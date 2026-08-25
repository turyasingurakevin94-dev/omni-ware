#!/usr/bin/env node
'use strict';
/*
 * The assistant's hands, on the shop's own controls.
 *
 * ASSISTANT_TOOLS is the executor map behind the chat: twenty entries,
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
/* The sync engine's "this row reached the server" record, held so the
   offline case can be staged: a Proxy says every id landed; swapping in
   an empty object says none did. */
const lastSyncedStub = { suppliers: new Proxy({}, { get: () => true }) };

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
  'buildVariantPriceRow', 'deriveWholesaleRetail', 'piecesPerUnitOrNull',
  'supFindDuplicate', 'supNormalisedName', 'firstFreeEntityId',
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
  extractFunction(src, 'apPriceBasis', 'index.html'),
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
  issueEntityId: async () => 'S900',
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

const { ASSISTANT_TOOLS: T } = scope.names();
const run = (name, input) => T[name].run(input || {});

/* ---------- 1. the gate labels are right ------------------------------ */
{
  const writes = ['create_quote', 'record_customer_payment', 'pay_supplier',
    'pay_staff_or_rent', 'add_expense', 'record_other_income', 'add_supplier_price',
    'add_sourcing_lead'];
  const reads = ['find_customer', 'find_supplier', 'find_product', 'customer_statement',
    'list_debtors', 'cash_on_hand', 'suppliers_owed', 'dues_owed', 'recent_invoices',
    'financial_summary', 'recommended_price', 'product_details'];
  t.check(Object.keys(T).length === 20, `twenty executors (got ${Object.keys(T).length})`);
  writes.forEach(w => t.check(T[w] && T[w].confirm === true,
    `${w} demands a confirmation — it touches the books`));
  reads.forEach(r => t.check(T[r] && T[r].confirm === false,
    `${r} answers freely — it reads and nothing more`));
  writes.forEach(w => t.check(typeof T[w].summary === 'function',
    `${w} can say what it is about to do, in words, for the card`));
  const serverNames = [...read('api/assistant.js').matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map(m => m[1]);
  t.check(serverNames.length === 20 && serverNames.every(n => T[n]),
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
  t.check(priced.cost === 7000 && priced.basis === 'wholesale',
    `the priced one answers from its own row, WHOLESALE side first — this shop wholesales (got ${JSON.stringify(priced)})`);
  t.check(priced.retail_cost === 8000,
    'with the retail cost riding along for the day the owner asks for retail');
  t.check(priced.no_markup_rule === true && /wholesale/.test(priced.note),
    'and no wholesale rule on file is said, with what to do, never a guessed figure');

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
  t.check(normal.suppliers.length === 2
    && normal.suppliers[0].supplier === 'Kampala Steel' && normal.suppliers[0].retail === 8000
    && normal.suppliers[1].supplier === 'Jinja Traders' && normal.suppliers[1].retail === 9000,
    `suppliers come cheapest first, by name and price (got ${JSON.stringify(normal.suppliers.map(s=>s.supplier))})`);
  t.check(normal.suppliers[0].pack === '20 Pc per Ctn', 'pack sizes ride along');
  t.check(normal.suppliers[0].tiers.length === 2 && normal.suppliers[0].tiers[1].price === 7500,
    'and so do volume tiers, so the model can speak the carton price');
  t.check(normal.suppliers_out_of_stock === 1,
    'a supplier marked out of stock is counted, not silently dropped');
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
      'a new figure REPLACES the old row — same id, out-of-stock flag untouched');
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
