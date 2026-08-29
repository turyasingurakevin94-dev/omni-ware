#!/usr/bin/env node
'use strict';
/*
 * What the shop down the road charges.
 *
 * This app has always known what goods COST. The price registry is a
 * record of suppliers; the buy plan ranks on what a line earned; the
 * kept-share says how thin it is. Not one of them knows what a customer
 * pays up the street — and that is the figure a pricing decision
 * actually turns on. "Margin is thin, lift the price" is only advice if
 * the line is not already dearer than the shop next door; if it is, the
 * fix was never the shelf, it was the supplier.
 *
 * Four laws, and the last is the one that keeps it honest:
 *
 *   AN OBSERVATION, NOT A PRICE LIST  nobody publishes what they
 *       charge. Each row is one thing somebody saw on one day, kept
 *       with its date, never overwritten. Two sightings of one shop are
 *       one competitor at its latest price.
 *   ONE READING  the screen, the dossier and the manager take the
 *       market from the same two functions, so they cannot disagree
 *       about what the shop knows.
 *   OUR OWN PRICE IS DERIVED  the comparison is against what this shop
 *       charges, taken through the same ladder every other selling
 *       price comes from — never a second opinion about ourselves.
 *   SILENCE IS NOT EVIDENCE  an empty record means nobody has looked.
 *       It must never read as "you are the cheapest", on the screen or
 *       in the manager's mouth, because that is the one wrong lesson
 *       this feature could teach.
 *
 * Run: node test/rival-prices.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('what rivals charge');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const makeData = () => ({
  products: [
    { id: 'P1', name: 'Runners Masasi', variants: [{ combo: { Size: '12' }, stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 5 }] },
    { id: 'P2', name: 'Self Drilling Screws', variants: [] },
    /* A line nobody has ever looked up. The empty state is the law this
       feature turns on, so it needs a line that genuinely has nothing. */
    { id: 'P3', name: 'Wall Angle', variants: [] },
    /* A second unchecked line, earning less. With only one, the order
       of the research list cannot be observed and a ranking by name
       would pass unnoticed. */
    { id: 'P4', name: 'Sofa Legs', variants: [] },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: 0, supplierId: 'S1', wholesale: 100000, retail: 106000,
      unit: 'Ctn', packQty: 1, packUnit: 'Ctn', tiers: [], outOfStock: false },
  ],
  presetDefaultMarkup: {},
  rivalPrices: [
    { id: 1, productId: 'P1', variantIdx: 0, rival: 'Haidery', price: 118000, unit: 'Ctn', seenOn: shift(TODAY, -3), note: 'shelf ticket' },
    { id: 2, productId: 'P1', variantIdx: 0, rival: 'Haidery', price: 124000, unit: 'Ctn', seenOn: shift(TODAY, -60), note: '' },
    { id: 3, productId: 'P1', variantIdx: 0, rival: 'Kasese Hardware', price: 109000, unit: 'Ctn', seenOn: shift(TODAY, -10), note: '' },
    { id: 4, productId: 'P1', variantIdx: null, rival: 'Wrong variant', price: 1, unit: '', seenOn: TODAY, note: '' },
    { id: 5, productId: 'P2', variantIdx: null, rival: 'Haidery', price: 4200, unit: 'Box', seenOn: TODAY, note: '' },
    { id: 6, productId: 'P1', variantIdx: 0, rival: '   ', price: 99000, unit: '', seenOn: TODAY, note: '' },
    { id: 7, productId: 'P1', variantIdx: 0, rival: 'Zero Shop', price: 0, unit: '', seenOn: TODAY, note: '' },
  ],
});

const env = (data, over) => ({
  data,
  todayISO: () => TODAY,
  daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
  apRound: (n) => Math.round(Number(n) || 0),
  supplierName: (id) => String(id),
  RIVAL_SIDES: ['wholesale', 'retail'],
  rivalPriceSideColumn: true,
  console, Date, JSON, Math, Number, String, Array, Object, Map, Promise, Boolean,
  ...(over || {}),
});

