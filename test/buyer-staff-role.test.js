#!/usr/bin/env node
'use strict';
/*
 * "Buys" in the owner's staff form: somebody added with it signs in to
 * the Buyer app, is never handed picking or delivery, and can still be
 * sent on a collection trip.
 *
 *   1. The floor. staffEligibleForRole never offers a buyer for picking
 *      or delivery, and the staff line (who takes the next order) leaves
 *      them out, with "On the buying desk" in place of "Free".
 *   2. Trips. The owner's "Send who to collect?" list and the Buyer app's
 *      own "Send someone" list both still include them.
 *   3. The login. Changing somebody onto or off the buying desk moves
 *      their existing login, the way the sales desk already does.
 *
 * Run: node test/buyer-staff-role.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('buyer staff role');
const src = read('index.html');
const worker = read('shared-worker.js');
const buyer = read('buyer.html');

/* ---------------- 1. the floor ---------------- */
{
  const staff = [
    { id: 'W1', name: 'Amos', role: 'worker', userId: 'u1' },
    { id: 'D1', name: 'Bena', role: 'delivery', userId: 'u2' },
    { id: 'B1', name: 'Okello', role: 'buyer', userId: 'u3' },
    { id: 'B2', name: 'Peter', role: 'buyer', userId: null },
    { id: 'S1', name: 'Grace', role: 'sales', userId: 'u4' },
  ];
  const data = { staff };
  const scope = compileScope([
    extractFunction(worker, 'staffEligibleForRole', 'shared-worker.js'),
    extractFunction(src, 'staffDispatchState', 'index.html'),
    extractFunction(src, 'staffInLine', 'index.html'),
  ], { data, staffAttendanceOn: () => ({ state: 'present' }), todayISO: () => '2026-10-16', staffActiveOrders: () => [], esc: (x) => String(x) },
  ['staffEligibleForRole', 'staffDispatchState', 'staffInLine']);
  const b = staff[2];
  t.check(!scope.staffEligibleForRole(b, 'worker') && !scope.staffEligibleForRole(b, 'delivery'), 'a buyer is never offered for picking or delivery');
  const st = scope.staffDispatchState(b);
  t.check(st.key === 'buyer' && st.text === 'On the buying desk', 'a buyer with a login reads "On the buying desk", never "Free"');
  t.check(scope.staffDispatchState(staff[3]).key === 'nologin' && /Buyer app/.test(scope.staffDispatchState(staff[3]).note), 'and one without a login says they sign in to the Buyer app once invited');
  const line = scope.staffInLine().map((x) => x.s.id);
  t.check(line.join() === 'W1,D1', 'the line for the next order holds the floor only: ' + line.join());
}

/* ---------------- 2. trips ---------------- */
{
  const modal = extractFunction(src, 'openAssignTripModal', 'index.html');
  t.check(/const candidates = \(data\.staff\|\|\[\]\)\.filter\(s=> !s\.unavailable && String\(s\.id\) !== String\(trip\.assignedWorkerId\)\)/.test(modal),
    'the owner can still send a buyer on a trip — the list is everyone available, not only the floor');
  t.check(/SHEET\.staff = \(\) => \{\s*const me = myStaff\(\), list = D\(\)\.staff\.filter\(s => !s\.unavailable && !\(me && String\(s\.id\) === String\(me\.id\)\)\);/.test(buyer),
    'and the Buyer app can send another buyer or anyone on the staff list');
}

/* ---------------- 3. the login ---------------- */
{
  t.check(/const desks = \['sales', 'buyer'(?:, 'store')?(?:, 'manager')?(?:, 'accounts')?(?:, 'sourcing')?\];\s*const crossesDesk = !!prevRole && prevRole !== record\.role && \(desks\.includes\(prevRole\) \|\| desks\.includes\(record\.role\)\);/.test(src),
    'changing somebody onto or off the buying desk moves their login, as the sales desk does');
  const move = extractFunction(src, 'moveStaffLoginToRole', 'index.html');
  t.check(/out\.role === 'buyer'\s*\? `\$\{firstName\(s\.name\)\}'s login now opens the Buyer app`/.test(move), 'and says where it now opens');
  const roles = /const SF_ROLES = \[[\s\S]*?\n\];/.exec(src)[0];
  t.check(/key:'buyer', name:'Buys'/.test(roles), 'the staff form offers "Buys"');
  const invite = read('supabase/functions/invite-worker/index.ts');
  t.check(/const BUYER_APP_URL = Deno\.env\.get\("BUYER_APP_URL"\) \|\| "https:\/\/omni-ware\.vercel\.app\/buyer\.html"/.test(invite), 'a buyer\'s invite lands on buyer.html');
  t.check(/const pick = rows\.find\(m => m\.role === 'buyer'\)/.test(buyer), 'and the Buyer app opens for a buyer membership');
}

process.exit(t.done() ? 1 : 0);
