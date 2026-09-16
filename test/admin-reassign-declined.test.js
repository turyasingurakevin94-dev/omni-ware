#!/usr/bin/env node
'use strict';
/*
 * An order nobody is preparing has to be visible, and re-assignable.
 *
 * denyOrderAssignment clears assignedWorkerId and pickingStatus but leaves
 * the order in Being Prepared -- correctly, since it still needs picking.
 * The board's card only drew an assignee row when there WAS an assignee, so
 * a declined order looked exactly like one being worked on, minus a line
 * nobody would notice was missing.
 *
 * And there was no way to put it back on somebody. The answer at the time
 * was a modal on the board: the owner picked a name and the order went to
 * that phone.
 *
 * The answer now is that nobody picks. A declined order is unassigned, and
 * an unassigned order in Being Prepared is IN THE PICKERS' QUEUE
 * (workerPickQueue, shared-worker.js) -- on every worker's phone, oldest
 * first, taken by the next one free. Declining is no longer a state the
 * board has to rescue an order from; it is the ordinary way an order goes
 * back to being anybody's.
 *
 * So what this file checks changed with it. The board still has to say
 * where an order stands, and it still has to offer a way out of the ONE
 * stranding that remains -- an order held by somebody whose app cannot
 * show it -- but "nobody is on it" is now a sentence, not an alarm.
 *
 * Run: node test/admin-reassign-declined.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, createReporter } = require('./_extract');

const t = createReporter('admin reassign declined');
const admin = read('index.html');
const shared = read('shared-worker.js');

/* ---------- 1. the card says when nobody is on it --------------------- */
{
  /* The console's who-cell asks orderNeedsWorker rather than only whether
     the field is empty, says which of the two absences it is, and the
     row's one act puts it on somebody. */
  const who = extractFunction(admin, 'orderWho', 'index.html');
  const act = extractFunction(admin, 'orderActSpec', 'index.html');
  t.check(/if\(orderNeedsWorker\(q\)\) main = otStaffGone\(q\.assignedWorkerId\) \? 'Assigned to someone no longer on staff'/.test(who),
    'an order held by somebody who cannot pick it says so in its own cell');
  t.check(/not on their phone/.test(who), 'and says which of the two it is');
  t.check(/if\(orderNeedsWorker\(q\)\) return \{ act:'release', label:'Back to the queue' \};/.test(act),
    'with an act that puts it back where anybody can take it');
  // A declined order -- nobody on it -- is the ordinary case now, and it
  // reads as a place in a queue rather than as an absence.
  t.check(/Next free picker takes it/.test(who) && /ahead of it in the queue/.test(who),
    'while an order nobody holds says where it stands in the pickers\' queue');

  // The readings are exact opposites: no two can be true of one order.
  t.check(/else if\(q\.pickingStatus === 'awaiting_accept'\) main = `Offered to \$\{name\}/.test(who)
    && /else main = `\$\{name\} picking/.test(who),
    'the offered and being-picked readings are conditioned on opposites');
}

/* ---------- 2. the act puts it back in the queue ----------------------- */
{
  t.check(/case 'release': releaseOrderToQueue\(id\); break;/.test(extractFunction(admin, 'otAct', 'index.html')),
    'the act on a stranded order releases it');
  const rel = extractFunction(admin, 'releaseOrderToQueue', 'index.html');
  t.check(/q\.assignedWorkerId = null;/.test(rel) && /resetPickingProgress\(q\)/.test(rel),
    'letting go of both the name and the pick — nobody walked it, so nothing is done');
  t.check(/q\.status !== 'preparing'/.test(rel),
    'and only while the order is at the stage a picker is needed for');
  // Which is the whole rescue: unassigned + preparing IS the queue.
  const queue = extractFunction(read('shared-worker.js'), 'workerPickQueue', 'shared-worker.js');
  t.check(/q\.status==='preparing' && !q\.assignedWorkerId/.test(queue),
    'because an unassigned order in Being Prepared is exactly what the pickers\' queue is');
  t.check(!/stageEnteredAt =/.test(rel),
    'and how long it has been waiting is not reset by handing it back — it has been waiting all along');
}

