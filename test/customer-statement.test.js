#!/usr/bin/env node
'use strict';
/*
 * A statement of account — the sheet a customer gets handed when they
 * ask what they owe.
 *
 * BUILT FROM THE DEBT LOG, not from the invoices. Invoicing an order
 * already writes a charge into the log ("Auto-sync — INV-xxxx"), taking
 * a payment writes a credit, and a manual charge or an opening balance
 * write their own entries. Deriving the account from invoices as well as
 * reading the log would count every credit sale twice — which on a
 * document you hand to a customer is the worst kind of wrong.
 *
 * The consequence is that this statement is exactly as good as the debt
 * log, and the sheet says so when the log and the balance the shop
 * carries disagree, rather than picking one of them.
 *
 * The decisions pinned below:
 *
 *   opening balance    everything before the period collapses into one
 *                      line. Reprinting three years of a regular
 *                      customer's history is not more honest, just
 *                      longer, and the carried figure holds the rest.
 *   stable order       two entries on the same day have no other way to
 *                      be ordered than the order they were written. A
 *                      running balance that reorders them shows a
 *                      customer a sequence that never happened.
 *   the disagreement   surfaced, never hidden.
 *
 * Run: node test/customer-statement.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('customer statement');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const data = { customers: [] };

const scope = compileScope([
  extractFunction(src, 'customerStatementRows', 'index.html'),
], { data }, ['customerStatementRows']);

const charge = (id, date, amount, note) => ({ id, date, type: 'charge', amount, note: note || '' });
const payment = (id, date, amount, note) => ({ id, date, type: 'payment', amount, note: note || '' });
const customer = (debtLog, debt) => {
  data.customers = [{ id: 'C1', name: 'Kato Construction', debt: debt == null ? 0 : debt, debtLog }];
};
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the running balance ----------------------------------- */
{
  customer([
    charge(1, '2026-01-10', 400000, 'Opening balance'),
    charge(2, '2026-03-05', 250000, 'Auto-sync — INV-0042'),
    payment(3, '2026-03-20', 400000, 'Cash'),
    charge(4, '2026-05-02', 250000, 'Auto-sync — INV-0071'),
    payment(5, '2026-05-30', 250000, 'MoMo'),
  ], 250000);
  const st = scope.customerStatementRows('C1', '2026-03-01', '2026-08-04');

  eq(st.opening, 400000, 'January is before the period, so it is carried in as one figure');
  eq(st.rows.length, 4, 'and only the four entries inside it are listed');
  t.check(st.rows.map((r) => r.balance).join(',') === '650000,250000,500000,250000',
    `the balance runs down the page (${st.rows.map((r) => r.balance).join(' -> ')})`);
  eq(st.charged, 500000, 'charges in the period are totalled');
  eq(st.paid, 650000, 'and so are payments');
  eq(st.closing, 250000, 'leaving what is owed now');

  // A charge adds, a payment subtracts. Getting this backwards produces a
  // document that tells a customer they are in credit when they owe.
  eq(st.rows[0].charge, 250000, 'a charge shows in the charged column');
  eq(st.rows[0].payment, 0, 'and not in the paid one');
  eq(st.rows[1].payment, 400000, 'a payment shows in the paid column');
  eq(st.rows[1].charge, 0, 'and not in the charged one');
}

/* ---------- 2. the period ------------------------------------------- */
{
  // Nothing outside the period appears as a row, in either direction.
  const st = scope.customerStatementRows('C1', '2026-03-01', '2026-04-30');
  eq(st.rows.length, 2, 'entries after the period are left out as well as those before');
  eq(st.opening, 400000, 'the opening still carries everything earlier');
  eq(st.closing, 250000, 'and the closing is the balance at the end of the period, not today');

  // An all-time statement has nothing to carry.
  const all = scope.customerStatementRows('C1', '0000-01-01', '2026-08-04');
  eq(all.opening, 0, 'over all time there is no balance brought forward');
  eq(all.rows.length, 5, 'and every entry is listed');
  eq(all.closing, 250000, 'reaching the same closing figure as the shorter period');
}

