#!/usr/bin/env node
'use strict';
/*
 * What the shop leans on.
 *
 * Concentration is the risk that appears on no statement. A shop can be
 * trading well and be one phone call from trouble, because most of what
 * it sells goes through one name or most of what it buys comes from one.
 * Nothing on the statements said so.
 *
 * THE TRAP THIS FILE EXISTS FOR IS THE COUNTER SALE. Every walk-in is
 * written under a single label, so grouping sales by customer name
 * reports the most diversified shop there is -- one whose trade is
 * spread across a hundred strangers who never gave a name -- as almost
 * wholly dependent on one "customer". Getting this wrong does not
 * produce a slightly-off number; it produces the opposite conclusion.
 *
 * THE SECOND TRAP IS THE DENOMINATOR. A customer who is most of the
 * INVOICED trade in a shop that takes as much again over the counter is
 * a much smaller part of the business than that, and measuring their
 * share against the named part alone would overstate what losing them
 * costs.
 *
 * Run: node test/concentration-risk.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('concentration risk');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { savedQuotes: [], suppliers: [], purchaseInvoices: [], products: [], prices: [] };
const NAMES = ['revenueConcentration', 'purchaseConcentration', 'concentrationExposure'];
const scope = compileScope([
  extractFunction(src, 'purchaseInvoiceTotal', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || id,
  anInvoicesInRange: (from, to) => data.savedQuotes.filter((q) =>
    !q.voided && q.invoicedAt >= from && q.invoicedAt <= to),
  anInvoiceTotals: (q) => ({ sales: q.sales }),
}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const pct = (n) => Math.round(n * 100);
const sale = (id, name, sales, counter) =>
  ({ id, invoicedAt: '2026-08-02', voided: false, client: { name }, counterSale: !!counter, sales });
const rev = () => scope.revenueConcentration('2026-08-01', '2026-08-31');

/* ---------- 1. counter sales are not a customer --------------------- */
{
  data.savedQuotes = [];
  for (let i = 1; i <= 8; i++) data.savedQuotes.push(sale(i, 'Counter sale', 900000, true));
  /* The smaller named customer is added FIRST on purpose: with the
     largest inserted first, dropping the sort leaves named[0] unchanged
     and a missing ranking is invisible. */
  data.savedQuotes.push(sale(21, 'Ssemwanga Builders', 1200000, false));
  data.savedQuotes.push(sale(20, 'Bugolobi Estates', 4000000, false));

  const r = rev();
  eq(r.total, 12400000, 'everything sold is counted');
  eq(r.counter, 7200000, 'with the counter trade held apart');
  eq(r.customers, 2, 'so only the two named customers are customers');
  eq(r.top.name, 'Bugolobi Estates', 'and the largest is a real name');

  /* The whole point. Eight walk-ins under one label outweigh every named
     customer, so a version that grouped by name alone would call this
     shop 58% dependent on a single buyer -- the exact opposite of what
     eight separate strangers means. */
  t.check(r.counter > r.top.amount,
    'the counter label would have been the biggest of all, which is why it must not be treated as one');
  t.check(r.top.name !== 'Counter sale', 'and it is not reported as the largest customer');

  /* Measured against EVERYTHING SOLD. Bugolobi is 77% of the named
     trade and 32% of the business; reporting the first would nearly
     treble the exposure. */
  eq(pct(r.topShare), 32, 'the largest customer is measured against all of the trade');
  t.check(Math.round(r.top.amount / r.namedTotal * 100) === 77,
    'and not against the named part alone, which would have said 77%');
  eq(pct(r.counterShare), 58, 'the counter share is reported so the spread can be seen');
}

/* ---------- 2. a shop that only trades over the counter ------------- */
{
  data.savedQuotes = [sale(1, 'Counter sale', 500000, true), sale(2, 'Counter sale', 300000, true)];
  const r = rev();
  t.check(r.top === null, 'a shop with no named customers has no largest one');
  eq(r.topShare, 0, 'and no share to report rather than a share of nothing');
  eq(r.customers, 0, 'with no customers counted');
  eq(r.counter, 800000, 'though the trade itself is still counted');
}

/* ---------- 3. one customer, and the empty case --------------------- */
{
  data.savedQuotes = [sale(1, 'Only Buyer', 1000000, false)];
  eq(pct(rev().topShare), 100, 'a single customer is the whole of the trade');

  data.savedQuotes = [];
  const r = rev();
  eq(r.total, 0, 'a period with nothing invoiced has nothing in it');
  t.check(r.top === null, 'and no largest customer');
  eq(r.topShare, 0, 'and no share, rather than a division by nothing');
  /* Every share goes through the same guard. counterShare is the one
     that actually reaches it here -- topShare short-circuits on the
     missing customer -- so without this the divide-by-nothing was
     never exercised and NaN would have reached the screen. */
  eq(r.counterShare, 0, 'and the counter share is nothing rather than NaN');
  eq(r.topThreeShare, 0, 'as is the share of the top three');
}

