#!/usr/bin/env node
'use strict';
/*
 * The Brief's own readings (A1.2-A9), each a pure function of what the
 * books and the journal hold, run on small hand-made books with the
 * arithmetic written beside each expectation.
 *
 * The laws they keep:
 *   - one figure per thing: a line or a customer named by two readings is
 *     counted once, the larger of the two;
 *   - three kinds of money never added to each other, never ranked
 *     against each other (Q5);
 *   - a hit is an event that FOLLOWED, k of n, and what cannot be weighed
 *     is "not measurable", never a miss (Q13);
 *   - chains are joins the books make, or the meeting's reading, said as
 *     which -- never a cause stated as fact (Q3);
 *   - a horizon only where a method supports it (Q4): the chase record's
 *     k of n, nothing else.
 *
 * Today is Wednesday 7 October 2026.
 *
 * Run: node test/manager-brief-models.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager brief models');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';

const S = compileScope([
  ...['mgrBriefKind', 'mgrBriefKey', 'mgrBriefSubjectOf', 'mgrBriefSignals', 'mgrBriefPlanAdds', 'mgrBriefUpside', 'mgrBriefCashToFree',
    'mgrBriefHitRate', 'mgrBriefLinkedChains', 'mgrBriefReadingChains', 'mgrBriefChainDepts', 'mgrBriefDecisionList', 'mgrBriefMindTrigger',
    'mgrBriefForesight', 'mgrBriefOrderBy', 'mgrBriefPatterns', 'mgrBriefBlindSpots', 'mgrBriefAskChips', 'mgrBriefDay', 'mgrBriefLastYear',
    'mgrShortUGX', 'mgrPipsFromRate', 'chaseRate', 'anShiftDate', 'waWeekday', 'managerPips', 'mgrPossessive', 'mgrDept'].map(fn),
  ...['MGR_BRIEF_KINDS', 'MGR_BRIEF_ALERT', 'MGR_BRIEF_UNUSUAL_DEPT', 'MGR_BRIEF_FS_ORDER', 'MGR_BRIEF_MONTHS', 'MGR_DEPTS', 'MGR_KIND_DEPT',
    'TRACK_WINDOWED', 'MGR_WEEKDAYS'].map(decl),
], {
  todayISO: () => TODAY, CHASE_WINDOW: 7,
  daysBetweenISO: (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000),
  fmtShortDate: (d) => {
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Number(d.slice(8, 10)) + ' ' + m[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4); },
  Date, Math, Number, String, Map, Set, Array, Object, JSON,
}, ['mgrBriefSignals', 'mgrBriefPlanAdds', 'mgrBriefUpside', 'mgrBriefCashToFree', 'mgrBriefHitRate', 'mgrBriefLinkedChains',
  'mgrBriefReadingChains', 'mgrBriefChainDepts', 'mgrBriefDecisionList', 'mgrBriefMindTrigger', 'mgrBriefForesight', 'mgrBriefOrderBy',
  'mgrBriefPatterns', 'mgrBriefBlindSpots', 'mgrBriefAskChips', 'mgrBriefDay', 'mgrBriefLastYear', 'mgrPipsFromRate', 'mgrShortUGX']);

/* ---------- 1. the signals the band counts (A1.2) ----------------------- */
{
  const s = S.mgrBriefSignals({
    alerts: [{ id: 'stockout:P001', kind: 'stockout' }, { id: 'loss:P002::', kind: 'loss' }, { id: 'cash:promised', kind: 'cash' },
      { id: 'cash:runway', kind: 'cash' }, { id: 'debt:all', kind: 'debt' }, { id: 'weird:1', kind: 'new' }],
    runningOut: [{ key: 'P001' }],
    unusual: [{ date: '2026-10-03', metric: 'sales' }, { date: '2026-10-02', metric: 'cash_out' }],
    answered: ['2026-10-03|sales'],
    notLanding: [{ key: 'chase|C9' }, { key: 'buy|P002' }],
    missedBills: [{ supplierId: 'S3' }, { supplierId: 'S3' }],
    brokeWord: [{ customerId: 'C9' }],
  });
  /* Subjects: k:P001 (the alert and the shelf), k:P002 (the loss and the
     buy advice), cash (two cash alerts are one position), debts, a:weird:1,
     the unanswered 2 Oct cash-out day, c:C9 (advice not landing and a
     broken promise), s:S3 (two bills, one supplier) = 8. The answered
     3 Oct day is not a signal. */
  t.check(s.count === 8, 'counted once per thing they are about: 8 (got ' + s.count + ')');
  eq([s.byDept.finance, s.byDept.store, s.byDept.sales, s.byDept.procurement, s.byDept.people], [4, 1, 1, 1, 0],
    'finance: cash, debts, the cash-out day, C9; store P001; sales P002; procurement S3');
  t.check(s.depts === 4, 'across four departments; an alert of a kind with no department is counted but filed under none');
  const c9 = s.list.find((x) => x.subject === 'c:C9');
  t.check(c9 && c9.from.length === 2, 'and a thing flagged twice says by what');
}

