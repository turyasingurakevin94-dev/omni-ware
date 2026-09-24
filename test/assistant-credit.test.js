#!/usr/bin/env node
'use strict';
/*
 * Out of AI credit, said in plain words -- and the everyday questions
 * answered from the books, so the panel still works without the AI.
 * Plus the panel owning the keyboard while it is open.
 *
 * Run: node test/assistant-credit.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('assistant credit');
const src = read('index.html');
const api = read('api/assistant.js');

/* ---------- 1. the server names it -------------------------------------- */
{
  class APIError extends Error { constructor(m, s) { super(m); this.status = s; } }
  const Anthropic = { AuthenticationError: class extends APIError {}, RateLimitError: class extends APIError {},
    APIConnectionError: class extends APIError {}, APIError };
  const { apiErrorReply } = compileScope([extractFunction(api, 'apiErrorReply', 'api/assistant.js')], { Anthropic, String }, ['apiErrorReply']);
  const out = apiErrorReply(new APIError('400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}', 400));
  t.check(out.status === 402 && out.error.type === 'no_credit' && !/\{/.test(out.error.message) && /top up/i.test(out.error.message),
    'a credit refusal becomes a plain sentence with what to do, never the provider\'s JSON');
  t.check(apiErrorReply(new APIError('400 text content blocks must be non-empty', 400)).error.type === 'api_error',
    'and any other rejection is still reported as before');
}

/* ---------- 2. the panel says it once, and remembers ------------------- */
{
  const { apIsNoCredit } = compileScope([extractFunction(src, 'apIsNoCredit', 'index.html')], { String }, ['apIsNoCredit']);
  t.check(apIsNoCredit({ type: 'no_credit' }) && apIsNoCredit({}, 402) && apIsNoCredit({ message: 'Your credit balance is too low' }) && !apIsNoCredit({ message: 'busy' }, 429),
    'the browser recognises the refusal however it arrives, including from an older server');
  const call = extractFunction(src, 'apCallServer', 'index.html');
  t.check(/if\(out\.noCredit\)\{ apCreditMark\('out'\); apRenderNoCredit\(\); return null; \}/.test(call) && /apCreditMark\('ok'\);/.test(call),
    'a refusal marks the credit out and shows the plain card; the next answer that gets through clears it');
  t.check(/if\(apIsNoCredit\(err, resp\.status\)\) return \{ error: AP_NO_CREDIT, noCredit: true \};/.test(extractFunction(src, 'apCallServerOnce', 'index.html'))
    && /if\(failed && apIsNoCredit\(failed\)\)/.test(extractFunction(src, 'apReadStream', 'index.html')),
    'on both the plain and the streamed path');
  t.check(/id="apCredit"/.test(src) && /AI credit: out/.test(extractFunction(src, 'apPaintCredit', 'index.html')),
    'and the panel header shows whether the AI is working, and how many questions went to it this month');
}

/* ---------- 3. the books answer without it ------------------------------ */
{
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const { apLocalAnswer } = compileScope([extractFunction(src, 'apLocalAnswer', 'index.html')], {
    esc, String, Number, Math, CASH_AHEAD_DAYS: 30,
    fmtUGX: (n) => Number(n).toLocaleString('en-US') + ' UGX', fmtShortDate: (d) => d, todayISO: () => '2026-09-24',
    cashOnHandByAccount: () => ({ total: 10630000, byAccount: [{ label: 'Cash drawer', amount: 8000000 }, { label: 'Mobile money', amount: 2630000 }] }),
    cashAhead: () => ({ committed: 4000000, safeToSpend: 6630000 }),
    debtChaseRows: () => ({ due: [{ name: 'Amos Dulisa', debt: 2515000, ageDays: 13 }], promised: [{ name: 'Dad', debt: 1436000, ageDays: 30 }], resting: [], blocked: [] }),
    anInvoicesInRange: () => [{ t: 1000000, p: 60000 }, { t: 500000, p: 20000 }], savedQuoteTotal: (q) => q.t, anInvoiceTotals: (q) => ({ profit: q.p }),
    data: { products: [{ id: 'P1', name: 'Cement Hima 50kg', variants: [] }] }, ourPriceFor: () => 34000, productVariantLabel: (p) => p.name,
  }, ['apLocalAnswer']);
  const cash = apLocalAnswer('How much money do I have?');
  t.check(/10,630,000 UGX/.test(cash) && /Cash drawer/.test(cash) && /6,630,000 UGX/.test(cash), 'money: the total, each account, and what is safe to spend');
  const owe = apLocalAnswer('Who owes me the most?');
  t.check(/2 customers owe you/.test(owe) && owe.indexOf('Amos') < owe.indexOf('Dad') && /13 days/.test(owe), 'debts: who owes, biggest first, and how old');
  t.check(/1,500,000 UGX/.test(apLocalAnswer('What did we sell this month?')) && /2 invoices/.test(apLocalAnswer('What did we sell this month?')), 'sales this month, from the invoices');
  t.check(/34,000 UGX/.test(apLocalAnswer('What is the price of cement')), 'a price, from the price rules');
  t.check(apLocalAnswer('Should I reprice the Masasi lines?') === null, 'and a question that needs judgement is left for the AI');
  const welcome = extractFunction(src, 'apRenderWelcome', 'index.html');
  t.check(/if\(apLocalAnswer\(q\)\)\{ apSendLocal\(q\); return; \}/.test(welcome), 'the starter questions always answer from the books, free');
  t.check(/apCreditState\(\) === 'out' && apLocalAnswer\(clean\)/.test(extractFunction(src, 'apSend', 'index.html')),
    'and with the credit out, a typed question the books can answer is answered');
}

/* ---------- 4. the keyboard belongs to the panel ------------------------ */
{
  const panel = { classList: { contains: (c) => c === 'open' } };
  const { navShortcutsBlocked } = compileScope([extractFunction(src, 'navShortcutsBlocked', 'index.html')], {
    document: { activeElement: { tagName: 'DIV' }, querySelector: () => null, getElementById: (id) => id === 'assistantPanel' ? panel : null },
  }, ['navShortcutsBlocked']);
  t.check(navShortcutsBlocked({ key: 'p' }) === true, 'a letter pressed while the assistant is open never jumps the app to another screen');
  const open = extractFunction(src, 'apOpenPanel', 'index.html');
  t.check(/input\.focus\(\);/.test(open) && /setTimeout\(grab, 320\)/.test(open), 'and the box takes the cursor at once, and again once the panel has slid in');
}

/* ---------- 5. the chat knows today's plan ------------------------------ */
{
  const scope = compileScope([extractFunction(src, 'apPlanChips', 'index.html'), extractFunction(src, 'apPlanSummary', 'index.html'),
    'let mgrMapJournal = null; let mgrJournalTopRepeat = null; function setJ(j, t){ mgrMapJournal = j; mgrJournalTopRepeat = t; }'], {
    mgrMoveOrder: (m) => m, mgrMoveFace: (b) => ({ name: b.who || '' }), targetMarginPct: () => 10,
    MANAGER_OBJECTIVES: { cash: 'Cash first' }, String, Math, Number,
  }, ['apPlanChips', 'apPlanSummary', 'setJ']);
  t.check(scope.apPlanChips().length === 0 && scope.apPlanSummary() === '', 'with no plan, the chat opens as before');
  scope.setJ({ today: { meeting: { body: { objective: 'cash', keyline: 'Get Amos in', rejected: 'the reorder waits' } },
    moves: [{ status: 'open', body: { title: 'Collect from Amos', who: 'Amos Dulisa', worth: 2515000, why: 'biggest and freshest' } }] } },
    { title: 'Put 5,000 shillings on the Masasi carton — worth more' });
  const chips = scope.apPlanChips();
  t.check(chips[0] === 'Why is Amos Dulisa first?' && /Did the advice to put 5,000 shillings on the Masasi carton work\?/.test(chips[1]) && /margin reaching 10%/.test(chips[2]),
    'with a plan, its first questions are about it: why this first, did the repeated advice work, what stops the margin (got ' + JSON.stringify(chips) + ')');
  const sum = scope.apPlanSummary();
  t.check(/Get Amos in/.test(sum) && /Collect from Amos — 2515000 UGX — open — why: biggest and freshest/.test(sum) && /considered and rejected: the reorder waits/.test(sum),
    'and a question asked from the plan carries it: the one thing, each move with its figure, state and reason, and what was rejected');
  t.check(/const planCtx = \(apPlanContextNext && apPlanSeededThread !== assistantThread\) \? apPlanSummary\(\) : '';/.test(extractFunction(src, 'apSend', 'index.html')),
    'once per conversation, not on every question');
  const wire = extractFunction(src, 'mgrWirePlan', 'index.html');
  t.check(/apPlanContextNext = true;/.test(wire) && /About move \$\{n \? n \+ ' ' : ''\}/.test(wire), 'Ask on a move opens the chat with that move, its number and figure filled in');
}

process.exit(t.done() ? 1 : 0);
