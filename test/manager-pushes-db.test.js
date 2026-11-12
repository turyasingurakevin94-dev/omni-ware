#!/usr/bin/env node
'use strict';
/*
 * The Manager's pushes (0184; docs/audit/manager/handover.md §4,
 * docs/spec/04-screens-manager-data.md §3): each ask lands on the Manager
 * with who asks, what, and the evidence; each answer is told to the people it
 * changes by the Manager's name; a push carries only a safe answer, and
 * answer_from_push answers it only for its recipient with the task, once per
 * key, never on a stale ask, never with an answer the push does not offer.
 *
 *   1. The SQL text: header, no role or task changes, every kind, the safe list.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0184
 *      run twice, then test/fixtures/manager-pushes-scenario.sql; and, when
 *      docs/audit/manager/0184b-credit-ask.sql is there, that file run twice
 *      and its own cases.
 *
 * Run: node test/manager-pushes-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/manager-pushes-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('The Manager\'s pushes (0184)');
const raw = read('supabase/migrations/0184_manager_pushes.sql');
const sql = raw.replace(/--[^\n]*/g, '');
const fn = (name) => {
  const at = sql.indexOf(`create or replace function ${name}(`);
  return at < 0 ? '' : sql.slice(at, sql.indexOf('$$;', sql.indexOf('$$', at) + 2) + 3);
};

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  const row = (/^\| 0184 \| (.*)$/m.exec(read('docs/decision-rights.md')) || [])[1] || '';
  t.check(/answer_from_push/.test(row) && /0184_manager_pushes\.sql/.test(row), 'docs/decision-rights.md reserves 0184 and says what it holds');
  t.check(!/insert into role_tasks|delete from role_tasks|update role_tasks/i.test(sql), 'no role or task changes (team.nudge is 0116\'s)');
  t.check(!/insert into (cash_txns|customer_debt_log|stock_log|stock_lots)|update customers|update stock\b/i.test(sql), 'writes no money and no stock itself');
  const kinds = ['order.cancelled', 'invoice.voided', 'credit_note.raised', 'agent.change.decided', 'team.nudge', 'goal.set', 'markup.wanted',
    'promise.made', 'trip.difference.decided', 'price.decided', 'price.waits', 'credit.hold', 'pick.short', 'trip.difference', 'stock.report',
    'invoice.held', 'order.cancel.ask.decided', 'restock.held', 'restock.released', 'carton.refused'];
  const missing = kinds.filter((k) => !new RegExp(`'${k.replace(/\./g, '\\.')}'`).test(sql));
  t.check(missing.length === 0, `every new or re-worded push kind is written (${missing.join(', ') || 'all'})`);
  t.check(/Not paid yet · on credit\?/.test(sql) && /Cash first · it stays/.test(sql), 'credit.ask and credit.ask.decided in the agreed words');
  t.check(!/'order\.delivered'/.test(fn('saved_quotes_ow_push')) && fn('saved_quotes_ow_push').length > 0, 'order.delivered to invoice.make is retired');
  t.check(!/sqlerrm/.test(fn('ow_invoice_due_orders').replace(/raise notice[^;]*;/g, '').replace(/v_why := sqlerrm/, '')), 'invoice.held says why by its code, never the database\'s text');
  t.check(!/'The Manager'/.test(sql), 'no push names "The Manager": the person\'s name (ow_name_of)');
  t.check(/alter table push_outbox add column if not exists actions jsonb/.test(sql) && /alter table push_subscriptions add column if not exists app_build int/.test(sql),
    'push_outbox.actions and push_subscriptions.app_build');
  // N-9: the actions are only the safe answers, and answer_from_push carries no money move.
  const acts = fn('ow_push_actions');
  const ids = [...acts.matchAll(/'id', '([a-z]+)'/g)].map((m) => m[1]).sort();
  t.check(JSON.stringify([...new Set(ids)]) === JSON.stringify(['again', 'approve', 'credit', 'keep', 'kept', 'ok', 'shop', 'take', 'went']),
    `the actions are the safe answers only (${[...new Set(ids)].join(', ')})`);
  const ans = fn('answer_from_push');
  t.check(!/write_off_stock|raise_credit_note|void_invoice|void_with_money|cancel_order|accept_stock_count|merge_customers|set_opening_balance|receive_payment|invoice_order|answer_cancel_ask\([^)]*true/.test(ans),
    'answer_from_push never writes off, credits, voids, refunds, cancels, takes a count, merges, bills or takes money');
  t.check(/ow_push_recipients\(o\.id\)/.test(ans) && /has_task\(o\.shop_id, o\.to_task\)/.test(ans) && /Someone else just did this/.test(ans) && /answered ->> 'key' = p_key::text/.test(ans)
    && /That answer is not on this push/.test(ans), 'answer_from_push: the recipient with the task, once per key, refused when stale or not offered');
  t.check(/'via', 'push'/.test(ans), 'and its owner\'s-log line says it came from the push');
  t.check(/create or replace function nudge_person\(p_shop uuid, p_to uuid, p_order bigint, p_words text\)/.test(sql) && /has_task\(p_shop, 'team\.nudge'\)/.test(sql),
    'nudge_person(p_shop, p_to, p_order, p_words) needs team.nudge');
  t.check(!/create table/i.test(sql), 'no new table (customer_asks waits on Kevin: docs/audit/manager/0184b-credit-ask.sql)');
}

const askFile = path.join(__dirname, '..', 'docs', 'audit', 'manager', '0184b-credit-ask.sql');
const hasAsk = fs.existsSync(askFile);
if (hasAsk) {
  const a = fs.readFileSync(askFile, 'utf8');
  const s = a.replace(/--[^\n]*/g, '');
  t.check(/Safe to run twice/.test(a) && /ROLLBACK/.test(a) && /CHECK AFTERWARDS/.test(a), '0184b: the header says it runs twice, and how to check and roll back');
  t.check(/create table if not exists customer_asks/.test(s) && /'credit\.limit\.ask'/.test(s) && /'credit\.limit\.ask\.decided'/.test(s), '0184b: customer_asks and its two pushes');
  t.check(!/insert into role_tasks/i.test(s), '0184b: no role or task changes');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_manager_pushes_test';
const psql = (args, input) => spawnSync('psql', [conn, ...args], { input, encoding: 'utf8' });
const onDb = (args, input) => spawnSync('psql', [`${conn} dbname=${db}`, ...args], { input, encoding: 'utf8', maxBuffer: 1 << 26 });
const errs = (r) => (r.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l));
const results = (r) => (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));

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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0184_manager_pushes.sql')]);
t.check(again.status === 0, `0184 runs a second time without error (${errs(again)[0] || 'ok'})`);
if (hasAsk) {
  [1, 2].forEach((n) => {
    const r = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', askFile]);
    t.check(r.status === 0, `0184b applies (run ${n}) (${errs(r)[0] || 'ok'})`);
  });
}

const r = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'manager-pushes-scenario.sql'), 'utf8'));
const rows = results(r);
t.check(rows.length >= 70, `the scenario ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });

if (hasAsk) {
  const r2 = onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'manager-credit-ask-scenario.sql'), 'utf8'));
  const rows2 = results(r2);
  t.check(rows2.length >= 8, `0184b's cases ran (${rows2.length}${errs(r2).length ? '; ' + errs(r2).slice(0, 2).join(' | ') : ''})`);
  rows2.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `0184b: ${label} — ${got}`); });
}

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
