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
  /* WAS: each document had to be caught totalling the SELL with its own
     inline reduce, because the screen had been caught totalling the cost.
     Both documents now draw the figure from savedQuoteTotal instead --
     the app's one answer to what this order comes to, goods and charges
     together -- so what is pinned is stronger than it was: not that each
     has the right arithmetic, but that neither has arithmetic of its own
     to get wrong. A hand-rolled sum reappearing in either is the old bug
     growing back. */
  const ownSum = /\.reduce\(\(s,it\)=> s \+ \(Number\(it\.qty\)\|\|0\)\*quoteItemSellPrice\(it\), 0\)/;
  t.check(/const grand = savedQuoteTotal\(data\.quote\);/.test(clientPrint) && !ownSum.test(clientPrint),
    'the printed quotation totals through the app’s one total, not its own');
  t.check(/const grand = savedQuoteTotal\(data\.quote\);/.test(whatsapp) && !ownSum.test(whatsapp),
    'so does the WhatsApp message');
  /* And both NAME the charges rather than burying them in a total that is
     bigger than the lines above it. */
  t.check(/orderBillLines\(data\.quote\)/.test(clientPrint) && /orderBillLines\(data\.quote\)/.test(whatsapp),
    'and each prints what every line on the bill is for, not just a larger total');
  /* The screen must reach the same figure by the same arithmetic. It does
     it a line at a time -- sell comes from quoteItemSellPrice, lineSell is
     qty times it, grandSell is their sum -- which is the same sum. */
  t.check(/const sell = quoteItemSellPrice\(it\);/.test(items),
    'and the screen prices every line through the same function');
  /* paysTotal is grandSell plus the charges and the credit, and it is
     handed to the bar whole: the words "Client pays" must sit over the
     WHOLE bill, or a rep goes to the door with a figure the invoice
     will not match. The table has no foot of its own any more -- the
     bar is the one place the arithmetic is stated. */
  t.check(/const paysTotal = cashTotal \+ creditCharge;/.test(items)
    && /renderQuoteFinbar\(grandBuy, grandSell, profit, chargesTotal, creditCharge\);/.test(items),
    'so the bar is handed the whole bill, not what the shop paid and not the goods alone');
  t.check(!/ow-tbl-f/.test(items),
    'and the table has no foot — the arithmetic is stated once, on the bar');
  /* THE TWO PRICES ARE TWO NAMED FIGURES, not one and a subtraction. The
     rep says both out loud at the counter, and a cash price the screen
     never states is one the screen cannot be read for. */
  t.check(/const cashTotal = grandSell \+ chargesTotal;/.test(items),
    'and what it comes to if they pay now is worked out on its own, so both prices are on the screen');
  t.check(!/Grand total<\/(?:td|div)>[\s\S]{0,120}?\$\{fmtUGX\(grandBuy\)\}/.test(items),
    'and never again puts the cost under the words a rep says out loud');
}

