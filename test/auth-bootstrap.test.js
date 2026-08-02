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

/* ---------- 2. a half-created shop is adopted, not duplicated --------- */
/*
 * The stranded-shop case. Second attempt must not insert a second shop.
 */
const ADOPT = grab('adoptHalfCreatedShop');
const CREATE = grab('showCreateShopScreen');
if (!ADOPT || !CREATE) {
  t.check(!!ADOPT, 'shared-worker.js defines adoptHalfCreatedShop, so a stranded shop can be reused');
  t.check(!!CREATE, 'shared-worker.js defines showCreateShopScreen');
  finish();
}
{
  const mk = (respond, log, overlay) => compileScope(
    [ADOPT, CREATE],
    {
      ensureAuthOverlay: () => overlay,
      sb: makeSb(respond, log),
      currentUser: { id: 'user-1' },
      seedData: undefined,
      saveData: async () => {},
      currentShopId: null,
      data: null,
    },
    ['showCreateShopScreen'],
  );

  // An orphan from a previous attempt, same name.
  {
    const log = [];
    const overlay = fakeOverlay();
    const respond = (q) => {
      if (q.table === 'shops' && q.op === 'select') return { data: [{ id: 'shop-orphan', name: 'My Shop' }], error: null };
      if (q.table === 'shop_members' && q.op === 'insert') return { data: null, error: null };
      return { data: null, error: null };
    };
    const { showCreateShopScreen } = mk(respond, log, overlay);
    const p = showCreateShopScreen();
    overlay.node('shop_name').value = 'My Shop';
    overlay.node('shop_create_btn').click().then(async () => {
      const shopId = await p;
      t.check(shopId === 'shop-orphan', `the stranded shop is reused (${shopId})`);
      t.check(!log.includes('insert:shops'), 'no second shop row is created');
      t.check(log.includes('insert:shop_members'), 'and the membership row it was missing is written');
      await partTwo();
    });
  }
  async function partTwo() {
    // No orphan: the normal path still creates one.
    const log = [];
    const overlay = fakeOverlay();
    const respond = (q) => {
      if (q.table === 'shops' && q.op === 'select') return { data: [], error: null };
      if (q.table === 'shops' && q.op === 'insert') return { data: { id: 'shop-new', name: 'My Shop' }, error: null };
      return { data: null, error: null };
    };
    const { showCreateShopScreen } = mk(respond, log, overlay);
    const p = showCreateShopScreen();
    overlay.node('shop_name').value = 'My Shop';
    await overlay.node('shop_create_btn').click();
    const shopId = await p;
    t.check(shopId === 'shop-new' && log.includes('insert:shops'),
      'with nothing to adopt, a shop is created as before');

    // A differently-named orphan is left alone rather than silently renamed.
    const log3 = [];
    const overlay3 = fakeOverlay();
    const respond3 = (q) => {
      if (q.table === 'shops' && q.op === 'select') return { data: [{ id: 'shop-other', name: 'Something Else' }], error: null };
      if (q.table === 'shops' && q.op === 'insert') return { data: { id: 'shop-new-2', name: 'My Shop' }, error: null };
      return { data: null, error: null };
    };
    const { showCreateShopScreen: create3 } = mk(respond3, log3, overlay3);
    const p3 = create3();
    overlay3.node('shop_name').value = 'My Shop';
    await overlay3.node('shop_create_btn').click();
    t.check((await p3) === 'shop-new-2',
      'an orphan under a different name is not adopted in place of what was asked for');

    await partThree();
  }

  /* ---------- 3. failures surface instead of hanging ------------------ */
  async function partThree() {
    // saveData() throwing used to leave the promise unsettled forever.
    const log = [];
    const overlay = fakeOverlay();
    const respond = (q) => {
      if (q.table === 'shops' && q.op === 'select') return { data: [], error: null };
      if (q.table === 'shops' && q.op === 'insert') return { data: { id: 'shop-x', name: 'My Shop' }, error: null };
      return { data: null, error: null };
    };
    const { showCreateShopScreen } = compileScope(
      [
        extractFunction(src, 'adoptHalfCreatedShop', 'shared-worker.js'),
        extractFunction(src, 'showCreateShopScreen', 'shared-worker.js'),
      ],
      {
        ensureAuthOverlay: () => overlay,
        sb: makeSb(respond, log),
        currentUser: { id: 'user-1' },
        seedData: undefined,
        saveData: async () => { throw new Error('network is down'); },
        currentShopId: null,
        data: null,
      },
      ['showCreateShopScreen'],
    );
    let settled = false;
    showCreateShopScreen().then(() => { settled = true; }, () => { settled = true; });
    overlay.node('shop_name').value = 'My Shop';
    await overlay.node('shop_create_btn').click();
    await new Promise(r => setTimeout(r, 0));

    t.check(overlay.node('shop_error').textContent === 'network is down',
      `a failed save is shown to the user ("${overlay.node('shop_error').textContent}")`);
    t.check(overlay.node('shop_create_btn').disabled === false,
      'and the button is usable again so it can be retried');
    t.check(settled === false,
      'the screen stays up rather than resolving as if the shop were ready');

    // Double-click must not run the whole thing twice.
    const log2 = [];
    const overlay2 = fakeOverlay();
    let inserts = 0;
    const respond2 = (q) => {
      if (q.table === 'shops' && q.op === 'select') return { data: [], error: null };
      if (q.table === 'shops' && q.op === 'insert') { inserts++; return { data: { id: 'shop-y', name: 'My Shop' }, error: null }; }
      return { data: null, error: null };
    };
    const { showCreateShopScreen: create2 } = compileScope(
      [
        extractFunction(src, 'adoptHalfCreatedShop', 'shared-worker.js'),
        extractFunction(src, 'showCreateShopScreen', 'shared-worker.js'),
      ],
      {
        ensureAuthOverlay: () => overlay2,
        sb: makeSb(respond2, log2),
        currentUser: { id: 'user-1' },
        seedData: undefined,
        saveData: async () => {},
        currentShopId: null,
        data: null,
      },
      ['showCreateShopScreen'],
    );
    create2();
    overlay2.node('shop_name').value = 'My Shop';
    const btn = overlay2.node('shop_create_btn');
    const first = btn.click();
    t.check(btn.disabled === true, 'the create button is disabled as soon as the first click starts work');
    await first;
    await btn.click();
    t.check(inserts === 1, `a second click does not create a second shop (${inserts} insert(s))`);

    finish();
  }
}

/* ---------- 4. structural: the pieces that keep the above true -------- */
function finish() {
  const picker = grab('showShopPicker') || '';
  t.check(/esc\(\(m\.shops && m\.shops\.name\) \|\| m\.shop_id\)/.test(picker),
    'the picker escapes the name at the point of interpolation');

  const create = grab('showCreateShopScreen') || '';
  t.check(/btn\.disabled = true;/.test(create) && /catch\(e\)/.test(create),
    'the create handler disables its button and catches');
  t.check(create.indexOf('adoptHalfCreatedShop') < create.indexOf("from('shops').insert"),
    'adoption is attempted before a new shop row is inserted');

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