/* ---------- 4. what was bought, and from whom ----------------------- */
{
  data.suppliers = [{ id: 'S1', name: 'Roofings' }, { id: 'S2', name: 'Tororo' }];
  const inv = (id, sup, date, qty, price, voided) =>
    ({ id, supplierId: sup, date, voided: !!voided, items: [{ qty, price }], payments: [] });
  // Smaller supplier first, for the same reason as the customers above.
  data.purchaseInvoices = [
    inv(2, 'S2', '2026-08-04', 40, 26000),
    inv(1, 'S1', '2026-08-03', 100, 45000),
    inv(3, 'S1', '2026-08-05', 20, 45000),
    inv(4, 'S2', '2026-08-05', 999, 99999, true),   // voided
    inv(5, 'S1', '2026-06-01', 500, 45000),          // before the period
  ];
  const b = scope.purchaseConcentration('2026-08-01', '2026-08-31');
  eq(b.total, 6440000, 'only invoices inside the period, and not the voided one');
  eq(b.suppliers, 2, 'across the two suppliers used');
  eq(b.top.name, 'Roofings', 'the largest is the one most was bought from');
  eq(pct(b.topShare), 84, 'at 84% of what was bought in');

  /* Through the supplier list, the same rule the creditors figures use,
     so the two cannot disagree about which invoices exist. */
  data.suppliers = [{ id: 'S2', name: 'Tororo' }];
  eq(scope.purchaseConcentration('2026-08-01', '2026-08-31').total, 1040000,
    'an invoice whose supplier is gone is out of this too');
  data.suppliers = [{ id: 'S1', name: 'Roofings' }, { id: 'S2', name: 'Tororo' }];
}

/* ---------- 5. concentration as a consequence ----------------------- *
 * A percentage on its own decides nothing. Set against breakeven it
 * becomes the only question that matters: would the shop still cover
 * itself without them.
 */
{
  data.savedQuotes = [sale(1, 'Big', 4000000, false), sale(2, 'Small', 1200000, false),
    sale(3, 'Counter sale', 7200000, true)];
  const is = { from: '2026-08-01', to: '2026-08-31', revenue: 12400000 };

  // Breakeven above what is left without them: the shop sinks.
  const sinking = scope.concentrationExposure(is, { salesNeeded: 9285714 });
  eq(sinking.name, 'Big', 'the exposure is to the largest customer');
  eq(Math.round(sinking.without), 8400000, 'what would have been sold without them');
  t.check(sinking.sinks === true, 'which is below what the shop needs, so it sinks');
  eq(Math.round(sinking.shortBy), 885714, 'by a stated amount rather than a vague warning');
  /* 32% sounds survivable and is not. That gap between how a percentage
     reads and what it does is the reason this is tied to breakeven. */
  eq(pct(sinking.share), 32, 'on a share that by itself reads as comfortable');

  // And the other way.
  const safe = scope.concentrationExposure(is, { salesNeeded: 6000000 });
  t.check(safe.sinks === false, 'a shop that would still cover itself is told so');
  eq(safe.shortBy, 0, 'and is short by nothing rather than a negative shortfall');

  /* No breakeven, no consequence. Without a margin there is no line to
     fall below, and inventing one would be worse than saying nothing. */
  t.check(scope.concentrationExposure(is, { salesNeeded: null }) === null,
    'with no breakeven to measure against, no consequence is claimed');
  data.savedQuotes = [sale(1, 'Counter sale', 500000, true)];
  t.check(scope.concentrationExposure(is, { salesNeeded: 100 }) === null,
    'and a shop with no named customer has no exposure to one');
}

/* ---------- 6. on the page ------------------------------------------ */
{
  const fn = (/function stConcentrationHTML[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/singleSourcedLines\(\)/.test(fn), 'single-sourced lines are reported');
  const ss = (/function singleSourcedLines[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* A COUNT, not a share of spending: a line bought twice a year can
     still stop the shop on the morning somebody wants it, and weighting
     by money would hide exactly those. */
  // Counted, never summed. (An earlier version of this check forbade the
  // substring "price", which the 'priced' filter argument contains.)
  t.check(/\.length;/.test(ss) && !/reduce\(/.test(ss),
    'as a count of lines rather than weighted by what is spent on them');
  t.check(/new Set\(productPriceRows\(r\.p\.id, r\.idx\)\.map\(x=> x\.supplierId\)\)\.size === 1/.test(ss),
    'counting distinct suppliers, so two prices from one supplier is still single-sourced');

  /* Counter trade is the OPPOSITE of concentration, so it is said as
     such rather than left as an unexplained slice of the total. */
  t.check(/spread across walk-in customers rather than resting on any one name/.test(fn),
    'counter trade is named as spread rather than left looking like a gap');
  t.check(/That is the exposure, not the percentage/.test(fn),
    'and the finding is the consequence rather than the share');
  t.check(/rev\.total <= 0 && buy\.total <= 0/.test(fn),
    'a period with nothing either way says so instead of showing zeroes');
}

process.exit(t.done() ? 1 : 0);
