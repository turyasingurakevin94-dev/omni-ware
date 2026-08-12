#!/usr/bin/env node
'use strict';
/*
 * The Add Quote page as a working document.
 *
 * The page is used live on a phone call. The loop is: search, quantity,
 * SAY A SELL PRICE, next item -- with the shop's own margin visible only
 * to the admin. The old page fought that loop three ways:
 *
 *   - search suggestions showed the cheapest supplier's raw BUY figure,
 *     priming the admin to say their own cost out loud
 *   - the actions were five 60px icon-over-label chips in the panel head
 *     -- app-launcher grammar -- while the total lived a scroll away
 *   - the layout was a form: floating 150px client fields, a 26px total
 *     block ABOVE the items pushing them down
 *
 * Now: a document header band, an inline search whose suggestions quote
 * the recommended SELL price, and a sticky bar at the viewport bottom
 * fusing the totals with the actions. quote-totals.test.js still owns
 * the sell-vs-buy money contract; this file owns the page's shape.
 *
 * Run: node test/quote-page-layout.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('quote page layout');
const src = read('index.html');

/* ---------- 1. suggestions say the sell price, or say why not -------- */
/*
 * Run against fixtures, because the wrong version of this is exactly a
 * string that LOOKS right: quoteSuggestedPrice falls back to the cost
 * silently when no markup rule exists, so asking it (instead of
 * suggestedSellingPrice, which returns null) would put the cost on the
 * call labelled as a sell.
 */
{
  const data = {
    products: [], suppliers: [],
    prices: [
      { id: 1, productId: 'P1', variantIdx: null, supplierId: 'S1', wholesale: 6000, retail: 6250, packQty: 12, unit: 'pc', tiers: [], outOfStock: false },
      { id: 2, productId: 'P2', variantIdx: null, supplierId: 'S1', wholesale: 8000, retail: 8500, packQty: 0, unit: 'pc', tiers: [], outOfStock: false },
    ],
    stock: { P1: 14 },
  };
  const scope = compileScope([
    extractFunction(src, 'productPriceRows', 'index.html'),
    extractFunction(src, 'rankedPriceRows', 'index.html'),
    extractFunction(src, 'effectiveMarkupRule', 'index.html'),
    extractFunction(src, 'suggestedSellingPrice', 'index.html'),
    extractFunction(src, 'stockKey', 'index.html'),
    extractFunction(src, 'getStockQty', 'index.html'),
    extractFunction(src, 'ipSuggestionPriceNote', 'index.html'),
    extractFunction(src, 'ipSuggestionStockNote', 'index.html'),
  ], {
    data,
    supplierName: () => 'Shafik',
    fmtUGXPerUnit: (n, u) => `${Number(n).toLocaleString('en-US')} UGX/${u || 'unit'}`,
  }, ['ipSuggestionPriceNote', 'ipSuggestionStockNote']);

  const ruled = { id: 'P1', name: 'Tape', retailMarkupType: 'percent', retailMarkupValue: 20 };
  const bare = { id: 'P2', name: 'Hinge' };
  const ghost = { id: 'P3', name: 'Ghost' };

  t.check(/ip-price-sell/.test(scope.ipSuggestionPriceNote(ruled, null))
    && /7,500/.test(scope.ipSuggestionPriceNote(ruled, null)),
    'a product with a markup rule quotes its SELL price — 6,250 cost at 20% is 7,500');
  t.check(/>sell</.test(scope.ipSuggestionPriceNote(ruled, null).replace(/<i>/, '>').replace(/<\/i>/, '<')) || /<i>sell<\/i>/.test(scope.ipSuggestionPriceNote(ruled, null)),
    'and says which price it is, since the page also knows costs');
  /* The honest edge: a price on file but no rule to turn it into a sell.
     Shown as a COST in caution colour with the reason, never silently
     relabelled -- that is the exact confusion this redesign removes. */
  const noRule = scope.ipSuggestionPriceNote(bare, null);
  t.check(/ip-price-norule/.test(noRule) && /no markup rule/.test(noRule) && /8,500/.test(noRule),
    'no markup rule: the cost is shown AS a cost, with the reason');
  t.check(!/ip-price-sell/.test(noRule),
    'and never wearing the sell styling');
  t.check(/No price on file/.test(scope.ipSuggestionPriceNote(ghost, null)),
    'no price rows at all still reads as exactly that');

  t.check(/14 in stock/.test(scope.ipSuggestionStockNote(ruled, null)),
    'the row says what the shelf can cover');
  t.check(/out of stock/.test(scope.ipSuggestionStockNote(bare, null)),
    'and when it cannot');
}

