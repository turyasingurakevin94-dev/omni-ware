#!/usr/bin/env node
'use strict';
/*
 * Add New Quote -- the number a rep says out loud.
 *
 * This page exists so somebody on a phone call can give a client a price.
 * The rightmost column of its table was headed "Line total" and the row
 * under the table was headed "Grand total", and BOTH held the shop's
 * COST rather than the client's price.
 *
 * Measured on the running app, three lines at a 25% retail markup:
 *
 *   line 1   100 bags   client 3,625,000    the row said 2,900,000
 *   line 2    20 sheets client 1,050,000    the row said   840,000
 *   line 3    15 kg     client   131,250    the row said   105,000
 *   ------------------------------------------------------------
 *   "Grand total"                3,845,000
 *   what the client actually owed 4,806,250
 *
 * And every document the client receives was already right: the printed
 * quotation, the client copy and the WhatsApp message all total the sell
 * price. So a rep read 3,845,000 off the screen, said it down the phone,
 * and then handed over a document saying 4,806,250 -- under-quoting by
 * 961,250, which is the entire margin on the job.
 *
 * These checks hold the screen to the documents. The arithmetic is the
 * one the client-facing outputs already use: qty x quoteItemSellPrice.
 *
 * Run: node test/quote-totals.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('quote totals');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const items = extractFunction(src, 'renderQuoteItems', 'index.html');
const bar = extractFunction(src, 'renderQuoteFinbar', 'index.html');
const clientPrint = (/q_print_quote_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
const whatsapp = (/q_whatsapp_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
const supplierPrint = (/q_print_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];

/* ---------- 1. the two totals are named apart ------------------------ */
{
  t.check(/const lineCost = qty \* buy;/.test(items) && /const lineSell = qty \* sell;/.test(items),
    'a line has a cost and a price and they are worked out separately');
  t.check(/grandBuy \+= lineCost;/.test(items) && /grandSell \+= lineSell;/.test(items),
    'and each rolls into its own total');
  /* The bug in one assertion: nothing may put the cost in the column the
     client's money belongs in. */
  t.check(!/q-line-total price">\$\{fmtUGX\(lineCost\)\}/.test(items),
    'the line total column never carries the cost');
  t.check(/q-line-total price">\$\{fmtUGX\(lineSell\)\}/.test(items),
    'it carries what the line adds to the client’s bill');
}

/* ---------- 2. the screen agrees with what the client is handed ------ *
 * The documents were never wrong. The screen was.
 */
{
  const sellSum = /\.reduce\(\(s,it\)=> s \+ \(Number\(it\.qty\)\|\|0\)\*quoteItemSellPrice\(it\), 0\)/;
  t.check(sellSum.test(clientPrint), 'the printed quotation totals the sell price');
  t.check(sellSum.test(whatsapp), 'so does the WhatsApp message');
  /* The screen must reach the same figure by the same arithmetic. It does
     it a line at a time -- sell comes from quoteItemSellPrice, lineSell is
     qty times it, grandSell is their sum -- which is the same sum. */
  t.check(/const sell = quoteItemSellPrice\(it\);/.test(items),
    'and the screen prices every line through the same function');
  t.check(/The client pays<\/td>[\s\S]{0,120}?\$\{fmtUGX\(grandSell\)\}/.test(items),
    'so the table foots with what the client pays, not what the shop paid');
  t.check(!/Grand total<\/td>[\s\S]{0,120}?\$\{fmtUGX\(grandBuy\)\}/.test(items),
    'and never again puts the cost under the words a rep says out loud');
}

