#!/usr/bin/env node
'use strict';
/*
 * Collection trips: somebody going to a supplier to fetch goods, and what
 * they came back with.
 *
 * Per SUPPLIER, not per order, because that is the shape of the real
 * thing: one journey to Shafik covers lines from three different orders
 * and is settled with one payment. Per order would have sent the same
 * worker to the same shop three times.
 *
 * The lifecycle, and who moves it:
 *
 *   open -> assigned          the admin, from the buying list
 *   assigned -> collecting    the worker, accepting on their device
 *   collecting -> collected   the worker, back with what they got
 *   collected -> confirmed    the ADMIN, checking it in
 *
 * That last arrow is the safety boundary this whole file leans on: only
 * confirming puts goods on the shelf, and confirming is not a thing the
 * worker app can do. The worker app saves from a snapshot that can be
 * hours old -- which is why WORKER_OWNED_KEYS lets it write so little of
 * an order -- and letting it write stock and supplier debt would be a
 * much larger trust than it has today.
 *
 * Run: node test/collection-trips.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('collection trips');
const src = read('index.html');
const shared = read('shared-worker.js');

/* ---------- the two scopes, worker and admin ------------------------- */

const SHARED_NAMES = ['tripIsLive', 'tripLines', 'tripLineGot', 'tripAllAnswered',
  'tripShortLines', 'tripsForWorker', 'tripsCoveringLine', 'lineIsOnATrip',
  'acceptCollectionTrip', 'setTripLineGot', 'finishCollectionTrip'];

const makeWorker = (state) => {
  const toasts = [];
  const scope = compileScope(
    SHARED_NAMES.map((n) => extractFunction(shared, n, 'shared-worker.js')),
    {
      data: state,
      myStaff: { id: 'W1', name: 'Kevin Moses' },
      saveData: () => { state._saves = (state._saves || 0) + 1; },
      toast: (m) => toasts.push(m),
    },
    SHARED_NAMES,
  );
  return { scope, toasts };
};

const trip = (over) => Object.assign({
  id: 'TRIP-1', supplierId: 'S1', status: 'assigned', assignedWorkerId: 'W1',
  createdAt: '2026-08-09T08:00:00Z', assignedAt: '2026-08-09T08:05:00Z',
  acceptedAt: null, collectedAt: null, confirmedAt: null, note: '', voided: false,
  lines: [
    { orderId: 'QA', lineId: 1, productId: 'P1', variantIdx: 4, productName: 'Tape Measure',
      unit: 'Dozen', packUnit: 'Ctn', clientName: 'Abraham', qty: 6, expectedPrice: 78333,
      gotQty: null, gotPrice: null },
    { orderId: 'QB', lineId: 1, productId: 'P2', variantIdx: null, productName: 'Hinges',
      unit: 'Ctn', packUnit: '', clientName: 'Musa', qty: 2, expectedPrice: 300000,
      gotQty: null, gotPrice: null },
  ],
}, over);

/* ---------- 1. the worker's three acts ------------------------------- */
{
  const state = { collectionTrips: [trip()] };
  const { scope, toasts } = makeWorker(state);
  const tr = state.collectionTrips[0];

  // Accept.
  t.check(scope.acceptCollectionTrip('TRIP-1') === true, 'the assigned worker can accept the trip');
  t.check(tr.status === 'collecting' && !!tr.acceptedAt, 'which marks them as out, with a time');

  // Cannot hand in half-answered.
  t.check(scope.finishCollectionTrip('TRIP-1') === false, 'a half-answered trip cannot be handed in');
  t.check(/2 more line/.test(toasts[toasts.length - 1]) && /0 is an answer/.test(toasts[toasts.length - 1]),
    `and the worker is told how many are left, and that zero counts (${toasts[toasts.length - 1]})`);

  // Say what came back: one full, one short at a different price.
  t.check(scope.setTripLineGot('TRIP-1', 0, 6, 80000) === true, 'a line records what came back');
  t.check(scope.setTripLineGot('TRIP-1', 1, 0, '') === true,
    'and zero is recordable — none came is an answer, not a blank');
  t.check(tr.lines[0].gotQty === 6 && tr.lines[0].gotPrice === 80000,
    'the quantity and the price actually paid are both kept');
  /* A price left blank falls back to the expected one rather than to
     nothing, so checking in never creates an uncosted lot. */
  t.check(tr.lines[1].gotPrice === 300000,
    `a blank price falls back to what was expected (${tr.lines[1].gotPrice})`);

  t.check(scope.tripAllAnswered(tr) === true, 'every line answered, the trip can be handed in');
  t.check(scope.finishCollectionTrip('TRIP-1') === true && tr.status === 'collected',
    'and handing it in marks it collected');

  // The short line is visible as such.
  const short = scope.tripShortLines(tr);
  t.check(short.length === 1 && short[0].sent === 2 && short[0].got === 0,
    `the line that came back short carries both numbers (${JSON.stringify(short.map(s => [s.sent, s.got]))})`);
}

