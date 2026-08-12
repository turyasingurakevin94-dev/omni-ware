#!/usr/bin/env node
'use strict';
/*
 * The 80mm thermal receipt.
 *
 * Paper handed across a counter at the moment money changes hands. The
 * app had fourteen print paths and not one receipt -- everything was A4
 * or A5 built for a laser printer, and the whole letterhead of all of
 * them was a shop name and nothing else.
 *
 * Two properties matter more than anything about the layout:
 *
 *   1. The paper and the screen cannot disagree. Every figure comes from
 *      savedQuoteTotal / invoiceBalanceDue / quoteItemSellPrice -- the
 *      same functions the A5 client copy, the WhatsApp message and the
 *      Invoices tab already use. Nothing here recomputes money.
 *   2. The client's phone number never reaches the paper. A receipt is
 *      handed over and often filed in somebody else's shop; a customer's
 *      number on it is personal data travelling further than the
 *      document needs, and it earns nothing on 72mm.
 *
 * The rest follows from the hardware: a thermal head is one bit, so
 * there is no grey anywhere; 72mm is about 32 monospace characters, so
 * an item name and its arithmetic never share a line.
 *
 * Run: node test/thermal-receipt.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('thermal receipt');
const src = read('index.html');

/* ---------- the builder, compiled with the app's own money ----------- */

const NAMES = ['receiptNum', 'receiptNumberLabel', 'nextPaymentId', 'paymentMethodLabel',
  'shopIdentity', 'printedShopName', 'buildReceiptHTML', 'savedQuoteTotal',
  'invoiceBalanceDue', 'quoteClientName', 'invoiceNumberLabel'];

const makeScope = (over) => {
  const data = Object.assign({
    presetShopLegalName: 'Telagon Hardware',
    presetShopAddress: 'Jesco House Room JHB08',
    presetShopPhone: '0754 333419',
    presetShopTin: '',
    presetReceiptFooter: 'Thank you for your business',
    savedQuotes: [], products: [],
  }, over || {});
  return compileScope(
    NAMES.map((n) => extractFunction(src, n, 'index.html')).concat([
      extractDeclaration(src, 'ACCOUNTS', 'index.html'),
    ]),
    {
      data,
      currentShopName: 'Registered Shop Ltd',
      esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
      quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
      fmtShortDate: () => '12 Aug 2026',
      todayISO: () => '2026-08-12',
      myStaff: { name: 'Kevin Moses' },
    },
    NAMES,
  );
};

const order = (over) => Object.assign({
  id: 152, client: { name: 'Abraham', phone: '0769727734' }, amountPaid: 1300000,
  payments: [
    { date: '2026-08-12', amount: 1000000, note: '', cashTxnId: 1, method: 'cash', id: 1 },
    { date: '2026-08-12', amount: 300000, note: '', cashTxnId: 2, method: 'momo', id: 2 },
  ],
  items: [
    { productName: 'Soft Close Mulper — Flat', unit: 'Ctn', qty: 1, price: 250000, sellPrice: 265000 },
    { productName: 'WISEUP Tape Measure — 3M', unit: 'Dz', qty: 2, price: 6250, sellPrice: 7500 },
    { productName: 'Hinges — Flat', unit: 'Ctn', qty: 4, price: 250000, sellPrice: 300000 },
  ],
}, over);

const nums = (html) => (html.match(/[\d,]{4,}/g) || []).map((x) => Number(x.replace(/,/g, '')));

/* ---------- 1. the paper agrees with the screen ---------------------- */
{
  const s = makeScope();
  const q = order();
  const html = s.buildReceiptHTML(q, q.payments[1], 1);

  t.check(s.savedQuoteTotal(q) === 1480000, 'the order totals 1,480,000 by the app’s own arithmetic');
  t.check(nums(html).includes(1480000), 'and that is the figure on the paper');
  t.check(s.invoiceBalanceDue(q) === 180000 && nums(html).includes(180000),
    'the balance the screen computes is the balance printed');
  // Never a second opinion: the builder must not do money of its own.
  const fn = extractFunction(src, 'buildReceiptHTML', 'index.html');
  t.check(/savedQuoteTotal\(q\)/.test(fn) && /invoiceBalanceDue\(q\)/.test(fn)
    && /quoteItemSellPrice\(it\)/.test(fn),
    'every figure is read from the functions the other documents use');
}

