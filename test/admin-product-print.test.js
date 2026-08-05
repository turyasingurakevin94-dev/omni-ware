#!/usr/bin/env node
'use strict';
/*
 * Printing the product list.
 *
 * The Products tab draws cards; a printed list needs rows. The tempting
 * shortcut is to walk data.products a second time inside the print handler
 * -- which is how two views of one thing end up showing different sets, the
 * fault behind several bugs already fixed in this file.
 *
 * So the walk lives in productRowsForList(): the filters, the flattening of
 * a variable product into one row per variant, and the multi-word matching
 * that lets "black plug" find a "Black Wall Plug". The grid maps those rows
 * to cards and the printout maps them to table rows, and neither can select
 * a different set from the other.
 *
 * Run: node test/admin-product-print.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin product print');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { products: [], prices: [] };
let rowsFor = null, err = null;
try {
  ({ productRowsForList: rowsFor } = compileScope(
    ['searchTokens', 'matchesAllTokens', 'variantLabel', 'productRowsForList']
      .map(n => extractFunction(src, n, 'index.html')),
    { data: store }, ['productRowsForList'],
  ));
} catch (e) { err = e; }
t.check(typeof rowsFor === 'function', `productRowsForList compiles${err ? ` (${err.message})` : ''}`);

if (rowsFor) {
  const seed = () => {
    store.products = [
      { id: 'P1', name: 'Cement (Tororo 50kg)', category: 'Cement', subcategory: '', type: 'simple' },
      { id: 'P2', name: 'Black Wall Plug', category: 'Fixings', subcategory: 'Plugs', type: 'simple' },
      { id: 'P3', name: 'Cabinet Hinge', category: 'Furniture', subcategory: 'Hinges', type: 'variable',
        variants: [{ sku: 'HNG-BR', combo: { Finish: 'Brass' } }, { sku: 'HNG-ST', combo: { Finish: 'Steel' } }] },
      { id: 'P4', name: 'Unset Variable', category: 'Furniture', subcategory: '', type: 'variable', variants: [] },
    ];
    store.prices = [{ productId: 'P1', supplierId: 'S1' }];
  };
  seed();

  /* ---------- 1. one row per sellable thing ------------------------- */
  {
    const all = rowsFor('', '', '');
    t.check(all.length === 5, `two simple products, two variants and an unset variable make five rows (${all.length})`);
    t.check(all.filter(r => r.kind === 'variant').length === 2, 'a variable product contributes one row per variant');
    t.check(all.filter(r => r.kind === 'variable-empty').length === 1,
      'and one with no variants set up still appears, rather than vanishing from its own catalog');
    t.check(all.filter(r => r.kind === 'simple').length === 2, 'simple products stay whole');

    const brass = all.find(r => r.v && r.v.sku === 'HNG-BR');
    t.check(brass && brass.idx === 0 && brass.p.id === 'P3',
      'each variant row carries its index, which is what stock and prices are keyed on');
  }

  /* ---------- 2. the filters ---------------------------------------- */
  {
    t.check(rowsFor('', 'Furniture', '').length === 3, 'a category filter keeps that category only');
    t.check(rowsFor('', '', 'S1').length === 1, 'a supplier filter keeps what that supplier prices');
    t.check(rowsFor('hinge', '', '').length === 2, 'a search matches across both variants of a product');
    t.check(rowsFor('brass', '', '').length === 1,
      'and narrows to one variant -- the reason a variable product is flattened at all');
    t.check(rowsFor('black plug', '', '').length === 1,
      'every typed word must appear, in any order: "black plug" finds "Black Wall Plug"');
    t.check(rowsFor('zzz', '', '').length === 0, 'and a miss is empty');
    t.check(rowsFor('hinge', 'Cement', '').length === 0, 'filters combine rather than compete');
  }

  /* ---------- 3. the grid and the printout share it ----------------- */
  {
    /* The card grid became a list, but the point of this check did not
       change: the screen and the printout must be built from the SAME
       row set, or a filtered print could list rows the screen is not
       showing. Pinned on the shared call rather than on the shape of
       what is done with it. */
    /* The pricing filter joined the other three. What is pinned is
       unchanged -- both callers pass the SAME filters -- and it now
       covers one more of them. */
    t.check(/const rows = productRowsForList\(filter, categoryFilter, supplierFilter, pricedFilter\);/.test(code),
      'the on-screen list is built from these rows');
    t.check((code.match(/productRowsForList\(filter, categoryFilter, supplierFilter, pricedFilter\)/g) || []).length === 2,
      'and the printout calls the very same function with the very same filters');
    t.check((code.match(/productRowsForList\(filter, categoryFilter, supplierFilter[,)]/g) || []).length === 3,
      'and nothing calls it with a filter the other one is not passing');
    // Neither may walk the catalog for itself.
    const printHandler = (/document\.getElementById\('p_print_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
    t.check(printHandler.length > 0, 'the print handler is found');
    t.check(!/data\.products\.forEach/.test(printHandler),
      'the print handler does not walk data.products itself');
    // Scoped to THIS list's walk, by its own category+supplier gate. The
    // file has other catalog walks -- quote suggestions, the inventory
    // table -- which answer different questions and are not duplicates of
    // it. An earlier version of this counted every forEach over
    // data.products and failed against perfectly correct code.
    t.check((code.match(/const matchesCategory = !categoryFilter \|\| p\.category === categoryFilter;/g) || []).length === 1,
      'the products-list filter is written once, and productRowsForList is where');
    t.check(/function productRowsForList[\s\S]{0,600}const matchesCategory = !categoryFilter/.test(code),
      'which is inside it');
  }

  /* ---------- 4. what the printed page says ------------------------- */
  {
    const h = (/document\.getElementById\('p_print_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
    t.check(/if\(rows\.length===0\)\{ toast\('No products match your filters'\); return; \}/.test(h),
      'printing nothing says so instead of opening a blank page');
    t.check(/if\(!win\)\{ toast\('Your browser blocked the print window/.test(h),
      'and a blocked pop-up is explained rather than failing silently');

    // A filtered list that does not say it is filtered reads as the whole
    // catalog -- the same "say what you are looking at" rule the order
    // history and category screens follow.
    t.check(/if\(filter\.trim\(\)\) applied\.push\(`matching/.test(h)
      && /if\(categoryFilter\) applied\.push\(`in \$\{categoryFilter\}`\)/.test(h)
      && /if\(supplierFilter\) applied\.push\(`priced by \$\{supplierName\(supplierFilter\)\}`\)/.test(h),
      'the header names every filter that is on');
    t.check(/\? `\$\{rows\.length\} product\$\{rows\.length===1\?'':'s'\} \$\{applied\.join\(', '\)\}`\s*\n?\s*: `All \$\{rows\.length\} product/.test(h),
      'and says "All N products" only when none are');
    t.check(/\$\{esc\(todayISO\(\)\)\}/.test(h), 'with the date it was printed');

    t.check(/const qty = r\.kind==='variable-empty' \? '' : getStockQty\(r\.p\.id, r\.idx\);/.test(h),
      'stock is per variant, and blank for a product with no variants to hold any');
    t.check(/thead\{display:table-header-group;\}/.test(h), 'the header repeats on every printed page');
    t.check(/tr\{page-break-inside:avoid;\}/.test(h), 'and no row is split across a page break');
  }
}

process.exit(t.done() ? 1 : 0);
