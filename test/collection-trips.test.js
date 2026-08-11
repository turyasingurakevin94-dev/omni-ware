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
  t.check(/r\.lines\.some\(l=> !l\.settled && !lineIsOnATrip\(l\.order\.id, l\.it\.lineId\)\)/.test(src),
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

/* ---------- 7. the standalone worker app carries trips --------------- */
/*
 * The first cut only worked inside the admin's Worker-view tab: the
 * standalone app never loaded collection_trips, so data.collectionTrips
 * was undefined, the trip card never rendered, and an accept tapped in a
 * market saved nothing. The whole feature, invisible exactly where it
 * was for.
 */
{
  const wsrc = read('worker.html');

  t.check(/sb\.from\('collection_trips'\)\.select\('\*'\)\.eq\('shop_id', shopId\)/.test(wsrc),
    'the worker app loads trips with everything else');
  t.check(/collectionTripsR && !collectionTripsR\.error && collectionTripsR\.data/.test(wsrc),
    'tolerating the table not existing yet, same as the admin');
  t.check(/collectionTrips: \(d\.collectionTrips\|\|\[\]\)\.map\(t=>\(\{/.test(wsrc),
    'and builds sync rows for them');

  /* The merge: this app saves from a snapshot that can be hours old, so
     it lays only what it owns onto the server's row. */
  const moves = (/const TRIP_WORKER_STATUS_MOVES = \{[\s\S]*?\};/.exec(wsrc) || [''])[0];
  t.check(/assigned: \['collecting'\]/.test(moves) && /collecting: \['collected'\]/.test(moves),
    'the worker may take a trip and bring it back, and nothing else');
  t.check(!/collected:/.test(moves.replace("collecting: ['collected']", '')),
    'confirming is not a move it can make');

  /* Run, not read. The assertion that mergeTripGot keys by order line
     used to be a regex over its source, which the Map it builds
     satisfies on its own -- so rewriting the lookup to go by index left
     the text intact and the test green. The only way to tell a key
     match from a position match is to hand it lines in a different
     order and look at where the answers land. */
  {
    const mergeScope = compileScope([extractFunction(wsrc, 'mergeTripGot', 'worker.html')], {}, ['mergeTripGot']);
    // The worker answered QA and QB; the admin has since reordered the
    // trip and added a third line.
    const local = [
      { orderId: 'QA', lineId: 1, qty: 6, gotQty: 6, gotPrice: 80000 },
      { orderId: 'QB', lineId: 1, qty: 2, gotQty: 0, gotPrice: null },
    ];
    const server = [
      { orderId: 'QB', lineId: 1, qty: 2 },
      { orderId: 'QC', lineId: 3, qty: 9 },
      { orderId: 'QA', lineId: 1, qty: 6 },
    ];
    const merged = mergeScope.mergeTripGot(server, local);
    t.check(merged.length === 3, 'the merge keeps the admin’s line list, not the snapshot’s');
    t.check(merged[0].gotQty === 0 && merged[2].gotQty === 6 && merged[2].gotPrice === 80000,
      `each answer follows its own order line across a reorder (${JSON.stringify(merged.map(m => m.gotQty))})`);
    t.check(merged[1].gotQty === undefined,
      'and a line the worker never saw is left unanswered, not handed somebody else’s count');
  }

  const mergeTrips = extractFunction(wsrc, 'mergeTripsOntoServerRows', 'worker.html');
  t.check(/moves\.includes\(local\.status\) \? local\.status : server\.status/.test(mergeTrips),
    'a stale status cannot drag a trip backward');
  t.check(/lines: mergeTripGot\(server\.lines, local\.lines\)/.test(mergeTrips),
    "and the admin's idea of what to fetch always wins over the snapshot");

  const save = extractFunction(wsrc, 'saveData', 'worker.html');
  t.check(/addDiffOps\(ops, 'collectionTrips', 'collection_trips', 'id', shopId, rows\.collectionTrips, \{neverDelete:true\}\)/.test(save),
    'trips ride the same save, and this app can never delete one');
  t.check(/rows\.collectionTrips = \[\];/.test(save),
    'a missing table drops the trip ops, not the pick save they ride with');

  /* The refresh guard. A worker who has just typed "5 of 6 at 80,000"
     must not have it swapped out from under them by the poll. */
  {
    const runUnsaved = (dataState, synced) => compileScope(
      [extractFunction(wsrc, 'hasUnsavedWork', 'worker.html')],
      { currentShopId: 'SHOP', data: dataState, lastSynced: synced, WORKER_OWNED_KEYS: [] },
      ['hasUnsavedWork'],
    ).hasUnsavedWork();

    const synced = (over) => ({ collectionTrips: { 'TRIP-1': Object.assign({
      id: 'TRIP-1', status: 'collecting',
      lines: [{ orderId: 'QA', lineId: 1, gotQty: null, gotPrice: null }],
    }, over) } });
    const live = (over) => ({ savedQuotes: [], collectionTrips: [Object.assign({
      id: 'TRIP-1', status: 'collecting',
      lines: [{ orderId: 'QA', lineId: 1, gotQty: null, gotPrice: null }],
    }, over)] });

    t.check(runUnsaved(live(), synced()) === false,
      'a trip that matches what was sent is not unsaved work');
    t.check(runUnsaved(live({ lines: [{ orderId: 'QA', lineId: 1, gotQty: 5, gotPrice: 80000 }] }), synced()) === true,
      'but a delivery just typed in holds the refresh off, exactly as an unsaved pick does');
    t.check(runUnsaved(live({ status: 'collected' }), synced()) === true,
      'and so does a hand-in that has not reached the server');
    /* A trip this app has never synced would otherwise read as unsaved
       forever, holding off every refresh -- the exact failure the picks
       guard above already had to be fixed for once. */
    t.check(runUnsaved(live({ id: 'TRIP-NEW' }), synced()) === false,
      'while a trip this app never synced is not its work to protect');
  }

  // And every lastSynced snapshot carries trips, or the diff would read
  // the missing key as "delete everything".
  const snapshots = (wsrc.match(/keyRowsById\((?:rows0|freshRows)\.collectionTrips, 'id'\)/g) || []).length;
  t.check(snapshots === 2, `both lastSynced sites snapshot trips (${snapshots})`);
}

/* ---------- 8. assigning is a modal, not a numbered prompt ----------- */
{
  const fn = extractFunction(src, 'openAssignTripModal', 'index.html');
  /* Widened in section 10 below: a trip handed out but not yet accepted
     can still be passed on, since nobody has gone anywhere. The narrow
     'open' check this used to pin is now one half of that condition. */
  t.check(/trip\.status !== 'open' && trip\.status !== 'assigned'/.test(fn),
    'a trip somebody is already out on cannot be assigned');
  t.check(/filter\(s=> !s\.unavailable/.test(fn),
    'to somebody actually available');
  t.check(/pendingAssign = null;/.test(fn),
    'without tripping the order-stage flow that shares the modal');
  t.check(/trip\.status = 'assigned';[\s\S]*?trip\.assignedAt = /.test(fn),
    'and picking a row assigns with a timestamp');
  t.check(/openAssignTripModal\(btn\.dataset\.assign\)/.test(src) && !/const pick = prompt\(/.test(src),
    'the buying list opens it, and the numbered prompt is gone');
}

/* ---------- 9. the way out ------------------------------------------- */
/*
 * `voided` sat in the table and in tripIsLive from the first commit, and
 * nothing ever wrote it. A trip made by mistake, or handed to somebody
 * who then left the shop, stayed live for good -- and because
 * lineIsOnATrip counts a live trip, every line on it was unsendable, so
 * "Send someone" stayed hidden for that whole run. The only way left to
 * get those goods on the shelf was to receive them by hand.
 */
{
  const adminNames = ['voidCollectionTrip', 'releaseTripsForStaff'];
  const make = (state) => compileScope(
    [...adminNames.map((n) => extractFunction(src, n, 'index.html')),
      extractFunction(shared, 'tripIsLive', 'shared-worker.js')],
    { data: state }, [...adminNames, 'tripIsLive'],
  );

  // Calling one off.
  const s = { collectionTrips: [trip({ status: 'assigned' })] };
  const sc = make(s);
  t.check(sc.voidCollectionTrip('TRIP-1') === true && s.collectionTrips[0].voided === true,
    'a trip can be called off');
  t.check(sc.tripIsLive(s.collectionTrips[0]) === false,
    'which takes it off every list — so its lines are sendable again');
  t.check(sc.voidCollectionTrip('TRIP-1') === false,
    'and calling off what is already called off changes nothing');

  /* A confirmed trip's goods are on the shelf and its supplier is
     billed. Hiding that record would leave stock nothing accounts for,
     so the way back is undoing the receipts, not voiding the journey. */
  const done = { collectionTrips: [trip({ status: 'confirmed' })] };
  t.check(make(done).voidCollectionTrip('TRIP-1') === false && !done.collectionTrips[0].voided,
    'a trip already checked in cannot be called off');

  /* voided_at is not a column in 0070, so writing one would put a field
     in memory that looks like a record until the next refresh drops it. */
  const fn = extractFunction(src, 'voidCollectionTrip', 'index.html');
  t.check(!/voidedAt/.test(fn),
    'and nothing is recorded that the table has nowhere to put');

  /* The control itself. A model that can call a trip off with no button
     to reach it is the same dead end as having no model at all -- and
     nothing here noticed until a mutant deleted the button and every
     test still passed. Offered on EVERY live trip, whatever its state,
     because the trip that most needs calling off is the one nobody is
     going to finish. */
  t.check(/data-void="\$\{esc\(t\.id\)\}"/.test(src) && /Call off<\/button>/.test(src),
    'the strip offers a way to call one off');
  t.check(/#buyingListBody \[data-void\]/.test(src) && /voidCollectionTrip\(trip\.id\)/.test(src),
    'and it is wired to the model rather than being decoration');
  /* Confirmed first, naming what happens: somebody may already be on
     their way, and the lines returning to the list is the easy part to
     miss. */
  const wire = extractFunction(src, 'wireBuyingListReceiving', 'index.html');
  t.check(/if\(!confirm\(`Call off the trip to \$\{supplierName\(trip\.supplierId\)\}/.test(wire),
    'asking before it happens, naming the supplier');
  t.check(/back on the buying list/.test(wire) && /is no longer going/.test(wire),
    'and saying both of the things that change');
  // "1 line go back" was what the first draft actually printed.
  t.check(/n===1\?'goes':'go'/.test(wire),
    'in English that survives a single line');

  // Losing the worker.
  const gone = { collectionTrips: [
    trip({ id: 'T-theirs', status: 'collecting', assignedWorkerId: 'W1',
      lines: [{ orderId: 'QA', lineId: 1, qty: 6, expectedPrice: 78333, gotQty: 6, gotPrice: 80000 }] }),
    trip({ id: 'T-else', status: 'assigned', assignedWorkerId: 'W9' }),
    trip({ id: 'T-done', status: 'confirmed', assignedWorkerId: 'W1' }),
  ] };
  const gc = make(gone);
  t.check(gc.releaseTripsForStaff('W1') === 1, 'deleting a worker releases the trip they were out on');
  const [theirs, other, finished] = gone.collectionTrips;
  t.check(theirs.status === 'open' && theirs.assignedWorkerId === null,
    'back on the list for somebody else, rather than stranded pointing at a ghost');
  t.check(theirs.voided !== true,
    'and NOT voided — the job still needs doing');
  /* They may well have collected before they left, and somebody will
     want to know what they said. */
  t.check(theirs.lines[0].gotQty === 6 && theirs.lines[0].gotPrice === 80000,
    'whatever they already reported is kept');
  t.check(theirs.assignedAt === null && theirs.acceptedAt === null,
    'while the times that belonged to their run are cleared');
  t.check(other.assignedWorkerId === 'W9' && finished.assignedWorkerId === 'W1',
    'somebody else’s trip and a finished one are both left alone');

  // deleteStaff has to actually call it, and say so first.
  const del = extractFunction(src, 'deleteStaff', 'index.html');
  t.check(/const releasedTrips = releaseTripsForStaff\(id\);/.test(del),
    'deleteStaff releases them');
  t.check(/tripIsLive\(t\) && String\(t\.assignedWorkerId\) === String\(id\)/.test(del)
    && /collection trip\$\{trips\.length===1\?'':'s'\}/.test(del),
    'and the warning says how many before anything is deleted');
  /* Built from what happened, not templated around orders: a worker out
     collecting and picking nothing used to be reported as "0 orders and
     1 trip released". */
  t.check(/releasing\.length \? `\$\{releasing\.length\} order/.test(del)
    && /\.filter\(Boolean\)/.test(del) && /freed\.join\(' and '\)/.test(del),
    'and what was freed is named only where there is something to name');
}

/* ---------- 10. handing a trip on ------------------------------------ */
{
  const fn = extractFunction(src, 'openAssignTripModal', 'index.html');
  t.check(/trip\.status !== 'open' && trip\.status !== 'assigned'/.test(fn),
    'a trip handed out but not yet accepted can still go to somebody else — nobody has moved');
  t.check(/trip\.voided/.test(fn),
    'a called-off trip cannot be assigned');
  t.check(/String\(s\.id\) !== String\(trip\.assignedWorkerId\)/.test(fn),
    'and the person already holding it is not offered as the new one');
  // Once they are out with the shop's money it is a phone call, not a button.
  t.check(/t\.status==='assigned' \? `<button type="button" class="bl-trip-act" data-assign=/.test(src)
    && !/t\.status==='collecting' \? `<button type="button" class="bl-trip-act" data-assign=/.test(src),
    'the button is offered before they accept and withdrawn once they are out');
}

process.exit(t.done() ? 1 : 0);
