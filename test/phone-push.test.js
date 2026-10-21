#!/usr/bin/env node
'use strict';
/*
 * Every phone app takes pushes (docs/decision-rights.md, "Push
 * notifications are part of the system"; the sending side is 0120 and
 * push-send).
 *
 *   1. Each app's Android shell carries the shop's Firebase file
 *      (google-services.json) with its own package name in it, and the
 *      build applies it -- without it the app cannot get a token at all.
 *   2. Each app signs its phone up under its own login, once, as it
 *      starts, inside the installed app only. Store keeps its own alerts
 *      switch (store.html enablePush).
 *
 * Run: node test/phone-push.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('phone push');
const APPS = ['sales', 'manager', 'buyer', 'store', 'accounts', 'sourcing', 'owner'];

for (const a of APPS) {
  const appId = JSON.parse(read(`apps/${a}/capacitor.config.json`)).appId;
  const gsPath = path.join(__dirname, '..', 'apps', a, 'android', 'app', 'google-services.json');
  let gs = null;
  try { gs = JSON.parse(fs.readFileSync(gsPath, 'utf8')); } catch (_e) {}
  const pkgs = gs ? gs.client.map((c) => c.client_info.android_client_info.package_name) : [];
  t.check(pkgs.includes(appId), `${a}: google-services.json names ${appId}`);
  t.check(/apply plugin: 'com\.google\.gms\.google-services'/.test(read(`apps/${a}/android/app/build.gradle`)), `${a}: the build applies it`);
  t.check(/@capacitor\/push-notifications/.test(read(`apps/${a}/package.json`)), `${a}: the push plugin is in the app`);
  const vc = Number((/versionCode (\d+)/.exec(read(`apps/${a}/android/app/build.gradle`)) || [])[1]);
  t.check(vc >= 2, `${a}: the build that carries Firebase is versionCode 2 or later (${vc}), so the page can tell it from an older install`);
  const page = read(`${a}.html`);
  const inst = extractFunction(page, 'pushInstalled', `${a}.html`);
  t.check(/getInfo\(\)/.test(inst) && /Number\(i\.build\) >= 2/.test(inst), `${a}: the page asks the install before it asks for a token`);
}

for (const a of APPS.filter((x) => x !== 'store')) {
  const src = read(`${a}.html`);
  const fn = extractFunction(src, 'phonePush', `${a}.html`);
  t.check(/isNativePlatform\(\)/.test(fn) && /phonePush\.on/.test(fn), `${a}: signs up inside the installed app, once`);
  t.check(/from\('push_subscriptions'\)\.upsert\(\{ shop_id: S\.shopId, staff_id: st \? st\.id : null, user_id: S\.user\.id, fcm_token: t\.value \}, \{ onConflict: 'fcm_token' \}\)/.test(fn),
    `${a}: the phone is this login's, with its staff row when it has one`);
  t.check(/perm\.receive !== 'denied'/.test(fn), `${a}: never asks again once the person said no`);
  t.check(fn.indexOf('pushInstalled()') > -1 && fn.indexOf('pushInstalled()') < fn.indexOf('P.checkPermissions()'),
    `${a}: an older install, with no Firebase, never asks for a token (it would close the app)`);
  t.check(/if \(error\) \{ window\.owPushError = [^;]+; [^}]+\} else \{ window\.owPushReady = true;/.test(fn),
    `${a}: says the phone is signed up only once the save landed (owPushReady), and keeps why not (owPushError)`);
  t.check(/addListener\('registrationError'/.test(fn), `${a}: a phone that gets no token says so`);
  t.check(/function start\(\)\{\n  S\.started = true;\n  phonePush\(\);/.test(src), `${a}: asked as the app starts`);
}
t.check(/function enablePush\(\)/.test(read('store.html')) && /push_subscriptions/.test(read('store.html')), 'store keeps its own alerts switch');
{
  const ep = extractFunction(read('store.html'), 'enablePush', 'store.html');
  t.check(ep.indexOf('pushInstalled()') > -1 && ep.indexOf('pushInstalled()') < ep.indexOf('P.register()'), 'and its switch asks the install first, so an older Store app is told to update rather than closing');
}

{
  // The Manager's "Push to your phone" says why, when the phone is not signed up.
  const m = read('manager.html');
  const why = extractFunction(m, 'pushWhy', 'manager.html');
  t.check(/owPushError/.test(why) && /Google Play services/.test(why) && /phone’s settings/.test(why), 'the Manager card reads why push is not on');
  t.check(/\$\{pushOn\(\) \? 'On' : pushWhy\(\) \? 'Not on' : 'Coming with push'\}/.test(m), 'and says Not on, with the reason, instead of Coming with push');
  t.check(/registrationError', e => \{ window\.owPushError = [^;]+; render\(\); \}/.test(m), 'an error redraws the screen it shows on');
}

{
  // A tap opens what the push is about: push-send puts { kind, ...ref } in
  // the data, and each app's pushOpen sends that to its own screen.
  const KINDS = {
    sales: ['price.decided', 'price.changed', 'credit.decided', 'invoice.ask.decided', 'payment.ask.decided', 'request.listed', 'item.switch'],
    manager: ['price.waits', 'credit.hold', 'pick.short', 'agent.change', 'order.delivered', 'trip.difference', 'trip.yard_note', 'stock.report', 'invoice.ask', 'invoice.held'],
    buyer: ['order.buying', 'trip.cash.ready', 'restock.held', 'trip.sent', 'trip.taken', 'trip.cancelled'],
    accounts: ['trip.cash', 'trip.cash.ask', 'bill.due', 'payment.ask', 'bill.paper'],
    sourcing: ['sourcing.request', 'sourcing.dropped', 'prices.confirm', 'sourcing.fix'],
    store: ['trip.back', 'stock.report.decided', 'stock_count', 'trip.sent', 'trip.taken', 'trip.cancelled'],
  };
  for (const [a, kinds] of Object.entries(KINDS)) {
    const src = read(`${a}.html`);
    const open = extractFunction(src, 'pushOpen', `${a}.html`);
    t.check(/try \{/.test(open) && /catch \(/.test(open), `${a}: pushOpen never throws`);
    const missing = kinds.filter((k) => !open.includes(`'${k}'`));
    t.check(!missing.length, `${a}: a tap on each of its pushes opens its screen (${missing.join(', ') || 'all routed'})`);
    t.check(/pushNotificationActionPerformed', a => \{ const d = \(a && a\.notification && a\.notification\.data\) \|\| \{\};/.test(src) && /pushOpen\(d\);/.test(src),
      `${a}: the tap listener hands the push's data to pushOpen`);
  }
  t.check(/A tap never takes an order/.test(extractFunction(read('store.html'), 'pushOpen', 'store.html')) && /orderIsMine\(q\)/.test(extractFunction(read('store.html'), 'pushOpen', 'store.html')),
    'store: a tap opens an order to pack only when it is already this person\'s');
}

{
  // Notifications on this phone: one row on You, beside Sounds & buzz.
  for (const [a, word] of [['sales', 'Sales'], ['buyer', 'Buyer'], ['accounts', 'Accounts'], ['sourcing', 'Sourcing']]) {
    const src = read(`${a}.html`);
    const st = extractFunction(src, 'pushState', `${a}.html`);
    t.check(["'On'", "'Not on'", "'Checking'", 'pushWhy()', 'pushNative()'].every((b) => st.includes(b)), `${a}: the row says On, Checking, or Not on with why`);
    t.check(extractFunction(src, 'pushWhy', `${a}.html`).includes(`install the new ${word} app`), `${a}: an older install is told to install the new ${word} app`);
    const at = src.search(/>Notifications</);
    t.check(at > 0 && /pushState\(\)|pushSub\(\)/.test(src.slice(at - 6000, at + 6000)), `${a}: the Notifications row is drawn from pushState`);
  }
}

{
  // What the Buyer passes on is read by the app it is for (0125, pushed by 0131 and 0134).
  for (const [a, kind] of [['accounts', 'trip_cash'], ['accounts', 'paper_bill'], ['sourcing', 'sourcing_fix'], ['sales', 'item_switch'], ['manager', 'yard_note']]) {
    const src = read(`${a}.html`);
    t.check(/from\('buyer_handoffs'\)\.select|selectAll\('buyer_handoffs'/.test(src) && src.includes(`'${kind}'`), `${a}: loads the Buyer's ${kind} hand-offs`);
    t.check(/from\('buyer_handoffs'\)\.update\(\{ status: 'done' \}\)\.eq\('shop_id', S\.shopId\)\.eq\('id', [\w.]+\)\.select\('id'\)/.test(src) && /!(r\.)?data\.length\) throw/.test(src),
      `${a}: and closes them (status done), counting it closed only when the row came back -- a switched-off task is no error, just no row`);
  }
  const sales = read('sales.html');
  // The refresh reads the orders that can still change (liveQuoteFilter) and merges them; the switches come with it.
  t.check(/async function refreshQuotes\(\)\{\n  try \{ const \[rows, sw\] = await Promise\.all\(\[selectAll\('saved_quotes', 'id', liveQuoteFilter\), switchesQuery\(\)\]\); mergeQuotes\(rows\);/.test(sales), 'sales: a switch made while the app is open shows on the next live refresh');
  {
    const acc = read('accounts.html');
    t.check(/tripId: h\.p\.tripId \|\| null/.test(acc) && /latestTripLines\(s\.id, a\.tripId\)/.test(acc) && /tripId == null \|\| String\(x\.id\) === String\(tripId\)/.test(acc),
      'accounts: a paper bill fills from its own trip, never a newer one to the same supplier');
  }
  t.check(!/priceWas|priceNow|costWas/.test(sales), 'sales: a switch\'s buying costs are never read into the Sales app');
}

process.exit(t.done() ? 1 : 0);
