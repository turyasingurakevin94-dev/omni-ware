#!/usr/bin/env node
'use strict';
/*
 * How far through paying an invoice off the customer is.
 *
 * Unlike a customer's revolving debt, an invoice is one document with one
 * total, so the sum is just paid over total. What needed thinking about
 * is the three cases where that sum lies -- all three reachable, all
 * three found on the running app before any of this was written:
 *
 *   INV-0004  total 600,000  paid 900,000  ->  naive bar 150%
 *   INV-0005  total 0        paid 0        ->  naive bar NaN%
 *   INV-0006  voided         paid 300,000  ->  naive bar 60%
 *
 * The first draws a bar half again as long as its own track while the
 * status pill says "Settled". The second sets width:NaN%, an invalid
 * declaration the browser drops, leaving the fill at whatever width it
 * last had. The third says somebody is 60% of the way through settling a
 * document that has been cancelled.
 *
 * Run: node test/invoice-progress.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('invoice progress');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { products: [] };
const NAMES = ['invoicePaymentProgress', 'orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderCreditTerms', 'orderCreditCharge', 'savedQuoteCashTotal', 'orderChargesTotal',
  'savedQuoteTotal', 'quoteItemSellPrice'];
let scope = null; let err = null;
try {
  scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), { data }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the progress helper compiles${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(got - want) < 1e-9, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
// One line, so the total is whatever this says it is.
const inv = (total, paid, extra) => Object.assign({
  items: [{ qty: 1, sellPrice: total }], amountPaid: paid, voided: false,
}, extra || {});

const render = (/function renderInvoices[\s\S]*?\n\}\n/.exec(code) || [''])[0];
/* WHERE THE SAYING MOVED. Invoices is the card system's now and its row
   carries Invoiced and Still due instead of a progress bar, so there is no
   progressCell to read. Everything the bar and its label used to say is
   said in words by invNoteRowHTML, which rides directly under the row it
   is about. The measurement itself has not moved at all: both read
   invoicePaymentProgress(), which is what the sections above exercise
   directly and what makes this the same rule rather than a new one. */
