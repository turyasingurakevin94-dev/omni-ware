#!/usr/bin/env node
'use strict';
/*
 * Two lists name the shop's departments: MANAGER_DEPTS, which the meeting's
 * [plan:] block is checked against when it is saved, and MGR_DEPTS, which the
 * screen draws its tiles, chips and filters from. A department the meeting
 * may name but the screen cannot draw -- or the reverse -- would leave a
 * decision with no tile, or a tile no decision can reach. Same six words,
 * same order.
 *
 * Run: node test/manager-depts-agree.test.js   (or: npm test)
 */
const { read, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager departments agree');
const src = read('index.html');
const scope = compileScope([
  extractDeclaration(src, 'MANAGER_DEPTS', 'index.html'),
  extractDeclaration(src, 'MGR_DEPTS', 'index.html'),
  'function lists(){ return { MANAGER_DEPTS, MGR_DEPTS }; }',
], {}, ['lists']).lists();

const saved = scope.MANAGER_DEPTS;
const drawn = scope.MGR_DEPTS.map((d) => d.id);
t.check(JSON.stringify(saved) === JSON.stringify(drawn),
  `the departments the meeting may name are the ones the screen draws, in the same order (saved ${JSON.stringify(saved)}, drawn ${JSON.stringify(drawn)})`);
t.check(saved.length === 6, 'six of them: finance, sales, procurement, store, people, marketing');
t.check(new Set(scope.MGR_DEPTS.map((d) => d.mono)).size === 6, 'and each wears its own letter');

process.exit(t.done() ? 1 : 0);
