#!/usr/bin/env node
'use strict';
/*
 * The order preview, simplified — and moving an order backwards.
 *
 * Two pieces of Order tracking, from the handoff in
 * .design/handoffs/design_handoff_order_preview_and_back/.
 *
 * THE PREVIEW was eleven blocks and a scrollbar on a one-line order
 * worth 12,000. Two of them drew the same timeline, three explained how
 * the app works, and the largest figure in the dialog — a pack surplus
 * eighteen times the order's value — was the fourth sentence of a grey
 * paragraph. It is six blocks now, and the rule underneath is that a
 * block appears only when it has content: the dialog is the size of the
 * order, so a one-item order in the yard stops looking as heavy as a
 * forty-line delivery in dispute.
 *
 * THE BACKWARD MOVE did not exist anywhere in the app. The board had
 * Hold or cancel, forward buttons, and a back arrow that only walked the
 * needs-you queue. But a van comes back. What is pinned here is the four
 * rules that make it safe: it is an event and never an erasure, it is
 * not a drag, the reason decides what else changes, and the client is
 * told by default.
 *
 * Run: node test/order-preview-and-back.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('order preview and back');
const src = read('index.html');
const prev = extractFunction(src, 'otPreviewSpec', 'index.html');
const back = extractFunction(src, 'otMoveBackSpec', 'index.html');
const track = extractFunction(src, 'otTrackHTML', 'index.html');

/* ---------- 1. six blocks, and what left ----------------------------- */
{
  /* Each of these was a heading or a paragraph in the old dialog, and
     each is named in the handoff with the reason it went. A test that
     only counted blocks would pass on a dialog that had dropped the
     wrong six. */
  [['How it got here', /How it got here/],
   ['Goods, as checked in', /Goods, as checked in|ow-dlg-shots/],
   ['the Loaded paragraph', /counts it as picked and packed/],
   ['the Not invoiced heading', /ow-dlg-l">\$\{q\.invoiced \? 'Invoiced' : 'Not invoiced'/],
   ['the footer sentence', /Nothing here sends itself/],
   ['the margin methodology', /today's cheapest supplier where it has not — not the list price/],
  ].forEach(([what, re]) => t.check(!re.test(prev), `${what} is gone from the preview`));

  /* And the six that stayed, each identified by something only it has. */
  [['the navy header', /om-od-h/], ['the stage track', /otTrackHTML\(q/],
   ['what to tell the client', /What to tell the client/], ['the line and the money', /om-od-money/],
   ['the pack surplus', /om-od-sur/], ['the action footer', /om-od-f/],
  ].forEach(([what, re]) => t.check(re.test(prev), `${what} is drawn`));
}

/* ---------- 2. a block appears only when it has content -------------- */
{
  /* THE RULE THE WHOLE REDESIGN RESTS ON. Every one of these is a
     conditional, and the condition is a fact about THIS order rather
     than about the screen. */
  [['no client band when there is nothing to say', /\$\{say \? `<div class="om-od-say">/],
   ['no surplus block when the pack matches the order', /\$\{overPack\.length \? `<div class="om-od-sur">/],
   ['no suppliers block once they have all answered', /\$\{q\.status === 'draft' && orderSupplierGroups\(q\)\.length \?/],
   ['no print button on an order with no lines', /\$\{s\.lines\.length \? `<button[^`]*opChitBtn/],
   ['no agent note on an order no agent placed', /\$\{q\.originAgentId \?/],
  ].forEach(([what, re]) => t.check(re.test(prev), what));
}

/* ---------- 3. the pack surplus is its own block --------------------- */
{
  /* The point of the redesign: 218,500 on an order worth 12,000 was
     sentence four of a five-sentence paragraph. What leaves the till
     goes on top, and where the rest of it goes is said underneath. */
  t.check(/Leaves the till today/.test(prev), 'the surplus block leads with what actually leaves the till');
  t.check(/orderOwnCost\(buys\)/.test(prev) && /orderPackSurplusCash\(buys\)/.test(prev),
    'and both figures are derived rather than written into the copy');
  t.check(/goes on the shelf as stock, not into this sale/.test(prev),
    'and it says where the difference went');
  /* Nine words instead of five sentences of method. What a person needs
     is whether the figure can be trusted. */
  t.check(/Cost is what the buyer paid, not the list price\./.test(prev),
    'the margin is trusted in nine words rather than explained in five sentences');
}

/* ---------- 4. the form teaches itself ------------------------------- */
{
  t.check(/carrierFormHTML\(q, OM_LOAD_CLS/.test(prev),
    'the carrier form is the same form the picker\'s phone draws, in the card system\'s clothes');
  t.check(/orderCarrierChosen\(q\) \? '' : 'disabled/.test(prev),
    'and the primary cannot be pressed until somebody is named — which is where the paragraph explaining that went');
}

/* ---------- 5. rule 1: a move back is an event, not an erasure ------- */
{
  const setter = extractFunction(src, 'setSavedQuoteStatus', 'index.html');
  t.check(/back \? \{ from, back:true, reason:/.test(setter),
    'a backward move appends an event carrying where it came from, why and who');
  t.check(!/\.at\s*=\s*Date\.now/.test(setter),
    'and never writes over the stamp on the stage being left');

  const env = { SQ_STATUS_ORDER: ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'] };
  const NAMES = ['orderStageEvents', 'orderStageVisits', 'orderStageFirstAt', 'orderStageLeftBack', 'orderBackMoves'];
  const scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), env, NAMES);
  /* Out at 14:02, back in Preparing at 15:10. The hour and eight minutes
     on the road is exactly the hour somebody rings up about. */
  const q = { status: 'preparing', stageLog: [
    { status: 'awaiting_goods', at: 1000 }, { status: 'preparing', at: 2000 },
    { status: 'pending_delivery', at: 3000 },
    { status: 'preparing', at: 4000, back: true, from: 'pending_delivery', reason: 'came_back' }] };
  t.check(scope.orderStageFirstAt(q, 'pending_delivery') === 3000,
    'the trip it made is still on the record at the time it was made');
  t.check((scope.orderStageLeftBack(q, 'pending_delivery') || {}).at === 4000,
    'and so is the moment it came back, as a separate fact');
  t.check(scope.orderStageVisits(q, 'preparing') === 2,
    'a step entered twice reports twice, which is what the chip reads');
  t.check(scope.orderStageVisits(q, 'draft') === 1,
    'and Taken counts the arrival the log does not hold — nothing moved it there');
  t.check(scope.orderBackMoves(q).length === 1, 'one backward move on the order');
}

/* ---------- 6. rule 2: not by dragging ------------------------------- */
{
  t.check(/data-dlg="backpick"/.test(track),
    'a step the order has been through is pressable on the track that already shows where it has been');
  t.check(!/draggable|dragstart|ondrop/i.test(prev) && !/draggable|dragstart|ondrop/i.test(back),
    'and neither sheet offers a drag — dragging a card is as cheap as reordering one, and this alters the record');
  t.check(/case 'backpick':/.test(src) && /openMoveBack\(id, el\.dataset\.back\)/.test(src),
    'pressing it opens the sheet rather than moving the order');
  /* TAKEN IS NEVER A TARGET: going back past Buying would unbuy goods
     that are in the yard and paid for, which is a return to a supplier
     and belongs to the buying side. Drawn and greyed rather than left
     off — a step missing from a track is a track nobody trusts. */
  const targets = extractFunction(src, 'orderBackTargets', 'index.html');
  t.check(/status === 'draft' \? 'too far back'/.test(targets) && /const can = status !== 'draft'/.test(targets),
    'Taken is drawn, greyed, and says why it cannot be a target');
}

/* ---------- 7. rule 3: the reason decides what else changes ---------- */
{
  const reasons = extractDeclaration(src, 'OT_BACK_REASONS', 'index.html');
  ['The van came back with it', 'The client refused it', 'It was marked out by mistake']
    .forEach((r) => t.check(reasons.includes(r), `an order coming back from Out can say "${r}"`));
  /* The van coming back and the client refusing both free the stop on
     the run; marked-by-mistake never took one, because the van never
     carried it. That is the whole reason the question is asked. */
  t.check(/freesStop:false/.test(reasons) && /freesStop:true/.test(reasons),
    'and the three differ in what they free, which is why the sheet asks at all');

  const changes = extractFunction(src, 'orderBackChanges', 'index.html');
  t.check(/Run \$\{at \+ 1\} loses this stop/.test(changes),
    'the derived list names the run that loses the stop');
  t.check(/reason\.freesStop !== false/.test(changes),
    'and only when the reason really freed one');
  /* DERIVED, NEVER INVENTED. The shop keeps no drive times, so the
     round's LENGTH is not on this line however much the mockup wanted
     it: a duration here would be a figure the books cannot answer for.
     The count they can. */
  t.check(!/1h 40m|\dh \d\dm/.test(changes),
    'and never a duration, because the shop keeps no drive times to derive one from');
  t.check(/nothing was invoiced, and nothing is owed before delivery/.test(changes),
    'money is reported as unmoved when nothing was billed');
  /* DELIVERED -> OUT IS THE ONE MOVE WITH MONEY IN IT. If the invoice
     has been drawn, the goods coming back means voiding it — an invoice
     operation that happens to change a stage, and Invoices already
     guards that path. */
  t.check(/The invoice has to be voided first/.test(changes), 'and an invoiced order says the move is an invoice operation');
  const move = extractFunction(src, 'moveOrderBack', 'index.html');
  t.check(/if\(q\.invoiced\)\{/.test(move) && /undo the invoice on Invoices first/.test(move),
    'which the move itself refuses to shortcut');
}

/* ---------- 8. rule 4: the client is told, by default ---------------- */
{
  t.check(/Tell the client it did not arrive/.test(back), 'the sheet offers to tell the client');
  t.check(/Leaving this unticked means the last thing they heard from you is untrue/.test(back),
    'and says why in those words rather than as a preference');
  t.check(/otBackTell == null \? !!promise : !!otBackTell/.test(back),
    'the tick follows the derived default until the owner touches it');
  /* DERIVED, not assumed from the stage. The app cannot see WhatsApp,
     so what it can honestly record is that the message was drafted and
     opened -- and with nothing stamped there is no promise to
     contradict and the block does not draw at all. */
  const promise = extractFunction(src, 'orderClientPromise', 'index.html');
  t.check(/if\(!t \|\| !t\.at\) return null;/.test(promise) && /if\(t\.status !== q\.status\) return null;/.test(promise),
    'and only a promise made about the stage being left counts as one');
  t.check(/q\.clientTold = \{ at: Date\.now\(\), status: q\.status/.test(extractFunction(src, 'otTellClient', 'index.html')),
    'which is stamped where the message is opened, exactly as announcing to the group is');
  /* Do not build a second composer. */
  t.check(/window\.open\(waComposeUrl/.test(extractFunction(src, 'otTellClient', 'index.html')),
    'the message itself is the composer the app already has');
}

/* ---------- 9. the track afterwards ---------------------------------- */
{
  t.check(/→ back \$\{otWhen\(ret\.at\)\}/.test(track),
    'a returned step keeps its time and gains the return it made');
  t.check(/om-od-trk-d\.om-back\{[^}]*var\(--om-late\)/.test(src),
    'drawn in caution ink, on a dot that is hollow rather than filled');
  t.check(/esc\(otOrdinal\(orderStageVisits\(q, st\)\)\)\} time/.test(track),
    'and the current step says how many times it has been entered');
  /* "2nd", not "2nd" for ever: an order can come back more than once,
     and a chip that still said "2nd time" the fourth time round is a
     chip nobody trusts. */
  const ord = compileScope([extractFunction(src, 'otOrdinal', 'index.html')], {}, ['otOrdinal']).otOrdinal;
  [[2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [21, '21st']]
    .forEach(([n, want]) => t.check(ord(n) === want, `${n} reads ${want} (got ${ord(n)})`));
  /* One sentence closes the card, because an amber dot on its own is a
     puzzle. */
  const line = extractFunction(src, 'otTrackLine', 'index.html');
  t.check(/Went out at \$\{otWhen\(went \|\| last\.at\)\}, came back at/.test(line),
    'and one sentence under the track says what happened, in words');
}

/* ---------- 10. what this is not ------------------------------------- */
{
  /* Hold or cancel stops an order where it stands. This puts it back a
     step and keeps it live. Both exist, and the sheet never offers
     cancelling as a way of going backwards. */
  t.check(!/data-dlg="cancel"/.test(back),
    'the move-back sheet never offers cancelling as a way of going back');
  t.check(/data-dlg="cancel"/.test(prev), 'while the order itself still has Hold or cancel');
  t.check(/Move it back to \$\{esc\(OT_LANE_NAME\[otBackTo\]/.test(back),
    'and the primary names the destination, so it is readable without the track');
}

process.exit(t.done() ? 1 : 0);
