/*
 * Debtors, drawn rather than explained.
 *
 * Two readings put figures on the redesigned screen that did not exist
 * before, and both are held here to the app's rule that every figure is
 * derived, never invented:
 *
 *   debAllocatePayment  what a payment typed into an open row would
 *                       clear. It has to say what the payment form will
 *                       actually do when that row opens it, or the
 *                       preview is a promise the save breaks.
 *   debBookHistory      the rail's twelve weeks: what the ledger said was
 *                       owed at each week's end, and how much of it was
 *                       already sixty days old then.
 *
 * Run: node test/debtors-visual.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('debtors visual');
const src = read('index.html');
const TODAY = '2026-08-04';
const data = { customers: [] };
const ago = (days) => new Date(Date.parse(TODAY + 'T00:00:00Z') - days * 86400000)
  .toISOString().slice(0, 10);

const scope = compileScope([
  extractFunction(src, 'daysBetweenISO', 'index.html'),
  extractFunction(src, 'customerOpenCharges', 'index.html'),
  extractFunction(src, 'debAllocatePayment', 'index.html'),
  extractFunction(src, 'debBookHistory', 'index.html'),
], {
  data,
  todayISO: () => TODAY,
}, ['debAllocatePayment', 'debBookHistory']);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the payment preview is the payment form's arithmetic --- */
{
  const invs = [
    { id: 1, no: 'INV-0001', date: ago(90), due: 1000 },
    { id: 2, no: 'INV-0002', date: ago(40), due: 600 },
    { id: 3, no: 'INV-0003', date: ago(5), due: 300 },
  ];
  const all = new Set(['1', '2', '3']);

  const a = scope.debAllocatePayment(1900, invs, all, 1300);
  eq(a.lines[0].clears, 1000, 'the oldest invoice is filled first');
  eq(a.lines[1].clears, 300, 'and the next takes only what is left');
  eq(a.lines[2].clears, 0, 'the newest is untouched');
  eq(a.cleared, 1, 'one invoice cleared in full, not two — a part-paid one is not cleared');
  eq(a.leftOwing, 600, 'what is left owing is the balance less the payment');
  eq(a.over, 0, 'and nothing was overpaid');

  /* The payment form lists only orders that carry this customer's id.
     An invoice matched by name alone is never ticked there, so drawing
     it as cleared would be a preview the save does not keep. */
  const some = new Set(['2', '3']);
  const b = scope.debAllocatePayment(1900, invs, some, 700);
  eq(b.lines[0].clears, 0, 'an invoice the form cannot offer is not drawn as cleared');
  eq(b.lines[0].can, false, 'and is marked as such');
  eq(b.lines[1].clears, 600, 'the payment goes to the oldest one it can reach');
  eq(b.lines[2].clears, 100, 'and on to the next');

  /* Past the invoices, the form reduces the balance directly; past the
     balance, the balance stops at nothing. Both are said, not hidden. */
  const c = scope.debAllocatePayment(2100, invs, all, 2500);
  eq(c.onInvoices, 1900, 'every invoice is paid off first');
  eq(c.toAccount, 200, 'the rest comes off the part of the balance on no invoice');
  eq(c.leftOwing, 0, 'the balance stops at nothing');
  eq(c.over, 400, 'and what was handed over beyond it is named');

  const z = scope.debAllocatePayment(1900, invs, all, 0);
  t.check(z.lines.every((l) => l.clears === 0) && z.leftOwing === 1900,
    'an empty box clears nothing and leaves the balance as it is');
}

/* ---------- 2. the twelve weeks come from the ledger ----------------- */
{
  let id = 1;
  const log = (rows) => rows.map(([d, type, amount]) => ({ id: id++, date: d == null ? '' : ago(d), type, amount }));
  data.customers = [
    // 1,000 charged 70 days ago and never paid: over sixty days today,
    // under it six weeks ago.
    { id: 'A', name: 'Old', debt: 1000, debtLog: log([[70, 'charge', 1000]]) },
    // 500 charged 30 days ago, 200 paid 10 days ago.
    { id: 'B', name: 'Part', debt: 300, debtLog: log([[30, 'charge', 500], [10, 'payment', 200]]) },
    // A row with no date cannot be placed on any week.
    { id: 'C', name: 'Undated', debt: 400, debtLog: log([[null, 'charge', 400]]) },
  ];
  const h = scope.debBookHistory(12);
  eq(h.length, 12, 'twelve points for twelve weeks');
  eq(h[11].asOf, TODAY, 'the last point is today');
  eq(h[11].total, 1300, 'today it holds what the dated ledger says is owed');
  eq(h[11].old, 1000, 'of which the seventy-day charge is over sixty days');
  const sixWeeks = h[11 - 6];
  eq(sixWeeks.total, 1000, 'six weeks ago only the first charge had been raised');
  eq(sixWeeks.old, 0, 'and it was not yet sixty days old');
  eq(h[0].total, 0, 'before either charge nothing was owed');
  t.check(h.every((p) => p.total >= p.old), 'the old part never exceeds the whole');
}

process.exit(t.done() ? 1 : 0);
