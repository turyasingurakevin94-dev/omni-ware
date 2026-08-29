#!/usr/bin/env node
'use strict';
/*
 * The assistant's hands, on the shop's own controls.
 *
 * ASSISTANT_TOOLS is the executor map behind the chat: thirty-four entries,
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

/* TODAY is read from the SAME todayISO() the executors call (assigned
   once the scope is compiled, below) -- a hardcoded date here failed
   the whole suite the first midnight after it was written, because
   debtor_payments' default-date path reads the real clock. */
let TODAY;
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
/* The sync engine's "this row reached the server" record, held so the
   offline case can be staged: a Proxy says every id landed; swapping in
   an empty object says none did. */
const lastSyncedStub = {
  suppliers: new Proxy({}, { get: () => true }),
  products: new Proxy({}, { get: () => true }),
};

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
  'debtCollectionsOn', 'debtLogIsInvoiceOwned', 'cashIsDebtCollection',
  'getStockQty', 'stockKey',
  'buildProductSuggestionEntries', 'supplierSkuIndex', 'searchTokens', 'matchesAllTokens',
  'productSearchText', 'productVariantLabel', 'variantLabel',
  'rankedPriceRows', 'productPriceRows', 'suggestedSellingPrice', 'effectiveMarkupRule',
  'captureSourcingLead', 'captureSourcingLeadAndSave', 'findSourcingLeadByText',
  'sourcingLeadsAll', 'sourcingCaptureToast', 'leadDistinctAskers',
  'buildVariantPriceRow', 'deriveWholesaleRetail', 'piecesPerUnitOrNull', 'tiersFromLegacyRow',
  'supFindDuplicate', 'supNormalisedName', 'firstFreeEntityId', 'ensurePresetCategory',
  'allProductVariantEntries', 'reorderRuleFor', 'inventoryLineFor', 'inventoryLineStats', 'sortInventoryLines',
  'shelfValueForKey', 'consignTally', 'consignedOnShelf',
  'getFIFOUnitCost', 'productUnitLabel', 'productPackInfo', 'matchesSubsequence',
  // The registry's own label builders: the dossier speaks its words,
  // not a second set of its own (see assistant-price-vocabulary).
  'prTierChipLabel', 'priceTierSummaryPart',
  'todayISO', 'accountLabel',
];
const scope = compileScope([
  extractDeclaration(src, 'ACCOUNTS', 'index.html'),
  extractDeclaration(src, 'AP_MAX_THREAD', 'index.html'),
  extractDeclaration(src, 'AP_MAX_STEPS', 'index.html'),
  extractDeclaration(src, 'apRound', 'index.html'),
  extractFunction(src, 'apMonthRange', 'index.html'),
  extractFunction(src, 'apCustomerById', 'index.html'),
  /* Explicit because it is a real dependency of every money-moving tool.
     It used to arrive by accident: apCustomerById was a one-liner and
     the extractor swept the next 29 lines in with it, this function
     among them. Widening apCustomerById removed the accident and left
     the dependency standing in the open, where it belongs. */
  extractFunction(src, 'apMovementDate', 'index.html'),
  extractFunction(src, 'apCustomerByName', 'index.html'),
  extractFunction(src, 'apPriceBasis', 'index.html'),
  extractFunction(src, 'apRuleWords', 'index.html'),
  extractFunction(src, 'apProductAttrs', 'index.html'),
  extractFunction(src, 'apSupplierPriceParts', 'index.html'),
  extractFunction(src, 'apEnsureSupplier', 'index.html'),
  extractFunction(src, 'apComboKey', 'index.html'),
  extractFunction(src, 'apSameCombo', 'index.html'),
  extractFunction(src, 'apImportParts', 'index.html'),
  extractFunction(src, 'apLastPaymentDate', 'index.html'),
  ...NAMES.map(n => extractFunction(src, n, 'index.html')),
  'let apQuoteInFlight = false;',
  extractDeclaration(src, 'ASSISTANT_TOOLS', 'index.html'),
  'function names(){ return {ASSISTANT_TOOLS, AP_MAX_THREAD, AP_MAX_STEPS, todayISO}; }',
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
  issueEntityId: async (kind, prefix) => prefix + '900',
  lastSynced: lastSyncedStub,
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

const { ASSISTANT_TOOLS: T, todayISO } = scope.names();
TODAY = todayISO();
const run = (name, input) => T[name].run(input || {});

/* ---------- 1. the gate labels are right ------------------------------ */
{
  const writes = ['create_quote', 'record_customer_payment', 'pay_supplier',
    'pay_staff_or_rent', 'add_expense', 'record_other_income', 'set_markup_rule',
    'create_product', 'add_supplier_price', 'import_price_list', 'add_sourcing_lead',
    'set_chase_timing', 'set_restock_rule', 'set_stage_limit'];
  const reads = ['find_customer', 'find_supplier', 'find_product', 'customer_statement',
    'list_debtors', 'debtor_payments', 'cash_on_hand', 'suppliers_owed', 'dues_owed',
    'recent_invoices', 'financial_summary', 'recommended_price', 'product_details',
    'stock_overview', 'purchase_plan', 'catalogue_names', 'standing_policies'];
  t.check(Object.keys(T).length === 34, `thirty-four executors (got ${Object.keys(T).length})`);
  writes.forEach(w => t.check(T[w] && T[w].confirm === true,
    `${w} demands a confirmation — it touches the books`));
  reads.forEach(r => t.check(T[r] && T[r].confirm === false,
    `${r} answers freely — it reads and nothing more`));
  writes.forEach(w => t.check(typeof T[w].summary === 'function',
    `${w} can say what it is about to do, in words, for the card`));
  const serverNames = [...read('api/assistant.js').matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map(m => m[1]);
  t.check(serverNames.length === 34 && serverNames.every(n => T[n]),
    'every tool the server offers has an executor here — an offered tool with no hands is a hang');
  // The three Manager reads join the free side of the ledger.
  t.check(T.shop_pulse && T.shop_pulse.confirm === false, 'shop_pulse answers freely — it reads and nothing more');
  t.check(T.manager_history && T.manager_history.confirm === false, 'manager_history answers freely — it reads and nothing more');
  t.check(T.week_review_data && T.week_review_data.confirm === false, 'week_review_data answers freely — it reads and nothing more');
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

/* ---------- 2c. one day of collections, partitioned ------------------- */
/*
 * "Which clients haven't paid today" is a partition of the DAY, not a
 * filter over the debtor list: somebody who cleared their whole balance
 * today owes nothing now and would vanish from a debtors-only view —
 * the exact day it matters that they appear.
 */
{
  /* Real payments carry the id of the cash receipt their money arrived
     on — recordCustomerPayment always writes one. A payment row with
     cashTxnId null is a CORRECTION (the drift repair's shape) and must
     not count, which is exactly what the last case below holds. */
  const pay = (date, amount)=> ({ id: nextId++, date, type: 'payment', amount, note: '', cashTxnId: 9000 + nextId });
  const charge = (date, amount)=> ({ id: nextId++, date, type: 'charge', amount, note: '' });
  data.customers = [
    { id: 1, name: 'Mulongo Hardware', phone: '', debt: 400000,
      debtLog: [charge('2026-08-01', 500000), pay(TODAY, 100000)] },
    { id: 2, name: 'Onora Peter', phone: '', debt: 300000,
      debtLog: [charge('2026-07-01', 350000), pay('2026-08-18', 50000)] },
    { id: 3, name: 'Ssebunya Joseph', phone: '', debt: 0,
      debtLog: [charge('2026-08-10', 150000), pay(TODAY, 150000)] },
    { id: 4, name: 'Dad', phone: '', debt: 200000,
      debtLog: [charge('2026-06-30', 200000)] },
  ];
  /* debtor_payments now also reads invoice payments and their cash
     receipts (debtCollectionsOn) — start this section from none, so
     quotes left behind by earlier sections cannot leak into the day. */
  data.savedQuotes = [];
  data.cashTxns = [];

  const day = run('debtor_payments', {});
  t.check(day.date === TODAY && day.paid_count === 2 && day.paid_total === 250000,
    `today's collections are counted whole (got ${JSON.stringify({ c: day.paid_count, t: day.paid_total })})`);
  t.check(day.paid[0].name === 'Ssebunya Joseph' && day.paid[0].paid === 150000 && day.paid[0].still_owes === 0,
    'the customer who CLEARED their debt today still appears — paid, owing nothing');
  t.check(day.paid[1].name === 'Mulongo Hardware' && day.paid[1].still_owes === 400000,
    'largest payment first, each with what still stands');
  t.check(day.not_paid_count === 2 && day.not_paid.every(r=> r.name !== 'Mulongo Hardware'),
    'a debtor who paid something today is NOT on the has-not-paid side');
  t.check(day.not_paid[0].name === 'Dad' && day.not_paid[0].last_paid === null,
    'oldest debt first, and never-paid says so');
  t.check(day.not_paid[1].name === 'Onora Peter' && day.not_paid[1].last_paid === '2026-08-18',
    'while a debtor who paid last week shows WHEN');
  t.check(day.not_paid_total === 500000, 'with the outstanding money summed whole');

  const other = run('debtor_payments', { date: '2026-08-18' });
  t.check(other.paid_count === 1 && other.paid[0].name === 'Onora Peter'
    && other.not_paid_count === 2,
    'any other day partitions by ITS ledger entries');

  /* The drift repair writes a payment-shaped correction row with no
     cash receipt behind it — "no money moves", its own confirm says.
     It must never turn a repair into a collection. */
  data.customers[3].debtLog.push({ id: nextId++, date: TODAY, type: 'payment', amount: 200000,
    cashTxnId: null, note: 'Balance correction — history did not add up to the balance shown' });
  const repaired = run('debtor_payments', {});
  t.check(repaired.paid_count === 2 && repaired.not_paid.some(r=> r.name === 'Dad'),
    'a drift-repair correction is not a collection — Dad still has not paid');

  const ld = run('list_debtors', {});
  t.check(ld.debtors[0].last_paid !== undefined
    && ld.debtors.some(r=> r.name === 'Onora Peter' && r.last_paid === '2026-08-18'),
    'and the plain debtor list now carries when each last paid');
}

/* ---------- 2d. the shelf at a glance --------------------------------- */
/*
 * "Update me about the stock" is an overview, not a 300-line list: the
 * value, where the money sits, what RAN OUT. Everything through the
 * Inventory screen's own stack — and its honesty rules: an uncosted
 * line is null, never zero, and ran-out means HAD stock (lot history),
 * so a product never tracked is not announced as missing.
 */
{
  data.products = [
    { id: 'PC1', name: 'Cement', type: 'simple', category: 'Building' },
    { id: 'PN1', name: 'Nails', type: 'simple', category: 'Building' },
    { id: 'PR1', name: 'Rope', type: 'simple', category: 'General' },
    { id: 'PX1', name: 'Glue', type: 'simple', category: 'General' },
  ];
  data.prices = [
    { id: 1, productId: 'PC1', variantIdx: null, supplierId: 'S1', retail: null, wholesale: 32000,
      unit: 'Bag', packUnit: '', packQty: 0, date: TODAY },
  ];
  data.stock = { PC1: 40, PN1: 0, PR1: 10 };
  data.stockLots = { PC1: [{ qty: 40, cost: 30000 }], PN1: [{ qty: 0, cost: 2000 }] };

  const ov = run('stock_overview', {});
  t.check(ov.total_value === 1200000 && ov.lines_in_stock === 2,
    `the shelf is valued at its costed lines (got ${JSON.stringify({ v: ov.total_value, n: ov.lines_in_stock })})`);
  t.check(ov.top_by_value[0].name === 'Cement' && ov.top_by_value[0].qty === 40
    && ov.top_by_value[0].value === 1200000 && ov.top_by_value[0].unit === 'Bag',
    'the biggest holding leads, with quantity, unit and value');
  t.check(ov.top_by_value[1].name === 'Rope' && ov.top_by_value[1].value === null
    && ov.uncosted_lines === 1,
    'a line with no recorded cost is null, never zero — cost unknown is not worthless');
  t.check(ov.ran_out_count === 1 && ov.ran_out[0] === 'Nails',
    'RAN OUT means had stock and has none — Nails, never the never-stocked Glue');

  const cem = run('stock_overview', { query: 'cement' });
  t.check(cem.total_value === 1200000 && cem.lines_in_stock === 1 && cem.ran_out_count === 0
    && cem.filter === 'cement',
    'a query narrows every figure to the matching lines');
  t.check(run('stock_overview', { query: 'zqxwv' }).matches === 0,
    'and a query matching nothing says so instead of describing an empty shop');
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
  t.check(priced.cost === 7000 && priced.basis === 'wholesale',
    `the priced one answers from its own row, WHOLESALE side first — this shop wholesales (got ${JSON.stringify(priced)})`);
  t.check(priced.retail_cost === 8000,
    'with the retail cost riding along for the day the owner asks for retail');
  t.check(priced.no_markup_rule === true && /wholesale/.test(priced.note),
    'and no wholesale rule on file is said, with what to do, never a guessed figure');

  /* The shop default reaches the assistant through the same resolver,
     and is NAMED as the default — claiming a product-specific rule
     that is not there would be a lie. */
  data.presetDefaultMarkup = { wholesaleType: 'percent', wholesaleValue: 20 };
  const defaulted = run('recommended_price', { product_id: 'P1', variant_index: 1 });
  t.check(defaulted.recommended_sell === 8400 && defaulted.via_shop_default === true,
    `with a shop default set, the ruleless variant prices at cost + default and says which book it came from (got ${JSON.stringify(defaulted)})`);
  delete data.presetDefaultMarkup;

  let threw = false;
  try{ run('recommended_price', { product_id: 'P999' }); } catch(e){ threw = true; }
  t.check(threw, 'a product that does not exist is an error, not an empty guess');
}

/* ---------- 3b. the dossier: one question, the whole product ---------- */
/*
 * "What do we know about X" must come back complete: stock, WHO sells
 * it and at what price, the markup rules, the suggested price. The
 * dossier assembles the same functions the screens read — and its
 * price block is recommended_price's own output, cross-called, so the
 * assistant can never hold two pricing arithmetics that drift.
 */
{
  data.suppliers = [
    { id: 'S1', name: 'Kampala Steel' },
    { id: 'S2', name: 'Jinja Traders' },
    { id: 'S3', name: 'Mbale Hardware' },
  ];
  data.products = [
    { id: 'P1', name: 'Mulper Hinges', type: 'variable', category: 'Fittings',
      shortDescription: 'Brass door hinges', notes: 'Fast mover',
      retailMarkupType: 'percent', retailMarkupValue: 30,
      variants: [
        { combo: { Type: 'Normal' } },
        { combo: { Type: 'Gold' }, retailMarkupType: 'fixed', retailMarkupValue: 2000 },
        { combo: { Type: 'Soft Close' } },
      ] },
    { id: 'P2', name: 'Cement', type: 'simple', category: 'Building',
      wholesaleMarkupType: 'percent', wholesaleMarkupValue: 10,
      retailMarkupType: 'percent', retailMarkupValue: 20 },
    { id: 'P3', name: 'G-MAN Bow Saw', type: 'simple', category: 'Furniture',
      wholesaleMarkupType: 'fixed', wholesaleMarkupValue: 10000 },
  ];
  data.prices = [
    { id: 1, productId: 'P1', variantIdx: 0, supplierId: 'S2', retail: 9000, wholesale: null,
      unit: 'Pc', packUnit: '', packQty: 0, date: '2026-08-01' },
    { id: 2, productId: 'P1', variantIdx: 0, supplierId: 'S1', retail: 8000, wholesale: null,
      unit: 'Pc', packUnit: 'Ctn', packQty: 20, date: '2026-08-10',
      tiers: [{ minQty: 1, price: 8000 }, { minQty: 20, price: 7500 }] },
    { id: 3, productId: 'P1', variantIdx: 0, supplierId: 'S3', retail: 7000, wholesale: null,
      unit: 'Pc', packUnit: '', packQty: 0, date: '2026-07-01', outOfStock: true },
    { id: 4, productId: 'P1', variantIdx: 1, supplierId: 'S1', retail: 10000, wholesale: null,
      unit: 'Pc', packUnit: '', packQty: 0, date: '2026-08-10' },
    { id: 5, productId: 'P2', variantIdx: null, supplierId: 'S2', retail: 36000, wholesale: 32000,
      unit: 'Bag', packUnit: '', packQty: 0, date: '2026-08-15' },
    { id: 6, productId: 'P3', variantIdx: null, supplierId: 'S1', retail: null, wholesale: 9500,
      unit: 'Pc', packUnit: 'Bundle', packQty: 10, date: '2026-08-24' },
  ];
  data.stock = { 'P1::0': 140, 'P1::1': 6, 'P2': 55 };

  const d = run('product_details', { product_id: 'P1' });
  t.check(d.name === 'Mulper Hinges' && d.description === 'Brass door hinges' && d.notes === 'Fast mover',
    'the product introduces itself — name, description, notes');
  t.check(d.markup_rules.retail === '30% on cost' && d.markup_rules.wholesale === null,
    'the markup rules arrive in words, and an unset rule is null, never a guess');
  t.check(d.variant_count === 3 && d.variants.length === 3, 'every variant accounted for');

  const normal = d.variants[0];
  t.check(normal.suppliers[0].supplier === 'Kampala Steel' && normal.suppliers[0].retail === 8000
    && normal.suppliers[1].supplier === 'Jinja Traders' && normal.suppliers[1].retail === 9000,
    `suppliers come cheapest first, by name and price (got ${JSON.stringify(normal.suppliers.map(s=>s.supplier))})`);
  t.check(normal.suppliers[0].pack === '20 Pc per Ctn', 'pack sizes ride along');
  t.check(normal.suppliers[0].packing === '20 Pc in a Ctn',
    'in the Price Registry’s own words, so the owner is never asked to confirm their own screen');
  t.check(normal.packing === '20 Pc in a Ctn',
    'and the packing is stated at the head of the dossier too');
  /* This assertion used to stop at the bare 7,500 while claiming the
     model could "speak the carton price" — and the model, handed a
     base-unit rung with no translation, asked the owner instead. The
     claim is now actually tested. */
  t.check(normal.suppliers[0].tiers.length === 2
    && normal.suppliers[0].tiers[1].price_per_unit === 7500
    && normal.suppliers[0].tiers[1].min_qty_packs === 1
    && normal.suppliers[0].tiers[1].price_per_pack === 150000,
    `volume tiers arrive translated into packs, so the model can SPEAK the carton price (got ${JSON.stringify(normal.suppliers[0].tiers[1])})`);
  t.check(/1 Ctn\+: 7,500 UGX \(150,000 UGX\/Ctn\)/.test(normal.suppliers[0].volume_pricing || ''),
    `and the whole ladder as the registry’s own sentence (got ${JSON.stringify(normal.suppliers[0].volume_pricing)})`);
  const oosRow = normal.suppliers.find(s=> s.out_of_stock);
  t.check(normal.suppliers.length === 3 && oosRow && oosRow.supplier === 'Mbale Hardware',
    'an out-of-stock supplier is NAMED and flagged — "does this supplier sell it" is answerable');
  t.check(normal.suppliers[normal.suppliers.length - 1].out_of_stock === true
    && normal.suppliers[0].out_of_stock === undefined,
    'ranked last, and never the one called cheapest');
  t.check(normal.suppliers_out_of_stock === 1,
    'and the count still travels beside the names');
  t.check(normal.in_stock === 140 && normal.cost === 8000 && normal.recommended_sell === 10400,
    `stock, best cost and the 30% suggestion (got ${JSON.stringify({ s: normal.in_stock, c: normal.cost, r: normal.recommended_sell })})`);
  const direct = run('recommended_price', { product_id: 'P1', variant_index: 0 });
  t.check(normal.cost === direct.cost && normal.recommended_sell === direct.recommended_sell
    && normal.basis === direct.basis && normal.name === direct.name,
    'the dossier price block IS recommended_price — one arithmetic, cross-called');

  const gold = d.variants[1];
  t.check(gold.recommended_sell === 12000
    && gold.retail_markup_override === '2,000 UGX added per unit (set on this variant itself)',
    `a variant with its own fixed rule overrides and says so (got ${JSON.stringify({ r: gold.recommended_sell, o: gold.retail_markup_override })})`);
  t.check(normal.retail_markup_override === undefined,
    'while a variant riding the product rule carries no override line');

  t.check(d.variants[2].no_price_on_file === true,
    'a variant with nothing on file says NO PRICE — honesty survives assembly');

  const simple = run('product_details', { product_id: 'P2' });
  t.check(simple.variant_count === 1 && simple.variants[0].variant_index === null
    && simple.variants[0].recommended_sell === 35200 && simple.variants[0].basis === 'wholesale',
    `a simple product is one block, priced WHOLESALE first even when both sides exist (got ${JSON.stringify(simple.variants[0].recommended_sell)})`);
  t.check(simple.variants[0].retail_cost === 36000 && simple.variants[0].retail_sell === 43200,
    'with the retail figures riding along for the day the owner asks for retail');
  t.check(simple.markup_rules.wholesale === '10% on cost' && simple.markup_rules.retail === '20% on cost',
    'both rules named in words');

  /* The live G-MAN case, verbatim: a fixed wholesale markup is added on
     the PACK and spread across its pieces — 9,500 + 10,000/10 = 10,500.
     The words must say pack too, or the model reads a false mismatch
     and sends the owner to check a setting that was healthy all along. */
  const saw = run('product_details', { product_id: 'P3' });
  t.check(saw.variants[0].recommended_sell === 10500 && saw.variants[0].cost === 9500,
    `a fixed wholesale markup spreads across the bundle (got ${JSON.stringify(saw.variants[0].recommended_sell)})`);
  t.check(saw.markup_rules.wholesale === '10,000 UGX added on each pack',
    'and the rule is WORDED per pack, so the words and the figure agree');

  const hint = run('find_product', { query: 'Cement' });
  t.check(hint.matches[0].cost === 32000 && hint.matches[0].suggested_sell_price === 35200,
    'find_product price hints stand on the same wholesale-first pick');

  let threw2 = false;
  try{ run('product_details', { product_id: 'P999' }); } catch(e){ threw2 = true; }
  t.check(threw2, 'an unknown id is an error pointing back to find_product');
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
  catch(e){ threw = /find_customer/.test(e.message) && /99/.test(e.message); }
  t.check(threw,
    'a vanished customer id fails with what to do — re-resolve — AND names the id it was handed, so a mismatch diagnoses itself');

  /* AN ID IS WHATEVER THE BOOKS MINTED. Ids are issued as C001-style
     strings (issueEntityId) while the oldest rows are plain numbers, and
     the schemas used to demand a number: live, the Manager reported "the
     statement tool rejects his id, C106" and it was right — the
     statement, the invoice list and RECORDING A PAYMENT were shut to
     every customer created since ids gained their prefix. */
  data.customers.push({ id: 'C106', name: 'Kasozi Traders', phone: '', debt: 250000, debtLog: [] });
  const byText = run('customer_statement', { customer_id: 'C106' });
  t.check(byText && /Kasozi/.test(JSON.stringify(byText)),
    'a C###-style id opens its own statement');
  const paidText = run('record_customer_payment', { customer_id: 'C106', amount: 50000, account: 'cash' });
  t.check(paidText.done === true && data.customers[1].debt === 200000,
    `and can be PAID — the defect shut the money path, not just a report (got ${data.customers[1].debt})`);
  const byNum = run('customer_statement', { customer_id: 1 });
  t.check(byNum && /Mulongo/.test(JSON.stringify(byNum)),
    'while a numeric id from the older rows still resolves — the fix widens, it never swaps one for the other');
  const asText = run('customer_statement', { customer_id: '1' });
  t.check(asText && /Mulongo/.test(JSON.stringify(asText)),
    'and the same id sent as text finds the same customer, since a model writes ids as words');
  data.customers.pop();
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

    /* ---------- 8b. the price registry, by voice ------------------- */
    /*
     * "Add jjaja walu as supplier for brushes 2 inch, he sells each
     * dozen at 8,000." The row must be the Registry's own row: built by
     * buildVariantPriceRow, one current price per product+variant+
     * supplier (REPLACE, keeping the row id and its out-of-stock flag),
     * and a new supplier goes through the graduation's two-save gate --
     * no price row may name a supplier the server never confirmed.
     */
    data.suppliers = [{ id: 'S1', name: 'Kampala Steel', phone: '0700', location: 'Kisenyi', notes: '' }];
    data.products = [
      { id: 'P10', name: 'Brushes 2 inch', type: 'simple', category: 'Tools' },
      { id: 'P11', name: 'Mulper Hinges', type: 'variable', category: 'Fittings',
        variants: [{ combo: { Type: 'Normal' } }, { combo: { Type: 'Gold' } }] },
    ];
    data.prices = [];

    const fs1 = run('find_supplier', { query: 'kampala steel' });
    t.check(fs1.exact_match === true && fs1.matches[0].id === 'S1' && fs1.matches[0].matched === 'name',
      'a supplier is found the way a customer is, exact tier first');
    const fsMiss = run('find_supplier', { query: 'jaja walu' });
    t.check(fsMiss.matches.length === 0 && fsMiss.all_names.length === 1
      && fsMiss.all_names[0].name === 'Kampala Steel',
      'and a miss returns the real supplier names on file, never a guess');

    t.check(T.add_supplier_price.confirm === true, 'writing a price demands the card');
    const card = T.add_supplier_price.summary({ product_id: 'P10', supplier_name: 'Jjaja Walu',
      unit: 'Dozen', price_per_unit: 8000, pieces_per_unit: 12 });
    t.check(/Jjaja Walu \(NEW/.test(card) && /8,000 UGX per Dozen \(12 pieces\)/.test(card),
      `the card says NEW supplier and the price in words (got "${card}")`);

    const dozen = await run('add_supplier_price', { product_id: 'P10', supplier_name: 'Jjaja Walu',
      unit: 'Dozen', price_per_unit: 8000, pieces_per_unit: 12 });
    t.check(dozen.done === true && dozen.supplier_created === true && dozen.supplier === 'Jjaja Walu',
      'the dozen case lands: a new supplier, created and confirmed synced first');
    t.check(data.suppliers.length === 2 && data.suppliers[1].id === 'S900',
      `with the server-issued S-number (got ${data.suppliers[1] && data.suppliers[1].id})`);
    const row = data.prices[0];
    t.check(row && row.unit === 'Dozen' && row.retail === 8000 && row.wholesale === null
      && row.piecesPerUnit === 12 && row.supplierId === 'S900',
      `and the Registry row is the Registry's own shape (got ${JSON.stringify(row)})`);
    t.check(row.priceSource === 'assistant',
      'stamped as the assistant’s entry — the card does not say "manually set" about a spoken price');
    t.check(/prc-source-pill assistant/.test(src) && />Assistant<\/span>/.test(src),
      'and the Registry renders that source as its own pill');
    t.check(row.tiers.length === 1 && row.tiers[0].minQty === 1 && row.tiers[0].price === 8000,
      'one tier: 8,000 for one dozen');

    const packed = await run('add_supplier_price', { product_id: 'P10', supplier_id: 'S1',
      unit: 'Pc', price_per_unit: 700, pack_unit: 'Ctn', pack_qty: 100, price_per_pack: 60000 });
    t.check(packed.retail === 700 && packed.wholesale === 600,
      `a pack quote derives the per-piece rate in code, never in the model (got ${JSON.stringify(packed)})`);

    const before = data.prices.find(r=> r.supplierId === 'S1');
    before.outOfStock = true; before.outOfStockSince = '2026-08-01';
    const again = await run('add_supplier_price', { product_id: 'P10', supplier_id: 'S1',
      unit: 'Pc', price_per_unit: 650 });
    const after = data.prices.find(r=> r.supplierId === 'S1');
    t.check(again.replaced === true && after.id === before.id && after.retail === 650
      && after.outOfStock === true && after.outOfStockSince === '2026-08-01',
      'a new single price lands on the same row — id and out-of-stock flag untouched');
    t.check(after.wholesale === 600 && after.tiers.length === 2,
      'and the carton rung SURVIVES it — one rung restated never erases the other');
    t.check(data.prices.filter(r=> r.supplierId === 'S1' && r.productId === 'P10').length === 1,
      'one current price per product+supplier, never a pile');

    let threwV = null;
    try{ await run('add_supplier_price', { product_id: 'P11', supplier_id: 'S1', unit: 'Pc', price_per_unit: 500 }); }
    catch(e){ threwV = e.message; }
    t.check(!!threwV && /variant/.test(threwV),
      'a variable product without its variant is refused, naming the fix');

    lastSyncedStub.suppliers = {};
    const offline = await run('add_supplier_price', { product_id: 'P10', supplier_name: 'Mbale Tools',
      unit: 'Pc', price_per_unit: 900 });
    t.check(offline.done === false && offline.supplier_created === 'Mbale Tools',
      'offline, the supplier is saved but the price says it could not follow');
    t.check(data.suppliers[2].id === 'S901'
      && !data.prices.some(r=> r.supplierId === 'S901'),
      'so no price row dangles on a supplier the server never confirmed');
    lastSyncedStub.suppliers = new Proxy({}, { get: () => true });
    t.check(data.customers.length === 0, 'and none of this ever touched a customer');

    /* ---------- 8c. markup rules, spoken --------------------------- */
    /*
     * "Wholesale = 10,000, retail = 2,000 per dozen" -- the rules are
     * the product form's own fields, written the same way (value 0 IS
     * "no rule"), and the reply carries the suggestion that NOW
     * follows, through recommended_price itself, where a misheard
     * figure shows itself at once. This shop speaks fixed amounts.
     */
    const mk = await run('set_markup_rule', { product_id: 'P10',
      retail_markup_type: 'percent', retail_markup_value: 25 });
    t.check(mk.done === true && data.products[0].retailMarkupType === 'percent'
      && data.products[0].retailMarkupValue === 25,
      'a spoken rule lands on the product, in the same fields the form writes');
    const direct2 = run('recommended_price', { product_id: 'P10' });
    t.check(mk.now_suggests && mk.now_suggests.price === direct2.recommended_sell,
      'and the reply carries the suggestion that now follows — recommended_price itself');

    const sum2 = T.set_markup_rule.summary({ product_id: 'P10',
      retail_markup_type: 'percent', retail_markup_value: 30 });
    t.check(/retail markup 30% on cost \(replaces 25% on cost\)/.test(sum2),
      `the card says what replaces what (got "${sum2}")`);

    const mkFix = await run('set_markup_rule', { product_id: 'P10',
      wholesale_markup_type: 'fixed', wholesale_markup_value: 10000 });
    t.check(mkFix.wholesale_rule === '10,000 UGX added on each pack',
      'a fixed wholesale rule reads per pack — this shop speaks fixed amounts');

    const mkVar = await run('set_markup_rule', { product_id: 'P11', variant_index: 1,
      retail_markup_type: 'fixed', retail_markup_value: 2000 });
    t.check(mkVar.done === true && data.products[1].variants[1].retailMarkupValue === 2000
      && data.products[1].retailMarkupValue === undefined,
      'a variant rule lands on the variant and leaves the product default untouched');
    t.check(run('product_details', { product_id: 'P11' }).variants[1].retail_markup_override
      === '2,000 UGX added per unit (set on this variant itself)',
      'and the dossier shows it as that variant’s own rule');

    const mkClear = await run('set_markup_rule', { product_id: 'P10',
      retail_markup_type: 'percent', retail_markup_value: 0 });
    t.check(mkClear.retail_rule === 'cleared'
      && run('product_details', { product_id: 'P10' }).markup_rules.retail === null,
      'value 0 clears — the form’s own "no rule", and the dossier agrees');

    let threwM = null;
    try{ await run('set_markup_rule', { product_id: 'P10', retail_markup_value: 10 }); }
    catch(e){ threwM = e.message; }
    t.check(!!threwM && /type/.test(threwM), 'a value without its type is refused');
    threwM = null;
    try{ await run('set_markup_rule', { product_id: 'P10' }); }
    catch(e){ threwM = e.message; }
    t.check(!!threwM, 'and so is a call carrying no rule at all');

    /* ---------- 8d. two quotes, two rungs -------------------------- */
    /*
     * The live failure, verbatim. "Each pack at 100,000, a carton has
     * 10 of them" is one rung plus PACKING — no carton price exists to
     * invent. "A carton becomes 800,000" is the SECOND rung of the same
     * ladder: saving it must keep the 100,000 single rung, because the
     * two are independent quotes. Updates merge into the ladder on
     * file; only what is restated changes.
     */
    data.products.push({ id: 'P12', name: 'Chair Pin Small', type: 'simple', category: 'Fittings' });

    const card1 = T.add_supplier_price.summary({ product_id: 'P12', supplier_name: 'Reagan Stuart',
      unit: 'Pack', price_per_unit: 100000, pack_unit: 'Carton', pack_qty: 10 });
    t.check(/no pack price quoted/.test(card1),
      `packing without a bulk quote says so on the card — nothing invented (got "${card1}")`);
    const reagan1 = await run('add_supplier_price', { product_id: 'P12', supplier_name: 'Reagan Stuart',
      unit: 'Pack', price_per_unit: 100000, pack_unit: 'Carton', pack_qty: 10 });
    const rrow = ()=> data.prices.find(r=> r.productId === 'P12');
    t.check(reagan1.done === true && reagan1.retail === 100000 && reagan1.wholesale === null
      && rrow().tiers.length === 1 && rrow().packQty === 10,
      `packing recorded, carton price NOT invented (got ${JSON.stringify(reagan1)})`);

    const card2 = T.add_supplier_price.summary({ product_id: 'P12', supplier_name: 'Reagan Stuart',
      pack_unit: 'Carton', pack_qty: 10, price_per_pack: 800000 });
    t.check(/100,000 UGX per Pack \(kept\)/.test(card2) && /800,000 UGX for a Carton of 10/.test(card2)
      && /Updates their entry/.test(card2),
      `the card shows BOTH rungs, the kept one marked (got "${card2}")`);
    const reagan2 = await run('add_supplier_price', { product_id: 'P12', supplier_name: 'Reagan Stuart',
      pack_unit: 'Carton', pack_qty: 10, price_per_pack: 800000 });
    t.check(reagan2.retail === 100000 && reagan2.wholesale === 80000
      && rrow().tiers.length === 2 && rrow().tiers[0].price === 100000 && rrow().tiers[1].price === 80000,
      `the carton rate joins the ladder WITHOUT erasing the single price (got ${JSON.stringify(reagan2.tiers)})`);
    t.check(reagan2.tiers.length === 2 && reagan2.tiers[0].min_qty === 1 && reagan2.tiers[1].min_qty === 10,
      'and the reply carries the whole ladder to read back');

    const resized = await run('add_supplier_price', { product_id: 'P12', supplier_name: 'Reagan Stuart',
      pack_unit: 'Carton', pack_qty: 5, price_per_pack: 350000 });
    t.check(rrow().tiers.length === 2 && rrow().tiers[1].minQty === 5 && rrow().tiers[1].price === 70000
      && rrow().packQty === 5 && resized.retail === 100000,
      'a changed pack size takes its old rung with it — a rate for cartons of 10 says nothing about cartons of 5');

    let threwP = null;
    try{ await run('add_supplier_price', { product_id: 'P12', supplier_id: 'S1', price_per_pack: 50000 }); }
    catch(e){ threwP = e.message; }
    t.check(!!threwP && /packing|first entry/.test(threwP),
      'a bare pack price with nothing on file is refused, naming what is missing');
    threwP = null;
    try{ await run('add_supplier_price', { product_id: 'P12', supplier_id: 'S1' }); }
    catch(e){ threwP = e.message; }
    t.check(!!threwP && /first entry/.test(threwP),
      'a first entry still demands the single-quantity price');
    threwP = null;
    try{ await run('add_supplier_price', { product_id: 'P12', supplier_name: 'Reagan Stuart' }); }
    catch(e){ threwP = e.message; }
    t.check(!!threwP && /Nothing to change/.test(threwP),
      'while an update saying nothing new is refused rather than re-saved');

    /* ---------- 8e. a NEW product, shaped like the form's own ------- */
    /*
     * The photo flow exposed the gap: seven items on a price list, no
     * way to create them. create_product mirrors the product form's
     * record EXACTLY -- same id allocator, default rules, sku rule,
     * category presets -- and carries the two disciplines that matter:
     * a name already on file never creates a twin, and pricing is told
     * to wait until the server has confirmed the product exists.
     */
    data.presetCategories = [];
    const cp = await run('create_product', { name: 'Pull Handle H-type', category: 'Fittings',
      variant_attributes: [
        { name: 'Size', values: ['400mm', '600mm'] },
        { name: 'Colour', values: ['Silver', 'Black'] }] });
    const newP = data.products.find(p=> p.id === cp.product_id);
    t.check(cp.done === true && cp.product_id === 'P900' && cp.synced === true,
      `a new product lands with the server-issued id, confirmed synced (got ${JSON.stringify(cp)})`);
    t.check(newP.type === 'variable' && newP.variants.length === 4
      && JSON.stringify(newP.variants[0].combo) === JSON.stringify({ Size: '400mm', Colour: 'Silver' })
      && newP.variants[0].sku === '400MM-SILVER',
      `two attributes cross into the full matrix, skus by the graduation rule (got ${JSON.stringify(newP.variants.map(v=> v.sku))})`);
    t.check(newP.wholesaleMarkupType === 'percent' && newP.wholesaleMarkupValue === 0
      && newP.agentDiscountWholesalePct === null && newP.variants[1].retailMarkupValue === 0
      && typeof newP.createdAt === 'string',
      'the record is the product form\'s own shape — default rules, null agent overrides, a birth date');
    t.check(data.presetCategories.some(c=> c.name === 'Fittings'),
      'and the category joins the presets, as the form would have it');

    const cpSimple = await run('create_product', { name: 'Wood Glue 500ml', category: 'General' });
    t.check(data.products.find(p=> p.id === cpSimple.product_id).type === 'simple'
      && cpSimple.variants === 0, 'no attributes makes a simple product');

    const beforeDup = data.products.length;
    let threwN = null;
    try{ await run('create_product', { name: '  pull handle H-TYPE ' }); }
    catch(e){ threwN = e.message; }
    t.check(!!threwN && /already exists/.test(threwN) && /P900/.test(threwN),
      'a name already on file is refused NAMING the existing product — a mishear never creates a twin');
    t.check(data.products.length === beforeDup, 'and nothing was pushed');
    t.check(/already exist/.test(T.create_product.summary({ name: 'pull handle h-type' })),
      'the card itself says so before anything is confirmed');
    t.check(/Create NEW product/.test(T.create_product.summary({ name: 'Brand New Thing', category: 'General' })),
      'while a genuinely new one is announced as NEW on the card');

    lastSyncedStub.products = {};
    const cpOffline = await run('create_product', { name: 'Tile Spacer 2mm', category: 'General' });
    t.check(cpOffline.synced === false && /Wait a moment/.test(cpOffline.note)
      && data.products.some(p=> p.id === cpOffline.product_id),
      'offline, the product keeps but the reply says pricing must wait for the server');
    lastSyncedStub.products = new Proxy({}, { get: () => true });

    /* ---------- 8f. the whole price list, one card ------------------ */
    /*
     * Maria Building Materials' typed list is ~88 rows; row-by-row that
     * is dozens of cards and more loop steps than exist. The bulk path:
     * catalogue_names hands the model the WHOLE catalogue in one read,
     * the review happens in chat, and import_price_list replays the
     * reviewed lines behind ONE card -- DELEGATING every write to
     * create_product.run and add_supplier_price.run, so the batch obeys
     * the exact laws the single tools do. Per-line failures are
     * collected, never fatal; only the supplier gate aborts the batch.
     */
    const cat = run('catalogue_names', {});
    t.check(cat.count === data.products.length && cat.products.length === data.products.length
      && cat.truncated === false, 'the whole catalogue comes back in one read');
    const catP11 = cat.products.find(p=> p.id === 'P11');
    t.check(catP11 && catP11.variants.length === 2
      && catP11.variants[0] === 'Normal' && catP11.variants[1] === 'Gold',
      'variant labels ride in order — a label\'s position IS its variant_index');
    t.check(!('variants' in cat.products.find(p=> p.id === 'P10')),
      'simple products carry no variant list — the result stays diet');

    const batch = { supplier_name: 'Maria Building Materials', items: [
      { product_id: 'P10', unit: 'Pc', price_per_unit: 700 },
      { product_id: 'P11', variant_index: 1, unit: 'Pc', price_per_unit: 4500 },
      { new_product: { name: 'Wire Nails', category: 'Nails',
          variant_attributes: [{ name: 'Size', values: ['2 inch', '4 inch'] }] },
        variant_combo: { Size: '2 inch' }, unit: 'Kg', price_per_unit: 6000,
        pack_unit: 'Carton', pack_qty: 20, price_per_pack: 100000 },
      { new_product: { name: 'Wire Nails' }, variant_combo: { Size: '4 inch' },
        unit: 'Kg', price_per_unit: 5500 },
      { new_product: { name: 'Hoe Handle' }, unit: 'Pc', price_per_unit: 3000 },
    ] };
    const cardI = T.import_price_list.summary(batch);
    t.check(/Maria Building Materials \(NEW/.test(cardI)
      && /5 price entries across 4 products/.test(cardI)
      && /creating 2 new products: Wire Nails, Hoe Handle/.test(cardI),
      `ONE card counts the whole batch honestly (got "${cardI}")`);

    const beforeImp = data.products.length;
    const imp = await run('import_price_list', batch);
    t.check(imp.done === true && imp.lines === 5 && imp.saved === 5 && !imp.failed
      && imp.supplier_created === true,
      `five lines land in one confirmed batch (got ${JSON.stringify(imp)})`);
    t.check(imp.products_created.length === 2 && data.products.length === beforeImp + 2,
      'two new products created ONCE each — lines sharing a name share the product');
    const wire = data.products.find(p=> p.name === 'Wire Nails');
    t.check(wire && wire.type === 'variable' && wire.variants.length === 2,
      'Wire Nails crosses into its two sizes, through create_product itself');
    const maria = data.suppliers.find(s=> s.name === 'Maria Building Materials');
    const wireRows = data.prices.filter(r=> r.productId === wire.id);
    t.check(!!maria && wireRows.length === 2 && wireRows.every(r=> r.supplierId === maria.id
      && r.priceSource === 'assistant'),
      'both size rows on file under the one new supplier, stamped as the assistant\'s');
    const r2in = wireRows.find(r=> r.variantIdx === 0);
    t.check(r2in && r2in.retail === 6000 && r2in.wholesale === 5000 && r2in.packQty === 20,
      `the 2-inch line carries both tiers — 6,000 single, the carton of 20 at 5,000/Kg (got ${JSON.stringify(r2in)})`);
    const r4in = wireRows.find(r=> r.variantIdx === 1);
    t.check(r4in && r4in.retail === 5500 && r4in.wholesale === null,
      'the 4-inch line has its single price and NO invented carton rate');
    t.check(data.prices.some(r=> r.productId === 'P11' && r.variantIdx === 1 && r.supplierId === maria.id),
      'and the existing variable product took its price on the exact variant');

    /* A "new" product that already exists attaches instead of twinning,
       and combos compare tolerantly -- the document says "4 INCH", the
       card on file says "4 inch". */
    const impDup = await run('import_price_list', { supplier_name: 'Maria Building Materials',
      items: [{ new_product: { name: '  WIRE NAILS ' }, variant_combo: { size: '4 INCH' },
        price_per_unit: 5200 }] });
    t.check(impDup.done === true && impDup.saved === 1 && impDup.products_created.length === 0
      && impDup.supplier_created === false,
      `a twin name attaches to the existing product — nothing created (got ${JSON.stringify(impDup)})`);
    t.check(data.products.filter(p=> /wire nails/i.test(p.name)).length === 1
      && data.prices.find(r=> r.productId === wire.id && r.variantIdx === 1).retail === 5200,
      'the price MERGED onto the existing 4-inch entry through the normal update law');

    /* An unconfirmed product blocks only its own lines. */
    lastSyncedStub.products = {};
    const imp2 = await run('import_price_list', { supplier_id: maria.id, items: [
      { product_id: 'P12', unit: 'Pc', price_per_unit: 1200 },
      { new_product: { name: 'Tile Cross 3mm' }, unit: 'Pkt', price_per_unit: 2500 },
    ] });
    t.check(imp2.done === true && imp2.saved === 1 && imp2.failed.length === 1
      && imp2.failed[0].item === 'Tile Cross 3mm' && /confirmed it yet/.test(imp2.failed[0].error),
      `an unconfirmed product fails ONLY its own lines, named with the reason (got ${JSON.stringify(imp2.failed)})`);
    const tileCross = data.products.find(p=> p.name === 'Tile Cross 3mm');
    t.check(imp2.products_created.includes('Tile Cross 3mm') && !!tileCross
      && !data.prices.some(r=> r.productId === tileCross.id),
      'the product kept, honestly reported, and NO price row dangles on it');
    lastSyncedStub.products = new Proxy({}, { get: () => true });

    /* A supplier the server never confirmed aborts the WHOLE batch. */
    lastSyncedStub.suppliers = {};
    const beforeGate = { p: data.products.length, r: data.prices.length };
    const imp3 = await run('import_price_list', { supplier_name: 'Never Synced Traders',
      items: [{ new_product: { name: 'Binding Wire' }, unit: 'Kg', price_per_unit: 4000 }] });
    t.check(imp3.done === false && /no products or prices were written/.test(imp3.note)
      && data.products.length === beforeGate.p && data.prices.length === beforeGate.r,
      'the supplier gate stops the batch BEFORE anything else lands');
    lastSyncedStub.suppliers = new Proxy({}, { get: () => true });

    /* Bad batches are refused BEFORE the card, naming the line. */
    let threwI = null;
    try{ await run('import_price_list', { supplier_name: 'Maria Building Materials', items: [
      { product_id: 'P10', unit: 'Pc', price_per_unit: 700 },
      { product_id: 'P10', price_per_unit: 720 } ] }); }
    catch(e){ threwI = e.message; }
    t.check(!!threwI && /Lines 1 and 2 both price/.test(threwI) && /merge them/.test(threwI),
      'two lines on one ladder are refused — an import must not silently self-overwrite');
    threwI = null;
    try{ await run('import_price_list', { supplier_name: 'X Traders', items: [
      { unit: 'Pc', price_per_unit: 700 } ] }); }
    catch(e){ threwI = e.message; }
    t.check(!!threwI && /Line 1 names no product/.test(threwI),
      'a line naming no product is refused by its line number');
    threwI = null;
    try{ await run('import_price_list', { supplier_name: 'X Traders', items: [
      { new_product: { name: 'Padlock Steel',
          variant_attributes: [{ name: 'Size', values: ['40mm', '50mm'] }] },
        unit: 'Pc', price_per_unit: 9000 } ] }); }
    catch(e){ threwI = e.message; }
    t.check(!!threwI && /variant_combo/.test(threwI),
      'a price on a variable NEW product must say which variant it is for');
    threwI = null;
    try{ await run('import_price_list', { supplier_name: 'X Traders', items: [
      { new_product: { name: 'Hinge Pin' }, unit: 'Pc' } ] }); }
    catch(e){ threwI = e.message; }
    t.check(!!threwI && /Line 1/.test(threwI) && /price_per_unit/.test(threwI),
      'a new product\'s line still needs its single-quantity price — the first-entry law');
    const cardBig = T.import_price_list.summary({ supplier_name: 'X Traders',
      items: Array.from({ length: 21 }, ()=> ({ product_id: 'P10', price_per_unit: 5 })) });
    t.check(/cannot run yet/.test(cardBig) && /at most 20/.test(cardBig),
      'twenty-one lines refuse on the card itself — a bigger call could not even be emitted whole');
    t.check(!data.suppliers.some(s=> /X Traders/.test(s.name)),
      'and none of the refused batches created their supplier');

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
