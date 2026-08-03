#!/usr/bin/env node
'use strict';
/*
 * The pick screen has to come up.
 *
 * boot() does three things: authenticate and load the orders, set up
 * notifications, then draw the screen and start polling. The first is
 * wrapped in a try/catch that shows a readable error. The third is what the
 * app is for.
 *
 * The second sat between them, outside any handler, and a throw there took
 * the whole app with it. The loading class was never removed, nothing
 * rendered, polling never started -- and no error appeared either, because
 * the catch above had already been passed. A worker stared at a loading
 * screen with their orders sitting in memory behind it, because a lookup
 * about notifications failed on a bad connection.
 *
 * Notifications are optional. The screen is not.
 *
 * Run: node test/worker-boot-resilience.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('worker boot resilience');
const workerHtml = read('worker.html');

// The real boot(), with everything it touches stubbed so the order of what
// happens -- and what survives a failure -- can be observed.
function build(pushBehaviour, loadBehaviour) {
  const seen = [];
  const sb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: () => {
                seen.push('push lookup');
                if (pushBehaviour === 'throws') throw new Error('network unreachable');
                if (pushBehaviour === 'rejects') return Promise.reject(new Error('network unreachable'));
                return Promise.resolve({ data: pushBehaviour === 'subscribed' ? { id: 7 } : null });
              },
            }),
          }),
        }),
      }),
    }),
  };
  const scope = (new Function(
    'sb', 'document', 'console', 'ensureAuthAndShop', 'loadWorkerData', 'keyRowsById',
    'buildWorkerSyncRows', 'ensureAuthOverlay', 'isNativeApp', 'registerNativePushListeners',
    'enableNativePush', 'renderWorkerView', 'startWorkerPolling', 'currentShopId', 'currentUser',
    `
    let data = null, lastSynced = null, myStaff = null, hasPushSubscription = false;
    ${extractFunction(workerHtml, 'boot', 'worker.html')}
    return { boot, subscribed: () => hasPushSubscription };
  `))(
    sb,
    { body: { classList: { remove: (c) => seen.push(`unhide:${c}`), add: () => {} } } },
    { error: (...a) => seen.push(`logged:${a[0]}`) },
    async () => { seen.push('auth'); },
    async () => {
      seen.push('load');
      if (loadBehaviour === 'throws') throw new Error('could not reach the shop');
      return { staff: [{ id: 'ST1', userId: 'U1' }], savedQuotes: [] };
    },
    () => ({}), () => ({ savedQuotes: [] }),
    () => ({ innerHTML: '' }),
    () => false,
    () => seen.push('listeners'), () => seen.push('enablePush'),
    () => seen.push('render'), () => seen.push('poll'),
    'shop-1', { id: 'U1' },
  );
  return { seen, boot: scope.boot, subscribed: scope.subscribed };
}

const drive = async (push, load) => {
  const b = build(push, load);
  let escaped = null;
  try { await b.boot(); } catch (e) { escaped = e.message; }
  return {
    rendered: b.seen.includes('render'),
    polling: b.seen.includes('poll'),
    unhidden: b.seen.some((s) => s.startsWith('unhide:')),
    logged: b.seen.filter((s) => s.startsWith('logged:')),
    escaped,
    subscribed: b.subscribed(),
    seen: b.seen,
  };
};

(async () => {

/* ---------- 1. notifications failing costs notifications only --------- */
{
  for (const how of ['throws', 'rejects']) {
    const r = await drive(how);
    t.check(r.rendered && r.polling && r.unhidden,
      `a push lookup that ${how} still leaves the pick screen up, drawn and polling`);
    t.check(r.escaped === null, `and the error does not escape boot (${how})`);
    t.check(r.logged.length === 1 && /notifications/i.test(r.logged[0]),
      `and is logged as what it was (${how})`);
    t.check(r.subscribed === false,
      `with notifications simply off, which is the honest outcome (${how})`);
  }
}

/* ---------- 2. the ordinary boot is unchanged ------------------------- */
{
  const r = await drive('ok');
  t.check(r.rendered && r.polling && r.unhidden, 'a clean boot draws the screen and starts polling');
  t.check(r.logged.length === 0, 'with nothing logged');
  t.check(r.seen.indexOf('unhide:app-loading') < r.seen.indexOf('render'),
    'and unhides before rendering -- the carousel cannot centre a card with no layout box');

  const sub = await drive('subscribed');
  t.check(sub.subscribed === true, 'an existing subscription is recognised');
}

/* ---------- 3. failing to load the orders still says so --------------- */
{
  // The case the original try/catch was written for, which must keep working:
  // there is nothing to show, so an error screen is the right outcome.
  const r = await drive('ok', 'throws');
  t.check(!r.rendered && !r.polling,
    'if the orders themselves cannot be loaded there is nothing to draw');
  t.check(r.logged.length === 1, 'and the failure is reported rather than swallowed');
  t.check(r.escaped === null, 'without the error escaping boot');
}

/* ---------- 4. the shape, so it is not undone by a later edit --------- */
{
  const fn = extractFunction(workerHtml, 'boot', 'worker.html');
  const iPush = fn.indexOf("from('push_subscriptions')");
  const iCatch = fn.indexOf("catch(err){");
  const iUnhide = fn.indexOf("classList.remove('app-loading')");
  const iRender = fn.indexOf('renderWorkerView()');
  const iPoll = fn.indexOf('startWorkerPolling()');

  t.check(/if\(myStaff\) try\{/.test(fn), 'the notifications block is guarded');
  t.check(iPush > -1 && iCatch > iPush, 'and its catch closes after the lookup');
  t.check(iCatch < iUnhide && iUnhide < iRender && iRender < iPoll,
    'so unhiding, rendering and polling all sit after it and cannot be skipped');
}

process.exit(t.done() ? 1 : 0);
})();
