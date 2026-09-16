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
    /* P1 counted and held, P2 counted and empty, P3 never counted at
       all. The third is the one this fixture used to be missing: it had
       P2 with no key and asserted the row said "out of stock" about it,
       which was the very thing being said about goods nobody had ever
       looked at. */
    stock: { P1: 14, P2: 0 },
  };
  const scope = compileScope([
    extractFunction(src, 'productPriceRows', 'index.html'),
    extractFunction(src, 'rankedPriceRows', 'index.html'),
    extractFunction(src, 'effectiveMarkupRule', 'index.html'),
    extractFunction(src, 'suggestedSellingPrice', 'index.html'),
    /* The two readings both notes are built from -- the tier the price is
       asked at, and which of the three stock answers is true. */
    extractFunction(src, 'suggestionPriceParts', 'index.html'),
    extractFunction(src, 'suggestionStockParts', 'index.html'),
    extractFunction(src, 'stockKey', 'index.html'),
    extractFunction(src, 'stockOnHand', 'index.html'),
  extractFunction(src, 'getStockQty', 'index.html'),
    extractFunction(src, 'ipSuggestionPriceNote', 'index.html'),
    extractFunction(src, 'ipSuggestionStockNote', 'index.html'),
  ], {
    data,
    esc: (v) => String(v),
    supplierName: () => 'Shafik',
    fmtUGXPerUnit: (n, u) => `${Number(n).toLocaleString('en-US')} UGX/${u || 'unit'}`,
  }, ['ipSuggestionPriceNote', 'ipSuggestionStockNote', 'getStockQty']);

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

  /* The Mulper shape, reported from the running shop: a carton-only
     supplier (wholesale price, retail null) and a WHOLESALE markup rule
     -- the house norm on half this catalogue. The first cut hardcoded
     the retail tier and painted every such product with the amber
     "no markup rule" warning while it carried a perfectly good rule for
     the tier it is actually sold at. */
  data.prices.push({ id: 3, productId: 'P4', variantIdx: null, supplierId: 'S1',
    wholesale: 150000, retail: null, packQty: 0, unit: 'Ctn', tiers: [], outOfStock: false });
  const cartonOnly = { id: 'P4', name: 'Normal Mulper', wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 10000 };
  const carton = scope.ipSuggestionPriceNote(cartonOnly, null);
  t.check(/ip-price-sell/.test(carton) && /160,000/.test(carton),
    `a carton-only product is asked its WHOLESALE rule — 150,000 + 10,000 sells at 160,000 (${carton.replace(/<[^>]*>/g, '')})`);
  /* And one genuinely without a rule for its own tier still warns --
     naming which tier is missing, so the fix lands on the right field. */
  const cartonBare = scope.ipSuggestionPriceNote({ id: 'P4', name: 'Bare Carton' }, null);
  t.check(/ip-price-norule/.test(cartonBare) && /No wholesale markup rule/.test(cartonBare),
    'a carton-only product with no wholesale rule warns about the wholesale rule, not the retail one');

  t.check(/14 in stock/.test(scope.ipSuggestionStockNote(ruled, null)),
    'the row says what the shelf can cover');
  t.check(/out of stock/.test(scope.ipSuggestionStockNote(bare, null)),
    'and when it cannot — counted, and empty');
  /* NEVER COUNTED IS ITS OWN ANSWER. Saying "out of stock" here steers
     a rep away from goods that may be standing in the yard, on the
     strength of a fact the books do not have. getStockQty still reads
     it as nought, because arithmetic cannot sell what nobody has seen;
     only the words have to tell the two apart. */
  const never = { id: 'P3', name: 'Never Counted' };
  const noteNever = scope.ipSuggestionStockNote(never, null);
  t.check(/not counted/.test(noteNever) && !/out of stock/.test(noteNever),
    'a line nobody has ever counted says so, rather than claiming the shelf is empty');
  t.check(scope.getStockQty('P3', null) === 0,
    'while the arithmetic still reads it as nought — you cannot sell what nobody has seen');
}

