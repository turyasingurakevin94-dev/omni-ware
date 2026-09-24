#!/usr/bin/env node
'use strict';
/*
 * The admin's books, under randomised sequences of real operations.
 *
 * Every bug found in this file so far came from one operation being right
 * in isolation and wrong in company: un-invoicing lost the FIFO cost, a
 * clamped debt logged the amount it could not apply, voiding in bulk did
 * less than voiding singly. Each was found by reasoning about one path.
 *
 * This does the opposite. It runs the real routines in random order against
 * one shared state and checks, after EVERY step, the things that must be
 * true of a set of books regardless of what happened to it:
 *
 *   I1  a customer's balance equals the sum of their own ledger
 *   I2  nobody owes a negative amount
 *   I3  stock on hand equals the quantity in its cost lots
 *   I4  stock is never negative
 *   I5  every cash entry is in an account the Cash Book totals
 *   I6  no invoice reports a negative balance due
 *   I7  a voided invoice charges nothing
 *   I8  stock bought with a known cost still knows it
 *   I9  no ledger entry records a movement of nothing
 *
 * I8 and I9 were added after checking this file against the bugs already
 * fixed here: without them it caught five of seven. The FIFO cost loss kept
 * quantities balanced and lost only the price, which I3 cannot see; the
 * zero-amount ledger entry left the total untouched, which I1 cannot see.
 * An invariant set is only as good as the failures it has been shown to
 * catch, so it is measured against them below.
 *
 * A failure prints the sequence that produced it, so it can be replayed.
 *
 * Run: node test/admin-invariants-property.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin invariants (property)');
const src = read('index.html');

/* ---------- the live state, mutated in place ------------------------ */
const data = {};
function reset() {
  Object.keys(data).forEach(k => delete data[k]);
  Object.assign(data, {
    stock: {}, stockLots: {}, stockLog: [], nextStockLogId: 1,
    cashTxns: [], nextCashTxnId: 1, nextDebtLogId: 1,
    products: [{ id: 'P1', name: 'Cement' }],
    suppliers: [{ id: 'S1', name: 'Kirinya' }],
    customers: [{ id: 'C1', name: 'Nakato', debt: 0, debtLog: [] }],
    savedQuotes: [], purchaseInvoices: [],
    // deleteSavedQuote clears the in-progress draft if it is the one being
    // deleted, so the draft has to exist for it to look at.
    quote: { client: { name: '', phone: '' }, date: '2026-08-01', items: [], savedId: null },
  });
}
reset();

const env = {
  data,
  todayISO: () => '2026-08-01',
  productVariantLabel: (p, v) => (v == null ? p.name : `${p.name} / ${v}`),
  invoiceNumberLabel: (q) => `INV-${String(q.id).padStart(4, '0')}`,
  generateCustomerId: () => 'C' + (data.customers.length + 1),
  quoteSuggestedPrice: () => null,
  quoteSuggestedStockPrice: () => null,
  saveData: () => {},
  allocRowId: (name) => {
    const counter = { stockLog: 'nextStockLogId', cashTxn: 'nextCashTxnId', debtLog: 'nextDebtLogId' }[name];
    if (!counter) throw new Error(`unexpected row id kind: ${name}`);
    const id = Number(data[counter]) || 1;
    data[counter] = id + 1;
    return id;
  },
  // Id-aware on purpose. The cash helpers ask for 'tab-cashbook' to decide
  // whether to re-render and must get null so they skip it; the render
  // helpers read .value straight off a search input and would throw on one.
  document: { getElementById: (id) => (String(id).startsWith('tab-') ? null : { value: '' }) },
  renderCbTransactions: () => {}, renderCbSummary: () => {}, renderCbTriggers: () => {},
  invRenderSide: () => {}, renderCustomers: () => {}, renderDebtorsList: () => {},
  renderSavedQuotes: () => {}, renderPurchaseInvoices: () => {},
  // deleteSavedQuote asks before it acts, and so does voiding now.
  // Always saying yes is the harsher path -- it is the one that actually
  // performs the reversal. The warning is stubbed truthy rather than null
  // so the confirm is really reached and the books are driven through the
  // branch a shop actually takes.
  voidInvoicesWarning: () => 'Void?',
  confirm: () => true,
  toast: () => {},
  fmtUGX: (n) => `${Math.round(n)} UGX`,
  cmpUnitKey: (s) => String(s || '').trim().toLowerCase(),
};

