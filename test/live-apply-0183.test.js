#!/usr/bin/env node
'use strict';
/*
 * The live script for the new Store app's database (docs/live/apply-0183.sql,
 * made by `node tools/build-live-sql.js 0183`): what Kevin pastes into the
 * live project's SQL editor.
 *
 *   1. The committed script is exactly what the tool makes from the
 *      migrations as they stand; its apply step is one transaction that
 *      starts with step 1's checks and carries 0183 whole; steps 1, 2 and 4
 *      only read.
 *   2. On a REAL database, when OW_PG names one:
 *        - made from migrations 0001-0181 (live once apply-0179-0181 is in):
 *          which-migrations.sql names 0183 alone; steps 1-4 run in order;
 *          step 4 says ok on every row; then all four again (safe to run
 *          twice); and the store scenario then passes on it;
 *        - made from 0001-0180: step 1 stops and names 0181;
 *        - with cancel_order (0177) or store_live (0168) changed by hand:
 *          step 1 stops and names it, and step 3 run anyway leaves nothing;
 *        - pasted from Windows (\r\n): steps 1, 3 and 4 pass.
 *
 * Run: node test/live-apply-0183.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/live-apply-0183.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('The live script for 0183');
const ROOT = path.join(__dirname, '..');
const committed = read('docs/live/apply-0183.sql');
const made = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-live-sql.js'), '0183'], { encoding: 'utf8' });
const migDir = path.join(ROOT, 'supabase', 'migrations');
const mig = fs.readFileSync(path.join(migDir, fs.readdirSync(migDir).find((f) => f.startsWith('0183_'))), 'utf8');

/* ---------------- 1. the script ---------------- */
t.check(made.status === 0 && made.stdout === committed, 'docs/live/apply-0183.sql is what `node tools/build-live-sql.js 0183` makes now (run the tool after changing a migration)');
const cut = (txt, n) => {
  const a = txt.indexOf(`-- STEP ${n} `), b = txt.indexOf(`-- STEP ${n + 1} `);
  return txt.slice(txt.lastIndexOf('-- ====', a), b < 0 ? undefined : txt.lastIndexOf('-- ====', b));
};
const step = (n) => cut(committed, n);
t.check(read('docs/live/which-migrations.sql').includes("'0183_store_new_app'"), 'which-migrations.sql knows 0183');
const apply = step(3);
t.check(/\nbegin;\n/.test(apply) && /\ncommit;\n\n$/.test(apply), 'step 3 is one transaction, BEGIN to COMMIT');
const pre = (s) => (s.match(/do \$pre\$[\s\S]*?end \$pre\$;/) || [''])[0];
t.check(pre(step(1)) !== '' && apply.indexOf(pre(step(1))) > apply.indexOf('\nbegin;\n') && apply.indexOf(pre(step(1))) < apply.indexOf('-- 0183_'), 'step 3 starts with step 1\'s checks, before it writes anything');
t.check(apply.includes(mig.trim()), 'step 3 carries 0183 whole');
const writes = (s) => /\b(insert|update|delete|create|alter|drop|grant|revoke|execute)\b/i.test(s.replace(/--[^\n]*/g, '').replace(/'[^']*'/g, ''));
t.check(!writes(step(1)) && !writes(step(2)) && !writes(step(4)), 'steps 1, 2 and 4 only read');
t.check(/hgywjaifdmgrcnwxstxg/.test(committed) && /Do not edit by hand/.test(committed), 'it names the live project, and says it is generated');
t.check(/notify-worker and notify-stock-count/.test(committed), 'it says to turn off the two old push webhooks when the new app replaces store.html');

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the script is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const psql = (args, input) => spawnSync('psql', [conn, ...args], { input, encoding: 'utf8' });
const shim = fs.readFileSync(path.join(__dirname, 'fixtures', 'supabase-shim.sql'), 'utf8');
const errs = (r) => (r.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l));
const onDb = (db) => (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8', maxBuffer: 1 << 26 });
const drop = (...dbs) => psql(['-qAt', ...dbs.flatMap((d) => ['-c', `drop database if exists ${d}`])]);

function makeDb(db, upTo) {
  drop(db);
  psql(['-qAt', '-c', `create database ${db}`]);
  const on = onDb(db);
  on(['-qAt', '-v', 'ON_ERROR_STOP=1'], shim);
  const failed = [];
  fs.readdirSync(migDir).filter((f) => f.endsWith('.sql') && f.slice(0, 4) <= upTo).sort().forEach((f) => {
    if (on(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]).status !== 0) failed.push(f);
  });
  return { on, failed };
}
const BASE = 'ow_live183_base';
function copyDb(db) {
  drop(db);
  psql(['-qAt', '-c', `create database ${db} template ${BASE}`]);
  return onDb(db);
}
const run = (on, n, text = committed) => on(['-qAt', '-v', 'ON_ERROR_STOP=1'], cut(text, n));
const oks = (r) => ((r.stdout || '').match(/\|ok\r?$/gm) || []).length;
const ROWS = (cut(committed, 4).match(/^ {2}\('0183 /gm) || []).length;

const base = makeDb(BASE, '0181');
t.check(base.failed.length === 0, `a database from 0001-0181 (${base.failed.join(', ') || 'all applied'})`);

{
  const on = copyDb('ow_live183_fresh');
  const missing = (on(['-qAt', '-F', '|'], read('docs/live/which-migrations.sql')).stdout || '').split('\n')
    .filter((l) => /\|(missing|partly)\|/.test(l)).map((l) => l.slice(0, 4)).filter((n) => n <= '0183'); // later builds (0184 …) are not this script's
  t.check(JSON.stringify(missing) === '["0183"]', `which-migrations.sql names 0183 alone as missing (${missing.join(', ')})`);
  const s1 = run(on, 1);
  t.check(s1.status === 0 && /Ready\. Step 3 puts 0183 in/.test(s1.stderr), `step 1: ready (${errs(s1)[0] || 'ok'})`);
  const s2 = run(on, 2);
  t.check(s2.status === 0 && /0183 is not in/.test(s2.stdout), `step 2 runs, reading only (${errs(s2)[0] || 'ok'})`);
  const s3 = run(on, 3);
  t.check(s3.status === 0, `step 3 applies 0183 (${errs(s3)[0] || 'ok'})`);
  const s4 = run(on, 4);
  t.check(s4.status === 0 && ROWS >= 10 && oks(s4) === ROWS && !/MISSING/.test(s4.stdout), `step 4: ok on every row (${oks(s4)} of ${ROWS}; ${errs(s4)[0] || ''})`);
  const again1 = run(on, 1), again3 = run(on, 3), again4 = run(on, 4);
  t.check(/0183 is in already/.test(again1.stderr) && again3.status === 0 && oks(again4) === ROWS, `run again: step 1 says it is in; steps 3 and 4 ok (${errs(again3)[0] || 'ok'})`);
  const left = (on(['-qAt', '-F', '|'], read('docs/live/which-migrations.sql')).stdout || '').split('\n').filter((l) => /\|(missing|partly)\|/.test(l) && l.slice(0, 4) <= '0183');
  t.check(left.length === 0, `then which-migrations.sql names nothing missing (${left.join('; ') || 'none'})`);
  const sc = on(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'store-new-app-scenario.sql'), 'utf8'));
  const rows = (sc.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
  t.check(rows.length >= 70 && rows.every((l) => l.startsWith('PASS')), `the store scenario passes on the database the script made (${rows.filter((l) => !l.startsWith('PASS')).slice(0, 2).join(' | ') || rows.length + ' cases'})`);
  drop('ow_live183_fresh');
}

{
  const { on } = makeDb('ow_live183_old', '0180');
  const s1 = run(on, 1);
  t.check(s1.status !== 0 && /Not run: 0181 not in this database yet/.test(s1.stderr), `before 0181, step 1 stops and names it (${(errs(s1)[0] || '').slice(0, 120)})`);
  drop('ow_live183_old');
}

const lit = (x) => `'${x.replace(/'/g, "''")}'`;
[['cancel_order(uuid, bigint, text, text, text)', 'cancel_order (0177)', 'Say why it is cancelled.', 'Say why.'],
 ['store_live(uuid)', 'store_live (0168)', "interval '3 days'", "interval '4 days'"]].forEach(([sig, name, from, to], i) => {
  const on = copyDb(`ow_live183_drift${i}`);
  const edit = on(['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `do $x$ declare src text := pg_get_functiondef('${sig}'::regprocedure);
    begin if position(${lit(from)} in src) = 0 then raise exception 'nothing to change'; end if;
    execute replace(src, ${lit(from)}, ${lit(to)}); end $x$`]);
  const e1 = run(on, 1);
  t.check(edit.status === 0 && e1.status !== 0 && e1.stderr.includes(`${name} changed since its migration`), `${name} changed by hand: step 1 stops and names it (${(errs(edit)[0] || errs(e1)[0] || '').slice(0, 140)})`);
  const e3 = run(on, 3);
  const after = (on(['-qAt', '-c', `select to_regprocedure('ow_ready_to_collect(text, jsonb)') is null and not exists (select 1 from pg_trigger where tgname = 'saved_quotes_ow_a_yard_push')`]).stdout || '').trim();
  t.check(e3.status !== 0 && after === 't', `step 3 run anyway stops first: nothing of 0183 is left (${after})`);
  drop(`ow_live183_drift${i}`);
});

{
  const on = copyDb('ow_live183_crlf');
  const crlf = committed.replace(/\r?\n/g, '\r\n');
  const s1 = run(on, 1, crlf), s3 = run(on, 3, crlf), s4 = run(on, 4, crlf);
  t.check(s1.status === 0 && s3.status === 0 && oks(s4) === ROWS, `pasted from Windows: steps 1, 3 and 4 pass (${errs(s1)[0] || errs(s3)[0] || oks(s4)})`);
  drop('ow_live183_crlf');
}

drop(BASE);
process.exit(t.done() ? 1 : 0);
