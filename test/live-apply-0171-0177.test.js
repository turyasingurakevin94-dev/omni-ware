#!/usr/bin/env node
'use strict';
/*
 * The live script for the rebuild's backend fixes (docs/live/apply-0171-0177.sql,
 * made by tools/build-live-sql.js): what Kevin pastes into the live
 * project's SQL editor.
 *
 *   1. The committed script is exactly what the tool makes from the
 *      migrations as they stand (so it never drifts from them), and its
 *      apply step is one transaction.
 *   2. On a REAL database, when OW_PG names one:
 *        - made from migrations 0001-0170 (live as it should stand), steps
 *          1, 2, 3 and 4 run in order; step 1 says none of the seven is in,
 *          step 4 says ok seven times; then all four again (it is safe to
 *          run twice) and step 1 names all seven;
 *        - made from 0001-0168 only, step 1 stops before anything changes,
 *          naming 0169;
 *        - with the void guard's wording changed by hand, step 1 stops and names it,
 *          and step 3 (if run anyway) fails as a whole, leaving nothing.
 *
 * Run: node test/live-apply-0171-0177.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/live-apply-0171-0177.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('The live script for 0171-0177');
const ROOT = path.join(__dirname, '..');
const committed = read('docs/live/apply-0171-0177.sql');
const made = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-live-sql.js')], { encoding: 'utf8' });

/* ---------------- 1. the script ---------------- */
t.check(made.status === 0 && made.stdout === committed, 'docs/live/apply-0171-0177.sql is what tools/build-live-sql.js makes now (run the tool after changing a migration)');
const step = (n) => {
  const a = committed.indexOf(`-- STEP ${n} `), b = committed.indexOf(`-- STEP ${n + 1} `);
  return committed.slice(committed.lastIndexOf('\n-- ====', a), b < 0 ? undefined : committed.lastIndexOf('\n-- ====', b));
};
const apply = step(3);
t.check(/\nbegin;\n/.test(apply) && /\ncommit;\n$/.test(apply), 'step 3 is one transaction, BEGIN to COMMIT');
['0171', '0172', '0173', '0174', '0175', '0176', '0177'].forEach((m) => {
  const f = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).find((x) => x.startsWith(m + '_'));
  t.check(!!f && apply.includes(fs.readFileSync(path.join(ROOT, 'supabase/migrations', f), 'utf8').trim()), `step 3 carries ${f || m} whole`);
});
t.check(!/\b(insert|update|delete)\b[^;]*\b(saved_quotes|customers|cash_txns)\b/i.test(step(1) + step(2) + step(4)), 'steps 1, 2 and 4 only read');
t.check(/hgywjaifdmgrcnwxstxg/.test(committed) && /Do not\n-- edit by hand/.test(committed), 'it names the live project, and says it is generated');

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the script is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const psql = (args, input) => spawnSync('psql', [conn, ...args], { input, encoding: 'utf8' });
const shim = fs.readFileSync(path.join(__dirname, 'fixtures', 'supabase-shim.sql'), 'utf8');
const migDir = path.join(ROOT, 'supabase', 'migrations');
const errs = (r) => (r.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l));

function makeDb(db, upTo) {
  psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]);
  const on = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8', maxBuffer: 1 << 26 });
  on(['-qAt', '-v', 'ON_ERROR_STOP=1'], shim);
  const failed = [];
  fs.readdirSync(migDir).filter((f) => f.endsWith('.sql') && f.slice(0, 4) <= upTo).sort().forEach((f) => {
    const r = on(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]);
    if (r.status !== 0) failed.push(f);
  });
  return { on, failed };
}
const run = (on, n) => on(['-qAt', '-v', 'ON_ERROR_STOP=1'], step(n));

// Live as it should stand: 0001-0170.
{
  const { on, failed } = makeDb('ow_live_apply_test', '0170');
  t.check(failed.length === 0, `a database from 0001-0170 (${failed.join(', ') || 'all applied'})`);
  const s1 = run(on, 1);
  t.check(s1.status === 0 && /Ready\. Already in: none of 0171-0177/.test(s1.stderr), `step 1: ready, none of the seven in yet (${errs(s1)[0] || 'ok'})`);
  const s2 = run(on, 2);
  t.check(s2.status === 0, `step 2 runs, reading only (${errs(s2)[0] || 'ok'})`);
  const s3 = run(on, 3);
  t.check(s3.status === 0, `step 3 applies the seven (${errs(s3)[0] || 'ok'})`);
  const s4 = run(on, 4);
  const oks = (s4.stdout || '').split('\n').filter((l) => /\|ok$/.test(l));
  t.check(s4.status === 0 && oks.length === 7 && !/MISSING/.test(s4.stdout), `step 4: ok seven times (${oks.length}; ${errs(s4)[0] || ''})`);
  const again1 = run(on, 1), again3 = run(on, 3), again4 = run(on, 4);
  t.check(/Already in: 0171, 0172, 0173, 0174, 0175, 0176, 0177/.test(again1.stderr), 'run again, step 1 names all seven as in');
  t.check(again3.status === 0 && again4.status === 0 && (again4.stdout.match(/\|ok$/gm) || []).length === 7, `and steps 3 and 4 run a second time, all ok (${errs(again3)[0] || 'ok'})`);
  psql(['-qAt', '-c', 'drop database if exists ow_live_apply_test']);
}

// A database missing 0169: step 1 stops, nothing changes.
{
  const { on } = makeDb('ow_live_apply_old', '0168');
  const s1 = run(on, 1);
  t.check(s1.status !== 0 && /Not run: 0169 not in this database yet/.test(s1.stderr), `before 0169, step 1 stops and names it (${(errs(s1)[0] || '').slice(0, 120)})`);
  psql(['-qAt', '-c', 'drop database if exists ow_live_apply_old']);
}

// The void guard changed by hand: step 1 names it; step 3 run anyway leaves nothing behind.
{
  const { on } = makeDb('ow_live_apply_drift', '0170');
  const edit = on(['-qAt', '-v', 'ON_ERROR_STOP=1'], `do $x$ declare src text := pg_get_functiondef('saved_quotes_sales_guard()'::regprocedure);
    begin execute replace(src, '''Voided order #''', '''Void of order #'''); end $x$;`);
  t.check(edit.status === 0, 'the void guard is changed by hand');
  const s1 = run(on, 1);
  t.check(s1.status !== 0 && /saved_quotes_sales_guard \(0122's void guard\) changed since its migration/.test(s1.stderr), `step 1 stops and names the changed function (${(errs(s1)[0] || '').slice(0, 140)})`);
  const s3 = run(on, 3);
  const left = on(['-qAt', '-c', `select count(*) from pg_trigger where tgname in ('saved_quotes_zz_cost_floor', 'saved_quotes_ow_a_stage_move', 'saved_quotes_ow_a_decisions')`]);
  t.check(s3.status !== 0 && (left.stdout || '').trim() === '0', `step 3 run anyway fails as a whole: none of the seven is left behind (${(left.stdout || '').trim()} triggers)`);
  psql(['-qAt', '-c', 'drop database if exists ow_live_apply_drift']);
}

process.exit(t.done() ? 1 : 0);
