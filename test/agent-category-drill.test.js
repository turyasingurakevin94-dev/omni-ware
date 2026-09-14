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
  t.check(/class="ag-crumb-here">\$\{esc\(browseCategoryFilter\)\}<\/span>/.test(code),
    'the section names the category');
  // And NOT the subcategory. Its chip sits highlighted directly below, so
  // "Furniture / Cabinet hinges" above a lit "Cabinet hinges" chip says
  // the same thing twice and makes the header the longest line on screen.
  t.check(!/ag-crumb-sub/.test(code),
    'and does not repeat the subcategory, which its own chip already shows');
  // How many are in the CATEGORY -- not how many survived the subcategory
  // chip and the search box as well. It counted groups.length, the fully
  // filtered set, and printed it under the category's name: "Building 0
  // items" while Building held three, "Furniture 1 item" while standing in
  // Furniture > Runners. The lit chip is what says you have narrowed.
  t.check(/class="ag-crumb-n">\$\{catCount\} item\$\{catCount===1\?'':'s'\}/.test(code),
    'and how many items are in the category it names');
  t.check(/const catCount = inCategory\s*\n?\s*\? groupCatalogItems\(catalog\.filter\(it=>itemCategory\(it\)===browseCategoryFilter\)\)\.length/.test(code),
    'counted through itemCategory and grouped, so it agrees with the tile that was tapped to get here');

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

  // Aisle pill. This used to read: "a category tile carries a 52px icon
  // badge, not a full-width image", with "the tile lays out sideways".
  // Both were true of a tile in a two-column grid, and the grid is the
  // thing that went: six aisles made it three rows deep, around 250px of
  // navigation between the search field and the shelves that sell.
  //
  // The same two facts the tile was pinned for still hold, and are what
  // is pinned here -- the mark is a small badge rather than an art block,
  // and the pill lays out sideways. What is new is the height: one 44px
  // row for the whole strip, and the count still on every aisle so
  // picking one is a decision rather than a guess.
  t.check(rule('.ag-cat-grid') === '' && !/class="ag-cat-item/.test(code),
    'the two-column tile grid is gone');
  const aisles = rule('.fx-aisles');
  t.check(/overflow-x:auto/.test(aisles) && /display:flex/.test(aisles),
    'the aisles are one scrolling row');
  const aisle = rule('.fx-aisle');
  t.check(/min-height:44px/.test(aisle) && /box-sizing:border-box/.test(aisle),
    'each pill is a 44px target, and border-box so 44 means 44');
  t.check(/align-items:center/.test(aisle),
    'and lays out sideways -- mark beside the label, not above it');
  const mark = rule('.fx-aisle .ic');
  t.check(/width:28px/.test(mark) && /height:28px/.test(mark),
    'the mark is a badge, not a full-width art block');
  t.check(/<span class="n">\$\{n\}<\/span>/.test(code),
    'and the pill still states how much is in the aisle');

  // The head above the grid said "Browse -- All 14 ->", which looked like
  // the way into the whole catalogue. It was plain text with no handler,
  // and section 5 above is why: there is no All-products list to go to.
  t.check(!/ag-cat-head/.test(src), 'the inert "All N ->" head is gone with it');

  // Shelf row. This used to read: "an Order-again / Sponsored card is 210
  // wide" with "a 16:9 image rather than a square crop" -- a card on a
  // sideways-scrolling shelf, sized so the next one peeked past the edge.
  //
  // It stopped being true when the shelves became lists. The card was 210
  // of a 390px screen and carried a photograph and a price; what it could
  // not carry was the thing this screen exists to say -- what the line
  // pays the agent -- and a shelf of them showed one and a half items at
  // a time behind an edge nobody swipes.
  //
  // So a shelf is .fx-prod rows now, and what is pinned is that the row
  // is a row: full width, a small leading square rather than a 16:9 block,
  // and the 44px controls this app holds itself to.
  //
  // .ag-scroll-row itself survives, and deliberately: the open-orders
  // switcher above the shelves is a genuine sideways strip of a handful
  // of short tabs. What must not come back is a PRODUCT on one.
  t.check(rule('.ag-scroll-row .ag-grid-card') === '',
    'no product card is sized for a sideways shelf any more');
  ['ag_solutionsRow', 'ag_orderAgainRow', 'ag_sponsoredRow', 'ag_clusterRow', 'ag_volumeRow'].forEach((id) => {
    t.check(new RegExp(`<div class="fx-card" id="${id}">`).test(src),
      `${id} is a list, not a strip`);
  });
  const shelfRow = rule('.fx-prod');
  t.check(/display:flex/.test(shelfRow) && /width:100%/.test(shelfRow),
    'a shelf row runs the full width of the column');
  const shelfThumb = rule('.fx-th');
  t.check(/width:46px/.test(shelfThumb) && /height:46px/.test(shelfThumb),
    'with a 46px leading square -- the agent knows the catalogue and is reading for speed');
  ['.fx-add', '.fx-star'].forEach((sel) => {
    const body = rule(sel);
    t.check(/width:44px/.test(body) && /height:44px/.test(body),
      `${sel} is a 44px target (the cluster star was 26 on the photo corner)`);
    t.check(/box-sizing:border-box/.test(body),
      `${sel} restores border-box after all:unset, or 44 is not 44`);
  });

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

