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

/* ---------- 7. the printed sheet -------------------------------------
   Repointed, not weakened: the sheet's LAYOUT moved into
   printStatementSheet when the supplier statement was built, because
   which columns exist and where the opening balance sits must be
   identical on both documents. Every claim below is the one it always
   was; it is now made about the builder the customer print calls. */
{
  const caller = (/function printCustomerStatement[\s\S]*?\n\}/.exec(code) || [''])[0];
  const p = (/function printStatementSheet[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(caller.length > 0 && p.length > 0, 'there is a print path');
  t.check(/printStatementSheet\(st, \{/.test(caller),
    'and it goes through the shared sheet rather than laying out its own');
  t.check(/clearInjectedPrintStyles\(\);/.test(p),
    'it clears a stale page size from another printout first');
  t.check(/printedShopName\(\)/.test(p) && /Statement of account/.test(p),
    'the sheet says whose it is and what it is');
  t.check(/Balance brought forward/.test(p), 'the carried figure is labelled, not left as an unexplained row');
  t.check(/st\.agrees \? '' :/.test(p),
    'and the disagreement, when there is one, is printed on the sheet');
  t.check(/printArea'\)\.innerHTML = '';/.test(p),
    'the print area is emptied afterwards, so the next receipt does not carry a statement');

  /* The wording is the caller's and the document is not. A customer is
     told what they owe you; read the other way round that sentence is
     simply false, which is why the sentences are passed in and the
     table is not. */
  t.check(/owesLine: \(m\)=> `<b>\$\{esc\(c\.name\)\}<\/b> owes/.test(caller),
    'the customer’s own closing sentence is supplied by the customer print');
  t.check(/payWord: 'Payment received'/.test(caller),
    'along with the word for money coming in');

  /* Built from the year and month, never by subtracting months from a
     date: standing on the 31st, setUTCMonth(-6) asks for the 31st of a
     30-day month and JavaScript rolls it forward. The same trap the loan
     window fell into. */
  const range = (/function customerStatementRange[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/Date\.UTC\(d\.getUTCFullYear\(\), d\.getUTCMonth\(\) - CUSTOMER_STATEMENT_MONTHS, 1\)/.test(range),
    'the six-month window is built from the year and month, not by subtracting from the day');

  /* The panel was a modal with its own button ids; it is a screen now,
     and every control on it goes through one delegated listener. Same
     guarantee, one listener rather than one per render. */
  t.check(/data-cact="print" data-cid=/.test(code)
       && /if\(name === 'print'\) return printCustomerStatement\(id\);/.test(code),
    'and the customer account carries the button that prints it');
}

/* ---------- 8. the same statement, on screen -------------------------
   All of the above existed, and could only be READ by printing it. The
   customer panel showed what somebody buys and how often, and never the
   orders, the payments and the balance they leave -- which is the one
   question a customer standing at the counter actually asks.

   Built from customerStatementRows, the same builder the print calls, so
   the sheet handed over the counter cannot carry different figures from
   the screen it was read off. */
/* REBUILT TO THE DESIGN BOARD. The statement on screen is now one ruled
   table per reading (customerStatementPanelHTML), and every guarantee
   below is the one this section was written for, asked of the builder
   that now draws it: the same statement-builder as the print, over the
   same period as the print, no second sum over the log, charges and
   payments in their own columns, the balance running down, the carried
   line and the closing line labelled, an empty period said in words,
   and the disagreement on screen. statementLedgerHTML still draws the
   supplier's statement and keeps its own pins in section 9. */
{
  const panel = extractFunction(src, 'customerStatementPanelHTML', 'index.html');
  const lines = extractFunction(src, 'customerLedgerLines', 'index.html');
  const print = extractFunction(src, 'printCustomerStatement', 'index.html');
  t.check(panel.length > 0 && lines.length > 0, 'the account has a statement');

  t.check(/customerStatementRows\(c\.id, from, to\)/.test(panel),
    'it calls the same builder as the print rather than totting the log up again');
  t.check(/const \{ from, to \} = customerStatementPeriod\(c\);/.test(panel) && /customerStatementPeriod\(cRec\)/.test(print),
    'over the same period the print covers, so the two documents cannot differ');
  t.check(!/debtLog/.test(panel) && !/debtLog/.test(lines),
    'and does no arithmetic of its own over the log — a second sum is a second answer waiting to happen');

  t.check(/st\.rows\.forEach/.test(lines), 'every entry in the period is listed');
  t.check(/l\.charge \? `<span class="ow-fig">\$\{f\(l\.charge\)\}<\/span>` : '<span class="cu-dash">&mdash;<\/span>'/.test(panel)
       && /l\.pay \? `<span class="ow-fig cu-sp-paid">\$\{f\(l\.pay\)\}<\/span>` : '<span class="cu-dash">&mdash;<\/span>'/.test(panel),
    'with charges and payments in their own columns, a zero shown as a dash');
  t.check(/bal: r\.balance/.test(lines) && /f\(l\.bal\)/.test(panel), 'and the balance running down beside them');
  t.check(/bal: st\.opening/.test(lines) && /Balance brought forward/.test(lines),
    'anything older is carried in as one labelled line, not dropped');
  t.check(/f\(st\.closing\)/.test(panel) && /Balance now due/.test(panel), 'closing on what is owed now');
  t.check(/st\.rows\.length \? '' :/.test(panel) && /Nothing was charged or paid/.test(panel),
    'a period with no movement says so rather than showing an empty table');
  t.check(/!st\.agrees/.test(panel) && /ok \? '' : customerOffBookHTML\(s\)/.test(panel),
    'and the log-versus-balance disagreement is shown on screen, not only on paper');

  /* Guarded, and shown even without an invoiced order. */
  const acct = extractFunction(src, 'renderCustomerAccount', 'index.html');
  t.check(/const hasLedger = !!\(Array\.isArray\(c\.debtLog\) && c\.debtLog\.length\);/.test(acct)
    && /s\.orderCount \|\| hasLedger \? customerStatementPanelHTML\(r\)/.test(acct),
    'a customer with a ledger but no invoiced order still gets their account');
  t.check(/if\(!c\)\{[\s\S]*?no longer on file/.test(acct), 'and a customer whose record has gone gives a sentence, not a throw');
}

/* ---------- 9. what a line says it is --------------------------------
   Every one of the 21 entries in this shop's log was written by the
   invoice sync, whose note is a machine tag: "Auto-sync — INV-0150".
   Printed straight into a Detail column, the same two words head every
   line of a document whose whole job is telling one line from another.

   Reworded on the way OUT. The stored note stays exactly as written,
   because debtLogIsInvoiceOwned() falls back to matching it on rows
   predating quoteId — rewriting what is on file would orphan them. */
{
  const detail = compileScope([extractFunction(src, 'statementRowDetail', 'index.html')],
    {}, ['statementRowDetail']).statementRowDetail;

  eq(detail({ type: 'charge', note: 'Auto-sync — INV-0150' }), 'Invoice INV-0150',
    'a charge names the order it came from, not the process that recorded it');
  eq(detail({ type: 'payment', note: 'Auto-sync — INV-0148' }), 'Payment received — INV-0148',
    'and a payment says which invoice it was set against');

  // A note somebody typed is theirs. Reaching in to reword it would lose
  // the only thing on the row the shop chose to say.
  eq(detail({ type: 'charge', note: 'Opening balance' }), 'Opening balance',
    'a hand-written note is left alone');
  eq(detail({ type: 'payment', note: 'MoMo' }), 'MoMo', 'whichever side it is on');

  // A row with nothing written on it still has to name itself.
  eq(detail({ type: 'charge', note: '' }), 'Goods supplied', 'an unnoted charge is still described');
  eq(detail({ type: 'payment' }), 'Payment received', 'and so is an unnoted payment, note or no note');

  /* The stored string is load-bearing. If the sync ever wrote the
     display wording instead, debtLogIsInvoiceOwned's legacy fallback
     would stop recognising its own rows. */
  t.check(/note: `Auto-sync — \$\{invoiceNumberLabel\(q\)\}`/.test(code),
    'the sync still writes the tag it always wrote');
  t.check(/\/\^Auto-sync — INV-\/\.test\(String\(l\.note\|\|''\)\)/.test(code),
    'which is what identifies an invoice-owned row written before quoteId existed');

  // Both renderers, one rule -- they had a copy each, and a copy each is
  // how the counter and the paper come to disagree.
  const block = extractFunction(src, 'statementLedgerHTML', 'index.html');
  const print = extractFunction(src, 'printStatementSheet', 'index.html');
  t.check(/statementRowDetail\(r, payWord\)/.test(block), 'the screen names rows through it');
  t.check(/esc\(statementRowDetail\(r, side\.payWord\)\)/.test(print), 'and so does the paper');
  t.check(!/r\.note \|\| \(r\.type === 'charge'/.test(code),
    'with the duplicated fallback gone from both');

  /* The one word that flips between the two accounts. Money leaving the
     shop is not "received", and a supplier statement that said so would
     read as though the shop had been paid. */
  eq(detail({ type: 'payment', ref: 'PINV-0012' }, 'Payment made'), 'Payment made — PINV-0012',
    'the paying side names its own direction');
  eq(detail({ type: 'payment', ref: 'PINV-0012' }), 'Payment received — PINV-0012',
    'and the default stays the receiving side, so the customer statement is unchanged');
  eq(detail({ type: 'charge', ref: 'PINV-0012' }), 'Invoice PINV-0012',
    'a charge names its document whichever side it is on');
  eq(detail({ type: 'payment' }, 'Payment made'), 'Payment made',
    'and an unreferenced payment still takes the right word');
}

process.exit(t.done() ? 1 : 0);
