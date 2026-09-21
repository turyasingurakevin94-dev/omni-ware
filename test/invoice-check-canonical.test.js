#!/usr/bin/env node
'use strict';
/*
 * ONE CANONICAL INVOICE CHECK.
 *
 * An order becomes an invoice at Step 5 and not before. toggleQuoteInvoiced
 * refuses to raise one on anything earlier, and raising it is the act that
 * takes the goods off the shelf, raises each supplier's bill and charges the
 * customer's account -- so "a real invoice" is BOTH halves, the stage and
 * the flag, and its opposite is the stage with the flag off.
 *
 * Both pairs were open-coded. The strict one stood in four places -- the
 * Invoices register, Analytics, and the two ghosts on an order row -- and
 * the opposite in six: what the row says it needs, its one act, the invoice
 * check itself, what is ready to invoice, the bulk dialog, and the day's
 * closing. Ten copies of two rules is ten chances for one of them to drift
 * a clause, and the drift would be silent: each of those screens shows
 * money, and none of them would disagree loudly.
 *
 * So the pair is named once, and these tests hold three things about it:
 * what the two helpers answer, that nothing spells the pair out by hand any
 * more, and that the helpers do NOT swallow voiding -- the Invoices
 * register keeps voided invoices behind its own checkbox and Analytics
 * drops them, and a helper answering that too would take the choice away
 * from the screen that has to make it.
 *
 * Run: node test/invoice-check-canonical.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('the canonical invoice check');
const src = read('index.html');

const fns = compileScope([
  extractFunction(src, 'isInvoice', 'index.html'),
  extractFunction(src, 'awaitsInvoice', 'index.html'),
], {}, ['isInvoice', 'awaitsInvoice']);
const { isInvoice, awaitsInvoice } = fns;

/* ---------- 1. what the two helpers answer --------------------------- */
{
  t.check(isInvoice({ status: 'completed', invoiced: true }) === true,
    'an order at Step 5 carrying the flag is an invoice');
  t.check(isInvoice({ status: 'completed', invoiced: false }) === false,
    'Step 5 with no flag is not one yet');
  t.check(isInvoice({ status: 'pending_delivery', invoiced: true }) === false,
    'and the flag on an order stepped back off Step 5 is not one either — the pair is the point');
  t.check(isInvoice(null) === false && isInvoice(undefined) === false,
    'a missing order answers false rather than throwing, because the derivations that ask walk arrays that can hold one');

  t.check(awaitsInvoice({ status: 'completed', invoiced: false }) === true,
    'an order at Step 5 with no invoice is waiting on one');
  t.check(awaitsInvoice({ status: 'completed', invoiced: true }) === false,
    'once it has one it is not');
  /* The reason this is a second helper rather than !isInvoice(q). */
  t.check(awaitsInvoice({ status: 'draft', invoiced: false }) === false
    && isInvoice({ status: 'draft', invoiced: false }) === false,
    'a draft is not an invoice AND is not waiting to be one — so awaitsInvoice is not the negation of isInvoice');
  t.check(awaitsInvoice(null) === false,
    'and a missing order is not waiting on anything');
}

/* ---------- 2. neither helper answers for voiding -------------------- */
{
  t.check(isInvoice({ status: 'completed', invoiced: true, voided: true }) === true,
    'a voided invoice is still an invoice to isInvoice: the Invoices register lists it behind Hide voided');
  const body = extractFunction(src, 'isInvoice', 'index.html')
    + extractFunction(src, 'awaitsInvoice', 'index.html');
  t.check(!/voided/.test(body),
    'so neither helper reads q.voided — every caller says it for itself, where the reader of that screen can see it');
  const ranged = extractFunction(src, 'invRangedInvoices', 'index.html');
  t.check(/hideVoided/.test(ranged) && /!q\.voided/.test(ranged),
    'the Invoices register still makes that choice itself, by its own checkbox');
  const an = extractFunction(src, 'anInvoicesInRange', 'index.html');
  t.check(/if\(q\.voided\) return false;/.test(an),
    'and Analytics still drops a voided sale outright, which is the opposite choice and also right');
}