/* ---------- 2. what the plan adds, by kind (A1.2) ------------------------ */
{
  const rows = [
    { status: 'open', body: { worth: 15233850, worthBasis: 'cash_freed' } },
    { status: 'open', body: { worth: 1085664, worthBasis: 'profit_30d' } },
    { status: 'done', body: { worth: 193521, worthBasis: 'profit_30d' } },
    { status: 'skipped', body: { worth: 4307680, worthBasis: 'cash_freed' } },
    { status: 'open', body: { worth: 0, worthBasis: 'loss_avoided' } },
    { status: 'open', body: { worth: 900000, worthBasis: 'sales' } },
    { status: 'open', body: { worth: 50000, worthBasis: null } },
  ];
  /* cash 15,233,850 (the skipped 4,307,680 is not in it); profit
     1,085,664 + 193,521 = 1,279,185; sales 900,000; the basis-less 50,000
     belongs to no kind. */
  eq(S.mgrBriefPlanAdds(rows), { cash: 15233850, profit: 1279185, sales: 900000, moves: 4 },
    'each kind summed apart, moves set aside left out, money of no kind not counted');
}

/* ---------- 3. profit upside found (A2.3) -------------------------------- */
{
  const u = S.mgrBriefUpside({
    marginLines: [{ key: 'P001', line: 'Simba', atStake: 1375490 }, { key: 'P025', line: 'Y12', atStake: 613056 }],
    moves: [
      { id: 1, status: 'open', body: { title: 'Order Simba', worthBasis: 'profit_30d', worth: 1085664, subject: { key: 'P001' } } },
      { id: 2, status: 'done', body: { title: 'Price Y12', worthBasis: 'profit_30d', worth: 193521, subject: { key: 'P025::' } } },
      { id: 3, status: 'open', body: { title: 'Ssali', worthBasis: 'profit_30d', worth: 300000, subject: { customerId: 'C5' } } },
      { id: 4, status: 'skipped', body: { title: 'x', worthBasis: 'profit_30d', worth: 1000000, subject: { key: 'P099' } } },
      { id: 5, status: 'open', body: { title: 'Kato', worthBasis: 'cash_freed', worth: 15233850, subject: { customerId: 'C1' } } },
    ],
    plays: [{ name: 'Bundle nails', amount: 250000 }],
  });
  /* P001: margin 1,375,490 beats the move's 1,085,664; P025: 613,056
     beats 193,521 ("P025::" is the same line); C5 300,000 a move; the
     skipped and the cash moves are not profit found.
     1,375,490 + 613,056 + 300,000 = 2,288,546. */
  t.check(u.total === 2288546 && u.lines === 2 && u.moves === 1, 'one figure per line, the larger of the two readings: 2,288,546 (got ' + u.total + ')');
  t.check(u.plays.total === 250000 && u.total === 2288546, 'and a play\'s own sizing is kept apart, never added in');
  const u2 = S.mgrBriefUpside({ marginLines: [{ key: 'P025', atStake: 613056 }],
    moves: [{ id: 2, status: 'open', body: { worthBasis: 'profit_30d', worth: 700000, subject: { key: 'P025' } } }] });
  t.check(u2.total === 700000 && u2.parts[0].from === 'move', 'when the move is the larger, the move is the figure');
}

