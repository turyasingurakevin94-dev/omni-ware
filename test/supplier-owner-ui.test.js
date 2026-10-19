#!/usr/bin/env node
'use strict';
/*
 * The owner's side of the supplier app (0132), inside index.html.
 *
 * Three places the existing screens take what suppliers say from their
 * own app, without being redrawn around it:
 *
 *   · a supplier's account carries their supplier-app login -- invite,
 *     a PIN shown once, suspend, sign out -- through supplier-accounts;
 *   · an order's confirm panel folds in "have all / short / none" from
 *     supplier_answers, through setOrderSupplierConfirm like any answer
 *     taken by phone;
 *   · the Price Registry lists supplier_proposals, and nothing changes a
 *     price until the owner accepts.
 *
 * The rules pinned here are the ones whose failure is silent: a PIN that
 * reaches `data` (and so every backup), an answer folded over a newer one
 * or onto an order that has changed since, and a proposal that changes a
 * price by itself.
 *
 * Run: node test/supplier-owner-ui.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('supplier app, owner side');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the PIN is on screen and nowhere else ------------------ */
{
  t.check(/let spPinShown = null;/.test(src), 'the supplier PIN is held in its own variable');
  t.check(!/data\.[a-zA-Z]+[^\n;]*spPinShown/.test(code) && !/spPinShown[^\n;]*data\./.test(code.replace(/res\.data|data:\s*res/g, '')),
    'and is never written into `data`, which is synced and backed up');
  t.check(!/(lsSet|localStorage)[^\n]*spPin/i.test(code), 'nor into storage');
  const rs = extractFunction(src, 'renderSuppliers', 'index.html');
  t.check(/spPinShown = null;/.test(rs), 'leaving the account for the book loses it, as the panel promises');
  const act = extractFunction(src, 'spPortalAct', 'index.html');
  t.check(/sb\.functions\.invoke\('supplier-accounts'/.test(act),
    'every account action goes through supplier-accounts, which mints and hashes');
  t.check(!/from\('supplier_accounts'\)\.(insert|update|upsert)/.test(code),
    'the owner app never writes supplier_accounts itself');
}

/* ---------- 2. the one-accent rule on the account --------------------- */
{
  const panel = extractFunction(src, 'supplierPortalPanelHTML', 'index.html');
  t.check(/otherAccent/.test(panel) && /supplierAskList\(s\.id\)/.test(panel),
    'the PIN button is the accent only when the account has no "Ask for prices" accent of its own');
  t.check(/supplierAccountsTable/.test(panel) && /0132_supplier_accounts\.sql/.test(panel),
    'with no 0132 the panel says so, in one line, rather than offering a button that cannot work');
}

/* ---------- 3. folding answers from the supplier app ------------------- */
const data = { savedQuotes: [], suppliers: [] };
const answers = [];
const updates = [];
const toasts = [];
const sbStub = {
  from: () => ({ update: (row) => ({ in: (col, ids) => { updates.push({ row, ids }); return Promise.resolve({ error: null }); } }) }),
};
const NAMES = ['orderSupplierGroups', 'orderSupplierTerms', 'orderSupplierConfirmState',
  'orderUnconfirmedSuppliers', 'orderDraftReady', 'setOrderSupplierConfirm',
  'supplierAppLatestAnswers', 'supplierAppAnswerFor', 'supplierAppAnswerNote',
  'foldSupplierAnswers', 'acceptSupplierTerms'];
const scope = compileScope([
  extractDeclaration(src, 'SUPPLIER_APP_SAID', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  sb: sbStub,
  supplierAnswersTable: true,
  supplierAnswerRows: answers,
  saveData: () => {},
  renderSavedQuotes: () => {},
  orderLeaveDraft: () => false,
  agentOrderSuppliersConfirmed: () => false,
  agentOrderTerms: () => '',
  toast: (m) => toasts.push(String(m)),
  supplierName: (id) => 'Supplier ' + id,
  quoteClientName: () => 'Musa',
  ORDER_STATUS_SHORT_LABELS: {},
}, NAMES);

const line = (over) => Object.assign({ lineId: 'L1', productId: 'P1', variantIdx: null, productName: 'Binding wire', qty: 10, price: 65000, unit: 'rolls', supplierId: 'S1' }, over);
const order = (items) => {
  const q = { id: 372, client: { name: 'Musa' }, status: 'draft', items, supplierConfirms: {} };
  data.savedQuotes = [q];
  answers.length = 0; updates.length = 0; toasts.length = 0;
  return q;
};
const at = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString();

{
  const q = order([line()]);
  answers.push({ id: 1, order_id: 372, supplier_id: 'S1', state: 'confirmed', terms: scope.orderSupplierTerms(q, 'S1'), changes: [], note: '', at: at(5), folded_at: null });
  eq(scope.foldSupplierAnswers(), 1, '"have all" at the order as it stands is folded in');
  const st = scope.orderSupplierConfirmState(q, 'S1');
  eq(st.state, 'confirmed', 'and settles the row, which is the point of asking in the app');
  eq(st.by, 'supplier', 'marked as said by the supplier, not by somebody here');
  t.check(Math.abs(st.at - Date.parse(answers[0].at)) < 1000, 'dated when THEY answered, not when it was read');
  eq(updates.length, 1, 'and marked read in supplier_answers');
  eq(scope.foldSupplierAnswers(), 0, 'a second read folds nothing — two devices fold it once');
}
{
  const q = order([line()]);
  answers.push({ id: 2, order_id: 372, supplier_id: 'S1', state: 'confirmed', terms: 'P1::5:65000', changes: [], note: '', at: at(5), folded_at: null });
  eq(scope.foldSupplierAnswers(), 0, 'an answer to the order as it USED to be is not applied');
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'pending', 'so the row still waits');
  t.check(scope.supplierAppAnswerFor(q, 'S1').outdated, 'and the panel can say it answered an older version');
}
{
  const q = order([line()]);
  q.supplierConfirms.S1 = { state: 'problem', at: Date.now(), askedAt: null, terms: null, note: 'rang them: none left' };
  answers.push({ id: 3, order_id: 372, supplier_id: 'S1', state: 'confirmed', terms: scope.orderSupplierTerms(q, 'S1'), changes: [], note: '', at: at(30), folded_at: null });
  eq(scope.foldSupplierAnswers(), 0, 'an app answer OLDER than what somebody here recorded does not overwrite it');
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'problem', 'the newer word stands');
}
{
  const q = order([line({ status: undefined })]);
  q.status = 'awaiting_goods';
  answers.push({ id: 4, order_id: 372, supplier_id: 'S1', state: 'none', terms: scope.orderSupplierTerms(q, 'S1'), changes: [], note: '', at: at(5), folded_at: null });
  eq(scope.foldSupplierAnswers(), 0, 'an order that has left Draft is not touched');
}

