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
// The lookbehind guards against `accept="image/*"` in the media picker,
// whose `/*` opens a block comment a naive stripper does not close for
// another 104,248 characters — blinding every check to the markup in
// between. A real opener is not preceded by a word character or a quote.
const stripComments = (s) => s
  .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const code = stripComments(src);

const scope = compileScope([
  extractDeclaration(src, 'LIST_PAGE_SIZES', 'index.html'),
  extractDeclaration(src, 'LIST_PAGE_DEFAULT', 'index.html'),
  extractDeclaration(src, 'listPageExpanded', 'index.html'),
  extractDeclaration(src, 'LIST_PAGED', 'index.html'),
  extractDeclaration(src, 'listPageAt', 'index.html'),
  extractFunction(src, 'listPageSize', 'index.html'),
  extractFunction(src, 'listPageCount', 'index.html'),
  extractFunction(src, 'listPageIndex', 'index.html'),
  extractFunction(src, 'listPageSlice', 'index.html'),
  extractFunction(src, 'listPagerNumbers', 'index.html'),
  extractFunction(src, 'listPagerHTML', 'index.html'),
  extractFunction(src, 'listMoreButtonHTML', 'index.html'),
  'function __page(id, v){ listPageAt[id] = v; }',
  'function __expand(id, v){ listPageExpanded[id] = v; }',
  'function __sizes(){ return LIST_PAGE_SIZES; }',
  'function __default(){ return LIST_PAGE_DEFAULT; }',
], {
  esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
}, ['listPageSize', 'listPageSlice', 'listMoreButtonHTML', 'listPagerNumbers', '__expand', '__page', '__sizes', '__default']);

const { listPageSize, listPageSlice, listMoreButtonHTML, listPagerNumbers, __expand, __page } = scope;
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