/* ---------- 4. cash to free (A2.4, Q4) ------------------------------------ */
{
  const f = S.mgrBriefCashToFree({
    debts: [{ id: 'C3', name: 'Lubega', debt: 18887050, ageDays: 130 }, { id: 'C1', name: 'Kato', debt: 30467700, ageDays: 88 },
      { id: 'C4', name: 'Nalubega', debt: 26619229, ageDays: 16 }],
    dead: [{ key: 'P009', line: 'Beige tiles', value: 5388606 }, { key: 'P022', line: 'Translucent sheets', value: 3313558 }],
    moves: [
      { id: 1, status: 'open', body: { title: 'Chase Kato', worthBasis: 'cash_freed', worth: 15233850, subject: { customerId: 'C1' } } },
      { id: 2, status: 'open', body: { title: 'Chase Nalubega', worthBasis: 'cash_freed', worth: 11000000, subject: { customerId: 'C4' } } },
      { id: 3, status: 'open', body: { title: 'Clear the tiles', worthBasis: 'cash_freed', worth: 6000000, subject: { key: 'P009' } } },
      { id: 4, status: 'skipped', body: { title: 'x', worthBasis: 'cash_freed', worth: 9e9, subject: { key: 'P050' } } },
    ],
    lags: [{ customerId: 'C1', k: 3, n: 4, lagDays: 3, typicalAmount: 1800000 },
      { customerId: 'C4', k: 3, n: 3, lagDays: 6, typicalAmount: 11204587 }],
  });
  /* Kato 30,467,700 (owed past 60 days, larger than the move's 15.2m);
     Lubega 18,887,050; Nalubega 11,000,000 from the move (her debt is 16
     days old, so only the move names it); the tiles 6,000,000 from the
     move (above their 5,388,606 on the shelf); the sheets 3,313,558.
     Total 69,668,308. */
  t.check(f.total === 69668308, 'one figure per customer or line: 69,668,308 (got ' + f.total + ')');
  eq(f.byKind, { debt: 49354750, dead: 3313558, move: 17000000 }, 'its parts by where they come from');
  /* Within 60 days, by the chase record alone: Kato min(30,467,700,
     1,800,000) = 1,800,000; Nalubega min(11,000,000, 11,204,587) =
     11,000,000. */
  t.check(f.expected.amount === 12800000 && f.expected.list.map((x) => x.k + '/' + x.n).join() === '3/4,3/3',
    'and only the part a chase record supports is given a horizon, with its k of n');
}

/* ---------- 5. the hit rate (A2.6, Q13) ----------------------------------- */
{
  const derive = (row, until) => ({
    'Chase Kato': { happened: true }, 'Restock nails': { happened: false }, 'Pay Steel': { happened: null },
  }[row.body.title] || { happened: null, until });
  const rows = [
    { date: '2026-09-01', status: 'done', body: { title: 'Chase Kato', mkind: 'chase', doneOn: '2026-09-02', subject: { customerId: 'C1' } } },
    { date: '2026-09-10', status: 'open', body: { title: 'Chase Kato', mkind: 'chase', subject: { customerId: 'C1' } } },
    { date: '2026-09-05', status: 'done', body: { title: 'Restock nails', mkind: 'buy', doneOn: '2026-09-05', subject: { key: 'P019' } } },
    { date: '2026-09-05', status: 'done', body: { title: 'Price Y12', mkind: 'price', doneOn: '2026-09-05', subject: { key: 'P025' } } },
    { date: '2026-09-06', status: 'done', body: { title: 'Chase Okot', mkind: 'chase', subject: { customerId: 'C2' } } },
    { date: '2026-10-06', status: 'done', body: { title: 'Pay Steel', mkind: 'settle', doneOn: '2026-10-06', subject: { supplierId: 'S3' } } },
    { date: '2026-09-07', status: 'done', body: { title: 'Tidy the store', mkind: 'other' } },
    { date: '2026-09-08', status: 'skipped', body: { title: 'Chase Kato', mkind: 'chase', subject: { customerId: 'C1' } } },
  ];
  /* Kato, done 2 Sept: weighed from 3 Sept until the next time it was
     advised -- followed (1 of 1). Nails: nothing followed (1 of 2, a miss).
     Y12 (a price), Okot (no day it was done) and the store (named nobody):
     not measurable, 3. Steel: done yesterday, nothing to weigh yet. */
  const h = S.mgrBriefHitRate(rows, derive);
  eq([h.k, h.n, h.notMeasurable, h.waiting], [1, 2, 3, 1], 'k of n over what the books can weigh, the rest named apart');
  t.check(h.misses.length === 1 && h.misses[0].title === 'Restock nails', 'the miss is named');
  /* The Kato occasion of 1 Sept closes at the next one, 8 Sept. */
  const seen = [];
  S.mgrBriefHitRate(rows.slice(0, 2).concat(rows[7]), (row, until) => { seen.push([row.date, until]); return { happened: true }; });
  eq(seen, [['2026-09-03', '2026-09-08']], 'a done move is weighed from the day after it was done until the advice came round again');
}

