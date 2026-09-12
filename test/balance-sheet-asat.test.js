#!/usr/bin/env node
'use strict';
/*
 * The balance sheet as at a date.
 *
 * It was always today's, whatever period was on screen. Printing a set
 * of statements for July handed somebody a July profit and loss beside a
 * balance sheet from today and called them one document -- and the
 * further into August they printed it, the further apart the two halves
 * drifted.
 *
 * Most of it rebuilds exactly, because the records are dated:
 * cashOnHandFor, fixedAssetsNBVAt and loansOutstandingAt already took a
 * date, and debtors, creditors and what is owed to staff all have dated
 * ledgers behind them.
 *
 * STOCK IS THE ONE THAT DOES NOT, and it is the reason this file is
 * careful. The log carries qtyAfter on every movement, so HOW MANY were
 * on the shelf that day is exact -- but WHAT THEY WERE WORTH is not,
 * because the FIFO lots as they stood then were never kept. The quantity
 * is rebuilt and valued at today's unit cost, and the sheet says so on
 * the line rather than passing an estimate off as a fact.
 *
 * Run: node test/balance-sheet-asat.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('balance sheet as at');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const TODAY = '2026-08-05';
const data = { customers: [], suppliers: [], purchaseInvoices: [], dues: [], stockLots: {}, stockLog: [] };

const NAMES = ['stockValueAsAt', 'receivablesAsAt', 'payablesAsAt', 'duesOwedAsAt'];
const scope = compileScope([
  /* Payables now include consignment that has sold and not been
     settled -- money owed with no bill yet. The chain comes along so
     the figure is the real one; a fixture holding nothing on
     consignment simply reads zero. */
  extractFunction(src, 'consignmentHeld', 'index.html'),
  extractFunction(src, 'consignmentAccrued', 'index.html'),
  extractFunction(src, 'consignmentSettlements', 'index.html'),
  extractFunction(src, 'consignmentSettled', 'index.html'),
  extractFunction(src, 'consignmentRows', 'index.html'),
  extractFunction(src, 'consignmentOwedTotal', 'index.html'),
  extractFunction(src, 'purchaseInvoiceTotal', 'index.html'),
  extractDeclaration(src, 'PAY_BASES', 'index.html'),
  extractFunction(src, 'dueBalance', 'index.html'),
  extractFunction(src, 'duePaidBy', 'index.html'),
  extractFunction(src, 'dueBasis', 'index.html'),
  extractFunction(src, 'dueAccruedAsAt', 'index.html'),
  extractFunction(src, 'monthChargeFraction', 'index.html'),
  extractFunction(src, 'dueCostAccruedTo', 'index.html'),
  extractFunction(src, 'duePositionAsAt', 'index.html'),
  extractFunction(src, 'dueAccruedOutstanding', 'index.html'),
  extractFunction(src, 'periodEndDate', 'index.html'),
  extractFunction(src, 'daysBetweenISO', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  todayISO: () => TODAY,
  inventoryValue: () => ({ value: 1500000, uncostedQty: 0 }),
  dashTotalDebtors: () => 1000000,
  dashTotalCreditors: () => 400000,
  duesOwed: () => ({ wages: 0, rent: 0, total: 0, count: 0, uncostedCount: 0 }),
}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. today is still today ---------------------------------- *
 * The live figures are the ones the rest of the app shows, so a sheet
 * dated today must go on reading them rather than rebuilding a second
 * answer that could differ.
 */
{
  eq(scope.receivablesAsAt(TODAY), 1000000, 'debtors today come from the live total');
  eq(scope.payablesAsAt(TODAY), 400000, 'and so do creditors');
  eq(scope.stockValueAsAt(TODAY).value, 1500000, 'and stock from the live valuation');
  t.check(!scope.stockValueAsAt(TODAY).estimated, 'which is not an estimate');
  // A date in the future is today's position, not a projection.
  eq(scope.receivablesAsAt('2027-01-01'), 1000000, 'a date ahead of today reads as today');
}

