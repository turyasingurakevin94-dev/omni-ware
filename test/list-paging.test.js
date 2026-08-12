#!/usr/bin/env node
'use strict';
/*
 * The long pages show a page, and say how many there really are.
 *
 * The stock log got this treatment first because it was the one that got
 * noticed. It was not the worst. The Price Registry renders every row it
 * holds -- 276 today, and only ever more, because a price entry is never
 * deleted, it is superseded. Measured in the running app:
 *
 *     Price Registry   52,346px  ->   4,923px
 *     Products         46,428px  ->   3,964px
 *     Customers        19,486px  ->   5,001px
 *     Suppliers         7,944px  ->   4,637px
 *
 * Each of those pages puts its filters and a summary strip at the top and
 * then buries them under a grid tall enough that getting back to the
 * search box is a scroll of its own.
 *
 * THE RISK THIS FILE EXISTS FOR is not the paging. It is that every one of
 * these pages carries a summary computed over what matched -- the price
 * registry's stats strip, the products page's held-stock note -- and a
 * slice taken one step too early would make those describe twenty-four
 * rows while claiming to describe the search. A long list is at least
 * honest; a summary quietly measuring the visible page is not. So the
 * checks below care most about WHERE the slice is taken.
 *
 * Run: node test/list-paging.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('list paging');
const src = read('index.html');
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const code = stripComments(src);

const scope = compileScope([
  extractDeclaration(src, 'LIST_PAGE_SIZES', 'index.html'),
  extractDeclaration(src, 'LIST_PAGE_DEFAULT', 'index.html'),
  extractDeclaration(src, 'listPageExpanded', 'index.html'),
  extractFunction(src, 'listPageSize', 'index.html'),
  extractFunction(src, 'listPageSlice', 'index.html'),
  extractFunction(src, 'listMoreButtonHTML', 'index.html'),
  'function __expand(id, v){ listPageExpanded[id] = v; }',
  'function __sizes(){ return LIST_PAGE_SIZES; }',
  'function __default(){ return LIST_PAGE_DEFAULT; }',
], {
  esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
}, ['listPageSize', 'listPageSlice', 'listMoreButtonHTML', '__expand', '__sizes', '__default']);

const { listPageSize, listPageSlice, listMoreButtonHTML, __expand } = scope;
const rows = (n) => Array.from({ length: n }, (_, i) => ({ i }));
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the slice ---------------------------------------------- */
{
  __expand('prices', false);
  eq(listPageSlice('prices', rows(276)).length, listPageSize('prices'),
    'a long list is cut to one page');
  eq(listPageSlice('prices', rows(5)).length, 5,
    'a short one is left whole rather than padded or cut');
  eq(listPageSlice('prices', []).length, 0, 'and an empty one stays empty');

  __expand('prices', true);
  eq(listPageSlice('prices', rows(276)).length, 276,
    'expanded, every row is handed over — these pages have no cap above them');
  __expand('prices', false);

  /* The slice must not reorder or replace anything: the caller has already
     filtered, sorted and (on the price registry) grouped these.

     Checked against a list LONGER than the page, which is the only way
     front differs from back. An earlier version of this used ten rows
     against a page of twenty-four, so `slice(-24)` returned the same ten
     and "takes the front" passed while the code took the end — hiding the
     newest entries, which on every one of these pages is the half
     somebody is looking for. */
  const long = Array.from({ length: 40 }, (_, i) => ({ tag: 'r' + i }));
  __expand('prices', false);
  const cut = listPageSlice('prices', long);
  const size = listPageSize('prices');
  t.check(cut.length === size && cut[0] === long[0] && cut[size - 1] === long[size - 1],
    `the page is the FRONT of the list, in order, by identity (first is ${cut[0] && cut[0].tag}, want r0)`);

  eq(listPageSize('nothing-registered'), scope.__default(),
    'an unregistered list still gets the fallback page size rather than none');
}

/* ---------- 2. the control tells the truth ---------------------------- */
{
  __expand('prices', false);
  const btn = listMoreButtonHTML('prices', 276, 'price entries');
  t.check(/Show all 276 price entries/.test(btn),
    `the label names what matched, not what is on screen (${btn.slice(0, 80)})`);
  t.check(/data-list-more="prices"/.test(btn), 'and carries which list it belongs to');
  t.check(/aria-expanded="false"/.test(btn), 'and its state');

  __expand('prices', true);
  t.check(/Show fewer/.test(listMoreButtonHTML('prices', 276, 'price entries')),
    'expanded, it offers the way back');
  t.check(/aria-expanded="true"/.test(listMoreButtonHTML('prices', 276, 'price entries')),
    'and says so');
  __expand('prices', false);

  eq(listMoreButtonHTML('prices', 24, 'price entries'), '',
    'a list that exactly fits gets no button');
  eq(listMoreButtonHTML('prices', 3, 'price entries'), '',
    'nor does a short one');
  t.check(listMoreButtonHTML('prices', 25, 'price entries') !== '',
    'one row over the page is enough to offer the rest');
}

