#!/usr/bin/env node
'use strict';
/*
 * The code a supplier uses for an item.
 *
 * Two suppliers stocking the same runner call it two different things on
 * their invoices, so the code belongs to the PRICE ROW -- product plus
 * variant plus supplier -- and not to the product. The variant's own SKU
 * is ours and stays where it is.
 *
 * That is also why it is never a shared default in bulk mode the way
 * packing and the tier ladder are: a code that named more than one item
 * would not be a code. Each variant card carries its own.
 *
 * And it is searchable, which is most of the point. The quote in your
 * hand says RUN-SC-10 and nothing else in the app does -- being able to
 * type that in is the reason for writing it down.
 *
 * Run: node test/supplier-sku.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('supplier sku');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. searchable by the code on the quote -------------------- */
{
  const store = {
    products: [{ id: 'P1', name: 'Runners', category: 'Furniture', subcategory: '', type: 'variable',
      variants: [{ sku: 'OURS-10', combo: { Size: '10"' } }] }],
    prices: [
      { id: 1, productId: 'P1', variantIdx: 0, supplierId: 'S1', supplierSku: 'RUN-SC-10', date: '2026-08-01' },
      { id: 2, productId: 'P1', variantIdx: 0, supplierId: 'S2', supplierSku: 'ZX/449', date: '2026-08-01' },
      { id: 3, productId: 'P1', variantIdx: 0, supplierId: 'S3', date: '2026-08-01' },
    ],
  };
  const NAMES = ['getFilteredPriceRows'];
  const scope = compileScope([
    extractFunction(src, 'productSearchHaystack', 'index.html'),
    extractFunction(src, 'getFilteredPriceRows', 'index.html'),
  ], {
    data: store,
    supplierName: (id) => ({ S1: 'Dooba', S2: 'Kripa', S3: 'Jagadamba' }[id] || ''),
    productName: (id) => id,
    productVariantLabel: () => 'Runners 10"',
    resolveProductImage: () => null,
    variantLabel: (c) => Object.values(c || {}).join(' '),
    searchTokens: (f) => String(f || '').toLowerCase().split(/\s+/).filter(Boolean),
    matchesAllTokens: (hay, toks) => toks.every((x) => hay.includes(x)),
    priceRowMatchesAge: () => true,
  }, NAMES);

  const ids = (q) => scope.getFilteredPriceRows(q, '', '', '').map((r) => r.id).sort();
  t.check(ids('RUN-SC-10').join(',') === '1',
    `the code off one supplier's quote finds that supplier's row (${ids('RUN-SC-10')})`);
  t.check(ids('zx/449').join(',') === '2', 'however it is cased, and whatever punctuation it carries');
  t.check(ids('runners').length === 3, 'the product name still finds every row, as before');
  t.check(ids('dooba').join(',') === '1', 'and the supplier name still finds theirs');
  /* A row with no code must not be swept in by searching for one, and
     must not become findable by the word "undefined". */
  t.check(ids('undefined').length === 0, 'a row with no code is not findable by the word "undefined"');
  t.check(ids('RUN-SC-10').includes(3) === false, 'nor by another supplier\'s code');
}

/* ---------- 1b. and findable where an item is picked ----------------- */
/*
 * REPORTED. Recording a code made it searchable in the Price Registry and
 * nowhere else -- so the one place it is actually needed, typing it into
 * "Add item to quote" with the supplier's paper in your hand, found
 * nothing.
 *
 * Every picker in the app runs through buildProductSuggestionEntries, and
 * its haystack was product name, ID and variant. The code lives on the
 * PRICE row, so nothing there could see it.
 */
{
  const store = {
    products: [
      { id: 'P1', name: 'Chrome Pipe', category: 'Plumbing', type: 'variable',
        variants: [{ sku: 'OURS-19', combo: { Size: '19mm' } }, { sku: 'OURS-25', combo: { Size: '25mm' } }] },
      { id: 'P2', name: 'Cement', category: 'Building', type: 'simple' },
    ],
    prices: [
      { productId: 'P1', variantIdx: 0, supplierId: 'S1', supplierSku: 'CP-19L' },
      { productId: 'P1', variantIdx: 1, supplierId: 'S1', supplierSku: 'CP-25H' },
      { productId: 'P1', variantIdx: 1, supplierId: 'S2', supplierSku: 'ZX/449' },
      { productId: 'P2', variantIdx: null, supplierId: 'S1', supplierSku: 'CEM-50' },
      { productId: 'P2', variantIdx: null, supplierId: 'S2' },
    ],
  };
  const NAMES2 = ['buildProductSuggestionEntries', 'supplierSkuIndex'];
  const sc = compileScope([
    extractFunction(src, 'supplierSkuIndex', 'index.html'),
    extractFunction(src, 'buildProductSuggestionEntries', 'index.html'),
  ], {
    data: store,
    variantLabel: (c) => Object.values(c || {}).join(' '),
    matchesAllTokens: (hay, toks) => toks.every((x) => hay.includes(x)),
  }, NAMES2);

  const found = (q) => sc.buildProductSuggestionEntries(q.toLowerCase().split(/\s+/).filter(Boolean))
    .map((e) => e.p.id + (e.variantIdx == null ? '' : '/' + e.variantIdx)).join(',');

  eq(found('CP-25H'), 'P1/1', "a code off the supplier's quote finds the variant they gave it to");
  eq(found('cp-19l'), 'P1/0', 'however it is cased');
  eq(found('ZX/449'), 'P1/1', "and a second supplier's code for the same variant finds it too");
  eq(found('CEM-50'), 'P2', 'a simple product is found by its code as well');

  /* A code belongs to one line. Finding a neighbour by it would send
     somebody to the wrong item with the right-looking paperwork. */
  t.check(!found('CP-25H').includes('P1/0'), 'and not the variant next to it');
  t.check(!found('CP-19L').includes('P2'), 'nor a different product entirely');

  // Everything that worked before still works.
  eq(found('chrome pipe').split(',').length, 2, 'searching by name still lists both variants');
  eq(found('OURS-25'), 'P1/1', 'and our own variant SKU still finds it');
  eq(found('P2'), 'P2', 'as does a product ID');
  t.check(found('nothinglikethis') === '', 'and a miss is still a miss');

  /* A row with no code must not make its item findable by the empty
     string, nor by the word "undefined". */
  t.check(!found('undefined').includes('P2'),
    'a price row with no code does not make its product findable by "undefined"');
}

