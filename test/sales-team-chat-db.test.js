#!/usr/bin/env node
'use strict';
/*
 * Sales, seventh (0170; docs/audit/sales/BUILD-2026-10-28.md): the team chat
 * -- a chat's salesperson, taken first-come, handed with a note, moved by the
 * Manager, each logged and pushed; team notes; a reply by someone else pushes
 * the chat's salesperson -- and a customer's kind, the Manager's to change.
 *
 *   1. The SQL text.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0170
 *      run twice, then test/fixtures/sales-team-chat-scenario.sql, as the
 *      owner, the Manager, two salespeople and Accounts.
 *
 * Run: node test/sales-team-chat-db.test.js
 *      OW_PG="host=/var/lib/postgresql/owtest port=5433 user=postgres" node test/sales-team-chat-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('Sales: the team chat and a customer\'s kind (0170)');
const raw = read('supabase/migrations/0170_sales_team_chat.sql');
const sql = raw.replace(/--[^\n]*/g, '');

/* ---------------- 1. the text ---------------- */
{
  t.check(/alter table wa_conversations add column if not exists owner_user_id uuid/.test(sql), 'a chat has a salesperson');
  t.check(/create trigger wa_conversations_owner_guard before update on wa_conversations/.test(sql) && /current_setting\('ow\.chat_owner', true\)/.test(sql), 'who has a chat changes only through the functions');
  t.check(/has_task\(c\.shop_id, 'chat\.take'\)/.test(sql) && /has_task\(c\.shop_id, 'chat\.move'\)/.test(sql), 'take and hand need chat.take; a move needs chat.move');
  t.check(/\('sales', 'chat\.take'\)/.test(sql) && /\('manager', 'chat\.take'\)/.test(sql) && /\('manager', 'chat\.move'\)/.test(sql) && !/\('sales', 'chat\.move'\)/.test(sql), 'Sales and the Manager take; only the Manager moves');
  t.check(/'chat\.handed'/.test(sql) && /'chat\.reply_by_other'/.test(sql) && /'chat\.note'/.test(sql), 'a hand-over, a reply by someone else and a note naming you are pushed');
  t.check(/customers_kind_check check \(kind is null or kind in \('contractor', 'reseller', 'retail'\)\)/.test(sql) && /create trigger customers_kind_guard/.test(sql), 'a customer\'s kind is one of three, the Manager\'s to change');
  t.check(!/\bdelete from\b/i.test(sql), 'nothing is deleted');
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  const doc = read('docs/decision-rights.md');
  t.check(/\| 0170 \| Sales, seventh/.test(doc), 'docs/decision-rights.md reserves 0170');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_sales_team_chat_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0170_sales_team_chat.sql')]);
t.check(again.status === 0, `0170 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);
const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'sales-team-chat-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 30, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});
psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
