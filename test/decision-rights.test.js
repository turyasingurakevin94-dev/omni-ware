#!/usr/bin/env node
'use strict';
/*
 * Who decides what: docs/decision-rights.md against the migrations.
 *
 * Every role app was built by a different session, and each one followed
 * the only written rule it found -- the migration headers saying prices,
 * margins and credit "stay the owner's". The owner wanted the Manager to
 * decide those. So the rule now lives in one file, CLAUDE.md points every
 * session at it, and this test holds it to what the database actually
 * grants:
 *
 *   1. CLAUDE.md points at the file, so a new session reads it first.
 *   2. Every task a migration grants a role is in the table, with that
 *      role under "Who decides". A grant the table does not allow fails.
 *   3. Every row marked Built "yes" is granted to every role it lists.
 *   4. Every row marked Built "no" is granted to nobody yet. Building it
 *      means granting the task AND flipping the row, in one change.
 *   5. One task, one set of deciders: a task on two rows says the same
 *      roles on both.
 *   6. Nothing day-to-day waits for the owner: each job the owner handed
 *      over is held to its role, and what the owner keeps is governance.
 *
 * Run: node test/decision-rights.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('decision rights');
const doc = read('docs/decision-rights.md');
const claude = read('CLAUDE.md');

const ROLES = ['sales', 'buyer', 'store', 'manager', 'accounts', 'sourcing'];

/* ---- the table, as the file writes it ---- */
function docRows() {
  const out = [];
  for (const line of doc.split('\n')) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length !== 6) continue;
    const task = (/^`([a-z_]+\.[a-z_]+)`$/.exec(cells[1]) || [])[1];
    if (!task) continue;
    const who = cells[2].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    // Built: "yes" (every role listed), "no" (none), or "yes: Buyer, Store"
    // (only the roles named, the rest still planned).
    const b = cells[5].toLowerCase();
    const part = /^yes:\s*(.+)$/.exec(b);
    const builtFor = b === 'yes' ? who.slice() : b === 'no' ? [] : part ? part[1].split(',').map((x) => x.trim()) : null;
    out.push({ decision: cells[0].replace(/\*\*/g, ''), task, who, built: b, builtFor });
  }
  return out;
}

/* ---- what the migrations grant: every ('role', 'task') inside an
   insert into role_tasks, with SQL comments stripped first so the
   rollback notes in each header are not read as grants ---- */
function migrationGrants() {
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const grants = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8').replace(/--[^\n]*/g, '');
    for (const m of sql.matchAll(/insert\s+into\s+role_tasks[\s\S]*?;/gi)) {
      for (const g of m[0].matchAll(/\(\s*'([a-z]+)'\s*,\s*'([a-z_]+\.[a-z_]+)'\s*\)/g)) {
        const key = g[1] + ' ' + g[2];
        if (!grants.has(key)) grants.set(key, f);
      }
    }
  }
  return grants;
}

const rows = docRows();
const grants = migrationGrants();

/* ---------------- 1. every session reads it ---------------- */
t.check(/docs\/decision-rights\.md/.test(claude), 'CLAUDE.md points every session at docs/decision-rights.md');
t.check(rows.length >= 30, `the table reads as rows (${rows.length} found)`);
t.check(rows.every((r) => r.builtFor && r.builtFor.every((w) => r.who.includes(w))), 'every row says Built yes, no, or "yes:" with roles it lists');
t.check(rows.every((r) => r.who.length && r.who.every((w) => ROLES.includes(w))), 'every "Who decides" names only role logins (the owner holds every task already)');

/* ---------------- 2. no grant the table does not allow ---------------- */
{
  const allowed = new Set();
  rows.forEach((r) => r.who.forEach((w) => allowed.add(w + ' ' + r.task)));
  const stray = [...grants.keys()].filter((k) => !allowed.has(k));
  t.check(stray.length === 0, 'every task a migration grants is in the table for that role'
    + (stray.length ? ` -- not in the table: ${stray.map((k) => `${k} (${grants.get(k)})`).join(', ')}` : ''));
}

