#!/usr/bin/env node
'use strict';
/*
 * Sales places an order through a server function (0180;
 * docs/spec/05-data.md §8 Q3 and §9 Q6): place_order numbers the order and
 * inserts it in one write, as sales.html inserts it, and every guard on
 * saved_quotes still judges it as the caller.
 *
 *   1. The SQL text, the decision-rights row, and the new app's write path.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0180
 *      run twice, then test/fixtures/place-order-scenario.sql.
 *
 * Run: node test/place-order-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/place-order-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const FILE = 'supabase/migrations/0180_place_order.sql';
const t = createReporter('Sales places an order through place_order (0180)');
const raw = read(FILE);
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0180 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0180');
  const f = sql.slice(sql.indexOf('create or replace function place_order'));
  t.check(/language plpgsql security definer set search_path = public/.test(f), 'one SECURITY DEFINER function');
  t.check(/has_task\(p_shop_id, 'quote\.make'\)/.test(f), 'it needs quote.make, the task for taking orders');
  t.check(/ow_next_row_id\(p_shop_id, 'row:saved_quote', floor_id\)/.test(f), 'it numbers the order from row:saved_quote, as the phone did');
  t.check(/insert into saved_quotes \(id, shop_id, client_name, client_phone, date, status, invoiced, invoiced_at, invoiced_ts, amount_paid, voided, payload\)/.test(f)
    && !/ow_system_begin|session_replication_role/.test(f), 'an ordinary insert, so every guard and trigger fires (no system bypass)');
  t.check(/'takenBy', uid::text/.test(f) && /'payments', '\[\]'::jsonb/.test(f), 'who took it and nothing paid are the server\'s');
  t.check(/presets ->> 'creditPct'/.test(f), 'the Credit charge is the shop\'s pct');
  t.check(/v_status not in \('draft', 'preparing'\)/.test(f), 'a new order starts in Checking or Packing');
  t.check(/pg_advisory_xact_lock/.test(f) && /'again', true/.test(f), 'the same key places once');
  t.check(/grant execute on function place_order\(uuid, jsonb, text\) to authenticated/.test(sql), 'signed-in callers may call it');
  const w = read('src/core/supabase/write.ts');
  t.check(/sb\.rpc\('place_order'/.test(w), 'the new app places orders through place_order (src/core/supabase/write.ts)');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_place_order_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, '..', FILE)]);
t.check(again.status === 0, `0180 runs a second time without error (${errs(again)[0] || 'ok'})`);

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'place-order-scenario.sql'), 'utf8'));
const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 49, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
