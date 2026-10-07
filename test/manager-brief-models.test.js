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
 *     k of n, nothing else;
 *   - a miss needs a whole window: advice done too recently, or advised
 *     again before its time was up, is waiting or not measurable;
 *   - a box whose readings failed says so, never its all-clear.
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
  ...['mgrBriefKind', 'mgrBriefKey', 'mgrBriefSubjectOf', 'mgrBriefSignals', 'mgrBriefPlanAdds', 'mgrBriefUpside', 'mgrBriefOver60', 'mgrBriefCashToFree',
    'mgrBriefForesightPick', 'mgrBriefUnread',
    'mgrBriefHitRate', 'mgrBriefLinkedChains', 'mgrBriefReadingChains', 'mgrBriefChainDepts', 'mgrBriefDecisionList', 'mgrBriefMindTrigger',
    'mgrBriefForesight', 'mgrBriefOrderBy', 'mgrBriefPatterns', 'mgrBriefBlindSpots', 'mgrBriefAskChips', 'mgrBriefDay', 'mgrBriefLastYear', 'mgrBriefOwn',
    'mgrShortUGX', 'mgrPipsFromRate', 'chaseRate', 'anShiftDate', 'waWeekday', 'managerPips', 'mgrPossessive', 'mgrDept'].map(fn),
  ...['MGR_BRIEF_KINDS', 'MGR_BRIEF_ALERT', 'MGR_BRIEF_UNUSUAL_DEPT', 'MGR_BRIEF_FS_ORDER', 'MGR_BRIEF_MONTHS', 'MGR_DEPTS', 'MGR_KIND_DEPT',
    'TRACK_WINDOWED', 'MGR_WEEKDAYS', 'MGR_BRIEF_BLIND_ORDER', 'MGR_BRIEF_NEEDS'].map(decl),
], {
  todayISO: () => TODAY, CHASE_WINDOW: 7,
  daysBetweenISO: (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000),
  fmtShortDate: (d) => {
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Number(d.slice(8, 10)) + ' ' + m[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4); },
  Date, Math, Number, String, Map, Set, Array, Object, JSON,
}, ['mgrBriefKind', 'mgrBriefSignals', 'mgrBriefPlanAdds', 'mgrBriefUpside', 'mgrBriefOver60', 'mgrBriefCashToFree', 'mgrBriefForesightPick', 'mgrBriefUnread',
  'mgrBriefHitRate', 'mgrBriefLinkedChains',
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
    { status: 'open', body: { worth: 420000, worthBasis: 'loss_avoided' } },
    { status: 'open', body: { worth: 130000, worthBasis: 'cost_saved' } },
    { status: 'open', body: { worth: 900000, worthBasis: 'sales' } },
    { status: 'open', body: { worth: 50000, worthBasis: null } },
  ];
  /* cash 15,233,850 (the skipped 4,307,680 is not in it); profit
     1,085,664 + 193,521 = 1,279,185 -- profit over 30 days only; a loss
     avoided (420,000) and a cost saved (130,000) are each their own kind,
     as the worth bases and the share ring keep them; sales 900,000; the
     basis-less 50,000 belongs to no kind. */
  eq(S.mgrBriefPlanAdds(rows), { cash: 15233850, profit: 1279185, loss: 420000, saving: 130000, sales: 900000, moves: 6 },
    'each kind summed apart, moves set aside left out, money of no kind not counted');
  eq(['cash_freed', 'profit_30d', 'loss_avoided', 'cost_saved', 'sales'].map(S.mgrBriefKind), ['cash', 'profit', 'loss', 'saving', 'sales'],
    'one kind per worth basis: a loss avoided and a cost saved are never folded into profit over 30 days');
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
    /* Each debt carries the part of it that is over 60 days old
       (mgrBriefOver60): Kato owes 30,467,700, of which only 16,468,050
       is older than 60 days; Lubega's is all old; Nalubega's none. */
    debts: [{ id: 'C3', name: 'Lubega', debt: 18887050, ageDays: 130, over60: 18887050 },
      { id: 'C1', name: 'Kato', debt: 30467700, ageDays: 88, over60: 16468050 },
      { id: 'C4', name: 'Nalubega', debt: 26619229, ageDays: 16, over60: 0 }],
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
  /* Kato 16,468,050 (the part owed past 60 days, larger than the
     move's 15.2m -- never his whole 30.47m balance); Lubega 18,887,050;
     Nalubega 11,000,000 from the move (none of her debt is past 60 days,
     so only the move names it); the tiles 6,000,000 from the move (above
     their 5,388,606 on the shelf); the sheets 3,313,558.
     16,468,050 + 18,887,050 + 11,000,000 + 6,000,000 + 3,313,558
     = 55,668,658. */
  t.check(f.total === 55668658, 'one figure per customer or line, debts by their part over 60 days: 55,668,658 (got ' + f.total + ')');
  eq(f.byKind, { debt: 35355100, dead: 3313558, move: 17000000 }, 'its parts by where they come from');
  /* Expected if chased, by the chase record alone: Kato min(16,468,050,
     1,800,000) = 1,800,000; Nalubega min(11,000,000, 11,204,587) =
     11,000,000. */
  t.check(f.expected.amount === 12800000 && f.expected.list.map((x) => x.k + '/' + x.n).join() === '3/4,3/3',
    'and only the part a chase record supports is given a horizon, with its k of n');
}

