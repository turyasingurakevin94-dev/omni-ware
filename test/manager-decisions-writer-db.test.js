#!/usr/bin/env node
'use strict';
/*
 * The Manager's decisions on an order are written only by whoever holds the
 * task (0175; docs/spec/01-order-journey.md §5 Q5 and Q12, docs/rebuild.md
 * "Backend fixes decided"): creditCheck (credit.release), pickSettle and
 * pickShortfallAckAt (pick.settle), creditNotes (credit_note.raise), and a
 * line's priceReview (price.approve) — which the database clears itself when
 * a new cost passes the price decided.
 *
 *   1. The SQL text.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0175
 *      run twice, then test/fixtures/manager-decisions-writer-scenario.sql.
 *
 * Run: node test/manager-decisions-writer-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/manager-decisions-writer-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('The Manager\'s decisions, checked on the writer (0175)');
const raw = read('supabase/migrations/0175_manager_decisions_checked_on_the_writer.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0175 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0175');
  t.check(/- \[x\] `credit\.release`, `pick\.settle`, `credit_note\.raise` checked on the writer/.test(read('docs/rebuild.md')), 'docs/rebuild.md ticks it off');
  [['creditCheck', 'credit.release'], ['pickSettle', 'pick.settle'], ['creditNotes', 'credit_note.raise'], ['priceReview', 'price.approve']].forEach(([k, task]) =>
    t.check(sql.includes(`'${k}'`) && sql.includes(`has_task(new.shop_id, '${task}')`), `${k} needs ${task}`));
  t.check(/ow_line_sells_under_cost\(new\.shop_id, it, presets\)/.test(sql) && /jsonb_set\(new\.payload, array\['items', \(n - 1\)::text, 'priceReview'\], 'null'::jsonb\)/.test(sql),
    'a cost raised past the price decided clears the decision (the database flags it)');
  t.check(/auth\.uid\(\) is null then return new/.test(sql), 'writes with no login are not judged');
  t.check('saved_quotes_ow_a_decisions' < 'saved_quotes_ow_checking_gate', 'it runs before the Checking gate');
  // The decision-rights rows it enforces.
  const dr = read('docs/decision-rights.md');
  t.check(/`pick\.settle` \| Manager/.test(dr) && /`credit_note\.raise` \| Manager/.test(dr) && /`credit\.release` \| Manager/.test(dr) && /`price\.approve` \| Manager/.test(dr), 'decision-rights gives each task to the Manager');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_manager_decisions_writer_test';
const psql = (args, input) => spawnSync('psql', [conn, ...args], { input, encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8', maxBuffer: 1 << 26 });
const errs = (r) => (r.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l));

const reset = psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]);
t.check(reset.status === 0, `a fresh database was made (${(reset.stderr || '').trim().slice(0, 200)})`);
const shim = fs.readFileSync(path.join(__dirname, 'fixtures', 'supabase-shim.sql'), 'utf8');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], shim).status === 0, 'the Supabase stand-in applied');

const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const failed = [];
fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort().forEach((f) => {
  const r = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]);
  if (r.status !== 0) failed.push(`${f}: ${(r.stderr || '').trim().split('\n')[0]}`);
});
t.check(failed.length === 0, `every migration applied, in order (${JSON.stringify(failed)})`);
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0175_manager_decisions_checked_on_the_writer.sql')]);
t.check(again.status === 0, `0175 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'manager-decisions-writer-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 27, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
