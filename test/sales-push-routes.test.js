#!/usr/bin/env node
'use strict';
/*
 * Each push has its page in the app it goes to; a test pairs them (docs/spec/06-offline-sync-push.md
 * §7 Q9). For Sales, the map is src/apps/sales/shell/pushes.ts. Here, from the migrations themselves:
 *
 *   - every push kind any migration writes (ow_push) is either in the Sales map or named below as
 *     another app's; a new kind fails until it is placed;
 *   - every kind sent to a task Sales holds (docs/decision-rights.md), and every §6b row "To" the
 *     salesperson, is in the map;
 *   - each kind's data, as push-send builds it (kind + the outbox row's ref, a saved_quotes ref also
 *     as orderId), carries the key the map reads, in every migration that sends it;
 *   - every page the map opens is a ROUTES.md id, with its id and without (the list it lives in);
 *   - §6b says ✓ and names that page for every Sales kind;
 *   - the address form of a push (#push=…, ?demo&push=…) reads back as it was written.
 *
 * Node 22 runs the TypeScript as it is. Run: node test/sales-push-routes.test.js (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales push routes');
const P = require(path.join(ROOT, 'src/apps/sales/shell/pushes.ts'));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/** Pushes the migrations send to another app (§6b), never to a salesperson. */
const ELSEWHERE = [
  // Manager
  'price.waits', 'credit.hold', 'credit.ask', 'pick.short', 'order.delivered', 'invoice.held', 'invoice.ask', 'order.cancel.ask',
  'agent.change', 'agent.cancel', 'carton.ask', 'trip.difference', 'trip.yard_note', 'stock.report', 'store.extra', 'store.closed',
  // Buyer
  'order.buying', 'supplier.answered', 'restock.held', 'restock.released', 'store.restock', 'carton.refused', 'sourcing.found',
  'trip.cash.ready', 'trip.sent', 'trip.taken', 'trip.cancelled', 'order.hold', 'order.hold.kept',
  // Store
  'trip.back', 'job.given', 'credit.ask.decided', 'store.ask.decided', 'stock.report.decided', 'store.handover',
  // Accounts
  'trip.cash', 'trip.cash.ask', 'trip.own_money', 'bill.due', 'bill.paper', 'payment.ask',
  // Sourcing
  'prices.confirm', 'sourcing.request', 'sourcing.dropped', 'sourcing.fix', 'store.new_item',
  // Owner
  'owner.digest',
];

/* ---- the migrations' pushes ---- */

