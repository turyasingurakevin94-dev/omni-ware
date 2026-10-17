#!/usr/bin/env node
'use strict';
/*
 * The Buyer app for Android (apps/buyer).
 *
 * The app is buyer.html inside the same native shell the sales app uses.
 * Its build swaps the page's CDN links for copies it carries, and the
 * native layer in the page -- Back, the strip behind the clock, the bars'
 * size, fetching a newer buyer.html -- does nothing in a browser.
 *
 * Run: node test/buyer-native-app.test.js   (or: npm test)
 */
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('buyer native app');
const transform = require(path.join(__dirname, '..', 'apps', 'buyer', 'src', 'transform.js'));
const src = read('buyer.html');

/* ---------- 1. the page the app ships ---------- */
{
  const html = transform(src);
  t.check(html.includes('<link rel="stylesheet" href="fonts/fonts.css">') && !/fonts\.googleapis\.com/.test(html), 'the fonts come from inside the app, not Google');
  t.check(html.includes('<script src="vendor/supabase.js"></script>') && !/cdn\.jsdelivr\.net/.test(html), 'and so does the Supabase client');
  t.check(/<head>\n<script src="transform\.js"><\/script>\n<meta/.test(html), 'the live-update swaps load first');
  t.check(!/rel="manifest"/.test(html), 'the browser install manifest is left out');
  t.check(transform(html) === html, 'a page that has been through it once is unchanged by a second pass');
  const build = read('apps/buyer/scripts/build-www.js');
  t.check(/path\.join\(ROOT, 'buyer\.html'\)/.test(build) && /"The phone app's native layer"|'The phone app\\'s native layer'|The phone app's native layer/.test(build), 'the build reads buyer.html and fails if the native layer is missing');
}

/* ---------- 2. the native layer: in the page, and out of the browser's way ---------- */
{
  const at = src.indexOf("The phone app's native layer");
  t.check(at > 0 && at < src.indexOf('</head>') && at < src.indexOf('<script src="https://cdn.jsdelivr.net'), 'the native layer is in <head>, ahead of everything else the page runs');
  const native = src.slice(at, src.indexOf('</script>', at));
  t.check(/if\(!C \|\| typeof C\.isNativePlatform !== 'function' \|\| !C\.isNativePlatform\(\)\) return;/.test(native), 'and does nothing in a browser');
  t.check(/window\.bxBack\(\)/.test(native) && /window\.bxBack = function\(\)/.test(src), 'Back closes a sheet, then a page, then the tab, before it leaves the app');
  t.check(/var SOURCE = 'https:\/\/omni-ware\.vercel\.app\/buyer\.html';/.test(native) && /var KEY = 'ow-buyer-bundle';/.test(native),
    'it fetches newer copies of buyer.html, kept apart from the sales app\'s');
  t.check(/App\.addListener\('pause'/.test(native) && /setServerBasePath/.test(native), 'a newer page is switched to only when the app goes to the background');
  t.check(/html\.length < 100000 \|\| html\.indexOf\('<\/html>'\) === -1/.test(native), 'and a cut-off download is never switched to');
  t.check(src.length > 100000, 'the page itself is big enough to pass that check');
  t.check(/#bx_pages \.bx-page:last-child/.test(native) && /\.bx-auth/.test(native) && /\.bx-scrim/.test(native) && !/sx_pages|\.sx-auth|\.sx-scrim/.test(native),
    'the strip behind the clock reads this page\'s own screens, not the sales app\'s');
  t.check(/--safe-t:var\(--safe-area-inset-top\); --safe-b:var\(--safe-area-inset-bottom\);/.test(src), 'and the bars\' size it measures is the one the page pads by');
  t.check(/kind === 'warn' \? H\.notification\(\{ type: 'WARNING' \}\)/.test(native), 'a problem or a short line buzzes as a warning, not a tap');
}

/* ---------- 3. the shell ---------- */
{
  const cfg = JSON.parse(read('apps/buyer/capacitor.config.json'));
  t.check(cfg.appId === 'com.omniware.buyer' && cfg.appName === 'Omni-Ware Buyer' && cfg.webDir === 'www', 'its own app id and name, separate from the sales app');
  t.check(cfg.plugins && cfg.plugins.SystemBars && cfg.plugins.SystemBars.insetsHandling === 'css' && cfg.plugins.SystemBars.initialViewportFitValueHint === 'cover',
    'Android measures the bars into --safe-area-inset-* and draws edge to edge');
  const gradle = read('apps/buyer/android/app/build.gradle');
  t.check(/namespace = "com\.omniware\.buyer"/.test(gradle) && /applicationId "com\.omniware\.buyer"/.test(gradle), 'Android installs it beside the sales app, not over it');
  t.check(/package com\.omniware\.buyer;/.test(read('apps/buyer/android/app/src/main/java/com/omniware/buyer/MainActivity.java')), 'its activity lives in its own package');
  t.check(/<string name="app_name">Omni-Ware Buyer<\/string>/.test(read('apps/buyer/android/app/src/main/res/values/strings.xml')), 'and is called Omni-Ware Buyer on the phone');
  const wf = read('.github/workflows/build-buyer-app.yml');
  t.check(/- 'buyer\.html'/.test(wf) && /- 'apps\/buyer\/\*\*'/.test(wf) && /workflow_dispatch/.test(wf), 'every change to the page or the shell is built, and it can be built by hand');
  t.check(/name: omniware-buyer-debug-apk/.test(wf) && /apps\/buyer\/android\/app\/build\/outputs\/apk\/debug\/app-debug\.apk/.test(wf), 'and hands back the APK under the run\'s Artifacts');
}

process.exit(t.done() ? 1 : 0);