const CHAIN = ['rivalPricesFor', 'rivalPriceLatest', 'ourPriceFor', 'ourCostFor',
  'rivalSide', 'rivalSideSaid', 'rivalSideLabel',
  'rankedPurchaseRowsAtQty', 'rankedPriceRows', 'productPriceRows', 'purchasePriceAtQty',
  'tieredUnitPrice', 'tiersForKind',
  'suggestedStockSellingPrice', 'effectiveStockMarkupRule', 'effectiveMarkupRule'];

const build = (data, extraSrc, names, over) => compileScope(
  CHAIN.map((n) => extractFunction(src, n, 'index.html')).concat(extraSrc || []),
  env(data, over), (names || ['rivalPricesFor', 'rivalPriceLatest', 'ourPriceFor']));

/* ---------- 1. an observation, not a price list ---------------------- */
{
  const s = build(makeData());
  const all = s.rivalPricesFor('P1', 0);
  eq(all.length, 3, 'only sightings of THIS line count — a different variant is a different product');
  t.check(!all.some((r) => !String(r.rival).trim()), 'a sighting with no shop attached is nobody’s price');
  t.check(!all.some((r) => Number(r.price) <= 0), 'and a price of nothing is not a price');
  eq(all[0].seenOn, shift(TODAY, -3), 'newest first, because a fresh sighting outranks an old one');

  const latest = s.rivalPriceLatest('P1', 0);
  eq(latest.length, 2, 'one line per SHOP — Haidery quoted twice is one competitor, not two');
  eq(latest[0].rival, 'Kasese Hardware', 'cheapest first: the one the customer would go to');
  eq(latest[0].price, 109000, 'at their price');
  eq(latest[1].price, 118000, 'and Haidery at the price seen THREE days ago, not the one seen sixty days ago');
  eq(latest[1].daysOld, 3,
    'with how stale it is — a price from March and a price from yesterday are different facts and must never read the same');
  eq(latest[0].daysOld, 10, 'each carrying its own age');

  eq(s.rivalPricesFor('P2', null).length, 1, 'a line with one sighting has one');
  eq(s.rivalPriceLatest('P9', null).length, 0, 'and a line nobody has looked at has none');
}

/* ---------- 2. our own price is derived, never a second opinion ------- */
{
  const s = build(makeData());
  eq(s.ourPriceFor('P1', 0), 105000,
    'what THIS shop charges comes through the same ladder every other selling price does — cost plus the line’s own rule');
  eq(s.ourPriceFor('P2', null), null,
    'and a line with no supplier price on file has no derived price, rather than a guess');
  eq(s.ourPriceFor('P9', null), null, 'as does a product that does not exist');

  /* The gap is the whole point: Kasese at 109,000 against our 105,000
     says there is room to lift. Reverse it and lifting loses the sale. */
  const latest = s.rivalPriceLatest('P1', 0);
  t.check(latest.every((r) => r.price > s.ourPriceFor('P1', 0)),
    'here both rivals are dearer than us — which is what turns "margin is thin" into "there is room to lift"');
}