/* ---------- 2. one code per row, never a shared default --------------- */
{
  /* Packing and the tier ladder have a default because a supplier can
     pack or discount everything the same way. A code cannot be shared:
     it names one item. So there is no product-wide box for it in bulk
     mode -- it is hidden, and each variant card carries its own. */
  t.check(/id="pr_sku_field"/.test(src) && /id="pr_supplier_sku"/.test(src),
    'single entry has one field for it');
  const mode = extractFunction(src, 'setPrBulkMode', 'index.html');
  t.check(/document\.getElementById\('pr_sku_field'\)\.style\.display = on \? 'none' : '';/.test(mode),
    'and bulk mode hides it, having nowhere sensible to apply one code to many items');

  const rows = extractFunction(src, 'renderPrBulkVariantRows', 'index.html');
  t.check(/class="pr-bulk-sku" data-idx="\$\{i\}"/.test(rows),
    'each variant card carries a box of its own');
  t.check(/value="\$\{esc\(prBulkSkus\[i\]\|\|''\)\}"/.test(rows),
    'showing the code already on file for that variant');
  t.check(/prBulkSkus\[Number\(e\.currentTarget\.dataset\.idx\)\] = e\.currentTarget\.value;/.test(rows),
    'and typing into it keeps the real variant index, like every other control on the card');

  const load = extractFunction(src, 'renderPrBulkVariants', 'index.html');
  t.check(/prBulkSkus = variantRows0\.map\(r=> \(r && r\.supplierSku\) \? r\.supplierSku : ''\);/.test(load),
    'opening the form loads each variant\'s existing code');
}

/* ---------- 3. saved, reloaded, and kept ------------------------------ */
{
  t.check(/supplierSku: pr\.supplier_sku \|\| ''/.test(code), 'the column is read back from the server');
  t.check(/supplier_sku: pr\.supplierSku \|\| null/.test(code),
    'and written to it — a blank stored as nothing, not as an empty code');

  const save = /getElementById\('pr_save'\)\.addEventListener\('click', \(\)=>\{([\s\S]*?)\n\}\);/.exec(src);
  const body = save ? save[1] : '';
  t.check(!!save, 'the save handler is there to check');
  t.check(/supplierSku: String\(prBulkSkus\[i\]\|\|''\)\.trim\(\),/.test(body),
    'a bulk save writes each variant its own code');
  t.check(/supplierSku: document\.getElementById\('pr_supplier_sku'\)\.value\.trim\(\),/.test(body),
    'and a single save writes the one on the form');

  /* Reopening an entry has to show the code back, or the next save
     silently blanks it. */
  t.check(/document\.getElementById\('pr_supplier_sku'\)\.value = r\.supplierSku \|\| '';/.test(code),
    'editing an entry shows the code it already has, rather than an empty box that would erase it');
  const reset = extractFunction(src, 'resetPriceForm', 'index.html');
  t.check(/document\.getElementById\('pr_supplier_sku'\)\.value = '';/.test(reset),
    'and it is cleared with the form, so it cannot ride onto the next entry');
}

/* ---------- 4. visible, or there was no point writing it down --------- */
{
  t.check((code.match(/class="prc-sku"/g) || []).length === 2,
    'both the card and the compact row show it');
  t.check((code.match(/\$\{r\.supplierSku \? `<span class="prc-sku"/g) || []).length === 2,
    'and only when there is one — no empty chip on the rows that have none');
  /* Counted, not merely found: the two renderers are siblings, and one
     of them still highlighting would let the other quietly stop. */
  t.check((code.match(/highlightTokens\(r\.supplierSku, tokens\)/g) || []).length === 2,
    'with the search term lit up in it on BOTH, since searching by code is what it is for');
  t.check(/supplier's code/.test(src),
    'and the search box says it can be searched by');
}

process.exit(t.done() ? 1 : 0);
