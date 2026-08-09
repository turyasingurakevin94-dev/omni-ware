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
      extractFunction(src, 'adoptedCartFor', 'agent.html'),
      extractFunction(src, 'clientsWithBaskets', 'agent.html'),
      extractFunction(src, 'otherBasketCount', 'agent.html'),
      /* The moments that move a basket, lifted out of the DOM handlers
         they live in so the state machine can be exercised. Kept in step
         with the real ones by hand — a stand-in that drifts is worse than
         none, since it goes on passing about code that has changed
         underneath it. */
      `function pick(client){
         const hadClient = !!cartKey(chosenClient);
         const inHand = hadClient ? [] : cart.slice();
         if(cartKey(chosenClient)!==cartKey(client)) stashActiveCart();
         chosenClient = client; activateCartFor(client);
         const merged = adoptedCartFor(hadClient, inHand, cart);
         if(merged.adopted){ cart.length = 0; merged.rows.forEach(r=> cart.push(r)); unnamedCart = []; }
       }`,
      // The switcher: parks and swaps, and adopts nothing.
      `function switchTo(client){ stashActiveCart(); chosenClient = client; activateCartFor(client); }`,
      `function switchToUnnamed(){ stashActiveCart(); chosenClient = null; activateCartFor(null); }`,
      `function change(){ stashActiveCart(); chosenClient = null; activateCartFor(null); }`,
      `function submitted(){ const k = cartKey(chosenClient); if(k) delete carts[k]; chosenClient = null; activateCartFor(null); }`,
      `function add(item){ cart.push(item); }`,
      `function unnamed(){ return unnamedCart.slice(); }`,
      `function resetAll(){ cart = []; carts = Object.create(null); chosenClient = null; unnamedCart = []; }`,
      `function state(){ return { cart: cart.slice(), carts: JSON.parse(JSON.stringify(carts)), client: chosenClient ? chosenClient.id : null }; }`,
    ],
    {}, ['pick', 'switchTo', 'switchToUnnamed', 'change', 'submitted', 'add', 'unnamed', 'resetAll', 'state', 'otherBasketCount', 'clientsWithBaskets'],
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

/* ---------- 4b. the basket nobody has claimed ------------------------ */
/*
 * Items added before a client is named live in a basket of their own. It
 * has to behave like every other one: parkable, switchable, and never
 * quietly emptied by something happening to a different quote.
 *
 * This is what makes the switcher safe. Tapping a client's tab means
 * "show me theirs", so what is in hand has to go somewhere — and before
 * this basket existed, the only options were to carry it along or drop
 * it, both of which are the bug this file was written about.
 */
if (s) {
  const eqJ = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
    `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

  s.resetAll();
  s.pick(NAMULI); s.add('cement');
  s.change();                                   // step away from Namuli
  s.add('loose bolt'); s.add('loose nut');
  eqJ(s.state().cart, ['loose bolt', 'loose nut'], 'items added with nobody named stay in hand');

  s.switchTo(NAMULI);
  eqJ(s.state().cart, ['cement'], 'switching to a client shows only their own basket');
  eqJ(s.unnamed(), ['loose bolt', 'loose nut'],
    'and the unclaimed basket is parked — not carried into theirs, and not dropped');

  s.switchToUnnamed();
  eqJ(s.state().cart, ['loose bolt', 'loose nut'], 'switching back returns the unclaimed basket');
  eqJ(s.state().carts.c1, ['cement'], 'with the client\'s own still waiting');

  /* Naming a client IS claiming them, so the picker adopts where the
     switcher does not. */
  s.resetAll();
  s.add('loose bolt');
  s.pick(NAMULI);
  eqJ(s.state().cart, ['loose bolt'], 'choosing a client claims what was in hand');
  eqJ(s.unnamed(), [],
    'and empties the unclaimed basket, or the same items would sit in two places at once');

  /* Submitting one client's order must not disturb a basket belonging to
     nobody. A plain `cart = []` would detach the active basket from the
     unclaimed one, and the next park would write the empty array over it. */
  s.resetAll();
  s.add('loose bolt');
  s.switchTo(NAMULI); s.add('cement');
  s.submitted();
  eqJ(s.unnamed(), ['loose bolt'], 'submitting an order leaves the unclaimed basket alone');
  eqJ(s.state().cart, ['loose bolt'], 'and hands it back, rather than a fresh empty one');
  s.add('another');
  eqJ(s.unnamed(), ['loose bolt', 'another'],
    'so the next item lands in it rather than in an array nothing reads');
}

/* ---------- 5. wired into the three places it moves ------------------ */
{
  const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

  t.check(/if\(cartKey\(chosenClient\) !== cartKey\(client\)\) stashActiveCart\(\);/.test(code),
    'selecting a different client parks the basket first');
  /* Change parks the client's basket and swaps in the unnamed one, which
     is usually empty and is exactly what `cart = []` used to mean. The
     difference is that anything genuinely waiting to be claimed comes
     back instead of being replaced by a fresh array. */
  t.check(/stashActiveCart\(\);\s*chosenClient = null;\s*activateCartFor\(null\);/.test(code),
    'Change parks the basket and leaves the unnamed one in hand');
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
  /* The guarantee is that dropping the client never leaves the PREVIOUS
     client's items in hand. There are now two ways to honour it: empty
     the basket, or swap in the unnamed one — which activateCartFor(null)
     does, now that the unnamed basket has somewhere to be kept. Either is
     fine; doing neither is the bug. And both must park first, or what was
     in hand is not carried anywhere, it is simply lost. */
  const unguarded = sites.filter(i => {
    const near = code.slice(Math.max(0, i - 200), i + 200);
    const swapped = /cart = \[\];/.test(near) || /activateCartFor\(null\)/.test(near);
    /* Parked, or deliberately deleted — resetCartAfterSubmit drops the
       basket it has just sent, which is the one case where not keeping it
       is the whole point. */
    const accountedFor = /stashActiveCart\(\)/.test(near) || /delete carts\[k\]/.test(near);
    return !(swapped && accountedFor);
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
  /* Gated on the ABSENCE of `carts`, because in a current draft `cart` is
     the unnamed basket and belongs to nobody — without that gate a client
     whose own basket happened to be empty would silently inherit it. */
  t.check(/if\(!draft\.carts && Array\.isArray\(draft\.cart\) && draft\.cart\.length && !carts\[String\(client\.id\)\]\)/.test(code),
    'a legacy single-cart draft is adopted into that client\'s basket');
  t.check(/if\(Array\.isArray\(draft\.cart\) && draft\.cart\.length && !unnamedCart\.length\)\{/.test(code),
    'and a draft with no client keeps its items, in the unnamed basket rather than dropping them');
}

process.exit(t.done() ? 1 : 0);
