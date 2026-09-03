#!/usr/bin/env node
'use strict';
/*
 * Sell the dead stock.
 *
 * 5,310,000 across 2,207 units, unsold for over 60 days — more than
 * twice the 2,608,644 this shop holds in cash, and most of that cash
 * belongs to consignors. The forecast line goes 862,512 below zero
 * inside the month. Clearing a quarter of it is about 1,300,000 of the
 * shop's own money back WITHOUT ASKING A DEBTOR FOR ANYTHING.
 *
 * The Manager has advised exactly that for weeks. It is one of the 23
 * advised moves out of 25 that were never acted on, and the reason was
 * plain: `dashInventoryHealth` knew the TOTAL and threw the per-line
 * detail away at the end of every walk, so the one screen naming the
 * problem could not show a single thing to sell. Advice with no
 * mechanism under it is advice nobody can act on.
 *
 * Four laws hold this together:
 *
 *   ONE READING  dashInventoryHealth is derived from stockAgeRows, not
 *       computed a second time. The dashboard card, the Manager's
 *       dead-stock target and this screen quote the same figure at the
 *       owner, and two walks are two answers.
 *   DERIVED, NEVER INVENTED  "likely to take it" means HAS TAKEN IT.
 *       A line nobody has bought comes back with no buyers and the
 *       screen says so — on the one screen where the owner is about to
 *       pick up a phone, a guessed name is worse than none.
 *   THE COST IS THE MONEY ALREADY SPENT  not what a replacement would
 *       cost today. Clearing is a decision about money that has gone,
 *       and on stock that has sat sixty days the two differ.
 *   BELOW COST IS SAID, NEVER BLOCKED  cash now against stock forever
 *       is a real decision a shop sometimes has to make, and it is the
 *       owner's. The app names the loss in shillings across the whole
 *       holding and leaves the tap where it is.
 *
 * Run: node test/dead-stock.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('dead stock');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const TODAY = '2026-08-29';
const ago = (d) => new Date(Date.parse(TODAY + 'T00:00:00Z') - d * 86400000).toISOString().slice(0, 10);

/* A shelf with one of everything that matters:
     P1  moved last week            -> alive
     P2  quiet 90 days, costed      -> dead, and the biggest money
     P3  quiet 70 days, no lot cost -> dead, costed at replacement
     P4  never sold, no price at all -> dead, and cannot be judged
     P5  quiet 80 days, consigned   -> dead, and not the shop's to discount
     P6  quiet 65 days, zero stock  -> not on the shelf, so not here    */
const products = [
  { id: 'P1', name: 'Fast Mover' }, { id: 'P2', name: 'Runners' },
  { id: 'P3', name: 'Uncosted' }, { id: 'P4', name: 'Never Sold' },
  { id: 'P5', name: 'Consigned' }, { id: 'P6', name: 'Sold Out' },
];
const stock = { P1: 10, P2: 12, P3: 8, P4: 5, P5: 6, P6: 0 };
const fifo = { P1: 1000, P2: 55000, P3: null, P4: null, P5: 9000 };

const data = {
  presetDeadStockDays: 60,
  presetClearance: {},
  products,
  customers: [
    { id: 'C1', name: 'Jackson', phone: '0772 111 222' },
    { id: 'C2', name: 'Mulongo', phone: '0700 333 444' },
  ],
  stockLog: [
    { key: 'P1', type: 'sale', date: ago(7) },
    { key: 'P2', type: 'sale', date: ago(90) },
    { key: 'P2', type: 'restock', date: ago(3) },   // a restock is not a customer
    { key: 'P3', type: 'sale', date: ago(70) },
    { key: 'P5', type: 'sale', date: ago(80) },
    { key: 'P6', type: 'sale', date: ago(65) },
  ],
  stockLots: { P5: [{ qty: 6, cost: 9000, consign: true }] },
  savedQuotes: [
    { id: 1, customerId: 'C1', invoiced: true, voided: false, invoicedAt: ago(90),
      client: { name: 'Jackson' }, items: [{ productId: 'P2', variantIdx: null, qty: 9, sellPrice: 70000 }] },
    { id: 2, customerId: 'C2', invoiced: true, voided: false, invoicedAt: ago(120),
      client: { name: 'Mulongo' }, items: [{ productId: 'P2', variantIdx: null, qty: 4, sellPrice: 68000 }] },
    // A counter sale: real money, but nobody to ring about it.
    { id: 3, customerId: null, counterSale: true, invoiced: true, voided: false, invoicedAt: ago(95),
      client: { name: 'Walk-in' }, items: [{ productId: 'P4', variantIdx: null, qty: 3, sellPrice: 9000 }] },
    // Voided, and never invoiced: neither is a purchase.
    { id: 4, customerId: 'C1', invoiced: true, voided: true, invoicedAt: ago(50),
      client: { name: 'Jackson' }, items: [{ productId: 'P2', variantIdx: null, qty: 99, sellPrice: 70000 }] },
    { id: 5, customerId: 'C1', invoiced: false, voided: false, date: ago(20),
      client: { name: 'Jackson' }, items: [{ productId: 'P2', variantIdx: null, qty: 99, sellPrice: 70000 }] },
  ],
};

