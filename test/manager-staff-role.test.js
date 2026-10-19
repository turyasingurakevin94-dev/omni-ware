#!/usr/bin/env node
'use strict';
/*
 * "Manages the team" in the owner's staff form: somebody added with it
 * signs in to the Manager app (manager.html), and -- like Sells and Buys,
 * unlike Runs the store -- is never handed picking or delivery.
 *
 *   1. The floor. staffEligibleForRole never offers them for picking or
 *      delivery; the staff line does not count them; they read "Runs the
 *      team", never "Free".
 *   2. The form and the list. The form offers it with its own mark, the
 *      list badges it.
 *   3. The login. Changing somebody onto or off it moves their existing
 *      login; a new invite lands on manager.html as a 'manager' member;
 *      the Manager app opens for that membership.
 *
 * Run: node test/manager-staff-role.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager staff role');
const src = read('index.html');
const worker = read('shared-worker.js');
const app = read('manager.html');

/* ---------------- 1. the floor ---------------- */
{
  const staff = [
    { id: 'W1', name: 'Amos', role: 'worker', userId: 'u1' },
    { id: 'M1', name: 'Sarah', role: 'manager', userId: 'u2' },
    { id: 'M2', name: 'Peter', role: 'manager', userId: null },
    { id: 'K1', name: 'Musa', role: 'store', userId: 'u3' },
  ];
  const scope = compileScope([
    extractFunction(worker, 'staffEligibleForRole', 'shared-worker.js'),
    extractFunction(src, 'staffDispatchState', 'index.html'),
    extractFunction(src, 'staffInLine', 'index.html'),
  ], { data: { staff }, staffAttendanceOn: () => ({ state: 'present' }), todayISO: () => '2026-10-17', staffActiveOrders: () => [], esc: (x) => String(x) },
  ['staffEligibleForRole', 'staffDispatchState', 'staffInLine']);
  const m = staff[1];
  t.check(!scope.staffEligibleForRole(m, 'worker') && !scope.staffEligibleForRole(m, 'delivery'), 'a manager is never handed picking or delivery');
  t.check(scope.staffDispatchState(m).key === 'manager' && scope.staffDispatchState(m).text === 'Runs the team', 'with a login they read "Runs the team", never Free');
  t.check(scope.staffDispatchState(staff[2]).key === 'nologin' && /Manager app/.test(scope.staffDispatchState(staff[2]).note), 'without one, "No login yet", pointing at the Manager app');
  t.check(scope.staffInLine().map((x) => x.s.id).join() === 'W1,K1', 'and they are not in the line for the next order');
}

/* ---------------- 2. the form and the list ---------------- */
{
  const roles = /const SF_ROLES = \[[\s\S]*?\n\];/.exec(src)[0];
  t.check(/key:'manager', name:'Manages the team'/.test(roles), 'the staff form offers "Manages the team"');
  t.check(/r\.key === 'manager' \? ICON_SX_MANAGE/.test(src) && /const ICON_SX_MANAGE = '<svg/.test(src), 'with its own mark');
  t.check(/s\.role === 'manager' \? `<span class="sx-capb">\$\{ICON_SX_MANAGE\}Manages<\/span>`/.test(src), 'the list badges them Manages');
  const warn = extractFunction(src, 'sfUpdateRoleWarning', 'index.html');
  t.check(/chosen === 'manager' && s\.role !== 'manager'/.test(warn) && /s\.role === 'manager' && chosen !== 'manager'/.test(warn), 'moving somebody onto or off it says what changes');
}

/* ---------------- 3. the login ---------------- */
{
  t.check(/const desks = \['sales', 'buyer', 'store', 'manager'(?:, 'accounts')?(?:, 'sourcing')?\];/.test(src), 'changing somebody onto or off it moves their login');
  const move = extractFunction(src, 'moveStaffLoginToRole', 'index.html');
  t.check(/out\.role === 'manager'\s*\? `\$\{firstName\(s\.name\)\}'s login now opens the Manager app`/.test(move), 'and says where it now opens');
  const invite = read('supabase/functions/invite-worker/index.ts');
  t.check(/const MANAGER_APP_URL = Deno\.env\.get\("MANAGER_APP_URL"\) \|\| "https:\/\/omni-ware\.vercel\.app\/manager\.html"/.test(invite) && /isManager \? MANAGER_APP_URL/.test(invite), 'a manager invite lands on manager.html');
  t.check(/isManager \? "manager"/.test(invite) && /const DESK_ROLES = \["staff", "sales", "buyer", "store", "manager"(?:, "accounts")?(?:, "sourcing")?\]/.test(invite), 'as a manager member, which a later role change may move');
  t.check(!/"owner"|"admin"/.test(/const DESK_ROLES = \[[^\]]*\]/.exec(invite)[0]), 'and an owner\'s or admin\'s membership is still never touched');
  t.check(/0116_manager_role\.sql/.test(invite), 'a database without the role is told which migration to paste');
  t.check(/const pick = rows\.find\(m => m\.role === 'manager'\)/.test(app), 'and the Manager app opens for a manager membership');
}

process.exit(t.done() ? 1 : 0);
