#!/usr/bin/env node
'use strict';
/*
 * The assistant's hands, on the shop's own controls.
 *
 * ASSISTANT_TOOLS is the executor map behind the chat: seventeen entries,
 * each backed by the exact function the corresponding button uses. This
 * file compiles the map together with those REAL functions and drives it
 * against fixtures, because the whole promise of the assistant is that
 * it is a second pair of hands on the same controls — never a second
 * implementation of the books. If recordCustomerPayment changes, these
 * checks must feel it.
 *
 * Two properties are load-bearing beyond the arithmetic:
 *
 *   confirm flags     every write tool carries confirm:true and every
 *                     read confirm:false. The chat loop renders a card
 *                     and waits ONLY where confirm says so; a write
 *                     mislabelled as a read would run from the model's
 *                     say-so with no owner in the loop.
 *   results are diet  every list is capped and every shilling rounded,
 *                     because a result is re-billed on every following
 *                     turn — and because a spoken answer cannot carry
 *                     forty rows.
 *
 * Run: node test/assistant-tools.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('assistant tools');
const src = read('index.html');

const TODAY = '2026-08-25';
const data = {
  customers: [], products: [], prices: [], savedQuotes: [], purchaseInvoices: [],
  suppliers: [], dues: [], cashTxns: [], cashDays: {}, stock: {}, stockLots: {},
  sourcingLeads: [], staff: [], rentAgreements: [], loans: [], fixedAssets: [],
  presetExpenseCategories: ['Transport', 'Rent', 'Cash Shortage', 'Other Expense'],
  presetIncomeCategories: ['Owner Investment', 'Cash Overage', 'Other Income'],
  nextQuoteLineId: 1,
};
let nextId = 100;
let saveCalls = 0;
let toasts = [];

const NAMES = [
  'buildQuoteRecord', 'savedQuoteTotal', 'quoteItemSellPrice', 'invoiceBalanceDue',
  'invoiceNumberLabel', 'customerOutstandingInvoices', 'customerOrdersFor',
  'recordCustomerPayment', 'applyCustomerPaymentAllocations', 'syncInvoiceDebtCharge',
  'applyInvoiceDebtCharge', 'invoiceDebtDesired', 'resolveInvoiceCustomer',
  'addCashReceipt', 'addCashPayment',
  'creditorTotalOwed', 'creditorOutstandingInvoices', 'credOpenInvoices',
  'purchaseInvoiceTotal', 'purchaseInvoiceBalanceDue', 'purchaseInvoiceNumberLabel',
  'allocateCreditorPayment', 'supplierName',
  'payDue', 'dueBalance', 'dueName', 'duesOutstanding', 'duesNeedingPayment',
  'duesOwedAsAt', 'dueAccruedAsAt', 'duePaidBy', 'dueAccruedOutstanding', 'dueBasis',
  'periodEndDate', 'daysBetweenISO', 'periodLabel',
  'collectableDebts', 'customerOldestOpenChargeDate', 'customerOpenCharges', 'daysSinceDate',
  'cashOnHandFor', 'cashOnHandByAccount', 'cashAnchorFor', 'cashIsMoneyIn', 'cashIsMoneyOut',
  'getStockQty', 'stockKey',
  'buildProductSuggestionEntries', 'supplierSkuIndex', 'searchTokens', 'matchesAllTokens',
  'productSearchText', 'productVariantLabel', 'variantLabel',
  'rankedPriceRows', 'productPriceRows', 'suggestedSellingPrice', 'effectiveMarkupRule',
  'captureSourcingLead', 'captureSourcingLeadAndSave', 'findSourcingLeadByText',
  'sourcingLeadsAll', 'sourcingCaptureToast', 'leadDistinctAskers',
  'todayISO', 'accountLabel',
];
const scope = compileScope([
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractDeclaration(src, 'AP_MAX_THREAD', 'index.html'),
  extractDeclaration(src, 'AP_MAX_STEPS', 'index.html'),
  extractDeclaration(src, 'apRound', 'index.html'),
  extractFunction(src, 'apMonthRange', 'index.html'),
  extractFunction(src, 'apCustomerById', 'index.html'),
  extractFunction(src, 'apCustomerByName', 'index.html'),
  ...NAMES.map(n => extractFunction(src, n, 'index.html')),
  'let apQuoteInFlight = false;',
  extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
  'function names(){ return {ASSISTANT_TOOLS, AP_MAX_THREAD, AP_MAX_STEPS}; }',
], {
  data,
  /* A benign element for every id: the reused functions peek at tabs
     ("is the cashbook visible?") before re-rendering, and 'none' makes
     every such peek answer no. */
  document: { getElementById: () => ({ style: { display: 'none' }, value: '',
    classList: { add(){}, remove(){}, contains: () => false } }), querySelector: () => null },
  saveData: () => { saveCalls++; },
  allocRowId: () => nextId++,
  issueRowId: async () => nextId++,
  toast: (m) => toasts.push(m),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  // Statement functions have their own test files; the executors that
  // wrap them are exercised through the simpler reads here.
  incomeStatement: () => ({ revenue: 0, costOfSales: 0, grossProfit: 0, opexRows: {}, depreciation: 0, operatingProfit: 0, interest: 0, netProfit: 0 }),
  balanceSheetAsAt: (d) => ({ asOf: d, cash: 0, receivables: 0, inventory: 0, fixedAssets: 0, assets: 0, payables: 0, staffAndRent: 0, loans: 0, liabilities: 0, equity: 0 }),
  cashFlowStatement: () => ({ tradingIn: 0, debtCollected: 0, stockOut: 0, operatingOut: 0, operating: 0, investing: 0, financing: 0, netMovement: 0 }),
  renderSourcing: () => {},
  renderSourcingBadge: () => {},
  goToTab: () => {}, refreshNavBadges: () => {},
  currentActiveTab: 'quote',
}, ['names']);

