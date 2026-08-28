#!/usr/bin/env node
'use strict';
/*
 * Draft: getting the suppliers to say yes before the group is told.
 *
 * Saving a quote used to announce it to the sales group in the same
 * breath, which said in effect "this is agreed". Often it was not -- the
 * supplier is rung afterwards and has none left, or the price has moved
 * since it was last recorded. By then the group had been told and
 * somebody was working from a figure nobody had checked.
 *
 * So an order waits in Draft until every supplier on it has come back,
 * and the group is told at the moment it LEAVES Draft.
 *
 *   who to ask     one row per supplier, not per line: one call settles
 *                  every line that supplier is on. Our own shelf has
 *                  nobody to ring, and neither does a line with no
 *                  supplier picked yet -- the second is reported so it
 *                  is visible, but does not hold the order back, because
 *                  a supplier is chosen for it at buying time.
 *   STALENESS      the one that matters. A confirmation is about TERMS.
 *                  Confirm, then edit the quote underneath it -- put a
 *                  quantity up, drop a price to win the job -- and a
 *                  plain boolean would still read as confirmed while
 *                  describing an agreement nobody made. The gate would
 *                  then open on the strength of a call about different
 *                  goods, which is the exact failure this stage exists
 *                  to stop.
 *   told once      forward out of Draft only. An order sent back and
 *                  pushed on again must not re-announce itself, or the
 *                  group reads it as a second order.
 *
 * Mutation-tested at 24 of 26. The two survivors are equivalent, proved
 * by driving both builds over the same data rather than by reading:
 *
 *   dropping `dir>0` from the draft gate    Draft is SQ_STATUS_ORDER[0],
 *     so a backward step computes nextIdx -1 and returns before the gate
 *     is ever reached. Kept anyway: it states the intent, and it stops
 *     being equivalent the moment anything is ordered ahead of Draft.
 *   recording terms on a 'problem' too      orderSupplierConfirmState
 *     only compares terms when the state is already 'confirmed', so
 *     terms on any other state are never read.
 *
 * Run: node test/order-draft-confirm.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order draft confirmation');
const src = read('index.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const data = { savedQuotes: [], suppliers: [] };
const calls = { announced: [], panelOpened: null, toasts: [] };

const NAMES = ['orderSupplierGroups', 'orderLinesWithNoSupplier', 'orderSupplierTerms',
  'orderSupplierConfirmState', 'orderUnconfirmedSuppliers', 'orderDraftReady',
  'setOrderSupplierConfirm', 'markOrderSupplierAsked', 'supplierConfirmMessage',
  'setSavedQuoteStatus', 'stepSavedQuoteStatus'];

const scope = compileScope([
  extractDeclaration(src, 'SQ_STATUSES', 'index.html'),
  extractDeclaration(src, 'SQ_STATUS_ORDER', 'index.html'),
  extractDeclaration(src, 'STAGE_ASSIGNMENT_ROLE', 'index.html'),
  extractDeclaration(src, 'STAGE_ASSIGNMENT_FIELD', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {
  data,
  saveData: () => {},
  renderSavedQuotes: () => {},
  announceOrderMove: () => {},
  // The one collaborator that matters here: whether, and how often, the
  // sales group was told.
  shareOrderToSalesGroup: (q) => { calls.announced.push(q.id); },
  openSupplierConfirmModal: (id) => { calls.panelOpened = id; },
  toast: (m) => { calls.toasts.push(String(m)); },
  supplierName: (id) => 'Supplier ' + id,
  quoteClientName: (q) => (q && q.client && q.client.name) || 'Walk-in',
  fmtUGX: (n) => 'UGX ' + Number(n).toLocaleString('en-UG'),
  // The real rule, not a flat answer: an order with anything bought in is
  // waiting on goods. Which is also what keeps the step under test landing
  // on Awaiting Goods -- Being Prepared needs a worker picked, and the
  // assign-staff modal would divert the move before it ever announced.
  orderAwaitsGoods: (q) => ((q && q.items) || []).some((it) => it.supplierId && it.supplierId !== '__stock__'),
  // Gates belonging to other stages, held open so this file measures its own.
  agentPaymentBlocksPreparing: () => false,
  promptAgentPrepayment: () => {},
  openAssignStaffModal: () => {},
  resetPickingProgress: () => {},
}, NAMES);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

let nextId = 1;
const line = (over) => Object.assign({
  lineId: nextId++, productId: 'P1', variantIdx: null, productName: 'Hinges',
  qty: 10, price: 5000, unit: 'pcs', supplierId: 'S1',
}, over);
const draft = (items) => {
  const q = { id: 500, client: { name: 'Musa' }, status: 'draft', items };
  data.savedQuotes = [q];
  calls.announced = []; calls.panelOpened = null; calls.toasts = [];
  return q;
};

/* ---------- 1. who actually has to be asked --------------------------- */
{
  const q = draft([
    line({ supplierId: 'S1' }),
    line({ supplierId: 'S1', productName: 'Screws' }),
    line({ supplierId: 'S2', productName: 'Cement' }),
    line({ supplierId: '__stock__', productName: 'Nails' }),
    line({ supplierId: null, productName: 'Paint' }),
  ]);
  const groups = scope.orderSupplierGroups(q);
  eq(groups.length, 2, 'one row per supplier, not per line — one call settles every line they are on');
  eq(groups[0].lines.length, 2, 'and it carries all of that supplier’s lines');
  t.check(!groups.some((g) => g.supplierId === '__stock__'),
    'our own shelf is not asked — there is nobody to ring');
  t.check(!groups.some((g) => !g.supplierId),
    'nor is a line with no supplier chosen');
  eq(scope.orderLinesWithNoSupplier(q).length, 1,
    'but that line is still reported, so it is visible rather than silently skipped');
}

