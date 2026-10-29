#!/usr/bin/env node
'use strict';
/*
 * The parity specs (test/parity/<tab>.json) and verdicts are well formed,
 * so a typo in a tab builder's spec fails here, in plain npm test, not
 * halfway through a parity run (tools/parity/run.cjs; test/parity/README.md).
 *
 * Run: node test/parity-specs.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('parity specs');
const TABS = ['today', 'chats', 'sell', 'counter', 'orders', 'customers', 'parts'];
// parts.json holds the two parts boards (Main, Main2), whose canvas page is "lang".
const PAGE = (tab) => (tab === 'parts' ? 'lang' : tab);
const canvas = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/canvas/sales-agent/boards/canvas.json'), 'utf8'));
const STEP_KEYS = new Set(['tap', 'type', 'into', 'press', 'wait', 'scroll', 'settle']);
const seen = new Map();

for (const tab of TABS) {
  const file = path.join(ROOT, 'test/parity', tab + '.json');
  t.check(fs.existsSync(file), `test/parity/${tab}.json exists`);
  if (!fs.existsSync(file)) continue;
  let list = null;
  try { list = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { t.fail(`${tab}.json is JSON: ${e.message}`); continue; }
  t.check(Array.isArray(list), `${tab}.json is a list`);
  (list || []).forEach((s, i) => {
    const where = `${tab}.json[${i}] ${s.board || ''}`;
    const b = canvas.boards[s.board];
    t.check(!!b, `${where}: the board is on the canvas`);
    if (b) t.check(b.page === PAGE(tab), `${where}: it is a ${tab} board (canvas page "${b.page}")`);
    t.check(!seen.has(s.board), `${where}: one spec per board${seen.has(s.board) ? ` (also in ${seen.get(s.board)})` : ''}`);
    seen.set(s.board, tab);
    t.check(typeof (s.demo ?? '') === 'string' && (!s.demo || s.demo.startsWith('&')), `${where}: demo flags start with "&" (they follow ?demo)`);
    t.check(Array.isArray(s.steps || []), `${where}: steps is a list`);
    (s.steps || []).forEach((st, k) => {
      const keys = Object.keys(st);
      t.check(keys.length > 0 && keys.every((x) => STEP_KEYS.has(x)), `${where} step ${k + 1}: only ${[...STEP_KEYS].join(', ')}`);
    });
    if (s.region) t.check(Array.isArray(s.region) && s.region.length === 4 && s.region.every((n) => typeof n === 'number'), `${where}: region is [x, y, w, h]`);
  });
  const vfile = path.join(ROOT, 'test/parity/verdicts', tab + '.json');
  if (fs.existsSync(vfile)) {
    const v = JSON.parse(fs.readFileSync(vfile, 'utf8'));
    Object.keys(v).forEach((board) => {
      t.check(canvas.boards[board] && canvas.boards[board].page === PAGE(tab), `verdicts/${tab}.json: ${board} is a ${tab} board`);
      t.check(typeof v[board].verdict === 'string', `verdicts/${tab}.json: ${board} has a verdict`);
    });
  }
}

process.exit(t.done() ? 1 : 0);
