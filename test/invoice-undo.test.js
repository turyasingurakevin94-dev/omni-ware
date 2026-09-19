#!/usr/bin/env node
'use strict';
/*
 * Undoing an invoice from the register.
 *
 * The shop asked the question that found this: "is it possible to edit an
 * invoice in case I realise after 3 days that I wrote the wrong quantity
 * of supplier or product?"
 *
 * The answer was no, and not for a good reason. Editing an invoiced order
 * is refused on purpose -- loadSavedQuote() says so outright, because each
 * line remembers what it took off the shelf in _stockTaken and a changed
 * quantity leaves that describing a deduction that no longer matches,
 * while the total moves out from under payments already recorded. The way
 * in was always to undo the invoice first, which reverses stock, payments,
 * their Cash Book entries and the purchase invoices together.
 *
 * But that control lived ONLY on the Order tracking board, and an invoiced
 * order leaves that board a day after invoicing (SQ_BOARD_HIDE_AFTER_MS).
 * On the third day there was no way in at all. The one act left on the
 * Invoices screen was Void -- which cancels the sale rather than
 * correcting it, and a cancelled-and-rewritten sale is not the same
 * document to anyone reading the books later.
 *
 * So the act moved to where the document actually lives. What this file
 * holds:
 *
 *   ONE reversal, not two. The row calls the same toggleQuoteInvoiced()
 *   the board calls. A second way of undoing an invoice is how two paths
 *   come to reverse different things -- which is exactly the fault
 *   admin-bulk-void.test.js was written for on the voiding side.
 *
 *   VOID AND UNDO ARE DIFFERENT ACTS and the screen must not blur them.
 *   Void cancels the paper and keeps the money in the Cash Book; undo says
 *   the invoice should never have existed. A voided document is offered
 *   Unvoid, never Undo.
 *
 *   THE REDRAW KEEPS THE SEARCH. Bare renderInvoices() was harmless while
 *   this was only ever reached from the board; from the register it is a
 *   screen wiping the search that found the row you just acted on.
 *
 * Run: node test/invoice-undo.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('invoice undo');
const src = read('index.html');
const render = extractFunction(src, 'renderInvoices', 'index.html');
const toggle = extractFunction(src, 'toggleQuoteInvoiced', 'index.html');
const bind = extractFunction(src, 'invBindDocActions', 'index.html');

/* ---------- 1. the act is on the row, and it is the same act ---------- */
{
  t.check(/inv-doc-unbill/.test(render),
    'the register\'s row carries an undo-invoice control');
  /* The BINDING moved to invBindDocActions when the paired lens arrived
     -- both lenses draw this row, and a second copy of the wiring is
     exactly how one lens comes to reverse what the other only prints.
     The button is still emitted by renderInvoices (checked above); this
     asks the same question of the one place that now binds it. */
  t.check(/\.inv-doc-unbill'\)[\s\S]{0,200}toggleQuoteInvoiced\(Number\(btn\.dataset\.id\)\)/.test(bind),
    'and it calls the same toggleQuoteInvoiced the Order tracking board calls');
  /* Not a private reversal beside the shared one. If this screen ever
     starts putting stock back or removing payments itself, these two
     paths will drift the way voiding once did. */
  ['reverseQuoteStockDeduction', 'removeCashTxnsByIds', 'removePurchaseInvoicesForQuote']
    .forEach((fn) => {
      t.check(!new RegExp(`${fn}\\(`).test(render),
        `renderInvoices does not reverse anything itself — ${fn} stays in the one place that owns it`);
    });
}

/* ---------- 2. a cancelled document is not offered undo -------------- */
{
  /* Void and undo are both "unmake this document" and they sit together
     at the end of the row, so the one case where offering both would be
     incoherent has to be closed: a voided invoice is already cancelled,
     and Unvoid is the act that belongs to it. */
  t.check(/q\.voided \? '' : icon\('inv-doc-unbill'/.test(render),
    'a voided row is offered Unvoid, never Undo invoice');
  t.check(/icon\('inv-doc-void danger'[\s\S]{0,80}q\.voided \? 'Unvoid invoice' : 'Void invoice'/.test(render),
    'and the void control still says which of the two it is about to do');
  /* The tooltip is the only place the difference is spelled out on the
     row itself, so it must name the consequence rather than the verb. */
  t.check(/Undo invoice — puts the stock, the payments and their Cash Book entries back/.test(render),
    'undo names what it puts back, not just that it undoes something');
  t.check(/returns the order to Order tracking so its quantities can be edited/.test(render),
    'and names where the order goes, which is the whole point of pressing it');
}

/* ---------- 3. undoing does not wipe the search that found the row --- */
{
  t.check(/renderInvoices\(document\.getElementById\('inv_doc_search'\) \? document\.getElementById\('inv_doc_search'\)\.value : ''\)/.test(toggle),
    'the redraw reads the search box, the way every other caller does');
  t.check(!/\n\s*renderInvoices\(\);/.test(toggle),
    'and no bare call survives to empty it');
}

/* ---------- 4. the row vanishes, so the toast says where it went ----- */
{
  /* Undone from the board the order is still in front of you. Undone
     from the register the row disappears -- it is not an invoice any
     more -- and a document vanishing with no word about where it has
     gone reads as data lost. */
  t.check(/invoiceNumberLabel\(q\)\} is no longer invoiced/.test(toggle),
    'the toast names the document that just stopped being one');
  t.check(/The order is back on Order tracking, where its quantities can be edited/.test(toggle),
    'and says where to go and what can be done there');
}

/* ---------- 5. the confirmation still names what it removes ---------- */
{
  /* Reaching this from the register does not make it a lighter act: it
     is irreversible, and uninvoiceReversalWarning() is what makes the
     shop's answer an informed one. Pinned here because this file is the
     reason the act became easy to reach. */
  t.check(/const warning = uninvoiceReversalWarning\(q\);[\s\S]{0,80}if\(warning && !confirm\(warning\)\) return;/.test(toggle),
    'undoing still asks first, naming the payments and stock it will reverse');
  const warn = extractFunction(src, 'uninvoiceReversalWarning', 'index.html');
  t.check(/This cannot be undone\. Continue\?/.test(warn),
    'and says plainly that there is no way back from it');
}

process.exit(t.done() ? 1 : 0);
