#!/usr/bin/env node
'use strict';
/*
 * What suppliers charge, over time.
 *
 * The shop buys most of its goods to order, so a supplier's price IS
 * the margin. This watches it from the purchase invoices the shop
 * already writes, and holds itself to four rules:
 *
 *   ONE UNIT ONLY. A price compares only with a price for the same
 *   thing. A product re-recorded from pieces to cartons would show a
 *   rise that never happened, so those points are excluded and COUNTED.
 *
 *   TWO DATED PURCHASES, ON DIFFERENT DAYS. One purchase is a price,
 *   not a trend; three on one day is one delivery.
 *
 *   MONEY, NOT PERCENTAGE. A 2% rise on the thing bought every week
 *   costs more than a 40% rise on something bought once, and the list
 *   is ordered by what it actually costs.
 *
 *   ONE DERIVATION. The dashboard's cost-rise flag reads from this, so
 *   the alert and the screen can never name different suppliers.
 *
 * Run: node test/supplier-price-watch.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('supplier price watch');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-27';
const ago = (d) => new Date(Date.parse(TODAY + 'T00:00:00Z') - d * 86400000).toISOString().slice(0, 10);
const pi = (id, days, supplierId, supplierName, items, voided) =>
  ({ id, date: ago(days), supplierId, supplierName, items, voided: !!voided });
const line = (productId, productName, price, qty, unit, variantIdx) =>
  ({ productId, variantIdx: variantIdx == null ? null : variantIdx, productName, price, qty, unit: unit || 'pc' });

const data = {
  presetPriceWatchDays: 180,
  products: [
    { id: 'P1', name: 'Wall Angle', variants: [] },
    { id: 'P2', name: 'Cement', variants: [] },
    { id: 'P3', name: 'Screws', variants: [] },
    { id: 'P4', name: 'Once Only', variants: [] },
    { id: 'P5', name: 'Same Day', variants: [] },
    { id: 'P6', name: 'Switched Unit', variants: [] },
    { id: 'P7', name: 'Steady Item', variants: [] },
    { id: 'P8', name: 'Unit Split', variants: [] },
    { id: 'P9', name: 'Free Sample', variants: [] },
  ],
  purchaseInvoices: [
    // P1: a small rise on a big volume — 2,500 → 2,600 over 600 units.
    pi(1, 120, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 2500, 200)]),
    pi(2, 60, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 2550, 200)]),
    pi(3, 10, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 2600, 200)]),
    // P2: a big percentage rise on almost nothing — 10,000 → 14,000 on 2.
    pi(4, 90, 'S2', 'Roto', [line('P2', 'Cement', 10000, 1, 'bag')]),
    pi(5, 12, 'S2', 'Roto', [line('P2', 'Cement', 14000, 1, 'bag')]),
    // P3: come down — 700 → 600 over 300.
    pi(6, 100, 'S1', 'Okuosi Gypsum', [line('P3', 'Screws', 700, 150)]),
    pi(7, 20, 'S1', 'Okuosi Gypsum', [line('P3', 'Screws', 600, 150)]),
    // P4: one purchase only — a price, not a trend.
    pi(8, 30, 'S1', 'Okuosi Gypsum', [line('P4', 'Once Only', 5000, 10)]),
    // P5: three purchases, all on one day — one delivery, no trend.
    pi(9, 40, 'S2', 'Roto', [line('P5', 'Same Day', 1000, 5)]),
    pi(10, 40, 'S2', 'Roto', [line('P5', 'Same Day', 1200, 5)]),
    // P6: the unit changed. The earlier pieces must never be compared
    // with the later cartons.
    pi(11, 150, 'S1', 'Okuosi Gypsum', [line('P6', 'Switched Unit', 500, 100, 'pc')]),
    pi(12, 80, 'S1', 'Okuosi Gypsum', [line('P6', 'Switched Unit', 10000, 5, 'ctn')]),
    pi(13, 15, 'S1', 'Okuosi Gypsum', [line('P6', 'Switched Unit', 10400, 5, 'ctn')]),
    // P7: bought again and again at the very same price. The only case
    // the old "every supplier is charging what they charged" sentence
    // was ever entitled to describe.
    pi(16, 100, 'S1', 'Okuosi Gypsum', [line('P7', 'Steady Item', 3000, 50)]),
    pi(17, 55, 'S1', 'Okuosi Gypsum', [line('P7', 'Steady Item', 3000, 50)]),
    pi(18, 12, 'S1', 'Okuosi Gypsum', [line('P7', 'Steady Item', 3000, 50)]),
    // P8: two purchases, but the FIRST is in another unit — so only one
    // point survives the guard and there is nothing to compare.
    pi(19, 70, 'S2', 'Roto', [line('P8', 'Unit Split', 400, 100, 'pc')]),
    pi(20, 18, 'S2', 'Roto', [line('P8', 'Unit Split', 9000, 4, 'ctn')]),
    // Lines the watch cannot read at all: one names no product, one
    // carries no price. Both must be COUNTED, not silently dropped.
    pi(21, 30, 'S1', 'Okuosi Gypsum', [
      { productId: null, variantIdx: null, productName: 'Sundries', price: 5000, qty: 1, unit: 'pc' },
      line('P9', 'Free Sample', 0, 10),
    ]),
    // Voided, and outside the look-back: neither counts for anything.
    pi(14, 5, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 9999, 500)], true),
    pi(15, 400, 'S1', 'Okuosi Gypsum', [line('P1', 'Wall Angle', 100, 500)]),
  ],
  prices: [
    // Agrees with what was actually paid: not out of step.
    { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: 2600, retail: 2650,
      unit: 'pc', packQty: 40, packUnit: 'bundle', tiers: [], outOfStock: false },
    // The file still says 10,000 while the last invoice paid 14,000.
    { id: 2, productId: 'P2', variantIdx: null, supplierId: 'S2', wholesale: 10000, retail: 10000,
      unit: 'bag', packQty: 10, packUnit: 'lot', tiers: [], outOfStock: false },
    /* A volume tier that matches what was paid at THAT quantity: the
       file and reality agree, and a naive comparison against the flat
       price would have called it drift. */
    { id: 3, productId: 'P3', variantIdx: null, supplierId: 'S1', wholesale: 700, retail: 750,
      unit: 'pc', packQty: 50, packUnit: 'ctn', tiers: [{ minQty: 100, price: 600 }], outOfStock: false },
    /* THE LIVE SHOP'S ROW. P6 is bought by the carton (the last two
       invoices above) while the file prices it by the piece — the same
       price, two bases. Compared straight, the file reads 9,500 out of
       step on every carton and the section ranks it FIRST, because the
       ranking multiplies the gap by how much is bought. */
    { id: 4, productId: 'P6', variantIdx: null, supplierId: 'S1', wholesale: 500, retail: 520,
      unit: 'pc', packQty: 20, packUnit: 'ctn', tiers: [], outOfStock: false },
  ],
};

