#!/usr/bin/env node
'use strict';
/*
 * When the shelf and the cost ledger disagree.
 *
 * Two records doing two jobs. data.stock counts what is on the shelf —
 * what the Inventory screen shows and what a stock-take is counted
 * against. The FIFO lots remember what each batch cost. Every ordinary
 * movement writes both in the same breath, so they should never part.
 *
 * They can, and did: a shop found 49 cartons of hinges in the cost
 * ledger against 9 on the shelf. While stock was valued off the lot
 * QUANTITIES that was a money fault — the balance sheet carried forty
 * cartons that did not exist. Valuation reads the count now, so it is
 * no longer that. It is still a real fault: the lots are the queue a
 * sale draws its cost from, so a lot that outlives the goods it was
 * bought for makes the next sales of that product look cheaper than they
 * were, and their margin wrong.
 *
 * So the drift is reported, and can be repaired — by moving the LOTS,
 * never the shelf.
 *
 * Run: node test/stock-lot-drift.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('stock lot drift');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { stock: {}, stockLots: {}, products: [], stockLog: [] };
const NAMES = ['stockKey', 'stockLotDrift', 'repairStockLotDrift', 'consumeStockLots',
  'addStockLot', 'shelfValueForKey', 'inventoryValue', 'productVariantLabel', 'variantLabel'];
let fns = null, err = null;
try {
  fns = compileScope(NAMES.map(n => extractFunction(src, n, 'index.html')),
    { data: store, todayISO: () => '2026-08-28', allocRowId: () => 1 }, NAMES);
}
catch (e) { err = e; }
t.check(!!fns, `the drift routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { stockLotDrift, repairStockLotDrift, inventoryValue } = fns;

  const reset = () => {
    store.products = [
      { id: 'P042', name: 'Normal Mulper — Flat' },
      { id: 'P051', name: 'Nice Door', variants: [{ combo: { Color: 'Red' } }, { combo: { Color: 'Blue' } }] },
    ];
    store.stock = {}; store.stockLots = {}; store.stockLog = [];
  };

  /* ---------- 1. the reported case is found and named --------------- */
  {
    reset();
    // Nine on the shelf; the ledger still carries the two duplicate
    // restocks of twenty on top of the nine.
    store.stock = { 'P042': 9 };
    store.stockLots = { 'P042': [{ qty: 20, cost: 145000 }, { qty: 20, cost: 145000 }, { qty: 9, cost: 145000 }] };
    const rows = stockLotDrift();
    t.check(rows.length === 1, `the one product adrift is found (${rows.length})`);
    t.check(rows[0].onShelf === 9 && rows[0].inLots === 49 && rows[0].drift === 40,
      `with both figures and the gap between them (${rows[0].onShelf} vs ${rows[0].inLots})`);
    t.check(rows[0].label === 'Normal Mulper — Flat',
      `named in words, not as a storage key (${rows[0].label})`);
  }

  /* ---------- 2. agreement is silence ------------------------------- */
  {
    reset();
    store.stock = { 'P042': 9 };
    store.stockLots = { 'P042': [{ qty: 9, cost: 145000 }] };
    t.check(stockLotDrift().length === 0, 'a product whose records agree is not reported');
    store.stock = { 'P042': 0 };
    store.stockLots = { 'P042': [] };
    t.check(stockLotDrift().length === 0, 'and neither is one that is simply out of stock');
  }

  /* ---------- 3. the repair moves the LOTS, never the shelf --------- */
  /*
   * The whole point. The shelf is what somebody counted; the ledger is
   * what drifted from it.
   */
  {
    reset();
    store.stock = { 'P042': 9 };
    store.stockLots = { 'P042': [{ qty: 20, cost: 100000 }, { qty: 20, cost: 120000 }, { qty: 9, cost: 145000 }] };
    repairStockLotDrift('P042');
    t.check(store.stock['P042'] === 9, 'the shelf count is untouched');
    const left = store.stockLots['P042'];
    const leftQty = left.reduce((s, l) => s + l.qty, 0);
    t.check(leftQty === 9, `and the ledger now carries exactly what is there (${leftQty})`);
    /* FIFO: what is still on the shelf is the NEWEST, so the lots that
       outlived the goods are the oldest. The 145,000 batch is the one
       that survives — trimming the other way would price the shelf at
       costs whose goods were sold months ago. */
    t.check(left.length === 1 && left[0].cost === 145000,
      `the oldest are dropped and the newest survive (${JSON.stringify(left)})`);
    t.check(stockLotDrift().length === 0, 'and nothing is left adrift');
  }

  /* ---------- 4. a shortfall admits it does not know the cost ------- */
  {
    reset();
    store.stock = { 'P042': 12 };
    store.stockLots = { 'P042': [{ qty: 5, cost: 145000 }] };
    const row = stockLotDrift()[0];
    t.check(row.drift === -7, `a ledger short of the shelf is reported too (${row.drift})`);
    repairStockLotDrift('P042');
    const left = store.stockLots['P042'];
    t.check(left.reduce((s, l) => s + l.qty, 0) === 12, 'the repair brings it up to the shelf');
    const uncosted = left.filter(l => l.cost == null).reduce((s, l) => s + l.qty, 0);
    t.check(uncosted === 7,
      'with the seven nobody priced carried as uncosted rather than at a guessed price');
    // Which every valuation already reads as worth nothing.
    const v = inventoryValue();
    t.check(v.value === 5 * 145000 && v.uncostedQty === 7,
      `so the shelf is valued at the five that have a cost, and the rest counted apart (${v.value}, ${v.uncostedQty})`);
  }

  /* ---------- 5. a variant is its own line -------------------------- */
  {
    reset();
    store.stock = { 'P051::1': 3, 'P042': 9 };
    store.stockLots = { 'P051::1': [{ qty: 8, cost: 80000 }], 'P042': [{ qty: 9, cost: 145000 }] };
    const rows = stockLotDrift();
    t.check(rows.length === 1 && rows[0].label === 'Nice Door — Blue',
      `a variant drifts on its own and is named with its combo (${rows[0] && rows[0].label})`);
    repairStockLotDrift('P051::1');
    t.check(store.stockLots['P051::1'].reduce((s, l) => s + l.qty, 0) === 3,
      'and is repaired without touching the product beside it');
    t.check(store.stockLots['P042'].reduce((s, l) => s + l.qty, 0) === 9, 'which is left exactly as it was');
  }

  /* ---------- 6. repairing one leaves the others to be decided ------ */
  {
    reset();
    store.stock = { 'P042': 9, 'P051::0': 2 };
    store.stockLots = { 'P042': [{ qty: 49, cost: 145000 }], 'P051::0': [{ qty: 7, cost: 60000 }] };
    t.check(stockLotDrift().length === 2, 'two adrift');
    repairStockLotDrift('P042');
    const left = stockLotDrift();
    t.check(left.length === 1 && left[0].key === 'P051::0',
      'fixing one fixes only that one — the rest stay named and unrepaired');
  }
}

