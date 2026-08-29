#!/usr/bin/env node
'use strict';
/*
 * The longer arc: the month and the quarter.
 *
 * Everything else the Manager judges is a week wide, and a week is too
 * short to see a shop growing or fading — a good Tuesday flatters it, a
 * public holiday damns it. Growth, expansion and the case for stocking
 * a new line are month-and-quarter questions, and the mind had no way
 * to ask one.
 *
 * Two rules make the answer honest, and both are guarded here:
 *
 *   LIKE FOR LIKE  a part-month is compared with the SAME NUMBER OF
 *       DAYS of the month before, never with a whole one. Eleven days
 *       against thirty is the arithmetic that makes every month look
 *       like a collapse until its last week — the same lesson the
 *       statements screen learned when it refused to call eleven days
 *       "the month".
 *   FAR ENOUGH BACK  the books say how many months they actually cover,
 *       and a comparison they cannot support is refused rather than
 *       dressed up. The thin-week rule from the review, over a longer
 *       span.
 *
 * Run: node test/manager-arc.test.js   (or: npm test)
 */
const { read, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the longer arc');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* Today is the 11th of August, so eleven days of this month are in. */
const TODAY = '2026-08-11';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* One invoice a day, worth 10,000 with 4,000 of profit, every day from
   the start of May — so every period's figures are its day count times
   those, and a wrong window shows up as a wrong multiple. */
const daily = { sales: 10000, cost: 6000 };
const invoicesIn = (from, to) => {
  const out = [];
  for (let d = from > '2026-05-01' ? from : '2026-05-01'; d <= to && d <= TODAY; d = shift(d, 1)) out.push({ date: d });
  return out;
};

const env = {
  data: { savedQuotes: [{ voided: false, invoiced: true, invoicedAt: '2026-05-01', date: '2026-05-01' }],
    cashTxns: [], customers: [] },
  todayISO: () => TODAY, anShiftDate: shift,
  apRound: (n) => Math.round(Number(n) || 0),
  anInvoicesInRange: invoicesIn,
  anOverallTotals: (inv) => ({ sales: inv.length * daily.sales, profit: inv.length * (daily.sales - daily.cost),
    count: inv.length, estimatedQty: 0 }),
  debtCollectionsOn: () => ({ total: 1000 }),
  cashOpexTotal: (rows) => rows.length * 500,
  dashCashTxnsInRange: (from, to) => invoicesIn(from, to),
  anRowsByItem: (inv) => (inv.length ? [
    { name: 'Runners Masasi', variant: '12 inch', sales: inv.length * 100, cost: inv.length * 40 },
    { name: 'Black Screws', variant: '', sales: inv.length * 50, cost: inv.length * 49 },
  ] : []),
  anRowsByCustomer: (inv) => (inv.length ? [{ name: 'Mulongo', sales: inv.length * 80, cost: inv.length * 30 }] : []),
  Date, JSON, Math, Number, String, Array, Object, Map, Set,
};
const scope = compileScope([
  extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
  'function names(){ return { ASSISTANT_TOOLS }; }',
], env, ['names']);
const T = scope.names().ASSISTANT_TOOLS;

t.check(T.month_and_quarter && T.month_and_quarter.confirm === false,
  'the longer arc reads and nothing more');
const out = T.month_and_quarter.run();

/* ---------- 1. like for like, or not at all -------------------------- */
{
  eq(out.month.so_far.from, '2026-08-01', 'this month starts on the first');
  eq(out.month.so_far.to, TODAY, 'and runs to today');
  eq(out.month.so_far.days, 11, 'eleven days in');
  eq(out.month.so_far.sales, 110000, 'with eleven days of sales');

  const like = out.month.same_days_last_month;
  eq(like.from, '2026-07-01', 'the comparison starts on the first of last month');
  eq(like.to, '2026-07-11', 'and stops at the SAME DAY — not the end of it');
  eq(like.days, 11, 'eleven days against eleven');
  eq(like.sales, 110000,
    'so the two are the same size: a part-month against a whole one is the arithmetic that makes every month look like a collapse');

  eq(out.month.last_full.from, '2026-07-01', 'the last full month is July');
  eq(out.month.last_full.to, '2026-07-31', 'to its last day');
  eq(out.month.last_full.days, 31, 'all thirty-one days of it');
  eq(out.month.the_month_before.from, '2026-06-01', 'and the one before is June');
  eq(out.month.the_month_before.days, 30, 'thirty days');
}

/* ---------- 2. the quarter is the calendar's, not a rolling 90 ------- */
{
  eq(out.quarter.so_far.from, '2026-07-01', 'this quarter starts in July — the calendar quarter the statements screen uses');
  eq(out.quarter.so_far.days, 42, 'forty-two days of it are in');
  eq(out.quarter.last_full.from, '2026-04-01', 'the last full quarter is April to June');
  eq(out.quarter.last_full.to, '2026-06-30', 'ending on the last day of June');
  const likeQ = out.quarter.same_days_last_quarter;
  eq(likeQ.from, '2026-04-01', 'the like-for-like starts at the head of that quarter');
  eq(likeQ.days, 42, 'and runs the same forty-two days');
}

/* ---------- 3. each period carries what a manager argues from -------- */
{
  const p = out.month.last_full;
  eq(p.gross_profit, 31 * 4000, 'gross profit for the period');
  eq(p.margin_pct, 40, 'the margin as a percentage, so a trend can be argued at all');
  eq(p.invoices, 31, 'how many invoices');
  eq(p.collected, 31 * 1000, 'what was actually collected across it');
  eq(p.running_costs, 31 * 500, 'the running costs');
  eq(p.net_after_costs, 31 * 4000 - 31 * 500, 'and what was left after them');
}

/* ---------- 4. what is climbing and what is fading ------------------- */
{
  /* July has 31 days against June's 30, so every line earned more —
     the point is that the tool names them and shows the change. */
  t.check(out.items_climbing.length > 0, 'items that earned more are named');
  const runner = out.items_climbing.find((r) => /Runners Masasi/.test(r.name));
  t.check(!!runner && runner.name === 'Runners Masasi — 12 inch',
    'by their full variant name, as every other screen names them');
  eq(runner.change, runner.earned_now - runner.earned_before,
    'with the change stated, not left to be worked out');
  t.check(out.customers_climbing.some((r) => r.name === 'Mulongo'),
    'and customers too — growth is who buys as much as what sells');
  eq(out.movers_compare.later, '2026-07-01 to 2026-07-31',
    'the two months being compared are named, so nobody has to guess the window');
  eq(out.movers_compare.earlier, '2026-06-01 to 2026-06-30', 'both of them');
  t.check(out.items_climbing.length <= 5 && out.items_fading.length <= 5, 'each list is capped');
}

/* ---------- 5. a comparison the books cannot support is refused ------ */
{
  eq(out.books_start, '2026-05-01', 'the tool says where the records actually begin');
  eq(out.months_on_file, 3, 'and how many months they cover');
  t.check(out.too_early_for_quarters && /not supported/.test(out.too_early_for_quarters),
    'three months is not two quarters — the quarter claim is refused in words, not left to be inferred');
  t.check(!out.too_early_for_months, 'while two whole months IS enough to compare months');

  const young = compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], { ...env, data: { ...env.data,
    savedQuotes: [{ voided: false, invoiced: true, invoicedAt: '2026-08-02', date: '2026-08-02' }] } }, ['names'])
    .names().ASSISTANT_TOOLS.month_and_quarter.run();
  eq(young.months_on_file, 0, 'a shop nine days old has no months on file');
  t.check(/say so instead of comparing them/.test(young.too_early_for_months || ''),
    'and is told to say so instead of comparing two months it does not have');

  const empty = compileScope([
    extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
    'function names(){ return { ASSISTANT_TOOLS }; }',
  ], { ...env, data: { ...env.data, savedQuotes: [] } }, ['names'])
    .names().ASSISTANT_TOOLS.month_and_quarter.run();
  eq(empty.books_start, null, 'with no invoiced sale at all the books have no start');
  eq(empty.months_on_file, 0, 'and no months — nothing here divides by a date that is not there');
}