/* ---------- 3. WHERE the slice is taken ------------------------------- */
/*
 * The whole risk. Each of these pages computes something over the rows
 * before it draws them; slicing first would make that something describe
 * the page while claiming to describe the search.
 */
{
  const prices = (/function renderPrices\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/const s = priceRegistryStats\(rows\);/.test(prices),
    'the price registry totals every row that matched, not the page');
  t.check(/const ordered = priceGroupsFor\(rows, sortMode\)\.flatMap\(g=> g\.rows\);/.test(prices)
    && /listPageSlice\('prices', ordered\)/.test(prices),
    'and slices AFTER grouping, so a product’s competing quotes are not cut in half at the boundary');
  t.check(/listMoreButtonHTML\('prices', ordered\.length,/.test(prices),
    'the button counts the grouped set it actually paged, not some other list');

  const products = (/function renderProducts\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/listPageSlice\('products', rows\)/.test(products)
    && /listMoreButtonHTML\('products', rows\.length,/.test(products),
    'products pages its filtered rows and counts all of them');
  t.check(products.indexOf('heldNote') < products.indexOf('listPageSlice'),
    'and the held-stock note is worked out before the slice, so it describes the search');

  const customers = (/function renderCustomers\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/listPageSlice\('customers', rows\)/.test(customers)
    && /listMoreButtonHTML\('customers', rows\.length,/.test(customers),
    'customers likewise');

  const suppliers = (/function renderSuppliers\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/listPageSlice\('suppliers', rows\)/.test(suppliers)
    && /listMoreButtonHTML\('suppliers', rows\.length,/.test(suppliers),
    'and suppliers');

  // Nothing may total the slice. If a caller ever binds it to a name and
  // then measures it, that is the bug this file is about.
  t.check(!/listPageSlice\([^)]*\)\.(length|reduce|forEach)/.test(code),
    'nothing measures the page — listPageSlice’s result is mapped and nothing else');
}

/* ---------- 4. every button is wired to something --------------------- */
/*
 * A renderer that draws the control without registering a re-render draws
 * a button that does nothing and looks broken. Rather than trusting four
 * call sites to remember, the ids are read back out of the source and
 * compared against the registry.
 */
{
  const used = [...new Set([...code.matchAll(/listMoreButtonHTML\('([\w-]+)'/g)].map((m) => m[1]))].sort();
  const sliced = [...new Set([...code.matchAll(/listPageSlice\('([\w-]+)'/g)].map((m) => m[1]))].sort();
  const registry = (/const LIST_PAGE_RERENDER = \{([\s\S]*?)\n\};/.exec(code) || ['', ''])[1];
  const wired = [...new Set([...registry.matchAll(/(\w+):/g)].map((m) => m[1]))].sort();
  const sized = [...new Set([...(/const LIST_PAGE_SIZES = \{([^}]*)\}/.exec(code) || ['', ''])[1]
    .matchAll(/(\w+):/g)].map((m) => m[1]))].sort();

  t.check(used.length >= 4, `at least the four long pages are paged (${used.join(', ')})`);
  eq(JSON.stringify(used), JSON.stringify(sliced),
    'every list that draws a button also takes a page, and the other way round');
  eq(JSON.stringify(used), JSON.stringify(wired),
    'and every one of them has a re-render registered, so no button is inert');
  eq(JSON.stringify(used), JSON.stringify(sized),
    'and a page size of its own rather than the fallback');

  // The listener itself.
  t.check(/e\.target\.closest\('\[data-list-more\]'\)/.test(code),
    'one delegated listener catches them all, so a rebuilt grid never loses its button');
  t.check(/listPageExpanded\[id\] = !listPageExpanded\[id\];/.test(code),
    'which flips that list’s state');
  t.check(/const again = LIST_PAGE_RERENDER\[id\];\s*\r?\n\s*if\(again\) again\(\);/.test(code),
    'and redraws the page it belongs to');

  // Sticky, and deliberately not reset by filtering.
  t.check(/^const listPageExpanded = \{\};$/m.test(code),
    'the expanded state lives outside the renderers, so a redraw does not fold it up');
  t.check(!/listPageExpanded = \{\};[\s\S]{0,120}render/.test(code.replace(/^const listPageExpanded = \{\};$/m, '')),
    'and nothing clears it on the way into a render');
}

/* ---------- 5. it shares the stock log's control, not a copy of it ---- */
{
  t.check(/\.log-more-row\{/.test(src),
    'one style for the control, wherever it appears');
  const uses = (src.match(/class="log-more-row"/g) || []).length;
  t.check(uses >= 2, `used by both the stock log and the shared helper (${uses} places)`);
}

process.exit(t.done() ? 1 : 0);