/* ---------- 5. the hit rate (A2.6, Q13) ----------------------------------- */
{
  /* As deriveMoveOutcome answers: true or false for every chase, restock
     and payment it can read -- never null for a fresh one -- and null
     only when the customer is no longer on file. */
  const derive = (row, until) => ({
    'Chase Kato': { happened: true }, 'Restock nails': { happened: false }, 'Pay Steel': { happened: false },
    'Chase Ssali': { happened: false }, 'Chase Achieng': { happened: false }, 'Chase Gone': { happened: null },
    'Restock cement': { happened: false },
  }[row.body.title] || { happened: false, until });
  const rows = [
    { date: '2026-09-01', status: 'done', body: { title: 'Chase Kato', mkind: 'chase', doneOn: '2026-09-02', subject: { customerId: 'C1' } } },
    { date: '2026-09-10', status: 'open', body: { title: 'Chase Kato', mkind: 'chase', subject: { customerId: 'C1' } } },
    { date: '2026-09-05', status: 'done', body: { title: 'Restock nails', mkind: 'buy', doneOn: '2026-09-05', subject: { key: 'P019' } } },
    { date: '2026-09-05', status: 'done', body: { title: 'Price Y12', mkind: 'price', doneOn: '2026-09-05', subject: { key: 'P025' } } },
    { date: '2026-09-06', status: 'done', body: { title: 'Chase Okot', mkind: 'chase', subject: { customerId: 'C2' } } },
    { date: '2026-10-06', status: 'done', body: { title: 'Pay Steel', mkind: 'settle', doneOn: '2026-10-06', subject: { supplierId: 'S3' } } },
    { date: '2026-09-07', status: 'done', body: { title: 'Tidy the store', mkind: 'other' } },
    { date: '2026-09-08', status: 'skipped', body: { title: 'Chase Kato', mkind: 'chase', subject: { customerId: 'C1' } } },
    { date: '2026-09-11', status: 'done', body: { title: 'Chase Ssali', mkind: 'chase', doneOn: '2026-09-11', subject: { customerId: 'C5' } } },
    { date: '2026-09-12', status: 'open', body: { title: 'Chase Ssali', mkind: 'chase', subject: { customerId: 'C5' } } },
    { date: '2026-09-01', status: 'done', body: { title: 'Chase Achieng', mkind: 'chase', doneOn: '2026-09-01', subject: { customerId: 'C6' } } },
    { date: '2026-09-20', status: 'open', body: { title: 'Chase Achieng', mkind: 'chase', subject: { customerId: 'C6' } } },
    { date: '2026-09-01', status: 'done', body: { title: 'Chase Gone', mkind: 'chase', doneOn: '2026-09-01', subject: { customerId: 'C9' } } },
    { date: '2026-10-01', status: 'done', body: { title: 'Restock cement', mkind: 'buy', doneOn: '2026-10-01', subject: { key: 'P001' } } },
  ];
  /* The time each is given: a chase or a payment 7 days; a restock its
     supplier's lead and two days -- nails 1 + 2 = 3, cement 10 + 2 = 12.
       Kato, done 2 Sept, weighed [3 Sept, 8 Sept): followed -- a hit.
       Nails, done 5 Sept, never advised again: [6 Sept, 7 Oct) is 31
         days, past its 3 -- nothing followed, a miss ("in the 31 days
         after").
       Achieng, done 1 Sept, advised again 20 Sept: [2 Sept, 20 Sept) is
         18 days, past its 7 -- a miss ("before it was advised again").
       Ssali, done 11 Sept, advised again 12 Sept: [12 Sept, 12 Sept) is
         0 days -- cut short, not measurable, never a miss.
       Steel, done yesterday: [7 Oct, 7 Oct) is 0 of its 7 -- waiting.
       Cement, done 1 Oct: [2 Oct, 7 Oct) is 5 of its 12 -- waiting.
       Y12 (a price), Okot (no day it was done), the store (named nobody)
         and Gone (no longer on file): not measurable.
     k 1 of n 3; not measurable 4 + 1 cut short = 5; waiting 2. */
  const windowOf = (kind, body) => kind === 'buy' ? ({ P019: 1, P001: 10 }[body.subject.key] + 2) : 7;
  const h = S.mgrBriefHitRate(rows, derive, { today: TODAY, windowOf });
  eq([h.k, h.n, h.notMeasurable, h.cutShort, h.waiting], [1, 3, 5, 1, 2], 'k of n over what the books can weigh, the rest named apart');
  eq(h.misses.map((m) => [m.title, m.days, m.again]), [['Restock nails', 31, false], ['Chase Achieng', 18, true]],
    'only a whole window can miss, and each miss says how long it had and whether the advice came round again');
  /* Without windowOf a restock is given a week, as a chase is. */
  const h2 = S.mgrBriefHitRate(rows.slice(13), derive, { today: TODAY });
  eq([h2.n, h2.waiting], [0, 1], 'a restock done 5 days ago is waiting, not a miss');
  /* The Kato occasion of 1 Sept closes at the next one, 8 Sept. */
  const seen = [];
  S.mgrBriefHitRate(rows.slice(0, 2).concat(rows[7]), (row, until) => { seen.push([row.date, until]); return { happened: true }; }, { today: TODAY });
  eq(seen, [['2026-09-03', '2026-09-08']], 'a done move is weighed from the day after it was done until the advice came round again');
}

