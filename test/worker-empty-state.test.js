#!/usr/bin/env node
'use strict';
/*
 * A picker with nothing assigned used to get a blank page.
 *
 * renderWorkerPendingList blanked the wrap when there was nothing pending,
 * and with no pick open nothing else drew either -- so below the "Pick &
 * Pack" title the screen was simply empty.
 *
 * That reads as a screen that failed to load, not as a shop with no work
 * waiting, and this app is exactly the one where a worker cannot tell the
 * difference: it loads once at boot and never refreshes itself, so staring
 * at it for another minute proves nothing. It is also the ordinary state at
 * the start of a shift, so it is the first thing a new worker ever sees.
 *
 * The empty state is suppressed while a pick IS open, where the carousel
 * fills the screen and an empty pending list needs no comment.
 *
 * Run: node test/worker-empty-state.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker empty state');
const sharedJs = read('shared-worker.js');

// One fake element; the function only ever sets innerHTML and walks it.
const wrap = {
  innerHTML: '',
  querySelectorAll: () => [],
};

const scope = compileScope([
  extractFunction(sharedJs, 'timeAgoLabel', 'shared-worker.js'),
  extractFunction(sharedJs, 'renderWorkerPendingList', 'shared-worker.js'),
], {
  document: { getElementById: () => wrap },
  esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  acceptOrderAssignment: () => {},
  denyOrderAssignment: () => {},
}, ['renderWorkerPendingList']);

const render = (pending, hasActive) => {
  wrap.innerHTML = '__untouched__';
  scope.renderWorkerPendingList(pending, hasActive);
  return wrap.innerHTML;
};

const pendingOrder = (id, name) => ({
  id, client: { name }, items: [{ productId: 'P001', qty: 1 }],
  pickingAssignedAt: Date.now() - 120000,
});

/* ---------- 1. nothing assigned says so ------------------------------- */
{
  const html = render([], false);
  t.check(html !== '', 'a worker with nothing to pick is not left on a blank page');
  t.check(/class="empty"/.test(html), 'it uses the same empty-state styling as the rest of the app');
  t.check(/Nothing to pick right now/.test(html), 'and says plainly that there is no work waiting');
}

/* ---------- 2. ...but not while a pick is open ------------------------ */
{
  const html = render([], true);
  t.check(html === '', 'with a pick open the carousel is the content; no empty state on top of it');
}

/* ---------- 3. a real pending order still wins either way ------------- */
{
  const withActive = render([pendingOrder(1, 'Moses')], true);
  const without = render([pendingOrder(1, 'Moses')], false);
  [['with a pick open', withActive], ['with nothing open', without]].forEach(([label, html]) => {
    t.check(/wv-pending-card/.test(html), `a pending order renders its card ${label}`);
    t.check(/Moses/.test(html), `and names the client ${label}`);
    t.check(!/Nothing to pick right now/.test(html), `and no empty state ${label}`);
  });
}

/* ---------- 4. several pending orders all render ---------------------- */
{
  const html = render([pendingOrder(1, 'Moses'), pendingOrder(2, 'Sarah')], false);
  t.check((html.match(/wv-pending-card/g) || []).length === 2, 'two pending orders give two cards');
  t.check(/Moses/.test(html) && /Sarah/.test(html), 'both are named');
}

/* ---------- 5. the caller passes the flag ----------------------------- */
{
  // The empty state is only correct because renderWorkerView tells this
  // function whether a pick is open. Called without it the argument is
  // undefined, which is falsy -- so the failure mode is a visible message
  // where none was wanted, never a blank screen.
  const src = read('shared-worker.js');
  t.check(/renderWorkerPendingList\(pending, !!active\);/.test(src),
    'renderWorkerView passes whether a pick is open');
  t.check(render([], undefined) !== '', 'and a missing flag errs toward showing the message');
}

process.exit(t.done() ? 1 : 0);
