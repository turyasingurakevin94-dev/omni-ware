#!/usr/bin/env node
'use strict';
/*
 * Consigned goods, recognisable wherever they are handled.
 *
 * The feature shipped as a screen. Everywhere else in the app a
 * consignor's goods looked exactly like the shop's own, so the person
 * pricing a quote, reading an order, taking cash over the counter or
 * counting what the shelf is worth saw no difference and handled them as
 * if there were none -- which is the mistake the whole feature exists to
 * prevent. Four screens said something untrue or incomplete about a
 * hundred boards that belonged to somebody else:
 *
 *   the picker      "Bought at 25,500 UGX each" -- a purchase that never
 *                   happened, said to the person setting the price
 *   the order card  "1 from stock" -- true of the shelf, silent about
 *                   who owns what is on it
 *   receive payment three figures, none of which says that part of the
 *                   money coming in is already owed to somebody
 *   inventory       "Value here 2,677,500 UGX" of another firm's goods,
 *                   counted as the shop's wealth
 *
 * The rules this file holds to account:
 *
 *   ONE READING. Every screen asks the same functions whose the goods
 *   are, so a marker cannot say one thing here and another there.
 *
 *   FACT AND FORECAST ARE NOT THE SAME. An invoiced line records the
 *   lots it took; a draft has taken nothing and can only be told what
 *   the shelf holds. `certain` is how a screen knows which it has, and
 *   the wording follows it.
 *
 *   THE WHOLE LINE, NOT THE FRONT OF THE QUEUE. Two of the shop's own
 *   standing ahead of eight a consignor left is a shelf where a line of
 *   ten is mostly somebody else's.
 *
 *   THE CUSTOMER IS NOT TOLD. Whose goods these are is the shop's
 *   arrangement with its supplier. It belongs on the screens the staff
 *   read and on none of the paper a client is handed.
 *
 * Run: node test/consignment-visibility.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('consignment visibility');
const src = read('index.html');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const data = {
  products: [
    { id: 'P1', name: 'Gypsum board 9mm', category: 'Ceilings', variants: [] },
    { id: 'P2', name: 'Our own cement', category: 'Cement', variants: [] },
  ],
  suppliers: [
    { id: 'S1', name: 'Okuosi Gypsum (U) Ltd' },
    { id: 'S2', name: 'Roto Industry' },
  ],
  stock: {},
  stockLots: {},
  savedQuotes: [],
  presetReorderRules: {},
};

const env = {
  data,
  esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  fmtUGXPerUnit: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  productUnitLabel: () => 'Pcs',
  productPackInfo: () => null,
  quoteItemSellPrice: (it) => Number(it.sellPrice) || 0,
  supplierName: (id) => (data.suppliers.find((s) => s.id === id) || {}).name || '(unknown supplier)',
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
  ICON_WARN: '<svg class="icon"></svg>',
};

let scope = null; let err = null;
try {
  scope = compileScope([
    'stockKey', 'getStockQty', 'addStockLot', 'consumeStockLots', 'peekStockLots',
    'consignTally', 'consignedOnShelf', 'consignedForLine', 'consignedForOrder',
    'consignTagLabel', 'consignTagTitle', 'consignTagHTML',
    'consignedUnitCostForSale', 'sellBelowCostClause',
    'shelfValueForKey', 'inventoryValue', 'reorderRuleFor', 'inventoryLineFor', 'inventoryLineStats',
    'getFIFOUnitCost', 'invPaymentSummaryHTML',
  ].map((n) => extractFunction(src, n, 'index.html')),
  env,
  ['peekStockLots', 'consignTally', 'consignedOnShelf', 'consignedForLine', 'consignedForOrder',
    'consignTagLabel', 'consignTagTitle', 'consignTagHTML', 'consignedUnitCostForSale',
    'sellBelowCostClause', 'shelfValueForKey', 'inventoryValue', 'inventoryLineFor',
    'inventoryLineStats', 'getStockQty', 'stockKey', 'addStockLot', 'consumeStockLots',
    'invPaymentSummaryHTML']);
} catch (e) { err = e; }
t.check(!!scope, `the reading compiles${err ? ` (${err.message})` : ''}`);

const reset = () => { data.stock = {}; data.stockLots = {}; data.savedQuotes = []; };

/* ---------- 1. what one shelf is holding, and whose -------------------- */
if (scope) {
  reset();
  // 25 of the shop's own, bought first, then 105 a consignor left.
  data.stockLots.P1 = [{ qty: 25, cost: 24000 }, { qty: 105, cost: 25500, consign: 'S1' }];
  data.stock.P1 = 130;

  const c = scope.consignedOnShelf('P1', null);
  eq(c.qty, 105, 'the consigned units are counted apart');
  eq(c.ownedQty, 25, 'and the shop\'s own are what is left of the shelf count');
  eq(c.value, 105 * 25500, 'valued at what will fall due to the consignor');
  eq(c.consignors.length, 1, 'one consignor here');
  eq(c.consignors[0].supplierId, 'S1', 'named by id, so a deleted supplier cannot take the reading down');

  eq(scope.consignTagLabel(c), '105 of 130 Okuosi Gypsum (U) Ltd\'s',
    'the marker says how much of the shelf is theirs when part of it is not');

  // The whole shelf theirs: "105 of 105" would read as a partial holding.
  data.stockLots.P1 = [{ qty: 105, cost: 25500, consign: 'S1' }];
  data.stock.P1 = 105;
  eq(scope.consignTagLabel(scope.consignedOnShelf('P1', null)), 'Okuosi Gypsum (U) Ltd\'s',
    'and drops the fraction when every one of them is theirs');

  // Two consignors cannot both be named in a pill, so it stops claiming to.
  data.stockLots.P1 = [{ qty: 60, cost: 25500, consign: 'S1' }, { qty: 40, cost: 26000, consign: 'S2' }];
  data.stock.P1 = 100;
  const two = scope.consignedOnShelf('P1', null);
  eq(scope.consignTagLabel(two), 'Consigned', 'two consignors on one shelf are not named in the pill');
  const title = scope.consignTagTitle(two, false);
  t.check(/Okuosi Gypsum \(U\) Ltd \(60\)/.test(title) && /Roto Industry \(40\)/.test(title),
    `but every one of them is named in full where there is room (${title})`);

  reset();
  data.stockLots.P2 = [{ qty: 40, cost: 30000 }];
  data.stock.P2 = 40;
  eq(scope.consignTagLabel(scope.consignedOnShelf('P2', null)), null,
    'goods the shop bought carry no marker at all');
  eq(scope.consignTagHTML(scope.consignedOnShelf('P2', null), false), '',
    'so a shelf of our own renders nothing rather than an empty pill');
}

