#!/usr/bin/env node
'use strict';
/*
 * Manager round 1, data and money integrity (0169; docs/audit/manager/ROUND-1.md):
 * the money and the stock hold together on the server, whoever writes.
 *
 *   1. The SQL text: what 0169 refuses, the new functions and who may call
 *      them, strict lots, the one receive_payment, and the correction script.
 *   2. A REAL database, when OW_PG names one: every migration in order, 0169
 *      run twice, then test/fixtures/manager-round1-scenario.sql as the
 *      Manager, Sales, Accounts, the Store and the owner; then the live-like
 *      old rows (manager-round1-correct-seed.sql), round-1-correct.sql run
 *      twice, and what it did (manager-round1-correct-check.sql).
 *
 * Run: node test/manager-round1-db.test.js
 *      OW_PG="host=/var/tmp/owpg port=5499 user=postgres" node test/manager-round1-db.test.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { read, createReporter, extractFunction, compileScope } = require('./_extract');

const t = createReporter('Manager round 1: money and stock hold together (0169)');
const raw = read('supabase/migrations/0169_manager_money_integrity.sql');
const sql = raw.replace(/--[^\n]*/g, '');
const fix = read('docs/audit/manager/round-1-correct.sql');
const check = read('docs/audit/manager/round-1-check.sql');

/* ---------------- 1. the SQL text ---------------- */
{
  t.check(/Safe to run twice/.test(raw) && /ROLLBACK/.test(raw) && /CHECK AFTERWARDS/.test(raw), 'the header says it runs twice, and how to check and roll back');
  t.check(/\| 0169 \| Manager, first/.test(read('docs/decision-rights.md')), 'docs/decision-rights.md reserves 0169');
  t.check(/insert into role_tasks \(role, task\) values \('manager', 'customer\.merge'\)/.test(sql) && /`customer\.merge` \| Manager \|/.test(read('docs/decision-rights.md')),
    'merging customers is the Manager\'s alone (customer.merge, in the decision-rights table)');
  t.check(/drop function if exists receive_payment\(uuid, text, numeric, text, bigint\[\], bigint, text, text\);/.test(sql)
    && /p_over text default null, p_date date default null, p_label text default null\)/.test(sql), 'one receive_payment: the old one dropped, p_date and p_label added with defaults');
  t.check(/if d > ow_today\(\) then\s*raise exception/.test(sql), 'a payment dated after today is refused');
  const mc = sql.slice(sql.indexOf('create or replace function saved_quotes_money_check()'), sql.indexOf('drop trigger if exists saved_quotes_zz_money_check'));
  t.check(/lower\(btrim\(p ->> 'method'\)\) <> lower\(btrim\(c\.account\)\)/.test(mc), 'a payment whose receipt is in another account is refused');
  t.check(/is already a payment on #/.test(mc) && /is named twice on this order/.test(mc), 'one receipt, one payment: on this order or any other');
  t.check(/errcode = 'OWGIV'/.test(mc) && /givenAway' ->> 'why'/.test(mc), 'an invoiced line at 0 needs givenAway.why (OWGIV)');
  t.check(/and auth\.uid\(\) is not null and not is_shop_admin\(p_shop_id\)/.test(sql) && /not coalesce\(q\.qa, false\)/.test(sql), 'a void with money is held for the phones, never a test record or the owner\'s console');
  t.check(/function void_sale_bills[\s\S]*?ow_void_money_open\(p_shop_id, q\)[\s\S]*?'OWVMN'/.test(sql), 'void_sale_bills refuses an order whose money is not settled');
  const vw = sql.slice(sql.indexOf('create or replace function void_with_money('), sql.indexOf('revoke all on function void_with_money'));
  t.check(/has_task\(p_shop_id, 'invoice\.void'\)/.test(vw) && /'Refund'/.test(vw) && /'Deposit — void ' \|\| lbl, null\)/.test(vw), 'void_with_money: invoice.void; a Refund cash row, or a deposit line on no order');
  t.check(/set voided = true, payload = coalesce\(payload, '\{\}'::jsonb\) \|\| jsonb_build_object\('voidMoney', vm\)/.test(vw), 'the void and its voidMoney go in one write');
  t.check(/l\.quote_id is null/.test(sql) && /security invoker/.test(sql.slice(sql.indexOf('function ow_customer_balance'), sql.indexOf('function merge_customers'))), 'ow_customer_balance: opening (no order) + open bills, read under the reader\'s policies');
  t.check(/v_total < 1000 then\s*raise exception[\s\S]*?'OWSML'/.test(sql) && /perform ow_end_targets\(r\.shop_id\)/.test(sql), 'the hourly run leaves a bill under 1,000 to the Manager and ends past targets');
  t.check(/create trigger cash_txns_round_amount before insert or update of amount on cash_txns/.test(sql), 'cash lines are whole shillings');
  t.check(/create constraint trigger stock_zz_lots_add_up after insert or update or delete on stock\s*deferrable initially deferred/.test(sql)
    && /create constraint trigger stock_lots_zz_lots_add_up after insert or update or delete on stock_lots\s*deferrable initially deferred/.test(sql)
    && /errcode = 'OWLOT'/.test(sql), 'stock and its lots are judged together at commit, and refused apart (OWLOT)');
  t.check(/function replace_stock_and_lots\(p_shop_id uuid, p_keys text\[\], p_stock jsonb, p_lots jsonb\)[\s\S]*?security invoker/.test(sql), 'replace_stock_and_lots runs as the caller (0083\'s owner-only writes still decide)');
  t.check(/Not run: migration\(s\) % are not in this database yet/.test(fix) && /'0165'/.test(fix) && /'0167'/.test(fix) && /'0169'/.test(fix), 'the correction stops first if 0165, 0167 or 0169 is missing');
  t.check(/fix_415 text := 'record';/.test(fix) && /lots_rule text := 'newest';/.test(fix) && /fix_test_voids boolean := true;/.test(fix) && !/fix_void_money/.test(fix), 'the correction carries Kevin\'s choices as switches');
  t.check(/^begin;$/m.test(fix) && /^commit;$/m.test(fix) && (fix.match(/'books\.correct'/g) || []).length >= 6, 'one transaction, each change in the owner\'s log');
  t.check(/and not coalesce\(q\.qa, false\)/.test(check) && /coalesce\(pay ->> 'note', ''\) <> 'Deposit'/.test(check), 'round-1-check: query 7 leaves test records out, query 9 the payments Sales noted Deposit');
}

