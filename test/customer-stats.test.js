#!/usr/bin/env node
'use strict';
/*
 * What the shop knows about one customer.
 *
 * The card carried a debt balance and the last entry against it. That
 * says whether somebody owes you and nothing at all about whether they
 * are worth keeping -- a customer who has spent 9,000,000 at a healthy
 * margin and has not been seen for two months was indistinguishable from
 * one who bought once.
 *
 * Everything here is derived on read from orders and invoices. Nothing is
 * stored, so nothing can drift out of step with the orders it came from.
 *
 * The judgement calls, each pinned below because each could reasonably
 * have gone the other way:
 *
 *   invoiced only   a quote is not a sale. Same line the income
 *                   statement draws, so the two cannot disagree.
 *   matched by name a customer trading before their record was linked
 *                   keeps their history. The alternative is telling a
 *                   ten-year customer they are new.
 *   gaps, not rate  "every N days" is the span divided by the GAPS
 *                   inside it, not orders divided by months. Six orders
 *                   in one week and none since averages "every 5 days"
 *                   the naive way, and would then report them overdue
 *                   every day afterwards.
 *   twice the gap   overdue is relative to that customer's own rhythm.
 *                   A monthly buyer is not late on day 32.
 *
 * Run: node test/customer-stats.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer stats');
const src = read('index.html');
const TODAY = '2026-08-04';
const data = { customers: [], savedQuotes: [] };

const scope = compileScope([
  extractFunction(src, 'invoiceLineCost', 'index.html'),
  extractFunction(src, 'anInvoiceTotals', 'index.html'),
  extractFunction(src, 'savedQuoteTotal', 'index.html'),
  extractFunction(src, 'invoiceBalanceDue', 'index.html'),
  extractFunction(src, 'customerOutstandingInvoices', 'index.html'),
  extractFunction(src, 'customerOrdersFor', 'index.html'),
  extractFunction(src, 'daysBetweenISO', 'index.html'),
  extractFunction(src, 'customerStats', 'index.html'),
], {
  data,
  todayISO: () => TODAY,
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
}, ['customerStats', 'customerOrdersFor', 'daysBetweenISO']);

const sheets = (qty) => ({ productName: 'Iron sheets', qty, unit: 'pcs', supplierId: '__stock__',
  price: 34000, sellPrice: 45000, _stockLots: [{ qty, cost: 30000 }] });
const cement = (qty) => ({ productName: 'Cement', qty, unit: 'bags', supplierId: '__stock__',
  price: 32000, sellPrice: 38000, _stockLots: [{ qty, cost: 31000 }] });
const order = (id, date, over) => Object.assign({
  id, customerId: 'C1', date, invoiced: true, invoicedAt: date, voided: false,
  amountPaid: 0, client: { name: 'Okello Hardware' }, items: [sheets(10)],
}, over);
const reset = () => {
  data.customers = [{ id: 'C1', name: 'Okello Hardware', location: 'Gulu', debt: 0 }];
  data.savedQuotes = [];
};
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${got}, want ${want})`);

/* ---------- 1. what they are worth ----------------------------------- */
{
  reset();
  data.savedQuotes = [
    order(1, '2026-05-01'), order(2, '2026-05-21'), order(3, '2026-06-10'),
    order(4, '2026-06-30', { amountPaid: 200000, items: [cement(40)] }),
  ];
  const s = scope.customerStats('C1');

  // Three orders of 10 sheets at 45,000 and one of 40 cement at 38,000.
  eq(s.orderCount, 4, 'every invoiced order counts');
  eq(s.sales, 1350000 + 1520000, 'spent with you is what they were billed');
  eq(s.cost, 900000 + 1240000, 'costed from the stock lots the goods actually came out of');
  eq(s.profit, 730000, 'so profit is real profit, not a percentage of turnover');
  t.check(Math.abs(s.margin - 25.44) < 0.01, `and the margin follows from it (got ${s.margin.toFixed(2)})`);
  eq(s.average, 717500, 'the typical order is the mean of the four');
  eq(s.biggest, 1520000, 'and the biggest is the cement order');

  // By value, not by quantity: 40 bags of cement outranks 30 sheets
  // because it is more money, which is the question being asked.
  eq(s.topProducts[0].name, 'Cement', 'what they buy is ranked by spend');
  eq(s.topProducts[0].qty, 40, 'quantities accumulate across orders');
  eq(s.topProducts[1].name, 'Iron sheets', 'and the sheets follow');
  eq(s.topProducts[1].qty, 30, 'summed over all three orders that carried them');
}

