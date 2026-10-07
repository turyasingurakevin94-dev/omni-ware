#!/usr/bin/env node
'use strict';
/*
 * The Manager reads its own lessons back.
 *
 * The weekly review ends by writing a verdict and up to three lessons
 * into the journal — and nothing ever read them again. manager_history
 * handed each meeting the scoreboard, the questions and what became of
 * past moves, and not one word of what the shop had learned; the only
 * code that touched a review row drew it on screen for the owner. A
 * manager that writes lessons it never re-reads is keeping a diary.
 *
 * Everything else here compounds — advice is accounted for, targets are
 * paced, answers come back as evidence. The judgement it formed about
 * its own week is the thing that should compound hardest.
 *
 * Two laws, both the shop's own, applied again:
 *
 *   ONE READING     the screen and both minds take the same rows from
 *                   the same function, so the owner and the manager can
 *                   never be shown different lessons.
 *   RUN IT, DON'T READ IT  these checks call the tools. A value computed
 *                   and then dropped before the return has slipped past
 *                   source-shaped assertions twice in this suite.
 *
 * Run: node test/manager-lessons.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the manager’s lessons');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const TODAY = '2026-08-31';

/* Newest first, as the query orders them. The middle row has no verdict
   — a review that never reached a judgement is not a lesson to quote. */
const reviews = [
  { id: 9, date: '2026-08-30', status: 'held', body: { verdict: 'A hard week saved by collections.',
    lessons: ['Chases without a date go nowhere', 'Price the below-cost lines first', '  ', 'A fourth lesson too many'] } },
  { id: 8, date: '2026-08-23', status: 'held', body: { verdict: '', lessons: ['Never reached a verdict'] } },
  { id: 7, date: '2026-08-16', status: 'held', body: { verdict: 'Quiet week.', lessons: [] } },
];
const journal = {
  meeting: [{ id: 1, date: '2026-08-30', body: { keyline: 'k' } }],
  move: [], question: [], target: [], review: reviews,
};
const env = {
  data: { customers: [], stockLog: [], savedQuotes: [], purchaseInvoices: [], cashTxns: [] },
  managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1',
  todayISO: () => TODAY, anShiftDate: shift,
  daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
  apRound: (n) => Math.round(Number(n) || 0),
  fmtUGX: (n) => String(n),
  anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0, estimatedQty: 0 }),
  debtCollectionsOn: () => ({ total: 0 }), cashIsMoneyIn: () => true,
  dashInventoryHealth: () => ({ deadValue: 0, deadQty: 0 }),
  cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
  console, Date, JSON, Math, Number, String, Array, Object, Promise,
};
const queries = [];
const fakeSb = { from: () => { const q = { _kind: null };
  q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
  q.eq = (c, v) => { if (c === 'kind'){ q._kind = v; queries.push(v); } return q; };
  q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
  q.then = (res) => res({ data: journal[q._kind] || [], error: null });
  return q; } };