/* ---------- 2. the inline search is the front door ------------------- */
{
  t.check(/<div class="[^"]*\bq-item-search-wrap\b[^"]*">[\s\S]{0,400}?id="q_item_search"/.test(src),
    'a permanent search field sits at the top of the items panel');
/* THE SLICES MATCH ON THE HOOK, NOT THE WHOLE CLASS ATTRIBUTE.
   The quote was rebuilt on the card system, so the document card, the
   dock and their controls each carry a .om- class beside the one the
   render and the wiring find them by. Three region slices keyed on the
   exact attribute text and matched nothing the moment a class was
   added -- which failed nineteen checks at once and said nothing true
   about any of them. What this file actually claims is WHERE things
   are and WHICH words they carry, and none of that moved. */
  const panel = (/<div class="[^"]*\bq-doc\b[^"]*">[\s\S]*?id="q_itemsWrap"/.exec(src) || [''])[0];
  t.check(/q_item_search/.test(panel),
    'above the items, inside the document');
  const wiring = extractFunction(src, 'renderQuoteItemSearchDd', 'index.html');
  /* The two doors lay the same facts out differently -- the picker's list
     wants one right-aligned note, this row wants the figure inside a line
     of meta -- so what they share is the DECISION, not the markup:
     suggestionPriceParts picks the tier and says whether there is a sell
     price at all, suggestionStockParts picks one of the three readings.
     Both notes in the picker are built from the same two. */
  t.check(/buildProductSuggestionEntries\(tokens\)/.test(wiring)
    && /suggestionPriceParts\(p, variantIdx\)/.test(wiring) && /suggestionStockParts\(p, variantIdx\)/.test(wiring),
    'its dropdown reuses the picker’s entries and the same price and stock readings — one truth, two doors');
  t.check(/suggestionPriceParts\(p, variantIdx\)/.test(extractFunction(src, 'ipSuggestionPriceNote', 'index.html'))
    && /suggestionStockParts\(p, variantIdx\)/.test(extractFunction(src, 'ipSuggestionStockNote', 'index.html')),
    'and the picker’s own notes are built from those same readings, so neither door can drift');
  /* Both halves of the Enter path: WHERE the top result comes from and
     what is done with it. Pinning only the pick call let a mutant null
     the querySelector and keep every assertion green while Enter did
     nothing. */
  t.check(/const top = dd\.querySelector\('\.suggestion-item'\);\s*if\(top\) quoteItemSearchPick\(\{ id: top\.dataset\.id/.test(src),
    'Enter takes the top result, because a call does not wait for a mouse');
  const pick = extractFunction(src, 'quoteItemSearchPick', 'index.html');
  t.check(/openModal\('itemPickerModal'\)/.test(pick) && /ipSelectProduct\(sel\.id, sel\.variantIdx\)/.test(pick),
    'and picking hands over to the same picker stage — suppliers, rec prices, cash hint unchanged');
  /* One + row serves both widths now. The phone card used to carry its
     own dashed "Add item" button (q_add_card_btn) as part of a second
     template, and the second template is gone: the row IS the card. */
  t.check(/id="q_add_row_btn"/.test(src) && !/q_add_card_btn/.test(src),
    'while the + row stays, so existing muscle memory still works — one add entry, not one per template');
}

/* ---------- 3. the sticky bar is the money and the actions ----------- */
{
  const bar = (/<div class="[^"]*\bq-stickybar\b[^"]*" id="q_stickybar">[\s\S]*?<\/section>/.exec(src) || [''])[0];
  t.check(/id="q_finbar"/.test(bar) && /id="q_save_btn"/.test(bar),
    'totals and Save share the bar — the figure read aloud sits beside the act that follows it');
  t.check(/id="q_print_quote_btn"/.test(bar) && /id="q_whatsapp_btn"/.test(bar),
    'with the frequent outputs one press away');
  t.check(/id="q_more_menu"[\s\S]*?id="q_print_btn"[\s\S]*?id="q_clear_btn"/.test(bar),
    'and the occasional ones — supplier copy, clear — behind the ⋯ menu');
  t.check(/class="[^"]*\bqbar-save\b[^"]*" id="q_save_btn"/.test(bar),
    'Save is the one filled button; everything else is quiet');
  /* Clear is destructive mid-call: it gets distance (the menu) AND keeps
     its question. */
  const clear = (/q_clear_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/confirm\(/.test(clear), 'Clear still confirms before destroying a quote');
  // The old chip toolbar is gone as a component, not merely restyled.
  t.check(!/\.qp-tbtn\{/.test(src) && !/class="qp-toolbar"/.test(src),
    'the icon-over-label chip toolbar no longer exists');

  /* THE SECONDARIES, NAMED. Each carries an aria-label and a title, and
     each is at least 40px because a control is a target before it is a
     picture. The three used to be icon-only at every width; the
     console has the room for the one word that tells sending from
     printing at a glance, so Send on WhatsApp keeps its words there.
     The aria-label says the same words, so it reads once, not twice. */
  const iconBtns = ['q_print_quote_btn', 'q_whatsapp_btn', 'q_more_btn'];
  iconBtns.forEach((id) => {
    const el = (new RegExp(`<button[^>]*id="${id}"[^>]*>`)).exec(bar);
    t.check(el && /aria-label="[^"]+"/.test(el[0]), `${id} is named for anything not reading the picture`);
    t.check(el && /title="[^"]+"/.test(el[0]), `and keeps the long explanation on hover`);
  });
  t.check(/id="q_whatsapp_btn"[^>]*aria-label="Send on WhatsApp"[\s\S]{0,900}?<span class="qbar-l">Send on WhatsApp<\/span>/.test(bar),
    'Send on WhatsApp keeps its words on the console, and the label says the same words, so it reads once');
  t.check(/\.qbar-wa \.qbar-l\{display:none;\}/.test(src),
    'and the phone keeps the mark and the name but drops the words — the dock has no room for them');
  /* CLIENT COPY IS A MENU ITEM AT EVERY WIDTH. Printing is the
     occasional act; sending and saving are the frequent ones. The
     button that owns the behaviour stays in the bar's markup, never
     drawn, and the menu item clicks it. */
  const barRow = bar.replace(/<div class="q-more-menu"[\s\S]*?<\/div>\s*<\/div>/, '');
  t.check(!/q_more_menu/.test(barRow), 'the ⋯ menu is cut out before the row is measured');
  t.check(!/>\s*Client copy\s*<\/button>/.test(barRow),
    'and Client copy has no words on the bar itself — it is not drawn there');
  t.check(/class="[^"]*\bq-print-owner\b[^"]*" id="q_print_quote_btn"/.test(bar) && /\.q-print-owner\{display:none;\}/.test(src),
    'the print button owns its behaviour and is never drawn');

  const btnRule = (/\.qbar-btn\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/min-width:40px/.test(btnRule) && /min-height:40px/.test(btnRule),
    'a bar button is still a thumb-sized target');
  const saveRule = (/\.qbar-save\{[^}]*\}/.exec(src) || [''])[0];
  t.check(/min-height:40px/.test(saveRule),
    'and Save matches it, so the row sits on one line');

  /* Save keeps its words. It is the commit, on a money document, and it
     is the one control on this bar worth the space. */
  t.check(/id="q_save_btn"[^>]*>[\s\S]{0,200}?Save quote/.test(bar),
    'Save quote is still labelled — an unlabelled commit is not a saving worth making');
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
  /* The band is the layer's .ow-cb: one bordered row with the inputs as
     ghosts inside its cells. It was .qp-client-inline, three .field
     boxes inside a bordered wrapper. */
  t.check(/\.ow-cb\{[\s\S]{0,200}?border:1px solid var\(--ow-rule-soft\)/.test(src),
    'the client fields are one bordered document-header band, not floating islands');
  /* The figures are .ow-tbl-n cells and .ow-gi inputs, and
     ow-table.test.js and design-system.test.js hold both to the mono
     face with tabular-nums. What this file pins is that the row really
     uses them. */
  t.check(/class="[^"]*\bq-line-total\b[^"]*">\$\{fmtUGX\(lineSell\)\}/.test(src)
    && /class="[^"]*\bq-qty\b[^"]*"/.test(src) && /class="[^"]*\bq-price\b[^"]*"/.test(src),
    'every figure in the grid sits in tabular digits — the cells and the inputs are the layer’s');
  t.check(/\.ow-gi\{[^}]*border:1px solid transparent[^}]*background:transparent/.test(src),
    'inputs rest quiet on the row — an editable document, not a form grid');
  /* Focus is attention, not alarm: this app's accent is oxide RED, and
     a red ring around a focused input is the universal grammar of a
     validation error. Focus on this page is steel-950, which is what
     --navy has always been an alias for. */
  t.check(/\.ow-tbl-r:hover \.ow-gi\{border-color:var\(--ow-steel-100\)/.test(src)
    && /\.ow-gi:focus\{border-color:var\(--ow-steel-950\)/.test(src) && !/\.ow-gi:focus\{[^}]*--ow-oxide/.test(src),
    'and grow their affordance when the hand arrives — in steel, since a red ring reads as an error');
  t.check(/\.q-item-search-wrap:focus-within\{border-color:var\(--navy\)/.test(src),
    'the search field focuses in navy for the same reason');
}

/* ---------- 6. an empty quote invites, and the band knows the client -- */
{
  const items = extractFunction(src, 'renderQuoteItems', 'index.html');
  /* Eight column headers over nothing and three footer rows all reading
     0 UGX -- zeros presented as an account. An empty document is an
     invitation to the one act that starts a quote. */
  t.check(/if\(items\.length===0\)\{\s*wrap\.innerHTML = `<div class="q-empty-doc">/.test(items),
    'an empty quote renders an invitation, not a table of zero totals');
  t.check(/Search above to add the first one/.test(items) && /press <b>\/<\/b>/.test(items),
    'that points at the search and teaches the shortcut');
  t.check(/renderQuoteFinbar\(0, 0, 0\);/.test(items),
    'while the bar still shows its zeros — it is the constant surface');
  /* The add buttons keep their ids in the empty branch too, hidden, so
     the wiring binds either way instead of throwing on a null. */
  t.check((items.match(/id="q_add_row_btn"/g) || []).length === 2,
    'and the add entry exists in both branches for the wiring to find');

  /* What the books know about the client lives INSIDE the band, as the
     cells after the date: the date's cell closes, the known-facts cell
     follows, and only then does the band close. The client and their
     number share the first cell -- one client, one cell. */
  t.check(/id="q_date">\s*<\/div>\s*(?:<!--[\s\S]*?-->\s*)?<div class="ow-cb-k" id="q_client_history"><\/div>\s*<\/div>/.test(src),
    'what the books know is the band’s own last cell, not an island under it');
  t.check(/<div class="q-client-cell">\s*<input[^>]*id="q_client_name"[^>]*>\s*<input[^>]*id="q_client_phone"/.test(src),
    'and the number sits in the client’s own cell beside the name');
  /* The usual-buys chips are INSIDE the document now, under the search:
     tapping one puts a line on it, so it belongs where the lines are.
     The cut is counted on the last chip rather than scrolled off. */
  const doc = (/<div class="[^"]*\bq-doc\b[^"]*">[\s\S]*?id="q_itemsWrap"/.exec(src) || [''])[0];
  t.check(/id="q_item_search_dd"[\s\S]*?<div class="[^"]*\bq-client-usual\b[^"]*" id="q_client_usual"><\/div>[\s\S]*?<div id="q_itemsWrap"/.test(doc),
    'the usual-buys chips sit inside the document, between the search and the lines');
  /* THE PHONE'S TWO TABS sit between them: the quote, and the details the
     console keeps in its rail. The chips are still above the lines; the
     tab bar is not drawn at all on the console. */
  /* THE TABS MOVED INTO THE NAVY HEADER, and there are three of them.
     
     They used to sit inside the document, between the usual-buys chips
     and the lines, because the header above was 48px of name and two
     icons with no room for anything else. The card system's phone
     header carries the screen's name, who the quote is for, those two
     icons AND the lenses -- which is what lets the console's title
     block and its pill row be dropped on the phone entirely rather
     than drawn a second time under the bar.
     
     Three cells, not two: Building and Saved are the same two lenses
     the console shows as pills, and Details is where the rail's cards
     go on a screen with no room beside the list for them. The pane
     switch is unchanged -- data-qtab is still what setQuoteTab reads. */
  const tabs = (/<div class="q-tabbar" id="q_tabbar"[\s\S]*?<\/div>\s*<\/div>/.exec(src) || [''])[0];
  t.check(/<div class="q-phbar"[\s\S]*?id="q_tabbar"/.test(src),
    'the phone’s lenses sit in its own header, not inside the document');
  t.check((tabs.match(/class="q-tab[ "]/g) || []).length === 3
    && /data-qtab="quote"/.test(tabs) && /data-qtab="saved"/.test(tabs) && /data-qtab="details"/.test(tabs),
    'three cells — the two lenses the console shows as pills, and Details');
  t.check(/id="q_tab_n_quote"/.test(tabs) && /id="q_tab_n_details"/.test(tabs) && /id="q_tab_dot"/.test(tabs),
    'each carrying its count, and Details a dot for a section that is warning');
  t.check(/\.q-tabbar\{display:none;\}/.test(src) || /,\s*\n?\s*\.q-tabbar,/.test(src),
    'and none of it is drawn on the console');
  /* The rail's panels are the Details pane and nothing else is left in
     the phone's body: #q_rail is hidden until that tab is chosen. */
  t.check(/#q_rail\{display:none;padding:0;\}/.test(src) && /body\.q-tab-details #q_rail\{display:flex;\}/.test(src),
    'the rail is the Details pane, drawn only on its tab');
  t.check(/body\.q-tab-details #q_itemsWrap\{display:none;\}/.test(src),
    'and the list is not drawn behind it');
  /* THE SEARCH IS A FIELD OF ITS OWN on the phone -- its own margin and
     border -- so the list starts clean at its column header. */
  t.check(/\.q-item-search-wrap\{height:var\(--ow-tap\);margin:10px 16px 8px;[^}]*border:1px solid var\(--ow-rule\);border-radius:var\(--ow-r-lg\);\}/.test(src),
    'the search is a field with its own margin and border, not a hairline row in the list');
  const dd = extractFunction(src, 'renderQuoteItemSearchDd', 'index.html');
  t.check(/id="q_search_n"/.test(src) && /nEl\.textContent = `\$\{all\.length\} result\$\{all\.length===1\?'':'s'\}`/.test(dd),
    'and says how many results there are as it is typed');
  /* A RESULT IS TWO LINES: the name whole, with the stock in a pill; one
     line of meta under it. It was five wrapping lines with the SKU
     leading, which read as a table that had fallen over. */
  t.check(/<span class="q-res-nm">\$\{highlightTokens\(p\.name, tokens\)\}<\/span>\$\{pill\}/.test(dd)
    && /<span class="q-res-sb">\$\{meta\}<\/span>/.test(dd),
    'a result is one name line and one meta line, never five');
  t.check(/\.q-res-nm\{[^}]*overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\}/.test(src)
    && /\.q-res-sb\{[^}]*overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\}/.test(src),
    'and neither of them ever wraps');
  t.check(/\$\{all\.length - max\} more · keep typing to narrow/.test(dd),
    'the results it does not show are counted, never dropped');
  const fit = extractFunction(src, 'fitUsualChips', 'index.html');
  t.check(/more\.textContent = `\+\$\{cut\}`;/.test(fit),
    'and the chips that do not fit the line are counted, never silently cut');
  const hist = extractFunction(src, 'renderClientHistoryBox', 'index.html');
  t.check(/Orders<\/span>/.test(hist) && /Owed now/.test(hist) && /Last order<\/span>/.test(hist),
    'the facts are orders, what is owed now and the last order — the rail’s client panel folded into the band');
}

/* ---------- 7. the dropdown is a member, not a copy ------------------ */
/*
 * The first shipped cut reused the picker's row MARKUP but none of its
 * styling scopes, and the rows rendered as an unstyled stack -- thumbs
 * on their own lines, names glued to SKUs, prices floating. The fix is
 * membership: the dropdown joins the two scopes that style suggestion
 * rows everywhere else, so there is one truth and no copy to drift.
 */
{
  t.check(/class="q-item-search-dd searchable-select" id="q_item_search_dd"/.test(src),
    'the dropdown carries the searchable-select scope — hover, sid spacing, variant notes');
  t.check(/#ip_list \.suggestion-item, #cmp_suggestions \.suggestion-item, \.q-item-search-dd \.suggestion-item\{display:flex/.test(src),
    'and joins the picker list’s own flex-row rule rather than duplicating it');
  t.check(/#ip_list \.ip-item-main, #cmp_suggestions \.ip-item-main, \.q-item-search-dd \.ip-item-main\{flex:1/.test(src)
    && /, \.q-item-search-dd \.ip-item-price\{flex-shrink:0/.test(src),
    'name and price cells included, so the row lays out like every other suggestion row');
}

/* ---------- 7b. a card may not clip the picker it hosts -------------- *
 *
 * THE FAULT THIS CATCHES SHIPPED, and it looked like a dead screen:
 * neither the client nor the product could be chosen. Both dropdowns
 * were built, populated and positioned correctly -- the JS was never
 * wrong -- and the CARD around them was `overflow:hidden`, so a 116px
 * client list rendered inside a 62px strip and 104px of the product
 * list fell outside the document card. Nothing threw. Nothing logged.
 * The rows were in the DOM the whole time.
 *
 * overflow:hidden was there for a good reason -- to clip the table
 * inside the card's 14px corners -- which is why it needs a test rather
 * than a memory: the next person to want rounded corners on a card will
 * reach for exactly the same declaration. Corners are clipped on the
 * child that paints to the edge instead.
 */
{
  const rule = (name) => (new RegExp('\\.' + name + '\\{([^}]*)\\}').exec(src) || ['', ''])[1];
  [['om-qclient', 'the client autocomplete'],
   ['om-qdoc', 'the product search results'],
  ].forEach(([cls, what]) => {
    t.check(!/overflow:\s*hidden/.test(rule(cls)),
      `.${cls} does not clip ${what} it hosts`);
  });
  /* And the corner is still clipped, on the one child that paints to it. */
  t.check(/\.om-qdoc \.om-addrow\{[^}]*border-radius:\s*0 0 14px 14px/.test(src),
    'the card keeps its bottom corners, clipped on the row that reaches them');
}

/* ---------- 8. the phone bar respects the bottom nav ----------------- */
{
  t.check(/\.q-stickybar\{left:0;bottom:calc\(var\(--mobile-bottomnav-h\) \+ env\(safe-area-inset-bottom, 0px\)\)/.test(src),
    'on a phone the bar sits ABOVE the bottom nav — both are fixed to the bottom, and the nav covered it');
  /* There used to be a rule here hiding the + button while this page
     was open, because its only job was opening this very page and it
     otherwise floated over the totals. The bar now carries Sell, which
     is the same door, so the button is gone and so is the rule — and
     nothing may quietly bring either back. */
  t.check(!/mobile-fab/.test(src),
    'the + button is gone from this page’s rules — Sell in the bar is the same door');
  t.check(/body\.on-quote-tab #tab-quote\{padding-bottom:110px;\}/.test(src),
    'with the reserve covering nav plus bar so the last row clears both');

  /* ONE ROW, NOT TWO — and what had to move for it.
     The actions took width:100% and dropped to their own line under the
     money, so the bar ate about 150px of a screen whose whole job is
     the quote above it. The owner chose what the bar carries: the
     figure, WhatsApp, Save. */
  /* THE DOCK IS ONE 64px LINE: the figure with its line count, WhatsApp
     and Save, in the thumb zone. The ⋯ is not on it -- the phone's own
     bar carries it, and the node is MOVED there, never copied, so there
     is one menu and one set of handlers. Above the line, the 36px shop
     strip. */
  t.check(/\.q-stickybar-actions\{display:contents;\}/.test(src) && /\.qbar-wa\{order:3;/.test(src) && /\.qbar-save\{order:4;/.test(src),
    'the actions dissolve into the dock, WhatsApp and Save closing the line in that order');
  t.check(/\.qp-says\{order:2;flex:1 1 auto;min-width:0;height:64px;/.test(src),
    'and the dock is one 64px line');
  const place = (/const wrap = document\.querySelector\('#q_stickybar \.q-more-wrap'\);[\s\S]*?mq\.addListener\(place\);/.exec(src) || [''])[0];
  t.check(/slot\.appendChild\(wrap\)/.test(place) && /insertBefore\(wrap, save\)/.test(place),
    'the ⋯ is moved into the phone’s bar and back, one node at either width');
  t.check(/\.q-print-owner\{display:none;\}/.test(src) && /getElementById\('q_phbar_print'\)\.addEventListener\('click'[\s\S]{0,120}?getElementById\('q_print_quote_btn'\)\.click\(\)/.test(src),
    'Client copy is the bar’s document mark, clicking the button that owns the printing');
  /* THE PHONE'S OWN CHROME. 190px of app bar, 26px heading, subtitle and
     link stood above the first line; now a 48px bar of the screen's own
     and no heading in the body. */
  t.check(/body\.on-quote-tab \.mobile-topbar\{display:none;\}/.test(src) && /body\.on-quote-tab #tab-quote > \.ow-ph\{display:none;\}/.test(src),
    'the phone draws its own 48px bar and no page heading under it');
  t.check(/\.q-phbar\{position:fixed;top:0;left:0;right:0;z-index:90;display:flex;[^}]*height:calc\(48px \+ env\(safe-area-inset-top\)\)/.test(src),
    'and the bar is 48px, fixed');
  /* THE LINE IS 54px CLOSED, 78px OPEN. The count and the price are
     dotted taps on the second line; a tap opens the row's own stepper
     and price field, one row at a time. */
  t.check(/\.q-doc \.ow-tbl-r\.q-line\{display:grid;grid-template-columns:22px minmax\(0,1fr\) auto;[^}]*min-height:54px;/.test(src),
    'a line is 54px closed');
  t.check(/\.q-doc \.ow-tbl-r\.q-line\.q-open\{min-height:78px;\}/.test(src),
    'and 78px with its controls open');
  const items2 = extractFunction(src, 'renderQuoteItems', 'index.html');
  t.check(/class="q-ph-tap" data-tap="qty"/.test(items2) && /class="q-ph-tap" data-tap="price"/.test(items2),
    'the count and the price are taps');
  t.check(/row\.querySelectorAll\('\.q-ph-tap'\)\.forEach\(b=> b\.addEventListener\('click', \(\)=> openRow\(b\.dataset\.tap\)\)\)/.test(items2),
    'that open the row on the control that was tapped');

  /* And it leaves as a PROXY, not a copy. The menu row has no handler
     of its own; it clicks the real button, which is display:none at
     this width and fires all the same. Two buttons with two copies of
     the same handler is how one of them comes to be quietly wrong. */
  const proxy = (/getElementById\('q_print_quote_phone'\)\.addEventListener\('click',[\s\S]*?\}\);/.exec(src) || [''])[0];
  t.check(/getElementById\('q_print_quote_btn'\)\.click\(\)/.test(proxy),
    'and it clicks the button that owns the behaviour rather than keeping a second copy of it');
  t.check(!/ensureQuote|printArea/.test(proxy),
    'so it knows nothing about printing at all');

  /* A number must never break across two lines. At 390px "1,806,000
     UGX" wrapped after the comma and stopped looking like a number. */
  t.check(/\.qp-says-value\{font-size:20px;white-space:nowrap;\}/.test(src),
    'the figure the owner reads down the phone never breaks');
  t.check(/\.qp-shopline b\{[^}]*white-space:nowrap/.test(src),
    'and neither does what the shop keeps');

  /* THE FIGURE AND THE PILL USED TO DISAGREE. The pill has four
     readings; the figure beside it had two — green unless the profit
     was negative — so a quote keeping 6% showed an amber pill next to a
     green figure. The figure now takes the pill's own reading, which is
     also what lets the phone drop the pill: at 390px the bar has about
     150 pixels for the money, and the two together need closer to 180. */
  const bar2 = extractFunction(src, 'renderQuoteFinbar', 'index.html');
  t.check(/<div class="[^"]*\bqp-keep-v\b[^"]*"[^>]*><b class="\$\{pillClass\}">\$\{fmtUGX\(profit\)\}<\/b>[\s\S]{0,200}?class="[^"]*\bqp-margin-pill-lg\b[^"]*\$\{pillClass\}">/.test(bar2),
    'the keep figure carries the same reading as the pill, not just the sign of the profit');
  t.check(!/style="color:/.test(bar2),
    'and takes it from a class rather than an inline colour, so a rule can reach it');
  ['good', 'warn', 'danger', 'quiet'].forEach((c) => {
    t.check(new RegExp('\\.qp-shopline b\\.' + c + '\\{color:').test(src),
      `all four readings are painted (${c})`);
  });
  /* THE SHOP SIDE IS BEHIND A TAP ON THE PHONE. The 36px strip above
     the dock says the shop's two figures small, with the pill; tapping
     it opens a third line on every row -- buy @, what is kept -- and
     stays open for the session. On a call the phone may be facing the
     client. */
  t.check(/\.qp-shop\{display:none;\}/.test(src) && /\.q-shop-toggle\{all:unset;[^}]*order:0;flex:1 1 100%;[^}]*height:36px;/.test(src),
    'the two-cell box is not drawn on the phone; the strip carries the figures');
  t.check(/figs\.innerHTML = `· costs you <b class="qp-sf-c">/.test(bar2) && /you keep <b class="qp-sf-k">/.test(bar2),
    'and the strip is written by the same render as the bar, from the same figures');
  /* "Keep", not "Margin". The column was renamed with the table, and
     this selector is what takes the shop's three cells off the phone
     card -- it went on naming the old word for one commit, and the
     Keep cell landed on top of the line's own second row. */
  t.check(/\.q-doc \.q-line > \.q-shop-first,\s*\.q-doc \.q-line > \[data-l="Buy @"\],\s*\.q-doc \.q-line > \[data-l="Keep"\]\{display:none;\}/.test(src)
    && /body\.q-shop-open \.q-doc \.q-line > \.q-ph-shop\{display:flex;/.test(src),
    'a line’s shop side is not drawn until the strip opens it');
  const toggle = extractFunction(src, 'setShopSideOpen', 'index.html');
  t.check(/sessionStorage\.setItem\('q_shop_open'/.test(toggle),
    'opened once, it stays open for the session');
}

/* ---------- 9. the picker stage speaks the page's grammar ------------ */
/*
 * The stage is where the two decisions get made -- what to charge, who
 * to buy from -- and it feeds the page that was just redesigned, so it
 * speaks the same language: one filled accent commits the surface, the
 * one price field says WHICH price it is, and the palette is the house
 * steel rather than a stray blue.
 */
{
  t.check(/<button class="qbar-save" id="ip_add_btn">/.test(src),
    'Add to quote is the same primary as Save quote — one grammar for the commit');
  t.check(/\.q-add-row \.qbar-save\{margin-left:auto;\}/.test(src),
    'sitting against the right edge like Save does on the bar');
  /* The field still names itself the SELL price; what changed is that it
     also names the unit it counts in. "Each" when the quantity is typed
     loose, "per Ctn" when it is typed in cartons -- the box, the card
     above it and the line it writes all count in the same unit. */
  t.check(/<label>Sell price \$\{chosenIsPack \? `per \$\{esc\(packUnit\)\}` : 'each'\} \(UGX\)<\/label>/.test(src),
    'the one price field names itself the SELL price — sell and buy kept trading clothes');
  t.check(/title="What the client pays per \$\{esc\(chosenUnit\|\|'unit'\)\} — the buy cost is recorded automatically/.test(src),
    'and its tooltip says where the buy cost comes from, so nobody types a cost into it');
  t.check(/\.q-stage-summary\{[\s\S]{0,200}?background:var\(--ow-steel-050\)/.test(src)
    && !/#EAF3FC/.test(src),
    "the summary panel is house steel — the one blue panel read as somebody else's component");
}

/* ---------- the stage header on a phone ------------------------------
 *
 * Reported from a real phone: the meta block beside the product name had
 * collapsed to ONE WORD WIDE, running down the screen a word at a time,
 * and the modal scrolled sideways with "Back to search" and "QUANTITY"
 * clipped off the left.
 *
 * One cause. `.q-stage-name` was flex-shrink:0, so a name as long as
 * somebody typed it -- "RIDER Self Drilling Screws — 1"" measures 234px
 * -- took the row whole, left the summary 29 pixels, and pushed the
 * modal body to 396px inside a 375px phone.
 */
{
  t.check(!/\.q-stage-name\{[^}]*flex-shrink:0/.test(src),
    'the product name may shrink — refusing to left the meta block 29px wide and the modal wider than the phone');
  t.check(/\.q-stage-name\{[^}]*min-width:0/.test(src),
    'and may shrink past its content, which is what min-width:0 is for in a flex row');

  /* CASCADE ORDER, pinned. The override below carries the SAME
     specificity as the base rule, so written before it, it lost in
     silence -- flex-basis went back to 0%, the meta block stayed 29px
     and the phone layout did not move at all. The first fix for this bug
     changed nothing for exactly that reason. */
  const base = src.indexOf('.q-stage-head .q-stage-summary{flex:1;');
  const override = src.indexOf('.q-stage-head .q-stage-summary{flex:1 1 100%;}');
  t.check(base >= 0 && override >= 0, 'both the base rule and the phone override exist');
  t.check(override > base,
    'and the override is written AFTER the rule it overrides — equal specificity is decided by order');

  const mq = (/@media \(max-width:760px\)\{[\s\S]*?\n  \}/.exec(src.slice(base)) || [''])[0];
  t.check(/\.q-stage-head\{flex-wrap:wrap;\}/.test(mq),
    'on a phone the header wraps');
  t.check(/\.q-stage-head \.q-stage-summary\{flex:1 1 100%;\}/.test(mq),
    'so the meta block takes a row of its own rather than a sliver of one');
  t.check(/max-width:760px/.test(mq),
    'at the same width the columns below it collapse — the stage goes single-file all at once');
}

process.exit(t.done() ? 1 : 0);
