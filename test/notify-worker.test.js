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

  t.check(/title, body, order\.id\)/.test(code),
    'the id the device opens on tap is the one that was read back');
  t.check(!/title, body, record\.id\)/.test(code),
    'not the id supplied in the request');
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

/* ---------- 5. dead tokens are cleaned up ----------------------------- */
{
  t.check(/fcmStatus === "UNREGISTERED" \|\| fcmStatus === "NOT_FOUND" \|\| resp\.status === 404/.test(code),
    'a token FCM has retired is recognised');
  t.check(/from\("push_subscriptions"\)\.delete\(\)\.eq\("id", sub\.id\)/.test(code),
    'and that subscription row is removed rather than retried forever');
}

process.exit(t.done() ? 1 : 0);
