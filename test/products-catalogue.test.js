#!/usr/bin/env node
'use strict';
/*
 * The catalogue, as a list.
 *
 * It was a grid of 270px cards, one per sellable thing, carrying an id,
 * a name, two category pills and the markup RULES. A catalogue is
 * scanned and compared -- what do I have, what does it cost me, what
 * does it sell for -- and a card grid is the one shape that makes
 * comparing hard, because no two figures ever line up in a column.
 *
 * It was also quieter than its own printout. The print button already
 * put stock on the page, on the stated reasoning that "walking the
 * shelves is most of what it is for", while the screen it printed from
 * showed no stock at all.
 *
 * So: one row per line, with the two missing facts -- what it costs to
 * buy, and how many are on the shelf -- in columns that line up.
 *
 * ONE OF THOSE TWO HAS SINCE BEEN GIVEN BACK, deliberately and with the
 * owner's decision behind it. Stock is Inventory's question, and
 * Inventory answers it far better than a column here ever could: by lot,
 * at what each lot cost, with what the shelf is worth and what has moved.
 * A column on the register could only repeat the number and none of the
 * reasoning, and it was taking width from the one column that must never
 * be the thing that shrinks -- the name, since a clipped figure is a
 * wrong figure and a clipped name is only a shorter one.
 *
 * What has NOT changed is the half that was the register's own: what a
 * line costs to buy is still on every row, and the markup rules that
 * turn it into a price are beside it. Nor is the removal silent -- the
 * checks below pin the panel foot that names where stock went, because a
 * figure that vanishes without a word is how somebody concludes the app
 * has stopped counting.
 *
 * The judgements pinned below:
 *
 *   the cheapest, not      a product with three suppliers has one price
 *   the first              worth showing, and it is the one the buying
 *                          list would actually walk to.
 *   unbuilt is not         a variable product with no variants yet
 *   unpriced               cannot be priced or stocked. Counting it as a
 *                          pricing gap reports a setup step as a fault.
 *   the strip counts       a summary that ignored the filters would
 *   what is LISTED         contradict the rows underneath it.
 *
 * Run: node test/products-catalogue.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('products catalogue');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const data = { products: [], prices: [], stock: {}, suppliers: [] };

const scope = compileScope([
  extractFunction(src, 'productPriceRows', 'index.html'),
  extractFunction(src, 'stockKey', 'index.html'),
  extractFunction(src, 'getStockQty', 'index.html'),
  extractFunction(src, 'productLineStats', 'index.html'),
  extractFunction(src, 'productBestBuy', 'index.html'),
  extractFunction(src, 'effectiveMarkupRule', 'index.html'),
  extractFunction(src, 'productSetupFault', 'index.html'),
  extractFunction(src, 'productHasPhoto', 'index.html'),
], {
  data,
  // Photographs live in the media library, which has its own file.
  resolveProductImage: () => '',
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || 'Unknown',
  rankedPurchaseRowsAtQty: (productId, variantIdx, qty) =>
    data.prices
      .filter((p) => p.productId === productId && (p.variantIdx == null ? null : p.variantIdx) === variantIdx)
      .map((p) => ({ ...p, purchasePrice: p.buy == null ? null : p.buy }))
      .sort((a, b) => (a.purchasePrice == null ? Infinity : a.purchasePrice)
                    - (b.purchasePrice == null ? Infinity : b.purchasePrice)),
}, ['productLineStats', 'productBestBuy', 'getStockQty', 'productSetupFault']);

const line = extractFunction(src, 'productLineHTML', 'index.html');
const price = (productId, variantIdx, supplierId, buy) => ({ productId, variantIdx, supplierId, buy });
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const reset = () => {
  data.suppliers = [{ id: 'S1', name: 'Katwe Steel' }, { id: 'S2', name: 'Mabati Point' }];
  data.products = []; data.prices = []; data.stock = {};
};

/* ---------- 1. the cheapest supplier, not the first ------------------ */
{
  reset();
  // Listed dearest first on purpose: taking prices[0] would name the
  // wrong supplier and the wrong figure, and a catalogue that disagrees
  // with the buying list about where to go is worse than no figure.
  data.prices = [price('P1', null, 'S2', 32500), price('P1', null, 'S1', 31000)];
  const buy = scope.productBestBuy('P1', null);
  eq(buy.price, 31000, 'the cheapest price is the one shown');
  eq(buy.supplierId, 'S1', 'and the supplier it belongs to');
  eq(buy.suppliers, 2, 'with how many others could supply it');

  // A line nothing can price says so rather than showing a zero, which
  // would read as free.
  const none = scope.productBestBuy('P9', null);
  t.check(none.price === null, 'nothing on file gives no price rather than zero');
  eq(none.suppliers, 0, 'and no suppliers');

  // A price row with no usable figure is still a supplier on file, but
  // not a price.
  data.prices = [price('P2', null, 'S1', null)];
  const unpriced = scope.productBestBuy('P2', null);
  t.check(unpriced.price === null, 'a supplier with no figure yields no price');
  eq(unpriced.suppliers, 1, 'though the supplier is still counted');
}

