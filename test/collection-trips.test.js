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
  /* Widened from refusing only `confirmed` to admitting only
     `collected`, which is the one state where somebody has come back
     and every line has been answered.

     The old rule let a trip nobody had reported on be checked in: every
     line was skipped for having no answer, so it received nothing,
     marked itself confirmed and left every list -- the journey silently
     stopped existing while the goods were still in the supplier's shop.
     The lines did return to the buying list, so it was recoverable, but
     the only sign was a "0 items received" that read like a delivery of
     nothing. Only the button's own gating had ever prevented it. */
  t.check(/if\(!trip \|\| trip\.voided \|\| trip\.status !== 'collected'\) return null;/.test(conf),
    'only a trip somebody has come back from can be checked in — and never twice');

  // Run, since that is the claim.
  const confirmables = ['open', 'assigned', 'collecting', 'collected', 'confirmed'].map((status) => {
    const st = { collectionTrips: [trip({ status, lines: [
      { orderId: 'QA', lineId: 1, qty: 6, expectedPrice: 78333, gotQty: 6, gotPrice: 80000 },
    ] })], savedQuotes: [] };
    const sc = compileScope(
      [extractFunction(src, 'confirmCollectionTrip', 'index.html'),
        extractFunction(shared, 'tripLines', 'shared-worker.js'),
        extractFunction(shared, 'tripLineGot', 'shared-worker.js')],
      { data: st, receiveQuoteLine: (it, n) => n, supplierName: () => 'Shafik' },
      ['confirmCollectionTrip'],
    );
    return `${status}:${sc.confirmCollectionTrip('TRIP-1') ? 'yes' : 'no'}`;
  }).join(' ');
  t.check(confirmables === 'open:no assigned:no collecting:no collected:yes confirmed:no',
    `checking in is offered from exactly one state (${confirmables})`);

  const voided = { collectionTrips: [trip({ status: 'collected', voided: true })], savedQuotes: [] };
  t.check(compileScope(
    [extractFunction(src, 'confirmCollectionTrip', 'index.html'),
      extractFunction(shared, 'tripLines', 'shared-worker.js'),
      extractFunction(shared, 'tripLineGot', 'shared-worker.js')],
    { data: voided, receiveQuoteLine: (it, n) => n, supplierName: () => 'Shafik' },
    ['confirmCollectionTrip'],
  ).confirmCollectionTrip('TRIP-1') === null,
    'and a trip called off after it came back cannot be checked in behind the call-off');

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
  /* pendingAssign is gone with the order-stage flow that owned it. The
     two forward steps that used to open this modal ask for nobody now: a
     picker takes the next order from the queue on their phone, and an
     order goes out on "Loaded, it has gone" with the carrier named in the
     row. A trip is the one thing left that is assigned from a modal, so
     the modal has one caller and nothing to be tripped up by. */
  t.check(!/pendingAssign/.test(src),
    'and nothing is left of the order-stage flow that used to share this modal');
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

