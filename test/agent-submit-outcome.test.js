#!/usr/bin/env node
'use strict';
/*
 * What the agent is told actually happened.
 *
 * Submitting an order is two network round trips: the submit itself, then
 * a reload of the agent's orders so the new one can be shown and, for a
 * prepay agent, paid for. Both used to sit inside one try, with one catch
 * that said the order could not be submitted.
 *
 * So when the second one failed -- a phone dropping off the network right
 * after the POST, which is the condition this app is written for -- the
 * agent was told:
 *
 *     "You're offline -- this order needs a live price check, so it can't
 *      submit until you're back online"
 *
 * about an order the server had already created. Their basket was still
 * sitting in front of them, so the obvious next move was to send it again.
 *
 * agent-submit-order dedupes an identical re-send inside a short window,
 * which kept most of these from becoming double orders. A retry after that
 * window was a real one, and either way the agent was lied to.
 *
 * The rule this file holds the handler to: the submit call is the only
 * thing that decides whether the order was placed. Nothing after it may
 * report a failure, and the basket -- the one thing that invites a re-send
 * -- must be gone before anything that can fail runs.
 *
 * Run: node test/agent-submit-outcome.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent submit outcome');
const src = read('agent.html');

// The send is a named function now -- the slider and a keyboard press on
// its knob both call it -- so it is extracted by name.
function extractSubmitHandler() {
  return extractFunction(src, 'submitOrder', 'agent.html');
}

// The three the handler actually reasons about. Everything else
// resetCartAfterSubmit touches on its way through is auto-created below --
// this file is about what the agent is told, not about the DOM.
const fields = {
  // parentNode/textContent because applyPausedToCart writes the reason in
  // beside the button -- the handler's finally calls it, so it runs on
  // every outcome in this file, not only the paused one.
  ag_submit_btn: { disabled: false },
  ag_slideLabel: { textContent: 'Slide to send · 1 item' },
  ag_slide: { parentNode: null },
  ag_delivery_shop: { checked: false },
  ag_delivery_address: { value: '' },
};
const btnParent = { children: [], insertBefore(n) { this.children.push(n); fields[n.id] = n; } };
fields.ag_slide.parentNode = btnParent;
const noopEl = () => ({
  value: '', checked: false, disabled: false, innerHTML: '', textContent: '',
  style: {}, dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, focus() {}, click() {}, querySelectorAll: () => [],
  remove() {},
});
const getElementById = (id) => fields[id] || (fields[id] = noopEl());
const createElement = () => ({ className: '', id: '', textContent: '',
  remove() { delete fields[this.id]; btnParent.children = btnParent.children.filter((c) => c !== this); } });

const state = {};
let s = null, err = null;
try {
  s = compileScope([
    'let cart = [], carts = Object.create(null), chosenClient = null, myAgent = null, myOrders = [];',
    // The real one, not a stub: whether the finally hands a disabled
    // button back is exactly the kind of thing this file exists to catch.
    'let agentPaused = false, sendingOrder = false, openLineIdx = -1;',
    // Lines the shop refused to price are marked, not just reported.
    'const blockedLines = new Map(); const feedItemKey = (p, v) => `${p}::${v==null?\'\':v}`; function renderCart(){}',
    'function setAgentPaused(on){ agentPaused = !!on; applyPausedToCart(); }',
    extractFunction(src, 'applyPausedToCart', 'agent.html'),
    'const cartKey = (client) => client ? String(client.id) : null;',
    // resetCartAfterSubmit returns to the unnamed basket rather than a
    // fresh array, so the real one comes along.
    'let unnamedCart = [];',
    extractFunction(src, 'activateCartFor', 'agent.html'),
    extractFunction(src, 'isNetworkError', 'agent.html'),
    extractFunction(src, 'resetCartAfterSubmit', 'agent.html'),
    extractSubmitHandler(),
    `function setUp(o){
       chosenClient = o.client; myAgent = o.agent; myOrders = [];
       cart = o.cart.slice(); carts = Object.create(null); carts[String(o.client.id)] = cart;
       fields.ag_delivery_shop.checked = !!o.shopDelivery;
       fields.ag_delivery_address.value = o.address || '';
       fields.ag_submit_btn.disabled = false;
       state.told = []; state.submits = 0; state.paymentPrompted = false; state.tab = null; state.sent = null;
     }`,
    `function readState(){ return {
       told: state.told.slice(), submits: state.submits,
       cartLeft: cart.length, basketsLeft: Object.keys(carts),
       buttonUsable: !fields.ag_submit_btn.disabled,
       buttonSays: fields.ag_slideLabel.textContent,
       paymentPrompted: state.paymentPrompted, tab: state.tab, sent: state.sent,
     }; }`,
  ], {
    fields, state,
    document: { getElementById, createElement, querySelectorAll: () => [] },
    toast: (m) => { state.told.push(String(m)); },
    switchTab: (tab) => { state.tab = tab; },
    openPaymentChoiceModal: () => { state.paymentPrompted = true; },
    openMomoPaymentModal: () => { state.paymentPrompted = true; },
    sentSnapshot: () => ({ count: 1 }),
    showSent: (snap, orderId) => { state.sent = { snap, orderId }; },
    renderCurrentView: () => {},
    resetSlide: () => {},
    saveQuoteDraft: () => {},
    clearQuoteDraft: () => {},
    updateCartBadge: () => {},
    renderSellClientChip: () => {},
    /* Models the real one's contract, not just its return value.
       callAgentFn is the single place that sees the server's `paused`
       flag and raises the state -- the handler's finally only re-applies
       whatever the state already is. A stub that skipped that made the
       handler look like it was handing a disabled button back. */
    callAgentFn: async () => {
      state.submits++;
      try { return state.submitResult(); } catch (e) {
        if (e && e.paused) s.setAgentPaused(true);
        throw e;
      }
    },
    loadAgentHomeData: async () => state.loadResult(),
  }, ['submitOrder', 'setUp', 'readState', 'setAgentPaused']);
} catch (e) { err = e; }
t.check(!!s, `the submit handler compiles out of agent.html${err ? ` (${err.message})` : ''}`);

