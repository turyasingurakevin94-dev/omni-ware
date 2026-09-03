#!/usr/bin/env node
'use strict';
/*
 * notify-worker -- the push notification a worker gets when an order is
 * assigned to them. Driven by a Supabase Database Webhook on saved_quotes,
 * which cannot present a Supabase JWT, so the function is deployed
 * verify_jwt=false.
 *
 * It had no authentication of any kind, and it built the notification
 * straight out of the request body: `record.client_name` became the text on
 * the phone and `record.id` became the order the app opened on tap. So a
 * POST from anyone who knew a shop id and a staff id put arbitrary text on
 * a worker's device. Confirmed against the deployed function with a crafted
 * payload: it ran the whole flow and stopped only at the subscription
 * lookup, because the shop id was fake.
 *
 * Two fixes, and the order matters. The re-read is the one that holds
 * regardless of configuration: the body now only says WHICH row changed,
 * and every word of the notification comes from that row. The shared secret
 * closes the door, but it is dormant until NOTIFY_WORKER_SECRET is set, so
 * it cannot be the only thing standing there.
 *
 * Run: node test/notify-worker.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('notify worker');
const src = read('supabase/functions/notify-worker/index.ts');
const code = src.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n');

/* ---------- 1. the notification is built from the row, not the body --- */
{
  t.check(/\.from\("saved_quotes"\)[\s\S]{0,200}?\.eq\("shop_id", record\.shop_id\)[\s\S]{0,80}?\.eq\("id", record\.id\)/.test(code),
    'the order is read back from the database, scoped to the shop in the event');

  t.check(/const clientName = order\.client_name \|\| "a client";/.test(code),
    'the notification text comes from the stored row');
  t.check(!/record\.client_name/.test(code),
    'the client name in the request body is never used');

  t.check(/Array\.isArray\(order\.payload\?\.items\)/.test(code),
    'the item count comes from the stored row too');
  t.check(!/Array\.isArray\(record\.payload\?\.items\)/.test(code),
    'and not from the body');

  /* Both pushes go out through one send loop (pushToDevices), which takes
     the id as an argument -- so this is checked at each call site: what is
     handed over is always the id of the row that was read back. */
  t.check(/return await pushToDevices\(fsa, subs, title, body, order\.id\);/.test(code)
    && /return await pushToDevices\(firebaseServiceAccount, subs, title, body, order\.id\);/.test(code),
    'the id the device opens on tap is the one that was read back, on both pushes');
  const sender = code.slice(code.indexOf('async function pushToDevices'));
  t.check(/sendFcmNotification\(fsa\.project_id, fcmAccessToken, sub\.fcm_token as string, title, body, orderId\)/.test(sender)
    && !/record\./.test(sender),
    'and the loop that sends knows nothing of the request body at all');
}

/* ---------- 2. a forged or stale assignment is refused ---------------- */
/*
 * Without this, a crafted event naming a real shop and staff id would
 * notify that worker about an assignment that never happened.
 */
{
  t.check(/const assignedNow = order\.payload\?\.assignedWorkerId \?\? null;/.test(code),
    'the stored assignment is read');
  t.check(/String\(assignedNow\) !== String\(newWorkerId\)/.test(code),
    'and compared against the one the event claims');
  t.check(/skipped: "assignment does not match the stored order"/.test(code),
    'a mismatch is skipped rather than sent');

  // Ordering. The re-read has to come before the subscription lookup, or a
  // forged event still gets to probe which shop/staff pairs have a device
  // registered before being turned away.
  const iRead = code.indexOf('order_reread');
  const iAssign = code.indexOf('assignedNow');
  const iSubs = code.indexOf('push_subscriptions');
  const iSend = code.indexOf('sendFcmNotification(fsa.project_id');
  t.check(iRead > 0 && iRead < iAssign && iAssign < iSubs && iSubs < iSend,
    'read, verify the assignment, then look up subscriptions, then send');

  // And the lookup itself must key off the verified row, not the body.
  t.check(/\.eq\("shop_id", order\.shop_id\)\s*\.eq\("staff_id", assignedNow\)/.test(code),
    'the subscription lookup uses the shop and staff id from the stored order');
  t.check(!/\.eq\("shop_id", record\.shop_id\)\s*\.eq\("staff_id", newWorkerId\)/.test(code),
    'not the pair supplied in the request');

  // The comparison is string-based on both sides, so a numeric staff id in
  // the row and a string in the event still match rather than silently
  // skipping every notification.
  const same = (a, b) => a != null && String(a) === String(b);
  t.check(same(7, '7') === true, 'a numeric id and its string form are the same assignment');
  t.check(same(7, 8) === false, 'a different id is not');
  t.check(same(null, null) === false, 'an unassigned order never matches');
  // staff.id is text (0009_staff_table.sql), so both sides being run
  // through String() is what makes this comparison reliable rather than
  // incidental. The event filter above uses a falsy test, which only drops
  // an empty id -- never a valid one.
  t.check(same(0, '0') === true, 'the assignment comparison does not treat id 0 as unassigned');
  t.check(same('w3', 'w3') === true, 'and a text staff id compares as itself');
}

