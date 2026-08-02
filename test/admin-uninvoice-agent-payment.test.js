#!/usr/bin/env node
'use strict';
/*
 * Un-invoicing an agent's order left it claiming to be paid.
 *
 * A prepay agent settles before their order can be prepared. The admin
 * books that as a real payment -- Cash Book receipt, an entry in
 * q.payments, amountPaid -- and separately sets agentPaymentStatus,
 * which is the single flag agentPaymentBlocksPreparing() (shared-worker.js)
 * reads to decide whether preparing is unblocked.
 *
 * Un-invoicing reverses everything collected against the invoice: the cash
 * entries, the payments array, amountPaid. The agent's prepayment lives in
 * that same array, so it went too -- but agentPaymentStatus did not. The
 * order came out of it saying the agent had settled while recording no
 * payment, holding no amountPaid, and having no Cash Book entry:
 *
 *     agentPaymentStatus: 'paid'   amountPaid: 0   payments: []   cash: []
 *
 * Money the shop is physically holding, with nothing anywhere to show for
 * it, and an order that would sail past the payment gate on the way back
 * out.
 *
 * The flag is reset with the record that justified it, so stepping forward
 * asks again and books it again.
 *
 * Run: node test/admin-uninvoice-agent-payment.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin uninvoice agent payment');
const src = read('index.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. the reset happens where the record is destroyed ------ */
{
  const branch = (/removeCashTxnsByIds\(\(q\.payments\|\|\[\]\)\.map\(p=>p\.cashTxnId\)\);[\s\S]{0,900}?removePurchaseInvoicesForQuote\(q\.id\);/.exec(code) || [''])[0];
  t.check(branch.length > 0, 'the un-invoice branch is found');
  t.check(/q\.payments = \[\];/.test(branch) && /q\.amountPaid = 0;/.test(branch),
    'it still clears the payments and the amount paid');
  t.check(/if\(q\.agentPaymentStatus === 'paid'\) q\.agentPaymentStatus = 'unpaid';/.test(branch),
    'and now clears the flag that said those payments existed');

  // Order matters only in that all three live together; pinned so a later
  // edit cannot move the reset somewhere the reversal does not reach.
  t.check(branch.indexOf('q.amountPaid = 0;') < branch.indexOf("q.agentPaymentStatus = 'unpaid'"),
    'the reset sits with the reversal it belongs to');
}

/* ---------- 2. only when it was set --------------------------------- */
{
  t.check(/if\(q\.agentPaymentStatus === 'paid'\)/.test(code),
    'a non-agent order, which has no such flag, is not given one');
}

/* ---------- 3. what the flag controls ------------------------------- */
/*
 * Transcribed from shared-worker.js, because the consequence of leaving it
 * set is that this returns false and the order walks through the gate.
 */
{
  const worker = read('shared-worker.js');
  t.check(/return !!\(agent && agent\.paymentTerm==='prepay' && q\.agentPaymentStatus!=='paid'\);/.test(worker),
    'preparing is blocked only while the flag is not "paid"');

  const blocks = (agent, q) => !!(agent && agent.paymentTerm === 'prepay' && q.agentPaymentStatus !== 'paid');
  const agent = { paymentTerm: 'prepay' };
  t.check(blocks(agent, { agentPaymentStatus: 'unpaid' }) === true,
    'so after the reset the order is stopped and asked for payment again');
  t.check(blocks(agent, { agentPaymentStatus: 'paid' }) === false,
    'whereas leaving it set let an order with no payment on it straight through');
  t.check(blocks({ paymentTerm: 'pay_on_delivery' }, { agentPaymentStatus: 'unpaid' }) === false,
    'and an agent who is not on prepay terms is never gated');
}

/* ---------- 4. the state that is now impossible --------------------- */
/*
 * Stated as arithmetic over the fields, so the invariant is readable
 * without a DOM: an order may not claim payment it cannot evidence.
 */
{
  const coherent = (q) => !(q.agentPaymentStatus === 'paid'
    && (Number(q.amountPaid) || 0) === 0
    && (q.payments || []).length === 0);

  t.check(coherent({ agentPaymentStatus: 'paid', amountPaid: 500000, payments: [{ amount: 500000 }] }),
    'paid, with the payment on file, is coherent');
  t.check(coherent({ agentPaymentStatus: 'unpaid', amountPaid: 0, payments: [] }),
    'unpaid, with nothing on file, is coherent -- this is what un-invoicing now produces');
  t.check(!coherent({ agentPaymentStatus: 'paid', amountPaid: 0, payments: [] }),
    'paid, with nothing on file, is the state that used to come out of an un-invoice');
}

process.exit(t.done() ? 1 : 0);
