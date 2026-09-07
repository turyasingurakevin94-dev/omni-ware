#!/usr/bin/env node
'use strict';
/*
 * Correcting what the goods COST, when the count is already right.
 *
 * ELEPHANT King — Short / Single Lock, on the real books. Twelve cartons
 * went on the ledger as "12" at 290,000 each. Sales took it to 4. Then
 * somebody counted the shelf and entered it in DOZENS: +56, then +20, to
 * 80. Once every movement is read in the shelf's own unit that 80 is
 * right — 80 Dozen IS the 4 Ctn standing there — so the COUNT needs no
 * correcting at all.
 *
 * The money does. The lots still hold 4 units at 290,000 (a carton's
 * price, now against a dozen) and 76 at 14,000, so the shelf claims
 * 2,224,000 for goods that cost 1,160,000, and reports 290,000 as the
 * cost of one dozen.
 *
 * Nothing in the app could repair that. Correct the count moves a
 * QUANTITY and asks only what the EXTRA ones cost; priceUncostedStock
 * only touches lots carrying no cost at all; and the movement log offers
 * no reversal by design, because a ledger corrects by posting rather
 * than erasing. Worse, reversing those two corrections WOULD have been
 * wrong: it takes the shelf back to 4, which now reads as 4 Dozen.
 *
 * Run: node test/recost-shelf.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('correcting the cost of a shelf');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const src = read('index.html');

const data = {
  products: [{ id: 'P073', name: 'ELEPHANT King', variants: [{ combo: { Type: 'Short / Single Lock' } }] }],
  stock: {}, stockLots: {}, stockLog: [], nextStockLogId: 1,
};
const N = ['stockKey', 'shelfValueForKey', 'recostShelfLots', 'uncostedStockRows', 'priceUncostedStock'];
const fns = compileScope(N.map((n) => extractFunction(src, n, 'index.html')), {
  data,
  todayISO: () => '2026-09-07',
  allocRowId: () => data.nextStockLogId++,
  productVariantLabel: (p, vi) => (vi == null ? p.name : `${p.name} — ${Object.values(p.variants[vi].combo).join(' / ')}`),
  fmtUGX: (n) => `${Math.round(n).toLocaleString('en-US')} UGX`,
}, N);

// The shelf exactly as the movements screen shows it.
const reset = () => {
  data.stock = { 'P073::0': 80 };
  data.stockLots = { 'P073::0': [{ qty: 4, cost: 290000 }, { qty: 56, cost: 14000 }, { qty: 20, cost: 14000 }] };
  data.stockLog = [];
};

/* ---------- 1. the fault, as the shelf reports it --------------------- */
{
  reset();
  const v = fns.shelfValueForKey('P073::0');
  eq(v.qty, 80, 'eighty on the shelf — which, read in Dozens, is the 4 Ctn standing there');
  eq(v.value, 2224000, 'claiming 2,224,000, the figure on the Inventory card');
  eq(v.unitCost, 27800, 'at 27,800 a Dozen — the 27,800 the 566,000 carton price was built on');
}

/* ---------- 2. the repair ---------------------------------------------- */
{
  reset();
  // 290,000 a carton at twenty to the carton is 14,500 a Dozen.
  const res = fns.recostShelfLots('P073', 0, 14500, 'carton price against a line counted in dozens');
  eq(res.priced, 80, 'every unit of the shop\'s own is re-priced');
  eq(res.before, 2224000, 'from what the shelf claimed');
  eq(res.after, 1160000, 'to what the goods actually cost: 80 Dozen at 14,500');

  const v = fns.shelfValueForKey('P073::0');
  eq(v.unitCost, 14500, 'and one Dozen now costs a Dozen\'s price');
  eq(v.qty, 80, 'THE COUNT NEVER MOVED — a cost correction is not a stock correction');
  eq(data.stock['P073::0'], 80, 'not on the shelf either');
  eq((data.stockLots['P073::0'] || []).length, 3, 'the lots are re-priced, not collapsed or replaced');
  eq((data.stockLots['P073::0'] || []).reduce((s, l) => s + l.qty, 0), 80, 'and still account for every unit');
}

/* ---------- 3. posted, never painted over ----------------------------- */
{
  reset();
  fns.recostShelfLots('P073', 0, 14500, 'carton price against a line counted in dozens');
  eq(data.stockLog.length, 1, 'the correction is a movement of its own');
  const row = data.stockLog[0];
  eq(row.delta, 0, 'at delta zero, because no goods moved');
  eq(row.qtyAfter, 80, 'carrying the standing count so the column stays readable');
  eq(row.type, 'correction', 'and typed as the correction it is');
  eq(row.cost, 14500, 'with the figure that was applied');
  t.check(/Cost corrected to 14,500 UGX each on 80 units/.test(row.note), `the note says what was done (${row.note})`);
  t.check(/was worth 2,224,000 UGX, now 1,160,000 UGX/.test(row.note),
    'and what the shelf was worth before and after — the only record that can answer why the value moved');
  t.check(/carton price against a line counted in dozens/.test(row.note),
    'with the owner\'s own words kept');
}

/* ---------- 4. somebody else's goods are not the shop's to restate ---- */
{
  reset();
  data.stockLots['P073::0'] = [{ qty: 20, cost: 290000 }, { qty: 60, cost: 15000, consign: 'S-ROTO' }];
  const res = fns.recostShelfLots('P073', 0, 14500);
  eq(res.priced, 20, 'only the shop\'s own units are re-priced');
  eq(res.consigned, 60, 'the consignor\'s are counted and named');
  eq(data.stockLots['P073::0'][1].cost, 15000, 'and left at what will be handed over when they sell');
  t.check(/60 held on consignment left alone/.test(data.stockLog[0].note), 'which the log says out loud');

  // A shelf that is ALL somebody else's has nothing of the shop's to correct.
  reset();
  data.stockLots['P073::0'] = [{ qty: 80, cost: 15000, consign: 'S-ROTO' }];
  const none = fns.recostShelfLots('P073', 0, 14500);
  eq(none.priced, 0, 'nothing is re-priced');
  eq(data.stockLog.length, 0, 'and no movement is posted for a correction that did not happen');
}

/* ---------- 5. what it refuses ---------------------------------------- */
{
  reset();
  eq(fns.recostShelfLots('P073', 0, -1), null, 'a negative cost is refused');
  eq(fns.recostShelfLots('P073', 0, 'abc'), null, 'so is one that is not a number');
  eq(fns.recostShelfLots('P073', 0, null), null, 'and a blank one — "nobody knows" is not a figure');
  eq(data.stockLog.length, 0, 'none of which writes anything');
  // Zero IS a figure: goods really can have cost nothing.
  t.check(fns.recostShelfLots('P073', 0, 0).priced === 80, 'zero is accepted — a free delivery costs zero, which is not the same as unknown');
}

/* ---------- 6. it is the other half of priceUncostedStock ------------- */
{
  reset();
  data.stockLots['P073::0'] = [{ qty: 40, cost: 14500 }, { qty: 40, cost: null }];
  /* priceUncostedStock touches ONLY the lot with no cost; this touches
     every one of the shop's own. Two different faults, two repairs. */
  fns.recostShelfLots('P073', 0, 14500);
  const lots = data.stockLots['P073::0'];
  eq(lots[0].cost, 14500, 'a lot already right is left at the same figure');
  eq(lots[1].cost, 14500, 'and one carrying no cost is given it too');
  eq(fns.shelfValueForKey('P073::0').uncostedQty, 0, 'so nothing on the shelf is left unvalued');
}

process.exit(t.done() ? 1 : 0);
