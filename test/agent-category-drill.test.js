#!/usr/bin/env node
'use strict';
/*
 * Picking a category on the Sell screen takes you INTO it.
 *
 * The screen already had most of a browse hub -- a category strip, a
 * subcategory row, discovery shelves for solutions, order-again and
 * sponsored items, and filter chips. What it did not have was anywhere to
 * go. Choosing a category applied a filter: the shelves hid themselves via
 * showingDiscoveryExtras(), but the category strip and the discovery chips
 * stayed put and there was no way back except tapping the same category
 * again to toggle it off. It read as a narrowed list, not as a place.
 *
 * It is a section now. The hub's own furniture steps aside, and the
 * section states where you are, how much is in it, and how to leave.
 *
 * Run: node test/agent-category-drill.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('agent category drill');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. the section exists and is only shown inside one ------- */
{
  t.check(/<div class="ag-crumb" id="ag_catCrumb" style="display:none;"><\/div>/.test(src),
    'the section header is in the markup, hidden until it is needed');
  t.check(/const inCategory = !!browseCategoryFilter;/.test(code),
    'and being in a category is what decides everything below');
}

/* ---------- 2. the hub steps aside --------------------------------- */
/*
 * The strip and the discovery chips are how you CHOOSE a category. Leaving
 * them on screen once you are inside one is what made it read as a filter.
 */
{
  t.check(/getElementById\('ag_catStripWrap'\)\.style\.display = inCategory \? 'none' : ''/.test(code),
    'the category strip hides once you are inside a category');
  t.check(/getElementById\('ag_browseChips'\)\.style\.display = inCategory \? 'none' : ''/.test(code),
    'and so do the discovery filter chips');
  t.check(/getElementById\('ag_gridTitle'\)\.style\.display = \(discovery \|\| inCategory\) \? 'none' : ''/.test(code),
    'the grid title stands down inside a category, since the section header says it');

  // The shelves were already handled, and must stay that way.
  t.check(/return !q && browseFilter==='all' && !browseCategoryFilter && !browseSubcategoryFilter;/.test(code),
    'the existing rule still hides the shelves inside a category');
}

/* ---------- 3. it says where you are, and how much is here ---------- */
{
  t.check(/class="ag-crumb-here">\$\{esc\(browseCategoryFilter\)\}\$\{sub\}/.test(code),
    'the section names the category');
  t.check(/browseSubcategoryFilter \? ` <span class="ag-crumb-sub">/.test(code),
    'and the subcategory when one is chosen, with a real space before it');
  t.check(/class="ag-crumb-n">\$\{groups\.length\} item\$\{groups\.length===1\?'':'s'\}/.test(code),
    'and how many items are in it');

  // The count moved, so it must not also remain on the title.
  t.check(/\(discovery \|\| inCategory\)\s*\?\s*''\s*:\s*`Results/.test(code),
    'the title no longer repeats the count inside a category');
}