/* ---------- 11. a trip whose reason left the board ------------------- */
/*
 * The trip strips hang off the buying list's runs, and the runs are
 * built from the orders being prepared. So stepping an order back to
 * Draft while somebody was out took its supplier's run away and the trip
 * with it -- while tripIsLive still held, so lineIsOnATrip still locked
 * the line and no second trip could be made for it either.
 *
 * Kevin standing in the shop with three hundred thousand shillings of
 * hinges, and nowhere in the app to check them in, call the trip off, or
 * send anybody again. The same one-way door voiding was built to open,
 * reached this time by an entirely ordinary action rather than a
 * mistake: a trip is a job in flight and a person out of the building,
 * and it does not stop existing because the reason for it changed.
 */
{
  const fn = extractFunction(src, 'blStrandedTripsHTML', 'index.html');
  t.check(/tripIsLive\(t\) && !onBoard\.has\(String\(t\.supplierId\)\)/.test(fn),
    'live trips with no run of their own are listed anyway');
  t.check(/blRunTripsHTML\(\{ supplierId: sid \}\)/.test(fn),
    'through the same strip, so they carry the same Assign, Check in and Call off');
  // A finished or called-off trip is not stranded, it is done.
  t.check(/tripIsLive\(t\)/.test(fn) && !/t\.status !== 'confirmed'/.test(fn),
    'while a confirmed or called-off one is simply finished, not stranded');
  t.check(/\$\{blStrandedTripsHTML\(runs\)\}/.test(src),
    'and the buying list renders them');

  // Run it: one trip to a supplier the board no longer mentions.
  const state = { collectionTrips: [
    trip({ id: 'T-live', supplierId: 'S9', status: 'collected' }),
    trip({ id: 'T-onboard', supplierId: 'S1' }),
    trip({ id: 'T-done', supplierId: 'S8', status: 'confirmed' }),
    trip({ id: 'T-off', supplierId: 'S7', voided: true }),
  ] };
  const scope = compileScope([
    extractFunction(shared, 'tripIsLive', 'shared-worker.js'),
    extractFunction(shared, 'tripLines', 'shared-worker.js'),
    extractFunction(shared, 'tripShortLines', 'shared-worker.js'),
    extractFunction(shared, 'tripLineGot', 'shared-worker.js'),
    extractFunction(src, 'blRunTripsHTML', 'index.html'),
    extractFunction(src, 'blStrandedTripsHTML', 'index.html'),
    // blRunTripsHTML asks these who is carrying the trip and whether it
    // can be checked in, so the scope has to hold them too.
    extractDeclaration(src, 'TRIP_SUPPLIER_CARRIER', 'index.html'),
    extractFunction(src, 'tripIsSupplierDelivered', 'index.html'),
    extractFunction(src, 'tripCarrierLabel', 'index.html'),
    extractFunction(src, 'tripStatusLabel', 'index.html'),
    extractFunction(src, 'tripCanCheckIn', 'index.html'),
    extractFunction(shared, 'quoteLineReceived', 'shared-worker.js'),
    extractFunction(shared, 'quoteLineShortfall', 'shared-worker.js'),
    extractFunction(shared, 'orderLineIsBoughtIn', 'shared-worker.js'),
    extractFunction(src, 'tripGoodsAllIn', 'index.html'),
  ], {
    data: state, esc: (s) => String(s), ICON_WARN: '', ICON_TRUCK: '',
    // Stubbed: what is worth asking this supplier about is the price
    // review's business, pinned in price-registry-freshness.test.js.
    supplierAskList: () => [],
    staffName: () => 'Kevin Moses', supplierName: (id) => `Supplier ${id}`,
    TRIP_STATUS_LABELS: { open: 'To send', assigned: 'Sent', collecting: 'Out collecting', collected: 'Back — to check in' },
  }, ['blStrandedTripsHTML']);

  const html = scope.blStrandedTripsHTML([{ supplierId: 'S1' }]);
  t.check(/T-live/.test(html), 'the trip whose order left the board is shown');
  t.check(!/T-onboard/.test(html), 'the one still under its own run is not repeated');
  t.check(!/T-done/.test(html) && !/T-off/.test(html),
    'and neither a finished trip nor a called-off one is dragged back');
  t.check(/data-confirm="T-live"/.test(html) && /data-void="T-live"/.test(html),
    'with the goods checkable in and the trip callable off from there');
  t.check(/1 collection still out/.test(html),
    `counted in the heading (${(/(\d+) collection/.exec(html) || [])[0]})`);

  // Nothing stranded, nothing said.
  t.check(scope.blStrandedTripsHTML([{ supplierId: 'S9' }, { supplierId: 'S1' }]) === '',
    'and the whole section is absent when every live trip has a run');

  /* Ids compared as strings, the way every other id comparison in this
     codebase is. A run carrying a number and a trip carrying the same id
     as text is the same supplier, and matching by identity would call it
     stranded while its own run sat directly above -- the trip listed
     twice, and an amber panel saying somebody is out when nobody is. */
  const mixed = { collectionTrips: [trip({ id: 'T-num', supplierId: '5' })] };
  const mixedScope = compileScope([
    extractFunction(shared, 'tripIsLive', 'shared-worker.js'),
    extractFunction(shared, 'tripLines', 'shared-worker.js'),
    extractFunction(shared, 'tripShortLines', 'shared-worker.js'),
    extractFunction(shared, 'tripLineGot', 'shared-worker.js'),
    extractFunction(src, 'blRunTripsHTML', 'index.html'),
    extractFunction(src, 'blStrandedTripsHTML', 'index.html'),
    // blRunTripsHTML asks these who is carrying the trip and whether it
    // can be checked in, so the scope has to hold them too.
    extractDeclaration(src, 'TRIP_SUPPLIER_CARRIER', 'index.html'),
    extractFunction(src, 'tripIsSupplierDelivered', 'index.html'),
    extractFunction(src, 'tripCarrierLabel', 'index.html'),
    extractFunction(src, 'tripStatusLabel', 'index.html'),
    extractFunction(src, 'tripCanCheckIn', 'index.html'),
    extractFunction(shared, 'quoteLineReceived', 'shared-worker.js'),
    extractFunction(shared, 'quoteLineShortfall', 'shared-worker.js'),
    extractFunction(shared, 'orderLineIsBoughtIn', 'shared-worker.js'),
    extractFunction(src, 'tripGoodsAllIn', 'index.html'),
  ], {
    data: mixed, esc: (s) => String(s), ICON_WARN: '', ICON_TRUCK: '',
    supplierAskList: () => [],
    staffName: () => 'Kevin Moses', supplierName: (id) => `Supplier ${id}`,
    TRIP_STATUS_LABELS: { assigned: 'Sent' },
  }, ['blStrandedTripsHTML']);
  t.check(mixedScope.blStrandedTripsHTML([{ supplierId: 5 }]) === '',
    'so a run whose id is a number covers a trip whose id is the same digits as text');
}

