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

// One fake element; the function sets innerHTML, walks it, and toggles the
// class the stylesheet uses to move the wrap below the pick card.
const classes = new Set();
const wrap = {
  innerHTML: '',
  querySelectorAll: () => [],
  classList: {
    toggle: (cls, on) => { if (on) classes.add(cls); else classes.delete(cls); },
    contains: (cls) => classes.has(cls),
  },
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

const pendingOrder = (id, name, lines) => ({
  id,
  client: { name },
  items: Array.from({ length: lines || 1 }, () => ({ productId: 'P001', qty: 1 })),
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

/* ---------- 3. with nothing open, a pending order gets its full card -- */
{
  const html = render([pendingOrder(1, 'Moses')], false);
  t.check(/wv-pending-card/.test(html), 'a pending order renders its card');
  t.check(/Moses/.test(html), 'and names the client');
  t.check(/wv-deny-btn/.test(html) && /wv-accept-btn/.test(html), 'with both actions on it');
  t.check(!/Nothing to pick right now/.test(html), 'and no empty state');
  t.check(!wrap.classList.contains('is-upnext'), 'and the wrap keeps its place above the pick card');
}

/* ---------- 3b. mid-pick it is news, not a decision ------------------- */
/*
 * The full card used to render here too, wedged between the "Now picking"
 * header and the card being worked on -- splitting the one flow on the
 * screen in half. And its Accept could not work: one open pick at a time
 * has been the rule since 0f31c2c, so pressing it earned a toast telling
 * the worker to finish what they were already holding. A button that
 * existed to be refused, sitting on top of the thing it was refusing for.
 */
{
  const html = render([pendingOrder(1, 'Sarah', 2)], true);
  t.check(/wv-upnext/.test(html), 'a waiting order collapses to a strip while a pick is open');
  t.check(/Up next/.test(html) && /Sarah/.test(html), 'saying what is coming and whose it is');
  t.check(!/wv-deny-btn/.test(html) && !/wv-accept-btn/.test(html),
    'with neither action, because neither is theirs to take yet');
  t.check(!/wv-pending-card/.test(html), 'and no card competing with the one being picked');
  t.check(wrap.classList.contains('is-upnext'),
    'the wrap is flagged, which is what moves it below the pick card');

  // More than one waiting still reads as one line.
  const many = render([pendingOrder(1, 'Sarah', 2), pendingOrder(2, 'Peter'), pendingOrder(3, 'Joan')], true);
  t.check(/\+2 more waiting/.test(many), 'others behind it are counted rather than listed');
  t.check((many.match(/wv-upnext"/g) || []).length === 1, 'as a single strip');

  // ...and the moment the pick is done, the decision is theirs again.
  const after = render([pendingOrder(1, 'Sarah', 2)], false);
  t.check(/wv-deny-btn/.test(after) && /wv-accept-btn/.test(after),
    'finishing brings the full card and both actions back');
  t.check(!wrap.classList.contains('is-upnext'), 'and the wrap returns above the pick card');
}

/* ---------- 3c. the stylesheet is what moves it ----------------------- */
{
  const css = read('worker.html');
  t.check(/\.wv-body\{display:flex;flex-direction:column;\}/.test(css),
    'the body is a column, so its children can be ordered');
  const order = (sel) => {
    const m = new RegExp(`${sel.replace(/[#.]/g, '\\$&')}\\{order:(\\d+);\\}`).exec(css);
    return m ? Number(m[1]) : null;
  };
  t.check(order('#wv_pendingWrap') < order('#wv_activeWrap'),
    'pending sits above the pick card by default');
  t.check(order('#wv_pendingWrap.is-upnext') > order('#wv_activeWrap'),
    'and below it once it is only announcing what is next');
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