/* ---------- 2. what the worker cannot do ----------------------------- */
{
  const state = { collectionTrips: [trip({ assignedWorkerId: 'W9' })] };
  const { scope, toasts } = makeWorker(state);
  t.check(scope.acceptCollectionTrip('TRIP-1') === false && state.collectionTrips[0].status === 'assigned',
    'a trip assigned to somebody else cannot be accepted');
  t.check(/passed to somebody else/.test(toasts[0]), 'and says so rather than failing silently');

  const s2 = { collectionTrips: [trip({ status: 'open', assignedWorkerId: null })] };
  t.check(makeWorker(s2).scope.acceptCollectionTrip('TRIP-1') === false,
    'an unassigned trip is not acceptable either — the admin hands them out');

  /* Answered in full, so the only thing standing between this trip and a
     second hand-in is the status guard itself -- a fixture with blank
     lines would let the all-answered check mask a missing guard. */
  const answeredLines = [
    { orderId: 'QA', lineId: 1, productName: 'Tape Measure', qty: 6, expectedPrice: 78333, gotQty: 6, gotPrice: 78333 },
  ];
  const s3 = { collectionTrips: [trip({ status: 'collected', lines: answeredLines })] };
  t.check(makeWorker(s3).scope.finishCollectionTrip('TRIP-1') === false,
    'a trip already handed in cannot be handed in again');
  const s3b = { collectionTrips: [trip({ status: 'confirmed', lines: answeredLines })] };
  t.check(makeWorker(s3b).scope.finishCollectionTrip('TRIP-1') === false,
    'nor can a confirmed one be re-collected');
  /* Same masking risk on accept: give the stray-status trips the right
     worker, so only the status guard can refuse them. */
  const s3c = { collectionTrips: [trip({ status: 'collected', lines: answeredLines })] };
  t.check(makeWorker(s3c).scope.acceptCollectionTrip('TRIP-1') === false,
    'a collected trip cannot be re-accepted into collecting');
  const s3d = { collectionTrips: [trip({ status: 'open' })] };
  t.check(makeWorker(s3d).scope.acceptCollectionTrip('TRIP-1') === false
    && s3d.collectionTrips[0].status === 'open',
    'and an open one assigned to this worker by a half-written save stays open');

  // The list rules, directly.
  const sLists = { collectionTrips: [
    trip({ id: 'T-mine' }),
    trip({ id: 'T-other', assignedWorkerId: 'W9' }),
    trip({ id: 'T-done', status: 'confirmed', lines: [] }),
    trip({ id: 'T-void', voided: true }),
  ] };
  const wLists = makeWorker(sLists);
  t.check(wLists.scope.tripsForWorker('W1').map((x) => x.id).join(',') === 'T-mine',
    "a worker sees their own live trips and nobody else's");
  t.check(wLists.scope.tripIsLive(sLists.collectionTrips[2]) === false,
    'a confirmed trip is finished business, off every list');
  t.check(wLists.scope.tripIsLive(sLists.collectionTrips[3]) === false,
    'and a voided one is no business at all');
  t.check(wLists.scope.tripAllAnswered(trip({ lines: [] })) === false,
    'a trip with no lines is not "fully answered" — it is nothing to hand in');

  const s4 = { collectionTrips: [trip()] };
  const w4 = makeWorker(s4);
  t.check(w4.scope.setTripLineGot('TRIP-1', 0, -3, 100) === false
    && s4.collectionTrips[0].lines[0].gotQty === null,
    'a negative quantity is refused, not clamped into a claim');
  t.check(w4.scope.setTripLineGot('TRIP-1', 9, 5, 100) === false, 'and a line that does not exist is nothing');

  /* The boundary itself: nothing the worker app can reach touches stock.
     applyStockDelta is not even in scope here -- these functions compile
     without it, which is the strongest form of "does not call it". */
  SHARED_NAMES.forEach((n) => {
    t.check(!/applyStockDelta|receiveQuoteLine/.test(extractFunction(shared, n, 'shared-worker.js')),
      `${n} cannot move stock`);
  });
}

/* ---------- 3. the admin makes trips from the buying list ------------ */
{
  const state = { collectionTrips: [], savedQuotes: [] };
  const admin = compileScope(
    ['tripIsLive', 'tripLines', 'tripsCoveringLine', 'lineIsOnATrip']
      .map((n) => extractFunction(shared, n, 'shared-worker.js'))
      .concat([extractFunction(src, 'createCollectionTripFromRun', 'index.html')]),
    { data: state, quoteClientName: (q) => (q.client && q.client.name) || 'a client' },
    ['createCollectionTripFromRun', 'lineIsOnATrip'],
  );

  const runLine = (orderId, lineId, name, qty, cost) => ({
    order: { id: orderId, client: { name: 'Abraham' } },
    it: { lineId, productId: 'P1', variantIdx: 4, productName: name, unit: 'Dozen', packUnit: 'Ctn' },
    qty, unitCost: cost,
  });
  const run = { supplierId: 'S1', lines: [runLine('QA', 1, 'Tape Measure', 6, 78333), runLine('QB', 1, 'Hinges', 2, 300000)] };

  const made = admin.createCollectionTripFromRun(run);
  t.check(!!made && made.lines.length === 2 && made.status === 'open',
    `a run becomes an open trip carrying its lines (${made && made.lines.length})`);
  t.check(made.lines[0].qty === 6 && made.lines[0].expectedPrice === 78333,
    'each line carries what to fetch and what it should cost');
  t.check(made.lines[0].gotQty === null && made.lines[0].gotPrice === null,
    'with nothing yet claimed about what came back');
  t.check(made.lines[0].orderId === 'QA' && made.lines[0].lineId === 1,
    'and points back at the order line it is for');

  /* The dedupe: a line already on somebody's list is not put on a second
     one. Two people sent for the same carton both buy it. */
  const again = admin.createCollectionTripFromRun(run);
  t.check(again === null, 'making a trip twice from the same run yields nothing the second time');
  t.check(state.collectionTrips.length === 1, 'and no empty trip is left behind');
}