/* ---------- 6. the mind is taught when and how to use it ------------- */
{
  const ext = api.slice(api.indexOf('const MANAGER_EXTENSION'), api.indexOf('].join', api.indexOf('const MANAGER_EXTENSION')));
  t.check(/THE LONGER ARC\./.test(ext), 'the longer arc is taught');
  t.check(/Call month_and_quarter when the objective is growth/.test(ext),
    'called when the objective is growth, where the horizon matters');
  t.check(/compare LIKE FOR LIKE/.test(ext) && /never against a whole month/.test(ext),
    'and compared like for like, in as many words');
  t.check(/one month\\u2019s move is a SIGNAL and two in the same direction is a TREND/.test(ext),
    'one month is a signal, two a trend — said so the mind cannot call a single month a direction');
  t.check(/refuse the comparison rather than dressing up noise as a direction/.test(ext),
    'and a comparison the books cannot support is refused');
  t.check(/a line that earned more two months running is a line to stock deeper/.test(ext),
    'with the trend turned into a move, not left as an observation');
  t.check(/name: 'month_and_quarter'/.test(api), 'and the tool is offered to the model');
  t.check(api.indexOf("name: 'month_and_quarter'") < api.indexOf("name: 'add_sourcing_lead'"),
    'inside the cached prefix — add_sourcing_lead still closes it');
}

process.exit(t.done() ? 1 : 0);
