#!/usr/bin/env node
'use strict';
/*
 * agent-nudge: what an agent's phone is told, and when. A notification is
 * the one part of the feed that reaches into someone's pocket uninvited,
 * so these pin the rules that keep it worth having: quiet hours, a daily
 * cap, each moment sent once, the most urgent first, and a closed
 * endpoint. Plus the agent side: asked for only from a button, and a tap
 * lands on the Feed.
 *
 * Run: node test/agent-nudge.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent nudge');
const fnSrc = read('supabase/functions/agent-nudge/index.ts');
const fn = (name) => extractFunction(fnSrc, name, 'agent-nudge/index.ts');
const DAY = 86400000;

let api;
try {
  api = compileScope(
    ['kampalaHour', 'isQuiet', 'kampalaDate', 'linePriced', 'orderEarnings', 'earnedOf', 'sumEarned', 'voice', 'fmt', 'first',
      'namesList', 'unitWord', 'weekOf', 'daysInMonth', 'wants', 'nudgesFor', 'pickToSend', 'monthBoard', 'priceMoves'].map(fn),
    { QUIET_FROM: 20, QUIET_TO: 7, KAMPALA_OFFSET_H: 3, DAY, WRAP_HOUR: 19,
      MONTHS: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      WEEKDAYS: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      DEFAULT_KINDS: { morning: true, win: true, price: true, bonus: true, goal: true, due: true, wrap: false } },
    ['isQuiet', 'nudgesFor', 'pickToSend', 'monthBoard', 'priceMoves'],
    { typescript: true });
} catch (e) { t.check(false, `the nudge rules compile (${e.message})`); }

if (api) {
  /* ---------- 1. quiet hours, Kampala time ---------------------------- */
  t.check(api.isQuiet(Date.parse('2026-09-27T17:30:00Z')), '20:30 in Kampala is quiet');
  t.check(api.isQuiet(Date.parse('2026-09-27T03:30:00Z')), '06:30 in Kampala is quiet');
  t.check(!api.isQuiet(Date.parse('2026-09-27T05:00:00Z')), '08:00 in Kampala is not');

  /* ---------- 2. what is worth a nudge, most urgent first -------------- */
  const now = Date.parse('2026-09-27T07:00:00Z');      // 10:00 in Kampala
  const d = (n) => new Date(now - n * DAY).toISOString().slice(0, 10);
  const line = (price, sell, qty) => ({ sellPrice: price, agentSellPrice: sell, qty });
  const orders = [
    { agent_id: 'A1', date: d(42), status: 'completed', payload: { agentClientId: 7, items: [line(100, 120, 10)] } },
    { agent_id: 'A1', date: d(21), status: 'completed', payload: { agentClientId: 7, items: [line(100, 120, 10)] } },
    { agent_id: 'A2', date: d(3), status: 'completed', payload: { items: [line(100, 130, 12)] } },
    { agent_id: 'A1', date: d(2), status: 'completed', payload: { items: [line(100, 120, 5)] } },
  ];
  const board = api.monthBoard(orders.filter((o) => o.date >= '2026-09-01'), [{ id: 'A1' }, { id: 'A2' }], '2026-09');
  const ctx = {
    inquiries: [
      { id: 1, agent_id: 'A1', customer_name: 'Peter Mugisha', message: 'Need 2 grinders', created_at: new Date(now - 3600000).toISOString() },
      { id: 2, agent_id: 'A1', customer_name: 'Old', created_at: new Date(now - 5 * DAY).toISOString() },
      { id: 3, agent_id: 'A2', customer_name: 'Not his', created_at: new Date(now - 3600000).toISOString() },
      { id: 4, agent_id: 'A1', customer_name: 'Done', handled_at: 'x', created_at: new Date(now - 3600000).toISOString() },
    ],
    pins: [{ id: 9, product_id: 'gog', note: 'New stock', created_at: new Date(now - DAY).toISOString(), ends_on: d(-3) }],
    promos: [{ id: 5, product_id: 'g', variant_idx: '', bonus_type: 'fixed', bonus_value: 5000, active: true, ends_at: d(-1) },
             { id: 6, product_id: 'x', variant_idx: '', bonus_type: 'fixed', bonus_value: 5000, active: true, ends_at: d(-1) }],
    clusters: [{ agent_id: 'A1', product_id: 'g', variant_idx: '' }],
    orders,
    products: new Map([['gog', 'Safety goggles'], ['g', 'Angle grinder']]),
    clients: new Map([['A1|7', 'John Kasule']]),
    board,
  };
  const n = api.nudgesFor('A1', ctx, now);
  const kinds = n.map((x) => x.kind);
  t.check(JSON.stringify(kinds) === JSON.stringify(['request', 'pin', 'due', 'rank', 'bonus']),
    `a request, a pin, a client due, a place within reach and a bonus ending, in that order (${kinds.join(', ')})`);
  t.check(n.filter((x) => x.kind === 'request').length === 1,
    'only an unanswered request, from the last two days, on HIS page');
  t.check(n.find((x) => x.kind === 'due').title === 'John Kasule is due', 'the due client is named');
  t.check(n.filter((x) => x.kind === 'bonus').length === 1, 'a bonus only for an item in his cluster');
  t.check(/from #1/.test(n.find((x) => x.kind === 'rank').title), 'and the place he can reach is the one above him');

  /* ---------- 3. once, and a cap a day -------------------------------- */
  const sent = new Set(['request|1']);
  const pick = api.pickToSend(n, sent, 1, 3);
  t.check(pick.length === 2 && pick[0].kind === 'pin', 'a moment already sent is not sent again, and the day stops at three');
  t.check(api.pickToSend(n, new Set(), 3, 3).length === 0, 'three already today means none more');
}

