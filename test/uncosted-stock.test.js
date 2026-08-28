#!/usr/bin/env node
'use strict';
/*
 * Stock on the shelf with no cost on file.
 *
 * A lot can exist and carry no cost. A stock count entered without one
 * makes one; so does the drift repair's shortfall branch, which books a
 * surplus as an uncosted lot rather than guessing a price for goods
 * nobody priced. Every valuation then reads those units as worth
 * nothing — correctly, and the balance sheet says so in three places and
 * fails a check over it.
 *
 * What was missing was the way back. The app made it easy to create the
 * state, told the shop about it on every statement, and offered nothing
 * to do about it: the only route was to count the units back down and
 * re-enter them as a purchase, which nobody would work out and whose
 * first step throws a bill warning. Naming a problem without a door out
 * of it is only half the job.
 *
 * Two doors, and this file guards both:
 *   — the stock count can carry what the goods cost, so the state need
 *     not be created at all;
 *   — units already uncosted can be priced where they sit, WITHOUT
 *     moving a single unit and without touching a lot that already
 *     carries a cost or belongs to a consignor.
 *
 * Run: node test/uncosted-stock.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('uncosted stock');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { stock: {}, stockLots: {}, products: [], stockLog: [], prices: [] };
const NAMES = ['uncostedStockRows', 'priceUncostedStock', 'shelfValueForKey', 'inventoryValue',
  'stockKey', 'addStockLot', 'applyStockDelta', 'consumeStockLots', 'restoreStockLots',
  'productVariantLabel', 'variantLabel'];
let fns = null, err = null;
try {
  fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')), {
    data: store,
    todayISO: () => '2026-08-28',
    allocRowId: () => 1,
    fmtUGX: (n) => `${Math.round(n).toLocaleString('en-UG')} UGX`,
    // The suggestion is a convenience, not a stored figure — stubbed so
    // these checks are about what gets WRITTEN, never about the prefill.
    rankedPriceRows: () => [],
    purchasePriceAtQty: () => 0,
  }, NAMES);
} catch (e) { err = e; }
t.check(!!fns, `the uncosted-stock routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { uncostedStockRows, priceUncostedStock, inventoryValue, applyStockDelta } = fns;

  const reset = () => {
    store.products = [
      { id: 'P042', name: 'Ceiling Tile 600x600' },
      { id: 'P051', name: 'Nice Door', variants: [{ combo: { Color: 'Red' } }, { combo: { Color: 'Blue' } }] },
    ];
    store.stock = {}; store.stockLots = {}; store.stockLog = [];
  };

  /* ---------- 1. what the reader finds, and what it leaves alone ----- */
  {
    reset();
    store.stock = { 'P042': 50, 'P051::0': 10 };
    store.stockLots = {
      // Ten counted in with a price, forty counted in without one.
      'P042': [{ qty: 10, cost: 31500 }, { qty: 40, cost: null }],
      // Fully costed: this one has nothing to answer for.
      'P051::0': [{ qty: 10, cost: 88000 }],
    };
    const rows = uncostedStockRows();
    eq(rows.length, 1, 'only the shelf carrying a lot with no cost is reported');
    eq(rows[0].key, 'P042', 'named by its stock key');
    eq(rows[0].qty, 40, 'counting the units on the uncosted lots, not the whole shelf');
    eq(rows[0].label, 'Ceiling Tile 600x600', 'and named the way the shop reads it');
    t.check(!rows.some(r => r.key === 'P051::0'),
      'a shelf whose every lot carries a cost is not on the list — there is nothing to ask about it');
  }

  /* ---------- 2. a consignor's uncosted goods are counted apart ------ */
  {
    reset();
    store.stock = { 'P042': 30 };
    store.stockLots = { 'P042': [
      { qty: 10, cost: null },
      { qty: 20, cost: null, consign: 'S1' },
    ] };
    const [row] = uncostedStockRows();
    eq(row.qty, 10, "only the shop's own uncosted units are offered for pricing");
    eq(row.consignQty, 20, 'a consignor’s are counted separately rather than folded in');
    /* Their cost is what the shop owes per unit as they sell. Pricing
       one here would invent a debt to somebody who never agreed it. */
    t.check(row.qty !== 30, 'because putting a figure on those would decide what a supplier is owed');
  }

  /* ---------- 3. pricing writes only where it is entitled to -------- */
  {
    reset();
    store.stock = { 'P042': 60 };
    store.stockLots = { 'P042': [
      { qty: 10, cost: 31500 },              // already priced — evidence
      { qty: 20, cost: null },               // ours, blank
      { qty: 15, cost: null, consign: 'S1' },// not ours
      { qty: 15, cost: null },               // ours, blank
    ] };
    const done = priceUncostedStock('P042', 29000);
    eq(done.priced, 35, 'every one of the shop’s own blank units takes the figure');
    eq(done.blockedByConsign, 15, 'and the consignor’s are reported, not silently skipped');

    const lots = store.stockLots['P042'];
    eq(lots[0].cost, 31500, 'a lot that already had a cost keeps it — a figure somebody recorded is evidence');
    eq(lots[1].cost, 29000, 'a blank one of ours takes the new figure');
    eq(lots[2].cost, null, 'a consignor’s stays blank, because pricing it would change what they are owed');
    eq(lots[3].cost, 29000, 'and so does the second blank one of ours');
    eq(lots.reduce((n, l) => n + l.qty, 0), 60, 'not one unit moved');
    eq(store.stock['P042'], 60, 'and the shelf count is exactly as it was');
  }

  /* ---------- 4. it says so in the log ------------------------------ */
  {
    const row = store.stockLog[store.stockLog.length - 1];
    t.check(!!row, 'the pricing writes itself down');
    eq(row.type, 'correction', 'as a correction');
    eq(row.delta, 0, 'that moved nothing');
    eq(row.cost, 29000, 'carrying the figure it put on');
    t.check(/35 units that had none/.test(row.note),
      `naming how many it costed (${JSON.stringify(row.note)})`);
    t.check(/15 held on consignment left alone/.test(row.note),
      'and how many it could not, so a banner that shrinks by less than expected explains itself');
  }

  /* ---------- 5. the balance sheet stops understating --------------- */
  {
    reset();
    store.stock = { 'P042': 50 };
    store.stockLots = { 'P042': [{ qty: 10, cost: 31500 }, { qty: 40, cost: null }] };
    const before = inventoryValue();
    eq(before.uncostedQty, 40, 'forty units are valued at nothing to begin with');
    eq(Math.round(before.value), 315000, 'so the shelf is worth only what the priced ten cost');

    priceUncostedStock('P042', 30000);
    const after = inventoryValue();
    eq(after.uncostedQty, 0, 'and afterwards nothing on this shelf is uncosted');
    eq(Math.round(after.value), 315000 + 40 * 30000, 'the value the sheet was understating by is now on it');
    eq(uncostedStockRows().length, 0, 'so the screen has nothing left to ask about');
  }

  /* ---------- 6. what it refuses ------------------------------------ */
  {
    reset();
    store.stock = { 'P042': 10 };
    store.stockLots = { 'P042': [{ qty: 10, cost: null }] };
    eq(priceUncostedStock('P042', 'abc'), null, 'a cost that is not a number writes nothing');
    eq(priceUncostedStock('P042', -5), null, 'nor does one below nothing');
    eq(store.stockLots['P042'][0].cost, null, 'and the lot is untouched by either');
    eq(priceUncostedStock('P999', 100), null, 'a key with nothing to price writes nothing');

    /* Zero is a real answer and must go through: goods given free by a
       supplier genuinely cost nothing, and refusing that would leave the
       shop with no way to say so. */
    const done = priceUncostedStock('P042', 0);
    t.check(!!done && done.priced === 10, 'but zero IS a cost — goods that genuinely came free can be said to have');
    eq(store.stockLots['P042'][0].cost, 0, 'and it is stored as nothing, not as unknown');
    eq(uncostedStockRows().length, 0, 'a lot costed at zero is answered, so it stops being asked about');
  }

  /* ---------- 7. a count can carry a cost, so the state need not exist */
  {
    reset();
    store.stock = { 'P042': 10 };
    store.stockLots = { 'P042': [{ qty: 10, cost: 31500 }] };
    applyStockDelta('P042', null, 40, 'correction', 'counted in at 29,000 per piece', 29000);
    eq(store.stock['P042'], 50, 'the shelf goes up by what was counted');
    const lot = store.stockLots['P042'][1];
    eq(lot.qty, 40, 'a lot is added for them');
    eq(lot.cost, 29000, 'carrying what they cost, so they are never uncosted in the first place');
    eq(uncostedStockRows().length, 0, 'and nothing is left for the screen to ask about');

    const log = store.stockLog[store.stockLog.length - 1];
    /* This read `type==='restock'` alone, so a count entered WITH a cost
       put the figure on the lot and then dropped it from the only
       history that could explain the lot. */
    eq(log.cost, 29000, 'and the log row carries the figure, so the raised value can be explained later');
    eq(log.supplierId, null, 'while naming no supplier, because a count bills nobody');
  }

  /* ---------- 7b. blank still means blank --------------------------- */
  {
    reset();
    store.stock = { 'P042': 10 };
    store.stockLots = { 'P042': [{ qty: 10, cost: 31500 }] };
    applyStockDelta('P042', null, 40, 'correction', 'found behind the shelf');
    eq(store.stockLots['P042'][1].cost, null,
      'a count with no cost given still makes an uncosted lot — "nobody knows" and "cost nothing" stay different claims');
    eq(store.stockLog[store.stockLog.length - 1].cost, null, 'and the log claims no figure either');
    eq(uncostedStockRows()[0].qty, 40, 'so the screen picks it up and asks');
  }
}