/* ---------- 3. two entries on one day -------------------------------- */
{
  /* Same date, so the only ordering available is the order they were
     written. A sort that dropped the tiebreak would let the payment
     print before the charge that caused it, showing the customer a
     sequence that never happened -- and a negative balance mid-page.

     Deliberately supplied out of order, so a stable sort alone would not
     produce the right answer. */
  customer([
    payment(9, '2026-06-01', 100000, 'Cash'),
    charge(8, '2026-06-01', 300000, 'Goods'),
  ], 200000);
  const st = scope.customerStatementRows('C1', '2026-01-01', '2026-12-31');
  eq(st.rows[0].note, 'Goods', 'the charge written first is listed first');
  eq(st.rows[0].balance, 300000, 'so the balance rises before it falls');
  eq(st.rows[1].balance, 200000, 'and lands on what is owed');
}

/* ---------- 4. the disagreement is surfaced -------------------------- */
{
  // The log is a history; c.debt is a balance kept beside it. Nothing
  // forces them to agree, and a statement that quietly disagrees with
  // what the shop will chase for is worse than one that admits it.
  customer([charge(1, '2026-06-01', 500000, 'Goods')], 500000);
  t.check(scope.customerStatementRows('C1', '2026-01-01', '2026-12-31').agrees,
    'a log that matches the recorded balance agrees');

  customer([charge(1, '2026-06-01', 500000, 'Goods')], 420000);
  const off = scope.customerStatementRows('C1', '2026-01-01', '2026-12-31');
  t.check(!off.agrees, 'and one that does not is flagged rather than smoothed over');
  eq(off.closing, 500000, 'the statement still shows what the entries come to');
  eq(off.recorded, 420000, 'alongside what the shop has recorded, so the gap can be settled');
}

/* ---------- 5. nothing to say ---------------------------------------- */
{
  customer([], 0);
  const st = scope.customerStatementRows('C1', '2026-01-01', '2026-12-31');
  eq(st.rows.length, 0, 'a customer who has never bought on credit has no entries');
  eq(st.opening, 0, 'nothing carried in');
  eq(st.closing, 0, 'and nothing owed');
  t.check(st.agrees, 'which agrees with a zero balance');

  // A customer with a settled account still gets a statement — that is
  // often exactly the one they asked for.
  customer([charge(1, '2026-06-01', 100000, 'Goods'), payment(2, '2026-06-20', 100000, 'Cash')], 0);
  const settled = scope.customerStatementRows('C1', '2026-01-01', '2026-12-31');
  eq(settled.closing, 0, 'a settled account closes at zero');
  eq(settled.rows.length, 2, 'with both sides of it shown');

  const gone = scope.customerStatementRows('NOBODY', '2026-01-01', '2026-12-31');
  t.check(gone.customer === null && gone.rows.length === 0,
    'and an unknown customer gives an empty statement rather than throwing');
}

/* ---------- 6. it is not derived twice ------------------------------- */
{
  const fn = (/function customerStatementRows[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/c\.debtLog/.test(fn), 'the statement reads the debt log');
  t.check(!/savedQuotes/.test(fn),
    'and NOT the invoices as well — invoicing already writes into the log, so reading both would charge every credit sale twice');
}

/* ---------- 7. the printed sheet ------------------------------------- */
{
  const p = (/function printCustomerStatement[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(p.length > 0, 'there is a print path');
  t.check(/clearInjectedPrintStyles\(\);/.test(p),
    'it clears a stale page size from another printout first');
  t.check(/printedShopName\(\)/.test(p) && /Statement of account/.test(p),
    'the sheet says whose it is and what it is');
  t.check(/Balance brought forward/.test(p), 'the carried figure is labelled, not left as an unexplained row');
  t.check(/st\.agrees \? '' :/.test(p),
    'and the disagreement, when there is one, is printed on the sheet');
  t.check(/printArea'\)\.innerHTML = '';/.test(p),
    'the print area is emptied afterwards, so the next receipt does not carry a statement');

  /* Built from the year and month, never by subtracting months from a
     date: standing on the 31st, setUTCMonth(-6) asks for the 31st of a
     30-day month and JavaScript rolls it forward. The same trap the loan
     window fell into. */
  const range = (/function customerStatementRange[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/Date\.UTC\(d\.getUTCFullYear\(\), d\.getUTCMonth\(\) - CUSTOMER_STATEMENT_MONTHS, 1\)/.test(range),
    'the six-month window is built from the year and month, not by subtracting from the day');

  t.check(/id="cstPrintBtn"/.test(code) && /printCustomerStatement\(btn\.dataset\.id\)/.test(code),
    'and the customer panel carries the button that prints it');
}

process.exit(t.done() ? 1 : 0);
