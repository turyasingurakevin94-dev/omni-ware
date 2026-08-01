#!/usr/bin/env node
'use strict';
/*
 * Row id allocation -- the numeric surrogate ids the admin app assigns to
 * prices, stock log entries, cash transactions, saved quotes, purchase
 * invoices and debt log entries.
 *
 * These used to come from `data.nextXId++`, a counter each client derived
 * on load as max(existing id) + 1. Two admins therefore read the same
 * number and both wrote it, and because the rows sync by upsert the second
 * silently overwrote the first. On cash_txns and customer_debt_log that is
 * money vanishing from the books.
 *
 * 0034 moved the counter into the database and hands out contiguous BLOCKS,
 * so allocation stays synchronous at the call site (addCashPayment() runs
 * mid-loop and can't await). The property that matters is the one a shared
 * counter can't give you: two clients allocating at once must never come
 * away with the same id.
 *
 * Run: node test/row-id-allocation.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('row id allocation');
const adminSrc = read('index.html');
const migSrc = read('supabase/migrations/0034_server_side_row_ids.sql');

/* ---------- a stand-in for the database counter ------------------------ */
/*
 * Mirrors next_row_id_blocks(): one shared counter per (shop, kind),
 * advanced by the block size, returning the first id of the run. Shared
 * across every client in a test, which is the whole point -- a client-local
 * mock would prove nothing about collisions.
 */
function makeServer() {
  const counters = {};
  return {
    counters,
    rpc(name, p) {
      if (name !== 'next_row_id_blocks') return Promise.resolve({ data: null, error: { message: 'unknown rpc ' + name } });
      const out = {};
      for (const kind of p.p_kinds) {
        const floor = Number((p.p_floors || {})[kind]) || 0;
        const last = Math.max(counters[kind] || 0, floor) + p.p_count;
        counters[kind] = last;
        out[kind] = last - p.p_count + 1;
      }
      return Promise.resolve({ data: out, error: null });
    },
  };
}

// One independent client: its own `data`, its own blocks, one shared server.
function makeClient(server, seedCounters) {
  const data = Object.assign({
    nextPriceId: 1, nextStockLogId: 1, nextCashTxnId: 1,
    nextSavedQuoteId: 1, nextPurchaseInvoiceId: 1, nextCustomerDebtLogId: 1,
  }, seedCounters || {});
  const env = { data, sb: server, currentShopId: 'shop-1', console: { warn() {} } };
  const scope = compileScope([
    extractDeclaration(adminSrc, 'ROW_ID_KINDS', 'index.html'),
    extractDeclaration(adminSrc, 'ROW_ID_BLOCK', 'index.html'),
    extractDeclaration(adminSrc, 'ROW_ID_REFILL_AT', 'index.html'),
    extractDeclaration(adminSrc, 'rowIdBlocks', 'index.html'),
    extractDeclaration(adminSrc, 'rowIdRefilling', 'index.html'),
    extractDeclaration(adminSrc, 'ROW_ID_BLOCK_KINDS', 'index.html'),
    extractFunction(adminSrc, 'localRowId', 'index.html'),
    extractFunction(adminSrc, 'noteIssuedRowId', 'index.html'),
    extractFunction(adminSrc, 'rowIdFloor', 'index.html'),
    extractFunction(adminSrc, 'resetRowIdBlocks', 'index.html'),
    extractFunction(adminSrc, 'refillRowIdBlocks', 'index.html'),
    extractFunction(adminSrc, 'allocRowId', 'index.html'),
    extractFunction(adminSrc, 'issueRowId', 'index.html'),
    'function __kinds(){ return Object.keys(ROW_ID_KINDS); }',
    'function __blockKinds(){ return ROW_ID_BLOCK_KINDS.slice(); }',
    'function __denseKinds(){ return Object.keys(ROW_ID_KINDS).filter(n=> ROW_ID_KINDS[n].dense); }',
    'function __blockSize(){ return ROW_ID_BLOCK; }',
  ], env, ['resetRowIdBlocks', 'refillRowIdBlocks', 'allocRowId', 'issueRowId',
           '__kinds', '__blockKinds', '__denseKinds', '__blockSize']);
  return Object.assign(scope, { data });
}

const server = makeServer();
const probe = makeClient(server);
const KINDS = probe.__kinds();
const BLOCK_KINDS = probe.__blockKinds();
const DENSE_KINDS = probe.__denseKinds();
const BLOCK = probe.__blockSize();

