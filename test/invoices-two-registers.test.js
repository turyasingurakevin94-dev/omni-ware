#!/usr/bin/env node
'use strict';
/*
 * Two registers of one transaction, on one screen.
 *
 * An order, the invoice it becomes and the purchase invoices it raises
 * against its suppliers are ONE THING moving through the business. The
 * data has always known it -- purchase invoices carry quoteId, and
 * purchaseInvoicesForOrder() walks the link. index.html says so itself,
 * beside those helpers: "Three tabs named after tables, one object."
 *
 * The screens did not. Following an order's "Raised" link had to change
 * tab, type the bill number into the OTHER screen's search box, widen
 * that screen's date range and drop its voided filter -- and getting
 * back meant undoing all four by hand, because the sales list you left
 * was gone.
 *
 * They are one screen now, as two LENSES over one filter bar. What this
 * file holds:
 *
 *   one at a time      the panes can never both be on screen. Side by
 *                      side was drawn and rejected: at 1440 with the
 *                      rail off each register gets 578px, which costs
 *                      the sales side four of its eight columns and the
 *                      buying side its rail and its checks band. This
 *                      app has a law against it already -- Movements was
 *                      pulled OUT of Inventory for being a whole second
 *                      console stacked under the first.
 *   one bar            one search box, one date range, one Hide voided.
 *                      Two copies of one bar is what made the link
 *                      expensive, so a second copy must not come back.
 *   one accent         oxide is spent once per screen. Sales owns it --
 *                      the printed sheet is the thing to do next -- and
 *                      on Purchases the same button goes ghost, because
 *                      there the accent belongs to the bill you opened.
 *   the focus          following a "Raised" link sets an ORDER, not a
 *                      search term, so the sales list it left is
 *                      untouched and Back is one press.
 *
 * Run: node test/invoices-two-registers.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('invoices, two registers');
const src = read('index.html');
const sec = (/<section id="tab-invoices"[\s\S]*?\n    <\/section>/.exec(src) || [''])[0];

/* ---------- 1. one screen ------------------------------------------- */
{
  t.check(sec.length > 0, 'the invoices section was found, not silently empty');
  t.check(!/id="tab-purchase-invoices"/.test(src),
    'Purchase invoices is not a screen of its own any more');
  const alias = extractFunction(src, 'resolveTab', 'index.html');
  t.check(/if\(tab === 'purchase-invoices'\)\{ invSide = 'buys'; return 'invoices'; \}/.test(alias),
    'but the old door still opens it, on the lens it meant');

  t.check(/id="inv_sales_pane"/.test(sec) && /id="inv_buys_pane"/.test(sec),
    'both registers live on one screen');
  ['pi_strip', 'piCheckWrap', 'purchaseInvoicesWrap', 'piRailWrap'].forEach((id) => {
    t.check(new RegExp(`id="${id}"`).test(sec),
      `and the buying side kept ${id}, which its handlers bind to`);
  });
}

/* ---------- 2. one view at a time ----------------------------------- */
/* The whole reason the second register is allowed onto this screen. If
   the panes could ever both be up, the screen is the stack that
   Inventory was split apart for. */
{
  const side = extractFunction(src, 'invApplySide', 'index.html');
  t.check(/salesPane\.hidden = !sales/.test(side) && /buysPane\.hidden = sales/.test(side),
    'exactly one register is ever on screen — the split this fold refused cannot come back by accident');
  t.check(/\.ow-f\[hidden\]\{display:none;\}/.test(src),
    'and the hidden attribute is honoured against the rules that outrank it');
  t.check(/\.inv-crumb\[hidden\]\{display:none;\}/.test(src),
    'including on the crumb, whose own display:flex would otherwise win');

  t.check(/sub\.textContent = sales/.test(side) && /box\.placeholder = paired/.test(side),
    'the words around the register follow it — the sub, and what the search box says it searches');
  /* Reached through the section, not by id: an id on a paragraph is an
     id another screen can one day repeat, and this file has already
     shipped that fault twice. */
  t.check(/document\.querySelector\('#tab-invoices \.ow-ph-sub'\)/.test(side)
    && /#tab-invoices \.ow-ph-help/.test(side),
    'and it reaches them through the section rather than by ids nobody else may take');
}

/* ---------- 3. one bar, one accent ---------------------------------- */
{
  t.check(!/'pi_doc_search'/.test(src) && !/'pi_doc_range_preset'/.test(src)
    && !/'pi_doc_hide_voided'/.test(src) && !/id="pi_doc_/.test(src),
    'the second copy of the filter bar is gone, controls and reads alike');
  t.check(/function piDocGetDateRange\(\)\{ return invDocGetDateRange\(\); \}/.test(src),
    'and the second reading of it is one line pointing at the first');
  t.check((src.match(/id="inv_doc_search"/g) || []).length === 1,
    'there is exactly one search box on the screen');
  const render = extractFunction(src, 'invRenderSide', 'index.html');
  t.check(/invSide === 'buys'/.test(render) && /renderPurchaseInvoices/.test(render)
    && /renderInvoices/.test(render),
    'and one keystroke in it draws whichever register is open');

  const side = extractFunction(src, 'invApplySide', 'index.html');
  t.check(/classList\.toggle\('btn-accent', invSide==='sales'\)/.test(side)
    && /classList\.toggle\('btn-ghost', invSide!=='sales'\)/.test(side),
    'the printed sheet is prominent on Sales and quiet on Together and Purchases');
  t.check((sec.match(/btn-accent/g) || []).length === 1,
    'and the screen carries exactly one of them in its markup');
}

/* ---------- 4. following the link, and getting back ----------------- */
{
  const focus = extractFunction(src, 'revealBillsForOrder', 'index.html');
  t.check(/invFocusOrderId = q\.id/.test(focus) && /invSide = 'buys'/.test(focus),
    'a "Raised" link asks about the ORDER and opens the buying lens');
  t.check(!/inv_doc_search/.test(focus),
    'without touching the shared bar, so the sales list it left is exactly where it was');
  t.check(/That order raised no supplier bills/.test(focus),
    'and an order with nothing behind it says so rather than landing on an empty register');

  const pr = extractFunction(src, 'renderPurchaseInvoices', 'index.html');
  t.check(/invoices = purchaseInvoicesForOrder\(focusOrder\)\.slice\(\)/.test(pr),
    'under a focus the list is that order\'s bills');
  t.check(/if\(tokens\.length && !focusOrder\)/.test(pr),
    'and the range and the search do not narrow it — a bill raised last month is still one of them');
  t.check(/const seg = focusOrder \? '' :/.test(pr),
    'the kind segment is not drawn under a focus, where two of its three choices could only empty the list');

  const crumb = extractFunction(src, 'invRenderCrumb', 'index.html');
  t.check(/invoiceNumberLabel\(q\)/.test(crumb) && /Back to Sales/.test(crumb),
    'the crumb names whose bills these are and carries the way back');
  t.check(/invFocusOrderId = null;[\s\S]{0,60}invSide = 'sales';[\s\S]{0,40}invApplySide\(\);/.test(crumb),
    'and Back is one press — which is the whole of what this fold buys');

  /* Pressing the lens by hand is a request for the whole register. A
     focus that survived it would be a filter nobody set and nobody can
     see. */
  t.check(/invSide = btn\.dataset\.side;\s*\n\s*invFocusOrderId = null;/.test(src),
    'pressing the lens drops the focus, so the register is the whole register');
}

process.exit(t.done() ? 1 : 0);
