/* A stand-in for supabase-js inside the preview: the tables are the
   sample shop in window.SX_FIXTURE, writes land in memory and are kept in
   window.SX_WRITES so a check can see what a screen wrote. */
(function () {
  const F = window.SX_FIXTURE;
  const T = F.tables;
  window.SX_WRITES = [];
  let nextId = 900000;
  function query(table) {
    const st = { table, filters: [], order: null, limit: null, single: false, maybe: false, op: 'select', row: null, gt: null, sel: '*' };
    const run = () => {
      let rows = (T[table] || []).slice();
      st.filters.forEach(([k, v, kind]) => { rows = rows.filter(r => kind === 'gte' ? String(r[k]) >= String(v) : String(r[k]) === String(v)); });
      if (st.gt) rows = rows.filter(r => String(r[st.gt[0]]) > String(st.gt[1]));
      if (st.op !== 'select') {
        window.SX_WRITES.push({ table, op: st.op, row: st.row, filters: st.filters });
        const list = T[table] || (T[table] = []);
        const rowsIn = Array.isArray(st.row) ? st.row : [st.row];
        if (st.op === 'insert' || st.op === 'upsert') {
          rowsIn.forEach(r => {
            const key = r.id != null ? r.id : (r.key != null ? r.key : null);
            const i = key == null ? -1 : list.findIndex(x => String(x.id != null ? x.id : x.key) === String(key));
            const full = { ...r }; if (full.id == null && table !== 'stock') full.id = ++nextId; if (table === 'decision_log') full.at = new Date().toISOString();
            if (i >= 0 && st.op === 'upsert') list[i] = { ...list[i], ...full }; else list.push(full);
          });
          const out = rowsIn.map(r => list.find(x => String(x.id) === String(r.id)) || list[list.length - 1]);
          return { data: st.single ? out[0] : out, error: null };
        }
        if (st.op === 'update') { rows.forEach(r => Object.assign(r, st.row)); return { data: rows, error: null }; }
        if (st.op === 'delete') { T[table] = list.filter(r => !rows.includes(r)); return { data: rows, error: null }; }
      }
      if (st.limit != null) rows = rows.slice(0, st.limit);
      if (st.single || st.maybe) return { data: rows[0] || null, error: null };
      return { data: rows, error: null, count: rows.length };
    };
    const q = {
      select(s, o) { st.sel = s; return q; }, eq(k, v) { st.filters.push([k, v]); return q; }, gte(k, v) { st.filters.push([k, v, 'gte']); return q; },
      gt(k, v) { st.gt = [k, v]; return q; }, order() { return q; }, limit(n) { st.limit = n; return q; },
      single() { st.single = true; return q; }, maybeSingle() { st.maybe = true; return q; },
      insert(r) { st.op = 'insert'; st.row = r; return q; }, upsert(r) { st.op = 'upsert'; st.row = r; return q; },
      update(r) { st.op = 'update'; st.row = r; return q; }, delete() { st.op = 'delete'; return q; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return q;
  }
  const user = { id: F.userId, email: 'moses@mukasa.ug' };
  const client = {
    from: query,
    rpc(name, args) {
      if (name === 'next_row_id_blocks') { const k = args.p_kinds[0]; return Promise.resolve({ data: { [k]: ++nextId }, error: null }); }
      if (name === 'next_entity_id') { const n = Math.max(Number(args.p_floor) || 0, 0) + 1; return Promise.resolve({ data: args.p_prefix + String(n).padStart(3, '0'), error: null }); }
      return Promise.resolve({ data: null, error: null });
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user }, error: null }),
      getSession: () => Promise.resolve({ data: { session: { user } } }),
      signInWithPassword: () => Promise.resolve({ error: null }), signOut: () => Promise.resolve({}),
      resetPasswordForEmail: () => Promise.resolve({ error: null }), updateUser: () => Promise.resolve({ error: null }),
    },
    storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#9C8F7A"/></svg>') } }) }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
  };
  window.supabase = { createClient: () => client };
})();
