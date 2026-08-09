#!/usr/bin/env node
'use strict';
/*
 * The basket built before anybody was named.
 *
 * The agent app keeps one basket per client: `cart` is the active one and
 * `carts[clientId]` holds the rest, so an agent can leave a half-built
 * quote to go and serve somebody else. Selecting a client parks the
 * basket in hand and swaps in theirs.
 *
 * REPORTED, and it lost work. Items added BEFORE a client was chosen had
 * no owner to be parked against -- cartKey(null) is null, so
 * stashActiveCart() stored nothing -- and activateCartFor() then replaced
 * `cart` with the newly chosen client's empty basket. Everything the
 * agent had just added in front of the customer disappeared, and
 * choosing the client was the very act that did it.
 *
 * Naming a client IS saying who those items are for, so they move across
 * instead. Appended to whatever that client already had, because a basket
 * parked for them earlier is theirs too and dropping either side is the
 * same fault again.
 *
 * Run: node test/agent-cart-adoption.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('agent cart adoption');
const src = read('agent.html');
const { adoptedCartFor } = (new Function(
  extractFunction(src, 'adoptedCartFor', 'agent.html') + '\nreturn { adoptedCartFor };'))();

const item = (n) => ({ name: n });
const names = (rows) => rows.map((r) => r.name).join(',');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the reported case -------------------------------------- */
{
  const hand = [item('Cement'), item('Nails')];
  const r = adoptedCartFor(false, hand, []);
  eq(names(r.rows), 'Cement,Nails',
    'items added before a client was chosen survive being given one');
  eq(r.adopted, 2, 'and the number that moved across is reported');
  eq(r.joined, 0, 'with nothing of the client\'s own to have joined');
}

/* ---------- 2. the client already had a basket ------------------------ */
/*
 * Both sides are real: one was parked for this client earlier, the other
 * was just built in front of them. Keeping one and dropping the other is
 * the same loss the fix is about, so they join.
 */
{
  const r = adoptedCartFor(false, [item('Nails')], [item('Cement'), item('Wire')]);
  eq(names(r.rows), 'Cement,Wire,Nails',
    'the parked basket keeps its order and the new items join the end');
  eq(r.adopted, 1, 'one item moved across');
  eq(r.joined, 2, 'onto two that were already waiting — worth saying, since the total jumps');
}

/* ---------- 3. switching between two clients -------------------------- */
/*
 * The one case where nothing must be adopted. The basket in hand already
 * belongs to somebody, stashActiveCart has parked it with them, and
 * carrying it into the next customer's order is the bug this per-client
 * design was built to prevent in the first place.
 */
{
  const r = adoptedCartFor(true, [item('Sarah\'s cement')], [item('Musa\'s nails')]);
  eq(names(r.rows), 'Musa\'s nails', 'the new client gets only their own basket');
  eq(r.adopted, 0, 'nothing follows the agent from the last customer');
  const empty = adoptedCartFor(true, [item('Sarah\'s cement')], []);
  eq(names(empty.rows), '', 'and a client with no basket yet still starts empty');
  eq(empty.adopted, 0, 'rather than inheriting the last one\'s items');
}

/* ---------- 4. nothing to adopt --------------------------------------- */
{
  const r = adoptedCartFor(false, [], [item('Cement')]);
  eq(names(r.rows), 'Cement', 'choosing a client with an empty basket in hand leaves theirs alone');
  eq(r.adopted, 0, 'and reports nothing moved, so nothing is said about it');
  eq(names(adoptedCartFor(false, [], []).rows), '', 'and an empty pair stays empty');
  eq(adoptedCartFor(false, null, null).adopted, 0, 'with no rows at all it does not throw');
  eq(names(adoptedCartFor(false, null, null).rows), '', 'and answers with an empty basket');
}