/* ---------- 4. a short answer is the owner's to take ------------------- */
{
  const q = order([line(), line({ lineId: 'L2', productName: 'Nails', qty: 50, price: 7800 })]);
  answers.push({ id: 5, order_id: 372, supplier_id: 'S1', state: 'short', terms: scope.orderSupplierTerms(q, 'S1'), changes: [{ lineId: 'L1', have: 6 }], note: 'Only 6 until Monday', at: at(5), folded_at: null });
  scope.foldSupplierAnswers();
  const st = scope.orderSupplierConfirmState(q, 'S1');
  eq(st.state, 'problem', 'a short answer is recorded, not taken');
  eq(q.items[0].qty, 10, 'and the order is NOT changed by it');
  t.check(/Only 6 until Monday/.test(st.note), 'their own words are kept');
  t.check(st.short && st.short[0].have === 6, 'with what they can give, line by line');
  t.check(scope.acceptSupplierTerms(372, 'S1'), 'the owner can take their terms');
  eq(q.items[0].qty, 6, 'which cuts the line to what they can give');
  eq(q.items[1].qty, 50, 'and leaves the lines they have in full alone');
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'confirmed', 'and confirms them at the new terms');
}
{
  const acts = compileScope([extractFunction(src, 'supplierConfirmActionsHTML', 'index.html')],
    { esc: (x) => String(x) }, ['supplierConfirmActionsHTML']).supplierConfirmActionsHTML;
  const html = acts('S1', { state: 'problem', askedAt: 1, short: [{ lineId: 'L1', have: 6 }] });
  t.check(/btn-accent sconf-terms[^>]*>Accept their terms/.test(html), '"Accept their terms" is the one accent on a short answer');
  eq((html.match(/btn-accent/g) || []).length, 1, 'and the only one');
}

/* ---------- 5. proposals change nothing by themselves ------------------ */
{
  const view = extractFunction(src, 'prxProposalView', 'index.html');
  const html = extractFunction(src, 'prxProposalsHTML', 'index.html');
  t.check(!/data\.prices\s*=|data\.prices\.push|\.retail\s*=|\.tiers\s*=/.test(html + view), 'drawing the queue writes no price');
  t.check(!/saveData\(/.test(view) && !/saveData\(/.test(html), 'nor saves anything');
  const act = extractFunction(src, 'prxProposalAct', 'index.html');
  t.check(/prxApplyProposal\(v\)/.test(act) && /action === 'accept' \|\| action === 'safe'/.test(act),
    'the registry changes only on Accept (or the safe-ones button)');
  const safe = /safe = was != null && was > 0 && Math\.abs\(now - was\) \/ was < 0\.02/.test(view);
  t.check(safe, '"safe" means a still-correct check, or a change under 2%');
  const apply = extractFunction(src, 'prxApplyProposal', 'index.html');
  t.check(/confirmPriceUnchanged\(/.test(apply), '"still correct" uses the registry’s own unchanged-price path');
  t.check(/priceSource: 'supplier'/.test(apply), 'and a supplier’s price is marked as theirs');
  t.check(/kind === 'new'/.test(view) && /can = false/.test(view),
    'a new item is never added to the catalogue automatically');
}

process.exit(t.done() ? 1 : 0);
