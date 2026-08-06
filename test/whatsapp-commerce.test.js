#!/usr/bin/env node
'use strict';
/*
 * WhatsApp commerce (phase 3): the catalog goes out, carts come back.
 *
 * The catalog is the shop window: every product with a photo and a
 * RETAIL price -- the same gates the daily picks use, priced by the
 * same rules the printed catalogue proves -- keyed by the app's own
 * stock keys, which is what lets a cart walk straight back to the
 * product when the order arrives.
 *
 * The claims that matter:
 *
 *   A CART BECOMES AN ORDER EXACTLY ONCE. Meta retries webhooks; the
 *   unique wamid answers a duplicate with an empty insert, and the
 *   empty insert means no second order.
 *
 *   THE ORDER HONOURS THE CART. Lines carry the price the catalog
 *   promised at cart time, not whatever the price is now -- a stale
 *   catalog is the admin's problem to see, never the customer's
 *   surprise to receive.
 *
 *   NOTHING VANISHES SILENTLY. A retailer id that matches no product
 *   becomes a NAMED unknown line; a product the shop no longer offers
 *   is DELETED from the catalog, not left on sale.
 *
 * Run: node test/whatsapp-commerce.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp commerce');
const src = read('index.html');
const hookSrc = read('supabase/functions/wa-webhook/index.ts');
const sendSrc = read('supabase/functions/wa-send/index.ts');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the cart walks back to the products ------------------- */
{
  let hook = null; let err = null;
  try {
    hook = compileScope([extractFunction(hookSrc, 'waOrderLines', 'wa-webhook')],
      {}, ['waOrderLines'], { typescript: true });
  } catch (e) { err = e; }
  t.check(!!hook, `waOrderLines compiles${err ? ` (${err.message})` : ''}`);
  if (hook) {
    const productsById = new Map([
      ['P017', { id: 'P017', name: 'Sofa Leg', variants: [{ combo: { Colour: 'Gold', Size: '4"' } }] }],
      ['P001', { id: 'P001', name: 'Hinge', variants: [] }],
    ]);
    const lines = hook.waOrderLines([
      { product_retailer_id: 'P017::0', quantity: 2, item_price: 203000, currency: 'UGX' },
      { product_retailer_id: 'P001', quantity: 5, item_price: 9000 },
      { product_retailer_id: 'GHOST-9', quantity: 1, item_price: 500 },
      { product_retailer_id: 'P001', quantity: 0, item_price: 9000 },   // zero qty: not a line
      { quantity: 3, item_price: 100 },                                  // no id: not a line
    ], productsById);

    eq(lines.length, 3, 'three real lines; zero-qty and id-less fragments are dropped');
    eq(lines[0].productId, 'P017', 'a variant retailer id walks back to its product');
    eq(lines[0].variantIdx, 0, 'and to the right variant');
    eq(lines[0].productName, 'Sofa Leg — Gold / 4"', 'named the way the shop names it');
    eq(lines[0].qty, 2, 'with the quantity the customer chose');
    eq(lines[0].sellPrice, 203000, 'at the price the CATALOG promised — not recomputed');
    eq(lines[1].variantIdx, null, 'a simple product is null, not variant zero');
    t.check(/UNKNOWN ITEM \(GHOST-9\)/.test(lines[2].productName),
      'a retailer id matching nothing becomes a NAMED unknown line');
    eq(lines[2].unknownRetailerId, 'GHOST-9', 'carrying the id for the admin to chase');
    eq(lines[2].qty, 1, 'with its quantity intact');
  }
}

/* ---------- 2. the catalog diff -------------------------------------- */
{
  let send = null; let err = null;
  try {
    send = compileScope([extractFunction(sendSrc, 'catalogDiff', 'wa-send')],
      {}, ['catalogDiff'], { typescript: true });
  } catch (e) { err = e; }
  t.check(!!send, `catalogDiff compiles${err ? ` (${err.message})` : ''}`);
  if (send) {
    const d = send.catalogDiff(['P001', 'P002', 'P017::0'], [
      { retailerId: 'P001' }, { retailerId: 'P017::0' }, { retailerId: 'P099' },
    ]);
    eq(JSON.stringify(d.toDelete), '["P002"]',
      'what the shop no longer offers comes OFF the shop window');
  }
}

