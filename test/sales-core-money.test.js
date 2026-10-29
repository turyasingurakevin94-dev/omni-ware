#!/usr/bin/env node
'use strict';
/*
 * The money rules Sales needs (src/core/money.ts), checked against the
 * spec (docs/spec/02-money.md) and the sample shop's own figures
 * (docs/canvas/sales-agent/FACTS.md). Node 22 runs the TypeScript as it is:
 * no build, no install.
 *
 * Run: node test/sales-core-money.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales core money');
const M = require(path.join(ROOT, 'src/core/money.ts'));

const line = (qty, price, o = {}) => ({ lineId: 1, itemId: 'x', variantIdx: null, name: 'x', unit: 'pc', packUnit: '', packQty: 0, qty, price, cost: null, shopPrice: price,
  from: 'shelf', supplierId: '__stock__', priceBy: null, priceNote: null, priceReview: null, priceToldAt: null, state: null, stateAt: null, ...o });
const order = (lines, o = {}) => ({ lines, charges: [], discount: 0, credit: null, paid: 0, ...o });

/* ---- whole shillings and how money is written (spec 02 §1, Q3) ---- */
t.check(M.whole(1000.5) === 1001 && M.whole(-0.4) === 0 && Object.is(M.whole(-0.4), 0), 'whole shillings: 1000.5 → 1,001; never -0');
t.check(M.money(1250000) === '1,250,000', 'money: 1,250,000');
t.check(M.ugx(1000) === '1,000 UGX' && M.ugx(null) === '', 'ugx: "1,000 UGX", blank when empty (Q3)');
t.check(M.short(3240000) === '3.2M' && M.short(1910000) === '1.9M' && M.short(35000000) === '35M', 'short: +3.2M, 1.9M, 35M (FACTS §5)');
t.check(M.short(1610000, 2) === '1.61M' && M.short(3240000, 2) === '3.24M', 'short with two decimals: 1.61M a day, 3.24M');
t.check(M.short(734000) === '734k' && M.short(500000) === '500k', 'short: 734k, 500k');
t.check(M.signed(-1000) === '−1,000' && M.signed(3240000) === '+3,240,000', 'signed: −1,000 and +3,240,000');

/* ---- an order's total (spec 02 §2) ---- */
t.check(M.lineTotal(line(2.5, 3850)) === 9625 && M.lineTotal(line(1 / 3, 1000)) === 333, 'each line is whole before adding (0165 ow_order_total)');
t.check(M.goodsTotal([line(40, 38000), line(2, 145000), line(10, null)]) === 1810000, '#0552: 40 × 38,000 + 2 × 145,000 = 1,810,000; the hinge (price coming) is in no total');
t.check(M.goodsTotal([line(2, 145000), line(3, 18000, { state: 'dropped' })]) === 290000, 'a dropped line is in no total');
t.check(M.pricesComing([line(1, 100), line(6, null)]) === 1, '"1 price coming"');
t.check(M.chargeAmount({ id: 1, label: 'Delivery · Ntinda', type: 'fixed', value: 20000 }, 500000) === 20000, 'a fixed charge');
t.check(M.chargeAmount({ id: 1, label: 'x', type: 'percent', value: 2 }, 100001) === 2000, 'a percent charge, rounded');
t.check(M.chargeAmount({ id: 1, label: 'x', type: 'fixed', value: -5 }, 1) === 0, 'a charge at 0 or less is 0');
t.check(M.orderTotal(order([line(10, 18000)], { charges: [{ id: 1, label: 'Delivery · Ntinda', type: 'fixed', value: 20000 }] })) === 200000, 'order total = goods + charges (spec 02 Q14)');
t.check(M.cashTotal(order([line(1, 1000)], { discount: 5000 })) === 0, 'a discount never takes the total below 0 (Q2)');