/* ---------- 3b. personal, precise, in the agent's own voice ------------ */
if (api) {
  // Thursday 15 October 2026, 08:00 in Kampala.
  const at = (h) => Date.parse(`2026-10-15T${String(h - 3).padStart(2, '0')}:00:00Z`);
  const day = (n) => new Date(Date.parse('2026-10-15T00:00:00Z') - n * DAY).toISOString().slice(0, 10);
  const line = (pid, qty, sell, price) => ({ productId: pid, variantIdx: null, qty, agentSellPrice: sell, sellPrice: price });
  const o = (date, cid, items, status) => ({ agent_id: 'H', date, status: status || 'completed', payload: { agentClientId: cid, items } });
  const orders = [
    o(day(14), 1, [line('cem', 40, 33000, 32600)]), o(day(7), 1, [line('cem', 40, 33000, 32600)]),   // Junior, every 7 days, due today
    o(day(20), 2, [line('g28', 60, 41000, 40800)]), o(day(10), 2, [line('g28', 60, 41000, 40800)]),  // Ken, every 10 days, due today
    o(day(0), 3, [line('cem', 5, 34000, 32000)], 'draft'),                                          // Grace's very first order, today
  ];
  const base = {
    inquiries: [], pins: [], clusters: [], orders,
    promos: [{ id: 41, product_id: 'g28', variant_idx: '', bonus_type: 'percent', bonus_value: 5, active: true, ends_at: '2026-10-16', created_at: '2026-10-14T09:00:00Z' }],
    products: new Map([['cem', 'Hima cement 50kg'], ['g28', 'Iron sheet G28']]),
    images: new Map([['cem', 'https://img.example/cem.jpg']]),
    clients: new Map([['H|1', 'Junior'], ['H|2', 'Ken Okello'], ['H|3', 'Grace N.']]),
    agentNames: new Map([['H', 'Henry Mugisha']]),
    clientCounts: new Map([['H', 13]]),
    goals: new Map([['H', 400000]]),
    prefs: new Map(),
    prices: api.priceMoves([
      { product_id: 'cem', variant_key: '', price: 32000, unit: 'bag', taken_on: day(1) },
      { product_id: 'cem', variant_key: '', price: 31200, unit: 'bag', taken_on: day(0) },
    ], day(0)),
    board: [],
  };
  const n8 = api.nudgesFor('H', base, at(8));
  const find = (k) => n8.find((x) => x.kind === k);
  t.check(find('morning') && find('morning').title === 'Morning, Henry' && /^Junior and Ken are due today\. Together, about [\d,]+ for you\.$/.test(find('morning').body),
    `the morning plan names him, names who is due, and says what it earns (${find('morning') && find('morning').body})`);
  t.check(n8[0].kind === 'morning', 'and it comes first, at his hour');
  t.check(!api.nudgesFor('H', base, at(10)).some((x) => x.kind === 'morning'), 'and only at his hour');
  const price = find('price');
  t.check(price && price.title === 'Hima cement 50kg just got cheaper, Henry'
    && price.body === "You pay 31,200 a bag, down 800. On Junior's usual 40 bags, that is +32,000 for you.",
    `a price drop is worked out on the client who takes the most of it (${price && price.body})`);
  t.check(price && price.image === 'https://img.example/cem.jpg' && price.open === 'item:cem:', 'with the product photo, and a tap opens the item');
  const win = n8.find((x) => x.kind === 'win' && /client/.test(x.ref));
  t.check(win && win.title === 'Grace is client number 13', `a first order is celebrated with the client's number (${win && win.title})`);
  const bonus = find('bonus_new');
  t.check(bonus && /^Until Friday\. Ken took 60 last time: at that, [\d,]+ extra\.$/.test(bonus.body),
    `a new bonus says what it would have added to a real client's order (${bonus && bonus.body})`);
  t.check(!find('goal'), 'and no goal milestone before a quarter of it');
  const rich = Object.assign({}, base, { goals: new Map([['H', 70000]]) });   // 54,000 so far
  const g = api.nudgesFor('H', rich, at(10)).find((x) => x.kind === 'goal');
  t.check(g && g.ref === '2026-10:75' && g.title === 'Three quarters done' && g.open === 'goal',
    `a goal milestone is the highest one crossed, once (${g && g.ref})`);

  const plain = Object.assign({}, base, { prefs: new Map([['H', { tone: 'straight', kinds: { price: false }, morning_hour: 9 }]]) });
  const p9 = api.nudgesFor('H', plain, at(9));
  t.check(p9.find((x) => x.kind === 'morning').title === 'Today: 2 clients due', 'straight to the point when he asks for that');
  t.check(!p9.some((x) => x.kind === 'price'), 'a kind he switched off is never sent');
  t.check(!api.nudgesFor('H', plain, at(8)).some((x) => x.kind === 'morning'), 'and the morning plan comes at the hour he picked');
  t.check(!api.nudgesFor('H', base, at(19)).some((x) => x.kind === 'wrap'), 'the evening wrap-up is off until he turns it on');
  const eve = Object.assign({}, base, { prefs: new Map([['H', { kinds: { wrap: true } }]]) });
  const w = api.nudgesFor('H', eve, at(19)).find((x) => x.kind === 'wrap');
  t.check(w && /^1 order, \+[\d,]+\. Tomorrow is wide open\.$/.test(w.body), `and then says today in one line (${w && w.body})`);
}