/* ---------- 4. confirming is the admin's, and is what receives ------- */
{
  const conf = extractFunction(src, 'confirmCollectionTrip', 'index.html');
  t.check(/receiveQuoteLine\(it, got, /.test(conf),
    'checking in routes every line through receiveQuoteLine — the same path as hand-receiving');
  /* One path, not two: a trip checked in and a line received by hand land
     in exactly the same state — stock in at what was paid, the line
     marked received, the supplier billed for what arrived. */
  t.check(/l\.gotPrice == null \? l\.expectedPrice : l\.gotPrice/.test(conf),
    'at the price the worker reported, falling back to the expected one');
  t.check(/if\(!\(got > 0\)\) return;/.test(conf),
    'a line that came back with nothing receives nothing');
  t.check(/if\(!it\)\{ missing\+\+; return; \}/.test(conf),
    'a line whose order was amended away is counted and reported, not silently dropped');
  t.check(/trip\.status = 'confirmed';/.test(conf) && /trip\.confirmedAt = /.test(conf),
    'and the trip is closed with a time');
  t.check(/if\(!trip \|\| trip\.status === 'confirmed'\) return null;/.test(conf),
    'a trip cannot be confirmed twice — that would shelve the goods twice');

  // The worker app cannot reach this: it lives in index.html only.
  t.check(!/function confirmCollectionTrip/.test(shared),
    'confirming does not exist in the worker app at all');
}

/* ---------- 5. the sync path ----------------------------------------- */
{
  t.check(/sel\('collection_trips'\)/.test(src), 'trips are loaded with everything else');
  t.check(/addDiffOps\(ops, 'collectionTrips', 'collection_trips', 'id', shopId, rows\.collectionTrips\);/.test(src),
    'and saved through the same diff writer as every other table');
  t.check(/collectionTrips: keyRowsById\(rows\.collectionTrips, 'id'\),/.test(src),
    'with a lastSynced snapshot so offline edits merge');
  /* The app deploys on a push; migrations are applied by hand. In the
     window between, the table does not exist -- and throwing there would
     take the whole shop down over a feature nothing else depends on. */
  t.check(/collectionTripsR && !collectionTripsR\.error && collectionTripsR\.data/.test(src),
    'a missing table reads as no trips, not as a failed boot');
  t.check(/collectionTrips:\[\],/.test(src), 'and an empty shop starts with none');

  const mig = read('supabase/migrations/0070_collection_trips.sql');
  t.check(/create table collection_trips/.test(mig), 'the migration creates the table');
  t.check(/'open','assigned','collecting','collected','confirmed'/.test(mig),
    'holding the same lifecycle the app walks');
  t.check(/owner only deletes/.test(mig),
    'with the same owner-only delete gate as every other data table');
}

/* ---------- 6. what the two surfaces show ---------------------------- */
{
  const bl = extractFunction(src, 'blRunTripsHTML', 'index.html');
  t.check(/tripIsLive\(t\) && String\(t\.supplierId\) === String\(run\.supplierId\)/.test(bl),
    'the buying list shows the live trips for the run being looked at');
  t.check(/data-confirm/.test(bl) && /data-assign/.test(bl),
    'with Assign on an open trip and Check in on a collected one');

  /* Scoped to the run header's own condition rather than searched
     file-wide, where createCollectionTripFromRun's dedupe filter carries
     the same words and would satisfy the check with the button's own
     guard deleted. */
  t.check(/r\.lines\.some\(l=> !l\.received && !lineIsOnATrip\(l\.order\.id, l\.it\.lineId\)\)/.test(src),
    'Send someone is offered only while something is not already on a list');

  const wv = extractFunction(shared, 'renderWorkerTrips', 'shared-worker.js');
  t.check(/if\(!wrap\) return;/.test(wv),
    'a host page that predates trips simply does not show them, rather than throwing');
  t.check(/tripsForWorker\(myStaff && myStaff\.id\)/.test(wv),
    'a worker sees their own trips and nobody else\'s');
  t.check(/data-accept/.test(wv) && /data-finish/.test(wv) && /wv-trip-line/.test(wv),
    'with accept, per-line answers, and hand-in');
  t.check(/\$\{answered < lines\.length \? 'disabled' : ''\}/.test(wv),
    'and hand-in stays disabled until every line is answered');
}

process.exit(t.done() ? 1 : 0);
