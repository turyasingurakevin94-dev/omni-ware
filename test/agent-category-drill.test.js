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

/* ---------- 6. the state machine ------------------------------------ */
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
