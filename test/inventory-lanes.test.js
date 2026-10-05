/*
 * Inventory's three states: the shelf sorted into Buy now, Healthy and
 * Dead money.
 *
 * What these checks hold is the one thing the view could get wrong
 * without anybody seeing it on screen: which lane a line lands in.
 *
 *   - Buy now is the shop's own two warnings: under the floor it set, or
 *     running out inside its cover at the pace it has actually sold.
 *   - A line with a pace SOLD in the last thirty days, so the age record
 *     cannot call it idle; it is dead money only when that pace would
 *     take longer than the quiet window to clear it.
 *   - A line with no pace is dead money when the age record says so, and
 *     is otherwise never given a day count it does not have.
 *   - Stock with no cost, and empty shelves, are named, never zoned.
 *
 * And the amount to order is the gap to the cover or the floor, whichever
 * is larger, at the cost last paid -- never priced at nothing.
 *
 * Run: node test/inventory-lanes.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('inventory lanes');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const risk = [];
const age = [];
const scope = compileScope([
  extractFunction(src, 'invCoverDays', 'index.html'),
  extractFunction(src, 'invZoneRows', 'index.html'),
], {
  data: { presetRestockCoverDays: 14 },
  stockKey: (id, v) => (v == null ? id : `${id}::${v}`),
  restockRiskRows: () => risk,
  stockAgeRows: () => age,
  deadStockQuietDays: () => 60,
}, ['invZoneRows']);

const line = (id, o) => Object.assign({ p: { id, name: id }, variantIdx: null, qty: 10, unitCost: 1000, value: 10000,
  uncosted: false, belowFloor: false, rule: null }, o || {});
const zoneOf = (id, lines) => scope.invZoneRows(lines).find((z) => z.key === id);

risk.length = 0; age.length = 0;
risk.push({ key: 'fast', dailyRate: 2, daysLeft: 5 });
risk.push({ key: 'fine', dailyRate: 0.5, daysLeft: 20 });
risk.push({ key: 'glut', dailyRate: 0.1, daysLeft: 100 });
risk.push({ key: 'agedButSelling', dailyRate: 0.5, daysLeft: 20 });
age.push({ key: 'agedButSelling', dead: true, daysQuiet: 90, lastSold: '2026-06-01' });
age.push({ key: 'idle', dead: true, daysQuiet: 74, lastSold: '2026-07-13' });
age.push({ key: 'fresh', dead: false, daysQuiet: 3, lastSold: '2026-09-22' });

const lines = [
  line('fast'),
  line('fine'),
  line('floor', { belowFloor: true, rule: { minUnits: 20 }, qty: 5 }),
  line('glut'),
  line('agedButSelling'),
  line('idle'),
  line('fresh'),
  line('nocost', { uncosted: true, unitCost: null, value: null }),
  line('empty', { qty: 0, value: null }),
];

eq(zoneOf('fast', lines).zone, 'buy', 'a line that runs out inside the cover is Buy now');
eq(zoneOf('fine', lines).zone, 'ok', 'a line with cover to spare is Healthy');
eq(zoneOf('floor', lines).zone, 'buy', 'a line under its own floor is Buy now even with no pace to measure');
eq(zoneOf('glut', lines).zone, 'dead', 'more stock than the quiet window at its own pace is Dead money');
eq(zoneOf('agedButSelling', lines).zone, 'ok',
  'a line that sold in the last 30 days is never idle, whatever the age record says');
eq(zoneOf('idle', lines).zone, 'dead', 'no pace and no sale inside the quiet window is Dead money');
eq(zoneOf('fresh', lines).zone, 'ok', 'no pace yet but a recent sale is not dead');
t.check(zoneOf('fresh', lines).daysLeft === null, 'and it is given no day count it does not have');
eq(zoneOf('nocost', lines).zone, 'nocost', 'stock with no cost is named, not zoned');
eq(zoneOf('empty', lines).zone, 'empty', 'and so is an empty shelf');

// What to order: to the cover or the floor, whichever is more, at last cost.
eq(zoneOf('fast', lines).need, 18, 'the gap to 14 days of cover at 2 a day, less the 10 on the shelf');
eq(zoneOf('fast', lines).needCost, 18000, 'priced at the cost last paid');
eq(zoneOf('floor', lines).need, 15, 'under its floor with no pace: back up to the floor');
eq(zoneOf('fine', lines).need, 0, 'nothing is ordered for a healthy line');
const unpriced = scope.invZoneRows([line('fast', { unitCost: null })])[0];
t.check(unpriced.need === 18 && unpriced.needCost === null,
  'a line with no cost has a quantity to order but no price -- never priced at nothing');

// The per-line cover wins over the shop's.
eq(scope.invZoneRows([line('fine', { rule: { coverDays: 30 } })])[0].zone, 'buy',
  'a line that carries its own 30-day cover is Buy now at 20 days left');

// The wiring the screen depends on.
/* THE LANES VIEW IS GONE, AND THESE FOUR ASSERTIONS CHANGED WITH IT.
   They read "the whole shelf is zoned once per render, for the map",
   "the lanes take only the lines the filters left", "List keeps its rail;
   Lanes puts the open line in its place" and "a long lane names what it
   does not show".

   WHAT THEY MEANT: the screen had two views of the same shelf, a list and
   three side-by-side lanes, and the zoning had to be done once and shared
   or the two would disagree about which lane a line was in; a lane that
   was capped had to say so or it looked like the whole lane.

   WHY THEY STOPPED BEING TRUE: the screen was drawn again from a canvas
   (.design/inventory-v3) as one table with a state segment above it. The
   three lanes became three presses on that segment -- Buy now, Healthy,
   Dead money -- so there is no second view to drift from the first and no
   capped lane to explain. The zoning itself, which is what the checks
   above hold, is unchanged and is still the only place that decides
   which state a line is in.

   WHAT THE NEW ASSERTIONS MEAN: the shelf is zoned once, in the model
   that both the tiles and the table read; the segment is a filter over
   the zones; and its counts are taken over what the search and category
   left, so "Buy now 3" beside a search means three of THOSE. */
const model = extractFunction(src, 'invModel', 'index.html');
t.check(/const zr = invZoneRows\(lines\);/.test(model) && /zByKey/.test(model),
  'the whole shelf is zoned once, in the one model the tiles and the table both read');
const render = extractFunction(src, 'renderInventory', 'index.html');
t.check((render.match(/invModel\(\)/g) || []).length === 1,
  'and a render builds that model once rather than once per piece of the screen');
t.check(/\(m\.zByKey\.get\(invKeyOf\(l\)\) \|\| \{\}\)\.zone === invZone/.test(render),
  'a pressed state lists only the lines in it');
t.check(/const matched = m\.lines\.filter\(l=> \(!hits \|\| hits\.has\(invKeyOf\(l\)\)\) && \(!categoryFilter \|\| l\.p\.category === categoryFilter\)\);/.test(render)
     && /matched\.forEach\(l=>\{/.test(render),
  'and the segment counts what the search and category left, not the whole shelf');

process.exit(t.done() ? 1 : 0);