/* ---------- 3. and the phone is what picks it up ---------------------- */
{
  /* The board no longer writes an assignment at all -- the modal that did
     is gone from this flow, and with it the pop-up on every order. What
     puts an order on a phone is the worker taking it, or being handed it
     when they finish the last one. Both write the same fields the modal
     used to, which is why nothing downstream had to change. */
  t.check(!/openAssignStaffModal/.test(admin),
    'the assign-staff pop-up is gone from the order flow rather than left sitting there unused');

  const take = extractFunction(shared, 'takeNextOrder', 'shared-worker.js');
  ["pickingStatus = 'in_progress'", 'pickCursor = 0', 'pickingAssignedAt', 'workerAcceptedAt'].forEach((bit) => {
    t.check(take.includes(bit), `taking the next order sets ${bit}`);
  });
  t.check(/workerAcceptedAt = now;/.test(take),
    'accepted in the same write, because the person tapping is the person taking it');

  const auto = extractFunction(shared, 'autoAssignNextOrder', 'shared-worker.js');
  ["pickingStatus = 'awaiting_accept'", 'pickCursor = 0', 'pickingAssignedAt'].forEach((bit) => {
    t.check(auto.includes(bit), `being handed the next one sets ${bit}`);
  });

  // awaiting_accept is what makes it appear on the worker's device -- their
  // app lists that and in_progress, nothing else.
  const mine = extractFunction(shared, 'renderWorkerView', 'shared-worker.js');
  t.check(/pickingStatus==='awaiting_accept'/.test(mine),
    'and awaiting_accept is exactly what the worker app puts in the pending list');
  t.check(/renderWorkerQueue\(queue, !!active\)/.test(mine),
    'while the queue itself is a panel on that same screen — which is how an unassigned order is seen at all');
}

/* ---------- 4. declining is what creates this state ------------------- */
{
  const deny = extractFunction(shared, 'denyOrderAssignment', 'shared-worker.js');
  t.check(/q\.assignedWorkerId = null;/.test(deny) && /q\.pickingStatus = null;/.test(deny),
    'declining clears both the worker and the picking status');
  t.check(!/q\.status/.test(deny),
    'and leaves the order in Being Prepared, which is why the board needs to show it');
}

/* ---------- 4b. deleting the worker holding an order ------------------ */
/*
 * The other way an order ends up with nobody picking it, and the worse one.
 * Declining leaves assignedWorkerId null, which the board can see. Deleting
 * the staff member left it pointing at somebody who no longer exists, and
 * that is invisible from every direction: myWorkerOrders matches on staff
 * id so no worker's app shows it, autoAssignNextOrder skips it as already
 * assigned, and the Assign button did not appear because the order still
 * "had" a worker. The card read "being prepared by (removed staff)" and
 * nothing on any screen could move it.
 */
{
  const del = extractFunction(admin, 'deleteStaff', 'index.html');
  t.check(/const live = \(data\.savedQuotes\|\|\[\]\)\.filter\(q=>!q\.voided\);/.test(del),
    'a cancelled order is nobody\'s work, so it is excluded once for both halves');
  t.check(/const picking = live\.filter\(q=>q\.assignedWorkerId===id && q\.status==='preparing' && q\.pickingStatus!=='done'\);/.test(del),
    'deleting a staff member finds the orders they are actively preparing');
  /* Not the ones they packed. Those goods are on the floor waiting for
     transport and the pick is over -- releasing them would throw away a
     finished pick and send somebody to walk the shelves again for an
     order already in boxes. It keeps their name, the way a delivered
     order keeps its picker: the record of who did it. */
  t.check(/pickingStatus!=='done'/.test(del),
    'and leaves a packed one alone — the pick is done and the goods are waiting for transport, not for a picker');
  t.check(/q\.assignedWorkerId = null;/.test(del) && /resetPickingProgress\(q\)/.test(del),
    'and lets go of both the assignment and the pick');
  t.check(/Orders they have already finished keep their name|already finished will keep showing their name/.test(del),
    'while a finished order keeps its assignment, which is the record of who prepared it');
  // Scoped to 'preparing': a completed order is history, not work in hand.
  t.check(!/q\.status!=='completed'/.test(del),
    'scoped by the stage it is in rather than by excluding one');

  // The count is named before the click, not discovered after it.
  t.check(/const releasing = /.test(del) && /releasing\.length/.test(del),
    'and the confirmation says how many orders it is about to release');
}

