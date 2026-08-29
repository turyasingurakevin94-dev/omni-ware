#!/usr/bin/env node
'use strict';
/*
 * The Executive Dashboard's derived numbers.
 *
 * These are advisory rather than transactional -- nothing here moves money.
 * What they do is tell the owner what to DO about money: whether there is
 * runway, whether a supplier is squeezing them, what the stock is worth.
 * A wrong ledger loses a figure; a wrong dashboard loses a decision.
 *
 * Two of them were confidently wrong, in the direction that reassures.
 *
 * Run: node test/dashboard-numbers.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('dashboard');
const src = read('index.html');

const TODAY = '2026-08-02';
const shift = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const data = { products: [], prices: [], cashTxns: [], purchaseInvoices: [], stock: {}, stockLots: {}, stockLog: [] };
const env = {
  data,
  todayISO: () => TODAY,
  supplierName: (id) => String(id),
  anShiftDate: shift,
  daysSinceDate: (d) => Math.round((new Date(TODAY) - new Date(d)) / 86400000),
};
const NAMES = ['dashCashTxnsInRange', 'dashMonthlyBurn', 'dashSupplierPriceInflation'];
/* The cost-rise flag is a cut of the supplier price watch now, so its
   chain comes with it -- including the registry lookup the watch uses
   to compare the file against what was actually paid. The flag itself
   still reports only what the invoices say; the case below proves it. */
const CHAIN = ['supplierPriceWatch', 'supplierPriceSeries', 'waDaysBetween',
  'productPriceRows', 'purchasePriceAtQty', 'tieredUnitPrice', 'tiersForKind'];
const fn = compileScope([
  extractDeclaration(src, 'DASH_COST_RISE_PCT', 'index.html'),
  extractDeclaration(src, 'PRICE_WATCH_FILE_TOLERANCE_PCT', 'index.html'),
  ...NAMES.concat(CHAIN).map((n) => extractFunction(src, n, 'index.html')),
], env, NAMES);

/* ---------- 0. dates shift by whole days, wherever you are ------------ */
/*
 * anShiftDate parsed `iso+'T00:00:00'` (LOCAL midnight) and serialised with
 * toISOString() (UTC). Anywhere ahead of Greenwich that lands on the
 * previous day -- in Africa/Kampala, where this app runs, anShiftDate(x, 0)
 * returned YESTERDAY. Every date range in the app is built from it: "last 7
 * days" spanned 8, and the dashboard's previous-period comparison chains two
 * shifts, so the drift compounded and it compared windows of different
 * lengths.
 *
 * Run in several timezones on purpose. Asserting this from one machine
 * proves nothing: the old code was correct in UTC and in the Americas, and
 * wrong everywhere this shop actually is.
 */
{
  const { execFileSync } = require('child_process');
  const path = require('path');
  const probe = `
    const { read, extractFunction, compileScope } = require(${JSON.stringify(path.join(__dirname, '_extract.js'))});
    const src = read('index.html');
    const fn = compileScope(['todayISO','anShiftDate','daysSinceDate']
      .map(n => extractFunction(src, n, 'index.html')), {}, ['todayISO','anShiftDate','daysSinceDate']);
    const today = fn.todayISO();
    const span = (n) => fn.daysSinceDate(fn.anShiftDate(today, -(n-1))) + 1;
    console.log(JSON.stringify({
      zeroShiftIsNoOp: fn.anShiftDate(today, 0) === today,
      last7: span(7), last30: span(30), last90: span(90),
      reversible: fn.anShiftDate(fn.anShiftDate(today, -45), 45) === today,
      monthEnd: fn.anShiftDate('2026-03-01', -1),
      yearEnd: fn.anShiftDate('2026-01-01', -1),
      leapDay: fn.anShiftDate('2028-03-01', -1),
    }));
  `;
  const ZONES = ['UTC', 'Africa/Kampala', 'Pacific/Kiritimati', 'Pacific/Midway', 'Asia/Kolkata'];
  const results = {};
  ZONES.forEach((tz) => {
    const raw = execFileSync(process.execPath, ['-e', probe], {
      cwd: path.join(__dirname, '..'),
      env: Object.assign({}, process.env, { TZ: tz }),
      encoding: 'utf8',
    });
    results[tz] = JSON.parse(raw);
  });

  const wrong = ZONES.filter((tz) => {
    const r = results[tz];
    return !r.zeroShiftIsNoOp || r.last7 !== 7 || r.last30 !== 30 || r.last90 !== 90
      || !r.reversible || r.monthEnd !== '2026-02-28' || r.yearEnd !== '2025-12-31' || r.leapDay !== '2028-02-29';
  });
  t.check(wrong.length === 0,
    wrong.length
      ? `date shifting is wrong in: ${wrong.map((z) => `${z} ${JSON.stringify(results[z])}`).join(' | ')}`
      : `a day is a day in all ${ZONES.length} timezones — UTC+14 through UTC-11, including the one this shop is in`);
  t.check(results['Africa/Kampala'].zeroShiftIsNoOp,
    'in particular, shifting by zero days does not move the date in Africa/Kampala');
  t.check(results['Pacific/Kiritimati'].last30 === 30,
    'and a 30-day window is 30 days at UTC+14, the furthest ahead there is');
}