/* ---------- 2. variants are priced and stocked separately ------------ */
{
  reset();
  data.prices = [price('P2', 0, 'S2', 45000), price('P2', 1, 'S2', 62000)];
  eq(scope.productBestBuy('P2', 0).price, 45000, 'each variant carries its own price');
  eq(scope.productBestBuy('P2', 1).price, 62000, 'and they do not share one');

  data.stock = { 'P2::0': 0, 'P2::1': 22 };
  eq(scope.getStockQty('P2', 0), 0, 'nor their stock');
  eq(scope.getStockQty('P2', 1), 22, 'which is keyed per variant');
}

/* ---------- 3. what the summary counts ------------------------------- */
{
  reset();
  data.prices = [price('P1', null, 'S1', 31000), price('P2', 0, 'S2', 45000)];
  data.stock = { P1: 140, 'P2::0': 0, 'P2::1': 22 };
  const P1 = { id: 'P1' }, P2 = { id: 'P2' }, P3 = { id: 'P3' }, P4 = { id: 'P4' };
  const rows = [
    { p: P1, v: null, idx: null, kind: 'simple' },
    { p: P2, v: {}, idx: 0, kind: 'variant' },
    { p: P2, v: {}, idx: 1, kind: 'variant' },
    { p: P3, v: null, idx: null, kind: 'simple' },        // no price, no stock
    { p: P4, v: null, idx: null, kind: 'variable-empty' },
  ];
  const s = scope.productLineStats(rows);

  eq(s.lines, 5, 'every listed line is counted');
  eq(s.products, 4, 'but four distinct products — two variants are one product');
  eq(s.variants, 2, 'the variants among them');
  eq(s.unbuilt, 1, 'and the one with no variants set up yet');

  /* A variable product with no variants cannot be priced or stocked.
     Counting it as unpriced would report a setup step as a pricing gap,
     and it would be double-counted as out of stock too. */
  eq(s.unpriced, 2, 'unpriced counts P2::1 and P3 — not the unbuilt one');

  /* WHAT `noStock` MEANT, AND WHY IT IS GONE. It counted lines with
     nothing on the shelf, and the strip painted that figure amber. On
     the seeded book that marked six lines of six, and on any real
     catalogue it marks most of it: a wholesaler holds stock of a
     minority of what it can sell. A mark that fires on everything marks
     nothing, and it was answering Inventory's question on the register's
     screen. Stock is still on every ROW, where it can be read against
     the row above it; it is no longer one of the four figures the strip
     uses to say whether the register is in good order.
     What replaced it is the count this screen is actually for. */
  /* Five, not three, and the two extra are the point. This shop has set
     no markup rule anywhere -- not on a product, not on a variant, not
     as a shop default -- so the two lines that DO have a supplier price
     still cannot be turned into a selling price. That is the state the
     seeded book ships in, and the old screen showed those lines as
     finished with "+undefined%" beside them. */
  eq(s.notReady, 5, 'every line is unfinished: two unpriced, one unbuilt, two priced with no rule to price them by');
  eq(s.unruled, 2, 'and the two with a price but no rule are named as their own cause');
  eq(s.unbuilt + s.unpriced + s.unruled, s.notReady,
    'the three causes add up to the count exactly, so the line under the strip can name them');

  /* Give the shop a default and the two priced lines become sellable
     without either of them being touched -- which is what makes the
     "no markup rule" mark honest: it is about the shop, not the line. */
  data.presetDefaultMarkup = { wholesaleType: 'percent', wholesaleValue: 15,
                               retailType: 'percent', retailValue: 30 };
  const s2 = scope.productLineStats(rows);
  eq(s2.unruled, 0, 'one shop default clears the rule fault on every line at once');
  eq(s2.notReady, 3, 'leaving only what is genuinely missing from the lines themselves');
  delete data.presetDefaultMarkup;
  eq(s.photos, 0, 'photographs are counted');
  t.check(!('noStock' in s),
    'and nothing on the strip counts empty shelves any more — that is Inventory\'s question');
}

