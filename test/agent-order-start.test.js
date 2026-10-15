#!/usr/bin/env node
'use strict';
/*
 * The top of an order, and what an agent sees before anything is in it.
 *
 * Whose order it is reads as one card (name, who they are to you, a way to
 * switch), not a row of initials. Switching brings up who is buying: open
 * baskets first, then who is due. Someone new gets the aisles -- each with
 * its own real icon and tint -- and what you sell most, ranked. A first
 * day, and a shop list still on its way, each have a shape of their own
 * rather than a blank.
 *
 * Run: node test/agent-order-start.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent order start');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');
const constBlock = (name) => {
  const i = src.indexOf(`const ${name} = `);
  if (i < 0) return '';
  const end = src.indexOf('\n];', i);
  return end > 0 && name === 'AISLE_ICONS' ? src.slice(i, end + 3) : src.slice(i, src.indexOf('\n', i));
};

/* ---------- 1. every aisle has a real icon and a tint ------------------ */
{
  const { aisleLook, aisleTint, categoryIconSVG } = compileScope(
    [constBlock('AISLE_ICONS'), constBlock('AISLE_FALLBACK'), fn('aisleLook'), fn('aisleTint'), fn('categoryIconSVG')],
    {}, ['aisleLook', 'aisleTint', 'categoryIconSVG']);
  t.check(aisleLook('Roofing') !== aisleLook('Cement') && aisleLook('Roofing') === aisleLook('Iron sheets'),
    'roofing and cement look different, and every roofing aisle looks the same');
  t.check(aisleLook('Something the shop invented') === aisleLook(''),
    'an aisle nobody planned for still gets an icon, the same fallback each time');
  t.check(/^--ai:#[0-9A-F]{6};--ai-s:#[0-9A-F]{6};$/i.test(aisleTint('Plumbing')),
    'a tile takes its tint as two properties it can colour from');
  const svg = categoryIconSVG('Paint');
  t.check(/viewBox="0 0 256 256"/.test(svg) && /class="icon ph"/.test(svg) && /opacity="0\.2"/.test(svg),
    'the icon is a drawn duotone mark, not a one-line stroke');
  t.check(/\.icon\.ph\{fill:currentColor;stroke:none;\}/.test(src),
    'and it is filled, so the stroke rules every other icon carries do not hollow it out');
  t.check(/--ai: var\(--ink-soft\); --ai-s: var\(--tile\);/.test(src),
    'an untinted tile falls back to the plain look');
}