/* ---------- 3. the shop's side is still there, and still marked ------ *
 * Removing the cost would have been the wrong fix: a rep needs to know
 * the job is profitable before agreeing a price. It just must not be
 * mistakable for the price.
 */
{
  t.check(/Costs you<\/div>\s*<div class="qp-cost-v">\$\{fmtUGX\(grandBuy\)\}/.test(bar),
    'the cost is still on the page, on the bar, named as the shop’s');
  /* The label gained a qualifier once charges existed -- "You keep on the
     items" -- because what a delivery costs the shop is not known until
     somebody records it, and counting an uncosted one as kept would read
     as pure profit. The figure is still profit and still there. */
  t.check(/You keep\$\{charges > 0 \|\| credit > 0 \? ' on the items' : ''\}<\/div>[\s\S]{0,200}?\$\{fmtUGX\(profit\)\}/.test(bar),
    'and so is what is left over, said to be about the items once it is only about them');
  /* A rule between the client's columns and the shop's, so no cost
     figure sits in the run of client figures.

     WAS: `border-left` on .q-shop-first, checked on the header cell,
     every row and both document rows. The rule is still there and still
     asserted -- but it is a GRID TRACK now, not a border on a cell, and
     that is the point of the change rather than an incidental rewrite.
     A border belongs to the cell that carries it, so the divider said
     "the supplier column is different"; the document actually has two
     SIDES -- five columns the client is buying against, three the shop
     is buying on -- and a 1px track between them belongs to neither and
     runs the full height of the row. The handoff draws it that way.

     So: the track exists in the column definition, and every row that
     spans the document emits a cell for it. A row that skipped it would
     not merely lose a line, it would shift every cell after it one
     column to the left, which is the failure this now catches and the
     border version could not. */
  t.check(/--ow-tbl-cols:[^;]*\b1px\b/.test(src),
    'the shop’s columns start behind a divider, and it is a track of its own');
  t.check(/\.q-doc \.q-tbl-rule\{[\s\S]{0,160}?background:/.test(src),
    'which is a real rule, not just a class name');
  const ruleCells = (t2) => (t2.match(/class="q-tbl-rule"/g) || []).length;
  t.check(/<div class="ow-tbl-c q-shop-first">Buy from<\/div>/.test(items)
    && ruleCells(items) === 2,
    'and the header and every line honour it (header + row = ' + ruleCells(items) + ')');
  /* The divider runs the length of the document: the header, every
     line, every charge, and the credit row. The foot that used to carry
     it is gone, so the document ends at the add row and the rule ends
     with it. */
  t.check(ruleCells(extractFunction(src, 'chargeRowsHTML', 'index.html')) === 1
    && ruleCells(extractFunction(src, 'creditRowHTML', 'index.html')) === 1,
    'and a charge and the credit row carry the divider too, so the rule runs the length of the document');

  // The supplier copy is the shop's own document and must keep the cost.
  t.check(/it\.price/.test(supplierPrint) && !/quoteItemSellPrice/.test(supplierPrint),
    'while the supplier copy, which is internal, still prints what the shop pays');
}

/* ---------- 4. the client's figure leads ----------------------------- */
{
  /* The label carries the line count on the phone, in a span the console does not draw. */
  t.check(/Client pays<span class="qp-says-n">/.test(bar), 'the summary opens with the client’s figure');
  /* pays = grandSell + charges. The bar is read out mid-call, so it is
     the one place the figure must be the whole bill. */
  t.check(/qp-says-value\$\{empty \? ' quiet' : ''\}">\$\{fmtUGX\(pays\)\}/.test(bar) && /const pays = grandSell \+ charges \+ credit;/.test(bar),
    'and that figure is the whole bill — goods, charges and the price of waiting');
  /* It used to be one of four equal cells labelled "Total sell" -- the
     jargon on a screen whose whole job is a sentence somebody speaks. */
  // Against what RENDERS: the comment recording why it changed quotes the
  // old label, and should.
  t.check(!/qp-finbar-label">Total sell/.test(code) && !/qp-finbar-cell/.test(bar),
    'not one of four equal cells labelled in jargon');
  /* THE BAR IS THE ACCOUNT. "Costs you" is back beside "You keep": the
     table lost its foot, so the bar is the one place the three figures
     are stated, ruled off from each other and the shop's two at a size
     the client across the counter cannot read. */
  t.check(/You keep\$\{charges > 0 \|\| credit > 0 \? ' on the items' : ''\}<\/div>/.test(bar),
    'with what the shop keeps beside it, quieter, and said to be about the items when a charge is uncosted beside it');
  t.check(/<div class="qp-cost">[\s\S]{0,200}?Costs you<\/div>/.test(bar),
    'and the cost, as its own figure — the bar is the account now, not a glance at half of one');
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
  t.check(/body\.on-quote-tab #tab-quote\{padding-bottom:86px;\}/.test(src),
    'while the document reserves the bar’s height so the last row is never buried under it');

  /* AN EMPTY QUOTE IS NOT A LOSING ONE. With nothing on it every figure
     is zero, and `grandSell<=0 || profit<=0` scored that as danger --
     painting a red 0% across the bottom of a form nobody had started.
     Red is this app's grammar for something being wrong, and the only
     thing wrong was that the rep had opened the screen.

     The distinction is bought and sold BOTH being nothing. A quote that
     has been priced and still keeps nothing is a real warning and must
     stay red: that is the case this bar exists to catch. */
  /* A quote carrying only a charge is not empty either, so the third
     term joins the other two rather than replacing them. */
  t.check(/const empty = grandSell <= 0 && grandBuy <= 0 && charges <= 0 && credit <= 0;/.test(bar),
    'an empty quote is told apart from a losing one by nothing being bought, sold, charged or lent');
  t.check(/if\(empty\) pillClass = 'quiet';/.test(bar),
    'and reads as no reading rather than as a loss');
  t.check(/else if\(grandSell<=0 \|\| profit<=0\) pillClass = 'danger';/.test(bar),
    'while a priced quote that keeps nothing is still red — the warning is not disarmed');
  t.check(/\.qp-margin-pill-lg\.quiet\{background:var\(--ow-steel-050\);color:var\(--ink-soft\);\}/.test(src),
    'the quiet pill is grey, not a colour that means anything');
  /* "You keep 0" goes grey with the pill rather than reporting zero in
     profit-green. It used to say so in an inline colour of its own,
     which meant the figure and the pill were worked out separately —
     and they disagreed: the pill had four readings and the figure had
     two, so a quote keeping 6% showed an amber pill beside a green
     figure. The figure now takes the pill's own class, so grey on an
     empty quote is the SAME decision as the grey pill rather than a
     second one that happens to match. */
  t.check(/<div class="qp-keep-v"><b class="\$\{pillClass\}">\$\{fmtUGX\(profit\)\}<\/b>/.test(bar),
    'and the keep figure takes the pill’s reading rather than working out a second one');
  t.check(/\.qp-shopline b\.quiet\{color:var\(--ink-soft\);\}/.test(src),
    'so "You keep 0" goes grey with it rather than reporting zero in profit-green');
  t.check(/\.qp-shopline b\.warn\{color:var\(--warn-ink\);\}/.test(src),
    'and a thin margin now shows on the figure too, which is the disagreement this ended');
}

/* ---------- 5. the phone says the same thing, because it is the same row *
 * Most of a shop's phone calls are taken on a phone. There used to be a
 * second template here -- a .qc-card pushed onto cardsArr beside each
 * <tr> -- and this section held the two to the same figure. Now there
 * is one row: each cell carries its column name as data-l, and the
 * layer's phone block turns that row into the card. Two templates can
 * disagree; one cannot.
 */
{
  t.check(!/cardsArr/.test(items) && !/qp-items-cards/.test(items),
    'there is no second template for the phone');
  t.check(/<div data-l="Line total" title="What this line adds to the client's bill" class="ow-tbl-n q-line-total price">\$\{fmtUGX\(lineSell\)\}/.test(items),
    'the one row carries the client’s line total under its column name, which is the phone’s label');
  /* WAS: Qty, Price each, Supplier, Buy @, Margin. Two of those columns
     were renamed to the words the handoff's document uses, and one was
     added. "Supplier" became "Buy from" and "Margin" became "Keep"
     because both of the old words named the shop's RECORD of the thing
     rather than the act: the rep is choosing who to buy from and reading
     what the shop keeps, and those are the words said on the call. Unit
     came out of the quantity cell into a column, so it needs a label
     like any other cell that becomes a line on the card. */
  ['Qty', 'Unit', 'Price each', 'Buy from', 'Buy @', 'Keep'].forEach((l) => {
    t.check(items.includes(`data-l="${l}"`), `and the ${l} cell is labelled for the card`);
  });
  t.check(!/data-l="Supplier"/.test(items) && !/data-l="Margin"/.test(items),
    'and the two words the document does not use are gone from the row');
  t.check(!/fmtUGX\(lineCost\)/.test(items), 'and the cost is never printed on a line');
}

/* ---------- 6. the words match the document -------------------------- *
 * The printed quotation's own column heading is "Price each". The screen
 * called the same figure "Sell @", so a rep reading one and a client
 * reading the other were looking at differently-named things.
 */
{
  t.check(/<div class="ow-tbl-n">Price each<\/div>/.test(items), 'the screen calls it what the quotation calls it');
  t.check(/<th>Price each<\/th>/.test(clientPrint), 'which is what the quotation calls it');
  t.check(!/>Sell @</.test(items), 'rather than the shop’s own word for it');
}

process.exit(t.done() ? 1 : 0);
