#!/usr/bin/env node
'use strict';
/*
 * One basket per client in the agent app.
 *
 * An agent works several shops in a morning and often quotes the same one
 * across repeat visits. The app modelled that as a single cart with a
 * single chosen client -- an e-commerce checkout, when the job is a quote
 * in progress per customer.
 *
 * That was not only the wrong metaphor. Tapping "Change" cleared the
 * client and KEPT the items, so a basket built for Namuli Hardware
 * silently became Mukasa Stores' order. Nothing warned and nothing
 * cleared, and the wrong customer is charged for goods they never asked
 * for. That bleed is the case this file exists to pin.
 *
 * `cart` is still the active basket, so the fifty-odd places that read it
 * were untouched; `carts` holds one per client behind it.
 *
 * Run: node test/agent-baskets.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent baskets');
const src = read('agent.html');

let s = null, err = null;
try {
  s = compileScope(
    [
      'let cart = [], chosenClient = null; let carts = Object.create(null);',
      'const cartKey = (client) => client ? String(client.id) : null;',
      extractFunction(src, 'stashActiveCart', 'agent.html'),
      extractFunction(src, 'activateCartFor', 'agent.html'),
      extractFunction(src, 'clientsWithBaskets', 'agent.html'),
      extractFunction(src, 'otherBasketCount', 'agent.html'),
      // The three moments that move a basket, lifted out of the DOM
      // handlers they live in so the state machine can be exercised.
      `function pick(client){ if(cartKey(chosenClient)!==cartKey(client)) stashActiveCart(); chosenClient = client; activateCartFor(client); }`,
      `function change(){ stashActiveCart(); chosenClient = null; cart = []; }`,
      `function submitted(){ const k = cartKey(chosenClient); if(k) delete carts[k]; cart = []; chosenClient = null; }`,
      `function add(item){ cart.push(item); }`,
      `function state(){ return { cart: cart.slice(), carts: JSON.parse(JSON.stringify(carts)), client: chosenClient ? chosenClient.id : null }; }`,
    ],
    {}, ['pick', 'change', 'submitted', 'add', 'state', 'otherBasketCount', 'clientsWithBaskets'],
  );
} catch (e) { err = e; }
t.check(!!s, `the basket helpers compile${err ? ` (${err.message})` : ''}`);

const NAMULI = { id: 'c1', name: 'Namuli Hardware' };
const MUKASA = { id: 'c2', name: 'Mukasa Stores' };

if (s) {
  /* ---------- 1. the bleed, which is the whole point ---------------- */
  {
    s.pick(NAMULI);
    s.add({ productId: 'p1', qty: 24 });
    s.add({ productId: 'p2', qty: 6 });
    t.check(s.state().cart.length === 2, "two items are in Namuli's basket");

    // The exact sequence that used to produce a wrong order.
    s.change();
    t.check(s.state().cart.length === 0,
      'tapping Change leaves nothing in hand -- this is where items used to follow the agent');

    s.pick(MUKASA);
    t.check(s.state().cart.length === 0,
      "and Mukasa's basket starts empty rather than inheriting Namuli's two items");

    s.add({ productId: 'p9', qty: 1 });
    t.check(s.state().cart.length === 1, 'an item added now belongs to Mukasa');
    t.check(s.state().carts.c1.length === 2, "while Namuli's two items are still waiting");
  }

  /* ---------- 2. going back finds the basket as it was -------------- */
  {
    s.pick(NAMULI);
    t.check(s.state().cart.length === 2, 'returning to Namuli restores their basket intact');
    t.check(s.state().carts.c2.length === 1, "and Mukasa's is parked, not lost");

    // Items land in the basket of whoever is chosen, which is the property
    // that makes storing the array by reference safe.
    s.add({ productId: 'p3', qty: 2 });
    t.check(s.state().carts.c1.length === 3, "a later add goes to Namuli's basket, not the last one touched");
    t.check(s.state().carts.c2.length === 1, "and does not touch Mukasa's");
  }

  /* ---------- 3. submitting clears only that customer --------------- */
  {
    s.pick(NAMULI);
    s.submitted();
    t.check(s.state().carts.c1 === undefined, "Namuli's basket is gone once their order is placed");
    t.check(s.state().carts.c2.length === 1, "Mukasa's is untouched");
    t.check(s.state().client === null && s.state().cart.length === 0,
      'and nothing is left in hand');
  }

  /* ---------- 4. what the agent is told ----------------------------- */
  {
    // Rebuild: Mukasa has one waiting, nobody chosen.
    t.check(s.otherBasketCount() === 1,
      'with no client chosen, the one waiting basket is counted as another');
    s.pick(MUKASA);
    t.check(s.otherBasketCount() === 0,
      'once it is the active one it is no longer "another"');
    s.pick(NAMULI);
    t.check(s.otherBasketCount() === 1, 'and switching away counts it again');

    // An empty basket is not a quote in progress and must not be advertised.
    s.pick({ id: 'c3', name: 'Empty' });
    t.check(!s.clientsWithBaskets().includes('c3'),
      'a client with an empty basket is not listed as having one');

    // Nor once the agent moves on from it. Selecting a client is how you
    // look at one, so an agent browsing three customers leaves empty
    // baskets behind each time; otherBasketCount is what the chip actually
    // reads, and counting those would tell them they have quotes waiting
    // that do not exist.
    s.pick(MUKASA);
    t.check(s.otherBasketCount() === 0,
      `switching away from empty baskets does not turn them into quotes in progress (got ${s.otherBasketCount()})`);
  }
}

