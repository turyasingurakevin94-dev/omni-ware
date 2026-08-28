#!/usr/bin/env node
'use strict';
/*
 * The sell price on a quote line.
 *
 * Two things, both about quantity.
 *
 * 1. WHICH MARKUP. A shop keeps two markups per product: retail for
 *    small quantities and wholesale for pack quantities. The item picker
 *    has always chosen between them by the same test used everywhere else
 *    -- qty at or above packQty earns the wholesale side -- but
 *    quoteItemSellPrice, which prices a line with no explicit sell price
 *    on it, passed 'retail' as a literal. So a shop with a wholesale
 *    markup on file never saw it applied to a quote line however many
 *    were being sold.
 *
 *    Worse for a FIXED wholesale markup: it is quoted per pack and
 *    suggestedSellingPrice divides it by packQty to get a per-unit
 *    figure. quoteItemSellPrice never passed packQty either, so the whole
 *    pack markup was added to every single unit -- a 6,000 markup on a
 *    carton of twelve became 6,000 on each tin instead of 500.
 *
 * 2. SELLING BELOW COST. Never blocked -- a loss-leader, clearing stock
 *    that will not move, or a goodwill line on a large order are real
 *    decisions. But the quote shows only a TOTAL profit, and a total
 *    cannot say which line went under. One below-cost line inside an
 *    order that is comfortably profitable overall is precisely the one
 *    nobody notices.
 *
 * Run: node test/admin-sell-price.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin sell price');
const src = read('index.html');

const data = { products: [] };
const scope = compileScope([
  extractFunction(src, 'effectiveMarkupRule', 'index.html'),
  extractFunction(src, 'effectiveStockMarkupRule', 'index.html'),
  extractFunction(src, 'suggestedSellingPrice', 'index.html'),
  extractFunction(src, 'suggestedStockSellingPrice', 'index.html'),
  extractFunction(src, 'quoteSuggestedPrice', 'index.html'),
  extractFunction(src, 'quoteSuggestedStockPrice', 'index.html'),
  extractFunction(src, 'quoteItemSellPrice', 'index.html'),
  /* The clause also reads the shelf now: a line sold from stock carries
     no buy price of its own, and when those units belong to a consignor,
     pricing under what will be owed is a loss out of the shop's own
     pocket. A fixture with no consigned lots reads exactly as before. */
  extractFunction(src, 'stockKey', 'index.html'),
  /* Read across every consigned unit the line reaches, not off the front
     of the queue: 2 of the shop's own standing ahead of 8 a consignor
     left used to answer "none of theirs" to a line of 10. */
  extractFunction(src, 'peekStockLots', 'index.html'),
  extractFunction(src, 'consignTally', 'index.html'),
  extractFunction(src, 'consignedForLine', 'index.html'),
  extractFunction(src, 'consignedUnitCostForSale', 'index.html'),
  extractFunction(src, 'sellBelowCostClause', 'index.html'),
], {
  data,
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  quoteLineComesOffShelf: (it) => !!it && (it.supplierId === '__stock__'
    || !!(it.receivedAt && Number(it.receivedQty) > 0)),
}, ['quoteItemSellPrice', 'sellBelowCostClause', 'effectiveMarkupRule']);

const product = (over) => {
  const p = Object.assign({
    id: 'P1', name: 'Paint white 4L', variants: [],
    wholesaleMarkupType: 'percent', wholesaleMarkupValue: 0,
    retailMarkupType: 'percent', retailMarkupValue: 0,
    stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 0,
    stockRetailMarkupType: 'percent', stockRetailMarkupValue: 0,
  }, over);
  data.products = [p];
  return p;
};
const line = (over) => Object.assign({
  productId: 'P1', variantIdx: null, unit: 'tin',
  qty: 1, packQty: 0, supplierId: 'S1', price: 10000,
}, over);

/* ---------- 1. the quantity picks the markup -------------------------- */
{
  // Retail 50%, wholesale 20%, pack of twelve.
  product({ retailMarkupValue: 50, wholesaleMarkupValue: 20 });

  t.check(scope.quoteItemSellPrice(line({ qty: 1, packQty: 12 })) === 15000,
    'a single tin takes the retail markup');
  t.check(scope.quoteItemSellPrice(line({ qty: 11, packQty: 12 })) === 15000,
    'and so does anything under the pack quantity');
  t.check(scope.quoteItemSellPrice(line({ qty: 12, packQty: 12 })) === 12000,
    `a full pack earns the wholesale markup (got ${scope.quoteItemSellPrice(line({ qty: 12, packQty: 12 }))})`);
  t.check(scope.quoteItemSellPrice(line({ qty: 50, packQty: 12 })) === 12000,
    'as does more than a pack');

  // No pack break means there is no wholesale side to earn.
  t.check(scope.quoteItemSellPrice(line({ qty: 500, packQty: 0 })) === 15000,
    'with no pack quantity on file every line is retail, however many are sold');
}