/* ---------- 2. the inline search is the front door ------------------- */
{
  t.check(/<div class="q-item-search-wrap">[\s\S]{0,400}?id="q_item_search"/.test(src),
    'a permanent search field sits at the top of the items panel');
  const panel = (/<div class="panel qp-panel qp-items-panel">[\s\S]*?id="q_itemsWrap"/.exec(src) || [''])[0];
  t.check(/q_item_search/.test(panel),
    'above the items, inside the document');
  const wiring = extractFunction(src, 'renderQuoteItemSearchDd', 'index.html');
  t.check(/buildProductSuggestionEntries\(searchTokens\(q\)\)/.test(wiring)
    && /ipSuggestionPriceNote/.test(wiring),
    'its dropdown reuses the picker’s entries and the same sell-price note — one truth, two doors');
  /* Both halves of the Enter path: WHERE the top result comes from and
     what is done with it. Pinning only the pick call let a mutant null
     the querySelector and keep every assertion green while Enter did
     nothing. */
  t.check(/const top = dd\.querySelector\('\.suggestion-item'\);\s*if\(top\) quoteItemSearchPick\(\{ id: top\.dataset\.id/.test(src),
    'Enter takes the top result, because a call does not wait for a mouse');
  const pick = extractFunction(src, 'quoteItemSearchPick', 'index.html');
  t.check(/openModal\('itemPickerModal'\)/.test(pick) && /ipSelectProduct\(sel\.id, sel\.variantIdx\)/.test(pick),
    'and picking hands over to the same picker stage — suppliers, rec prices, cash hint unchanged');
  t.check(/id="q_add_row_btn"|q_add_row_btn/.test(src) && /q_add_card_btn/.test(src),
    'while the + entries stay, so existing muscle memory still works');
}

/* ---------- 3. the sticky bar is the money and the actions ----------- */
{
  const bar = (/<div class="q-stickybar" id="q_stickybar">[\s\S]*?<\/section>/.exec(src) || [''])[0];
  t.check(/id="q_finbar"/.test(bar) && /id="q_save_btn"/.test(bar),
    'totals and Save share the bar — the figure read aloud sits beside the act that follows it');
  t.check(/id="q_print_quote_btn"/.test(bar) && /id="q_whatsapp_btn"/.test(bar),
    'with the frequent outputs one press away');
  t.check(/id="q_more_menu"[\s\S]*?id="q_print_btn"[\s\S]*?id="q_clear_btn"/.test(bar),
    'and the occasional ones — supplier copy, clear — behind the ⋯ menu');
  t.check(/class="qbar-save" id="q_save_btn"/.test(bar),
    'Save is the one filled button; everything else is quiet');
  /* Clear is destructive mid-call: it gets distance (the menu) AND keeps
     its question. */
  const clear = (/q_clear_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/confirm\(/.test(clear), 'Clear still confirms before destroying a quote');
  // The old chip toolbar is gone as a component, not merely restyled.
  t.check(!/\.qp-tbtn\{/.test(src) && !/class="qp-toolbar"/.test(src),
    'the icon-over-label chip toolbar no longer exists');
}

/* ---------- 4. the bar exists exactly when the page does ------------- */
{
  t.check(/document\.body\.classList\.toggle\('on-quote-tab', tab==='quote'\)/.test(src),
    'the tab switch writes the gating class');
  t.check(/document\.body\.classList\.add\('on-quote-tab'\)/.test(src),
    'and boot seeds it, because the quote tab is the default and boot never passes the switch');
  t.check(/\.q-stickybar\{\s*position:fixed/.test(src),
    'fixed to the viewport — which is why the gate must exist at all');
}

/* ---------- 5. the header band and the document grid ----------------- */
{
  t.check(/\.qp-client-inline\{[\s\S]{0,200}?border:1px solid var\(--line\)/.test(src),
    'the client fields are one bordered document-header band, not floating islands');
  t.check(/\.qp-items-panel table\{[^}]*font-variant-numeric:tabular-nums/.test(src),
    'every figure in the grid sits in tabular digits');
  t.check(/\.qp-items-panel td input\[type="number"\], \.qp-items-panel td input\[type="text"\]\{\s*background:transparent;border-color:transparent/.test(src),
    'inputs rest quiet on the row — an editable document, not a form grid');
  t.check(/\.qp-items-panel tr:hover td input/.test(src) && /\.qp-items-panel td input:focus\{border-color:var\(--accent\)/.test(src),
    'and grow their affordance when the hand arrives');
}

process.exit(t.done() ? 1 : 0);
