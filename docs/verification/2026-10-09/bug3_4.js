'use strict';
// BUG-3 (stock lot delete-then-insert) and BUG-4 (loader row cap), executing the real
// loadData() and addStockLotsDiffOps() from index.html against real Postgres + PostgREST
// (db-max-rows = 1000), via supabase-js's PostgrestClient.
const { closure } = require('./extract');
const { RealDB, sql, sqlJSON, SHOP, resetShop } = require('./realdb');

const { extractDeclaration } = require('../../../test/_extract');
const { SRC } = require('./extract');
const DECLS = [];
function compile(roots, env) {
  const c = closure(roots, { maxDepth: 6 });
  const keys = Object.keys(env);
  const body = keys.map((k, i) => `var ${k} = __env[${i}];`).join('\n') + '\n' + DECLS.join('\n') + '\n' + c.sources.join('\n') +
    `\nreturn { ${roots.join(', ')}, __get: (n) => eval(n) };`;
  return new Function('__env', body)(keys.map((k) => env[k]));
}
async function withDecls(fn) {
  for (let i = 0; i < 30; i++) {
    try { return await fn(); } catch (e) {
      const m = e instanceof ReferenceError && /^(\w+) is not defined/.exec(e.message);
      if (!m) throw e;
      DECLS.unshift(extractDeclaration(SRC['index.html'], m[1], 'index.html'));
      console.log('  (pulled real top-level declaration', m[1] + ')');
    }
  }
}
const cloneJSON = (x) => JSON.parse(JSON.stringify(x));

async function loadWith(db) {
  return withDecls(async () => {
    const s = compile(['loadData'], { sb: db.client('browser'), booksRead: { at: null }, document: { getElementById: () => null } });
    const d = await s.loadData(SHOP);
    return { d, booksRead: s.__get('booksRead') };
  });
}

(async () => {
  // ---------------- BUG-4 ----------------
  resetShop();
  sql(`insert into cash_txns(id, shop_id, date, account, type, amount, description)
         select 9000000 + g, '${SHOP}', '2026-10-01', 'cash', 'receipt', 1, 'synthetic' from generate_series(1, 1001) g;`);
  // 999 lots on other keys, then two lots of key P at heap positions 1000 and 1001.
  sql(`insert into stock_lots(shop_id, key, qty, cost) select '${SHOP}', 'K' || g, 1, 10 from generate_series(1, 999) g;
       insert into stock_lots(shop_id, key, qty, cost) values ('${SHOP}', 'P', 10, 100), ('${SHOP}', 'P', 5, 120);
       insert into stock(shop_id, key, qty) values ('${SHOP}', 'P', 15);`);
  const db = new RealDB();
  const { d, booksRead } = await loadWith(db);
  const dbCash = Number(sql(`select count(*) from cash_txns where shop_id='${SHOP}'`));
  const dbLotsP = sqlJSON(`select qty, cost from stock_lots where shop_id='${SHOP}' and key='P' order by id`);
  console.log(`BUG-4 loader: cash_txns in DB=${dbCash} loaded=${d.cashTxns.length} | cash total DB=${dbCash} loaded=${d.cashTxns.reduce((s, t) => s + Number(t.amount), 0)}`);
  console.log(`BUG-4 loader: stock_lots P in DB=${JSON.stringify(dbLotsP)} loaded=${JSON.stringify(d.stockLots.P || [])} | stock P=${d.stock.P}`);
  console.log(`BUG-4 freshness: booksRead=${JSON.stringify({ fresh: !!booksRead.at, error: booksRead.error })}`);
  // Direct PostgREST check of what a single select returns, and its Content-Range.
  const res = await fetch(`http://127.0.0.1:53000/cash_txns?select=id&shop_id=eq.${SHOP}`, { headers: { Prefer: 'count=exact' } });
  console.log(`BUG-4 raw PostgREST: HTTP ${res.status} rows=${(await res.json()).length} Content-Range=${res.headers.get('content-range')}`);

  // Subsequent write: a sale takes 1 from P's loaded lot; the real diff op rewrites key P.
  {
    const lastSynced = { stockLots: cloneJSON(d.stockLots) };
    const s = compile(['addStockLotsDiffOps'], { sb: db.client('browser'), lastSynced, syncAbsentCollections: null, cloneJSON, stockLotConsignColumn: true, console });
    const lots = cloneJSON(d.stockLots);
    lots.P[0].qty -= 1;
    const ops = [];
    s.addStockLotsDiffOps(ops, SHOP, lots);
    const r = await ops[0].run();
    if (!r.error) ops[0].commit();
    console.log(`BUG-4 subsequent sale: op error=${JSON.stringify(r.error)} | P lots now in DB=${JSON.stringify(sqlJSON(`select qty, cost from stock_lots where shop_id='${SHOP}' and key='P' order by id`))} (was ${JSON.stringify(dbLotsP)})`);
  }

  // ---------------- BUG-3 ----------------
  resetShop();
  sql(`insert into stock_lots(shop_id, key, qty, cost, consign) values ('${SHOP}', 'P', 10, 100, 'SUP1');`);
  {
    const db3 = new RealDB();
    const loaded = (await loadWith(db3)).d;
    const lastSynced = { stockLots: cloneJSON(loaded.stockLots) };
    const s = compile(['addStockLotsDiffOps'], { sb: db3.client('browser'), lastSynced, syncAbsentCollections: null, cloneJSON, stockLotConsignColumn: true, console });
    const lots = cloneJSON(loaded.stockLots);
    lots.P[0].qty = 9;
    const off = db3.hook(async (op) => { if (op.kind === 'insert' && op.table === 'stock_lots') return { error: { message: 'injected stock_lots insert failure' } }; });
    const ops = [];
    s.addStockLotsDiffOps(ops, SHOP, lots);
    const r = await ops[0].run();
    if (!r.error) ops[0].commit();
    off();
    // A separate client (another device) reads the shop.
    const other = await loadWith(new RealDB());
    console.log(`BUG-3 after failed insert: run error=${JSON.stringify(r.error && r.error.message)} | DB P lots=${JSON.stringify(sqlJSON(`select qty, cost, consign from stock_lots where shop_id='${SHOP}' and key='P'`))} | other device sees P lots=${JSON.stringify(other.d.stockLots.P || [])} | snapshot P (not committed)=${JSON.stringify(lastSynced.stockLots.P)}`);
    // Same tab retries on its next save:
    const ops2 = [];
    s.addStockLotsDiffOps(ops2, SHOP, lots);
    const r2 = await ops2[0].run();
    if (!r2.error) ops2[0].commit();
    console.log(`BUG-3 same-tab retry: error=${JSON.stringify(r2.error)} | DB P lots=${JSON.stringify(sqlJSON(`select qty, cost, consign from stock_lots where shop_id='${SHOP}' and key='P'`))}`);
  }
  resetShop();
})().catch((e) => { console.error(e); process.exit(1); });
