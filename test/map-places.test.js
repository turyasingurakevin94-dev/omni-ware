#!/usr/bin/env node
'use strict';
/*
 * Where things and people are.
 *
 * Every customer and supplier carries a location, but it is a NAME --
 * "Bwaise", "Industrial Area" -- and nothing knew where those were. The
 * shop's whole book resolves to about twenty distinct places, so a place
 * is pinned once by hand and every record naming it inherits the pin.
 * That is the only reason this feature is affordable: twenty pins, not
 * eighty-five geocoder lookups against addresses that do not exist.
 *
 * A PIN IS A WHOLE THING OR IT IS NOTHING. A place nobody has placed is
 * not a place at 0,0 in the Gulf of Guinea, and a latitude without a
 * longitude is not half a position -- it is a marker on a real meridian
 * at a fictional latitude. Both answer null and get listed apart, the
 * same way the buying runs already set aside suppliers with no location.
 *
 * THE MONEY IS DERIVED, NEVER STORED. A total kept on a place would drift
 * from the Debtors list the first time an invoice was voided. And a place
 * where money is owed but nothing behind it carries a date is 'unknown',
 * never 'under 30 days' -- the one band AGING_BANDS says such a debt must
 * never quietly join.
 *
 * Run: node test/map-places.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('map places');
const src = read('index.html');

const data = { places: [], presetLocations: [], customers: [], suppliers: [] };
const owedTo = new Map();          // supplierId -> what the shop owes them
const openInvoices = new Map();    // customerId -> [{invoicedAt|date}]
const TODAY = Date.parse('2026-08-08T00:00:00Z');

const NAMES = ['placePin', 'customerOldestDebtDays', 'mapPlaceRows',
  'pinDistanceKm', 'mapPlaceSplit', 'mapCentrePin'];
const scope = compileScope([
  extractDeclaration(src, 'AGING_BANDS', 'index.html'),
  extractDeclaration(src, 'MAP_CORE_RADIUS_KM', 'index.html'),
  extractFunction(src, 'agingBandFor', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  canonicalLocation: (raw) => String(raw == null ? '' : raw).trim().replace(/\s+/g, ' '),
  creditorTotalOwed: (id) => owedTo.get(id) || 0,
  customerOutstandingInvoices: (id) => openInvoices.get(id) || [],
  daysSinceDate: (d) => Math.floor((TODAY - Date.parse(d)) / 86400000),
}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const byName = (rows, n) => rows.find((r) => r.name === n);
const stripLineComments = (text) => text.split(/\r?\n/)
  .map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
// Real coordinates, so the distances below are real distances.
const KAMPALA = { lat: 0.3152, lng: 32.5816 };   // the shop, roughly Nakasero
const reset = () => {
  data.places = []; data.presetLocations = []; data.customers = []; data.suppliers = [];
  owedTo.clear(); openInvoices.clear();
};

/* ---------- 1. a pin is whole, or it is nothing ---------------------- */
{
  reset();
  data.places = [
    { name: 'Bwaise', lat: 0.3476, lng: 32.5619 },
    { name: 'Half Pin', lat: 0.35, lng: null },
    { name: 'Never Placed', lat: null, lng: null },
  ];
  t.check(!!scope.placePin('Bwaise'), 'a placed place has a pin');
  eq(scope.placePin('Bwaise').lat, 0.3476, 'carrying its latitude');
  /* THE TRAP: null is falsy, but so is 0 — and 0,0 is a real point in
     the Atlantic. A missing pin must be tested for null, not for truth. */
  eq(scope.placePin('Never Placed'), null, 'an unplaced place has NO pin, not one at 0,0');
  eq(scope.placePin('Half Pin'), null, 'and half a pin is no pin either');
  eq(scope.placePin('Nowhere At All'), null, 'a place not on file at all has none');
  eq(scope.placePin(''), null, 'and a blank location asks for nothing');

  // A genuine pin at the origin is still a pin, if anyone ever sets one.
  data.places.push({ name: 'Null Island', lat: 0, lng: 0 });
  t.check(scope.placePin('Null Island') !== null, 'a deliberate 0,0 is not mistaken for missing');
}

