#!/usr/bin/env node
'use strict';
/*
 * Targets the Manager sets itself, and a scoreboard it is judged by.
 *
 * A manager that only advises cannot be held to anything. So it now
 * proposes numbers for the week and the shop reads, every day, how far
 * it is from them. Three laws hold it honest, and each of them is the
 * shop's own, applied again:
 *
 *   ONLY WHAT THE APP CAN MEASURE  a metric earns its place only if some
 *       existing screen already answers it from the books. A target
 *       somebody has to remember is a wish, and wishes do not survive a
 *       busy week.
 *   NEVER ITS OWN SCORE  the aim, the baseline and the dates are stored;
 *       where the shop STANDS is derived at render, every time, by the
 *       same function the screen and both tools read. A manager that
 *       keeps its own score can flatter it -- the deriveMoveOutcome
 *       lesson, applied to the scoreboard.
 *   A COMMITMENT IS A TAP  a proposed target is not a live one. The
 *       management contract, unchanged since the first meeting.
 *
 * The level/flow distinction is the subtle one: 8,000,000 of debt coming
 * down to 6,500,000 against an aim of 5,000,000 is HALF the distance,
 * not 130% of the target.
 *
 * Run: node test/manager-targets.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the manager’s targets');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const data = { customers: [{ id: 1, debt: 6500000 }, { id: 2, debt: 0.2 }] };
const env = {
  data,
  todayISO: () => '2026-08-29', anShiftDate: shift,
  apRound: (n) => Math.round(Number(n) || 0),
  debtCollectionsOn: (d) => ({ total: d >= '2026-08-26' ? 400000 : 100000 }),
  anInvoicesInRange: (f, to) => [{ f, to }],
  anOverallTotals: () => ({ sales: 4000000, profit: 1200000, count: 3, estimatedQty: 0 }),
  dashInventoryHealth: () => ({ deadValue: 900000, deadQty: 12 }),
  cashOnHandByAccount: () => ({ total: 2500000, byAccount: [] }),
  Date, JSON, Math, Number, String, Array, Object,
};
const scope = compileScope([
  extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
  extractFunction(src, 'managerScoreProgress', 'index.html'),
  'function names(){ return { MANAGER_METRICS, managerScoreProgress }; }',
], env, ['names']);
const { MANAGER_METRICS: M, managerScoreProgress } = scope.names();

/* ---------- 1. only what the books can answer unasked ---------------- */
{
  const keys = Object.keys(M);
  eq(keys.length, 6, 'six metrics, every one of them measurable here');
  ['collections', 'gross_profit', 'sales', 'debtors_total', 'dead_stock_value', 'cash_on_hand']
    .forEach((k) => t.check(keys.includes(k), `${k} can be aimed at`));
  keys.forEach((k) => t.check(typeof M[k].measure === 'function',
    `${k} carries the function that measures it — a metric with no measure is a wish`));
  t.check(M.debtors_total.direction === 'down' && M.dead_stock_value.direction === 'down',
    'debt and dead stock are aimed DOWN — a target that cannot say which way is good judges nothing');
  t.check(M.collections.direction === 'up' && M.cash_on_hand.direction === 'up', 'collections and cash are aimed up');
  t.check(M.collections.kind === 'flow' && M.debtors_total.kind === 'level',
    'a flow is earned across the week; a level is where the shop stands today');
}