/* ---------- when the supplier brings it themselves -------------------
 *
 * Not every journey is one of ours to make. A supplier who delivers
 * removes the errand, but the goods are still in motion and the lines
 * are still spoken for -- so it is the same TRIP, checked in against
 * what was expected exactly as a collected one is, carrying a sentinel
 * where a staff id would go instead of growing a parallel lifecycle
 * beside it.
 *
 * WHAT MUST NOT HAPPEN is a worker ever seeing it. tripsForWorker
 * matches on a real staff id, so a sentinel matches nobody -- and that
 * is asserted here rather than assumed, because the day it stops being
 * true is the day somebody is sent to fetch what is already being
 * brought to the door.
 */
{
  const NAMES = ['tripIsSupplierDelivered', 'tripCarrierLabel', 'tripStatusLabel',
    'tripCanCheckIn', 'createCollectionTripFromRun'];
  const state = { collectionTrips: [] };
  const admin = compileScope([
    extractDeclaration(src, 'TRIP_SUPPLIER_CARRIER', 'index.html'),
    extractDeclaration(shared, 'TRIP_STATUS_LABELS', 'shared-worker.js'),
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
    extractFunction(shared, 'tripsForWorker', 'shared-worker.js'),
    extractFunction(shared, 'tripIsLive', 'shared-worker.js'),
    extractFunction(shared, 'lineIsOnATrip', 'shared-worker.js'),
    extractFunction(shared, 'tripsCoveringLine', 'shared-worker.js'),
    extractFunction(shared, 'tripLines', 'shared-worker.js'),
  ], {
    data: state,
    staffName: (id) => `Staff ${id}`,
    quoteClientName: () => 'A client',
  }, NAMES.concat(['tripsForWorker', 'lineIsOnATrip']));

  const run = { supplierId: 'S1', lines: [
    { order: { id: 1 }, it: { lineId: 'L1', productId: 'P1', productName: 'Hinges', unit: 'Ctn' }, qty: 3, unitCost: 1000 },
  ] };

  const ours = admin.createCollectionTripFromRun(run);
  state.collectionTrips = [];
  const theirs = admin.createCollectionTripFromRun(run, { supplierDelivers: true });

  /* The two differ in exactly one thing -- who is carrying it. */
  t.check(ours.assignedWorkerId === null && ours.status === 'open',
    'a trip of ours starts unassigned and waiting to be sent');
  t.check(theirs.assignedWorkerId === '__supplier__',
    'a supplier delivery carries the sentinel where a staff id would go');
  t.check(theirs.status === 'collecting',
    'and starts already in motion — there is no "to send" for a journey nobody here is making');
  t.check(theirs.lines.length === ours.lines.length,
    'the lines are the same either way, so the goods are checked in against the same expectation');

  t.check(admin.tripIsSupplierDelivered(theirs) && !admin.tripIsSupplierDelivered(ours),
    'the two are told apart by the carrier, not by the status');
  t.check(admin.tripCarrierLabel(theirs) === 'Supplier delivering',
    `and the sentinel is never printed raw (${admin.tripCarrierLabel(theirs)})`);
  t.check(admin.tripCarrierLabel(ours) === 'nobody yet',
    'while one of ours with nobody on it still says so');
  t.check(admin.tripCarrierLabel({ assignedWorkerId: 'W1' }) === 'Staff W1',
    'and a real worker is still named');

  t.check(admin.tripStatusLabel(theirs) === 'On its way here',
    `"Out collecting" is false when nobody of ours went out (${admin.tripStatusLabel(theirs)})`);
  t.check(admin.tripStatusLabel({ ...ours, status: 'collecting' }) === 'Out collecting',
    'but it is still the right words for a trip somebody is actually on');

  /* Check-in: a worker has to say they are back first, a supplier
     delivery announces itself by arriving. */
  /* REVERSED, and the old assertion was defending a bug I shipped.
     "A supplier delivery can be checked in the moment it lands" sounds
     right and is not: check-in reads each line's ANSWER and shelves that
     many, and a supplier delivery has no worker to give those answers --
     so it counted nothing. Worse, confirmCollectionTrip refuses any trip
     that is not `collected`, which a supplier delivery never is, so the
     button did nothing at all. Reported from the shop as "Check in 0
     lines from Dooba Enterprises Ltd", with OK doing nothing.

     Its goods go on the shelf line by line through the ordinary Receive
     control, and the trip closes itself when the last one is in. */
  t.check(!admin.tripCanCheckIn(theirs),
    'a supplier delivery is never "ready to check in" — it has no answers to check');
  t.check(!admin.tripCanCheckIn({ ...theirs, status: 'collecting' })
    && !admin.tripCanCheckIn({ ...theirs, status: 'assigned' })
    && !admin.tripCanCheckIn({ ...theirs, status: 'open' }),
    'in any state it can be in');
  t.check(!admin.tripCanCheckIn({ ...ours, status: 'collecting' }),
    'one of ours cannot, until whoever is out says they are back');
  t.check(admin.tripCanCheckIn({ ...ours, status: 'collected' }),
    'which is what "collected" means');

  /* The one that matters.

     tripsForWorker takes ONE argument and reads data.collectionTrips
     itself. Called with two, it filtered against an array and returned
     nothing -- so "no worker is ever offered a supplier delivery" passed
     while proving nothing at all. The second assertion is what caught
     it: a check that must find something is the one that tells you the
     first check was looking. */
  state.collectionTrips = [theirs];
  t.check(admin.tripsForWorker('W1').length === 0,
    'no worker is ever offered a supplier delivery');
  t.check(admin.tripsForWorker('__supplier__').length === 1,
    'and the sentinel is only ever matched by itself, so the filter is doing real work');
  state.collectionTrips = [ours];
  t.check(admin.tripsForWorker('W1').length === 0 && admin.tripsForWorker(null).length === 1,
    'while an unassigned trip of ours is still nobody’s until it is handed out');
  t.check(admin.lineIsOnATrip(1, 'L1'),
    'its lines are spoken for, so nobody is sent for what is already coming');

  /* And the strip itself. Everything above is arithmetic; this is what
     the admin can actually press, which is where "no worker is offered
     it" either holds or quietly stops holding. */
  const stripState = { collectionTrips: [] };
  const strip = compileScope([
    extractFunction(shared, 'tripIsLive', 'shared-worker.js'),
    extractFunction(shared, 'tripLines', 'shared-worker.js'),
    extractFunction(shared, 'tripShortLines', 'shared-worker.js'),
    extractFunction(shared, 'tripLineGot', 'shared-worker.js'),
    extractDeclaration(src, 'TRIP_SUPPLIER_CARRIER', 'index.html'),
    extractFunction(src, 'tripIsSupplierDelivered', 'index.html'),
    extractFunction(src, 'tripCarrierLabel', 'index.html'),
    extractFunction(src, 'tripStatusLabel', 'index.html'),
    extractFunction(src, 'tripCanCheckIn', 'index.html'),
    // blRunTripsHTML asks this whether a worker's trip is already home.
    extractFunction(shared, 'quoteLineReceived', 'shared-worker.js'),
    extractFunction(shared, 'quoteLineShortfall', 'shared-worker.js'),
    extractFunction(shared, 'orderLineIsBoughtIn', 'shared-worker.js'),
    extractFunction(src, 'tripGoodsAllIn', 'index.html'),
    extractFunction(src, 'blRunTripsHTML', 'index.html'),
  ], {
    data: stripState, esc: (s) => String(s), ICON_TRUCK: '', staffName: () => 'Kevin',
    supplierAskList: () => [],
    supplierName: () => 'Shafik Katwe',
    TRIP_STATUS_LABELS: { open: 'To send', assigned: 'Sent', collecting: 'Out collecting', collected: 'Back — to check in' },
  }, ['blRunTripsHTML']);

  stripState.collectionTrips = [theirs];
  const theirHTML = strip.blRunTripsHTML({ supplierId: 'S1' });
  t.check(!/data-assign=/.test(theirHTML),
    'the strip offers no way to hand a supplier delivery to a worker — that would send somebody for what is already coming');
  t.check(!/data-confirm=/.test(theirHTML),
    'the strip offers no Check in either — an inert button is worse than none');
  t.check(/Receive each line below as it arrives/.test(theirHTML),
    'and says where its goods are actually recorded instead');
  t.check(/data-void=/.test(theirHTML), 'and called off, like any other trip');
  t.check(/Supplier delivering/.test(theirHTML) && !/__supplier__/.test(theirHTML),
    'and it names the carrier in words, never as the sentinel');

  stripState.collectionTrips = [{ ...ours, status: 'open' }];
  t.check(/data-assign=/.test(strip.blRunTripsHTML({ supplierId: 'S1' })),
    'while one of ours still offers Assign, so the guard tells the two apart rather than hiding the button for everyone');

  /* The guard is checked in the statuses where Assign WOULD otherwise be
     drawn. A supplier trip is created as 'collecting', where no trip of
     any kind offers Assign -- so testing it there proved nothing, and
     the guard could be deleted with every check still green. It exists
     to hold whatever status a supplier delivery ends up in, so that is
     what is asked of it. */
  ['open', 'assigned'].forEach((status) => {
    stripState.collectionTrips = [{ ...theirs, status }];
    t.check(!/data-assign=/.test(strip.blRunTripsHTML({ supplierId: 'S1' })),
      `a supplier delivery sitting at "${status}" still offers nobody of ours to send`);
  });

  /* The button that starts it, and what it starts. Source-read, because
     the run head is built inside the buying list render. */
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/data-bringing="\$\{esc\(r\.supplierId\)\}"/.test(code),
    'the run head offers "they’re delivering" beside "send someone"');
  t.check(/createCollectionTripFromRun\(run, \{supplierDelivers:true\}\)/.test(code),
    'and pressing it makes a SUPPLIER trip — an ordinary one would put the run straight back on the send-somebody list');

  /* ---- and the journey ends when the goods are here ---- */
  /*
   * The half that was missing. A worker's trip is retired by handing it
   * in; a supplier delivery has nobody to hand it in, so without this it
   * would sit on the list claiming to be on its way long after the van
   * had gone -- and its lines would stay spoken for, so nobody could be
   * sent for anything that never turned up.
   */
  const closeState = { collectionTrips: [], savedQuotes: [] };
  const closeScope = compileScope([
    extractFunction(shared, 'tripIsLive', 'shared-worker.js'),
    extractFunction(shared, 'tripLines', 'shared-worker.js'),
    extractFunction(shared, 'orderLineIsBoughtIn', 'shared-worker.js'),
    extractFunction(shared, 'quoteLineReceived', 'shared-worker.js'),
    extractFunction(shared, 'quoteLineShortfall', 'shared-worker.js'),
    extractDeclaration(src, 'TRIP_SUPPLIER_CARRIER', 'index.html'),
    extractFunction(src, 'tripIsSupplierDelivered', 'index.html'),
    // The auto-close asks the same "has it all arrived?" question the
    // strip asks, so the two can never disagree about what arrived means.
    extractFunction(src, 'tripGoodsAllIn', 'index.html'),
    extractFunction(src, 'closeArrivedSupplierTrips', 'index.html'),
  ], { data: closeState }, ['closeArrivedSupplierTrips', 'tripGoodsAllIn']);

  const mkOrder = (over) => ({ id: 7, items: [
    { lineId: 'A', supplierId: 'S1', qty: 10 }, { lineId: 'B', supplierId: 'S1', qty: 5 },
  ], ...over });
  const mkTrip = (over) => ({ id: 'T', supplierId: 'S1', status: 'collecting',
    assignedWorkerId: '__supplier__', voided: false,
    lines: [{ orderId: 7, lineId: 'A' }, { orderId: 7, lineId: 'B' }], ...over });

  // Nothing received yet.
  closeState.savedQuotes = [mkOrder()];
  closeState.collectionTrips = [mkTrip()];
  t.check(closeScope.closeArrivedSupplierTrips() === 0
    && closeState.collectionTrips[0].status === 'collecting',
    'a delivery with nothing received yet stays open');

  // Half received is still half out.
  closeState.savedQuotes = [mkOrder({ items: [
    { lineId: 'A', supplierId: 'S1', qty: 10, receivedAt: 'x', receivedQty: 10 },
    { lineId: 'B', supplierId: 'S1', qty: 5 },
  ] })];
  closeState.collectionTrips = [mkTrip()];
  t.check(closeScope.closeArrivedSupplierTrips() === 0,
    'and one line in is not the van emptied');

  // A line that came SHORT is not a line that arrived.
  closeState.savedQuotes = [mkOrder({ items: [
    { lineId: 'A', supplierId: 'S1', qty: 10, receivedAt: 'x', receivedQty: 10 },
    { lineId: 'B', supplierId: 'S1', qty: 5, receivedAt: 'x', receivedQty: 2 },
  ] })];
  closeState.collectionTrips = [mkTrip()];
  t.check(closeScope.closeArrivedSupplierTrips() === 0,
    'a line three short of what was ordered keeps the delivery open — the rest is still owed');

  // Everything in.
  closeState.savedQuotes = [mkOrder({ items: [
    { lineId: 'A', supplierId: 'S1', qty: 10, receivedAt: 'x', receivedQty: 10 },
    { lineId: 'B', supplierId: 'S1', qty: 5, receivedAt: 'x', receivedQty: 5 },
  ] })];
  closeState.collectionTrips = [mkTrip()];
  t.check(closeScope.closeArrivedSupplierTrips() === 1
    && closeState.collectionTrips[0].status === 'confirmed'
    && !!closeState.collectionTrips[0].confirmedAt,
    'the last line in closes the delivery, with the time it happened');

  /* A worker's trip is closed by confirmCollectionTrip, which is also
     what puts its goods on the shelf. This must never touch one, or a
     journey would be retired without its goods ever being shelved. */
  closeState.collectionTrips = [mkTrip({ assignedWorkerId: 'W1' })];
  t.check(closeScope.closeArrivedSupplierTrips() === 0
    && closeState.collectionTrips[0].status === 'collecting',
    'and a worker’s trip is never closed this way, however much of it has arrived');

  /* A delivery already closed is not closed again. Without the liveness
     test it would be re-confirmed on every later receipt, moving the
     time it happened forward each time -- so the record of when the
     goods actually arrived would drift to whenever the shop last took a
     delivery from anybody. */
  closeState.savedQuotes = [mkOrder({ items: [
    { lineId: 'A', supplierId: 'S1', qty: 10, receivedAt: 'x', receivedQty: 10 },
    { lineId: 'B', supplierId: 'S1', qty: 5, receivedAt: 'x', receivedQty: 5 },
  ] })];
  closeState.collectionTrips = [mkTrip({ status: 'confirmed', confirmedAt: '2026-08-01T09:00:00Z' })];
  t.check(closeScope.closeArrivedSupplierTrips() === 0,
    'a delivery already checked in is not counted again');
  t.check(closeState.collectionTrips[0].confirmedAt === '2026-08-01T09:00:00Z',
    'and the time it actually arrived is not moved forward');

  /* An empty one never closes on its own, because `every` over nothing
     is true -- a trip made with no lines would confirm itself the
     instant anybody received anything, anywhere. */
  closeState.collectionTrips = [mkTrip({ lines: [] })];
  t.check(closeScope.closeArrivedSupplierTrips() === 0
    && closeState.collectionTrips[0].status === 'collecting',
    'and a delivery carrying nothing does not declare itself arrived');

  // Called where the goods actually land.
  t.check(/const closed = closeArrivedSupplierTrips\(\);/.test(code),
    'the receive handler closes whatever that delivery completed');

  /* ---- a worker's trip whose goods arrived another way ---- */
  /*
   * Seen on the shop's own screen: Kevin's trip reading "Sent · Kevin
   * Moses · 2 lines" with both of those lines showing "40 received" and
   * "paid" underneath it. The lines had been taken in at the counter
   * rather than checked in through the trip, so the strip went on saying
   * somebody was out with goods that were already on the shelf.
   *
   * SAID, NOT CLOSED, and the difference matters. A supplier delivery
   * closes itself because nobody is carrying it. A person may genuinely
   * still be out -- waiting on the rest of an order, or on their way
   * back -- and retiring their trip under them would destroy the shop's
   * only record that they are out at all.
   */
  const railState = { collectionTrips: [], savedQuotes: [] };
  const rail = compileScope([
    extractFunction(shared, 'tripIsLive', 'shared-worker.js'),
    extractFunction(shared, 'tripLines', 'shared-worker.js'),
    extractFunction(shared, 'tripShortLines', 'shared-worker.js'),
    extractFunction(shared, 'tripLineGot', 'shared-worker.js'),
    extractFunction(shared, 'quoteLineReceived', 'shared-worker.js'),
    extractFunction(shared, 'quoteLineShortfall', 'shared-worker.js'),
    extractFunction(shared, 'orderLineIsBoughtIn', 'shared-worker.js'),
    extractDeclaration(src, 'TRIP_SUPPLIER_CARRIER', 'index.html'),
    extractFunction(src, 'tripIsSupplierDelivered', 'index.html'),
    extractFunction(src, 'tripCarrierLabel', 'index.html'),
    extractFunction(src, 'tripStatusLabel', 'index.html'),
    extractFunction(src, 'tripCanCheckIn', 'index.html'),
    extractFunction(src, 'tripGoodsAllIn', 'index.html'),
    extractFunction(src, 'blRunTripsHTML', 'index.html'),
  ], {
    data: railState, esc: (s) => String(s), ICON_TRUCK: '', staffName: () => 'Kevin Moses',
    supplierName: () => 'Shafik Katwe',
    supplierAskList: () => [],
    TRIP_STATUS_LABELS: { open: 'To send', assigned: 'Sent', collecting: 'Out collecting', collected: 'Back — to check in' },
  }, ['blRunTripsHTML', 'tripGoodsAllIn']);

  const railOrder = (over) => ({ id: 7, items: [
    { lineId: 'A', supplierId: 'S1', qty: 10 }, { lineId: 'B', supplierId: 'S1', qty: 5 },
  ], ...over });
  const railTrip = (over) => ({ id: 'K', supplierId: 'S1', status: 'assigned',
    assignedWorkerId: 'W1', voided: false,
    lines: [{ orderId: 7, lineId: 'A' }, { orderId: 7, lineId: 'B' }], ...over });

  railState.savedQuotes = [railOrder()];
  railState.collectionTrips = [railTrip()];
  t.check(!rail.tripGoodsAllIn(railState.collectionTrips[0]),
    'a trip whose goods have not arrived is not "already in"');
  const notInHTML = rail.blRunTripsHTML({ supplierId: 'S1' });
  t.check(!/already in/.test(notInHTML), 'and its strip says nothing of the sort');
  /* Nor does it borrow the supplier delivery's instruction. The two
     hints answer different questions -- one tells you where to record
     goods, the other tells you a journey is moot -- and a worker trip
     showing "receive each line below" would be telling somebody to take
     in goods that are still in a van. */
  t.check(!/Receive each line below/.test(notInHTML),
    'and a worker trip is never given the supplier delivery’s instruction');

  railState.savedQuotes = [railOrder({ items: [
    { lineId: 'A', supplierId: 'S1', qty: 10, receivedAt: 'x', receivedQty: 10 },
    { lineId: 'B', supplierId: 'S1', qty: 5, receivedAt: 'x', receivedQty: 5 },
  ] })];
  const inHTML = rail.blRunTripsHTML({ supplierId: 'S1' });
  t.check(rail.tripGoodsAllIn(railState.collectionTrips[0]), 'every line in makes it so');
  t.check(/Everything on this trip is already in/.test(inHTML),
    'and the strip stops claiming somebody is out with goods that are on the shelf');
  t.check(/data-void=/.test(inHTML),
    'while Call off stays a human decision — they may still be out there');
  t.check(railState.collectionTrips[0].status === 'assigned',
    'and nothing has closed the trip behind their back');

  // A supplier delivery gets its own words, not these.
  railState.collectionTrips = [railTrip({ assignedWorkerId: '__supplier__', status: 'collecting' })];
  const supHTML = rail.blRunTripsHTML({ supplierId: 'S1' });
  t.check(/Receive each line below/.test(supHTML) && !/already in/.test(supHTML),
    'a supplier delivery is told what to do, not what somebody else should decide');

  /* One predicate, two callers. closeArrivedSupplierTrips asks the same
     question, so the delivery that closes and the trip that only says so
     can never disagree about what "arrived" means. */
  t.check(/if\(tripGoodsAllIn\(t\)\)\{/.test(code),
    'the auto-close reads the same predicate as the strip');
}

