#!/usr/bin/env node
'use strict';
/*
 * Which side of the counter a rival's price was.
 *
 * Everything built for the market read ONE side. ourPriceFor asked the
 * ladder for 'wholesale' and nothing ever asked for anything else, so
 * the price shown, the gap, the ranking, the money at stake and the
 * one-tap change were all wholesale.
 *
 * A rival's shelf ticket is usually a RETAIL price. Filed as it was, it
 * was weighed against this shop's WHOLESALE price -- and the difference
 * between two different things was then ranked by money and put at the
 * top of the screen.
 *
 * Five laws:
 *
 *   THREE STATES, NOT TWO  wholesale, retail, and NOBODY SAID. An
 *       observation is removed but never rewritten, so every row on
 *       file before the column existed cannot be told what it was. It
 *       is read against the wholesale price -- the price the screen was
 *       showing beside it when somebody typed it in -- and the row says
 *       that is an assumption rather than letting it pass as a fact.
 *   A FIXED RULE MEANS DIFFERENT THINGS ON EACH SIDE  wholesale fixed
 *       is an amount on each PACK and the ladder divides it back down;
 *       retail fixed is an amount on each piece and is not divided.
 *       Inverting the wholesale form for a retail target writes a rule
 *       packQty times too large.
 *   ONE SHOP CAN QUOTE BOTH  so the key that de-duplicates sightings
 *       carries the side. Without it the later sighting silently hides
 *       the earlier and half the market disappears.
 *   EACH SIDE ON ITS OWN VOLUME  a retail price ranked on a month that
 *       was almost all sold by the pack claims money that was never at
 *       stake on that side at all. The split is derived by the same
 *       quantity-against-pack line that decided what was charged.
 *   NO RULE IS NOT A PRICE OF NOUGHT  half this shop's catalogue
 *       carries a wholesale rule and no retail one. A retail sighting
 *       there is counted and named, never dropped in silence and never
 *       shown as a gap against nothing.
 *
 * Run: node test/rival-price-side.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('which side of the counter');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const rules = (w, r) => ({
  ...(w == null ? {} : { stockWholesaleMarkupType: 'fixed', stockWholesaleMarkupValue: w }),
  ...(r == null ? {} : { stockRetailMarkupType: 'fixed', stockRetailMarkupValue: r }),
});

const makeData = () => ({
  products: [
    /* Sold both ways: by the carton of 12 and by the piece. */
    { id: 'P1', name: 'Runners Masasi', variants: [], ...rules(24000, 14000) },
    /* A wholesale rule and NO retail one — the majority case in this
       shop, and the one that decides whether a retail sighting is
       dropped in silence or named. */
    { id: 'P2', name: 'Wall Angle', variants: [], ...rules(5000, null) },
    { id: 'P3', name: 'Sofa Legs', variants: [], ...rules(1000, null) },
    { id: 'P4', name: 'Door Handle', variants: [], ...rules(3000, 2500) },
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: 96000, retail: 96000, unit: 'Pc', packQty: 12, packUnit: 'Ctn', tiers: [] },
    { id: 2, productId: 'P2', variantIdx: null, supplierId: 'S1', wholesale: 20000, retail: 20000, unit: 'Pc', packQty: 1, packUnit: 'Pc', tiers: [] },
    { id: 3, productId: 'P3', variantIdx: null, supplierId: 'S1', wholesale: 5000, retail: 5000, unit: 'Pc', packQty: 1, packUnit: 'Pc', tiers: [] },
    { id: 4, productId: 'P4', variantIdx: null, supplierId: 'S1', wholesale: 9000, retail: 9500, unit: 'Pc', packQty: 6, packUnit: 'Box', tiers: [] },
  ],
  presetDefaultMarkup: {},
  presetBuyHolds: {},
  rivalPrices: [
    /* ONE SHOP, ONE LINE, BOTH SIDES. */
    { id: 1, productId: 'P1', variantIdx: null, rival: 'Haidery', price: 97000, unit: '', seenOn: shift(TODAY, -2), note: '', side: 'wholesale' },
    { id: 2, productId: 'P1', variantIdx: null, rival: 'Haidery', price: 106000, unit: '', seenOn: shift(TODAY, -1), note: '', side: 'retail' },
    /* A side this line has no rule for. */
    { id: 3, productId: 'P2', variantIdx: null, rival: 'Zauja', price: 30000, unit: '', seenOn: TODAY, note: '', side: 'retail' },
    /* Written before the column existed. */
    { id: 4, productId: 'P3', variantIdx: null, rival: 'Haidery', price: 5500, unit: '', seenOn: TODAY, note: '', side: null },
    { id: 5, productId: 'P4', variantIdx: null, rival: 'Zauja', price: 11000, unit: '', seenOn: TODAY, note: '', side: 'retail' },
    { id: 6, productId: 'P4', variantIdx: null, rival: 'Haidery', price: 12000, unit: '', seenOn: TODAY, note: '', side: 'wholesale' },
  ],
  savedQuotes: [{ id: 1, invoiced: true, voided: false, date: shift(TODAY, -5), items: [
    { productId: 'P1', variantIdx: null, qty: 24, packQty: 12, supplierId: '__stock__', sellPrice: 98000, _stockLots: [{ qty: 24, cost: 96000 }] },
    { productId: 'P1', variantIdx: null, qty: 5, packQty: 12, supplierId: '__stock__', sellPrice: 110000, _stockLots: [{ qty: 5, cost: 96000 }] },
    { productId: 'P2', variantIdx: null, qty: 10, packQty: 1, supplierId: '__stock__', sellPrice: 25000, _stockLots: [{ qty: 10, cost: 20000 }] },
    { productId: 'P3', variantIdx: null, qty: 8, packQty: 1, supplierId: '__stock__', sellPrice: 6000, _stockLots: [{ qty: 8, cost: 5000 }] },
    { productId: 'P4', variantIdx: null, qty: 3, packQty: 6, supplierId: '__stock__', sellPrice: 12000, _stockLots: [{ qty: 3, cost: 9500 }] },
    { productId: 'P4', variantIdx: null, qty: 12, packQty: 6, supplierId: '__stock__', sellPrice: 10000, _stockLots: [{ qty: 12, cost: 9500 }] },
  ] }],
});

