#!/usr/bin/env node
'use strict';
/*
 * Sales Analytics -- the Statistics screens.
 *
 * Its unit of truth is the MARGIN, and the page had three ways of being
 * wrong about it.
 *
 * A LOSS RENDERED GREEN. The Gross profit cell carried a hardcoded
 * `good` class. Verified on the running app: gross profit -60,000
 * printed in rgb(28,107,88), the app's own verdigris, exactly as a
 * profit would. Selling below cost was reported as health.
 *
 * A GUESSED COST WAS PRESENTED AS A FACT. invoiceLineCost already works
 * out estimatedQty -- units sold out of the shop's own stock with NO cost
 * lot behind them, costed at whatever `price` happened to be, which for a
 * counter-picked line is often nothing. The page never showed it.
 * Verified: 20 of 30 units costed at zero, and the screen reported a
 * gross margin of 79.71% without a word. Two decimal places on a figure
 * two thirds of which was invented.
 *
 * AND THE EXPORT WAS A DIFFERENT REPORT. Export CSV read anRowsForView()
 * -- the whole range, unsorted -- while the table showed the searched and
 * sorted rows. Verified: searching "Beta" showed one customer and
 * exported three, in another order. The button sits immediately beside
 * the search box that filtered them out. The KPIs ignored the search too,
 * so "Sales count 3" sat over a single row.
 *
 * Run: node test/sales-analytics.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('sales analytics');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['anFilterRows', 'anSortRows', 'anVisibleTotals', 'anCostConfidence', 'anDeltaHTML'];
let scope = null; let err = null;
try {
  scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the analytics helpers compile${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const near = (got, want, msg) => t.check(Math.abs(got - want) < 1e-6, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const kpis = (/function renderAnKpis\(rows\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const table = (/function renderAnTable\(\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const foot = (/function anTableFootHTML\(cols, rows\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const exportFn = (/an_export_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
const byItem = (/function anRowsByItem\(invoices\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const byCust = (/function anRowsByCustomer\(invoices\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const byDoc = (/function anRowsByDoc\(invoices\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];

/* ---------- 1. a loss is not a profit -------------------------------- */
{
  t.check(/kpi-value \$\{t\.profit >= 0 \? 'good' : 'bad'\}/.test(kpis),
    'gross profit is coloured by its sign');
  t.check(!/kpi-value good">\$\{fmtUGX\(Math\.round\(t\.profit\)\)\}/.test(code),
    'and no longer carries a hardcoded good, which painted a loss verdigris');
  t.check(/kpi-value \$\{t\.margin >= 0 \? '' : 'bad'\}/.test(kpis), 'as is the margin');
  t.check(/\.kpi-value\.bad\{color:var\(--danger\);\}/.test(src),
    'with a rule that actually gives it the danger colour');
  // Down to the individual row and the totals line, or a loss hides
  // inside a column of black figures.
  t.check(/c\.key==='profit' && Number\(r\[c\.key\]\)<0 \? ' an-neg' : ''/.test(table),
    'a row that lost money is marked too');
  t.check(/c\.key==='profit' && v<0 \? ' an-neg' : ''/.test(foot), 'and so is the total');
}

/* ---------- 2. how much of the cost was a guess ---------------------- */
if (scope) {
  eq(scope.anCostConfidence({ estimatedQty: 0, qty: 100 }), null,
    'nothing to say when every unit had a real cost behind it');
  eq(scope.anCostConfidence({ estimatedQty: 5, qty: 0 }), null,
    'nor when nothing was sold at all');
  const c = scope.anCostConfidence({ estimatedQty: 20, qty: 30 });
  eq(c.est, 20, 'otherwise it says how many units were guessed at');
  eq(c.qty, 30, 'out of how many');
  near(c.share, 2 / 3, 'as a share');
  /* The distinction worth drawing: a couple of estimated units in a
     thousand is a footnote, two thirds of them is the whole figure. */
  eq(c.dominant, true, 'and flags when most of the margin rests on a guess');
  eq(scope.anCostConfidence({ estimatedQty: 4, qty: 100 }).dominant, false,
    'while a handful of units is not that');

  t.check(/const conf = anCostConfidence\(t\);/.test(kpis), 'the screen works it out');
  t.check(/Cost was estimated on/.test(kpis) && /no purchase cost recorded against them/.test(kpis),
    'and says it in terms of what actually happened, not "data quality"');
  t.check(/conf\.dominant \? ' — most of this margin rests on a guess' : ''/.test(kpis),
    'with the stronger warning kept for when it is warranted');
  /* Two decimals on a figure part of whose cost was invented is
     precision the number does not have. */
  t.check(/t\.margin\.toFixed\(1\)/.test(kpis), 'and the margin is not quoted to two decimals');
  t.check(/if\(col\.pct\) return \(Number\(value\)\|\|0\)\.toFixed\(1\) \+ '%';/.test(code),
    'anywhere on the page');
}

