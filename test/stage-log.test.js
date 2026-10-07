#!/usr/bin/env node
'use strict';
/*
 * An order's stage log: written on every move, by both apps, and never
 * lost to the other one's save.
 *
 * Three readers were built on q.stageLog -- the order's trail, its stage
 * times, and the board's days-per-stage (ofHist) -- and nothing wrote
 * it, so every one of them said "not recorded" of every order. Now:
 *
 *   WRITTEN      setSavedQuoteStatus appends {status, at, auto?} when
 *                the stage really changes, `at` in milliseconds (the
 *                board subtracts one entry's from the next). The worker
 *                app's loadOrder appends its own move the same way.
 *   MERGED       Each app saves the whole payload from its own copy, so
 *                each merges the server's copy in first (mergeStageLog:
 *                each status+moment once, oldest first). The console does
 *                it inside the upsert (addDiffOps' beforeUpsert) and keeps
 *                the merged log on the order in memory too, or the row
 *                would be re-sent on every save. A failed re-read still
 *                saves -- the database's trigger (0106) unions as well.
 *   NOT OWNED    stageLog stays out of WORKER_OWNED_KEYS and out of
 *                hasUnsavedWork: owned, the worker's copy would overwrite
 *                the console's; compared, a merged log would never equal
 *                the local one and hold every refresh off for good.
 *
 * Run: node test/stage-log.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('stage log');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const src = read('index.html');
const sharedJs = read('shared-worker.js');
const workerHtml = read('worker.html');
const mig = read('supabase/migrations/0106_data_integrity.sql');

const { mergeStageLog } = compileScope([extractFunction(sharedJs, 'mergeStageLog', 'shared-worker.js')], {}, ['mergeStageLog']);

/* The emptiest books buildSyncRows will run on, so the row the console
   really sends is the one measured here. */
const PROBES = { priceAskedColumn: true, sourcingVariantColumn: true, sourcingImageColumn: true, transferColumn: true,
  linkSizeColumn: true, siteStageColumn: true, cashTransferColumn: true, cashCoversColumns: true, customerTermsColumns: true,
  waPostKindsColumn: true, cashEntryMetaColumns: true, cashCloseColumns: true, stockLogMetaColumns: true,
  debtLogLinkColumns: true, lotConsignColumn: true };
const books = (savedQuotes) => ({
  suppliers: [], staff: [], agents: [], customers: [], products: [], prices: [], stock: {}, stockLots: {},
  stockLog: [], cashDays: {}, cashTxns: [], savedQuotes, purchaseInvoices: [], supplierCommissions: [],
  fixedAssets: [], loans: [], quote: null,
});
const SYNC = [
  extractFunction(src, 'dateOrNull', 'index.html'),
  extractFunction(src, 'buildSyncRows', 'index.html'),
];

/* ---------- 1. the console writes it, on a real move only ------------ */
{
  const data = { savedQuotes: [] };
  const s = compileScope([
    extractDeclaration(src, 'SQ_STATUSES', 'index.html'),
    extractDeclaration(src, 'SQ_STATUS_ORDER', 'index.html'),
    extractFunction(src, 'setSavedQuoteStatus', 'index.html'),
  ], { data, saveData: () => {}, renderSavedQuotes: () => {}, announceOrderMove: () => {} }, ['setSavedQuoteStatus']);
  data.savedQuotes = [{ id: 1, status: 'draft', stageEnteredAt: 111 }];
  const q = data.savedQuotes[0];

  s.setSavedQuoteStatus(1, 'awaiting_goods', { auto: true });
  t.check(Array.isArray(q.stageLog) && q.stageLog.length === 1, 'a move writes the first entry');
  eq(q.stageLog[0].status, 'awaiting_goods', 'naming the stage it moved into');
  t.check(typeof q.stageLog[0].at === 'number' && q.stageLog[0].at === q.stageEnteredAt,
    'at the same moment as stageEnteredAt, in milliseconds — the board subtracts one from the next');
  eq(q.stageLog[0].auto, true, 'and a move the app made itself says so');

  s.setSavedQuoteStatus(1, 'awaiting_goods');
  eq(q.stageLog.length, 1, 'staying where it is writes nothing');

  s.setSavedQuoteStatus(1, 'preparing');
  eq(q.stageLog.length, 2, 'the next move is appended, the first kept');
  t.check(!('auto' in q.stageLog[1]), 'and an owner\'s tap carries no auto mark at all');

  const fn = (n) => extractFunction(src, n, 'index.html');
  t.check(/setSavedQuoteStatus\(q\.id, 'preparing', \{ auto: true \}\)/.test(fn('autoAdvanceReceivedOrders')),
    'goods checked in move an order on as the app\'s own move');
  t.check(/setSavedQuoteStatus\(q\.id, orderAwaitsGoods\(q\) \? 'awaiting_goods' : 'preparing', \{ auto: !force \}\)/.test(fn('orderLeaveDraft')),
    'as does the last supplier\'s answer, while the owner\'s own tap is theirs');
  const tick = src.slice(src.indexOf('Autopilot. Moves only what the books already say is ready'), src.indexOf('  feedMove(o, stage, why, manual) {'));
  t.check(/setSavedQuoteStatus\(q\.id, 'preparing', \{ auto: true \}\)/.test(tick) && /self\.sendOut\(q, d, true\)/.test(tick),
    'and the board\'s autopilot marks both of its moves');
}