/* ---------- 2. debtors, from their own dated ledger ------------------ */
{
  data.customers = [{
    id: 'C1', name: 'Bugolobi', debt: 1000000, debtLog: [
      { id: 1, date: '2026-07-20', type: 'charge', amount: 3000000 },
      { id: 2, date: '2026-08-02', type: 'payment', amount: 2000000 },
    ],
  }];
  eq(scope.receivablesAsAt('2026-07-31'), 3000000,
    'what was owed at the end of July, before August\'s payment');
  eq(scope.receivablesAsAt('2026-07-19'), 0, 'and nothing before the charge was raised');
  eq(scope.receivablesAsAt('2026-08-02'), 1000000, 'the payment counts on the day it was made');

  /* A customer who has overpaid is not a negative debtor -- money owed
     TO them is a liability, not a receivable of less than nothing, and
     letting it go negative would net it off against what others owe. */
  data.customers = [{ id: 'C2', name: 'Prepaid', debt: 0, debtLog: [
    { id: 1, date: '2026-07-01', type: 'charge', amount: 100000 },
    { id: 2, date: '2026-07-02', type: 'payment', amount: 250000 },
  ]}];
  eq(scope.receivablesAsAt('2026-07-31'), 0, 'an overpaid customer floors at nothing');
}

/* ---------- 3. creditors, from invoice and payment dates ------------- */
{
  data.suppliers = [{ id: 'S1', name: 'Roofings' }];
  data.purchaseInvoices = [{
    id: 1, supplierId: 'S1', date: '2026-07-18', voided: false,
    items: [{ qty: 10, price: 100000 }],
    payments: [{ date: '2026-08-04', amount: 600000 }],
  }];
  eq(scope.payablesAsAt('2026-07-31'), 1000000, 'the whole invoice was still owed at the end of July');
  eq(scope.payablesAsAt('2026-07-17'), 0, 'and nothing before it was raised');

  data.purchaseInvoices[0].voided = true;
  eq(scope.payablesAsAt('2026-07-31'), 0, 'a voided invoice was never owed');
  data.purchaseInvoices[0].voided = false;

  /* Reached through the supplier list, the same way the live total is.
     Two dates counting different sets of invoices would show a movement
     between them that never happened. */
  data.suppliers = [];
  eq(scope.payablesAsAt('2026-07-31'), 0,
    'an invoice whose supplier is gone is out of both dates, not just one');
  data.suppliers = [{ id: 'S1', name: 'Roofings' }];
}

/* ---------- 4. wages and rent, as at the date ------------------------ */
{
  data.dues = [
    { id: 1, kind: 'wage', refId: 'S1', period: '2026-07', dueDate: '2026-07-31',
      amount: 450000, paid: 450000, payments: [{ date: '2026-08-03', amount: 450000 }] },
    { id: 2, kind: 'rent', refId: '1', period: '2026-08', dueDate: '2026-08-01',
      amount: 800000, paid: 0, payments: [] },
    // Uncosted: a real obligation of an unknown size, and no figure to
    // put on a balance sheet.
    { id: 3, kind: 'wage', refId: 'S2', period: '2026-07', dueDate: '2026-07-31',
      amount: null, paid: 0, payments: [] },
  ];
  const july = scope.duesOwedAsAt('2026-07-31');
  eq(july.total, 450000, 'July\'s wage was still owed on the 31st — it was paid in August');
  eq(july.uncostedCount, 1, 'with the uncosted month counted apart rather than guessed at');
  /* And kept OUT of the open list, not merely contributing nothing to
     it. Letting it in changed no total -- a null amount adds zero -- so
     only the count showed it, and a month nobody has costed is not a
     month the shop can say it owes. */
  eq(july.count, 1, 'and left out of what is owed, since its size is not known');
  t.check(july.rent === 0, 'and August\'s rent was not yet due, so it is not a July liability');

  const aug = scope.duesOwedAsAt('2026-08-04');
  eq(aug.total, 800000, 'by August the wage is paid and the rent has fallen due');
}