/* ---------- 4c. and rows already stranded by the old behaviour -------- */
{
  // Shops carry orders assigned to staff deleted before the fix above, so
  // the board has to offer a way out of a state it can no longer create.
  const needs = extractFunction(admin, 'orderNeedsWorker', 'index.html');
  /* "Nobody assigned" is no longer the question. That order is in the
     pickers' queue, which is a place, not a hole -- the alarm the board
     used to raise for it was the alarm that made an unassigned order look
     broken, and it fired on every single new order. */
  t.check(/if\(!q\.assignedWorkerId\) return false;/.test(needs),
    'an order with nobody assigned is in the queue, and needs nothing from the board');
  t.check(/if\(q\.pickingStatus==='done'\) return false;/.test(needs),
    'nor does a packed one — what it needs is Loaded, not a picker');
  t.check(/if\(!\(data\.staff\|\|\[\]\)\.some\(s=>s\.id===q\.assignedWorkerId\)\) return true;/.test(needs),
    'while one HELD by somebody no longer on staff still does — nobody can see it and it is in no queue');
  // Assigned to somebody real is not enough: the picking state has to be one
  // their app actually lists, or the order is on nobody's screen. 'done'
  // sitting in Being Prepared is exactly that, and finishPreparingOrder
  // persists it for as long as its delivery picker is open.
  t.check(/return !\['awaiting_accept','in_progress'\]\.includes\(q\.pickingStatus\);/.test(needs),
    'and so does one whose picking state no worker app renders');
  t.check(/if\(!q \|\| q\.status!=='preparing'\) return false;/.test(needs),
    'only while it is at Being Prepared, since that is the stage a picker is needed for');

  const who = extractFunction(admin, 'orderWho', 'index.html');
  t.check(/if\(orderNeedsWorker\(q\)\) main = /.test(who),
    'the row asks that question rather than only whether the field is empty');
  t.check(/else main = `\$\{name\} picking · \$\{answered\} of \$\{items\.length\}`/.test(who),
    'and the "picking" reading is its exact opposite, so never both');
  t.check(/Assigned to someone no longer on staff/.test(who),
    'and says which of the two it is');
}

