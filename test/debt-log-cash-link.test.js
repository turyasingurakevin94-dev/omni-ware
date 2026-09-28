#!/usr/bin/env node
'use strict';
/*
 * A ledger payment keeps its receipt across a reload.
 *
 * A payment written on a customer's ledger carries the cashTxnId of the
 * receipt its money came in on. collectionLedgerRow() will not count a
 * ledger payment without it, so when the save dropped the field every
 * such payment (one against an opening balance, say) fell out of the
 * morning brief's "who paid today" after the next load, and the
 * statement of account showed "—" for its method.
 *
 * Pinned here: the row the save sends and the row the load reads carry
 * the link both ways (0104), the save only sends the column once the
 * probe has found it, and a row saved before the column existed is
 * linked again on load.
 *
 * Run: node test/debt-log-cash-link.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('debt log cash link');
const src = read('index.html');

const scope = compileScope([
  extractFunction(src, 'dateOrNull', 'index.html'),
  extractFunction(src, 'debtLogToRow', 'index.html'),
  extractFunction(src, 'debtLogFromRow', 'index.html'),
  extractFunction(src, 'debtLogIsInvoiceOwned', 'index.html'),
  extractFunction(src, 'collectionLedgerRow', 'index.html'),
  extractFunction(src, 'cashIsMoneyIn', 'index.html'),
  extractFunction(src, 'linkLedgerPaymentsToReceipts', 'index.html'),
], {}, ['debtLogToRow', 'debtLogFromRow', 'collectionLedgerRow', 'linkLedgerPaymentsToReceipts']);
const { debtLogToRow, debtLogFromRow, collectionLedgerRow, linkLedgerPaymentsToReceipts } = scope;

/* ---------- 1. the round trip --------------------------------------- */
{
  const paid = { id: 41, date: '2026-09-28', type: 'payment', amount: 150000, note: '', cashTxnId: 812 };
  const row = debtLogToRow(paid, 'C002', 'shop-1', true);
  t.check(row.cash_txn_id === 812, 'the save sends the receipt link as cash_txn_id');
  t.check(row.customer_id === 'C002' && row.shop_id === 'shop-1' && row.id === 41, 'alongside the row it belongs to');
  // Postgres hands a bigint back as a string through some drivers; the
  // link is compared with === against cash entry ids, which are numbers.
  const back = debtLogFromRow(Object.assign({}, row, { amount: '150000', cash_txn_id: '812' }));
  t.check(back.cashTxnId === 812, 'and the load reads it back as cashTxnId, a number');
  t.check(back.amount === 150000 && back.type === 'payment' && back.date === '2026-09-28', 'with the rest of the row intact');
  t.check(collectionLedgerRow(back), 'so after a reload the payment still counts as money collected');

  const charge = debtLogFromRow(debtLogToRow({ id: 2, date: '2026-09-01', type: 'charge', amount: 9000, note: 'x' }, 'C1', 's', true));
  t.check(charge.cashTxnId === null, 'a row with no receipt round-trips as null, not undefined or 0');
  t.check(debtLogToRow({ id: 3, type: 'charge', amount: 1, cashTxnId: 0 }, 'C1', 's', true).cash_txn_id === 0,
    'an id of 0 is still an id');
}

/* ---------- 2. the probe guards the write ---------------------------- */
{
  const row = debtLogToRow({ id: 1, date: '2026-09-28', type: 'payment', amount: 5, note: '', cashTxnId: 9 }, 'C1', 's', false);
  t.check(!('cash_txn_id' in row), 'without the column the save leaves it out, so the ledger keeps saving');
  t.check(debtLogFromRow({ id: 1, date: null, type: 'charge', amount: 5, note: null }).cashTxnId === null,
    'and a load from a table without the column reads no link');
  t.check(/debtLogCashTxnColumn = !\(debtLogCashColR && debtLogCashColR\.error\);/.test(src), 'the app probes for the column');
  t.check(/sb\.from\('customer_debt_log'\)\.select\('cash_txn_id'\)\.limit\(1\)/.test(src), 'on the table it lives on');
  t.check(/debtLogToRow\(l, c\.id, shopId, debtLogCashTxnColumn\)/.test(extractFunction(src, 'buildSyncRows', 'index.html')),
    'buildSyncRows writes the ledger through the shared row builder, behind the probe');
  t.check(/push\(debtLogFromRow\(l\)\)/.test(extractFunction(src, 'loadData', 'index.html')), 'and loadData reads it through the shared reader');
  const mig = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0104_debt_log_cash_txn.sql'), 'utf8');
  t.check(/alter table customer_debt_log add column if not exists cash_txn_id bigint;/.test(mig), 'migration 0104 adds the nullable column');
}