/* ---------- 2. what "ready" means -------------------------------------- */
{
  const q = draft([line({ supplierId: 'S1' }), line({ supplierId: 'S2' })]);
  t.check(!scope.orderDraftReady(q), 'a fresh draft is not ready — nobody has been asked');
  eq(scope.orderUnconfirmedSuppliers(q).length, 2, 'both are outstanding');

  scope.setOrderSupplierConfirm(500, 'S1', 'confirmed', '');
  eq(scope.orderUnconfirmedSuppliers(q).length, 1, 'confirming one leaves the other');
  t.check(!scope.orderDraftReady(q), 'and one is not enough');

  scope.setOrderSupplierConfirm(500, 'S2', 'confirmed', '');
  t.check(scope.orderDraftReady(q), 'with every supplier back, it is ready');
}
{
  // Nothing bought in: there is no call for anybody to make, and holding
  // the order in Draft would be waiting for one that does not exist.
  const q = draft([line({ supplierId: '__stock__' })]);
  t.check(scope.orderDraftReady(q), 'an order filled entirely off our own shelf is ready by default');
  eq(scope.orderSupplierGroups(q).length, 0, 'because it has nobody to ask');
}

/* ---------- 3. a problem is not a confirmation ------------------------ */
{
  const q = draft([line({ supplierId: 'S1' })]);
  scope.setOrderSupplierConfirm(500, 'S1', 'problem', 'no stock until Friday');
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'problem', 'a problem is recorded as one');
  eq(scope.orderSupplierConfirmState(q, 'S1').note, 'no stock until Friday',
    'with what they actually said — "no stock till Friday" and "the price is now 12,000" need different fixes');
  t.check(!scope.orderDraftReady(q), 'and it does not open the gate');
}

/* ---------- 4. THE STALENESS RULE ------------------------------------- */
{
  const q = draft([line({ supplierId: 'S1', qty: 10, price: 5000 })]);
  scope.setOrderSupplierConfirm(500, 'S1', 'confirmed', '');
  t.check(scope.orderDraftReady(q), 'confirmed at 10 @ 5,000');

  q.items[0].price = 6500;
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'stale',
    'raising the price after the call un-confirms it — they agreed to a different figure');
  t.check(!scope.orderDraftReady(q), 'so the gate closes again');

  q.items[0].price = 5000;
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'confirmed',
    'and putting it back restores what was actually agreed');

  q.items[0].qty = 40;
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'stale',
    'quantity counts too — "yes we have ten" is not "yes we have forty"');

  q.items[0].qty = 10;
  q.items.push(line({ supplierId: 'S1', productName: 'Screws' }));
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'stale',
    'and so does adding a line to a supplier who already answered');
}
{
  // Rounding: the message quoted whole shillings, so a fraction the
  // supplier never saw must not un-confirm them.
  const q = draft([line({ supplierId: 'S1', price: 5000 })]);
  scope.setOrderSupplierConfirm(500, 'S1', 'confirmed', '');
  q.items[0].price = 5000.4;
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'confirmed',
    'a sub-shilling change is not a change — it never reached the supplier');
}
{
  // A problem carries no terms, so it cannot go stale into looking
  // resolved: only a confirmation is allowed to expire.
  const q = draft([line({ supplierId: 'S1' })]);
  scope.setOrderSupplierConfirm(500, 'S1', 'problem', 'price up');
  q.items[0].price = 9999;
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'problem',
    'editing the quote does not turn a problem into anything else');
}

