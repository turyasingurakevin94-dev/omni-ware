#!/usr/bin/env node
'use strict';
/*
 * A dress rehearsal of the fresh start (0148, docs/fresh-start.md), on the
 * STAGING project only, with a made-up shop -- never the real one.
 *
 *   1. Removes any earlier practice shop, and every shop copied from it.
 *   2. Loads the practice shop (tools/staging/sample-shop.sql), owned by
 *      your staging login when OWNER_EMAIL names one, so you can open it on
 *      the staging site; otherwise by a placeholder login.
 *   3. Runs the steps in the runbook's order: the preview, the copy, the
 *      rename of the old shop, the move's preview and the move.
 *   4. Checks what the copy promises, against the database itself, and
 *      writes a plain report (to GITHUB_STEP_SUMMARY when in Actions).
 *      Any failed check fails the run.
 *
 * Run by the "Set up staging" workflow (what: rehearse), with the Supabase
 * access token and STAGING_PROJECT_REF from the repository's secrets. The
 * live project is refused by name. For a local run against a database made
 * from the migrations, set OW_PG to a libpq connection string instead.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LIVE = 'hgywjaifdmgrcnwxstxg';
const SAMPLE = '5a3b1e00-0000-4000-8000-0000000000aa';
const PLACEHOLDER = '5a3b1e00-0000-4000-8000-0000000000ff';
const NEW_NAME = 'Mukasa Hardware (practice)';
const OLD_NAME = 'Mukasa Hardware (practice, old books)';

const REF = process.env.STAGING_PROJECT_REF;
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const LOCAL = process.env.OW_PG;
const EMAIL = (process.env.OWNER_EMAIL || '').trim();

if (!LOCAL) {
  if (!REF || !TOKEN) { console.error('Needs STAGING_PROJECT_REF and SUPABASE_ACCESS_TOKEN (or OW_PG for a local database).'); process.exit(1); }
  if (REF === LIVE) { console.error(`STAGING_PROJECT_REF is the LIVE project (${LIVE}). Refusing: a rehearsal never touches the real shop.`); process.exit(1); }
}

const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
async function sql(text) {
  if (LOCAL) {
    const r = spawnSync('psql', [LOCAL, '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: text, encoding: 'utf8' });
    if (r.status !== 0) throw new Error((r.stderr || '').trim().split('\n')[0]);
    return r.stdout;
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Supabase answered ${res.status}: ${body.slice(0, 300)}`);
  return body;
}
// Rows of one select, as objects, the same from both ways in.
async function rows(select) {
  const out = await sql(`select coalesce(json_agg(t), '[]'::json) as j from (${select}) t`);
  if (LOCAL) return JSON.parse(out.trim() || '[]');
  const r = JSON.parse(out);
  const j = r[0] && r[0].j;
  return typeof j === 'string' ? JSON.parse(j) : (j || []);
}
const one = async (select) => (await rows(select))[0] || {};

const lines = [];
const say = (s = '') => { lines.push(s); console.log(s); };
const table = (rs) => {
  say('| What | Count | Note |'); say('|---|---:|---|');
  rs.forEach((r) => say(`| ${r.what} | ${r.n} | ${String(r.note || '').replace(/\|/g, '/')} |`));
  say();
};
const checks = [];
const check = (ok, label) => { checks.push({ ok: !!ok, label }); };

async function main() {
  say(`## Practice run: a fresh start on staging`);
  say();
  say(LOCAL ? 'Database: a local copy made from the migrations.' : `Database: the staging project \`${REF}\`. The live shop was not touched.`);
  say();

  // 1. A clean slate: the earlier practice shop and its copies.
  await sql(`delete from shops where id in (select shop_id from fresh_starts where from_shop = ${lit(SAMPLE)});
             delete from shops where id = ${lit(SAMPLE)};`);

  // 2. Who owns it.
  let owner = null, ownerWord;
  if (EMAIL) owner = (await one(`select id from auth.users where lower(email) = lower(${lit(EMAIL)})`)).id || null;
  if (owner) ownerWord = `your staging login (${EMAIL}), so you can open both practice shops on the staging site`;
  else {
    await sql(`insert into auth.users (id, email) values (${lit(PLACEHOLDER)}, 'practice-owner@example.invalid') on conflict (id) do nothing`);
    owner = PLACEHOLDER;
    ownerWord = EMAIL
      ? `a placeholder login: no staging login uses ${EMAIL} yet. Sign up on the staging site with it, then run this again to open the practice shops yourself`
      : 'a placeholder login. Run again with your staging email to open the practice shops yourself';
  }
  const seed = fs.readFileSync(path.join(__dirname, 'staging', 'sample-shop.sql'), 'utf8').replace(/\{\{OWNER\}\}/g, owner);
  await sql('begin;\n' + seed + '\ncommit;');
  say(`The practice shop **${NEW_NAME}** was made, with made-up data, owned by ${ownerWord}.`);
  say();

  const countsOf = (shop) => one(`select
      (select count(*) from products where shop_id = ${lit(shop)}) products, (select count(*) from prices where shop_id = ${lit(shop)}) prices,
      (select count(*) from suppliers where shop_id = ${lit(shop)}) suppliers, (select count(*) from customers where shop_id = ${lit(shop)}) customers,
      (select count(*) from staff where shop_id = ${lit(shop)}) staff, (select count(*) from agents where shop_id = ${lit(shop)}) agents,
      (select coalesce(sum(debt), 0) from customers where shop_id = ${lit(shop)}) debt, (select count(*) from customers where shop_id = ${lit(shop)} and debt > 0) owing,
      (select count(*) from stock where shop_id = ${lit(shop)}) stock, (select count(*) from cash_txns where shop_id = ${lit(shop)}) cash,
      (select count(*) from saved_quotes where shop_id = ${lit(shop)}) orders, (select count(*) from purchase_invoices where shop_id = ${lit(shop)}) bills,
      (select count(*) from loans where shop_id = ${lit(shop)}) loans`);
  const before = await countsOf(SAMPLE);

  // 3. The runbook, in order.
  say('### 1. The preview (nothing saved)');
  const dry = await rows(`select * from ow_fresh_start(${lit(SAMPLE)}, ${lit(NEW_NAME)})`);
  table(dry);
  check(dry[0] && /DRY RUN/.test(dry[0].what) && !(await one(`select 1 as x from fresh_starts where from_shop = ${lit(SAMPLE)}`)).x, 'The preview saved nothing');

  say('### 2. Making the new shop');
  const real = await rows(`select * from ow_fresh_start(${lit(SAMPLE)}, ${lit(NEW_NAME)}, true)`);
  table(real);
  const NEW = (real.find((r) => r.what === 'the new shop') || {}).note;
  if (!NEW) throw new Error('the copy did not report a new shop');
  await sql(`update shops set name = ${lit(OLD_NAME)} where id = ${lit(SAMPLE)}`);
  say(`The old practice shop was renamed **${OLD_NAME}**.`);
  say();

  const after = await countsOf(NEW), still = await countsOf(SAMPLE);
  check(['products', 'prices', 'suppliers', 'customers', 'staff', 'agents'].every((k) => Number(after[k]) === Number(before[k])),
    `Price list, suppliers, customers, staff and agents all came across (${after.products} products, ${after.prices} prices, ${after.suppliers} suppliers, ${after.customers} customers, ${after.staff} staff, ${after.agents} agents)`);
  check(Number(after.debt) === 0, 'Every customer starts at 0 owed in the new shop');
  const fs0 = await one(`select (select count(*) from jsonb_object_keys(old_debts)) n, (select coalesce(sum(value::numeric), 0) from jsonb_each_text(old_debts)) total from fresh_starts where shop_id = ${lit(NEW)}`);
  check(Number(fs0.n) === Number(before.owing) && Number(fs0.total) === Number(before.debt),
    `The Manager's checklist holds what the old books said: ${fs0.n} customers, ${Number(fs0.total).toLocaleString('en-US')} in all`);
  check(['stock', 'cash', 'orders', 'bills', 'loans'].every((k) => Number(after[k]) === 0), 'No stock, cash, orders, supplier bills or loans came across');
  const pre = await one(`select presets ? 'dayLog' or presets ? 'chaseLog' or presets ? 'stockCounts' or presets ? 'debtChases' as logs,
      presets -> 'creditHold' ->> 'days' as hold, presets ->> 'shopLegalName' as legal from app_settings where shop_id = ${lit(NEW)}`);
  check(!pre.logs && pre.hold === '21' && /Mukasa/.test(pre.legal || ''), 'Settings came across (credit policy, letterhead); the running logs stayed behind');
  check(Object.keys(before).every((k) => String(before[k]) === String(still[k])), 'The old shop is exactly as it was');
  const agents = await one(`select count(*) filter (where user_id is not null) as logged from agents where shop_id = ${lit(NEW)}`);
  check(Number(agents.logged) === 0, 'Agents came across without logins (those move on switch day)');

  say('### 3. Switch day: moving the team (preview, then for real)');
  const mdry = await rows(`select * from ow_fresh_start_move(${lit(SAMPLE)}, ${lit(NEW)})`);
  check(mdry[0] && /DRY RUN/.test(mdry[0].what), "The move's preview saved nothing");
  const move = await rows(`select * from ow_fresh_start_move(${lit(SAMPLE)}, ${lit(NEW)}, true)`);
  table(move);
  const both = await one(`select count(*) as n from shop_members where user_id = ${lit(owner)} and shop_id in (${lit(SAMPLE)}, ${lit(NEW)}) and role = 'owner'`);
  check(Number(both.n) === 2, 'The owner sees both shops, and picks one in the apps');

  // 4. The verdict.
  say('### Checks');
  checks.forEach((c) => say(`- ${c.ok ? '✅' : '❌'} ${c.label}`));
  say();
  const bad = checks.filter((c) => !c.ok).length;
  say(bad ? `**${bad} check(s) failed.** Nothing should go near the real shop until they pass.` : '**Every check passed.**');
  if (owner !== PLACEHOLDER) {
    say();
    say('To look for yourself: open the staging site (any Omni-Ware address with the red STAGING strip, such as the preview Vercel makes for this branch), sign in, and choose a shop. In the Manager app, **To collect** shows the old books\' balances to confirm.');
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  const msg = `Practice run stopped: ${e.message}`;
  console.error(msg);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + `\n\n**${msg}**\n`);
  process.exit(1);
});