/* ---------- 5. wired into selecting a client -------------------------- */
{
  const sel = extractFunction(src, 'selectClient', 'agent.html');
  /* Read BEFORE anything is swapped, or it is already the wrong basket. */
  t.check(/const hadClient = !!cartKey\(chosenClient\);/.test(sel)
    && /const inHand = hadClient \? \[\] : cart\.slice\(\);/.test(sel),
    'the basket in hand is taken before the swap, which is the only moment it still exists');
  t.check(sel.indexOf('const inHand') < sel.indexOf('activateCartFor(client)'),
    'and before the client\'s own basket replaces it');

  /* Refilled in place. Reassigning `cart` would leave carts[clientId]
     pointing at the old array, so later pushes would land in a basket
     nothing reads -- the same disappearance by another route. */
  t.check(/cart\.length = 0;\s*\r?\n\s*merged\.rows\.forEach\(r=> cart\.push\(r\)\);/.test(sel),
    'the client\'s own array is refilled in place, so carts and cart stay the same object');
  t.check(!/cart = merged\.rows/.test(sel),
    'rather than reassigned, which would quietly detach it from the client it belongs to');

  t.check(/adoptedCartFor\(hadClient, inHand, cart\)/.test(sel),
    'and the decision is the one this file tests, not made again in its own words');
  /* Claimed means claimed. Left in the unnamed basket as well, the same
     items would show under this client AND still waiting for one. */
  t.check(/unnamedCart = \[\];/.test(sel),
    'the unclaimed basket is emptied once its items have an owner');
  t.check(/moved to \$\{client\.name\}/.test(sel) && /which already had \$\{merged\.joined\}/.test(sel),
    'the agent is told what moved, and told when it joined a basket that already had items');
}

