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
 * And there was no way to put it back on somebody. The forward arrow from
 * Being Prepared asks for a DELIVERY person, so the obvious move sent an
 * unpicked order out for delivery. The only real route was stepping back to
 * Draft and forward again -- two non-obvious clicks that also throw the pick
 * away.
 *
 * Same modal the first assignment goes through, given the status the order is
 * already in, so setSavedQuoteStatus leaves stageEnteredAt alone and
 * re-assigning does not reset how long the order has been waiting.
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
  t.check(/if\(orderNeedsWorker\(q\)\) main = /.test(who),
    'an order in Preparing with nobody who can pick it says so in its own cell');
  t.check(/'Assigned to someone no longer on staff'/.test(who) && /'Nobody picking yet'/.test(who),
    'and says which of the two it is');
  t.check(/if\(orderNeedsWorker\(q\)\) return \{ act:'assign', label:'Assign a picker' \};/.test(act),
    'with an act to put it on somebody');

  // The two readings are exact opposites: the same predicate decides
  // whether the cell names a picker or the absence of one.
  t.check(/else if\(q\.pickingStatus === 'awaiting_accept'\) main = `Offered to \$\{name\}/.test(who)
    && /else main = `\$\{name\} picking/.test(who),
    'the assigned and unassigned readings are conditioned on opposites');
}

/* ---------- 2. the button opens the assignment the first one uses ----- */
{
  t.check(/case 'assign': openAssignStaffModal\(id, 'preparing', 'worker'\); break;/.test(extractFunction(admin, 'otAct', 'index.html')),
    "it opens the worker picker for the stage it is already in");

  // Which matters: openAssignStaffModal ends by calling setSavedQuoteStatus,
  // and re-entering the same stage must not restamp it.
  const setStatus = extractFunction(admin, 'setSavedQuoteStatus', 'index.html');
  t.check(/if\(q\.status===status\)/.test(setStatus) || /q\.status!==status/.test(setStatus),
    'and setSavedQuoteStatus only restamps stageEnteredAt on a real move');
}

/* ---------- 3. what the modal writes is what the worker app reads ----- */
{
  // The picker's row handler is the single place a worker assignment is made
  // from the board; a declined order now goes back through it unchanged.
  const modal = admin.slice(admin.indexOf('function openAssignStaffModal'), admin.indexOf('function closeAssignStaffModal'));

  // The worker id is written through the role->field map rather than by
  // name, which is the point: 'worker' resolves to assignedWorkerId, so the
  // re-assignment goes through exactly the same path as the first one.
  t.check(/order\[STAGE_ASSIGNMENT_FIELD\[role\]\] = row\.dataset\.id;/.test(modal),
    'assigning writes the id through the role-to-field map');
  t.check(/STAGE_ASSIGNMENT_FIELD = \{ worker: 'assignedWorkerId'/.test(admin),
    "and 'worker' maps to assignedWorkerId");

  ["pickingStatus = 'awaiting_accept'", 'pickCursor = 0', 'pickingAssignedAt'].forEach((bit) => {
    t.check(modal.includes(bit), `assigning sets ${bit}`);
  });

  // awaiting_accept is what makes it appear on the worker's device -- their
  // app lists that and in_progress, nothing else.
  const mine = extractFunction(shared, 'renderWorkerView', 'shared-worker.js');
  t.check(/pickingStatus==='awaiting_accept'/.test(mine),
    'and awaiting_accept is exactly what the worker app puts in the pending list');
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
  t.check(/const picking = live\.filter\(q=>q\.assignedWorkerId===id && q\.status==='preparing'\);/.test(del),
    'deleting a staff member finds the orders they are actively preparing');
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
  t.check(/if\(!q\.assignedWorkerId\) return true;/.test(needs),
    'an order with nobody assigned needs a worker');
  t.check(/if\(!\(data\.staff\|\|\[\]\)\.some\(s=>s\.id===q\.assignedWorkerId\)\) return true;/.test(needs),
    'and so does one assigned to somebody who is no longer on staff');
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
  t.check(/if\(orderNeedsDelivery\(q\)\) return \{ act:'assigndelivery', label:'Assign delivery' \};/.test(extractFunction(admin, 'orderActSpec', 'index.html')),
    'the row offers a way to name one');
  t.check(/if\(orderNeedsDelivery\(q\)\) return \{ main: otStaffGone\(q\.assignedDeliveryId\) \? 'Driver no longer on staff' : 'Nobody delivering'/.test(who)
    && /Going out with \$\{deliveryAssigneeLabel\(q\)\}/.test(who),
    'and the "going out with" reading is its exact opposite');
  t.check(/case 'assigndelivery': openAssignStaffModal\(id, 'pending_delivery', 'delivery'\); break;/.test(admin),
    'wired to the delivery picker for the stage it is already in');

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
