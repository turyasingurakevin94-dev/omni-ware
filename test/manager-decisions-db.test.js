#!/usr/bin/env node
'use strict';
/*
 * The Manager's decisions (0122_manager_decisions.sql).
 *
 * docs/decision-rights.md gives the Manager prices, markups, credit,
 * invoicing, returns, voids, write-offs, goals and limits. 0122 grants
 * the tasks and builds the narrow doors they go through. This holds it
 * two ways:
 *
 *   1. The SQL text, everywhere: every function exists, is SECURITY
 *      DEFINER with a pinned search_path, checks the task the decision
 *      rights name, writes the owner's log, and is revoked from public;
 *      the two internal helpers are callable by nobody; the guards still
 *      refuse invoicing and un-voiding from a desk login; the two new
 *      tables have no update policy.
 *   2. A REAL database, when OW_PG names one (as test/manager-role-db
 *      does): every migration applied in order, 0122 run twice, then
 *      test/fixtures/manager-decisions-scenario.sql signs in as Sales, the
 *      Manager, the Store and the owner and tries each decision.
 *
 * Run: node test/manager-decisions-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/manager-decisions-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('the Manager\'s decisions (0122)');
const raw = read('supabase/migrations/0122_manager_decisions.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---- the body of one function, from its create to the next create ---- */
function fnBody(name) {
  const at = sql.search(new RegExp(`create or replace function ${name}\\(`));
  if (at < 0) return '';
  const rest = sql.slice(at + 10);
  const next = rest.search(/create or replace function |create table |\ndo \$\$/);
  return sql.slice(at, next < 0 ? sql.length : at + 10 + next);
}

/* ---------------- 1. the tasks ---------------- */
{
  const grant = (/insert into role_tasks[\s\S]*?;/.exec(sql) || [''])[0];
  const want = ['price.approve', 'markup.set', 'margin.see', 'invoice.make', 'pick.settle', 'credit_note.raise',
    'invoice.void', 'credit.set', 'promise.record', 'agent.change', 'trip.difference', 'stock.writeoff',
    'restock.hold', 'goal.set', 'team.limits'];
  const got = [...grant.matchAll(/\('manager', '([a-z_.]+)'\)/g)].map((m) => m[1]);
  t.check(want.every((w) => got.includes(w)) && got.length === want.length, `the Manager gets exactly its ${want.length} tasks (${got.join(', ')})`);
  t.check(/on conflict do nothing/.test(grant), 'the grant can run twice');
  t.check(!/'(buy\.restock|stock\.report|stock\.receive)'\)/.test(grant), 'and not the Buyer\'s or the Store\'s rows built later');
  t.check(/invoice\.make[\s\S]{0,200}0119/.test(raw), 'the header says invoice.make waits on the shared invoicing function (0119)');
}

