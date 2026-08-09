#!/usr/bin/env node
'use strict';
/*
 * The other half of a pack that could not be broken.
 *
 * A line for one dozen filled from a six-dozen carton buys six. One goes
 * to the customer; five stay in the shop. They were being bought, paid
 * for and then forgotten -- the purchase invoice billed the supplier for
 * one dozen while a carton left his shop, and the five nobody had
 * counted were only found again the next time somebody looked at the
 * shelf.
 *
 * Three things now follow from the same number:
 *
 *   the supplier is billed for what he actually sold -- the carton
 *   the surplus goes on the shelf, at the line's own unit cost
 *   the buying list sends somebody for what they must actually collect
 *
 * All three read it from ipLineOutlay(), the function the item picker
 * already uses to say what a line will take out of the till, so what is
 * warned about when the line is added is what happens when it is
 * invoiced.
 *
 * Run: node test/quote-pack-surplus.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('quote pack surplus');
const src = read('index.html');

// Sells only by the carton of six; and one who sells loose.
const CARTONS = { supplierId: 'S1', sname: 'Cartons Only', wholesale: 78333, retail: null, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
const LOOSE = { supplierId: 'S2', sname: 'Loose Trader', wholesale: null, retail: 102000, packQty: 6, packUnit: 'Ctn', unit: 'Dozen', tiers: [] };
const ROWS = { 'P1::4': [CARTONS], 'P2::': [LOOSE] };

const NAMES = ['tiersForKind', 'tieredUnitPrice', 'ipLineOutlay', 'orderLineIsBoughtIn',
  'quoteLineUnitsBought', 'quoteLineSurplus', 'quoteLineReceived'];
let fn = null, err = null;
try {
  fn = compileScope(
    NAMES.map((n) => extractFunction(src, n, 'index.html')),
    { productPriceRows: (pid, vi) => ROWS[`${pid}::${vi == null ? '' : vi}`] || [] },
    NAMES,
  );
} catch (e) { err = e; }
t.check(!!fn, `the surplus helpers compile${err ? ` (${err.message})` : ''}`);

const line = (over) => Object.assign(
  { productId: 'P1', variantIdx: 4, qty: 1, supplierId: 'S1', price: 78333, unit: 'Dozen', packUnit: 'Ctn' }, over);

/* ---------- 1. how many are really bought ---------------------------- */
{
  t.check(fn.quoteLineUnitsBought(line()) === 6,
    `one dozen off a six-dozen carton buys six (${fn.quoteLineUnitsBought(line())})`);
  t.check(fn.quoteLineSurplus(line()) === 5, 'five of which stay in the shop');

  t.check(fn.quoteLineUnitsBought(line({ qty: 6 })) === 6 && fn.quoteLineSurplus(line({ qty: 6 })) === 0,
    'a full carton leaves nothing over');
  t.check(fn.quoteLineUnitsBought(line({ qty: 7 })) === 12 && fn.quoteLineSurplus(line({ qty: 7 })) === 5,
    'seven means two cartons, and five over again');

  // A supplier who sells loose sells exactly what was asked for.
  t.check(fn.quoteLineSurplus(line({ productId: 'P2', variantIdx: null, supplierId: 'S2', qty: 1 })) === 0,
    'nothing is left over where the supplier breaks packs');

  /* Goods off our own shelf are not bought at all, so there is nothing
     to be left over from. */
  t.check(fn.quoteLineUnitsBought(line({ supplierId: '__stock__' })) === 1
    && fn.quoteLineSurplus(line({ supplierId: '__stock__' })) === 0,
    'and a line sold from stock buys nothing');

  /* The supplier's price may have come off file since the order was
     taken. Guessing a pack size that is no longer recorded would be
     worse than taking the line at the quantity it was quoted at. */
  t.check(fn.quoteLineUnitsBought(line({ productId: 'GONE' })) === 1,
    'a line whose price is no longer on file is taken at its word');

  /* The bought-in guard also stops a nullish line reaching the lookup at
     all -- reversal walks whatever is on the order, and a hole in that
     array must not throw in the middle of putting stock back. */
  let threw = null;
  try { fn.quoteLineUnitsBought(null); fn.quoteLineSurplus(undefined); } catch (e) { threw = e; }
  t.check(!threw, `a missing line is nothing bought rather than a crash${threw ? ` (${threw.message})` : ''}`);
}