/* ---------- 2. the worker app writes its own move -------------------- */
{
  const data = { savedQuotes: [] };
  const s = compileScope([
    extractDeclaration(sharedJs, 'CARRIER_KINDS', 'shared-worker.js'),
    extractFunction(sharedJs, 'carrierKindsFor', 'shared-worker.js'),
    extractFunction(sharedJs, 'staffEligibleForRole', 'shared-worker.js'),
    extractFunction(sharedJs, 'staffName', 'shared-worker.js'),
    extractFunction(sharedJs, 'loadOrder', 'shared-worker.js'),
    'function __set(d){ data = d; }',
  ], {
    data, saveData: () => {}, toast: () => {}, renderWorkerView: () => {}, refreshAdminOrderBoardIfOpen: () => {},
    setSavedQuoteStatus: undefined, myStaff: { id: 'ST1', name: 'Brian' }, document: undefined,
  }, ['loadOrder', '__set']);
  const q = { id: 7, status: 'preparing', deliveryMode: 'shop_delivery', stageEnteredAt: 1000,
    stageLog: [{ status: 'preparing', at: 1000 }], items: [] };
  s.__set({ savedQuotes: [q], staff: [] });
  t.check(s.loadOrder(7, { kind: 'hired', name: 'Kato Transport' }) === true, 'the worker loads an order out');
  eq(q.stageLog.length, 2, 'and the move is appended to the log it already had');
  eq(q.stageLog[1], { status: 'pending_delivery', at: q.stageEnteredAt }, 'as the console writes it, at the same moment');
  t.check(/stageLog:q\.stageLog\|\|null/.test(extractFunction(workerHtml, 'buildWorkerSyncRows', 'worker.html')),
    'and it goes up with the rest of the worker\'s row');
}

/* ---------- 3. two copies, made one ----------------------------------- */
{
  eq(mergeStageLog(null, undefined), null, 'nothing and nothing is no log, not an empty one');
  eq(mergeStageLog([], []), null, 'nor are two empty lists');
  const admin = [{ status: 'preparing', at: 1000 }, { status: 'draft', at: 1500 }, { status: 'preparing', at: 2000 }];
  const worker = [{ status: 'preparing', at: 1000 }, { status: 'pending_delivery', at: 3000 }];
  eq(mergeStageLog(worker, admin).map((e) => e.status + '@' + e.at),
    ['preparing@1000', 'draft@1500', 'preparing@2000', 'pending_delivery@3000'],
    'each move once, oldest first, whichever copy it came from and in whichever order they are given');
  eq(mergeStageLog(admin, admin).length, 3, 'the same log twice is the same log');
  eq(mergeStageLog([{ status: 'completed', at: '1970-01-01T00:00:04.000Z' }], [{ status: 'completed', at: 4000 }]),
    [{ status: 'completed', at: 4000 }], 'a moment spelled as text is the same moment as its number, and is kept as the number');
  eq(mergeStageLog([{ status: 'x' }, null, { at: 5 }], [{ status: 'preparing', at: 9 }]), [{ status: 'preparing', at: 9 }],
    'an entry with no stage or no moment is not a move');

  /* Why the order matters: the board reads the days spent in a stage as
     the next entry's moment less this one's. */
  const { ofHist } = compileScope([extractFunction(src, 'ofHist', 'index.html')], {}, ['ofHist']);
  const day = 864e5;
  eq(ofHist({ stageLog: mergeStageLog([{ status: 'preparing', at: 3 * day }], [{ status: 'awaiting_goods', at: day }]) }),
    { awaiting_goods: 2 }, 'two days buying, read off a merged log');

  /* A tab that had not refreshed can send out an order already out, and
     the log keeps both entries for good (0106). The second is not a
     move: read as one it would cut the first stay short (2 days, not 4)
     and start a second that never happened. */
  const t0 = Date.UTC(2026, 9, 1);
  const doubled = [{ status: 'preparing', at: t0 }, { status: 'pending_delivery', at: t0 + day },
    { status: 'pending_delivery', at: t0 + 3 * day }, { status: 'completed', at: t0 + 5 * day }];
  eq(ofHist({ stageLog: doubled }), { preparing: 1, pending_delivery: 4 },
    'a stage entered again without leaving it is timed from when it first got there');
  const { orderTrail } = compileScope([extractFunction(src, 'orderTrail', 'index.html')], {
    supplierName: () => '', staffName: () => '', quoteLineReceived: () => false, invoiceNumberLabel: () => '',
    DELIVERY_SELF_CARRIERS: {}, otStageShort: (s) => s,
  }, ['orderTrail']);
  eq(orderTrail({ savedAt: t0 - 1, stageLog: doubled }).map((e) => e.what),
    ['Taken at the desk', 'Moved to preparing', 'Moved to pending_delivery', 'Moved to completed'],
    'and the order\'s trail says it was sent out once');
}