/* ---------- 6. chains linked in the books (A4, Q3) ----------------------- */
{
  const chains = S.mgrBriefLinkedChains({
    collect: { over: 7, overTotal: 7150000, leftOfBudget: 0, owedToYou: 136669398, debtors: 17, overKeys: ['P001', 'P030'],
      candidates: [{ customerId: 'C001', name: 'Kato', debt: 30467700, lines: 7, spend: 7150000 }] },
    runningOut: [{ key: 'P030', name: 'Binding wire', days: 0.4 }, { key: 'P001', name: 'Simba', days: 4 }, { key: 'P009', name: 'Tiles', days: 2 }],
    walk: { tightest: { date: '2026-10-14', balance: 1350000 }, days: [
      { date: '2026-10-07', events: [{ line: 'committed', kind: 'bill', amount: -5670120 }, { line: 'expected', kind: 'chase', amount: 1800000 }] },
      { date: '2026-10-13', events: [{ line: 'committed', kind: 'wage', amount: -2100000 }, { line: 'committed', kind: 'rent', amount: -2500000 }] },
      { date: '2026-10-14', events: [{ line: 'committed', kind: 'wage', amount: -275000 }] },
      { date: '2026-10-20', events: [{ line: 'committed', kind: 'loan', amount: -1833599 }] } ] },
    floor: { amount: 2000000, source: 'set' },
    supplierRisks: [{ supplierId: 'S003', name: 'Steel & Tube', label: 'Steel & Tube stops delivering — a bill reaches 90 days', date: '2026-10-23', amount: 5670120 }],
    stockRisks: [{ key: 'P029', name: 'Hoop iron', date: '2026-10-13', supplierId: 'S003' }, { key: 'P001', name: 'Simba', date: '2026-10-10', supplierId: 'S001' }],
  });
  eq(chains.map((c) => c.id), ['b:collect', 'b:lowest', 'b:supplier:S003'], 'three joins, each labelled as the books\'');
  t.check(chains.every((c) => c.source === 'books'), 'every one of them from the books');
  const [a, b, c] = chains;
  /* Binding wire (0.4 days) and Simba (4) are among the 7 lines that do
     not fit and run out inside 10 days; the tiles are not on the plan. */
  t.check(a.nodes.length === 3 && a.nodes[2].text === '2 of them run out inside 10 days' && a.nodes[2].figure === 'Binding wire · 0d',
    'owed and buying: the lines that do not fit, what can be spent, and those of them running out');
  t.check(a.fix.subject === 'c:C001' && /would buy 7 of the 7 lines, if it were in the drawer today/.test(a.fix.text),
    'and the collection that would buy them, said as an if-then on the drawer, never a promise');
  /* Until Wed 14 Oct: the bill 5,670,120, wages 2,100,000 + 275,000 =
     2,375,000 (two payments), rent 2,500,000; the expected receipt and
     the 20 Oct loan are not in it. 4 payments, 10,545,120 out. */
  t.check(b.root.text === '4 dated payments leave before Wed 14 Oct' && b.root.figure === S.mgrShortUGX(10545120) + ' out',
    'the lowest day: every committed payment before it, counted (got ' + b.root.text + ' / ' + b.root.figure + ')');
  eq(b.nodes.map((n) => n.text), ['Bills you named a day for', 'Rent', 'Wages — 2 payments',
    'The lowest the committed line goes, under your 2m floor'], 'by department, largest first, ending on the day itself against the floor');
  t.check(b.nodes[3].figure === '1.35m · Wed 14 Oct' && /arithmetic on the committed line, not a forecast/.test(b.fix.text),
    'and its fix is arithmetic on the committed line, said so');
  t.check(c.nodes.length === 1 && c.nodes[0].text === 'Hoop iron runs out — Steel & Tube supplies it',
    'terms and shelf: only the lines that supplier supplies');
  t.check(!JSON.stringify(chains).match(/root cause|caused|because of|thanks to/i), 'and nothing in them says one thing caused another');
  const none = S.mgrBriefLinkedChains({ collect: null, walk: { tightest: { date: TODAY, balance: 5 }, days: [{ date: TODAY, events: [] }] } });
  t.check(none.length === 0, 'a shop with nothing to join has no chains, rather than invented ones');
}

