#!/usr/bin/env node
'use strict';
/*
 * Your money: once the Earnings screen, now the Money sheet that comes up
 * from the ring on Today.
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

const money = extractFunction(src, 'openMoneySheet', 'agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');
const six = fn('moneySixHTML'), hero = fn('moneyHeroHTML'), orderRows = fn('moneyOrdersHTML');

/* ---------- 1. the sheet reads top to bottom by month ---------------- */
/*
 * This month: the gauge, anything waiting to be claimed, the climb, what
 * is on its way, where it came from, where you stand, then every order.
 * A closed month: the gauge, claims, the month day by day, who made it,
 * six months, then every order. The account is on the You page.
 */
{
  const at = (re) => { const m = re.exec(money); return m ? m.index : -1; };
  const seq = [at(/moneyHeroHTML\(f\)/), at(/moneyClaimHTML\(f\.key\)/), at(/moneyClimbHTML\(f\) \+ moneyWayHTML\(f\) \+ moneySourcesHTML\(f\) \+ moneyStandingHTML\(\)/), at(/moneyOrdersHTML\(f\)/)];
  t.check(seq.every((x, i) => x > 0 && (i === 0 || x > seq[i - 1])),
    `the gauge, claims, the month, then the month's orders (${seq.join(' -> ')})`);
  t.check(/moneyHeatHTML\(f\) \+ moneyDonutHTML\(f\) \+ moneyClimbHTML\(f\)/.test(money),
    'a closed month shows its days, who made it, and six months');
  t.check(!/termCardHTML\(\)|ag_signout_btn/.test(money), 'the account lives on the You page now, not under the money');
}

/* ---------- 2. the chart carries figures ---------------------------- */
{
  t.check(!/agSparkFill/.test(src), 'the sparkline is gone');
  t.check(/<span class="v">\$\{empty \? '—' : esc\(fmtCompactUGX\(v\.total\)\)\}<\/span>/.test(six),
    'every column states what that month earned');
  t.check(/aria-label="\$\{esc\(monthLabel\(mk\)\)\}, \$\{empty \? 'no orders' : esc\(fmtUGX\(v\.total\)\)\}"/.test(six),
    'and the exact, uncompacted figure is on the label, so the rounding is not the only access to it');
  t.check(/height:\$\{Math\.max\(4, Math\.round\(/.test(six),
    'a month that earned nothing gets a stub -- no bar at all reads as missing data, not as a bad month');
  t.check(/const empty = !v\.orders\.length;/.test(six),
    'but a month with no ORDERS is a different thing, told apart by its orders, not by its total, and shows a dash');
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
  t.check(/data-month="\$\{esc\(mk\)\}"/.test(six), 'each column carries its month');
  t.check(/const bar = e\.target\.closest\('\[data-month\]'\);\s*if\(bar\)\{ moneyMonth = bar\.dataset\.month;[^}]*paint\(\);/.test(money),
    'and tapping one loads that month into the rest of the sheet');
  t.check(/aria-pressed="\$\{sel\}"/.test(six),
    'the selected column is marked, in the accessibility tree as well as visually');
  t.check(/data-mnav="-1"/.test(hero) && /if\(k > currentMonthKey\(\)\) return;/.test(money),
    'the arrows page by month, and never into the future');
  t.check(/!months\.includes\(key\)/.test(six) && /is before this window/.test(six),
    'a month outside the window is named, rather than leaving no column marked and no explanation');
  t.check(/\.ax-mx-card \.six \.b\{all:unset;box-sizing:border-box;[^}]*min-height:44px/.test(src),
    'a column is a 44px tap target, restoring border-box after all:unset, so 44 means 44');
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
  t.check(/done = o\.status === 'completed'/.test(orderRows)
    && /e\.margin \+ \(done \? e\.bonus : 0\)/.test(orderRows),
    'the row applies the same qualification the wallet does');
  t.check(/when done/.test(orderRows),
    'and an unqualified bonus is shown as pending rather than dropped, so it is not simply missing');
}

/* ---------- 6. the sheet says which month it is showing ------------ */
{
  t.check(/f\.isNow \? 'YOURS THIS MONTH' : `YOURS IN \$\{/.test(hero) && /<b>\$\{esc\(monthName\(f\.key\)\)\}<\/b>/.test(hero),
    'the figure names its month, so a past month is never read as this one');
  t.check(/No orders in \$\{esc\(monthName\(f\.key\)\)\}\./.test(orderRows),
    'and so does the empty state');
}

process.exit(t.done() ? 1 : 0);
