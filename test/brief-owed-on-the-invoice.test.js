#!/usr/bin/env node
'use strict';
/*
 * What they were CHARGED, and what they still OWE, are two facts.
 *
 * The brief prices a customer's list against lastPrice -- what their last
 * line was charged at. That figure is sound: sellPrice is a stored
 * snapshot of the negotiated price, frozen once the order is invoiced
 * (loadSavedQuote refuses to open one), so it is a faithful record of
 * what was asked for.
 *
 * What it is NOT is proof the money arrived. A payment settles an
 * INVOICE and never a line: q.payments carries an amount, a date and the
 * cash receipt it came in on, and no line at all. So "what they actually
 * paid for the ELEPHANT King" is not a fact this app holds, and
 * apportioning a part-payment across lines to manufacture one would be a
 * figure with nothing behind it.
 *
 * The honest answer is the account. Before you send names what the
 * customer still owes -- the WHOLE account, not just the invoices behind
 * today's list, because a debt is a fact about the person rather than
 * about the goods on this picture. Read through the same
 * customerOutstandingInvoices the debtors list and the payment picker
 * settle against, so the brief and the counter can never disagree about
 * what one person owes.
 *
 * Run: node test/brief-owed-on-the-invoice.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('brief — owed on the account');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const src = read('index.html');

/* ---- the reader, as the app really computes it ----------------------- */
const data = { savedQuotes: [], customers: [{ id: 'C1', name: 'Bright (PAM)' }] };
const R = ['orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderChargesTotal',
  'savedQuoteCashTotal', 'orderCreditTerms', 'orderCreditCharge',
  'savedQuoteTotal', 'invoiceBalanceDue', 'customerOutstandingInvoices'];
const reader = compileScope(R.map((n) => extractFunction(src, n, 'index.html')),
  { data, quoteItemSellPrice: (it) => Number(it.sellPrice) || 0 }, R);

// Four cartons of ELEPHANT King at 300,000 = 1,200,000 on the invoice.
const inv = (id, when, over) => Object.assign({
  id, customerId: 'C1', invoiced: true, voided: false, invoicedAt: when, amountPaid: 0, payments: [],
  items: [{ productId: 'P-RUN', variantIdx: 0, unit: 'Ctn', qty: 4, sellPrice: 300000 }],
}, over || {});

/* ---------- 1. the reader decides what counts as owed ----------------- */
{
  data.savedQuotes = [
    inv(41, '2026-08-21'),
    inv(42, '2026-09-04', { amountPaid: 900000 }),   // part-paid
    inv(43, '2026-09-05', { amountPaid: 1200000 }),  // settled
    inv(44, '2026-09-05', { voided: true }),         // voided
    inv(45, '2026-09-06', { invoiced: false }),      // still on the board
    inv(46, '2026-09-06', { customerId: 'C2' }),     // somebody else's
  ];
  const out = reader.customerOutstandingInvoices('C1');
  eq(out.map((q) => q.id).join(','), '41,42', 'only the unpaid, invoiced, unvoided invoices of THIS customer');
  eq(reader.invoiceBalanceDue(out[0]), 1200000, 'the whole of the untouched one is out');
  eq(reader.invoiceBalanceDue(out[1]), 300000, 'and a part-payment leaves only the remainder');
  eq(out[0].id, 41, 'oldest first, the way the debtors list and the payment picker order it');

  data.savedQuotes = [inv(47, '2026-09-04', { amountPaid: 1500000 })];
  eq(reader.customerOutstandingInvoices('C1').length, 0,
    'an overpayment is not a negative debt -- invoiceBalanceDue clamps at zero');
}

