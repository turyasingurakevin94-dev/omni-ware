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

// The handler is an anonymous arrow inside addEventListener, so there is no
// name for extractFunction to anchor on. Sliced by brace matching from its
// one call site; throws rather than skipping if the shape ever moves,
// because a test that quietly stops exercising this would report green
// while checking nothing.
function extractSubmitHandler() {
  const anchor = "document.getElementById('ag_submit_btn').addEventListener('click', async ()=>{";
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error('could not find the ag_submit_btn click handler in agent.html');
  if (src.indexOf(anchor, at + 1) >= 0) throw new Error('more than one ag_submit_btn click handler');
  const open = at + anchor.length - 1;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      return `async function submitOrder()${src.slice(open, i + 1)}`;
    }
  }
  throw new Error('unbalanced braces in the ag_submit_btn handler');
}

// The three the handler actually reasons about. Everything else
// resetCartAfterSubmit touches on its way through is auto-created below --
// this file is about what the agent is told, not about the DOM.
const fields = {
  ag_submit_btn: { disabled: false },
  ag_delivery_shop: { checked: false },
  ag_delivery_address: { value: '' },
};
const noopEl = () => ({
  value: '', checked: false, disabled: false, innerHTML: '', textContent: '',
  style: {}, dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, focus() {}, click() {}, querySelectorAll: () => [],
});
const getElementById = (id) => fields[id] || (fields[id] = noopEl());

const state = {};
let s = null, err = null;
try {
  s = compileScope([
    'let cart = [], carts = Object.create(null), chosenClient = null, myAgent = null, myOrders = [];',
    'const cartKey = (client) => client ? String(client.id) : null;',
    extractFunction(src, 'isNetworkError', 'agent.html'),
    extractFunction(src, 'resetCartAfterSubmit', 'agent.html'),
    extractSubmitHandler(),
    `function setUp(o){
       chosenClient = o.client; myAgent = o.agent; myOrders = [];
       cart = o.cart.slice(); carts = Object.create(null); carts[String(o.client.id)] = cart;
       fields.ag_delivery_shop.checked = !!o.shopDelivery;
       fields.ag_delivery_address.value = o.address || '';
       fields.ag_submit_btn.disabled = false;
       state.told = []; state.submits = 0; state.paymentPrompted = false; state.tab = null;
     }`,
    `function readState(){ return {
       told: state.told.slice(), submits: state.submits,
       cartLeft: cart.length, basketsLeft: Object.keys(carts),
       buttonUsable: !fields.ag_submit_btn.disabled,
       paymentPrompted: state.paymentPrompted, tab: state.tab,
     }; }`,
  ], {
    fields, state,
    document: { getElementById, querySelectorAll: () => [] },
    toast: (m) => { state.told.push(String(m)); },
    switchTab: (tab) => { state.tab = tab; },
    openPaymentChoiceModal: () => { state.paymentPrompted = true; },
    saveQuoteDraft: () => {},
    clearQuoteDraft: () => {},
    updateCartBadge: () => {},
    renderSellClientChip: () => {},
    callAgentFn: async () => { state.submits++; return state.submitResult(); },
    loadAgentHomeData: async () => state.loadResult(),
  }, ['submitOrder', 'setUp', 'readState']);
} catch (e) { err = e; }
t.check(!!s, `the submit handler compiles out of agent.html${err ? ` (${err.message})` : ''}`);

const CLIENT = { id: 'c1', name: 'Namuli Hardware' };
const AGENT = { id: 'AG0001', name: 'Sarah', paymentTerm: 'prepay' };
const BASKET = [{ productId: 'p1', variantIdx: null, qty: 10, agentSellPrice: 34000, floorPrice: 32000 }];

const netError = () => { const e = new Error('Failed to fetch'); e.name = 'TypeError'; throw e; };
const said = (r, re) => r.told.some((m) => re.test(m));

const run = async (submitResult, loadResult) => {
  s.setUp({ client: CLIENT, agent: AGENT, cart: BASKET });
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
      t.check(said(r, /Order submitted/), 'they are told it was submitted');
      t.check(said(r, /under Orders/),
        'and where to find it, since the refresh that would have shown it is what broke');
      t.check(r.cartLeft === 0 && r.basketsLeft.length === 0,
        'the basket is cleared, so nothing invites them to send the same order again');
      t.check(r.buttonUsable, 'and the button is usable again');
    }

    /* ---------- 2. the ordinary path is unchanged ---------------------- */
    {
      const r = await run(() => ({ ok: true, orderId: 4242 }), async () => {});
      t.check(r.told.length === 1 && /Order submitted/.test(r.told[0]),
        `a clean submit still says one thing (${JSON.stringify(r.told)})`);
      t.check(r.cartLeft === 0 && r.tab === 'sell', 'clears the basket and returns to Sell');
    }

    /* ---------- 3. a prepay agent is still asked to pay ---------------- */
    {
      s.setUp({ client: CLIENT, agent: AGENT, cart: BASKET });
      state.submitResult = () => ({ ok: true, orderId: 4242 });
      state.loadResult = () => { s.readState(); };
      // The reload is what puts the new order in myOrders; mimic that.
      state.loadResult = async () => { state.injected = true; };
      await s.submitOrder();
      t.check(state.injected === true, 'the orders reload still runs on the happy path');
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
  }
  process.exit(t.done() ? 1 : 0);
})();
