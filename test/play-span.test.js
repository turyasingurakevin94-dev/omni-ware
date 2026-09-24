#!/usr/bin/env node
'use strict';
/*
 * A STRATEGY IS FOR A SPAN.
 *
 * A play carried a name, a problem it treats, a treatment and a
 * measure — and no clock. It ran until somebody remembered to stop it.
 *
 * So a strategy the shop meant to try for a month could sit in the
 * playbook for a season, argued from every Monday, with nothing
 * anywhere asking whether it had had its chance. That is the difference
 * between working a strategy and keeping a label: a manager who cannot
 * say "this was for four weeks and it has run nine" is not carrying a
 * strategy across weeks, it is carrying a word.
 *
 * The span is the MANAGER'S own commitment, so running past it is the
 * Manager's failure to answer for — not the shop's. Same shape as
 * advice that is not landing, one level up: not a shop that disagreed,
 * a manager that stopped noticing.
 *
 * Four laws:
 *
 *   IT IS NAMED, NEVER ACTED ON. This stops no play and drops nothing.
 *   What to do about a play that has run its course is the owner's.
 *
 *   NO SPAN NAMED IS ITS OWN ANSWER. Defaulting to four weeks would
 *   judge a shop against a horizon nobody agreed — the same invention
 *   as a derived due date.
 *
 *   WEEK ONE FROM THE DAY IT STARTS. A play started this morning is in
 *   its first week, not its noughth.
 *
 *   AND THE SPAN ANSWERS A DIFFERENT QUESTION FROM THE MOVEMENT. A play
 *   three days old that moved nothing has not failed; one nine weeks
 *   into a four-week span has been carried rather than worked.
 *
 * Run: node test/play-span.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('a strategy is for a span');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBack = (n) => shift(TODAY, -n);

const clockScope = compileScope(
  [extractFunction(src, 'managerPlayClock', 'index.html'),
    extractFunction(src, 'managerPlaysPastSpan', 'index.html')],
  { todayISO: () => TODAY,
    daysSinceDate: (d) => Math.round((Date.parse(TODAY) - Date.parse(String(d))) / 86400000),
    Date, Math, Number, String, Array, Object, Boolean },
  ['managerPlayClock', 'managerPlaysPastSpan']);
const clock = (over) => clockScope.managerPlayClock(Object.assign({ weeks: 4, started_on: daysBack(10) }, over || {}), TODAY);

/* ---------- 1. where a play is in its own span ----------------------- */
{
  eq(clock({ started_on: TODAY }).weekOf, 1,
    'WEEK ONE FROM THE DAY IT STARTS — "week 0 of 4" is a screen written by somebody counting array indexes');
  eq(clock({ started_on: daysBack(6) }).weekOf, 1, 'six days in is still the first week');
  eq(clock({ started_on: daysBack(7) }).weekOf, 2, 'and the seventh day begins the second');
  eq(clock({ started_on: daysBack(10) }).weeks, 4, 'the span it was given travels with it');
  eq(clock({ started_on: daysBack(10) }).daysLeft, 18, 'with how long is left of it');
  eq(clock({ started_on: daysBack(10) }).past, false, 'and it is not past while it is inside it');
}

/* ---------- 2. and when it has outlived it --------------------------- */
{
  eq(clock({ started_on: daysBack(28) }).past, false,
    'the last day of a four-week span is still inside it — a play is not late on the day it is due');
  const over = clock({ started_on: daysBack(40) });
  eq(over.past, true, 'a play forty days into a four-week span is past it');
  eq(over.daysOver, 12, 'by twelve days, said as a number the owner can argue with');
  eq(over.daysLeft, 0, 'and nothing is left of it');
}

/* ---------- 3. no span named is its own answer ----------------------- */
{
  const none = clock({ weeks: null, started_on: daysBack(40) });
  eq(none.noSpan, true,
    'A PLAY WITH NO HORIZON SAYS SO — defaulting to four weeks would judge a shop against a number nobody agreed, which is the same invention as a derived due date');
  eq(none.past, false, 'and can never be past a span it never had');
  eq(none.days, 40, 'though how long it has run is still said');
  eq(clock({ weeks: 0 }).noSpan, true, 'nought weeks is no span at all');
  eq(clockScope.managerPlayClock({ weeks: 4 }, TODAY), null,
    'and a play with no start date has no clock — a span needs two ends');
}