/* ---------- 1. burn is divided by the history that exists ------------- */
/*
 * The window is 90 days; assuming it is FULL is what was wrong. A shop ten
 * days old had ten days of spending divided by three months -- burn
 * understated ninefold, and runway (cash / burn) overstated by the same.
 * It reported 3.0 months of cover where there were 0.3, which is exactly
 * the error an owner would act on.
 */
{
  const spendPerDay = 300000;
  const trueMonthly = spendPerDay * 30;
  const rows = [];
  [10, 45, 90].forEach((days) => {
    data.cashTxns = [];
    for (let i = 0; i < days; i++) data.cashTxns.push({ date: shift(TODAY, -i), type: 'payment', amount: spendPerDay });
    rows.push({ days, burn: Math.round(fn.dashMonthlyBurn()) });
  });
  const allRight = rows.every((r) => r.burn === trueMonthly);
  t.check(allRight,
    allRight
      ? `burn is the same true rate at 10, 45 and 90 days of history (${trueMonthly.toLocaleString()}/month)`
      : `burn still depends on how much history exists: ${rows.map((r) => `${r.days}d→${r.burn}`).join(', ')}`);

  // The consequence, stated as the owner would meet it.
  data.cashTxns = [];
  for (let i = 0; i < 10; i++) data.cashTxns.push({ date: shift(TODAY, -i), type: 'payment', amount: spendPerDay });
  const runway = 3000000 / fn.dashMonthlyBurn();
  t.check(runway > 0.28 && runway < 0.36,
    `a 3,000,000 balance against ten days of this spending is a third of a month of runway, not three (${runway.toFixed(1)})`);
}
{
  data.cashTxns = [];
  t.check(fn.dashMonthlyBurn() === 0, 'a shop that has spent nothing has no burn rather than a divide-by-zero');
  data.cashTxns = [{ date: TODAY, type: 'receipt', amount: 500000 }];
  t.check(fn.dashMonthlyBurn() === 0, 'and money coming IN is not burn');
}
{
  // Only outflows count, and all three spellings of one.
  data.cashTxns = [
    { date: TODAY, type: 'payment', amount: 100 }, { date: TODAY, type: 'out', amount: 100 },
    { date: TODAY, type: 'expense', amount: 100 }, { date: TODAY, type: 'receipt', amount: 9999 },
    { date: shift(TODAY, -200), type: 'payment', amount: 9999 },   // outside the window
  ];
  const burn = fn.dashMonthlyBurn();
  t.check(Math.round(burn) === 300 * 30,
    `payments, outs and expenses all count; receipts and anything older than the window do not (${Math.round(burn)})`);
}

