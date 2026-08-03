#!/usr/bin/env node
'use strict';
/*
 * Two agents, one phone.
 *
 * Agents share devices -- that is the working assumption the offline
 * snapshot was already hardened against (cacheBelongsTo, and the note
 * above it in agent.html). The quote draft is that snapshot's sibling and
 * had none of the same protection: one key per browser, no stamp saying
 * who wrote it, restored unconditionally on boot, and not cleared on sign
 * out.
 *
 * What that handed the next agent to sign in:
 *
 *   the baskets     every in-progress basket, with products and
 *                   quantities, keyed by the previous agent's client ids.
 *   the address     a customer's typed delivery address, verbatim, sitting
 *                   in the new agent's quote form.
 *   the chip        "2 other quotes in progress", counted straight off the
 *                   restored baskets, for clients they own none of.
 *
 * And it did not decay: the next save re-wrote those baskets under the new
 * agent's own draft, so the previous agent's work was laundered into
 * theirs rather than aging out.
 *
 * An agent's client list is private to them by design (0012_sales_agents
 * .sql), so this is a leak between agents, not a staleness bug -- the same
 * conclusion the offline snapshot's comment reaches about itself.
 *
 * Run: node test/agent-shared-device.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent shared device');
const src = read('agent.html');

// One device: a localStorage that survives sign-out, sign-in and reload.
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const fields = {
  ag_delivery_shop: { checked: false, dispatchEvent: () => {} },
  ag_delivery_address: { value: '' },
};

let s = null, err = null;
try {
  s = compileScope([
    extractDeclaration(src, 'QUOTE_DRAFT_KEY', 'agent.html'),
    'let restoringQuoteDraft = false;',
    'let cart = [], chosenClient = null, carts = Object.create(null), agentClients = [], currentUser = null;',
    'const cartKey = (client) => client ? String(client.id) : null;',
    extractFunction(src, 'stashActiveCart', 'agent.html'),
    extractFunction(src, 'activateCartFor', 'agent.html'),
    extractFunction(src, 'clientsWithBaskets', 'agent.html'),
    extractFunction(src, 'otherBasketCount', 'agent.html'),
    extractFunction(src, 'draftBelongsTo', 'agent.html'),
    extractFunction(src, 'saveQuoteDraft', 'agent.html'),
    extractFunction(src, 'clearQuoteDraft', 'agent.html'),
    extractFunction(src, 'restoreQuoteDraft', 'agent.html'),
    // The app around the draft, lifted out of the DOM handlers it lives in.
    'function selectClient(c){ if(cartKey(chosenClient)!==cartKey(c)) stashActiveCart(); chosenClient = c; activateCartFor(c); }',
    'function addItem(it){ cart.push(it); saveQuoteDraft(); }',
    `function signIn(user, clients){
       currentUser = user; agentClients = clients;
       cart = []; chosenClient = null; carts = Object.create(null);
       fields.ag_delivery_address.value = ''; fields.ag_delivery_shop.checked = false;
       restoreQuoteDraft();
     }`,
    `function state(){ return {
       carts: JSON.parse(JSON.stringify(carts)),
       client: chosenClient && chosenClient.id,
       address: fields.ag_delivery_address.value,
       shopDelivery: fields.ag_delivery_shop.checked,
       others: otherBasketCount(),
     }; }`,
  ], { localStorage, document: { getElementById: (id) => fields[id] }, fields },
  ['saveQuoteDraft', 'clearQuoteDraft', 'restoreQuoteDraft', 'selectClient',
    'addItem', 'signIn', 'state', 'draftBelongsTo']);
} catch (e) { err = e; }
t.check(!!s, `the draft helpers compile${err ? ` (${err.message})` : ''}`);

const A = { id: 'user-aaa' }, B = { id: 'user-bbb' };
const A_CLIENTS = [{ id: 'c1', name: 'Namuli Hardware' }, { id: 'c2', name: 'Mukasa Stores' }];
const B_CLIENTS = [{ id: 'c9', name: 'Kigongo Traders' }];
const ADDRESS = 'Plot 14 Ntinda, ask for Sarah — gate is blue';

// Agent A's morning: two baskets going, an address typed, nothing submitted.
const agentAWorks = () => {
  s.signIn(A, A_CLIENTS);
  s.selectClient(A_CLIENTS[0]);
  s.addItem({ productId: 'p1', name: 'Cement 50kg', qty: 40 });
  s.selectClient(A_CLIENTS[1]);
  s.addItem({ productId: 'p2', name: 'Iron sheets', qty: 12 });
  fields.ag_delivery_address.value = ADDRESS;
  fields.ag_delivery_shop.checked = true;
  s.saveQuoteDraft();
};

if (s) {
  /* ---------- 1. the draft says who wrote it ------------------------- */
  {
    Object.keys(store).forEach((k) => delete store[k]);
    agentAWorks();
    const draft = JSON.parse(store.agentQuoteDraft);
    t.check(String(draft.userId) === String(A.id),
      'a saved draft is stamped with the login that wrote it');
    t.check(Object.keys(draft.carts).length === 2 && draft.deliveryAddress === ADDRESS,
      'and holds the baskets and the typed delivery address, which is what makes the stamp matter');
  }

  /* ---------- 2. it comes back for the agent who wrote it ------------ */
  {
    s.signIn(A, A_CLIENTS);
    const back = s.state();
    t.check(Object.keys(back.carts).length === 2, "agent A's own baskets are restored");
    t.check(back.carts.c1.length === 1 && back.carts.c2.length === 1, 'with their items intact');
    t.check(back.address === ADDRESS && back.shopDelivery === true,
      'and the delivery choice they had made -- the whole point of keeping a draft');
    t.check(back.client === 'c2', 'and the client they were on');
  }

  /* ---------- 3. and not for anybody else ---------------------------- */
  {
    Object.keys(store).forEach((k) => delete store[k]);
    agentAWorks();
    // A hands the phone over without signing out, or signs out on a build
    // that did not clear the draft. Either way it is still on the device.
    s.signIn(B, B_CLIENTS);
    const got = s.state();

    t.check(Object.keys(got.carts).length === 0,
      `no basket of agent A's is loaded into agent B's session (got ${JSON.stringify(Object.keys(got.carts))})`);
    t.check(got.address === '',
      "and a customer's delivery address does not appear in another agent's quote form");
    t.check(got.shopDelivery === false, 'nor the delivery mode that went with it');
    t.check(got.client === null, 'and nobody is pre-selected');
    t.check(got.others === 0,
      'so the chip does not announce "other quotes in progress" for clients this agent has never heard of');
  }

  /* ---------- 4. dropped, not merely ignored ------------------------- */
  {
    // Left in place, the next save would re-write it under B's own stamp:
    // A's work laundered into B's draft rather than aged out.
    t.check(store.agentQuoteDraft === undefined,
      "a draft that is not yours is cleared off the device, not left for your own next save to adopt");

    s.selectClient(B_CLIENTS[0]);
    s.addItem({ productId: 'p3', name: 'Paint 4L', qty: 2 });
    const stored = JSON.parse(store.agentQuoteDraft);
    t.check(JSON.stringify(Object.keys(stored.carts)) === '["c9"]',
      `and agent B's own draft holds only agent B's basket (got ${JSON.stringify(Object.keys(stored.carts))})`);
    t.check(String(stored.userId) === String(B.id), 'stamped with agent B');
  }

  /* ---------- 5. a draft from before the stamp belongs to nobody ----- */
  {
    t.check(s.draftBelongsTo({ userId: 'user-aaa' }, 'user-aaa') === true, 'a matching stamp is yours');
    t.check(s.draftBelongsTo({ userId: 'user-aaa' }, 'user-bbb') === false, 'a different one is not');
    t.check(s.draftBelongsTo({ carts: {} }, 'user-aaa') === false,
      'and an unstamped draft cannot be shown to belong to anyone, so it is nobody\'s');
    t.check(s.draftBelongsTo({ userId: 'user-aaa' }, null) === false,
      'with no signed-in login there is nothing it could match');

    // The cost of that: one in-progress quote, once, on upgrade. Pinned so
    // the trade-off is a decision on the record rather than a surprise.
    Object.keys(store).forEach((k) => delete store[k]);
    store.agentQuoteDraft = JSON.stringify({
      carts: { c1: [{ productId: 'p1', qty: 5 }] }, chosenClientId: 'c1', deliveryAddress: ADDRESS });
    s.signIn(A, A_CLIENTS);
    t.check(Object.keys(s.state().carts).length === 0 && s.state().address === '',
      'a legacy unstamped draft is dropped rather than handed to whoever opens the app next');
  }

  /* ---------- 6. signing out does not leave it behind ---------------- */
  {
    const signOut = extractFunction(src, 'signOutAndReload', 'agent.html');
    t.check(/clearQuoteDraft\(\)/.test(signOut),
      'signing out clears the quote draft, as it already did the offline snapshot');
    t.check(/clearOfflineCache\(\)/.test(signOut),
      'and still clears the snapshot');
    t.check(signOut.indexOf('clearQuoteDraft()') < signOut.indexOf('sb.auth.signOut()'),
      'both before the session goes, while there is still a session to reason about');
  }

  /* ---------- 7. one rule, both keys --------------------------------- */
  {
    // These are siblings: same device, same problem, same answer. If one
    // grows an ownership check the other should not be left behind again.
    const restore = extractFunction(src, 'restoreQuoteDraft', 'agent.html');
    t.check(/draftBelongsTo\(/.test(restore),
      'the draft is read through an ownership check');
    const own = extractFunction(src, 'ownCachedSnapshot', 'agent.html');
    t.check(/cacheBelongsTo\(/.test(own),
      'and so is the offline snapshot, which is where the rule came from');
    const save = extractFunction(src, 'saveQuoteDraft', 'agent.html');
    t.check(/userId:\s*currentUser/.test(save),
      'and a draft cannot be written without the stamp that check depends on');
  }
}

process.exit(t.done() ? 1 : 0);
