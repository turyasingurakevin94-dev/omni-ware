'use strict';
/*
 * In-memory, Supabase-shaped test double for verification only.
 *
 * Implements: select column projection (incl. "*", "a, b"), count/head,
 * filters eq/neq/in/is/gt/gte/lt/lte (incl. "payload->>key" JSON paths),
 * order, limit, range, max_rows cap, single/maybeSingle, insert/update/
 * delete/upsert with .select() returning, per-table unique constraints,
 * identity ids, rpc handlers, and an async hook run before every
 * operation executes (for barriers and fault injection).
 *
 * Every operation's read-or-write executes atomically at the moment it is
 * dispatched (after its hook resolves), like a single PostgREST statement
 * under READ COMMITTED. There is no multi-statement transaction, because
 * the handlers under test never open one.
 */

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function getPath(row, col) {
  const m = /^([a-z_0-9]+)(?:->>?(.+))?$/i.exec(col.trim());
  if (!m) throw new Error('bad column ' + col);
  let v = row[m[1]];
  if (m[2]) {
    const parts = m[2].split(/->>?/);
    for (const p of parts) v = v == null ? undefined : v[p.replace(/'/g, '')];
    if (/->>/.test(col) && v != null && typeof v !== 'string') v = String(v);
  }
  return v;
}

function cmp(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  const na = Number(a), nb = Number(b);
  if (typeof a !== 'string' || typeof b !== 'string') {
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  }
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}
const looseEq = (a, b) => (a == null || b == null) ? false : String(a) === String(b);

class FakeDB {
  constructor(opts = {}) {
    this.tables = {};
    this.nextId = {};
    this.unique = opts.unique || {};       // table -> [[col, col], ...]
    this.identity = opts.identity || {};   // table -> 'id'
    this.maxRows = opts.maxRows || Infinity;
    this.rpcs = opts.rpcs || {};
    this.hooks = [];                       // async (op) => undefined | {error}
    this.log = [];
    this.users = opts.users || {};         // token -> user
  }
  seed(table, rows) {
    this.tables[table] = (this.tables[table] || []).concat(rows.map(clone));
    const idc = this.identity[table];
    if (idc) {
      const max = this.tables[table].reduce((m, r) => Math.max(m, Number(r[idc]) || 0), 0);
      this.nextId[table] = Math.max(this.nextId[table] || 1, max + 1);
    }
  }
  rows(table) { return clone(this.tables[table] || []); }
  hook(fn) { this.hooks.push(fn); return () => { this.hooks = this.hooks.filter((h) => h !== fn); }; }

  async runHooks(op) {
    for (const h of this.hooks) {
      const r = await h(op);
      if (r && r.error) return r;
    }
    return null;
  }

  client(label) {
    const db = this;
    return {
      label,
      from: (table) => new Query(db, table, label),
      rpc: async (name, args) => {
        const op = { kind: 'rpc', name, args, client: label };
        db.log.push(op);
        const inj = await db.runHooks(op);
        if (inj) return { data: null, error: inj.error };
        const fn = db.rpcs[name];
        if (!fn) return { data: null, error: { message: 'no rpc ' + name } };
        return { data: await fn(args, label), error: null };
      },
      auth: {
        getUser: async (token) => ({ data: { user: db.users[token] || null }, error: db.users[token] ? null : { message: 'bad jwt' } }),
      },
    };
  }
}

class Query {
  constructor(db, table, client) {
    this.db = db; this.table = table; this.client = client;
    this.kind = 'select'; this.cols = '*'; this.filters = []; this.orders = [];
    this.lim = null; this.rng = null; this.mode = 'many'; this.returning = false;
    this.countOpt = null; this.head = false; this.values = null; this.upsertOpts = null;
  }
  select(cols = '*', opts) {
    if (this.kind === 'select') { this.cols = cols; if (opts) { this.countOpt = opts.count || null; this.head = !!opts.head; } }
    else { this.returning = true; this.cols = cols; }
    return this;
  }
  insert(values) { this.kind = 'insert'; this.values = values; return this; }
  upsert(values, opts) { this.kind = 'upsert'; this.values = values; this.upsertOpts = opts || {}; return this; }
  update(values) { this.kind = 'update'; this.values = values; return this; }
  delete() { this.kind = 'delete'; return this; }
  eq(c, v) { this.filters.push({ op: 'eq', c, v }); return this; }
  neq(c, v) { this.filters.push({ op: 'neq', c, v }); return this; }
  in(c, v) { this.filters.push({ op: 'in', c, v }); return this; }
  is(c, v) { this.filters.push({ op: 'is', c, v }); return this; }
  gt(c, v) { this.filters.push({ op: 'gt', c, v }); return this; }
  gte(c, v) { this.filters.push({ op: 'gte', c, v }); return this; }
  lt(c, v) { this.filters.push({ op: 'lt', c, v }); return this; }
  lte(c, v) { this.filters.push({ op: 'lte', c, v }); return this; }
  not(c, o, v) { this.filters.push({ op: 'not', c, o, v }); return this; }
  order(c, o = {}) { this.orders.push({ c, asc: o.ascending !== false }); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  then(res, rej) { return this.exec().then(res, rej); }

  match(r) {
    return this.filters.every((f) => {
      const v = getPath(r, f.c);
      switch (f.op) {
        case 'eq': return looseEq(v, f.v);
        case 'neq': return !looseEq(v, f.v);
        case 'in': return f.v.some((x) => looseEq(v, x));
        case 'is': return f.v === null ? v == null : v === f.v;
        case 'gt': return v != null && cmp(v, f.v) > 0;
        case 'gte': return v != null && cmp(v, f.v) >= 0;
        case 'lt': return v != null && cmp(v, f.v) < 0;
        case 'lte': return v != null && cmp(v, f.v) <= 0;
        case 'not': if (f.o === 'is') return f.v === null ? v != null : v !== f.v; throw new Error('not.' + f.o);
        default: throw new Error('filter ' + f.op);
      }
    });
  }
  project(r) {
    const cols = String(this.cols || '*').trim();
    if (cols === '*') return clone(r);
    const out = {};
    cols.split(',').map((s) => s.trim()).filter(Boolean).forEach((c) => {
      if (/[()]/.test(c)) throw new Error('embedded selects not supported: ' + c);
      out[c] = clone(r[c]);
    });
    return out;
  }
  uniqueViolation(table, candidate, ignore) {
    const sets = (this.db.unique[table] || []);
    for (const cols of sets) {
      const clash = (this.db.tables[table] || []).find((r) => r !== ignore && cols.every((c) => candidate[c] != null && looseEq(r[c], candidate[c])));
      if (clash) return { code: '23505', message: `duplicate key value violates unique constraint (${cols.join(',')})` };
    }
    return null;
  }

  async exec() {
    const db = this.db;
    const op = { kind: this.kind, table: this.table, client: this.client, filters: this.filters, values: this.values, cols: this.cols };
    db.log.push(op);
    const inj = await db.runHooks(op);
    if (inj) return { data: null, error: inj.error, count: null };
    // From here on, synchronous: one statement, atomic.
    const t = db.tables[this.table] || (db.tables[this.table] = []);
    let out = null, err = null, count = null;
    if (this.kind === 'select') {
      let rows = t.filter((r) => this.match(r));
      if (this.countOpt) count = rows.length;
      for (const o of this.orders.slice().reverse()) rows = rows.slice().sort((a, b) => (o.asc ? 1 : -1) * cmp(getPath(a, o.c), getPath(b, o.c)));
      if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
      if (this.lim != null) rows = rows.slice(0, this.lim);
      rows = rows.slice(0, db.maxRows);   // PostgREST max_rows: silent cap
      out = this.head ? null : rows.map((r) => this.project(r));
    } else if (this.kind === 'insert' || this.kind === 'upsert') {
      const vals = Array.isArray(this.values) ? this.values : [this.values];
      const made = [];
      for (const v0 of vals) {
        const v = clone(v0);
        const idc = db.identity[this.table];
        if (idc && v[idc] == null) { const n = db.nextId[this.table] || 1; v[idc] = n; db.nextId[this.table] = n + 1; }
        if (this.kind === 'upsert') {
          const conflict = (this.upsertOpts.onConflict || 'id').split(',').map((s) => s.trim());
          const ex = t.find((r) => conflict.every((c) => looseEq(r[c], v[c])));
          if (ex) { Object.assign(ex, v); made.push(ex); continue; }
        }
        const u = this.uniqueViolation(this.table, v, null);
        if (u) { err = u; break; }
        if (!('created_at' in v)) v.created_at = new Date().toISOString();
        t.push(v); made.push(v);
      }
      if (err) out = null; else out = this.returning ? made.map((r) => this.project(r)) : null;
    } else if (this.kind === 'update') {
      const hits = t.filter((r) => this.match(r));
      for (const r of hits) Object.assign(r, clone(this.values));
      out = this.returning ? hits.map((r) => this.project(r)) : null;
    } else if (this.kind === 'delete') {
      const keep = [], gone = [];
      t.forEach((r) => (this.match(r) ? gone : keep).push(r));
      db.tables[this.table] = keep;
      out = this.returning ? gone.map((r) => this.project(r)) : null;
    }
    if (err) return { data: null, error: err, count };
    if (this.mode === 'single' || this.mode === 'maybe') {
      const arr = out || [];
      if (arr.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' }, count };
      if (!arr.length && this.mode === 'single') return { data: null, error: { code: 'PGRST116', message: 'no rows' }, count };
      return { data: arr[0] || null, error: null, count };
    }
    return { data: out, error: null, count };
  }
}

/* A barrier that releases once `n` parties have arrived. */
function barrier(n) {
  let arrived = 0, release;
  const gate = new Promise((r) => { release = r; });
  return { arrive: () => { arrived++; if (arrived >= n) release(); return gate; }, get arrived() { return arrived; } };
}

module.exports = { FakeDB, barrier, clone };