/* ---------- 6. chains linked in the books (A4, Q3) ----------------------- */
{
  const chains = S.mgrBriefLinkedChains({
    collect: { over: 7, overTotal: 7150000, leftOfBudget: 0, budgetBefore: 3148424, onOrder: 3148424, spend: 0,
      owedToYou: 136669398, debtors: 17, overKeys: ['P001', 'P030'],
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
  /* What is left to buy with is the buy plan's budget: 3,148,424 after
     every dated payment, less 3,148,424 on orders already out = 0 --
     said as that, never as "what you can spend after every dated
     payment", which is the strip's 3.15m. */
  t.check(a.nodes[1].text === 'Left to buy with, after every dated payment and the orders already out' && a.nodes[1].figure === '0 left of 3.15m',
    'the buy plan\'s budget is named as what is left to buy with, beside what it was cut from (got ' + a.nodes[1].text + ' / ' + a.nodes[1].figure + ')');
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
  /* The same quantity the chain draws: 3,148,424 after every dated
     payment, less 3,148,424 on orders already out = 0 left to buy with,
     under the line's 4,212,750. */
  const buy = S.mgrBriefMindTrigger({ mkind: 'buy' }, { ...f, buy: { cost: 4212750, left: 0, before: 3148424, onOrder: 3148424 } });
  t.check(buy.fired && /left to buy with falls below the line’s 4\.21m/.test(buy.text)
    && buy.firedText === 'It has: 0 is left to buy with — 3.15m after every dated payment, less 3.15m on orders already out.',
    'a buy: what is left to buy with has fallen below the line\'s cost, in the chain\'s own words (got ' + buy.firedText + ')');
  t.check(!S.mgrBriefMindTrigger({ mkind: 'buy' }, { ...f, buy: { cost: 400000, left: 900000, before: 900000, onOrder: 0 } }).fired,
    'and with 900k left for a 400k line, it has not');
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
    receipts: [{ date: '2026-10-10', label: 'Kato Construction Ltd — after a chase', amount: 1800000, source: 'paid within 3 days of a chase in 3 of 4 · chased 2026-10-06' },
      { date: '2026-11-30', label: 'Wasswa Roofing Contractors — after a chase', amount: 1, source: 'outside the window' }],
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
  t.check(/chased 6 Oct 2026$/.test(items[3].tag) && !/\d{4}-\d{2}-\d{2}/.test(items.map((x) => x.tag).join(' ')),
    'and its dates are said as every date on the Brief is, never a raw ISO date (got ' + items[3].tag + ')');
  t.check(items[7].text === 'Centenary’s 10m offer expires' && /22% over 12 months/.test(items[7].tag), 'an offer\'s expiry, from the owner\'s own record');
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
  t.check(p[3].pips === S.mgrPipsFromRate(5, 7) && p[3].ev === 'my advice, done: 2 of 7 times', 'a pattern is as sure as the count that agrees with it');
  t.check(p[0].ev === 'your chase record: 9 of 10 chases', 'and each names what it was counted from -- the chase record, or the Manager\'s own advice');
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
  /* A fixed order that carries no money -- the canvas's (rival prices,
     who the buyers are, the shelf), then the rest -- because each gap's
     money is a different quantity: 11.69m of profit, 70m of stock at
     cost, 70.19m of bills owed. Ranking them by it would rank one kind of
     money against another. */
  eq(b.map((x) => x.id), ['rival', 'customer', 'counts', 'beyond', 'terms', 'daily'], 'in the canvas\'s order, never by their money');
  const swapped = S.mgrBriefBlindSpots({ rivalNever: { count: 1, top: 'x', earned: 1 }, terms: { unknownOwing: 1, owed: 9e9 },
    counts: { lines: 10, counted: 1, value: 5e9 } });
  eq(swapped.map((x) => x.id), ['rival', 'counts', 'terms'], 'and the order does not move when the money does');
  t.check(b.find((x) => x.id === 'counts').money === 70000000 && b.find((x) => x.id === 'counts').moneyWord === 'of stock at cost not counted in 90 days'
    && b.find((x) => x.id === 'terms').moneyWord === 'of bills owed to them' && b.find((x) => x.id === 'rival').moneyWord === 'of last month’s profit on them',
    'each gap\'s money is drawn in its own words, as what the gap covers');
  t.check(b.find((x) => x.id === 'beyond').title === '1 line sold more than the book held', 'said as sold beyond the book, never as negative stock (Q11)');
  /* 1 - 1,816 / 4,122 = 0.5594 -> 56%. */
  t.check(/cover only 56% of invoices/.test(b.find((x) => x.id === 'customer').cost), 'each with what it costs the advice');
  t.check(b.every((x) => x.door), 'and each opens the screen that closes it -- never sending anything');
  t.check(S.mgrBriefBlindSpots({ counts: { lines: 10, counted: 9 } }).length === 0, 'a shop counted nine lines in ten has no count gap');
}

/* ---------- 14. the ask card's questions (A1.4) ----------------------------- */
{
  eq(S.mgrBriefAskChips({ cashTight: true, profitUp: true, offer: { name: 'Centenary', amount: 10000000 }, first: 'Kato Construction', margin: 9.1, aim: 12 }),
    ['Why is cash tight if profit is up?', 'What happens if I take Centenary’s 10m?', 'Why is Kato Construction first?'],
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
  /* Books from 25 Sep 2025: a year back (377 days), but the usual is the
     four weeks from 10 Sep 2025, half of them before the books began --
     a usual read from 13 of its 28 days would invent a lift. */
  t.check(S.mgrBriefLastYear(TODAY, '2025-09-25', salesIn).length === 0, 'nor on books that start inside the four weeks the usual is read from');
  t.check(S.mgrBriefLastYear(TODAY, '2025-09-10', salesIn).length === 1, 'and the first day of those four weeks is enough');
}

/* ---------- 16. the part of a balance over 60 days (A2.4) ------------------ */
{
  /* As the Debtors aging buckets it, charge by charge, today 7 Oct 2026:
       1 Jul, 100 still due -- 98 days old: in.
       7 Aug, 30 still due -- 61 days old: in.
       8 Aug, 50 still due -- 60 days old: not over 60.
       1 Jun, 0.2 still due -- under half a shilling: settled.
       20 Sep, 999 -- 17 days old: not in.
     100 + 30 = 130. */
  eq(S.mgrBriefOver60([{ date: '2026-07-01', remaining: 100 }, { date: '2026-08-07', remaining: 30 }, { date: '2026-08-08', remaining: 50 },
    { date: '2026-06-01', remaining: 0.2 }, { date: '2026-09-20', remaining: 999 }, { date: null, remaining: 5 }], TODAY), 130,
    'only the charges themselves older than 60 days, never the whole balance');
}

/* ---------- 17. what the next 30 days shows first (A6.*) -------------------- */
{
  const items = S.mgrBriefForesight({ today: TODAY,
    events: [
      { date: '2026-10-07', kind: 'bill', label: 'Steel — bill', amount: -5670120, line: 'committed', overdue: true, dueOn: '2026-08-24' },
      { date: '2026-10-07', kind: 'rent', label: 'Shop', amount: -1000000, line: 'committed', overdue: true, dueOn: '2026-10-01' },
      { date: '2026-10-12', kind: 'bill', label: 'A — bill', amount: -200000, line: 'committed' },
      { date: '2026-10-14', kind: 'bill', label: 'B — bill', amount: -300000, line: 'committed' },
      { date: '2026-10-15', kind: 'bill', label: 'C — bill', amount: -100000, line: 'committed' },
      { date: '2026-10-27', kind: 'bill', label: 'D — bill', amount: -400000, line: 'committed' },
      { date: '2026-10-28', kind: 'wage', label: 'Joan', amount: -400000, line: 'committed' },
      { date: '2026-10-28', kind: 'wage', label: 'Moses', amount: -275000, line: 'committed' }],
    tightest: { date: '2026-11-05', balance: 3148424 }, floor: { amount: 3000000, source: 'set' },
    supplierRisks: [{ label: 'Steel stops delivering', date: '2026-10-23', amount: 5670120 }],
    offers: [{ name: 'Centenary', from: 'bank', amount: 10000000, expiresOn: '2026-10-18' }],
    receipts: [{ date: '2026-10-09', label: 'A — after a chase', amount: 1, source: 's' }, { date: '2026-10-10', label: 'B — after a chase', amount: 1, source: 's' },
      { date: '2026-10-11', label: 'C — after a chase', amount: 1, source: 's' }],
  });
  /* Cap 6, chosen by kind: the lowest day (5 Nov) first, then the risks --
     the two payments past their day folded into one row on today, and
     Steel's deadline -- then the offer, then the first two expected
     receipts. The folded bills of 12-15 Oct, the 27 Oct bill and the
     wages do not fit. Put back in date order. */
  const six = S.mgrBriefForesightPick(items, 6, TODAY);
  eq(six.map((x) => x.date + ' ' + x.kind), ['2026-10-07 risk', '2026-10-09 expected', '2026-10-10 expected', '2026-10-18 deadline',
    '2026-10-23 risk', '2026-11-05 known'], 'the default view is chosen by kind and spans the month, the lowest day always in it');
  /* 5,670,120 + 1,000,000 = 6,670,000 -> 6.67m. */
  t.check(six[0].text === 'Past their day · 2 payments · 6.67m out' && six[0].fold === 2 && six[0].day === 7 && six[0].dow === 'Wed',
    'payments past their day fold into one row on today (got ' + six[0].text + ')');
  /* Cap 12: everything chosen fits; the three bills of the week of 12 Oct
     (200k + 300k + 100k = 600k) are one row on their first day; the 27
     Oct bill stays its own; the third expected receipt still waits. */
  const all = S.mgrBriefForesightPick(items, 12, TODAY);
  t.check(all.length === 9 && all.some((x) => x.text === 'Bills · 3 on the days you named this week · 600k out' && x.date === '2026-10-12')
    && all.some((x) => x.date === '2026-10-27' && x.text === 'Bill · D · 400k out') && !all.some((x) => x.date === '2026-10-11'),
    'routine bills fold into a row a week, and only the first two expected receipts show before "Show all"');
}

/* ---------- 18. a box whose readings failed says so ------------------------- */
{
  eq(S.mgrBriefUnread(['the cash ahead', 'supplier of P001', 'supplier of P002', 'posts'], ['the cash ahead', 'risks', 'supplier of ']),
    ['the cash ahead', 'who supplies each line'], 'the readings a box is drawn from that failed, each named once');
  eq(S.mgrBriefUnread([], ['the cash ahead']), [], 'and none when nothing failed');
}

process.exit(t.done() ? 1 : 0);