/* ---------- 2. the panel says it, through that same reader ------------ */
{
  const env = {
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    briefFrames: () => [{ items: [{ kind: 'row' }] }],
    briefWordCount: () => 27, briefRowCount: () => 1,
    briefAlsoWords: () => '', briefOwnEvidence: () => null, briefLeftOffLines: () => [],
    briefNoteBody: (title, items) => `<p>${title}</p>` + items.map((i) => `<p>${i}</p>`).join(''),
    productVariantLabel: (p) => p.name, BRIEF_MAX_LIST_FRAMES: 4,
    custTermsDays: () => 7,
    daysBetweenISO: (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000),
    todayISO: () => '2026-09-07',
    invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
    fmtShortDate: (iso) => String(iso),
    invoiceBalanceDue: reader.invoiceBalanceDue,
    customerOutstandingInvoices: reader.customerOutstandingInvoices,
  };
  const W = compileScope([
    extractDeclaration(src, 'BRIEF_OWED_NAMED_MAX', 'index.html'),
    extractFunction(src, 'briefWhyHTML', 'index.html'),
  ], env, ['briefWhyHTML']);
  const brief = { customer: { id: 'C1', name: 'Bright (PAM)' }, product: { name: 'X' }, pickVariant: 0,
    reason: null, also: [], groups: [{ rows: [] }], dropped: [], pricing: [], habits: [],
    sameAsTheirs: false, cheaperThanTheirs: false, lastPrice: 300000, price: 566000 };

  data.savedQuotes = [inv(41, '2026-08-21'), inv(42, '2026-09-04', { amountPaid: 900000 })];
  const two = W.briefWhyHTML(brief);
  t.check(/They still owe <b>1,500,000<\/b> on 2 invoices/.test(two),
    'the total is the whole account, over every outstanding invoice');
  t.check(/INV-0041<\/b> 1,200,000 \(2026-08-21, 17 days\)/.test(two),
    'each is named with its age');
  t.check(/INV-0042<\/b> 300,000 \(2026-09-04, 3 days\)/.test(two), 'and so is the newer one');
  t.check(two.indexOf('INV-0041') < two.indexOf('INV-0042'), 'oldest first');

  /* PAST THE TERMS, SAID ONCE. One of these two is past 7-day terms, so
     the count is stated rather than the phrase being hung on the
     invoice -- and never repeated per row. */
  t.check(/<b>1<\/b> past your terms\./.test(two), 'how many are past the terms is said once');
  eq((two.match(/past your terms/g) || []).length, 1,
    'and exactly once, however many invoices carry the fault');
  t.check(!/days &mdash; past your terms/.test(two),
    'the phrase no longer hangs off each invoice');

  /* THE WHOLE ACCOUNT, not the invoices behind this list. The brief
     carries no habits at all here and the debt is still named -- which
     is the case the narrow version could not see. */
  t.check(/They still owe/.test(two), 'a debt is named even when nothing on today\'s list points at it');

  // Named rather than dropped.
  data.savedQuotes = [41, 42, 43, 44, 45].map((id, i) => inv(id, `2026-08-0${i + 1}`));
  const many = W.briefWhyHTML(brief);
  // compileScope only hands back functions, so the cap is read from its
  // own declaration rather than through the scope.
  eq(extractDeclaration(src, 'BRIEF_OWED_NAMED_MAX', 'index.html'),
    'const BRIEF_OWED_NAMED_MAX = 3;', 'three are named before the rest are counted');
  t.check(/on 5 invoices/.test(many), 'the count covers the whole account');
  t.check(/They still owe <b>6,000,000<\/b>/.test(many), 'as does the total');
  t.check(/and <b>2<\/b> more\./.test(many), 'and the ones not named are counted, never dropped');
  t.check(/INV-0041/.test(many) && !/INV-0045/.test(many), 'the oldest are the ones said');
  /* All five are past terms, including the two never named -- which is
     why the clause counts rather than pointing at the named rows. */
  t.check(/All past your terms\./.test(many), 'when every one is late it is said in two words');
  eq((many.match(/past your terms/g) || []).length, 1, 'still exactly once');

  /* NONE late: nothing is said about terms at all. */
  data.savedQuotes = [inv(50, '2026-09-06')];
  const fresh = W.briefWhyHTML(brief);
  t.check(/They still owe <b>1,200,000<\/b> on one invoice/.test(fresh), 'a single invoice is "one invoice"');
  t.check(!/past your terms/.test(fresh), 'and one inside the terms says nothing about them');

  // A lone late one reads as a statement, not a count.
  data.savedQuotes = [inv(51, '2026-08-01')];
  t.check(/ Past your terms\./.test(W.briefWhyHTML(brief)), 'a single late invoice says so plainly');

  /* A DATELESS INVOICE cannot be judged late, and sorts to the front --
     so the clause counts rather than naming a position in the list. */
  data.savedQuotes = [inv(52, ''), inv(53, '2026-08-01')];
  const undated = W.briefWhyHTML(brief);
  t.check(/<b>1<\/b> past your terms\./.test(undated),
    'an invoice with no date is not counted late, and the one that is still is');
  t.check(!/oldest/.test(undated), 'nothing claims a position the ordering cannot support');

  // Nothing owed, nothing said.
  data.savedQuotes = [inv(41, '2026-08-21', { amountPaid: 1200000 })];
  t.check(!/still owe/.test(W.briefWhyHTML(brief)), 'a customer who owes nothing reads no line about debt');
  data.savedQuotes = [];
  t.check(!/still owe/.test(W.briefWhyHTML(brief)), 'nor one with no invoices at all');
}

/* ---------- 3. where it sits, and what it never touches --------------- */
{
  const why = extractFunction(src, 'briefWhyHTML', 'index.html');
  t.check(/customerOutstandingInvoices\(b\.customer\.id\)/.test(why),
    'read through the shared reader, so the brief and the counter cannot disagree');
  t.check(!/b\.habits[\s\S]{0,120}lastOwed/.test(why),
    'and no longer inferred from the habits, which only saw the invoices behind the list');
  t.check(/watch\.push\(`They still owe/.test(why),
    'it sits in the panel the owner weighs before sending');
  t.check(!/fix\.push\(`They still owe/.test(why),
    'and not under "where to fix it" -- there is nothing to correct, and chasing is its own screen');
  t.check(/a price list is not a demand/.test(why),
    'the sentence the owner reads says the picture stays a price list');
  t.check(/const lateCount = owed\.filter\(/.test(why) && !/&mdash; past your terms/.test(why),
    'past the terms is counted over the whole account, not hung on each named row');

  /* The customer never reads this: briefWhyHTML is the owner's panel and
     briefFrames builds the picture. */
  const frames = extractFunction(src, 'briefFrames', 'index.html');
  t.check(!/customerOutstandingInvoices|still owe/.test(frames),
    'nothing owed reaches the shared picture at all');

  /* The habit is back to what it was: a receipt, not a ledger. */
  const hab = extractFunction(src, 'customerProductHabits', 'index.html');
  t.check(!/lastOwed/.test(hab),
    'the habit carries no debt field -- the account is read where the account lives');
  t.check(/lastPrice: last\.l\.unitKnown \? last\.p : null/.test(hab),
    'and lastPrice still reads the charged figure, untouched by what is owed');
}

process.exit(t.done() ? 1 : 0);
