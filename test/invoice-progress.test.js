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
const NAMES = ['invoicePaymentProgress', 'orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderChargesTotal',
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
const cell = (/const progressCell = \(q\)=>\{[\s\S]*?\n  \};/.exec(render) || [''])[0];

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
  t.check(/style="width:\$\{Math\.round\(p\.pct\*100\)\}%"/.test(cell),
    'the bar is drawn from the clamped figure');
  t.check(/const pct = p\.total > 0 \? Math\.round\(p\.paid\/p\.total\*100\) : 0;/.test(cell),
    'and the number beside it from the true one, so 150% reads 150%');
  t.check(/inv-prog-over/.test(cell) && /\.deb-prog\.inv-prog-over \.deb-prog-fill\{background:var\(--danger\)\}?/.test(src.replace(/;\s*\}/g, '}')),
    'marked in the colour that says something is wrong, since the clamped bar looks settled');
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
  t.check(/totals nothing — its items carry no price/.test(cell)
    && /Price the items to see progress/.test(cell),
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
  t.check(/still recorded against it and still in the Cash Book/.test(cell),
    'a voided invoice holding money names it as unfinished business');
  t.check(/Unvoid it, or remove the payment/.test(cell), 'with both ways out');
  t.check(/nothing to be part way through paying/.test(cell),
    'while an empty voided one is simply not measurable');
}

/* ---------- 5. it is the same bar, in both layouts ------------------- */
{
  /* Reusing .deb-prog rather than building a lookalike: this is the same
     question the debtors and creditors lists ask, and a second bar that
     looked slightly different would read as a different measure. */
  t.check(/<div class="deb-prog\$\{p\.over > 0 \? ' inv-prog-over' : ''\}"/.test(cell),
    'the invoice bar is the component the debtors and creditors lists already use');
  /* Nothing to measure is a dash, not an empty bar: an empty bar reads as
     "has paid nothing", which is a claim about somebody's conduct. */
  t.check(/return `<span class="deb-prog-none" title="\$\{esc\(why\)\}">—<\/span>`;/.test(cell),
    'and an unmeasurable one is a dash rather than an empty bar');

  /* THESE TWO USED TO NAME TWO PLACES: a <td class="inv-status-cell">
     and a <div class="deb-card-prog"> in the phone card beside it. What
     they were protecting was that the bar reached BOTH layouts -- a
     measure that existed only on the console would be missing from the
     screen the shop actually reads. That was a real hazard while the
     renderer hand-wrote two templates that could drift, and they had
     already drifted: the card carried a rank the table numbered
     differently.

     The screen is one .ow-tbl now, and the layer turns each row into a
     card below 820px from the SAME call. So "it reaches both layouts"
     is no longer something this renderer can get wrong -- there is one
     status cell, and the phone shows it because the phone shows the
     row. The assertion moves to what can still go wrong: that the bar
     is emitted once, from the status cell, and that the cell is
     labelled so the card it becomes says what the figure is. */
  t.check(/<div class="ow-tbl-c inv-c-st" data-l="Status">[\s\S]{0,120}?progressCell\(q\)/.test(render),
    'the bar lives in the status cell of the one row template, labelled so the phone card names it');
  t.check((render.match(/progressCell\(q\)/g) || []).length === 1,
    'and is emitted exactly once — there is no second template to drift from');
  /* And the three reasons it can give were hover-only titles, which is
     to say invisible on the phone. They are rows of the register now,
     in the same words. */
  t.check(/const noteRow = \(q\)=>\{/.test(render), 'a document that disagrees with itself gets a row of its own');
  ['still recorded against it and still sitting in the Cash Book',
   'more than it asks for',
   'its items carry no price'].forEach((phrase) => {
    t.check(render.includes(phrase), `and it says so in words: "${phrase}"`);
  });
  /* Every reachable branch of the cell is a `title`, so the reason is
     always available -- including on the two that render a bare dash. */
  eq((cell.match(/title="/g) || []).length, 2,
    'with both the bar and the dash explaining themselves on hover');
}

process.exit(t.done() ? 1 : 0);