/* ---------- 2. the whole line, not the front of the queue ------------- */
/*
 * The reading this replaced looked at the first live lot and stopped.
 * A shelf with a couple of the shop's own standing in front of a
 * consignor's delivery therefore answered "none of theirs" to a line
 * that was almost entirely theirs -- and the warning that exists for
 * exactly that sale never fired.
 */
if (scope) {
  reset();
  data.stockLots.P1 = [{ qty: 2, cost: 24000 }, { qty: 8, cost: 25500, consign: 'S1' }];
  data.stock.P1 = 10;

  const peek = scope.peekStockLots('P1', null, 10);
  eq(peek.length, 2, 'a peek walks FIFO across as many lots as the quantity reaches');
  eq(peek[1].qty, 8, 'taking what it needs from each');
  eq(data.stockLots.P1[0].qty, 2, 'and takes nothing -- the shelf is untouched by a forecast');

  eq(scope.peekStockLots('P1', null, 2).length, 1, 'a small line stops inside the first lot');
  eq(scope.peekStockLots('P1', null, 0).length, 0, 'and no quantity reads nothing');

  const line = { productId: 'P1', variantIdx: null, qty: 10, unit: 'pc', supplierId: '__stock__' };
  eq(scope.consignedForLine(line).qty, 8, 'so a line of ten over that shelf is eight somebody else\'s');
  eq(scope.consignedForLine(line).certain, false,
    'and it is a forecast: the line has not been invoiced, so nothing has actually been taken');

  const warn = scope.sellBelowCostClause({ ...line, sellPrice: 20000, price: 0 });
  t.check(/below the 25,500 UGX you will owe/.test(warn),
    `the below-cost warning fires on the consigned part of a mixed line (${warn})`);
  t.check(/44,000 UGX over 8/.test(warn),
    `charged against the EIGHT that are theirs, not the whole ten (${warn})`);
}

