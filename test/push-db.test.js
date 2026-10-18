#!/usr/bin/env node
'use strict';
/*
 * Push for every app (0120_push_for_every_app.sql): every handoff that
 * waits on someone sends that person a push (docs/decision-rights.md,
 * "Push notifications are part of the system").
 *
 *   1. The SQL text: the outbox, who a push is for, each handoff's
 *      trigger and the task it names, the owner's digest, and that the
 *      push-send function delivers it.
 *   2. A REAL database, when OW_PG names one: every migration applied in
 *      order, 0120 run again (after 0122, as its header says), then
 *      test/fixtures/push-scenario.sql walks each handoff.
 *
 * Run: node test/push-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/push-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('push for every app (0120)');
const raw = read('supabase/migrations/0120_push_for_every_app.sql');
const sql = raw.replace(/--[^\n]*/g, '');

function fnBody(name) {
  const at = sql.search(new RegExp(`create or replace function ${name}\\(`));
  if (at < 0) return '';
  const rest = sql.slice(at + 10);
  const next = rest.search(/create or replace function |create table |\ndo \$\$/);
  return sql.slice(at, next < 0 ? sql.length : at + 10 + next);
}

/* ---------------- 1. the outbox ---------------- */
{
  t.check(/alter table push_subscriptions alter column staff_id drop not null/.test(sql), 'a login with no staff row (the owner) can register a phone');
  t.check(/create table if not exists push_outbox \(/.test(sql) && /alter table push_outbox enable row level security/.test(sql), 'the outbox is made once, with row-level security');
  t.check(!/create policy "[^"]+" on push_outbox\s+for (insert|update|delete|all)/.test(sql), 'no login writes the outbox');
  t.check(/push_outbox_dedupe_idx on push_outbox\(shop_id, dedupe\) where dedupe is not null/.test(sql), 'one push per thing: a dedupe key');
  const who = fnBody('ow_push_recipients');
  t.check(/m\.user_id is distinct from o\.from_user/.test(who), 'whoever made the write is never pushed about it');
  t.check(/role_tasks rt where rt\.role = m\.role and rt\.task = o\.to_task/.test(who), 'a push by task follows the decision rights (role_tasks), so the owner gets none');
  t.check(sql.includes('revoke all on function ow_push_recipients(bigint) from public, anon, authenticated;')
    && sql.includes('revoke all on function ow_push(uuid, text, text, text, uuid, text, text, jsonb, text) from public, anon, authenticated;'),
    'no login may write a push or ask who one goes to');
  t.check(/exception when others then\s+raise notice 'push_outbox/.test(fnBody('ow_push')), 'a push never stops the write that asked for it');
}

/* ---------------- 2. each handoff, to the task the rules name ---------------- */
{
  const want = {
    saved_quotes_ow_push: ["'price.approve'", "'credit.release'", "'pick.settle'", "'agent.change'", "'invoice.make'", 'taker'],
    collection_trips_ow_push: ["'stock.receive'", "'trip.cash'", "'trip.difference'"],
    stock_reports_ow_push: ["'stock.writeoff'"],
    restock_lines_ow_push: ["'buy.restock'"],
    prices_ow_push: ['q.taker'],
    sourcing_leads_ow_push: ["'sourcing.ask'", "r ->> 'by'", "'takenBy'", "'withdrawn'"],
  };
  for (const [fn, tasks] of Object.entries(want)) {
    const body = fnBody(fn);
    t.check(tasks.every((x) => body.includes(x)), `${fn} pushes to ${tasks.join(', ')}`);
    t.check(/security definer set search_path = public/.test(body), `${fn} is security definer with a pinned search_path`);
    const tbl = fn.replace(/_ow_push$/, '');
    t.check(new RegExp(`create trigger ${fn} after [a-z ]+ on ${tbl}`).test(sql) && sql.includes(`drop trigger if exists ${fn} on ${tbl};`),
      `${fn} runs after the write, and is dropped before it is made`);
  }
  t.check(/to_regclass\('public\.stock_reports'\) is null/.test(sql) && /to_regclass\('public\.restock_lines'\) is null/.test(sql) && /RUN IT AGAIN AFTER 0122/.test(raw),
    '0122\'s two tables are skipped and named when missing, and the header says to run it again');
  const d = fnBody('ow_owner_digest');
  t.check(/'owner'/.test(d) && /'digest:' \|\| d/.test(d), 'the owner gets one digest a day, not a ping per decision');
  t.check(/cron\.schedule\('ow-owner-digest', '0 16 \* \* \*'/.test(sql), 'at 19:00 in Kampala');
  const docs = read('docs/decision-rights.md');
  t.check(/\| 0120 \| /.test(docs), 'docs/decision-rights.md reserves 0120 for this build');
}

/* ---------------- 3. delivery ---------------- */
{
  const fn = read('supabase/functions/push-send/index.ts');
  t.check(/rpc\("ow_push_recipients"/.test(fn) && /from\("push_outbox"\)/.test(fn) && /\.is\("sent_at", null\)/.test(fn), 'push-send sends what the outbox holds, to whom the database says');
  t.check(/x-webhook-secret/.test(fn) && /PUSH_SEND_SECRET/.test(fn), 'and checks the webhook\'s secret');
  t.check(/UNREGISTERED/.test(fn) && /MAX_TRIES/.test(fn), 'a retired phone is dropped, a failed push is tried again a few times');
  t.check(/\[functions\.push-send\]\s+verify_jwt = false/.test(read('supabase/config.toml')), 'deployed open, like notify-worker, because a webhook drives it');
}

/* ---------------- 4. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_push_test';
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
// Run again after 0122, as the header says: that attaches the triggers on
// 0122's two tables.
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0120_push_for_every_app.sql')]);
t.check(again.status === 0, `0120 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'push-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 30, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
