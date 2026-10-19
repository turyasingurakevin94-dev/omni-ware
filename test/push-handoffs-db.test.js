#!/usr/bin/env node
'use strict';
/*
 * The eleven pushes the notifications canvas added (0131): every handoff
 * that waits on someone tells them. The owner reviewed them on the canvas
 * and kept all eleven.
 *
 *   1. The SQL text: each trigger, the task or person it pushes to, and
 *      the two morning runs on pg_cron.
 *   2. A REAL database, when OW_PG names one: every migration in order,
 *      0131 run twice, then test/fixtures/push-handoffs-scenario.sql walks
 *      each handoff as the people who make it.
 *
 * Run: node test/push-handoffs-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/push-handoffs-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('pushes for every handoff (0131)');
const raw = read('supabase/migrations/0131_pushes_for_every_handoff.sql');
const sql = raw.replace(/--[^\n]*/g, '');

function fnBody(name) {
  const at = sql.search(new RegExp(`create or replace function ${name}\\(`));
  if (at < 0) return '';
  const rest = sql.slice(at + 10);
  const next = rest.search(/create or replace function |create table |\ndo \$\$/);
  return sql.slice(at, next < 0 ? sql.length : at + 10 + next);
}

/* ---------------- 1. each handoff, to whom the rules say ---------------- */
{
  const want = {
    saved_quotes_ow_push2: ["'credit.decided'", 'taker', "'order.buying'", "'trip.plan'"],
    invoice_asks_ow_push2: ["'invoice.ask'", "'invoice.void'", "'credit_note.raise'", "'invoice.ask.decided'", 'new.asked_by'],
    stock_reports_ow_push2: ["'stock.report.decided'", 'new.reported_by'],
    buyer_handoffs_ow_push2: ["'trip.cash.ask'", "'trip.cash'", "'trip.cash.ready'", 'new.created_by'],
    sourcing_leads_ow_push2: ["'sourcing.request'", "'sourcing.dropped'", "'sourcing.lead'"],
    ow_push_bills_due: ["'bill.due'", "'bill.pay'"],
    ow_push_prices_to_confirm: ["'prices.confirm'", "'price.list'"],
  };
  for (const [fn, bits] of Object.entries(want)) {
    const body = fnBody(fn);
    t.check(bits.every((b) => body.includes(b)), `${fn} pushes ${bits.join(', ')}`);
    t.check(/security definer set search_path = public/.test(body), `${fn} is security definer with a pinned search_path`);
    t.check(/perform ow_push\(/.test(body) && !/insert into push_outbox/.test(body), `${fn} goes through 0120's ow_push, never straight into the outbox`);
  }
  t.check(/create trigger saved_quotes_ow_push2 after insert or update on saved_quotes/.test(sql) && sql.includes('drop trigger if exists saved_quotes_ow_push2 on saved_quotes;'),
    'the order trigger runs after the write, and is dropped before it is made');
  t.check(/to_regclass\('public\.' \|\| t\.tbl\) is null/.test(sql) && /\('invoice_asks', 'invoice_asks_ow_push2'/.test(sql) && /\('sourcing_leads', 'sourcing_leads_ow_push2'/.test(sql),
    'a table this database lacks is skipped and named, not an error');
  t.check(/new\.done_by is distinct from new\.created_by/.test(fnBody('buyer_handoffs_ow_push2')), 'the Buyer marking cash in hand themselves is not pushed back to them');
  t.check(/greatest\(0, coalesce\(ow_num\(pi\.payload ->> 'transport'\), 0\)\)/.test(fnBody('ow_push_bills_due')) && /'amountPaid'/.test(fnBody('ow_push_bills_due')),
    'a bill\'s balance is the console\'s purchaseInvoiceTotal less what is paid');
  t.check(/order by r\.date nulls first, r\.id/.test(fnBody('ow_push_prices_to_confirm')) && /'perDay'/.test(fnBody('ow_push_prices_to_confirm')),
    'the day\'s prices are the oldest confirmed, as many as the owner set (priceReview.perDay)');
  t.check(/cron\.schedule\('ow-bills-due', '0 4 \* \* \*'/.test(sql) && /cron\.schedule\('ow-prices-to-confirm', '0 5 \* \* 1-6'/.test(sql),
    '07:00 and 08:00 in Kampala (04:00 and 05:00 UTC), prices Monday to Saturday');
  t.check(/Safe\s+-- to run twice|Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0131 \| /.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0131 for this build');
}

/* ---------------- 3. on a real database ---------------- */
const conn = process.env.OW_PG;
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_push_handoffs_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0131_pushes_for_every_handoff.sql')]);
t.check(again.status === 0, `0131 runs a second time without error (${(again.stderr || '').trim().split('\n').filter((l) => /ERROR/.test(l))[0] || 'ok'})`);

const scenario = fs.readFileSync(path.join(__dirname, 'fixtures', 'push-handoffs-scenario.sql'), 'utf8');
const run = onDb(['-qAt', '-F', '\t'], scenario);
const rows = (run.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
t.check(rows.length >= 30, `the scenario ran (${rows.length} cases${run.stderr ? '; ' + run.stderr.trim().split('\n').filter((l) => /ERROR/.test(l)).slice(0, 2).join(' | ') : ''})`);
rows.forEach((l) => {
  const [verdict, label, got] = l.split('\t');
  t.check(verdict === 'PASS', `${label} — ${got}`);
});

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
