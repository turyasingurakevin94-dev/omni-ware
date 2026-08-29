#!/usr/bin/env node
'use strict';
/*
 * Make the morning brief again.
 *
 * Eight builds, eight features, and every one of them added an
 * obligation to the morning meeting. The instructions went from 7,536
 * characters to 17,806, and 81% of that governed the meeting rather
 * than the review. Three separate sentences each claimed to be the one
 * the answer opened with — "open by accounting for your own last
 * advice", "NAME THE WEEK'S OBJECTIVE FIRST", and, added two builds
 * later, "you must open by accounting for it BEFORE ANYTHING ELSE".
 * Only one of three can be first.
 *
 * And every move was walked through in prose while its own card
 * already carried the title, the worth, the whole argument and the
 * door — the answer paid for twice, out of a budget the plan block
 * already spends a third of.
 *
 * Three laws, and the second is the one that does the work:
 *
 *   AN OCCASION GETS ITS OWN RULES  a morning plans a day and must be
 *       readable standing up; a review judges a week and is meant to
 *       be long. They shared one block, so each carried the other's.
 *   HAND LESS, DO NOT ASK FOR RESTRAINT  a rule saying "be brief" is
 *       weaker than an answer that hands less. manager_history now
 *       sorts what it knows into what is WORTH SAYING and what is
 *       merely for restraint — and says which is which.
 *   A FACT THAT LIVES ONE TURN IS NOT RECORDED  a meeting that ran out
 *       of room said so once and forgot. Now it is journalled, because
 *       it is the only evidence that would show this build failing.
 *
 * Run: node test/manager-brief.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the morning brief');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const shift = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- 1. two occasions, two rulebooks -------------------------- */
{
  const grab = (name) => {
    const i = api.indexOf('const ' + name + ' = [');
    t.check(i > -1, `${name} exists`);
    return api.slice(i, api.indexOf('\n];', i));
  };
  const common = grab('MANAGER_COMMON');
  const meeting = grab('MANAGER_MEETING');
  const review = grab('MANAGER_REVIEW');

  t.check(!/THE WEEKLY REVIEW\./.test(meeting) && !/JUDGE THE STRATEGIES/.test(meeting),
    'the morning carries NO review rules — it used to read 3,277 characters about judging a week it was not judging');
  t.check(!/THE MORNING MEETING\./.test(review) && !/Plays worth knowing in this trade/.test(review),
    'and the review carries no meeting rules — it used to read 12,247 characters about planning a day it was not planning');
  ['Never forecast', 'STANDING POLICIES', 'THE LONGER ARC', 'Follow-up questions']
    .forEach((p) => t.check(new RegExp(p).test(common), `what binds on both occasions is shared once: ${p}`));
  t.check(!new RegExp('Never forecast').test(meeting) && !new RegExp('Never forecast').test(review),
    'and is not duplicated into either — one reading of a rule, as of everything else here');

  /* NOTHING MAY BE LOST IN THE SPLIT. Writing this file I dropped two
     whole paragraphs — the order of work and the entire targets rule —
     and every other check still passed, because each one only asked
     what was ABSENT. A rule that survives in none of the three blocks
     has been deleted by accident, and this is the only thing that
     would say so. */
  const RULES = [
    'THE MORNING MEETING\\.', 'HOW THE MORNING READS', 'Order of work: call manager_history FIRST',
    'NAME THE WEEK', 'Compose the day: pick AT MOST FIVE moves',
    'After the prose, end with EXACTLY ONE machine block',
    'WHEN YOU TURN DOWN A BUY', 'A hold is an argument, never a lock',
    'ASK FOR WHAT THE BOOKS CANNOT HOLD', 'BE MEASURED\\.',
    'THE PLAYBOOK', 'Propose AT MOST TWO plays in a meeting',
    'Plays worth knowing in this trade',
    'THE WEEKLY REVIEW\\.', 'JUDGE THE STRATEGIES', 'When a play carries too_early',
    'Never forecast', 'THE LONGER ARC', 'STANDING POLICIES\\.', 'Follow-up questions',
  ];
  RULES.forEach((r) => {
    const re = new RegExp(r);
    const homes = [common, meeting, review].filter((b) => re.test(b)).length;
    eq(homes, 1, `the rule survives the split, in exactly one block: ${r.replace(/\\/g, '')}`);
  });

  t.check(meeting.length + common.length < 15000,
    `the morning's rulebook is materially smaller than the 17,806 it was (now ${meeting.length + common.length})`);
  t.check(review.length + common.length < 8000,
    `and the review's is a third of what it was (now ${review.length + common.length})`);

  /* The selector, run rather than read. */
  const pick = compileScope([
    extractDeclaration(api, 'MANAGER_COMMON', 'api/assistant.js'),
    extractDeclaration(api, 'MANAGER_MEETING', 'api/assistant.js'),
    extractDeclaration(api, 'MANAGER_REVIEW', 'api/assistant.js'),
    extractFunction(api, 'managerExtension', 'api/assistant.js')], {}, ['managerExtension']).managerExtension;
  t.check(/HOW THE MORNING READS/.test(pick('manager')), 'the meeting mode gets the meeting rules');
  t.check(/THE WEEKLY REVIEW\./.test(pick('manager-review')), 'the review mode gets the review rules');
  t.check(/STANDING POLICIES/.test(pick('manager')) && /STANDING POLICIES/.test(pick('manager-review')),
    'and both get the common ones');
  t.check(!/THE WEEKLY REVIEW\./.test(pick('manager')),
    'a meeting never sees the review rules — the whole point of the split');

  /* An unknown mode must not silently land on the wrong rulebook. */
  t.check(/rawMode === 'manager' \|\| rawMode === 'manager-review'/.test(api),
    'the server validates the mode against the two names the app sends');
  t.check(/system: mgrMode/.test(api),
    'and an unknown one is the plain assistant, never a fall-through to a manager rulebook');
}