/* ---- the credit charge: ONE line at 3% (FACTS §6, the lead's final ruling) ---- */
{
  const draft = order([line(5, 18000), line(1, 96000)], { credit: { pct: 3, days: 30 } });
  t.check(M.goodsTotal(draft.lines) === 186000, "Kyaligonza's draft is 186,000");
  t.check(M.creditCharge(draft) === 5580, 'on credit at 3%: Credit charge +5,580');
  t.check(M.orderTotal(draft) === 191580, '… 191,580 in all');
  const rows = M.extraRows(draft);
  t.check(rows.length === 1 && rows[0].label === 'Credit charge' && rows[0].amount === 5580, 'the bill shows it as ONE "Credit charge" line; unit prices stay the shop\'s');
  t.check(draft.lines[0].price === 18000, 'unit prices are not folded');
  t.check(M.creditCharge(order([line(1, 1000)])) === 0, 'no credit, no charge');
}

/* ---- owed, paid over, change, deposit (spec 02 §6, Q11) ---- */
t.check(M.orderOwes(order([line(40, 38000), line(2, 145000)], { paid: 1000000 })) === 810000, 'what is owed on an order: total less paid');
{
  const p = M.payPlan(470000, 560000);
  t.check(p.toDebt === 470000 && p.over === 90000, "Nansana: 560,000 on 470,000 owed → 90,000 over (FACTS lead ruling)");
  const ch = M.settleOver(470000, 560000, 'change');
  t.check(ch.moneyIn === 470000 && ch.change === 90000 && !ch.refused, 'Give change: only what is owed is money in');
  const dep = M.settleOver(470000, 560000, 'deposit');
  t.check(dep.moneyIn === 560000 && dep.deposit === 90000, 'Deposit: all of it is kept');
  t.check(M.settleOver(470000, 560000, null).refused, 'neither: refused (OWOVR)');
  t.check(M.payPlan(-50000, 100000).toDebt === 0, 'a deposit already held: nothing is owed');
}
t.check(M.changeFor(52000, 60000) === 8000 && M.changeFor(52000, 50000) === -2000, 'counter change: 60,000 for 52,000 → 8,000; short is negative');

/* ---- the 21-day hold (spec 02 Q8; FACTS §3.1) ---- */
t.check(M.HOLD_DAYS === 21, 'the hold is 21 days');
t.check(M.holdDay('2026-10-02') === '2026-10-23', '#0531 of Fri 2 Oct reaches the hold Fri 23 Oct');
t.check(!M.pastHold('2026-10-02', '2026-10-17') && M.pastHold('2026-08-24', '2026-10-17'), '15 days is under 21; 54 days is past');
{
  const kato = { owes: 420000, creditLimit: 2000000, debtLog: [
    { id: 1, day: '2026-10-02', type: 'charge', amount: 980000, orderId: 511 }, { id: 2, day: '2026-10-02', type: 'payment', amount: 980000, orderId: 511 },
    { id: 3, day: '2026-10-02', type: 'charge', amount: 300000, orderId: 531 },
    { id: 4, day: '2026-10-06', type: 'charge', amount: 3620000, orderId: 529 }, { id: 5, day: '2026-10-08', type: 'payment', amount: 3620000, orderId: 529 },
    { id: 6, day: '2026-10-09', type: 'charge', amount: 120000, orderId: 544 },
  ] };
  const open = M.openCharges(kato);
  t.check(open.length === 2 && open[0].orderId === 531 && open[0].left === 300000 && open[1].orderId === 544, "Kato's open bills: #0531 300,000 and #0544 120,000 (a payment clears the bill it names first)");
  t.check(M.oldestAge(kato, '2026-10-17') === 15, "Kato's oldest is 15 days");
  t.check(M.creditHold(kato, 100000, true, '2026-10-17') === null, 'Kato within his 2,000,000 limit and under 21 days: no hold');
  t.check(M.creditHold(kato, 1700000, true, '2026-10-17').over, 'over the limit with the order: held');
  const ks = { owes: 420000, creditLimit: null, debtLog: [{ id: 1, day: '2026-08-24', type: 'charge', amount: 1110000, orderId: 533 }, { id: 2, day: '2026-10-09', type: 'payment', amount: 690000, orderId: 533 }] };
  const h = M.creditHold(ks, 186000, true, '2026-10-17');
  t.check(h && h.old && h.age === 54 && h.noLimit, 'Kyaligonza: 54 days past the hold and no limit set → new credit waits for Ruth');
}

process.exit(t.done() ? 1 : 0);
