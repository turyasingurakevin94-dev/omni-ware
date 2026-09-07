#!/usr/bin/env node
'use strict';
/*
 * "I ordered the wrong quantity four days ago. How do I edit the bill?"
 *
 * You don't, and that is deliberate: a purchase invoice raised from a
 * customer's order is GENERATED from that order, never typed, so the
 * order is the truth and the bill follows it. applyPurchaseBillEdit
 * refuses one outright for exactly that reason.
 *
 * What was missing was the sentence. Standing on the bill, the slot
 * where a standalone bill offers "Correct it" was filled with "Open
 * INV-0307" — where you go, but not what you came to do — and the only
 * explanation of the real route was a toast you could get by pressing a
 * button that is not there. A screen that cannot do a thing must say
 * where the thing is done; an absent control reads as "this cannot be
 * changed" rather than "it is changed over there".
 *
 * And the route has a destructive step in the middle. Undoing the
 * invoice reverses the customer's payments and the supplier's, with
 * their Cash Book entries, and puts the sold goods back on the shelf.
 * Somebody four days in needs that figure BEFORE they start, because
 * afterwards the screen that held it no longer does.
 *
 * So the cost is read from the same two functions the confirm dialog
 * uses. What the bill promises and what the dialog says cannot drift.
 *
 * Run: node test/bill-correction-route.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('bill correction route');
const src = read('index.html');
const route = extractFunction(src, 'piCorrectionRouteHTML', 'index.html');
const body = extractFunction(src, 'piOpenBodyHTML', 'index.html');

t.check(route.length > 0, 'the route exists as its own function');

/* ---------- 1. it names the walk, all three screens of it ------------ */
{
  t.check(/corrected there rather than here/.test(route),
    'it says the correction is made on the order, not on this screen');
  t.check(/Undo invoice/.test(route) && /invoice it again/.test(route),
    'and names the two ends of the move, so it is a route and not a refusal');
  /* The button beside the note lands on the Invoices register with the
     order searched, and Undo invoice lives on that row. Naming the
     screen without naming the tap is how a route sends somebody to the
     right place and leaves them there. */
  t.check(/lands on its row in Invoices/.test(route) && /Order tracking/.test(route),
    'and names the actual next tap, not just a screen');
  t.check(/quantity, item or supplier/.test(route),
    'naming all three of the things that go wrong when an order is placed');
  /* The supplier case is the one somebody assumes cannot be fixed,
     because the bill is addressed to the wrong shop. Re-invoicing
     regroups the lines by supplier, so it is the same move. */
  t.check(/wrong supplier is put right by the same move/.test(route),
    'and saying so, since a bill addressed to the wrong supplier looks unfixable');
  /* Correcting what was RECEIVED is a different door again: the receipt
     is undone on the buying list, which only carries orders still being
     prepared. Without this the walk dead-ends. */
  t.check(/step the order back/.test(route) && /What to buy/.test(route),
    'and the receipt has its own door, which is behind a backward step');
}

/* ---------- 2. the cost is this bill's own, and matches the dialog --- */
{
  t.check(/orderReversalParts\(/.test(route) && /orderStockReturnParts\(/.test(route),
    'the cost is read from the same two functions the confirm dialog uses, so the two cannot disagree');
  t.check(/cash book entries/.test(route),
    'it says the Cash Book entries go too — the part nobody expects');
  t.check(/back on the shelf/.test(route),
    'and that the sold goods come back, which is a stock count somebody has to do');
  t.check(/costs nothing/.test(route),
    'an order with nothing paid and no stock moved says so, rather than warning about nothing');
  /* The instruction that only works BEFORE the destructive step. */
  t.check(/Write down what was paid/.test(route) && /recorded again afterwards/.test(route),
    'and where money is involved it says to write it down first, because afterwards it is gone from the screen');
  const guarded = /if\(pi\.voided\) return route;/.test(route);
  t.check(guarded, 'a voided bill gets the route without a cost — there is nothing left to reverse');
}

/* ---------- 3. the control is in the slot the eye looks in ----------- */
{
  t.check(/Correct on \$\{esc\(invoiceNumberLabel\(linkedOrder\)\)\}|'Correct on'/.test(body)
    || /Correct on/.test(body),
    'the order-linked bill offers "Correct on INV-…" where a standalone bill offers "Correct it"');
  t.check(/pi\.voided \? 'Open' : 'Correct on'/.test(body),
    'and a voided bill is only a door, since it has nothing to correct');
  t.check(/corrections are made on the order and the bill is raised again from it/.test(body),
    'the button carries the reason, so pressing it is not a leap of faith');
  /* The refusal on the other side has to keep agreeing with this. */
  const edit = extractFunction(src, 'applyPurchaseBillEdit', 'index.html');
  t.check(/if\(pi\.quoteId\) return \{ok: false/.test(edit),
    "and the bill still cannot be edited here — the route would be a lie if it could");
}

process.exit(t.done() ? 1 : 0);