/* ---------- 3. the backfill ------------------------------------------ */
{
  const d = {
    customers: [
      { id: 'C1', name: 'Milly', debtLog: [
        { id: 1, date: '2026-08-26', type: 'payment', amount: 60000, note: '' },
        { id: 2, date: '2026-08-26', type: 'payment', amount: 5000, note: 'Balance correction — history did not add up' },
        { id: 3, date: '2026-08-26', type: 'payment', amount: 7000, note: 'Auto-sync — INV-0004' },
        { id: 4, date: '2026-08-26', type: 'charge', amount: 60000, note: '' },
        { id: 5, date: '2026-08-27', type: 'payment', amount: 40000, note: '' },
      ] },
      { id: 'C2', name: 'Kato', debtLog: [
        { id: 6, date: '2026-08-26', type: 'payment', amount: 60000, note: '', cashTxnId: 70 },
      ] },
    ],
    savedQuotes: [{ id: 4, payments: [{ cashTxnId: 71 }] }],
    cashTxns: [
      { id: 70, date: '2026-08-26', type: 'receipt', category: 'Debt Payment', amount: 60000, description: 'Payment — Milly Kato', quoteId: null },
      { id: 71, date: '2026-08-26', type: 'receipt', category: 'Debt Payment', amount: 60000, description: 'Payment — Milly', quoteId: null },
      { id: 72, date: '2026-08-26', type: 'receipt', category: 'Agent Payment', amount: 60000, description: 'Payment — Milly', quoteId: null },
      { id: 73, date: '2026-08-26', type: 'payment', category: 'Debt Payment', amount: 60000, description: 'Payment — Milly', quoteId: null },
      { id: 74, date: '2026-08-26', type: 'receipt', category: 'Debt Payment', amount: 60000, description: 'Payment — Milly', quoteId: null, time: '14:20' },
      { id: 75, date: '2026-08-26', type: 'receipt', category: 'Debt Payment', amount: 5000, description: 'Payment — Milly', quoteId: null },
    ],
  };
  const n = linkLedgerPaymentsToReceipts(d);
  const log = d.customers[0].debtLog;
  t.check(log[0].cashTxnId === 74,
    'a ledger payment is linked to its day\'s receipt: same day, name and amount, passing over one already claimed, an agent\'s, and money out');
  t.check(log[1].cashTxnId == null, 'a balance correction is not money and is never linked');
  t.check(log[2].cashTxnId == null && log[3].cashTxnId == null, 'nor is an invoice\'s echo or a charge');
  t.check(log[4].cashTxnId == null, 'a payment with no receipt that day stays unlinked rather than borrowing another day\'s');
  t.check(d.customers[1].debtLog[0].cashTxnId === 70, 'a link already held is left as it is');
  t.check(n === 1, 'and the count says how many were linked');
  t.check(linkLedgerPaymentsToReceipts(d) === 0 && log[0].cashTxnId === 74, 'running it again changes nothing');

  const boot = extractFunction(src, 'boot', 'index.html');
  t.check(/initLastSynced\(data, currentShopId\);[\s\S]*linkLedgerPaymentsToReceipts\(data\);[\s\S]*resetRowIdBlocks\(\)/.test(boot),
    'boot links after the snapshot, so the link diffs as an edit and the next save writes it');
  const poll = extractFunction(src, 'pollForUpdatesNow', 'index.html');
  t.check(/buildLastSynced\(fresh, currentShopId\);[\s\S]*linkLedgerPaymentsToReceipts\(fresh\);[\s\S]*data = fresh;/.test(poll),
    'and so does the background refresh');
}

t.done();