/* ---------- 7. the meeting's own chains: "My reading" ---------------------- */
{
  const r = S.mgrBriefReadingChains({ chains: [
    { title: 'Credit without terms', dept: 'sales', confidence: 3, fix: { title: '14-day terms', move: 1 },
      links: [{ dept: 'sales', text: '38% of sales go out on credit', figure: '26.0m a month', tool: 'shop_pulse' },
        { dept: 'finance', text: 'Customers hold your money 38 days', figure: '11.6m owed', tool: 'list_debtors' },
        { text: 'No department said', figure: '1 of 2', tool: 'chase_response' }] },
    { title: 'Too short', links: [{ text: 'one', figure: '1', tool: 'x' }] }] });
  t.check(r.length === 1 && r[0].source === 'reading' && r[0].confidence === 3, 'a chain the meeting read, with its own judged confidence');
  t.check(r[0].root.text === '38% of sales go out on credit' && r[0].root.tool === 'shop_pulse' && r[0].nodes.length === 2,
    'its first link is the card it starts from, each citing its figure and its tool');
  t.check(r[0].fix.move === 1 && S.mgrBriefChainDepts(r[0]) === 2, 'its fix points at a decision by position; it runs through two departments');
}

/* ---------- 8. the decisions shown (A5.*, Q5) ----------------------------- */
{
  const rows = [
    { n: 1, dept: 'finance', touches: ['sales'], kind: 'cash', worth: 15 },
    { n: 2, dept: 'finance', touches: ['procurement'], kind: 'profit', worth: 0 },
    { n: 3, dept: 'procurement', touches: ['finance', 'store'], kind: 'profit', worth: 109 },
    { n: 4, dept: 'sales', touches: ['store'], kind: 'profit', worth: 19 },
    { n: 5, dept: 'store', touches: ['sales'], kind: 'cash', worth: 43 },
  ];
  const ns = (x) => x.map((r) => r.n);
  eq(ns(S.mgrBriefDecisionList(rows, 'order', 'all').shown), [1, 2, 3, 4, 5], 'the meeting\'s own order');
  eq(ns(S.mgrBriefDecisionList(rows, 'order', 'store').shown), [3, 4, 5], 'a department: its own moves and those that move it, still in order');
  const p = S.mgrBriefDecisionList(rows, 'profit', 'all');
  eq([ns(p.shown), ns(p.rest)], [[3, 4], [1, 2, 5]], 'by profit: profit moves by their profit; cash and no-money moves kept apart, in order');
  const c = S.mgrBriefDecisionList(rows, 'cash', 'sales');
  eq([ns(c.shown), ns(c.rest)], [[5, 1], [4]], 'by cash inside a department: never cash against profit');
}

