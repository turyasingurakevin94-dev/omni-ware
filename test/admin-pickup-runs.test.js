#!/usr/bin/env node
'use strict';
/*
 * Where the buying trip actually goes.
 *
 * The delivery banner answers "which of these are going the same way".
 * This is the same question pointed the other way. The buyer leaves the
 * shop with a list organised by SUPPLIER, and the morning is organised by
 * PLACE: three suppliers in Katwe is one trip, and the buying list showed
 * it as three separate errands.
 *
 * The decisions worth pinning:
 *
 *   where the money         grouped on the supplier orderPurchaseLines
 *   is really spent         RANKED, not the one the order was quoted on.
 *                           They differ whenever somebody else got
 *                           cheaper since, and walking to the quoted
 *                           supplier is walking to the wrong yard.
 *
 *   spelling does not       "katwe" and "Katwe" are one place. The
 *   split a place           clustering runs through the same canonical
 *                           form the rest of the app uses, so a lowercase
 *                           entry does not become its own trip.
 *
 *   nothing is dropped      a supplier with no location, and a line with
 *                           no price at all, are held aside and NAMED. A
 *                           line quietly missing from a buying trip is
 *                           how an order comes back one item short.
 *
 *   stops before money      a place worth three stops outranks a place
 *                           worth one, even for a larger sum. The trip is
 *                           the expensive part.
 *
 * Run: node test/admin-pickup-runs.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin pickup runs');
const src = read('index.html');
const data = { suppliers: [], presetLocations: [] };

// orderPurchaseLines is stubbed: which supplier is cheapest today is the
// price registry's job and is tested where that lives. What is new here
// is what happens to those lines once they exist.
const purchaseLines = new Map();
const scope = compileScope([
  extractFunction(src, 'canonicalLocation', 'index.html'),
  extractFunction(src, 'destinationKey', 'index.html'),
  extractFunction(src, 'supplierLocationFor', 'index.html'),
  extractFunction(src, 'pickupRuns', 'index.html'),
], {
  data,
  orderPurchaseLines: (q) => purchaseLines.get(q.id) || [],
  supplierName: (id) => (data.suppliers.find((s) => String(s.id) === String(id)) || {}).name || 'Unknown',
}, ['pickupRuns', 'supplierLocationFor', 'canonicalLocation']);

const supplier = (id, name, location) => ({ id, name, location });
const line = (supplierId, cost, over) => Object.assign({
  it: { productName: 'Item', unit: 'pcs' }, qty: 1, lineCost: cost,
  best: { supplierId }, movedFrom: null,
}, over);
const order = (id, lines) => { const q = { id, items: [] }; purchaseLines.set(id, lines); return q; };
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const reset = () => {
  purchaseLines.clear();
  data.suppliers = [
    supplier('S1', 'Katwe Steel', 'Katwe'),
    supplier('S2', 'Katwe Cement Depot', 'katwe'),   // lowercase on purpose
    supplier('S3', 'Mabati Point', 'Katwe'),
    supplier('S4', 'Ndeeba Timber', 'Ndeeba'),
    supplier('S5', 'Nowhere Traders', ''),
  ];
  data.presetLocations = ['Katwe', 'Ndeeba'];
};

/* ---------- 1. one place, several suppliers -------------------------- */
{
  reset();
  const orders = [
    order(1, [line('S1', 400000), line('S2', 620000), line('S4', 110000)]),
    order(2, [line('S3', 1350000)]),
  ];
  const { runs } = scope.pickupRuns(orders);

  eq(runs.length, 2, 'four suppliers across two places is two trips');
  eq(runs[0].label, 'Katwe', 'the place with the most stops leads');
  eq(runs[0].suppliers.length, 3, 'and it carries all three of its suppliers');
  eq(runs[0].total, 400000 + 620000 + 1350000, 'with the money the trip needs');
  eq(runs[0].orderCount, 2, 'counted across both orders it serves');
  eq(runs[0].lines.length, 3, 'and every line to collect there');

  // Within a place, the biggest supplier first: that is the stop worth
  // getting right if the morning runs short.
  eq(runs[0].suppliers[0].name, 'Mabati Point', 'the largest stop is named first');
  eq(runs[0].suppliers[0].total, 1350000, 'with what is owed there');
  eq(runs[0].suppliers[2].name, 'Katwe Steel', 'and the smallest last');

  eq(runs[1].label, 'Ndeeba', 'then the single-supplier place');
  eq(runs[1].suppliers.length, 1, 'with its one stop');
}

