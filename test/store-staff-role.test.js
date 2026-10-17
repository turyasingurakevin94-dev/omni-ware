#!/usr/bin/env node
'use strict';
/*
 * "Runs the store" in the owner's staff form: somebody added with it signs
 * in to the Store app (store.html), and -- unlike Sells and Buys -- is still
 * on the floor: handed picking and delivery, in the line for the next
 * order, and told about the pickers' queue.
 *
 *   1. The floor. staffEligibleForRole offers them for picking and
 *      delivery; the staff line counts them as Free or Carrying.
 *   2. The form and the list. The form offers it, the list badges it, the
 *      filter finds it.
 *   3. The login. Changing somebody onto or off the store moves their
 *      existing login; a new invite lands on store.html as a 'store'
 *      member; the Store app opens for that membership.
 *
 * Run: node test/store-staff-role.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('store staff role');
const src = read('index.html');
const worker = read('shared-worker.js');
const store = read('store.html');

/* ---------------- 1. the floor ---------------- */
{
  const staff = [
    { id: 'W1', name: 'Amos', role: 'worker', userId: 'u1' },
    { id: 'D1', name: 'Bena', role: 'delivery', userId: 'u2' },
    { id: 'K1', name: 'Musa', role: 'store', userId: 'u3' },
    { id: 'B1', name: 'Okello', role: 'buyer', userId: 'u4' },
    { id: 'S1', name: 'Grace', role: 'sales', userId: 'u5' },
  ];
  const scope = compileScope([
    extractFunction(worker, 'staffEligibleForRole', 'shared-worker.js'),
    extractFunction(src, 'staffDispatchState', 'index.html'),
    extractFunction(src, 'staffInLine', 'index.html'),
  ], { data: { staff }, staffAttendanceOn: () => ({ state: 'present' }), todayISO: () => '2026-10-17', staffActiveOrders: () => [], esc: (x) => String(x) },
  ['staffEligibleForRole', 'staffDispatchState', 'staffInLine']);
  const k = staff[2];
  t.check(scope.staffEligibleForRole(k, 'worker') && scope.staffEligibleForRole(k, 'delivery'), 'somebody who runs the store can be handed picking and delivery');
  t.check(!scope.staffEligibleForRole(staff[1], 'worker') && scope.staffEligibleForRole(staff[0], 'delivery'), 'and the worker / delivery split is unchanged');
  t.check(scope.staffDispatchState(k).key === 'free', 'with a login and nothing in hand, they read Free');
  t.check(scope.staffInLine().map((x) => x.s.id).join() === 'W1,D1,K1', 'and they are in the line for the next order');
  const nw = read('supabase/functions/notify-worker/index.ts');
  t.check(/\.in\("role", \["worker", "store"\]\)/.test(nw), 'the "Next to pick" push reaches them too');
}

/* ---------------- 2. the form and the list ---------------- */
{
  const roles = /const SF_ROLES = \[[\s\S]*?\n\];/.exec(src)[0];
  t.check(/key:'store', name:'Runs the store'/.test(roles), 'the staff form offers "Runs the store"');
  t.check(/r\.key === 'store' \? ICON_SX_STORE/.test(src) && /const ICON_SX_STORE = '<svg/.test(src), 'with its own shopfront mark');
  t.check(/s\.role === 'store' \? `<span class="sx-capb">\$\{ICON_SX_STORE\}Store<\/span>/.test(src), 'the list badges them Store, Pick and Deliver');
  t.check(/data-role="store" aria-pressed="false">Store/.test(src) && /store: rows\.filter\(s=> s\.role === 'store'\)\.length/.test(src), 'and the filter finds them, with a count');
}

/* ---------------- 3. the login ---------------- */
{
  t.check(/const desks = \['sales', 'buyer', 'store'(?:, 'manager')?\];/.test(src), 'changing somebody onto or off the store moves their login');
  const move = extractFunction(src, 'moveStaffLoginToRole', 'index.html');
  t.check(/out\.role === 'store'\s*\? `\$\{firstName\(s\.name\)\}'s login now opens the Store app`/.test(move), 'and says where it now opens');
  const invite = read('supabase/functions/invite-worker/index.ts');
  t.check(/const STORE_APP_URL = Deno\.env\.get\("STORE_APP_URL"\) \|\| "https:\/\/omni-ware\.vercel\.app\/store\.html"/.test(invite) && /isStore \? STORE_APP_URL/.test(invite), 'a store invite lands on store.html');
  t.check(/isStore \? "store"/.test(invite) && /const DESK_ROLES = \["staff", "sales", "buyer", "store"(?:, "manager")?\]/.test(invite), 'as a store member, which a later role change may move');
  t.check(/const pick = rows\.find\(m => m\.role === 'store'\)/.test(store), 'and the Store app opens for a store membership');
}

process.exit(t.done() ? 1 : 0);
