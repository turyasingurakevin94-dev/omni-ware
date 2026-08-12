#!/usr/bin/env node
'use strict';
/*
 * What needs you today.
 *
 * The dashboard answered "how is the business doing?" across eight panels
 * and three and a bit screens, and never answered "so what do I do about
 * it?". Everything actionable sat in one panel in the SECOND row, in
 * source order -- the order the checks happened to be written -- with no
 * sort and no cap.
 *
 * Measured on a shop with a quarter of real trading behind it:
 *
 *   crit  Supplier cost rising     a cost trend, months old
 *   warn  Debtor exposure          84 days old
 *   warn  Debtor exposure          67 days old
 *   warn  Debtor exposure          45 days old
 *   info  Stock-out risk           CEMENT. 1.9 DAYS OF COVER.
 *   warn  Demand concentration     a structural fact
 *
 * The one thing that would cost money that week -- the shop's biggest
 * seller running out on Friday -- was ranked FIFTH and labelled "info",
 * the lowest tier there is, under three near-identical cards about money
 * that had been outstanding for months and would still be outstanding
 * tomorrow. The severity was inverted: an 84-day debt is chronic, a
 * two-day stock-out is acute.
 *
 * And the biggest fact in that dataset was on no screen at all. The old
 * dashboard flagged "Cement costs 34% more than it did" -- the INPUT --
 * and never joined it to the selling price, so it never noticed that the
 * cost had passed the shelf price and every bag was going out at a loss:
 * -5.7% margin, 187,659 over the window, about 1,955 a bag.
 *
 * Run: node test/dashboard-alerts.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('dashboard alerts');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const NAMES = ['dashAlerts', 'dashBandFor', 'agingDaysLabel'];
let scope = null; let err = null;
try {
  scope = compileScope([
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
    extractDeclaration(src, 'DASH_URGENT_DAYS', 'index.html'),
    extractDeclaration(src, 'DASH_SOON_DAYS', 'index.html'),
    extractDeclaration(src, 'DASH_BANDS', 'index.html'),
    extractDeclaration(src, 'DASH_BAND_RANK', 'index.html'),
    // compileScope exports functions only, so a constant needs a wrapper.
    'function readBands(){ return DASH_BANDS; }',
  ], {
    fmtUGX: (n) => `${Math.round(n).toLocaleString('en-US')} UGX`,
    fmtShortDate: (s) => String(s),
    esc: (s) => String(s),
  }, [...NAMES, 'readBands']);
} catch (e) { err = e; }
t.check(!!scope, `the alert engine compiles${err ? ` (${err.message})` : ''}`);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const render = (/function renderDashboard\(\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const engine = (/function dashAlerts\(ctx\)\{[\s\S]*?\n\}\n/.exec(code) || [''])[0];
const dashSection = (/<section id="tab-dashboard"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];

// A shop with nothing wrong; each test adds only the thing it is about.
const CTX = (over) => Object.assign({
  itemRows: [], totals: { sales: 0, cost: 0 }, opex: 0, grossProfit: 0, netProfit: 0,
  cashBalance: 1000000, burn: 0, runwayMonths: null,
  inv: { deadValue: 0, deadQty: 0, ratio: 100 },
  debtors: [], goingQuiet: [], concentration: [], stockOut: [], inflation: [],
}, over || {});
const ids = (list) => list.map((a) => a.id);
const byId = (list, id) => list.find((a) => a.id === id);

/* ---------- 1. the inversion, as a fixture --------------------------- *
 * This is the whole piece in one assertion.
 */
if (scope) {
  const list = scope.dashAlerts(CTX({
    stockOut: [{ key: 'P001', productId: 'P001', variantIdx: null, dailyRate: 3.2, name: 'Cement', qty: 9, daysLeft: 1.9 }],
    debtors: [{ name: 'Mukisa Hardware', debt: 15556600, ageDays: 84 }],
    inflation: [{ name: 'Cement', supplierName: 'Kirinya', first: 28000, last: 37520, growth: 34, since: '2026-05-13' }],
    concentration: [{ name: 'Barbed Wire', concentration: 60, topBuyerName: 'Kato' }],
    goingQuiet: [{ name: 'Peter', avgGapDays: 14, sinceLastDays: 40 }],
  }));
  eq(list[0].id, 'stockout:P001',
    'the thing with a deadline this week outranks 15,556,600 of debt that has waited three months');
  eq(list[0].band, 'now', 'and is filed as needing somebody today');
  /* Money alone would put the debt first, which is exactly what the old
     ordering did by accident of source order. */
  t.check(list[0].money < byId(list, 'debt:all').money,
    'even though the debt is by far the larger number');
  t.check(ids(list).indexOf('debt:all') < ids(list).indexOf('cost-rise:0'),
    'and within the undated ones, the bigger money comes first');

  /* SOURCE ORDER, ruled out. Stock-outs happen to be pushed first, so a
     fixture whose most urgent thing is also its first-pushed thing
     passes whether the list is sorted or not -- which is how the old
     screen looked fine right up until the day it did not.

     Here the first thing pushed is a stock-out five weeks out and the
     urgent one is a line selling below cost, pushed later. */
  const shuffled = scope.dashAlerts(CTX({
    stockOut: [{ key: 'P009', productId: 'P009', variantIdx: null, dailyRate: 0.2, name: 'Hinges', qty: 7, daysLeft: 35 }],
    itemRows: [{ key: 'P001::', name: 'Cement', qty: 96, sales: 3264000, cost: 3451659, profit: -187659, margin: -5.7 }],
  }));
  eq(shuffled[0].id, 'loss:P001::',
    'and the ranking really is a ranking, not the order the checks happen to be written in');
  eq(shuffled[1].id, 'stockout:P009', 'with the far-off one behind it');
}

