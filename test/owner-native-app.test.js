#!/usr/bin/env node
'use strict';
/*
 * The Owner app for Android (apps/owner).
 *
 * The app is owner.html inside the same native shell the other role apps
 * use. Its build swaps the page's CDN links for copies it carries, and the
 * native layer in the page -- Back, the strip behind the clock, the bars'
 * size, fetching a newer owner.html -- does nothing in a browser.
 *
 * Pushes wait for the shop's Firebase project to have this app: the page
 * does not ask for them (OWNER_PUSH_READY) until the shell carries its
 * google-services.json, and the two must change together.
 *
 * Run: node test/owner-native-app.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('owner native app');
const transform = require(path.join(__dirname, '..', 'apps', 'owner', 'src', 'transform.js'));
const src = read('owner.html');

/* ---------- 1. the page the app ships ---------- */
{
  const html = transform(src);
  t.check(html.includes('<link rel="stylesheet" href="fonts/fonts.css">') && !/fonts\.googleapis\.com/.test(html), 'the fonts come from inside the app, not Google');
  t.check(html.includes('<script src="vendor/supabase.js"></script>') && !/cdn\.jsdelivr\.net/.test(html), 'and so does the Supabase client');
  t.check(/<head>\n<script src="transform\.js"><\/script>\n<meta/.test(html), 'the live-update swaps load first');
  t.check(!/rel="manifest"/.test(html), 'the browser install manifest is left out');
  t.check(transform(html) === html, 'a page that has been through it once is unchanged by a second pass');
  const build = read('apps/owner/scripts/build-www.js');
  t.check(/path\.join\(ROOT, 'owner\.html'\)/.test(build) && /The phone app's native layer/.test(build), 'the build reads owner.html and fails if the native layer is missing');
}

/* ---------- 2. the native layer: in the page, and out of the browser's way ---------- */
{
  const at = src.indexOf("The phone app's native layer");
  t.check(at > 0 && at < src.indexOf('</head>') && at < src.indexOf('<script src="https://cdn.jsdelivr.net'), 'the native layer is in <head>, ahead of everything else the page runs');
  const native = src.slice(at, src.indexOf('</script>', at));
  t.check(/if\(!C \|\| typeof C\.isNativePlatform !== 'function' \|\| !C\.isNativePlatform\(\)\) return;/.test(native), 'and does nothing in a browser');
  t.check(/window\.bxBack\(\)/.test(native) && /window\.bxBack = function\(\)/.test(src), 'Back closes a sheet, then a page, then the tab, before it leaves the app');
  t.check(/var SOURCE = 'https:\/\/omni-ware\.vercel\.app\/owner\.html';/.test(native) && /var KEY = 'ow-owner-bundle';/.test(native),
    'it fetches newer copies of owner.html, kept apart from the other apps\'');
  t.check(!/accounts\.html|ow-accounts/.test(native), 'and nothing in it still points at the Accounts app it was carried from');
  t.check(/App\.addListener\('pause'/.test(native) && /setServerBasePath/.test(native), 'a newer page is switched to only when the app goes to the background');
  t.check(/html\.length < 100000 \|\| html\.indexOf\('<\/html>'\) === -1/.test(native), 'and a cut-off download is never switched to');
  t.check(src.length > 100000, 'the page itself is big enough to pass that check');
  t.check(/--safe-t:var\(--safe-area-inset-top\); --safe-b:var\(--safe-area-inset-bottom\);/.test(src), 'the bars\' size it measures is the one the page pads by');
}

/* ---------- 3. the shell ---------- */
{
  const cfg = JSON.parse(read('apps/owner/capacitor.config.json'));
  t.check(cfg.appId === 'com.omniware.owner' && cfg.appName === 'Omni-Ware Owner' && cfg.webDir === 'www', 'its own app id and name, separate from the team\'s apps');
  t.check(cfg.plugins && cfg.plugins.SystemBars && cfg.plugins.SystemBars.insetsHandling === 'css', 'Android measures the bars into --safe-area-inset-*');
  const gradle = read('apps/owner/android/app/build.gradle');
  t.check(/namespace = "com\.omniware\.owner"/.test(gradle) && /applicationId "com\.omniware\.owner"/.test(gradle), 'Android installs it beside the other apps, not over one');
  t.check(/package com\.omniware\.owner;/.test(read('apps/owner/android/app/src/main/java/com/omniware/owner/MainActivity.java')), 'its activity lives in its own package');
  t.check(/<string name="app_name">Omni-Ware Owner<\/string>/.test(read('apps/owner/android/app/src/main/res/values/strings.xml')), 'and is called Omni-Ware Owner on the phone');
  const wf = read('.github/workflows/build-owner-app.yml');
  t.check(/- 'owner\.html'/.test(wf) && /- 'apps\/owner\/\*\*'/.test(wf) && /workflow_dispatch/.test(wf), 'every change to the page or the shell is built, and it can be built by hand');
  t.check(/name: omniware-owner-debug-apk/.test(wf) && /apps\/owner\/android\/app\/build\/outputs\/apk\/debug\/app-debug\.apk/.test(wf), 'and hands back the APK under the run\'s Artifacts');
  const man = JSON.parse(read('manifest-owner.json'));
  t.check(man.start_url === '/owner.html' && man.scope === '/owner.html' && /<link rel="manifest" href="\/manifest-owner\.json">/.test(src), 'a browser installs the page as its own app');
}

/* ---------- 4. pushes: not asked for until Firebase knows this app ---------- */
{
  const hasFile = fs.existsSync(path.join(__dirname, '..', 'apps', 'owner', 'android', 'app', 'google-services.json'));
  const m = /const OWNER_PUSH_READY = (true|false);/.exec(src);
  t.check(!!m, 'the page says whether it may ask for pushes');
  t.check(m && (m[1] === 'true') === hasFile, 'and says yes exactly when the shell carries its google-services.json (apps/owner/README.md)');
  t.check(/if \(!OWNER_PUSH_READY \|\| !P \|\| phonePush\.on/.test(src), 'without it, the phone is never asked to register');
  t.check(/function start\(\)\{\n  S\.started = true;\n  phonePush\(\);/.test(src), 'with it, pushes are asked for first thing, as in every app');
  t.check(/push_subscriptions'\)\.upsert\(\{ shop_id: S\.shopId, staff_id: st \? st\.id : null, user_id: S\.user\.id, fcm_token: t\.value \}, \{ onConflict: 'fcm_token' \}\)/.test(src),
    'the phone is the owner\'s login, with no staff row needed (0120)');
  t.check(/d\.kind === 'owner\.digest'[^]*S\.view = 'log'/.test(src), 'tapping the digest opens the log at its day');
}

process.exit(t.done() ? 1 : 0);