const env = (data, over) => ({
  data,
  todayISO: () => TODAY,
  daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
  apRound: (n) => Math.round(Number(n) || 0),
  supplierName: (id) => String(id),
  productDisplayLabel: (p) => p.name,
  allProductVariantEntries: () => data.products.map((p) => ({ p, variantIdx: null })),
  saveData: () => { data._saved = (data._saved || 0) + 1; },
  rivalPriceSideColumn: true,
  console, Date, JSON, Math, Number, String, Array, Object, Map, Set, Promise, Boolean,
  ...(over || {}),
});

const CHAIN = ['rivalSide', 'rivalSideSaid', 'rivalSideLabel',
  'rivalPricesFor', 'rivalPriceLatest', 'ourCostFor', 'ourPriceFor',
  'priceRuleForTarget', 'setStockPriceRule',
  'rankedPurchaseRowsAtQty', 'rankedPriceRows', 'productPriceRows', 'purchasePriceAtQty',
  'tieredUnitPrice', 'tiersForKind', 'productPackInfo', 'productUnitLabel',
  'suggestedStockSellingPrice', 'effectiveStockMarkupRule', 'effectiveMarkupRule',
  'rivalMarketRows', 'rivalNeverChecked', 'marketVerdict', 'buyKeyParts', 'stockKey',
  'waSalesByKey', 'waDaysBetween', 'waWeekday', 'quoteItemSellPrice', 'invoiceLineCost',
  'quoteSuggestedPrice', 'quoteSuggestedStockPrice', 'getStockQty'];

