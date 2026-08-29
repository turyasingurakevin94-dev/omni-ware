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
  console, Date, JSON, Math, Number, String, Array, Object, Map, Promise, Boolean,
  ...(over || {}),
});

const CHAIN = ['rivalPricesFor', 'rivalPriceLatest', 'ourPriceFor',
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
    t.check(/4,000 above yours/.test(html),
      'and the gap against OUR price — Kasese at 109,000 is 4,000 ABOVE our 105,000, which is exactly what turns "margin is thin" into "there is room to lift"');
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
    const rest = src.replace(extractFunction(src, 'rivalPricesFor', 'index.html'), '');
    eq((rest.match(/data\.rivalPrices \|\| \[\]/g) || []).length, 0,
      'and nothing else in the app reads the market rows on its own — two readings are two chances to disagree');

    t.check(/out\.other_shops_charge = rivals\.map/.test(src),
      'the product dossier carries what other shops charge, from that same reading');
    t.check(/if\(rivals\.length\) out\.other_shops_charge/.test(src),
      'and omits it entirely where nobody has looked, rather than sending an empty list that reads as "none are cheaper"');
  }

  /* ---------- 6. the rules ----------------------------------------- */
  {
    t.check(/WHAT OTHER SHOPS CHARGE\. This app knows what goods COST/.test(api),
      'the assistant is told the app knows costs and not what the competition charges');
    t.check(/write it down with add_rival_price; it changes none of their own prices/.test(api),
      'and to write down what it hears, with the reassurance that it changes no price of the shop’s own');
    t.check(/say the shop does not know rather than treating silence as evidence that nobody is cheaper/.test(api),
      'and that an absent record is ignorance, not evidence');

    const meeting = api.slice(api.indexOf('const MANAGER_MEETING = ['), api.indexOf('\n];', api.indexOf('const MANAGER_MEETING = [')));
    t.check(/PRICING HAS TWO SIDES/.test(meeting),
      'the manager is told a thin margin argues for lifting only if the line is not already the dearest');
    t.check(/at least one ask should be a rival\\u2019s price on a line that matters/.test(meeting),
      'and when margin is the objective it must go and ask for one');
    t.check(/Never treat an empty record as proof this shop is the cheapest: it is proof that nobody has looked/.test(meeting),
      'and it may never read an empty record as proof of being cheapest — the same law the screen keeps, kept in the manager’s mouth');

    t.check(/name: 'add_rival_price'/.test(api), 'the tool is offered to the model');
    t.check(/the only thing in this app that knows what a customer can pay elsewhere/.test(api),
      'described for what it is');
    t.check(/required: \['product_id', 'rival', 'price'\]/.test(api),
      'and it cannot be called without the line, the shop and the price');

    const tool = src.slice(src.indexOf('add_rival_price: {'), src.indexOf('add_supplier_price: {'));
    t.check(/confirm: true/.test(tool),
      'it CONFIRMS like every other write — nothing reaches the books without the owner’s tap');
    t.check(/ABOVE your|BELOW your/.test(tool),
      'and the card says how it compares with our own price, so the owner confirms a fact they can judge');

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