/* ---------- 2. a cost rise means a cost that actually rose ------------ */
/*
 * The bug worth having. This read data.prices, which holds exactly ONE
 * current row per product+variant+supplier -- a save replaces the previous
 * one. So sorting a product's rows by date and comparing first to last
 * compared two DIFFERENT suppliers, or two different variants, and called
 * the difference between them a price rise. Both produced crit cards
 * saying margin was being squeezed while nothing had changed.
 */
const inv = (date, supplier, name, price, variantIdx = null, voided = false) => ({
  date, supplierId: supplier, supplierName: supplier, voided,
  items: [{ productId: 'P1', variantIdx, productName: name, price, qty: 5 }],
});
{
  data.purchaseInvoices = [inv('2026-05-01', 'Kampala Steel', 'Hinges', 10000), inv('2026-07-20', 'Kampala Steel', 'Hinges', 13000)];
  const [f] = fn.dashSupplierPriceInflation();
  t.check(f && Math.round(f.growth) === 30,
    `a supplier charging more for the same item over time is reported (${f ? f.growth.toFixed(1) : 'nothing'}%)`);
  t.check(f && f.first === 10000 && f.last === 13000 && f.since === '2026-05-01' && f.supplierName === 'Kampala Steel',
    'with both figures, the date it was cheaper, and who charged it — so it can be checked rather than believed');
}
{
  const mustBeQuiet = {
    'two suppliers, each bought once': [inv('2026-05-01', 'CHEAP', 'Hinges', 10000), inv('2026-07-20', 'DEAR', 'Hinges', 15000)],
    'two variants of one product': [inv('2026-05-01', 'S1', 'Hinges S', 20000, 0), inv('2026-07-20', 'S1', 'Hinges L', 50000, 1)],
    'several purchases on one day': [inv('2026-05-01', 'S1', 'Hinges', 10000), inv('2026-05-01', 'S1', 'Hinges', 15000)],
    'a price that fell': [inv('2026-05-01', 'S1', 'Hinges', 15000), inv('2026-07-20', 'S1', 'Hinges', 10000)],
    'a rise below the threshold': [inv('2026-05-01', 'S1', 'Hinges', 10000), inv('2026-07-20', 'S1', 'Hinges', 10300)],
    'the later purchase voided': [inv('2026-05-01', 'S1', 'Hinges', 10000), inv('2026-07-20', 'S1', 'Hinges', 13000, null, true)],
    'a single purchase': [inv('2026-05-01', 'S1', 'Hinges', 10000)],
    'nothing bought at all': [],
  };
  const noisy = Object.entries(mustBeQuiet)
    .filter(([, rows]) => { data.purchaseInvoices = rows; return fn.dashSupplierPriceInflation().length > 0; })
    .map(([label]) => label);
  t.check(noisy.length === 0,
    noisy.length
      ? `these raised a cost-rise flag and must not: ${noisy.join('; ')}`
      : `none of the ${Object.keys(mustBeQuiet).length} look-alikes raise a flag`);
}
{
  // The price registry alone can no longer produce a flag, whatever is in
  // it -- that is the whole point of the change.
  data.purchaseInvoices = [];
  data.products = [{ id: 'P1', name: 'Hinges' }];
  data.prices = [
    { productId: 'P1', variantIdx: null, supplierId: 'CHEAP', wholesale: 10000, retail: 14000, date: '2026-01-01' },
    { productId: 'P1', variantIdx: null, supplierId: 'DEAR', wholesale: 15000, retail: 18000, date: '2026-08-01' },
  ];
  t.check(fn.dashSupplierPriceInflation().length === 0,
    'two suppliers in the price registry cannot by themselves raise a cost-rise flag');
  /* The source pin follows the derivation to where it now lives. The
     watch DOES read the price registry -- to say where the file has
     drifted from what the shop actually pays -- but the movement it
     reports comes from the invoices alone, which is what the case above
     proves at runtime. */
  const seriesSrc = extractFunction(src, 'supplierPriceSeries', 'index.html')
    .split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  t.check(/data\.purchaseInvoices/.test(seriesSrc),
    'because the prices it compares are read from the purchase invoices, which have history');
  t.check(/points\.push/.test(seriesSrc) && !/points\.push[\s\S]{0,200}data\.prices/.test(seriesSrc),
    'and nothing from the registry, which has none, is ever pushed onto that trail');
}
{
  // Ranked worst-first and capped, so the card names the ones worth acting on.
  data.purchaseInvoices = [];
  [['A', 10000, 30000], ['B', 10000, 12000], ['C', 10000, 20000], ['D', 10000, 11000]].forEach(([s, lo, hi]) => {
    data.purchaseInvoices.push(inv('2026-05-01', s, 'Hinges', lo), inv('2026-07-20', s, 'Hinges', hi));
  });
  const flags = fn.dashSupplierPriceInflation();
  t.check(flags.length === 3 && flags[0].supplierName === 'A' && flags[1].supplierName === 'C',
    `the worst rises come first and the list is capped (${flags.map((f) => f.supplierName).join(',')})`);
}

