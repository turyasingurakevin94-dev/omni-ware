#!/usr/bin/env node
'use strict';
/*
 * Where the market is costing you.
 *
 * Three builds went into the market record -- the table, the screen,
 * the Manager's questions that fill it -- and the app still could not
 * say where any of it HURT. Every sighting was one row with a gap
 * beside it, grouped by shop, ordered by how recently somebody looked.
 * So 200 shillings on a line sold twice a year sat next to 7,000 on the
 * best earner and read the same.
 *
 * What separates them is VOLUME. This is the arithmetic Supplier prices
 * already does to a supplier's rise, turned round to face the customer.
 *
 * Four laws:
 *
 *   COMPARE LIKE WITH LIKE, OR DO NOT COMPARE  our own price is always
 *       per base unit; a sighting carries whatever unit a person said.
 *       "118,000 a carton" against a per-piece price of 9,000 is not a
 *       gap of 109,000. A pack unit is divided down and the row shows
 *       its working; anything else is NOT COMPARED, and counted out
 *       loud rather than dropped.
 *   VOLUME DECIDES THE ORDER  the ranking is gap x what the shop
 *       actually sold in thirty days. A line that sold nothing has
 *       nothing at stake and is not here at all.
 *   THE CHEAPEST RIVAL IS THE ONE THAT MATTERS  three shops on one line
 *       are not three arguments. The customer walks to the cheapest,
 *       and the cheapest is also the ceiling to lift towards.
 *   AT STAKE, NEVER LOST  being dearer does not take money out of the
 *       till; it risks the sale. The figure is said as the customer's
 *       own arithmetic, and the lifting side states the assumption it
 *       rests on -- that the volume holds -- because nothing here can
 *       promise it.
 *
 * Run: node test/market-verdict.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('where the market is costing you');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const pct = (v) => ({ stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: v });

const makeData = () => ({
  products: [
    { id: 'P1', name: 'Runners Masasi', type: 'variable', variants: [{ combo: { Size: '12' }, ...pct(5) }] },
    /* Priced by the piece and sold by the box: the line the whole
       unit question turns on. */
    { id: 'P2', name: 'Self Drilling Screws', variants: [], ...pct(10) },
    { id: 'P3', name: 'Wall Angle', variants: [], ...pct(10) },
    { id: 'P4', name: 'Sofa Legs', variants: [], ...pct(10) },
    { id: 'P5', name: 'Door Handle', variants: [], ...pct(10) },
    { id: 'P6', name: 'Nails', variants: [], ...pct(10) },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: 0, supplierId: 'S1', wholesale: 100000, retail: 106000, unit: 'Ctn', packQty: 1, packUnit: 'Ctn', tiers: [] },
    { id: 2, productId: 'P2', variantIdx: null, supplierId: 'S1', wholesale: 900, retail: 1000, unit: 'Pc', packQty: 12, packUnit: 'Box', tiers: [] },
    { id: 3, productId: 'P3', variantIdx: null, supplierId: 'S1', wholesale: 20000, retail: 21000, unit: 'Pc', packQty: 1, packUnit: 'Pc', tiers: [] },
    { id: 4, productId: 'P4', variantIdx: null, supplierId: 'S1', wholesale: 5000, retail: 5500, unit: 'Pc', packQty: 4, packUnit: 'Ctn', tiers: [] },
    { id: 5, productId: 'P5', variantIdx: null, supplierId: 'S1', wholesale: 10000, retail: 11000, unit: 'Pc', packQty: 1, packUnit: 'Pc', tiers: [] },
    /* P6 has none: a line the shop sells with no price of its own. */
  ],
  presetDefaultMarkup: {},
  rivalPrices: [
    { id: 1, productId: 'P1', variantIdx: 0, rival: 'Haidery', price: 118000, unit: 'Ctn', seenOn: shift(TODAY, -3), note: '' },
    { id: 2, productId: 'P1', variantIdx: 0, rival: 'Kasese Hardware', price: 100000, unit: 'Ctn', seenOn: shift(TODAY, -5), note: '' },
    { id: 3, productId: 'P2', variantIdx: null, rival: 'Haidery', price: 12000, unit: 'Box', seenOn: shift(TODAY, -2), note: 'a quotation' },
    { id: 4, productId: 'P3', variantIdx: null, rival: 'Zauja', price: 25000, unit: '', seenOn: shift(TODAY, -95), note: '' },
    { id: 5, productId: 'P3', variantIdx: null, rival: 'Haidery', price: 30000, unit: '', seenOn: shift(TODAY, -1), note: '' },
    { id: 6, productId: 'P4', variantIdx: null, rival: 'Haidery', price: 30000, unit: 'Bag', seenOn: TODAY, note: '' },
    { id: 7, productId: 'P5', variantIdx: null, rival: 'Kasese Hardware', price: 9000, unit: '', seenOn: TODAY, note: '' },
    { id: 8, productId: 'P6', variantIdx: null, rival: 'Haidery', price: 5000, unit: '', seenOn: TODAY, note: '' },
  ],
  savedQuotes: [{ id: 1, invoiced: true, voided: false, date: shift(TODAY, -5), items: [
    { productId: 'P1', variantIdx: 0, qty: 4, packQty: 1, supplierId: '__stock__', sellPrice: 105000, _stockLots: [{ qty: 4, cost: 100000 }] },
    { productId: 'P2', variantIdx: null, qty: 500, packQty: 12, supplierId: '__stock__', sellPrice: 1100, _stockLots: [{ qty: 500, cost: 900 }] },
    { productId: 'P3', variantIdx: null, qty: 10, packQty: 1, supplierId: '__stock__', sellPrice: 22000, _stockLots: [{ qty: 10, cost: 20000 }] },
    { productId: 'P4', variantIdx: null, qty: 3, packQty: 4, supplierId: '__stock__', sellPrice: 5500, _stockLots: [{ qty: 3, cost: 5000 }] },
    { productId: 'P6', variantIdx: null, qty: 20, supplierId: '__stock__', sellPrice: 5500, _stockLots: [{ qty: 20, cost: 4000 }] },
  ] }],
});