/* ---------- 5. asking is remembered separately from answering --------- */
{
  const q = draft([line({ supplierId: 'S1' })]);
  scope.markOrderSupplierAsked(500, 'S1');
  t.check(!!scope.orderSupplierConfirmState(q, 'S1').askedAt, 'asking is stamped');
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'pending',
    'but asking is not answering — the gate stays shut on a message nobody replied to');

  scope.setOrderSupplierConfirm(500, 'S1', 'confirmed', '');
  t.check(!!scope.orderSupplierConfirmState(q, 'S1').askedAt,
    'and the answer keeps the record that they were asked at all');
}

/* ---------- 5b. the pill tells the two kinds of "pending" apart ------- */
{
  // Found by looking at the rendered panel: keyed on state alone, the pill
  // read "Not asked yet" directly above a note saying "Asked just now —
  // nothing back yet". The panel contradicting itself about the one thing
  // it exists to report.
  const pill = compileScope([extractDeclaration(src, 'SUPPLIER_CONFIRM_PILLS', 'index.html'),
    extractFunction(src, 'supplierConfirmPill', 'index.html')], {}, ['supplierConfirmPill']).supplierConfirmPill;
  eq(pill({ state: 'pending', askedAt: null }).label, 'Not asked yet', 'nobody has rung yet');
  eq(pill({ state: 'pending', askedAt: 123 }).label, 'Waiting for reply',
    'somebody rang and got nothing back — a different situation, and the one worth chasing');
  eq(pill({ state: 'confirmed', askedAt: 123 }).label, 'Confirmed', 'an answer outranks the asking');
  eq(pill({ state: 'pending', askedAt: 123 }).cls, '',
    'and it stays neutral — a supplier asked thirty seconds ago is not a warning, and colouring every outstanding ask amber is how a screen stops being read');
}

/* ---------- 5b2. the buttons match what the supplier has said --------- */
{
  /* Found by looking at a fully-confirmed panel: every row offered the
     same three buttons whatever state it was in, so a supplier who had
     already confirmed still had a red "They confirmed" as the loudest
     thing on their card, beside an "Ask on WhatsApp" implying nobody had
     asked. And a mis-tick could not be undone except by recording a
     Problem, which was a lie about what the supplier said. */
  const acts = compileScope([extractFunction(src, 'supplierConfirmActionsHTML', 'index.html')],
    { esc: (x) => String(x) }, ['supplierConfirmActionsHTML']).supplierConfirmActionsHTML;
  const accentOf = (html) => {
    const m = html.match(/btn-accent [a-z-]*sconf-(ask|yes|no)[^>]*>([^<]*)</);
    return m ? { kind: m[1], label: m[2] } : null;
  };
  const has = (html, cls) => html.includes(cls);

  const fresh = acts('S1', { state: 'pending', askedAt: null });
  eq(accentOf(fresh).label, 'Ask on WhatsApp',
    'nobody has been asked, so asking is the one highlighted action');

  const waiting = acts('S1', { state: 'pending', askedAt: 123 });
  eq(accentOf(waiting).kind, 'yes',
    'once the message has gone, recording their answer is what happens next');
  t.check(/Ask again/.test(waiting), 'and asking becomes “Ask again”, not “Ask on WhatsApp”');

  const done = acts('S1', { state: 'confirmed', askedAt: 123 });
  t.check(accentOf(done) === null,
    'a confirmed row has NO accent button — there is no work left on it to invite');
  t.check(!/They confirmed/.test(done),
    'and does not offer to confirm something already confirmed');
  t.check(has(done, 'sconf-undo'),
    'it offers Undo instead, so a tick on the wrong supplier can be taken back');
  t.check(/Ask again/.test(done), 'asking again is still possible, quietly');

  const stale = acts('S1', { state: 'stale', askedAt: 123 });
  eq(accentOf(stale).kind, 'ask',
    'when the quote moved under them, asking again IS the work and is highlighted');
  t.check(/new terms/.test(stale), 'and the label says what changed');

  const prob = acts('S1', { state: 'problem', askedAt: 123 });
  eq(accentOf(prob).kind, 'ask', 'a problem is resolved by going back to them');
  t.check(/Edit what they said/.test(prob),
    'and the note can be corrected rather than only replaced');

  ['pending', 'confirmed', 'stale', 'problem'].forEach((state) => {
    const html = acts('S1', { state, askedAt: 1 });
    const accents = (html.match(/btn-accent/g) || []).length;
    t.check(accents <= 1, `${state}: at most one accent button, so the eye is never asked to choose`);
  });
}