const env = {
  data,
  todayISO: () => TODAY,
  supplierName: (id) => ({ S1: 'Okuosi Gypsum', S2: 'Roto' })[id] || String(id),
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'supplierPriceSeries', 'supplierPriceWatch', 'dashSupplierPriceInflation',
    'waDaysBetween', 'productPriceRows', 'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind',
  ].map((n) => extractFunction(src, n, 'index.html'))
    .concat([
      extractDeclaration(src, 'PRICE_WATCH_FILE_TOLERANCE_PCT', 'index.html'),
      /* The unit check the file side now goes through. */
      extractDeclaration(src, 'cmpUnitKey', 'index.html'),
      extractDeclaration(src, 'DASH_COST_RISE_PCT', 'index.html'),
    ]),
  env, ['supplierPriceSeries', 'supplierPriceWatch', 'dashSupplierPriceInflation']);
} catch (e) { err = e; }
t.check(!!scope, `the watch chain compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. what counts as a trend at all -------------------------- */
if (scope) {
  const all = scope.supplierPriceSeries(TODAY);
  const by = (name) => all.find((s) => s.name === name);

  t.check(by('Once Only').trend === false && by('Once Only').rise === 0,
    'one purchase is a price, not a trend');
  t.check(by('Same Day').trend === false,
    'and three purchases on one day are one delivery, not a movement');

  const angle = by('Wall Angle');
  eq(angle.points.length, 3, 'the voided invoice and the one outside the look-back are not points');
  t.check(angle.first.price === 2500 && angle.last.price === 2600,
    'the trend runs from the oldest comparable price to the newest');
  eq(angle.units, 600, 'over the quantity actually bought in the window');
  eq(angle.extra, 60000, 'and the money is that quantity at the new price — 100 more on each of 600');

  const switched = by('Switched Unit');
  eq(switched.points.length, 2, 'a purchase recorded in another unit is NOT compared');
  eq(switched.skippedOtherUnit, 1, 'it is counted instead, so the gap in the trail is visible');
  t.check(switched.first.price === 10000 && switched.rise === 400,
    'and the trend is only over the prices that can honestly be compared');
}

/* ---------- 2. ranked by money, not percentage ------------------------ */
if (scope) {
  const w = scope.supplierPriceWatch(TODAY);
  eq(w.up.map((s) => s.name).join(','), 'Wall Angle,Cement,Switched Unit',
    'the biggest COST comes first — Wall Angle rose 4% and leads, because it rose on six hundred pieces');
  const cement = w.up.find((s) => s.name === 'Cement');
  t.check(Math.round(cement.risePct) === 40 && cement.extra === 8000,
    'a 40% rise on two bags is reported as 40%, and still ranks below a 4% rise worth ten times as much');

  eq(w.down.map((s) => s.name).join(','), 'Screws',
    'a supplier who dropped their price is worth knowing about too');
  t.check(w.down[0].rise === -100 && w.down[0].extra === -30000,
    'with what that saved on what was bought');
}

/* ---------- 3. the Price Registry, checked against reality ------------ */
if (scope) {
  const w = scope.supplierPriceWatch(TODAY);
  const names = w.outOfStep.map((s) => s.name);
  t.check(names.includes('Cement'),
    'a file still saying 10,000 while the last invoice paid 14,000 is named');
  const cement = w.outOfStep.find((s) => s.name === 'Cement');
  eq(cement.onFile, 10000, 'with what the file says');
  eq(cement.fileGap, 4000, 'and the size of the gap');

  t.check(!names.includes('Wall Angle'),
    'a file that agrees with what was paid is not flagged');
  t.check(!names.includes('Screws'),
    'and neither is one whose VOLUME TIER matches what was paid at that quantity — a tier is not drift');

  /* COMPARE LIKE WITH LIKE, ON BOTH SIDES. The invoice trail was split
     by unit and then measured against a registry row that was never held
     to the same rule. Switched Unit is bought by the carton at 10,400 and
     priced in the file by the piece at 500 — the same money, two bases —
     and the straight subtraction called the file 9,900 out of step on
     every carton. It was ranked FIRST, too: the ranking multiplies the
     gap by how much the shop buys, so the more of it it bought the
     bigger the thing that was not happening grew. */
  t.check(!names.includes('Switched Unit'),
    'a row the file prices by the piece and the invoices buy by the carton is NOT called drift — it is the same price in two units, and subtracting one from the other is not a comparison');
  const split = scope.supplierPriceSeries(TODAY).find((s) => s.name === 'Switched Unit');
  t.check(split.fileUnitSplit === true, 'the pair says why it could not be checked');
  t.check(split.onFile === null && split.fileStale === false,
    'and no figure is put beside it — a number nobody can stand behind is worse than none');

  const once = scope.supplierPriceSeries(TODAY).find((s) => s.name === 'Once Only');
  t.check(once.onFile === null && once.fileStale === false,
    'nothing on file is reported as nothing on file — a different answer from agreeing');
}

/* ---------- 3b. the screen accounts for what it read ------------------ */
/*
 * The first version of the empty state said "nothing has moved: every
 * supplier is charging what they charged, and the Price Registry agrees
 * with what you actually paid". Both halves overclaim: a supplier bought
 * from ONCE has never charged twice, and a pair with no registry row
 * agrees with nothing. A screen with nothing to report owes an account
 * of what it read.
 */
if (scope) {
  const w = scope.supplierPriceWatch(TODAY);
  const r = w.reasons;

  eq(r.once, 1, 'a pair bought once is counted as such, not as a supplier holding their price');
  eq(r.sameDay, 1, 'and so is one bought several times on a single day');
  eq(r.unitSplit, 1, 'a pair left with one comparable point by the unit guard is counted too');
  t.check(w.steady.map((s) => s.name).join(',') === 'Steady Item',
    'a supplier who really did hold their price is NAMED');
  eq(r.steady, 1, 'and counted');
  eq(r.moved, 4, 'with the movers counted beside them');
  eq(r.once + r.sameDay + r.unitSplit + r.steady + r.moved, r.pairs,
    'every pair is in exactly one bucket — the account adds up to the whole list');

  eq(r.linesNoProduct, 1, 'a purchase line naming no product is counted, never silently skipped');
  eq(r.linesNoPrice, 1, 'and so is one carrying no price');
  t.check(r.linesRead > r.pairs, 'against the total lines actually read');
  t.check(r.noFileRow >= 1, 'pairs the Price Registry has never priced are counted — the file check cannot speak for them');
  /* NAMED RATHER THAN DROPPED, and named ACCURATELY. Folding these into
     noFileRow would have the screen say "no Price Registry row" about a
     pair that has one — true-sounding, and false. */
  eq(r.fileUnitSplit, 1,
    'a pair the file prices in another unit is its own count, not quietly folded into "no row on file"');
  t.check(scope.supplierPriceSeries(TODAY)
    .filter((s) => s.fileUnitSplit).every((s) => s.onFile === null),
    'and every one of them declined to compare rather than comparing badly');

  const steady = w.steady[0];
  t.check(steady.silence === 'steady' && steady.rise === 0
    && !w.up.includes(steady) && !w.down.includes(steady),
    'and a held price is in neither Going up nor Come down');
}

/* ---------- 4. one derivation, one story ------------------------------ */
if (scope) {
  const flags = scope.dashSupplierPriceInflation();
  t.check(flags.length > 0 && flags.every((f) => f.growth > 5),
    'the dashboard flag still only reports rises past its own threshold');
  const first = flags[0];
  t.check(typeof first.name === 'string' && typeof first.supplierName === 'string'
    && typeof first.first === 'number' && typeof first.last === 'number'
    && typeof first.growth === 'number' && typeof first.since === 'string',
    'and keeps the exact shape dashAlerts consumes');
  t.check(!flags.some((f) => f.name === 'Wall Angle'),
    'a 4% rise is under the dashboard threshold even though it costs the most — the card and the screen answer different questions from the SAME series');
  const deleg = extractFunction(src, 'dashSupplierPriceInflation', 'index.html');
  t.check(/supplierPriceWatch\(\)\.up/.test(deleg),
    'delegation in the source too — the alert cannot grow its own price history again');
}

/* ---------- 5. the wiring --------------------------------------------- */
{
  /* THE PAID SIDE OF THE REGISTRY. Three questions about one thing --
     what suppliers quote, what you actually paid, what other shops
     charge -- were three screens on the rail. This one is a side of the
     Price registry now, behind its switch; the old tab key still opens
     it, on that side, so the Manager's door, a saved last tab and the
     assistant's prompt all keep working without being told. */
  t.check(!/id="tab-prices-watch"/.test(src) && !/data-tab="prices-watch"/.test(src)
    && /data-lens="paid"/.test(src) && /id="pr_lens_paid"/.test(src) && /id="pw_body"/.test(src),
    'Supplier prices is the Paid side of the Price registry — a lens on that screen, not a screen of its own');
  const go = extractFunction(src, 'goToTab', 'index.html');
  const alias = extractFunction(src, 'resolveTab', 'index.html');
  t.check(/^function goToTab\(tab\)\{\n  tab = resolveTab\(tab\);/.test(go)
    && /if\(tab === 'prices-watch'\)\{ prLens = 'paid'; return 'prices'; \}/.test(alias),
    'and the old key still opens it, on that side — resolved once at the top of goToTab, never wherever a key happens to be read');
  t.check(/if\(tab==='prices'\) showPriceLens\(prLens\);/.test(go)
    && /if\(prLens === 'paid'\) renderPriceWatch\(\);/.test(extractFunction(src, 'showPriceLens', 'index.html')),
    'and redraws on entry');
  t.check(/'prices-watch': \{ tab: 'prices-watch'/.test(src),
    'the Manager\'s door keeps the key, which is what the alias is for');
  const panel = extractFunction(src, 'renderPriceWatch', 'index.html');
  t.check(/listPageSlice\('priceUp', w\.up\)/.test(panel) && /listPageSlice\('priceFile', w\.outOfStep\)/.test(panel),
    'each section shows the few that matter, with the rest one tap away');
  t.check(/selectPrProduct\(sr\.productId, sr\.variantIdx\)/.test(panel) && /openModal\('priceModal'\)/.test(panel),
    'and an out-of-step row opens the price form — this screen never edits the file itself');
  t.check(!/every supplier is charging what they charged/.test(panel),
    'the empty state no longer reassures — it accounts for what it read');
  t.check(/accountLines/.test(panel) && /Read <b>\$\{r\.linesRead\}<\/b> purchase line/.test(panel),
    'saying how many lines it read and how many pairs they make');
  t.check(/listPageSlice\('priceSteady', w\.steady\)/.test(panel),
    'and naming the suppliers who held their price rather than claiming it of everyone');
  t.check(/priceWatchDays:d\.presetPriceWatchDays/.test(src)
    && /presetPriceWatchDays: presets\.priceWatchDays != null \? Number\(presets\.priceWatchDays\) : 180/.test(src),
    'the look-back loads and persists like every other shop setting');
}

/* ---------- 6. the screen is a report, not a paragraph ---------------- */
/*
 * It wore the same spare parts as the buy plan: a filter bar with the
 * whole account of the screen crammed into a right-aligned hint beside
 * the look-back box, shopping-list rows, and a sixty-word paragraph of
 * semicolons where a breakdown of ninety pairs into five buckets
 * belongs. What a row here has to say is that a price moved and what
 * that move is worth -- and the worth was the second sub-line, in the
 * smallest text on the row, under the trail it explains.
 */
{
  const panel = extractFunction(src, 'renderPriceWatch', 'index.html');

  t.check(/class="ow-strip/.test(panel) && /'pairs compared'/.test(panel)
    && /'held their price'/.test(panel) && /'out of step with the file'/.test(panel),
    'what the side read is in the layer\'s strip, the one every converted screen uses for it');
  t.check(!/pw_summary/.test(src),
    'and not squeezed into a hint beside the look-back box — that element is gone');

  /* The file section first. Everything else here is information; a
     registry row that no longer matches what the shop pays is the one
     thing on the screen silently costing the buying plan its accuracy. */
  const iFile = panel.indexOf("listPageSlice('priceFile'");
  const iUp = panel.indexOf("listPageSlice('priceUp'");
  const iSteady = panel.indexOf("listPageSlice('priceSteady'");
  t.check(iFile > 0 && iFile < iUp && iUp < iSteady,
    'the out-of-step rows lead, because they are the ones with something to do about them');

  // The consequence, then the evidence.
  const iWhat = panel.indexOf('class="pw-what"');
  const iTrail = panel.indexOf('class="pw-trailline"');
  t.check(iWhat > 0 && iWhat < iTrail,
    'a row says what the move is worth before it shows the prices behind it');

  /* Each bucket its own row. A breakdown wants a column of counts that
     can be added up by eye. */
  t.check(/bits\.push\(\{ n: r\.once, why:/.test(panel) && /class="pw-account-row"/.test(panel),
    'the account is a breakdown, not a semicolon chain');
  t.check(/accountLines/.test(panel) && /Read <b>\$\{r\.linesRead\}<\/b> purchase line/.test(panel),
    'still saying how many lines it read and how many pairs they make');

  t.check(/<span class="ow-f-l">Look back<\/span><span class="ow-f-in"><input type="number" class="ow-f-v" id="pw_days"/.test(src),
    'the look-back is one of the layer\'s labelled fields, its unit in the box');
  t.check(/id="pw_days"/.test(src),
    'keeping the id — the listener binds to it at parse time with no null guard');

  /* THE SPARE PARTS ARE GONE. Consignment, What to buy, Supplier prices
     and Chase debts each have their own shape now, so .buy-controls,
     .buy-row, .buy-main and .buy-tail are dead and deleted. A dead rule
     in the stylesheet is how the next screen ends up wearing one. */
  // Matched as RULE selectors, not as prose: the comments explaining why
  // they went naturally name them, and a test that cannot tell a rule
  // from a sentence about a rule is a test that fails on its own record.
  t.check(!/\.buy-row\{/.test(src) && !/\.buy-controls\{/.test(src) && !/\.buy-tail h4\{/.test(src),
    'the borrowed classes are retired, not left in the drawer');
  t.check(!/class="buy-row"/.test(panel) && !/class="buy-note"/.test(panel),
    'while this one wears its own');

  /* Three kinds of row, three different chips, and none of them is a
     percentage pretending to be the other two. A steady row showing
     "+0%" would be a price change that never happened. */
  /* On the layer's chip now, with the mark before the word: a held row
     wears the flat bar, a file row the not-equal sign in amber. The
     chip's own names stay. */
  t.check(/<span class="ow-cp pw-move"[^>]*>\$\{ICON_TREND_FLAT\}held<\/span>/.test(panel)
    && /<span class="ow-cp ow-warn pw-move file"[^>]*>\$\{ICON_NEQ\}file<\/span>/.test(panel),
    'a held row says held and a file row says file — the chip is passed in, not derived');
  t.check(/pw-move\$\{sr\.rise > 0 \? ' up' : ' down'\}/.test(panel),
    'and only a moved row carries a percentage, up or down');
}

process.exit(t.done() ? 1 : 0);