const cell = (/function invNoteRowHTML\(q\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
t.check(cell.length > 0, 'the note that speaks for the bar is found');
t.check(/const p = invoicePaymentProgress\(q\);/.test(cell),
  'and it measures through the shared helper rather than restating the arithmetic');

/* ---------- 1. the ordinary sum -------------------------------------- */
if (scope) {
  near(scope.invoicePaymentProgress(inv(1200000, 400000)).pct, 1 / 3,
    'a third paid measures a third of the way through');
  eq(scope.invoicePaymentProgress(inv(800000, 800000)).pct, 1, 'settled in full is all the way');
  /* Zero HERE is a measurement, not an absence: a 2,500,000 invoice with
     nothing against it really is nowhere. That is the opposite call from
     the debtors bar, where a zero came from having nothing to measure. */
  eq(scope.invoicePaymentProgress(inv(2500000, 0)).pct, 0,
    'and nothing paid on a real invoice is a measured nought, not an unknown');
  eq(scope.invoicePaymentProgress(inv(1200000, 400000)).reason, null,
    'with no reason to give when it can be measured');
}

/* ---------- 2. paid more than it asks for ---------------------------- *
 * Not hypothetical. Nothing clamps a payment to the balance due, and
 * amending a short order lowers the total while amountPaid stays put --
 * the app's own dialog admits the resulting credit "is not tracked".
 */
if (scope) {
  const p = scope.invoicePaymentProgress(inv(600000, 900000));
  eq(p.pct, 1, 'an overpaid invoice is clamped so the bar cannot run past its own track');
  eq(p.over, 300000, 'and the excess is carried, so the screen can say so rather than showing a full bar');
  eq(scope.invoicePaymentProgress(inv(800000, 800000)).over, 0,
    'while settling exactly is not an overpayment');

  /* The clamp and the label read the SAME number in the naive version,
     so this is where a mutation hides: taking the true percentage from
     the clamped value turns 150% into a serene 100%, which is precisely
     what the status pill already wrongly says. */
  /* p.pct is still clamped -- that is the helper's job and section 2
     above proves it -- but nothing on the card row is drawn from it, so
     the danger the clamp used to create has moved rather than gone. It
     used to be a full-looking bar; it is now a Still due column reading 0.
     Either way the TRUE percentage is the thing that must be spoken, and
     taking it from the clamped value would turn 150% into a serene 100%.
     That is exactly what the state chip already wrongly says when it reads
     "paid", which is why the sentence has to contradict it. */
  t.check(/const pct = p\.total > 0 \? Math\.round\(p\.paid\/p\.total\*100\) : 0;/.test(cell),
    'the percentage is taken from the true figure, so 150% reads 150%');
  t.check(/\${pct}% of what it asks for/.test(cell),
    'and it is said on the row, because Still due reads 0 on an overpaid invoice');
  t.check(/om-nrow-bad/.test(cell),
    'marked in the colour that says something is wrong, since the row above it looks settled');
  t.check(/more than it asks for/.test(cell) && /refunding or carrying to their next order/.test(cell),
    'and named as money that needs handling, not merely as a wrong number');
}

/* ---------- 3. an invoice that totals nothing ------------------------ *
 * An item with no sell price contributes nothing, so an invoice of them
 * totals nothing and paid/total is NaN.
 */
if (scope) {
  const zero = { items: [{ qty: 5, sellPrice: null, price: null }], amountPaid: 0, voided: false };
  eq(scope.savedQuoteTotal(zero), 0, 'an unpriced invoice really does total nothing');
  const p = scope.invoicePaymentProgress(zero);
  eq(p.pct, null, 'so it reports no measurement rather than NaN');
  eq(p.reason, 'no-total', 'saying which of the two silences it is');
  /* "Price the items to see progress" was written for a bar. There is no
     bar, and the thing to do about an unpriced invoice is not to watch it
     fill -- it is to price it, or to undo a document nobody was ever asked
     to pay. The fact is unchanged; the instruction is now the one that
     applies. */
  t.check(/totals nothing — its items carry no price/.test(cell)
    && /Price the items, or undo the invoice/.test(cell),
  'and the screen says what to do about it');
}

/* ---------- 4. a voided invoice -------------------------------------- *
 * setInvoicesVoided drops the debt charge and DELIBERATELY keeps
 * q.payments and the Cash Book entries behind them. So a voided invoice
 * can still be holding real money, and this is the only screen anyone
 * would notice it on.
 */
if (scope) {
  const p = scope.invoicePaymentProgress(inv(500000, 300000, { voided: true }));
  eq(p.pct, null, 'a cancelled document has nothing to be part way through');
  eq(p.reason, 'voided', 'and says that is why');
  eq(p.paid, 300000, 'while still carrying what is sitting against it');

  /* Which reason wins when both apply. Voided is the more useful thing
     to say: the missing prices are why it totals nothing, but the void
     is why nobody is paying it. */
  eq(scope.invoicePaymentProgress({ items: [{ qty: 1, sellPrice: null, price: null }], amountPaid: 0, voided: true }).reason,
    'voided', 'a voided invoice that also totals nothing leads with the void');

  /* Two different things to say, and only one of them is a loose end. */
  t.check(/p\.paid > 0/.test(cell), 'the wording turns on whether money is actually sitting on it');
  t.check(/still recorded against it and still sitting in the Cash Book/.test(cell),
    'a voided invoice holding money names it as unfinished business');
  t.check(/Unvoid it, or remove the payment/.test(cell), 'with both ways out');
  /* An empty voided invoice gets NOTHING, and that is the right answer
     rather than a missing one. The bar had to say something in the space
     it occupied, so it said "nothing to be part way through paying". A
     note row occupies no space until there is something wrong, and a
     cancelled document with no money on it is not wrong -- it is finished.
     A screen that marks everything marks nothing. */
  t.check(/return '';/.test(cell),
    'while an empty voided one says nothing, because there is nothing unfinished about it');
}

/* ---------- 5. it reaches both layouts, from one call ---------------- */
{
  /* WHAT THIS SECTION USED TO PROTECT, and still does. It named two
     places -- a <td class="inv-status-cell"> and a <div
     class="deb-card-prog"> in the phone card beside it -- because the
     measure had to reach BOTH layouts. A figure that exists only on the
     console is missing from the screen the shop actually reads, and the
     two hand-written templates had already drifted once.

     The bar itself is gone: Invoices is the card system's and its row
     carries Invoiced and Still due. But the hazard came back the moment
     that row needed a phone layout, because the desktop grid is 344px of
     fixed columns before gaps and cannot be made to fit 390. So the row
     builder emits BOTH -- five cells for the console, one two-line block
     for the phone -- from ONE call, off the same document. That is what
     is checked now: one function, both layouts, and the phone's figures
     read from the same variables the cells do. */
  const row = (/function invRegisterRowHTML\(q, groupKey\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(row.length > 0, 'the register has one row builder');
  t.check(/class="om-lrow-ph"/.test(row),
    'and it emits the phone block from the same call, so the two cannot drift');
  t.check((row.match(/class="om-lrow-ph"/g) || []).length === 1,
    'exactly once — there is no second template to drift from');
  /* Both layouts read `due`, the one balance the row computed, so the
     console and the phone can never disagree about what is owed. */
  t.check((row.match(/fmtUGX\(Math\.round\(due\)\)/g) || []).length === 2,
    'and both layouts print the same still-due figure, from the same variable');
  /* The state chip is the one component drawn twice, and it is a call
     rather than a copy for the same reason. */
  t.check((row.match(/invChipHTML\(q\)/g) || []).length === 2,
    'the state is the same component in both, called rather than copied');
  /* And the phone says what the console says with a column heading it
     cannot show: which bills were raised, and how old the money is. */
  t.check(/const pinvPhone =/.test(row) && /const agePhone =/.test(row),
    'the phone names the bills and the age, which it has no column headers to carry');
}

process.exit(t.done() ? 1 : 0);
