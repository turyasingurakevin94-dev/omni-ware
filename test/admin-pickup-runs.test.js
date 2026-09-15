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
  /* On the console the buying trip is a panel on the rail rather than
     an icon on a lane head: the same derivation, drawn by place, over
     the same group -- what is still to be bought. */
  const panel = extractFunction(src, 'orderTripPanelHTML', 'index.html');
  t.check(/pickupRuns\(orders\)/.test(panel) && /list \|\| beingPreparedOrders\(\)/.test(panel),
    'the rail panel reads the pickup runs over the working stages, where the buying is decided');
  t.check(/\$\{stops\.length\} stop/.test(panel), 'the number of places rides on the panel head');
  t.check(/title="Where to buy from/.test(panel) && /aria-label="Where to buy from/.test(panel),
    'and its act names itself, by hover and to a screen reader');
  t.check(/if\(p\.noLocation\.length\) bits\.push/.test(panel) && /if\(p\.unpriced\.length\) bits\.push/.test(panel),
    'with the two exceptions still surfaced rather than lost');
  t.check(/Nothing on the board has to be bought in/.test(panel) && /Everything bought in has arrived/.test(panel),
    'and nothing to buy says which of the two silences it is');
  t.check(/case 'pickups': openPickupRuns\(\); break;/.test(src), 'and opens the panel');

  /* THE CAROUSEL IS GONE, AND SO IS THE ID CLASH IT CARRIED.

     The buying round, the delivery runs and the buying list were three
     sideways tracks sharing one implementation (wireRunCarousel) and
     three id prefixes, and the reason this block existed at all is that
     one of those prefixes -- pr_ -- belonged to PAYROLL's month stepper,
     so the arrows in this modal silently wired somebody else's buttons.
     All three screens are hairline rows in the board's one dialog now:
     the round is read down the page, so there is no track, no prefix and
     no clash. What is kept from the old block is the half that was never
     about the carousel: Payroll still owns pr_prev and pr_next, and
     nothing else in the file may take them. */
  const payroll = (/<section id="tab-payroll"[\s\S]*?<\/section>/.exec(src) || [''])[0];
  t.check(/id="pr_prev"/.test(payroll) && /id="pr_next"/.test(payroll),
    'pr_prev and pr_next belong to Payroll’s month stepper');
  t.check((src.match(/\sid="pr_prev"/g) || []).length === 1
    && (src.match(/\sid="pr_next"/g) || []).length === 1,
    'and to it alone — two elements sharing an id made one of them unreachable, silently');
  t.check(!/wireRunCarousel\('/.test(src),
    'and no screen opens a sideways track any more — the round is a list you read down');
}

/* ---------- a shop you have no reason to enter is not a stop ---------
 *
 * This screen is a walking order: which places, in which order, carrying
 * how much. A line already bought and on the shelf is none of those
 * things, and leaving it in produced an errand for nothing -- reported
 * from the shop as "2 places to reach · 0 UGX to spend", with every
 * place, supplier and line under it also reading 0 UGX.
 *
 * The buying list keeps those lines deliberately, because there is still
 * an Undo to offer there if a receipt was wrong. Nothing on this screen
 * can act on one, so it is dropped -- and COUNTED, because "nothing here
 * has to be bought in" and "all of it has already arrived" are different
 * facts and only one of them means the buying is done.
 */
{
  data.suppliers = [{ id: 'S1', name: 'Dooba', location: 'Nakasero' },
    { id: 'S2', name: 'Meggo', location: 'Jesco House' }];
  const ln = (o) => Object.assign({
    it: { productName: 'Chrome Pipe', unit: 'Pcs' }, qty: 40,
    best: { supplierId: 'S1' }, lineCost: 262000, settled: false }, o);

  purchaseLines.clear();
  purchaseLines.set(1, [ln(), ln({ best: { supplierId: 'S2' }, lineCost: 420000 })]);
  const live = scope.pickupRuns([{ id: 1 }]);
  t.check(live.runs.length === 2 && live.settled === 0,
    'two places to reach while there is buying to do');

  // Every line already in.
  purchaseLines.set(1, [ln({ settled: true, lineCost: 0 }),
    ln({ best: { supplierId: 'S2' }, settled: true, lineCost: 0 })]);
  const done = scope.pickupRuns([{ id: 1 }]);
  t.check(done.runs.length === 0,
    'and nowhere to reach once they are all on the shelf — not two places worth nothing');
  t.check(done.settled === 2,
    `with the count kept, so the screen can say why it is empty (${done.settled})`);

  // Half and half: the finished one drops out, the live one stays.
  purchaseLines.set(1, [ln({ settled: true, lineCost: 0 }),
    ln({ best: { supplierId: 'S2' }, lineCost: 420000 })]);
  const half = scope.pickupRuns([{ id: 1 }]);
  t.check(half.runs.length === 1 && half.runs[0].label === 'Jesco House',
    'a place whose goods are in drops off the route while the other stays on it');
  t.check(half.runs[0].total === 420000,
    'and the money to carry is only what is still to be bought');
  t.check(half.settled === 1, 'the dropped one still counted');

  /* A settled line is dropped BEFORE the unpriced check, so a line that
     is both already-in and never-priced does not get reported as a
     pricing gap somebody needs to fix. */
  purchaseLines.set(1, [ln({ settled: true, lineCost: null, best: null })]);
  const both = scope.pickupRuns([{ id: 1 }]);
  t.check(both.unpriced.length === 0 && both.settled === 1,
    'a line already in is not also reported as missing a price');
}

/* ---------- and the screen says which silence it is ------------------- */
{
  t.check(/Nowhere to go — all \$\{p\.settled\} bought-in line/.test(src),
    'an empty route says the goods have arrived, not that there was never anything to buy');
  t.check(/Nothing on the board has to be bought in/.test(src),
    'while a board that genuinely buys nothing still says that');
  t.check(/const \{ runs, noLocation, unpriced, settled \} = pickupRuns\(orders\);/.test(src),
    'which needs the count, so the modal reads it');

  /* "0 places to reach · 0 UGX to spend" sat directly above the sentence
     explaining there is nowhere to go -- the same fact twice, the second
     time in figures that mean nothing. The dialog's header is a mono
     count now and it counts what is really there, so an empty round
     reads "0 stops · 0 items" only in the one place, with the sentence
     under it doing the explaining. */
  t.check(/\$\{stops\.length\} stop\$\{stops\.length === 1 \? '' : 's'\} · \$\{lines\} item/.test(src),
    'and the journey header counts the journey rather than repeating it in figures');

  /* The line reads "<product> · <qty> <unit>", so an ellipsis lands on
     the quantity: "Chrome Pipe — 19mm - Light · 40…" tells somebody in a
     shop everything except how many to ask for. */
  const nameCss = (/\.dr-order-name\{[^}]*\}/.exec(src) || [''])[0];
  t.check(!/text-overflow:ellipsis/.test(nameCss),
    `the item line is not truncated (${nameCss.replace(/\s+/g, ' ')})`);
  t.check(!/white-space:nowrap/.test(nameCss), 'it is allowed to wrap');
  t.check(/overflow-wrap:anywhere/.test(nameCss),
    'and a single unbroken product code still breaks rather than escaping the card');
}

process.exit(t.done() ? 1 : 0);