/* ---------- 2. how old the oldest unpaid thing is -------------------- */
{
  reset();
  openInvoices.set('C1', [{ invoicedAt: '2026-07-09' }, { invoicedAt: '2026-06-09' }]);
  eq(scope.customerOldestDebtDays({ id: 'C1', debt: 500000 }), 60,
    'the OLDEST open invoice sets the age, not the newest');
  eq(scope.customerOldestDebtDays({ id: 'C1', debt: 0 }), null,
    'a customer who owes nothing has no debt age');
  /* Owed, but nothing behind it carries a date: unknown, not new. */
  openInvoices.set('C2', [{ invoicedAt: null, date: null }]);
  eq(scope.customerOldestDebtDays({ id: 'C2', debt: 90000 }), null,
    'a balance with nothing dated behind it reports NO age rather than zero');
  eq(scope.customerOldestDebtDays(null), null, 'and nobody has no age');
}

/* ---------- 3. one row per place, money derived ---------------------- */
{
  reset();
  data.places = [{ name: 'Bwaise', lat: 0.3476, lng: 32.5619 }];
  data.presetLocations = ['Bwaise', 'Empty Place'];
  data.customers = [
    { id: 'C1', location: 'Bwaise', debt: 400000 },
    { id: 'C2', location: 'Bwaise', debt: 100000 },
    { id: 'C3', location: 'Katwe', debt: 0 },
  ];
  data.suppliers = [
    { id: 'S1', location: 'Bwaise' },
    { id: 'S2', location: 'Katwe' },
  ];
  owedTo.set('S1', 250000);
  openInvoices.set('C1', [{ invoicedAt: '2026-07-09' }]);   // 30 days
  openInvoices.set('C2', [{ invoicedAt: '2026-08-06' }]);   // 2 days

  const rows = scope.mapPlaceRows();
  const bwaise = byName(rows, 'Bwaise');
  eq(bwaise.customers.length, 2, 'a place collects the customers who name it');
  eq(bwaise.suppliers.length, 1, 'and the suppliers');
  eq(bwaise.owed, 500000, 'what they owe the shop is summed from the customer records');
  eq(bwaise.owing, 250000, 'what the shop owes is summed from the supplier ledger');
  eq(bwaise.count, 3, 'the marker size counts everybody at the place');
  /* The colour follows the OLDEST debt at the place, so one long-overdue
     customer is not hidden behind two fresh ones. */
  eq(bwaise.oldestDays, 30, 'the place takes its age from its oldest debt');
  eq(bwaise.band, 'b60', 'and is banded by that age, not by an average');

  eq(byName(rows, 'Katwe').band, null, 'a place where nothing is owed has no debt colour at all');
  /* A customer in credit owes nothing -- they must not net off what the
     people beside them owe, or an overpayment hides a real debt. */
  data.customers.push({ id: 'C4', location: 'Bwaise', debt: -300000 });
  eq(byName(scope.mapPlaceRows(), 'Bwaise').owed, 500000,
    'a customer in credit contributes nothing, rather than subtracting from what others owe');
  /* A place with nobody at it still exists — you must be able to pin it
     before the first customer moves in. */
  t.check(!!byName(rows, 'Empty Place'), 'a known place with nobody at it is still listed');
  eq(byName(rows, 'Empty Place').count, 0, 'with nothing at it');

  // Busiest first, so the map's biggest markers are the top of the list.
  eq(rows[0].name, 'Bwaise', 'the busiest place sorts first');

  /* Owed, but undated: 'unknown'. Flattering it into "under 30 days"
     is exactly what AGING_BANDS exists to prevent. */
  reset();
  data.customers = [{ id: 'C9', location: 'Mystery', debt: 200000 }];
  openInvoices.set('C9', [{ invoicedAt: null, date: null }]);
  eq(byName(scope.mapPlaceRows(), 'Mystery').band, 'unknown',
    'money owed with no date behind it is banded unknown, never as new');
}