/* ---------- 3c. every phone, its own way ------------------------------ */
t.check(/platform === "android"[\s\S]{0,120}sendFcm/.test(fnSrc) && /platform === "ios"[\s\S]{0,160}sendApns/.test(fnSrc),
  'Android through FCM, iPhone through APNs, the browser through Web Push');
t.check(/if \(code === 410\) await admin\.from\("agent_push_subscriptions"\)\.delete\(\)/.test(fnSrc), 'and a phone that is gone is forgotten');
t.check(/if \(k === "request"\) return true;/.test(fnSrc), 'a customer waiting on an answer is never switched off');

/* ---------- 4. closed unless the shop set a secret --------------------- */
t.check(/if \(!AGENT_NUDGE_SECRET\) return json\(\{ error: "AGENT_NUDGE_SECRET is not set" \}, 503\);/.test(fnSrc),
  'the run endpoint refuses to work at all without AGENT_NUDGE_SECRET');
t.check(/x-cron-secret/.test(fnSrc) && /401/.test(fnSrc), 'and turns away a call without the right secret');
t.check(/retired_at/.test(fnSrc) && /unavailable/.test(fnSrc), 'a paused or retired agent is never nudged');
t.check(/unique index if not exists agent_push_log_once/.test(read('supabase/migrations/0103_agent_push.sql')),
  'the database itself refuses the same moment twice');

/* ---------- 5. the agent side ------------------------------------------ */
const agent = read('agent.html');
const fnBody = (name)=>{
  const i = agent.search(new RegExp(`(async )?function ${name}\\(`));
  if(i < 0) return '';
  const j = agent.indexOf('\n}\n', i);
  return agent.slice(i, j < 0 ? i + 4000 : j);
};
t.check(/data-p="push"/.test(agent) && /else if\(k === 'push'\) openNotifySheet\(\);/.test(agent),
  'You -> Notifications opens the notifications sheet');
t.check(/data-nt="on"/.test(agent) && /t\.dataset\.nt === 'on'\)\{ if\(await enableAgentPush\(\)\)/.test(agent)
  && /data-ask="on"/.test(agent) && /if\(await enableAgentPush\(\)\) sheet\.close\(\);/.test(agent),
  'notifications are asked for from a button he pressed');
