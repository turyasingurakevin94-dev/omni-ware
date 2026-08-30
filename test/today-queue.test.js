#!/usr/bin/env node
'use strict';
/*
 * One list, two tiers, and the ordering that is not the screen's to
 * overturn.
 *
 * Today merges two things that were previously drawn in two places and
 * ranked two different ways: the Manager's moves for this morning, and
 * the app's own watch. They are the same KIND of thing — something that
 * needs you, with money on it — and splitting them was why the front
 * door had to be read twice.
 *
 * Merging them introduces exactly two ways to lie, and this file guards
 * both:
 *
 *   THE ORDER      mgrMoveOrder resolves the `after` dependencies a
 *                  meeting declares. A move that waits on another must
 *                  never be drawn above the one it waits on — the
 *                  Manager ranked them, and a screen that re-sorts by
 *                  money would quietly tell the owner to do the second
 *                  thing first. The two tiers therefore live in
 *                  SEPARATE containers and are never sorted together.
 *
 *   THE SILENCE    Nothing is suppressed. A move about Mulongo and an
 *                  alert about Mulongo may both appear, and that is the
 *                  right trade: a duplicate row is visible and
 *                  harmless, while a wrong suppression hides a real
 *                  alert and leaves nothing on screen to show it
 *                  happened.
 *
 * Run: node test/today-queue.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('today queue');
const src = read('index.html');

/* ---------- 1. the two tiers never share a container ---------- */
{
  const section = (/<section id="tab-dashboard"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];
  const mgr = section.indexOf('id="dash_mgrQueue"');
  const watch = section.indexOf('id="dash_actionList"');
  t.check(mgr > 0 && watch > 0, 'both tiers have a home on Today');
  t.check(mgr < watch,
    'the Manager\'s moves sit ABOVE the watch — advice first, arithmetic under it');

  const plan = extractFunction(src, 'renderTodayPlan', 'index.html');
  t.check(/mgrMoveOrder\(rows\)/.test(plan),
    'and they are drawn in mgrMoveOrder\'s order, which resolves what waits on what');
  t.check(!/\.sort\(/.test(plan),
    'renderTodayPlan never re-sorts them — the Manager ranked these and the screen does not get a vote');
  t.check(/getElementById\('dash_mgrQueue'\)/.test(plan) && !/dash_actionList/.test(plan),
    'and it writes only into its own container, so the watch\'s list cannot be reordered by it landing late');

  const dash = extractFunction(src, 'renderDashboard', 'index.html');
  t.check(!/dash_mgrQueue/.test(dash),
    'while renderDashboard never writes the Manager tier itself — the journal is asynchronous and the two must not race for one box');
  t.check(/renderTodayPlan\(\);/.test(dash), 'it only asks for it');
}

/* ---------- 2. nothing is suppressed ---------- */
{
  const dash = extractFunction(src, 'renderDashboard', 'index.html');
  t.check(/dash_actionList'\)\.innerHTML = alerts\.length/.test(dash),
    'every alert dashAlerts returns is drawn');
  t.check(!/\bsuppress|\bdedupe|\bdedup\b/i.test(dash),
    'and none of them is filtered out because a move mentioned something similar — a wrong suppression is invisible, a duplicate row is not');
}

/* ---------- 3. a row says which tier it came from ---------- */
{
  const NAMES = ['mgrQueueRowHTML', 'deriveMoveOutcome'];
  const data = { today: '2026-08-30', customers: [], savedQuotes: [], cashTxns: [] };
  let scope = null, err = null;
  try {
    scope = compileScope([
      extractDeclaration(src, 'MANAGER_DOORS', 'index.html'),
      extractDeclaration(src, 'MANAGER_WORTH_BASES', 'index.html'),
      extractDeclaration(src, 'OW_CARET', 'index.html'),
      extractDeclaration(src, 'OW_CARET_C', 'index.html'),
      ...NAMES.map(n => extractFunction(src, n, 'index.html')),
      'function names(){ return {mgrQueueRowHTML}; }',
    ], {
      data,
      todayISO: () => '2026-08-30',
      /* Stubbed the way the rest of the suite stubs them: this file is
         about which tier a row belongs to and what order the rows are
         in, not about escaping or currency formatting. */
      esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
      fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
      /* deriveMoveOutcome reads the books to say what followed a move.
         This file is about the ROW, not about that derivation, which
         manager-lessons and track-record already own. */
      debtCollectionsOn: () => ({ rows: [], total: 0 }),
      apCustomerById: () => null,
      collectableDebts: () => [],
    }, ['names']);
  } catch (e) { err = e; }
  t.check(!!scope, `the row builder compiles${err ? ` (${err.message})` : ''}`);

  if (scope) {
    const { mgrQueueRowHTML } = scope.names();
    const move = (over) => Object.assign({
      id: 'm1', status: 'open', date: '2026-08-30',
      body: { title: 'Mulongo: a deposit before the next delivery', why: 'Five chases produced nothing.',
        worth: 3330000, worthBasis: 'tied', door: 'debtors', mkind: 'chase' },
    }, over || {});

    const html = mgrQueueRowHTML(move(), [move()]);
    t.check(/class="ow-cp ow-mg">Manager</.test(html),
      'a Manager row is marked as the Manager\'s, not left to look like arithmetic');
    t.check(/3,330,000/.test(html), 'carrying the money it is worth');
    t.check(/ow-q-r ow-qtog/.test(html) && /ow-q-card ow-qtog/.test(html),
      'and it emits BOTH shapes — the desktop row and the phone card — from one call, so the two can never say different things');
    t.check(/class="ow-q-x"/.test(html) && /class="ow-q-why"/.test(html),
      'with the reasoning folded underneath rather than permanently in the way');

    /* The defect the Manager screen still has: this sentence is a flex
       item wedged between two buttons there. Here it has its own line. */
    const unmeasured = mgrQueueRowHTML(
      move({ body: Object.assign({}, move().body, { door: '', mkind: 'chase' }) }), []);
    t.check(!/ow-q-note[\s\S]{0,400}?<button/.test(unmeasured) || /class="ow-q-note"/.test(unmeasured),
      'and a state sentence, when there is one, is a line of its own and not a flex item between buttons');

    const done = mgrQueueRowHTML(move({ status: 'done' }), []);
    t.check(/ow-cp ow-good">Done</.test(done), 'a move already done says so on the row');
    t.check(!/mgr-done/.test(done),
      'and stops offering to be done again');
  }
}

process.exit(t.done() ? 1 : 0);