/* ---------- 4. across town, or across the country -------------------- */
{
  const lira = { lat: 2.2350, lng: 32.9097 };
  const industrialArea = { lat: 0.3080, lng: 32.6100 };
  const km = scope.pinDistanceKm(KAMPALA, lira);
  t.check(km > 200 && km < 260, `Kampala to Lira is a couple of hundred km (${Math.round(km)})`);
  t.check(scope.pinDistanceKm(KAMPALA, industrialArea) < 5,
    'while Industrial Area is a few minutes away');
  eq(Math.round(scope.pinDistanceKm(KAMPALA, KAMPALA)), 0, 'a place is no distance from itself');
  eq(scope.pinDistanceKm(null, lira), null, 'and there is no distance to nowhere');
  /* Flat degrees would be wrong by a third here: a degree of longitude
     is not a degree of latitude anywhere but the equator. */
  const dueEast = { lat: KAMPALA.lat, lng: KAMPALA.lng + 1 };
  const dueNorth = { lat: KAMPALA.lat + 1, lng: KAMPALA.lng };
  t.check(Math.abs(scope.pinDistanceKm(KAMPALA, dueEast) - scope.pinDistanceKm(KAMPALA, dueNorth)) < 2,
    'a degree east and a degree north are the same distance ON THE EQUATOR, which is where this shop is');
  /* And that equality is exactly why the equator cannot test the
     formula: flat degrees agree with it here. Measured at 60 degrees
     north, where a degree of longitude is half a degree of latitude,
     flat degrees are wrong by nearly a factor of two -- so this is what
     proves the cosine terms are actually doing their job. */
  const far = { lat: 60, lng: 0 };
  const farEast = { lat: 60, lng: 1 };
  const farNorth = { lat: 61, lng: 0 };
  const eastKm = scope.pinDistanceKm(far, farEast);
  const northKm = scope.pinDistanceKm(far, farNorth);
  t.check(eastKm > 50 && eastKm < 60, `at 60N a degree of longitude is about 56km (${Math.round(eastKm)})`);
  t.check(northKm > 105 && northKm < 116, `while a degree of latitude is still about 111km (${Math.round(northKm)})`);
  t.check(northKm - eastKm > 40, 'the two differ by tens of kilometres, which flat degrees cannot see');
}

/* ---------- 5. three states, not two --------------------------------- */
{
  const rows = [
    { name: 'Bwaise', pin: { lat: 0.3476, lng: 32.5619 } },
    { name: 'Industrial Area', pin: { lat: 0.3080, lng: 32.6100 } },
    { name: 'Lira', pin: { lat: 2.2350, lng: 32.9097 } },
    { name: 'Jinja', pin: { lat: 0.4244, lng: 33.2042 } },
    { name: 'Not Placed Yet', pin: null },
  ];
  const split = scope.mapPlaceSplit(rows, KAMPALA);
  eq(split.core.length, 2, 'places around the shop are the map');
  eq(split.far.length, 2, 'distant ones are listed beside it rather than zooming the map out to nothing');
  eq(split.unpinned.length, 1, 'and unplaced ones are their own problem again');
  /* Three states because "no pin" and "too far to draw" have different
     fixes: one needs placing, the other needs a click to fly there. */
  eq(split.unpinned[0].name, 'Not Placed Yet', 'named, so it can be placed');
  eq(split.far[0].name, 'Jinja', 'the far list runs nearest first');
  t.check(split.far[0].km > 60 && split.far[0].km < 90,
    `carrying how far away it is (${Math.round(split.far[0].km)}km)`);

  // With no shop pin there is nothing to measure from, so nothing is far.
  const noHome = scope.mapPlaceSplit(rows, null);
  eq(noHome.far.length, 0, 'with no shop pin, nothing is judged too far');
  eq(noHome.core.length, 4, 'and every pinned place is drawn');
}