/* ---------- 2. the privacy claim ------------------------------------- */
/*
 * The one promise this document makes about what it does NOT carry.
 */
{
  const s = makeScope();
  const q = order();
  [s.buildReceiptHTML(q, q.payments[0], 0), s.buildReceiptHTML(q, null, null)].forEach((html, i) => {
    t.check(!/0769727734/.test(html),
      `no client phone number reaches the paper (${i === 0 ? 'payment receipt' : 'whole sale'})`);
  });
  t.check(/Abraham/.test(s.buildReceiptHTML(q, null, null)),
    'while the client’s name does — a receipt has to say whose it is');
}

/* ---------- 3. receipt numbers ---------------------------------------- */
{
  const s = makeScope();
  const q = order();
  t.check(s.receiptNumberLabel(q, q.payments[1], 1) === 'R-0152-2',
    'a receipt carries its own number, derived from its invoice and its place on it');
  t.check(s.receiptNumberLabel(q, q.payments[1], 1) !== s.invoiceNumberLabel(q),
    'distinct from the invoice number — one invoice can be paid three times');
  /* Payments recorded before this feature existed have no id. They must
     still print rather than crash, numbered from what they do have. */
  t.check(s.receiptNumberLabel(q, { amount: 5 }, 0) === 'R-0152-1',
    'a payment predating the id field still prints, numbered from its index');
  /* The id is what keeps a number stable when a LATER payment is
     reversed -- index alone would renumber the survivors. */
  t.check(s.nextPaymentId(q) === 3 && s.nextPaymentId({ payments: [] }) === 1,
    'new payments take one more than the highest already on that invoice');
  t.check(s.nextPaymentId({ payments: [{ id: 7 }, { id: 2 }] }) === 8,
    'the highest, not the count — so a reversal never hands out a used number');
}

