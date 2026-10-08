#!/usr/bin/env node
'use strict';
/*
 * THE SHARED FRAME, AFTER THE FINAL REVIEW.
 *
 * Each block below pins one finding of the final review against the
 * Manager's shared frame -- the helpers every section draws with, the
 * boot probe, the cash line, Today's strip and the meeting's tools --
 * with expectations worked out by hand, not read back from the code.
 *
 *  1. mgrShortUGX lost digits: 100,000,000 read "1m", 130.4m "13m".
 *  2. Any error on the manager_notes probe read as "the table does not
 *     exist", so a 500 sent the owner to paste migration 0081 again.
 *  3. With no floor set and nothing to stand in, the floor was carried
 *     as 0 and printed "0 UGX" -- an unknown read as a figure.
 *  4. The owner's payday moved only the Manager's line; cashAhead (the
 *     buying budget, the meeting's safe_to_spend) kept wages at month end.
 *  5. Today's pace strip ranked by pace.on_course, so an At-risk cash
 *     floor fell off it behind an On-track target; At risk wore crimson.
 *  6. Today's invite said moves were "ranked by the money on them".
 *  7. The header said nothing of when the books were last read.
 *  8. The meeting got the first 8 findings in screen order, dropping an
 *     unanswered problem for an answered one, without the figures.
 *  9. The phone's ask field put a second oxide action on every section.
 *
 * Run: node test/manager-shared-review.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager shared review');
const src = read('index.html');
const api = read('api/assistant.js');
const fn = (name) => extractFunction(src, name, 'index.html');
const decl = (name) => extractDeclaration(src, name, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. money at a glance keeps its digits -------------------- */
{
  const { mgrShortUGX } = compileScope([fn('mgrShortUGX')], {}, ['mgrShortUGX']);
  const cases = [
    [100000000, '100m', 'a hundred million is 100m, not 1m'],
    [130400000, '130m', '130.4m rounds to 130m, not 13m'],
    [200000000, '200m', '200m, not 2m'],
    [120000000, '120m', '120m, not 12m'],
    [136669398, '137m', 'the harness book\'s debtors, 136,669,398, still 137m'],
    [-100000000, '-100m', 'and a negative hundred million keeps its zeros'],
    [999600, '1m', '999,600 rounds to a thousand k, which is 1m'],
    [-999600, '-1m', 'and so does -999,600'],
    [10000000, '10m', 'under 100m the decimals go only after the point: 10.00m reads 10m'],
    [10500000, '10.5m', '10.50m reads 10.5m'],
    [6640000, '6.64m', '6,640,000 reads 6.64m'],
    [940000, '940k', '940,000 reads 940k'],
    [1500, '2k', '1,500 rounds to 2k'],
    [-1500, '-2k', 'and -1,500 to -2k, the same way'],
    [999, '999', 'under a thousand, the shillings'],
    [0, '0', 'nothing is 0'],
  ];
  cases.forEach(([v, want, msg]) => eq(mgrShortUGX(v), want, msg));
}

/* ---------- 2. a failed probe is not a missing table ------------------ */
{
  const { managerNotesMissing } = compileScope([fn('managerNotesMissing')], {}, ['managerNotesMissing']);
  eq(managerNotesMissing({ code: '42P01', message: 'relation "manager_notes" does not exist' }), true, 'Postgres\'s 42P01 is a missing table');
  eq(managerNotesMissing({ code: 'PGRST205', message: 'Could not find the table \'public.manager_notes\' in the schema cache' }), true,
    'PostgREST\'s PGRST205 is a missing table');
  eq(managerNotesMissing({ message: 'relation "public.manager_notes" does not exist' }), true, 'and so are those words with no code');
  eq(managerNotesMissing({ code: 'STUBFAIL', message: 'the journal is down' }), false, 'a 500 is not');
  eq(managerNotesMissing({ code: '57014', message: 'canceling statement due to statement timeout' }), false, 'a timeout is not');
  eq(managerNotesMissing({ code: '42501', message: 'permission denied for table manager_notes' }), false, 'a policy refusal is not');
  eq(managerNotesMissing(null), false, 'no error is not');

  /* The probe's own two lines, run on each answer. */
  const m = /\n  managerNotesTable = [^\n]*\n  managerNotesProbeErr = [^;]*;/.exec(src);
  t.check(!!m, 'loadData sets both flags from the probe');
  const probe = (answer) => {
    const S = compileScope([fn('managerNotesMissing'),
      'function run(managerNotesR){ let managerNotesTable, managerNotesProbeErr;' + (m ? m[0] : '') + ' return [managerNotesTable, managerNotesProbeErr]; }'],
    {}, ['run']);
    return S.run(answer);
  };
  eq(probe({ data: [], error: null }), [true, null], 'the probe answered: the journal is there');
  eq(probe({ data: null, error: { code: 'STUBFAIL', message: 'the journal is down' } }), [true, 'the journal is down'],
    'a 500 on the probe keeps the journal, and keeps why the read failed -- no 0081 banner');
  eq(probe({ data: null, error: { code: '42P01', message: 'relation "manager_notes" does not exist' } }), [false, null],
    'only a missing table means "not set up"');
  t.check(/let managerNotesProbeErr = null;/.test(src), 'the reason is a module flag, empty until a probe fails');
}