/* ---------- 3. an invoiced line is a fact, a draft is not ------------- */
if (scope) {
  reset();
  data.stockLots.P1 = [{ qty: 50, cost: 25500, consign: 'S1' }];
  data.stock.P1 = 50;

  const invoiced = { productId: 'P1', variantIdx: null, qty: 4, supplierId: '__stock__',
    _stockLots: [{ qty: 4, cost: 25500, consign: 'S1' }] };
  const fact = scope.consignedForLine(invoiced);
  eq(fact.qty, 4, 'an invoiced line reads the lots it actually took');
  eq(fact.certain, true, 'and says so');
  t.check(/is owed to them for these/.test(scope.consignTagTitle(fact, true)),
    'so the wording is a debt that exists rather than one that might');

  const draft = { productId: 'P1', variantIdx: null, qty: 4, supplierId: '__stock__' };
  eq(scope.consignedForLine(draft).certain, false, 'a draft line has taken nothing yet');
  t.check(/falls due to them as these sell/.test(scope.consignTagTitle(scope.consignedForLine(draft), false)),
    'and is worded as what would happen, not as what has');

  /* A line bought in for the order is not off our shelf, whatever the
     shelf holds of the same product -- and the shelf here is entirely a
     consignor's, which is the fixture that catches a reading that
     ignores where the line is coming from. */
  const boughtIn = { productId: 'P1', variantIdx: null, qty: 4, supplierId: 'S2' };
  eq(scope.consignedForLine(boughtIn).qty, 0,
    'a line bought in from another supplier owes that supplier, not the consignor');
  // An order quoted from stock before the sentinel existed carries no
  // supplier at all, and the picker already reads that as our shelf.
  eq(scope.consignedForLine({ productId: 'P1', variantIdx: null, qty: 4 }).qty, 4,
    'while a line naming no supplier is off our shelf, as the picker reads it');
}

/* ---------- 4. money on one invoice ----------------------------------- */
if (scope) {
  reset();
  const invoice = {
    invoiced: true,
    amountPaid: 30000,
    items: [
      { productId: 'P1', variantIdx: null, qty: 4, sellPrice: 32500, supplierId: '__stock__',
        _stockLots: [{ qty: 4, cost: 25500, consign: 'S1' }] },
      { productId: 'P2', variantIdx: null, qty: 2, sellPrice: 40000, supplierId: '__stock__',
        _stockLots: [{ qty: 2, cost: 30000 }] },
    ],
  };
  const owed = scope.consignedForOrder(invoice);
  eq(owed.qty, 4, 'only the consigned line counts toward what is owed');
  eq(owed.value, 102000, 'priced at the consignor\'s cost, the basis the Consignment screen uses');
  eq(owed.certain, true, 'and an invoiced order states it as a fact');

  const html = scope.invPaymentSummaryHTML(invoice);
  t.check(/Total amt/.test(html) && /Balance due/.test(html), 'the payment modal keeps its three figures');
  t.check(/102,000 UGX of this is Okuosi Gypsum \(U\) Ltd's/.test(html),
    `and names what part of the money coming in is not the shop's (${html.replace(/\s+/g, ' ').slice(-220)})`);
  /* The debt does not shrink because the customer paid half. It fell due
     the moment the goods left the shelf, and somebody looking at a full
     drawer has to know that before they spend it. */
  t.check(/whether or not it is paid in full/.test(html),
    'and says plainly that part-payment does not part-cancel it');

  const plain = scope.invPaymentSummaryHTML({ invoiced: true, amountPaid: 0,
    items: [{ productId: 'P2', variantIdx: null, qty: 2, sellPrice: 40000, supplierId: '__stock__',
      _stockLots: [{ qty: 2, cost: 30000 }] }] });
  t.check(!/ip-consign/.test(plain),
    'an invoice of the shop\'s own goods says nothing extra -- the note appears when it is true');

  /* Voided and draft orders are excluded upstream of this, by the same
     rule consignmentAccrued follows: a sale that did not happen owes
     nothing. Pinned here because the payment modal is the one place a
     figure would be read as cash already in the drawer. */
  eq(scope.consignedForOrder({ items: [] }).qty, 0, 'an order with no lines owes nothing');
  eq(scope.consignedForOrder(null).qty, 0, 'and no order at all does not throw');
}