/* ---------- 5. wired into the three places it moves ------------------ */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

  t.check(/if\(cartKey\(chosenClient\) !== cartKey\(client\)\) stashActiveCart\(\);/.test(code),
    'selecting a different client parks the basket first');
  t.check(/stashActiveCart\(\);\s*chosenClient = null;\s*cart = \[\];/.test(code),
    'Change parks the basket and empties the hand');
  t.check(/const k = cartKey\(chosenClient\);\s*if\(k\) delete carts\[k\];/.test(code),
    'and submitting deletes only that client\'s basket');
  // Every place that drops the chosen client must also empty the hand --
  // that is the whole bug. Checked by looking at what surrounds each site
  // rather than by pattern-matching the old code, which an earlier version
  // of this check did and could not tell the fix from the defect.
  const sites = [...code.matchAll(/chosenClient = null;/g)]
    .map(m => m.index)
    // The declaration `let cart = [], chosenClient = null;` is where both
    // start empty, not a place either is cleared.
    .filter(i => !/let cart = \[\],\s*$/.test(code.slice(Math.max(0, i - 20), i)));
  t.check(sites.length >= 2, `every site that clears the client is examined (${sites.length})`);
  const unguarded = sites.filter(i => {
    const near = code.slice(Math.max(0, i - 160), i + 160);
    return !/cart = \[\];/.test(near);
  });
  t.check(unguarded.length === 0,
    `no site drops the client while leaving items in hand (${unguarded.length} unguarded)`);
}

/* ---------- 6. a draft written by the old app is not lost ------------ */
/*
 * An agent mid-quote when the app updates has a draft holding a single
 * `cart` and a chosenClientId. Those items belonged to that client, so
 * they are adopted rather than dropped.
 */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/carts, chosenClientId: chosenClient \? chosenClient\.id : null/.test(code),
    'the draft now stores every basket');
  t.check(/stashActiveCart\(\);\s*localStorage\.setItem\(QUOTE_DRAFT_KEY/.test(code),
    'and parks the active one first, or what is in hand is written under the wrong key');
  t.check(/if\(Array\.isArray\(draft\.cart\) && draft\.cart\.length && !carts\[String\(client\.id\)\]\)/.test(code),
    'a legacy single-cart draft is adopted into that client\'s basket');
  t.check(/\} else if\(Array\.isArray\(draft\.cart\) && draft\.cart\.length\)\{/.test(code),
    'and a legacy draft with no client keeps its items in hand rather than dropping them');
}

process.exit(t.done() ? 1 : 0);
