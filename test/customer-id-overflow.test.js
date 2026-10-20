#!/usr/bin/env node
'use strict';
/*
 * A new customer's id past C999 (0135_customer_id_overflow.sql).
 *
 * Postgres's lpad cuts a string longer than its width, so the 1000th
 * customer came out as 'C' || lpad('1000', 3, '0') = C100 -- an id in use --
 * and invoicing a walk-in stopped with a duplicate customers_pkey.
 *
 *   1. The SQL text: the invoice makes its customer through
 *      ow_free_customer_id, which never cuts and never hands out a taken id,
 *      and next_entity_id keeps every digit too.
 *   2. A REAL database, when OW_PG names one: every migration in order, a
 *      shop with C001..C999 on file, then the shared-foundation scenario --
 *      whose invoices make new customers -- must pass, and they must be
 *      C1000 and C1001 (a walk-in is nobody since 0138, so it makes none).
 *
 * Run: node test/customer-id-overflow.test.js
 *      OW_PG="host=/tmp port=5544 user=postgres" node test/customer-id-overflow.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('customer ids past C999 (0135)');
const sql = read('supabase/migrations/0135_customer_id_overflow.sql');
const fn = name => { const at = sql.indexOf('create or replace function ' + name + '('); if (at < 0) throw new Error('0135 has no ' + name); const open = sql.indexOf('$$', at); const end = sql.indexOf('$$;', open + 2); return sql.slice(at, end + 3); };

/* ---------------- 1. the SQL ---------------- */
{
  const free = fn('ow_free_customer_id');
  t.check(/lpad\(n::text, greatest\(3, length\(n::text\)\), '0'\)/.test(free), 'the new id keeps every digit: C1000, not C100');
  t.check(/exit when not exists \(select 1 from customers where shop_id = p_shop_id and id = v_id\)/.test(free), 'and is never one already on file');
  t.check(/substring\(id from '\^C\(\\d\+\)\$'\)/.test(free), 'its floor is the highest C-number on file, not every digit in every id');
  t.check(sql.includes('revoke all on function ow_free_customer_id(uuid) from public, anon, authenticated;') && !/grant execute on function ow_free_customer_id/.test(sql), 'no login calls it');
  const core = fn('ow_invoice_core');
  t.check(/cname := ow_free_customer_id\(p_shop_id\);/.test(core) && !/lpad\(ow_next_row_id/.test(core), 'invoicing makes its new customer through it');
  t.check(sql.includes('revoke all on function ow_invoice_core(uuid, bigint, text, uuid, text) from public, anon, authenticated;'), 'ow_invoice_core stays callable by no login');
  const nei = fn('next_entity_id');
  t.check(/lpad\(v::text, greatest\(coalesce\(p_pad, 3\), 1, length\(v::text\)\), '0'\)/.test(nei), 'the console\'s next_entity_id keeps every digit too');
  t.check(/if not is_shop_member\(p_shop_id\) then/.test(nei) && sql.includes('grant execute on function next_entity_id(uuid, text, text, int, bigint) to authenticated;'), 'and keeps its membership check and grant');
  // ow_invoice_core is otherwise 0119's, word for word.
  const orig = read('supabase/migrations/0119_shared_foundation.sql');
  const o = orig.slice(orig.indexOf('create or replace function ow_invoice_core('), orig.indexOf('end $$;', orig.indexOf('create or replace function ow_invoice_core(')) + 7);
  const n = core.slice(0, core.indexOf('end $$;') + 7);
  const strip = s => s.replace(/cname := [\s\S]*?;\n/, '');
  t.check(strip(o) === strip(n), 'ow_invoice_core is 0119\'s but for that one line (if 0119 changes it, change it here too)');
  const files = fs.readdirSync(path.join(__dirname, '..', 'supabase', 'migrations')).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
  const last = re => files.filter(f => re.test(read('supabase/migrations/' + f))).pop();
  // 0136 re-states ow_invoice_core once more (the invoice label past 9999)
  // and test/audit-0136.test.js holds it to 0135's text but for that line;
  // 0138 re-states it again (no bill at cost, no walk-in debtor) and
  // test/invoice-unpriced-db.test.js holds it to 0136's but for those.
  t.check(last(/create or replace function ow_invoice_core\(/) === '0138_no_bill_at_cost_no_walkin_debtor.sql' && last(/create or replace function next_entity_id\(/) === '0135_customer_id_overflow.sql', 'in number order, 0138 is the last word on the core and 0135 on next_entity_id');
  t.check(/\| 0135 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0135 for it');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the C1000 case is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_customer_id_test';
const psql = args => spawnSync('psql', [conn, ...args], { encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });
t.check(psql(['-qAt', '-c', `drop database if exists ${db}`, '-c', `create database ${db}`]).status === 0, 'a fresh database was made');
t.check(onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], read('test/fixtures/supabase-shim.sql')).status === 0, 'the Supabase stand-in applied');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const failed = [];
fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort().forEach(f => {
  const r = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, f)]);
  if (r.status !== 0) failed.push(`${f}: ${(r.stderr || '').trim().split('\n')[0]}`);
});
t.check(failed.length === 0, `every migration applied, in order (${JSON.stringify(failed)})`);

// The scenario's shop, with 999 customers on file before its first order.
const filler = "\ninsert into customers(shop_id,id,name,debt) select '11111111-1111-1111-1111-111111111111', 'C' || lpad(g::text, 3, '0'), 'Customer ' || g, 0 from generate_series(2, 999) g;\n";
let scenario = read('test/fixtures/shared-foundation-scenario.sql');
const at = scenario.indexOf("\n-- Orders already on the road");
scenario = scenario.slice(0, at) + filler + scenario.slice(at)
  + "\nselect 'NEW', string_agg(name || '=' || id, ',' order by id) from customers where shop_id = '11111111-1111-1111-1111-111111111111' and id ~ '^C\\d{4,}$';\n";
const run = onDb(['-qAt', '-F', '\t'], scenario);
const lines = (run.stdout || '').split('\n');
const rows = lines.filter(l => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 55, `the scenario ran (${rows.length} cases)`);
const bad = rows.filter(l => !l.startsWith('PASS'));
t.check(bad.length === 0, `every case passed with 999 customers on file (${bad.slice(0, 3).join(' | ')})`);
const g = lines.find(l => l.startsWith('NEW\t'));
// Since 0138 a walk-in is nobody: the paid counter sale makes no customer, so the
// clients new at invoicing are the two named ones, numbered past C999.
t.check(g === 'NEW\tGgaba Stores=C1000,Mukono Roofing=C1001', `the clients new at invoicing are C1000 and C1001, and no "Walk-in" customer is made (${g})`);

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