/* ---------- 3. the shop's side is still there, and still marked ------ *
 * Removing the cost would have been the wrong fix: a rep needs to know
 * the job is profitable before agreeing a price. It just must not be
 * mistakable for the price.
 */
{
  t.check(/Costs you<\/td>[\s\S]{0,120}?\$\{fmtUGX\(grandBuy\)\}/.test(items),
    'the cost is still on the page, named as the shop’s');
  t.check(/You keep<\/td>[\s\S]{0,160}?\$\{fmtUGX\(profit\)\}/.test(items),
    'and so is what is left over');
  /* A rule between the client's columns and the shop's, so no cost
     figure sits in the run of client figures. */
  t.check(/<th class="q-shop-first q-supplier-th">Supplier<\/th>/.test(items),
    'the shop’s columns start behind a divider');
  t.check(/\.qp-items-table-wrap th\.q-shop-first, \.qp-items-table-wrap td\.q-shop-first\{[\s\S]{0,80}?border-left:/.test(src),
    'which is a real rule, not just a class name');
  t.check(/<td class="q-shop-first">\$\{supplierPickerHTML\}<\/td>/.test(items),
    'and every row honours it');

  // The supplier copy is the shop's own document and must keep the cost.
  t.check(/it\.price/.test(supplierPrint) && !/quoteItemSellPrice/.test(supplierPrint),
    'while the supplier copy, which is internal, still prints what the shop pays');
}

/* ---------- 4. the client's figure leads ----------------------------- */
{
  t.check(/Client pays<\/div>/.test(bar), 'the summary opens with the client’s figure');
  t.check(/qp-says-value">\$\{fmtUGX\(grandSell\)\}/.test(bar), 'and that figure is the sell total');
  /* It used to be one of four equal cells labelled "Total sell" -- the
     jargon on a screen whose whole job is a sentence somebody speaks. */
  // Against what RENDERS: the comment recording why it changed quotes the
  // old label, and should.
  t.check(!/qp-finbar-label">Total sell/.test(code) && !/qp-finbar-cell/.test(bar),
    'not one of four equal cells labelled in jargon');
  /* "You keep" stays on the bar; "Costs you" deliberately does not any
     more. The bar is glanced at mid-call -- pays and keeps are the two
     numbers that decision needs, the cost is derivable, and the full
     three-line account still lives in the table footer above (section 2
     pins it there). */
  t.check(/You keep <b/.test(bar), 'with what the shop keeps under it, quieter');
  /* Checked against the TEMPLATE, not the whole function -- the comment
     explaining why "Costs you" left quotes the phrase, and should. */
  t.check(!/Costs you <b>/.test(bar),
    'and no third figure — the bar is a glance, the footer is the account');
  /* The finbar used to sit ABOVE the items so the total stayed on
     screen; the real fix is stronger — the whole summary now rides a
     bar fixed to the viewport bottom (#q_stickybar), fused with the
     quote's actions, so it can NEVER scroll away however long the quote
     grows. The items panel therefore no longer contains it. */
  t.check(/<div class="q-stickybar" id="q_stickybar">\s*<div class="qp-finbar" id="q_finbar">/.test(src),
    'the summary rides the sticky bar at the viewport bottom');
  const panel = (/<div class="panel qp-panel qp-items-panel">[\s\S]*?<\/div>\n        <\/div>/.exec(src) || [''])[0];
  t.check(!/id="q_finbar"/.test(panel),
    'and is out of the items panel entirely — pinned to the screen, not to a scroll position');
  t.check(/body\.on-quote-tab \.q-stickybar\{display:flex;\}/.test(src),
    'shown only while the quote tab is, since fixed position ignores tab visibility');
  t.check(/body\.on-quote-tab \.quote-layout\{padding-bottom:86px;\}/.test(src),
    'while the document reserves the bar’s height so the last row is never buried under it');
}

/* ---------- 5. the mobile card says the same thing ------------------- *
 * Most of a shop's phone calls are taken on a phone.
 */
{
  const card = (/cardsArr\.push\(`[\s\S]*?`\);/.exec(items) || [''])[0];
  t.check(/q-line-total price" title="What this line adds to the client's bill">\$\{fmtUGX\(lineSell\)\}/.test(card),
    'the card carries the client’s line total, like the row');
  t.check(!/fmtUGX\(lineCost\)/.test(card), 'and not the cost');
}

/* ---------- 6. the words match the document -------------------------- *
 * The printed quotation's own column heading is "Price each". The screen
 * called the same figure "Sell @", so a rep reading one and a client
 * reading the other were looking at differently-named things.
 */
{
  t.check(/<th>Price each<\/th>/.test(items), 'the screen calls it what the quotation calls it');
  t.check(/<th>Price each<\/th>/.test(clientPrint), 'which is what the quotation calls it');
  t.check(!/<th>Sell @<\/th>/.test(items), 'rather than the shop’s own word for it');
}

process.exit(t.done() ? 1 : 0);