/* ---------------- 2. the functions, as the Manager app calls them ---------------- */
const FNS = {
  set_shop_preset: { sig: 'p_shop_id uuid, p_key text, p_value jsonb', tasks: ['markup.set', 'credit.set', 'team.limits'] },
  set_product_markup: { sig: 'p_shop_id uuid, p_product_id text, p_fields jsonb', tasks: ['markup.set'] },
  manager_stock_move: { sig: 'p_shop_id uuid, p_lines jsonb, p_type text, p_note text, p_task text', tasks: ['stock.writeoff', 'credit_note.raise', 'invoice.void'] },
  decide_invoice_ask: { sig: 'p_id uuid, p_status text', tasks: ['invoice.void', 'credit_note.raise'] },
  void_sale_bills: { sig: 'p_shop_id uuid, p_quote_id bigint', tasks: ['invoice.void'] },
  accept_trip_difference: { sig: 'p_trip_id text', tasks: ['trip.difference'] },
  hold_restock_line: { sig: 'p_id uuid, p_hold boolean', tasks: ['restock.hold'] },
  write_off_stock: { sig: 'p_shop_id uuid, p_report_ids uuid\\[\\], p_lines jsonb, p_reason text', tasks: ['stock.writeoff'] },
  dismiss_stock_report: { sig: 'p_id uuid', tasks: ['stock.writeoff'] },
  set_person_goal: { sig: 'p_shop_id uuid, p_who text, p_aim numeric, p_from date, p_to date', tasks: ['goal.set'] },
};
for (const [name, f] of Object.entries(FNS)) {
  const body = fnBody(name);
  t.check(new RegExp(`create or replace function ${name}\\(${f.sig}\\)\\s*returns jsonb`).test(sql), `${name}(${f.sig.replace(/\\/g, '')}) returns jsonb`);
  t.check(/language plpgsql security definer set search_path = public/.test(body), `${name} is security definer with a pinned search_path`);
  const asks = f.tasks.every((task) => body.includes(`'${task}'`)) && /has_task\(/.test(body);
  t.check(asks, `${name} asks has_task for ${f.tasks.join(' / ')}`);
  t.check(/errcode = '42501'/.test(body), `${name} refuses a missing task with 42501`);
  t.check(/perform manager_log_decision\(/.test(body), `${name} writes the owner's log`);
  t.check(/jsonb_build_object\('ok', true/.test(body), `${name} answers {ok: true, ...}`);
  const types = f.sig.replace(/\\/g, '').split(',').map((p) => p.trim().split(/\s+/).slice(1).join(' ')).join(', ');
  t.check(sql.includes(`revoke all on function ${name}(${types}) from public, anon;`)
    && sql.includes(`grant execute on function ${name}(${types}) to authenticated;`), `${name} is revoked from public and granted to signed-in logins`);
}

/* the helpers: the log writer and the stock mover are nobody's to call */
{
  t.check(/revoke all on function manager_log_decision\([^)]*\) from public, anon, authenticated;/.test(sql)
    && !/grant execute on function manager_log_decision/.test(sql), 'the log writer is callable by no client');
  t.check(/revoke all on function manager_apply_stock_lines\([^)]*\) from public, anon, authenticated;/.test(sql)
    && !/grant execute on function manager_apply_stock_lines/.test(sql), 'the stock mover is callable by no client');
  const log = fnBody('manager_log_decision');
  t.check(/insert into decision_log \(shop_id, by, by_name, role, task, what, amount, ref, before, after\)/.test(log),
    'the log row carries who, their name and role, the task, the line, the amount, the ref and before / after');
  t.check(/from staff s/.test(log) && /from shop_members m/.test(log), 'by_name comes from staff, role from the membership');
  t.check(/to_regclass\('public\.decision_log'\) is null then return/.test(log), 'a database without 0123 is not broken by the log');
}

/* the stock mover: accept_stock_count's mechanics */
{
  const mv = fnBody('manager_apply_stock_lines');
  t.check(/on conflict \(shop_id, key\) do update set qty = excluded\.qty/.test(mv), 'stock is upserted');
  t.check(/greatest\(0,/.test(mv), 'never below zero');
  t.check(/from stock_lots where shop_id = p_shop_id and key = k order by id/.test(mv), 'the oldest lots go first');
  t.check(/insert into stock_lots \(shop_id, key, qty, cost\) values \(p_shop_id, k, v_delta, v_cost\)/.test(mv), 'goods back come in as a lot at their cost');
  t.check(/'row:stock_log'/.test(mv) && /insert into stock_log \(id,/.test(mv), 'each line logs a stock_log row with an id from the shared counter');
  const sm = fnBody('manager_stock_move');
  t.check(/p_type not in \('writeoff', 'reversal'\)/.test(sm), 'a move is a writeoff or a reversal');
  t.check(/case when p_task = 'stock\.writeoff' then -1 else 1 end/.test(sm), 'a write-off goes down, a return or a void comes back');
}

/* ---------------- 3. the guards, redrawn ---------------- */
{
  const sq = fnBody('saved_quotes_sales_guard');
  t.check(/if not is_shop_desk\(new\.shop_id\) then return new; end if;/.test(sq), 'the order guard binds both desk roles, as 0116 left it');
  t.check(/if new\.invoiced or new\.voided then\s+raise exception/.test(sq), 'a desk login never inserts an invoiced or voided order');
  t.check(/if new\.invoiced is distinct from old\.invoiced then\s+raise exception/.test(sq), 'a desk login never invoices or un-invoices by saving');
  t.check(/if old\.voided then\s+raise exception/.test(sq), 'and never un-voids');
  t.check(/has_task\(new\.shop_id, 'invoice\.void'\)/.test(sq), 'a void is invoice.void');
  t.check(/has_task\(new\.shop_id, 'agent\.change'\) and coalesce\(new\.payload, '\{\}'::jsonb\) \? 'agentCancel'\s+and not coalesce\(old\.invoiced, false\)/.test(sq),
    'agent.change closes only an agent\'s cancelled, uninvoiced order');
  t.check(/create trigger saved_quotes_sales_guard before insert or update on saved_quotes/.test(sql), 'the order guard is re-attached');

  const cu = fnBody('customers_sales_guard');
  t.check(/coalesce\(new\.debt, 0\) > coalesce\(old\.debt, 0\) then\s+raise exception/.test(cu), 'a desk login still never raises a debt');
  t.check(/coalesce\(new\.debt, 0\) <> 0 then\s+raise exception/.test(cu), 'a new customer still owes nothing');
  t.check((cu.match(/has_task\(new\.shop_id, 'credit\.set'\)/g) || []).length === 2, 'a limit or terms, new or changed, is credit.set');
  t.check(!/the owner/i.test(cu) && /Manager''s to set \(credit\.set\)/.test(cu), 'the refusal names the Manager, not the owner');
  t.check(/if tg_op = 'INSERT' and exists \(select 1 from customers c/.test(cu), 'an upsert of an existing customer is judged as the update it becomes');
  t.check(/create trigger customers_sales_guard before insert or update on customers/.test(sql), 'the customer guard is re-attached');

  t.check(!/create policy[^;]*on products/.test(sql) && !/owner updates only" on products/.test(sql),
    'products stay closed to direct writes; markups go through set_product_markup');
  const mk = fnBody('set_product_markup');
  ['wholesale_markup_type', 'wholesale_markup_value', 'retail_markup_type', 'retail_markup_value',
    'stock_wholesale_markup_type', 'stock_wholesale_markup_value', 'stock_retail_markup_type', 'stock_retail_markup_value']
    .forEach((c) => t.check(new RegExp(`\\b${c}\\s*=`).test(mk), `set_product_markup sets ${c}`));
  t.check(/not in \('percent', 'fixed'\)/.test(mk), 'markup types are the ones index.html writes: percent or fixed');
  t.check(!/\bname\s*=/.test(mk.replace(/v_name/g, '')), 'and never the product\'s name or anything else');
}

/* ---------------- 4. the new tables ---------------- */
for (const tbl of ['restock_lines', 'stock_reports']) {
  t.check(new RegExp(`create table if not exists ${tbl} \\(`).test(sql), `${tbl} is created, once`);
  t.check(new RegExp(`alter table ${tbl} enable row level security`).test(sql), `${tbl} has row-level security`);
  t.check(new RegExp(`create policy "[^"]+" on ${tbl}\\s+for select using \\(is_shop_member\\(shop_id\\)\\)`).test(sql), `members read ${tbl}`);
  t.check(!new RegExp(`create policy "[^"]+" on ${tbl}\\s+(as restrictive\\s+)?for (update|all|delete)`).test(sql), `${tbl} has no update, delete or all policy`);
}
t.check(/on restock_lines\s+for insert with check \(has_task\(shop_id, 'buy\.restock'\)/.test(sql), 'restock lines are added by buy.restock');
t.check(/on stock_reports\s+for insert with check \(has_task\(shop_id, 'stock\.report'\) and reported_by = auth\.uid\(\) and status = 'sent'/.test(sql),
  'stock reports are added by stock.report, as the reporter, sent');
t.check(/check \(status in \('planned', 'held', 'bought', 'dropped'\)\)/.test(sql), 'a restock line is planned, held, bought or dropped');
t.check(/check \(why in \('damaged', 'lost', 'stolen', 'expired', 'other'\)\)/.test(sql), 'a report says why');
t.check(/restock_lines[\s\S]{0,40}0125/.test(raw) && /stock_reports[\s\S]{0,80}0124/.test(raw), 'the header names the builds that write each table');

/* ---------------- 5. trips, goals ---------------- */
{
  const tr = fnBody('accept_trip_difference');
  t.check(/l ->> 'gotQty'/.test(tr) && /l ->> 'yardQty'/.test(tr), 'a trip\'s difference is the Buyer\'s gotQty against the yard\'s yardQty');
  t.check(!/(insert into|update) stock\b/.test(tr) && !/stock_lots/.test(tr), 'accepting it moves no stock (stock.receive is the Store\'s, later)');
  t.check(/add column if not exists difference_accepted_at timestamptz/.test(sql) && /add column if not exists difference_accepted_by uuid/.test(sql),
    'the acceptance is two columns on the trip');
  t.check(/create trigger collection_trips_difference_guard/.test(sql), 'and members cannot set them without trip.difference');
  const g = fnBody('set_person_goal');
  t.check(/'who', p_who, 'metric', 'sales', 'aim'/.test(g) && /'from', to_char\(p_from/.test(g) && /'to', to_char\(p_to/.test(g),
    'a goal is the target row manager.html personGoal() reads: who, metric sales, aim, from, to');
  t.check(/kind = 'target' and n\.status = 'open'/.test(g) && /set status = 'closed'/.test(g), 'the person\'s overlapping open goal is closed');
}

/* ---------------- 6. it runs twice ---------------- */
{
  const policies = [...sql.matchAll(/create policy "([^"]+)" on ([a-z_]+)/g)];
  t.check(policies.every(([, n, tb]) => sql.includes(`drop policy if exists "${n}" on ${tb};`)), 'every policy is dropped before it is made');
  const triggers = [...sql.matchAll(/create trigger ([a-z_]+) [\s\S]*? on ([a-z_]+)/g)];
  t.check(triggers.every(([, n, tb]) => sql.includes(`drop trigger if exists ${n} on ${tb};`)), 'every trigger is dropped before it is made');
  t.check(!/create table (?!if not exists)/.test(sql) && !/create index (?!if not exists)/.test(sql), 'tables and indexes are made only if missing');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says so, and how to check and roll back');
}

/* ---------------- 7. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_manager_decisions_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0122_manager_decisions.sql')]);
t.check(again.status === 0, `0122 runs a second time without error (${(again.stderr || '').trim().split('\n')[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'manager-decisions-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 60, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