/* ---------- 2. a spelling is not a second place ---------------------- */
{
  // "katwe" was typed by somebody in a hurry. It is the same yard, the
  // same trip, and splitting it would send the buyer to Katwe twice.
  const { runs } = scope.pickupRuns([order(1, [line('S1', 100), line('S2', 200)])]);
  eq(runs.length, 1, 'a lowercase entry does not become its own trip');
  eq(runs[0].label, 'Katwe', 'and the place keeps the spelling the shop settled on');
  eq(runs[0].suppliers.length, 2, 'with both suppliers under it');

  /* That case is carried by the preset list -- canonicalLocation turns
     "katwe" into the agreed "Katwe" before the grouping ever sees it, so
     it does not actually exercise the key.

     A place NOT in the presets is where the key does the work. Nobody
     has agreed a spelling for Bwaise, so the two records keep the two
     spellings and only the key merges them. A mutation run removing it
     passed the check above and failed this one. */
  reset();
  data.presetLocations = [];
  data.suppliers = [
    supplier('B1', 'Bwaise Hardware', 'Bwaise'),
    supplier('B2', 'Bwaise Poles', 'bwaise'),
    supplier('B3', 'Bwaise Sand', ' Bwaise  '),   // stray spacing too
  ];
  const loose = scope.pickupRuns([order(1, [line('B1', 100), line('B2', 200), line('B3', 300)])]);
  eq(loose.runs.length, 1,
    'three spellings of one place with no preset to agree on is still one trip');
  eq(loose.runs[0].suppliers.length, 3, 'with all three stops under it');
  eq(loose.runs[0].total, 600, 'and the whole trip\'s money in one figure');
}

/* ---------- 3. stops outrank money ----------------------------------- */
{
  reset();
  // Ndeeba is worth more than Katwe, but Katwe is two stops in one trip.
  const { runs } = scope.pickupRuns([
    order(1, [line('S1', 100000), line('S3', 100000), line('S4', 5000000)]),
  ]);
  eq(runs[0].label, 'Katwe',
    'two stops in one place come before one stop worth twenty-five times as much — the trip is the expensive part');
  eq(runs[1].label, 'Ndeeba', 'and the larger single stop follows');

  // Equal stops fall back to money, or the order would be arbitrary.
  reset();
  const tie = scope.pickupRuns([order(1, [line('S1', 100000), line('S4', 900000)])]);
  eq(tie.runs[0].label, 'Ndeeba', 'with one stop each, the bigger sum leads');
}

/* ---------- 4. nothing is quietly dropped ---------------------------- */
{
  reset();
  const { runs, noLocation, unpriced } = scope.pickupRuns([
    order(1, [
      line('S1', 400000),
      line('S5', 24000),                                  // supplier has no location
      line(null, null, { lineCost: null, best: null }),   // nothing ranked at all
    ]),
  ]);

  eq(runs.length, 1, 'only the placeable line makes a trip');
  eq(noLocation.length, 1, 'the supplier with no location is held aside, not folded into a trip');
  eq(noLocation[0].label, 'Nowhere Traders', 'and named by its supplier, since there is no place to name it by');
  eq(noLocation[0].total, 24000, 'carrying its money, so the total to take is still right');
  eq(unpriced.length, 1, 'and a line nothing ranked is named too');

  /* The failure this prevents. A line missing from the buying trip is not
     a display problem -- it is an order that comes back one item short,
     discovered at the counter. */
  const placed = runs.reduce((s, r) => s + r.lines.length, 0)
    + noLocation.reduce((s, r) => s + r.lines.length, 0) + unpriced.length;
  eq(placed, 3, 'every line is accounted for somewhere: on a trip, held aside, or flagged');
}