/* ---------------- 1b. the owner console saves stock and its lots in one call ---------------- */
async function consoleSave() {
  const html = read('index.html');
  const sync = extractFunction(html, 'syncDataToServer', 'index.html');
  t.check(/salesDeskFilterOps\(ops\);\s*mergeStockOps\(ops, shopId, rows\);/.test(sync), 'the console folds its stock ops after building (and filtering) every op');
  const make = (rpcError) => {
    const calls = [];
    const sb = {
      rpc: async (fn, args) => { calls.push({ fn, args }); return { error: rpcError }; },
    };
    const lastSynced = { stock: { P1: { shop_id: 's', key: 'P1', qty: 10 }, P5: { shop_id: 's', key: 'P5', qty: 4 }, P7: { shop_id: 's', key: 'P7', qty: 1 } },
                         stockLots: { P1: [{ qty: 10, cost: 100 }], P5: [{ qty: 4, cost: 50 }], P7: [{ qty: 1, cost: 9 }] } };
    const { mergeStockOps } = compileScope([extractFunction(html, 'mergeStockOps', 'index.html'), extractFunction(html, 'dbFunctionMissing', 'index.html')],
      { sb, lastSynced }, ['mergeStockOps']);
    return { calls, lastSynced, mergeStockOps };
  };
  // P1 sold 2 (stock and lots change), P5's lots re-costed only, P7 gone; the settings op is left alone.
  const rows = { stock: [{ shop_id: 's', key: 'P1', qty: 8 }, { shop_id: 's', key: 'P5', qty: 4 }],
                 stockLots: { P1: [{ qty: 8, cost: 100 }], P5: [{ qty: 4, cost: 55, consign: 'S2' }] } };
  const ran = [];
  const mkOps = () => [
    { key: 'stock', table: 'stock', run: async () => { ran.push('stock'); return { error: null }; }, commit: () => ran.push('commit stock') },
    { key: 'stock', table: 'stock', deletes: true, run: async () => { ran.push('del'); return { error: null }; }, commit: () => ran.push('commit del') },
    { key: 'stockLots', table: 'stock_lots', run: async () => { ran.push('lots'); return { error: null }; }, commit: () => ran.push('commit lots') },
    { key: 'settings', table: 'app_settings', run: async () => ({ error: null }), commit: () => {} },
  ];
  const a = make(null), ops = mkOps();
  a.mergeStockOps(ops, 's', rows);
  t.check(ops.length === 2 && ops.filter((o) => o.key === 'stock').length === 1 && ops.some((o) => o.key === 'settings'), 'the stock, its deletes and the lots become one op; the rest are untouched');
  const op = ops.find((o) => o.key === 'stock');
  const r1 = await op.run(); if (!r1.error) op.commit();
  const c = a.calls[0] || { args: {} };
  t.check(a.calls.length === 1 && c.fn === 'replace_stock_and_lots' && JSON.stringify([...c.args.p_keys].sort()) === '["P1","P5","P7"]', `one call names every key touched (${JSON.stringify(c.args.p_keys)})`);
  t.check(JSON.stringify(c.args.p_stock) === '[{"key":"P1","qty":8},{"key":"P5","qty":4}]' && !c.args.p_stock.some((x) => x.key === 'P7'), 'with each key\'s stock (P7 has none: its row goes)');
  t.check(JSON.stringify(c.args.p_lots) === '[{"key":"P1","qty":8,"cost":100,"consign":null},{"key":"P5","qty":4,"cost":55,"consign":"S2"}]', 'and exactly its lots, consignor kept');
  t.check(ran.join() === 'commit stock,commit del,commit lots', `the old ops are not run, and each is marked saved once the call lands (${ran.join()})`);
  ran.length = 0;
  const b = make({ code: 'PGRST202', message: 'Could not find the function' }), ops2 = mkOps();
  b.mergeStockOps(ops2, 's', rows);
  const op2 = ops2.find((o) => o.key === 'stock');
  const r2 = await op2.run(); if (!r2.error) op2.commit();
  t.check(ran.join() === 'stock,del,lots,commit stock,commit del,commit lots', `before 0169 the old ops run as they did (${ran.join()})`);
  ran.length = 0;
  const d = make({ code: 'OWLOT', message: 'The stock of P1 is 8 but its lots add up to 10' }), ops3 = mkOps();
  d.mergeStockOps(ops3, 's', rows);
  const op3 = ops3.find((o) => o.key === 'stock');
  const r3 = await op3.run(); if (!r3.error) op3.commit();
  t.check(r3.error && r3.error.code === 'OWLOT' && ran.length === 0, 'a refusal comes back as the save\'s error, and nothing is marked saved');
  const none = make(null), ops4 = [{ key: 'settings', run: async () => ({ error: null }), commit: () => {} }];
  none.mergeStockOps(ops4, 's', rows);
  t.check(ops4.length === 1 && none.calls.length === 0, 'no stock op, no call');
}