const build = (data, extraSrc, names, over) => compileScope(
  CHAIN.map((n) => extractFunction(src, n, 'index.html'))
    .concat([extractDeclaration(src, 'RIVAL_STALE_DAYS', 'index.html'),
      extractDeclaration(src, 'RIVAL_SIDES', 'index.html'),
      extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html')])
    .concat(extraSrc || []),
  env(data, over), names);

(async () => {

/* ---------- 1. three states, not two --------------------------------- */
{
  const s = build(makeData(), [], ['rivalSide', 'rivalSideSaid', 'rivalSideLabel']);
  eq(s.rivalSide({ side: 'retail' }), 'retail', 'a side that was said is the side');
  eq(s.rivalSideSaid({ side: 'retail' }), true, 'and it says so');
  eq(s.rivalSide({ side: null }), 'wholesale',
    'a row written before the column existed is READ as wholesale — the price the screen was showing beside it when somebody typed it in');
  eq(s.rivalSideSaid({ side: null }), false,
    'but never CLAIMS to be: the reading and the assumption are different facts and the row has to be able to say which it has');
  eq(s.rivalSide({ side: 'trade' }), 'wholesale', 'a side nobody can name is no side at all');
  eq(s.rivalSideSaid({ side: 'trade' }), false, 'and does not pass as one');
}

/* ---------- 2. each side has its own price, and its own arithmetic ---- */
{
  const s = build(makeData(), [], ['ourPriceFor', 'priceRuleForTarget', 'setStockPriceRule', 'waSalesByKey']);

  eq(s.ourPriceFor('P1', null), 98000, 'wholesale unless asked otherwise, so every older reading means what it always meant');
  eq(s.ourPriceFor('P1', null, 'wholesale'), 98000, 'a fixed wholesale rule of 24,000 is per CARTON, spread over the twelve');
  eq(s.ourPriceFor('P1', null, 'retail'), 110000, 'and a fixed retail rule of 14,000 is per PIECE, not divided by anything');
  eq(s.ourPriceFor('P2', null, 'retail'), null,
    'a line with a wholesale rule and no retail one has NO retail price — which is a different answer from a price of nothing');

  const w = s.priceRuleForTarget('P4', null, 12000, 'wholesale');
  eq(w.side, 'wholesale', 'a wholesale target carries its side');
  eq(w.value, 15000, 'and is written per pack — 2,500 a piece across a box of six');
  const r = s.priceRuleForTarget('P4', null, 11000, 'retail');
  eq(r.side, 'retail', 'a retail target carries its side');
  eq(r.value, 1500,
    'and is written PER PIECE, undivided — multiplied by the pack it would be 9,000 and the price would land at 18,500 instead of 11,000');
  eq(r.cost, 9500, 'on the same cost the shown price was built on');
  eq(r.keptPct, 14, 'with the share that leaves');

  const data = makeData();
  const s2 = build(data, [], ['ourPriceFor', 'priceRuleForTarget', 'setStockPriceRule']);
  const m = s2.priceRuleForTarget('P4', null, 11000, 'retail');
  s2.setStockPriceRule('P4', null, { retailType: m.type, retailValue: m.value });
  eq(s2.ourPriceFor('P4', null, 'retail'), 11000,
    'so the retail price that comes back out is the price that went in, to the shilling');
  eq(s2.ourPriceFor('P4', null, 'wholesale'), 10000,
    'and the WHOLESALE price is untouched — a shelf ticket must not move what a pack sells for');
}

/* ---------- 3. the split of a month's sales -------------------------- */
{
  const sales = build(makeData(), [], ['waSalesByKey']).waSalesByKey(TODAY);
  const p1 = sales.get('P1');
  eq(p1.units30, 29, 'the month is what it always was');
  eq(p1.wholesaleUnits30, 24, 'but the 24 sold at or above the carton were a wholesale sale');
  eq(p1.retailUnits30, 5, 'and the 5 below it were retail — the same line that decided what was charged for them');
  eq(p1.wholesaleUnits30 + p1.retailUnits30, p1.units30, 'and the two halves are the whole');
  const p4 = sales.get('P4');
  eq(p4.retailUnits30, 3, 'a quantity under the pack is retail');
  eq(p4.wholesaleUnits30, 12, 'and one at or over it is not');
}

/* ---------- 4. one shop, one line, both sides ------------------------ */
{
  const s = build(makeData(), [], ['rivalMarketRows', 'rivalPriceLatest']);
  const rows = s.rivalMarketRows(TODAY);
  const p1 = rows.filter((x) => x.key === 'P1');
  eq(p1.length, 2,
    'one shop quoting a pack price and a piece price for the same line is TWO sightings — keyed on the shop alone the later one silently hides the earlier and half the market disappears');
  const w = p1.find((x) => x.side === 'wholesale');
  const r = p1.find((x) => x.side === 'retail');
  eq(w.theirs, 97000, 'their pack price');
  eq(w.ours, 98000, 'against ours on that side');
  eq(w.gap, -1000, 'so we are 1,000 dearer by the carton');
  eq(r.theirs, 106000, 'their piece price');
  eq(r.ours, 110000, 'against OUR RETAIL price, not our wholesale one');
  eq(r.gap, -4000, 'so we are 4,000 dearer by the piece — against the wholesale price it would read as 8,000, which is a comparison of two different things');

  const legacy = rows.find((x) => x.key === 'P3');
  eq(legacy.side, 'wholesale', 'a sighting from before the column is read as wholesale');
  eq(legacy.sideSaid, false, 'and carries the fact that nobody said so');

  const latest = s.rivalPriceLatest('P1', null);
  eq(latest.length, 2, 'the dossier reading splits them too');
  t.check(latest.every((x) => x.sideSaid === true), 'each saying which side it is');
}

/* ---------- 5. each side on its own volume, and no rule is named ----- */
{
  const v = build(makeData(), [], ['marketVerdict']).marketVerdict(TODAY);

  const w = v.under.find((x) => x.key === 'P1' && x.side === 'wholesale');
  const r = v.under.find((x) => x.key === 'P1' && x.side === 'retail');
  eq(w.units30, 24, 'the wholesale row is ranked on what was sold by the pack');
  eq(w.atStake, 24000, '1,000 across 24');
  eq(r.units30, 5, 'and the retail row on what was sold by the piece');
  eq(r.atStake, 20000, '4,000 across 5');
  t.check(v.under.indexOf(w) < v.under.indexOf(r),
    'so the WHOLESALE row leads — ranked on the whole month both would be inflated and the retail one would come first, claiming money that was never at stake on that side');

  const lift = v.lift.find((x) => x.key === 'P4');
  eq(lift.side, 'wholesale', 'the lifting side carries its side too');
  eq(lift.units30, 12, 'on its own volume');
  eq(lift.atStake, 24000, 'and its own money');

  eq(v.noRule, 1,
    'a sighting on a side the line has no rule for is COUNTED — half this catalogue has a wholesale rule and no retail one, and dropping those in silence is how a record starts lying about how much it knows');
  t.check(!v.under.some((x) => x.key === 'P2') && !v.lift.some((x) => x.key === 'P2'),
    'while staying out of both rankings, because there is no price of ours to compare it with');
}

/* ---------- 6. the screen ------------------------------------------- */
{
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const mk = (over) => build(makeData(), [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket'], {
    rivalPricesTable: true,
    document: { getElementById: (id) => (id === 'mk_body' ? el : null) },
    esc: (x) => String(x == null ? '' : x),
    listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
    mkGroupBy: 'shop', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
    ...over,
  });
  mk({}).renderMarket();
  const html = el.innerHTML;

  t.check(/rv-side wholesale">wholesale</.test(html) && /rv-side retail">retail</.test(html),
    'every row says which of your two prices it argues with');
  t.check(/no side said/.test(html),
    'and one from before the column says nobody said, rather than passing as a wholesale price somebody chose');
  t.check(/Charge 106,000 retail/.test(html) && /Charge 97,000 wholesale/.test(html),
    'the button names the side it would move, because a shop has two prices and only one of them is changing');
  t.check(/your retail/.test(html) && /your wholesale/.test(html),
    'the figures beside it say which price is being compared');
  t.check(/sold by the piece in 30 days/.test(html) && /sold by the pack in 30 days/.test(html),
    'and the volume says which side it was sold on');
  t.check(/1 sighting names a side this line has no price rule for/.test(html),
    'the one left out for want of a rule is named, with what to do about it');
  t.check(/no retail price of your own on this line/.test(html),
    'and the record row says which side is missing rather than "no price of your own"');
  t.check(/id="mk_side"/.test(html) && /Their retail/.test(html),
    'the entry form asks which side a price was');

  /* Before 0088 lands. */
  const el2 = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  build(makeData(), [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket'], {
    rivalPricesTable: true, rivalPriceSideColumn: false,
    document: { getElementById: (id) => (id === 'mk_body' ? el2 : null) },
    esc: (x) => String(x == null ? '' : x),
    listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
    mkGroupBy: 'shop', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
  }).renderMarket();
  t.check(!/id="mk_side"/.test(el2.innerHTML),
    'a shop without the column is not offered a control whose answer would be thrown away');
  t.check(/0088_rival_price_side\.sql/.test(el2.innerHTML),
    'it is told which file to paste instead');

  /* Grouped by side. */
  const el3 = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  build(makeData(), [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket'], {
    rivalPricesTable: true,
    document: { getElementById: (id) => (id === 'mk_body' ? el3 : null) },
    esc: (x) => String(x == null ? '' : x),
    listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
    mkGroupBy: 'side', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
  }).renderMarket();
  t.check(/Their wholesale prices/.test(el3.innerHTML) && /Their retail prices/.test(el3.innerHTML),
    'and the record can be read wholly one side at a time');
  t.check(/<option value="side">Side<\/option>/.test(src), 'with the control to ask for it');
}

/* ---------- 6b. the tap moves ONE price ------------------------------ */
{
  const tap = (side, to) => {
    const data = makeData();
    const seen = { confirms: [], toasts: [], clicks: [] };
    const el = { innerHTML: '', querySelector: () => null,
      querySelectorAll: (sel) => (sel === '.rv-match'
        ? [{ dataset: { pid: 'P4', vi: '', side, to: String(to) },
            addEventListener: (_e, fn) => seen.clicks.push(fn) }] : []) };
    const s = build(data, [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket', 'ourPriceFor'], {
      rivalPricesTable: true,
      document: { getElementById: (id) => (id === 'mk_body' ? el : null) },
      esc: (x) => String(x == null ? '' : x),
      listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
      mkGroupBy: 'shop', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
      toast: (m) => seen.toasts.push(m),
      confirm: (m) => { seen.confirms.push(m); return true; },
      buyHoldFor: () => null, deleteRivalPrice: () => {},
    });
    s.renderMarket();
    seen.clicks[0]();
    return { data, seen, s };
  };

  /* Door Handle: 12,000 retail and 10,000 wholesale, both from a cost
     of 9,500. Matching Zauja's retail 11,000 must move ONE of them. */
  let r = tap('retail', 11000);
  eq(r.s.ourPriceFor('P4', null, 'retail'), 11000, 'a retail tap lands the RETAIL price on the figure the button named');
  eq(r.s.ourPriceFor('P4', null, 'wholesale'), 10000,
    'and leaves the WHOLESALE price exactly where it was — writing the wholesale rule from a shelf ticket would change what every pack sells for, on evidence about single pieces');
  eq(r.data.products[3].stockRetailMarkupValue, 1500, 'the retail rule is written per piece');
  eq(r.data.products[3].stockWholesaleMarkupValue, 3000, 'the wholesale rule is untouched');
  t.check(/Charge 11,000 retail instead of 12,000\?/.test(r.seen.confirms[0]), 'the dialog names the side and both figures');
  t.check(/Your wholesale price is not touched\./.test(r.seen.confirms[0]), 'and says out loud what it will not do');
  t.check(/Now 11,000 retail — keeping 14%/.test(r.seen.toasts[0]), 'the toast says which price now stands where');

  r = tap('wholesale', 12000);
  eq(r.s.ourPriceFor('P4', null, 'wholesale'), 12000, 'a wholesale tap moves the wholesale price');
  eq(r.s.ourPriceFor('P4', null, 'retail'), 12000, 'and leaves retail at its own 12,000, set by its own rule');
  eq(r.data.products[3].stockWholesaleMarkupValue, 15000, 'written per pack — 2,500 a piece across a box of six');
  eq(r.data.products[3].stockRetailMarkupValue, 2500, 'with the retail rule untouched');
}

/* ---------- 7. writing a side --------------------------------------- */
{
  const run = async (over) => {
    const data = makeData();
    const rows = [];
    const s = build(data, [extractFunction(src, 'addRivalPrice', 'index.html')], ['addRivalPrice'], {
      currentShopId: 'shop-1',
      sb: { from: () => ({ insert: (row) => { rows.push(row); return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 9 }, error: null }) }) }; } }) },
      ...over,
    });
    const r = await s.addRivalPrice({ productId: 'P1', rival: 'Haidery', price: 90000, ...(over || {}).input });
    return { data, rows, r };
  };

  let out = await run({ input: { side: 'retail' } });
  eq(out.rows[0].side, 'retail', 'the side the owner picked reaches the database');
  eq(out.data.rivalPrices[out.data.rivalPrices.length - 1].side, 'retail', 'and the row the screen shows at once');

  out = await run({ input: { side: 'trade' } });
  eq(out.rows[0].side, undefined, 'a side nobody can name is not written at all');

  out = await run({ input: {} });
  eq(out.rows[0].side, undefined, 'and neither is one nobody said — null is the honest state, never a guess');

  out = await run({ rivalPriceSideColumn: false, input: { side: 'retail' } });
  eq(out.rows[0].side, undefined,
    'before 0088 the side is DROPPED rather than sent — PostgREST refuses the whole row for one unknown column, so sending it would lose the price as well');
  eq(out.r.ok, true, 'and the sighting is still kept');
}

