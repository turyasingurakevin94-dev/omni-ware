#!/usr/bin/env node
'use strict';
/*
 * A meeting that was cut off must still reach the journal.
 *
 * Live: a meeting ran past max_tokens, the owner said "continue" twice,
 * and the Manager finished with "five moves, two targets and three
 * questions are on the Manager screen for you to act on" -- and none of
 * them existed. The commit sat in the finally of the FIRST apRunLoop,
 * where apLastPlan was still null because the plan block had not been
 * written yet. The turns that carried it went through apSend, and
 * nothing there saved anything. The whole meeting was lost while its
 * author announced it, and with it the targets that the scoreboard and
 * the dashboard pace line both stand on.
 *
 * So the law: A MEETING IS COMMITTED WHEN ITS PLAN ARRIVES, whichever
 * turn carries it -- and committed exactly ONCE, because a plan written
 * twice is a journal that double-counts its own advice.
 *
 * Run: node test/manager-resume.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('the resumed meeting');
const src = read('index.html');
const api = read('api/assistant.js');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* One scope, one mutable apLastPlan — the same variable the panel sets
   when a [plan:] block finally parses, on whatever turn that is. */
const state = { apLastPlan: null, saved: [], stamps: [], renders: 0 };
const mk = () => {
  const scope = compileScope([
    'let apLastPlan = null;',
    'let managerToday = null;',
    // Whether this sitting ever ran out of room. The commit stamps it on
    // the plan, so the card drawn today and the one drawn from the
    // journal tomorrow cannot disagree about it.
    'let apCutOffThisSitting = false;',
    'function sayCutOff(){ apCutOffThisSitting = true; }',
    // The real marker, declared as the app declares it — the identity
    // check that makes a commit idempotent is the point of this file.
    extractDeclaration(src, 'managerCommittedPlan', 'index.html'),
    extractFunction(src, 'managerCommitPlan', 'index.html'),
    'function setPlan(p){ apLastPlan = p; }',
    'function today(){ return managerToday; }',
  ], {
    todayISO: () => '2026-08-30',
    lsSet: (k, v) => { state.stamps.push([k, v]); },
    MANAGER_MEETING_KEY: 'owManagerMeetingOn',
    managerSaveMeeting: async (plan) => { state.saved.push(plan); return 1; },
    renderManager: () => { state.renders++; },
    renderManagerCard: () => {},
    Array, String, Promise,
  }, ['managerCommitPlan', 'setPlan', 'today', 'sayCutOff']);
  return scope;
};

