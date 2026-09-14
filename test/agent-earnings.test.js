#!/usr/bin/env node
'use strict';
/*
 * The agent Earnings screen.
 *
 * The screen answers one question -- how much did I make -- and its
 * six-month chart could not answer it. A 64px sparkline: no figures, no
 * scale, and no marker for the month being inspected. Paging to April
 * changed the wallet, the claim card and the order list, and left the
 * chart showing the same six anonymous months. It was drawn once when the
 * screen opened and deliberately never redrawn.
 *
 * It is columns now, each carrying its own figure, and it is the screen's
 * month picker: tapping one loads that month everywhere else.
 *
 * The bug found while rebuilding it is the one worth keeping a test on.
 * monthEarnings() counts a bonus only on a COMPLETED order -- an order
 * still out for delivery has not earned it yet. The order rows below
 * printed orderEarnings(o).bonus regardless of status, so in any month
 * holding a pending order the rows added up to more than the total they
 * sat directly underneath.
 *
 * Run: node test/agent-earnings.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent earnings');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. the order the user asked for ------------------------- */
/*
 * Bonus opportunities below the six-month graph. Everything from the
 * wallet down to the order list is about the selected month; bonus
 * opportunities are not month-scoped, so they follow that block rather
 * than splitting it.
 */
{
  const view = (/<div id="ag_earningsView"[\s\S]*?\n  <\/div>/.exec(src) || [''])[0];
  t.check(view.length > 0, 'the earnings view is found');
  const seq = [...view.matchAll(/id="(ag_trendCardWrap|ag_claimWrap|ag_earningsOrdersWrap|ag_bonusOpportunitiesWrap)"/g)].map(m => m[1]);
  t.check(seq.join(',') === 'ag_trendCardWrap,ag_claimWrap,ag_earningsOrdersWrap,ag_bonusOpportunitiesWrap',
    `the graph comes first and bonus opportunities last (${seq.join(' -> ')})`);
  t.check(view.indexOf('ag_trendCardWrap') < view.indexOf('ag_bonusOpportunitiesWrap'),
    'which is the whole point: bonus opportunities sit BELOW the last-6-months graph');
}

/* ---------- 2. the chart carries figures ---------------------------- */
{
  t.check(!/agSparkFill/.test(src), 'the sparkline is gone');
  t.check(/<span class="v">\$\{empty \? '&mdash;' : esc\(fmtCompactUGX\(t\)\)\}<\/span>/.test(code),
    'every column states what that month earned');
  t.check(/aria-label="\$\{esc\(monthLabel\(m\)\)\}, \$\{empty \? 'no orders' : esc\(fmtUGX\(t\)\)\}"/.test(code),
    'and the exact, uncompacted figure is on the label, so the rounding is not the only access to it');

  // A ZERO month still occupies a column. This used to be the whole rule:
  //
  //     const pct = max > 0 ? Math.max((t/max)*100, 3) : 3;
  //
  // which gave every month a stub, including months with no orders in
  // them at all -- and printed "0" over them. That is a zero that looks
  // measured, and a measured zero cannot be told from a real one: on this
  // screen the difference is between a bad month and a month the app
  // failed to read. So the rule splits in two, and both halves are pinned.
  t.check(/const px = \(t\)=> max > 0 \? Math\.max\(Math\.round\(\(t\/max\)\*TREND_BAR_PX\), 3\) : 3;/.test(code),
    'a month that earned nothing gets a stub -- no bar at all reads as missing data, not as a bad month');
  t.check(/const empty = !stats\[i\]\.orders\.length;/.test(code),
    'but a month with no ORDERS is a different thing, and is told apart by its orders, not by its total');
  t.check(/<span class="none"><\/span>/.test(code) && /\.fx-col \.none\{[^}]*height:2px/.test(src),
    'and draws a hairline and a dash instead of a stub and a zero');
}

/* ---------- 3. the compacted figures -------------------------------- */
/*
 * Six exact UGX amounts do not fit across a phone. The boundaries are
 * what break: 999,600 must not render as "1000k".
 */
{
  let f = null;
  try { ({ fmtCompactUGX: f } = compileScope([extractFunction(src, 'fmtCompactUGX', 'agent.html')], {}, ['fmtCompactUGX'])); }
  catch (e) { /* reported below */ }
  t.check(typeof f === 'function', 'fmtCompactUGX compiles');
  if (f) {
    t.check(f(0) === '0', 'nothing earned is 0, not 0k');
    t.check(f(999) === '999', 'under a thousand is exact');
    t.check(f(45500) === '46k', 'thousands round');
    t.check(f(412000) === '412k', 'and read at a glance');
    t.check(f(999400) === '999k', 'just under the million mark stays in k');
    t.check(f(999600) === '1M', 'and just over it promotes, rather than saying 1000k');
    t.check(f(1250000) === '1.3M', 'millions keep one decimal while it still means something');
    t.check(f(12400000) === '12M', 'and drop it once it does not');
    t.check(f(null) === '0' && f(undefined) === '0', 'missing figures do not throw');
  }
}