/* ---------- 7. the shape of the screen ------------------------------- */
{
  t.check(/function renderStockLotDrift\(\)/.test(code), 'the Inventory screen reports the drift');
  /* What matters is that renderInventory drives it every time, not what
     sits between -- the uncosted-stock banner is rendered from the same
     place and had to be allowed to. */
  t.check(/renderStockLotDrift\(\);\s*\n\s*renderUncostedStock\(\);\s*\n\s*const wrap = document\.getElementById\('invTableWrap'\);/.test(code),
    'every time it renders, so a repair elsewhere cannot leave a stale warning');
  const banner = (/function renderStockLotDrift[\s\S]*?\n\}/.exec(code) || [''])[0];
  const fix = (/function fixStockLotDrift[\s\S]*?\n\}/.exec(code) || [''])[0];
  /* The rows are listed in groups now -- the shelf says empty, the
     record carries more, the record carries less -- rather than as one
     flat run. What this check held still holds and is what it pins:
     every line adrift is listed, none cut to a first few. The three
     groups between them take every row, and each lists ALL of its own. */
  t.check(/rows\.filter\(r=> !\(r\.onShelf > 0\) && r\.inLots > 0\)/.test(banner)
      && /rows\.filter\(r=> r\.onShelf > 0 && r\.inLots > r\.onShelf\)/.test(banner)
      && /rows\.filter\(r=> r\.inLots < r\.onShelf\)/.test(banner),
    'the groups between them take every line adrift — empty shelf, record over, record under');
  t.check(/\$\{g\.rows\.map\(r=> rowHTML\(r, g\)\)\.join\(''\)\}/.test(banner) && !/\.slice\(/.test(banner),
    'and each group lists every one of its lines rather than a first few — the buttons act on what is named');
  /* Action before mechanism. The first version led with the FIFO queue
     and repeated the same explanation under every row; the shop read it
     and asked what it was supposed to do. What a reader must DECIDE now
     comes before anything they merely have to KNOW, and the theory is
     said once — in the confirm, where it is about to matter. */
  t.check(/Is the shelf count right\?/.test(banner),
    'the banner opens on the one question the reader has to answer');
  t.check(banner.indexOf('Is the shelf count right?') < banner.indexOf('${groups.map(groupHTML)'),
    'asked before the list, not after it');
  t.check(!/first-in-first-out/.test(banner),
    'and the FIFO explanation is not repeated under every row');
  /* Said as ticks now rather than a sentence, and still said before a
     single row: what matching leaves alone is the fear, so it is on
     screen, not behind the confirm. */
  t.check(/keeps every stock count/.test(banner) && /moves no money/.test(banner)
      && /leaves your statements as they are/.test(banner) && /never touches consignment/.test(banner),
    'while what it does NOT touch is said plainly, since that is the fear');
  t.check(banner.indexOf('moves no money') < banner.indexOf('${groups.map(groupHTML)'),
    'and said before the rows it is about');
  t.check(/Array\.isArray\(key\) \? rows\.filter\(r=> key\.includes\(r\.key\)\)/.test(fix),
    'a group\'s "Match all" matches exactly the lines that group names, and no others');
  t.check(/what is still on the shelf is \nthe newest stock|the oldest entries are dropped/.test(fix),
    'the mechanism is kept for the confirm, where it is about to be acted on');

  t.check(/if\(!confirm\(msg\)\) return;/.test(fix), 'the repair asks first');
  t.check(/No stock count changes and no money moves/.test(fix),
    'saying plainly that the shelf and the money are not what is being changed');
  t.check(/cost record \$\{r\.inLots\} → \$\{r\.onShelf\}/.test(fix),
    'and naming each record from and to before it commits');
}