/* ---------- 2. one opening, and no walking the moves ----------------- */
{
  const i = api.indexOf('const MANAGER_MEETING = [');
  const meeting = api.slice(i, api.indexOf('\n];', i));

  t.check(/HOW THE MORNING READS \\u2014 THREE OR FOUR SENTENCES, THEN THE BLOCK/.test(meeting),
    'the morning has ONE shape, said once, at the top');
  t.check(/NEVER WALK THROUGH THE MOVES IN PROSE/.test(meeting),
    'and never walks the moves — every one is already drawn in full on its own card');
  t.check(/spends the answer twice and buys the owner nothing/.test(meeting),
    'with the reason said, so it is a judgement and not an arbitrary ban');

  /* The three rivals for the opening slot: all gone but one. */
  t.check(!/open by accounting for your own last advice/.test(api),
    'the first rival opening is deleted, not softened');
  t.check(!/you must open by accounting for it before anything else/.test(api),
    'and so is the one I added two builds later that claimed to outrank both');
  eq((meeting.match(/NAME THE WEEK\\u2019S OBJECTIVE FIRST/g) || []).length, 1,
    'exactly one sentence now says what comes first');

  /* The competing first tool call. */
  t.check(!/Read standing_policies FIRST/.test(api),
    'and standing_policies no longer also claims to be the first thing read');
  t.check(/Read standing_policies before you propose one/.test(api),
    'it is read before proposing one, which is what it always meant');

  /* What survives is the cheap kind: restraints cost nothing to obey. */
  ['EVERY MOVE MUST SERVE THAT OBJECTIVE OR BE DROPPED', 'you must not ask again',
    'NEVER propose a play the shop has tried and dropped', 'NEVER hold a line that is already held']
    .forEach((r) => t.check(new RegExp(r).test(meeting), `the restraint survives: ${r}`));
  t.check(/MUST leave the meeting with either a move against it TODAY or an honest re-plan/.test(meeting),
    'and the one recital worth its cost survives too — a target behind pace must be answered, not noted');
}

