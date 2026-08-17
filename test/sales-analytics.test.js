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
  /* Repointed, not weakened: the note used to end "those came out of your
     own stock with no purchase cost recorded against them", which stopped
     being true once a BOUGHT-IN line with no price on file started
     counting here too -- and sending somebody to look at their shelf for
     a line they ordered in is worse than saying nothing. Same assertion,
     same intent: name what happened. */
  t.check(/Cost was estimated on/.test(kpis) && /Nothing on file says what those units cost us/.test(kpis),
    'and says it in terms of what actually happened, not "data quality"');
  t.check(/their sale value counts as profit in full/.test(kpis),
    'spelling out the consequence, since that is the number somebody is about to act on');
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

/* ---------- 8. a cost of nothing is not a cost of zero ------------------
 *
 * Asked live, of a real board: "how does Ken Bwaise have 105,000 UGX as
 * gross profit on his order. That can't be true." His row showed 22.6%
 * against four neighbours at 4.0, 4.5, 4.8 and 7.4.
 *
 * invoiceLineCost costs a bought-in line at `Number(it.price)||0`, and
 * declared the answer certain either way. A line with no price on file --
 * a state this shop demonstrably has, since the buying banner counts them
 * on its own face ("N lines with no supplier price") -- therefore cost
 * NOTHING, with estimatedQty 0 to say so confidently. Its whole sale value
 * lands in gross profit.
 *
 * The arithmetic below is unchanged. What changes is which units claim to
 * be evidence.
 */
{
  const costFn = compileScope([extractFunction(src, 'invoiceLineCost', 'index.html')], {}, ['invoiceLineCost']).invoiceLineCost;
  const line = (o) => Object.assign({ qty: 10, price: 1000, supplierId: 'S1' }, o);

  const priced = costFn(line());
  eq(priced.cost, 10000, 'a bought-in line still costs what we agreed to pay');
  eq(priced.estimatedQty, 0, 'and that is evidence, not a guess');

  const unpriced = costFn(line({ price: 0 }));
  eq(unpriced.cost, 0, 'a bought-in line with no price on file still contributes no cost — the arithmetic is unchanged');
  eq(unpriced.estimatedQty, 10,
    'but every unit of it is now counted as unmeasured, instead of reporting a free sale as a fact');
  eq(costFn(line({ price: undefined })).estimatedQty, 10, 'a line with no price field at all counts the same way');

  /* Off the shelf: the lots are the evidence. */
  const shelf = (lots, o) => costFn(line(Object.assign({ supplierId: '__stock__', _stockLots: lots }, o)));
  eq(shelf([{ qty: 10, cost: 800 }]).cost, 8000, 'shelf units cost what those exact units cost');
  eq(shelf([{ qty: 10, cost: 800 }]).estimatedQty, 0, 'which is measured, not guessed');
  eq(shelf([{ qty: 6, cost: 800 }]).estimatedQty, 4,
    'stock running out mid-sale leaves the remainder a guess, as it always has');
  /* And those four are still COSTED, at the line's own price. Dropping
     them would make a short sale look more profitable than a full one --
     the opposite of the bug this section is about, and the mutation that
     survived until this line existed. */
  eq(shelf([{ qty: 6, cost: 800 }]).cost, 8800,
    'the guessed remainder still carries the line price into the cost — six at 800 and four at 1,000');
  /* stock_lots.cost is nullable, and Number(null)||0 is zero -- so these
     units were costed at nothing AND counted as measured. */
  eq(shelf([{ qty: 10, cost: null }]).estimatedQty, 10,
    'lots carrying no cost of their own are unmeasured too, not free');
  eq(shelf([{ qty: 10, cost: null }]).cost, 0, 'again with the arithmetic left alone');
  eq(shelf([]).estimatedQty, 10, 'and a shelf line with no lots at all is entirely a guess');

  // The reversal guard this function has always carried.
  eq(shelf([{ qty: 25, cost: 800 }]).cost, 8000,
    'lots recording more than was sold cost only what was sold');
}

/* ---------- 9. and the row says so ------------------------------------
 *
 * anCostConfidence has told the KPI strip this since the 79.71% incident.
 * The strip describes the whole visible range; the question people ask is
 * about ONE row. estimatedQty was on the row the entire time and the
 * margin printed beside it without a word.
 */
{
  const mark = extractFunction(src, 'anEstimatedMarkHTML', 'index.html');
  const markFn = compileScope([mark], { esc: (s) => String(s) }, ['anEstimatedMarkHTML']).anEstimatedMarkHTML;

  eq(markFn({ estimatedQty: 0, qty: 22 }, 'cost'), '', 'a row whose cost is all evidence is not marked');
  eq(markFn(null, 'cost'), '', 'and neither is a missing row');
  t.check(markFn({ estimatedQty: 22, qty: 22 }, 'cost').includes('*'),
    'a row part of whose cost was invented carries the mark');
  t.check(/22 of 22 units/.test(markFn({ estimatedQty: 22, qty: 22 }, 'cost')),
    'saying how many of how many, so the reader can weigh it');
  eq(markFn({ estimatedQty: 22, qty: 22 }, 'sales'), '',
    'on the cost column only — cost is where the doubt is, and profit and margin both come out of it');

  t.check(/anFormatCell\(c, r\[c\.key\], r\)/.test(table),
    'the table hands the row to the formatter, since the value alone cannot know');
  t.check(/anFormatCell\(c, v, t\)/.test(foot),
    'and the totals line is marked on the same rule as the rows it adds up');
  const card = extractFunction(src, 'reportCardHTML', 'index.html');
  t.check(/formatCellFn\(c, row\[c\.key\], row\)/.test(card),
    'the phone card too — the caveat cannot be desktop-only');

  /* The file gets opened in a spreadsheet, mailed on, and quoted back. A
     star that does not survive the export is a figure with the doubt
     filed off. */
  t.check(/Units with no cost recorded/.test(exportFn),
    'the export carries the count as its own column');
  t.check(/r\.estimatedQty/.test(exportFn), 'taken from the row, not recomputed');
}

process.exit(t.done() ? 1 : 0);
