#!/usr/bin/env node
'use strict';
/*
 * The records behind a figure.
 *
 * Every line on the statements is a sum, and a sum on its own has to be
 * taken on trust. Clicking a line now opens the records it was summed
 * from — the invoices behind revenue, the cash entries behind a cost
 * category, the bills behind payables, per customer, per product, per
 * loan.
 *
 * The property this file exists to prove is RECONCILIATION: for every
 * drillable line, the preview's rows add up to exactly the figure the
 * statement shows, because both are computed from the same primitives.
 * A preview that showed less than its statement would teach a reader to
 * distrust precisely the thing built to earn trust — so the panel also
 * carries a tripwire that says so out loud, and that tripwire is tested
 * too, in both directions.
 *
 * Run: node test/statement-drill-down.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('statement drill-down');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const store = { customers: [], suppliers: [], purchaseInvoices: [], cashTxns: [], savedQuotes: [],
  dues: [], staff: [], rentAgreements: [], loans: [], stockLots: {}, stockLog: [], products: [] };
let fns = null, err = null;
const env = {
  data: store,
  todayISO: () => '2026-08-21',
  fmtUGX: (n) => `${Math.round(Number(n) || 0)} UGX`,
  esc: (x) => String(x == null ? '' : x),
  anShiftDate: (iso, d) => {
    const dt = new Date(iso + 'T00:00:00Z'); dt.setUTCDate(dt.getUTCDate() + d);
    return dt.toISOString().slice(0, 10);
  },
  // Trading figures come from the sales analytics; stubbed at the same
  // boundary the app calls them across, with fixture invoices.
  anInvoicesInRange: (from, to) => store.savedQuotes.filter(q => {
    const d = q.invoicedAt || q.date; return q.invoiced && !q.voided && d >= from && d <= to;
  }),
  anInvoiceTotals: (q) => ({ sales: q._sales || 0, cost: q._cost || 0, estimatedQty: q._est || 0 }),
  invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
  purchaseInvoiceNumberLabel: (pi) => 'PINV-' + String(pi.id).padStart(4, '0'),
  // Assets and loans, stubbed as data-shaped fixtures.
  liveFixedAssets: () => [],
  assetChargeBetween: () => 0,
  assetNBVAt: () => 0,
  assetIsDisposed: () => false,
  liveLoans: () => store.loans,
  loanOutstanding: (l, asOf) => l._outstanding != null ? l._outstanding : 0,
  loanInterestPaidBetween: (l) => l._interest || 0,
  loanFees: (l) => l._fees || 0,
  cashOnHandFor: (account, asOf) => store.cashTxns
    .filter(t => t.account === account && String(t.date || '') <= asOf)
    .reduce((s, x) => s + (x.type === 'receipt' || x.type === 'in' ? 1 : -1) * (Number(x.amount) || 0), 0),
  dashTotalDebtors: () => store.customers.reduce((s, c) => s + (Number(c.debt) || 0), 0),
  // The today path of payablesAsAt short-circuits to this, so it has to
  // agree with the fixtures the way the real one agrees with the app.
  dashTotalCreditors: () => store.purchaseInvoices
    .filter(pi => !pi.voided && store.suppliers.some(x => x.id === pi.supplierId))
    .reduce((s, pi) => s + Math.max(0, pi.items.reduce((n, it) => n + it.qty * it.price, 0) - (Number(pi.amountPaid) || 0)), 0),
  duesOwed: () => ({ total: 0, wages: 0, rent: 0, count: 0, uncostedCount: 0 }),
  inventoryValue: () => ({ value: 0, uncostedQty: 0 }),
};
const NAMES = [
  /* Payables now include consignment that has sold and not been settled
     -- money owed with no bill yet -- so its chain comes along. A
     fixture holding nothing on consignment simply reads zero. */
  'consignmentHeld', 'consignmentAccrued', 'consignmentSettlements',
  'consignmentSettled', 'consignmentRows', 'consignmentOwedTotal',
  'cashIsMoneyIn', 'cashIsMoneyOut', 'cashIsOperatingExpense', 'cashIsTradingIncome', 'cashIsOwnerWithdrawal', 'cashIsDebtCollection', 'invoiceBackedCashTxnIds',
  'cashIsCashShortage', 'cashIsCashOverage',
  'dashCashTxnsInRange', 'purchaseInvoiceTotal', 'payablesAsAt', 'receivablesAsAt',
  'cashFlowStatement', 'stDrillData', 'stDrillPanelHTML',
  // The drill labels read through the same who-paid resolver the cash
  // book screen uses, so a txn preview names the client too.
  'cbTxnDisplayDesc',
  // The real label pair — a stub here once hid that the stock preview
  // never found a product at all and printed raw keys instead of names.
  'productVariantLabel', 'variantLabel',
];
try {
  fns = compileScope(
    [extractDeclaration(src, 'ACCOUNTS', 'index.html'),
      extractDeclaration(src, 'CASH_NOT_OPEX', 'index.html'),
      extractDeclaration(src, 'CASH_OWNER_WITHDRAWAL', 'index.html'),
      extractDeclaration(src, 'CASH_NOT_REVENUE', 'index.html'),
      extractDeclaration(src, 'CASH_SHORTAGE_CATEGORY', 'index.html'),
      extractDeclaration(src, 'CASH_OVERAGE_CATEGORY', 'index.html'),
      extractDeclaration(src, 'CASH_VARIANCE_LINE', 'index.html'),
      extractDeclaration(src, 'ST_DRILL_MAX_ROWS', 'index.html'),
      // cashHas is a const arrow, so it is pulled as a declaration.
      extractDeclaration(src, 'cashHas', 'index.html'),
      'let stDrillKey = null; function setDrillKey(k){ stDrillKey = k; }',
      ...NAMES.map(n => extractFunction(src, n, 'index.html'))],
    env, [...NAMES, 'setDrillKey'],
  );
} catch (e) { err = e; }
t.check(!!fns, `the drill routines compile${err ? ` (${err.message})` : ''}`);