/* ---------- 4. there is a way back, and it is reachable ------------- */
{
  t.check(/id="ag_catBack"/.test(code), 'the section has a back control');
  t.check(/\.ag-crumb-back\{[^}]*min-height:44px/.test(src) && /\.ag-crumb-back\{[^}]*min-width:44px/.test(src),
    'sized for a thumb at 44px, like every other control on this surface');
  t.check(/\.ag-crumb-back\{[^}]*box-sizing:border-box/.test(src),
    'and it restores border-box after all:unset, so 44 means 44');
  t.check(/\.ag-crumb-back:focus-visible\{outline:/.test(src),
    'with a visible focus ring');

  // Leaving must clear BOTH filters. Clearing only the category would drop
  // you back on the hub with an invisible subcategory still applied.
  t.check(/browseCategoryFilter = null;\s*browseSubcategoryFilter = null;\s*renderSubcategoryChips\(\);\s*renderBrowseGrid\(\);/.test(code),
    'going back clears the subcategory as well as the category');
}

/* ---------- 5. nothing is reachable without choosing --------------- */
/*
 * There is no "All products" list. Dumping the catalogue under the tiles
 * made the tiles decoration: an agent could scroll past them into
 * everything, so picking an aisle never had a point. A product is reached
 * through its category, or by searching for it.
 */
{
  t.check(/getElementById\('ag_browseGrid'\)\.style\.display = discovery \? 'none' : ''/.test(code),
    'the grid is hidden on the hub');
  t.check(/if\(discovery\)\{ grid\.innerHTML = ''; return; \}/.test(code),
    'and not even built there, since that is the whole catalogue on a mid-range phone');
  t.check(!/'All products'/.test(code),
    'the All products title is gone');

  // The two ways in, and the two dead ends, say different things.
  t.check(/Nothing in \$\{esc\(browseSubcategoryFilter \|\| browseCategoryFilter\)\} yet\./.test(code),
    'an empty aisle names itself');
  t.check(/No products match that search\. Try a category instead\./.test(code),
    'and a search that finds nothing points back at the aisles');
}

/* ---------- 6. nothing is stranded ---------------------------------- */
/*
 * With no All-products list, a product whose category is blank would be
 * unreachable except by searching for it by name -- which is exactly the
 * knowledge a browsing agent does not have. Every product belongs to a
 * tile, and the leftovers belong to Other.
 */
{
  const { extractFunction, compileScope } = require('./_extract');
  let itemCategory = null;
  try {
    ({ itemCategory } = compileScope(
      ["const AGENT_OTHER_CATEGORY = 'Other';", extractFunction(src, 'itemCategory', 'agent.html')],
      {}, ['itemCategory'],
    ));
  } catch (e) { /* reported below */ }
  t.check(typeof itemCategory === 'function', 'agent.html defines itemCategory');

  if (itemCategory) {
    t.check(itemCategory({ category: 'Roofing' }) === 'Roofing', 'a named category is itself');
    t.check(itemCategory({ category: '' }) === 'Other', 'an empty category is Other');
    t.check(itemCategory({ category: '   ' }) === 'Other', 'so is a whitespace-only one');
    t.check(itemCategory({}) === 'Other', 'and so is a missing one');
    t.check(itemCategory({ category: ' Roofing ' }) === 'Roofing', 'and a padded name is trimmed, not made Other');

    // The property that matters: every product lands somewhere.
    const cat = [{ category: 'Roofing' }, { category: '' }, {}, { category: '  ' }, { category: 'Building' }];
    const buckets = {};
    cat.forEach(it => { const k = itemCategory(it); buckets[k] = (buckets[k] || 0) + 1; });
    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    t.check(total === cat.length, `every product is reachable through exactly one tile (${total} of ${cat.length})`);
    t.check(buckets.Other === 3, 'and the three uncategorised ones share Other');
  }

  // Selecting Other must return the uncategorised items, not hunt for a
  // category literally named "Other" and find none.
  t.check(/items = items\.filter\(it=>itemCategory\(it\)===browseCategoryFilter\)/.test(code),
    'the category filter compares through itemCategory');
  t.check(/catalog\.filter\(it=>itemCategory\(it\)===browseCategoryFilter\)\.map\(it=>it\.subcategory\)/.test(code),
    'and so does the subcategory list, or opening Other would show the subcategories of nothing');
  t.check(/const countFor = \(c\)=> catalog\.filter\(it=>itemCategory\(it\)===c\)\.length;/.test(code),
    'and the tile count, so Other states how much it holds');

  // Other is built last, and only when something is actually in it.
  t.check(/const hasOther = catalog\.some\(it=>!\(it\.category\|\|''\)\.trim\(\)\);/.test(code),
    'Other appears only when there is something uncategorised');
  t.check(/hasOther \? named\.concat\(AGENT_OTHER_CATEGORY\) : named/.test(code),
    'and it is appended after the named aisles, never ahead of one');
}

/* ---------- 7. the three card shapes -------------------------------- */
/*
 * Each surface on this screen shows a product at a different size, and
 * each size answers a different question. Pinned because they are exactly
 * the numbers that drift back toward one another.
 */
{
  const rule = (sel) => {
    const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}').exec(src);
    return m ? m[1] : '';
  };

  // Category tile: the icon, not an art block. A full-width panel per tile
  // pushed the shelves below the fold on a six-aisle shop.
  const icon = rule('.ag-cat-icon');
  t.check(/width:52px/.test(icon) && /height:52px/.test(icon),
    'a category tile carries a 52px icon badge, not a full-width image');
  t.check(!/aspect-ratio:1\.15/.test(icon), 'the tall art block is gone');
  t.check(/align-items:center/.test(rule('.ag-cat-item')),
    'so the tile lays out sideways -- icon beside the label, not above it');

  // Shelf card: wide and 16:9. Wider than a phone-third on purpose, so the
  // next card peeks past the edge and the shelf reads as scrollable.
  const shelfCard = rule('.ag-scroll-row .ag-grid-card');
  t.check(/width:210px/.test(shelfCard), 'an Order-again / Sponsored card is 210 wide');
  t.check(/aspect-ratio:16\/9/.test(rule('.ag-scroll-row .ag-grid-thumb-wrap')),
    'with a 16:9 image rather than a square crop');

  // In-category row: one wide row, image left, big enough to tell two
  // variants of the same fitting apart.
  const row = rule('#ag_browseGrid .ag-grid-card');
  t.check(/display:flex/.test(row) && /min-height:140px/.test(row),
    'a category row is a wide row about 140 tall');
  t.check(/width:116px/.test(rule('#ag_browseGrid .ag-grid-thumb-wrap')),
    'with a 116px image on the left');
  t.check(/grid-template-columns:1fr/.test(rule('#ag_browseGrid.ag-browse-grid')),
    'one per row, not a two-up grid');
}

/* ---------- 8. the state machine ------------------------------------ */
/*
 * The three positions this screen can be in, as plain logic.
 */
{
  const view = (cat, sub, q, filter) => {
    const discovery = !q && filter === 'all' && !cat && !sub;
    return { shelves: discovery, strip: !cat, chips: !cat, crumb: !!cat };
  };
  const hub = view(null, null, '', 'all');
  t.check(hub.shelves && hub.strip && hub.chips && !hub.crumb,
    'the hub shows shelves, the strip and the chips, and no section header');

  const inCat = view('Roofing', null, '', 'all');
  t.check(!inCat.shelves && !inCat.strip && !inCat.chips && inCat.crumb,
    'inside a category only the section and its items remain');

  const searching = view(null, null, 'nails', 'all');
  t.check(!searching.shelves && searching.strip && !searching.crumb,
    'a search is not a category -- the shelves go, but the strip stays and no section header appears');
}

process.exit(t.done() ? 1 : 0);
