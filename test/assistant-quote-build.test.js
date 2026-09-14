#!/usr/bin/env node
'use strict';
/*
 * One saved-quote record, assembled the same way for every caller.
 *
 * The save button's handler used to hold the record literal inline —
 * the only write path in the app with no callable function behind it.
 * The assistant needs to build a draft quote in code, and two
 * assemblies of the same record would drift the way the till's once
 * did, so the literal became buildQuoteRecord() and the handler now
 * calls it. This file pins both halves: the shape a fresh record must
 * have, the fields an update must NOT lose, and — by regex — that the
 * handler genuinely shares the extraction rather than keeping a copy.
 *
 * The id stays the CALLER'S concern, deliberately: both callers must
 * issue the dense INV- number only after their own validation and
 * confirms pass, because a save the shop backs out of must cost
 * nothing. So the function takes quoteId and never awaits anything.
 *
 * Run: node test/assistant-quote-build.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('assistant quote build');
const src = read('index.html');

const NAMES = ['orderCharges', 'buildQuoteRecord'];
const fn = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);
const build = fn.buildQuoteRecord;

const items = [{ lineId: 1, productId: 'P042', variantIdx: 0, productName: 'Mulper Hinges — Gold',
  unit: 'Pc', packUnit: 'Ctn', packQty: 20, qty: 5, supplierId: '__stock__',
  supplierName: 'Our stock', price: 8000, sellPrice: 12000 }];

/* ---------- 1. a brand-new draft -------------------------------------- */
{
  const r = build({ quoteId: 107, client: { name: 'Okello', phone: '0700' },
    date: '2026-08-25', items, existing: null });

  t.check(r.id === 107, 'the id is the one the caller issued');
  t.check(r.status === 'draft', 'a new record is a DRAFT');
  t.check(r.invoiced === false && r.invoicedAt === null && r.invoicedTs === null,
    'not invoiced — creating a quote never moves stock');
  t.check(r.amountPaid === 0 && Array.isArray(r.payments) && r.payments.length === 0,
    'no money on it yet');
  t.check(r.voided === false && r.customerId === null && r.debtCharged === 0,
    'and none of the invoice-side bookkeeping claims anything');
  t.check(typeof r.stageEnteredAt === 'number' && r.stageEnteredAt > 0,
    'the tracking board knows when this step began');
  t.check(r.assignedWorkerId === null && r.assignedDeliveryId === null, 'assigned to nobody');
  t.check(typeof r.savedAt === 'string' && r.savedAt.length > 0, 'stamped when saved');
  t.check(r.client.name === 'Okello' && r.client !== undefined, 'the client rides along');

  // Deep copies, both ways: the caller's arrays must not share references
  // with what lands in data.savedQuotes.
  r.items[0].qty = 999;
  t.check(items[0].qty === 5, 'items are deep-copied — mutating the record cannot reach the source');
  const c = { name: 'A', phone: '' };
  const r2 = build({ quoteId: 1, client: c, date: '2026-08-25', items, existing: null });
  r2.client.name = 'B';
  t.check(c.name === 'A', 'and the client object is copied too');
}

/* ---------- 2. an update keeps what the form does not edit ------------ */
/*
 * The exact regression the record's own comment documents: an explicit
 * field list once dropped originAgentId, agentPaymentStatus and the
 * worker pick-and-pack fields, so re-saving an agent's order detached
 * it from its agent. The spread-first shape is the fix; this pins it.
 */
{
  const existing = {
    id: 55, status: 'preparing', stageEnteredAt: 12345,
    originAgentId: 'AG7', agentClientId: 'AC1', agentPaymentStatus: 'prepaid',
    pickingStatus: 'in_progress', pickCursor: 3, workerAcceptedAt: 999,
    assignedWorkerId: 'W2', assignedDeliveryId: null,
    invoiced: true, invoicedAt: '2026-08-20', invoicedTs: 1755640000000,
    amountPaid: 100000, payments: [{ amount: 100000 }], voided: false,
    customerId: 9, debtCharged: 350000,
    client: { name: 'Old', phone: '' }, date: '2026-08-20', items: [],
  };
  const r = build({ quoteId: 55, client: { name: 'New Name', phone: '0788' },
    date: '2026-08-25', items, existing });

  t.check(r.originAgentId === 'AG7' && r.agentPaymentStatus === 'prepaid'
    && r.pickingStatus === 'in_progress' && r.pickCursor === 3 && r.workerAcceptedAt === 999,
    'agent and worker fields survive — the regression the comment documents stays fixed');
  t.check(r.status === 'preparing', 'the stage is untouched');
  t.check(r.stageEnteredAt === 12345,
    're-saving content does not reset when the stage was entered — only setSavedQuoteStatus advances it');
  t.check(r.invoiced === true && r.amountPaid === 100000 && r.payments.length === 1,
    'invoice state and money already on the order come through');
  t.check(r.customerId === 9 && r.debtCharged === 350000, 'and so does the debt bookkeeping');
  t.check(r.client.name === 'New Name' && r.date === '2026-08-25' && r.items.length === 1,
    'while the fields this save actually edits are the new ones');
  t.check(r.assignedWorkerId === 'W2', 'assignment is preserved');
}

/* ---------- 3. the handler shares the extraction ---------------------- */
{
  const at = src.indexOf('__btn_q_save_btn');
  const handler = src.slice(at, at + 4000);
  t.check(/const record = buildQuoteRecord\(\{quoteId, client: data\.quote\.client,/.test(handler),
    'the save button builds its record through buildQuoteRecord');
  t.check((src.match(/status: existing \? existing\.status : 'draft'/g) || []).length === 1,
    'and the record literal exists exactly once — no second copy to drift');
  const fnAt = src.indexOf('function buildQuoteRecord');
  const issueAt = src.indexOf("await issueRowId('savedQuote')");
  t.check(fnAt > 0 && !/await/.test(extractFunction(src, 'buildQuoteRecord', 'index.html')),
    'the builder is synchronous — the dense INV- id stays the caller’s concern');
  t.check(issueAt > 0, 'which the handler still issues only after its own confirms');
}

process.exit(t.done() ? 1 : 0);
