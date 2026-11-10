#!/usr/bin/env node
'use strict';
/*
 * The live script for the new Sales app's database changes
 * (docs/live/apply-0179-0181.sql, made by `node tools/build-live-sql.js
 * 0179-0181`): what Kevin pastes into the live project's SQL editor.
 *
 *   1. The committed script is exactly what the tool makes from the
 *      migrations as they stand; its apply step is one transaction that
 *      starts with step 1's checks and carries 0179, 0180 and 0181 whole;
 *      steps 1, 2 and 4 only read.
 *   2. On a REAL database, when OW_PG names one:
 *        - made from migrations 0001-0178 (live as it should stand): which-
 *          migrations.sql names the three; steps 1-4 run in order; step 4
 *          says ok three times; then all four again (safe to run twice) and
 *          step 1 names all three as in;
 *        - with 0179 in already: step 1 says so, step 3 leaves it exactly
 *          as it is (same policies, same function) and puts in 0180 and
 *          0181;
 *        - as Kevin's read-only check found live (10 Nov): 0001-0178 and
 *          0180, without 0179 or 0181: step 1 names 0180 as in and goes on,
 *          step 2 says where each stands, step 3 puts in 0179 and 0181;
 *          with place_order from an older draft, step 1 says so plainly and
 *          step 3 puts the repo's in its place; a place_order with other
 *          arguments stops step 1;
 *        - made from 0001-0177 (no 0178): step 1 stops and names 0178;
 *        - with cancel_order (0177) changed by hand: step 1 stops and names
 *          it, and step 3 run anyway leaves nothing behind; the same for
 *          0179's ow_yard_worker changed by hand;
 *        - with the functions and the script pasted from Windows (\r\n):
 *          steps 1, 3 and 4 pass.
 *
 * Run: node test/live-apply-0179-0181.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/live-apply-0179-0181.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('The live script for 0179-0181');
const ROOT = path.join(__dirname, '..');
const committed = read('docs/live/apply-0179-0181.sql');
const made = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-live-sql.js'), '0179-0181'], { encoding: 'utf8' });
const migDir = path.join(ROOT, 'supabase', 'migrations');
const migration = (no) => fs.readFileSync(path.join(migDir, fs.readdirSync(migDir).find((f) => f.startsWith(no + '_'))), 'utf8');

/* ---------------- 1. the script ---------------- */
t.check(made.status === 0 && made.stdout === committed, 'docs/live/apply-0179-0181.sql is what `node tools/build-live-sql.js 0179-0181` makes now (run the tool after changing a migration)');
const cut = (txt, n) => {
  const a = txt.indexOf(`-- STEP ${n} `), b = txt.indexOf(`-- STEP ${n + 1} `);
  return txt.slice(txt.lastIndexOf('-- ====', a), b < 0 ? undefined : txt.lastIndexOf('-- ====', b));
};
const step = (n) => cut(committed, n);
const which = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-which-migrations-sql.js')], { encoding: 'utf8' });
t.check(which.status === 0 && which.stdout === read('docs/live/which-migrations.sql'), 'docs/live/which-migrations.sql is what tools/build-which-migrations-sql.js makes now');
t.check(['0179_yard_workers_keep_out_of_the_books', '0180_place_order', '0181_sales_cancel_ask'].every((m) => read('docs/live/which-migrations.sql').includes(`'${m}'`)), 'which-migrations.sql knows 0179, 0180 and 0181');
const apply = step(3);
t.check(/\nbegin;\n/.test(apply) && /\ncommit;\n\n$/.test(apply), 'step 3 is one transaction, BEGIN to COMMIT');
const pre = (s) => (s.match(/do \$pre\$[\s\S]*?end \$pre\$;/) || [''])[0];
t.check(pre(step(1)) !== '' && apply.indexOf(pre(step(1))) > apply.indexOf('\nbegin;\n') && apply.indexOf(pre(step(1))) < apply.indexOf('-- 0179_'), 'step 3 starts with step 1\'s checks, before it writes anything');
['0179', '0180', '0181'].forEach((m) => t.check(apply.includes(migration(m).trim()), `step 3 carries ${m} whole`));
t.check(!migration('0179').includes('$m0179$') && /if \(to_regprocedure\('ow_yard_worker\(uuid\)'\)[\s\S]*?then\n {4}raise notice '0179 is in already: left as it is\.';\n {4}return;/.test(apply), '0179 runs only where it is not in already');
const writes = (s) => /\b(insert|update|delete|create|alter|drop|grant|revoke|execute)\b/i.test(s.replace(/--[^\n]*/g, '').replace(/'[^']*'/g, ''));
t.check(!writes(step(1)) && !writes(step(2)) && !writes(step(4)), 'steps 1, 2 and 4 only read');
t.check(/hgywjaifdmgrcnwxstxg/.test(committed) && /Do not edit by hand/.test(committed), 'it names the live project, and says it is generated');
t.check(/place_order/.test(step(2)) && /cancel\.ask/.test(step(2)) && /role = 'staff'/.test(step(2)), 'step 2 shows place_order, the cancel ask and the yard workers');

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
// A copy of the 0001-0178 database, quicker than building one again.
const BASE = 'ow_live179_base';
function copyDb(db) {
  drop(db);
  psql(['-qAt', '-c', `create database ${db} template ${BASE}`]);
  return onDb(db);
}
const run = (on, n, text = committed) => on(['-qAt', '-v', 'ON_ERROR_STOP=1'], cut(text, n));
const oks = (r) => ((r.stdout || '').match(/\|ok\r?$/gm) || []).length;

const base = makeDb(BASE, '0178');
t.check(base.failed.length === 0, `a database from 0001-0178 (${base.failed.join(', ') || 'all applied'})`);

// Live as it should stand: 0001-0178.
{
  const on = copyDb('ow_live179_fresh');
  const missing = (on(['-qAt', '-F', '|'], read('docs/live/which-migrations.sql')).stdout || '').split('\n')
    .filter((l) => /\|missing\|/.test(l)).map((l) => l.slice(0, 4));
  t.check(JSON.stringify(missing) === '["0179","0180","0181"]', `which-migrations.sql names the three as missing (${missing.join(', ')})`);
  const s1 = run(on, 1);
  t.check(s1.status === 0 && /Ready\. Already in: none of 0179-0181/.test(s1.stderr), `step 1: ready, none of the three in yet (${errs(s1)[0] || 'ok'})`);
  const s2 = run(on, 2);
  t.check(s2.status === 0, `step 2 runs, reading only (${errs(s2)[0] || 'ok'})`);
  const s3 = run(on, 3);
  t.check(s3.status === 0 && !/0179 is in already/.test(s3.stderr), `step 3 applies the three (${errs(s3)[0] || 'ok'})`);
  const s4 = run(on, 4);
  t.check(s4.status === 0 && oks(s4) === 3 && !/MISSING/.test(s4.stdout), `step 4: ok three times (${oks(s4)}; ${errs(s4)[0] || ''})`);
  const left = (on(['-qAt', '-F', '|'], read('docs/live/which-migrations.sql')).stdout || '').split('\n').filter((l) => /\|(missing|partly)\|/.test(l));
  t.check(left.length === 0, `then which-migrations.sql names nothing missing (${left.join('; ') || 'none'})`);
  const again1 = run(on, 1), again3 = run(on, 3), again4 = run(on, 4);
  t.check(/Already in: 0179, 0180, 0181/.test(again1.stderr), 'run again, step 1 names all three as in');
  t.check(again3.status === 0 && /0179 is in already: left as it is/.test(again3.stderr) && again4.status === 0 && oks(again4) === 3,
    `and steps 3 and 4 run a second time, all ok (${errs(again3)[0] || 'ok'})`);
  drop('ow_live179_fresh');
}

// 0179 in already: step 1 says so; step 3 leaves it as it is and puts in 0180 and 0181.
{
  const on = copyDb('ow_live179_has179');
  const m = on(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, fs.readdirSync(migDir).find((f) => f.startsWith('0179_')))]);
  t.check(m.status === 0, `a database with 0179 in already (${errs(m)[0] || 'ok'})`);
  const state = () => (on(['-qAt', '-c', `select (select string_agg(oid::text, ',' order by oid) from pg_policy where polname = 'not a yard worker')
    || '/' || (select oid from pg_proc where proname = 'ow_yard_worker') || '/' || (select count(*) from role_tasks where role = 'staff')`]).stdout || '').trim();
  const before = state();
  const s1 = run(on, 1);
  t.check(s1.status === 0 && /Ready\. Already in: 0179\./.test(s1.stderr), `step 1: 0179 already in (${errs(s1)[0] || (s1.stderr.match(/Already in: [^.]*/) || [''])[0]})`);
  const s3 = run(on, 3);
  t.check(s3.status === 0 && /0179 is in already: left as it is/.test(s3.stderr), `step 3 skips 0179 (${errs(s3)[0] || 'ok'})`);
  t.check(before !== '' && state() === before, 'and leaves it exactly as it was: the same 21 policies, the same function, the same tasks');
  const s4 = run(on, 4);
  t.check(s4.status === 0 && oks(s4) === 3, `step 4: ok three times (${oks(s4)})`);
  // 0179's function changed by hand: step 1 names it; step 3 run anyway leaves nothing.
  on(['-qAt', '-c', 'drop function place_order(uuid, jsonb, text)', '-c', 'drop table cancel_asks cascade']);
  const edit = on(['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `do $x$ begin execute replace(pg_get_functiondef('ow_yard_worker(uuid)'::regprocedure), '''staff''', '''worker'''); end $x$`]);
  const e1 = run(on, 1);
  t.check(edit.status === 0 && e1.status !== 0 && /ow_yard_worker \(0179\) changed since its migration/.test(e1.stderr), `ow_yard_worker changed by hand: step 1 stops and names it (${(errs(e1)[0] || '').slice(0, 140)})`);
  const e3 = run(on, 3);
  const after = (on(['-qAt', '-c', `select to_regprocedure('place_order(uuid, jsonb, text)') is null and to_regclass('public.cancel_asks') is null`]).stdout || '').trim();
  t.check(e3.status !== 0 && after === 't', `step 3 run anyway stops first: nothing of 0180 or 0181 is left (${after})`);
  drop('ow_live179_has179');
}

// Live as Kevin's read-only check found it (10 Nov): 0001-0178 and 0180, without 0179 or 0181.
{
  const on = copyDb('ow_live179_has180');
  const m = on(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, fs.readdirSync(migDir).find((f) => f.startsWith('0180_')))]);
  t.check(m.status === 0, `a database with 0180 in, without 0179 or 0181 (${errs(m)[0] || 'ok'})`);
  const missing = (on(['-qAt', '-F', '|'], read('docs/live/which-migrations.sql')).stdout || '').split('\n')
    .filter((l) => /\|(missing|partly)\|/.test(l)).map((l) => l.slice(0, 4));
  t.check(JSON.stringify(missing) === '["0179","0181"]', `which-migrations.sql reads it as live did: 0179 and 0181 missing (${missing.join(', ')})`);
  const s1 = run(on, 1);
  t.check(s1.status === 0 && /Ready\. Already in: 0180\./.test(s1.stderr) && !/Not the repo's/.test(s1.stderr), `step 1: 0180 already in, and does not stop (${errs(s1)[0] || (s1.stderr.match(/Already in: [^.]*/) || [''])[0]})`);
  const s2 = run(on, 2);
  t.check(s2.status === 0 && /0179 yard workers\|not in: step 3 puts it in/.test(s2.stdout) && /0180 place_order\|in, as the repo's: step 3 changes nothing/.test(s2.stdout)
    && /0181 cancel asks\|not in: step 3 puts it in/.test(s2.stdout), `step 2 says where each stands (${errs(s2)[0] || 'ok'})`);
  const s3 = run(on, 3), s4 = run(on, 4);
  t.check(s3.status === 0 && s4.status === 0 && oks(s4) === 3, `steps 3 and 4: 0179 and 0181 go in, ok three times (${errs(s3)[0] || oks(s4)})`);
  const left = (on(['-qAt', '-F', '|'], read('docs/live/which-migrations.sql')).stdout || '').split('\n').filter((l) => /\|(missing|partly)\|/.test(l));
  t.check(left.length === 0 && /Already in: 0179, 0180, 0181/.test(run(on, 1).stderr), `then nothing is missing and step 1 names all three (${left.join('; ') || 'none'})`);
  // place_order from an older draft: step 1 says so plainly and goes on; step 3 puts the repo's in its place.
  const draft = on(['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `do $x$ declare src text := pg_get_functiondef('place_order(uuid, jsonb, text)'::regprocedure);
    begin if position('Nothing to place.' in src) = 0 then raise exception 'no message to change'; end if;
    execute replace(src, 'Nothing to place.', 'Nothing.'); end $x$`]);
  const d1 = run(on, 1), d2 = run(on, 2);
  t.check(draft.status === 0 && d1.status === 0 && /Not the repo's: place_order \(0180\)/.test(d1.stderr) && /Already in: 0179, 0181\./.test(d1.stderr),
    `place_order from an older draft: step 1 says so and does not stop (${errs(draft)[0] || errs(d1)[0] || (d1.stderr.match(/Not the repo's[^.]*/) || [''])[0]})`);
  t.check(/0180 place_order\|in, but NOT the repo's/.test(d2.stdout), 'step 2 shows it too');
  const d3 = run(on, 3), d4 = run(on, 4);
  const body = (on(['-qAt', '-c', `select position('Nothing to place.' in prosrc) > 0 from pg_proc where proname = 'place_order'`]).stdout || '').trim();
  t.check(d3.status === 0 && oks(d4) === 3 && body === 't', `step 3 puts the repo's in its place; step 4 ok three times (${errs(d3)[0] || oks(d4)})`);
  t.check(!/Not the repo's/.test(run(on, 1).stderr), 'and step 1 no longer says so');
  // A place_order with other arguments: step 3 would leave two, so step 1 stops.
  on(['-qAt', '-c', `create function place_order(p_shop_id uuid, p_row jsonb) returns jsonb language sql as $f$ select '{}'::jsonb $f$`]);
  const o1 = run(on, 1);
  t.check(o1.status !== 0 && /place_order with other arguments than the repo's/.test(o1.stderr), `a place_order with other arguments: step 1 stops and says so (${(errs(o1)[0] || '').slice(0, 140)})`);
  drop('ow_live179_has180');
}

// Before 0178: step 1 stops and names it.
{
  const { on } = makeDb('ow_live179_old', '0177');
  const s1 = run(on, 1);
  t.check(s1.status !== 0 && /Not run: 0178 not in this database yet/.test(s1.stderr), `before 0178, step 1 stops and names it (${(errs(s1)[0] || '').slice(0, 120)})`);
  drop('ow_live179_old');
}

// cancel_order changed by hand: step 1 stops and names it; step 3 run anyway leaves nothing.
{
  const on = copyDb('ow_live179_drift');
  const edit = on(['-qAt', '-v', 'ON_ERROR_STOP=1', '-c', `do $x$ declare src text := pg_get_functiondef('cancel_order(uuid, bigint, text, text, text)'::regprocedure);
    begin if position('Say why it is cancelled.' in src) = 0 then raise exception 'no message to change'; end if;
    execute replace(src, 'Say why it is cancelled.', 'Give a reason.'); end $x$`]);
  t.check(edit.status === 0, `cancel_order is changed by hand (${errs(edit)[0] || 'ok'})`);
  const s1 = run(on, 1);
  t.check(s1.status !== 0 && /cancel_order \(0177's Cancel\) changed since its migration/.test(s1.stderr), `step 1 stops and names the changed function (${(errs(s1)[0] || '').slice(0, 140)})`);
  const s3 = run(on, 3);
  const left = (on(['-qAt', '-c', `select count(*) from pg_policy where polname = 'not a yard worker'`, '-c', `select (to_regprocedure('place_order(uuid, jsonb, text)') is null and to_regclass('public.cancel_asks') is null)::text`]).stdout || '').trim().split('\n');
  t.check(s3.status !== 0 && left[0] === '0' && left[1] === 'true', `step 3 run anyway fails as a whole: none of the three is left behind (${left.join(', ')})`);
  drop('ow_live179_drift');
}

// Pasted from Windows: the functions it leans on with \r\n, and the script too.
{
  const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
  const on = copyDb('ow_live179_crlf');
  const cr = on(['-qAt', '-v', 'ON_ERROR_STOP=1',
    '-c', `do $x$ begin execute replace(replace(pg_get_functiondef('cancel_order(uuid, bigint, text, text, text)'::regprocedure), chr(13), ''), chr(10), chr(13) || chr(10)); end $x$`,
    '-c', `do $x$ begin execute replace(replace(pg_get_functiondef('saved_quotes_stage_move()'::regprocedure), chr(13), ''), chr(10), chr(13) || chr(10)); end $x$`]);
  const has = (on(['-qAt', '-c', `select position(chr(13) in prosrc) > 0 from pg_proc where proname = 'cancel_order'`]).stdout || '').trim();
  t.check(cr.status === 0 && has === 't', `cancel_order and the stage rule with \\r\\n (${errs(cr)[0] || has})`);
  const ap = crlf(committed);
  const a1 = run(on, 1, ap), a3 = run(on, 3, ap), a4 = run(on, 4, ap);
  t.check(a1.status === 0 && /Ready/.test(a1.stderr), `step 1, pasted with \\r\\n: ready (${errs(a1)[0] || 'ok'})`);
  t.check(a3.status === 0 && oks(a4) === 3, `steps 3 and 4, pasted with \\r\\n: ok three times (${errs(a3)[0] || oks(a4)})`);
  const again = run(on, 3, ap);
  t.check(again.status === 0 && /0179 is in already/.test(again.stderr), `and step 3 again (${errs(again)[0] || 'ok'})`);
  drop('ow_live179_crlf');
}

drop(BASE);
process.exit(t.done() ? 1 : 0);
