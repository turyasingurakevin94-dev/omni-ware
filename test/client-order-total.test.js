#!/usr/bin/env node
'use strict';
/*
 * What the customer is told an order came to, against what the shop will
 * invoice for it.
 *
 * These two were computed in different places and, for one commit, by
 * different arithmetic. index.html grew charges on a quote and a price
 * for the credit, so an order became
 *
 *     savedQuoteTotal = goods + charges + creditCharge
 *
 * and the invoice, the receipt and the debt log all followed it. The
 * portal went on summing the GOODS alone -- so a customer read a figure
 * smaller than the invoice they were sent, and smaller than their own
 * statement, which is built from that same debt log. A portal that
 * disagrees with itself is the one failure this whole boundary exists to
 * prevent, and no test caught it: both sides were green against their own
 * fixtures, which is exactly how two correct branches produce a wrong
 * answer when they meet.
 *
 * So this does not test the portal's arithmetic. It runs the portal's and
 * index.html's side by side over the same orders and compares them.
 *
 * Run: node test/client-order-total.test.js   (or: npm test)
 */
const { stripTypeScriptTypes } = require('module');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client order total');

/* Node strips the whole file once. The alternative is guessing at
   TypeScript syntax the shared helper was never meant to cover, and a
   guess that fails reads as a missing function rather than as a missing
   check. */
const fnSrc = stripTypeScriptTypes(
  read('supabase/functions/client-portal/index.ts')
    .replace(/^import[^\n]*\n/m, '').replace(/^export function /gm, 'function '),
  { mode: 'strip' });
const app = read('index.html');

const PORT = ['goodsTotal', 'unpricedLines', 'chargeAmount', 'chargeLines', 'creditLine', 'orderTotal'];
const portal = compileScope(PORT.map((n) => extractFunction(fnSrc, n, 'client-portal')), {}, PORT);

const ADMIN = ['savedQuoteGoodsTotal', 'orderCharges', 'chargeAmount', 'orderChargesTotal',
  'savedQuoteCashTotal', 'orderCreditTerms', 'orderCreditCharge', 'savedQuoteTotal',
  'creditTermLabel', 'orderChargeLines', 'orderBillLines', 'quoteItemSellPrice'];
const admin = compileScope(ADMIN.map((n) => extractFunction(app, n, 'index.html')),
  { data: { products: [] } }, ADMIN);

const L = (qty, sell) => ({ productId: 'P', productName: 'X', qty, unit: 'pc', sellPrice: sell, price: 1 });

/* ---------- 1. the same figure, order for order ----------------------- */
{
  const cases = [
    ['goods only', { items: [L(10, 5000)] }],
    ['one fixed charge', { items: [L(10, 5000)], charges: [{ label: 'Delivery', type: 'fixed', value: 30000 }] }],
    ['a percent charge', { items: [L(10, 5000)], charges: [{ label: 'Handling', type: 'percent', value: 5 }] }],
    ['two charges', { items: [L(10, 5000)], charges: [
      { label: 'Delivery', type: 'fixed', value: 30000 }, { label: 'Handling', type: 'percent', value: 5 }] }],
    ['credit only', { items: [L(10, 5000)], credit: { pct: 3, days: 30 } }],
    ['charges and credit', { items: [L(140, 48500)],
      charges: [{ label: 'Delivery', type: 'fixed', value: 120000 }], credit: { pct: 3, days: 30 } }],
    ['a zero-value charge', { items: [L(10, 5000)], charges: [{ label: 'Nothing', type: 'fixed', value: 0 }] }],
    ['credit at zero per cent', { items: [L(10, 5000)], credit: { pct: 0, days: 30 } }],
    ['credit with no days', { items: [L(10, 5000)], credit: { pct: 3 } }],
    ['no items at all', { items: [], charges: [{ label: 'Callout', type: 'fixed', value: 20000 }] }],
    ['rounding, an odd percent', { items: [L(7, 3333)],
      charges: [{ label: 'H', type: 'percent', value: 7 }], credit: { pct: 2.5, days: 45 } }],
    ['no charges key at all', { items: [L(3, 1000)] }],
    ['charges present but empty', { items: [L(3, 1000)], charges: [] }],
  ];
  cases.forEach(([label, payload]) => {
    const mine = portal.orderTotal(payload);
    const theirs = admin.savedQuoteTotal(Object.assign({}, payload));
    t.check(mine === theirs, `${label}: the customer's figure is the shop's (${mine} / ${theirs})`);
  });

  /* The test would be worth nothing if the charges never moved the
     figure: it would be comparing goods to goods. */
  const bare = { items: [L(10, 5000)] };
  const loaded = { items: [L(10, 5000)], charges: [{ label: 'Delivery', type: 'fixed', value: 30000 }], credit: { pct: 3, days: 30 } };
  t.check(portal.orderTotal(loaded) > portal.orderTotal(bare) + 30000,
    `and charges and credit really do move it (${portal.orderTotal(bare)} -> ${portal.orderTotal(loaded)})`);
}