/* ---------- 8. what the assistant is given and told ------------------ */
{
  const data = makeData();
  const calls = [];
  const tools = compileScope(
    CHAIN.map((n) => extractFunction(src, n, 'index.html'))
      .concat([extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
        extractDeclaration(src, 'RIVAL_STALE_DAYS', 'index.html'),
        extractDeclaration(src, 'RIVAL_SIDES', 'index.html'),
        extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html'),
        extractFunction(src, 'productVariantLabel', 'index.html'),
        extractFunction(src, 'variantLabel', 'index.html'),
        'function names(){ return { ASSISTANT_TOOLS }; }']),
    env(data, { fmtShortDate: (d) => String(d), renderMarket: () => {},
      addRivalPrice: (input) => { calls.push(input); return Promise.resolve({ ok: true, id: 1 }); } }),
    ['names']).names().ASSISTANT_TOOLS;

  await tools.record_rival_prices.run({ rival: 'Haidery', items: [
    { product_id: 'P1', price: 106000, side: 'retail' },
    { product_id: 'P1', price: 97000 },
  ] });
  eq(calls[0].side, 'retail', 'a side on a spoken line reaches the writer');
  eq(calls[1].side, undefined, 'and a line without one carries none rather than a guess');

  const card = tools.record_rival_prices.summary({ rival: 'Haidery', items: [
    { product_id: 'P1', price: 106000, side: 'retail' }] });
  t.check(/below your retail 110,000/.test(card),
    'and the confirm card compares it against the right price of ours, named — against the wholesale one it would read as 8,000 and the owner would approve a comparison of two different things');

  const schema = api.slice(api.indexOf("name: 'record_rival_prices'"), api.indexOf('additionalProperties: false,\n    },\n  },\n];', api.indexOf("name: 'record_rival_prices'")));
  t.check(/side: \{ type: 'string', enum: \['wholesale', 'retail'\]/.test(schema), 'the tool can be told a side');
  t.check(/A shelf ticket in another shop is usually retail/.test(schema), 'with the case that decides it');
  t.check(/SAY WHICH SIDE each price is/.test(schema), 'and is told to ask rather than guess');
  t.check(/each sighting says which side it is, and a retail figure argues about the retail price only/.test(api),
    'and the mind reading a dossier is told the same');
  t.check(/side_not_said/.test(api) && /side_not_said/.test(src),
    'including what an unsaid side means, in the prompt and in the reading it names');
}

/* ---------- 9. the migration ---------------------------------------- */
{
  const mig = read('supabase/migrations/0088_rival_price_side.sql');
  t.check(/alter table rival_prices\s*\n\s*add column if not exists side text;/.test(mig),
    '0088 adds the column and nothing else');
  t.check(/check \(side is null or side in \('wholesale', 'retail'\)\)/.test(mig),
    'with the database refusing a side nobody can name — and allowing null, which is every row already on file');
  t.check(!/update rival_prices/.test(mig),
    'and NOTHING is back-filled: an observation is removed but never rewritten, so a row cannot be told what it was');
  t.check(/comment on column rival_prices\.side/.test(mig),
    'the reasoning goes into the database with the column');
}

})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
