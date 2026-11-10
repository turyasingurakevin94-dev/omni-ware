#!/usr/bin/env node
'use strict';
/*
 * Regenerates the table in docs/audit/sales/CANVAS-PARITY.md from:
 *   docs/canvas/sales-agent/boards/canvas.json    every board, its tab and title
 *   test/parity/<tab>.json                        the specs (how the app reaches each board)
 *   docs/audit/sales/parity/results.json          what tools/parity/run.cjs measured
 *   test/parity/verdicts/<tab>.json               each tab critic's verdict
 *
 *   node tools/parity/report.cjs
 *
 * Only the part between the two markers is rewritten; the words around it stay.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DOC = path.join(ROOT, 'docs/audit/sales/CANVAS-PARITY.md');
const START = '<!-- parity:start (tools/parity/report.cjs writes this part) -->';
const END = '<!-- parity:end -->';
const TABS = ['today', 'chats', 'sell', 'counter', 'orders', 'customers', 'parts'];
// The parts boards (Main, Main2) are canvas page "lang"; their specs are test/parity/parts.json.
const tabOf = (page) => (page === 'lang' ? 'parts' : page);

const read = (rel, empty) => { const f = path.join(ROOT, rel); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : empty; };

const canvas = read('docs/canvas/sales-agent/boards/canvas.json', { boards: {} });
const results = read('docs/audit/sales/parity/results.json', {});
const specs = {}, verdicts = {};
TABS.forEach((t) => {
  read(`test/parity/${t}.json`, []).forEach((s) => { specs[s.board] = { tab: t, ...s }; });
  Object.assign(verdicts, read(`test/parity/verdicts/${t}.json`, {}));
});

const boards = Object.entries(canvas.boards)
  .filter(([, b]) => TABS.includes(tabOf(b.page)))
  .sort(([a, x], [b, y]) => TABS.indexOf(tabOf(x.page)) - TABS.indexOf(tabOf(y.page)) || a.localeCompare(b));

const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
let withSpec = 0, measured = 0, passed = 0;
const rows = boards.map(([file, b]) => {
  const name = file.replace(/\.dc\.html$/, ''), spec = specs[file], r = results[file], v = verdicts[file];
  if (spec) withSpec++;
  if (r && r.diff != null) measured++;
  if (v && /^pass/i.test(v.verdict || '')) passed++;
  const diff = !r ? '—' : r.diff == null ? `could not run: ${cell((r.errors || [])[0])}` : `${r.diff}%${r.regionDiff != null ? ` (region ${r.regionDiff}%)` : ''}`;
  const verdict = v ? `${cell(v.verdict)}${v.score != null ? ` ${v.score}` : ''}${v.note ? ` · ${cell(v.note)}` : ''}` : '—';
  const shot = r && r.diff != null ? `[side by side](parity/${name}.png) · [diff](parity/${name}.diff.png)` : '—';
  return `| ${name} | ${tabOf(b.page)} | ${cell(b.title)} | ${spec ? (r && r.taps != null ? r.taps : (spec.steps || []).filter((s) => s.tap != null).length) : '—'} | ${spec ? diff : 'no spec yet'} | ${verdict} | ${shot} |`;
});

const table = [
  START,
  '',
  `**${boards.length} boards** · ${withSpec} with a spec · ${measured} measured · ${passed} passed by their critic. Regenerated ${new Date().toISOString().slice(0, 10)}.`,
  '',
  '| Board | Tab | What it shows | Taps from Today | Pixels that differ | Critic | Screenshot |',
  '|---|---|---|---|---|---|---|',
  ...rows,
  '',
  END,
].join('\n');

const doc = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
const i = doc.indexOf(START), j = doc.indexOf(END);
if (i < 0 || j < 0) throw new Error(`${path.relative(ROOT, DOC)} has no parity markers`);
fs.writeFileSync(DOC, doc.slice(0, i) + table + doc.slice(j + END.length));
console.log(`report: ${boards.length} boards, ${withSpec} with a spec, ${measured} measured, ${passed} passed → ${path.relative(ROOT, DOC)}`);