/* ---------- 3. an unknown floor is not known, never 0 ----------------- */
{
  const data = { presetManager: {} };
  let cmc = { total: 0, rent: 0, wages: 0, dailyCount: 1, noRateCount: 0 };
  const S = compileScope([fn('mgrCashFloor'), fn('mgrMeetingSettings'), fn('mgrPaydayLabel'), fn('mgrPaydaySettlesLabel'),
    fn('mgrPaydaySettles'), fn('mgrPaydaySettlesDefault'), fn('mgrOrdinal'), decl('MGR_WEEKDAYS')], {
    data, currentPeriod: () => '2026-10', committedMonthlyCost: () => cmc,
  }, ['mgrCashFloor', 'mgrMeetingSettings']);
  const none = S.mgrCashFloor();
  eq([none.amount, none.source], [null, 'stand-in'], 'no floor set and no rent or salary: the floor is null, not 0');
  t.check(/no rent or salary/.test(none.note), 'and says why');
  eq(S.mgrMeetingSettings(none, null).cash_floor.amount, 'not known', 'the meeting is told "not known", never amount 0');
  cmc = { total: 4200000, rent: 2500000, wages: 1700000, dailyCount: 0, noRateCount: 0 };
  eq(S.mgrCashFloor().amount, 4200000, 'rent 2,500,000 + salaries 1,700,000 stand in at 4,200,000');
  eq(S.mgrMeetingSettings(S.mgrCashFloor(), null).cash_floor.amount, 4200000, 'and the meeting gets that figure');
  data.presetManager.cashFloor = 0;
  eq([S.mgrCashFloor().amount, S.mgrCashFloor().source], [0, 'set'], 'a floor the owner set at 0 is still 0 -- their answer');
  /* The Record settings tile. */
  const g = fn('renderManagerGrowth');
  t.check(/floor\.amount == null \? 'not known'/.test(g), 'the settings tile prints "not known" for an unknown floor, never "0 UGX"');
  t.check(/floor\.amount == null \? 'Blank: nothing stands in'/.test(g), 'and the field does not offer 0 as the stand-in');
}