/* ---------- 3. nothing spells the pair out by hand any more ---------- */
{
  /* Comments are stripped first: the helpers' own comment quotes the rule
     it replaced, and a law that its own explanation breaks is no law. */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/).map((l)=> l.replace(/(?<!:)\/\/.*$/, '')).join('\n')
    /* The two helpers are where the rule is allowed to be written out;
       everywhere else is a copy. Excised by their own extracted source, so
       this cannot quietly start exempting anything wider. */
    .replace(extractFunction(src, 'isInvoice', 'index.html'), ' ')
    .replace(extractFunction(src, 'awaitsInvoice', 'index.html'), ' ');
  /* Every spelling the file has ever used, spaces optional around === and
     &&, so a re-spaced copy cannot slip back in. */
  const open = /status\s*===\s*'completed'\s*&&\s*!?\s*q\.invoiced/g;
  const hits = code.match(open) || [];
  t.check(hits.length === 0,
    `no screen open-codes the stage-and-flag pair any more (found ${hits.length})`);
  /* The other way round, which orderInvoiceCheckHTML used to read. */
  const inverted = code.match(/status\s*!==\s*'completed'\s*\|\|\s*q\.invoiced/g) || [];
  t.check(inverted.length === 0,
    'nor its inverted spelling');
  t.check(/function isInvoice\(q\)\{/.test(src) && /function awaitsInvoice\(q\)\{/.test(src),
    'because there is one of each to call instead');
}

/* ---------- 4. the ten sites that used to spell it out --------------- */
{
  const at = (name)=> extractFunction(src, name, 'index.html');
  const strict = [
    ['orderRowBodyHTML', /isInvoice\(q\) \? ghost\('invoice', 'Undo invoice'\)/, "the row's Undo invoice ghost"],
    ['orderRowBodyHTML', /!q\.voided && !isInvoice\(q\)/, "and its Cancel order ghost, which an invoice must not offer"],
    ['invRangedInvoices', /filter\(q=> isInvoice\(q\)\)/, 'the Invoices register'],
    ['anInvoicesInRange', /if\(!isInvoice\(q\)\) return false;/, 'Analytics'],
  ];
  for (const [fn, re, what] of strict) t.check(re.test(at(fn)), `${what} asks isInvoice`);

  const waiting = [
    ['orderNeedsYou', /else if\(awaitsInvoice\(q\)\)\{/, 'what the row says it needs'],
    ['orderActSpec', /if\(awaitsInvoice\(q\)\) return \{ act:'invoice'/, 'its one act'],
    ['orderInvoiceCheckHTML', /if\(!awaitsInvoice\(q\)\) return '';/, 'the invoice check itself'],
    ['ordersReadyToInvoice', /filter\(q=> awaitsInvoice\(q\) && !q\.voided/, 'what is ready to invoice'],
    ['otInvoiceSpec', /filter\(q=> awaitsInvoice\(q\) && !q\.voided/, 'the bulk dialog, for the short picks it leaves out'],
    ['dayClosing', /&& awaitsInvoice\(q\)\n/, "the day's closing, for the sale the books were never told about"],
  ];
  for (const [fn, re, what] of waiting) t.check(re.test(at(fn)), `${what} asks awaitsInvoice`);
}

/* ---------- 5. the flag alone is a THIRD question, left alone -------- */
{
  /* Forty-odd derivations ask only q.invoiced, and they are not this
     refactor's to convert: the edit guard, the stock reversal and the
     document label all mean "does this order carry an invoice", whatever
     stage it is at, and an invoiced order stepped back off Step 5 must
     still be uneditable and must still put its goods back. Converting
     them would be a behaviour change on money screens, not a rename —
     this test records that the line was drawn deliberately. */
  const edit = /\$\{q\.invoiced\?'disabled':''\}/;
  t.check(edit.test(src),
    'the edit button still keys on the flag alone, so an invoiced order stepped back off Step 5 stays uneditable');
  const del = extractFunction(src, 'deleteSavedQuote', 'index.html');
  t.check(/if\(q\.invoiced\) reverseQuoteStockDeduction\(q\);/.test(del),
    'and deleting one still puts its goods back on the flag alone — the stock moved, whatever the stage now says');
}

process.exit(t.done() ? 1 : 0);
