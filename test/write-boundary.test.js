#!/usr/bin/env node
'use strict';
/*
 * Who may WRITE the shop's books, enforced by the database.
 *
 * The books used to be guarded by the screens alone: every login
 * attached to the shop is a shop_member, and 0001 gave members "full
 * access" to every books table. A worker's phone, or anyone reaching
 * the database directly, could insert a payment or rewrite a debt and
 * the app would show nothing -- because nothing in the app did it.
 * 0083 adds the restrictive insert/update policies that close it, in
 * the shape 0058 already proved for deletes.
 *
 * A list of table names in a migration rots the moment somebody adds a
 * table. So this test does not restate the list -- it DERIVES both
 * sides and compares them:
 *
 *   EVERY BOOKS TABLE  every table granted "shop members full access"
 *                      anywhere in supabase/migrations is either locked
 *                      by 0083 or on the worker allowlist. A future
 *                      migration that adds a books table and forgets
 *                      the lock fails HERE, before it ships.
 *   THE ALLOWLIST IS THE APP  the exempt tables are exactly the tables
 *                      worker.html actually writes. The exemption
 *                      cannot drift from the app that needs it.
 *   RESTRICTIVE, NOT PERMISSIVE  a permissive policy would GRANT
 *                      writes to everyone instead of narrowing them --
 *                      the same word that makes 0058 work.
 *
 * Run: node test/write-boundary.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('the write boundary');
const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const allSql = files.map((f) => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n');
const lock = read('supabase/migrations/0083_owner_only_writes.sql');

/* ONLY the executable half. The rollback in the header comment is a
   second copy of the same list, and reading that one instead would pass
   every check here while the real policies locked nothing — a false
   green of exactly the kind this file exists to prevent. Comment lines
   go first, then the block is found in what remains. */
const lockCode = lock.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
const lockBody = lockCode.slice(lockCode.indexOf('do $$'));
const lockList = lockBody.slice(lockBody.indexOf('array[') + 6, lockBody.indexOf(']'));
const lockedTables = [...lockList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

/* What the worker app actually writes: addDiffOps(ops, <collection>,
   '<table>', ...). Parsed, never typed out. */
const worker = read('worker.html');
const workerWrites = [...worker.matchAll(/addDiffOps\(\s*ops\s*,\s*'[A-Za-z]+'\s*,\s*'([a-z_]+)'/g)]
  .map((m) => m[1]);

/* Every table members were granted full access to, from the individual
   declarations and from 0001's loop alike. */
const membersFull = new Set([...allSql.matchAll(/create policy "shop members full access" on ([a-z_]+)/g)]
  .map((m) => m[1]));
const loopBlock = allSql.slice(allSql.indexOf("foreach t in array array[\n    'suppliers'"));
[...loopBlock.slice(0, loopBlock.indexOf(']')).matchAll(/'([a-z_]+)'/g)].forEach((m) => membersFull.add(m[1]));

/* ---------- 1. the two sides are real ------------------------------- */
{
  t.check(membersFull.size >= 25,
    `the books tables were found, not silently zero (got ${membersFull.size})`);
  t.check(lockedTables.length >= 25,
    `and so were the locked ones (got ${lockedTables.length})`);
  t.check(workerWrites.length === 2 && workerWrites.includes('saved_quotes') && workerWrites.includes('collection_trips'),
    `the worker app writes exactly two tables, read from worker.html itself (got ${JSON.stringify(workerWrites)})`);
  ['cash_txns', 'customer_debt_log', 'customers', 'prices', 'purchase_invoices', 'dues'].forEach((tbl) =>
    t.check(lockedTables.includes(tbl), `${tbl} — money or debt — is locked`));
}

/* ---------- 2. nothing may be left behind --------------------------- */
{
  const missed = [...membersFull].filter((tbl) => !lockedTables.includes(tbl) && !workerWrites.includes(tbl));
  t.check(missed.length === 0,
    `every table members can write is either locked or named as the worker's — nothing left open by accident (open: ${JSON.stringify(missed)})`);
  const strays = lockedTables.filter((tbl) => !membersFull.has(tbl));
  t.check(strays.length === 0,
    `and nothing is locked that members were never granted — a typo would lock a table that does not exist (${JSON.stringify(strays)})`);
}

/* ---------- 3. the worker keeps working ----------------------------- */
{
  workerWrites.forEach((tbl) =>
    t.check(!lockedTables.includes(tbl),
      `${tbl} stays writable — locking it would stop a picker recording a pick, or a driver a collection`));
  t.check(/NOT saved_quotes, NOT collection_trips/.test(lock),
    'and the migration says so where the list is, so the next reader does not "fix" it');
  /* The fence on those two rows lives in the app, and must still be there. */
  t.check(/WORKER_OWNED_KEYS/.test(worker) && /neverDelete:true/.test(worker),
    'their real guard — which fields may move, and never a delete — is still in the worker app');
}

/* ---------- 4. restrictive, on both commands, checking the owner ----- */
{
  t.check(/for insert with check \(is_shop_admin\(shop_id\)\)/.test(lock), 'inserts are checked');
  t.check(/for update using \(is_shop_admin\(shop_id\)\) with check \(is_shop_admin\(shop_id\)\)/.test(lock),
    'and updates on both sides — using alone would let a row be edited INTO another shop');
  t.check((lock.match(/as restrictive/g) || []).length >= 2,
    'both policies are RESTRICTIVE — a permissive one would grant writes to everyone instead of narrowing them');
  t.check(!/is_shop_member\(shop_id\)\)', t\)/.test(lockBody),
    'and neither checks mere membership, which is the hole being closed');
  t.check(/is_shop_admin/.test(lock) && !/is_shop_owner/.test(lockBody),
    'owner-or-admin, so a trusted manager can be promoted later without another migration');
}

/* ---------- 5. 0058's delete rule is untouched ----------------------- */
{
  const del = read('supabase/migrations/0058_owner_only_deletes.sql');
  t.check(/create policy "owner only deletes" on %I as restrictive for delete using \(is_shop_owner\(shop_id\)\)/.test(del),
    'deleting stays owner-only, exactly as 0058 left it');
  t.check(!/drop policy "owner only deletes"/.test(lock),
    'and 0083 does not disturb it');
}

/* ---------- 6. the owner can look first, and go back ---------------- */
{
  t.check(/select role, count\(\*\) from shop_members/.test(lock),
    'the migration carries the query that shows who would be affected, before anything changes');
  t.check(/drop policy if exists "owner writes only" on %I/.test(lock)
    && /drop policy if exists "owner updates only" on %I/.test(lock),
    'and a rollback that restores today in one paste — a lock with no key is not a lock, it is a trap');
}

process.exit(t.done() ? 1 : 0);
