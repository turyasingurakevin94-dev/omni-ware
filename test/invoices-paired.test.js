#!/usr/bin/env node
'use strict';
/*
 * THE PAIRED LENS — a sale, beside the bills that sale raised.
 *
 * This screen had already drawn side by side once and rejected it, and
 * the rejection is written into index.html: two registers at 578px each
 * cost the sales side four of its eight columns including the select-all
 * the bulk void depends on, and the buying side its rail and its whole
 * checks band. "Movements was pulled OUT of Inventory for being a whole
 * second console stacked under the first."
 *
 * What is built here is not that. The register is untouched and one
 * press away; the pane beside the list is the .ow-side rail this app
 * already gives to the ONE ITEM being worked. The tests below hold that
 * line — if the paired lens ever starts eating the register, or the rail
 * ever grows into a second register, they fail.
 *
 * They also hold the figure the lens exists for. `kept` is a
 * subtraction, and a subtraction with nothing to subtract must not
 * quietly print the whole invoice as profit: a shop's restocks carry
 * quoteId: null and its own sales are often filled from stock, so the
 * null case is the common one, not the edge.
 *
 * Run: node test/invoices-paired.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter, winningDeclaration } = require('./_extract');

const t = createReporter('invoices, paired');
const src = read('index.html');
const css = src.slice(src.indexOf('<style>'), src.indexOf('\n</style>\n')).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s*\n\s*/g, '');
const sec = (/<section id="tab-invoices"[\s\S]*?<\/section>/.exec(src) || [''])[0];
const side = extractFunction(src, 'invApplySide', 'index.html');
const route = extractFunction(src, 'invRenderSide', 'index.html');
const paired = extractFunction(src, 'renderInvoicesPaired', 'index.html');
const rail = extractFunction(src, 'invPairRailHTML', 'index.html');
const ranged = extractFunction(src, 'invRangedInvoices', 'index.html');
const register = extractFunction(src, 'renderInvoices', 'index.html');

/* ---------- 1. a third lens, not a third screen ---------------------- */
{
  t.check(/data-side="paired"/.test(sec) && /data-side="sales"/.test(sec) && /data-side="buys"/.test(sec),
    'the segment offers three lenses over the one filter bar');
  t.check(/id="inv_paired_pane"/.test(sec) && /id="inv_register_pan"/.test(sec),
    'and the paired region and the register are separate panes that can be swapped');
  /* The whole argument of the build. The register is not narrowed, not
     re-columned and not stripped: it is hidden, entire, and returns
     entire. If this ever becomes a shared pane the rejection this file
     records has quietly been overturned without being argued. */
  t.check(/pairedPane\.hidden = !paired/.test(side) && /register\.hidden = paired/.test(side),
    'the paired lens hides the register rather than rebuilding it — it comes back whole');
  t.check(/salesPane\.hidden = !sales/.test(side),
    'and Paired is still one of the sales pane’s shapes, so the bar and the strip above are shared');
  /* Two buttons could be lit by "not the other one". Three cannot. */
  t.check(/const on = b\.dataset\.side === invSide;/.test(side),
    'the lit button is the one whose name matches the lens, not the one that is not the other');
  t.check(/let invSide = 'paired';/.test(src),
    'and the screen opens on it');
}

/* ---------- 2. one bar, one range, one order ------------------------- */
{
  t.check(/invSide === 'paired'/.test(route) && /renderInvoicesPaired/.test(route),
    'a keystroke in the shared search box draws whichever lens is open');
  t.check(/invRangedInvoices\(filter\)/.test(register) && /invRangedInvoices\(filter\)/.test(paired),
    'both lenses ask ONE function which invoices the filters matched');
  t.check(/inv_doc_hide_voided/.test(ranged) && /invDocGetDateRange\(\)/.test(ranged) && /searchTokens\(filter\)/.test(ranged),
    'and that function is the one place the date range, the search and Hide voided are read');
  t.check(/INV_LENS_STATE\.key/.test(ranged),
    'the ordering argument is made there too, so Open first means the same on both');
  /* A second copy of the wiring is how one lens comes to void a
     document the other only prints. */
  t.check(/invBindDocActions\(wrap\)/.test(register) && /invBindDocActions\(wrap\)/.test(paired),
    'and both bind the row’s acts through the same binder');
  t.check(/invoices: \(\)=> invRenderSide\(\)/.test(src),
    '"Show more" redraws the lens that is open, not the register behind it');
}