/* ---------- consigned lots are not this button's to drop -------------
 *
 * The repair used to call consumeStockLots for the excess and throw the
 * result away -- which walks the FRONT of the queue and takes whatever
 * is there. Where the oldest lots were a consignor's, pressing Fix
 * deleted their goods: what they held dropped, nothing was recorded as
 * sold against them, and so what they were owed simply stopped existing.
 * No log row named it either, because this function wrote none.
 *
 * A mismatch in the cost ledger is a bookkeeping error. Correcting one
 * must never be the way somebody else's money disappears.
 */
if (fns) {
  const { stockLotDrift, repairStockLotDrift } = fns;
  const heldFor = (sup) => Object.keys(store.stockLots).reduce((n, k) =>
    n + (store.stockLots[k] || []).filter(l => l.consign === sup)
      .reduce((s, l) => s + (Number(l.qty) || 0), 0), 0);

  store.products = [{ id: 'P042', name: 'Gypsum board 9mm' }];
  store.stock = { P042: 10 };
  store.stockLog = [];
  // The consignor's delivery is the OLDEST lot, which is exactly where a
  // front-of-queue trim would have taken from.
  store.stockLots = { P042: [{ qty: 10, cost: 25500, consign: 'S1' }, { qty: 6, cost: 24000 }] };

  const row = repairStockLotDrift('P042');
  eq(heldFor('S1'), 10, 'the consignor still holds every one of theirs');
  eq(row.trimmed, 6, 'the shop\'s own entries are what came off');
  eq(row.blockedByConsign, 0, 'and there was enough of the shop\'s own to cover the whole excess');
  eq((store.stockLots.P042 || []).length, 1, 'leaving one lot behind');

  /* And where there is NOT enough of the shop's own, it stops rather
     than helping itself to the rest -- and says how many it left. */
  store.stock = { P042: 4 };
  store.stockLots = { P042: [{ qty: 10, cost: 25500, consign: 'S1' }] };
  store.stockLog = [];
  const stuck = repairStockLotDrift('P042');
  eq(heldFor('S1'), 10, 'a shelf whose excess is ALL a consignor\'s comes out untouched');
  eq(stuck.trimmed, 0, 'nothing was trimmed');
  eq(stuck.blockedByConsign, 6, 'and the six it could not take are reported, not swallowed');
  t.check(stockLotDrift().length === 1,
    'so the drift is still there afterwards, which is the honest outcome');

  // Written down either way: it moves the cost ledger, and a shop whose
  // stock value changed had nothing to look at that said why.
  const log = store.stockLog[store.stockLog.length - 1];
  t.check(log && log.type === 'correction' && log.delta === 0,
    'a correction row is written, moving no count');
  t.check(log && /held on consignment/.test(log.note),
    `and it names why it stopped (${log && log.note})`);

  const fix = extractFunction(src, 'fixStockLotDrift', 'index.html');
  t.check(/Entries for goods held on consignment are left alone/.test(fix),
    'the confirm says so before the tap');
  t.check(/blockedByConsign > 0/.test(fix) && /Check the Consignment screen/.test(fix),
    'and what it could not do is reported as loudly as what it did');
}

process.exit(t.done() ? 1 : 0);
