#!/usr/bin/env node
'use strict';
/*
 * Adding an item: one tap on a tile, priced from the shop's live book.
 *
 * There used to be an add sheet. It went up holding a spinner while the
 * price was fetched, because a tap on a slow connection that did nothing
 * visible invited a second tap. There is no sheet now -- the "+" on a
 * Find tile adds the line -- and the same two hazards are handled where
 * they now live:
 *
 *   - the tile shows a spinner in place of its "+" while the price is on
 *     its way, so a tap always visibly did something
 *   - a second tap on the same item while the first is in flight adds
 *     nothing, rather than a duplicate line
 *
 * And the price the line starts at: what this client paid last time if
 * there is one, else the shop's own suggested price, and never below what
 * the shop charges the agent unless the agent types it.
 *
 * Run: node test/agent-add-panel-loading.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent add item');
const src = read('agent.html');

const cart = [];
const seen = { renders: 0, toasts: [], saved: 0, busyDuringFetch: null };
let reply = null, lastRate = 0;
const env = {
  cart, chosenClient: { id: 7, name: 'Kato' }, currentView: 'find',
  feedItemKey: (p, v) => `${p}::${v == null ? '' : v}`,
  isNetworkError: (e) => /fetch/.test(String(e && e.message)),
  toast: (m) => seen.toasts.push(String(m)),
  lastRateFor: () => lastRate,
  cartLineMargin: (sell, floor) => (sell > floor ? { level: 'ok' } : { level: 'none', detail: 'you keep nothing on this line' }),
  updateCartBadge: () => {}, saveQuoteDraft: () => { seen.saved++; },
  renderFind: () => { seen.renders++; },
  callAgentFn: () => reply,
};
let api = null, err = null;
try {
  api = compileScope(['const addingKeys = new Set();', 'function busy(k){ return addingKeys.has(k); }',
    extractFunction(src, 'tierForQty', 'agent.html'), extractFunction(src, 'addCatalogLine', 'agent.html')],
    env, ['addCatalogLine', 'busy']);
} catch (e) { err = e; }
t.check(!!api, `addCatalogLine compiles${err ? ` (${err.message})` : ''}`);

const item = { productId: 'n1', variantIdx: null, name: 'Wire nails 4"', unit: 'kg', packUnit: 'ctn', packQty: 25, floorPrice: 3700, ourPrice: 4100 };
const priced = { available: true, unit: 'kg', packUnit: 'ctn', packQty: 25, ourPrice: 4100,
  tiers: [{ minQty: 100, unitPrice: 3550, tier: 'wholesale' }, { minQty: 1, unitPrice: 3700, tier: 'retail' }] };

(async () => {
if (api) {
  /* ---------- 1. a tap always visibly does something ------------------ */
  let release;
  reply = new Promise((r) => { release = () => r(priced); });
  const first = api.addCatalogLine(item, { unit: 'pack', displayQty: 1 });
  t.check(api.busy('n1::') && seen.renders >= 1,
    'the tile redraws at once with the item marked busy, before the price comes back');
  const second = await api.addCatalogLine(item, { unit: 'pack', displayQty: 1 });
  t.check(second === null, 'a second tap while the first is in flight adds nothing');
  release();
  const line = await first;
  t.check(!api.busy('n1::'), 'and the busy mark is cleared once the price is in');
  t.check(cart.length === 1, `one tap, one line (${cart.length})`);

  /* ---------- 2. priced from the ladder, in the unit tapped ------------ */
  t.check(line.qty === 25 && line.displayQty === 1 && line.displayUnit === 'ctn',
    'one carton is 25 kg underneath, and shown as the carton it was added as');
  t.check(line.floorPrice === 3700 && line.tier === 'retail',
    'priced at the rung 25 kg earns, from the ladder sorted low to high whatever order it arrived in');
  t.check(Array.isArray(line.tiers) && line.tiers[0].minQty === 1,
    'and the line keeps the whole ladder, so every later quantity is priced without another fetch');
  t.check(line.agentSellPrice === 4100, 'with no history, it starts at the shop\'s own suggested price');
  t.check(seen.saved === 1, 'and the basket is kept, so a reload does not lose it');

  /* ---------- 3. their last price comes first -------------------------- */
  lastRate = 3900;
  reply = Promise.resolve(priced);
  const again = await api.addCatalogLine(Object.assign({}, item, { productId: 'n2' }), { unit: 'unit', displayQty: 4 });
  t.check(again.agentSellPrice === 3900, 'a client who paid 3,900 last time is quoted 3,900 again');
  lastRate = 0;
  reply = Promise.resolve(Object.assign({}, priced, { ourPrice: 3000 }));
  const under = await api.addCatalogLine(Object.assign({}, item, { productId: 'n3' }), { unit: 'unit', displayQty: 1 });
  t.check(under.agentSellPrice === 3700,
    'and a suggested price under what the shop charges is never used -- the line starts at cost, not at a loss');
  t.check(!seen.toasts.some((m) => /keep nothing/.test(m)),
    'and no message pops up about it -- the line and its card show +0 in amber instead');

  /* ---------- 4. no signal ------------------------------------------- */
  reply = Promise.reject(new Error('Failed to fetch'));
  const offline = await api.addCatalogLine(Object.assign({}, item, { productId: 'n4' }), { unit: 'unit', displayQty: 2 });
  t.check(offline && offline.floorPrice === 3700 && offline.tiers.length === 1,
    'offline, the line is added at the last price on the phone rather than refused');
  t.check(seen.toasts.some((m) => /offline/i.test(m)), 'and the agent is told which price that is');
}

/* ---------- 5. the tile shows it ------------------------------------- */
{
  const tile = extractFunction(src, 'findTileHTML', 'agent.html');
  t.check(/const busy = addingKeys\.has\(key\);/.test(tile) && /\$\{busy \? '<span class="ag-spinner"/.test(tile),
    'the "+" turns into a spinner while its price is on the way');
  t.check(/\.ag-spinner\{[^}]*animation:ag-spin/.test(src) && /@keyframes ag-spin/.test(src),
    'which spins');
  t.check(/@media \(prefers-reduced-motion: reduce\)\{ \.ag-spinner\{animation:none;\} \}/.test(src),
    'except for anyone who has asked the phone for less motion');
}

process.exit(t.done() ? 1 : 0);
})();