/* ---------- 5. where the money is really spent ----------------------- */
{
  reset();
  /* The order was quoted on Ndeeba Timber; Katwe Steel is cheaper today,
     so `best` ranks Katwe. The trip must go to Katwe -- grouping on the
     quoted supplier would send the buyer to the wrong yard, and the money
     would be counted against a place nobody visits. */
  const { runs } = scope.pickupRuns([
    order(1, [line('S1', 400000, { movedFrom: 'S4', it: { productName: 'Iron bars', unit: 'pcs' } })]),
  ]);
  eq(runs.length, 1, 'one trip');
  eq(runs[0].label, 'Katwe', 'to where the money will actually be spent, not where it was quoted');
  eq(runs[0].suppliers[0].name, 'Katwe Steel', 'and the stop is the supplier being bought from');
}

/* ---------- 6. an empty board ---------------------------------------- */
{
  reset();
  const none = scope.pickupRuns([]);
  eq(none.runs.length, 0, 'nothing to buy is no trips');
  eq(none.noLocation.length, 0, 'nothing held aside');
  eq(none.unpriced.length, 0, 'and nothing flagged');

  const stockOnly = scope.pickupRuns([order(1, [])]);
  eq(stockOnly.runs.length, 0, 'an order filled entirely from the shelf sends nobody anywhere');

  // A supplier that has since been deleted still has to go somewhere.
  reset();
  const gone = scope.pickupRuns([order(1, [line('S404', 5000)])]);
  eq(gone.runs.length, 0, 'a supplier no longer on file has no location to cluster by');
  eq(gone.noLocation.length, 1, 'so it is held aside rather than thrown away');
  eq(gone.noLocation[0].total, 5000, 'with its money still counted');
}

/* ---------- 7. the banner and the panel it opens --------------------- */
{
  /* It shares a full-width strip above the board with the cash banner
     rather than sitting inside the Being Prepared column: at 244px a
     column cannot hold two figures side by side. The group it is asked
     about is unchanged -- what Being Prepared needs bought. */
  t.check(/const prepGroup = quotes\.filter\(q=>q\.status==='preparing'\)/.test(src)
    && /pickupRunsBannerHTML\(prepGroup\)/.test(src),
    'the banner is asked about Being Prepared, where the buying is decided');
  t.check(/<div class="sq-strip">\$\{cashToBuyBannerHTML\(prepGroup\)\}\$\{pickupRunsBannerHTML\(prepGroup\)\}<\/div>/.test(src),
    'and shares one line with the cash figure — what it costs beside where to go');
  t.check(/if\(pickupsBanner\) pickupsBanner\.addEventListener\('click', openPickupRuns\)/.test(src),
    'and opens the panel');

  // Shared with the delivery carousel rather than copied: the two fiddly
  // parts of that track -- counting the gap into the stride, and rounding
  // to a card before stepping -- are exactly the kind that get fixed once
  // and stay broken in a duplicate.
  t.check(/function wireRunCarousel\(trackId, prevId, nextId\)/.test(src),
    'the sideways track is one implementation taking ids');
  t.check(/wireRunCarousel\('dr_track', 'dr_prev', 'dr_next'\)/.test(src)
    && /wireRunCarousel\('pr_track', 'pr_prev', 'pr_next'\)/.test(src),
    'used by both the delivery runs and the pickup runs');

  const fn = (/function wireRunCarousel[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(!/openModal\(/.test(fn),
    'and it wires the track without opening anything — which modal to show is the caller\'s business');
  t.check(/if\(track && prev && next\)/.test(fn),
    'guarded, since a board with nothing to buy renders no track at all');
}

process.exit(t.done() ? 1 : 0);