/* ---------- 3. the tool hands less ----------------------------------- */
(async () => {
  const journal = (over) => ({
    meeting: [{ id: 1, date: shift(TODAY, -1), body: { keyline: 'k' } }],
    move: [], review: [], target: [], play: [], question: [], ...over,
  });
  const run = (jr, data, over) => {
    const scope = compileScope([
      extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
      extractDeclaration(src, 'MANAGER_METRICS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEMS', 'index.html'),
      extractDeclaration(src, 'MANAGER_PROBLEM_METRICS', 'index.html'),
      extractDeclaration(src, 'BUY_HOLD_MAX_DAYS', 'index.html'),
      extractFunction(src, 'booksStartDate', 'index.html'),
      extractFunction(src, 'managerPlayProgress', 'index.html'),
      extractFunction(src, 'managerPlaybook', 'index.html'),
      extractFunction(src, 'managerScoreboard', 'index.html'),
      extractFunction(src, 'managerScoreProgress', 'index.html'),
      extractFunction(src, 'managerRecentReviews', 'index.html'),
      extractFunction(src, 'managerReviewBrief', 'index.html'),
      extractFunction(src, 'deriveMoveOutcome', 'index.html'),
      extractFunction(src, 'buyHoldsStanding', 'index.html'),
      extractFunction(src, 'buyHoldFor', 'index.html'),
      extractFunction(src, 'buyKeyParts', 'index.html'),
      extractFunction(src, 'buyKeyLabel', 'index.html'),
      extractFunction(src, 'buyPriceStamp', 'index.html'),
      extractFunction(src, 'buyPriceNow', 'index.html'),
      'function names(){ return { ASSISTANT_TOOLS }; }',
    ], {
      data: { customers: [{ id: 1, debt: 6500000 }], savedQuotes: [], products: [], stockLog: [], purchaseInvoices: [], cashTxns: [], presetBuyHolds: {}, ...(data || {}) },
      managerNotesTable: true, currentShopId: 'shop-1',
      todayISO: () => TODAY, anShiftDate: shift,
      daysSinceDate: (d) => Math.round((new Date(TODAY + 'T00:00:00Z') - new Date(d + 'T00:00:00Z')) / 86400000),
      apRound: (n) => Math.round(Number(n) || 0), fmtUGX: (n) => String(n),
      anInvoicesInRange: () => [], anOverallTotals: () => ({ sales: 0, profit: 0, count: 0 }),
      debtCollectionsOn: () => ({ total: 100000 }),
      dashInventoryHealth: () => ({ deadValue: 0 }), cashOnHandByAccount: () => ({ total: 0, byAccount: [] }),
      productDisplayLabel: (p, vi) => p.name, effectiveStockMarkupRule: () => null,
      rankedPurchaseRowsAtQty: () => [], suggestedStockSellingPrice: () => null,
      console, Date, JSON, Math, Number, String, Array, Object, Promise,
      sb: { from: () => { const q = { _kind: null };
        q.select = () => q; q.order = () => q; q.in = () => q; q.gte = () => q; q.lte = () => q;
        q.eq = (c, v) => { if (c === 'kind') q._kind = v; return q; };
        q.limit = () => Promise.resolve({ data: jr[q._kind] || [], error: null });
        q.then = (res) => res({ data: jr[q._kind] || [], error: null });
        return q; } },
      ...(over || {}),
    }, ['names']).names();
    return scope.ASSISTANT_TOOLS.manager_history.run({ limit: 3 });
  };

  /* A quiet shop: nothing off course, nothing new. */
  {
    const out = await run(journal());
    eq(out.worth_saying.length, 0, 'a quiet morning has nothing worth saying');
    t.check(/handful of words/.test(out.nothing_new || ''),
      'and is told to say so briefly rather than filling the silence with bookkeeping');
  }

  /* A target behind its own pace is news; one on course is not. */
  {
    const targets = [
      { id: 1, date: shift(TODAY, -6), status: 'open', body: { metric: 'collections', aim: 3000000,
        baseline: 0, from: shift(TODAY, -6), to: shift(TODAY, 1), why: 'w' } },
    ];
    const out = await run(journal({ target: targets }));
    const behind = out.worth_saying.filter((x) => x.kind === 'target_behind');
    eq(behind.length, 1, 'a target behind its pace is the first thing worth saying');
    eq(behind[0].metric, 'collections', 'named');
    t.check(behind[0].behind_by > 0, 'with how far behind it is');

    /* Same target, comfortably ahead: silence. */
    const ahead = await run(journal({ target: [{ ...targets[0],
      body: { ...targets[0].body, aim: 100 } }] }));
    eq(ahead.worth_saying.filter((x) => x.kind === 'target_behind').length, 0,
      'a target ON COURSE is not news — that is the entire point of a pace line, and it used to cost a paragraph anyway');
    t.check(Array.isArray(ahead.scoreboard) && ahead.scoreboard.length === 1,
      'though the scoreboard is still there to argue from when a move needs it');
  }

  /* An answer the shop went and found since the last meeting. */
  {
    const qs = [
      { id: 9, date: shift(TODAY, -3), status: 'answered', body: { question: 'What does Roto charge for 40?', answer: '96,000 each', answeredOn: TODAY } },
      { id: 8, date: shift(TODAY, -20), status: 'answered', body: { question: 'Old news', answer: 'Answered ages ago', answeredOn: shift(TODAY, -15) } },
      { id: 7, date: shift(TODAY, -4), status: 'open', body: { question: 'Still waiting on this one' } },
    ];
    const out = await run(journal({ question: qs }));
    const fresh = out.worth_saying.filter((x) => x.kind === 'question_answered');
    eq(fresh.length, 1, 'only the answer that came in SINCE the last meeting is news');
    eq(fresh[0].answer, '96,000 each', 'with what the shop found out');
    t.check(!fresh.some((x) => /Old news/.test(x.asked)),
      'an answer from a fortnight ago has already been used and is not raised again');

    /* And the restraint list is names only. */
    t.check(Array.isArray(out.do_not_repeat.open_questions), 'the open questions are listed for restraint');
    eq(out.do_not_repeat.open_questions[0], 'Still waiting on this one', 'by their text alone');
    t.check(typeof out.do_not_repeat.open_questions[0] === 'string',
      'as bare strings, not rows — there is nothing there to recite even if the mind wanted to');
  }

  /* Plays and holds: names for restraint, movement for news. */
  {
    const started = shift(TODAY, -21);
    const plays = [
      { id: 5, date: started, status: 'running', body: { name: 'Charge for cutting', treats: 'margin', how: 'h', source: 'manager', startedOn: started } },
      { id: 4, date: started, status: 'dropped', body: { name: 'Bulk-lot the dead stock', treats: 'dead_stock', source: 'manager' } },
    ];
    const data = {
      products: [{ id: 'P1', name: 'Runners Masasi', variants: [] }],
      presetBuyHolds: {
        P1: { reason: 'Reprice first', placedOn: shift(TODAY, -18), by: 'manager',
          rule: { wholesale: 'none', retail: 'none' }, price: null },
      },
    };
    const out = await run(journal({ play: plays }), data);

    eq(out.do_not_repeat.plays_running[0], 'Charge for cutting', 'a running play is named, for restraint');
    eq(out.do_not_repeat.plays_dropped[0], 'Bulk-lot the dead stock', 'and so is a dropped one');
    eq(out.do_not_repeat.lines_held[0], 'Runners Masasi', 'and a held line');
    t.check(out.do_not_repeat.plays_running.every((x) => typeof x === 'string'),
      'all of them names only — the restraint list can never become a recital');

    const stale = out.worth_saying.filter((x) => x.kind === 'hold_going_stale');
    eq(stale.length, 1, 'a hold standing eighteen days with nothing repriced IS worth saying');
    eq(stale[0].line, 'Runners Masasi', 'by name');

    /* A fresh hold is not news — it was this week's own decision. */
    const fresh = await run(journal({ play: plays }), { ...data,
      presetBuyHolds: { P1: { ...data.presetBuyHolds.P1, placedOn: shift(TODAY, -2) } } });
    eq(fresh.worth_saying.filter((x) => x.kind === 'hold_going_stale').length, 0,
      'a hold placed two days ago is not going stale, and saying so would be noise');
  }

  /* A review written since the last meeting: today is the first chance
     to act on its lessons. */
  {
    const out = await run(journal({ review: [{ id: 3, date: TODAY, status: 'held',
      body: { verdict: 'A hard week saved by collections.', lessons: ['Chases without a date go nowhere'] } }] }));
    const nr = out.worth_saying.filter((x) => x.kind === 'new_review');
    eq(nr.length, 1, 'a review written since the last meeting is news');
    eq(nr[0].lessons[0], 'Chases without a date go nowhere', 'with its lessons');

    const old = await run(journal({ review: [{ id: 3, date: shift(TODAY, -9), status: 'held',
      body: { verdict: 'v', lessons: ['l'] } }] }));
    eq(old.worth_saying.filter((x) => x.kind === 'new_review').length, 0,
      'one from before the last meeting has already been acted on, and is not raised twice');
    t.check(!!old.last_review, 'though it is still there to argue from');
  }

  /* The caps the uncapped keys never had. */
  {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, date: shift(TODAY, -6),
      status: 'open', body: { metric: 'collections', aim: 3000000, baseline: 0,
        from: shift(TODAY, -6), to: shift(TODAY, 1), why: 'w' } }));
    const out = await run(journal({ target: many }));
    t.check(out.scoreboard.length <= 6, 'the scoreboard is capped, as every sibling already was');
    t.check(out.worth_saying.filter((x) => x.kind === 'target_behind').length <= 3,
      'and at most three of them can be worth saying — a brief is not a list');
  }

  /* ---------- 4. a cut-off meeting says so afterwards --------------- */
  {
    const save = extractFunction(src, 'managerSaveMeeting', 'index.html');
    t.check(/\.\.\.\(plan\.cutOff \? \{ cutOff: true \} : \{\}\)/.test(save),
      'a meeting that ran out of room is written down as such');
    const commit = extractFunction(src, 'managerCommitPlan', 'index.html');
    t.check(/if\(apCutOffThisSitting\) apLastPlan\.cutOff = true;/.test(commit),
      'stamped on the plan itself, so the card drawn from memory today and from the journal tomorrow agree');
    t.check(/let apCutOffThisSitting = false;/.test(src),
      'on a flag that outlives the single send apWasCutOff lived for');
    const loop = extractFunction(src, 'apRunLoop', 'index.html');
    t.check(/apCutOffThisSitting = true;/.test(loop), 'set where the ceiling is actually hit');
    const render = extractFunction(src, 'renderManager', 'index.html');
    t.check(/ran out of room mid-answer/.test(render),
      'and the owner is told, rather than left to wonder why the plan looks thin');

    const out = await run({ meeting: [{ id: 1, date: shift(TODAY, -1), body: { keyline: 'k', cutOff: true } }],
      move: [], review: [], target: [], play: [], question: [] });
    eq(out.meetings[0].ran_out_of_room, true,
      'and the next meeting can see that the last one was cut short');
  }

  /* ---------- 5. the occasions are wired at the client too ---------- */
  {
    t.check(/apMode = 'manager-review';/.test(src),
      'the review declares its own occasion, so the server can hand it its own rules');
    const loop = extractFunction(src, 'apRunLoop', 'index.html');
    t.check(/if\(apMode === 'manager'\)\{ try\{ await managerCommitPlan\(\)/.test(loop),
      'and a REVIEW never journals a plan — it emits none by contract, so committing on one could only journal a stale plan as if today had proposed it');
    t.check(/A review emits no \[plan:\] block by contract/.test(src),
      'with the reason written where the next reader will need it');
  }

  /* ---------- 6. the tool says which half is which ----------------- */
  {
    t.check(/worth_saying is what is off course or new since the last meeting/.test(api),
      'the tool tells the mind what worth_saying is, before it is ever called');
    t.check(/it IS the morning’s opening sentences: there is nothing else to open with/.test(api),
      'and that it IS the opening — leaving nothing for a competing rule to claim');
    t.check(/FOR YOUR RESTRAINT AND NOT FOR YOUR PROSE/.test(api),
      'and that the other half is for restraint, in those words');
    t.check(/never read the list back to the owner/.test(api),
      'said plainly enough that reciting it would be a rule broken, not a rule missing');
  }
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
