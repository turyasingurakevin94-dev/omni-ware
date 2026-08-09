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
  t.check(/cart: chosenClient \? \[\] : cart\.slice\(\),/.test(save),
    'a basket with nobody named yet is written out on its own');
  /* Empty once a client is chosen: from then on it lives in `carts`, and
     writing it in both places would restore it in both places. */
  t.check(/chosenClient \? \[\]/.test(save),
    'and not written twice once it has an owner, which would double it on restore');
  t.check(/carts, chosenClientId: chosenClient \? chosenClient\.id : null/.test(save),
    'while every owned basket is still written under its client');

  const restore = extractFunction(src, 'restoreQuoteDraft', 'agent.html');
  t.check(/\} else if\(Array\.isArray\(draft\.cart\) && draft\.cart\.length\)\{/.test(restore),
    'and the reading side puts an unowned basket back in hand');
  t.check(/Object\.keys\(draft\.carts\)\.forEach/.test(restore),
    'with every client basket restored beside it, so several quotes survive together');
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