/* ---------- 2. the supplier is billed for the carton ----------------- */
{
  const gen = extractFunction(src, 'generatePurchaseInvoicesForQuote', 'index.html');
  /* What was bought, for a line nobody has receipted. Where a receipt
     exists it wins -- counted beats calculated, and goods-receiving.test.js
     covers that half. */
  t.check(/: quoteLineUnitsBought\(it\),/.test(gen),
    'the purchase invoice carries what was bought, not what was quoted');
  /* Billing the one dozen that left the shop while a carton left his
     would understate what is owed, and leave the other five sitting on
     our shelf with no purchase behind them. */
  t.check(!/qty: it\.qty, price: it\.price/.test(gen),
    'the quoted quantity is no longer what he is billed for');

  // purchaseInvoiceTotal multiplies the two, so the debt follows.
  const total = compileScope([extractFunction(src, 'purchaseInvoiceTotal', 'index.html')], {}, ['purchaseInvoiceTotal'])
    .purchaseInvoiceTotal({ items: [{ qty: 6, price: 78333 }] });
  t.check(total === 469998, `so a carton is owed for as a carton (${total})`);
}

/* ---------- 3. the surplus goes on the shelf ------------------------- */
/*
 * Run against a stubbed applyStockDelta, because what matters is the
 * movements that actually happen -- reading the source cannot tell a
 * call that is made from one sitting behind a condition that is never
 * true.
 */
{
  const movements = [];
  const run = compileScope(
    ['tiersForKind', 'tieredUnitPrice', 'ipLineOutlay', 'orderLineIsBoughtIn',
      'quoteLineUnitsBought', 'quoteLineSurplus', 'quoteLineReceived',
      'applyQuoteSurplusToStock', 'reverseQuoteSurplusToStock']
      .map((n) => extractFunction(src, n, 'index.html')),
    {
      productPriceRows: (pid, vi) => ROWS[`${pid}::${vi == null ? '' : vi}`] || [],
      supplierName: (id) => ({ S1: 'Cartons Only', S2: 'Loose Trader' }[id] || id),
      applyStockDelta: (productId, variantIdx, delta, type, note, cost, supplierId) =>
        movements.push({ productId, variantIdx, delta, type, note, cost, supplierId }),
    },
    ['applyQuoteSurplusToStock', 'reverseQuoteSurplusToStock'],
  );

  const order = () => ({
    client: { name: 'Abraham' },
    items: [
      line(),                                                        // 1 of 6 -> 5 over
      line({ productId: 'P2', variantIdx: null, supplierId: 'S2', price: 102000 }), // loose, none over
      line({ supplierId: '__stock__' }),                             // off our own shelf
    ],
  });

  const q = order();
  const added = run.applyQuoteSurplusToStock(q);
  t.check(added === 5, `five are left over across the order (${added})`);
  t.check(movements.length === 1, `and exactly one line moves stock (${movements.length})`);

  const m = movements[0];
  t.check(m && m.delta === 5 && m.type === 'restock',
    `five arrive as a restock, like any other stock coming in (${m && m.delta} ${m && m.type})`);
  t.check(m && m.productId === 'P1' && m.variantIdx === 4, 'against the item that was bought');
  /* With a cost, or the lot carries none and getFIFOUnitCost() goes null
     -- which is how a shelf ends up holding goods the shop cannot
     value. And from the supplier, like any other restock. */
  t.check(m && m.cost === 78333 && m.supplierId === 'S1',
    `at the line's own unit cost, from the supplier it came from (${m && m.cost}, ${m && m.supplierId})`);
  t.check(m && /Left over from Abraham/.test(m.note) && /Cartons Only sells by the Ctn/.test(m.note),
    `with a note saying which order it is left from and why (${m && m.note})`);

  // Reversal gives back exactly what was given.
  movements.length = 0;
  run.reverseQuoteSurplusToStock(q);
  t.check(movements.length === 1 && movements[0].delta === -5 && movements[0].type === 'reversal',
    `un-invoicing takes the same five back off (${JSON.stringify(movements)})`);
  t.check(q.items.every((it) => it._surplusStocked === undefined),
    'and forgets them, so a second un-invoice cannot take them twice');

  // Nothing left over is nothing to reverse.
  movements.length = 0;
  run.reverseQuoteSurplusToStock(order());
  t.check(movements.length === 0, 'an order that never had a surplus reverses nothing');

  /* Remembered on the line rather than recomputed: a pack size edited in
     between would otherwise take a different number off the shelf than
     went on it. */
  const reverse = extractFunction(src, 'reverseQuoteSurplusToStock', 'index.html');
  t.check(/if\(!it\._surplusStocked\) return;/.test(reverse) && !/quoteLineSurplus\(it\)/.test(reverse),
    'reversed by what was actually added, not by what it would be worked out as now');

  const stale = { client: { name: 'Old' }, items: [line({ _surplusStocked: 3, qty: 99 })] };
  movements.length = 0;
  run.reverseQuoteSurplusToStock(stale);
  t.check(movements.length === 1 && movements[0].delta === -3,
    `so a line whose packing changed still gives back the three it was given (${movements[0] && movements[0].delta})`);

  // Both halves are wired into the one place an order's stock moves.
  const toggle = extractFunction(src, 'toggleQuoteInvoiced', 'index.html');
  t.check(/surplusStocked = applyQuoteSurplusToStock\(q\);/.test(toggle),
    'invoicing puts the surplus on the shelf');
  t.check(/reverseQuoteSurplusToStock\(q\);/.test(toggle), 'un-invoicing takes it back off');
  t.check(toggle.indexOf('applyQuoteStockDeduction(q)') < toggle.indexOf('applyQuoteSurplusToStock(q)'),
    'and one order can do both, a stock line going out while a pack line comes in');

  /* Silent, it is stock the shop did not ask for and will not think to
     look for -- which is how goods go missing on paper. */
  t.check(/left over from packs added to stock/.test(toggle),
    'the shopkeeper is told it happened');
}