/* ---------- 3. it survives a search ---------------------------------- *
 * estimatedQty is a property of the ROW, not of the range: filtering to
 * one customer must not lose the fact that their cost was a guess.
 */
{
  t.check(/estimatedQty: t\.estimatedQty/.test(byDoc), 'a document row carries how much of it was estimated');
  t.check(/row\.estimatedQty \+= lineCosting\.estimatedQty;/.test(byItem), 'an item row does');
  t.check(/row\.estimatedQty \+= t\.estimatedQty;/.test(byCust), 'and a customer row does');
  /* One call per line, not two. invoiceLineCost walks the stock lots. */
  eq((byItem.match(/invoiceLineCost\(it\)/g) || []).length, 1,
    'costed once per line rather than twice for the same answer');
}

/* ---------- 4. one set of rows, four readers ------------------------- */
if (scope) {
  const rows = [
    { name: 'Alpha Traders', sales: 340000, cost: 280000, qty: 10, count: 1, estimatedQty: 0, profit: 60000, margin: 17.6 },
    { name: 'Beta Builders', sales: 2600000, cost: 2100000, qty: 50, count: 1, estimatedQty: 50, profit: 500000, margin: 19.2 },
    { name: 'Gamma Ltd', sales: 47500, cost: 35000, qty: 5, count: 1, estimatedQty: 0, profit: 12500, margin: 26.3 },
  ];
  eq(scope.anFilterRows(rows, 'Beta').length, 1, 'a search narrows the rows');
  eq(scope.anFilterRows(rows, '').length, 3, 'an empty search narrows nothing');
  eq(scope.anFilterRows(rows, '   ').length, 3, 'nor does one of only spaces');

  /* `key` is an internal join field added for the dashboard, not
     something anybody searched for. Left in the haystack, typing "::"
     matched every row on the screen. */
  const keyed = [{ key: 'P001::', name: 'Cement', sales: 1, cost: 0, qty: 1 },
    { key: 'P002::', name: 'Nails', sales: 1, cost: 0, qty: 1 }];
  eq(scope.anFilterRows(keyed, '::').length, 0, 'and the internal join key is not searchable');
  eq(scope.anFilterRows(keyed, 'P001').length, 0, 'so an id in it cannot match either');
  eq(scope.anFilterRows(keyed, 'Cement').length, 1, 'while a real name still does');

  const asc = scope.anSortRows(rows, { key: 'sales', dir: 1 });
  eq(asc[0].name, 'Gamma Ltd', 'sorting ascending puts the smallest first');
  eq(scope.anSortRows(rows, { key: 'sales', dir: -1 })[0].name, 'Beta Builders', 'and descending the largest');

  t.check(/function anVisibleRows\(\)\{[\s\S]*?anSortRows\([\s\S]*?anFilterRows\(anRowsForView\(\)/.test(code),
    'the visible rows are the filtered rows, sorted');
  t.check(/const rows = anVisibleRows\(\);/.test(table), 'the table draws them');
  t.check(/const rows = anVisibleRows\(\);/.test(exportFn),
    'and the export writes THOSE, not the whole range in another order');
  t.check(!/const rows = anRowsForView\(\);/.test(exportFn),
    'which is what it used to do, beside the very search box that filtered them out');
  t.check(/renderAnKpis\(rows\);/.test(table),
    'and the summary above is handed the same rows, so it cannot say "3" over one line');
}

/* ---------- 5. the totals ------------------------------------------- */
if (scope) {
  const rows = [
    { sales: 1000, cost: 900, qty: 10, count: 2, estimatedQty: 1 },   // 10% margin
    { sales: 100, cost: 10, qty: 1, count: 1, estimatedQty: 0 },      // 90% margin
  ];
  const tt = scope.anVisibleTotals(rows);
  eq(tt.sales, 1100, 'sales add up');
  eq(tt.profit, 190, 'profit is what is left of them');
  eq(tt.qty, 11, 'as do the units');
  eq(tt.estimatedQty, 1, 'and the guessed ones');
  eq(tt.count, 3, 'and the sale counts, where a row carries one');
  /* NOT the mean of 10% and 90%. Averaging margins weights a one-bag
     sale the same as a lorry load -- it would report 50% here, against
     a business that actually kept 17.3% of what it took. */
  near(Number(tt.margin.toFixed(1)), 17.3, 'while the margin is the total profit over the total sales, not the average of the margins');

  // A row without its own count is one sale, which is what a document row is.
  eq(scope.anVisibleTotals([{ sales: 5, cost: 1, qty: 1, estimatedQty: 0 }]).count, 1,
    'a document row counts as the one sale it is');
  eq(scope.anVisibleTotals([]).margin, 0, 'and nothing sold is a margin of nothing, not a division by zero');

  /* Pinned on the CALL, not only on the function. Dropping
     ${anTableFootHTML(...)} from the table left the whole function
     sitting in the file, unreached, while every check on it passed. */
  t.check(/\$\{anTableFootHTML\(cols, rows\)\}<\/table>/.test(table),
    'and the table actually renders it');
  t.check(/const t = anVisibleTotals\(rows\);/.test(foot), 'drawn from the visible rows');
  t.check(/c\.key==='margin' \? t\.margin/.test(foot), 'taking the margin from that same arithmetic');
}

/* ---------- 6. against the period before it -------------------------- *
 * A figure on its own says nothing about a business. 20,271,000 of sales
 * is either a good month or a collapse, and the page never said which.
 */
if (scope) {
  t.check(/anShiftDate\(from, -1\)/.test(code) && /dashRangeSpanDays\(from, to\)/.test(code),
    'the period before is the same length, ending the day this one starts');
  t.check(/if\(!from \|\| !to\) return null;/.test(code),
    'and "all time" has none, so nothing is claimed for it');
  t.check(/if\(!prev\.length\) return null;/.test(code),
    'nor does a period with no invoices behind it');

  eq(scope.anDeltaHTML(100, null, true), '', 'no prior period shows no change');
  t.check(/new/.test(scope.anDeltaHTML(100, 0, true)),
    'and growth from nothing is said as new business rather than as +100%, which implies a doubling');
  eq(scope.anDeltaHTML(0, 0, true), '', 'while nothing to nothing says nothing at all');
  t.check(/\+50%/.test(scope.anDeltaHTML(150, 100, true)) && /up/.test(scope.anDeltaHTML(150, 100, true)),
    'a real rise is a percentage, marked as good where more is better');
  t.check(/down/.test(scope.anDeltaHTML(50, 100, true)), 'and a fall as bad');

  /* A MARGIN MOVES IN POINTS. 13.2% to 23.3% is up 10.1 points; reported
     as "+77%" it reads as though the margin itself were 77, which is the
     number somebody would repeat to their supplier. */
  t.check(/\+10\.1 pts/.test(scope.anDeltaHTML(23.3, 13.2, true, true)),
    'a margin change is given in points, not as a percentage of a percentage');
  t.check(/level/.test(scope.anDeltaHTML(23.30, 23.32, true, true)),
    'and a margin that has barely moved says so rather than rounding to +0.0');
  t.check(/anDeltaHTML\(t\.margin, cmp\.margin, true, true\)/.test(kpis), 'which is how the screen asks for it');

  /* A comparison against the whole previous period is meaningless while
     a search narrows this one to a single customer. */
  t.check(/const cmp = filtered \? null : prev;/.test(kpis),
    'and no comparison is offered while a search is narrowing the figures');
  /* Pinned on the guard: `if(false) bits.push(...)` leaves the sentence
     present and unreachable, and a match on the words alone passed. */
  t.check(/if\(filtered\) bits\.push\(/.test(kpis) && /Showing only what matches/.test(kpis),
    'the screen saying instead what it is showing');
  t.check(/else if\(prev\) bits\.push\(/.test(kpis),
    'and the comparison line taking its place only when there is no search');
}

process.exit(t.done() ? 1 : 0);