const env = (data, over) => ({
  // productPackInfo reads the shelf's own unit now (stockUnitFor).
  cmpUnitKey: (s) => String(s || '').trim().toLowerCase(),
  data,
  todayISO: () => TODAY,
  daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
  apRound: (n) => Math.round(Number(n) || 0),
  supplierName: (id) => String(id),
  RIVAL_SIDES: ['wholesale', 'retail'],
  rivalPriceSideColumn: true,
  /* The Rivals side draws the layer's card: a thumb and marks these
     checks never argue about. */
  productThumbHTML: () => '', fmtPriceCompact: (n) => Number(n || 0).toLocaleString('en-US'),
  ICON_STORE: '', ICON_TREND_UP: '', ICON_TREND_DOWN: '', ICON_CLOCK: '', ICON_WARN: '',
  productDisplayLabel: (p, vi) => (vi == null ? p.name : `${p.name} 12"`),
  allProductVariantEntries: () => data.products.flatMap((p) => (p.variants && p.variants.length)
    ? p.variants.map((_v, i) => ({ p, variantIdx: i })) : [{ p, variantIdx: null }]),
  console, Date, JSON, Math, Number, String, Array, Object, Map, Set, Promise, Boolean,
  ...(over || {}),
});

const CHAIN = ['rivalPricesFor', 'rivalPriceLatest', 'ourPriceFor', 'ourCostFor',
  'rivalSide', 'rivalSideSaid', 'rivalSideLabel',
  'rankedPurchaseRowsAtQty', 'rankedPriceRows', 'productPriceRows', 'purchasePriceAtQty',
  'tieredUnitPrice', 'tiersForKind', 'stockUnitFor', 'productPackInfo', 'productUnitLabel',
  'suggestedStockSellingPrice', 'effectiveStockMarkupRule', 'effectiveMarkupRule',
  'rivalMarketRows', 'rivalNeverChecked', 'marketVerdict', 'buyKeyParts', 'stockKey',
  'waSalesByKey', 'waDaysBetween', 'waWeekday', 'quoteItemSellPrice', 'invoiceLineCost',
  'quoteSuggestedPrice', 'quoteSuggestedStockPrice', 'stockOnHand', 'getStockQty',
  'priceRuleForTarget', 'setStockPriceRule'];