/* ---------- 4. the payday dates wages on the buying budget too -------- */
{
  /* Today Wed 7 Oct 2026, 5,000,000 in hand. Joan earns 600,000 a month;
     September's wages (raised, due 30 Sep) and October's (raised, due
     31 Oct) are unpaid. One bill is due 20 Oct, 4,000,000.
       No payday: Sep's on today (overdue), the bill on the 20th, Oct's on
       the 31st: 5.0m - 0.6m = 4.4m, - 4.0m = 0.4m, - 0.6m = -0.2m.
       Lowest -200,000 on 31 Oct; safe to spend 0.
       Payday the 10th (pays the month just ended): Sep's on 10 Oct,
       Oct's on 10 Nov (past the 6 Nov window): 4.4m, then 0.4m on the
       20th. Lowest 400,000 on 20 Oct; safe to spend 400,000. */
  const data = {
    presetManager: {},
    staff: [{ id: 'ST1', name: 'Joan', payBasis: 'monthly', payRate: 600000 }],
    dues: [
      { kind: 'wage', refId: 'ST1', period: '2026-09', dueDate: '2026-09-30', amount: 600000, paid: 0 },
      { kind: 'wage', refId: 'ST1', period: '2026-10', dueDate: '2026-10-31', amount: 600000, paid: 0 },
    ],
    loans: [], customers: [],
  };
  const pad = (n) => String(n).padStart(2, '0');
  const env = {
    data, todayISO: () => '2026-10-07', CASH_AHEAD_DAYS: 30,
    cashOnHandByAccount: () => ({ total: 5000000 }),
    dueBalance: (d) => d.amount - d.paid, dueName: () => 'Joan',
    loanRemainingSchedule: () => [], rentAgreementsFor: () => [],
    findDue: (kind, id, period) => data.dues.find((d) => d.kind === kind && d.refId === id && d.period === period) || null,
    credOpenInvoices: () => [{ dueOn: '2026-10-20', due: 4000000, supplierId: 'S1', invoice: { id: 'B1' }, ageDays: 10 }],
    supplierName: () => 'Roofings', promiseLatest: () => null, promisesBroken: () => 0, collectableDebts: () => [],
    staffOnPayroll: () => data.staff, basisMonthCost: (b, r) => (b === 'monthly' ? r : null),
    periodLabel: (p) => p,
    anShiftDate: (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    daysBetweenISO: (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5),
    periodOf: (iso) => String(iso).slice(0, 7),
    periodShift: (p, m) => { let [y, mo] = p.split('-').map(Number); mo += m; while (mo > 12) { mo -= 12; y++; } while (mo < 1) { mo += 12; y--; } return y + '-' + pad(mo); },
    periodEndDate: (p) => { const [y, mo] = p.split('-').map(Number); return p + '-' + pad(new Date(Date.UTC(y, mo, 0)).getUTCDate()); },
    waWeekday: (iso) => new Date(iso + 'T00:00:00Z').getUTCDay(),
  };
  const S = compileScope([fn('cashCommitments'), fn('cashAhead'), fn('mgrPayday'), fn('mgrPaydaySettles'), fn('mgrPaydaySettlesDefault'),
    fn('mgrPaydayDates'), fn('mgrWageShares'), fn('mgrWageEvents'), fn('mgrPaydayLabel'), fn('mgrOrdinal'), decl('MGR_WEEKDAYS')], env,
  ['cashAhead']);
  const before = S.cashAhead();
  eq([before.tightest, before.safeToSpend], [{ date: '2026-10-31', balance: -200000 }, 0],
    'no payday: wages at the payroll\'s month end, lowest -200,000 on 31 Oct, nothing safe to spend (unchanged)');
  data.presetManager.payday = { kind: 'monthly', day: 10 };
  const after = S.cashAhead();
  eq([after.tightest, after.safeToSpend], [{ date: '2026-10-20', balance: 400000 }, 400000],
    'payday the 10th: September\'s wages leave on 10 Oct, October\'s after the window -- lowest 400,000 on 20 Oct, and that is the budget');
  eq(after.commitments.filter((c) => c.kind === 'wage').map((c) => [c.date, c.amount]), [['2026-10-10', 600000]],
    'one wage on the line, on the payday, never also at month end');
  eq(after.wagesNotRaised, [], 'and no month is named as missing');

  /* A salaried month NOBODY HAS RAISED is costed from the pay rate on the
     payday. October's due is not raised; payday the 25th (pays the month
     in progress). September's (raised, its payday 25 Sep gone by) is owed
     today: 5.0m - 0.6m = 4.4m; the bill on the 20th: 0.4m; October's
     600,000 from Joan's rate on the 25th: -0.2m. November's payday (25
     Nov) is past the 6 Nov window. Lowest -200,000 on 25 Oct; 0 to spend;
     October is on the line, so it is not named as "not raised". */
  data.dues = data.dues.filter((d) => d.period !== '2026-10');
  data.presetManager.payday = null;
  const unraised = S.cashAhead();
  eq([unraised.tightest, unraised.wagesNotRaised], [{ date: '2026-10-20', balance: 400000 }, ['2026-10']],
    'no payday, October not raised: lowest 400,000 on 20 Oct and October named as not raised (never guessed)');
  data.presetManager.payday = { kind: 'monthly', day: 25 };
  const costed = S.cashAhead();
  eq(costed.commitments.filter((c) => c.kind === 'wage').map((c) => [c.date, c.amount, c.raised]),
    [['2026-10-07', 600000, true], ['2026-10-25', 600000, false]],
    'payday the 25th: September owed today, October costed from the pay rate on the 25th');
  eq([costed.tightest, costed.safeToSpend, costed.wagesNotRaised], [{ date: '2026-10-25', balance: -200000 }, 0, []],
    'lowest -200,000 on 25 Oct, nothing safe to spend, no month named as missing');
}

/* ---------- 5. Today shows the worst states, in their own colours ----- */
{
  const lines = { sat: 'on', floor: 'risk', gp: 'risk', coll: 'on', broke: 'off' };
  const S = compileScope([fn('mgrPaceShow'), decl('MGR_PACE_RANK'), decl('MGR_PACE_CLASS')], {
    mgrTgTodayLine: (x) => ({ key: lines[x.metric], text: x.metric }),
  }, ['mgrPaceShow']);
  /* The reviewer's book: Saturday loads on track (on course), the cash
     floor At risk though its pace is "on course" (the committed line
     breaks it 22 Oct), gross profit At risk, collections on track. */
  const live = [
    { metric: 'sat', days_left: 10, pace: { on_course: true } },
    { metric: 'floor', days_left: 24, pace: { on_course: true } },
    { metric: 'gp', days_left: 4, pace: { on_course: false } },
    { metric: 'coll', days_left: 4, pace: { on_course: true } },
  ];
  eq(S.mgrPaceShow(live).map((r) => r.x.metric), ['gp', 'floor'],
    'both At-risk targets, the nearer deadline first -- the floor is no longer pushed off by an On-track one');
  eq(S.mgrPaceShow(live.concat([{ metric: 'broke', days_left: 30, pace: { on_course: false } }])).map((r) => r.x.metric), ['broke', 'gp'],
    'Off track before At risk');
  eq(S.mgrPaceShow([live[0], live[3]]).map((r) => r.x.metric), ['coll', 'sat'], 'two On-track targets: the nearer deadline first');
  const MGR_PACE_CLASS = compileScope([decl('MGR_PACE_CLASS'), 'function get(){ return MGR_PACE_CLASS; }'], {}, ['get']).get();
  eq(MGR_PACE_CLASS, { off: 'behind', risk: 'risk', on: 'ok' }, 'Off track wears the crimson rail, At risk its own');
  t.check(/\.mgr-pace\.risk\{border-left:3px solid var\(--ow-amber\);\}/.test(src) && /\.mgr-pace\.behind\{border-left:3px solid var\(--danger\);\}/.test(src),
    'amber for At risk, crimson for Off track -- as the Targets section draws them');
  const pace = fn('renderManagerPace');
  t.check(/mgrPaceShow\(live\)/.test(pace) && /MGR_PACE_CLASS\[line\.key\]/.test(pace) && !/on_course/.test(pace),
    'the strip takes both its choice and its colour from the state, never from pace.on_course');
}

/* ---------- 6. the invite keeps the meeting's order (law 6) ----------- */
{
  const card = fn('renderManagerCard');
  t.check(!/ranked by the money/.test(card) && /today's few moves in the meeting's own order/.test(card),
    'Today\'s invite says the moves come in the meeting\'s own order, never ranked by money');
}

/* ---------- 7. when the books were read ------------------------------- */
{
  const S = compileScope([fn('mgrFresh')], { esc: (s) => String(s).replace(/</g, '&lt;') }, ['mgrFresh']);
  const at = new Date(2026, 9, 7, 8, 12).getTime(), failed = new Date(2026, 9, 7, 8, 42).getTime();
  const ok = S.mgrFresh({ at, failedAt: null, error: null });
  eq(ok.bad, false, 'a good read is not a failure');
  const okText = ok.html.replace(/<[^>]+>/g, '');
  eq(okText, 'Books read 08:12 · Wed 7 Oct', 'the canvas line: the time of the read, then the day');
  t.check(/class="mgr-fresh-lamp"/.test(ok.html) && /class="mgr-fresh-t">08:12</.test(ok.html), 'with a lamp, and the time as a figure');
  const bad = S.mgrFresh({ at, failedAt: failed, error: 'Failed to fetch' });
  eq(bad.bad, true, 'a failed read is said as one');
  eq(bad.html.replace(/<[^>]+>/g, ''), 'The books could not be read at 08:42 — Failed to fetch · last read 08:12 · Wed 7 Oct',
    'named, with its reason and the last good time beside it');
  eq(S.mgrFresh({ at: null, failedAt: null, error: null }).html, '', 'nothing read yet says nothing -- never a time of 0');
  t.check(/<span class="mgr-fresh" id="mgrFresh" role="status"><\/span>/.test(src), 'the header has the line');
  t.check(/mgrPaintFresh\(\)/.test(fn('renderManager')), 'every Manager render paints it');
  const load = fn('loadData');
  t.check(/booksRead = booksFail/.test(load) && /if\(booksFail && typeof mgrPaintFresh === 'function'\) mgrPaintFresh\(\);/.test(load),
    'and loadData stamps every read, painting a failure at once since no redraw follows one');
  t.check(/\.mgr-fresh-bad \.mgr-fresh-lamp\{background:var\(--ow-crimson\);\}/.test(src) && /\.mgr-fresh-lamp\{[^}]*background:var\(--ow-verdigris\)/.test(src),
    'verdigris when fresh, crimson when the read failed');
}

/* ---------- 8. the meeting sees what still needs the owner ------------ */
{
  const S = compileScope([fn('mgrMeetingUnusualPick')], {}, ['mgrMeetingUnusualPick']);
  /* The harness book's eleven findings in screen order; #5 is answered. */
  const tones = ['bad', 'bad', 'bad', 'good', 'good', 'bad', 'good', 'good', 'good', 'good', 'bad'];
  const items = tones.map((tone, i) => ({ id: i + 1, tone }));
  const picked = S.mgrMeetingUnusualPick(items, (x) => (x.id === 5 ? { answer: 'A big order came in' } : null), 8);
  /* Unanswered problems 1 2 3 6 11 (five), then unanswered good news
     4 7 8 (three of five) -- eight -- listed in the screen's order. */
  eq(picked.map((r) => r.x.id), [1, 2, 3, 4, 6, 7, 8, 11],
    'every unanswered problem, #11 included, before good news; the answered #5 waits');
  eq(S.mgrMeetingUnusualPick(items, () => null, 20).length, 11, 'with room for all, all go');
  const hist = src.slice(src.indexOf('  manager_history: { confirm: false'));
  t.check(/return \{ id: x\.id, date: x\.date/.test(hist) && /figure: x\.figure/.test(hist) && /usual: x\.usual/.test(hist)
    && /weekdays_compared: x\.weeks/.test(hist), 'each carries the screen\'s number, the figure, its usual and what that rests on');
  const desc = (/unusual_days: the findings[^']*/.exec(api) || [''])[0];
  t.check(/last fortnight/.test(desc) && /eleven signals/.test(desc) && /found_in_books/.test(desc) && /owner_taught/.test(desc)
    && /ALONGSIDE it, never its cause/.test(desc) && !/money out/.test(desc),
    'and the tool tells the meeting what it really reads: a fortnight, eleven signals, no "money out"');
  t.check(/never name a cause/.test(desc), 'still a question, never a verdict');
  /* The pick sorts back into screen order (#4, good news, arrives before
     problem #11), so the description must not call the order a ranking. */
  const mh = (/name: 'manager_history',\s*description: '([^']*)'/.exec(api) || ['', ''])[1];
  t.check(mh.length > 0 && !/listed first/.test(mh) && /Unanswered problems are chosen first; the list keeps the screen\u2019s order and numbers/.test(mh.replace(/\\u2019/g, "\u2019")),
    'manager_history says problems are CHOSEN first and the list keeps the screen\'s order -- never that the order is a priority');
}

/* ---------- 9. one oxide action on the phone -------------------------- */
{
  const rule = (/#mgrTalkBtn \.mgr-talk-go\{flex:none;[^}]*\}/.exec(src) || [''])[0];
  t.check(/background:var\(--ow-steel-950\)/.test(rule) && !/--ow-oxide/.test(rule),
    'the ask field\'s go-square is navy on every section; each section keeps the one oxide action');
}

process.exit(t.done() ? 1 : 0);