/* ---------- 2. the score is read from the books, not remembered ------ */
{
  /* Collections: 4 days at 400,000 (26-29 Aug) + 3 at 100,000. */
  const flow = managerScoreProgress({ date: '2026-08-23',
    body: { metric: 'collections', aim: 3000000, baseline: 1500000, from: '2026-08-23', to: '2026-08-29' } });
  eq(flow.actual, 1900000, 'a flow target is summed from the same daily collections the review uses');
  eq(flow.pct, 63, 'and progress is the share of the aim earned');
  eq(flow.met, false, 'short of the aim is not met');
  eq(flow.days_left, 0, 'with the days left in its own period');

  /* Level: 8,000,000 owed when taken on, aim 5,000,000, now 6,500,000. */
  const level = managerScoreProgress({ date: '2026-08-23',
    body: { metric: 'debtors_total', aim: 5000000, baseline: 8000000, from: '2026-08-23', to: '2026-09-05' } });
  eq(level.actual, 6500000, 'a level target reads what the books say TODAY');
  eq(level.pct, 50,
    'and progress is the distance travelled from where it started — 6.5m of an 8m-to-5m journey is half way, never 130%');
  eq(level.met, false, 'not met while it is still above the aim');
  eq(level.days_left, 7, 'days left counted to its own end date');

  const beaten = managerScoreProgress({ date: '2026-08-23',
    body: { metric: 'debtors_total', aim: 7000000, baseline: 8000000, from: '2026-08-23', to: '2026-09-05' } });
  t.check(beaten.met === true && beaten.pct === 100,
    'an aim already reached reads as met and is capped — no manager scores 150% of its own target');

  const finished = managerScoreProgress({ date: '2026-08-10',
    body: { metric: 'collections', aim: 100000, baseline: 0, from: '2026-08-10', to: '2026-08-16' } });
  t.check(finished.finished === true, 'a period that has ended says so, so the review can judge it');

  eq(managerScoreProgress({ body: { metric: 'vibes', aim: 1 } }), null,
    'a metric this app cannot measure scores nothing at all');

  /* The law itself: nothing about where the shop stands is written. */
  const prog = extractFunction(src, 'managerScoreProgress', 'index.html');
  t.check(/m\.measure\(from, to\)/.test(prog) && !/insert|update\(/.test(prog),
    'the score is measured, never stored — a manager that keeps its own score can flatter it');
}

/* ---------- 3. a commitment is a tap --------------------------------- */
(async () => {
  {
    const inserted = [];
    const save = compileScope([
      extractFunction(src, 'managerSaveMeeting', 'index.html'),
      extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
      extractDeclaration(src, 'MANAGER_MOVE_KINDS', 'index.html'),
      extractFunction(src, 'managerResolvedSubject', 'index.html'),
      'async function managerInsertProposals(rows){ return sb.from(\'manager_notes\').insert(rows); }',
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
      extractDeclaration(src, 'MANAGER_LEVERS', 'index.html'),
      extractDeclaration(src, 'MANAGER_OBJECTIVES', 'index.html'),
    ], { ...env, managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1',
      sb: { from: () => ({ insert: (row) => { inserted.push(row); return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 21 }, error: null }) }) }; } }) },
      Promise, console,
    }, ['managerSaveMeeting']).managerSaveMeeting;

    await save({ keyline: 'k', moves: [],
      targets: [
        { metric: 'collections', aim: 3000000, why: '2,400,000 last week and two chases worth 5,830,000' },
        { metric: 'unicorns', aim: 999, why: 'nonsense' },
        { metric: 'gross_profit', aim: 0, why: 'no aim at all' },
        { metric: 'dead_stock_value', aim: 600000, why: 'from 900,000' },
        { metric: 'sales', aim: 5000000, why: 'a third' },
      ] });
    const targets = inserted.find((r) => Array.isArray(r) && r[0] && r[0].kind === 'target');
    eq(targets.length, 2, 'at most two targets, and only ones this app can measure');
    eq(targets[0].status, 'proposed',
      'PROPOSED, never adopted by the writing of it — a number the shop is judged by is taken on by a tap');
    eq(targets[0].body.metric, 'collections', 'the metric it argued');
    eq(targets[0].body.aim, 3000000, 'and the aim');
    t.check(!targets.some((x) => x.body.metric === 'unicorns'),
      'a metric nothing measures never reaches the journal');
    t.check(!targets.some((x) => Number(x.body.aim) === 0), 'and an aim of nothing is not a target');
  }

  /* ---------- 4. adopting fixes the period and the starting point ---- */
  {
    const updates = [];
    const toasts = [];
    const adopt = compileScope([
      extractFunction(src, 'managerAdoptTarget', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
    ], { ...env, managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1',
      toast: (m) => toasts.push(m), renderManager: () => {},
      sb: { from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({
          data: { date: '2026-08-29', body: { metric: 'debtors_total', aim: 5000000 } } }) }) }) }),
        update: (patch) => { updates.push(patch); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }; },
      }) }, Promise,
    }, ['managerAdoptTarget']).managerAdoptTarget;

    await adopt(9);
    eq(updates[0].status, 'open', 'taking it on makes it live');
    eq(updates[0].body.from, '2026-08-29', 'the period starts the day it was taken on');
    eq(updates[0].body.to, '2026-09-04', 'and runs a week');
    eq(updates[0].body.baseline, 6500000,
      'with WHERE THE SHOP STOOD written down — without it, a level target reads as if the whole debt book were this week’s work');
    t.check(toasts.some((m) => /scoreboard reads it from your books/.test(m)),
      'and the owner is told the score comes from their own books');
  }

  /* ---------- 5. one scoreboard, read by the screen and the tools ---- */
  {
    const rows = [
      { id: 1, date: '2026-08-27', status: 'open', body: { metric: 'collections', aim: 3000000, baseline: 0, from: '2026-08-27', to: '2026-09-02' } },
      { id: 2, date: '2026-08-01', status: 'open', body: { metric: 'sales', aim: 1, baseline: 0, from: '2026-08-01', to: '2026-08-07' } },
      { id: 3, date: '2026-08-29', status: 'proposed', body: { metric: 'dead_stock_value', aim: 600000, why: 'from 900,000' } },
      { id: 4, date: '2026-08-29', status: 'declined', body: { metric: 'sales', aim: 9 } },
    ];
    const board = compileScope([
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
    ], { ...env, managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1',
      sb: { from: () => { const q = {}; q.select = () => q; q.eq = () => q; q.order = () => q;
        q.limit = () => Promise.resolve({ data: rows, error: null }); return q; } }, Promise,
    }, ['managerScoreboard']).managerScoreboard;

    const out = await board();
    eq(out.targets.length, 1, 'a target whose week ended long ago drops off the live board');
    eq(out.targets[0].metric, 'collections', 'the live one stands');
    eq(out.proposed.length, 1, 'a proposal waits for the tap');
    eq(out.proposed[0].label, 'Dead stock', 'named in the owner’s words');
    t.check(!out.proposed.some((x) => x.metric === 'sales' && x.aim === 9),
      'and one set aside stays set aside');

    /* The same reading everywhere: the screen and both tools call it. */
    const render = extractFunction(src, 'renderManager', 'index.html');
    t.check(/st\.score/.test(render), 'the screen draws the scoreboard from that one reading');
    /* Run the tool, do not merely look for the call: a scoreboard that is
       computed and then dropped on the way out reads as working. */
    const journal = { meeting: [{ id: 1, date: '2026-08-28', body: { keyline: 'k' } }], move: [], question: [], target: rows };
    const tools = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractFunction(src, 'buyHoldsStanding', 'index.html'),
      extractFunction(src, 'buyHoldFor', 'index.html'),
      extractFunction(src, 'buyKeyLabel', 'index.html'),
      extractFunction(src, 'managerAdviceTally', 'index.html'),
      extractFunction(src, 'managerTrackRecord', 'index.html'),
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
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], { ...env, managerNotesTable: true, rivalPricesTable: false, currentShopId: 'shop-1',
      data: { ...data, stockLog: [], savedQuotes: [], purchaseInvoices: [] },
      daysSinceDate: () => 3, fmtUGX: (n) => String(n), Promise,
      sb: { from: () => { const q = { _kind: null };
        q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
        q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
        q.limit = () => Promise.resolve({ data: journal[q._kind] || [], error: null });
        q.then = (res) => res({ data: journal[q._kind] || [], error: null });
        return q; } },
    }, ['names']).names().ASSISTANT_TOOLS;

    const hist = await tools.manager_history.run({ limit: 3 });
    t.check(Array.isArray(hist.scoreboard) && hist.scoreboard.length === 1,
      'the meeting is HANDED the scoreboard, not merely near the code that builds one');
    eq(hist.scoreboard[0].metric, 'collections', 'the live target, with where the books say it stands');
    eq(hist.scoreboard[0].actual, 1200000, 'measured now — the same reading the screen shows');
    t.check((hist.targets_awaiting_your_approval || []).length === 1,
      'and what is still waiting for the owner’s tap');
  }

  /* ---------- 6. the mind is told it will be measured ---------------- */
  {
    const ext = api.slice(api.indexOf('const MANAGER_COMMON'), api.indexOf('function managerExtension'));
    t.check(/BE MEASURED\./.test(ext), 'the mind is told to propose targets');
    t.check(/AT MOST TWO targets/.test(ext), 'bounded to two — a scoreboard of ten is a dashboard');
    ['collections', 'gross_profit', 'sales', 'debtors_total', 'dead_stock_value', 'cash_on_hand']
      .forEach((m) => t.check(ext.includes(m), `${m} is offered as a metric`));
    t.check(/Never propose a target for something no tool here measures/.test(ext),
      'and nothing outside what the app can measure');
    t.check(!/you must open by accounting for it before anything else/.test(ext),
      'the scoreboard no longer CLAIMS the opening sentence — it was the third rule to do so, and three cannot all be first');
    t.check(/A target behind pace is in worth_saying, and it MUST leave the meeting with either a move against it TODAY or an honest re-plan/.test(ext),
      'but the obligation that mattered survives whole: a target behind pace is answered, not merely noted');
    t.check(/never quietly replace it with an easier one/.test(ext),
      'a missed target is said, not swapped — the whole point of being measured');
    t.check(/"targets":\[\{"metric":"collections","aim":3000000/.test(ext),
      'and the plan block carries targets in its stated shape');
    t.check(/Account for the scoreboard too when week_review_data carries one/.test(ext),
      'the weekly review judges the week against its own aims');

    const mig = read('supabase/migrations/0085_manager_targets.sql');
    t.check(/check \(kind in \('meeting', 'move', 'review', 'question', 'target'\)\)/.test(mig),
      '0085 admits the target kind — without it every target is refused');
    t.check(/drop constraint if exists manager_notes_kind_check/.test(mig), 'dropping the old check by name first');
  }
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