/* ---------- 6. the wiring that keeps it alive ------------------------ */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/addDiffOps\(ops, 'places', 'places', 'name', shopId, rows\.places\);/.test(code),
    'places are synced, keyed by the NAME every other record joins on');
  t.check(/places: keyRowsById\(rows\.places, 'name'\),/.test(code),
    'and seeded into the snapshot, or a pin deleted before the first save resurrects');
  t.check(/places: \(placesR\.data\|\|\[\]\)\.map/.test(code) && /places: \(d\.places\|\|\[\]\)\.map/.test(code),
    'they round-trip to the server in both directions');

  /* The render is DOM and Leaflet, so nothing above executes it. This
     one line is worth asserting because without the fallback the far
     strip never appears until somebody configures a shop position —
     silently, with distant places drawn as though they were local. */
  t.check(/const home = mapHomePin\(\) \|\| mapCentrePin\(rows\);/.test(code),
    'the map measures from the shop if it knows it, and from the middle of everything if it does not');
  t.check(/if\(tab==='map'\) renderMap\(\);/.test(code), 'and the tab draws it on entry');

  const mig = read('supabase/migrations/0066_place_pins.sql');
  t.check(/places_pin_whole check \(\(lat is null\) = \(lng is null\)\)/.test(mig),
    'the database refuses half a pin too, not just the client');
  t.check(/lat >= -90 and lat <= 90/.test(mig) && /lng >= -180 and lng <= 180/.test(mig),
    'and refuses a coordinate that is not on Earth');
  t.check(/as restrictive for delete using \(is_shop_owner\(shop_id\)\)/.test(mig),
    'with the same owner-only delete gate every other data table carries');
}

/* ---------- 7. the middle of everything, when nothing says where ----- *
 * The far strip has to work before anybody configures a shop position,
 * so distances are measured from the median of the pinned places. The
 * MEDIAN, not the mean: one customer in Lira drags a mean two hundred
 * kilometres north and takes the whole map with it, while the median
 * does not move -- the outlier this exists to find must not be able to
 * move the thing it is measured from.
 */
{
  const kampalaish = [
    { pin: { lat: 0.30, lng: 32.57 } },
    { pin: { lat: 0.31, lng: 32.58 } },
    { pin: { lat: 0.32, lng: 32.59 } },
    { pin: { lat: 2.235, lng: 32.91 } },   // Lira, 200km+ north
    { pin: null },
  ];
  const centre = scope.mapCentrePin(kampalaish);
  t.check(centre.lat < 0.4,
    `the centre stays in Kampala despite Lira (${centre.lat.toFixed(3)})`);
  eq(scope.mapCentrePin([]), null, 'nothing pinned, no centre to claim');
  eq(scope.mapCentrePin([{ pin: null }]), null, 'and an unpinned place contributes none');

  // With that centre, Lira is correctly the outlier rather than the map.
  const split = scope.mapPlaceSplit(kampalaish.map((r, i) => Object.assign({ name: 'P' + i }, r)), centre);
  eq(split.far.length, 1, 'exactly the distant one is set aside');
  eq(split.core.length, 3, 'and the cluster is the map');
}