/* ---------- 3. the rail is a rail, not a second register ------------- */
{
  t.check(/class="ow-side"/.test(sec), 'the pane beside the list is the layer’s own side rail');
  t.check(!/ow-tb|inv-bulk-dd|inv_doc_select_all_th/.test((/<div class="ow-grid inv-pair"[\s\S]*?\n      <div class="ow-pan inv-pan" id="inv_register_pan">/.exec(src) || [''])[0]),
    'and it carries no toolbar, no select-all and no bulk operations of its own');
  /* 380px, not the layer's 304: this rail carries money and an action
     rather than words. The point of the check is that it is a RAIL
     width at all -- a second register would need three times it. */
  t.check(/\.ow-grid\.inv-pair\{grid-template-columns:minmax\(0,1fr\) 380px;\}/.test(css),
    'the rail is a fixed rail beside a fluid list, at a rail\u2019s width');
}

/* ---------- 4. what a job kept, and when it refuses to say ----------- */
const NAMES = ['quoteItemSellPrice', 'orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal',
  'orderCreditTerms', 'orderCreditCharge', 'savedQuoteCashTotal', 'orderChargesTotal',
  'savedQuoteTotal', 'purchaseInvoicesForOrder', 'purchaseInvoiceTotal',
  'purchaseInvoiceBalanceDue', 'invJobFigures'];