/* ---------- 9. a search leaves the aisle ---------------------------- */
/*
 * The search box lives in the hero, at the very top of the screen and
 * outside the category section entirely, so it reads as searching the
 * catalogue. It did not: it ANDed itself with whatever category was open,
 * invisibly. Typing "hinge" inside Building > Cement found nothing and
 * reported "Nothing in Cement yet" -- which was false, Cement held two
 * products, and the identical search from the hub found the hinge at once.
 *
 * So a query now clears the category, and the two states cannot co-occur.
 */
{
  t.check(/if\(document\.getElementById\('ag_browse_search'\)\.value\.trim\(\) && browseCategoryFilter\)\{\s*browseCategoryFilter = null;\s*browseSubcategoryFilter = null;\s*renderSubcategoryChips\(\);/.test(code),
    'typing a search drops the category and the subcategory with it');

  // The message must not depend on that staying true.
  t.check(/const searching = document\.getElementById\('ag_browse_search'\)\.value\.trim\(\);/.test(code),
    'and the empty state asks whether a search is running BEFORE it blames the aisle');
  const emptyBlock = (/if\(!groups\.length\)\{[\s\S]*?return;\s*\}/.exec(code) || [''])[0];
  t.check(emptyBlock.indexOf('No products match that search') < emptyBlock.indexOf('Nothing in'),
    'so a fruitless search can never report the category as empty');

  // The three states, as plain logic.
  const view = (cat, q) => {
    const catAfter = q ? null : cat;
    return { cat: catAfter, crumb: !!catAfter, strip: !catAfter, scope: catAfter ? 'aisle' : 'everything' };
  };
  t.check(view('Building', 'hinge').scope === 'everything',
    'a search from inside an aisle searches everything');
  t.check(view('Building', 'hinge').crumb === false && view('Building', 'hinge').strip === true,
    'and the screen returns to looking like a search, not like an aisle');
  t.check(view('Building', '').scope === 'aisle', 'while no query leaves you where you were');

  // The placeholder that used to flash before the first render.
  t.check(/<div class="ag-section-title" id="ag_gridTitle"><\/div>/.test(src),
    'the grid title starts empty -- it read "All products", a list this screen no longer has');
}

/* ---------- 9. a product card opens the product ---------------------- */
/*
 * Merged main-grid cards used to open the add panel only through a "+"
 * button on the thumbnail, and the handler returned early for anything
 * carrying data-selected-vidx so that browsing never launched the panel by
 * accident. The "+" was then removed. The guard was not, which left every
 * in-category product completely inert -- tapping one did nothing at all.
 *
 * The whole card is the target now. The things that must NOT open it --
 * variant chips, the axis buttons, the cluster star, the image -- are all
 * handled earlier in the same delegated listener and return before
 * reaching the card branch, so this is ordering, not luck.
 */
{
  t.check(!/if\(card\.dataset\.selectedVidx !== undefined\) return;/.test(code),
    'the guard that made in-category cards inert is gone');
  t.check(/const vidxRaw = card\.dataset\.selectedVidx !== undefined \? card\.dataset\.selectedVidx : card\.dataset\.vidx;/.test(code),
    'a merged card opens the variant it is currently showing, not its first one');
  t.check(/#ag_browseGrid \.ag-grid-card\{[^}]*cursor:pointer/.test(src),
    'and it looks tappable, since it now is');

  // Ordering: every early return must come before the card branch.
  const listener = (/const card = e\.target\.closest\('\.ag-grid-card'\);/.exec(code) || {}).index;
  t.check(typeof listener === 'number', 'the card branch is found');
  ['data-star-pid', 'data-chip-pid', 'data-axis-pid', 'ag-grid-thumb'].forEach(sel => {
    const at = code.indexOf(`closest('[${sel}]')`) >= 0
      ? code.indexOf(`closest('[${sel}]')`)
      : code.indexOf(`closest('#ag_browseGrid .${sel}')`);
    t.check(at > 0 && at < listener, `${sel} is handled before the card branch, so it never opens the panel`);
  });
}

process.exit(t.done() ? 1 : 0);