/* ---------- 3. the shared secret ------------------------------------- */
{
  t.check(/const NOTIFY_WORKER_SECRET = Deno\.env\.get\("NOTIFY_WORKER_SECRET"\);/.test(code),
    'a webhook secret can be configured');
  t.check(/if \(\(req\.headers\.get\("x-webhook-secret"\) \|\| ""\) !== NOTIFY_WORKER_SECRET\)/.test(code),
    'and a request without the matching header is refused');
  t.check(/return json\(\{ error: "Bad or missing webhook secret" \}, 401\)/.test(code),
    'with a 401');

  // Dormant when unset, so configuring it is a deliberate step rather than
  // something that silently breaks every notification on deploy.
  t.check(/if \(NOTIFY_WORKER_SECRET\) \{/.test(code),
    'the check is skipped while no secret is configured');
  t.check(/NOTIFY_WORKER_SECRET is not set -- this endpoint accepts requests from anyone/.test(src),
    'and that state is logged loudly rather than passing silently');

  // It must run before any work, not after.
  const iSecret = code.indexOf('x-webhook-secret');
  const iBody = code.indexOf('await req.json()');
  t.check(iSecret > 0 && iSecret < iBody,
    'the secret is checked before the body is even parsed');
}

/* ---------- 4. the event filter still holds --------------------------- */
/*
 * old_record comes from a plpgsql trigger, where OLD is fully populated --
 * REPLICA IDENTITY governs logical replication, not trigger records -- so
 * this comparison does real work and an ordinary edit to an already
 * assigned order does not re-notify.
 */
/*
 * Keying on the id alone was not enough. What means "this worker has to do
 * something" is the order being put in front of them -- pickingStatus going
 * to 'awaiting_accept' -- and one of the three writers that does it re-offers
 * the order to the SAME worker: the backward step that sends an order back
 * to be picked again. The id is unchanged there, so no push was sent and the
 * order reappeared on their device in silence.
 *
 * A changed id still counts on its own, so a handover that somehow did not
 * set pickingStatus would not go quiet either.
 */
{
  t.check(/if \(!payload \|\| payload\.table !== "saved_quotes" \|\| payload\.type !== "UPDATE"\)/.test(code),
    'only saved_quotes updates are considered');
  t.check(/const offeredAgain = newPicking === "awaiting_accept" && oldPicking !== "awaiting_accept";/.test(code),
    'an order newly put in front of a worker counts, however it got there');
  t.check(/const handedOver = newWorkerId !== oldWorkerId;/.test(code),
    'and so does a changed assignment on its own');
  t.check(/if \(!newWorkerId \|\| !\(handedOver \|\| offeredAgain\)\)/.test(code),
    'either one announces; neither is skipped');
  t.check(/if \(pickingNow !== "awaiting_accept"\)/.test(code),
    'and the stored row must still be awaiting acceptance before anything is sent');

  // The decision itself, over every path an order takes to a worker. Mirrors
  // the source above; the regexes are what tie the two together.
  const announces = (oldW, oldP, newW, newP, storedP) => {
    const handedOver = newW !== oldW;
    const offeredAgain = newP === 'awaiting_accept' && oldP !== 'awaiting_accept';
    if (!newW || !(handedOver || offeredAgain)) return false;
    return (storedP === undefined ? newP : storedP) === 'awaiting_accept';
  };
  const AA = 'awaiting_accept';

  t.check(announces(null, null, 'ST1', AA) === true, 'the admin assigning an unassigned order notifies');
  t.check(announces('ST1', 'done', 'ST1', AA) === true,
    'and so does sending it back to the same worker to be picked again');
  t.check(announces('ST1', AA, 'ST2', AA) === true, 'handing it to a different worker notifies them');

  t.check(announces('ST1', AA, 'ST1', 'in_progress') === false, 'accepting it notifies nobody');
  t.check(announces('ST1', 'in_progress', 'ST1', 'in_progress') === false, 'nor does ticking an item');
  t.check(announces('ST1', 'in_progress', 'ST1', 'done') === false, 'nor finishing the pick');
  t.check(announces('ST1', AA, null, null) === false, 'nor declining it');

  // Anchored to the row, so a forged or stale event cannot summon one.
  t.check(announces(null, null, 'ST1', AA, 'in_progress') === false,
    'an event for an order the worker has already accepted is dropped');
  t.check(announces(null, null, 'ST1', AA, 'done') === false, 'and one already finished');
}

/* ---------- 4b. and the second push: "Next to pick" ------------------- */
/*
 * A stage change alone used to tell nobody. An order entering Preparing
 * with no worker on it is in the pickers' queue -- on every worker's phone,
 * oldest first, taken by the next one free -- but an app that is closed
 * hears nothing, and an app that is open only finds out on its next poll.
 * That was the hole the assign-a-picker pop-up used to paper over: with
 * the pop-up gone, the queue has to reach the phones itself.
 *
 * It sits BEFORE the assignment filter, which turns away anything with no
 * assignee -- an order with no assignee being exactly what this announces.
 */
{
  t.check(/const enteredPreparing = record\.status === "preparing" && oldRecord\.status !== "preparing";/.test(code),
    'an order entering Being Prepared is recognised, by the transition rather than the state');
  t.check(/if \(enteredPreparing && !newWorkerId\) \{\s*return await notifyPickQueue\(record\);/.test(code),
    'and one arriving with nobody on it announces the queue');

  // Ordering. The assignment filter returns early on a missing assignee,
  // so this branch has to come first or it could never fire.
  const iQueue = code.indexOf('enteredPreparing && !newWorkerId');
  const iFilter = code.indexOf('if (!newWorkerId || !(handedOver || offeredAgain))');
  t.check(iQueue > 0 && iQueue < iFilter,
    'checked before the filter that turns away an order with no assignee');

  // Its own re-read and its own guard, for the same reason the assignment
  // path has them: the body says which row changed and nothing else.
  const fn = code.slice(code.indexOf('async function notifyPickQueue'));
  t.check(/\.from\("saved_quotes"\)[\s\S]{0,240}?\.eq\("shop_id", record\.shop_id\)[\s\S]{0,80}?\.eq\("id", record\.id\)/.test(fn),
    'the order is read back from the database before anything is sent');
  t.check(/order\.status === "preparing"/.test(fn)
    && /\(order\.payload\?\.assignedWorkerId \?\? null\) == null/.test(fn)
    && /\(order\.payload\?\.pickingStatus \?\? null\) !== "done"/.test(fn),
    'and the stored row must still be unassigned, in Preparing, and not already packed');
  t.check(/skipped: "order is no longer in the pickers' queue"/.test(fn),
    'or the push is skipped — an order somebody already took is not news');

  const iRead = fn.indexOf('queue_reread');
  const iGuard = fn.indexOf('stillQueued');
  const iSubs = fn.indexOf('push_subscriptions');
  t.check(iRead > 0 && iRead < iGuard && iGuard < iSubs,
    'read, check it is still in the queue, then look up subscriptions');

  // Every worker in the shop, and only workers: a delivery-only staff
  // member does not pick, so a push telling them to would be noise on the
  // one channel this app has.
  t.check(/\.from\("staff"\)[\s\S]{0,160}?\.eq\("shop_id", order\.shop_id\)[\s\S]{0,60}?\.eq\("role", "worker"\)/.test(fn),
    "the shop's workers are looked up from the verified row's own shop");
  t.check(/\.in\("staff_id", workerIds\)/.test(fn),
    'and every one of their devices is told, because any of them may be the next one free');
  t.check(/const title = "Next to pick";/.test(fn) && /the next free picker takes it/.test(fn),
    'the notification says what it is and what happens next');
  t.check(/skipped: "no workers on staff"/.test(fn) && /skipped: "no worker has a push subscription"/.test(fn),
    'and a shop with nobody to tell is skipped rather than treated as an error');

  // The decision itself, over the transitions an order actually makes.
  const announces = (oldStatus, newStatus, worker) =>
    newStatus === 'preparing' && oldStatus !== 'preparing' && !worker;
  t.check(announces('draft', 'preparing', null) === true,
    'the last supplier confirming moves an order in, and the queue is announced');
  t.check(announces('awaiting_goods', 'preparing', null) === true,
    'as does the last of its goods arriving');
  t.check(announces('preparing', 'preparing', null) === false,
    'an edit to an order already waiting does not ring every phone again');
  t.check(announces('draft', 'preparing', 'ST1') === false,
    'and an order arriving already on somebody goes down the assignment path instead');
  t.check(announces('pending_delivery', 'preparing', null) === true,
    'an order sent back to be picked again is in the queue like any other');
}

/* ---------- 5. dead tokens are cleaned up ----------------------------- */
{
  t.check(/fcmStatus === "UNREGISTERED" \|\| fcmStatus === "NOT_FOUND" \|\| resp\.status === 404/.test(code),
    'a token FCM has retired is recognised');
  t.check(/from\("push_subscriptions"\)\.delete\(\)\.eq\("id", sub\.id\)/.test(code),
    'and that subscription row is removed rather than retried forever');
}

process.exit(t.done() ? 1 : 0);