/* ---------- 9. what would change my mind (A5.7) --------------------------- */
{
  const f = { today: TODAY };
  const chase = S.mgrBriefMindTrigger({ mkind: 'chase' }, { ...f, chase: { doneOn: '2026-09-28', happened: false } });
  t.check(chase.fired && /nothing came in the 7 days after the chase on 28 Sep 2026/.test(chase.firedText),
    'a chase done 9 days ago with nothing paid: the trigger has fired, and says so');
  t.check(!S.mgrBriefMindTrigger({ mkind: 'chase' }, { ...f, chase: { doneOn: '2026-10-03', happened: false } }).fired,
    'four days after, it has not fired yet');
  const buy = S.mgrBriefMindTrigger({ mkind: 'buy' }, { ...f, buy: { cost: 4212750, safe: 3148424 } });
  t.check(buy.fired && /4\.21m/.test(buy.text) && /3\.15m/.test(buy.firedText), 'a buy: what can be spent has fallen below the line\'s cost');
  const price = S.mgrBriefMindTrigger({ mkind: 'price' }, { ...f, price: { ours: 46500, rival: { rival: 'Kasubi', price: 45000, daysOld: 3 } } });
  t.check(price.fired && price.firedText === 'It has: Kasubi at 45,000, seen 3 days ago.', 'a price: a rival seen below it');
  t.check(S.mgrBriefMindTrigger({ mkind: 'settle' }, { ...f, settle: { datedOn: '2026-10-10' } }).fired, 'a payment: a day named for the bill');
  t.check(S.mgrBriefMindTrigger({ mkind: 'other' }, f) === null, 'and a kind the books cannot watch has none, rather than an invented one');
}

/* ---------- 10. the next 30 days (A6.*) ------------------------------------ */
{
  const items = S.mgrBriefForesight({ today: TODAY,
    events: [
      { date: '2026-10-07', kind: 'bill', label: 'Steel & Tube Industries — bill', amount: -5670120, line: 'committed', overdue: true, dueOn: '2026-08-24' },
      { date: '2026-10-28', kind: 'wage', label: 'Joan', amount: -400000, line: 'committed' },
      { date: '2026-10-28', kind: 'wage', label: 'Moses', amount: -275000, line: 'committed' },
      { date: '2026-11-20', kind: 'rent', label: 'Shop', amount: -2500000, line: 'committed' },
      { date: '2026-10-10', kind: 'chase', label: 'x', amount: 1800000, line: 'expected' }],
    tightest: { date: '2026-11-05', balance: 3148424 }, floor: { amount: 3000000, source: 'set' },
    orderBy: [{ name: 'Roofing nails', by: '2026-10-08', outOn: '2026-10-10', measured: true, lead: 1, supplier: 'Kasubi' },
      { name: 'Binding wire', by: '2026-10-03', outOn: '2026-10-07', measured: true, lead: 3, supplier: 'Steel & Tube' },
      { name: 'Hoop iron', outOn: '2026-10-13', measured: false, supplier: '' }],
    supplierRisks: [{ label: 'Steel & Tube stops delivering — a bill reaches 90 days', date: '2026-10-23', amount: 5670120 }],
    offers: [{ name: 'Centenary', from: 'bank', amount: 10000000, rate: 22, termMonths: 12, expiresOn: '2026-10-18' }],
    targets: [{ to: '2026-10-11', label: 'Collect', aimText: '6m', nowText: '5.7m', dept: 'finance' }],
    receipts: [{ date: '2026-10-10', label: 'Kato Construction Ltd — after a chase', amount: 1800000, source: 'paid within 3 days of a chase in 3 of 4' }],
    lastYear: [{ date: '2026-10-14', dept: 'sales', text: 'Last year these weeks: Roofing sold 31% above its usual', tag: 'last year’s fact' }],
  });
  eq(items.map((x) => x.date + ' ' + x.kind), [
    '2026-10-07 risk', '2026-10-07 risk', '2026-10-08 deadline', '2026-10-10 expected', '2026-10-11 deadline',
    '2026-10-13 deadline', '2026-10-14 known', '2026-10-18 deadline', '2026-10-23 risk', '2026-10-28 known', '2026-11-05 known'],
  'every dated thing in 30 days, by day; the 20 Nov rent is outside, and the expected band\'s own events are not doubled');
  t.check(items[0].text === 'Bill · Steel & Tube Industries · 5.67m out' && /past its day — due 24 Aug 2026/.test(items[0].tag),
    'a bill past its day is a risk on today, saying when it was due');
  t.check(items[1].text === 'Already inside the lead time for Binding wire' && items[2].text === 'Last day to order Roofing nails in time'
    && items[2].tag === 'Kasubi takes 1 day', 'the last day to order, with the lead time it was counted from');
  t.check(items[5].text === 'Hoop iron runs out' && items[5].tag === 'lead not measured', 'and "lead not measured" where it is not');
  t.check(items[3].text === 'Kato Construction Ltd’s 1.8m expected' && /3 of 4/.test(items[3].tag), 'an expected receipt carries its k of n');
  t.check(items[9].text === 'Wages · 2 staff · 675k out' && items[9].dept === 'people', 'two wages on one payday are one line: 400k + 275k');
  t.check(items[10].kind === 'known' && /above your 3m floor/.test(items[10].tag), 'the lowest day, against the floor it was judged by');
  t.check(items[0].day === 7 && items[0].dow === 'Wed' && items[8].dow === 'Fri', 'each with its day number and weekday');
}

