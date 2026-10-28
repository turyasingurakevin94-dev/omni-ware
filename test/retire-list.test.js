#!/usr/bin/env node
'use strict';
/*
 * The retire list (docs/rebuild.md): the rebuild never keeps two versions of
 * an app. A new app replaces its old page one role at a time; this holds
 * each switch to the list:
 *
 *   1. The list names every role the rebuild replaces, once, with its page.
 *   2. A switched role: its page at the root is the built one (first line
 *      "GENERATED from src/"), and "Old gone by" is a date at most 30 days
 *      after the switch.
 *   3. After "Old gone by", old/<role>.html is not in the repo.
 *   4. After the switch, a test that still reads the role's page says it
 *      reads the built page ("reads the built <role>.html"); the old app's
 *      tests, which cut its functions out, go with it.
 *   5. Nothing in src/ reads an old page (a root app page or old/).
 *
 * Run: node test/retire-list.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, read, createReporter } = require('./_extract');

const t = createReporter('retire list');
const ROLES = ['store.html', 'sales.html', 'buyer.html', 'manager.html', 'accounts.html'];
const DAY = 24 * 3600 * 1000;
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' }).split(',')[0]);

/* ---------------- the list ---------------- */
const doc = read('docs/rebuild.md');
const at = doc.indexOf('## Retire list');
t.check(at >= 0, 'docs/rebuild.md has a Retire list');
const section = doc.slice(at, doc.indexOf('\n## ', at + 5));
const rows = section.split('\n').filter((l) => /^\| [A-Z][a-z]+ \| `/.test(l)).map((l) => {
  const c = l.split('|').slice(1, -1).map((x) => x.trim());
  const date = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(x + 'T00:00:00') : null);
  return { role: c[0], page: c[1].replace(/`/g, ''), switched: date(c[2]), goneBy: date(c[3]), raw: c };
});
t.check(JSON.stringify(rows.map((r) => r.page).sort()) === JSON.stringify([...ROLES].sort()),
  `it names each page the rebuild replaces, once (${rows.map((r) => r.page).join(', ')})`);
rows.forEach((r) => {
  t.check(r.raw[2] === '—' || r.switched, `${r.role}: "Switched" is a date (YYYY-MM-DD) or — (${r.raw[2]})`);
  t.check(r.raw[3] === '—' || r.goneBy, `${r.role}: "Old gone by" is a date (YYYY-MM-DD) or — (${r.raw[3]})`);
});

/* ---------------- each switch ---------------- */
const tests = fs.readdirSync(path.join(ROOT, 'test')).filter((f) => f.endsWith('.js') && f !== 'retire-list.test.js' && f !== 'file-size.test.js');
for (const r of rows) {
  if (!r.switched) {
    t.check(!r.goneBy, `${r.role}: not switched, so no date to be gone by yet`);
    continue;
  }
  const page = fs.existsSync(path.join(ROOT, r.page)) ? read(r.page) : '';
  t.check(page.slice(0, 300).includes('GENERATED from src/'), `${r.role} switched: ${r.page} is the page built from src/`);
  t.check(!!r.goneBy && r.goneBy >= r.switched && r.goneBy - r.switched <= 30 * DAY, `${r.role}: the old page is gone at most 30 days after the switch`);
  if (r.goneBy && today > r.goneBy) {
    t.check(!fs.existsSync(path.join(ROOT, 'old', r.page)), `${r.role}: old/${r.page} is gone (it was due by ${r.raw[3]})`);
  }
  const left = tests.filter((f) => {
    const src = fs.readFileSync(path.join(ROOT, 'test', f), 'utf8');
    return src.includes(`'${r.page}'`) && !src.includes(`reads the built ${r.page}`);
  });
  t.check(left.length === 0, `${r.role}: no old-app test still reads ${r.page} (${left.join(', ') || 'none'})`);
}

/* ---------------- src/ never reads an old page ---------------- */
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.(ts|tsx|js|css)$/.test(e.name)) out.push(p);
  }
  return out;
}
const srcFiles = walk(path.join(ROOT, 'src'), []);
const oldPage = new RegExp(`(from\\s+|import\\(|require\\(|readFileSync\\(|fetch\\()\\s*['"\`][^'"\`]*(old/|\\.\\./)*(${ROLES.map((x) => x.replace('.', '\\.')).join('|')}|old/[a-z]+\\.html)`);
const readers = srcFiles.filter((p) => oldPage.test(fs.readFileSync(p, 'utf8'))).map((p) => path.relative(ROOT, p));
t.check(readers.length === 0, `nothing in src/ reads an old page (${readers.join(', ') || `${srcFiles.length} files checked`})`);

process.exit(t.done() ? 1 : 0);