t.check(!/requestPermission\(\)[\s\S]{0,40}boot\(\)/.test(agent) && !/^\s*enableAgentPush\(\);/m.test(agent)
  && !/requestPermissions/.test(fnBody('startAgentPush')),
  'and never on load -- starting up only refreshes a token already allowed');
t.check(/pushAskDue = true;/.test(fnBody('showSent')) && /localStorage\.setItem\(pushAskedKey\(\), '1'\)/.test(fnBody('openPushAskSheet'))
  && /agentPushState\(\) !== 'off'/.test(fnBody('maybeAskForPush')),
  'the first ask comes once, after an order is sent, and only while notifications are off');
t.check(/onConflict: 'push_token'/.test(fnBody('saveNativeToken')) && /platform: C\.getPlatform\(\)/.test(fnBody('saveNativeToken')),
  'in the phone app the push token is saved against the agent, one row per phone');
const route = fnBody('routePush');
t.check(['goal', 'order', 'client', 'item'].every(k=> route.includes(`what === '${k}'`)) && /startAgentPush\(\);/.test(agent)
  && /pushNotificationActionPerformed/.test(fnBody('startAgentPush')),
  'a tapped notification lands where it points: the goal, an order, a client, an item');
t.check(/switchTab\(openParam \? 'today'/.test(agent) && /routePush\(openParam\)/.test(agent) && /routePush\(e\.data\.open\)/.test(agent),
  'in the browser too, via ?open= and the service worker');
// The sheet's choices are the ones agent-nudge reads.
const kindsIds = [...(agent.match(/const NOTIFY_KINDS = \[([\s\S]*?)\n\];/) || ['', ''])[1].matchAll(/id:'(\w+)'/g)].map(m=> m[1]);
const serverKinds = Object.keys(JSON.parse(fnSrc.match(/DEFAULT_KINDS[^=]*=\s*(\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":')));
t.check(kindsIds.length === 7 && kindsIds.join() === serverKinds.join(),
  `the sheet's switches are the kinds agent-nudge knows (${kindsIds.join(', ')})`);
t.check(/\[7, 8, 9\]/.test(fnBody('openNotifySheet')) && /data-tone="playful"/.test(agent) && /data-tone="straight"/.test(agent)
  && /onConflict: 'shop_id,agent_id'/.test(fnBody('saveNotifyPrefs')),
  'morning time and tone are saved as the table allows them');
const mig = read('supabase/migrations/0110_agent_native_push.sql');
t.check(/morning_hour between 6 and 10/.test(mig) && /tone in \('playful', 'straight'\)/.test(mig)
  && /create unique index if not exists agent_push_subscriptions_token_key\s+on agent_push_subscriptions \(push_token\);/.test(mig),
  'the table takes those values, and a plain unique index answers ON CONFLICT (push_token)');
// The phone apps.
const manifest = read('apps/agent/android/app/src/main/AndroidManifest.xml');
t.check(/POST_NOTIFICATIONS/.test(manifest) && /default_notification_icon" android:resource="@drawable\/ic_stat_ow"/.test(manifest)
  && /default_notification_channel_id/.test(manifest) && /<vector/.test(read("apps/agent/android/app/src/main/res/drawable/ic_stat_ow.xml"))
  && /icon: "ic_stat_ow"/.test(fnSrc),
  'Android: asks on 13+, and shows the app\'s own mark');
t.check(/<string name="ow_notify_channel">ow_agent<\/string>/.test(read('apps/agent/android/app/src/main/res/values/notify.xml'))
  && /createChannel\(\{ id:'ow_agent'/.test(agent) && /channel_id: "ow_agent"/.test(fnSrc),
  'Android: one channel, named the same in the app, the manifest and agent-nudge');
t.check(/capacitorDidRegisterForRemoteNotifications/.test(read('apps/agent/ios/App/App/AppDelegate.swift'))
  && /aps-environment/.test(read('apps/agent/ios/App/App/App.entitlements'))
  && /CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/.test(read('apps/agent/ios/App/App.xcodeproj/project.pbxproj')),
  'iPhone: the APNs token reaches the app, and the app may receive pushes');
const sw = read('agent-sw.js');
t.check(/showNotification/.test(sw) && /notificationclick/.test(sw) && !/caches\./.test(sw),
  'the service worker shows and opens notifications, and caches nothing');

process.exit(t.done() ? 1 : 0);