/* ---------- 2b. the customer book turns pages ------------------------- */
/*
 * The owner asked for a next page on Customers rather than one button that
 * pours the whole book onto the screen. The page must be the RIGHT rows --
 * the second page starts where the first stopped, by identity -- and the
 * control must say which rows of how many, in figures.
 */
{
  const size = listPageSize('customers');
  const book = Array.from({ length: 60 }, (_, i) => ({ tag: 'c' + i }));
  __page('customers', 0);
  let pg = listPageSlice('customers', book);
  t.check(pg.length === size && pg[0] === book[0], 'page one is the front of the book');
  __page('customers', 1);
  pg = listPageSlice('customers', book);
  t.check(pg.length === size && pg[0] === book[size] && pg[size - 1] === book[2 * size - 1],
    `page two starts where page one stopped (first is ${pg[0] && pg[0].tag}, want c${size})`);
  __page('customers', 2);
  eq(listPageSlice('customers', book).length, 60 - 2 * size, 'the last page holds what is left, not a padded page');
  __page('customers', 9);
  t.check(listPageSlice('customers', book)[0] === book[2 * size],
    'a page past the end lands on the last page rather than an empty one');
  __page('customers', 0);
  __expand('customers', true);
  eq(listPageSlice('customers', book).length, size, 'a paged list is not grown by the old show-all state');
  __expand('customers', false);

  __page('customers', 1);
  const html = listMoreButtonHTML('customers', 60, 'customers');
  t.check(/data-list-page="customers"/.test(html) && !/data-list-more=/.test(html),
    'the customer book draws the pager, not the show-all button');
  t.check(new RegExp(`${size + 1}&ndash;${2 * size}</b> of 60 customers`).test(html),
    'and names the rows on screen out of every one that matched');
  t.check(/aria-current="page"[^>]*>2</.test(html), 'the page you are on is marked, and it is page 2');
  t.check(/aria-label="Previous page"/.test(html) && !/data-page="0" disabled aria-label="Previous page"/.test(html),
    'from page 2 the way back is open');
  __page('customers', 2);
  t.check(/data-page="3" disabled aria-label="Next page"/.test(listMoreButtonHTML('customers', 60, 'customers')),
    'and on the last page the way forward is shut');
  __page('customers', 0);
  eq(listMoreButtonHTML('customers', size, 'customers'), '', 'a book that fits one page gets no pager');

  eq(JSON.stringify(listPagerNumbers(0, 5)), '[0,1,2,3,4]', 'a few pages are all shown');
  eq(JSON.stringify(listPagerNumbers(6, 13)), '[0,null,5,6,7,null,12]',
    'many pages show the ends and the neighbours, with the gaps marked');
  eq(JSON.stringify(listPagerNumbers(0, 13)), '[0,1,2,3,null,12]', 'at the start, the first few');
  eq(JSON.stringify(listPagerNumbers(12, 13)), '[0,null,9,10,11,12]', 'at the end, the last few');

  const render = (/function renderCustomers\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/if\(question !== custPageQuestion\)\{[^}]*listPageAt\.customers = 0;/.test(render),
    'a new search or lens goes back to page one');
  t.check(/closest\('\[data-list-page\]'\)/.test(code) && /listPageAt\[id\] = /.test(code),
    'one delegated listener turns the page');
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

/* ---------- 4b. the invoice tables, where the summary is money -------- */
/*
 * The owner opened Invoices to seventy rows on one page and asked for
 * some of them to be hidden. These two tables are the sharpest case of
 * the risk this file was written for: each ends in a Total row, and
 * both used to accumulate that total INSIDE the loop that drew the
 * rows. Harmless while the loop drew everything; the moment it draws
 * two dozen, "Total 45,408,740" silently becomes the total of whatever
 * is on screen — a wrong figure, in money, presented as the answer to
 * the filter the owner set.
 */
{
  const code = stripComments(src);
  const renderers = [
    { fn: 'renderInvoices', id: 'invoices', totalOf: 'savedQuoteTotal' },
    { fn: 'renderPurchaseInvoices', id: 'purchaseInvoices', totalOf: 'purchaseInvoiceTotal' },
  ];
  renderers.forEach(({ fn, id, totalOf }) => {
    const body = stripComments(extractFunction(src, fn, 'index.html'));
    const totalsAt = body.indexOf(`invoices.forEach(`);
    const sliceAt = body.indexOf(`listPageSlice('${id}', invoices)`);
    const rowsAt = body.indexOf('const rowsHtml = shown.map(');
    t.check(totalsAt > 0 && sliceAt > totalsAt,
      `${fn}: the totals are summed over the whole range BEFORE the page is cut`);
    t.check(rowsAt > sliceAt,
      `${fn}: and the rows are drawn from the page, not from everything`);
    t.check(new RegExp(`invoices\\.forEach\\([\\s\\S]{0,220}${totalOf}\\(`).test(body),
      `${fn}: the totalling pass reads the unsliced list`);
    t.check(!/shown\.forEach\(|shown\.reduce\(/.test(body),
      `${fn}: and nothing is summed from the page — that is the whole hazard`);
    t.check(new RegExp(`listMoreButtonHTML\\('${id}', invoices\\.length`).test(body),
      `${fn}: the button promises the FULL count, which is what pressing it delivers`);
    /* A footer reading "Total" beside two dozen rows reads as their
       total. When a page is cut it has to say which total it is. */
    t.check(/const totalLabel = cut \? `Total \(all \$\{invoices\.length\}\)` : 'Total';/.test(body),
      `${fn}: and the footer says so when a page is being shown`);
    /* Selection can only reach drawn checkboxes, and the bulk actions
       behind it include voiding. The label must not imply the rest.
       ASKED OF THE REGISTER THAT STILL HAS ONE. Purchase invoices no
       longer draws checkboxes at all: on that screen voiding is not a
       flag but an act on the shelf -- a bill raised from the shop's own
       purchase order takes its goods back off the shelf and reopens the
       order -- and "void selected" behind a dropdown did several of
       those irreversible things on one press, with nothing on screen
       saying which of the ticked rows were deliveries. Its bulk menu
       and its checkbox column are gone; printing survives as a list
       print over everything the filters matched, which is not a
       selection and cannot misreport one. The assertion is kept, and
       kept sharp, for Invoices, where selection still exists -- the
       original hazard is that a select-all label promises rows the
       press cannot reach, and a screen with no select-all makes no
       promise to break. */
    if(fn !== 'renderPurchaseInvoices'){
      t.check(/const selectAllLabel = cut \? `Select all \$\{shown\.length\} shown`/.test(body),
        `${fn}: select-all says what it can actually take`);
    } else {
      t.check(!/pi-doc-check|selectAllLabel|Select all/.test(body),
        `${fn}: draws no selection at all, so it promises no rows it cannot take`);
    }
  });

  // Printing the list is not paging: it still covers the whole range.
  t.check(/piLastRows = invoices;/.test(code) && /invLastRows = invoices;/.test(code),
    'the print list keeps every row the filters matched, page or no page');
}

/* ---------- 5. it shares the stock log's control, not a copy of it ---- */
{
  t.check(/\.log-more-row\{/.test(src),
    'one style for the control, wherever it appears');
  const uses = (src.match(/class="log-more-row"/g) || []).length;
  t.check(uses >= 2, `used by both the stock log and the shared helper (${uses} places)`);
}

process.exit(t.done() ? 1 : 0);