/* ---------- 11. the last day to order (A6.5) ------------------------------- */
{
  const supplierOf = (k) => ({ P019: { supplierId: 'S4' }, P030: { supplierId: 'S3' }, P029: { supplierId: 'S9', name: 'X' }, P001: { supplierId: 'S1' } })[k] || null;
  const out = S.mgrBriefOrderBy([
    { key: 'P019', name: 'Roofing nails', daysLeft: 3.1 }, { key: 'P030', name: 'Binding wire', daysLeft: 0 },
    { key: 'P029', name: 'Hoop iron', daysLeft: 6.0 }, { key: 'P001', name: 'Simba', daysLeft: 4.0 }, { key: 'P050', name: 'Far', daysLeft: 45 }],
  [{ supplierId: 'S4', days: 1, typical: true, name: 'Kasubi' }, { supplierId: 'S3', days: 3, typical: true, name: 'Steel & Tube' },
    { supplierId: 'S9', days: 2, typical: false, name: 'X' }], supplierOf, new Set(['P001']), TODAY);
  /* Nails: out floor(3.1) = 3 days on, 10 Oct; ordered by 10 Oct less
     1 day's lead less a day = 8 Oct. Wire: out today, by 7 Oct - 4 = 3 Oct.
     Hoop iron: its supplier has one delivery on record -- not measured.
     Simba is on order; the 45-day line runs out after the 30 days. */
  eq(out.map((o) => [o.key, o.outOn, o.by, o.measured]), [['P019', '2026-10-10', '2026-10-08', true],
    ['P030', '2026-10-07', '2026-10-03', true], ['P029', '2026-10-13', null, false]], 'by = run-out day − lead − 1, never a lead of 0');
}

/* ---------- 12. what it has learned (A8.1) -------------------------------- */
{
  const p = S.mgrBriefPatterns({
    lags: [{ name: 'Kato', k: 3, n: 4, lagDays: 3 }, { name: 'Ssali', k: 9, n: 10, lagDays: 6 }, { name: 'X', k: 1, n: 2, lagDays: 0 }],
    ignores: [{ name: 'Lubega', k: 0, n: 5 }],
    levers: [{ kind: 'chase', name: 'Achieng', completedObserved: 2, completedScored: 7 }],
    repeat: { returned: 3, eligible: 4 },
    posts: { k: 12, n: 20 },
    restock: { weekday: 2, k: 34, n: 120 },
    lessons: [{ text: 'Lubega has not answered five chases; stop advising it as a collection.', date: '2026-10-03' }],
  });
  eq(p.slice(0, 4).map((x) => x.text), ['Ssali pays within 6 days of a chase', 'Kato pays within 3 days of a chase', 'Lubega does not pay after a chase',
    'Chasing Achieng is rarely followed by a payment'], 'the chase records first, by how often they were tried; never "because"');
  /* Ssali 9 of 10: the middle of the Wilson range is (0.9 + 1.96²/20) /
     (1 + 1.96²/10) = 1.09208 / 1.38416 = 0.789, × 5 = 3.9 -> 4 pips.
     Kato 3 of 4: 1.2302 / 1.9604 = 0.628, × 5 = 3.1 -> 3 pips. */
  eq([p[0].pips, p[1].pips], [4, 3], 'how sure, from the k of n behind each');
  /* Achieng: 2 of 7 is "rarely", so its pips count the 5 of 7 that agree. */
  t.check(p[3].pips === S.mgrPipsFromRate(5, 7) && p[3].ev === '2 of 7 times it was done', 'a pattern is as sure as the count that agrees with it');
  t.check(p.length === 6 && p[4].text === 'Most new customers come back within 30 days'
    && p[5].text === 'A WhatsApp post is usually followed by more of that line sold than the week before',
    'six at most: the repeat cohort and the posts follow; the deliveries and the lesson wait');
  const q = S.mgrBriefPatterns({ restock: { weekday: 2, k: 34, n: 120 }, posts: { k: 3, n: 9 },
    lessons: [{ text: 'A lesson', date: '2026-10-03' }] });
  t.check(q.length === 2 && q[0].text === 'Deliveries land most on Tuesdays' && q[1].judged && q[1].pips === null
    && /my reading, from the review of 3 Oct 2026/.test(q[1].ev), 'nine posts are too few to call; a review\'s lesson is its reading, judged, with no counted pips');
}

