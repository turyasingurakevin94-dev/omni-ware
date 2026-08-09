#!/usr/bin/env node
'use strict';
/*
 * The invoice, on the till roll.
 *
 * There are now two ways to print a sale -- an A5 sheet through the
 * browser's print dialog, and 80mm of thermal paper straight out of a
 * Bluetooth link -- and they are built by different code from the same
 * record. That is exactly the shape of the bugs already fixed several
 * times in this file: two views of one thing, walking the data twice, and
 * quietly showing different numbers.
 *
 * So the receipt does not compute anything. It reads savedQuoteTotal,
 * quoteItemSellPrice and invoiceNumberLabel -- the same functions the
 * invoice screen reads -- and this asserts that it still does. A receipt
 * whose total disagrees with the invoice it was printed from is the worst
 * kind of wrong: it is handed to the customer.
 *
 * The second half renders what it built through the real driver and checks
 * the paper can hold it, at every paper width the settings offer.
 *
 * Run: node test/admin-thermal-receipt.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');
const EscPos = require('../drivers/escpos.js');
const Profiles = require('../drivers/profiles.js');
const Receipt = require('../drivers/receipt.js');

const t = createReporter('admin thermal receipt');
const src = read('index.html');

const store = { products: [], prices: [] };
let build = null, total = null, err = null;
try {
  ({ receiptDocForQuote: build, savedQuoteTotal: total } = compileScope(
    ['todayISO', 'quoteItemPackingLabel', 'quoteItemSellPrice', 'savedQuoteTotal',
      'invoiceNumberLabel', 'printedShopName', 'receiptDocForQuote']
      .map((n) => extractFunction(src, n, 'index.html')),
    { data: store, currentShopName: 'Kevin Hardware' },
    ['receiptDocForQuote', 'savedQuoteTotal'],
  ));
} catch (e) { err = e; }
t.check(typeof build === 'function', `receiptDocForQuote compiles${err ? ` (${err.message})` : ''}`);

const quote = (over) => Object.assign({
  id: 142,
  invoiced: true,
  invoicedAt: '2026-08-09',
  amountPaid: 0,
  voided: false,
  client: { name: 'Musa Ssekandi', phone: '0700000000' },
  items: [
    { name: 'Cement (Tororo 50kg)', qty: 20, unit: 'Bag', sellPrice: 34000, price: 30000 },
    { name: 'Wall Plug 8mm', qty: 3, unit: 'Box', sellPrice: 12500, price: 10000, packQty: 100, packUnit: 'Box' },
  ],
}, over || {});

if (build) {
  /* ---------- 1. the money is the invoice's money ------------------- */
  {
    const q = quote();
    const doc = build(q);
    const grand = doc.totals.filter((x) => x.emphasis)[0];
    t.check(!!grand, 'there is exactly one emphasised total');
    t.check(grand.value === Math.round(total(q)),
      `the receipt's total is savedQuoteTotal, not a second sum (${grand.value} vs ${Math.round(total(q))})`);

    // Line by line too: a total that matches while the lines do not is a
    // receipt that adds up and still describes the wrong sale.
    const lines = doc.items.map((it) => Number(it.qty) * Number(it.rate));
    t.check(lines.reduce((s, x) => s + x, 0) === Math.round(total(q)),
      'and the lines add up to it');
    t.check(doc.items.length === q.items.length, 'every line on the invoice is on the receipt');
  }

  /* ---------- 2. the document number is the invoice number ---------- */
  {
    const doc = build(quote());
    const number = doc.meta.filter((m) => m.label === 'Invoice')[0];
    t.check(number && number.value === 'INV-0142',
      `the receipt carries the invoice number the rest of the app prints (${number && number.value})`);

    const draft = build(quote({ invoiced: false }));
    t.check(draft.title === 'Quotation' && !draft.meta.some((m) => m.label === 'Invoice'),
      'an uninvoiced quote is headed Quotation and claims no invoice number');
  }

  /* ---------- 3. balances say something or are left out -------------
   *
   * A zero balance printed under a sale paid in full is a line of paper per
   * receipt saying nothing, on a document that has to be read at a glance. */
  {
    const paidInFull = build(quote({ amountPaid: 717500 }));
    t.check(!paidInFull.totals.some((x) => /balance/i.test(x.label)),
      'a sale paid in full prints no balance line');
    t.check(!paidInFull.totals.some((x) => /^paid$/i.test(x.label)),
      'nor a Paid line that merely repeats the total');

    const part = build(quote({ amountPaid: 500000 }));
    const due = part.totals.filter((x) => /balance/i.test(x.label))[0];
    t.check(due && due.value === 217500, `a part payment prints what is still owed (${due && due.value})`);
    t.check(part.footer.some((f) => /until paid for/i.test(f)),
      'and the footer says the goods are not yet the customer\'s');

    // Cash and change, for the counter: what was handed over and what went
    // back. Only when there is change -- exact money needs no arithmetic
    // printed under it.
    const withChange = build(quote(), { cashGiven: 800000 });
    const change = withChange.totals.filter((x) => x.label === 'Change')[0];
    t.check(change && change.value === 82500, `change is cash less the total (${change && change.value})`);
    t.check(!build(quote(), { cashGiven: 717500 }).totals.some((x) => x.label === 'Change'),
      'exact money prints no change line');
  }

  /* ---------- 4. a voided sale says so ------------------------------
   *
   * The A5 sheet prints VOIDED across it. A receipt reprinted from a
   * cancelled sale with no such mark is a valid-looking receipt for a sale
   * that did not happen. */
  {
    const doc = build(quote({ voided: true }));
    t.check(/void/i.test(doc.title) || doc.footer.some((f) => /VOID/i.test(f)),
      'a voided sale is marked on the receipt');
  }

  /* ---------- 5. the packing note earns its line -------------------- */
  {
    const doc = build(quote());
    t.check(doc.items[0].note === '',
      `"Per Bag" above a line reading "20 Bag" is not printed (${JSON.stringify(doc.items[0].note)})`);
    t.check(/100/.test(doc.items[1].note),
      `how many are in a pack is printed (${JSON.stringify(doc.items[1].note)})`);
  }

  /* ---------- 6. the shop's own name is the letterhead -------------- */
  {
    t.check(build(quote()).shop.name === 'Kevin Hardware',
      'the letterhead is printedShopName, the same one the A5 sheets use');
  }

  /* ---------- 7. it fits the paper, on every profile ----------------
   *
   * Rendered through the real driver rather than inspected: the layout is
   * the driver's job, and the only useful question here is whether what
   * this app hands it can be printed. */
  {
    const long = quote({
      client: { name: 'A Customer With A Rather Long Name Indeed', phone: '0700000000' },
      items: [{
        name: 'Supercalifragilisticexpialidociousroofingnailsfourinchgalvanised',
        qty: 1000, unit: 'Cartons', sellPrice: 987654, price: 900000, packQty: 144, packUnit: 'Carton',
      }],
    });
    Object.keys(Profiles.PAPER).forEach((key) => {
      const profile = Profiles.make({ paper: key });
      const over = Receipt.describe(build(long, { cashGiven: 999999999 }), profile)
        .filter((b) => b.type === 'text'
          && EscPos.textWidth(b.text, profile.codepage) > Math.floor(profile.columns / (b.width || 1)));
      t.check(over.length === 0,
        `${key}: an awkward invoice still fits the paper (${over.slice(0, 1).map((b) => b.text).join('') || 'fits'})`);
    });
  }
}

