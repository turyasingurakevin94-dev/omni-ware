#!/usr/bin/env node
'use strict';
/*
 * Change the price where you decide it.
 *
 * The app argues about a price from three sides now -- what the line
 * costs, what it keeps, what the shop up the road charges -- and then
 * stopped. Acting on any of it meant leaving the screen, finding the
 * product, opening the price rule and guessing a markup that landed
 * where you wanted. And the question the decision actually turns on had
 * never been answered anywhere: CAN YOU AFFORD TO MATCH THEM. The app
 * knew the line cost 96,000 and knew Kasese charged 100,000, and had
 * never put the two together.
 *
 * Four laws:
 *
 *   THERE IS NO PRICE TO SET, ONLY A RULE  the single lever is a markup
 *       on cost, so landing on a chosen figure means inverting the rule
 *       that produces it. FIXED, not percent: fixed lands exactly on
 *       the figure the owner was shown, a percent lands near it. A
 *       wholesale fixed rule is added per PACK, so the value written is
 *       the gap times the pack -- and the price that comes back out
 *       must be the price that went in, to the shilling.
 *   ONE COST, OR THE ROW CONTRADICTS ITSELF  three different costs are
 *       already in play on adjacent screens. What is shown beside our
 *       derived price must be built on the cost that price was built
 *       on, so ourCostFor is the one reading and ourPriceFor is one of
 *       its readers.
 *   ONE DOOR  the modal and the market screen write a stock rule
 *       through the same function, and it is the STOCK tier -- the tier
 *       the shelf price is actually read from.
 *   BELOW COST IS NOT ONE TAP  selling under what the goods cost is a
 *       real decision a shop sometimes makes, and not one to make by
 *       mis-tapping a phone. The sentence says so and names the fix;
 *       the button is withheld.
 *
 * Run: node test/price-move.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('changing the price where you decide it');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fx = (v) => ({ stockWholesaleMarkupType: 'fixed', stockWholesaleMarkupValue: v });

/* Each line is one case. The figures are chosen so the arithmetic is
   checkable by eye and so a boundary is sat on exactly, not near. */