/** The top-level arguments of a call's text. */
function args(s) {
  const out = []; let d = 0, q = false, cur = '';
  for (const c of s) {
    if (c === "'") q = !q;
    else if (!q && c === '(') d++;
    else if (!q && c === ')') d--;
    else if (!q && d === 0 && c === ',') { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}
/** The text between the parenthesis at `i` (just after it) and its match. */
function inner(s, i) {
  let d = 1, j = i;
  while (j < s.length && d) { if (s[j] === '(') d++; else if (s[j] === ')') d--; j++; }
  return s.slice(i, j - 1);
}
/** The keys a jsonb_build_object(...) writes, and the table it names. */
function refKeys(expr) {
  const a = args(expr), keys = [];
  for (let i = 0; i < a.length; i += 2) keys.push(a[i].replace(/^'|'$/g, ''));
  const ti = keys.indexOf('table');
  return { keys, table: ti >= 0 && a[ti * 2 + 1] ? a[ti * 2 + 1].replace(/^'|'$/g, '') : null };
}

const calls = []; // { file, kind, toUser, toTask, toRole, data: [keys] | null }
const dir = path.join(ROOT, 'supabase/migrations');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  const s = fs.readFileSync(path.join(dir, file), 'utf8').replace(/--[^\n]*/g, '');
  const re = /perform\s+ow_push\s*\(/g; let m;
  while ((m = re.exec(s))) {
    const a = args(inner(s, m.index + m[0].length).replace(/\s+/g, ' '));
    const km = a[1] && a[1].match(/^'([a-z_.]+)'$/);
    if (!km) { t.fail(`${file}: a push whose kind is not written out (${a[1]})`); continue; }
    let ref = a[7] || '';
    if (/^ref$/.test(ref)) {
      // The function's own `ref := jsonb_build_object(…)`, the last one before the call.
      const before = s.slice(0, m.index), at = Math.max(before.lastIndexOf('ref jsonb := jsonb_build_object('), before.lastIndexOf('ref := jsonb_build_object('));
      ref = at >= 0 ? 'jsonb_build_object(' + inner(before, before.indexOf('(', at) + 1) + ')' : '';
    }
    const rm = ref.match(/^jsonb_build_object\s*\(/);
    let data = null;
    if (rm) {
      const r = refKeys(inner(ref, rm[0].length));
      data = ['kind', ...r.keys, ...(r.table === 'saved_quotes' ? ['orderId'] : [])];
    }
    calls.push({ file, kind: km[1], toUser: a[4], toTask: a[5], toRole: a[6], data });
  }
}
const kinds = [...new Set(calls.map((c) => c.kind))].sort();
t.check(kinds.length > 50, `the migrations send ${kinds.length} kinds of push`);

/* ---- every kind is placed: Sales' map, or another app ---- */
const sales = Object.keys(P.PUSHES).sort();
for (const k of kinds) t.check(sales.includes(k) !== ELSEWHERE.includes(k), `${k}: ${sales.includes(k) ? 'Sales opens it' : ELSEWHERE.includes(k) ? 'another app' : 'placed nowhere (add it to the Sales map or ELSEWHERE)'}`);
for (const k of sales) t.check(kinds.includes(k), `${k}: a migration sends it`);
for (const k of ELSEWHERE) t.check(kinds.includes(k), `ELSEWHERE ${k}: a migration sends it`);

/* ---- a task Sales holds, or §6b's "the salesperson": Sales' ---- */
const rights = read('docs/decision-rights.md');
const salesTasks = new Set();
rights.split('\n').forEach((l) => { const m = l.match(/^\|[^|]*\| `([a-z_.]+)` \| ([^|]*)\|/); if (m && /\bSales\b/.test(m[2])) salesTasks.add(m[1]); });
t.check(salesTasks.has('quote.make'), `decision-rights.md: Sales holds quote.make (${salesTasks.size} tasks)`);
for (const c of calls) {
  const task = (c.toTask.match(/'([a-z_.]+)'/g) || []).map((x) => x.slice(1, -1));
  if (task.some((x) => salesTasks.has(x)) || /'sales'/.test(c.toRole)) t.check(sales.includes(c.kind), `${c.kind} (${c.file}): sent to Sales' task or role, and in the map`);
}
const spec = read('docs/spec/06-offline-sync-push.md');
const s6b = spec.slice(spec.indexOf('### 6b.'), spec.indexOf('## 7.'));
const rows = s6b.split('\n').filter((l) => /^\| `/.test(l)).map((l) => l.split('|').slice(1, -1).map((x) => x.trim()));
for (const r of rows.filter((x) => /salesperson/.test(x[1]))) {
  for (const k of r[0].match(/`([a-z_.]+)`/g).map((x) => x.slice(1, -1))) t.check(sales.includes(k), `§6b sends ${k} to the salesperson: in the map`);
}

/* ---- each kind's data carries what the map reads ---- */
for (const k of sales) {
  const key = P.PUSHES[k].key;
  for (const c of calls.filter((x) => x.kind === k)) t.check(!!c.data && c.data.includes(key), `${k} (${c.file}): its data carries ${key}${c.data ? ` [${c.data.join(', ')}]` : ' (no ref read)'}`);
}

/* ---- every page is in ROUTES.md ---- */
const routes = new Set();
read('src/apps/sales/shell/ROUTES.md').split('\n').forEach((l) => { const m = l.match(/^\| `([a-z/-]+)` \|/); if (m) routes.add(m[1]); });
t.check(routes.has('orders/order') && routes.has('chats/chat'), `ROUTES.md read (${routes.size} ids)`);
const books = { paymentAsks: [
  { id: 'pa-order', orderId: 533, customerId: 'C002' },
  { id: 'pa-cust', orderId: null, customerId: 'C002' },
  { id: 'pa-none', orderId: null, customerId: null },
] };
const WANT = { orderId: '552', quote: '552', id: '101' };
for (const k of sales) {
  const key = P.PUSHES[k].key, has = P.routeOf({ kind: k, [key]: k === 'payment.ask.decided' ? 'pa-order' : WANT[key] }, books);
  const bare = P.routeOf({ kind: k }, null);
  t.check(!!has && routes.has(has.id), `${k} → ${has && has.id} ${JSON.stringify(has && has.params)}: a ROUTES.md id`);
  t.check(!!has && Object.keys(has.params).length > 0 && Object.values(has.params).every((v) => v !== '' && !Number.isNaN(v)), `${k}: the page is named by the push's ${key}`);
  t.check(!!bare && routes.has(bare.id), `${k} with no ${key} → ${bare && bare.id}: the list it lives in`);
}
const pa = (id) => P.routeOf({ kind: 'payment.ask.decided', id }, books);
t.check(pa('pa-order').id === 'orders/order' && pa('pa-order').params.id === 533, 'payment.ask.decided: its order, from the copy');
t.check(pa('pa-cust').id === 'customers/customer' && pa('pa-cust').params.id === 'C002', 'payment.ask.decided: else its customer');
t.check(pa('pa-none').id === 'today/day' && pa('pa-none').params.view === 'money' && pa('gone').id === 'today/day', 'payment.ask.decided: else the day\'s money');
t.check(P.routeOf({ kind: 'price.waits', orderId: '552' }, null) === null && P.routeOf({}, null) === null, 'a kind Sales has no page for opens nothing');
t.check(P.routeOf({ kind: 'chat.note', id: '1); alert(1' }, null).id === 'chats', 'an id that is not an id opens the list');

/* ---- §6b says Sales opens each, and which page ---- */
for (const k of sales) {
  const r = rows.find((x) => x[0].includes('`' + k + '`'));
  const page = P.routeOf({ kind: k, [P.PUSHES[k].key]: 'x1' }, null).id;
  t.check(!!r && /✓/.test(r[3]) && r[3].includes('`' + page + '`'), `§6b ${k}: ✓ and names \`${page}\`${r ? ` (${r[3]})` : ' (no row)'}`);
}

/* ---- the address form ---- */
const d = { kind: 'order.cancel.ask.decided', table: 'cancel_asks', id: 'a-1', quote: '552' };
t.check(JSON.stringify(P.pushFrom('#' + P.pushQuery(d))) === JSON.stringify(d), 'a push in the address reads back as written (#push=…)');
t.check(JSON.stringify(P.pushFrom('?demo&push=chat.note&id=101')) === JSON.stringify({ kind: 'chat.note', demo: '', id: '101' }), '?demo&push=chat.note&id=101');
t.check(P.pushFrom('?demo') === null && P.pushFrom('') === null, 'no push in the address: none');

process.exit(t.done() ? 1 : 0);