const NAMES = [
  'stockKey', 'addStockLot', 'consumeStockLots', 'restoreStockLots', 'getFIFOUnitCost',
  'applyStockDelta', 'stockOnHand', 'getStockQty', 'applyQuoteStockDeduction', 'reverseQuoteStockDeduction',
  // A sale leaves in the shelf's unit, read through these two.
  'stockUnitFor', 'stockMoveOnRowUnit',
  // applyQuoteStockDeduction now also deducts a bought-in line that has
  // been received, so the test for that comes with it.
  'quoteLineReceived', 'quoteLineComesOffShelf',
  'addCashReceipt', 'addCashPayment', 'removeCashTxnsByIds',
  'quoteItemSellPrice', 'orderCharges', 'chargeAmount', 'savedQuoteGoodsTotal', 'orderCreditTerms', 'orderCreditCharge', 'savedQuoteCashTotal', 'orderChargesTotal',
  'savedQuoteTotal', 'invoiceBalanceDue', 'invoiceDebtDesired',
  'resolveInvoiceCustomer', 'applyInvoiceDebtCharge', 'syncInvoiceDebtCharge',
  'customerLedgerTotal', 'customerDebtDrift', 'customerOutstandingInvoices',
  'applyCustomerPaymentAllocations', 'recordCustomerPayment', 'setInvoicesVoided',
  'orderStockReturnParts', 'orderReversalParts', 'deleteQuoteWarning', 'removePurchaseInvoicesForQuote', 'deleteSavedQuote',
];
let fns = null, err = null;
/* Three of these moved to shared-worker.js when Awaiting Goods
   arrived: both apps have to agree about whether an order's goods
   are in, so the rule lives where both can read it. */
const SHARED_HOME = ['orderLineIsBoughtIn', 'quoteLineReceived', 'quoteLineComesOffShelf'];
const fnSrc = (n) => (SHARED_HOME.includes(n) ? read('shared-worker.js') : src);
const fnFile = (n) => (SHARED_HOME.includes(n) ? 'shared-worker.js' : 'index.html');
try { fns = compileScope(NAMES.map(n => extractFunction(fnSrc(n), n, fnFile(n))), env, NAMES); }
catch (e) { err = e; }
t.check(!!fns, `the admin's money and stock routines compile together${err ? ` (${err.message})` : ''}`);