/* ---------- 4. an empty catalogue ------------------------------------ */
{
  reset();
  const s = scope.productLineStats([]);
  eq(s.lines, 0, 'no lines');
  eq(s.products, 0, 'no products');
  eq(s.unpriced, 0, 'nothing unpriced');
  eq(s.notReady, 0, 'and nothing unfinished, rather than a count of nothing');
  eq(s.photos, 0, 'and no photographs, so the strip reads 0 of 0 rather than dividing by nothing');
}

/* ---------- 5. the screen shows what the paper shows ------------------ */
{
  const render = (/function renderProducts[\s\S]*?\n\}/.exec(code) || [''])[0];

  const rowFn = (/function productLineHTML[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/productBestBuy\(p\.id, idx\)/.test(rowFn),
    'the buying price is read per line, variant included');
  /* And stock is NOT, which is the change: the row used to call
     getStockQty(p.id, idx) beside it. Pinned as an absence so the column
     cannot creep back without somebody reading the note at the top of
     this file and deciding again. */
  t.check(!/getStockQty/.test(rowFn),
    'and stock is not read here at all — that is Inventory\'s question, answered there by lot');

  // The card grid is gone, and so are its builders.
  t.check(!/simpleCardHTML|variantCardHTML|variableEmptyCardHTML/.test(code),
    'the three card builders are gone');
  t.check(!/product-grid|product-card/.test(src), 'and nothing is left styling them');

  // Both the list and the printout must come from one row set, or a
  // filtered print could list rows the screen is not showing.
  // Five filters now, still shared between the screen and the sheet.
  t.check((code.match(/productRowsForList\(filter, categoryFilter, supplierFilter, pricedFilter, addedFilter\)/g) || []).length === 2,
    'the list and the printout are built from the same filtered rows');

  /* The strip reports what the search, category, supplier and date
     filters left -- so it can never contradict the rows under it -- and
     deliberately IGNORES the set-up filter. Narrowing to "no supplier
     price" must not make the strip and the category rail claim the shop
     sells nothing else; the whole point of those figures is to say how
     much of the register is finished, which a list of the unfinished
     part cannot answer. `wide` is that row set, and it is `rows` itself
     whenever no set-up filter is on. */
  t.check(/const s = productLineStats\(wide\);/.test(render),
    'the summary counts what is listed, so it cannot contradict the rows under it');
  t.check(/const wide = pricedFilter\s*\?\s*productRowsForList\(filter, categoryFilter, supplierFilter, '', addedFilter\)\s*:\s*rows;/.test(render),
    'and it widens on the set-up filter only, keeping every other filter the rows have');
  t.check(/strip\.innerHTML = s\.lines \?/.test(render),
    'and shows nothing at all when nothing matched');
}