/* ---------- 1. nothing to commit is not a commit --------------------- */
(async () => {
  {
    const s = mk();
    eq(await s.managerCommitPlan(), false, 'a turn that carried no plan commits nothing');
    eq(state.saved.length, 0, 'and writes nothing');
    s.setPlan({ keyline: 'k', moves: [] });
    eq(await s.managerCommitPlan(), false, 'a plan with no moves is not a plan');
    eq(state.saved.length, 0, 'so still nothing is written');
  }

  /* A meeting that ran out of room says so on the record. The fact
     used to live for one send and then vanish, so nobody could tell
     afterwards whether the instructions had grown too heavy to answer
     in one go -- which is the only evidence that would show it. */
  {
    state.saved.length = 0;
    const s = mk();
    s.setPlan({ keyline: 'k', moves: [{ title: 'Chase Mulongo', why: 'w' }] });
    eq(await s.managerCommitPlan(), true, 'a whole meeting commits');
    eq(state.saved[0].cutOff, undefined, 'and says nothing about running out of room, because it did not');

    state.saved.length = 0;
    const s2 = mk();
    s2.sayCutOff();
    s2.setPlan({ keyline: 'k', moves: [{ title: 'Chase Mulongo', why: 'w' }] });
    eq(await s2.managerCommitPlan(), true, 'a cut-off meeting still commits — that law is older than this one');
    eq(state.saved[0].cutOff, true,
      'and carries the fact that it ran out of room into the journal with it');
  }

  /* ---------- 2. the plan that lands two turns later is kept --------- */
  {
    state.saved.length = 0; state.stamps.length = 0; state.renders = 0;
    const s = mk();
    /* Turn one: cut off at max_tokens, no block yet. */
    eq(await s.managerCommitPlan(), false, 'the truncated turn commits nothing');
    /* Turn two, after "continue": the block arrives. */
    const plan = { keyline: 'Cash first', objective: { name: 'cash', why: 'cover is 0.0 months' },
      moves: [{ title: 'Chase Mulongo', why: 'w', worth: 3330000 }],
      targets: [{ metric: 'collections', aim: 3000000, why: 'y' }],
      asks: ['What does Roto charge for 40?'] };
    s.setPlan(plan);
    eq(await s.managerCommitPlan(), true, 'the turn that carries the plan commits it');
    eq(state.saved.length, 1, 'the meeting is journalled');
    t.check(state.saved[0] === plan,
      'the WHOLE plan — moves, targets and questions travel together, exactly as it arrived');
    eq(state.saved[0].targets.length, 1, 'the targets the owner never saw are in it');
    eq(state.saved[0].asks.length, 1, 'and the questions');
    eq(state.stamps[0][1], '2026-08-30', 'today is stamped, so the invite stands down');
    t.check(state.renders > 0, 'and the screen is redrawn — the plan appears without another meeting');
    eq(s.today().date, '2026-08-30', 'the session copy is set too, for a shop with no memory table');
  }

  /* ---------- 3. committed once, however many turns ------------------ */
  {
    state.saved.length = 0;
    const s = mk();
    const plan = { moves: [{ title: 'One', why: 'w', worth: 1 }] };
    s.setPlan(plan);
    await s.managerCommitPlan();
    await s.managerCommitPlan();
    await s.managerCommitPlan();
    eq(state.saved.length, 1,
      'three turns after the plan landed still write ONE meeting — a journal that double-counts its own advice is worse than none');

    const second = { moves: [{ title: 'A new meeting', why: 'w', worth: 2 }] };
    s.setPlan(second);
    eq(await s.managerCommitPlan(), true, 'but a genuinely new plan is a new meeting');
    eq(state.saved.length, 2, 'and is written');
  }

  /* ---------- 4. wired where every turn passes ----------------------- */
  {
    const loop = extractFunction(src, 'apRunLoop', 'index.html');
    t.check(/if\(apMode === 'manager'\)\{ try\{ await managerCommitPlan\(\); \}/.test(loop),
      'every turn taken in manager mode commits a plan that has landed — apSend goes through here, and that is where the resumed plan arrives');
    t.check(/catch\(e\)\{ console\.warn\('Manager: plan not committed:'/.test(loop),
      'and a failure to commit never takes the panel down with it');

    const meeting = extractFunction(src, 'runManagerMeeting', 'index.html');
    t.check(/const committed = await managerCommitPlan\(\);/.test(meeting),
      'the meeting itself commits through the same one function, not a second copy of the rules');
    t.check(!/await managerSaveMeeting\(apLastPlan\)/.test(meeting),
      'and no longer saves inline — one path, one behaviour');
    t.check(/if\(!committed && !apLastPlan && !apWasCutOff\)/.test(meeting),
      'the "no plan sheet came back" line is held back when the answer was merely cut off — the plan is still coming');

    const review = extractFunction(src, 'runManagerReview', 'index.html');
    t.check(/managerCommittedPlan = null;/.test(review) || /managerCommittedPlan = null;/.test(meeting),
      'a fresh occasion clears the committed marker, so the next plan can be written');
  }

  /* ---------- 5. the owner is told the plan is not lost --------------- */
  {
    const loop = extractFunction(src, 'apRunLoop', 'index.html');
    t.check(/The plan is not lost: it is kept the moment the meeting finishes\./.test(loop),
      'a cut-off meeting says the plan survives — otherwise "cut off" reads as "start again"');
    t.check(/apMode === 'manager' \?/.test(loop),
      'and says it only in a meeting, where there is a plan to lose');
  }

  /* ---------- 6. the meeting stops writing itself twice -------------- */
  {
    const ext = api.slice(api.indexOf('const MANAGER_COMMON'), api.indexOf('function managerExtension'));
    t.check(/KEEP THE PROSE SHORT/.test(ext), 'the meeting is told to keep its prose short');
    t.check(/the cards on the Manager screen carry every move in full/.test(ext),
      'because the cards already carry each move — writing both at length spends the answer twice');
    t.check(/shorten the PROSE: the block is the part that must never be lost/.test(ext),
      'and when the answer runs long the block is what survives');
  }
})().then(() => { process.exit(t.done() ? 1 : 0); })
  .catch((e) => { console.error(e); process.exit(1); });
