#!/usr/bin/env node
'use strict';
/*
 * Whether the statements can be believed, and which way the shop is going.
 *
 * THE FAILURE THIS FILE EXISTS FOR was found by reading the page rather
 * than the code. On a shop whose counter sales are taken in cash, the
 * statements said:
 *
 *   profit and loss   revenue 0, net profit -2,450,000
 *   cash flow         received from sales 7,100,000
 *   can these be      "nothing outstanding"
 *   trusted?
 *
 * Revenue comes from invoices by design -- it puts revenue and cost of
 * sales on the same accrual footing, which is right. But nothing told the
 * reader when that basis was excluding the trade. A hardware shop selling
 * over the counter reports a loss equal to its entire running costs every
 * month, and the panel whose whole job is "can these be trusted" did not
 * check the one thing most likely to be wrong.
 *
 * So the gap is measured, said before the figures it qualifies rather
 * than under them, and graded: a caveat when the uninvoiced trade is a
 * minority, a failure when it is the majority. A check that is red every
 * day in a cash shop is a check nobody reads.
 *
 * Run: node test/statements-trust.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('statements trust');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['statementBasisGap'];
const scope = compileScope([...NAMES.map((n) => extractFunction(src, n, 'index.html'))],
  { fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX' }, NAMES);

const gap = (revenue, tradingIn) => scope.statementBasisGap({ revenue }, { tradingIn });
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the shop that looks like it is failing --------------- */
{
  // The figures off the real screen: everything sold over the counter.
  const g = gap(0, 7100000);
  t.check(!!g, 'a shop with counter takings and no invoices has a gap to report');
  eq(g.uninvoiced, 7100000, 'the whole of the takings is outside the profit and loss');
  eq(g.revenue, 0, 'because none of it was invoiced');
  eq(g.invoicedShare, 0, 'so the statement can see none of the trade');
  t.check(g.dominant === true,
    'and it is graded as the majority of the business, not a footnote');
}

/* ---------- 2. it is graded, not shouted ---------------------------- *
 * A check that is red every day in a cash shop is wallpaper. It only
 * fails when the uninvoiced trade is bigger than the invoiced revenue --
 * the point at which the statement is describing the smaller half.
 */
{
  t.check(gap(14000000, 3200000).dominant === false,
    'a shop that invoices most of its sales gets a caveat, not a failure');
  t.check(gap(14000000, 7100000).dominant === false,
    'still a caveat while the invoiced side is the larger one');
  t.check(gap(7000000, 7100000).dominant === true,
    'and a failure the moment the uninvoiced side is larger');

  // The boundary. Equal halves is not yet "most of the trade".
  t.check(gap(5000000, 5000000).dominant === false,
    'exactly half is not the majority');
  eq(Math.round(gap(5000000, 5000000).invoicedShare * 100), 50, 'and reads as half the trade');
}

/* ---------- 3. a shop that invoices everything is left alone -------- */
{
  t.check(gap(14000000, 0) === null,
    'no counter takings means no gap and nothing to say about one');
  t.check(gap(0, 0) === null, 'and a period with no trade at all raises nothing');
  /* Sub-shilling noise is not a finding. */
  t.check(gap(1000, 0.4) === null, 'nor does a fraction of a shilling');
  /* The figure is rounded because it is PRINTED -- it goes straight into
     the banner and the check as money. Probing only the sub-shilling
     band missed this: below one shilling, rounded and unrounded both
     fall under the threshold and the mutant read as equivalent. */
  eq(gap(1000, 1234.6).uninvoiced, 1235,
    'and what is reported is whole shillings, since it is printed as money');
}

/* ---------- 4. the checks panel carries it -------------------------- */
{
  const checks = (/function statementChecks[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const gap = statementBasisGap\(is, cf\);/.test(checks),
    'the trust panel asks about the gap at all, which it never used to');
  t.check(/ok: gap\.dominant \? false : null/.test(checks),
    'reporting it as a failure only when it is the majority of the trade');
  /* The reader has to be told BOTH halves are missing. Saying only that
     revenue is understated invites the reader to add the takings back
     and think that is the profit -- the goods those sales consumed are
     missing from cost of sales too. */
  t.check(/neither that money nor the cost of the goods it sold/.test(checks),
    'and says that the cost of those goods is missing as well as the money');
  t.check(/Invoice the counter sales|Invoice counter sales/.test(checks),
    'with the thing to do about it');
}

/* ---------- 5. the verdict comes before the figures ----------------- */
{
  const ov = (/function stOverview[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/const gap = statementBasisGap\(is, cf\);/.test(ov),
    'the overview works out whether its own headline can be trusted');
  /* Order on the page, not merely presence: the banner is emitted before
     the vitals. Somebody reading a loss must not learn only afterwards,
     if they scroll, that the loss is an artefact of the basis. */
  t.check(ov.indexOf('st-verdict') < ov.indexOf('st-vitals'),
    'and says so above the numbers rather than under them');
  t.check(/These figures are missing \$\{Math\.round\(\(1-gap\.invoicedShare\)\*100\)\}%/.test(ov),
    'naming what share of the trade is missing');
  t.check(/st-verdict \$\{verdict\.state\}/.test(ov),
    'and carrying its state, so the banner is not the same colour whatever it says');

  /* A margin needs something to be a margin OF. "0.0% of everything
     sold" on a month with no invoiced sales reads as breaking even on a
     full month of trade. */
  t.check(/no invoiced sales to measure it against/.test(ov),
    'and a margin over no sales says so rather than printing 0.0%');
}

/* ---------- 6. the direction, which two points cannot give ---------- */
{
  const trend = (/function statementsTrend[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/incomeStatement\(from, to\)/.test(trend) && /cashFlowStatement\(from, to\)/.test(trend),
    'each month is built from the same two statements the tabs are built from');
  t.check(/netProfit: is\.netProfit/.test(trend) && /operating: cf\.operating/.test(trend),
    'carrying what the statements say and what the till says');

  const months = (/function stTrendMonths[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* Built from YYYY-MM and periodShift, never by adding months to a
     date: standing on the 31st, asking for "a month ago" rolls into the
     wrong month, which is the bug loansDueWithin was written around. */
  t.check(/periodShift\(p, -1\)/.test(months),
    'the months are stepped by period, not by subtracting days from a date');
  t.check(/out\.unshift\(p\)/.test(months), 'and come out oldest first, the way they are read');

  const chart = (/function stTrendChartHTML[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  /* A chart on a profit and loss that cannot draw a loss is no use. The
     bars run from a zero line in the middle. */
  t.check(/const zeroY = H \/ 2;/.test(chart) && /v >= 0 \? zeroY - h : zeroY/.test(chart),
    'a losing month is drawn below the line rather than as a short bar above it');
  t.check(/Math\.max\(1, \.\.\.values\.map\(Math\.abs\)\)/.test(chart),
    'and the scale is taken from the largest magnitude either way, so a loss is not clipped');
  t.check(/<title>/.test(chart), 'every bar names its month and its figure');
}

process.exit(t.done() ? 1 : 0);