/* ---------- 7c. the banner reads as English at one unit ------------ */
/* One unit on one shelf is the commonest way a shop first meets this
   screen, and the plural verb made it read "1 unit across 1 product have
   no cost on file" — the kind of sentence that costs a paragraph its
   credibility. Found by rendering it, not by reading the code. */
{
  const capture = { innerHTML: '', querySelectorAll: () => [] };
  const NAMES2 = ['uncostedStockRows', 'stockKey', 'productVariantLabel', 'variantLabel', 'renderUncostedStock'];
  const store2 = { stock: {}, stockLots: {}, products: [{ id: 'P042', name: 'Ceiling Tile 600x600' }], stockLog: [] };
  const r = compileScope(NAMES2.map((n) => extractFunction(src, n, 'index.html')), {
    data: store2, todayISO: () => '2026-08-28', allocRowId: () => 1,
    fmtUGX: (n) => `${Math.round(n)} UGX`,
    esc: (x) => String(x == null ? '' : x),
    rankedPriceRows: () => [], purchasePriceAtQty: () => 0,
    document: { getElementById: () => capture },
  }, NAMES2);
  const text = (stock, lots) => {
    store2.stock = stock; store2.stockLots = lots;
    r.renderUncostedStock();
    return capture.innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const one = text({ P042: 1 }, { P042: [{ qty: 1, cost: null }] });
  t.check(/1 unit has no cost on file\./.test(one), `one unit takes a singular verb (${one.slice(0, 60)})`);
  t.check(!/across 1 product/.test(one), 'and "across 1 product" is not said at all — there is nothing to spread across');
  t.check(/What did it cost you\?/.test(one), 'the question does not ask what ONE thing cost "each"');
  t.check(/it is valued at nothing/.test(one) && /when it sells/.test(one), 'and the consequence agrees with it throughout');
  t.check(/Put a cost on it/.test(one), 'down to the button');

  const many = text({ P042: 50 }, { P042: [{ qty: 40, cost: null }, { qty: 10, cost: 31500 }] });
  t.check(/40 units have no cost on file\./.test(many), 'many units still take the plural');
  t.check(!/across 1 product/.test(many), 'and one product is still not counted out loud');
  t.check(/they cost you, each\?/.test(many), 'where "each" now earns its place');

  const two = text({ P042: 40, 'P051::0': 12 },
    { P042: [{ qty: 40, cost: null }], 'P051::0': [{ qty: 12, cost: null }] });
  t.check(/across 2 products/.test(two), 'and the spread is named once there genuinely is one');
}

/* ---------- 8. the two doors are actually wired to the screen ------- */
{
  t.check(/function renderUncostedStock\(\)/.test(code), 'the Inventory screen reports the uncosted units');
  t.check(/id="invUncosted"/.test(src), 'into an element that exists');
  t.check(/renderUncostedStock\(\);/.test(code.slice(code.indexOf('function renderInventory'))) ||
    /renderStockLotDrift\(\);\s*\n\s*renderUncostedStock\(\);/.test(code),
    'every time the screen renders, so pricing one cannot leave a stale banner');
  t.check(/data-costfix=/.test(code) && /askUncostedStockPrice\(btn\.dataset\.costfix\)/.test(code),
    'each row carries its own button, so one product is answered at a time');

  /* The banner has to say what it will NOT do. "Correcting stock" is
     exactly what this is not, and a shop pressing it has to be sure. */
  const banner = code.slice(code.indexOf('function renderUncostedStock'),
    code.indexOf('function askUncostedStockPrice'));
  t.check(/moves no stock and no\s*\n?\s*money/.test(banner) || /no stock and no/.test(banner),
    'and says plainly that it moves neither stock nor money');
  t.check(/valued at nothing/.test(banner) && /understated/.test(banner),
    'naming what the state is currently costing, rather than only that it exists');

  const ask = code.slice(code.indexOf('function askUncostedStockPrice'));
  t.check(/Consignment screen/.test(ask.slice(0, ask.indexOf('\n}'))),
    'and the question names where a consignor’s goods are settled instead');

  // The cost field on the count screen: present, and only when the count
  // goes UP, since only then are units being added that could carry one.
  t.check(/id="inv_cost_wrap"/.test(src) && /id="inv_cost"/.test(src),
    'the stock count asks what the goods cost');
  t.check(/costWrap\.style\.display = adjusted > 0 \? '' : 'none';/.test(code),
    'only when the count goes up — asking on a count down is a question with no meaning behind it');
  t.check(/const costPerUnit = d > 0 && costInput/.test(code),
    'and it is only read then, so a figure left in the box cannot ride along on a count down');
  t.check(/Leave blank if you do not know/.test(src) || /Blank is a real answer/.test(src),
    'blank is offered as a real answer, because sometimes nobody knows');
}

process.exit(t.done() ? 1 : 0);