const data = { products: [], purchaseInvoices: [], savedQuotes: [] };
let scope = null; let err = null;
try {
  scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), { data }, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the job arithmetic compiles${err ? ` (${err.message})` : ''}`);

if (scope) {
  const sale = (id, total) => ({ id, client: { name: 'X' }, items: [{ qty: 1, sellPrice: total }], amountPaid: 0 });
  const bill = (id, quoteId, total, paid, voided) => ({
    id, quoteId, items: [{ qty: 1, price: total }], amountPaid: paid || 0, voided: !!voided,
  });
  const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

  data.purchaseInvoices = [bill(1, 175, 220000, 220000), bill(2, 175, 95000, 0)];
  const j = scope.invJobFigures(sale(175, 465000));
  eq(j.sold, 465000, 'what the sale was invoiced for');
  eq(j.bought, 315000, 'what its bills came to');
  eq(j.kept, 150000, 'and what it kept is the subtraction');
  eq(j.pct, 32, 'as a share of the sale');
  eq(j.owed, 95000, 'with only the unpaid part of the bills still owed');

  /* THE CASE THAT MATTERS MOST, because it is the common one.
     generatePurchaseInvoiceForRestock() sets quoteId: null and plenty of
     orders are filled from stock the shop already had, so a lens that
     answered "kept" with the whole invoice would be inventing the one
     figure the shop most wants to believe. */
  data.purchaseInvoices = [];
  const none = scope.invJobFigures(sale(291, 425000));
  eq(none.kept, null, 'a sale with no bill behind it cannot say what it kept');
  eq(none.pct, null, 'and offers no percentage either');
  eq(none.bought, 0, 'nothing was bought against it on any document here');
  t.check(/no supplier bill/.test(rail) && /stock lots/.test(rail),
    'and the rail says so in words, naming where that cost actually sits');

  /* A VOIDED BILL IS NOT A COST. It is a cancelled document. */
  data.purchaseInvoices = [bill(3, 287, 395000, 395000), bill(4, 287, 380000, 60000, true)];
  const v = scope.invJobFigures(sale(287, 615000));
  eq(v.bought, 395000, 'a voided bill is none of what the job cost');
  eq(v.kept, 220000, 'so it cannot make a profitable job look like a loss');
  eq(v.bills.length, 2, 'and it is still listed, because a cancelled document is kept, never deleted');
  eq(v.live.length, 1, 'while only the live one is counted');

  /* Only voided bills behind a sale is the same refusal as none at all:
     there is nothing real to subtract. */
  data.purchaseInvoices = [bill(5, 300, 100000, 0, true)];
  eq(scope.invJobFigures(sale(300, 500000)).kept, null,
    'a sale whose only bill was voided still cannot say what it kept');
}

/* ---------- 5. the restocks are named, never dropped ----------------- */
{
  /* The option this screen refused -- one row per transaction -- was
     refused because a shop's restocks belong to no sale at all and would
     be orphaned by it. They are money out either way. */
  t.check(/no sale behind it/.test(rail),
    'a bill with no sale behind it is named as exactly that');
  t.check(/The rest of this range/.test(rail),
    'and lives under a band of its own rather than being filtered away');
  t.check(/on \$\{unpaid\.length\} unpaid purchase/.test(paired),
    'the strip counts every unpaid bill in the range, not only this job’s');
}

/* ---------- 6. the money never gives way ----------------------------- */
{
  /* A clipped figure is not a shortened figure, it is a WRONG one. In
     a 380px rail something has to give, and it is the words. */
  const bought = (/\.inv-pb-bought\{([^}]*)\}/.exec(css) || ['', ''])[1];
  t.check(/text-overflow:ellipsis/.test(bought) && /overflow:hidden/.test(bought)
    && /white-space:nowrap/.test(bought) && /min-width:0/.test(bought),
    'what a bill was for truncates properly when the rail is tight — all three declarations, and it can shrink');
  t.check(/\.ow-tbl\.inv-pb-tbl\{--ow-tbl-cols:minmax\(0,1fr\) 96px auto;\}/.test(css),
    'while the owed column is sized to its content and never gives way');
  /* .ow-link is `all:unset`, declared later in the file, so a
     single-class rule here loses the face, the tabular figures and the
     nowrap -- which is how INV-0175 came to break across two lines. */
  t.check(/\.inv-pr-tbl \.inv-pr-doc\{/.test(src) && /\.inv-pb-tbl \.inv-pb-doc\{/.test(src),
    'and a document number beats .ow-link’s all:unset on specificity, so it never wraps');
}

/* ---------- 7. the phone is its own design --------------------------- */
{
  /* Two 380px columns at 390 is not a layout. The pairing inverts: the
     bills fold into the card of the sale that raised them. */
  const phone = (/@media \(max-width:820px\)\{([\s\S]*?)\n  \}\n/.exec(src.slice(src.indexOf('.ow-pan.inv-pan{overflow:clip;}'))) || ['', ''])[1];
  t.check(/\.inv-pr-bills\{display:none;\}/.test(src.replace(/\s+/g, '')) || /inv-pr-bills\{display:none/.test(src),
    'the folded bills are hidden on the console, where the rail already shows them');
  t.check(/class="inv-pr-bills"/.test(paired),
    'and they are emitted from the SAME call as the row, so the two designs cannot say different things');
  t.check(/ow-grid\.inv-pair\{grid-template-columns:minmax\(0,1fr\);\}/.test(src.replace(/\s+/g, '')),
    'the two columns become one below 820px');
  t.check(/\.inv-pj-h,\.ow-strip\.inv-pj-sum,\.inv-pb-mine\{display:none;\}/.test(src.replace(/\s+/g, '')),
    'and the job block goes with them — there is no selection on a phone for it to be about');
}

/* ---------- 8. a region built on .ow-grid can actually hide ---------- */
{
  /* Found by the class-hooks test, and it was real: display:grid beats
     the hidden attribute outright, so the paired pane sat on screen
     behind the register that had replaced it. */
  const d = winningDeclaration(src, 'inv_paired_pane', 'display');
  t.check(d && d.value === 'none' && /\[hidden\]/.test(d.sel),
    `the hidden attribute actually hides the paired pane (${d ? d.sel + ' → ' + d.value : 'no rule'})`);
}

process.exit(t.done() ? 1 : 0);
