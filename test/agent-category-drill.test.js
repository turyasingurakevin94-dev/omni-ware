#!/usr/bin/env node
'use strict';
/*
 * Finding an item: every aisle of the shop, a tap from the order.
 *
 * The Find screen opens INSIDE an aisle -- the one this client buys from
 * most, then the one the agent sells from most -- so the first screen is
 * usually the right one. The aisle is a navy pill at the top; tapping it
 * brings up every aisle as a sheet of tiles with how much is in each. The
 * shelves inside the aisle are chips beside it. A search looks at the
 * whole shop, whatever aisle you were in, because a search that silently
 * ANDs itself with an aisle you cannot see reports "nothing here" about
 * things that are there.
 *
 * These pin the rules by running the real list builder against a small
 * catalogue, rather than by reading its source.
 *
 * Run: node test/agent-category-drill.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent category drill');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');

const catalog = [
  { productId: 'a', variantIdx: null, name: 'Hima cement', category: 'Cement', subcategory: 'Bags' },
  { productId: 'b', variantIdx: null, name: 'Tororo cement', category: 'Cement', subcategory: 'Bags' },
  { productId: 'c', variantIdx: null, name: 'Iron sheet G28', category: 'Roofing', subcategory: 'Sheets' },
  { productId: 'd', variantIdx: null, name: 'Ridge cap', category: 'Roofing', subcategory: 'Accessories' },
  { productId: 'e', variantIdx: null, name: 'Trowel', category: '' },
  { productId: 'f', variantIdx: 0, name: 'Hinges', variantLabel: 'Soft close', category: 'Roofing', subcategory: 'Accessories', createdAt: new Date().toISOString() },
  { productId: 'f', variantIdx: 1, name: 'Hinges', variantLabel: 'Normal', category: 'Roofing', subcategory: 'Accessories' },
];
const search = { value: '' };
const env = {
  catalog, chosenClient: null,
  myOrders: [{ agentClientId: 7, items: [{ productId: 'c', variantIdx: null }] }],
  document: { getElementById: () => search },
  promotedMap: () => new Map([['d::', { bonusType: 'fixed', bonusValue: 500 }]]),
  feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`,
};
const api = compileScope([
  "const AGENT_OTHER_CATEGORY = 'Other';",
  "let findCategory = null, findSub = null, findFilter = { again:false, bonus:false, fresh:false };",
  'function setFind(c, s, f){ findCategory = c; findSub = s; findFilter = Object.assign({ again:false, bonus:false, fresh:false }, f || {}); }',
  fn('itemCategory'), fn('findCategories'), fn('boughtBeforeKeys'), fn('findItems'), fn('groupCatalogItems'),
], env, ['itemCategory', 'findCategories', 'findItems', 'setFind', 'groupCatalogItems']);
const ids = (items) => items.map((it) => it.productId + (it.variantIdx == null ? '' : it.variantIdx)).join(',');

/* ---------- 1. an aisle is a place, and its shelves narrow it ---------- */
{
  api.setFind('Roofing', null);
  t.check(ids(api.findItems()) === 'c,d,f0,f1', `inside an aisle you see that aisle (${ids(api.findItems())})`);
  api.setFind('Roofing', 'Accessories');
  t.check(ids(api.findItems()) === 'd,f0,f1', 'and a shelf chip narrows it to that shelf');
  t.check(api.groupCatalogItems(api.findItems()).length === 2,
    'variants of one product count once -- "2 items" is two products, not two tiles of the same hinge');
}

/* ---------- 2. a search looks at the whole shop ----------------------- */
{
  api.setFind('Cement', 'Bags');
  search.value = 'ridge';
  t.check(ids(api.findItems()) === 'd',
    'typing "ridge" while standing in Cement finds the ridge cap in Roofing -- the aisle does not silently AND itself in');
  search.value = 'soft';
  t.check(ids(api.findItems()) === 'f0', 'and the variant label is searched as well as the name');
  search.value = '';
}

/* ---------- 3. the quick views cut across the aisles ------------------ */
{
  api.setFind(null, null, { bonus: true });
  t.check(ids(api.findItems()) === 'd', 'Bonus shows only what earns a bonus, from every aisle');
  api.setFind(null, null, { again: true });
  t.check(ids(api.findItems()) === 'c', 'Sold before shows what has been sold before');
  api.setFind(null, null, { fresh: true });
  t.check(ids(api.findItems()) === 'f0', 'New shows what the shop added in the last 30 days');
  api.setFind('Cement', null, { bonus: true });
  t.check(ids(api.findItems()) === '', 'and a filter inside an aisle narrows that aisle, it does not leave it');
}

/* ---------- 4. nothing is stranded ----------------------------------- */
/*
 * There is no All-products list, so a product whose category is blank
 * would be unreachable except by name. Every product belongs to a tile,
 * and the leftovers belong to Other -- last, and only when it has
 * something in it.
 */
{
  const cats = api.findCategories();
  t.check(cats.join(',') === 'Cement,Roofing,Other', `the aisles are the shop's own, with Other last (${cats.join(',')})`);
  api.setFind('Other', null);
  t.check(ids(api.findItems()) === 'e', 'opening Other returns the uncategorised items, not a hunt for a category named "Other"');
  t.check(api.itemCategory({ category: '   ' }) === 'Other' && api.itemCategory({ category: ' Roofing ' }) === 'Roofing',
    'whitespace is uncategorised, and a padded name is trimmed rather than made Other');
}

/* ---------- 5. the screen: one pill, one sheet, shelves beside --------- */
{
  const render = fn('renderFind');
  t.check(/id="ag_catPill"/.test(render) && /AX_ICON\.chevD/.test(render),
    'the aisle you are in is a pill that says it can be changed');
  t.check(/if\(subs\.length < 2\) subs = \[\];/.test(render),
    'shelf chips appear only when an aisle has more than one shelf -- one shelf is not a choice');
  t.check(/Nothing matches that search\./.test(render) && /Nothing here with those filters\./.test(render),
    'an empty search and an empty filter say different things, so neither blames the other');
  const sheet = fn('openCategorySheet');
  t.check(/groupCatalogItems\(catalog\.filter\(it=> itemCategory\(it\) === c\)\)\.length/.test(sheet),
    'each aisle tile states how many products it holds, counted the way the list counts them');
  t.check(/document\.getElementById\('ag_browse_search'\)\.value = '';/.test(sheet),
    'choosing an aisle clears a search, so the two cannot disagree about what is shown');
  const def = fn('defaultFindCategory');
  t.check(def.indexOf('chosenClient') < def.indexOf('myOrders'),
    'Find opens on the aisle this client buys from most, before the agent\'s own habit');
}

/* ---------- 6. thumb-sized ------------------------------------------- */
{
  const rule = (sel) => {
    const m = new RegExp('\\n\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}').exec(src);
    return m ? m[1] : '';
  };
  t.check(/height:44px/.test(rule('.ax-catpill')), 'the aisle pill is 44px tall');
  t.check(/height:44px/.test(rule('.ax-sub')), 'and so is every shelf chip');
  t.check(/height:100px/.test(rule('.ax-cat')), 'the aisle tiles in the sheet are big enough to hit without looking');
  t.check(/width:44px;height:44px/.test(rule('.ax-add')), 'the add button on a tile is 44px');
}

process.exit(t.done() ? 1 : 0);