/* ---------- 4. the buying list sends them for the right thing -------- */
{
  const lines = extractFunction(src, 'orderPurchaseLines', 'index.html');
  t.check(/const out = best \? ipLineOutlay\(best, quotedQty\) : null;/.test(lines)
    && /out \? out\.units : quotedQty/.test(lines),
    'the quantity to collect is the whole carton where the carton is the least sold');
  /* Once a line has been received the figure comes from the receipt
     instead, and nothing more is owed on it -- goods-receiving.test.js
     covers that half. */
  t.check(/lineCost: received \? 0 : \(unitCost==null \? null : unitCost \* qty\),/.test(lines),
    'and the money to take follows it');
  /* The row shows qty x unit cost = line total. Leaving the cost on the
     carton while the quantity said one dozen would print a row that does
     not multiply out. */
  t.check(/quotedQty,/.test(lines) && /surplus: Math\.max\(0, qty - quotedQty\),/.test(lines),
    'with what the customer is owed kept alongside what has to be fetched');

  /* orderCashToBuy sums lineCost, and cashPositionForBuying() subtracts
     that from the balance the item picker judges a new line against. If
     this understated a pack-forced order on the board, the picker would
     be told there is more money free than there is -- the same blindness
     one screen over. */
  t.check(/return orderPurchaseLines\(q\)\.reduce\(\(s,l\)=> s \+ \(l\.lineCost \|\| 0\), 0\);/
    .test(extractFunction(src, 'orderCashToBuy', 'index.html')),
    'so the cash the board says it needs counts the whole carton too');
}

process.exit(t.done() ? 1 : 0);