/* ---------- 6. rows again — and the card is the phone's -------------- *
 * THE HISTORY, BECAUSE THIS SECTION HAS NOW REVERSED TWICE AND THE
 * REASON MUST NOT BE LOST. The catalogue was a grid of 270px cards. It
 * became rows, because a card grid is the one shape that makes a
 * catalogue hard to read -- the figures never line up in a column, and a
 * column of money that does not line up is unreadable at a glance, which
 * is the only way a catalogue is ever read. Then it was asked to go back
 * to the card, and this section was written to make sure the card came
 * back carrying the two facts the rows had added rather than the look
 * being restored by dropping them.
 *
 * It is rows again on the desk, and this time the reason is settled
 * rather than swapped: the owner was asked what the screen is FOR and
 * said setting a line up and keeping it right. That is work done down a
 * column -- what does this cost, what does it fetch, which rule made
 * that -- and it is the work a grid of unequal cards defeats.
 *
 * The card is not gone. It is the PHONE, drawn for the job the phone
 * actually has: standing in front of the goods asking which line this
 * is, where a photograph beats a column. What this section pins now is
 * the thing that makes the reversal safe -- the row and the card come
 * out of ONE call, so the two surfaces can never come to say different
 * things about the same product, which is the rule the work queue
 * already follows. Whichever way the look goes next, that must hold.
 */
{
  t.check(/return \{ row, card \};/.test(line),
    'one call emits the desktop row and the phone card together, so they cannot disagree');
  t.check(/class="pg-cols pg-r/.test(line) && /class="pg-c"/.test(line),
    'the row is a row and the card is a card, built side by side from the same figures');

  /* Of the two facts the rows were added for, the register keeps its own
     and hands the other back to the screen that owns it. */
  t.check(/productBestBuy\(p\.id, idx\)/.test(line),
    'it still says what the thing costs to buy');
  t.check(/pgBuyBasis/.test(line) && /supplierName\(buy\.supplierId\)/.test(code),
    'and names the cheapest supplier, which the printed list has always carried');

  /* NAMED RATHER THAN DROPPED. A column that disappears without a word
     reads as an app that has stopped counting, so the foot of the panel
     says where the figure lives now. This is the check that makes the
     removal a decision rather than a loss. */
  const render = (/function renderProducts[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/What is on the shelf is not here/.test(render) && /Inventory/.test(render),
    'and the panel foot says where stock went, rather than letting a column vanish in silence');

  /* Three money columns and one elastic name column: six grid tracks,
     not seven. Pinned with the widths because the whole argument for the
     row is that the figures line up, which stops being true the moment a
     money column is allowed to be the flexible one. */
  t.check(/\.pg-cols\{display:grid;grid-template-columns:34px minmax\(0,1fr\) 126px 112px 112px 22px;/.test(src),
    'the register is three money columns wide, each fixed, with the name the only one that gives way');

  /* The figures line up, which is the whole argument for the row. Money
     is tabular and right-aligned, and the money columns are fixed while
     the NAME column is the one that gives way -- a clipped figure is not
     a shortened figure, it is a wrong one. */
  t.check(/\.pg-f\{[^}]*font-variant-numeric:tabular-nums;/.test(src),
    'with the figures tabular, so a column of them can be read down the page');
  t.check(/\.pg-v\{[^}]*text-align:right;/.test(src), 'and right-aligned');
  t.check(/\.pg-cols\{display:grid;grid-template-columns:34px minmax\(0,1fr\)/.test(src),
    'and the name column is the only elastic one, so no money column can ever be the thing that shrinks');

  // The card builders the grid needed are still gone.
  t.check(!/simpleCardHTML|variantCardHTML|variableEmptyCardHTML/.test(code),
    'the three old card builders are still gone');

  /* THE MARKUP RULE, which is the fact this screen owns and no other
     screen shows. It rendered "+undefined%" on every card for as long as
     the card existed, because two functions shared the name
     markupRuleLabel -- see test/function-name-collisions.test.js. It is
     on the row now, under the price it produced, saying which rule made
     it: the line's own, or the shop default it falls through to. */
  t.check(/pgRuleBasis/.test(line), 'each selling price carries the rule that produced it');
  t.check(/its own/.test(code) && /default \$\{label\}/.test(code),
    'and says whether that rule is the line\'s own or the shop default behind it');
}

process.exit(t.done() ? 1 : 0);
