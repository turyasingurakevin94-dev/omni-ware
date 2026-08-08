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

process.exit(t.done() ? 1 : 0);