if (fns) {
  const { stDrillData, stDrillPanelHTML, cashFlowStatement, payablesAsAt, receivablesAsAt, setDrillKey } = fns;

  const rowsSum = (d) => (d.rows || []).reduce((s, r) => s + (Number(r.v) || 0), 0);
  const reconciles = (d, what) => {
    t.check(!!d, `${what}: the provider answers`);
    if (!d) return;
    const sum = rowsSum(d);
    t.check(Math.abs(sum - d.expect) < 1,
      `${what}: ${d.rows.length} row(s) add up to the statement figure (${sum} vs ${d.expect})`);
  };

  // A trading month with something behind every kind of line.
  const seed = () => {
    store.savedQuotes = [
      { id: 1, invoiced: true, voided: false, invoicedAt: '2026-08-03', client: { name: 'Onora' }, _sales: 500000, _cost: 300000 },
      { id: 2, invoiced: true, voided: false, invoicedAt: '2026-08-10', client: { name: 'Mulongo' }, _sales: 700000, _cost: 450000, _est: 2 },
      { id: 3, invoiced: true, voided: false, invoicedAt: '2026-07-01', client: { name: 'OldSale' }, _sales: 999999, _cost: 1 },
    ];
    store.cashTxns = [
      { id: 1, date: '2026-08-02', account: 'cash', type: 'receipt', category: 'Sales', amount: 400000, description: 'Till' },
      { id: 2, date: '2026-08-04', account: 'cash', type: 'payment', category: 'Transport', amount: 50000, description: 'Fuel' },
      { id: 3, date: '2026-08-05', account: 'momo', type: 'payment', category: 'Stock Purchase', amount: 120000, description: 'PINV pay' },
      { id: 4, date: '2026-08-06', account: 'bank', type: 'receipt', category: 'Debt Collection', amount: 80000, description: 'Onora paid' },
      { id: 5, date: '2026-08-07', account: 'cash', type: 'receipt', category: 'Owner Investment', amount: 900000, description: 'Owner' },
      { id: 6, date: '2026-08-08', account: 'cash', type: 'payment', category: 'Loan Repayment', amount: 60000, description: 'Repay' },
      { id: 7, date: '2026-07-20', account: 'cash', type: 'receipt', category: 'Sales', amount: 11111, description: 'Last month' },
      // The owner taking money home: financing, never an expense.
      { id: 8, date: '2026-08-09', account: 'cash', type: 'expense', category: 'Capital Withdrawal', amount: 250000, description: 'Owner took home' },
    ];
    store.suppliers = [{ id: 'S1', name: 'Roto' }];
    store.purchaseInvoices = [
      { id: 9, supplierId: 'S1', supplierName: 'Roto', date: '2026-08-01', voided: false,
        items: [{ qty: 1, price: 2900000 }], amountPaid: 120000,
        payments: [{ date: '2026-08-05', amount: 120000 }] },
      { id: 10, supplierId: 'S1', supplierName: 'Roto', date: '2026-06-01', voided: false,
        items: [{ qty: 1, price: 500000 }], amountPaid: 500000,
        payments: [{ date: '2026-07-01', amount: 500000 }] },
    ];
    store.customers = [
      { id: 'C1', name: 'Onora', location: 'Industrial Area', debt: 370000, debtLog: [
        { date: '2026-05-01', type: 'charge', amount: 800000 }, { date: '2026-06-01', type: 'payment', amount: 430000 }] },
      { id: 'C2', name: 'Clear', debt: 0, debtLog: [] },
    ];
    store.loans = [{ id: 1, lender: 'Centenary', startedOn: '2026-01-01', principal: 5000000, _outstanding: 3200000, _interest: 45000, _fees: 0 }];
    // The shelf: one plain product, one variant — keyed the way stockKey
    // writes them, '::' and no separator at all when there is no variant.
    store.products = [
      { id: 'P1', name: 'Mulper Hinges — Flat' },
      { id: 'P2', name: 'Nice Door', variants: [{ combo: { Color: 'Red' } }, { combo: { Color: 'Blue' } }] },
    ];
    /* Count and lots are separate facts, and the fixture keeps them
       separate: the shelf holds what data.stock says, the lots say what
       a unit cost. Deliberately made to DISAGREE on P1 — 9 on the shelf
       against lots for 49 — which is the shop's own case, and the shape
       that used to value forty cartons nobody had. */
    store.stock = { 'P1': 9, 'P2::1': 3 };
    store.stockLots = { 'P1': [{ qty: 49, cost: 145000 }], 'P2::1': [{ qty: 3, cost: 80000 }] };
  };

  const ctxFor = () => {
    seed();
    const from = '2026-08-01', to = '2026-08-21';
    const cf = cashFlowStatement(from, to);
    // The slice of incomeStatement/balanceSheet the providers read.
    const is = {
      revenue: 1200000, costOfSales: 750000,
      opexRows: { Transport: 50000 }, opex: 50000,
      depreciation: 0, interest: 45000, loanFees: 0, disposals: [], disposalGain: 0,
    };
    const bs = {
      asOf: to,
      cashAccounts: [
        { key: 'cash', label: 'Cash', amount: Math.round(env.cashOnHandFor('cash', to)) },
        { key: 'momo', label: 'Mobile Money', amount: Math.round(env.cashOnHandFor('momo', to)) },
        { key: 'bank', label: 'Bank', amount: Math.round(env.cashOnHandFor('bank', to)) },
      ],
      receivables: receivablesAsAt(to), payables: payablesAsAt(to),
      loans: 3200000, staffAndRent: 0, staffAndRentDetail: { uncostedCount: 0 },
      fixedAssets: 0, inventory: 9 * 145000 + 3 * 80000, ownerCapital: 900000, ownerDrawings: 250000,
      equity: 2132737, retainedEarnings: 2132737 - (900000 - 250000),
    };
    return { from, to, is, bs, cf };
  };

  /* ---------- 1. every preview adds up to its own statement line ----- */
  {
    const ctx = ctxFor();
    reconciles(stDrillData('pl:revenue', ctx), 'revenue');
    reconciles(stDrillData('pl:cogs', ctx), 'cost of sales');
    reconciles(stDrillData('pl:opex:Transport', ctx), 'an expense category');
    reconciles(stDrillData('pl:interest', ctx), 'loan interest');
    reconciles(stDrillData('bs:cash:cash', ctx), 'the cash account');
    reconciles(stDrillData('bs:receivables', ctx), 'owed by customers');
    reconciles(stDrillData('bs:payables', ctx), 'owed to suppliers');
    reconciles(stDrillData('bs:loans', ctx), 'loans outstanding');
    reconciles(stDrillData('bs:stock', ctx), 'stock on the shelf');
    reconciles(stDrillData('bs:ownerin', ctx), 'owner money in');
    reconciles(stDrillData('bs:ownerout', ctx), 'owner money out');
    reconciles(stDrillData('bs:retained', ctx), 'retained earnings');
    ['tradingin', 'debtcollected', 'stockout', 'opexpaid', 'borrowed', 'ownerin', 'ownerout', 'repaid', 'equipment', 'assetsale', 'unclassified']
      .forEach(k => reconciles(stDrillData('cf:' + k, ctx), 'cash flow — ' + k));
  }

  /* ---------- 1b. a withdrawal is nowhere near the expenses ---------- */
  {
    const ctx = ctxFor();
    const opex = stDrillData('pl:opex:Transport', ctx);
    t.check(opex.rows.every(r => !/took home/i.test(r.l) && !/Capital Withdrawal/.test(r.s || '')),
      'the expense preview carries no withdrawal');
    const out = stDrillData('cf:ownerout', ctx);
    t.check(out.rows.length === 1 && /Owner took home/.test(out.rows[0].l),
      'the withdrawal lives on its own financing line, listed by name');
    const ret = stDrillData('bs:retained', ctx);
    t.check(ret.rows.some(r => /Back out what the owner took/.test(r.l)),
      'and the balancing figure\u2019s subtraction shows it added back — a withdrawal is not a loss');
  }

  /* ---------- 1c. the shelf is named in words, not keys -------------- */
  /*
   * From the shop: the stock preview read P051::6 and P042::0 where it
   * meant products' names. stockKey joins with '::' and writes no
   * separator at all for a plain product; the preview split on '|', so
   * the lookup found nothing and every row fell back to its raw key.
   * Checked with the real productVariantLabel, because the stub that
   * stood in for it returned a bare name for anything and hid exactly
   * this.
   */
  {
    const ctx = ctxFor();
    const d = stDrillData('bs:stock', ctx);
    const labels = d.rows.map(r => r.l);
    t.check(labels.includes('Mulper Hinges — Flat'),
      `a plain product is named (${JSON.stringify(labels)})`);
    t.check(labels.includes('Nice Door — Blue'),
      'a variant is named with its combo, from the key\u2019s own index');
    t.check(labels.every(l => !/::/.test(l) && !/^P\d+$/.test(l)),
      'and no row shows a raw stock key where a name belongs');
  }

  /* ---------- 1d. the shelf, not the cost ledger --------------------- */
  /*
   * From the shop: "why is it saying we have 49 ctns yet we have 9".
   *
   * data.stock is how many things are on the shelf — what the Inventory
   * screen shows and what a stock-take corrects. The FIFO lots answer a
   * different question: what each of them cost. Valuing the LOT
   * quantities is the same figure only while the two agree, and when
   * they came apart the balance sheet carried forty cartons of hinges
   * that did not exist — with nothing on the sheet to disagree with,
   * every figure in the section having come from the same wrong side.
   */
  {
    const ctx = ctxFor();
    const d = stDrillData('bs:stock', ctx);
    const hinges = d.rows.find(r => /Mulper/.test(r.l));
    t.check(!!hinges && /^9 on the shelf/.test(hinges.s),
      `the count is the one on the shelf, not the sum of the cost lots (${hinges && hinges.s})`);
    t.check(!!hinges && hinges.v === 9 * 145000,
      `and it is valued at nine cartons, not forty-nine (${hinges && hinges.v})`);
    t.check(!/49/.test((hinges && hinges.s) || ''), 'the lot quantity is nowhere in what the shop reads');
    reconciles(d, 'stock valued from the shelf');
  }

  /* ---------- 2. the rows are the right records, not just the sum --- */
  {
    const ctx = ctxFor();
    const rev = stDrillData('pl:revenue', ctx);
    t.check(rev.rows.length === 2 && rev.rows.every(r => /INV-000[12]/.test(r.l)),
      'revenue lists the period\'s invoices and not July\'s');
    t.check(rev.rows.every(r => r.go && r.go.indexOf('inv:') === 0),
      'and each one is a door to the invoice itself');
    const cog = stDrillData('pl:cogs', ctx);
    t.check(cog.rows.some(r => /estimated/.test(r.s)),
      'a cost that is partly estimated says so on its row');
    const pay = stDrillData('bs:payables', ctx);
    t.check(pay.rows.length === 1 && pay.rows[0].l === 'PINV-0009',
      `a settled bill does not appear among payables (${pay.rows.map(r => r.l).join(', ')})`);
    t.check(pay.rows[0].v === 2780000, 'and the open one shows what is still owed, not its face value');
    const rec = stDrillData('bs:receivables', ctx);
    t.check(rec.rows.length === 1 && rec.rows[0].l === 'Onora',
      'a customer owing nothing is not listed among receivables');
    const cashAcc = stDrillData('bs:cash:cash', ctx);
    t.check(cashAcc.rows[0].l === 'Balance carried in',
      'a cash account opens with the balance carried in, so the rows reconcile to a running balance');
    t.check(cashAcc.signed === true, 'and its movements are signed — money out is not money in');
  }

  /* ---------- 3. as-at: the preview obeys the sheet's date ----------- */
  {
    const ctx = ctxFor();
    ctx.bs = { ...ctx.bs, asOf: '2026-06-15', payables: payablesAsAt('2026-06-15'), receivables: receivablesAsAt('2026-06-15') };
    reconciles(stDrillData('bs:payables', ctx), 'payables as at an earlier date');
    const pay = stDrillData('bs:payables', ctx);
    t.check(pay.rows.length === 1 && pay.rows[0].l === 'PINV-0010' && pay.rows[0].v === 500000,
      'a bill later paid still shows owed on a sheet dated before the payment');
    reconciles(stDrillData('bs:receivables', ctx), 'receivables as at an earlier date');
    const rec = stDrillData('bs:receivables', ctx);
    t.check(rec.rows[0].v === 370000, 'a customer balance is rebuilt from their dated history for that day');
  }

  /* ---------- 4. the unclassified line is the exact complement ------- */
  /*
   * The statement's own tripwire: unclassified = net movement minus the
   * three sections, expected to be zero. One half of an account transfer
   * is a movement every bucket excludes — CASH_NOT_OPEX keeps it out of
   * running costs, and it is none of the named categories — so it is the
   * real shape of what this line exists to catch. (An arbitrary made-up
   * category would NOT do: any money-out not excluded counts as opex,
   * and the first draft of this check proved 0 === 0 that way.)
   */
  {
    const ctx = ctxFor();
    store.cashTxns.push({ id: 99, date: '2026-08-15', account: 'cash', type: 'payment', category: 'Account Transfer', amount: 300000, description: 'To bank — receiving half never recorded' });
    const cf = cashFlowStatement(ctx.from, ctx.to);
    t.check(Math.round(cf.unclassified) === -300000,
      `the fixture genuinely falls between the sections (${cf.unclassified})`);
    const d = stDrillData('cf:unclassified', { ...ctx, cf });
    t.check(d.rows.length === 1 && Math.abs(rowsSum(d) - cf.unclassified) < 1,
      `and the preview lists exactly it, summing to the statement's own tripwire (${rowsSum(d)} vs ${cf.unclassified})`);
  }

  /* ---------- 5. the panel's own tripwire ---------------------------- */
  {
    const ctx = ctxFor();
    setDrillKey('pl:revenue');
    const html = stDrillPanelHTML(ctx);
    t.check(/exactly the figure on the statement/.test(html),
      'a preview that adds up says so');
    t.check(!/st-drill-off/.test(html), 'and is not dressed as a fault');
    // Force a mismatch the way a real bug would: the statement claiming
    // more than the records support.
    ctx.is = { ...ctx.is, revenue: 9999999 };
    const bad = stDrillPanelHTML(ctx);
    t.check(/st-drill-off/.test(bad) && /a fault worth reporting/.test(bad),
      'a preview that does not add up says so loudly instead of hoping nobody sums it');
    setDrillKey(null);
    t.check(/Click any figure/.test(stDrillPanelHTML(ctx)),
      'with nothing selected, the panel says what it is for');
  }

  /* ---------- 6. derived lines stay closed --------------------------- */
  {
    const ctx = ctxFor();
    t.check(stDrillData('pl:grossprofit', ctx) === null && stDrillData('bs:networth', ctx) === null,
      'totals and other derived lines have no preview — their components are the preview');
  }
}