/* ---------- telling the supplier what is coming for ------------------
 *
 * A WhatsApp deep link rather than the Cloud API, and that is a choice
 * with a reason. Business-initiated messages outside a 24-hour window
 * only travel as approved templates, and the one this shop owns is
 * `shop_update` -- category MARKETING, footer "Reply STOP to opt out of
 * promotions". A supplier who taps STOP to stop adverts would then be
 * unreachable for the message saying somebody is on their way. A pick
 * list is a UTILITY message and would need its own approved template;
 * a link needs none, costs nothing, and puts a human in front of
 * anything leaving the shop.
 */
{
  /* The trip message counts each line in the unit it was chosen in,
     through the same reader every document uses; a loose line reads
     exactly as before. */
  const NAMES3 = ['waComposeUrl', 'supplierTripMessage', 'supplierTripWaUrl', 'supplierPriceAskMessage',
    'quoteLinePack', 'quoteLineCountPer', 'quoteLineCount'];
  const msgState = { suppliers: [{ id: 'S1', name: 'Dooba', phone: '0701240819' }] };
  /* The price review is stubbed, not compiled: what is worth asking
     Dooba about is decided by the stock log, the sales and the item's
     other suppliers, none of which this file is about. Its own
     behaviour is pinned in test/price-registry-freshness.test.js. Here
     it only has to produce a list, so the trip message can be checked
     for carrying one. */
  let askList = [];
  const msg = compileScope([
    extractFunction(shared, 'tripLines', 'shared-worker.js'),
    extractDeclaration(src, 'TRIP_SUPPLIER_CARRIER', 'index.html'),
    extractFunction(src, 'tripIsSupplierDelivered', 'index.html'),
    ...NAMES3.map((n) => extractFunction(src, n, 'index.html')),
  ], {
    data: msgState,
    supplierName: () => 'Dooba',
    staffName: (id) => (id === 'W1' ? 'Kevin Moses' : id),
    supplierAskList: () => askList,
    // Stubbed with the price form's own shape: what a supplier can be
    // asked about is a tier question, pinned in price-registry-freshness.
    priceReplySlots: (row) => [{ qty: 1, price: 0, label: '' }],
  }, NAMES3);

  const t2 = (over) => Object.assign({
    id: 'T', supplierId: 'S1', status: 'assigned', assignedWorkerId: 'W1', voided: false,
    lines: [
      { productName: 'Chrome Pipe — 19mm - Light', qty: 40, unit: 'Pcs' },
      { productName: 'Chrome Pipe — 25mm - Light', qty: 20, unit: 'Pcs' },
    ],
  }, over);

  const ours = msg.supplierTripMessage(t2());

  /* THE ITEMS MUST BE TELLABLE APART. The first version used the aligned
     monospace table the other WhatsApp messages use -- 14-character
     columns -- which rendered both of these as "Chrome Pipe —…". A pick
     list whose two lines read identically is worse than none, because
     somebody acts on it and brings back the wrong pipe. */
  t.check(/19mm/.test(ours) && /25mm/.test(ours),
    'two products that differ only late in the name are still told apart');
  t.check(!/…/.test(ours), 'nothing in the list is truncated');
  t.check(/40 Pcs/.test(ours) && /20 Pcs/.test(ours), 'each carries its quantity and unit');
  const ctn = msg.supplierTripMessage(t2({ lines: [{ productName: 'Soft Close', qty: 200, unit: 'Pair', packUnit: 'Ctn', packQty: 100, qtyIn: 'pack' }] }));
  t.check(/Soft Close — 2 Ctn/.test(ctn) && !/200 Pair/.test(ctn),
    'a line chosen as cartons asks the supplier for cartons');

  // No prices. The shop is about to negotiate with the reader.
  t.check(!/UGX/.test(ours) && !/\d{1,3},\d{3}/.test(ours),
    'and no price, which is the shop’s position and not the supplier’s business');

  // Who is coming, when it is known.
  t.check(/Kevin Moses/.test(ours), 'the person collecting is named');
  t.check(!/Kevin Moses/.test(msg.supplierTripMessage(t2({ assignedWorkerId: null }))),
    'and not guessed at before anybody is assigned');
  t.check(/send someone shortly/.test(msg.supplierTripMessage(t2({ assignedWorkerId: null }))),
    'which is said plainly instead');

  /* Two journeys, two messages. Telling a supplier who is loading their
     own van that you are "coming to collect" sends them to wait at a
     counter. */
  const theirs = msg.supplierTripMessage(t2({ assignedWorkerId: '__supplier__', status: 'collecting' }));
  t.check(/Please deliver/.test(theirs) && !/coming to collect/.test(theirs),
    'a supplier delivery is asked to bring it, not told we are coming');
  t.check(/coming to collect/.test(ours) && !/Please deliver/.test(ours),
    'and a trip of ours is the other way round');
  t.check(!/will collect/.test(theirs),
    'with nobody of ours named on a journey nobody of ours is making');

  /* The number. One rule, shared with the client-quote sender, because
     two readings of "does a leading 0 mean 256" is how one of them dials
     a number the other would not. */
  t.check(msg.waComposeUrl('0701240819', 'x').startsWith('https://wa.me/256701240819?text='),
    'a local number is dialled as Ugandan');
  t.check(msg.waComposeUrl('256701240819', 'x').startsWith('https://wa.me/256701240819?'),
    'one already in full is left alone rather than prefixed twice');
  t.check(msg.waComposeUrl('+256 701 240 819', 'x').startsWith('https://wa.me/256701240819?'),
    'and spacing and a plus are ignored');
  t.check(msg.waComposeUrl('', 'hello').startsWith('https://wa.me/?text='),
    'no number still opens WhatsApp with the message, rather than losing what was written');
  t.check(/text=hello$/.test(msg.waComposeUrl('', 'hello')), 'carrying the text with it');

  // Used by both senders, so there is only one rule.
  const code2 = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check((code2.match(/waComposeUrl\(/g) || []).length >= 3,
    'the client quote and the supplier notice both go through it');
  t.check(!/phoneDigits\.startsWith\('0'\)/.test(code2),
    'and the inline copy it replaced is gone, not left beside it');

  // Offered on the strip, and wired.
  t.check(/data-tell="\$\{esc\(t\.id\)\}"/.test(code2), 'every trip offers to tell its supplier');
  t.check(/window\.open\(supplierTripWaUrl\(trip\), '_blank'\);/.test(code2), 'which opens the link');
  t.check(/No phone number for \$\{supplierName\(trip\.supplierId\)\}/.test(code2),
    'and a supplier with no number on file is named rather than silently opening a chooser');

  /* ---- while you're there ----------------------------------------------
     A separate errand to go and confirm prices is the thing that never
     happens. A line at the bottom of a message somebody is sending
     anyway is the thing that does -- so the trip's own notice carries
     the prices worth asking this supplier about. */
  askList = [];
  const bare = decodeURIComponent(msg.supplierTripWaUrl(t2()).split('?text=')[1]);
  t.check(!/confirm your current prices/.test(bare),
    'a supplier with nothing worth asking about gets the plain journey message');

  askList = [
    { row: { id: 1, pname: 'Cement — 50kg', unit: 'Bag' } },
    { row: { id: 2, pname: 'Nails — 4 inch', unit: '' } },
  ];
  const withAsk = decodeURIComponent(msg.supplierTripWaUrl(t2()).split('?text=')[1]);
  t.check(/We are coming to collect/.test(withAsk) && /Chrome Pipe/.test(withAsk),
    'the journey is still the message');
  t.check(/confirm your current prices/.test(withAsk), 'and the enquiry rides along at the bottom');
  t.check(/Cement — 50kg \(per Bag\)/.test(withAsk) && /Nails — 4 inch/.test(withAsk),
    'naming each item, with its unit where there is one');
  t.check(!/Nails — 4 inch \(per/.test(withAsk), 'and no empty bracket where there is not');

  /* STILL NO PRICES, and for a stronger reason than the journey has.
     The whole point is to hear THEIR figure: "you said 7,600 in May,
     still right?" invites a yes from a supplier who has since put it
     up, and the shop would never find out. */
  t.check(!/UGX/.test(withAsk) && !/\d{1,3},\d{3}/.test(withAsk),
    'the enquiry names the item and never the price the shop has on file');

  // Greeted once. Two "Hello Dooba," in one message reads as a mistake.
  t.check((withAsk.match(/Hello \*Dooba\*/g) || []).length === 1,
    'one greeting, not one per half');

  const askOnly = msg.supplierPriceAskMessage('S1', []);
  t.check(askOnly === '', 'an empty ask is no message at all rather than a greeting with nothing under it');
}

/* ---------- when the client sends their own person ------------------- */
/*
 * The same idea at the other end. An order carried by somebody who is
 * not ours has no assignee AND needs none -- and "no assignee" already
 * meant "this still needs a person", so without a way to say why, a
 * client-collected order sat in Pending Delivery counted as outstanding
 * work until somebody noticed.
 */
{
  const NAMES = ['deliveryIsSelfCarried', 'deliveryAssigneeLabel', 'orderNeedsDelivery'];
  const state = { staff: [{ id: 'D1', name: 'Musa' }] };
  const s = compileScope([
    extractDeclaration(src, 'DELIVERY_SELF_CARRIERS', 'index.html'),
    ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
  ], { data: state, staffName: (id) => (state.staff.find((x) => x.id === id) || {}).name || '' }, NAMES);

  const at = (assignedDeliveryId) => ({ status: 'pending_delivery', assignedDeliveryId });

  t.check(s.deliveryAssigneeLabel(at('__client__')) === 'Client’s own person',
    `the sentinel resolves to words, never to '__client__' in front of a customer`);
  t.check(!s.orderNeedsDelivery(at('__client__')),
    'and the order stops being counted as needing one of ours');
  t.check(!s.orderNeedsDelivery(at('__agent__')) && s.deliveryAssigneeLabel(at('__agent__')) === 'Agent pickup',
    'the agent case that was here first still behaves exactly as it did');
  t.check(!s.orderNeedsDelivery(at('D1')),
    'a real staff member still counts as covered');
  t.check(s.orderNeedsDelivery(at(null)),
    'nobody at all still needs somebody — which is the whole distinction');
  t.check(s.orderNeedsDelivery(at('D-DELETED')),
    'and an assignee who has left the shop needs replacing');

  // A stale sentinel outside Pending Delivery is not a delivery at all.
  t.check(!s.orderNeedsDelivery({ status: 'preparing', assignedDeliveryId: null }),
    'an order not yet at the delivery step is not waiting for a driver');

  /* Where this is chosen. It used to be a modal that refused to open at
     all when no delivery staff existed -- which would have made "the
     client is collecting it" impossible to record in exactly the shop most
     likely to need it. It is now the Loaded form, in the row and on the
     picker's phone, and the question it asks is who is carrying it: hired
     transport, one of ours, the client's own person, the agent. A shop
     with no delivery staff simply picks one of the other three. */
  const shared = read('shared-worker.js');
  const kinds = extractDeclaration(shared, 'CARRIER_KINDS', 'shared-worker.js');
  ['hired', 'staff', 'client', 'agent'].forEach((k) => t.check(new RegExp(`${k}:`).test(kinds),
    `the Loaded form offers "${k}" as a way an order can leave`));
  const load = extractFunction(shared, 'loadOrder', 'shared-worker.js');
  t.check(/assignee = '__client__'/.test(load) || /} else {\n    assignee = '__client__';/.test(load),
    "and the client's own person is written as the sentinel the board reads as settled");
  /* Was pinned on the words "Choose who of ours is taking it", which
     belonged to a second box that appeared under the first once you had
     said "one of ours". Nobody found that box -- the shop has a handful
     of staff and the obvious thing is to pick the person -- so the people
     are now named in the one list and the second box is gone. The RULE it
     was guarding is unchanged and is what is pinned instead: a person
     chosen has to resolve to somebody really on the delivery list, or
     nothing is written. */
  t.check(/const st = \(data\.staff\|\|\[\]\)\.find\(x=> String\(x\.id\) === String\(c\.staffId\) && staffEligibleForRole\(x, 'delivery'\)\);/.test(load)
    && /if\(!st\)\{ toast\([^)]*\); return false; \}/.test(load),
    'while "one of ours" must actually name somebody on the delivery list');
  const form = extractFunction(shared, 'carrierFormHTML', 'shared-worker.js');
  t.check(/staffEligibleForRole\(st, 'delivery'\) && !st\.unavailable/.test(form)
    && /'staff:' \+ st\.id/.test(form),
    'and the list names those people itself, rather than a category that hides them behind a second box');
}

process.exit(t.done() ? 1 : 0);