/* ---------- 5. the shelf is worth what the shop owns ------------------ */
/*
 * The card worked out its own value -- quantity times the FIFO unit cost,
 * over the WHOLE shelf -- while inventoryValue counted a consignor's
 * goods out. The two disagreed by exactly the consigned holding, so a
 * shop could read what its stock was worth in two places and get two
 * answers. Both now read shelfValueForKey.
 */
if (scope) {
  reset();
  data.stockLots.P1 = [{ qty: 25, cost: 24000 }, { qty: 105, cost: 25500, consign: 'S1' }];
  data.stock.P1 = 130;
  data.stockLots.P2 = [{ qty: 40, cost: 30000 }];
  data.stock.P2 = 40;

  const l = scope.inventoryLineFor(data.products[0], null);
  eq(l.qty, 130, 'the count is the whole shelf -- consigned units can be sold, which is the point');
  eq(l.value, 25 * 24000, 'but the value is only what the shop owns');
  eq(l.consignedValue, 105 * 25500, 'with the consignor\'s share reported beside it');
  t.check(!!l.consign, 'and the line knows to carry a marker');

  const whole = scope.inventoryValue();
  const byKey = ['P1', 'P2'].reduce((s, k) => s + scope.shelfValueForKey(k).value, 0);
  eq(Math.round(byKey), Math.round(whole.value),
    'the per-shelf reading and the balance sheet total agree by construction');
  const lines = [scope.inventoryLineFor(data.products[0], null), scope.inventoryLineFor(data.products[1], null)];
  eq(Math.round(scope.inventoryLineStats(lines).value), Math.round(whole.value),
    'so the Stock on hand strip and the balance sheet cannot state different money');
  eq(scope.inventoryLineStats(lines).consigned, 105 * 25500,
    'and what left that total is named rather than dropped');

  // A shelf that is entirely somebody else's is worth nothing TO US --
  // a known quantity, not a missing one.
  reset();
  data.stockLots.P1 = [{ qty: 105, cost: 25500, consign: 'S1' }];
  data.stock.P1 = 105;
  const all = scope.inventoryLineFor(data.products[0], null);
  eq(all.value, 0, 'a shelf that is all a consignor\'s values at nothing to the shop');
  eq(all.uncosted, false, 'which is not a missing cost -- the price is known, it is just not ours');
  eq(all.consignedValue, 105 * 25500, 'and what it is worth to them is stated');
}