(async () => {

  /* ---------- 1. ids from a block are distinct and increasing ---------- */
  {
    const c = makeClient(makeServer());
    await c.refillRowIdBlocks(['cashTxn']);
    const ids = [];
    for (let i = 0; i < BLOCK; i++) ids.push(c.allocRowId('cashTxn'));
    t.check(new Set(ids).size === ids.length,
      `a block hands out ${BLOCK} distinct ids (${new Set(ids).size} unique)`);
    t.check(ids.every((v, i) => i === 0 || v > ids[i - 1]),
      'ids come out strictly increasing');
  }

  /* ---------- 2. two clients never collide ----------------------------- */
  /*
   * The bug. Both clients load the same shop, so both derive the same
   * "max + 1" locally -- under the old counter their first allocation was
   * the same number and one row overwrote the other.
   */
  {
    const shared = makeServer();
    const a = makeClient(shared, { nextCashTxnId: 41 });
    const b = makeClient(shared, { nextCashTxnId: 41 });
    await a.refillRowIdBlocks(['cashTxn']);
    await b.refillRowIdBlocks(['cashTxn']);

    const idsA = [], idsB = [];
    // Interleaved, the way two admins actually work, and well past a single
    // block each -- drawing only one block's worth would pass even if the
    // block were ignored entirely, since reserving one already nudges the
    // two local counters apart. Running over the edge is what proves the
    // top-up keeps them apart rather than letting one walk into the other's
    // range. The yield lets the background refill land, as it would between
    // two real user actions.
    for (let i = 0; i < BLOCK * 3; i++) {
      idsA.push(a.allocRowId('cashTxn'));
      idsB.push(b.allocRowId('cashTxn'));
      await new Promise((r) => setImmediate(r));
    }
    const overlap = idsA.filter((id) => idsB.includes(id));
    t.check(overlap.length === 0,
      overlap.length
        ? `two clients allocated the same cash txn id: ${overlap.join(', ')}`
        : `two clients allocating at once share no ids (${idsA.length} + ${idsB.length})`);
    // nextCashTxnId is "the next one to hand out", so 41 seeded means 40 is
    // the highest id already on file -- nothing issued may land at or below it.
    t.check(Math.min(...idsA, ...idsB) > 40,
      `every issued id clears the ids already on file (lowest ${Math.min(...idsA, ...idsB)}, highest existing 40)`);
  }
  {
    // Same guarantee across every kind at once, since boot reserves them
    // together in one round trip.
    const shared = makeServer();
    const a = makeClient(shared);
    const b = makeClient(shared);
    await a.refillRowIdBlocks(BLOCK_KINDS);
    await b.refillRowIdBlocks(BLOCK_KINDS);
    const clashes = BLOCK_KINDS.filter((k) => a.allocRowId(k) === b.allocRowId(k));
    t.check(clashes.length === 0,
      clashes.length ? `these kinds collided across clients: ${clashes.join(', ')}` : `all ${BLOCK_KINDS.length} block-allocated kinds allocate independently per client`);
  }

  /* ---------- 3. a floor stops an id being reissued -------------------- */
  /*
   * Covers rows written while a client was offline on its local counter:
   * the server's seed can't know about them, so the client passes its own
   * highest as a floor.
   */
  {
    const shared = makeServer();
    const early = makeClient(shared);
    await early.refillRowIdBlocks(['price']);
    early.allocRowId('price');

    // A second client that has been working offline and is now well ahead.
    const late = makeClient(shared, { nextPriceId: 5000 });
    await late.refillRowIdBlocks(['price']);
    const id = late.allocRowId('price');
    t.check(id >= 5000,
      `a client ahead of the server is not handed an id it has already used (got ${id})`);
  }

  /* ---------- 4. degrading to the local counter is still safe ---------- */
  {
    const dead = { rpc: () => Promise.resolve({ data: null, error: { message: 'offline' } }) };
    const c = makeClient(dead, { nextCashTxnId: 77 });
    await c.refillRowIdBlocks(['cashTxn']);   // fails, swallowed
    const ids = [c.allocRowId('cashTxn'), c.allocRowId('cashTxn'), c.allocRowId('cashTxn')];
    t.check(ids.join(',') === '77,78,79',
      `with no server the local counter still issues monotonically (got ${ids.join(',')})`);
    t.check(c.data.nextCashTxnId === 80, 'the local counter is advanced, not just read');
  }
  {
    // Falling back mid-session must not rewind onto ids the block issued.
    const flaky = makeServer();
    const c = makeClient(flaky, { nextCashTxnId: 5 });
    await c.refillRowIdBlocks(['cashTxn']);
    const fromBlock = [c.allocRowId('cashTxn'), c.allocRowId('cashTxn')];
    flaky.rpc = () => Promise.resolve({ data: null, error: { message: 'dropped' } });
    // Drain the block so the next call has to fall back.
    for (let i = 0; i < BLOCK; i++) c.allocRowId('cashTxn');
    const afterFallback = c.allocRowId('cashTxn');
    t.check(afterFallback > Math.max(...fromBlock),
      `the local counter resumes above what the block issued (${afterFallback} vs ${Math.max(...fromBlock)})`);
  }

  /* ---------- 5. blocks do not survive a shop switch ------------------- */
  {
    const c = makeClient(makeServer());
    await c.refillRowIdBlocks(['stockLog']);
    const before = c.allocRowId('stockLog');
    c.resetRowIdBlocks();
    // With the block dropped, allocation must fall through to the local
    // counter rather than keep spending ids reserved against another shop.
    c.data.nextStockLogId = 900;
    const after = c.allocRowId('stockLog');
    t.check(after === 900 && before !== 900,
      `resetRowIdBlocks drops the reserved run so it can't be spent in another shop (before ${before}, after ${after})`);
  }

  /* ---------- 6. the block tops up before it runs dry ------------------ */
  {
    const shared = makeServer();
    const c = makeClient(shared);
    await c.refillRowIdBlocks(['price']);
    const first = shared.counters['row:price'];
    for (let i = 0; i < BLOCK - 1; i++) c.allocRowId('price');
    await new Promise((r) => setImmediate(r));   // let the background refill land
    t.check(shared.counters['row:price'] > first,
      `a block nearing exhaustion reserves the next one in the background (${first} -> ${shared.counters['row:price']})`);
  }

  /* ---------- 7. document numbers stay dense --------------------------- */
  /*
   * saved_quotes and purchase_invoices ids ARE the INV-/PINV- numbers on
   * paperwork handed to customers and suppliers. A block left part-used
   * shows up there as a skipped invoice number, so these two are fetched
   * one at a time at the moment of creation instead.
   */
  {
    t.check(DENSE_KINDS.slice().sort().join(',') === 'purchaseInvoice,savedQuote',
      `the document-numbered collections are exactly the dense ones (${DENSE_KINDS.join(', ')})`);
    t.check(BLOCK_KINDS.length + DENSE_KINDS.length === KINDS.length,
      'every kind is either block-allocated or dense, never neither or both');
  }
  {
    const c = makeClient(makeServer());
    const ids = [];
    for (let i = 0; i < 12; i++) ids.push(await c.issueRowId('savedQuote'));
    const gaps = ids.filter((v, i) => i > 0 && v !== ids[i - 1] + 1);
    t.check(gaps.length === 0,
      gaps.length
        ? `the INV- sequence skipped at ${gaps.join(', ')}`
        : `12 quotes saved in a row take 12 consecutive numbers (${ids[0]}..${ids[ids.length - 1]})`);
  }
  {
    // Across a restart, which is exactly where a block allocator leaks its
    // unused remainder into the sequence.
    const shared = makeServer();
    const a = await makeClient(shared).issueRowId('purchaseInvoice');
    const b = await makeClient(shared).issueRowId('purchaseInvoice');
    t.check(b === a + 1,
      `a new session continues the PINV- sequence rather than skipping (${a} -> ${b})`);
  }
  {
    // Density must not cost the property this whole change exists for.
    const shared = makeServer();
    const a = makeClient(shared), b = makeClient(shared);
    const got = [];
    for (let i = 0; i < 6; i++) { got.push(await a.issueRowId('savedQuote')); got.push(await b.issueRowId('savedQuote')); }
    t.check(new Set(got).size === got.length,
      `two clients numbering quotes at once never share a number (${got.join(',')})`);
  }
  {
    const dead = { rpc: () => Promise.resolve({ data: null, error: { message: 'offline' } }) };
    const c = makeClient(dead, { nextSavedQuoteId: 31 });
    const ids = [await c.issueRowId('savedQuote'), await c.issueRowId('savedQuote')];
    t.check(ids.join(',') === '31,32',
      `with no server a quote still gets a number (got ${ids.join(',')})`);
  }
  {
    // Both ways a dense kind could slip back into block allocation.
    const c = makeClient(makeServer());
    let threw = false;
    try { c.allocRowId('savedQuote'); } catch (_e) { threw = true; }
    t.check(threw, 'block-allocating a document-numbered id is refused, not silently gapped');

    const shared = makeServer();
    const c2 = makeClient(shared);
    await c2.refillRowIdBlocks(KINDS);   // asked for everything, dense included
    t.check(!shared.counters['row:saved_quote'] && !shared.counters['row:purchase_invoice'],
      'refilling never reserves a run for a document-numbered kind, even when asked to');
  }
  {
    t.check(/await refillRowIdBlocks\(ROW_ID_BLOCK_KINDS\)/.test(adminSrc),
      'boot reserves blocks only for the kinds that use them');
    // An unawaited issueRowId() would put a Promise in the id field, which
    // then syncs as null and detaches the record from everything.
    const calls = adminSrc.split(/\r?\n/).map((line, i) => ({ line, n: i + 1 }))
      // Anchored on a quoted argument so prose mentioning `issueRowId()` --
      // the guard in allocRowId names it in its error message -- isn't read
      // as a call site. Quote-agnostic, so swapping ' for " can't hide one.
      .filter((c) => /\bissueRowId\s*\(\s*['"]/.test(c.line));
    const unawaited = calls.filter((c) => !/await\s+issueRowId\s*\(/.test(c.line));
    t.check(calls.length >= 3 && unawaited.length === 0,
      unawaited.length
        ? `issueRowId is called without await at: ${unawaited.map((c) => c.n).join(', ')}`
        : `all ${calls.length} issueRowId call sites are awaited`);
  }

  /* ---------- 8. nothing still allocates from a bare local counter ----- */
  {
    const stragglers = [];
    adminSrc.split(/\r?\n/).forEach((line, i) => {
      const m = /data\.next([A-Za-z]+)Id\+\+/.exec(line);
      // nextQuoteLineId numbers lines inside the quote draft payload, not
      // rows in a table -- there is nothing for two clients to collide on.
      if (m && m[1] !== 'QuoteLine') stragglers.push(`${i + 1}: ${m[0]}`);
    });
    t.check(stragglers.length === 0,
      stragglers.length
        ? `these ids still come from a client-side counter: ${stragglers.join('; ')}`
        : 'every database-backed id goes through allocRowId() or issueRowId()');
  }

  /* ---------- 8. client and migration agree on the kinds --------------- */
  /*
   * A kind the client asks for but the migration never seeded would start
   * from 0 and hand out ids that already exist.
   */
  {
    const declared = extractDeclaration(adminSrc, 'ROW_ID_KINDS', 'index.html');
    const clientKinds = (declared.match(/'row:[a-z_]+'/g) || []).map((s) => s.slice(1, -1));
    const seeded = (migSrc.match(/'row:[a-z_]+'/g) || []).map((s) => s.slice(1, -1));
    const unseeded = clientKinds.filter((k) => !seeded.includes(k));
    t.check(clientKinds.length === KINDS.length && unseeded.length === 0,
      unseeded.length
        ? `these kinds are requested by the client but never seeded in 0034: ${unseeded.join(', ')}`
        : `all ${clientKinds.length} kinds the client allocates are seeded from existing rows in 0034`);
  }
  {
    // The allocator is the only way in -- the counter table has RLS on with
    // no policies, so a client that could write it directly would be no
    // safer than the counter this replaces.
    t.check(/security definer/.test(migSrc) && /is_shop_member\(p_shop_id\)/.test(migSrc),
      'next_row_id_blocks is security definer and checks shop membership itself');
    t.check(/on conflict \(shop_id, kind\) do update/.test(migSrc),
      'the counter is advanced through a row-locking upsert, so concurrent callers serialise');
  }

  /* ---------- 9. quote line ids are read back by the right key --------- */
  /*
   * Not a DB id, but the same class of bug: the loader read `i.id`, which
   * quote items have never had, so the counter reset to 1 on every load and
   * the next item added reused a lineId already in the draft.
   */
  {
    const loader = /nextQuoteLineId: \(quote\.items && quote\.items\.length\) \? Math\.max\(0,\.\.\.quote\.items\.map\(i=>i\.([A-Za-z]+)\|\|0\)\)\+1 : 1/.exec(adminSrc);
    t.check(loader && loader[1] === 'lineId',
      `the quote line counter is derived from lineId, the key items actually carry (found ${loader ? loader[1] : 'no match'})`);

    const items = [{ lineId: 1 }, { lineId: 2 }, { lineId: 3 }];
    const next = items.length ? Math.max(0, ...items.map((i) => i.lineId || 0)) + 1 : 1;
    t.check(next === 4 && !items.some((i) => i.lineId === next),
      `a reloaded draft continues past its existing lines instead of reusing one (next ${next})`);
  }

  process.exit(t.done() ? 1 : 0);
})();