const CLIENT = { id: 'c1', name: 'Namuli Hardware' };
const AGENT = { id: 'AG0001', name: 'Sarah', paymentTerm: 'prepay' };
const BASKET = [{ productId: 'p1', variantIdx: null, qty: 10, agentSellPrice: 34000, floorPrice: 32000 }];

const netError = () => { const e = new Error('Failed to fetch'); e.name = 'TypeError'; throw e; };
const said = (r, re) => r.told.some((m) => re.test(m));

const run = async (submitResult, loadResult) => {
  s.setUp({ client: CLIENT, agent: AGENT, cart: BASKET });
  s.setAgentPaused(false);
  state.submitResult = submitResult;
  state.loadResult = loadResult;
  await s.submitOrder();
  return s.readState();
};

(async () => {
  if (s) {
    /* ---------- 1. the refresh fails after the order is placed --------- */
    {
      const r = await run(() => ({ ok: true, orderId: 4242 }), netError);

      t.check(r.submits === 1, 'the order was submitted once');
      t.check(!said(r, /can't submit|Could not submit/),
        `the agent is not told the order failed, because it did not (${JSON.stringify(r.told)})`);
      t.check(r.sent && r.sent.orderId === 4242, 'they are shown the Sent screen for it');
      t.check(said(r, /Order submitted/) && said(r, /waiting for you on Today/),
        'and told where to find it, since the refresh that would have shown it is what broke');
      t.check(r.cartLeft === 0 && r.basketsLeft.length === 0,
        'the basket is cleared, so nothing invites them to send the same order again');
      t.check(r.buttonUsable, 'and the button is usable again');
    }

    /* ---------- 2. the ordinary path is unchanged ---------------------- */
    {
      const r = await run(() => ({ ok: true, orderId: 4242 }), async () => {});
      t.check(r.told.length === 0 && r.sent && r.sent.orderId === 4242,
        `a clean submit says it with the Sent screen, and nothing else (${JSON.stringify(r.told)})`);
      t.check(r.cartLeft === 0 && r.tab === 'today', 'clears the basket, and Today is underneath when Sent is closed');
    }

    /* ---------- 3. nobody is asked to pay on sending ----------------- *
     * A prepay agent used to be asked for the money the moment the order
     * went. If the shop then dropped a line, they had paid for goods they
     * would never get. The shop checks the lines first now; payment is
     * asked for on the order's track, once it has.
     */
    {
      const r = await run(() => ({ ok: true, orderId: 4242 }), async () => {});
      t.check(!r.paymentPrompted, 'sending opens no payment prompt, for a prepay agent either');
      t.check(!/openPaymentChoiceModal|openMomoPaymentModal/.test(extractSubmitHandler()),
        'and the send cannot reach one');
    }

    /* ---------- 4. a genuine submit failure keeps the basket ----------- */
    {
      const r = await run(netError, async () => {});
      t.check(said(r, /can't submit until you're back online/),
        'a submit that really failed offline says so');
      t.check(r.cartLeft === 1 && r.basketsLeft.length === 1,
        'and keeps the basket, because the agent does need to send it again');
      t.check(!said(r, /Order submitted/),
        'without ever claiming the order went through');
      t.check(r.buttonUsable, 'with the button usable for the retry');
    }

    /* ---------- 5. a rejection reports the reason --------------------- */
    {
      const r = await run(() => { throw new Error('No supplier price on file for Cement 50kg'); }, async () => {});
      t.check(said(r, /No supplier price on file/),
        'a server rejection is passed through rather than blamed on the network');
      t.check(r.cartLeft === 1, 'and the basket survives so it can be fixed and resent');
    }

    /* ---------- 6. the structure that makes the above hold ------------ */
    {
      // Comments stripped first: the note above the submit call quotes the
      // old failure message, and matching that instead of the live one
      // would make this assertion about the prose rather than the code.
      const handler = extractSubmitHandler()
        .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
      const submitAt = handler.indexOf("callAgentFn('agent-submit-order'");
      const resetAt = handler.indexOf('resetCartAfterSubmit()');
      const loadAt = handler.indexOf('loadAgentHomeData()');
      const failMsg = handler.indexOf("can't submit until you're back online");

      t.check(submitAt < failMsg && failMsg < loadAt,
        'the failure message belongs to the submit call, and is closed before the reload runs');
      t.check(resetAt < loadAt,
        'the basket is cleared BEFORE the reload, so a failure there cannot leave it inviting a re-send');
      t.check(/return;\s*\}finally\{/.test(handler.replace(/\r?\n\s*/g, '')),
        'a failed submit returns rather than falling through into the success path');
    }

    /* ---------- 7. refused because the shop paused them ---------------- *
     * Not a failure that might work next time. The finally re-enables the
     * button on every outcome, which for this one would hand it straight
     * back and undo the block -- so the agent taps, is refused, taps
     * again, and the app looks broken rather than paused.
     */
    {
      const r = await run(() => {
        const e = new Error('Your account is paused. Talk to the shop before placing new orders.');
        e.paused = true; throw e;
      }, async () => {});

      t.check(said(r, /account is paused/), 'the agent is told the shop paused them');
      t.check(!said(r, /Could not submit order/),
        'not that the order could not be submitted, which describes something that might work next time');
      t.check(!said(r, /back online/), 'and not blamed on the network');
      t.check(!r.buttonUsable, 'the submit button stays out of reach rather than being handed back');
      t.check(r.buttonSays === 'Orders are paused', 'saying why, rather than looking broken');
      /* Their work is not thrown away. A pause is the shop's decision and
         the agent should not lose a basket over it. */
      t.check(r.cartLeft === 1 && r.basketsLeft.length === 1,
        'and the basket is still there for when the pause is lifted');
      t.check(!r.paymentPrompted && r.tab === null && !r.sent,
        'with none of the order-placed housekeeping run for an order that was never placed');
    }
  }
  process.exit(t.done() ? 1 : 0);
})();