/* ---------- 2. whose order it is, as one card --------------------------- */
{
  const strip = fn('renderClientStrip');
  t.check(/class="ax-who" data-strip="pick"/.test(strip) && /PH\.swap/.test(strip),
    'the client card is the switch, and says so');
  t.check(/clientLine\(chosenClient\)/.test(strip),
    'under the name, who they are to you');
  t.check(!/recentClients\(/.test(strip),
    'the row of other people\'s initials is gone from the top of the order');
  t.check(/parked\.map/.test(strip) && /PH\.basket/.test(strip),
    'a basket still waiting keeps its own chip, with how many items are in it');

  const { clientLine } = compileScope([fn('clientLine')], {
    clientOrderCounts: () => new Map([['A', []], ['B', [{}, {}]], ['C', [{}]]]),
    clientCadence: (c) => (c.id === 'B' ? { avgGapDays: 9.4 } : null),
    clientStats: () => ({ lastAt: '2026-10-03' }),
    dateShort: () => '3 Oct',
  }, ['clientLine']);
  t.check(clientLine({ id: 'A' }).tone === 'new' && /first order/.test(clientLine({ id: 'A' }).text),
    'someone with no orders is new');
  t.check(clientLine({ id: 'B' }).text === 'Every 9 days · 2 orders',
    'a regular is their rhythm and how often they have bought');
  t.check(clientLine({ id: 'C' }).text === '1 order · last 3 Oct',
    'one order is not a rhythm, so it says when');
}

/* ---------- 3. who's buying -------------------------------------------- */
{
  const pick = fn('openClientPicker');
  t.check(/Still open/.test(pick) && /Resume/.test(pick) && /basketTotal\(rows\)/.test(pick),
    'baskets still open come first, with what is in them and one tap back');
  t.check(/Who's due/.test(pick) && /a\.st\.rank - b\.st\.rank/.test(pick),
    'then everyone, the most due first');
  t.check(/pickRing\(st, cad\)/.test(pick) && /class="ax-cp-new" data-pick-new/.test(pick),
    'each with a ring for how far through their gap they are, and a new client at the bottom');
  t.check(/openClientSheet\(c\.id\)/.test(pick),
    'tapping the one already open opens their own sheet, as the name used to');
  t.check(/data-pick-unnamed/.test(pick) && /switchToUnnamed\(\)/.test(pick),
    'the unnamed basket can be gone back to from here too');
}

/* ---------- 4. someone new: aisles, and what you sell most ------------- */
{
  const sells = compileScope([fn('sellMostItems')], {
    myOrders: [
      { items: [{ productId: 'p1', variantIdx: null }, { productId: 'p2', variantIdx: null }] },
      { items: [{ productId: 'p1', variantIdx: null }] },
      { voided: true, items: [{ productId: 'p2', variantIdx: null }] },
    ],
    feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`, orderDate: () => '',
    catalogEntry: (p) => ({ productId: p, name: p }),
    promotedMap: () => new Map([['b1::', {}]]),
    catalog: [{ productId: 'b1', variantIdx: null }, { productId: 'z', variantIdx: null }],
  }, ['sellMostItems']).sellMostItems;
  const got = sells(6);
  t.check(got.length === 2 && got[0].it.productId === 'p1' && got[0].sold === 2 && got[1].sold === 1,
    'what you sell most is ranked, with how many orders each has been in (a voided one does not count)');
  t.check(got.recent === false, 'with nothing in the last 30 days it falls back to every order, and does not claim the window');
  const today = new Date().toISOString().slice(0, 10);
  const recent = compileScope([fn('sellMostItems')], {
    myOrders: [{ d: today, items: [{ productId: 'p2', variantIdx: null }] }, { d: '2020-01-01', items: [{ productId: 'p1', variantIdx: null }, { productId: 'p1', variantIdx: null }] }],
    feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`, orderDate: (o) => o.d,
    catalogEntry: (p) => ({ productId: p }), promotedMap: () => new Map(), catalog: [],
  }, ['sellMostItems']).sellMostItems(6);
  t.check(recent.recent === true && recent.length === 1 && recent[0].it.productId === 'p2',
    'what moves now: the last 30 days, when there is anything in them');

  const first = compileScope([fn('sellMostItems')], {
    myOrders: [], feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`, catalogEntry: () => null, orderDate: () => '',
    promotedMap: () => new Map([['b1::', {}]]),
    catalog: [{ productId: 'b1', variantIdx: null }, { productId: 'z', variantIdx: null }],
  }, ['sellMostItems']).sellMostItems(6);
  t.check(first.length === 1 && first[0].it.productId === 'b1' && first[0].sold === 0,
    'before a first sale it is what earns a bonus, marked as never sold');

  const pad = fn('launchpadHTML');
  t.check(/Earn extra on these/.test(pad) && /Your best sellers land here/.test(pad),
    'on a first day the row says so, with a place kept for the best sellers to come');
  t.check(/if\(!catalog\.length\)\{\s*if\(browseDataLoaded\)/.test(pad) && /ax-sk-tile/.test(pad) && /Getting the shop list/.test(pad),
    'while the shop list is on its way, the shape of the screen -- never a blank');
  t.check(/The shop has no items listed yet/.test(pad),
    'and a shop with nothing listed says that, rather than looking broken');
  const card = fn('sellCardHTML');
  t.check(/class="rk\$\{i === 0 \? ' gold' : ''\}"/.test(card) && /x\.sold \/ Math\.max\(1, top\)/.test(card),
    'each card carries its rank and a bar against your best seller');
  t.check(/\+\$\{fmtNum\(yours\)\} yours/.test(card) && /data-lp-add=/.test(card),
    'what you make on one, and a + to add it');
  const usual = fn('renderUsual');
  t.check(/regs\.slice\(0, 4\)/.test(usual) && /class="ax-uct\$\{isIn \? ' in' : ''\}" data-usual=/.test(usual) && /\$\{inN\}\/\$\{regs\.length\}/.test(usual),
    'a regular\'s usual is up to four tiles, each one tap, with how many are in');
  t.check(/missing\.length > 1 \? `<button type="button" class="ax-uc-all" data-usual-all>/.test(usual),
    'and one button for the rest only when more than one is missing');
  t.check(/classList\.toggle\('empty', !cart\.length\)/.test(fn('renderDock')) && /\.ax-dock\.empty \.ag-knob \.kno\{display:block;/.test(src),
    'an empty order looks empty at the bottom too: no total, a basket where the arrow was');
  t.check(/id="ag_orderCats"/.test(src) && /placeholder="Add an item"/.test(src),
    'the box says what it is for, with every aisle one tap beside it');
  t.check(/aisleTint\(c\)/.test(fn('aisleTileHTML')) && /bonus \?/.test(fn('aisleTileHTML')),
    'an aisle tile wears its own tint, with a star for how many earn a bonus there');
}

/* ---------- 5. bundles show what is in them --------------------------- */
{
  const env = {
    catalogEntry: (p) => ({ ir1: { productId: 'ir1', name: 'Iron sheet', floorPrice: 30000, ourPrice: 32000 }, n3: { productId: 'n3', name: 'Nails', floorPrice: 9000, ourPrice: 9500 } })[p] || null,
    feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`,
    myOrders: [
      { items: [{ productId: 'ir1', variantIdx: null }, { productId: 'n3', variantIdx: null }, { productId: 'x', variantIdx: null }] },
      { items: [{ productId: 'ir1', variantIdx: null }] },
      { voided: true, items: [{ productId: 'ir1', variantIdx: null }, { productId: 'n3', variantIdx: null }] },
    ],
  };
  const { bundleFigures, bundleUses } = compileScope([fn('bundleLines'), fn('bundleFigures'), fn('bundleUses')], env, ['bundleFigures', 'bundleUses']);
  const tpl = { line_items: [{ productId: 'ir1', variantIdx: null, qty: 20 }, { productId: 'n3', variantIdx: null, qty: 2 }, { productId: 'gone', variantIdx: null, qty: 1 }] };
  const f = bundleFigures(tpl);
  t.check(f.total === 20 * 32000 + 2 * 9500 && f.yours === 20 * 2000 + 2 * 500 && f.gone === 1,
    'a bundle comes to today\'s shelf price, with what it pays you, and says what is no longer sold');
  t.check(bundleUses(tpl.line_items.slice(0, 2) && { line_items: tpl.line_items.slice(0, 2) }) === 1,
    'and counts the orders that had every item of it (a voided one does not count)');
  const card = fn('bundleCardHTML');
  t.check(/aisleStackHTML\(/.test(card) && /class="ax-bd-c"/.test(card) && /data-bundle-edit=/.test(card) && /Add all <b>/.test(card),
    'each bundle shows its aisles, its items, one button for all of it, and a way to edit it');
  const cats = fn('openCategorySheet');
  t.check(/k:'bundles'/.test(cats) && /data-bundles/.test(cats) && /PH\.stack/.test(cats),
    'Bundles is one of the four ways into the shop, beside Usual, Bonus and New');
  const edit = fn('openBundleEdit');
  t.check(/\.update\(\{ name, line_items: items \}\)\.eq\('id', tpl\.id\)/.test(edit) && /\.delete\(\)\.eq\('id', tpl\.id\)/.test(edit),
    'a bundle can be renamed, trimmed or deleted');
  const save = fn('openSaveSolutionModal');
  t.check(/data-idea=/.test(save) && /aisleStackHTML\(/.test(save) && /Save <b>\$\{cart\.length\}<\/b>/.test(save),
    'saving one shows what goes in, offers names to tap, and says how many items');
}

/* ---------- 6. a usual of one, and what goes with it ------------------ */
{
  const usual = fn('renderUsual');
  t.check(/if\(regs\.length === 1\)\{/.test(usual) && /class="ax-uc-one" data-usual=/.test(usual),
    'a usual of one item is one wide tile, not a lone tile in a row of four');
  t.check(/if\(!cart\.length\) top \+= launchpadHTML\(\);/.test(usual),
    'and before anything is in, the aisles and what you sell most follow the usual');
  t.check(/cart\.length < 3 && catalog\.length \? oftenWithHTML\(cart\[cart\.length - 1\]\)/.test(usual),
    'once a line is in, what usually goes with it comes next, while the order is short');
  const { oftenWith } = compileScope([fn('oftenWith')], {
    feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`,
    cart: [{ productId: 'pipe', variantIdx: null }],
    chosenClient: { id: 'A' },
    catalogEntry: (p) => ({ productId: p }),
    myOrders: [
      { agentClientId: 'A', items: [{ productId: 'pipe' }, { productId: 'elbow' }, { productId: 'tee' }] },
      { agentClientId: 'A', items: [{ productId: 'pipe' }, { productId: 'elbow' }] },
      { agentClientId: 'B', items: [{ productId: 'pipe' }, { productId: 'glue' }] },
    ],
  }, ['oftenWith']);
  const w = oftenWith({ productId: 'pipe', variantIdx: null }, 3);
  t.check(w.mine && w.of === 2 && w.rows[0].it.productId === 'elbow' && w.rows[0].n === 2 && w.rows.length === 2,
    'what goes with it is read from this client\'s own orders when they have bought it twice, most often first');
}

process.exit(t.done() ? 1 : 0);