/* ---------- 5. stock: the quantity is exact, the value is not -------- *
 * The one line that cannot be rebuilt truthfully, and the reason the
 * sheet has to say what it did.
 */
{
  data.stockLots = { P1: [{ qty: 60, cost: 25000 }] };
  data.stockLog = [
    { id: 1, key: 'P1', type: 'restock', delta: 100, qtyAfter: 100, date: '2026-07-10', cost: 25000 },
    { id: 2, key: 'P1', type: 'sale', delta: -40, qtyAfter: 60, date: '2026-08-02', cost: null },
  ];
  const july = scope.stockValueAsAt('2026-07-31');
  eq(july.value, 2500000, '100 bags were on the shelf that day, at today\'s 25,000 a bag');
  t.check(july.estimated === true,
    'and it is marked an estimate, because the lots as they stood then were never kept');

  // Before the first movement, the shelf held what stood before it.
  eq(scope.stockValueAsAt('2026-07-01').value, 0, 'nothing was on the shelf before the first restock');

  // An item that never moved held then what it holds now.
  data.stockLots.P2 = [{ qty: 5, cost: 10000 }];
  eq(scope.stockValueAsAt('2026-07-31').value, 2500000 + 50000,
    'an item with no movements on file is carried at what it holds now');

  /* Stock with no cost on file is counted, never valued at a guess --
     the same rule the live valuation follows. */
  data.stockLots = { P3: [{ qty: 8, cost: null }] };
  data.stockLog = [{ id: 1, key: 'P3', type: 'restock', delta: 8, qtyAfter: 8, date: '2026-07-05', cost: null }];
  const un = scope.stockValueAsAt('2026-07-31');
  eq(un.value, 0, 'stock with no cost on file adds nothing to the value');
  eq(un.uncostedQty, 8, 'but its quantity is reported rather than lost');
}

/* ---------- 6. what the sheet says it did ---------------------------- */
{
  const bs = (/function balanceSheetAsAt[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/cashOnHandFor\(a\.key, asOf\)/.test(bs), 'cash is read as at the date');
  t.check(/receivablesAsAt\(asOf\)/.test(bs) && /payablesAsAt\(asOf\)/.test(bs)
    && /duesOwedAsAt\(asOf\)/.test(bs) && /stockValueAsAt\(asOf\)/.test(bs),
    'and so is everything else that has a dated ledger behind it');
  /* Owner money in is a running total. Left uncapped it would count
     capital put in AFTER the date, and the sheet would not balance
     against its own equity. */
  t.check(/t\.category === 'Owner Investment' && String\(t\.date\|\|''\) <= asOf/.test(bs),
    'the owner\'s money in stops at the date too');
  t.check(/inventoryEstimated: !!inv\.estimated/.test(bs),
    'and the sheet carries whether its stock line is an estimate');

  const ctx = (/function statementsContext[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(/balanceSheetAsAt\(to > todayISO\(\) \? todayISO\(\) : to\)/.test(ctx),
    'the sheet follows the period, capped at today — a sheet dated forward would be today\'s figures under a heading that has not happened');

  const doc = (/function stBalanceSheet[\s\S]*?\n\}\n/.exec(code) || [''])[0];
  t.check(/bs\.inventoryEstimated/.test(doc) && /the lots as they stood then were not kept/.test(doc),
    'the stock line says its value is an estimate and why');
  t.check(/bs\.historic/.test(doc) && /Rebuilt as at/.test(doc),
    'and the note says the sheet was rebuilt rather than taken live');

  /* The old note claimed the sheet was always today's. That WAS true and
     was the bug; leaving it would have the paper contradict the figures
     printed above it. */
  t.check(!/As at today only/.test(code),
    'the note that said it could only ever be today is gone');
}

process.exit(t.done() ? 1 : 0);