/* ---------- 2. the lines, named ---------------------------------------- */
/*
 * A figure on an invoice a customer cannot account for is a figure they
 * ring about. The charges are the part of the bill they did NOT see when
 * they sent the order -- the shop adds them afterwards -- so they are
 * named rather than folded into a total.
 */
{
  const q = { items: [L(140, 48500)],
    charges: [{ label: 'Delivery', type: 'fixed', value: 120000 }, { label: 'Handling', type: 'percent', value: 5 }],
    credit: { pct: 3, days: 30 } };
  const mine = portal.chargeLines(q).concat(portal.creditLine(q) ? [portal.creditLine(q)] : []);
  const theirs = admin.orderBillLines(Object.assign({}, q));
  const shape = (ls) => JSON.stringify(ls.map((l) => [l.label, l.amount]));
  t.check(shape(mine) === shape(theirs),
    `every bill line matches the shop's, label and figure (${shape(mine)})`);
  t.check(mine.some((l) => /^Credit — 30 days$/.test(l.label)),
    'the credit line says how many days it was agreed for');
  t.check(portal.creditLine({ items: [L(1, 100)], credit: { pct: 3 } }).label === 'Credit',
    'and says just "Credit" where nobody named a term');

  /* A percent charge is a percent of the GOODS and the credit is a
     percent of the cash total -- never of themselves, and never of each
     other. Split out in both files for that reason. */
  const pctOnly = { items: [L(10, 5000)], charges: [{ label: 'H', type: 'percent', value: 10 }] };
  t.check(portal.chargeLines(pctOnly)[0].amount === 5000,
    `a percent charge is a percent of the goods (${portal.chargeLines(pctOnly)[0].amount})`);
  const both = { items: [L(10, 5000)], charges: [{ label: 'H', type: 'percent', value: 10 }], credit: { pct: 10, days: 30 } };
  t.check(portal.creditLine(both).amount === 5500,
    `and the credit is a percent of goods PLUS charges (${portal.creditLine(both).amount})`);
  t.check(portal.orderTotal(both) === 60500, `so the three stack once each (${portal.orderTotal(both)})`);

  t.check(portal.chargeLines({ items: [L(1, 100)], charges: [{ label: '  ', type: 'fixed', value: 500 }] })[0].label === 'Charge',
    'a charge nobody labelled still gets a word, not a blank');
  t.check(portal.chargeLines({ items: [L(1, 100)], charges: [{ label: 'X', type: 'fixed', value: 0 }] }).length === 0,
    'and one worth nothing is not a line at all');
}

/* ---------- 3. a line the shop never priced ---------------------------- */
/*
 * index.html's quoteItemSellPrice falls back to deriving a sell price
 * from the line's cost and the product's markup. Re-deriving anything
 * from cost is the code path that must not exist inside this boundary,
 * so such a line counts as nothing here -- and the order says so rather
 * than quietly totalling short.
 */
{
  t.check(portal.unpricedLines({ items: [L(5, null), L(2, 100), { qty: 3 }] }) === 2,
    `a line with no sellPrice is counted (${portal.unpricedLines({ items: [L(5, null), L(2, 100), { qty: 3 }] })})`);
  t.check(portal.unpricedLines({ items: [L(5, 0)] }) === 0,
    'a price of nought is a price somebody set, not a missing one');
  t.check(portal.unpricedLines({ items: [{ qty: 0 }] }) === 0,
    'and a line for no quantity is not an unpriced line');
  t.check(portal.unpricedLines({}) === 0 && portal.unpricedLines(null) === 0,
    'an order with no items counts none, rather than throwing');

  const page = read('client.html');
  t.check(/no price recorded against/.test(page),
    'the screen says when a total is short and why');
  t.check(/Your invoice is the figure that counts/.test(page),
    'and points at the document that is not');
}

/* ---------- 4. it reaches every place an order is shown ---------------- */
{
  const noComments = fnSrc.replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  const totals = (noComments.match(/total: orderTotal\(q\.payload\)|const total = orderTotal\(q\.payload\)/g) || []).length;
  t.check(totals === 3,
    `the recent five, the full list and one order all use it (${totals} of 3)`);
  t.check(!/lines\.reduce\(\(s, l\) => s \+ l\.lineTotal, 0\)/.test(noComments),
    'and none of them sums the goods lines instead');

  const page = read('client.html');
  t.check(/o\.charges \|\| \[\]\)\.map/.test(page) && /o\.credit\b/.test(page),
    'the order screen draws the charges and the credit');
  t.check(/Goods<\/div>/.test(page),
    'under a Goods line, so the total can be read as a sum');
}

process.exit(t.done() ? 1 : 0);