const scope = compileScope([
  extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
  extractFunction(src, 'buyHoldsStanding', 'index.html'),
  extractFunction(src, 'buyHoldFor', 'index.html'),
  extractFunction(src, 'buyKeyLabel', 'index.html'),
  extractFunction(src, 'managerAdviceTally', 'index.html'), extractFunction(src, 'mgrLiveMoveRows', 'index.html'), extractFunction(src, 'mgrJrWords', 'index.html'), extractDeclaration(src, 'MGR_JR_STOP', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
      extractFunction(src, 'mgrLiveMoveRows', 'index.html'),
      extractFunction(src, 'managerChaseEvidence', 'index.html'),
      /* The unusual-days reading has its own test; here it is quiet. */
      "function unusualDays(){ return { today: '', judged: 0, thin: 0, floor: 0, items: [] }; } function unusualLine(){ return ''; } var mgrUnusualMemo = null;"
      + " async function mgrUnusualForMeeting(){ return { judged: false, items: [], answered: () => null, answersError: null, normalsError: null, taught: [] }; }",
      extractFunction(src, 'chaseResponse', 'index.html'),
      extractFunction(src, 'chaseDayAdd', 'index.html'),
      extractFunction(src, 'chaseRate', 'index.html'),
      extractFunction(src, 'chaseResponseLine', 'index.html'),
      extractFunction(src, 'customerCollectionDays', 'index.html'),
      extractFunction(src, 'collectionInvoiceTxn', 'index.html'),
      extractFunction(src, 'collectionLedgerRow', 'index.html'),
      extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
      extractFunction(src, 'cashIsMoneyIn', 'index.html'),
      extractDeclaration(src, 'CHASE_WINDOW', 'index.html'),
      extractDeclaration(src, 'CHASE_LOOKBACK', 'index.html'),
      extractDeclaration(src, 'CHASE_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_CHASED', 'index.html'),
      extractDeclaration(src, 'CHASE_MIN_QUIET', 'index.html'),
      extractDeclaration(src, 'CHASE_MERGE', 'index.html'),
      extractDeclaration(src, 'CHASE_VERDICT_WORDS', 'index.html'),
      extractDeclaration(src, 'mgrChaseMemo', 'index.html'),
      extractDeclaration(src, 'mgrChaseExtras', 'index.html'),
      extractFunction(src, 'trackRecordName', 'index.html'),
      extractFunction(src, 'trackRecordLine', 'index.html'),
      extractFunction(src, 'trackRecordDeadLevers', 'index.html'),
      extractDeclaration(src, 'TRACK_MOVES_READ', 'index.html'),
      extractDeclaration(src, 'TRACK_MIN_TIMES', 'index.html'),
      extractDeclaration(src, 'TRACK_WINDOWED', 'index.html'),
  extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerPlayClock', 'index.html'),
      extractFunction(src, 'managerPlaysPastSpan', 'index.html'),
  extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
  extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
  extractFunction(src, 'managerRecentReviews', 'index.html'),
  extractFunction(src, 'managerReviewBrief', 'index.html'),
  extractFunction(src, 'managerScoreboard', 'index.html'),
  extractFunction(src, 'managerScoreProgress', 'index.html'),
  extractFunction(src, 'deriveMoveOutcome', 'index.html'),
  'function names(){ return { ASSISTANT_TOOLS, managerRecentReviews, managerReviewBrief }; }',
], { ...env, sb: fakeSb }, ['names']);
const N = scope.names();

(async () => {
  /* ---------- 1. one honest reading ---------------------------------- */
  {
    const rows = await N.managerRecentReviews(4);
    eq(rows.length, 2, 'a review that never reached a verdict is skipped, not surfaced as a blank');
    eq(rows[0].id, 9, 'newest first');

    const brief = N.managerReviewBrief(rows[0]);
    eq(brief.verdict, 'A hard week saved by collections.', 'the judgement travels');
    eq(brief.lessons.length, 3, 'lessons are capped at three, as the review itself is');
    t.check(!brief.lessons.some((l) => !l.trim()), 'and a blank lesson never counts toward the three');
    eq(brief.held_on, '2026-08-30', 'with the day it was held');
    eq(brief.days_ago, 1, 'and how long ago — DERIVED now, so it cannot go stale in the journal');
    eq(N.managerReviewBrief(null), null, 'no review, no brief');

    const none = compileScope([extractFunction(src, 'managerRecentReviews', 'index.html')],
      { managerNotesTable: false, sb: { from(){ throw new Error('touched the database without the table'); } },
        Math, Number, console }, ['managerRecentReviews']);
    eq((await none.managerRecentReviews(4)).length, 0,
      'without the memory table it answers empty rather than reaching for a table that is not there');
  }

  /* ---------- 2. the meeting is handed last week's lessons ----------- */
  {
    const hist = await N.ASSISTANT_TOOLS.manager_history.run({ limit: 3 });
    t.check(!!hist.last_review, 'the meeting is HANDED the last review, not merely near the code that reads one');
    eq(hist.last_review.verdict, 'A hard week saved by collections.', 'with its verdict');
    eq(hist.last_review.lessons[0], 'Chases without a date go nowhere', 'and its lessons, in order');
    eq(hist.last_review.days_ago, 1, 'and how fresh it is');
  }

  /* ---------- 3. the review is handed the one before it -------------- */
  {
    const wk = await N.ASSISTANT_TOOLS.week_review_data.run();
    t.check(!!wk.previous_review, 'the review can see the review before it');
    eq(wk.previous_review.verdict, 'A hard week saved by collections.',
      'so it can say whether its own last lessons stuck instead of drawing fresh ones over the top');
    eq(wk.previous_review.lessons.length, 3, 'with the same lessons the meeting reads');
  }

  /* ---------- 4. the screen reads the same rows ---------------------- */
  {
    const load = extractFunction(src, 'managerLoadState', 'index.html');
    t.check(/managerRecentReviews\(4\)/.test(load),
      'the screen takes the reviews from the one reading');
    t.check(!/\.eq\('kind', 'review'\)/.test(load),
      'and no longer keeps a second query of its own — two readings are two chances to disagree');
    const rest = src.replace(extractFunction(src, 'managerRecentReviews', 'index.html'), '');
    eq((rest.match(/\.eq\('kind', 'review'\)/g) || []).length, 0,
      'in fact nothing else in the app reads a review row directly');
  }

  /* ---------- 5. both minds are told to use them --------------------- */
  {
    const ext = api.slice(api.indexOf('const MANAGER_COMMON'), api.indexOf('function managerExtension'));
    t.check(/the lesson from the last review that today acts on/.test(ext),
      'a meeting must name the lesson today’s plan acts on — now inside the one rule that says how a morning reads, rather than as a fourth claim on the opening sentence');
    t.check(/or the one you are setting aside and why/.test(ext),
      'and when it acts on none of them, say which it is setting aside and why');
    t.check(/say plainly that it is dead and stop carrying it/.test(ext),
      'a lesson the owner keeps passing on is retired, not repeated forever — the twice-rejected-rule judgement, applied to itself');
    t.check(/OPEN THE ACCOUNT WITH THE LAST REVIEW/.test(ext),
      'and the review opens by saying whether its own last lessons were acted on');
    t.check(/Never repeat a lesson word for word without saying what has changed/.test(ext),
      'never repeating a lesson without saying what changed');
    t.check(/last_review: the verdict and lessons from the most recent weekly review/.test(api)
      && /Carries previous_review as well/.test(api),
      'and both tools say in their own descriptions that the review travels with them');
  }
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
