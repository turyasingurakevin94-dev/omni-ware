#!/usr/bin/env node
'use strict';
/*
 * The shared foundation (0119_shared_foundation.sql): the Checking gate,
 * the one invoicing function, and the run that invoices a delivered order
 * after 24 hours. docs/decision-rights.md section 5 step 0.
 *
 *   1. The SQL text, everywhere: the gate trigger, invoice_order() and its
 *      rights, the helpers nobody may call, the hourly schedule, the
 *      stale-copy guard, and that it runs twice.
 *   2. A REAL database, when OW_PG names one: every migration applied in
 *      order, 0119 run twice, then test/fixtures/shared-foundation-scenario.sql
 *      signs in as Sales, the Manager, the Store, Accounts and the owner.
 *
 * Run: node test/shared-foundation-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/shared-foundation-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('the shared foundation (0119)');
const raw = read('supabase/migrations/0119_shared_foundation.sql');
const sql = raw.replace(/--[^\n]*/g, '');

function fnBody(name) {
  const at = sql.search(new RegExp(`create or replace function ${name}\\(`));
  if (at < 0) return '';
  const rest = sql.slice(at + 10);
  const next = rest.search(/create or replace function |create table |\ndo \$\$/);
  return sql.slice(at, next < 0 ? sql.length : at + 10 + next);
}

/* ---------------- 1. the gate ---------------- */
{
  const g = fnBody('saved_quotes_ow_checking_gate');
  t.check(/create trigger saved_quotes_ow_checking_gate before insert or update on saved_quotes/.test(sql), 'the gate sits on every insert and update of an order');
  t.check(/if uid is null then return new; end if;/.test(g), 'Edge Functions and the hourly run are not gated');
  t.check(/tg_op = 'INSERT' and exists \(select 1 from saved_quotes q where q\.id = new\.id\) then return new;/.test(g),
    'an upsert of an order already saved is judged as the update it becomes');
  t.check(/not has_task\(new\.shop_id, 'price\.approve'\)/.test(g) && /errcode = '42501'/.test(g), 'only price.approve writes a line\'s priceReview');
  t.check(/new\.status := 'preparing'/.test(g) && /'__stock__'/.test(g) && /originAgentId/.test(g), 'an order all from our shelf goes straight to Packing, an agent\'s does not');
  t.check(/ow_gate_reason\(new\.shop_id, new\.payload, new\.amount_paid\)/.test(g) && /new\.status := 'draft'/.test(g) && /'gateHeldMove'/.test(g),
    'a move the gate refuses is kept back on the order, not thrown away');
  t.check(/held ->> 'terms' is distinct from ow_gate_terms\(new\.payload\)/.test(g), 'a held move goes stale when the lines move under it');
  t.check(!/v_role (not )?in \('owner'[^)]*\)[\s\S]{0,80}ow_gate_reason/.test(g), 'the gate binds the owner too');
  const why = fnBody('ow_gate_reason');
  t.check(/ow_line_waits_price/.test(why) && /'price'/.test(why), 'a price waiting for the Manager holds the order');
  t.check(/credit_limit/.test(why) && /dec ->> 'decision' = 'hold'/.test(why) && /'credit'/.test(why), 'so does going over the credit limit until the Manager says Release');
  const w = fnBody('ow_line_waits_price');
  t.check(/\('under', 'nomargin', 'nocost'\)/.test(w) && /priceBy/.test(w), 'the same question manager.html asks: a salesperson\'s price under the shop\'s');
}