/* ---------- 6. the five screens actually say it ----------------------- */
if (scope) {
  const fn = (name) => extractFunction(src, name, 'index.html');

  const picker = fn('renderIpStage');
  t.check(/consignTagHTML\(stockShelfConsign/.test(picker),
    'the item picker marks the OUR STOCK card');
  t.check(/Owed to \$\{[^}]*consignors\.length > 1[\s\S]{0,200}?each as they sell/.test(picker),
    'and stops calling a consignor\'s delivery a purchase');
  /* "Bought at" is still there for goods the shop DID buy, and must be:
     the honesty is in which branch runs, not in deleting the phrase. */
  t.check(/Bought at \$\{fmtUGX\(stockCost\)\} each/.test(picker),
    'while goods the shop bought still read as bought');

  t.check(/consignTagHTML\(consign, consign\.certain\)/.test(fn('orderMetaRowHTML')),
    'the order board card marks an order selling a consignor\'s goods');

  const prev = fn('orderPreviewLines');
  t.check(/consignedForLine\(it\)/.test(prev) && /From stock — \$\{consignTagLabel/.test(prev),
    'the order preview says whose the goods are as well as where they are');

  t.check(/ip-consign/.test(fn('invPaymentSummaryHTML')),
    'the receive-payment modal carries the note');

  const inv = fn('renderInventory');
  t.check(/consignTagHTML\(l\.consign, false\)/.test(inv), 'the inventory card carries the marker');
  t.check(/Not ours/.test(inv), 'and names the money that left its value');

  const quote = fn('renderQuoteItems');
  t.check((quote.match(/\$\{consignTag\}/g) || []).length === 2,
    'the quote editor marks the line on both the table row and the phone card');
  /* The supplier cell is a searchable input whose value is matched
     against supplier names. A marker inside it would be typed over. */
  t.check(!/supplierDisplayLabel[\s\S]{0,160}consignTag/.test(quote),
    'and keeps it out of the supplier picker, whose value is matched against names');
}

/* ---------- 7. the customer is never told ----------------------------- */
/*
 * "Apply it everywhere" is the natural way to break this later. Whose
 * goods these are is the shop's arrangement with its supplier; printing
 * it on a client's quote or receipt hands that client the supplier
 * relationship. Pinned on the builders themselves rather than on a
 * rendered string, so a marker added anywhere inside them is caught.
 */
{
  const CUSTOMER_FACING = ['buildQuoteA5HTML', 'buildReceiptHTML', 'waQuoteText', 'waOrderReceiptText'];
  CUSTOMER_FACING.forEach((name) => {
    const body = extractFunction(src, name, 'index.html');
    t.check(!/consign/i.test(body),
      `${name} says nothing about consignment -- it is paper the customer keeps`);
  });
}

/* ---------- 8. the marker can be read ---------------------------------- */
{
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const token = (name) => (new RegExp(`--${name}:(#[0-9A-Fa-f]{6})`).exec(src) || [])[1];

  const ink = token('ow-amber-ink'), ground = token('ow-amber-soft');
  t.check(!!ink && !!ground, 'both colours the tag names are defined in this file');
  t.check(ratio(ink, ground) >= 4.5,
    `and 10px bold on that ground clears AA (${ratio(ink, ground).toFixed(2)}:1)`);
  /* The lighter amber does not, which is why the tag does not use it --
     recorded here so a later "make it brighter" has to argue with a
     measurement rather than with taste. */
  t.check(ratio(token('ow-amber'), ground) < 4.5,
    'while the lighter amber beside it does not, which is why it is not the text colour');

  const rule = (/\.consign-tag\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/background:var\(--ow-amber-soft\)/.test(rule) && /color:var\(--ow-amber-ink\)/.test(rule),
    'the rule uses exactly the pair that was measured');
  t.check(/white-space:nowrap/.test(rule), 'and does not break a consignor\'s name across two lines');
  /* .both-tag carries margin-left:7px and every container it sits in
     zeroes it again. This one is spaced by the literal space its builder
     emits, which works in a flex row and in a plain text node alike. */
  t.check(!/margin-left/.test(rule),
    'it carries no margin of its own -- the space comes from the builder, so it is right in any container');
  t.check(/return ` <span class="consign-tag"/.test(extractFunction(src, 'consignTagHTML', 'index.html')),
    'and that space is a real character, not a gap only the eye can see');

  /* The supplier card's name used to grow into all the room left on its
     row, so the tag joining it had nowhere to go but into the quantity:
     "130 in stock" rendered as "130 in...". It now takes what it needs
     and the row wraps. Shrinking is still allowed, so a long supplier
     name on a narrow card still ellipsises rather than overflowing. */
  t.check(/\.q-sc-top\{[^}]*flex-wrap:wrap/.test(src), 'the supplier card head wraps');
  const nameRule = (/\.q-sc-name\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(/flex:0 1 auto/.test(nameRule),
    'and the name takes what it needs rather than all that is left, so the tag has somewhere to go');
  t.check(/text-overflow:ellipsis/.test(nameRule) && /min-width:0/.test(nameRule),
    'while still ellipsising a long supplier name when the row is genuinely tight');
}

t.done();
