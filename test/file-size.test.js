#!/usr/bin/env node
'use strict';
/*
 * The size guard (docs/rebuild.md, phase 0).
 *
 * The apps grew into a few files of 4,000-181,000 lines. Nobody -- and no
 * Claude session -- can read one of those whole, so every change was made
 * to a part of the file while the rest went unseen, and shared rules were
 * copied app to app until the copies disagreed. The rebuild moves them to
 * small files. This test keeps it moving one way:
 *
 *   1. A source file not listed below stays at or under 1,000 lines.
 *   2. A listed file stays at or under its ceiling. Ceilings are today's
 *      size plus room for the work in flight; they only ever go DOWN.
 *      When a file shrinks, lower its number. Raising one needs Kevin.
 *   3. A built file (first line says "GENERATED from src/") is not
 *      measured -- it is one file on purpose; its src/ files are. It
 *      leaves CEILINGS when it becomes built.
 *   4. CLAUDE.md points every session at docs/rebuild.md.
 *
 * Run: node test/file-size.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, read, createReporter } = require('./_extract');

const t = createReporter('file size');
const LIMIT = 1000;

// The files that were already over the limit on 2026-10-28. Lower only.
const CEILINGS = {
  'index.html': 181549,
  'agent.html': 17891,
  'sales.html': 11752,
  'sourcing.html': 10204,
  'accounts.html': 7539,
  'manager.html': 6898,
  'store.html': 6796,
  'buyer.html': 6668,
  'owner.html': 4833,
  'client.html': 2551,
  'supplier.html': 2163,
  'worker.html': 1696,
  'shared-worker.js': 2947,
  'sourcing-console.js': 2755,
};

const SOURCE = /\.(html|js|css|ts|tsx)$/;
const SKIP = new Set(['node_modules', 'www', 'android', 'ios', '.git', 'test', 'vendor']);

function walk(rel, out) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(r, out);
    else if (SOURCE.test(e.name)) out.push(r);
  }
  return out;
}

// The site's own source: the root pages and scripts, the API, and src/ as it grows.
const files = [
  ...fs.readdirSync(ROOT).filter((f) => SOURCE.test(f)),
  ...walk('api', []),
  ...walk('src', []),
];

const built = (rel) => read(rel).slice(0, 300).includes('GENERATED from src/');
const lines = (rel) => read(rel).split('\n').length;

for (const f of files.sort()) {
  if (built(f)) {
    t.check(CEILINGS[f] == null, `${f} is built from src/, so it is measured there, not here (take it out of CEILINGS)`);
    continue;
  }
  const n = lines(f);
  const cap = CEILINGS[f];
  if (cap == null) t.check(n <= LIMIT, `${f}: ${n} lines, at most ${LIMIT}`);
  else t.check(n <= cap, `${f}: ${n} lines, ceiling ${cap}${n <= cap ? '' : ' -- split it, do not raise the ceiling'}`);
}

for (const f of Object.keys(CEILINGS)) {
  t.check(files.includes(f), `${f} is still where the ceiling list says (remove it from CEILINGS once it is gone)`);
}

t.check(read('CLAUDE.md').includes('docs/rebuild.md'), 'CLAUDE.md points every session at docs/rebuild.md');

process.exit(t.done() ? 1 : 0);
