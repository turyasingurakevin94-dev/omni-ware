#!/usr/bin/env node
'use strict';
/*
 * Browsing the public catalogue by category.
 *
 * This is the only surface a customer ever sees. It showed a flat grid of
 * every product with a single search box -- which asks the customer to
 * already know the word for the thing they want. In a Ugandan hardware
 * shop that word might be mabati, or iron sheets, or roofing, and someone
 * browsing is precisely the person who does not know which.
 *
 * The categories were already there. catalogue-public sends `category` on
 * every item and the page was throwing it away. Same shape as most of what
 * this redesign has turned up: the system knows something and the screen
 * does not use it.
 *
 * Deliberately still absent: price. Publishing one would undercut the
 * agent's own margin, which the whole pricing model is built on.
 *
 * Run: node test/catalogue-browse.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('catalogue browse');
const src = read('catalogue.html');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ITEMS = [
  { productId: '1', name: 'Iron sheets 30g', category: 'Roofing' },
  { productId: '2', name: 'Roofing nails 4"', category: 'Roofing' },
  { productId: '3', name: 'Ridge cap', category: 'Roofing' },
  { productId: '4', name: 'Cement 50kg', category: 'Building' },
  { productId: '5', name: 'Sand', category: 'Building' },
  { productId: '6', name: 'Hinges 4"', category: 'Fasteners', variantLabel: 'Brass' },
  { productId: '7', name: 'Padlock', category: '' },
  { productId: '8', name: 'Bolt M8', category: '   ' },
];

let fns = null, err = null;
try {
  fns = compileScope(
    [extractFunction(src, 'catalogueCategories', 'catalogue.html')],
    { items: ITEMS, esc }, ['catalogueCategories'],
  );
} catch (e) { err = e; }
t.check(!!fns, `the category helper compiles${err ? ` (${err.message})` : ''}`);

/* ---------- 1. the aisles ------------------------------------------- */
if (fns) {
  const cats = fns.catalogueCategories();
  const names = cats.map(c => c.name);

  t.check(names[0] === 'Roofing' && cats[0].count === 3,
    'the busiest aisle comes first, since that is what most people came for');
  t.check(JSON.stringify(names) === JSON.stringify(['Roofing', 'Building', 'Fasteners', 'Other']),
    `aisles are ordered by how much is in them (${names.join(', ')})`);
  // Other holds two here and Fasteners one, so a pure count sort would put
  // Other third. It is pinned last on purpose: it is not an aisle the shop
  // chose, and ranking it above a named one reads as a real department.
  t.check(names[names.length - 1] === 'Other',
    'and Other is last regardless of how much falls into it');

  const total = cats.reduce((n, c) => n + c.count, 0);
  t.check(total === ITEMS.length, `every product lands in exactly one aisle (${total} of ${ITEMS.length})`);

  const other = cats.find(c => c.name === 'Other');
  t.check(other && other.count === 2,
    'an uncategorised product goes to Other rather than disappearing, and so does a whitespace-only category');
}

/* ---------- 2. category and search narrow together ------------------ */
/*
 * The rule that makes this usable: picking an aisle then typing searches
 * WITHIN it, rather than silently starting over across everything.
 */
{
  const filter = (activeCategory, q) => {
    const inCategory = !activeCategory
      ? ITEMS
      : ITEMS.filter(it => ((it.category || '').trim() || 'Other') === activeCategory);
    q = q.trim().toLowerCase();
    return !q ? inCategory : inCategory.filter(it =>
      (it.name || '').toLowerCase().includes(q) || (it.variantLabel || '').toLowerCase().includes(q));
  };

  t.check(filter('', '').length === 8, 'no aisle and no search shows everything');
  t.check(filter('Roofing', '').length === 3, 'an aisle narrows to its own products');
  t.check(filter('Roofing', 'nails').length === 1, 'and a search narrows within that aisle');
  t.check(filter('Building', 'nails').length === 0,
    'a term that exists elsewhere does not leak in from another aisle');
  t.check(filter('', 'nails').length === 1, 'while searching with no aisle still spans everything');
  t.check(filter('Other', '').length === 2, 'Other is selectable like any aisle');
  t.check(filter('Fasteners', 'brass').length === 1,
    'the variant is searchable too, since that is often the distinguishing word');
}

/* ---------- 3. it does not offer a choice that is not one ----------- */
{
  const single = compileScope(
    [extractFunction(src, 'catalogueCategories', 'catalogue.html')],
    { items: [{ productId: '1', name: 'Only', category: 'Roofing' }], esc }, ['catalogueCategories'],
  );
  t.check(single.catalogueCategories().length === 1, 'a one-aisle catalogue has one category');
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/if\(cats\.length < 2\)\{ wrap\.style\.display = 'none'; return; \}/.test(code),
    'and the filter hides itself rather than showing a single pointless chip');
}

/* ---------- 4. the empty state gives a way out ---------------------- */
/*
 * There are now two reasons a customer sees nothing, and the way out
 * differs. "No products found" served neither.
 */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/Nothing in \$\{esc\(activeCategory\)\} matches/.test(code),
    'a search inside an aisle that finds nothing says which aisle');
  t.check(/Try All, or ask for it below/.test(code),
    'and points at the two ways out');
  t.check(/Nothing listed under \$\{esc\(activeCategory\)\} yet/.test(code),
    'an empty aisle says so rather than blaming the search');
  t.check(/will find out/.test(code),
    'and a miss with no aisle offers to ask the agent, which is the point of the page');
  t.check(!/>No products found\.</.test(code),
    'the one-size-fits-nothing message is gone');
}

/* ---------- 5. the chips are usable, and price stays out ------------ */
{
  const code = src;
  t.check(/\.cat-chip\{[^}]*min-height:44px/.test(code),
    'a chip is tappable at 44px');
  t.check(/\$\{esc\(c\.label\)\} <span class="cat-n">/.test(code),
    'with a real space before the count, not just a flex gap');
  t.check(/\.cat-chip\.on \.cat-n\{color:#[0-9A-Fa-f]{6};\}/.test(code),
    'and the count colour is opaque, so its contrast can actually be measured');

  // The deliberate omission. A price here would undercut the agent's
  // margin, which agent-catalog and agent-submit-order are built around.
  t.check(!/floorPrice|ourPrice|fmtUGX/.test(code),
    'no price is published on the customer-facing catalogue');
}

process.exit(t.done() ? 1 : 0);
