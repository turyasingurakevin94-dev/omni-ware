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
const APPS = ['sales', 'manager', 'buyer', 'store', 'accounts', 'sourcing'];

for (const a of APPS) {
  const appId = JSON.parse(read(`apps/${a}/capacitor.config.json`)).appId;
  const gsPath = path.join(__dirname, '..', 'apps', a, 'android', 'app', 'google-services.json');
  let gs = null;
  try { gs = JSON.parse(fs.readFileSync(gsPath, 'utf8')); } catch (_e) {}
  const pkgs = gs ? gs.client.map((c) => c.client_info.android_client_info.package_name) : [];
  t.check(pkgs.includes(appId), `${a}: google-services.json names ${appId}`);
  t.check(/apply plugin: 'com\.google\.gms\.google-services'/.test(read(`apps/${a}/android/app/build.gradle`)), `${a}: the build applies it`);
  t.check(/@capacitor\/push-notifications/.test(read(`apps/${a}/package.json`)), `${a}: the push plugin is in the app`);
}

for (const a of APPS.filter((x) => x !== 'store')) {
  const src = read(`${a}.html`);
  const fn = extractFunction(src, 'phonePush', `${a}.html`);
  t.check(/isNativePlatform\(\)/.test(fn) && /phonePush\.on/.test(fn), `${a}: signs up inside the installed app, once`);
  t.check(/from\('push_subscriptions'\)\.upsert\(\{ shop_id: S\.shopId, staff_id: st \? st\.id : null, user_id: S\.user\.id, fcm_token: t\.value \}, \{ onConflict: 'fcm_token' \}\)/.test(fn),
    `${a}: the phone is this login's, with its staff row when it has one`);
  t.check(/perm\.receive !== 'denied'/.test(fn), `${a}: never asks again once the person said no`);
  t.check(/function start\(\)\{\n  S\.started = true;\n  phonePush\(\);/.test(src), `${a}: asked as the app starts`);
}
t.check(/function enablePush\(\)/.test(read('store.html')) && /push_subscriptions/.test(read('store.html')), 'store keeps its own alerts switch');

process.exit(t.done() ? 1 : 0);