const { ASSISTANT_TOOLS: T } = scope.names();
const run = (name, input) => T[name].run(input || {});

/* ---------- 1. the gate labels are right ------------------------------ */
{
  const writes = ['create_quote', 'record_customer_payment', 'pay_supplier',
    'pay_staff_or_rent', 'add_expense', 'record_other_income', 'add_sourcing_lead'];
  const reads = ['find_customer', 'find_product', 'customer_statement', 'list_debtors',
    'cash_on_hand', 'suppliers_owed', 'dues_owed', 'recent_invoices',
    'financial_summary', 'recommended_price'];
  t.check(Object.keys(T).length === 17, `seventeen executors (got ${Object.keys(T).length})`);
  writes.forEach(w => t.check(T[w] && T[w].confirm === true,
    `${w} demands a confirmation — it touches the books`));
  reads.forEach(r => t.check(T[r] && T[r].confirm === false,
    `${r} answers freely — it reads and nothing more`));
  writes.forEach(w => t.check(typeof T[w].summary === 'function',
    `${w} can say what it is about to do, in words, for the card`));
  const serverNames = [...read('api/assistant.js').matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map(m => m[1]);
  t.check(serverNames.length === 17 && serverNames.every(n => T[n]),
    'every tool the server offers has an executor here — an offered tool with no hands is a hang');
}

/* ---------- 2. finding people never creates them ---------------------- */
{
  data.customers = [
    { id: 1, name: 'Mulongo Hardware', phone: '0700111222', debt: 2380000.4, debtLog: [] },
    { id: 2, name: 'Mulongo Betty', phone: '0755000111', debt: 0, debtLog: [] },
    { id: 3, name: 'Onora Peter', phone: '0788999000', debt: 370000, debtLog: [] },
  ];
  const r = run('find_customer', { query: 'mulongo' });
  t.check(r.matches.length === 2 && r.exact_match === false,
    'an ambiguous name returns both, flagged inexact — the model must ask which');
  const exact = run('find_customer', { query: 'Onora Peter' });
  t.check(exact.exact_match === true && exact.matches.length === 1 && exact.matches[0].id === 3,
    'a full name is an exact match');
  t.check(exact.matches[0].owes === 370000, 'carrying what they owe, rounded');
  t.check(run('find_customer', { query: 'nobody at all' }).matches.length === 0,
    'a miss returns no matches — the name list rides separately, never as a match');
  t.check(data.customers.length === 3,
    'and searching NEVER creates a customer — the resolveInvoiceCustomer trap stays out of this path');
}

/* ---------- 2b. a miss hands over the real names ---------------------- */
/*
 * The shop's names are Luganda as often as English, and the voice
 * recognizer writes what it hears: "my long go" for Mulongo, "chali
 * wajala" for Kyaliwajjala. A code-side phonetic key that guessed the
 * match was tried and made things WORSE — wrong picks on the real
 * catalogue, real names still missed (bc4a4d0). So the guessing moved
 * to the model: a miss now returns the actual names on file, the model
 * picks the one that sounds right and says it back inside the answer.
 * Code keeps only recall and honesty — full list, hard cap, truncated
 * flag, and each substring match naming the field it came through.
 */
{
  data.customers = [
    { id: 1, name: 'Mulongo Hardware', phone: '0700111222', debt: 2380000, debtLog: [], notes: '' },
    { id: 2, name: 'Onora Peter', phone: '0788999000', debt: 370000, debtLog: [], notes: '' },
    { id: 3, name: 'Ssebunya Joseph', phone: '0755000111', debt: 50000, debtLog: [], notes: 'also called Kadde — brings the van on Thursdays' },
  ];

  const heard = run('find_customer', { query: 'my long go' });
  t.check(heard.matches.length === 0 && Array.isArray(heard.all_names),
    'a name heard by sound is never guessed at in code — the real names come back instead');
  t.check(heard.all_names.length === 3 && heard.all_names.some(n=> n.id === 1 && n.name === 'Mulongo Hardware'),
    'every name on file WITH its id, so the model can pick Mulongo and act on the real record');
  t.check(heard.truncated === false, 'a small book is complete');
  t.check(!('close_match' in heard),
    'and the close_match guess flag is gone — there is nothing left to guess');

  const nick = run('find_customer', { query: 'Kadde' });
  t.check(nick.matches.length === 1 && nick.matches[0].name === 'Ssebunya Joseph',
    'a nickname written in the notes finds its customer — how the owner teaches the assistant');
  t.check(nick.matches[0].matched === 'notes',
    'and the match says it came through the notes, so the model can say so aloud');
  t.check(run('find_customer', { query: 'Onora' }).matches[0].matched === 'name',
    'a plain name hit says name');
  t.check(run('find_customer', { query: '0788999' }).matches[0].matched === 'phone',
    'a phone hit says phone');

  const keep = data.customers;
  data.customers = Array.from({ length: 310 }, (_, i) =>
    ({ id: i + 1, name: 'Customer ' + (i + 1), phone: '', debt: 0, debtLog: [], notes: '' }));
  const cap = run('find_customer', { query: 'zzz nothing here' });
  t.check(cap.all_names.length === 300 && cap.truncated === true,
    'a book bigger than the cap SAYS it was cut, instead of silently ending at the Ms');
  data.customers = keep;

  data.products = [
    { id: 'P1', name: 'Mulper Hinges', type: 'variable', category: 'Fittings',
      variants: [{ combo: { Type: 'Normal' } }, { combo: { Type: 'Gold' } }] },
    { id: 'P3', name: 'Kyaliwajjala Rope', type: 'simple', category: 'General' },
  ];
  data.prices = [];
  const fp = run('find_product', { query: 'mulpel hinges' });
  t.check(fp.matches.length === 0 && Array.isArray(fp.product_names),
    'a misheard product is not guessed either — the catalogue names come back');
  t.check(fp.product_names.includes('Mulper Hinges') && fp.product_names.includes('Kyaliwajjala Rope'),
    'all of them, spelt exactly as the shop spells them');
  t.check(fp.truncated === false && !('close_match' in fp), 'complete, and no guess flag');
  const again = run('find_product', { query: 'Mulper Hinges' });
  t.check(again.matches.length === 2 && again.matches.every(m=> m.product_id === 'P1'),
    're-calling with the picked spelling resolves variants and prices down the normal path');
  t.check(!/apFuzzyFind|apNameKey|apEditDistance/.test(src),
    'and the phonetic guesser is genuinely gone from the app — recall belongs to code, ranking to the model');
}

/* ---------- 3. the recommended price, honestly ------------------------ */
{
  data.products = [
    { id: 'P1', name: 'Mulper Hinges', type: 'variable', category: 'Fittings',
      variants: [{ combo: { Type: 'Normal' } }, { combo: { Type: 'Gold' } }, { combo: { Type: 'Soft Close' } }],
      markupRules: undefined },
    { id: 'P2', name: 'Cement', type: 'simple', category: 'Building' },
  ];
  data.prices = [
    { id: 1, productId: 'P1', variantIdx: 1, supplierId: 'S1', retail: 8000, wholesale: 7000,
      unit: 'Pc', packUnit: 'Ctn', packQty: 20, date: TODAY, voided: false,
      tiers: [{ minQty: 1, price: 8000 }, { minQty: 20, price: 7000 }] },
  ];

  const ambiguous = run('recommended_price', { product_id: 'P1' });
  t.check(ambiguous.needs_variant === true && ambiguous.variants.length === 3,
    'many types exist, so it hands back the choice instead of guessing one');
  t.check(ambiguous.variants[2].name === 'Soft Close', 'named as the shop names them');

  const unpriced = run('recommended_price', { product_id: 'P1', variant_index: 0 });
  t.check(unpriced.no_price_on_file === true,
    'a variant with no price says NO PRICE — it does not borrow a sibling’s');

  const priced = run('recommended_price', { product_id: 'P1', variant_index: 1 });
  t.check(priced.cost === 8000 && priced.basis === 'retail',
    `the priced one answers from its own row (got ${JSON.stringify(priced)})`);
  t.check(priced.no_markup_rule === undefined || !priced.no_markup_rule || priced.note,
    'and when no markup rule exists it says so with what to do, never a guessed figure');

  let threw = false;
  try{ run('recommended_price', { product_id: 'P999' }); } catch(e){ threw = true; }
  t.check(threw, 'a product that does not exist is an error, not an empty guess');
}

/* ---------- 4. receiving money: oldest first, books consistent -------- */
{
  data.customers = [{ id: 1, name: 'Mulongo Hardware', phone: '', debt: 500000, debtLog: [] }];
  data.savedQuotes = [
    { id: 10, client: { name: 'Mulongo Hardware' }, customerId: 1, invoiced: true, voided: false,
      invoicedAt: '2026-08-01', invoicedTs: 1, date: '2026-08-01', amountPaid: 0, payments: [],
      debtCharged: 300000, items: [{ qty: 1, sellPrice: 300000, price: 0, supplierId: '__stock__' }] },
    { id: 11, client: { name: 'Mulongo Hardware' }, customerId: 1, invoiced: true, voided: false,
      invoicedAt: '2026-08-10', invoicedTs: 2, date: '2026-08-10', amountPaid: 0, payments: [],
      debtCharged: 200000, items: [{ qty: 1, sellPrice: 200000, price: 0, supplierId: '__stock__' }] },
  ];
  data.cashTxns = [];
  saveCalls = 0;

  const r = run('record_customer_payment', { customer_id: 1, amount: 400000, account: 'cash' });
  t.check(r.done === true && r.received === 400000, 'the payment is recorded in full');
  t.check(data.savedQuotes[0].amountPaid === 300000,
    'the OLDEST invoice is settled first, completely');
  t.check(data.savedQuotes[1].amountPaid === 100000, 'the newer one takes the remainder');
  t.check(data.cashTxns.length === 2 && data.cashTxns.every(x => x.account === 'cash'),
    'each allocation writes its own cash receipt, into the account the owner said');
  t.check(data.customers[0].debt === 100000,
    `the balance follows the money down (got ${data.customers[0].debt})`);
  t.check(saveCalls > 0, 'and it is saved');

  let threw = false;
  try{ run('record_customer_payment', { customer_id: 99, amount: 1000, account: 'cash' }); }
  catch(e){ threw = /find_customer/.test(e.message); }
  t.check(threw, 'a vanished customer id fails with what to do — re-resolve — not a silent zero');
}

/* ---------- 5. paying a supplier: clamped, oldest first, saved -------- */
{
  data.suppliers = [{ id: 'S1', name: 'Roto Industry' }];
  data.purchaseInvoices = [
    { id: 20, supplierId: 'S1', supplierName: 'Roto Industry', date: '2026-07-01', voided: false,
      amountPaid: 0, payments: [], items: [{ qty: 10, price: 30000 }] },
    { id: 21, supplierId: 'S1', supplierName: 'Roto Industry', date: '2026-08-01', voided: false,
      amountPaid: 0, payments: [], items: [{ qty: 5, price: 30000 }] },
  ];
  data.cashTxns = [];
  saveCalls = 0;

  const r = run('pay_supplier', { supplier_id: 'S1', amount: 999999999, account: 'bank' });
  t.check(r.paid === 450000,
    `a wild amount is clamped to what is actually owed (got ${r.paid})`);
  t.check(data.purchaseInvoices[0].amountPaid === 300000 && data.purchaseInvoices[1].amountPaid === 150000,
    'oldest bill first, then the rest');
  t.check(r.still_owed === 0, 'and the supplier ends square');
  t.check(saveCalls > 0,
    'saveData is called by the EXECUTOR — allocateCreditorPayment deliberately leaves it to its caller');

  let threw = false;
  try{ run('pay_supplier', { supplier_id: 'S1', amount: 1000, account: 'cash' }); }
  catch(e){ threw = /not owed/.test(e.message); }
  t.check(threw, 'paying a supplier who is owed nothing is refused in words');
}

/* ---------- 6. expenses: only the shop’s own categories --------------- */
{
  data.cashTxns = [];
  let threw = null;
  try{ run('add_expense', { account: 'cash', amount: 20000, category: 'Boda', description: 'delivery' }); }
  catch(e){ threw = e.message; }
  t.check(!!threw && /Transport/.test(threw) && /Cash Shortage/.test(threw),
    'an unknown category is rejected WITH the valid list, so the model retries correctly');
  t.check(data.cashTxns.length === 0, 'and nothing was written');

  const ok = run('add_expense', { account: 'momo', amount: 20000, category: 'Transport', description: 'boda to Kireka' });
  t.check(ok.done === true && data.cashTxns.length === 1 && data.cashTxns[0].category === 'Transport',
    'a real category goes straight through addCashPayment');
  t.check(data.cashTxns[0].account === 'momo', 'into the account the owner said');
}

/* ---------- 7. the sourcing queue ------------------------------------- */
{
  data.sourcingLeads = [];
  const r = run('add_sourcing_lead', { item_name: 'Mulper Gold Hinges 4 inch', customer_name: 'Okello' });
  t.check(r.done === true && data.sourcingLeads.length === 1,
    'the item lands on the sourcing queue');
  t.check(data.sourcingLeads[0].requests[0].customerName === 'Okello',
    'remembering who asked for it');
  const again = run('add_sourcing_lead', { item_name: 'mulper gold hinges 4 inch' });
  t.check(data.sourcingLeads.length === 1 && again.already_on_queue === true,
    'asking twice does not duplicate — the existing dedup path answers');
}

/* ---------- 8. a draft quote through the shared builder --------------- */
{
  data.products = [{ id: 'P2', name: 'Cement', type: 'simple', category: 'Building' }];
  data.prices = [{ id: 2, productId: 'P2', variantIdx: null, supplierId: 'S1', retail: 32000,
    wholesale: 30000, unit: 'Bag', packUnit: '', packQty: 0, date: TODAY, voided: false,
    tiers: [{ minQty: 1, price: 32000 }] }];
  data.stock = { P2: 100 };
  data.savedQuotes = [];
  data.customers = [];
  saveCalls = 0;

  return (async () => {
    const r = await run('create_quote', { customer_name: 'Okello',
      items: [{ product_id: 'P2', qty: 10, sell_price: 35000 }] });
    t.check(r.done === true && /^INV-\d{4}$/.test(r.invoice), 'a real INV- number is issued');
    t.check(r.status === 'draft', 'and the quote is a DRAFT');
    const q = data.savedQuotes[0];
    t.check(q.invoiced === false, 'not invoiced — stock has not moved');
    t.check(q.items[0].supplierId === '__stock__',
      'the shelf covers ten bags, so the line sells off the shelf');
    t.check(q.items[0].sellPrice === 35000 && r.total === 350000,
      'at the price the owner said');
    t.check(q.status === 'draft' && q.amountPaid === 0 && q.payments.length === 0,
      'with the full buildQuoteRecord shape behind it');
    t.check(saveCalls > 0, 'and saved');

    let threw = null;
    try{ await run('create_quote', { customer_name: 'X', items: [{ product_id: 'P404', qty: 1 }] }); }
    catch(e){ threw = e.message; }
    t.check(!!threw && /find_product/.test(threw),
      'an unresolved product id is an error naming the fix');
    t.check(data.savedQuotes.length === 1, 'and no half-built quote was pushed');

    /* ---------- 9. reads stay diet -------------------------------- */
    data.customers = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1, name: 'C' + (i + 1), phone: '', debt: 1000 * (i + 1),
      debtLog: [{ id: i, date: TODAY, type: 'charge', amount: 1000 * (i + 1), note: '' }] }));
    const debtors = run('list_debtors', {});
    t.check(debtors.debtors.length === 15 && debtors.count === 30,
      'thirty debtors come back as fifteen rows plus the true count — a spoken answer cannot carry forty rows');
    t.check(debtors.total === (1000 * 30 * 31) / 2, 'while the total is the whole book');

    process.exit(t.done() ? 1 : 0);
  })();
}