/* ---------- 3. the threat card says what the data supports ------------ */
/*
 * The old card asserted "wholesale up X% vs retail up only Y%". The retail
 * side has no history anywhere -- prices.retail is only ever the current
 * figure -- so that comparison was not merely wrong, it was uncomputable.
 */
{
  /* The card moved into dashAlerts when the dashboard grew a ranked
     list -- same claim, said in the shop's terms rather than as a
     severity label. */
  const alerts = extractFunction(src, 'dashAlerts', 'index.html');
  t.check(/costs \$\{f\.growth\.toFixed\(0\)\}% more than it did/.test(alerts)
    && !/margin is being squeezed/.test(src),
  'the card reports the cost rise it can actually see');
  /* Both ends of the trend, which is the part that IS computable: what
     it cost then and what it costs now, from the purchase invoices. */
  t.check(/\$\{fmtUGX\(Math\.round\(f\.first\)\)\} on \$\{esc\(fmtShortDate\(f\.since\)\)\}, \$\{fmtUGX\(Math\.round\(f\.last\)\)\} now/.test(alerts),
    'naming both prices and when the first was paid');
  t.check(!/f\.rGrowth/.test(src),
    'and no longer quotes a retail trend that cannot be computed from anything stored');
}

/* ---------- 4. stock with no recorded cost is not worth nothing ------- */
{
  /* The shelf walk moved into stockAgeRows so the clearance screen could
     have the per-line list the dashboard had always thrown away. The
     cost cascade travelled with it and must still be the same one. */
  const rows = extractFunction(src, 'stockAgeRows', 'index.html');
  t.check(!/getFIFOUnitCost\(p\.id, variantIdx\) \|\| 0/.test(rows),
    'inventory value no longer treats unknown cost as zero');
  t.check(/rankedPriceRows\(p\.id, variantIdx\)\[0\]/.test(rows) && /purchasePriceAtQty\(fallbackRow, qty\)/.test(rows),
    'and falls back to what replacing the unit would cost, like the quote line does');

  /* ONE READING. dashInventoryHealth is now derived from those rows and
     must not walk the shelf a second time — two walks are two answers,
     and the dashboard card, the Manager's dead-stock target and the
     clearance screen all quote this figure at the owner. */
  const health = extractFunction(src, 'dashInventoryHealth', 'index.html');
  t.check(/stockAgeRows\(\)/.test(health),
    'the dashboard reads the one shelf walk rather than repeating it');
  t.check(!/allProductVariantEntries|getStockQty|getFIFOUnitCost/.test(health),
    'and reaches for none of the pieces itself — the moment it does, the screen and the card can disagree about what is dead');
}

process.exit(t.done() ? 1 : 0);
