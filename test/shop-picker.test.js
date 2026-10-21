#!/usr/bin/env node
'use strict';
/*
 * Which shop a role app opens, when a login belongs to more than one.
 *
 * Every role app used to take the first membership the database returned
 * that suited it. With one shop that was the shop; with two (the owner
 * across the old books and a fresh start) it opened one of them at random
 * and never said which. Now:
 *
 *   1. One block, the same in all seven apps, decides it. Each app passes
 *      it the memberships it may open, and reads the shop's age with them.
 *   2. One shop: no question. Two or more: the person chooses, newest shop
 *      first, and the choice is kept on this phone for every app. Switching
 *      asks again, with the shop open now marked.
 *   3. What a phone keeps for later (a half-made order, a count, which
 *      staff row is "me") is kept per shop, and a value saved before this
 *      change is adopted by the shop open now, once.
 *   4. Each app offers the switch only to a login with more than one shop.
 *
 * Run: node test/shop-picker.test.js   (or: npm test)
 */
const vm = require('vm');
const { read, createReporter } = require('./_extract');

const t = createReporter('shop picker');
const APPS = {
  manager: ['manager', 'owner', 'admin'],
  sales: ['sales', 'owner', 'admin', 'manager'],
  store: ['store', 'owner', 'admin', 'manager', 'staff'],
  buyer: ['buyer', 'owner', 'admin', 'manager'],
  accounts: ['accounts', 'owner', 'admin', 'manager'],
  sourcing: ['sourcing', 'owner', 'admin'],
  owner: ['owner', 'admin'],
};
const START = '/* ---- which shop this login opens ----';
const blockOf = (src, app) => {
  const i = src.indexOf(START), j = src.indexOf('\nasync function boot(){', i);
  if (i < 0 || j < 0) throw new Error(app + '.html: the shop block is missing');
  return src.slice(i, j);
};
const srcs = Object.fromEntries(Object.keys(APPS).map(a => [a, read(a + '.html')]));

/* ---------------- 1. one block, every app ---------------- */
const block = blockOf(srcs.manager, 'manager');
for (const [app, roles] of Object.entries(APPS)) {
  const src = srcs[app];
  t.check(blockOf(src, app) === block, `${app}.html carries the same shop block as manager.html`);
  const boot = src.slice(src.indexOf('\nasync function boot(){'), src.indexOf('\n}\n', src.indexOf('\nasync function boot(){')));
  t.check(/select\('shop_id, role, shops\(name, created_at\)'\)/.test(boot), `${app}: reads each shop's age with its name`);
  const call = /const pick = await chooseShop\(rows\.filter\(m => \[([^\]]*)\]\.includes\(m\.role\)\), \{ box: '([a-z]+-auth)', btn: '([a-z]+-btn)' \}\);/.exec(boot);
  t.check(call && call[1] === roles.map(r => `'${r}'`).join(', '), `${app}: opens for ${roles.join(', ')}, and asks which shop when there are several`);
  t.check(call && new RegExp(`class(?:Name)? ?= ?['"]${call[2]}['"]`).test(src) && src.includes(`.${call[3]}`), `${app}: the picker draws in the app's own sign-in overlay and buttons`);
  t.check(!/rows\.find\(m => /.test(boot), `${app}: no longer takes the first membership that fits`);
}