/* ---------- 4. a console save after the worker's entry ---------------- */
(async () => {
  /* The database hands an entry back with its keys in jsonb's own order
     -- shortest first, so {at, auto, status} -- not the order this app
     wrote them in. The stub does the same with anything it holds, and
     keeps what each upsert sends, so a save's next read sees it. */
  const jsonb = (e) => {
    const o = {};
    Object.keys(e).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).forEach((k) => { o[k] = e[k]; });
    return o;
  };
  const run = async ({ server, failRead, local, prevPayload }) => {
    const data = { savedQuotes: [local] };
    const lastSynced = { savedQuotes: {} };
    const sent = [], errors = [];
    const sb = {
      from: () => ({
        select: (cols) => ({
          eq: () => ({
            in: (_f, ids) => Promise.resolve(failRead ? { data: null, error: { message: 'offline' } }
              : { data: ids.filter((id) => server[id]).map((id) => ({ id, stageLog: server[id].map(jsonb) })), error: null, cols }),
          }),
        }),
        upsert: (rows) => {
          sent.push(JSON.parse(JSON.stringify(rows)));
          rows.forEach((r) => { if (r.payload && Array.isArray(r.payload.stageLog)) server[r.id] = r.payload.stageLog.map(jsonb); });
          return Promise.resolve({ error: null });
        },
      }),
    };
    const s = compileScope([
      ...SYNC,
      extractFunction(sharedJs, 'addDiffOps', 'shared-worker.js'),
      extractFunction(sharedJs, 'cloneJSON', 'shared-worker.js'),
      extractFunction(sharedJs, 'mergeStageLog', 'shared-worker.js'),
      extractFunction(src, 'mergeServerStageLogs', 'index.html'),
    ], Object.assign({ data, lastSynced, sb, syncAbsentCollections: null, __owAllowMassDelete: false,
      sourcingResearchRows: () => [], console: { error: (...a) => errors.push(a.join(' ')) } }, PROBES),
    ['buildSyncRows', 'addDiffOps', 'mergeServerStageLogs']);
    if (prevPayload) lastSynced.savedQuotes['12'] = { id: 12, payload: prevPayload };
    const save = async () => {
      const rows = s.buildSyncRows(books(data.savedQuotes), 'shop-1');
      const ops = [];
      s.addDiffOps(ops, 'savedQuotes', 'saved_quotes', 'id', 'shop-1', rows.savedQuotes,
        { beforeUpsert: (r) => s.mergeServerStageLogs('shop-1', r) });
      const res = await Promise.all(ops.map((op) => op.run()));
      res.forEach((r, i) => { if (!(r && r.error)) ops[i].commit(); });
      return ops.length;
    };
    return { data, sent, errors, save, lastSynced };
  };

  {
    const local = { id: 12, status: 'completed', items: [], stageLog: [{ status: 'preparing', at: 1000 }, { status: 'completed', at: 5000 }] };
    const h = await run({ local, server: { 12: [{ status: 'preparing', at: 1000 }, { status: 'pending_delivery', at: 3000 }] } });
    eq(await h.save(), 1, 'the order goes up');
    eq(h.sent[0][0].payload.stageLog.map((e) => e.status),
      ['preparing', 'pending_delivery', 'completed'],
      'carrying the worker\'s entry it never had, in its place in time — not erasing it');
    eq(h.data.savedQuotes[0].stageLog.map((e) => e.at), [1000, 3000, 5000],
      'and the order in memory now holds the merged log too');
    eq(await h.save(), 0,
      'so the next save finds nothing changed — the row sent is the row built, and is not re-sent on every save');

    // A move made while the read was out is newer than both, and kept.
    const h2 = await run({ local: { id: 12, status: 'completed', items: [], stageLog: [{ status: 'completed', at: 5000 }] },
      server: { 12: [{ status: 'pending_delivery', at: 3000 }] } });
    const before = h2.data.savedQuotes[0];
    const p = h2.save();
    before.stageLog = before.stageLog.concat([{ status: 'preparing', at: 6000 }]);
    await p;
    eq(before.stageLog.map((e) => e.at), [3000, 5000, 6000], 'a move made while the read was out survives the merge');
  }

  /* Two moves in one session. After the first save the server holds the
     first entry in its own spelling; the second save reads it back that
     way. Memory must keep the server's spelling of an entry the server
     holds, or the row built next never equals the row committed and the
     order goes up on every save until a refresh replaces the books. */
  {
    const local = { id: 12, status: 'preparing', items: [], stageLog: [] };
    const h = await run({ local, server: {} });
    const move = (status, at) => { local.status = status; local.stageLog = local.stageLog.concat([{ status, at, auto: true }]); };
    const counts = [];
    move('preparing', 1000); counts.push(await h.save()); counts.push(await h.save());
    move('pending_delivery', 2000); counts.push(await h.save()); counts.push(await h.save()); counts.push(await h.save());
    eq(counts, [1, 0, 1, 0, 0], 'each move goes up once, and an idle save sends nothing');
    eq(h.sent.length, 2, 'two moves, two upserts');
  }

  {
    const local = { id: 12, status: 'preparing', items: [], stageLog: [{ status: 'preparing', at: 1000 }] };
    const h = await run({ local, failRead: true, server: {} });
    eq(await h.save(), 1, 'a failed re-read still saves');
    eq(h.sent.length, 1, 'the upsert goes');
    eq(h.sent[0][0].payload.stageLog, [{ status: 'preparing', at: 1000 }], 'with the rows as they were built');
    t.check(h.errors.some((e) => /saved_quotes/.test(e)), 'and the failure is logged, not swallowed');
  }

  {
    const local = { id: 12, status: 'draft', items: [] };
    const h = await run({ local, server: {} });
    await h.save();
    eq(h.sent[0][0].payload.stageLog, null, 'an order new to the server, with no log, goes up exactly as built');
  }

  /* Without the hook the upsert is the plain call it always was, so
     every other collection's save is untouched by this. */
  {
    const s = compileScope([extractFunction(sharedJs, 'addDiffOps', 'shared-worker.js'),
      extractFunction(sharedJs, 'cloneJSON', 'shared-worker.js')], {
      lastSynced: {}, syncAbsentCollections: null, __owAllowMassDelete: false,
      sb: { from: () => ({ upsert: () => ({ error: null, plain: true }) }) },
    }, ['addDiffOps']);
    const ops = [];
    s.addDiffOps(ops, 'products', 'products', 'id', 'shop-1', [{ id: 1 }]);
    t.check(ops[0].run().plain === true, 'a collection with no hook still upserts directly, without an await in between');
    const tie = /addDiffOps\(ops, 'savedQuotes', 'saved_quotes', 'id', shopId, rows\.savedQuotes, \{beforeUpsert: \(r\)=> mergeServerStageLogs\(shopId, r\)\}\);/;
    t.check(tie.test(extractFunction(src, 'syncDataToServer', 'index.html')), 'and the console\'s orders are saved through the hook');
  }

  /* ---------- 5. a worker save after the console's entry --------------- */
  {
    let server = { id: 12, shop_id: 'shop-1', status: 'preparing',
      payload: { items: [], stageLog: [{ status: 'preparing', at: 1000 }, { status: 'draft', at: 1500 }, { status: 'preparing', at: 2000 }] } };
    const s = compileScope([
      extractDeclaration(workerHtml, 'WORKER_OWNED_KEYS', 'worker.html'),
      extractDeclaration(workerHtml, 'WORKER_STATUS_MOVES', 'worker.html'),
      extractFunction(workerHtml, 'mergePickState', 'worker.html'),
      extractFunction(workerHtml, 'mergeOntoServerRows', 'worker.html'),
      extractFunction(workerHtml, 'hasUnsavedWork', 'worker.html'),
      extractFunction(sharedJs, 'mergeStageLog', 'shared-worker.js'),
      'function __owned(){ return WORKER_OWNED_KEYS.slice(); }',
      'function __set(d, ls){ data = d; lastSynced = ls; }',
      'var data = null, lastSynced = null, currentShopId = "shop-1";',
    ], {
      sb: { from: () => ({ select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [server], error: null }) }) }) }) },
    }, ['mergeOntoServerRows', 'hasUnsavedWork', '__owned', '__set']);
    const [row] = await s.mergeOntoServerRows('shop-1', [{ id: 12, shop_id: 'shop-1', status: 'pending_delivery',
      payload: { items: [], stageLog: [{ status: 'preparing', at: 1000 }, { status: 'pending_delivery', at: 3000 }] } }]);
    eq(row.payload.stageLog.map((e) => e.status + '@' + e.at),
      ['preparing@1000', 'draft@1500', 'preparing@2000', 'pending_delivery@3000'],
      'the worker\'s save keeps the console\'s entries and adds its own, in order');

    /* A MOVE REFUSED LEAVES NO ENTRY. The worker taps Loaded on a copy
       the console has already moved on -- sent out by the autopilot, or
       completed -- so the status stays the server's, and the worker's
       entry must not ride in with it: 0106 keeps every entry it sees,
       and one written here would stand for good as a move that never
       happened. */
    const stale = (at) => ({ id: 12, shop_id: 'shop-1', status: 'pending_delivery',
      payload: { items: [], stageLog: [{ status: 'preparing', at: 1000 }, { status: 'pending_delivery', at }] } });
    const serverLog = [{ status: 'preparing', at: 1000 }, { status: 'pending_delivery', at: 2000 }, { status: 'completed', at: 5000 }];
    server = { id: 12, shop_id: 'shop-1', status: 'completed', payload: { items: [], stageLog: serverLog } };
    const [done] = await s.mergeOntoServerRows('shop-1', [stale(6000)]);
    eq(done.status, 'completed', 'an order the console completed stays completed');
    eq(done.payload.stageLog, serverLog, 'and its log comes back exactly as the server had it');
    server = { id: 12, shop_id: 'shop-1', status: 'pending_delivery',
      payload: { items: [], stageLog: serverLog.slice(0, 2) } };
    const [out] = await s.mergeOntoServerRows('shop-1', [stale(3000)]);
    eq(out.status, 'pending_delivery', 'an order the console already sent out is out once');
    eq(out.payload.stageLog, serverLog.slice(0, 2), 'with no second "sent out" from the worker\'s late tap');

    t.check(!s.__owned().includes('stageLog'), 'stageLog is not one of the keys the worker owns');
    /* Only the log differs between memory and what was last synced: that
       is not unsaved work, or a merged log would hold off every refresh. */
    const q = { id: 12, status: 'pending_delivery', items: [], stageLog: [{ status: 'pending_delivery', at: 3000 }] };
    s.__set({ savedQuotes: [q] }, { savedQuotes: { 12: { id: 12, status: 'pending_delivery', payload: { items: [],
      stageLog: [{ status: 'preparing', at: 1000 }, { status: 'pending_delivery', at: 3000 }] } } } });
    eq(s.hasUnsavedWork(), false, 'and a log that differs only by the other app\'s entries is not unsaved work');
  }

  /* ---------- 6. and the database keeps the union too ------------------ */
  {
    t.check(/create trigger saved_quotes_keep_stage_log\s+before update on public\.saved_quotes/.test(mig),
      '0106 adds a trigger that runs before every update of an order — the upsert\'s conflict path included');
    t.check(/old\.payload -> 'stageLog'/.test(mig) && /new\.payload -> 'stageLog'/.test(mig),
      'reading the log already there and the log arriving');
    t.check(/distinct on \(x\.e ->> 'status', x\.e ->> 'at'\)/.test(mig),
      'keeping each status and moment once');
    t.check(/order by u\.at_ms nulls last/.test(mig), 'ordered by the moment, as the board reads it');
    t.check(/language plpgsql set search_path = public/.test(mig), 'with its search path pinned, as this schema\'s functions are');
  }

  process.exit(t.done() ? 1 : 0);
})();