/* ---------- 5b3. undoing an answer does not unsay the asking --------- */
{
  const q = draft([line({ supplierId: 'S1' })]);
  scope.markOrderSupplierAsked(500, 'S1');
  scope.setOrderSupplierConfirm(500, 'S1', 'confirmed', '');
  scope.setOrderSupplierConfirm(500, 'S1', 'pending', '');
  const st = scope.orderSupplierConfirmState(q, 'S1');
  eq(st.state, 'pending', 'undo returns the row to unconfirmed');
  t.check(!!st.askedAt,
    'but keeps the record that they were asked — deleting it made a twice-chased supplier read as “Not asked yet”, and the next person rang them again');
}
{
  const q = draft([line({ supplierId: 'S1' })]);
  scope.setOrderSupplierConfirm(500, 'S1', 'confirmed', '');
  scope.setOrderSupplierConfirm(500, 'S1', 'pending', '');
  eq(scope.orderSupplierConfirmState(q, 'S1').state, 'pending',
    'and a row that was never asked simply clears');
}

/* ---------- 5c. reaching the supplier, and saying so when we cannot --- */
{
  // Found by counting the real shop: nine of forty-four suppliers have no
  // first number. Reading sup.phone alone would have opened a blank chat
  // for anyone whose number sits in phone2.
  const wa = compileScope([
    extractFunction(src, 'contactPhones', 'index.html'),
    extractFunction(src, 'supplierWaNumber', 'index.html'),
  ], { data }, ['supplierWaNumber']).supplierWaNumber;
  data.suppliers = [
    { id: 'A', name: 'First field', phone: '0700111222', phone2: '' },
    { id: 'B', name: 'Second field only', phone: '', phone2: '0700333444' },
    { id: 'C', name: 'Neither', phone: '', phone2: '' },
  ];
  eq(wa('A'), '0700111222', 'the usual case');
  eq(wa('B'), '0700333444', 'a number in phone2 is still a number to ring');
  eq(wa('C'), '', 'and none is none');
  eq(wa('gone'), '', 'a supplier no longer on file resolves to no number rather than throwing');
  data.suppliers = [];

  /* Tied to the CONDITION, not just to the words being present somewhere.
     Checking only that the sentence exists in the file passes happily
     while the branch that shows it is dead -- the string sits in a
     template literal that nothing ever reaches. */
  t.check(/const noNumber = !supplierWaNumber\(g\.supplierId\)[\s\S]{0,200}No WhatsApp number saved for them/.test(code),
    'the panel says so up front, and only when there is genuinely no number — otherwise WhatsApp opens its contact picker and the button looks broken');
}