/* ---------- 7. the wiring on the page -------------------------------- */
{
  t.check(/const drillable = stActiveTab !== 'ratios' && stActiveTab !== 'overview';/.test(code),
    'the ratios and the overview stay full-width — ratios because every figure is derived, the overview by the shop\u2019s own request: it is the summary, and the records live on the statements its lines summarise');
  /* No handle on a door that opens onto a wall: with no panel on the
     overview, none of its lines may carry a drill key. Matched over the
     whole of stOverview so a key added to any future line fails here. */
  const overviewDoc = (/function stOverview\([\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(overviewDoc.length > 0, 'found stOverview');
  t.check(!/drill:/.test(overviewDoc), 'and none of its lines is clickable');
  // The two providers only the overview reached went with it.
  t.check(!/ov:runcosts|ov:borrowcost/.test(code),
    'the providers nothing can reach any more are gone rather than left as dead code');
  t.check(/stDrillKey = null;\n  renderStatements\(\);/.test(code.replace(/\r/g, '')),
    'switching documents closes the preview rather than leaving it beside the wrong statement');
  t.check(/data-st-drill="\$\{esc\(o\.drill\)\}" tabindex="0" role="button"/.test(code),
    'a drillable line is a real button to the keyboard, not only to the mouse');
  t.check(/\.st-print \.st-drill-aff\{display:none;\}/.test(code),
    'and on paper the lines are not doors, so nothing says they are');
}

/* ---------- the panel stands exactly as tall as the statement -------- */
/*
 * The first cut sized the panel to its own content and capped it at the
 * viewport, which gave the page two competing scrollbars and a right
 * column whose height never agreed with the left. The shop's review was
 * "the scrolling doesn't have to become weird", which was accurate.
 *
 * The contract now: the preview column contributes NO height of its own
 * (absolutely anchored in its track, so the row is sized by the statement
 * alone and opening a 250-row preview never lengthens the page), the
 * panel fills that height exactly, and the only scrollbar the panel owns
 * is its list's. Checked structurally, since a cascade helper cannot
 * measure a scroll: what must not come back is the shape that scrolled
 * weirdly.
 */
{
  const css = src.replace(/\s+/g, ' ');
  t.check(/\.st-split-side\{position:relative;min-width:0;\}/.test(css.replace(/ /g, '')),
    'the side column is a positioning context, not a sticky scroller');
  t.check(!/\.st-split-side\{[^}]*position:sticky/.test(css),
    'the first cut\u2019s sticky-scrolling column is gone');
  t.check(/\.st-split-anchor\{position:absolute;inset:0;\}/.test(css.replace(/ /g, '')),
    'the anchor is absolute, so the preview adds no height to the page');
  t.check(/\.st-split-anchor > \*\{[^}]*height:100%/.test(css),
    'and the panel fills the statement\u2019s height exactly');
  t.check(/max-height:min\(100%, calc\(100vh - 24px\)\)/.test(css),
    'capped at the viewport only when the statement itself runs past it');
  t.check(/\.st-drill-list\{[^}]*flex:1 1 auto/.test(css),
    'the list absorbs the spare room, so the reconciliation footer sits on the bottom edge');
  t.check(/<div class="st-split-anchor">\$\{stDrillPanelHTML\(ctx\)\}<\/div>/.test(src),
    'and the markup actually routes the panel through the anchor');
  // Stacked on a narrow screen, the absolute anchor would overlay the
  // document it is meant to follow.
  /* Two 1100px media blocks exist in the file; matched on the one that
     restyles the split, not merely the first. */
  const mobile = (/@media \(max-width:1100px\)\{\s*\.st-split\{[\s\S]*?\n  \}/.exec(src) || [''])[0];
  t.check(mobile.length > 0, 'found the split layout\u2019s own narrow-screen block');
  t.check(/\.st-split-anchor\{position:static/.test(mobile),
    'on a narrow screen the anchor returns to the flow');
  t.check(/max-height:70vh/.test(mobile),
    'where the panel keeps a lid on itself instead of pushing the page a dozen screens long');
}

process.exit(t.done() ? 1 : 0);