/* ---------- 4. the ones past their day, worst first ------------------ */
{
  const book = { running: [
    { name: 'A', clock: clock({ started_on: daysBack(31) }) },
    { name: 'B', clock: clock({ started_on: daysBack(60) }) },
    { name: 'C', clock: clock({ started_on: daysBack(5) }) },
    { name: 'D', clock: clock({ weeks: null, started_on: daysBack(90) }) },
  ] };
  const past = clockScope.managerPlaysPastSpan(book);
  eq(past.map((p) => p.name).join(','), 'B,A',
    'the plays past their day, the worst overrun first — and NOT the one still inside its span, nor the one that never had one');
}

/* ---------- 5. the span is written down when it is proposed ---------- */
(async () => {
  {
    const inserted = [];
    const scope = compileScope(
      [extractFunction(src, 'managerSaveMeeting', 'index.html'),
      'async function managerInsertProposals(rows){ return sb.from(\'manager_notes\').insert(rows); }',
        extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
        extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
        extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
        extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
        extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
        extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html')],
      {
        managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
        managerToday: null, setBuyHold: () => true, buyKeyParts: () => ({}),
        data: { customers: [], suppliers: [], products: [] },
        console,
        sb: { from: () => ({
          insert: (rows) => { inserted.push(rows);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 44 }, error: null }) }) }; },
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
        }) },
        Date, JSON, Math, Number, String, Array, Object, Boolean, Promise,
      }, ['managerSaveMeeting']);

    await scope.managerSaveMeeting({ keyline: 'k', moves: [], plays: [
      { name: 'Charge for cutting', treats: 'margin', how: 'h', sized: 's', watch: 'w', weeks: 4 },
      { name: 'Deposit before delivery', treats: 'debt', how: 'h', weeks: 99 },
    ] });
    const plays = inserted.find((r) => Array.isArray(r) && r[0] && r[0].kind === 'play');
    t.check(!!plays, 'the plays reach the journal');
    eq(plays[0].body.weeks, 4, 'A PLAY IS WRITTEN DOWN WITH THE SPAN IT WAS GIVEN — without it the clock has nothing to read');
    eq(plays[1].body.weeks, null,
      'and a span longer than a quarter is refused rather than stored: a play that needs more than thirteen weeks to show anything is not a play, it is a hope');
  }

  /* ---------- 6. and the meeting is told, in the place it opens with -- */
  {
    const rows = [
      { id: 4, date: daysBack(60), status: 'running',
        body: { name: 'Deposit before delivery', treats: 'debt', source: 'manager', startedOn: daysBack(60), weeks: 4 } },
      { id: 3, date: daysBack(5), status: 'running',
        body: { name: 'Charge for cutting', treats: 'margin', source: 'manager', startedOn: daysBack(5), weeks: 4 } },
    ];
    const q = (out) => { const o = {}; o.select = () => o; o.eq = () => o; o.gte = () => o; o.lte = () => o;
      o.order = () => o; o.limit = () => Promise.resolve(out); return o; };
    const scope = compileScope(
      [extractFunction(src, 'managerPlaybook', 'index.html'),
        extractFunction(src, 'managerPlayClock', 'index.html'),
        extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
        extractFunction(src, 'managerPlayProgress', 'index.html'),
        extractFunction(src, 'booksStartDate', 'index.html'),
        extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
        extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
        extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
        'async function book(){ return await managerPlaybook(); }'],
      { managerNotesTable: true, currentShopId: 'S', todayISO: () => TODAY,
        daysSinceDate: (d) => Math.round((Date.parse(TODAY) - Date.parse(String(d))) / 86400000),
        data: { savedQuotes: [{ voided: false, invoiced: true, date: '2026-01-01' }], customers: [] },
        anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0 }),
        dashInventoryHealth: () => ({ deadValue: 0 }), cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
        debtCollectionsOn: () => ({ total: 0 }),
        console,
        sb: { from: () => q({ data: rows, error: null }) },
        Date, JSON, Math, Number, String, Array, Object, Boolean, Promise },
      ['book', 'managerPlaysPastSpan']);

    const b = await scope.book();
    eq(b.running.length, 2, 'both plays are running');
    const late = b.running.find((p) => p.name === 'Deposit before delivery');
    const young = b.running.find((p) => p.name === 'Charge for cutting');
    eq(late.clock.past, true, 'the sixty-day play is past its four weeks');
    eq(late.clock.daysOver, 32, 'by thirty-two days');
    eq(young.clock.past, false, 'the five-day one is not');
    eq(young.clock.weekOf, 1, 'and is in its first week');
    eq(scope.managerPlaysPastSpan(b).length, 1, 'so exactly one is past its day');
  }
})().then(() => {

  /* ---------- 7. the rulebook and the tools carry the argument -------- */
  {
    const meeting = api.slice(api.indexOf('const MANAGER_MEETING'), api.indexOf('const MANAGER_REVIEW'));
    t.check(/"weeks":4/.test(meeting),
      'the block the meeting emits carries the span, or the mind has nowhere to put it');
    t.check(/weeks \(how many weeks it is for\)/.test(meeting), 'and the field is named in the plays rule');
    t.check(/A play past its span is never carried into another week in silence/.test(meeting),
      'with the law: a play past its day is named, never carried');
    t.check(/extend it with a reason, stop it, or replace it/.test(meeting),
      'and the three answers spelled out — "say something" cannot be satisfied by saying anything');

    /* THE ARGUMENT LIVES IN THE TOOL DESCRIPTIONS, which cost no
       rulebook. The morning's rules sit against a ceiling, and three
       restatements were trimmed to pay for the law above. */
    const hist = api.slice(api.indexOf("name: 'manager_history'"), api.indexOf("name: 'week_review_data'"));
    t.check(/past_its_span/.test(hist), 'manager_history says what the key is called');
    t.check(/your own commitment, so overrunning it is yours to answer for/.test(hist),
      'AND WHOSE FAILURE IT IS — a manager past its own horizon has stopped noticing, and the shop is not the one at fault');
    t.check(/no_span_named/.test(hist), 'a play proposed before spans existed is named, not judged against a guess');
    t.check(/a play can fail in week one/.test(hist),
      'and the older law survives the move: a play that is not working is called whatever its span says');

    const wk = api.slice(api.indexOf("name: 'week_review_data'"));
    t.check(/for_weeks, has_run_days, and past_its_span/.test(wk.slice(0, 3000)),
      'the review is handed the horizon too');
    t.check(/A play three days old that moved nothing has not failed/.test(wk.slice(0, 3000)),
      'WITH WHY BOTH ARE NEEDED — the span and the movement answer different questions, and judging on one alone gets a young play wrong');
  }

  /* ---------- 8. and the owner sees it without a meeting -------------- */
  {
    const render = (/const clock = \(p\)=>\{[\s\S]*?\n      \};/.exec(src) || [''])[0];
    t.check(/week \$\{c\.weekOf\} of \$\{c\.weeks\}/.test(render),
      'the clock is written in the words the owner reads');
    t.check(/past its \$\{c\.weeks\} weeks/.test(render), 'and says plainly when it has run over');
    t.check(/no span named/.test(render), 'and when it never had a horizon at all');
    /* AND THE CARD CALLS IT. Every check above passes with the clock
       written, correct, and never put on a card — which is exactly how
       a whole build reaches the tests and never the owner. */
    /* The play is a ROW now rather than a card -- four plays as 90px
       cards was 360px of chrome for four sentences -- so this locates
       the emitter by its current name. What is pinned is unchanged and
       is the point: every check above passes with the clock written,
       correct, and never put in front of the owner, which is exactly
       how a whole build reaches the tests and never the shop. */
    const card = (/const row = \(p, buttons\)=> `[\s\S]*?<\/div>`;/.exec(src) || [''])[0];
    t.check(card.length > 200, `the play row was found, not silently skipped (${card.length} chars)`);
    t.check(/\$\{clock\(p\)\}/.test(card),
      'THE CARD DRAWS IT — a strategy the owner cannot see the clock on is one they can only be told about, and the meeting is not held every day');
    t.check(/\.mgr-play-clock\.over\{/.test(src) && /ow-oxide-soft/.test(src),
      'with the overrun marked, so the owner does not have to count the weeks to notice');
  }

  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