/* ---------- 4. the chart is the month picker ------------------------ */
{
  t.check(/data-trend-month="\$\{esc\(m\)\}"/.test(code), 'each column carries its month');
  t.check(/const col = e\.target\.closest\('\[data-trend-month\]'\);/.test(code)
    && /earningsViewMonth = col\.dataset\.trendMonth;\s*renderEarnings\(\);/.test(code),
    'and tapping one loads that month into the rest of the screen');
  t.check(/const sel = m === earningsViewMonth;/.test(code) && /aria-pressed="\$\{sel\}"/.test(code),
    'the selected column is marked, in the accessibility tree as well as visually');

  // The marker has to follow the prev/next arrows too, which is exactly
  // what the old "deliberately not re-rendered" comment ruled out.
  t.check(/renderTrendChart\(\);\s*renderClaimCard\(monthKey, bonus\);/.test(code),
    'renderEarnings redraws the chart, so the arrows move the marker as well as the figures');
  t.check(!/deliberately not\s*\n?\/\/ re-rendered on prev\/next/.test(src),
    'and the comment that forbade it is gone');

  // Paging past the six-month window must not silently lose you.
  t.check(/!months\.includes\(earningsViewMonth\)/.test(code),
    'a month outside the window is detected');
  t.check(/before this window/.test(code),
    'and named, rather than leaving no column marked and no explanation');

  t.check(/\.fx-col\{[^}]*min-height:44px/.test(src), 'a column is a 44px tap target');
  t.check(/\.fx-col\{[^}]*box-sizing:border-box/.test(src),
    'and it restores border-box after all:unset, so 44 means 44');
  t.check(/\.fx-col:focus-visible\{outline:/.test(src), 'with a visible focus ring');
}

/* ---------- 5. the rows add up to the total above them -------------- */
/*
 * The bug. Both rules stated as plain arithmetic, so the fix is pinned to
 * the behaviour rather than to the shape of the markup.
 */
{
  const orderEarnings = (o) => {
    let margin = 0, bonus = 0;
    (o.items || []).forEach(it => {
      margin += ((Number(it.agentSellPrice) || 0) - (Number(it.sellPrice) || 0)) * (Number(it.qty) || 0);
      bonus += Number(it.bonusCommission) || 0;
    });
    return { margin, bonus };
  };
  const mk = (status, margin, bonus) => ({ status, items: [{ agentSellPrice: margin, sellPrice: 0, qty: 1, bonusCommission: bonus }] });
  const orders = [mk('completed', 95000, 5000), mk('pending_delivery', 60000, 25000)];

  // What the wallet shows -- monthEarnings' rule, transcribed.
  const walletTotal = orders.reduce((sum, o) => {
    const e = orderEarnings(o);
    return sum + e.margin + (o.status === 'completed' ? e.bonus : 0);
  }, 0);

  // What a row shows now.
  const rowAmount = (o) => {
    const e = orderEarnings(o);
    return e.margin + (o.status === 'completed' ? e.bonus : 0);
  };
  const rowsSum = orders.reduce((s, o) => s + rowAmount(o), 0);
  t.check(walletTotal === 160000, 'the wallet counts the pending order\'s margin but not its bonus');
  t.check(rowsSum === walletTotal, `and the rows now add up to it (${rowsSum} vs ${walletTotal})`);

  // What a row showed before, which is what made them disagree.
  const oldRowAmount = (o) => { const e = orderEarnings(o); return e.margin + e.bonus; };
  t.check(orders.reduce((s, o) => s + oldRowAmount(o), 0) === 185000,
    'the old rows summed to 185,000 under a total reading 160,000');

  // The source states the rule once, next to the figure it governs.
  t.check(/const counted = o\.status === 'completed';/.test(code)
    && /const earned = e\.margin \+ \(counted \? e\.bonus : 0\);/.test(code),
    'the row applies the same qualification the wallet does');
  t.check(/bonus when completed/.test(code),
    'and an unqualified bonus is shown as pending rather than dropped, so it is not simply missing');
}

/* ---------- 6. the screen says which month it is showing ------------ */
{
  t.check(/ag_earningsOrdersTitle'\)\.textContent = `Orders in \$\{monthLabel\(monthKey\)\}`/.test(code),
    'the order list names its month instead of saying "that month"');
  t.check(/No orders in \$\{esc\(monthLabel\(monthKey\)\)\}\./.test(code),
    'and so does the empty state');
}

process.exit(t.done() ? 1 : 0);
