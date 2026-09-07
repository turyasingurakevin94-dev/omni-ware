#!/usr/bin/env node
'use strict';
/*
 * What they were CHARGED, and what they actually PAID, are two facts.
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
 * The honest answer is the balance on the document the line sits on.
 * This file pins that: carried beside the price rather than folded into
 * it, and said once per invoice in the panel the owner reads before the
 * thumb presses send. The picture stays a price list.
 *
 * Run: node test/brief-owed-on-the-invoice.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('brief — owed on the invoice');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const src = read('index.html');

const RUN = { id: 'P-RUN', name: 'ELEPHANT King', type: 'variable',
  variants: [{ combo: { Type: 'Short / Single Lock' } }] };
const CEM = { id: 'P-CEM', name: 'Cement', type: 'simple', unit: 'Bag' };
const data = {
  products: [RUN, CEM],
  prices: [
    { productId: 'P-RUN', variantIdx: 0, supplierId: 'S1', unit: 'Dozen', packUnit: 'Ctn', packQty: 20, wholesale: 14500, retail: 15000 },
    { productId: 'P-CEM', variantIdx: null, supplierId: 'S1', unit: 'Bag', wholesale: 30000, retail: 32000 },
  ],
  savedQuotes: [],
};
const env = {
  data,
  cmpUnitKey: (s) => String(s || '').trim().toLowerCase(),
  productPriceRows: (pid, vi = null) => data.prices.filter((p) => p.productId === pid
    && (p.variantIdx == null ? null : p.variantIdx) === vi),
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  customerOrdersFor: () => data.savedQuotes,
  todayISO: () => '2026-09-07',
  daysBetweenISO: (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000),
  pairLastsDays: () => 0,
  /* The real reader, compiled in below, so the test cannot drift from
     how the app decides what is still due. */
};
const NAMES = ['stockUnitFor', 'stockMoveOnRowUnit', 'habitLineOnRowUnit', 'customerProductHabits',
  'savedQuoteTotal', 'invoiceBalanceDue'];
const fns = compileScope([
  extractDeclaration(src, 'TELL_MIN_ORDERS', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], env, NAMES);

// Four cartons of ELEPHANT King, invoiced, at 300,000 a carton = 1,200,000.
const order = (id, when, over) => Object.assign({
  id, invoiced: true, voided: false, invoicedAt: when, amountPaid: 0, payments: [],
  items: [{ productId: 'P-RUN', variantIdx: 0, unit: 'Ctn', qty: 4, sellPrice: 300000 }],
}, over || {});

/* ---------- 1. the charge and the balance are separate figures -------- */
{
  data.savedQuotes = [order(41, '2026-08-28'), order(42, '2026-09-04')];
  const h = fns.customerProductHabits('C-BRIGHT')[0];
  eq(h.lastPrice, 15000, 'the receipt figure is what the line was charged, per Dozen');
  eq(h.lastOwed, 1200000, 'and the whole of the last invoice is still out');
  eq(h.lastOrder.id, 42, 'read off the document that receipt came from');

  // Part-paid: the charge does not move, the balance does.
  data.savedQuotes[1].amountPaid = 900000;
  const part = fns.customerProductHabits('C-BRIGHT')[0];
  eq(part.lastPrice, 15000, 'a part-payment does not change what the line was charged');
  eq(part.lastOwed, 300000, 'only what is still owed on the document');

  // Settled, and over-settled.
  data.savedQuotes[1].amountPaid = 1200000;
  eq(fns.customerProductHabits('C-BRIGHT')[0].lastOwed, 0, 'a settled invoice owes nothing');
  data.savedQuotes[1].amountPaid = 1500000;
  eq(fns.customerProductHabits('C-BRIGHT')[0].lastOwed, 0,
    'and an overpayment is not a negative debt -- invoiceBalanceDue clamps at zero');
}

/* ---------- 2. what is not a debt ------------------------------------- */
{
  data.savedQuotes = [order(43, '2026-09-04', { voided: true })];
  eq(fns.customerProductHabits('C-B')[0].lastOwed, 0, 'a voided invoice is not money owed');

  /* An order still on the board has been charged nothing yet.
     customerOrdersFor is filtered to invoiced orders upstream, so this
     is belt and braces -- and it is the guard that keeps a quote from
     being reported as a debt if that ever changes. */
  data.savedQuotes = [order(44, '2026-09-04', { invoiced: false })];
  eq(fns.customerProductHabits('C-B').length, 0, 'an uninvoiced order makes no habit at all');
}

/* ---------- 3. it is carried, never folded into the price ------------- */
{
  const fn = extractFunction(src, 'customerProductHabits', 'index.html');
  t.check(/lastPrice: last\.l\.unitKnown \? last\.p : null/.test(fn),
    'lastPrice still reads the charged figure, untouched by what is owed');
  t.check(!/lastPrice:.*lastOwed|lastOwed.*\?\s*last\.p/.test(fn),
    'the balance never adjusts the price -- the two say different things and the picture is priced off the first');
  t.check(/if\(!o \|\| !o\.invoiced \|\| o\.voided\) return 0;/.test(fn),
    'and a document that was never charged, or was voided, owes nothing');
}

/* ---------- 4. said once per document, before you send ---------------- */
{
  const why = extractFunction(src, 'briefWhyHTML', 'index.html');
  t.check(/if\(owed\.some\(o=> o\.q\.id === h\.lastOrder\.id\)\) return;/.test(why),
    'one unpaid invoice carrying three of their regulars is named once, not three times');
  t.check(/owed\.sort\(/.test(why) && /invoicedAt \|\| a\.q\.date/.test(why),
    'oldest first, the way every other screen orders money that is out');
  t.check(/watch\.push\(`They still owe/.test(why),
    'it sits in the panel the owner weighs before sending');
  t.check(!/fix\.push\(`They still owe/.test(why),
    'and not under "where to fix it" -- there is nothing to correct, and chasing is its own screen');
  t.check(/because that is the level the\s+books settle at/.test(why),
    'why it is the document and not the item is explained in the code, not on the screen every send');
  t.check(/a price list is not a demand/.test(why),
    'and the sentence the owner reads says the picture stays a price list');
  t.check(/const late = age != null && age > terms;/.test(why) && /custTermsDays\(\)/.test(why),
    'late is measured against the shop\'s OWN terms, not a number this screen invented');

  /* The customer never reads this. briefWhyHTML is the owner's panel --
     the frames are built by briefFrames, which this must not touch. */
  t.check(!/briefFrames\(b\)[\s\S]{0,200}They still owe/.test(why),
    'the picture is untouched: a price list is not a demand');
  const frames = extractFunction(src, 'briefFrames', 'index.html');
  t.check(!/lastOwed/.test(frames), 'and nothing owed reaches the shared picture at all');
}

process.exit(t.done() ? 1 : 0);