/* ---------- 4. how the money arrived --------------------------------- */
{
  const s = makeScope();
  const q = order();
  const html = s.buildReceiptHTML(q, q.payments[0], 0);
  t.check(/Paid[^<]*Cash/.test(html.replace(/&mdash;/g, '—')), 'a cash payment says Cash');
  t.check(/Mobile Money/.test(html), 'and a mobile-money one says Mobile Money');
  t.check(s.paymentMethodLabel({ method: 'bank' }) === 'Bank', 'through the same ACCOUNTS list the form offers');
  t.check(s.paymentMethodLabel({}) === '', 'and an old payment with no method says nothing rather than guessing');
  // The form already asked for the account and used to discard it.
  const save = (/ip_save'\)\.addEventListener[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/method: account/.test(save), 'the payment records the account the form already collected');
  t.check(/id: nextPaymentId\(q\)/.test(save), 'and an id, so its receipt number survives a later reversal');
}

/* ---------- 5. balance due, only when there is one ------------------- */
{
  const s = makeScope();
  t.check(/BALANCE DUE/.test(s.buildReceiptHTML(order(), null, null)),
    'a part-paid invoice prints what is still owed — this shop sells on credit');
  t.check(!/BALANCE DUE/.test(s.buildReceiptHTML(order({ amountPaid: 1480000 }), null, null)),
    'a settled one does not, because there is nothing to say');
  t.check(!/BALANCE DUE/.test(s.buildReceiptHTML(order({ amountPaid: 2000000 }), null, null)),
    'and an overpayment never prints a negative balance');
}

/* ---------- 6. an unfilled shop still gets paper --------------------- */
{
  const bare = makeScope({
    presetShopLegalName: '', presetShopAddress: '', presetShopPhone: '',
    presetShopTin: '', presetReceiptFooter: '',
  });
  const html = bare.buildReceiptHTML(order(), null, null);
  t.check(/1,480,000/.test(html), 'a shop that has filled nothing in still gets a usable receipt');
  t.check(/Registered Shop Ltd/.test(html),
    'falling back to the name the shop is registered under, not to a blank letterhead');
  /* Each optional line, by name. A blank rendered row is worse than no
     row on paper this narrow: it reads as a field somebody forgot to
     fill rather than one the shop does not have. */
  t.check(!/r-sub"><\/div>/.test(html) && !/Tel <\/div>/.test(html) && !/TIN <\/div>/.test(html)
    && !/TIN /.test(html),
    'and an unset field costs no blank line — it simply does not render');
  t.check(!/TIN/.test(makeScope({ presetShopTin: '' }).buildReceiptHTML(order(), null, null)),
    'a shop with no TIN never prints the word');
  // With them set, they appear.
  const full = makeScope({ presetShopTin: '1001234567' }).buildReceiptHTML(order(), null, null);
  t.check(/Telagon Hardware/.test(full) && /Jesco House Room JHB08/.test(full)
    && /0754 333419/.test(full) && /TIN 1001234567/.test(full),
    'while every field that is set does reach the top of the paper');
}

/* ---------- 7. the printer plumbing ---------------------------------- */
{
  const fn = extractFunction(src, 'printReceipt', 'index.html');
  /* `size:80mm auto` was the first attempt and the print preview showed
     it does not do what it reads like: the driver ignores the auto and
     offers its own fixed sheets, the shortest here being 80x210mm. A
     seven-centimetre receipt then fed fourteen centimetres of blank roll
     after it, every sale. The page is measured and cut to the content
     instead. */
  t.check(/@page\{size:80mm \$\{receiptPageHeightMM\(area\)\}mm;margin:0;\}/.test(fn),
    'the page is cut to the content, not left to a driver’s fixed sheet');
  /* margin:0 is load-bearing, learned from a printed receipt. A @page
     margin OFFSETS the content: 3mm of it pushed a 72mm receipt to span
     3..75mm across a head that reaches 72mm, and the last character of
     every right-aligned figure was cut off -- a printed 265,000 read as
     265,00. It also added its bottom margin to the roll. */
  t.check(!/margin:3mm/.test(fn),
    'with no page margin, which offset the content past the print head and fed extra roll');
  const css = (/\.receipt\{[\s\S]*?\}/.exec(src) || [''])[0];
  t.check(/width:72mm/.test(css) && /box-sizing:border-box/.test(css) && /padding:2mm/.test(css),
    'the receipt owns the full 72mm the head can reach, its inset taken from inside');
  // Against the CODE: the comment explaining why auto was abandoned
  // quotes the phrase, and should.
  t.check(!/size:80mm auto/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
    'and nothing still asks for an auto height the driver will not honour');
  const measure = extractFunction(src, 'receiptPageHeightMM', 'index.html');
  t.check(/left:-9999px/.test(measure),
    'measured off to one side, since #printArea is display:none and a hidden element has no height');
  t.check(/Math\.ceil\(px \/ 96 \* 25\.4\)/.test(measure),
    'rounded UP — a page half a millimetre short spills a second, almost-empty sheet');
  t.check(/Math\.max\(40,/.test(measure) && /if\(!el\) return 200;/.test(measure),
    'with a floor, and a sane fallback if the receipt somehow did not render');
  /* Measured to the LAST CHILD's bottom edge, not the container's
     height. Those are the same number today -- .receipt has no bottom
     padding and its last child no bottom margin, verified at 100.8mm
     both ways in the running app -- so this has no behaviour to observe
     and is pinned by shape instead. It is the definition that stays
     true the moment a footer grows a margin, which is exactly when a
     container's height quietly starts including paper nothing prints
     on. */
  t.check(/const last = el\.lastElementChild;/.test(measure)
    && /last \? last\.getBoundingClientRect\(\)\.bottom : box\.bottom/.test(measure),
    'the page ends at the last child’s bottom edge — the last ink, whatever the box grows into');
  /* And nothing sits below the footer. A document reference used to,
     repeating the invoice number already three rows from the top: 6.1mm
     of roll, measured, for a fact the paper had already stated. */
  const build = extractFunction(src, 'buildReceiptHTML', 'index.html');
  const tail = build.slice(build.lastIndexOf('shop.footer'));
  t.check(!/invoiceNumberLabel/.test(tail),
    'and the footer is the last thing printed — no reference repeated below it');
  t.check((makeScope().buildReceiptHTML(order(), null, null).match(/INV-0152/g) || []).length === 1,
    'so the invoice number reaches the paper exactly once');
  t.check(/clearInjectedPrintStyles\(\);/.test(fn),
    'any sheet a previous print left behind is cleared first — @page does not cascade by specificity');
  t.check(/area\.innerHTML = '';/.test(fn),
    'and #printArea is emptied afterwards, which the A5 paths never do');
  t.check(fn.indexOf('clearInjectedPrintStyles') < fn.indexOf("st.id = 'receipt80PrintStyle'"),
    'cleared BEFORE the new sheet is injected, or it would clear its own');
  /* statements-print.test.js already asserts every injected id is known
     to the cleaner. Registering here is what keeps that true. */
  t.check(/INJECTED_PRINT_STYLE_IDS = \[[^\]]*'receipt80PrintStyle'/.test(src),
    'the 80mm sheet is registered with the cleaner like the other four');

  /* The cash book was the ONE #printArea path that never cleared. Latent
     while every sheet was A5; with an 80mm sheet in play it printed the
     day report as a 72mm column with its right half off the paper. */
  const cb = (/cb_print'\)\.addEventListener[\s\S]{0,600}/.exec(src) || [''])[0];
  t.check(/clearInjectedPrintStyles\(\);/.test(cb),
    'and the cash book clears too — it was the last path that did not');
}

/* ---------- 8. one bit of ink ---------------------------------------- */
/*
 * A thermal head is on or off. Grey is faked by dithering dots and
 * prints as a smear, so the receipt's CSS may not contain one.
 */
{
  const css = (/\.receipt\{[\s\S]*?\.receipt \.r-foot\{[^}]*\}/.exec(src) || [''])[0];
  t.check(css.length > 0, 'the receipt CSS block is findable');
  const colours = css.match(/(?:color|background)\s*:\s*([^;!]+)/g) || [];
  const nonBlack = colours.filter((c) => !/#000|#fff|inherit|transparent/.test(c));
  t.check(nonBlack.length === 0,
    `nothing on the receipt is a colour a one-bit head cannot print${nonBlack.length ? ` (${nonBlack.join(', ')})` : ''}`);
  t.check(/width:72mm/.test(css), 'and it is laid out to the 72mm the printer can actually reach');
  // The block was dead for a long time — this is what makes it alive.
  t.check(/class="receipt"/.test(src), 'the class is rendered by something now, rather than being dead CSS');
}

/* ---------- 9. automatic, but only where it was asked for ------------ */
{
  const save = (/ip_save'\)\.addEventListener[\s\S]*?\n\}\);/.exec(src) || [''])[0];
  t.check(/if\(data\.presetAutoPrintReceipt\) printReceipt\(q, payment, q\.payments\.length-1\);/.test(save),
    'money received prints paper — the one moment that does not wait for a click');
  t.check(save.indexOf('saveData()') < save.indexOf('printReceipt'),
    'after the payment is saved, so a printer that is off cannot cost the shop the record');
  t.check(/presetAutoPrintReceipt: presets\.autoPrintReceipt !== false/.test(src),
    'on by default, and a setting rather than a code change');
  /* The identity fields carry no shop's name in the code.
     They were seeded with 'Telagon Hardware' / 'Jesco House Room JHB08'
     while this was being built, guarded so the seed only filled what was
     unset. The guard was the right shape and the seed was still wrong:
     this app is installed by more than one shop, and a default that is
     another business's real name and real room number is a letterhead
     lying in wait for whoever installs next. Nothing is lost by dropping
     it -- shopIdentity() falls back to the name the shop registered
     under, and the address and phone lines simply do not render until
     somebody fills them in. */
  t.check(/presetShopLegalName: presets\.shopLegalName \|\| ''/.test(src)
    && /presetShopAddress: presets\.shopAddress \|\| ''/.test(src),
    'the shop identity comes from the shop, with no name seeded into the code');
  // Placeholders are exempt, deliberately. A greyed-out "e.g. Telagon
  // Hardware" is a hint that shows an empty field what kind of thing goes
  // in it; it is never read, never stored and never printed. What must not
  // exist is a real business's name as a VALUE -- something that becomes
  // data, or reaches paper, without anyone typing it.
  const withoutHints = src.replace(/placeholder="[^"]*"/g, '');
  t.check(!/Telagon|Jesco/.test(withoutHints),
    'and no real business name or address survives as a value anywhere in the file');
  // Dropping the seed must not leave a receipt with a blank letterhead.
  const identity = (/function shopIdentity\(\)\{[\s\S]*?\n\}/.exec(src) || [''])[0];
  t.check(/name: \(d\.presetShopLegalName \|\| ''\)\.trim\(\) \|\| printedShopName\(\)/.test(identity),
    'a shop that has typed no legal name still gets a letterhead, from the name it registered under');
  t.check(/id="preset_auto_print_receipt"/.test(src), 'with a switch in Shop identity');
  // Reprints exist, and reuse the number rather than minting a new one.
  t.check(/class="q-remove-icon inv-pay-print"/.test(src) && /printReceipt\(q, \(q\.payments\|\|\[\]\)\[idx\], idx\)/.test(src),
    'any payment can be reprinted, carrying the number it carried the first time');
  t.check(/class="pc-icon-btn inv-doc-receipt"/.test(src) && /printReceipt\(q, null, null\)/.test(src),
    'and the whole sale can be printed from the Invoices row');
}

process.exit(t.done() ? 1 : 0);