/* ---------- 3. writing one down ------------------------------------- */
(async () => {
  {
    const data = makeData();
    const inserted = [];
    const s = compileScope(
      CHAIN.map((n) => extractFunction(src, n, 'index.html'))
        .concat([extractFunction(src, 'addRivalPrice', 'index.html'),
          'function names(){ return { addRivalPrice, rivalPriceLatest }; }']),
      env(data, { currentShopId: 'shop-1',
        sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
          select: () => ({ single: () => Promise.resolve({ data: { id: 99 }, error: null }) }) }; } }) } }),
      ['names']).names();

    const ok = await s.addRivalPrice({ productId: 'P1', variantIdx: 0, rival: ' Haidery ', price: 117500.4, note: 'quoted to Milly' });
    eq(ok.ok, true, 'a sighting of a real line is kept');
    eq(inserted[0].rival, 'Haidery', 'the shop’s name, trimmed');
    eq(inserted[0].price, 117500, 'the price in whole shillings');
    eq(inserted[0].seen_on, TODAY, 'seen today unless the owner says otherwise');
    eq(inserted[0].product_id, 'P1', 'against the line it belongs to');
    eq(inserted[0].variant_idx, 0, 'and its variant');
    t.check(data.rivalPrices.some((r) => r.id === 99),
      'and it is kept locally too, so the screen that asked for it shows it NOW rather than after a reload');
    eq(s.rivalPriceLatest('P1', 0)[1].price, 117500,
      'the freshest sighting for that shop is immediately the one that counts');

    const dated = await s.addRivalPrice({ productId: 'P1', variantIdx: 0, rival: 'Kasese', price: 100, seenOn: '2026-07-01' });
    eq(dated.ok, true, 'a sighting can carry the day it was actually seen');
    eq(inserted[1].seen_on, '2026-07-01', 'and keeps it');
    const bad = await s.addRivalPrice({ productId: 'P1', variantIdx: 0, rival: 'Kasese', price: 100, seenOn: 'last Tuesday' });
    eq(inserted[2].seen_on, TODAY,
      'a date that is not a date becomes today rather than a row nobody can place in time');

    eq((await s.addRivalPrice({ productId: 'P1', variantIdx: 0, rival: '', price: 5 })).ok, false,
      'a price with no shop against it is refused — it would be a rumour on the record');
    eq((await s.addRivalPrice({ productId: 'P1', variantIdx: 0, rival: 'X', price: 0 })).ok, false,
      'and so is a price of nothing');
    eq((await s.addRivalPrice({ productId: 'P9', rival: 'X', price: 5 })).ok, false,
      'a line this shop does not sell is refused');
    eq((await s.addRivalPrice({ productId: 'P1', variantIdx: 7, rival: 'X', price: 5 })).ok, false,
      'and so is a variant it does not have');
  }

  /* The table may not be there yet, and must say so by name. */
  {
    const data = makeData();
    const s = compileScope(
      CHAIN.map((n) => extractFunction(src, n, 'index.html'))
        .concat([extractFunction(src, 'addRivalPrice', 'index.html')]),
      env(data, { currentShopId: 'shop-1',
        sb: { from: () => ({ insert: () => ({ select: () => ({ single: () => Promise.resolve({
          data: null, error: { message: 'relation "rival_prices" does not exist' } }) }) }) }) } }),
      ['addRivalPrice']);
    const r = await s.addRivalPrice({ productId: 'P1', variantIdx: 0, rival: 'Haidery', price: 118000 });
    eq(r.ok, false, 'without the table nothing is kept');
    t.check(/0087_rival_prices\.sql/.test(r.why),
      'and the failure names the migration that fixes it — a failure must name itself');
  }

  /* ---------- 4. the screen where the decision is made -------------- */
  {
    const data = makeData();
    const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
    const s = compileScope(
      CHAIN.map((n) => extractFunction(src, n, 'index.html'))
        .concat([extractFunction(src, 'renderRivalPrices', 'index.html')]),
      env(data, { rivalPricesTable: true,
        document: { getElementById: (id) => (id === 'rivalWrap' ? el : null) },
        esc: (x) => String(x == null ? '' : x) }),
      ['renderRivalPrices']);

    s.renderRivalPrices('P1', 0);
    const html = el.innerHTML;
    t.check(/What other shops charge/.test(html), 'the panel is DRAWN on the screen where the price rule is set');
    t.check(html.includes('Kasese Hardware') && html.includes('109,000'), 'with each shop and its price');
    t.check(html.includes('Haidery') && html.includes('118,000'), 'the freshest sighting for each');
    t.check(!html.includes('124,000'), 'and never the stale one it replaced');
    t.check(/seen 3 days ago/.test(html), 'each saying how old it is');
    t.check(/4,000 above your wholesale/.test(html),
      'and the gap against OUR price ON THAT SIDE — Kasese at 109,000 is 4,000 ABOVE our 105,000 wholesale, which is exactly what turns "margin is thin" into "there is room to lift", and naming the side is what stops a shelf ticket being weighed against a pack price');
    t.check(/You sell it at/.test(html) && html.includes('105,000'), 'with our own price said plainly');
    t.check(/rv_shop/.test(html) && /rv_price/.test(html), 'and a box to add what the owner saw');

    /* THE LAW THAT MATTERS. */
    s.renderRivalPrices('P3', null);
    const empty = el.innerHTML;
    t.check(/nobody has looked/.test(empty),
      'A LINE NOBODY HAS LOOKED AT SAYS SO — silence must never read as "you are the cheapest", which is the one wrong lesson this could teach');
    t.check(!/You sell it at/.test(empty), 'and a line with no price of its own claims none');

    /* Before the migration lands. */
    const s2 = compileScope(
      CHAIN.map((n) => extractFunction(src, n, 'index.html'))
        .concat([extractFunction(src, 'renderRivalPrices', 'index.html')]),
      env(data, { rivalPricesTable: false,
        document: { getElementById: (id) => (id === 'rivalWrap' ? el : null) },
        esc: (x) => String(x == null ? '' : x) }),
      ['renderRivalPrices']);
    s2.renderRivalPrices('P1', 0);
    t.check(/0087_rival_prices\.sql/.test(el.innerHTML),
      'and before the migration lands the panel names it rather than offering a box that swallows what is typed');
  }

  /* ---------- 5. one reading, and both minds get it ---------------- */
  {
    const editor = extractFunction(src, 'openPriceRuleEditor', 'index.html');
    t.check(/renderRivalPrices\(productId, variantIdx\)/.test(editor),
      'the pricing screen draws the market from the one reading');
    /* Three readings, each with one job, and NOTHING outside them
       touches the rows: everything for a line, the freshest per shop,
       and the whole market for the screen. A fourth reader would be a
       fourth chance to disagree about what the shop knows. */
    const READERS = ['rivalPricesFor', 'rivalNeverChecked', 'rivalMarketRows', 'addRivalPrice', 'deleteRivalPrice'];
    const rest = READERS.reduce((acc, fn) => acc.replace(extractFunction(src, fn, 'index.html'), ''), src);
    eq((rest.match(/data\.rivalPrices\b/g) || []).length, 0,
      'nothing outside the named readings touches the market rows — two readings are two chances to disagree');

    t.check(/out\.other_shops_charge = rivals\.map/.test(src),
      'the product dossier carries what other shops charge, from that same reading');
    t.check(/if\(rivals\.length\) out\.other_shops_charge/.test(src),
      'and omits it entirely where nobody has looked, rather than sending an empty list that reads as "none are cheaper"');
  }

  /* ---------- 5b. the market, laid out --------------------------- */
  {
    const data = makeData();
    /* P3 sells but nobody has ever checked it; P2 sells less and has a
       sighting. The worklist must put P3 first and leave P2 out. */
    data.savedQuotes = [{ id: 1, invoiced: true, voided: false, date: shift(TODAY, -5), items: [
      { productId: 'P3', variantIdx: null, qty: 10, supplierId: '__stock__', sellPrice: 20000, _stockLots: [{ qty: 10, cost: 8000 }] },
      { productId: 'P2', variantIdx: null, qty: 4, supplierId: '__stock__', sellPrice: 5000, _stockLots: [{ qty: 4, cost: 4000 }] },
      { productId: 'P4', variantIdx: null, qty: 6, supplierId: '__stock__', sellPrice: 9000, _stockLots: [{ qty: 6, cost: 6000 }] },
    ] }];
    const MARKET = ['rivalMarketRows', 'rivalNeverChecked', 'buyKeyParts', 'stockKey',
      'waSalesByKey', 'waDaysBetween', 'waWeekday', 'quoteItemSellPrice', 'invoiceLineCost',
      'quoteSuggestedPrice', 'quoteSuggestedStockPrice', 'getStockQty',
    'productPackInfo', 'productUnitLabel'];
    const s = compileScope(
      CHAIN.concat(MARKET).map((n) => extractFunction(src, n, 'index.html'))
        .concat([extractDeclaration(src, 'RIVAL_STALE_DAYS', 'index.html'),
          'function names(){ return { rivalMarketRows, rivalNeverChecked }; }']),
      env(data, {
        productDisplayLabel: (p, vi) => (vi == null ? p.name : `${p.name} 12"`),
        allProductVariantEntries: () => data.products.flatMap((p) => (p.variants && p.variants.length)
          ? p.variants.map((_v, i) => ({ p, variantIdx: i })) : [{ p, variantIdx: null }]),
      }), ['names']).names();

    const rows = s.rivalMarketRows(TODAY);
    /* Four: two shops on Masasi, one on the screws, and the fixture's
       bare-P1 row, which is a sighting against the product rather than
       against its variant and is its own line. */
    eq(rows.length, 4, 'one row per shop per line, across the whole market');
    const masasi = rows.filter((r) => r.key === 'P1::0');
    eq(masasi.length, 2, 'both shops on the same line');
    t.check(!masasi.some((r) => r.theirs === 124000),
      'and the stale sighting Haidery replaced is gone — the freshest of each pair, never both');
    eq(masasi.find((r) => r.shop === 'Kasese Hardware').gap, 4000,
      'each carrying the gap against OUR price, which is the comparison being made');
    eq(masasi.find((r) => r.shop === 'Kasese Hardware').stale, false, 'ten days old is not stale');

    /* Staleness, at the mark and past it. */
    data.rivalPrices.push({ id: 20, productId: 'P2', variantIdx: null, rival: 'Old Shop',
      price: 4000, unit: '', seenOn: shift(TODAY, -91), note: '' });
    const withStale = s.rivalMarketRows(TODAY).find((r) => r.shop === 'Old Shop');
    eq(withStale.stale, true, 'a sighting older than the stale mark says so');
    eq(withStale.daysOld, 91, 'with its age, so the screen can show it rather than assert it');

    const never = s.rivalNeverChecked(TODAY);
    eq(never.length, 2, 'only lines that SELL and have nothing on file are worth a walk');
    eq(never[0].line, 'Wall Angle',
      'WORTH FIRST: Wall Angle earned 120,000 and Sofa Legs 18,000, so Wall Angle leads — by name it would be the other way round, and the whole point is to say where to walk first');
    eq(never[1].line, 'Sofa Legs', 'and the smaller earner follows');
    eq(never[0].earned30, 120000, 'ranked on what it earned in 30 days — the buy plan’s own ranking');
    t.check(!never.some((n) => n.key === 'P2'),
      'a line already checked is not on the list, however little is known about it');
    t.check(!never.some((n) => n.key === 'P1::0'), 'nor one with two shops on file');
  }

  /* ---------- 5c. removing a sighting, never rewriting one -------- */
  {
    const data = makeData();
    const deleted = [];
    const toasts = [];
    let confirmed = true;
    const s = compileScope(
      [extractFunction(src, 'deleteRivalPrice', 'index.html')],
      { data, currentShopId: 'shop-1', confirm: () => confirmed,
        toast: (m) => toasts.push(m), renderMarket: () => {},
        sb: { from: () => ({ delete: () => ({ eq: () => ({ eq: (c, v) => { deleted.push(v); return Promise.resolve({ error: null }); } }) }) }) },
        console, Promise, Number, String, Array, Object },
      ['deleteRivalPrice']);

    /* AWAITED, never returned. Written as `return …then(…)` this
       returned from the whole async block and every section after it
       silently never ran — three checks that read as passing were not
       being executed at all. */
    await s.deleteRivalPrice(3);
    eq(deleted[0], 3, 'a sighting can be REMOVED — a mistyped price must not be permanent');
    t.check(!data.rivalPrices.some((r) => r.id === 3), 'and it leaves the shop’s own copy at once');
    confirmed = false;
    await s.deleteRivalPrice(1);
    eq(deleted.length, 1, 'and a refused confirmation removes nothing');
    /* THE LAW: no edit path anywhere. */
    t.check(!/rival_prices'\)\s*\.update/.test(src),
      'NOTHING UPDATES A SIGHTING IN PLACE — editing one would quietly rewrite what this shop recorded as seen, and every argument the manager makes from this table rests on that not happening');
    t.check(/deleted, not corrected/.test(src),
      'and the owner is told so in those words when they remove one');
  }

  /* ---------- 6. the rules ----------------------------------------- */
  {
    t.check(/WHAT OTHER SHOPS CHARGE\. This app knows what goods COST/.test(api),
      'the assistant is told the app knows costs and not what the competition charges');
    t.check(/write it down with record_rival_prices \\u2014 one call carrying every line they mentioned/.test(api),
      'and to write down what it hears in ONE call carrying every line — research does not happen a price at a time');
    t.check(/A QUOTATION FROM ANOTHER SHOP IS NOT A SUPPLIER PRICE/.test(api),
      'A COMPETITOR’S QUOTE IS NEVER A SUPPLIER PRICE: without this the assistant reads a photographed quotation as an offer to this shop');
    t.check(/would cost every line in the buying plan from a figure nobody will ever sell to this shop at/.test(api),
      'with the damage said plainly — the registry is what this shop PAYS, and poisoning it costs every buy');
    t.check(/If you cannot tell which it is, ask before you write/.test(api),
      'and where it is genuinely unclear, it asks rather than guessing');
    t.check(/one taken months back is weak evidence and is worth saying so and re-checking/.test(api),
      'a sighting from months ago is weak evidence, never quoted as if seen yesterday');
    t.check(/say the shop does not know rather than treating silence as evidence that nobody is cheaper/.test(api),
      'and that an absent record is ignorance, not evidence');

    const meeting = api.slice(api.indexOf('const MANAGER_MEETING = ['), api.indexOf('\n];', api.indexOf('const MANAGER_MEETING = [')));
    t.check(/PRICING HAS TWO SIDES/.test(meeting),
      'the manager is told a thin margin argues for lifting only if the line is not already the dearest');
    t.check(/at least one ask should be a rival\\u2019s price on a line that matters/.test(meeting),
      'and when margin is the objective it must go and ask for one');
    t.check(/Never treat an empty record as proof this shop is the cheapest: it is proof that nobody has looked/.test(meeting),
      'and it may never read an empty record as proof of being cheapest — the same law the screen keeps, kept in the manager’s mouth');

    t.check(/name: 'record_rival_prices'/.test(api), 'the tool is offered to the model');
    t.check(/the only thing in this app that knows what a customer can pay elsewhere/.test(api),
      'described for what it is');
    t.check(/required: \['rival', 'items'\]/.test(api),
      'and it cannot be called without the shop and at least one line');
    t.check(/maxItems: 10/.test(api),
      'bounded at ten lines a call — a round of the market, not an import');

    const tool = src.slice(src.indexOf('record_rival_prices: {'), src.indexOf('add_supplier_price: {'));
    t.check(/confirm: true/.test(tool),
      'it CONFIRMS like every other write — nothing reaches the books without the owner’s tap');
    t.check(/above your|below your/.test(tool),
      'and the card says how each line compares with our own price, so the owner confirms facts they can judge');

    const mig = read('supabase/migrations/0087_rival_prices.sql');
    t.check(/create table rival_prices/.test(mig), '0087 creates the table');
    t.check(/check \(price > 0\)/.test(mig), 'a price of nothing is refused by the database too');
    t.check(/owner writes only/.test(mig) && /owner updates only/.test(mig) && /owner only deletes/.test(mig),
      'and it carries the same three owner-only restrictions every other books table has — a rival price argues for changing a price, so it is not a staff write');
    t.check(/seen_on date not null/.test(mig),
      'every row carries the day it was seen: a price with no date is a rumour');
  }
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