/* ---------- 13. what it cannot see yet (A9, Q11) ---------------------------- */
{
  const b = S.mgrBriefBlindSpots({
    rivalNever: { count: 98, top: 'PVC pipe', earned: 11690000 },
    noCustomer: { missing: 1816, invoices: 4122 },
    soldBeyond: { lines: 1, units: 11, value: 1091300, top: 'Binding wire 25kg' },
    counts: { lines: 119, counted: 24, last: '2026-10-03', value: 70000000 },
    terms: { unknownOwing: 5, owed: 70190000 },
    dailyWages: { names: ['Okello Denis'] },
    fuel: { none: false },
  });
  eq(b.map((x) => x.id), ['terms', 'counts', 'rival', 'beyond', 'customer', 'daily'], 'the gaps with the most money behind them first');
  t.check(b.find((x) => x.id === 'beyond').title === '1 line sold more than the book held', 'said as sold beyond the book, never as negative stock (Q11)');
  /* 1 - 1,816 / 4,122 = 0.5594 -> 56%. */
  t.check(/cover only 56% of invoices/.test(b.find((x) => x.id === 'customer').cost), 'each with what it costs the advice');
  t.check(b.every((x) => x.door), 'and each opens the screen that closes it -- never sending anything');
  t.check(S.mgrBriefBlindSpots({ counts: { lines: 10, counted: 9 } }).length === 0, 'a shop counted nine lines in ten has no count gap');
}

/* ---------- 14. the ask card's questions (A1.4) ----------------------------- */
{
  eq(S.mgrBriefAskChips({ cashTight: true, profitUp: true, offer: { name: 'Centenary', amount: 10000000 }, first: 'Kato Construction', margin: 9.1, aim: 12 }),
    ['Why is cash tight if profit is up?', 'What happens if I take Centenary\'s 10m?', 'Why is Kato Construction first?'],
    'only questions the books can answer today, three at most');
  eq(S.mgrBriefAskChips({ cashTight: false, first: null, margin: 13, aim: 12 }), [], 'and none when the books give no reason to ask');
}

/* ---------- 15. last year in these weeks (A6.6) ----------------------------- */
{
  /* 364 days before 7 Oct 2026 is Wed 8 Oct 2025. The four weeks before
     it: roofing 4,000,000 (1,000,000 a week), nails 100,000 (under one
     sale in twenty of the 10,000,000 sold -- too small to read). The
     week of 15 Oct 2025: roofing 1,310,000 -> 31% above its usual. */
  const salesIn = (from, to) => from === '2025-09-10' ? new Map([['Roofing', 4000000], ['Nails', 100000], ['Cement', 5900000]])
    : from === '2025-10-15' ? new Map([['Roofing', 1310000], ['Nails', 900000], ['Cement', 1400000]]) : new Map();
  const ly = S.mgrBriefLastYear(TODAY, '2025-08-01', salesIn);
  t.check(ly.length === 1 && ly[0].date === '2026-10-14' && ly[0].text === 'Last year these weeks: Roofing sold 31% above its usual'
    && /last year’s fact/.test(ly[0].tag), 'a category that sold a quarter above its usual this week last year, said as last year\'s fact');
  t.check(S.mgrBriefLastYear(TODAY, '2025-11-01', salesIn).length === 0, 'and nothing on books younger than a year');
}

process.exit(t.done() ? 1 : 0);