/* ---------- 1b. ranked by money, where the two disagree -------------- */
{
  /* The fixture above cannot tell the two rankings apart: cement is both
     the biggest spend AND the biggest quantity, so sorting by qty would
     have produced the same list and the check would have passed on a
     broken sort. A mutation run caught exactly that.

     Nails separate them. 200 of them is the largest quantity on the
     account and the smallest amount of money, and "what they buy" is a
     question about money. */
  reset();
  data.savedQuotes = [order(1, '2026-07-01', {
    items: [
      sheets(5),                                                          //   225,000
      { productName: 'Nails', qty: 200, unit: 'kg', supplierId: '__stock__',
        price: 1500, sellPrice: 2000, _stockLots: [{ qty: 200, cost: 1400 }] }, // 400,000
      cement(20),                                                         //   760,000
    ],
  })];
  const s = scope.customerStats('C1');
  eq(s.topProducts[0].name, 'Cement', 'the biggest spend leads');
  eq(s.topProducts[1].name, 'Nails', 'then the next biggest spend');
  eq(s.topProducts[2].name, 'Iron sheets', 'and the smallest spend last');
  t.check(s.topProducts[0].qty < s.topProducts[1].qty,
    'even though the leader is not the largest quantity — 20 bags outrank 200 kg of nails because they are more money');
}

/* ---------- 2. do they still come ------------------------------------ */
{
  // Builds its own orders rather than leaning on the block above: a
  // fixture shared between sections means adding a case to one silently
  // changes the arithmetic of another, which is exactly what happened.
  reset();
  data.savedQuotes = [
    order(1, '2026-05-01'), order(2, '2026-05-21'),
    order(3, '2026-06-10'), order(4, '2026-06-30'),
  ];
  // 1 May to 30 June is 60 days across THREE gaps, so every 20 days.
  // Orders-divided-by-months would say 4 over 2 months = every 15.
  const s = scope.customerStats('C1');
  eq(s.everyDays, 20, 'the rhythm is the span shared among the gaps inside it');
  eq(s.daysSinceLast, 35, 'and the silence since is counted from the last order');
  eq(s.overdue, false, '35 days is late for a 20-day buyer but not yet twice their gap');

  data.savedQuotes.push(order(5, '2026-05-05'));
  const s2 = scope.customerStats('C1');
  eq(s2.everyDays, 15, 'an extra order inside the span shortens the gap');
  eq(s2.overdue, true, 'and 35 days is now more than twice it — worth a call');

  // One order is not a rhythm, and claiming one would put a customer who
  // bought once on the "overdue" list forever.
  reset();
  data.savedQuotes = [order(1, '2026-07-30')];
  const s3 = scope.customerStats('C1');
  t.check(s3.everyDays === null, 'a single order establishes no pattern');
  eq(s3.overdue, false, 'so they cannot be overdue');
  eq(s3.daysSinceLast, 5, 'though how long it has been is still worth knowing');
}

/* ---------- 3. a quote is not a sale --------------------------------- */
{
  reset();
  data.savedQuotes = [
    order(1, '2026-07-01'),
    order(2, '2026-07-20', { invoiced: false, invoicedAt: null }),
    order(3, '2026-07-25', { voided: true }),
  ];
  const s = scope.customerStats('C1');
  eq(s.orderCount, 1, 'only invoiced orders are money earned');
  eq(s.openCount, 1, 'one is still on the board, and is counted separately rather than ignored');
  eq(s.sales, 450000, 'so an unbilled quote adds nothing to what they have spent');

  // A voided order is not an order. Counting it would inflate both the
  // spend and the rhythm.
  t.check(scope.customerOrdersFor('C1').every(q => !q.voided),
    'and a voided order is gone entirely, not merely uninvoiced');

  /* When it was BILLED, not when it was quoted. A quote raised in June
     and invoiced in July is a July sale, and dating it to June would
     both age the customer's silence wrongly and stretch their rhythm.

     Every fixture above happens to have the two dates equal, so this
     distinction was invisible to the suite until a mutation run swapped
     one for the other and nothing failed. */
  reset();
  data.savedQuotes = [
    order(1, '2026-06-01', { invoicedAt: '2026-07-20' }),
    order(2, '2026-06-10', { invoicedAt: '2026-08-01' }),
  ];
  const billed = scope.customerStats('C1');
  eq(billed.first, '2026-07-20', 'the first sale is dated to when it was billed');
  eq(billed.last, '2026-08-01', 'and so is the most recent');
  eq(billed.daysSinceLast, 3, 'so the silence is measured from the invoice, not the quote');
  eq(billed.everyDays, 12, 'and the rhythm spans the invoices, not the quotes');

  // The fallback still matters: an order billed before invoicedAt was
  // recorded has only its own date to go on.
  data.savedQuotes = [order(1, '2026-06-01', { invoicedAt: null })];
  eq(scope.customerStats('C1').last, '2026-06-01',
    'an older order with no invoice date falls back to its own');
}