/* ---------- 3. what the shop lists ----------------------------------- */
{
  const sellFixture = new Map(); const basisAsked = [];
  const env = {
    data: { products: [], presetCategories: [] },
    catalogueSellAtQty: (p, idx, qty, basis) => {
      basisAsked.push(basis);
      return sellFixture.get(p.id + (idx==null ? '' : '::'+idx)) || null;
    },
    productVariantLabel: (p, idx) => idx==null ? p.name : `${p.name} — v${idx}`,
  };
  let scope = null; let err = null;
  try {
    scope = compileScope([
      extractFunction(src, 'waCatalogItems', 'index.html'),
      extractFunction(src, 'waOrderSummary', 'index.html'),
      extractFunction(src, 'stockKey', 'index.html'),
      extractFunction(read('shared-worker.js'), 'resolveProductImage', 'shared-worker.js'),
    ], env, ['waCatalogItems', 'waOrderSummary']);
  } catch (e) { err = e; }
  t.check(!!scope, `the client commerce helpers compile${err ? ` (${err.message})` : ''}`);
  if (scope) {
    env.data.products = [
      { id: 'P1', name: 'Cement', type: 'simple', image: 'u1' },
      { id: 'P2', name: 'Faceless', type: 'simple', image: null },
      { id: 'P3', name: 'Priceless', type: 'simple', image: 'u3' },
      { id: 'P4', name: 'Sofa Leg', type: 'variable', image: null,
        variants: [{ combo: { Size: '4"' }, image: 'u4' }] },
      { id: 'P5', name: 'Empty variable', type: 'variable', variants: [] },
    ];
    sellFixture.set('P1', { price: 45000.4, unit: 'bag' });
    // Priceable on purpose: if the photo gate slips, nothing else stops
    // the photoless product reaching the catalog.
    sellFixture.set('P2', { price: 7000, unit: 'pc' });
    sellFixture.set('P4::0', { price: 203000, unit: 'ctn' });

    const { items, gaps } = scope.waCatalogItems();
    eq(items.length, 2, 'listed: everything with a photo AND a retail price, nothing else');
    eq(items[0].retailerId, 'P1', 'a simple product is keyed by its bare id');
    eq(items[1].retailerId, 'P4::0', 'a variant by its stock key — the id a cart walks back on');
    eq(items[0].price, 45000, 'prices are whole shillings, rounded');
    eq(items[0].description, 'Sold per bag', 'the unit rides as the description');
    t.check(gaps.noPhoto.includes('Faceless'), 'the missing photo is NAMED');
    t.check(gaps.noPrice.includes('Priceless'), 'and so is the missing price');
    t.check(basisAsked.every((b) => b === 'retail'),
      'every price the catalog asks for is the RETAIL one — the approved decision');

    const sum = scope.waOrderSummary({ order: { product_items: [
      { quantity: 2, item_price: 203000 }, { quantity: 5, item_price: 9000 },
    ] } });
    t.check(sum.includes('7 items'), 'the summary counts UNITS across lines');
    t.check(sum.includes('451,000'), 'and totals what the cart promised');
    t.check(scope.waOrderSummary({ order: { product_items: [{ quantity: 1, item_price: 5 }] } })
      .includes('1 item ·'), 'one item is singular');
  }
}