const build = (data, extraSrc, names, over) => compileScope(
  CHAIN.map((n) => extractFunction(src, n, 'index.html'))
    .concat([extractDeclaration(src, 'RIVAL_STALE_DAYS', 'index.html'),
      extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html'),
      extractFunction(src, 'targetMarginPct', 'index.html')])
    .concat(extraSrc || []),
  env(data, over), names);

(async () => {

/* ---------- 1. compare like with like, or do not compare ------------- */
{
  const data = makeData();
  const s = build(data, [], ['rivalMarketRows', 'ourPriceFor']);
  const rows = s.rivalMarketRows(TODAY);
  const by = (shop, key) => rows.find((r) => r.shop === shop && r.key === key);

  eq(s.ourPriceFor('P2', null), 1100, 'we price the screws by the piece');
  const box = by('Haidery', 'P2');
  eq(box.theirsSaid, 12000, 'the sighting keeps what was actually seen — a box at 12,000');
  eq(box.theirs, 1000,
    'and is DIVIDED DOWN to the piece before anything compares it — without this the gap is 10,900 and every reading built on it is nonsense');
  eq(box.packQty, 12, 'carrying the pack it divided by');
  eq(box.packUnit, 'Box', 'and what that pack is called, so the row can show its working');
  eq(box.gap, -100, 'so the gap is 100 a piece, which is the figure a price decision turns on');
  eq(box.comparable, true, 'a pack unit we know how to convert is comparable');

  const bag = by('Haidery', 'P4');
  eq(bag.comparable, false,
    'a unit that is neither ours nor our pack cannot be compared — a Bag is not a Pc and not a Ctn');
  eq(bag.gap, null, 'so it carries NO gap rather than a wrong one');
  eq(bag.saidUnit, 'Bag', 'while saying what was recorded');
  eq(bag.ownUnit, 'Pc', 'and what we price in, so the screen can say why');

  const ctn = by('Kasese Hardware', 'P1::0');
  eq(ctn.theirs, 100000, 'a unit that matches ours is taken as it stands');
  eq(ctn.packQty, 0, 'with nothing to show, because nothing was converted');
  eq(ctn.gap, -5000, 'and the gap is the plain difference');

  /* ONE READING. The ranking and the record underneath it are the same
     list read twice, so they cannot disagree about the market. */
  const verdictSrc = extractFunction(src, 'marketVerdict', 'index.html');
  t.check(/rivalMarketRows\(/.test(verdictSrc) && !/data\.rivalPrices/.test(verdictSrc),
    'the verdict is derived from the one reading and never from the raw rows — a second opinion about the market is how two screens end up arguing');

  const bare = by('Haidery', 'P6');
  eq(bare.comparable, true, 'a sighting with no unit at all is in our own basis — that is what a person typing into a screen showing our price means');
  eq(bare.gap, null, 'though with no price of our own there is still nothing to compare');

  /* A UNIT NOBODY RECORDED IS NOT A UNIT THAT MATCHES.
   *
   * The gate used to read `!saidUnit || converts || !ownUnit || same(...)`
   * — so when the PRODUCT had no unit on file, any sighting was waved
   * through whatever it was priced in. A carton price against a per-piece
   * line entered the ranking, the money-at-stake, and a button that
   * writes a selling price; and the unit the person had typed was never
   * even shown, because the row only prints it on the not-comparable
   * branch. The assistant's own tool invites that unit ("Per what, when
   * the owner says: Ctn, Box, Pc"), so it arrives from voice too.
   */
  const noUnitProduct = JSON.parse(JSON.stringify(data));
  noUnitProduct.prices = (noUnitProduct.prices || []).map((r) =>
    (r.productId === 'P2' ? { ...r, unit: '', packUnit: '', packQty: 0 } : r));
  const s2 = build(noUnitProduct, [], ['rivalMarketRows']);
  const blind = s2.rivalMarketRows(TODAY).find((r) => r.shop === 'Haidery' && r.key === 'P2');
  eq(blind.comparable, false,
    'a Box sighting on a line the shop prices in nothing-recorded is NOT comparable — not knowing our own unit is not the same as knowing it matches');
  eq(blind.gap, null, 'so it carries no gap, and cannot reach the ranking or the button');
  eq(blind.saidUnit, 'Box', 'while still saying what was recorded, so the screen can explain itself');
}

/* ---------- 2. the two sides, one row per line ----------------------- */
{
  const v = build(makeData(), [], ['marketVerdict']).marketVerdict(TODAY);

  eq(v.under.length, 2, 'the lines a rival undercuts us on');
  eq(v.lift.length, 1, 'and the lines where every shop we checked is dearer');

  const p1 = v.under.find((x) => x.key === 'P1::0');
  eq(p1.shop, 'Kasese Hardware',
    'THE CHEAPEST RIVAL, not the dearest: Haidery is 13,000 above us on the same line, and the customer walks to Kasese');
  eq(p1.theirs, 100000, 'at their price');
  eq(p1.ours, 105000, 'against ours, derived through the same ladder as every other selling price');
  eq(p1.gap, -5000, 'so we are 5,000 dearer');
  eq(v.under.filter((x) => x.key === 'P1::0').length, 1,
    'and two shops on one line make ONE row — three sightings are not three arguments');

  const p3 = v.lift[0];
  eq(p3.line, 'Wall Angle', 'the line where we are cheapest');
  eq(p3.shop, 'Zauja', 'measured against the cheapest of them, which is the ceiling to lift towards');
  eq(p3.gap, 3000, 'by 3,000');
  eq(p3.atStake, 30000, 'worth 30,000 a month at the volume we already sell');
  eq(p3.stale, true, 'and it is a 95-day-old sighting, which the row must say before anyone acts on it');
  eq(p3.daysOld, 95, 'with its age');
}

/* ---------- 3. volume decides the order ------------------------------ */
{
  const v = build(makeData(), [], ['marketVerdict']).marketVerdict(TODAY);

  eq(v.under[0].key, 'P2',
    'WORST FIRST BY WHAT IS AT STAKE: the screws are only 100 a piece dearer, but 500 went out the door — ranked on the gap alone they would come second and the owner would walk to the wrong problem');
  eq(v.under[0].atStake, 50000, '100 a piece across 500 pieces');
  eq(v.under[1].key, 'P1::0', 'and the bigger gap on the smaller seller follows');
  eq(v.under[1].atStake, 20000, '5,000 across 4 cartons');
  t.check(v.under[0].atStake > v.under[1].atStake, 'in that order, by money');
  eq(v.atStake, 70000, 'and the strip totals what is at stake across them');
  eq(v.under[0].units30, 500, 'each carrying the volume the figure rests on, so it can be shown rather than asserted');
}

/* ---------- 4. what is left out, and said out loud ------------------- */
{
  const data = makeData();
  const v = build(data, [], ['marketVerdict']).marketVerdict(TODAY);

  t.check(!v.under.some((x) => x.key === 'P5') && !v.lift.some((x) => x.key === 'P5'),
    'a line that sold NOTHING in thirty days has nothing at stake, however cheap the shop up the road is');
  t.check(!v.under.some((x) => x.key === 'P6') && !v.lift.some((x) => x.key === 'P6'),
    'and a line with no price of our own is not compared to anything');
  t.check(!v.under.some((x) => x.key === 'P4') && !v.lift.some((x) => x.key === 'P4'),
    'nor is a sighting in a unit we cannot convert');
  eq(v.notCompared, 1,
    'but that one is COUNTED — dropping it silently is how a record starts lying about how much it knows');

  /* A line with no price of our own is not a unit problem and must not
     be reported as one. */
  data.rivalPrices = data.rivalPrices.filter((r) => r.productId !== 'P4');
  eq(build(data, [], ['marketVerdict']).marketVerdict(TODAY).notCompared, 0,
    'and the count is of units that disagree, not of everything that fell out');
}

/* ---------- 5. the screen says the answer before the evidence -------- */
{
  const data = makeData();
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const paged = [];
  const s = build(data, [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket'], {
    rivalPricesTable: true,
    document: { getElementById: (id) => (id === 'mk_body' ? el : null) },
    esc: (x) => String(x == null ? '' : x),
    listPageSlice: (id, rows) => { paged.push(id); return rows.slice(0, 5); },
    listMoreButtonHTML: () => '',
    mkGroupBy: 'shop', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
  });
  s.renderMarket();
  const html = el.innerHTML;

  t.check(paged.includes('marketUnder') && paged.includes('marketLift') && paged.includes('market'),
    'all three lists are paged, each under its own name — one id shared between two lists pages them together');
  t.check(/Where they are cheaper than you/.test(html), 'the screen names where a rival undercuts us');
  t.check(/Where you are cheapest/.test(html), 'and where every shop we checked is dearer');
  t.check(html.indexOf('Where they are cheaper') < html.indexOf('rv-groups'),
    'ABOVE the record: the answer first, the evidence under it');
  t.check(/at stake this month/.test(html) && html.includes('70,000'),
    'with what it comes to across the lot, in the strip');

  /* ZERO IS ONLY GOOD NEWS IF SOMEBODY LOOKED.
   *
   * `never checked` counts lines sold in the last 30 days with no
   * sighting on file — so a shop that has invoiced nothing for a month
   * scores 0 and the strip painted it GREEN, directly above an empty
   * state saying nothing has been recorded. A green nought reads as "the
   * market is checked", which is the one lesson this screen exists to
   * never teach.
   */
  t.check(/never checked/.test(html), 'the strip carries what has never been checked');
  const empty = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const bare = build(Object.assign(makeData(), { rivalPrices: [], savedQuotes: [] }),
    [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket'], {
      rivalPricesTable: true,
      document: { getElementById: (id) => (id === 'mk_body' ? empty : null) },
      esc: (x) => String(x == null ? '' : x),
      listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
      mkGroupBy: 'shop', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
    });
  bare.renderMarket();
  t.check(!/ow-mt ow-good/.test(empty.innerHTML),
    'a shop that has recorded NOTHING gets no green cell — a green nought beside "nothing recorded yet" is the screen congratulating somebody for never having looked');

  t.check(/A customer buying your month’s 500 at Haidery’s price saves 50,000\./.test(html),
    'and the argument is the CUSTOMER’S arithmetic — being dearer risks the sale, it does not take money out of the till, and the sentence never says it did');
  t.check(!/lost|losing/i.test(html),
    'nothing on the screen calls it a loss, because nothing in the books says the sale went elsewhere');
  t.check(/would add up to 30,000 a month, at the same volume/.test(html),
    'the lifting side says UP TO — the figure is what lifting all the way to their price would add, and the advice is to stop just under it — and states the assumption it rests on, which is the part nothing here can promise');

  t.check(/12,000 a Box of 12 = 1,000 each/.test(html),
    'a converted sighting SHOWS ITS WORKING, so a figure ten times too big would be visible rather than merely wrong');
  t.check(/recorded per Bag, you price per Pc/.test(html),
    'and one that could not be converted says exactly why, on the record');
  t.check(/1 sighting was recorded in a unit that does not match/.test(html),
    'with the ones left out counted where the reader can see them');
  t.check(/seen 95 days ago/.test(html) && /worth checking again/.test(html),
    'an old sighting is marked and the section says to check it again before acting');

  /* Before the migration lands. */
  const s2 = build(makeData(), [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket'], {
    rivalPricesTable: false,
    document: { getElementById: (id) => (id === 'mk_body' ? el : null) },
    esc: (x) => String(x == null ? '' : x),
    listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
    mkGroupBy: 'shop', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
  });
  s2.renderMarket();
  t.check(/0087_rival_prices\.sql/.test(el.innerHTML),
    'and with no market table it names the migration rather than ranking an empty record');
}

/* ---------- 6. the Manager reads the verdict ------------------------- */
{
  const under = [
    { productId: 'P2', variantIdx: null, line: 'Self Drilling Screws', shop: 'Haidery',
      theirs: 1000, ours: 1100, gap: -100, units30: 500, atStake: 50000, daysOld: 2, stale: false },
    { productId: 'P1', variantIdx: 0, line: 'Runners Masasi 12"', shop: 'Kasese Hardware',
      theirs: 100000, ours: 105000, gap: -5000, units30: 4, atStake: 20000, daysOld: 5, stale: false },
    { productId: 'P3', variantIdx: null, line: 'Wall Angle', shop: 'Zauja',
      theirs: 1, ours: 2, gap: -1, units30: 1, atStake: 1, daysOld: 1, stale: false },
    { productId: 'P4', variantIdx: null, line: 'Sofa Legs', shop: 'Zauja',
      theirs: 1, ours: 2, gap: -1, units30: 1, atStake: 1, daysOld: 1, stale: false },
  ];
  const tools = (over) => compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    extractFunction(src, 'buyHoldsStanding', 'index.html'),
    extractFunction(src, 'buyHoldFor', 'index.html'),
    extractFunction(src, 'buyKeyLabel', 'index.html'),
    extractFunction(src, 'buyKeyParts', 'index.html'),
    extractFunction(src, 'managerAdviceTally', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
    extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
    extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
    extractFunction(src, 'deriveMoveOutcome', 'index.html'),
    extractFunction(src, 'managerScoreboard', 'index.html'),
    extractFunction(src, 'managerRecentReviews', 'index.html'),
    extractFunction(src, 'managerReviewBrief', 'index.html'),
    extractFunction(src, 'managerScoreProgress', 'index.html'),
    extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], {
    data: { products: [], customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [] },
    managerNotesTable: true, currentShopId: 'shop-1', todayISO: () => TODAY,
    rivalPricesTable: true, rivalNeverChecked: () => [],
    marketVerdict: () => ({ under, lift: [], notCompared: 0, atStake: 70002 }),
    anShiftDate: (iso, n) => shift(iso, n),
    daysSinceDate: () => 1, apRound: (n) => Math.round(Number(n) || 0), fmtUGX: (n) => String(n),
    sb: { from: () => { const q = { _kind: null };
      q.select = () => q; q.order = () => q; q.in = () => q;
      /* The date window managerAdviceTally reads over. */
      q.gte = () => q; q.lte = () => q;
      q.eq = (c, val) => { if (c === 'kind') q._kind = val; return q; };
      q.limit = () => Promise.resolve({ data: [], error: null });
      q.then = (res) => res({ data: [], error: null });
      return q; } },
    Date, JSON, Math, Number, String, Array, Object, Promise,
    ...over,
  }, ['names']).names().ASSISTANT_TOOLS;

  const out = await tools({}).manager_history.run({ limit: 3 });
  const hurt = out.where_the_market_hurts;
  t.check(Array.isArray(hurt), 'the morning is told where the market is already hurting, not only where to walk');
  eq(hurt.length, 3, 'the worst three, because a meeting is three or four sentences and not a list');
  eq(hurt[0].product_id, 'P2', 'worst first');
  eq(hurt[0].variant_index, null, 'with the ids an argument or an ask needs');
  eq(hurt[0].at_stake_30d, 50000, 'and what a month of this shop’s own sales is worth at their price');
  eq(hurt[0].their_price, 1000, 'their price');
  eq(hurt[0].ours, 1100, 'beside ours');
  eq(hurt[0].shop, 'Haidery', 'and whose it is, so the Manager can name them');
  eq(hurt[0].seen_days_ago, 2, 'with how old the sighting is, because a stale one is weak evidence');

  const bare = await tools({ rivalPricesTable: false,
    marketVerdict: () => { throw new Error('read the market with no market table'); } }).manager_history.run({ limit: 3 });
  t.check(!('where_the_market_hurts' in bare),
    'a shop without the market table is told nothing about it — and does not walk the catalogue to find out');

  const hist = api.slice(api.indexOf("name: 'manager_history'"), api.indexOf('input_schema', api.indexOf("name: 'manager_history'")));
  t.check(/where_the_market_hurts/.test(hist), 'the tool that returns it says what it is');
  t.check(/at_stake_30d/.test(hist) && /worst first/.test(hist), 'including the figure and its order');
  t.check(/AT STAKE, not a loss the books recorded/.test(hist),
    'and what the figure does NOT claim — being dearer risks the sale, it does not take money out of the till');
  t.check(/Forty-one tools in FIXED order/.test(api),
    'and the tool count in the comment beside them is the number of tools there actually are');
}

})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