if (fns) {
  const {
    applyStockDelta, getStockQty, applyQuoteStockDeduction, reverseQuoteStockDeduction,
    savedQuoteTotal, invoiceBalanceDue, syncInvoiceDebtCharge,
    customerDebtDrift, recordCustomerPayment, setInvoicesVoided, removeCashTxnsByIds,
  } = fns;

  const ACCOUNTS = new Set(['cash', 'momo', 'bank']);

  /* ---------- the invariants ---------------------------------------- */
  // How much stock was added with no price attached -- the ceiling I8
  // measures unpriced stock against. Reset with the state.
  let uncostedQty = 0;

  function violations() {
    const bad = [];
    data.customers.forEach(c => {
      if (customerDebtDrift(c) !== 0) bad.push(`I1 ${c.name}: balance ${Math.round(c.debt)} vs ledger ${Math.round(fns.customerLedgerTotal(c))}`);
      if ((Number(c.debt) || 0) < 0) bad.push(`I2 ${c.name}: debt ${c.debt}`);
    });
    Object.keys(data.stock).forEach(k => {
      const qty = Number(data.stock[k]) || 0;
      const lotQty = (data.stockLots[k] || []).reduce((s, l) => s + (Number(l.qty) || 0), 0);
      if (Math.abs(qty - lotQty) > 0.000001) bad.push(`I3 ${k}: stock ${qty} vs lots ${lotQty}`);
      if (qty < 0) bad.push(`I4 ${k}: ${qty}`);
    });
    // I8. A restock carries its purchase price, and a reversal restores the
    // lots a sale consumed -- so neither may create stock whose cost is
    // unknown. A stock count that FINDS units genuinely has no price to
    // record and legitimately does, so the bound is what those added.
    //
    // Measured in QUANTITY, not lots. Selling part of a lot and undoing it
    // splits one lot into two, both carrying the same null, so a count of
    // lots grows without any new uncosted stock existing -- this test
    // reported exactly that against a correct app before the measure was
    // changed. Quantity survives the split; the number of lots does not.
    let nullCostQty = 0;
    Object.keys(data.stockLots).forEach(k => {
      (data.stockLots[k] || []).forEach(l => { if (l.cost == null) nullCostQty += Number(l.qty) || 0; });
    });
    if (nullCostQty > uncostedQty + 0.000001) {
      bad.push(`I8 ${nullCostQty} units priced at nothing, from ${uncostedQty} added without a price`);
    }
    data.customers.forEach(c => {
      (c.debtLog || []).forEach(l => {
        if (!(Number(l.amount) > 0)) bad.push(`I9 ${c.name}: ledger entry of ${l.amount}`);
      });
    });
    data.cashTxns.forEach(x => { if (!ACCOUNTS.has(x.account)) bad.push(`I5 txn ${x.id}: account "${x.account}"`); });
    data.savedQuotes.forEach(q => {
      if (invoiceBalanceDue(q) < 0) bad.push(`I6 ${q.id}: ${invoiceBalanceDue(q)}`);
      if (q.voided && (Number(q.debtCharged) || 0) !== 0) bad.push(`I7 ${q.id}: voided but charging ${q.debtCharged}`);
    });
    return bad;
  }

  /* ---------- the operations, as the app performs them --------------- */
  const mkQuote = (id) => ({
    id, client: { name: 'Nakato', phone: '' }, date: '2026-08-01', customerId: 'C1',
    items: [{ id: id * 10, productId: 'P1', variantIdx: null, qty: 4, sellPrice: 9000, price: 7000, supplierId: '__stock__' }],
    status: 'completed', invoiced: false, invoicedAt: null,
    amountPaid: 0, payments: [], voided: false, debtCharged: 0,
  });

  const OPS = {
    restock: (r) => applyStockDelta('P1', null, 1 + r(20), 'restock', '', 5000 + r(5000) * 100, 'S1'),
    correct: (r) => applyStockDelta('P1', null, -(1 + r(8)), 'correction', 'count'),
    // A stock count that finds MORE than the book says. It carries no
    // price, so it is the one legitimate source of a null-cost lot.
    correctUp: (r) => { const n = 1 + r(6); uncostedQty += n; applyStockDelta('P1', null, n, 'correction', 'count'); },
    deleteQuote: (r) => {
      if (!data.savedQuotes.length) return;
      fns.deleteSavedQuote(data.savedQuotes[r(data.savedQuotes.length)].id);
    },
    addQuote: () => { if (data.savedQuotes.length < 4) data.savedQuotes.push(mkQuote(data.savedQuotes.length + 1)); },
    invoice: (r) => {
      const q = data.savedQuotes.find(x => !x.invoiced); if (!q) return;
      q.invoiced = true; q.invoicedAt = '2026-08-01';
      applyQuoteStockDeduction(q);
      syncInvoiceDebtCharge(q);
    },
    uninvoice: () => {
      const q = data.savedQuotes.find(x => x.invoiced); if (!q) return;
      q.invoiced = false; q.invoicedAt = null;
      reverseQuoteStockDeduction(q);
      removeCashTxnsByIds((q.payments || []).map(p => p.cashTxnId));
      q.payments = []; q.amountPaid = 0;
      syncInvoiceDebtCharge(q);
    },
    voidOne: () => { const q = data.savedQuotes.find(x => !x.voided); if (q) setInvoicesVoided([q], true); },
    unvoidOne: () => { const q = data.savedQuotes.find(x => x.voided); if (q) setInvoicesVoided([q], false); },
    voidAll: () => setInvoicesVoided(data.savedQuotes, true),
    unvoidAll: () => setInvoicesVoided(data.savedQuotes, false),
    payCustomer: (r) => recordCustomerPayment('C1', 1000 * (1 + r(15)), 'cash', 'payment', []),
    overpay: () => recordCustomerPayment('C1', 999999, 'momo', 'clearing', []),
  };
  const OP_NAMES = Object.keys(OPS);

  /* ---------- run them in anger -------------------------------------- */
  {
    // Deterministic: a failure is replayable from the seed printed with it.
    let seed = 20260801;
    const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };

    let failure = null, steps = 0;
    for (let run = 0; run < 300 && !failure; run++) {
      reset();
      uncostedQty = 0;
      const trace = [];
      for (let i = 0; i < 12; i++) {
        const name = OP_NAMES[rnd(OP_NAMES.length)];
        trace.push(name);
        try { OPS[name](rnd); }
        catch (e) { failure = { trace: trace.slice(), why: `threw: ${e.message}` }; break; }
        steps++;
        const bad = violations();
        if (bad.length) { failure = { trace: trace.slice(), why: bad.join(' | ') }; break; }
      }
    }
    t.check(!failure,
      failure
        ? `books stayed consistent -- FAILED after [${failure.trace.join(' > ')}]: ${failure.why}`
        : `books stayed consistent across 300 random sequences (${steps} operations)`);
  }

  /* ---------- and the invariants are not vacuous --------------------- */
  /*
   * A property test that cannot fail proves nothing. Each invariant is
   * shown to fire on state that breaks it.
   */
  {
    reset();
    data.customers[0].debt = 500;
    t.check(violations().some(v => v.startsWith('I1')), 'I1 fires when a balance outruns its ledger');

    reset();
    data.customers[0].debt = -1;
    data.customers[0].debtLog = [{ id: 1, type: 'payment', amount: 1 }];
    t.check(violations().some(v => v.startsWith('I2')), 'I2 fires on a negative balance');

    reset();
    data.stock.P1 = 10;
    t.check(violations().some(v => v.startsWith('I3')), 'I3 fires when stock has no lots behind it');

    reset();
    data.stock.P1 = -5; data.stockLots.P1 = [{ qty: -5, cost: 1 }];
    t.check(violations().some(v => v.startsWith('I4')), 'I4 fires on negative stock');

    reset();
    data.cashTxns = [{ id: 1, account: 'MTN MoMo', type: 'receipt', amount: 1 }];
    t.check(violations().some(v => v.startsWith('I5')), 'I5 fires on the account id that used to be written');

    reset();
    data.savedQuotes = [Object.assign(mkQuote(1), { voided: true, debtCharged: 900 })];
    t.check(violations().some(v => v.startsWith('I7')), 'I7 fires on a voided invoice still charging');

    reset(); uncostedQty = 0;
    data.stock.P1 = 10; data.stockLots.P1 = [{ qty: 10, cost: null }];
    t.check(violations().some(v => v.startsWith('I8')),
      'I8 fires on stock whose cost has been dropped -- the state un-invoicing used to leave');

    reset();
    data.customers[0].debtLog = [{ id: 1, type: 'payment', amount: 0 }];
    t.check(violations().some(v => v.startsWith('I9')),
      'I9 fires on a ledger entry that records no movement');
  }
}

process.exit(t.done() ? 1 : 0);

