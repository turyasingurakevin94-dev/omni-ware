#!/usr/bin/env node
'use strict';
/*
 * Row-level security.
 *
 * The anon key is published in index.html -- it has to be, the app is a
 * static page -- so RLS is the ONLY thing standing between a stranger and
 * this shop's books. There is no second gate behind it.
 *
 * These are the structural properties behind that. They were checked
 * against the live database too (every table probed signed-out, read and
 * write); this file is what stops the structure drifting afterwards, since
 * a new table is exactly the kind of thing that gets added without one.
 *
 * Run: node test/rls-policies.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { createReporter, extractFunction } = require('./_extract');

const t = createReporter('RLS');
const MIG = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.readdirSync(MIG).sort();
const sql = files.map((f) => fs.readFileSync(path.join(MIG, f), 'utf8')).join('\n');

/* ---------- 1. every table has RLS turned on -------------------------- */
/*
 * The one that matters most, and the one most likely to rot: a table added
 * without this line is readable and writable by anyone holding the anon
 * key, with nothing anywhere to say so.
 */
{
  const created = [...sql.matchAll(/create table (?:if not exists )?([a-z_]+)\s*\(/g)].map((m) => m[1]);
  const rls = new Set([...sql.matchAll(/alter table ([a-z_]+) enable row level security/g)].map((m) => m[1]));
  // 0001 turns it on for a list of tables inside a DO loop rather than
  // one statement each.
  const loop = /foreach t in array array\[([\s\S]*?)\]/.exec(sql);
  if (loop) [...loop[1].matchAll(/'([a-z_]+)'/g)].forEach((m) => rls.add(m[1]));

  const dropped = new Set([...sql.matchAll(/drop table (?:if exists )?([a-z_]+)/g)].map((m) => m[1]));
  const live = created.filter((x) => !dropped.has(x));
  const unprotected = live.filter((x) => !rls.has(x));

  t.check(live.length >= 30, `found the schema's tables to check (${live.length})`);
  t.check(unprotected.length === 0,
    unprotected.length
      ? `these tables have no row level security: ${unprotected.join(', ')}`
      : `all ${live.length} tables enable row level security`);
}

/* ---------- 2. the id counters stay unreachable ----------------------- */
/*
 * RLS on with no policy at all is the point: the allocator is SECURITY
 * DEFINER and checks membership itself, so a client that could touch these
 * rows directly would be no safer than the client-side counter they
 * replaced. A policy appearing here would undo that.
 */
{
  const counterPolicies = [...sql.matchAll(/create policy "[^"]+" on entity_id_counters/g)].length;
  t.check(counterPolicies === 0,
    `entity_id_counters has no policy, so nothing reaches it but the allocator (${counterPolicies} found)`);
  t.check(/alter table entity_id_counters enable row level security/.test(sql),
    'and RLS is on, so "no policy" means no access rather than open access');
}

/* ---------- 3. both id allocators check membership themselves --------- */
{
  ['next_entity_id', 'next_row_id_blocks'].forEach((f) => {
    const fnSrc = new RegExp(`create or replace function ${f}\\(([\\s\\S]*?)\\$\\$;`).exec(sql);
    t.check(fnSrc && /security definer/.test(fnSrc[1]) && /if not is_shop_member\(p_shop_id\) then/.test(fnSrc[1]),
      `${f} runs as definer and refuses a caller who is not a member`);
  });
}

/* ---------- 4. an agent can read their orders, not write them --------- */
/*
 * 0012 gave agents `for all` on saved_quotes, keyed on an unconstrained
 * JSONB field. 0027 narrowed it to `for select` against a real FK'd column.
 * Agents submit orders through agent-submit-order (service role), so read
 * is all they need -- and write access keyed on a field the client
 * controls is what made the original policy worth replacing.
 */
{
  // The LAST definition wins: 0027 wrote this policy and 0035 narrowed it.
  // Matching the first would check a version the database no longer has --
  // the same trap agent_staff_names sets two sections down.
  const defs = [...sql.matchAll(/create policy "agents read their own orders" on saved_quotes([\s\S]*?);/g)];
  t.check(defs.length >= 1, `found the live agent policy on saved_quotes (${defs.length} versions in history)`);
  const pol = defs.length ? defs[defs.length - 1][1] : '';
  t.check(/for select/.test(pol),
    'it grants select only — an agent cannot write an order row directly');
  t.check(/agent_id = current_agent_id\(shop_id\)/.test(pol),
    'and matches on the FK\'d column, not on payload JSON the client controls');
  // 0027 kept a fallback for rows its backfill might have missed. The
  // backfill, the lockstep trigger and 0030's validated FK between them
  // mean no such row can exist -- and the fallback was the very
  // client-controlled JSONB read 0027 set out to remove, on the one branch
  // that cannot use the index.
  t.check(!/payload->>'originAgentId'/.test(pol),
    'and no longer falls back to reading originAgentId out of the payload');
  t.check(/drop policy "agents manage their own orders" on saved_quotes/.test(sql),
    'the old for-all policy was dropped rather than left alongside it');
  // Two permissive policies OR together, so leaving the old one would have
  // silently restored everything the new one narrowed.
  const forAll = [...sql.matchAll(/create policy "[^"]+" on saved_quotes\s+for all/g)].length;
  const stillLive = forAll - [...sql.matchAll(/drop policy "[^"]+" on saved_quotes/g)].length;
  t.check(stillLive <= 0,
    `no for-all agent policy survives on saved_quotes (${forAll} created, ${stillLive} net)`);
}

/* ---------- 4b. an agent cannot edit their own trust settings --------- */
/*
 * agents carries a for-all policy for ADMINS and a select-only one for the
 * agent themselves. There is deliberately no update policy for the agent:
 * payment_term is what decides whether their orders can be prepared before
 * they have paid, so an agent able to write it could flip themselves to
 * postpay and order on credit indefinitely.
 *
 * Verified live -- an update comes back 0 rows while the same session
 * updates agent_clients fine -- but nothing in the schema states it, since
 * it is the ABSENCE of a policy. This is what would notice one appearing.
 */
{
  const onAgents = [...sql.matchAll(/create policy "([^"]+)" on agents\s+for (all|select|insert|update|delete)/g)]
    .map((m) => ({ name: m[1], cmd: m[2] }));
  const dropped = new Set([...sql.matchAll(/drop policy (?:if exists )?"([^"]+)" on agents/g)].map((m) => m[1]));
  const live = onAgents.filter((p) => !dropped.has(p.name));

  const writable = live.filter((p) => p.cmd === 'all' || p.cmd === 'update' || p.cmd === 'insert');
  t.check(writable.length > 0 && writable.every((p) => /admin/i.test(p.name)),
    writable.length
      ? `only admins may write to agents (${writable.map((p) => `${p.name}[${p.cmd}]`).join(', ')})`
      : 'expected at least an admin write policy on agents');
  t.check(live.some((p) => p.cmd === 'select' && /agent views own row/.test(p.name)),
    'an agent can still read their own row, which is how the app shows them their payment term');
}

/* ---------- 5. agents are not shop members ---------------------------- */
/*
 * The whole agent model rests on this. shop_members carries a blanket
 * "shop members full access" policy on every business table, so an agent
 * added to that roster would gain full read/write on the entire shop --
 * every customer, every price, the cash book.
 */
{
  const invite = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'invite-agent', 'index.ts'), 'utf8');
  t.check(!/from\(["']shop_members["']\)[\s\S]{0,80}\.(insert|upsert)/.test(invite),
    'inviting an agent never adds them to the shop_members roster');
  t.check(/agents are\s*\n?\/\/ deliberately NOT shop_members/.test(invite) || /deliberately NOT shop_members/.test(invite),
    'and the reason is written down where the next person will look');
}

/* ---------- 6. the one definer function that returns data is scoped --- */
/*
 * The predicates all return a boolean, so a mistake in them fails closed.
 * agent_staff_names returns rows out of `staff`, so it is the one where a
 * missing condition would actually hand over data.
 */
{
  // The LAST definition wins -- 0016 wrote this one and 0027 replaced it,
  // and matching the first would check a version the database no longer has.
  const all = [...sql.matchAll(/create or replace function agent_staff_names\(([\s\S]*?)\$\$;/g)];
  const body = all.length ? all[all.length - 1][1] : '';
  t.check(all.length >= 1, `found the live definition of agent_staff_names (${all.length} versions in history)`);
  t.check(/security definer/.test(body), 'agent_staff_names is security definer, as it must be to see staff');
  t.check(/s\.shop_id = p_shop_id/.test(body),
    'it is scoped to the shop asked about');
  t.check(/current_agent_id\(p_shop_id\)/.test(body),
    'and only returns names attached to an order the CALLER\'s own agent id owns');
  t.check(!/payload->>'originAgentId'/.test(body),
    'and reaches those orders through the FK\'d column alone, like the policy');
}

/* ---------- 6b. the detached-order health check ----------------------- */
/*
 * The second definer function that returns rows rather than a boolean, so
 * it gets the same scrutiny as agent_staff_names: a missing condition here
 * hands one shop's order and payment data to another.
 *
 * It exists because the failure it looks for is invisible from the only
 * screen that would notice. Both write paths that caused it are fixed, so
 * it should always return nothing -- which is precisely why it has to be
 * asked rather than waited for.
 */
{
  const fnSrc = /create or replace function detached_agent_orders\(([\s\S]*?)\$\$;/.exec(sql);
  t.check(fnSrc, 'the detached-order check exists');
  const body = fnSrc ? fnSrc[1] : '';
  t.check(/security definer/.test(body),
    'it is definer, so it can see the payment rows that prove ownership');
  t.check(/is_shop_member\(p_shop_id\)/.test(body),
    'and checks membership itself, since definer bypasses RLS');
  t.check(/q\.shop_id = p_shop_id/.test(body) && /p\.shop_id  = q\.shop_id/.test(body),
    'both sides of the join are pinned to the shop asked about');
  t.check(/stable/.test(body) && !/\b(insert|update|delete)\b/i.test(body),
    'it only reads — a health check must never repair anything on its own');
  // Keyed on payment evidence, not on "looks unattributed": an ordinary
  // walk-in order is unattributed too and always will be.
  t.check(/p\.status   = 'successful'/.test(body) && /agent_mobile_payments/.test(body),
    'it keys on a successful payment, which is what distinguishes a detached order from a walk-in');
  t.check(/revoke all on function detached_agent_orders\(uuid\) from public/.test(sql),
    'and is not callable by an anonymous visitor');
}
{
  // Admins could not read agent_mobile_payments at all -- 0022 gave it one
  // policy, for agents. The admin app has a Mobile Money screen that reads
  // this table, so it had always been blank.
  const pols = [...sql.matchAll(/create policy "([^"]+)" on agent_mobile_payments\s+for (all|select|insert|update|delete)([\s\S]{0,90})/g)]
    .map((m) => ({ name: m[1], cmd: m[2], body: m[3] }));
  t.check(pols.some((p) => p.cmd === 'select' && /is_shop_member/.test(p.body)),
    'a shop member can read the agent mobile payments their own shop collected');
  t.check(!pols.some((p) => p.cmd === 'all' || p.cmd === 'insert' || p.cmd === 'update'),
    'but nobody writes them from a client — only the service role creates or resolves a payment');
}
{
  // The check is worthless if the dashboard never asks.
  const admin = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  /* Pinned on the CALL existing, not on what it is handed. It used to be
     `checkDetachedAgentOrders(threatCardHTML)`, and threatCardHTML went
     with the "Everything flagged" panel -- which was the only place this
     flag was ever rendered. Losing a duplicate panel must not quietly
     lose the one check that had nowhere else to go, so what matters is
     that the dashboard still asks and still draws the answer. */
  t.check(/async function checkDetachedAgentOrders\(/.test(admin)
    && /checkDetachedAgentOrders\(/.test(admin.replace(/async function checkDetachedAgentOrders\(/, '')),
    'the dashboard actually runs the detached-agent check');
  t.check(/checkDetachedAgentOrders\(\(t\)=> alertCardHTML\(/.test(admin),
    'and renders its answer as one of the ranked alerts, where the list somebody reads is');
  const fnBody = extractFunction(admin, 'checkDetachedAgentOrders', 'index.html');
  // Scoped to the catch block itself. Matching "a return exists somewhere
  // after the catch" passes on any function with a later return, which is
  // most of them -- what matters is that the handler writes nothing to the
  // page and leaves.
  const catchBlock = /\}catch\(err\)\{([\s\S]*?)\n  \}/.exec(fnBody);
  t.check(catchBlock, 'the check handles its own failure');
  const handler = catchBlock ? catchBlock[1] : '';
  t.check(/return;/.test(handler) && !/insertAdjacentHTML|innerHTML|list\b/.test(handler),
    'a check that cannot run stays quiet rather than putting an unactionable red card on the dashboard');
  t.check(/if\(!rows\.length\) return;/.test(fnBody),
    'and adds nothing at all when there is nothing wrong');
}

/* ---------- 7. product images are deliberately public ----------------- */
/*
 * Recorded rather than flagged: the bucket is public because the public
 * catalogue shows product photos to strangers with no session at all. What
 * must stay closed is writing to it.
 */
{
  t.check(/insert into storage\.buckets[\s\S]{0,120}'product-images', true\)/.test(sql),
    'the product-images bucket is public by intent, for the public catalogue');
  [['upload', 'Uploading'], ['replace', 'Replacing'], ['delete', 'Deleting']].forEach(([verb, label]) => {
    const p = new RegExp(`create policy "shop members can ${verb} product images"([\\s\\S]*?);`).exec(sql);
    t.check(p && /is_shop_member/.test(p[1]),
      `${label} a product image still requires shop membership`);
  });
}

process.exit(t.done() ? 1 : 0);
