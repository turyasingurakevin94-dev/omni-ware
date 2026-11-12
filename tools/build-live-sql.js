#!/usr/bin/env node
'use strict';
/*
 * A run of migrations as one script for the LIVE project's SQL editor.
 *
 * Migrations reach the live shop as a paste into the Supabase SQL editor,
 * read before they are run (.github/workflows/deploy-functions.yml says
 * so: only edge functions go through Actions, never the database). Several
 * pastes in the right order, each able to stop half-way, is several chances
 * to leave the books between two rules. So this writes one script:
 *
 *   STEP 1  PREREQUISITES  read-only. Stops with a plain message if the
 *           live database is missing what the run is built on, or if a
 *           function it changes or leans on is not the shape it expects.
 *           Says which of the run are in already.
 *   STEP 2  PREVIEW        read-only. What will change for the staff.
 *   STEP 3  APPLY          BEGIN, the migrations as they are in
 *           supabase/migrations, COMMIT: all of them, or none.
 *   STEP 4  CHECK AFTERWARDS  read-only.
 *
 * Each run's words (header, steps 1, 2 and 4) live in tools/live-sql/:
 *
 *   0171-0177  the rebuild's backend fixes -> docs/live/apply-0171-0177.sql
 *              (test/live-apply-0171-0177.test.js)
 *   0179-0181  the yard worker, place_order, Sales' cancel ask
 *              -> docs/live/apply-0179-0181.sql (test/live-apply-0179-0181.test.js)
 *   0183       the new Store app's pushes and Ready to collect
 *              -> docs/live/apply-0183.sql (test/live-apply-0183.test.js)
 *
 * Each script is this tool's output, committed; its test holds the two to
 * each other and runs it on a database made from the migrations.
 *
 * Run: node tools/build-live-sql.js [0171-0177 | 0179-0181 | 0183] [out.sql]
 *      (no run named: 0171-0177)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'supabase/migrations');
const RUNS = ['0171-0177', '0179-0181', '0183'];

const args = process.argv.slice(2);
const name = RUNS.includes(args[0]) ? args.shift() : '0171-0177';
const run = require(`./live-sql/${name}.js`);
const FIRST = run.first;
const LAST = run.last;

const all = fs.readdirSync(DIR).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const files = all.filter((f) => { const n = Number(f.slice(0, 4)); return n >= FIRST && n <= LAST; });
if (files.length !== LAST - FIRST + 1) {
  console.error(`expected migrations ${FIRST}-${LAST}, found ${files.join(', ')}`);
  process.exit(1);
}
const text = (f) => fs.readFileSync(path.join(DIR, f), 'utf8').trim();

/*
 * What a run's steps may ask of the migrations.
 *
 * fingerprint(fn, upTo): the md5 of a function's body as the last migration
 * up to upTo writes it, with every space, tab and line end taken out, so a
 * copy pasted from Windows or re-spaced by an editor still matches and a
 * changed word does not. In SQL: md5(translate(prosrc, <the four>, '')).
 */
const ctx = {
  files,
  text,
  fingerprint(fn, upTo) {
    let body = null;
    all.filter((f) => f.slice(0, 4) <= upTo).forEach((f) => {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8');
      const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?${fn}\\s*\\([\\s\\S]*?\\bas\\s+(\\$[a-z_]*\\$)([\\s\\S]*?)\\1`, 'gi');
      for (const m of src.matchAll(re)) body = m[2];
    });
    if (body === null) throw new Error(`no migration up to ${upTo} writes ${fn}`);
    return crypto.createHash('md5').update(body.replace(/[ \t\r\n]/g, ''), 'utf8').digest('hex');
  },
};
const words = (x) => (typeof x === 'function' ? x(ctx) : x);

const out = [];
const add = (s) => out.push(s);

add(words(run.header));
add(words(run.step1));
add(words(run.step2));
add(`-- =====================================================================
-- STEP 3  APPLY: from BEGIN to COMMIT, in one go
-- =====================================================================
begin;
`);
if (run.beforeApply) add(words(run.beforeApply));
for (const f of files) {
  add(`-- ---------------------------------------------------------------------
-- ${f}
-- ---------------------------------------------------------------------
${run.apply ? run.apply(f, text(f), ctx) : text(f)}
`);
}
add(`commit;
`);
add(words(run.step4));

const sql = out.join('\n');
const dest = args[0];
if (dest) fs.writeFileSync(dest, sql); else process.stdout.write(sql);