/* ---------- 2. no deadline is not a deadline of zero ----------------- */
if (scope) {
  eq(scope.dashBandFor(null), 'chronic', 'an alert with no deadline is undated, not due today');
  eq(scope.dashBandFor(0), 'now', 'while zero days really is today');
  eq(scope.dashBandFor(7), 'now', 'the urgent band includes its last day');
  eq(scope.dashBandFor(8), 'soon', 'and the next one starts after it');
  eq(scope.dashBandFor(30), 'soon', 'the month band includes its last day too');
  /* A countdown 90 days out is still a countdown. Lumped in with the
     undated ones, a cash runway read as a puddle. */
  eq(scope.dashBandFor(90), 'later', 'a deadline further out is still a deadline, not a leak');
  const bands = scope.readBands();
  t.check(bands.later && bands.chronic && bands.later.label !== bands.chronic.label,
    'and the two are labelled differently, since they call for different things');
}

/* ---------- 3. sold for less than it cost ---------------------------- *
 * The old dashboard flagged the supplier's price climbing and never
 * joined it to the selling price.
 */
if (scope) {
  const list = scope.dashAlerts(CTX({
    itemRows: [
      { key: 'P001::', name: 'Cement', qty: 96, sales: 3264000, cost: 3451659, profit: -187659, margin: -5.7 },
      { key: 'P002::', name: 'Iron Sheets', qty: 40, sales: 2080000, cost: 1680000, profit: 400000, margin: 19.2 },
    ],
  }));
  const loss = byId(list, 'loss:P001::');
  t.check(!!loss, 'an item selling below cost is raised at all, which it never was');
  eq(loss.dueDays, 0, 'as something happening today, because it bites on every sale made today');
  eq(loss.money, 187659, 'carrying what it has already cost');
  t.check(/about 1,955 UGX on every one/.test(loss.detail),
    'and said per unit, which is the number somebody can act on');
  t.check(!byId(list, 'loss:P002::'), 'while a profitable line is not flagged');
  eq(list[0].id, 'loss:P001::', 'and it leads, because nothing else here has a deadline');
}

/* ---------- 4. which half of the business moved ---------------------- *
 * "-3.0% margin" describes the symptom. Whether the goods or the
 * overheads are the problem is the thing to say, and they are different
 * problems with different answers.
 */
if (scope) {
  const overheads = scope.dashAlerts(CTX({
    totals: { sales: 22743500, cost: 19388708 }, grossProfit: 3354792, opex: 4026853, netProfit: -672061,
  }));
  t.check(!!byId(overheads, 'costs:overheads'), 'a shop whose goods make money but whose overheads eat it is told so');
  t.check(!byId(overheads, 'costs:gross'), 'and not told its pricing is wrong');
  t.check(/Trading is fine; the overheads are the problem/.test(byId(overheads, 'costs:overheads').detail),
    'in those terms');

  const gross = scope.dashAlerts(CTX({
    totals: { sales: 1000000, cost: 1200000 }, grossProfit: -200000, opex: 50000, netProfit: -250000,
  }));
  t.check(!!byId(gross, 'costs:gross'), 'while a shop losing money on the goods themselves is told THAT');
  t.check(!byId(gross, 'costs:overheads'), 'and not sent to look at its expenses');
  t.check(/This is pricing, not overheads/.test(byId(gross, 'costs:gross').detail), 'named as a different problem');

  const fine = scope.dashAlerts(CTX({ totals: { sales: 100, cost: 50 }, grossProfit: 50, netProfit: 20 }));
  t.check(!byId(fine, 'costs:overheads') && !byId(fine, 'costs:gross'),
    'and a shop making money is told neither');
}