/* ---------------- 2. on a real database ---------------- */
const conn = process.env.OW_PG;
(async () => {
await consoleSave();
if (!conn) {
  console.log('skip   - OW_PG is not set, so the scenario is not run on a database (see the header of this file)');
  process.exit(t.done() ? 1 : 0);
}
const db = 'ow_manager_round1_test';
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
const again = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', path.join(migDir, '0169_manager_money_integrity.sql')]);
t.check(again.status === 0, `0169 runs a second time without error (${errs(again)[0] || 'ok'})`);

const verdicts = (r, min, what) => {
  const rows = (r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL)\t/.test(l));
  t.check(rows.length >= min, `${what} ran (${rows.length} cases${errs(r).length ? '; ' + errs(r).slice(0, 2).join(' | ') : ''})`);
  rows.forEach((l) => { const [verdict, label, got] = l.split('\t'); t.check(verdict === 'PASS', `${label} — ${got}`); });
};
verdicts(onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'manager-round1-scenario.sql'), 'utf8')), 60, 'the scenario');

const seed = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1'], fs.readFileSync(path.join(__dirname, 'fixtures', 'manager-round1-correct-seed.sql'), 'utf8'));
t.check(seed.status === 0, `the old rows as live has them went in (${errs(seed)[0] || 'ok'})`);
const fixPath = path.join(__dirname, '..', 'docs', 'audit', 'manager', 'round-1-correct.sql');
const first = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', fixPath]);
t.check(first.status === 0, `round-1-correct.sql runs (${errs(first)[0] || 'ok'})`);
t.check(/Cash line 9400: 386666\.67 → 386667 \(adjustment 0\.33\)/.test(first.stderr || ''), 'and lists each 1-shilling adjustment as a notice');
const second = onDb(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', fixPath]);
t.check(second.status === 0 && /#0415: skipped/.test(second.stderr || '') && /every key adds up already/.test(second.stderr || ''), `and a second run changes nothing (${errs(second)[0] || 'ok'})`);
verdicts(onDb(['-qAt', '-F', '\t'], fs.readFileSync(path.join(__dirname, 'fixtures', 'manager-round1-correct-check.sql'), 'utf8')), 12, 'the check after the correction');

// Without 0169, the correction stops before it changes anything.
const bare = 'ow_manager_round1_bare';
psql(['-qAt', '-c', `drop database if exists ${bare}`, '-c', `create database ${bare}`]);
const onBare = (args, input) => spawnSync('psql', [`${conn} dbname=${bare}`, ...args], { input, encoding: 'utf8' });
onBare(['-qAt'], shim);
fs.readdirSync(migDir).filter((f) => f.endsWith('.sql') && f < '0169').sort().forEach((f) => onBare(['-qAt', '-f', path.join(migDir, f)]));
const stop = onBare(['-qAt', '-v', 'ON_ERROR_STOP=1', '-f', fixPath]);
t.check(stop.status !== 0 && /Not run: migration\(s\) 0169 are not in this database yet/.test(stop.stderr || ''), 'without 0169 the correction stops with a plain notice');
psql(['-qAt', '-c', `drop database if exists ${bare}`]);

psql(['-qAt', '-c', `drop database if exists ${db}`]);
process.exit(t.done() ? 1 : 0);
})();
