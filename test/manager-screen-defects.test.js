#!/usr/bin/env node
'use strict';
/*
 * Three ways the Manager screen was lying with its layout.
 *
 * None of them were wrong arithmetic. Every figure on that screen was
 * correct the whole time. What was wrong was what the screen SAID about
 * its own state — which is the class of defect this app keeps producing,
 * and the class no amount of checking the numbers catches.
 *
 *   THE SENTENCE     The state line ("nothing measures it — it named no
 *                    customer") was emitted INSIDE .mgr-acts, a flex
 *                    row, between the Skip and Discuss buttons, with
 *                    margin-left:auto. It was driven flush against
 *                    Discuss and crowded it — worst on a done or
 *                    skipped card, which has no Skip button for it to
 *                    push against. The owner found this in a screenshot.
 *                    A sentence is not a control and does not belong in
 *                    a row of them.
 *
 *   THE BUTTON       The meeting offer painted "Hold the meeting" in
 *                    accent red on every visit, and then — a moment
 *                    later, when the journal answered — rewrote it to
 *                    "Hold another anyway" and demoted it from red to
 *                    grey. The main action of the screen changed under
 *                    the owner's eyes every single time, which reads as
 *                    an app that cannot make up its mind. The stamp in
 *                    localStorage already knew the answer before any
 *                    query ran.
 *
 *   THE STALE PLAN   Four unawaited chains fill this page and nothing
 *                    cleared what the last render left. Until each
 *                    answered, yesterday's plan sat there looking
 *                    exactly like today's. There was no visual
 *                    difference between "this is your plan" and "this
 *                    is the plan from before you tapped Done".
 *
 * Run: node test/manager-screen-defects.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('manager screen defects');
const src = read('index.html');
const view = extractFunction(src, 'mgrMoveView', 'index.html');
const render = extractFunction(src, 'renderManager', 'index.html');

/* ---------- 1. the sentence has its own line ---------- */
{
  const acts = view.slice(view.indexOf('<div class="mgr-acts">'));
  t.check(!/mgr-state/.test(acts),
    'the state sentence is no longer inside the button row');
  t.check(/class="mgr-move-state"/.test(view),
    'it has a line of its own above the actions');
  t.check(view.indexOf('mgr-move-state') < view.indexOf('<div class="mgr-acts">'),
    'and that line comes BEFORE the buttons, so no auto-margin can drive it into one');
  t.check(/<p class="mgr-move-state"/.test(view),
    'emitted as a paragraph rather than a span, because it is prose');

  /* A NEW class on purpose. .mgr-state is also worn by the playbook's
     "since {date}" chip inside a different .mgr-acts, where the auto
     margin is doing useful work — editing it would have fixed one card
     and quietly restyled another. */
  t.check(/\.mgr-move-state\{[^}]*display:block/.test(src),
    'the new class is a block');
  t.check(/\.mgr-state\{[^}]*margin-left:auto/.test(src),
    'and .mgr-state keeps its auto margin, because the playbook chip still wants it');
  t.check(/\.mgr-move-state\{[^}]*max-width:\d+ch/.test(src),
    'with a measure on it — it is a sentence, and a sentence needs one');
}

/* ---------- 2. the offer is born settled ---------- */
{
  t.check(/const heldGuess = !!\(managerToday \|\| lsGet\(MANAGER_MEETING_KEY\) === todayISO\(\)\)/.test(render),
    'the offer reads this device\'s own stamp before it paints anything');
  t.check(/class="btn \$\{heldGuess \? 'btn-ghost' : 'btn-accent'\}"/.test(render),
    'and the button is BORN in the right colour rather than demoted into it');
  t.check(/\$\{\s*heldGuess \? 'Hold another anyway' : 'Hold the meeting'\}/.test(render),
    'and with the right words');

  /* The correction must survive — a meeting held on the owner's other
     device is real, and the stamp cannot know about it. What must not
     survive is correcting a guess that was already right. */
  t.check(/if\(!!st\.today !== heldGuess\)\{/.test(render),
    'the journal only speaks when it DISAGREES with the stamp — on an ordinary morning this branch does nothing');
  t.check(!/rb\.classList\.remove\('btn-accent'\)/.test(render),
    'the unconditional demotion is gone, not merely moved');
  t.check(/on another device/.test(render),
    'and when it does correct, it says why rather than silently swapping the button');
}

/* ---------- 3. nothing stale is left on screen ---------- */
{
  t.check(/mgr-reading/.test(render),
    'every container the journal fills is cleared before the query goes out');
  /* The playbook clears its own container a few lines earlier, so this
     locates the LOOP rather than the first mention of the class. */
  const loop = /\[acct,[\s\S]{0,400}?mgr-reading[\s\S]{0,120}?\}\);/.exec(render);
  t.check(!!loop, 'the clearing loop exists and names its containers in one place');
  const at = render.indexOf('managerLoadState().then');
  t.check(loop && render.indexOf(loop[0]) < at,
    'and it runs BEFORE the query goes out, not after it comes back');
  const block = loop ? loop[0] : '';
  ['acct', 'planWrap', 'scoreWrap', 'qWrap', 'revWrap', 'hist', 'passed'].forEach(n => {
    t.check(new RegExp(`\\b${n}\\b`).test(block), `${n} is among them`);
  });
  t.check(/managerTrackWrap/.test(block),
    'including the track record, which is filled by a chain nested two deep and would linger longest');
  t.check(/\.mgr-reading\{/.test(src), 'and the line has a style, so it reads as a wait rather than as content');
}

process.exit(t.done() ? 1 : 0);