/* ---------- 5. an overdrawn cash book has no runway ------------------ *
 * Dividing a negative balance by burn printed "-0.4 months of runway",
 * which reads as a small number rather than as money already gone.
 */
if (scope) {
  const over = scope.dashAlerts(CTX({ cashBalance: -5000000, burn: 13900000, runwayMonths: -0.36 }));
  t.check(!!byId(over, 'cash:overdrawn'), 'an overdrawn cash book is said plainly');
  t.check(!byId(over, 'cash:runway'), 'rather than as a negative number of months left');
  eq(byId(over, 'cash:overdrawn').dueDays, 0, 'and it is today’s problem, not a countdown');
  t.check(/the money has already gone/.test(byId(over, 'cash:overdrawn').detail), 'in those words');

  const short = scope.dashAlerts(CTX({ cashBalance: 40780700, burn: 13817647, runwayMonths: 2.95 }));
  const rw = byId(short, 'cash:runway');
  t.check(!!rw, 'a short runway is raised while there IS runway');
  eq(rw.band, 'later', 'as a countdown, even at three months out');
  /* Money is what is AT STAKE. Carrying the balance made a healthy
     40,780,700 the biggest number in the list and sorted a comfortable
     runway above everything that was actually bleeding. */
  eq(rw.money, 0, 'and the cash still in hand is not counted as money at risk');

  t.check(!byId(scope.dashAlerts(CTX({ cashBalance: 9e9, burn: 1, runwayMonths: 500 })), 'cash:runway'),
    'while a shop with years of cover is not warned at all');
}

/* ---------- 6. one debt row, not one per debtor ---------------------- *
 * Three cards reading "X owes Y, outstanding Z days" are a list, not
 * three alarms, and they crowded out everything else by sheer number.
 */
if (scope) {
  const list = scope.dashAlerts(CTX({
    debtors: [
      { name: 'Mukisa Hardware', debt: 4025600, ageDays: 84 },
      { name: 'Sarah Namono', debt: 9843500, ageDays: 67 },
      { name: 'Nabweru Builders', debt: 2991800, ageDays: 91 },
    ],
  }));
  eq(list.filter((a) => a.kind === 'debt').length, 1, 'every debtor is one alert between them');
  eq(list.filter((a) => a.kind === 'debt')[0].id, 'debt:all', 'under one id, not one per name');
  const d = byId(list, 'debt:all');
  eq(d.money, 16860900, 'totalling what is out there');
  /* The BIGGEST debt here is Sarah's, the OLDEST is Nabweru's. Picked by
     size the card names the wrong customer, and a fixture where one
     customer is both cannot tell the difference. */
  t.check(/oldest is Nabweru Builders at 91 days/.test(d.detail),
    'and naming the worst of them by age, not by size');
  eq(d.dueDays, null, 'with no deadline, because old debt does not fall due on a date');

  /* An undated balance cannot name a worst age. Reporting one would be
     inventing it. */
  const undated = scope.dashAlerts(CTX({ debtors: [{ name: 'Somebody', debt: 500000, ageDays: -1 }] }));
  t.check(/none of it with a date behind it/.test(byId(undated, 'debt:all').detail),
    'while debt nothing dates says so rather than claiming an age');
}

/* ---------- 7. the join that priced every stock-out at zero ---------- *
 * stockKey gives "P001" for a product with no variant; anRowsByItem
 * gives "P001::". Joining on the wrong one matched nothing, silently,
 * and every stock-out came out priced at zero looking perfectly well
 * formed.
 */
if (scope) {
  const row = { key: 'P001::', name: 'Cement', qty: 96, sales: 3264000, cost: 2000000, profit: 1264000, margin: 38 };
  const list = scope.dashAlerts(CTX({
    itemRows: [row],
    stockOut: [{ key: 'P001', productId: 'P001', variantIdx: null, dailyRate: 3.2, name: 'Cement', qty: 9, daysLeft: 2.8 }],
  }));
  eq(byId(list, 'stockout:P001').money, 1264000,
    'a stock-out is priced at what the item actually earns, joined on the key anRowsByItem builds');
  t.check(/earned 1,264,000 UGX of profit this period/.test(byId(list, 'stockout:P001').detail),
    'and says so');
  t.check(/const rowKey = s\.productId \+ '::' \+ \(s\.variantIdx == null \? '' : s\.variantIdx\);/.test(engine),
    'built that way rather than from stockKey, which disagrees for a product with no variant');

  // A variant must not collect the plain product's figures, or the other
  // way round.
  const v = scope.dashAlerts(CTX({
    itemRows: [{ key: 'P001::1', name: 'Cement 25kg', qty: 5, sales: 100, cost: 10, profit: 90, margin: 90 }],
    stockOut: [{ key: 'P001', productId: 'P001', variantIdx: null, dailyRate: 1, name: 'Cement', qty: 2, daysLeft: 2 }],
  }));
  eq(byId(v, 'stockout:P001').money, 0, 'and a variant’s earnings are not credited to the plain product');
}