/* ---------- 5b. the unclaimed basket survives closing the app --------- */
/*
 * Every OTHER basket is written out under its client's key. One with
 * nobody named has no key, so it was the only basket that did not survive
 * a reload -- the same loss as the bug above, reached by closing the app
 * instead of by choosing a client.
 *
 * The reading side already handled this shape; only the writing side had
 * dropped it.
 */
{
  const save = extractFunction(src, 'saveQuoteDraft', 'agent.html');
  /* stashActiveCart above has just parked whatever is in hand, so the
     unnamed basket is in unnamedCart whichever quote is open. Written
     from there rather than from `cart`, so it is saved the same way while
     the agent is looking at somebody else's quote. */
  t.check(/cart: unnamedCart\.slice\(\),/.test(save),
    'a basket with nobody named yet is written out on its own');
  t.check(/stashActiveCart\(\);/.test(save),
    'after the active basket is parked, which is what puts it there');
  t.check(/carts, chosenClientId: chosenClient \? chosenClient\.id : null/.test(save),
    'while every owned basket is still written under its client');

  const restore = extractFunction(src, 'restoreQuoteDraft', 'agent.html');
  t.check(/if\(Array\.isArray\(draft\.cart\) && draft\.cart\.length && !unnamedCart\.length\)\{/.test(restore),
    'and the reading side puts an unowned basket back where it belongs');
  t.check(/if\(!chosenClient\) cart = unnamedCart;/.test(restore),
    'making it the active one only when nobody was chosen');
  t.check(/Object\.keys\(draft\.carts\)\.forEach/.test(restore),
    'with every client basket restored beside it, so several quotes survive together');
}

/* ---------- 5c. the switcher: which quotes exist, and whose ---------- */
/*
 * "1 other quote in progress" said a quote existed without saying whose,
 * so the only way to reach it was to guess a name into the picker. The
 * switcher lists them by name with what is in each.
 *
 * THE TWO GESTURES ARE NOT THE SAME. Choosing a client from the picker
 * means "these items are for them" and adopts whatever is in hand.
 * Tapping a tab means "show me theirs" and must adopt nothing -- parking
 * what is in hand instead, which is why the unnamed basket now has
 * somewhere to be parked.
 */
{
  const sum = (new Function(
    extractFunction(src, 'quoteBasketSummaries', 'agent.html') + '\nreturn quoteBasketSummaries;'))();
  const clients = [{ id: 'C1', name: 'Sarah' }, { id: 'C2', name: 'Musa' }];
  const held = { C1: [1, 2, 3], C2: [1], C3: [] };

  const open = sum(clients, held, 'C1', []);
  t.check(open.map((b) => b.name).join(',') === 'Sarah,Musa',
    'every quote in progress is listed by the client it is for');
  t.check(open[0].active && open[0].count === 3,
    'the one being worked on comes first, with what is in it');
  t.check(open.every((b) => b.count > 0),
    'and a client whose basket is empty is not listed as having a quote');

  const loose = sum(clients, held, null, [1, 1]);
  t.check(loose[0].unnamed && loose[0].name === 'Not yet named' && loose[0].active,
    'a basket nobody has claimed is listed too, as the one in hand');
  t.check(loose.filter((b) => b.unnamed).length === 1,
    'exactly once, since there is only ever one of it');
  t.check(sum(clients, held, 'C1', []).every((b) => !b.unnamed),
    'and not at all when there is nothing waiting to be claimed');

  /* A basket parked for a client whose record has since gone is still
     listed. One you cannot see is one you cannot empty, and it would
     count against the total for ever. */
  const orphan = sum(clients, { C9: [1] }, null, []);
  t.check(orphan.length === 1 && orphan[0].missing,
    'a basket whose client is no longer on file is still reachable');

  const render = extractFunction(src, 'renderSellClientChip', 'agent.html');
  t.check(/baskets\.length > 1 \?/.test(render),
    'the switcher appears only when there is more than one quote to move between');
  /* The line that matters: switching parks and swaps, and never calls
     selectClient, which would adopt what is in hand. */
  t.check(render.includes("stashActiveCart();")
    && render.includes("chosenClient = client;") && render.includes("activateCartFor(client);"),
    'tapping a tab parks what is in hand and swaps in theirs');
  t.check(!/selectClient\(client\)/.test(render),
    'and does not go through selectClient, which would claim the loose items for them');
  /* BOTH branches park first — the client one and the unnamed one. Either
     alone would still let a basket be dropped on the way out. */
  t.check((render.match(/stashActiveCart\(\);/g) || []).length === 2,
    'and every branch of the switcher parks what is in hand before swapping');
  t.check(/showQuoteFor\(client\)/.test(render) && /showQuoteUnassigned\(\)/.test(render),
    'reusing the same chip rendering as choosing a client, so the two cannot disagree');
}

/* ---------- 5d. submitting one order leaves the others alone --------- */
{
  const reset = extractFunction(src, 'resetCartAfterSubmit', 'agent.html');
  /* `cart = []` here would leave the active basket detached from the
     unclaimed one, and the next park would write that empty array over
     whatever was still waiting to be claimed. */
  t.check(/activateCartFor\(null\);/.test(reset),
    'after submitting, the unclaimed basket is handed back rather than a fresh empty array');
  t.check(!/\bcart = \[\];/.test(reset),
    'so sending one client\'s order cannot quietly empty a basket belonging to nobody');
  t.check(/const k = cartKey\(chosenClient\);\s*\r?\n\s*if\(k\) delete carts\[k\];/.test(reset),
    'while the basket that was actually sent is the only one discarded');
}

/* ---------- 6. the nudge, which is a statement not a barrier ---------- */
{
  const tab = extractFunction(src, 'renderCartTab', 'agent.html');
  t.check(/const unassigned = hasItems && !chosenClient;/.test(tab),
    'the note shows only when there are items and nobody named for them');
  t.check(/will follow whoever you pick/.test(tab),
    'and says the items are safe, which is now true and is the reassuring half');
  t.check(/You will need one before sending this quote/.test(tab),
    'as well as why a client is wanted, which is the encouraging half');
  /* Submitting has always required a client. The note tells you that up
     front instead of at the last step. */
  t.check(/if\(!chosenClient\)\{ toast\('Choose or add a client first'\); return; \}/.test(src),
    'and the send button still requires one, so the note is describing a real rule');
}

process.exit(t.done() ? 1 : 0);