const makeData = () => ({
  products: [
    { id: 'P1', name: 'Runners Masasi', type: 'variable', variants: [{ combo: { Size: '12' }, ...fx(9000) }] },
    { id: 'P2', name: 'Self Drilling Screws', variants: [], ...fx(1200) },   // sold by the box of 12
    { id: 'P3', name: 'Wall Angle', variants: [], ...fx(5000) },             // comfortable
    { id: 'P4', name: 'Sofa Legs', variants: [], ...fx(1000) },              // matching would go under cost
    { id: 'P5', name: 'Door Handle', variants: [], ...fx(500) },             // lands on exactly ten per cent
    { id: 'P6', name: 'Nails', variants: [] },                              // no price on file at all
  ],
  prices: [
    { id: 1, productId: 'P1', variantIdx: 0, supplierId: 'S1', wholesale: 96000, retail: 99000, unit: 'Ctn', packQty: 1, packUnit: 'Ctn', tiers: [] },
    { id: 2, productId: 'P2', variantIdx: null, supplierId: 'S1', wholesale: 900, retail: 1000, unit: 'Pc', packQty: 12, packUnit: 'Box', tiers: [] },
    { id: 3, productId: 'P3', variantIdx: null, supplierId: 'S1', wholesale: 20000, retail: 21000, unit: 'Pc', packQty: 1, packUnit: 'Pc', tiers: [] },
    { id: 4, productId: 'P4', variantIdx: null, supplierId: 'S1', wholesale: 5000, retail: 5500, unit: 'Pc', packQty: 1, packUnit: 'Pc', tiers: [] },
    { id: 5, productId: 'P5', variantIdx: null, supplierId: 'S1', wholesale: 9000, retail: 9500, unit: 'Pc', packQty: 1, packUnit: 'Pc', tiers: [] },
  ],
  presetDefaultMarkup: {},
  presetBuyHolds: {},
  rivalPrices: [
    { id: 1, productId: 'P1', variantIdx: 0, rival: 'Kasese Hardware', price: 100000, unit: '', seenOn: shift(TODAY, -3), note: '' },
    { id: 2, productId: 'P2', variantIdx: null, rival: 'Haidery', price: 1050, unit: '', seenOn: shift(TODAY, -2), note: '' },
    { id: 3, productId: 'P3', variantIdx: null, rival: 'Zauja', price: 24000, unit: '', seenOn: shift(TODAY, -1), note: '' },
    { id: 4, productId: 'P4', variantIdx: null, rival: 'Haidery', price: 4500, unit: '', seenOn: TODAY, note: '' },
    { id: 5, productId: 'P5', variantIdx: null, rival: 'Zauja', price: 10000, unit: '', seenOn: TODAY, note: '' },
  ],
  savedQuotes: [{ id: 1, invoiced: true, voided: false, date: shift(TODAY, -5), items: [
    { productId: 'P1', variantIdx: 0, qty: 4, packQty: 1, supplierId: '__stock__', sellPrice: 105000, _stockLots: [{ qty: 4, cost: 96000 }] },
    { productId: 'P2', variantIdx: null, qty: 500, packQty: 12, supplierId: '__stock__', sellPrice: 1100, _stockLots: [{ qty: 500, cost: 1000 }] },
    { productId: 'P3', variantIdx: null, qty: 10, packQty: 1, supplierId: '__stock__', sellPrice: 25000, _stockLots: [{ qty: 10, cost: 20000 }] },
    { productId: 'P4', variantIdx: null, qty: 8, packQty: 1, supplierId: '__stock__', sellPrice: 6000, _stockLots: [{ qty: 8, cost: 5000 }] },
    { productId: 'P5', variantIdx: null, qty: 20, packQty: 1, supplierId: '__stock__', sellPrice: 9500, _stockLots: [{ qty: 20, cost: 9000 }] },
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
  saveData: () => { data._saved = (data._saved || 0) + 1; },
  console, Date, JSON, Math, Number, String, Array, Object, Map, Set, Promise, Boolean,
  ...(over || {}),
});

const CHAIN = ['ourCostFor', 'ourPriceFor', 'boughtInPriceFor', 'suggestedSellingPrice', 'priceRuleForTarget', 'setStockPriceRule',
  'rivalSide', 'rivalSideSaid', 'rivalSideLabel',
  'rivalPricesFor', 'rivalPriceLatest',
  'rankedPurchaseRowsAtQty', 'rankedPriceRows', 'productPriceRows', 'purchasePriceAtQty',
  'tieredUnitPrice', 'tiersForKind', 'stockUnitFor', 'productPackInfo', 'productUnitLabel',
  'suggestedStockSellingPrice', 'effectiveStockMarkupRule', 'effectiveMarkupRule',
  'rivalMarketRows', 'rivalNeverChecked', 'marketVerdict', 'buyKeyParts', 'stockKey',
  'waSalesByKey', 'waDaysBetween', 'waWeekday', 'quoteItemSellPrice', 'invoiceLineCost',
  'quoteSuggestedPrice', 'quoteSuggestedStockPrice', 'stockOnHand', 'getStockQty'];

const build = (data, extraSrc, names, over) => compileScope(
  CHAIN.map((n) => extractFunction(src, n, 'index.html'))
    .concat([extractDeclaration(src, 'RIVAL_STALE_DAYS', 'index.html'),
      extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html'),
      extractFunction(src, 'targetMarginPct', 'index.html')])
    .concat(extraSrc || []),
  env(data, over), names);

(async () => {

/* ---------- 1. one cost, and the price is one of its readers --------- */
{
  const data = makeData();
  const s = build(data, [], ['ourCostFor', 'ourPriceFor', 'priceRuleForTarget']);

  const c = s.ourCostFor('P1', 0);
  eq(c.cost, 96000, 'what the line costs, off the cheapest supplier row at one unit');
  eq(c.packQty, 1, 'with the pack that price is per');
  eq(s.ourPriceFor('P1', 0), 105000, 'and the price the shop charges is derived from that very figure');

  const m = s.priceRuleForTarget('P1', 0, 100000);
  eq(m.cost, 96000,
    'so what the card says a line costs is the SAME 96,000 the shown price was built on — a second cost basis makes the row contradict itself in front of the owner');
  eq(s.ourCostFor('P6', null), null, 'a line with no price on file has no cost');
  eq(s.priceRuleForTarget('P6', null, 5000), null,
    'and an offer the app cannot price is not made at all');
  eq(s.priceRuleForTarget('P1', 0, 0), null, 'nor is one for a price of nothing');
}

/* ---------- 2. the rule that lands exactly on the figure -------------- */
{
  const data = makeData();
  const s = build(data, [], ['priceRuleForTarget', 'setStockPriceRule', 'ourPriceFor']);

  const m = s.priceRuleForTarget('P1', 0, 100000);
  eq(m.type, 'fixed',
    'FIXED, not percent: the owner was shown a figure and the rule must land on it, not near it');
  eq(m.value, 4000, 'the gap between cost and the price asked for');
  eq(m.target, 100000, 'the price asked for');
  eq(m.keptPct, 4, 'and the share that leaves — 4,000 of 100,000');
  eq(m.thin, true, 'which is under the ten per cent this trade calls thin');
  eq(m.pays, true, 'though it is still above cost');

  s.setStockPriceRule('P1', 0, { wholesaleType: m.type, wholesaleValue: m.value });
  eq(s.ourPriceFor('P1', 0), 100000,
    'and the price that comes back out is the price that went in, to the shilling');

  /* The packed line: a wholesale fixed rule is added per PACK. */
  const packed = s.priceRuleForTarget('P2', null, 1050);
  eq(packed.packQty, 12, 'a line sold by the box carries its pack');
  eq(packed.value, 600,
    'so the rule written is the gap TIMES the pack — 50 a piece across 12 is 600 on the box; written as 50 the price lands at 1,004');
  eq(packed.keptPct, 5, 'the share is still per piece: 50 of 1,050');
  s.setStockPriceRule('P2', null, { wholesaleType: packed.type, wholesaleValue: packed.value });
  eq(s.ourPriceFor('P2', null), 1050, 'and the packed line lands exactly too');
}

/* ---------- 3. what it will and will not say -------------------------- */
{
  const s = build(makeData(), [], ['priceRuleForTarget']);

  const good = s.priceRuleForTarget('P3', null, 24000);
  eq(good.keptPct, 17, 'a comfortable line says what it keeps');
  eq(good.thin, false, 'and is not called thin');

  const under = s.priceRuleForTarget('P4', null, 4500);
  eq(under.pays, false, 'a price below what the goods cost does not pay');
  eq(under.cost, 5000, 'and the cost it is under is named');
  t.check(under.keptPct < 0, 'the share is negative rather than withheld — the arithmetic is the argument');

  const edge = s.priceRuleForTarget('P5', null, 10000);
  eq(edge.keptPct, 10, 'exactly ten per cent');
  eq(edge.thin, false,
    'is NOT thin — the mark is strictly under, the same judgement the buy plan already makes');
}

/* ---------- 4. one door, and it is the tier the shelf reads ----------- */
{
  const data = makeData();
  const s = build(data, [], ['setStockPriceRule', 'ourPriceFor']);

  s.setStockPriceRule('P3', null, { wholesaleType: 'fixed', wholesaleValue: 4000 });
  eq(data.products[2].stockWholesaleMarkupValue, 4000,
    'the writer writes the STOCK tier — the tier the shelf price is read through; the other tier prices a line bought in for an order, and a change there would save happily and move nothing');
  eq(data.products[2].stockWholesaleMarkupType, 'fixed', 'with its type');
  eq(s.ourPriceFor('P3', null), 24000, 'so the shelf price actually moves');
  eq(data._saved, 1, 'and it is saved, once');

  s.setStockPriceRule('P1', 0, { wholesaleType: 'fixed', wholesaleValue: 1 });
  eq(data.products[0].variants[0].stockWholesaleMarkupValue, 1, 'a variant rule lands on the variant');
  eq(data.products[0].stockWholesaleMarkupValue, undefined, 'and leaves the product default alone');

  eq(s.setStockPriceRule('P9', null, { wholesaleValue: 1 }), false, 'a product that is not there is refused');
  eq(s.setStockPriceRule('P1', 7, { wholesaleValue: 1 }), false, 'and so is a variant that is not there');
  eq(data._saved, 2, 'neither of which saved anything');

  /* Only what was passed. */
  s.setStockPriceRule('P3', null, { retailType: 'percent', retailValue: 20 });
  eq(data.products[2].stockWholesaleMarkupValue, 4000, 'a retail change leaves the wholesale rule standing');
  eq(data.products[2].stockRetailMarkupValue, 20, 'and lands on retail');

  /* The modal writes through the same door. */
  const modal = src.slice(src.indexOf("document.getElementById('sr_clear_btn')"), src.indexOf("function resetProductForm"));
  eq((modal.match(/setStockPriceRule\(srProductId, srVariantIdx, \{/g) || []).length, 2,
    'both of the price-rule modal\u2019s buttons write through the same function — two writers for one rule is two rules that drift');
  t.check(!/stock(Wholesale|Retail)Markup(Type|Value)\s*=/.test(modal),
    'and neither sets the fields itself, whatever it calls the row it is holding');
}

/* ---------- 5. the row shows the consequence before the tap ----------- */
{
  const data = makeData();
  const el = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const s = build(data, [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket'], {
    rivalPricesTable: true,
    document: { getElementById: (id) => (id === 'mk_body' ? el : null) },
    esc: (x) => String(x == null ? '' : x),
    listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
    mkGroupBy: 'shop', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
  });
  s.renderMarket();
  const html = el.innerHTML;

  t.check(/Match Kasese Hardware’s 100,000 — costs you 96,000\. You would keep 4% — under your 10% mark\./.test(html),
    'the row says what matching would cost, what it would keep, and that it is under the mark — all three before anything is tapped');
  t.check(/data-to="100000"/.test(html) && /Charge 100,000/.test(html),
    'with a button that names the figure it would set');

  t.check(/Matching them would sell below the 5,000 it costs you\. The fix is the supplier, not the shelf\./.test(html),
    'a price under cost says so, and names where the fix actually is');
  const belowRow = html.slice(html.indexOf('Matching them would sell below'), html.indexOf('Matching them would sell below') + 400);
  t.check(!/rv-match/.test(belowRow),
    'AND WITHHOLDS THE BUTTON — selling under cost is a real decision and not one to make by mis-tapping a phone');

  t.check(/Lift to Zauja’s 10,000 — costs you 9,000\. You would keep 10%\./.test(html),
    'the lifting side reads as lifting, and ten per cent exactly is not flagged');
  t.check(/Lift to Zauja’s 10,000 — costs you 9,000\. You would keep 10%\.(?![^<]*under your)/.test(html),
    'with no thin warning on it at all');
  t.check(/Charge 10,000 wholesale/.test(html),
    'and the button names the SIDE it would move, because a shop has two prices and only one of them is being changed');
  t.check(/You would keep 17%\./.test(html), 'and a comfortable line simply says the share');
}

/* ---------- 6. the tap: confirmed, written, and said ------------------ */
{
  const run = (over) => {
    const data = makeData();
    const seen = { confirms: [], toasts: [], clicks: [] };
    const el = { innerHTML: '', querySelector: () => null,
      querySelectorAll: (sel) => (sel === '.rv-match'
        ? [{ dataset: { pid: 'P1', vi: '0', to: '100000' },
            addEventListener: (_e, fn) => seen.clicks.push(fn) }] : []) };
    const s = build(data, [extractFunction(src, 'renderMarket', 'index.html')], ['renderMarket', 'ourPriceFor'], {
      rivalPricesTable: true,
      document: { getElementById: (id) => (id === 'mk_body' ? el : null) },
      esc: (x) => String(x == null ? '' : x),
      listPageSlice: (id, rows) => rows, listMoreButtonHTML: () => '',
      mkGroupBy: 'shop', mkShop: '', mkSeenOn: '', mkSide: 'wholesale',
      toast: (m) => seen.toasts.push(m),
      confirm: (m) => { seen.confirms.push(m); return over.say !== false; },
      buyHoldFor: () => over.hold || null,
      deleteRivalPrice: () => {},
      ...over.env,
    });
    s.renderMarket();
    seen.clicks[0]();
    return { data, seen, s };
  };

  /* Declined. */
  let r = run({ say: false });
  eq(r.seen.confirms.length, 1, 'the tap ASKS first — a price decides every sale after it, and a mis-tap leaves nothing behind to notice');
  t.check(/Charge 100,000 wholesale instead of 105,000\?/.test(r.seen.confirms[0]),
    'naming both figures and the side, the one it would leave and the one it would set');
  t.check(/Your retail price is not touched\./.test(r.seen.confirms[0]),
    'and saying out loud what it will NOT do — a shop has two prices and this moves one');
  /* NAMED FOR WHAT IT IS. That 96,000 is the cheapest price on FILE at
     quantity one — a registry quote, possibly from a supplier this shop
     has never bought a thing from. "It costs you" claimed it was what
     the shop paid, which is a different figure the app also holds. */
  t.check(/The cheapest price on file for it is 96,000, so you would keep 4%\./.test(r.seen.confirms[0]),
    'and the consequence again, in the dialog itself — with the cost named for what it actually is');
  /* WHICH PRICE, EXACTLY. setStockPriceRule writes the STOCK rule: the
     one a line off the shop's own shelf is priced by. A line bought in
     to order reads the product's default rule and does not move, which
     is the deliberate design and was nowhere on the card — so a shop
     that buys a line in order after order could tap this, be told it
     worked, and go on charging the old price. */
  t.check(/sets the price for goods sold off your own shelf/.test(r.seen.confirms[0]),
    'and says WHICH of the two prices it is setting, rather than letting "wholesale" stand for both');
  eq(r.data.products[0].variants[0].stockWholesaleMarkupValue, 9000,
    'and a declined tap changes NOTHING');
  eq(r.seen.toasts.length, 0, 'and says nothing');

  /* Taken. */
  r = run({ say: true });
  eq(r.data.products[0].variants[0].stockWholesaleMarkupValue, 4000, 'a confirmed tap writes the rule');
  eq(r.s.ourPriceFor('P1', 0), 100000, 'and the line now sells at the figure on the button');
  t.check(/Now 100,000 wholesale — keeping 4%/.test(r.seen.toasts[0]),
    'and says what it now charges, on which side, and what it keeps');
  t.check(!/hold/i.test(r.seen.toasts[0]),
    'with no word about a hold, because none stood');

  /* A hold stood on the line. */
  r = run({ say: true, hold: { key: 'P1::0', reason: 'wait for the markup', over: false } });
  t.check(/The hold on this line has ended: the price it objected to has changed\./.test(r.seen.toasts[0]),
    'where the manager had held the line, the consequence is NAMED — the hold is over the moment the price it objected to moves, and finding that out on the buy screen tomorrow is finding it out too late');

  /* A hold that had already ended is not announced again. */
  r = run({ say: true, hold: { key: 'P1::0', reason: 'wait', over: true } });
  t.check(!/hold/i.test(r.seen.toasts[0]), 'a hold already over is not ended a second time');
}

/* ---------- 7. the tool stops claiming what it did not do ------------- */
{
  const data = makeData();
  const tools = compileScope(
    CHAIN.map((n) => extractFunction(src, n, 'index.html'))
      .concat([extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
        extractDeclaration(src, 'RIVAL_STALE_DAYS', 'index.html'),
        extractDeclaration(src, 'THIN_MARGIN_PCT', 'index.html'),
      extractFunction(src, 'targetMarginPct', 'index.html'),
        extractFunction(src, 'productVariantLabel', 'index.html'),
        extractFunction(src, 'variantLabel', 'index.html'),
        extractFunction(src, 'apRuleWords', 'index.html'),
        'function names(){ return { ASSISTANT_TOOLS }; }']),
    env(data, { isFinite, rivalPricesTable: false }), ['names']).names().ASSISTANT_TOOLS;

  /* P1 carries its own stock rule; P6 carries none. */
  const withStock = tools.set_markup_rule.run({ product_id: 'P1', variant_index: 0,
    wholesale_markup_type: 'fixed', wholesale_markup_value: 3000 });
  eq(withStock.done, true, 'the rule is still written — it is a real and different rule');
  eq(data.products[0].variants[0].wholesaleMarkupValue, 3000, 'on the tier the tool has always written');
  t.check(/still decides what it sells for off the shelf/.test(String(withStock.shelf_price_unchanged)),
    'but the result SAYS the shelf price did not move — reporting a plain success there is the tool claiming a change the shelf never saw');
  eq(data.products[0].variants[0].stockWholesaleMarkupValue, 9000,
    'and the stock rule is left exactly as it was');

  const noStock = tools.set_markup_rule.run({ product_id: 'P6',
    wholesale_markup_type: 'fixed', wholesale_markup_value: 500 });
  eq(noStock.shelf_price_unchanged, undefined,
    'a line with no stock rule of its own carries no such warning — the new rule is what prices it');

  const desc = api.slice(api.indexOf("name: 'set_markup_rule'"), api.indexOf('input_schema', api.indexOf("name: 'set_markup_rule'")));
  t.check(/TWO RULES CAN EXIST ON ONE LINE/.test(desc), 'and the mind is told the two tiers exist');
  t.check(/shelf_price_unchanged/.test(desc), 'and what the flag it may get back means');
  t.check(/Forty-one tools in FIXED order/.test(api), 'with no new tool added: still forty-one');
}

/* ---------- 6. the modal must name the rule it is actually using ----- *
 *
 * Caught live, on this shop's own screen. The item picker printed
 *
 *     Price rule: Wholesale +5,000 UGX · Retail +6% (shop default)
 *
 * above a recommended wholesale of 160,000, over a cost of 135,000 —
 * arithmetic that visibly refuses to work, because the price came from
 * the STOCK rule the market screen had just written (+25,000) while the
 * line printed the default one.
 *
 * quoteItemSellPrice prices a line off our own shelf by the stock rule
 * and every other line by the default: a deliberate split. Naming the
 * wrong half of it turns a correct price into one the owner cannot check.
 */
{
  const product = { id: 'P1', name: 'Runners', wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 5000,
    stockWholesaleMarkupType: 'fixed', stockWholesaleMarkupValue: 25000,
    retailMarkupType: 'percent', retailMarkupValue: 6 };

  const line = (fromStock) => compileScope([
    extractFunction(src, 'ipStageSummaryLine', 'index.html'),
    extractFunction(src, 'effectiveMarkupRule', 'index.html'),
    extractFunction(src, 'effectiveStockMarkupRule', 'index.html'),
    extractFunction(src, 'markupRuleLabel', 'index.html'),
  ], {
    data: { presetDefaultMarkup: null },
    esc: (x) => String(x == null ? '' : x),
    ipSelectedSupplierId: fromStock ? '__stock__' : 'S1',
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
    Number, String, Math, Object, Array, Boolean,
  }, ['ipStageSummaryLine']).ipStageSummaryLine(product, null, 'Ctn', null);

  const stock = line(true);
  t.check(/25,000/.test(stock),
    'a line off our own shelf names the STOCK rule — the one its price is actually computed from');
  t.check(!/\+5,000/.test(stock),
    'and not the default rule, which is what made the modal disagree with its own recommended price');
  t.check(/own shelf/.test(stock),
    'saying which of the two it is, because the shop has both and they differ');

  const boughtIn = line(false);
  t.check(/5,000/.test(boughtIn) && !/25,000/.test(boughtIn),
    'while a line bought in from a supplier names the default rule, which IS the one it is priced by');
  t.check(!/own shelf/.test(boughtIn), 'and does not claim to be off the shelf');
}

})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