/* ---------- 8. one list, shown ONCE ----------------------------------- */
/*
 * This used to be titled "one list, shown twice", and that was the whole
 * problem. "What needs you today" drew alerts.slice(0, 5); "Everything
 * flagged", a panel and most of a screen below it, drew the SAME array
 * through the SAME card function. The top five appeared twice, verbatim.
 * Its own note admitted it -- "the same list in full, in the same order --
 * the top of it is what needs you today" -- which is a caption explaining
 * why a reader should ignore half of what they are looking at.
 *
 * Reported as: the two "seem to be duplicative". They were identical.
 *
 * One list now, five deep, the rest one press away through the same
 * paging every long page in this app uses.
 */
{
  t.check(/const alerts = dashAlerts\(\{/.test(render), 'the alerts are built once');
  t.check(/dash_actionList'\)\.innerHTML = alerts\.length/.test(render),
    'and drawn in one place');
  t.check(!/dash_threatList/.test(code),
    'the second panel that re-drew the same array is gone, not merely hidden');
  t.check(!/Everything flagged/.test(code.replace(/<!--[\s\S]*?-->/g, '')),
    'and so is its heading');
  t.check(!/threatCardHTML/.test(code) && !/class="threat-card/.test(code),
    'along with the card kind that existed only to show one list a second way');

  /* A list of twenty is a list nobody reads. The point of ranking them was
     that the top is where somebody starts -- so the cap stays, and what it
     hides is now reachable in place rather than duplicated below. */
  t.check(/listPageSlice\('dashAlerts', alerts\)\.map\(alertCardHTML\)/.test(render),
    'the top block is still capped, through the shared paging');
  t.check(/listMoreButtonHTML\('dashAlerts', alerts\.length, 'flags'\)/.test(render),
    'and says how many there are in total rather than how many it is hiding');
  t.check(/dashAlerts: 5\b/.test(code),
    'five, because this is a to-do list on the first screen, not a grid to browse');
  t.check(/dashAlerts: \(\)=> renderDashboard\(\)/.test(code),
    'and the control is wired, so pressing it does something');

  // The detached-agent check had the removed panel as its only home.
  t.check(/checkDetachedAgentOrders\(\(t\)=> alertCardHTML\(\{/.test(render),
    'the one flag that lived in that panel joins the ranked list instead of being lost with it');
  t.check(/const list = document\.getElementById\('dash_actionList'\);/.test(code),
    'appending to the list that still exists');
  t.check(/band: 'now'/.test(render),
    "and carrying a band, because money an agent cannot see is not a thing to get to eventually");

  t.check(!/threats\.push\(/.test(code),
    'and the old unsorted, uncapped threat list is gone rather than left running beside it');

  // Above the vitals: the figures are how the shop IS, this is what to do.
  t.check(dashSection.indexOf('id="dash_actionList"') < dashSection.indexOf('id="dash_vitalGrid"'),
    'the answer comes before the four figures, not in the second row');
}

/* ---------- 9. the vital cards say what they mean --------------------- */
{
  /* The old debt card showed the debtors-minus-creditors GAP and called
     any positive gap good -- so 15,556,600 of the shop's money sitting in
     other people's pockets rendered in the same green as a profit. What
     decides it is how long it has been out. */
  t.check(/tone: !oldestDebt \? 'good' : \(oldestDebt\.ageDays > 60 \? 'bad' : \(oldestDebt\.ageDays > 30 \? 'warn' : 'good'\)\)/.test(render),
    'money owed to you is coloured by how old it is, not by being larger than what you owe');
  t.check(/Oldest is \$\{agingDaysLabel\(oldestDebt\.ageDays\)\}/.test(render), 'and the card says which age');
  t.check(!/Owed to us exceeds what we owe by this much/.test(code),
    'the gap framing, which called that healthy, is gone');

  t.check(/netProfit < 0 && curTotals\.profit > 0/.test(render),
    'a loss says whether it was the goods or the overheads');
  t.check(/Goods made \$\{fmtUGX\(Math\.round\(curTotals\.profit\)\)\}, running the shop cost/.test(render),
    'with both halves named');

  t.check(/cashBalance < 0[\s\S]{0,200}?Overdrawn — this is money already spent, not months remaining/.test(render),
    'an overdrawn balance is not described as months of runway');
  /* Nothing to compare against is not a change of nothing. A shop's
     first period showed "+0.0% vs prior period", which reads as flat. */
  t.check(/nothing to compare it with yet/.test(render),
    'and a first period says there is nothing to compare with rather than reporting no change');
}

process.exit(t.done() ? 1 : 0);
