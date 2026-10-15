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
  t.check(/class="ax-who" data-strip="pick"/.test(strip) && /AX_ICON\.swap/.test(strip),
    'the client card is the switch, and says so');
  t.check(/clientLine\(chosenClient\)/.test(strip),
    'under the name, who they are to you');
  t.check(!/recentClients\(/.test(strip),
    'the row of other people\'s initials is gone from the top of the order');
  t.check(/parked\.map/.test(strip) && /AX_ICON\.basket/.test(strip),
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
    feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`,
    catalogEntry: (p) => ({ productId: p, name: p }),
    promotedMap: () => new Map([['b1::', {}]]),
    catalog: [{ productId: 'b1', variantIdx: null }, { productId: 'z', variantIdx: null }],
  }, ['sellMostItems']).sellMostItems;
  const got = sells(6);
  t.check(got.length === 2 && got[0].it.productId === 'p1' && got[0].sold === 2 && got[1].sold === 1,
    'what you sell most is ranked, with how many orders each has been in (a voided one does not count)');

  const first = compileScope([fn('sellMostItems')], {
    myOrders: [], feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`, catalogEntry: () => null,
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
  t.check(/aisleTint\(c\)/.test(fn('aisleTileHTML')) && /bonus \?/.test(fn('aisleTileHTML')),
    'an aisle tile wears its own tint, with a star for how many earn a bonus there');
}

process.exit(t.done() ? 1 : 0);
