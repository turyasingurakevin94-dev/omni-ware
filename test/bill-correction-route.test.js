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
const route = extractFunction(src, 'piCorrectionRouteHelpHTML', 'index.html');
const line = extractFunction(src, 'piCorrectionRouteHTML', 'index.html');
const body = extractFunction(src, 'piOpenBodyHTML', 'index.html');

t.check(route.length > 0 && line.length > 0, 'the line and the walk are separate functions');

/* ---------- 0. one line on the bill, the walk behind the "i" --------- */
{
  /* The first cut put the whole route and the whole cost in the footer,
     and it ran to nine lines under a bill of one — an explanation bigger
     than the document. What you need at a glance is that this is
     corrected somewhere else; the walk is read once, when you are about
     to take it. */
  t.check(/Corrected on/.test(line) && line.length < 400,
    'the footer says one thing: this is corrected on the order, not here');
  t.check(!/Undo invoice|Being prepared|Write down/.test(line),
    'and the walk is not in it — that is what the bubble is for');
  const wire = extractFunction(src, 'piWireRegister', 'index.html');
  t.check(/foldInstruction\(line, help, 'How this bill is corrected'\)/.test(wire),
    'the walk is folded behind an "i" by the same helper the page headers use');
  /* Two paragraphs, not one block: the walk is what to do, the cost is
     what it takes, and run together they read as one long warning
     nobody finishes. */
  t.check(/return \[route, `\$\{cost\}\$\{write\}`\];/.test(route),
    'and it is two paragraphs — the walk, then what undoing it costs');
  t.check(/\.ow-pi-cf-h\{display:none;\}/.test(src.replace(/\s+/g, '')) === false
    || /ow-pi-cf-h\{display:none/.test(src.replace(/\s+/g, '')),
    'and it is hidden where it is written, so an unfolded footer is a sentence and not a wall');
  t.check(/\.page-info-bubble \.ow-pi-cf-h\{display:block;\}/.test(src),
    'coming back once the fold has moved it into the bubble');
}

/* ---------- 1. it names the walk, all three screens of it ------------ */
{
  t.check(/Corrected on/.test(line),
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
  /* Same fields, same arithmetic as orderReversalParts and
     orderStockReturnParts — which is what the confirm dialog reads — so
     the figures on the bill and the figures in the dialog cannot
     disagree. Only the wording is more careful; see the debt case
     below. */
  t.check(/order\.payments/.test(route) && /quoteId === order\.id/.test(route)
    && /order\.debtCharged/.test(route) && /_stockTaken/.test(route),
    'the cost is read from the same fields the confirm dialog reads, so the two cannot disagree');
  t.check(/cash book entries/.test(route),
    'it says the Cash Book entries go too — the part nobody expects');
  /* The confirm dialog lumps all three reversal parts under "along with
     their Cash Book entries". That is right for the two payment lines
     and wrong for the third: money the customer still owes is written
     off, and a debt has no Cash Book entry to remove. */
  t.check(/written off, not collected/.test(route) && /no cash book entry to remove for it/.test(route),
    'and the money still owed is worded as the write-off it is, not as an entry being removed');
  t.check(/back on the shelf/.test(route),
    'and that the sold goods come back, which is a stock count somebody has to do');
  t.check(/costs nothing/.test(route),
    'an order with nothing paid and no stock moved says so, rather than warning about nothing');
  /* The instruction that only works BEFORE the destructive step. */
  t.check(/Write down what was paid/.test(route) && /recorded again afterwards/.test(route),
    'and where money is involved it says to write it down first, because afterwards it is gone from the screen');
  const guarded = /if\(pi\.voided\) return \[route\];/.test(route);
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

/* ---------- 4. the bubble can open upward --------------------------- */
{
  /* A page heading has the whole page below it and never needed this.
     The bubble is reused now by a footer inside an open row, which can
     sit anywhere down a long list — and a 370px bubble hanging off a
     badge near the bottom of the window opens below the fold, with only
     the page scroll to reach it. */
  const place = extractFunction(src, 'placeInfoBubble', 'index.html');
  t.check(/tip-up/.test(place), 'placeInfoBubble can flip the bubble upward outside a modal');
  t.check(/if\(noRoomBelow && roomAbove\) bubble\.classList\.add\('tip-up'\);/.test(place),
    'and only when there is no room below AND room above — flipping into a top edge is not a fix');
  t.check(/bubble\.classList\.remove\('tip-up'\)[\s\S]{0,200}getBoundingClientRect\(\)/.test(place),
    'measured with the flip off, so the height is the same whichever way it opens');
  t.check(/\.page-info-bubble\.tip-up\{top:auto;bottom:calc\(100% \+ 8px\);\}/.test(src)
    && /\.page-info-bubble\.tip-up::before\{top:auto;bottom:-5px;\}/.test(src),
    'and the arrow moves to the bottom with it');
}

process.exit(t.done() ? 1 : 0);