/* ---------- 2. a fixed wholesale markup is per PACK ------------------- */
{
  // 6,000 on a carton of twelve is 500 a tin, not 6,000 a tin.
  product({
    retailMarkupType: 'fixed', retailMarkupValue: 2000,
    wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 6000,
  });

  const perPack = scope.quoteItemSellPrice(line({ qty: 12, packQty: 12 }));
  t.check(perPack === 10500,
    `a fixed wholesale markup is spread across the pack (got ${perPack}, expected 10,500 = 10,000 + 6,000/12)`);
  t.check(scope.quoteItemSellPrice(line({ qty: 1, packQty: 12 })) === 12000,
    'while a fixed retail markup is per unit as it stands');
}

/* ---------- 3. an explicit price still wins --------------------------- */
{
  product({ retailMarkupValue: 50 });
  t.check(scope.quoteItemSellPrice(line({ sellPrice: 99000 })) === 99000,
    'a price typed on the line is used as typed');
  t.check(scope.quoteItemSellPrice(line({ sellPrice: 0 })) === 0,
    'including a deliberate zero');
  t.check(scope.quoteItemSellPrice(line({ sellPrice: '' })) === 15000,
    'while an empty one falls back to the markup, which is what the reset control is for');

  data.products = [];
  t.check(scope.quoteItemSellPrice(line({ price: 7777 })) === 7777,
    'and a line whose product is gone falls back to what it cost, rather than to nothing');
}

/* ---------- 4. our own shelf uses the stock rule, same quantity test -- */
{
  product({
    retailMarkupValue: 50, wholesaleMarkupValue: 20,
    stockRetailMarkupValue: 80, stockWholesaleMarkupValue: 30,
  });

  t.check(scope.quoteItemSellPrice(line({ supplierId: '__stock__', qty: 1, packQty: 12 })) === 18000,
    'a stock line under the pack quantity takes the stock RETAIL markup');
  t.check(scope.quoteItemSellPrice(line({ supplierId: '__stock__', qty: 12, packQty: 12 })) === 13000,
    'and at a pack quantity the stock WHOLESALE markup');

  // The documented fallback: no stock rule set means the ordinary one.
  product({ retailMarkupValue: 50, wholesaleMarkupValue: 20 });
  t.check(scope.quoteItemSellPrice(line({ supplierId: '__stock__', qty: 12, packQty: 12 })) === 12000,
    'with no stock rule on file it falls back to the default rule for that side');
}

/* ---------- 5. a variant's own markup still overrides ----------------- */
{
  const p = product({ retailMarkupValue: 50, wholesaleMarkupValue: 20 });
  p.variants = [{ wholesaleMarkupType: 'percent', wholesaleMarkupValue: 5,
                  retailMarkupType: 'percent', retailMarkupValue: 10 }];

  t.check(scope.quoteItemSellPrice(line({ variantIdx: 0, qty: 1, packQty: 12 })) === 11000,
    "a variant's retail markup beats the product's");
  t.check(scope.quoteItemSellPrice(line({ variantIdx: 0, qty: 12, packQty: 12 })) === 10500,
    "and its wholesale markup is reached by the same quantity test");
  t.check(scope.quoteItemSellPrice(line({ variantIdx: null, qty: 12, packQty: 12 })) === 12000,
    'while a line with no variant still uses the product rule');
}

/* ---------- 6. selling under cost is said, not stopped ---------------- */
{
  const say = (over) => scope.sellBelowCostClause(line(over));

  const clause = say({ price: 34000, sellPrice: 32000, qty: 50, unit: 'bag' });
  t.check(clause !== '', 'a sell price below the buy price is reported');
  t.check(/32,000 UGX is below the 34,000 UGX/.test(clause),
    `naming both figures (${clause})`);
  t.check(/2,000 UGX lost per bag/.test(clause), 'what is lost on each');
  t.check(/100,000 UGX over 50/.test(clause), 'and what that comes to over the line');

  t.check(say({ price: 34000, sellPrice: 34000 }) === '',
    'selling at exactly cost is not a loss and says nothing');
  t.check(say({ price: 34000, sellPrice: 45000 }) === '', 'nor is selling above it');
  t.check(say({ price: 34000, sellPrice: 0 }) !== '',
    'giving it away is still worth mentioning');
  t.check(say({ price: 34000 }) === '',
    'a line with no sell price of its own is priced by markup, so there is nothing to warn about');
  t.check(say({ price: 34000, sellPrice: '' }) === '',
    'and clearing the field is a reset, not a decision to sell at nothing');
  t.check(scope.sellBelowCostClause(null) === '', 'and no line at all does not throw');

  t.check(!/over 1\b/.test(say({ price: 100, sellPrice: 90, qty: 1, unit: 'bag' })),
    'a single-unit line does not repeat the same figure as a total');
  t.check(/ each/.test(say({ price: 100, sellPrice: 90, qty: 3, unit: '' })),
    'a line with no unit name still reads properly');
}