/* ---------- 4. all of it is REACHED ---------------------------------- */
{
  /* Exactly-once: the order is created only when the message row was
     NEWLY inserted -- a duplicate bounces off the unique wamid and the
     empty insert means no second order. */
  t.check(/ignoreDuplicates: true \}\)\.select\("id"\);/.test(hookSrc),
    'the message insert reports whether it actually landed');
  t.check(/ev\.type === "order" && orderPayload && \(landed \?\? \[\]\)\.length > 0/.test(hookSrc),
    'and a cart becomes an order only on a fresh landing');

  const createFn = extractFunction(hookSrc, 'createWaOrder', 'wa-webhook');
  t.check(/originWa: true,\s*\n\s*originWamid: wamid,/.test(createFn),
    'the order remembers which cart message it came from');
  t.check(/status: "draft",/.test(createFn) && !/\bid:/.test(createFn.slice(createFn.indexOf('.insert('), createFn.indexOf('.select("id")'))),
    'inserted as a draft with no explicit id — the identity column assigns, like agent orders');
  t.check(/Order no\. \$\{inserted\.id\}/.test(createFn),
    'the confirmation quotes the order number the customer can call about');
  t.check(/confirmation record failed AFTER delivery/.test(createFn),
    'a bookkeeping failure after the confirmation went out is reported as such');

  /* The catalog sync. */
  t.check(/price: `\$\{Math\.round\(it\.price\)\} UGX`,/.test(sendSrc),
    'prices ride as feed-style strings — no cents arithmetic on a zero-decimal currency');
  t.check(/\.\.\.toDelete\.map\(\(id\) => \(\{ method: "DELETE", data: \{ id \} \}\)\),/.test(sendSrc),
    'orphans are deleted from the catalog, not left on sale');
  t.check(/method: "UPDATE",/.test(sendSrc), 'and desired items ride as upserts');
  t.check(/catalogId = numRow\?\.catalog_id;/.test(sendSrc),
    'the catalog id comes from the stored connection, not the request');

  /* The client. */
  t.check(/action: 'catalog-sync', items \}/.test(src),
    'the sync button sends the computed items through the edge function');
  t.check(/esc\(m\.msg_type==='order' \? waOrderSummary\(m\.payload\) : \(m\.body \|\| '\['\+m\.msg_type\+'\]'\)\)/.test(src),
    'an order message renders as its summary in the thread');
  t.check(/update\(\{ catalog_id: v \}\)\.eq\('shop_id', currentShopId\)/.test(src),
    'saving the catalog id updates the shop\'s own connection row');

  /* The catalog card pushed into a chat: same gate as a text reply. */
  const catBlock = (/action === "send-catalog"[\s\S]*?action === "send"/.exec(sendSrc) || [''])[0];
  t.check(/type: "catalog_message",/.test(catBlock) && /name: "catalog_message",/.test(catBlock),
    'the card is a real interactive catalog message');
  t.check(/whatsapp_commerce_settings\?is_cart_enabled=true&is_catalog_visible=true/.test(catBlock),
    'the number\'s commerce settings are ensured on every send — they gate the storefront icon too');
  t.check(/thumbnail_product_retailer_id: thumbId/.test(catBlock)
    && /type: "product_list",/.test(catBlock),
    'a thumbnail rides along, and a refusal falls back to an explicit product list');
  t.check(catBlock.indexOf('windowState(conv.last_inbound_at') > -1
    && catBlock.indexOf('windowState(conv.last_inbound_at') < catBlock.indexOf('fetch(`${GRAPH_BASE}'),
    'and the window is checked before any bytes go to Meta, same as a reply');
  t.check(/action: 'send-catalog', conversationId: waInbox\.active/.test(src),
    'the Catalog button sends it into the OPEN conversation');

  /* Learned live on order 151: the client sync mapping rebuilds the
     quote payload from NAMED keys, and any key not named is stripped on
     the first admin edit. The wa origin fields must be in the list, the
     same preservation contract the agent fields already carry. */
  t.check(/originWa:q\.originWa, originWamid:q\.originWamid\}/.test(src),
    'an admin re-save never strips what wa-webhook set on the order');
}

process.exit(t.done() ? 1 : 0);