/* ---------- 8. today's deliveries, on the map ------------------------ *
 * Built on deliveryRuns(), which already answers "which of these are
 * going the same way" for the delivery banner. A second grouping would
 * be a second opinion about which orders share a trip, and the two would
 * disagree the first time either changed.
 *
 * A run carries what the driver should come back WITH -- the balance
 * still unpaid, not the order's value. On any part-paid order those are
 * different numbers, and the one somebody is accountable for is the
 * balance.
 */
{
  const dData = { places: [{ name: 'Bwaise', lat: 0.3476, lng: 32.5619 }] };
  const mk = (id, driver) => ({ id, client: { name: 'Cust ' + id }, assignedDeliveryId: driver });
  const runsFixture = [
    { key: 'bwaise', label: 'Bwaise', orders: [mk(1, 'ST1'), mk(2, null)],
      value: 600000, drivers: ['ST1'], unassigned: 1 },
    { key: 'nowhere yet', label: 'Nowhere Yet', orders: [mk(3, 'ST1')],
      value: 90000, drivers: ['ST1'], unassigned: 0 },
  ];
  const balances = { 1: 300000, 2: 200000, 3: 90000 };

  const dScope = compileScope([
    extractFunction(src, 'placePin', 'index.html'),
    extractFunction(src, 'deliveryMapRuns', 'index.html'),
  ], {
    data: dData,
    canonicalLocation: (raw) => String(raw == null ? '' : raw).trim(),
    deliveryRuns: () => ({ runs: runsFixture, collected: [{ id: 9 }], unknown: [{ id: 8 }] }),
    pendingDeliveryOrders: () => [],
    invoiceBalanceDue: (q) => balances[q.id] || 0,
  }, ['deliveryMapRuns']);

  const out = dScope.deliveryMapRuns();
  eq(out.runs.length, 2, 'every stop is carried through, pinned or not');
  const bwaise = out.runs.find((r) => r.label === 'Bwaise');
  t.check(!!bwaise.pin, 'a stop at a pinned place can be drawn');
  eq(out.runs.find((r) => r.label === 'Nowhere Yet').pin, null,
    'and a stop at an unpinned place carries no pin rather than a guessed one');

  /* THE NUMBER SOMEBODY IS ACCOUNTABLE FOR. Order value is 600,000;
     100,000 is already paid, so 500,000 should come back. Sending a
     driver out against the value would expect the wrong money. */
  eq(bwaise.value, 600000, 'the run keeps the order value it was grouped with');
  eq(bwaise.toCollect, 500000, 'but what to collect is the UNPAID balance, not the value');
  eq(bwaise.unassigned, 1, 'and it still knows how many have no driver');

  /* Two kinds of "not a stop", kept apart: collecting in person was never
     going to be one; an order with no destination is one nobody can plan. */
  eq(out.collected.length, 1, 'orders being collected in person are set aside');
  eq(out.unknown.length, 1, 'and orders with no destination are their own problem');
}

/* ---------- 9. the delivery layer is wired --------------------------- */
{
  const wired = stripLineComments(src);
  t.check(/data-layer="deliveries"/.test(src), 'the map offers a deliveries layer');
  t.check(/if\(mpLayer === 'deliveries'\) return renderDeliveryMap\(\);/.test(wired),
    'which takes its own render path');
  const dm = extractFunction(src, 'renderDeliveryMap', 'index.html');
  t.check(/r\.unassigned > 0 \? '#B0700A' : '#2F7FBF'/.test(dm),
    'a stop with no driver is the colour that stands out — it is the one thing to fix before the van leaves');
  t.check(/const noPin = runs\.filter\(r=> !r\.pin\);/.test(dm) && /not on the map/.test(dm),
    'stops the map cannot draw are named, not silently dropped from the day');
  const ds = extractFunction(src, 'renderDeliverySide', 'index.html');
  t.check(/invoiceBalanceDue\(q\)/.test(ds) && /no driver yet/.test(ds),
    'and each order shows what is owed on it and who is taking it');
}