/* ---------- 4d. and the same one stage on ----------------------------- */
/*
 * A driver can leave too. Less dire than a missing picker -- the order is
 * still visible and can be stepped to Completed -- but the only way to name
 * a new one was stepping it back to Being Prepared, which retires the
 * delivery assignment AND throws away the finished pick, so the whole order
 * is picked again to correct somebody's name.
 */
{
  const needs = extractFunction(admin, 'orderNeedsDelivery', 'index.html');
  t.check(/if\(!q \|\| q\.status!=='pending_delivery'\) return false;/.test(needs),
    'only asked of an order out for delivery');
  t.check(/if\(!q\.assignedDeliveryId\) return true;/.test(needs), 'nobody named needs one');
  /* Was pinned on the '__agent__' literal. There are two of these now --
     an agent collecting their own, and a client sending their own person
     -- so the question is asked of the SET rather than of one member of
     it, and adding a third carrier does not need this line edited. */
  t.check(/if\(deliveryIsSelfCarried\(q\)\) return false;/.test(needs),
    'somebody outside the shop carrying it is not a driver who can go missing');
  const carriers = extractDeclaration(admin, 'DELIVERY_SELF_CARRIERS', 'index.html');
  t.check(/__agent__:/.test(carriers) && /__client__:/.test(carriers),
    'and both the agent and the client are in that set');
  t.check(/return !\(data\.staff\|\|\[\]\)\.some\(s=>s\.id===q\.assignedDeliveryId\);/.test(needs),
    'and a driver no longer on staff needs replacing');

  const who = extractFunction(admin, 'orderWho', 'index.html');
  t.check(/if\(orderNeedsDelivery\(q\)\) return \{ act:'loaded', label:'Who has it' \};/.test(extractFunction(admin, 'orderActSpec', 'index.html')),
    'the row offers a way to name one');
  t.check(/if\(orderNeedsDelivery\(q\)\) return \{ main: otStaffGone\(q\.assignedDeliveryId\) \? 'Driver no longer on staff' : 'Nobody named as carrying it'/.test(who)
    && /Going out with \$\{deliveryAssigneeLabel\(q\)\}/.test(who),
    'and the "going out with" reading is its exact opposite');
  /* WIRED TO THE FORM, and to the form wherever the form is. On the
     phone that is the order's row; on the console there are no rows, so
     it is the order's own dialog, which draws the very same block. It
     used to mean the row and only the row, which on a desktop meant
     marking a row open inside a table that is display:none there -- the
     button did nothing, and an order out with nobody named could not be
     given a driver from the desk at all. Still never a pop-up asking the
     question a second way. */
  t.check(/case 'loaded': if\(otConsoleShowing\(\)\) openOrderPreview\(id\); else \{ otOpenRow\(id\); otFocusLoad\(id\); \} break;/.test(admin),
    'wired to the form — the row on the phone, the order’s own dialog on the console — rather than to a pop-up over it');
  t.check(/const loadHtml = orderLoadFormHTML\(q\);/.test(extractFunction(admin, 'otPreviewSpec', 'index.html')),
    'and that dialog draws the same form, rather than a second way of asking');
  // A third carrier that is not a person of ours: hired transport, named
  // on the note. Without it, every hired lorry had to be recorded as
  // somebody on the payroll or as nobody at all.
  t.check(/__carrier__: 'Hired transport'/.test(carriers),
    'and hired transport is one of the ways an order can be settled');

  // Both halves released, but not the same way.
  const del = extractFunction(admin, 'deleteStaff', 'index.html');
  t.check(/const delivering = live\.filter\(q=>q\.assignedDeliveryId===id && q\.status==='pending_delivery'\);/.test(del),
    'deleting a staff member also finds what they are out delivering');
  t.check(/delivering\.forEach\(q=>\{ q\.assignedDeliveryId = null; \}\);/.test(del),
    'and releases only the assignment');
  t.check(!/delivering\.forEach[\s\S]{0,80}resetPickingProgress/.test(del),
    'leaving the finished pick alone -- a driver leaving is no reason to pick the order again');
  t.check(/const releasing = picking\.concat\(delivering\);/.test(del),
    'and both are counted in what the confirmation promises');
}

/* ---------- 5. the affordance is reachable with a finger -------------- */
{
  // The act is one of the layer's small buttons: 28px on the console and
  // a full thumb on the phone, where the layer's own rules for the
  // table's act cell and the queue's acts set the 44px floor.
  const phone = admin.slice(admin.indexOf('THE PHONE.'), admin.lastIndexOf('</style>'));
  t.check(/\.ow-ot \.ow-tbl-a \.btn\.ow-sm\{[^}]*min-height:var\(--ow-tap\)/.test(phone),
    "on the phone the row's act is at least 44px tall");
  t.check(/\.ow-ot-qa \.btn\.ow-sm\{[^}]*min-height:var\(--ow-tap\)/.test(phone),
    "and so is the queue's");
}

process.exit(t.done() ? 1 : 0);
