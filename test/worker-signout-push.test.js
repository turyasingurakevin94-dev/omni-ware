#!/usr/bin/env node
'use strict';
/*
 * Signing out has to take this device's push subscription with it.
 *
 * push_subscriptions rows are keyed on the device's FCM token and carry the
 * staff_id they were registered for. Every other way a subscription ends was
 * already covered:
 *
 *   a different worker signs in here   the upsert replaces the row, since
 *                                      onConflict is the token
 *   a staff member is removed          the (shop_id, staff_id) foreign key
 *                                      cascades
 *   FCM retires the token              notify-worker deletes the row on
 *                                      UNREGISTERED / NOT_FOUND
 *
 * Signing out was the one that left one stranded. The row stayed, pointing
 * the device at the worker who had just left it, so the phone went on
 * buzzing for their orders -- and the notification body is the client's name
 * and item count, on the lock screen of a device nobody is signed in to.
 *
 * The delete has to happen BEFORE the sign-out, because the row's policy is
 * user_id = auth.uid() and there is no auth.uid() afterwards.
 *
 * Run: node test/worker-signout-push.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('worker signout push');
const sharedJs = read('shared-worker.js');

// Real source, with the client and the page stubbed so the order of calls can
// be observed without a browser or a network.
function build(token, deleteError) {
  const seen = [];
  const sb = {
    from: (table) => ({
      delete: () => ({
        eq: (field, value) => {
          seen.push({ step: 'delete', table, field, value });
          return Promise.resolve({ error: deleteError || null });
        },
      }),
    }),
    auth: { signOut: () => { seen.push({ step: 'signOut' }); return Promise.resolve({}); } },
  };
  const scope = (new Function('sb', 'location', 'console', 'myPushToken', `
    ${extractFunction(sharedJs, 'signOutAndReload', 'shared-worker.js')}
    return { signOutAndReload };
  `))(sb, { reload: () => seen.push({ step: 'reload' }) },
    // Serialised, not join()ed -- the second argument is the error object,
    // and join() would flatten it to "[object Object]" and assert nothing.
    { error: (...a) => seen.push({ step: 'logged', text: a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') }) },
    token);
  return { seen, run: scope.signOutAndReload };
}

(async () => {

/* ---------- 1. a subscribed device removes its own row ---------------- */
{
  const { seen, run } = build('TOKEN-abc');
  await run();

  const del = seen.find((s) => s.step === 'delete');
  t.check(!!del, 'signing out deletes a push subscription');
  t.check(!!del && del.table === 'push_subscriptions', 'from push_subscriptions');
  t.check(!!del && del.field === 'fcm_token' && del.value === 'TOKEN-abc',
    "scoped to this device's token, so a second phone keeps its notifications");

  const iDel = seen.findIndex((s) => s.step === 'delete');
  const iOut = seen.findIndex((s) => s.step === 'signOut');
  const iReload = seen.findIndex((s) => s.step === 'reload');
  t.check(iDel > -1 && iDel < iOut,
    'and does it before signing out, while the row policy can still match auth.uid()');
  t.check(iReload > iOut, 'then reloads');
}

/* ---------- 2. a device that never registered deletes nothing --------- */
{
  // The admin app shares this button, and the web build has no push at all.
  const { seen, run } = build(null);
  await run();

  t.check(!seen.some((s) => s.step === 'delete'),
    'with no token there is no row to remove, and nothing is attempted');
  t.check(seen.some((s) => s.step === 'signOut') && seen.some((s) => s.step === 'reload'),
    'and signing out still happens');
}

/* ---------- 3. a failed delete does not trap anyone signed in --------- */
{
  const { seen, run } = build('TOKEN-abc', { message: 'network is down' });
  await run();

  t.check(seen.some((s) => s.step === 'logged' && /network is down/.test(s.text)),
    'a delete that fails is logged');
  t.check(seen.some((s) => s.step === 'signOut'), 'and the sign-out goes ahead regardless');
  t.check(seen.some((s) => s.step === 'reload'), 'as does the reload');
}

/* ---------- 4. the token is captured where it arrives ----------------- */
{
  const reg = sharedJs.slice(sharedJs.indexOf("addListener('registration'"));
  const upsertAt = reg.indexOf("from('push_subscriptions').upsert");
  const assignAt = reg.indexOf('myPushToken = token.value;');
  t.check(assignAt > -1, "the registration listener keeps the device's token");
  t.check(assignAt > -1 && upsertAt > -1 && assignAt < upsertAt,
    'before the upsert, so a failed upsert still leaves sign-out able to clean up');
}

/* ---------- 5. the other three endings are still in place ------------- */
{
  t.check(/onConflict: 'fcm_token'/.test(sharedJs),
    'a different worker signing in on this device replaces the row');
  const mig = read('supabase/migrations/0011_staff_login_and_push.sql');
  t.check(/foreign key \(shop_id, staff_id\) references staff\(shop_id, id\) on delete cascade/.test(mig),
    'removing a staff member cascades to their subscriptions');
  t.check(/user_id = auth\.uid\(\)/.test(mig),
    'and a device can only ever touch its own row, which is why the delete precedes the sign-out');
  const notify = read('supabase/functions/notify-worker/index.ts');
  t.check(/from\("push_subscriptions"\)\.delete\(\)\.eq\("id", sub\.id\)/.test(notify),
    'and a token FCM has retired is cleaned up server-side');
}

process.exit(t.done() ? 1 : 0);
})();