/* ---------- 10. finding a place, and moving its pin ------------------ *
 * Twenty places have to be pinned by hand, so the list that makes that
 * quick is part of the feature, not decoration. UNPLACED SORTS FIRST
 * whatever the query -- those are the work -- and busiest first within
 * each half, because pinning the place holding thirteen customers is
 * worth more than the one holding one.
 *
 * And a pin must be movable. The first click of a rough map is a guess;
 * a feature that can only ever be told once is a feature people stop
 * trusting.
 */
{
  const sData = { places: [] };
  const sScope = compileScope([
    extractFunction(src, 'searchTokens', 'index.html'),
    extractFunction(src, 'matchesAllTokens', 'index.html'),
    extractFunction(src, 'mapPlaceSearch', 'index.html'),
    extractFunction(src, 'mapSetPin', 'index.html'),
    extractFunction(src, 'mapClearPin', 'index.html'),
  ], {
    data: sData,
    canonicalLocation: (raw) => String(raw == null ? '' : raw).trim(),
  }, ['mapPlaceSearch', 'mapSetPin', 'mapClearPin']);

  const rows = [
    { name: 'Original Shauriyako', count: 23, pin: { lat: 0.311, lng: 32.576 } },
    { name: 'Industrial Area', count: 13, pin: null },
    { name: 'Bwaise', count: 3, pin: null },
    { name: 'Katwe', count: 5, pin: { lat: 0.294, lng: 32.571 } },
  ];

  const all = sScope.mapPlaceSearch(rows, '');
  eq(all[0].name, 'Industrial Area', 'the busiest UNPLACED place is first — that is the work');
  eq(all[1].name, 'Bwaise', 'then the rest of the unplaced');
  eq(all[2].name, 'Original Shauriyako', 'placed ones come after, busiest first');
  eq(all.length, 4, 'and nothing is dropped');

  eq(sScope.mapPlaceSearch(rows, 'bwa').length, 1, 'a fragment finds its place');
  eq(sScope.mapPlaceSearch(rows, 'BWA')[0].name, 'Bwaise', 'however it is typed');
  eq(sScope.mapPlaceSearch(rows, 'original shau')[0].name, 'Original Shauriyako',
    'and several words all have to match');
  eq(sScope.mapPlaceSearch(rows, 'zzz').length, 0, 'a miss is a miss');
  /* The caller's array must not be reordered underneath it -- the map is
     drawn from the same rows. */
  eq(rows[0].name, 'Original Shauriyako', 'searching does not reorder the caller\'s own list');

  /* Setting a pin, then MOVING it. */
  sData.places = [];
  const set = sScope.mapSetPin('Bwaise', 0.3476123456, 32.5619987654);
  eq(sData.places.length, 1, 'placing a place nobody has placed adds it');
  eq(set.lat, 0.347612, 'stored to six places — about ten centimetres, past what a finger can mean');
  sScope.mapSetPin('Bwaise', 0.35, 32.56);
  eq(sData.places.length, 1, 'moving it does not add a second row for the same place');
  eq(sData.places[0].lat, 0.35, 'it moves the one that is there');

  /* Taking it back NULLS the coordinates rather than dropping the row:
     the schema allows a place with no position, and an update cannot be
     mistaken by the sync engine for a deletion. */
  eq(sScope.mapClearPin('Bwaise'), true, 'a pin can be taken back');
  eq(sData.places.length, 1, 'and the place stays on the list, ready to be put somewhere better');
  eq(sData.places[0].lat, null, 'with no position');
  eq(sData.places[0].lng, null, 'on either axis — never half a pin');
  eq(sScope.mapClearPin('Never Existed'), false, 'clearing a place that was never placed changes nothing');
  eq(sScope.mapSetPin('', 1, 2), null, 'and a blank name is not a place');
}

