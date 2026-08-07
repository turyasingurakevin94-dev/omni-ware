#!/usr/bin/env node
'use strict';
/*
 * The auth + shop bootstrap in shared-worker.js -- the gate both the admin
 * app (index.html) and the worker app (worker.html) sit behind. Neither
 * defines its own; both call ensureAuthAndShop() from here, so a bug in
 * this file is a bug in both.
 *
 * What was wrong:
 *
 *   - showShopPicker() interpolated the shop name straight into innerHTML.
 *     esc() is defined at the top of the same file and used 168 lines
 *     above, so this was an inconsistency rather than a missing tool. A
 *     shop you were invited to could put markup in your own picker.
 *
 *   - showCreateShopScreen() makes two writes that cannot be atomic from a
 *     client: insert the shop, then insert the membership row. If the
 *     second failed, the shop was stranded permanently -- the picker reads
 *     shop_members so it never showed up, and "owners can delete shop"
 *     (0001) needs an owner membership row that does not exist, so nobody
 *     could remove it. Clicking again made another one.
 *
 *   - The same handler awaited saveData() with nothing around it. A throw
 *     there left the promise unsettled: overlay up, button dead, and
 *     boot()'s own catch never reached.
 *
 * Run: node test/auth-bootstrap.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('auth bootstrap');
const src = read('shared-worker.js');

/* ---------- a DOM small enough to reason about ------------------------ */
function fakeEl() {
  return {
    innerHTML: '', textContent: '', value: '', disabled: false, type: '', checked: false,
    _h: {},
    addEventListener(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); },
    // A real browser fires no click on a disabled button, so neither does
    // this -- otherwise a disable guard looks broken when it is working.
    async click() {
      if (this.disabled) return;
      for (const fn of (this._h.click || [])) await fn({ target: this });
    },
  };
}
function fakeOverlay() {
  const nodes = {};
  const el = fakeEl();
  el.querySelector = (sel) => {
    const id = String(sel).replace(/^#/, '');
    return nodes[id] || (nodes[id] = fakeEl());
  };
  el.node = (id) => el.querySelector('#' + id);
  return el;
}

// Chainable enough for .select().eq() and .insert().select().single(),
// and awaitable at any point, which is how the real client behaves.
function makeSb(respond, log) {
  const chain = (table, op, payload) => {
    const q = {
      table, op, payload, filters: [],
      select(cols) { q.cols = cols; return q; },
      eq(col, val) { q.filters.push([col, val]); return q; },
      single() { q.isSingle = true; return q; },
      then(res, rej) { return Promise.resolve().then(() => respond(q)).then(res, rej); },
    };
    return q;
  };
  return {
    from(table) {
      return {
        select(cols) { log.push(`select:${table}`); return chain(table, 'select').select(cols); },
        insert(payload) { log.push(`insert:${table}`); return chain(table, 'insert', payload); },
      };
    },
    auth: {
      updateUser: async (p) => { log.push('auth:updateUser'); return respond({ table: 'auth', op: 'updateUser', payload: p }); },
    },
  };
}

const esc = extractFunction(src, 'esc', 'shared-worker.js');

// A function this file expects may simply not be there. That has to read as
// a failed check, not a stack trace that takes every later check with it.
function grab(name) {
  try { return extractFunction(src, name, 'shared-worker.js'); }
  catch (e) { return null; }
}

/* ---------- 1. the shop picker escapes the shop name ------------------ */
/*
 * Reachable when a login has two or more memberships. The name comes from
 * whoever created that shop, which for an invited user is someone else.
 */
{
  const overlay = fakeOverlay();
  const { showShopPicker } = compileScope(
    [esc, extractFunction(src, 'showShopPicker', 'shared-worker.js')],
    { ensureAuthOverlay: () => overlay }, ['showShopPicker'],
  );

  const EVIL = '</option><img src=x onerror=alert(1)>';
  showShopPicker([
    { shop_id: 'aaaa-1111', shops: { name: EVIL } },
    { shop_id: 'bbbb-2222', shops: { name: 'Kampala Hardware' } },
  ]);
  const html = overlay.innerHTML;

  t.check(!html.includes(EVIL), 'the raw shop name is not written into the picker markup');
  t.check(!/<img src=x onerror/.test(html), 'and the injected tag does not survive as a tag');
  t.check(html.includes('&lt;/option&gt;'), 'it is escaped rather than stripped');
  t.check(html.includes('Kampala Hardware'), 'an ordinary shop name still reads normally');

  // The quote-breaking case, which the value attribute would carry.
  const overlay2 = fakeOverlay();
  const { showShopPicker: picker2 } = compileScope(
    [esc, extractFunction(src, 'showShopPicker', 'shared-worker.js')],
    { ensureAuthOverlay: () => overlay2 }, ['showShopPicker'],
  );
  picker2([{ shop_id: 'x" onmouseover="alert(1)', shops: { name: 'ok' } }]);
  // The escaped text still reads "onmouseover=" -- that is harmless. What
  // matters is that no raw quote closes the value attribute early.
  t.check(!/value="x" /.test(overlay2.innerHTML),
    'a quote in the shop id cannot break out of the value attribute');
  t.check(overlay2.innerHTML.includes('&quot;'),
    'the quote is escaped rather than dropped');
}

/* ---------- 2. the create-shop flow is GONE, on purpose --------------- */
/*
 * Everything this file once proved about showCreateShopScreen and
 * adoptHalfCreatedShop (adoption before insert, the disabled button, the
 * surfaced saveData throw) died with the flow itself: shop creation is no
 * longer a client power AT ALL. Any signed-up stranger used to be offered
 * a blank shop; now an account with no membership hits a dead end in
 * every host, and migration 0059 dropped the policy that would have let
 * an insert through anyway. auth-login-screens.test.js holds the closed
 * door; here it is enough that the flow cannot quietly return.
 */
t.check(!grab('showCreateShopScreen') && !grab('adoptHalfCreatedShop'),
  'the create-shop flow is gone from shared-worker.js, not waiting to be rewired');
finish();

/* ---------- 4. structural: the pieces that keep the above true -------- */
function finish() {
  const picker = grab('showShopPicker') || '';
  t.check(/esc\(\(m\.shops && m\.shops\.name\) \|\| m\.shop_id\)/.test(picker),
    'the picker escapes the name at the point of interpolation');

  const setpw = grab('showSetPasswordScreen') || '';
  t.check(/saveBtn\.disabled = true;/.test(setpw),
    'the set-password button cannot be double-submitted either');
  t.check(/catch\(e\)/.test(setpw),
    'and a thrown updateUser is reported rather than leaving a dead screen');

  // Both host apps use this one bootstrap -- neither may grow its own.
  ['index.html', 'worker.html'].forEach(f => {
    const host = read(f).split(/\r?\n/).map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n');
    t.check(!/function (showShopPicker|showCreateShopScreen|ensureAuthAndShop)\b/.test(host),
      `${f} still uses the shared bootstrap rather than its own copy`);
  });

  process.exit(t.done() ? 1 : 0);
}