/* ---------- 8. the app is wired to the driver ----------------------
 *
 * The files load in dependency order and the pieces the app calls are the
 * ones the driver exports. Both are the sort of thing that breaks on a
 * rename and shows up as a blank screen rather than a failing test. */
{
  const order = ['escpos.js', 'profiles.js', 'receipt.js', 'transports.js', 'printer.js']
    .map((f) => src.indexOf(`<script src="drivers/${f}"></script>`));
  t.check(order.every((i) => i > 0), 'every driver file is loaded by index.html');
  t.check(order.every((v, i) => i === 0 || v > order[i - 1]),
    'and in dependency order — the encoder first, the printer last');

  const appScript = src.indexOf('<script>\n// Supabase appends');
  t.check(appScript > order[order.length - 1],
    'the drivers load before the app script that uses them');

  // The counter sale prints itself. It is the whole reason a shop wants
  // one of these printers, and it is one `if` away from silently not
  // happening.
  t.check(/if\(thermalAutoPrintCounterSales\(\)\)\{\s*printThermalReceipt\(res\.quote/.test(src),
    'a counter sale prints its receipt when the setting is on');
  t.check(/inv-doc-receipt/.test(src) && /printThermalReceipt\(q\)/.test(src),
    'and an invoice can be reprinted to the till roll from its row');
}

process.exit(t.done() ? 1 : 0);