const CHAIN = ['stockAgeRows', 'deadStockRows', 'deadStockQuietDays', 'deadStockBuyers',
  'clearanceFor', 'consignmentUnitCostForKey', 'setClearancePrice',
  'markClearanceOffered', 'unmarkClearanceOffered', 'dashInventoryHealth',
  'clearanceOffers', 'clearanceOfferMessage', 'lastClearancePricePaid'];

let saved = 0;
let scope = null; let err = null;
try {
  scope = compileScope(CHAIN.map((n) => extractFunction(src, n, 'index.html')), {
    data,
    todayISO: () => TODAY,
    saveData: () => { saved++; },
    allProductVariantEntries: () => products.map((p) => ({ p, variantIdx: null })),
    getStockQty: (pid) => stock[pid] || 0,
    getFIFOUnitCost: (pid) => (fifo[pid] == null ? null : fifo[pid]),
    rankedPriceRows: (pid) => (pid === 'P4' ? [] : [{ wholesale: 1 }]),
    purchasePriceAtQty: () => 500,
    productDisplayLabel: (p) => p.name,
    stockKey: (pid, vi) => ((vi == null || vi === '') ? pid : `${pid}::${vi}`),
    contactPhones: (c) => [c && c.phone].filter(Boolean),
    daysSinceDate: (d) => Math.round((Date.parse(TODAY + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 86400000),
    anShiftDate: (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10),
    quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US'),
  }, CHAIN);
} catch (e) { err = e; }
t.check(!!scope, `the clearance chain compiles${err ? ` (${err.message})` : ''}`);

(async () => {

/* ---------- 1. what is sitting there ---------------------------------- */
if (scope) {
  const rows = scope.deadStockRows(TODAY);
  const by = (name) => rows.find((r) => r.line === name);

  eq(rows.map((r) => r.line).join(','), 'Runners,Consigned,Uncosted,Never Sold',
    'the dead lines, WORST MONEY FIRST — which is the order a person clearing a shelf works in');
  t.check(!by('Fast Mover'), 'a line that sold last week is not dead');
  t.check(!by('Sold Out'), 'and one with nothing on the shelf is not sitting there at all');

  eq(by('Runners').value, 12 * 55000, 'each line carries what the money in it comes to');
  eq(by('Runners').daysQuiet, 90, 'and how long it has been quiet');
  eq(by('Runners').qty, 12, 'and how many are standing there');

  /* A RESTOCK IS NOT A CUSTOMER. P2 moved three days ago — inwards. A
     line the shop keeps buying and never selling is the worst kind of
     dead, and reading any movement as life would hide exactly that. */
  t.check(by('Runners').dead === true,
    'a line restocked last week but not SOLD in ninety days is dead — stock arriving is not stock leaving');

  eq(by('Never Sold').daysQuiet, null, 'a line that has never sold has no quiet days to report');
  t.check(by('Never Sold').dead === true, 'and is dead, which is what never having sold means');
}

/* ---------- 2. the cost, and when there is none ----------------------- */
if (scope) {
  const rows = scope.deadStockRows(TODAY);
  const by = (name) => rows.find((r) => r.line === name);

  eq(by('Runners').costKnown, true, 'a line with a FIFO cost knows what it cost');
  eq(by('Runners').costFrom, 'fifo', 'from the lots actually sitting there');

  /* NOT WORTH NOTHING. Stock counted in rather than bought has no FIFO
     cost; valuing it at zero understates the shelf by however much of it
     that is, so it falls back to what replacing it would cost — and says
     which of the two it used, because a clearance judged against a
     replacement price is a different claim. */
  eq(by('Uncosted').costFrom, 'registry', 'one with no lot cost falls back to what replacing it would cost');
  eq(by('Uncosted').costKnown, true, 'and can still be judged');
  eq(by('Uncosted').unitCost, 500, 'at that figure');

  /* AND WHERE THERE IS NEITHER, IT SAYS SO. A line with no lot cost and
     no supplier price anywhere cannot be judged at all, and the screen
     has to admit that rather than price it against a nought. */
  eq(by('Never Sold').costKnown, false, 'a line with no cost anywhere knows it has none');
  eq(by('Never Sold').costFrom, 'none', 'and names which of the two it is missing');
}

/* ---------- 3. one reading, two readers ------------------------------- */
if (scope) {
  const health = scope.dashInventoryHealth();
  const rows = scope.stockAgeRows(TODAY);
  const dead = rows.filter((r) => r.dead);

  eq(health.deadValue, dead.reduce((s, r) => s + r.value, 0),
    'the dashboard total is the sum of the very rows the screen lists — one walk, so the card and the screen cannot argue about what is dead');
  eq(health.deadQty, dead.reduce((s, r) => s + r.qty, 0), 'and so is the unit count');
  eq(health.fastValue + health.deadValue, health.totalValue, 'and the two halves are the whole shelf');
}

/* ---------- 4. who has actually taken it ------------------------------ */
if (scope) {
  const buyers = scope.deadStockBuyers('P2');
  eq(buyers.map((b) => b.name).join(','), 'Jackson,Mulongo',
    'the customers who have bought this line, most units first');
  eq(buyers[0].units, 9, 'with what each of them took');
  eq(buyers[0].phone, '0772 111 222', 'and a number to reach them on');

  eq(buyers.reduce((s, b) => s + b.units, 0), 13,
    'a voided order and an uninvoiced one are not purchases and are counted in neither');

  /* A COUNTER SALE IS NOT A CUSTOMER. Real money, and nobody to ring. */
  eq(scope.deadStockBuyers('P4').length, 0,
    'a line sold only over the counter has NO buyer to offer it to — there is nobody there, and inventing one is the worst thing this screen could do');

  eq(scope.deadStockBuyers('P5').length, 0, 'and a line nobody has ever bought has none either');
}

/* ---------- 5. what a price would mean -------------------------------- */
if (scope) {
  const rows = scope.deadStockRows(TODAY);
  const runners = rows.find((r) => r.line === 'Runners');

  const good = scope.clearanceFor(runners, 60000);
  eq(good.pays, true, 'a price over cost pays');
  eq(good.keptPct, 8, 'and says what share of it the shop keeps');
  eq(good.raises, 60000 * 12, 'and what the whole holding would raise');
  eq(good.shortAll, 0, 'with nothing lost');

  /* BELOW COST IS SAID, NEVER BLOCKED. */
  const under = scope.clearanceFor(runners, 40000);
  eq(under.pays, false, 'a price under cost does not pay, and says so');
  eq(under.shortEach, 15000, 'naming the loss on each');
  eq(under.shortAll, 15000 * 12, 'and across every unit standing there');
  eq(under.raises, 40000 * 12, 'while still saying what it would put back in the drawer');
  t.check(under !== null,
    'and it is RETURNED, not refused — cash now against stock forever is the shop’s decision, not the app’s');

  /* THE COST IS THE MONEY ALREADY SPENT. priceRuleForTarget does this
     arithmetic on the cheapest supplier TODAY, which is the right cost
     for matching a rival and the wrong one for clearing a shelf. */
  const fn = extractFunction(src, 'clearanceFor', 'index.html');
  t.check(!/ourCostFor\(/.test(fn),
    'the clearance is judged against what the goods actually cost, never against what replacing them would cost today');

  const fallback = scope.clearanceFor(rows.find((r) => r.line === 'Uncosted'), 700);
  eq(fallback.pays, true, 'a line costed off the registry can still be judged');

  /* A FIGURE NOBODY CAN STAND BEHIND IS WORSE THAN NONE. */
  const blind = scope.clearanceFor(rows.find((r) => r.line === 'Never Sold'), 700);
  t.check(blind != null, 'a line with no cost anywhere still takes a price');
  eq(blind.cost, null, 'but carries no cost');
  eq(blind.pays, null, 'and refuses to say whether it pays, rather than measuring it against a nought');
  eq(blind.raises, 700 * 5, 'while still saying what it would put in the drawer, which IS knowable');

  /* SOMEBODY ELSE'S GOODS ARE NOT THE SHOP'S TO DISCOUNT. What is owed
     on a consigned unit is owed whatever it sells for, so a price under
     that comes out of the owner's own pocket. */
  const cons = scope.clearanceFor(rows.find((r) => r.line === 'Consigned'), 7000);
  eq(cons.consignedCost, 9000, 'a consigned line knows what will be owed on it');
  eq(cons.owesConsignor, 2000 * 6,
    'and a price under that is named as money out of the owner’s own pocket — a different loss from selling your own stock cheap');
  eq(scope.clearanceFor(rows.find((r) => r.line === 'Runners'), 40000).owesConsignor, 0,
    'while a line that is the shop’s own owes nobody anything');
}

/* ---------- 6. marking, and taking it back ---------------------------- */
if (scope) {
  const before = saved;
  scope.setClearancePrice('P2', 45000);
  eq(data.presetClearance.P2.price, 45000, 'a clearance price is written down');
  eq(data.presetClearance.P2.setOn, TODAY, 'with the day it was set');
  t.check(saved > before, 'and saved, so the other device sees it');

  eq(scope.deadStockRows(TODAY).find((r) => r.line === 'Runners').clearance, 45000,
    'and the row carries it back');

  scope.markClearanceOffered('P2');
  eq(data.presetClearance.P2.offeredOn, TODAY,
    'taking the offer away is stamped — the app cannot see WhatsApp, so it records that the message left the screen');
  scope.unmarkClearanceOffered('P2');
  t.check(!data.presetClearance.P2.offeredOn, 'and can be told it did not go');

  scope.setClearancePrice('P2', 0);
  t.check(!data.presetClearance.P2,
    'clearing the figure removes the mark entirely — a clearance thought better of should leave nothing behind');
}

/* ---------- 7. the offer ---------------------------------------------- */
if (scope) {
  scope.setClearancePrice('P2', 45000);
  const offers = scope.clearanceOffers(TODAY);

  eq(offers.length, 2, 'an offer for each customer who has taken a marked line');
  eq(offers[0].name, 'Jackson', 'the one who took most, first');
  eq(offers[0].lines.length, 1, 'carrying only the lines they have a history with');
  eq(offers[0].lines[0].line, 'Runners', 'named');

  const msg = scope.clearanceOfferMessage(offers[0], offers[0].lines, { name: 'Telagon Hardware', phone: '0750016750' });
  t.check(/Hello Jackson/.test(msg), 'the message opens to them by name');
  t.check(/bought from us before/.test(msg),
    'and says why they are being written to — this is not a circular, and must not read as one');
  t.check(/\*Runners\* — 45,000 each/.test(msg), 'naming the line and the price');
  t.check(/12 left/.test(msg), 'and how many are there, which is what makes it an offer');
  t.check(/You last took Runners at 70,000, so that is 25,000 off/.test(msg),
    'and what THEY last paid, which is the one fact that turns a price into an offer');
  t.check(/Telagon Hardware · 0750016750/.test(msg), 'signed by the shop');

  /* NEVER A LINE THEY DO NOT BUY. */
  scope.setClearancePrice('P4', 3000);
  const wider = scope.clearanceOffers(TODAY);
  t.check(wider.every((b) => b.lines.every((l) => l.line !== 'Never Sold')),
    'a line only ever sold over the counter reaches nobody’s message — there is no history to write to');

  /* AND NEVER A PRICE NOBODY SET. */
  scope.setClearancePrice('P2', 0);
  scope.setClearancePrice('P4', 0);
  eq(scope.clearanceOffers(TODAY).length, 0,
    'with nothing marked there is nothing to offer — an offer with no price in it is not an offer');
}

/* ---------- 8. what they last paid ------------------------------------ */
if (scope) {
  eq(scope.lastClearancePricePaid({ customerId: 'C1', name: 'Jackson' }, 'P2'), 70000,
    'what a customer last paid for a line is read off their own orders');
  eq(scope.lastClearancePricePaid({ customerId: 'C2', name: 'Mulongo' }, 'P2'), 68000,
    'and each of them has their own figure — a price is a thing agreed with a person');
  eq(scope.lastClearancePricePaid({ customerId: 'C1', name: 'Jackson' }, 'P5'), null,
    'and where nothing says, it is NULL rather than a guess — the message leaves the sentence out entirely');
}

/* ---------- 9. the screen, and the Manager ---------------------------- */
{
  /* THE SCREEN IS NOW CALLED renderPricing.
     Clearance and Margin were merged: they asked the same question about
     one shelf -- a line is selling and keeping enough, selling but thin,
     or not selling at all -- and the last two are both a price decision.
     Every assertion below is the one that was here before; only the name
     of the function that has to satisfy it changed. What this file
     guards is unchanged: the screen reads the one shelf walk, a price is
     confirmed, both below-cost cases are named and neither is blocked,
     a line nobody has bought says so, and what SHIPS on WhatsApp is what
     is in the box rather than the app's draft. */
  const panel = extractFunction(src, 'renderPricing', 'index.html');
  /* ONE HOP, because one screen now draws two readings. renderPricing
     builds its queue from pricingRows(), and pricingRows() is where the
     shelf walk is read. The guarantee is unchanged and is checked across
     both halves of it: the screen must not walk the shelf itself, and
     the walk it is handed must be deadStockRows() rather than a second
     reading that could disagree with the Manager's. */
  const unified = extractFunction(src, 'pricingRows', 'index.html');
  t.check(/pricingRows\(\)/.test(panel) && /deadStockRows\(\)/.test(unified),
    'the screen reads the one shelf walk');
  t.check(/waComposeUrl\(btn\.dataset\.phone, msgFor\(btn\.dataset\.who\)\)/.test(panel),
    'sending opens WhatsApp with what is IN THE BOX — the owner’s edits ship, not the app’s draft');
  t.check(/confirm\(/.test(panel),
    'and setting a price is confirmed, like every other price decision in this app');
  t.check(/out of your own pocket/.test(panel) && /Cash now against stock forever is your call/.test(panel),
    'the below-cost cases are both named on the screen, and neither is blocked');
  t.check(/nobody has ever bought this/.test(panel),
    'a line with no buyers says so rather than showing an empty list');

  const badge = extractFunction(src, 'renderPricingBadge', 'index.html');
  t.check(/deadStockRows\(\)/.test(badge),
    'the rail badge counts from the same reading, so the number and the list cannot disagree');
  /* WHAT IS DEAD, NOT WHAT IS DEALT WITH. It counted lines the owner had
     MARKED and read "1" beside a shelf holding 22 dead lines worth
     5,310,000 — the one place that could have said money was sitting
     still instead reported one small errand. Every other badge on the
     rail counts work WAITING: debtors owing, lines under target,
     debtors to chase. */
  t.check(!/r\.clearance != null/.test(badge),
    'and it counts what is DEAD, not what the owner has already marked — every other badge on the rail counts work waiting');
  /* ONE SCREEN, ONE BADGE, so the tooltip now names BOTH halves rather
     than one. The old assertion pinned the exact words 'line(s) sitting
     dead' because there were two badges on the rail and each had to say
     which of the two readings it was counting. There is one badge now,
     over one screen, and it counts lines under target PLUS lines sitting
     dead -- so what it must still do is name what it counted, which is
     what is checked. A badge whose tooltip named only one half would be
     the fault this assertion was written against. */
  t.check(/sitting dead/.test(badge) && /under target/.test(badge),
    'and its tooltip names both halves it is counting, not one of them');

  const at = src.indexOf('dead_stock: (()=>{');
  const pulse = src.slice(at, at + 1400);
  t.check(at > 0, 'the pulse block is found');
  t.check(/worst_lines/.test(pulse) && /deadStockRows\(today\)/.test(pulse),
    'the Manager is given the LINES, not just the total it has been repeating at this shop for weeks');
  t.check(/lines_marked_to_clear/.test(pulse),
    'and what the owner has already dealt with, so the advice can move on to the rest');
  t.check(/buyers_who_took_it_before/.test(pulse),
    'with whether there is anybody to sell each one to — a line with no buyer needs different advice');
}

})().then(() => {
  process.exit(t.done() ? 1 : 0);
}).catch((e) => { console.error(e); process.exit(1); });