/* ---------------- 2. the choice ---------------- */
function sandbox(){
  const store = () => { const m = new Map(); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
  const overlays = [];
  const makeEl = cls => {
    const el = { className: cls, innerHTML: '', buttons: [], signout: { onclick: null } };
    el.querySelectorAll = sel => {
      if (sel !== '[data-shop]') return [];
      el.buttons = [...el.innerHTML.matchAll(/data-shop="([^"]*)"/g)].map(x => ({ dataset: { shop: x[1] }, onclick: null }));
      return el.buttons;
    };
    el.querySelector = sel => (sel === '[data-a=signout]' ? el.signout : null);
    return el;
  };
  const ctx = {
    S: { user: { id: 'u1' } },
    localStorage: store(), sessionStorage: store(),
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    sb: { auth: { signOut: async () => {} } },
    location: { reloads: 0, reload(){ this.reloads++; } },
    document: {
      querySelector: sel => overlays.find(o => '.' + o.className === sel) || null,
      createElement: () => makeEl(''),
      body: { appendChild: el => overlays.push(el) },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(block + '\nthis.api = { chooseShop, switchShop, shopScoped, SHOP_KEY };', ctx);
  return { ctx, api: ctx.api, overlays };
}
const OLD = { shop_id: 'shop-old', role: 'owner', shops: { name: 'Mukasa Hardware', created_at: '2025-03-01T08:00:00Z' } };
const NEW = { shop_id: 'shop-new', role: 'owner', shops: { name: 'Mukasa Hardware <fresh>', created_at: '2026-10-21T08:00:00Z' } };
const UI = { box: 'bx-auth', btn: 'bx-btn' };
const flush = () => new Promise(r => setImmediate(r));

(async () => {
  {
    const { ctx, api, overlays } = sandbox();
    t.check((await api.chooseShop([], UI)) === null, 'no shop this app may open: nothing is picked, so the app says access is denied');
    const one = await api.chooseShop([OLD], UI);
    t.check(one === OLD && !overlays.length && ctx.S.shopCount === 1, 'one shop: it opens with no question asked, and no switch is offered');
  }
  {
    const { ctx, api, overlays } = sandbox();
    const p = api.chooseShop([OLD, NEW], UI);
    await flush();
    const el = overlays[0];
    t.check(el && el.className === 'bx-auth' && /Which shop\?/.test(el.innerHTML), 'two shops and no choice yet: the person is asked which one');
    t.check(el.buttons.map(b => b.dataset.shop).join() === 'shop-new,shop-old', 'newest shop first, since after a fresh start that is the one to open');
    t.check(/Newest/.test(el.innerHTML) && !/Open now/.test(el.innerHTML), 'the newest is marked, and no shop is marked as open on a first choice');
    t.check(el.innerHTML.indexOf('>OCT<') < el.innerHTML.indexOf('>MAR<') && /2026</.test(el.innerHTML) && /2025</.test(el.innerHTML),
      'each shop shows the month its books began, which tells an old shop from a fresh one of the same name');
    t.check(!el.innerHTML.includes('<fresh>') && el.innerHTML.includes('&lt;fresh&gt;'), 'a shop name is escaped where it is drawn');
    t.check(/You're the owner/.test(el.innerHTML) && /aria-label="Mukasa Hardware, books from MAR 2025"/.test(el.innerHTML), 'each shop says what this login is there, and a screen reader hears the month too');
    el.buttons[1].onclick();
    const got = await p;
    t.check(got === OLD && ctx.localStorage.getItem('ow-shop:u1') === 'shop-old' && ctx.S.shopCount === 2, 'the tapped shop opens and is remembered on this phone');

    overlays.length = 0;
    const again = await api.chooseShop([OLD, NEW], UI);
    t.check(again === OLD && !overlays.length, 'next time, and in every other app on this phone, the remembered shop opens without asking');

    api.switchShop();
    t.check(ctx.location.reloads === 1 && ctx.sessionStorage.getItem('ow-shop-ask') === '1', 'switching reloads the app to ask again');
    const p2 = api.chooseShop([OLD, NEW], UI);
    await flush();
    t.check(/Open now/.test(overlays[0].innerHTML) && ctx.sessionStorage.getItem('ow-shop-ask') === null, 'the picker comes back with the shop open now marked, and asks only once');
    overlays[0].buttons[0].onclick();
    t.check((await p2) === NEW && ctx.localStorage.getItem('ow-shop:u1') === 'shop-new', 'and the new choice is kept');
  }
  {
    const { ctx, api, overlays } = sandbox();
    ctx.localStorage.setItem('ow-shop:u1', 'shop-gone');
    const p = api.chooseShop([OLD, NEW], UI);
    await flush();
    t.check(overlays.length === 1, 'a remembered shop this login can no longer open is not opened; the person is asked');
    overlays[0].buttons[0].onclick(); await p;
  }

  /* ---------------- 3. what the phone keeps, per shop ---------------- */
  {
    const { ctx, api } = sandbox();
    ctx.localStorage.setItem('ow-store-count:u1', '{"P1":12}');
    t.check(api.shopScoped('ow-store-count:u1') === 'ow-store-count:u1', 'before a shop is open nothing is moved');
    ctx.S.shopId = 'shop-old';
    const k = api.shopScoped('ow-store-count:u1');
    t.check(k === 'ow-store-count:u1:shop-old' && ctx.localStorage.getItem(k) === '{"P1":12}' && ctx.localStorage.getItem('ow-store-count:u1') === null,
      'a count saved before this change is adopted by the shop open now');
    ctx.S.shopId = 'shop-new';
    t.check(ctx.localStorage.getItem(api.shopScoped('ow-store-count:u1')) === null, 'and never shows up in the other shop');
  }
  const KEPT = {
    manager: ["function meKey(){ return shopScoped('ow-manager-me:'", "function dayLogKey(){ return shopScoped('ow-manager-day:'"],
    sales: ["function draftKey(){ return shopScoped('ow-sales-draft:'", "function nwDraftsKey(){ return shopScoped('ow-sales-drafts:'"],
    store: ["const DRAFT_KEY = () => shopScoped('ow-store-picks:'", "const CT_KEY = () => shopScoped('ow-store-count:'"],
    buyer: ["const TRIP_DRAFT_KEY = () => shopScoped('ow-buyer-trip:'", "const PHONES_KEY = () => shopScoped('ow-buyer-phones')"],
  };
  for (const [app, keys] of Object.entries(KEPT)) {
    t.check(keys.every(k => srcs[app].includes(k)), `${app}: its drafts on the phone are kept per shop`);
  }
  t.check(!/localStorage\.(get|set)Item\('ow-buyer-phones'/.test(srcs.buyer), 'buyer: a supplier\'s number kept on the phone is never read across shops');

  /* ---------------- 4. the switch ---------------- */
  for (const app of ['manager', 'sales', 'store', 'buyer', 'accounts', 'owner']) {
    const src = srcs[app];
    t.check(/\$\{S\.shopCount > 1 \? [`'][^\n]*data-act="switchshop"/.test(src) && src.includes('ACT.switchshop = () => switchShop();'),
      `${app}: a login with more than one shop can switch, and nobody else sees it`);
  }
  t.check(/<sc-if value="\{\{ manyShops \}\}"><button type="button" onClick="\{\{ switchShop \}\}"/.test(srcs.sourcing) && /manyShops: S\.shopCount > 1, switchShop: \(\) => switchShop\(\)/.test(srcs.sourcing),
    'sourcing: the same, on its own profile screen');

  process.exit(t.done() ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