/* ---------- 4. history survives a missing link ----------------------- */
{
  reset();
  data.savedQuotes = [
    order(1, '2026-06-01'),
    // Taken before the customer record existed, so it carries the name
    // and no id -- the same fallback orderIsRepeatClient uses.
    order(2, '2026-06-20', { customerId: null }),
    order(3, '2026-06-25', { customerId: null, client: { name: '  okello hardware  ' } }),
    order(4, '2026-06-28', { customerId: null, client: { name: 'Someone Else' } }),
  ];
  eq(scope.customerStats('C1').orderCount, 3,
    'an order matched by name still belongs to them — a long-standing customer must not read as new');
  t.check(!scope.customerOrdersFor('C1').some(q => q.id === 4),
    'and somebody else\'s order is not swept in by the fallback');
}

/* ---------- 5. what is owed ------------------------------------------ */
{
  reset();
  data.customers[0].debt = 50000;
  data.savedQuotes = [
    order(1, '2026-05-01', { amountPaid: 450000 }),
    order(2, '2026-06-01', { amountPaid: 100000 }),
    order(3, '2026-07-01'),
  ];
  const s = scope.customerStats('C1');
  eq(s.paid, 550000, 'what they have actually handed over');
  eq(s.outstanding, 350000 + 450000, 'against what is still due on the invoices');
  eq(s.unpaidCount, 2, 'a fully paid invoice is not outstanding');
  eq(s.oldestUnpaid, '2026-06-01', 'the oldest unpaid one is named');
  eq(s.oldestUnpaidDays, 64, 'and aged, because how long is the whole point');
  eq(s.debt, 50000, 'the hand-recorded balance on the card is carried through separately');
}

/* ---------- 6. nothing to show, said plainly ------------------------- */
{
  reset();
  const s = scope.customerStats('C1');
  eq(s.orderCount, 0, 'a customer with no orders has none');
  eq(s.sales, 0, 'and no spend');
  eq(s.margin, 0, 'a margin on nothing is zero, not a division by zero');
  t.check(s.everyDays === null && s.daysSinceLast === null && s.first === null,
    'with no dates invented to fill the gaps');
  t.check(Array.isArray(s.topProducts) && s.topProducts.length === 0,
    'and an empty list rather than a missing one');

  // A card can be clicked before its customer record has loaded, or after
  // it was deleted from another device.
  const gone = scope.customerStats('NO-SUCH-ID');
  t.check(gone.customer === null && gone.orderCount === 0,
    'an unknown customer returns an empty picture rather than throwing');
}

/* ---------- 7. the card opens it, its buttons do not ----------------- */
{
  // The card carries edit, delete, charge and payment. If the delegated
  // handler did not ignore clicks that landed on a button, editing a
  // customer would also open their history behind the form.
  const wiring = (/function wireCustomerCards\(\)[\s\S]*?\n\}\)\(\);/.exec(src) || [''])[0];
  t.check(/e\.target\.closest\('button'\)/.test(wiring),
    'a click on one of the card\'s own buttons does not also open the panel');
  t.check(/role="button"/.test(src) && /tabindex="0"/.test(src),
    'the card is reachable by keyboard, not only by pointer');
  t.check(/e\.key !== 'Enter' && e\.key !== ' '/.test(wiring),
    'and opens on Enter or Space like any other control');
  t.check(/e\.preventDefault\(\)/.test(wiring),
    'with Space stopped from scrolling the page instead');
  // Bound once on the wrapper: the grid is rebuilt on every search
  // keystroke, so per-card binding would leak a listener per render.
  t.check(/wrap\.addEventListener/.test(wiring) && !/card\.addEventListener/.test(wiring),
    'the handler is delegated, so re-rendering the grid does not stack listeners');
}

process.exit(t.done() ? 1 : 0);