/* ---------- 5d. the reason is collected in the panel ------------------ */
{
  // window.prompt was the only one in 43,000 lines: every other flow in
  // this file builds its own field. A native dialog on a phone is an
  // unstyled box that blocks the page.
  t.check(!/window\.prompt\(/.test(code),
    'no browser dialog — nothing else in this file uses one');
  t.check(/class="sconf-why-input"/.test(code), 'the reason is typed into the row itself');
  t.check(/supplierConfirmWhyFor = null;[\s\S]{0,200}closeModal\('supplierConfirmModal'\)/.test(code),
    'and closing the panel drops a half-typed reason, so it cannot reappear against another supplier');
  const wire = extractFunction(src, 'wireSupplierConfirmPanel', 'index.html');
  t.check(/e\.key === 'Enter'/.test(wire) && /e\.key === 'Escape'/.test(wire),
    'Enter saves and Escape backs out — without them a one-field form is mouse-only');
}

/* ---------- 5e. the panel's classes do not collide with the app's ----- */
{
  /* This is a bug that shipped into the working tree and was caught by
     looking at the rendered page, not by reading the diff. The panel was
     written with an `sc-` prefix, and `sc-` was already taken:

       .sc-row   the phone and location rows on every supplier card. The
                 app scopes its own as `.sc-details .sc-row`; a BARE
                 `.sc-row` rule therefore hit all 44 of them and put a
                 border, padding and a panel background round each.
       .sc-head  the supplier card header. The app's rule is bare too,
                 and mine was further down the file -- equal specificity,
                 so document order decided it and mine won, changing
                 align-items and gap on a card it had nothing to do with.

     Neither showed up in any test, because both files were still valid
     and every assertion still passed. Hence this: a prefix check is the
     only thing that catches a collision before somebody sees it. */
  const render = extractFunction(src, 'renderSupplierConfirmList', 'index.html');
  const used = [...new Set(
    (render.match(/class="[^"$]*"/g) || [])
      .map((m) => m.replace(/class="|"/g, ''))
      .join(' ')
      .split(/\s+/)
      .filter(Boolean)
  )];
  /* Three kinds of unprefixed class are legitimate, and each is here by
     name rather than by a loose pattern, so a fourth has to be argued for
     rather than slipping in:

       btn / btn-*    the app's button styling, reused deliberately.
       preset-hint    likewise -- the app's own muted-note style.
       good bad warn  pill colours, and orphan the dashed variant. Every
       orphan         one of them appears ONLY compounded in the panel's
                      CSS (.sconf-pill.warn, .sconf-row.orphan), so none
                      can land on anything by itself. */
  const ALLOWED = ['btn', 'preset-hint', 'good', 'bad', 'warn', 'orphan'];
  const stray = used.filter((c) => !c.startsWith('sconf-')
    && !ALLOWED.includes(c) && !c.startsWith('btn-'));
  // The compound-only claim, checked rather than trusted.
  ['good', 'bad', 'warn', 'orphan'].forEach((m) => {
    if (!used.includes(m)) return;
    t.check(!new RegExp(`^\\s*\\.${m}\\{`, 'm').test(code),
      `.${m} is never a rule on its own, so using it in the panel cannot restyle anything else`);
  });
  t.check(stray.length === 0,
    `every class the panel renders is sconf- prefixed, so it cannot land on anything else (stray: ${stray.join(', ') || 'none'})`);

  // And from the other side: the app's own two are left as they were.
  const bare = (sel) => (code.match(new RegExp(`^\\s*\\.${sel}\\{`, 'gm')) || []).length;
  eq(bare('sc-row'), 0,
    'no bare .sc-row rule — the app scopes its own as .sc-details .sc-row, and an unscoped one restyles all 44 supplier contact rows');
  eq(bare('sc-head'), 1,
    'exactly one bare .sc-head rule, the app’s own — a second one later in the file would win on document order and reshape supplier cards');
}

/* ---------- 6. the gate on the way out of Draft ----------------------- */
{
  const q = draft([line({ supplierId: 'S1' })]);
  scope.stepSavedQuoteStatus(500, 1);
  eq(q.status, 'draft', 'an unconfirmed order does not leave Draft');
  eq(calls.announced.length, 0, 'so the sales group is not told');
  eq(calls.panelOpened, 500,
    'and the panel opens — going to look at who is outstanding is the next thing anybody does');
  t.check(/still to confirm/.test(calls.toasts.join(' ')), 'the refusal says what is missing');
}
{
  const q = draft([line({ supplierId: 'S1' })]);
  scope.setOrderSupplierConfirm(500, 'S1', 'problem', 'none left');
  scope.stepSavedQuoteStatus(500, 1);
  eq(q.status, 'draft', 'nor does one with a problem on it');
  t.check(/reported a problem/.test(calls.toasts.join(' ')),
    'and the problem outranks the count — "2 of 3 confirmed" describes the arithmetic, not the situation');
}
{
  const q = draft([line({ supplierId: 'S1' })]);
  scope.setOrderSupplierConfirm(500, 'S1', 'confirmed', '');
  scope.stepSavedQuoteStatus(500, 1);
  t.check(q.status !== 'draft', 'a fully confirmed order moves on');
  eq(calls.announced.length, 1, 'and THAT is when the sales group is told');
}

/* ---------- 7. told once, and only forward ---------------------------- */
{
  const q = draft([line({ supplierId: '__stock__' })]);
  scope.setSavedQuoteStatus(500, 'preparing');
  eq(calls.announced.length, 1, 'leaving Draft announces once');
  scope.setSavedQuoteStatus(500, 'pending_delivery');
  eq(calls.announced.length, 1, 'later moves do not announce again');
  scope.setSavedQuoteStatus(500, 'draft');
  eq(calls.announced.length, 1, 'going back to Draft announces nothing');
  scope.setSavedQuoteStatus(500, 'preparing');
  eq(calls.announced.length, 2,
    'and pushing it on again announces once more — the correction the group needs, not a duplicate of the first');
}
{
  const q = draft([line({ supplierId: '__stock__' })]);
  q.status = 'preparing';
  calls.announced = [];
  scope.setSavedQuoteStatus(500, 'draft');
  eq(calls.announced.length, 0, 'a backward move into Draft never announces');
}

/* ---------- 8. what the supplier is actually sent --------------------- */
{
  const q = draft([
    line({ supplierId: 'S1', productName: 'Hinges', qty: 10, price: 5000 }),
    line({ supplierId: 'S2', productName: 'Cement', qty: 3, price: 42000 }),
  ]);
  const msg = scope.supplierConfirmMessage(q, 'S1');
  t.check(/Hinges/.test(msg), 'their own line is in the message');
  t.check(!/Cement/.test(msg),
    'and the rest of the order is not — a supplier has no business seeing it, and a list to filter is answered slowly');
  t.check(/5,000/.test(msg),
    'the PRICE is carried: it is half of what is being confirmed, and "yes we have them" against a figure they never saw is worse than not asking');
  t.check(/10/.test(msg), 'as is the quantity');
}

/* ---------- 9. saving no longer announces ----------------------------- */
{
  // Anchored on the click listener specifically: 'q_save_btn' also appears
  // in a keydown handler earlier in the file, and the loose anchor captured
  // that one instead -- 666 characters that contained neither the sales
  // group nor the status, so both checks "passed" against the wrong code.
  // Wrapped in saveOnceAtATime (one click, one document), so it registers
  // off a captured button and closes with `}));`.
  const saveHandler = (/__btn_q_save_btn\.addEventListener\('click'[\s\S]*?\n\}\)\);/.exec(code) || [''])[0];
  t.check(saveHandler.length > 0, 'found the save handler');
  // Block comments stripped as well as line ones: the comment left in the
  // handler EXPLAINS that the announcement moved out, and naming it there
  // is what a reader needs -- but it would satisfy a search for the name
  // and let a real call slip back in unnoticed.
  const saveCode = saveHandler.replace(/\/\*[\s\S]*?\*\//g, '');
  t.check(!/SALES_GROUP_WA_LINK|shareOrderToSalesGroup/.test(saveCode),
    'saving a quote does not tell the sales group — that is what this whole stage moved');
  /* The record literal moved into buildQuoteRecord so the assistant can
     build a draft through the identical path -- the handler now calls
     it, and the draft default is asserted where it lives. */
  t.check(/const record = buildQuoteRecord\(/.test(saveHandler),
    'the handler builds its record through the shared builder');
  t.check(/status: existing \? existing\.status : 'draft'/.test(
    extractFunction(src, 'buildQuoteRecord', 'index.html')),
    'and a new quote still lands in Draft');
}
{
  const setter = extractFunction(src, 'setSavedQuoteStatus', 'index.html');
  t.check(/SQ_STATUS_ORDER\.indexOf\(status\) > SQ_STATUS_ORDER\.indexOf\('draft'\)/.test(setter),
    'the hand-off is keyed on moving FORWARD out of draft');
  t.check(/const leavingDraft = moved && q\.status==='draft'/.test(setter),
    'and read before q.status is overwritten, or it would never be true');
}

/* ---------- 10. it survives a save ------------------------------------ */
{
  t.check(/supplierConfirms:q\.supplierConfirms\|\|null/.test(code),
    'confirmations go up in the payload — saved_quotes already has that column, so no migration');
  t.check(/\.\.\.\(q\.payload\|\|\{\}\)/.test(code),
    'and the loader spreads the payload back whole, so they come home');
  const workerKeys = read('worker.html');
  t.check(!/WORKER_OWNED_KEYS[\s\S]{0,400}supplierConfirms/.test(workerKeys),
    'admin-owned: a worker save merging onto the server row cannot revert a confirmation from its own stale snapshot');
}

/* ---------- 11. the confirm pill is not the assign button ------------- */
{
  // They share a look and deliberately not a class: the board wires every
  // .sq-assign-btn to the assign-staff modal, so sharing it would have made
  // the confirm pill open a staff picker.
  t.check(/class="sq-confirm-btn"/.test(code), 'the confirm pill has its own class');
  t.check(!/class="sq-assign-btn sq-confirm-btn"/.test(code),
    'and does not carry the assign class, which is wired to the staff picker');
  t.check(/querySelectorAll\('\.sq-confirm-btn'\)[\s\S]{0,120}openSupplierConfirmModal/.test(code),
    'it opens the confirmation panel instead');
}

process.exit(t.done() ? 1 : 0);
