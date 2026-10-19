'use strict';
/*
 * Real local Postgres 16 (all 108 repo migrations applied) behind a real
 * PostgREST 12.2.3 with db-max-rows = 1000. Clients are supabase-js's own
 * PostgrestClient, with a fetch wrapper that can hold or fail individual
 * HTTP requests (deterministic barriers / fault injection). RPCs that
 * depend on a caller JWT (current_agent_id, is_shop_admin) are answered
 * by the harness -- no authentication is attempted.
 */
const { execFileSync } = require('child_process');
const { PostgrestClient } = require(require('path').join(process.env.VERIFY_WORK || '/tmp/omni-verify', 'npm/node_modules/@supabase/postgrest-js'));

const REST = 'http://127.0.0.1:53000';
const PSQL = ['-q', '-h', '127.0.0.1', '-p', '55432', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'];

function sql(q) { return execFileSync('psql', [...PSQL, '-c', q], { encoding: 'utf8' }).trim(); }
function sqlJSON(q) { const out = sql(`select coalesce(json_agg(t), '[]') from (${q}) t`); return JSON.parse(out || '[]'); }

class RealDB {
  constructor({ rpcs = {} } = {}) {
    this.hooks = [];
    this.rpcs = rpcs;
    this.log = [];
  }
  hook(fn) { this.hooks.push(fn); return () => { this.hooks = this.hooks.filter((h) => h !== fn); }; }
  fetchFor(label) {
    return async (url, init = {}) => {
      const u = new URL(String(url));
      const op = {
        client: label, method: (init.method || 'GET').toUpperCase(),
        table: u.pathname.replace(/^\//, ''), search: u.search, params: Object.fromEntries(u.searchParams),
        body: init.body ? JSON.parse(init.body) : null,
      };
      op.kind = { GET: 'select', HEAD: 'select', POST: 'insert', PATCH: 'update', DELETE: 'delete' }[op.method];
      this.log.push(op);
      for (const h of this.hooks) {
        const r = await h(op);
        if (r && r.error) return new Response(JSON.stringify({ message: r.error.message, code: 'XX000' }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
      return fetch(url, init);
    };
  }
  client(label) {
    const pg = new PostgrestClient(REST, { fetch: this.fetchFor(label) });
    const rpcs = this.rpcs;
    return {
      from: (t) => pg.from(t),
      rpc: async (name, args) => (rpcs[name] ? { data: await rpcs[name](args, label), error: null } : pg.rpc(name, args)),
    };
  }
}

const SHOP = '00000000-0000-0000-0000-00000000000a';
function resetShop() {
  // Fresh synthetic shop per scenario; cascades remove everything it owns.
  sql(`delete from shops where id = '${SHOP}';
       insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000aa', 'owner@example.invalid') on conflict do nothing;
       insert into shops(id, name, created_by) values ('${SHOP}', 'Synthetic', '00000000-0000-0000-0000-0000000000aa');`);
}

module.exports = { RealDB, sql, sqlJSON, SHOP, resetShop };