/* ---------- 7. the handler itself, driven ----------------------------- */
/*
 * Checking the source alone cannot tell "warns" from "warns and quietly
 * undoes the edit", and the whole point is that it never overrules the
 * person typing. So the real handler is sliced out of its addEventListener
 * and run.
 */
{
  const anchor = "row.querySelector('.q-sell').addEventListener('change', (e)=>{";
  const at = src.indexOf(anchor);
  let handler = null, err = null;
  if (at < 0) err = new Error('could not find the .q-sell change handler in index.html');
  else if (src.indexOf(anchor, at + 1) >= 0) err = new Error('more than one .q-sell change handler');
  else {
    const open = at + anchor.length - 1;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) {
        handler = `function onSellChange(e)${src.slice(open, i + 1)}`;
        break;
      }
    }
    if (!handler) err = new Error('unbalanced braces in the .q-sell handler');
  }
  t.check(!!handler, `the sell-price handler can be sliced out${err ? ` (${err.message})` : ''}`);

  if (handler) {
    const told = [];
    const box = { item: null };
    const run = compileScope([
      // Same chain as above: the clause reads the shelf for consigned units.
      extractFunction(src, 'stockKey', 'index.html'),
      extractFunction(src, 'peekStockLots', 'index.html'),
      extractFunction(src, 'consignTally', 'index.html'),
      extractFunction(src, 'consignedForLine', 'index.html'),
      extractFunction(src, 'consignedUnitCostForSale', 'index.html'),
      extractFunction(src, 'sellBelowCostClause', 'index.html'),
      handler,
      'function setItem(i){ box.item = i; item = i; }',
      'let item = null;',
    ], {
      box, told,
      // No consigned lots in this fixture, so the clause reads exactly as
      // it did before -- which is what these cases are checking.
      data: { stockLots: {} },
      quoteLineComesOffShelf: (it) => !!it && (it.supplierId === '__stock__'
        || !!(it.receivedAt && Number(it.receivedQty) > 0)),
      fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
      toast: (m) => { told.push(String(m)); },
      saveData: () => {}, renderQuoteItems: () => {},
    }, ['onSellChange', 'setItem']);

    // Below cost: warned, and saved anyway.
    told.length = 0;
    let it = line({ price: 34000, qty: 50, unit: 'bag' });
    run.setItem(it);
    run.onSellChange({ target: { value: '32000' } });
    t.check(it.sellPrice === 32000,
      `the price is saved exactly as typed (got ${it.sellPrice}) -- the warning never overrules the person typing`);
    t.check(told.length === 1 && /Saved — but/.test(told[0]), `and is reported (${JSON.stringify(told)})`);
    t.check(/32,000 UGX is below the 34,000 UGX/.test(told[0]), 'naming both figures');

    // Above cost: saved, nothing said.
    told.length = 0;
    it = line({ price: 34000, qty: 50, unit: 'bag' });
    run.setItem(it);
    run.onSellChange({ target: { value: '45000' } });
    t.check(it.sellPrice === 45000 && told.length === 0,
      `an ordinary sell price is saved with nothing said (${JSON.stringify(told)})`);
  }
}

/* ---------- 8. wired where sell prices are actually entered ----------- */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

  t.check(/\.q-sell'\)\.addEventListener\('change'[\s\S]{0,260}?sellBelowCostClause\(item\)/.test(code),
    'editing the sell price on a quote line checks it');
  t.check(/toast\(`Saved — but \$\{below\}\.`, 7000\)/.test(code),
    'and says so without blocking the save');

  // The item picker raises its own warning at the same moment. Two toasts
  // in a row means only the second is ever read -- the same fault fixed in
  // the agent app's submit handler -- so they are composed into one.
  t.check(/warnings\.push\(belowCost\)/.test(code) && /warnings\.join\('; and '\)/.test(code),
    'the item picker folds a below-cost line into its single toast rather than raising a second one');
  t.check(/if\(overStock\) warnings\.push\(/.test(code),
    'alongside the out-of-stock warning it already had');

  // The literal that caused the first half of this file.
  t.check(!/quoteSuggestedPrice\(product, buy, 'retail', variantIdx\)/.test(code),
    "quoteItemSellPrice no longer hard-codes 'retail'");
  t.check(/const kind = \(packQty>0 && qty>=packQty\) \? 'wholesale' : 'retail';/.test(code),
    'choosing the side by the same qty-vs-pack test used on the buying side');
}

process.exit(t.done() ? 1 : 0);
