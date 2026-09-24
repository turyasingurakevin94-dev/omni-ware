#!/usr/bin/env node
'use strict';
/*
 * A move on the Manager's own screen: its face, its number, its kind,
 * its state, its evidence -- and buttons that actually do something.
 *
 * The plan and Today's queue draw moves as queue rows (.ow-q[data-mid]),
 * and mgrWirePlan only ever wired the old .mgr-move cards: Done and Not
 * now on the plan were buttons that recorded nothing. Pinned here, with
 * the reason for "not now" now typed in place instead of in a pop-up.
 *
 * Run: node test/manager-move-rows.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager move rows');
const src = read('index.html');

/* ---------- 1. the buttons reach every move --------------------------- */
{
  const wire = extractFunction(src, 'mgrWirePlan', 'index.html');
  t.check(/querySelectorAll\('\.mgr-move, \.ow-q\[data-mid\]'\)/.test(wire),
    'Done and Not now are wired on queue rows as well as on the old cards');
  t.check(/card\.querySelector\('\.mgr-skip-why'\)/.test(wire) && /if\(box && !why\)\{ box\.focus\(\);/.test(wire),
    'the reason is read from the row\'s own box, and an empty one asks rather than recording a blank');

  const calls = [];
  const els = (sel) => [];
  const listeners = {};
  const mkBtn = (name) => ({ addEventListener: (ev, fn) => { listeners[name] = fn; }, dataset: {} });
  const box = { value: '', focus: () => { calls.push('focus'); }, placeholder: '' };
  const row = { dataset: { mid: '42' }, querySelector: (sel) => ({ '.mgr-done': mkBtn('done'), '.mgr-skip': mkBtn('skip'), '.mgr-skip-why': box }[sel] || null) };
  const root = { querySelectorAll: (sel) => (sel === '.mgr-move, .ow-q[data-mid]' ? [row] : []) };
  const { mgrWirePlan } = compileScope([wire], {
    managerSetMoveStatus: (id, st, why) => calls.push([id, st, why || null]),
    goToTab: () => {}, apOpenPanel: () => {}, document: { getElementById: () => null },
    prompt: () => { calls.push('prompt'); return null; },
  }, ['mgrWirePlan']);
  mgrWirePlan(root);
  listeners.done();
  listeners.skip();
  box.value = 'waiting for Kato';
  listeners.skip();
  t.check(JSON.stringify(calls) === JSON.stringify([[42, 'done', null], 'focus', [42, 'skipped', 'waiting for Kato']]),
    'a queue row records Done, refuses a blank reason, and records Not now with its reason (got ' + JSON.stringify(calls) + ')');
  t.check(!calls.includes('prompt'), 'and a row with a box never opens the pop-up');
}

/* ---------- 2. the rich row ------------------------------------------- */
{
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const scope = compileScope([
    extractFunction(src, 'mgrRichRowHTML', 'index.html'),
    extractFunction(src, 'mgrMoveFace', 'index.html'),
    extractDeclaration(src, 'MGR_KIND_TONE', 'index.html'),
    extractDeclaration(src, 'MGR_KIND_WORD', 'index.html'),
    extractDeclaration(src, 'MGR_KIND_ICON', 'index.html'),
  ], {
    data: { customers: [{ id: 7, name: 'Kato Construction Ltd' }] },
    deriveMoveOutcome: (r) => ({ status: r.status || 'open', derived: r.status === 'done' ? 'paid 400,000 since' : null }),
    MANAGER_DOORS: { chase: { tab: 'chase', label: 'Open the money queue' } },
    MANAGER_WORTH_BASES: { cash_freed: 'cash freed' },
    mgrMoveOrder: (rows) => rows, mgrChaseRowFor: () => null, chaseResponseLine: () => '',
    supplierName: () => '', fmtUGX: (n) => n.toLocaleString('en-US') + ' UGX', fmtShortDate: (d) => d,
    OW_CARET: '', OW_CARET_C: '', esc, Math, Number, String, Array, Object,
  }, ['mgrRichRowHTML']);
  const rows = [
    { id: 1, status: 'open', body: { title: 'Collect the 13-day invoice', mkind: 'chase', door: 'chase', worth: 2515000, worthBasis: 'cash_freed', subject: { customerId: 7 }, unlocks: 'the restock' } },
    { id: 2, status: 'open', body: { title: 'Restock Masasi', mkind: 'buy', worth: 250000, after: 0 } },
    { id: 3, status: 'done', body: { title: 'Ring Sarah', mkind: 'chase', worth: 400000, doneOn: '2026-09-24' } },
    { id: 4, status: 'skipped', body: { title: 'Get a date from Peter', mkind: 'chase', skipReason: 'travelling' } },
  ];
  const open = scope.mgrRichRowHTML(rows[0], rows, { rich: true, num: 0, open: true });
  t.check(/<span class="mgr-rv-n">01<\/span><span class="mgr-av mgr-av-\d" aria-hidden="true">KC<\/span>/.test(open),
    'a move about a customer wears their initials and its number in the plan');
  t.check(/<span class="mgr-kc mgr-kt-money">Chase<\/span> /.test(open) && /Kato Construction Ltd/.test(open),
    'its kind as a chip in its door\'s colour, spaced from what follows, and the customer by name');
  t.check(/class="btn btn-accent ow-sm mgr-door"/.test(open) && /class="mgr-skip-why"/.test(open) && /class="btn btn-ghost ow-sm mgr-done"/.test(open),
    'the open move carries its door, Done, and Not now with a box for the reason');
  t.check(/aria-label="79% of the money in today's plan"/.test(open),
    'and a ring for its share of the day\'s money (2,515,000 of 3,165,000)');
  t.check(/Unlocks: the restock/.test(open), 'with what it makes possible as a chip');
  const waiting = scope.mgrRichRowHTML(rows[1], rows, { rich: true, num: 1 });
  t.check(/waiting on 01/.test(waiting) && /mgr-av-k mgr-kt-buy/.test(waiting),
    'a move that waits on another names its number, and one about no one wears its kind\'s mark');
  const done = scope.mgrRichRowHTML(rows[2], rows, { rich: true, num: 2 });
  t.check(/mgr-rv-done/.test(done) && /mgr-sc mgr-sc-done/.test(done) && /paid 400,000 since/.test(done) && !/mgr-done"/.test(done),
    'a done move says so, with what the books saw since, and offers no Done again');
  const skipped = scope.mgrRichRowHTML(rows[3], rows, { rich: true, num: 3 });
  t.check(/mgr-rv-skipped/.test(skipped) && /“travelling”/.test(skipped), 'a move set aside shows the owner\'s own reason');
  t.check(/mgrQueueRowHTML\(r, rows, \{ kindChip: true, open, rich: true, num: ordered\.indexOf\(r\) \}\)/.test(src),
    'the Manager\'s plan draws rich rows; Today\'s queue keeps its compact one');
}

process.exit(t.done() ? 1 : 0);