/* ---------------- 3 and 4. Built says what the database says ---------------- */
{
  const missing = new Set(), early = new Set();
  for (const r of rows) {
    for (const w of r.who) {
      const has = grants.has(w + ' ' + r.task), should = r.builtFor.includes(w);
      if (should && !has) missing.add(`${w} ${r.task}`);
      if (!should && has) early.add(`${w} ${r.task} (${grants.get(w + ' ' + r.task)})`);
    }
  }
  t.check(missing.size === 0, 'every role a row marks built is granted by a migration'
    + (missing.size ? ` -- not granted: ${[...missing].join(', ')}` : ''));
  t.check(early.size === 0, 'no role holds a task its row still marks planned -- update the row when you build it'
    + (early.size ? ` -- already granted: ${[...early].join(', ')}` : ''));
}

/* ---------------- 5. one task, one set of deciders ---------------- */
{
  const byTask = new Map();
  const clash = [];
  for (const r of rows) {
    const k = r.who.slice().sort().join(',') + ' / ' + r.builtFor.slice().sort().join(',');
    if (byTask.has(r.task) && byTask.get(r.task) !== k) clash.push(r.task);
    byTask.set(r.task, k);
  }
  t.check(clash.length === 0, 'a task on two rows names the same roles and status on both'
    + (clash.length ? ` -- differs: ${clash.join(', ')}` : ''));
}

/* ---------------- the owner watches the machine, and is not part of it ----------------
   Each day-to-day job the owner handed over, held to the role that now
   decides it. Moving one back to "the owner" means changing this list,
   which is a conversation with the owner, not a quiet edit. */
{
  const HOME = {
    manager: ['price.approve', 'markup.set', 'margin.see', 'credit.set', 'credit.release', 'invoice.make',
      'pick.settle', 'credit_note.raise', 'invoice.void', 'stock.writeoff', 'stock.correct', 'trip.difference',
      'customer.edit', 'agent.change', 'goal.set', 'team.limits', 'restock.hold', 'debt.open'],
    accounts: ['cash.expense', 'cash.income', 'cash.transfer', 'payment.edit', 'day.open', 'bill.record', 'bill.pay',
      'consign.settle', 'payroll.run', 'loan.edit', 'asset.edit', 'agent.pay', 'finance.see', 'trip.cash'],
    sourcing: ['sourcing.lead', 'product.edit', 'supplier.edit', 'price.list', 'price.confirm'],
    sales: ['counter.sell', 'sourcing.ask'],
    store: ['stock.receive', 'stock.report', 'trip.collect', 'route.lock'],
    buyer: ['buy.restock', 'price.confirm', 'trip.collect'],
  };
  for (const [role, tasks] of Object.entries(HOME)) {
    const off = tasks.filter((task) => !rows.some((r) => r.task === task && r.who.includes(role)));
    t.check(off.length === 0, `the ${role[0].toUpperCase() + role.slice(1)} role holds what the owner handed it`
      + (off.length ? ` -- not ${role}'s in the table: ${off.join(', ')}` : ''));
  }
  const selfApprove = ['price.approve', 'markup.set', 'credit.set'].filter((task) => rows.some((r) => r.task === task && r.who.includes('sales')));
  t.check(selfApprove.length === 0, 'and Sales never approves its own price, markup or credit');
  const kept = (/## 4\.[\s\S]*?\n## 5\./.exec(doc) || [''])[0];
  t.check(/governance, never operations/.test(kept) && !/invoic|expense|payroll|price list|markup/i.test(kept),
    'what the owner keeps is governance only -- no invoicing, money, prices or markups');
}

/* ---------------- no two migrations share a number ----------------
   Several sessions build at once. Each has a reserved number in section 5;
   two files with one number would run in an order nobody chose. */
{
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const seen = new Map(), dup = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^\d{4}_.*\.sql$/.test(x))) {
    const n = f.slice(0, 4);
    if (seen.has(n)) dup.push(`${seen.get(n)} and ${f}`); else seen.set(n, f);
  }
  t.check(dup.length === 0, 'no two migrations share a number' + (dup.length ? ` -- ${dup.join('; ')}` : ''));
  const reserved = [...doc.matchAll(/^\| (01\d\d) \| /gm)].map((m) => m[1]);
  t.check(reserved.length >= 9 && new Set(reserved).size === reserved.length, 'section 5 reserves one number per build, none twice');
}

process.exit(t.done() ? 1 : 0);
