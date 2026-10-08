#!/usr/bin/env node
'use strict';
/*
 * The Order screen: the whole sale on one screen.
 *
 * Who it is for along the top, the lines in the middle -- each one opened
 * in place to change its quantity or price -- and a navy dock at the foot
 * holding how it gets there, what it comes to, what it leaves the agent,
 * and one slide to send. There is no review page, because this is the
 * review.
 *
 * What is pinned:
 *
 *   - the dock's figures come from the same helper as every line's chip,
 *     so the two cannot disagree, including while a price is being typed
 *   - the slider says what is missing in place of "Slide to send", and
 *     the send itself still refuses on its own
 *   - a slide, not a tap, sends: a basket is not sent from a pocket. A
 *     keyboard still presses it like any button
 *   - typing a price never redraws the field under the thumb
 *
 * Run: node test/agent-quote-layout.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent order screen');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');

/* ---------- 1. one set of figures ---------------------------------- */
{
  let api = null, err = null;
  const env = { cart: [], openLineIdx: -1, fmtUGX: (n) => 'UGX ' + n, esc: (s) => String(s) };
  try {
    api = compileScope([fn('cartLineMargin'), fn('cartLineFigures'), fn('cartTotals'),
      'function setCart(rows, open, preview){ cart.length = 0; rows.forEach((r)=> cart.push(r)); openLineIdx = open; }'],
    env, ['cartTotals', 'setCart']);
  } catch (e) { err = e; }
  t.check(!!api, `the totals compile${err ? ` (${err.message})` : ''}`);
  if (api) {
    api.setCart([
      { qty: 40, floorPrice: 32000, agentSellPrice: 33500 },
      { qty: 25, floorPrice: 3700, agentSellPrice: 4100, displayQty: 1, displayUnit: 'ctn' },
    ], -1);
    const tot = api.cartTotals();
    t.check(tot.total === 40 * 33500 + 25 * 4100, `the dock's total is every line at the agent's price (${tot.total})`);
    t.check(tot.profit === 40 * 1500 + 25 * 400, 'and what it leaves them is every line\'s margin');
    api.setCart([{ qty: 40, floorPrice: 32000, agentSellPrice: 33500 }], 0);
    const typing = api.cartTotals({ qty: 40, floorPrice: 32000, agentSellPrice: 31000 });
    t.check(typing.profit === -40000, 'while a price is being typed, the dock already shows what it would leave -- a loss, here');
  }
  const dock = fn('renderDock');
  t.check(/const t = cartTotals\(preview\);/.test(dock), 'the dock draws from that one helper');
  t.check(/e\.classList\.toggle\('loss', t\.profit < 0\)/.test(dock), 'and turns its figure when the order runs at a loss');
}