/* ---------- 11. the search and the pin editing are wired ------------- */
{
  const wired2 = stripLineComments(src);
  t.check(/id="mp_search"/.test(src) && /getElementById\('mp_search'\)\.addEventListener\('input', renderMapResults\);/.test(wired2),
    'the search box narrows the list as it is typed');
  const rr = extractFunction(src, 'renderMapResults', 'index.html');
  t.check(/class="mp-chip mp-place"/.test(rr) && /r\.pin \? 'Move' : 'Place'/.test(rr),
    'a placed place offers Move and an unplaced one offers Place — the same button, honest about which');
  t.check(/r\.pin \? `<button type="button" class="mp-chip mp-clear"/.test(rr),
    'and only a placed place can be removed');
  t.check(/mpPinning === r\.name \? 'Click the map…'/.test(rr),
    'the place being placed says so, so nobody wonders whether the click registered');

  /* Only one place armed at a time, or two names race for one click and
     whichever listener fired last wins silently. */
  const begin = extractFunction(src, 'mapBeginPin', 'index.html');
  t.check(/if\(mpPinning\) mapCancelPin\(\);/.test(begin),
    'arming a second place cancels the first');
  t.check(/mpMap\.once\('click', mapPinClick\);/.test(begin),
    'and the map listens exactly once');
  const cancel = extractFunction(src, 'mapCancelPin', 'index.html');
  t.check(/mpMap\.off\('click', mapPinClick\)/.test(cancel),
    'cancelling takes the listener off again, so a later click is not swallowed');
  t.check(/if\(e\.key === 'Escape'\) mapCancelPin\(\);/.test(wired2),
    'with Escape as the way out');

  const rm = extractFunction(src, 'mapRemovePin', 'index.html');
  t.check(/if\(!confirm\(/.test(rm) && /will stop showing/.test(rm),
    'removing a pin asks first, and says what stops being shown');
  t.check(/saveData\(\);/.test(rm) && /renderMap\(\);/.test(rm),
    'then saves and redraws');
}

/* ---------- 12. the placed ones must be reachable -------------------- *
 * REPORTED LIVE: "I had already placed a pin for Katwe and Gaggawala but
 * am not seeing a way of removing them." Both pins existed with good
 * coordinates. The list sorts unplaced FIRST -- right for the job of
 * pinning twenty places -- and was then cut at twelve rows. With twenty
 * places still to do, the two that were placed sorted to positions
 * twenty-one and twenty-two and were never rendered. Move and Remove
 * live on those rows, so a pin became unremovable by being invisible.
 *
 * Two things follow: the list renders every match and scrolls, and there
 * is a way to ask for the placed half directly.
 */
{
  const fData = { places: [] };
  const fScope = compileScope([
    extractFunction(src, 'searchTokens', 'index.html'),
    extractFunction(src, 'matchesAllTokens', 'index.html'),
    extractFunction(src, 'mapPlaceSearch', 'index.html'),
  ], { data: fData, canonicalLocation: (raw) => String(raw || '').trim() }, ['mapPlaceSearch']);

  // The reported shape: twenty unplaced, two placed.
  const many = [];
  for (let i = 0; i < 20; i++) many.push({ name: 'Todo ' + i, count: 20 - i, pin: null });
  many.push({ name: 'Katwe', count: 5, pin: { lat: 0.316, lng: 32.568 } });
  many.push({ name: 'Gaggawala', count: 12, pin: { lat: 0.317, lng: 32.571 } });

  const all = fScope.mapPlaceSearch(many, '', 'all');
  eq(all.length, 22, 'every place is returned — nothing is dropped before it reaches the screen');
  /* The bug, stated as the thing that must stay true: the placed ones
     sort last, so any cap at all buries them. */
  t.check(all.findIndex((r) => r.name === 'Katwe') > 12,
    'placed places still sort last, which is why the list may not be truncated');

  const placed = fScope.mapPlaceSearch(many, '', 'placed');
  eq(placed.length, 2, 'asking for the placed half returns exactly the pins on the map');
  t.check(placed.every((r) => r.pin), 'and nothing without a pin');
  eq(placed[0].name, 'Gaggawala', 'busiest first among them');

  const todo = fScope.mapPlaceSearch(many, '', 'todo');
  eq(todo.length, 20, 'and asking for the work returns only what is still to do');
  t.check(todo.every((r) => !r.pin), 'with nothing already placed in the way');

  // The filter and the search compose.
  eq(fScope.mapPlaceSearch(many, 'katwe', 'placed').length, 1, 'searching within the placed half works');
  eq(fScope.mapPlaceSearch(many, 'katwe', 'todo').length, 0,
    'and a placed place is correctly absent from the to-do half');
}

/* ---------- 13. and the screen honours that --------------------------- */
{
  const wired3 = stripLineComments(src);
  const rr2 = extractFunction(src, 'renderMapResults', 'index.html');
  t.check(/const shown = all;/.test(rr2),
    'every match is rendered — a row that is not drawn is a pin that cannot be moved or removed');
  t.check(!/all\.slice\(0, ?\d+\)/.test(rr2), 'nothing silently truncates the list');
  t.check(/\.mp-results\{max-height:320px;overflow-y:auto;\}/.test(src),
    'the list scrolls instead, so a long one is still all there');
  t.check(/mapPlaceSearch\(mapPlaceRows\(\), q, mpFilter\)/.test(rr2),
    'and the chosen half is what it asks for');
  t.check(/data-filter="placed"/.test(src) && /data-filter="todo"/.test(src),
    'with a way to ask for either half');
  t.check(/mpFilter = b\.dataset\.filter;/.test(wired3) && /renderMapResults\(\);/.test(wired3),
    'that redraws when pressed');
}

process.exit(t.done() ? 1 : 0);