/* ---------------- 2. invoicing ---------------- */
{
  const io = fnBody('invoice_order');
  t.check(/create or replace function invoice_order\(p_shop_id uuid, p_quote_id bigint\)\s*returns jsonb/.test(sql), 'invoice_order(p_shop_id uuid, p_quote_id bigint) returns jsonb, as manager.html calls it');
  t.check(/language plpgsql security definer set search_path = public/.test(io), 'it is security definer with a pinned search_path');
  t.check(/has_task\(p_shop_id, 'invoice\.make'\)/.test(io) && /has_task\(p_shop_id, 'counter\.sell'\)/.test(io), 'the Manager invoices; a salesperson only a counter sale');
  t.check(/<> '__stock__'/.test(io), 'a counter sale is goods off our own shelf only');
  t.check(/ow_system_begin\(\)/.test(io) && /ow_system_end\(saved\)/.test(io), 'the writes run as the system once the right is checked');
  t.check(/perform ow_log\(/.test(io), 'every invoice goes in the owner\'s log');
  t.check(sql.includes('revoke all on function invoice_order(uuid, bigint) from public, anon;')
    && sql.includes('grant execute on function invoice_order(uuid, bigint) to authenticated;'), 'signed-in logins may call it, nobody else');
  for (const f of ['ow_invoice_core(uuid, bigint, text, uuid, text)', 'ow_invoice_due_orders()', 'ow_stock_move(uuid, text, numeric, text, numeric, text, text, numeric, text)',
    'ow_next_row_id(uuid, text, bigint)', 'ow_system_begin()', 'ow_system_end(jsonb)', 'ow_log(uuid, uuid, text, text, text, text, numeric, jsonb, jsonb, jsonb)']) {
    t.check(sql.includes(`revoke all on function ${f} from public, anon, authenticated;`) && !sql.includes(`grant execute on function ${f.split('(')[0]}`),
      `${f.split('(')[0]} is callable by no login`);
  }
  const core = fnBody('ow_invoice_core');
  t.check(/'OWSHP'/.test(core) && /'OWPRC'/.test(core) && /'OWBIL'/.test(core), 'refused for a short pick, a price undecided, or bills already raised');
  t.check(/'sale'/.test(core) && /'restock'/.test(core) && /insert into purchase_invoices/.test(core) && /insert into customer_debt_log/.test(core),
    'it moves the stock, raises the bills and brings the debt to the balance, as the console does');
  t.check(/'Auto-sync — ' \|\| inv_label/.test(core), 'the debt line reads as the console\'s does');
  t.check(/'_stockTaken'/.test(core) && /'_stockLots'/.test(core) && /'_surplusStocked'/.test(core) && /'debtCharged'/.test(core),
    'and leaves on the order what the console needs to take it back');
  t.check(/insert into role_tasks \(role, task\) values \('sales', 'counter\.sell'\) on conflict do nothing;/.test(sql), 'Sales gets counter.sell here');
}

/* ---------------- 3. the 24 hours, and a stale copy ---------------- */
{
  const due = fnBody('ow_invoice_due_orders');
  t.check(/interval '24 hours'/.test(due) && /status = 'completed' and not q\.invoiced and not q\.voided/.test(due), 'every delivered order 24 hours old, not invoiced, not voided');
  t.check(/exception when others then/.test(due), 'one order that cannot be invoiced does not stop the rest');
  t.check(/cron\.schedule\('ow-invoice-due', '7 \* \* \* \*'/.test(sql) && /cron\.unschedule/.test(sql), 'scheduled every hour, once');
  const k = fnBody('saved_quotes_ow_keep_invoice');
  t.check(/old\.invoiced and not coalesce\(new\.invoiced, false\)/.test(k) && /'invoicedBy'/.test(k), 'a copy that never saw the invoice cannot take it back');
  t.check(/create trigger saved_quotes_ow_keep_invoice before update on saved_quotes/.test(sql), 'that guard is attached');
}

/* ---------------- 4. it runs twice ---------------- */
{
  const triggers = [...sql.matchAll(/create trigger ([a-z_]+) [\s\S]*? on ([a-z_]+)/g)];
  t.check(triggers.every(([, n, tb]) => sql.includes(`drop trigger if exists ${n} on ${tb};`)), 'every trigger is dropped before it is made');
  t.check(!/create table (?!if not exists)/.test(sql) && !/create index (?!if not exists)/.test(sql), 'tables and indexes are made only if missing');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says so, and how to check and roll back');
  const doc = read('docs/decision-rights.md');
  t.check(/\| 0119 \| /.test(doc), 'docs/decision-rights.md reserves 0119 for this build');
  t.check(/'invoice_order', \{ p_shop_id: S\.shopId, p_quote_id: /.test(read('manager.html')), 'manager.html calls it by the same name and arguments');
}

/* ---------------- 5. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_shared_foundation_test';
const psql = (args, input) => spawnSync('psql', [conn, ...args], { input, encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8' });

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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0119_shared_foundation.sql')]);
t.check(again.status === 0, `0119 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'shared-foundation-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 55, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