/* ---------- 2. what stops a send, said where you would slide ---------- */
{
  let api = null;
  const els = { ag_delivery_shop: { checked: false }, ag_delivery_address: { value: '' } };
  try {
    api = compileScope(['let agentPaused = false, chosenClient = null; const cart = [];',
      'function set(p, c, n){ agentPaused = p; chosenClient = c; cart.length = 0; for(let i=0;i<n;i++) cart.push({}); }',
      'const blockedLines = new Map(); const feedItemKey = (p, v) => `${p}::${v==null?\'\':v}`;',
      fn('lineBlock'), fn('deliveryMode'), fn('sendBlocker')],
    { document: { getElementById: (id) => els[id] } }, ['sendBlocker', 'set']);
  } catch (e) { /* below */ }
  t.check(!!api, 'sendBlocker compiles');
  if (api) {
    api.set(false, null, 0);
    t.check(api.sendBlocker() === 'Add an item to send', 'an empty order asks for an item first');
    api.set(false, null, 2);
    t.check(api.sendBlocker() === 'Pick a client to send', 'then for whom it is');
    api.set(false, { id: 1 }, 2);
    t.check(api.sendBlocker() === null, 'and with both, nothing stops it');
    els.ag_delivery_shop.checked = true;
    t.check(api.sendBlocker() === 'Add the address to send', 'a delivery needs somewhere to go');
    els.ag_delivery_address.value = 'Plot 12, Ntinda';
    t.check(api.sendBlocker() === null, 'and has it once the address is typed');
    api.set(true, { id: 1 }, 2);
    t.check(api.sendBlocker() === 'Orders are paused', 'a paused account says so before anything else');
  }
  const dock = fn('renderDock');
  t.check(/knob\.disabled = !!block;/.test(dock) && /block\s*\|\| `Slide to send · \$\{cart\.length\} item/.test(dock),
    'the slider is disabled and says what is missing; otherwise it says how many items go');
  const submit = fn('submitOrder');
  t.check(/if\(!cart\.length\)\{ toast\('Add at least one item'\); resetSlide\(\); return; \}/.test(submit)
    && /if\(deliveryMode==='shop_delivery' && !deliveryAddress\)\{ toast\('Enter a delivery address'\); resetSlide\(\); return; \}/.test(submit),
    'and the send refuses on its own as well, so the slider is describing a real rule');
}

/* ---------- 3. a slide, not a tap ----------------------------------- */
{
  const wire = (/\(function wireSlide\(\)\{[\s\S]*?\}\)\(\);/.exec(src) || [''])[0];
  t.check(wire.length > 0, 'the slider is wired');
  t.check(/dx >= max \* 0\.85/.test(wire) && /submitOrder\(\);/.test(wire),
    'it sends only once the knob is dragged most of the way across');
  t.check(/if\(!moved\) toast\('Slide the red button across to send'\);/.test(wire),
    'a plain tap does not send, and says how to');
  t.check(/addEventListener\('click', \(e\)=>\{ if\(e\.detail === 0\) submitOrder\(\); \}\);/.test(wire),
    'a keyboard press still sends -- the knob is a real button');
  t.check(/\.ax-slide\{[^}]*touch-action:pan-y/.test(src) && /\.ag-knob\{[^}]*touch-action:none/.test(src),
    'and the drag is the knob\'s alone: the page still scrolls under a thumb that misses it');
  t.check((src.match(/id="ag_submit_btn"/g) || []).length === 1, 'there is exactly one send control');
}

/* ---------- 4. editing a line in place ------------------------------- */
{
  const typing = (/getElementById\('ag_cartWrap'\)\.addEventListener\('input'[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/const preview = Object\.assign\(\{\}, it, \{ agentSellPrice: entered \/ lineMult\(it\) \}\);/.test(typing),
    'a typed price is previewed per base unit, the way it will be stored');
  t.check(!/renderCart\(\)/.test(typing) && /renderDock\(preview\)/.test(typing),
    'and patches the chips and the dock without redrawing the field under the thumb');
  const commit = (/getElementById\('ag_cartWrap'\)\.addEventListener\('change'[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/it\.agentSellPrice = entered \/ lineMult\(it\);/.test(commit) && /saveQuoteDraft\(\);/.test(commit),
    'it is committed when the field is left, and kept');
  const render = fn('renderCart');
  t.check(/class="ax-sug" data-sug=/.test(render) && /last <b>/.test(render) && /shop <b>/.test(render),
    'under the price: what this client paid last time, and the shop\'s own price, one tap each');
  t.check(/data-del aria-label="Remove/.test(render), 'and the way to take the line out');
}

/* ---------- 5. the dock stays in reach ------------------------------- */
{
  t.check(/\.ax-dock\{[^}]*position:fixed/.test(src) && /\.ax-dock\{[\s\S]*?env\(safe-area-inset-bottom/.test(src.replace(/--safe-b/g, 'env(safe-area-inset-bottom')),
    'the dock is pinned to the foot and clears the phone\'s home bar');
  t.check(/\.ax-order\{[^}]*padding:14px 16px calc\(250px/.test(src), 'and the last line scrolls clear of it');
  t.check(/document\.querySelectorAll\('input\[name="ag_delivery"\]'\)/.test(src)
    && /id="ag_delivery_pickup"/.test(src) && /id="ag_delivery_shop"/.test(src),
    'pickup and delivery are real radio inputs behind the toggle, so the choice survives a reload');
}

process.exit(t.done() ? 1 : 0);
