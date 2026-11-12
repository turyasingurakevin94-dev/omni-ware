#!/usr/bin/env node
'use strict';
/*
 * The Store app for Android (apps/store): the new Store app (this test reads the built store.html,
 * src/apps/store, switched 2026-11-12) inside its native shell.
 *
 *   1. The page the app ships: the phone's swaps (apps/store/src/transform.js) take the CDN links out,
 *      and apps/store/scripts/build-www.js packages the built page and its four area files, never the old one.
 *   2. The new native layer: the shared one (src/native/start.ts), wired to the Store's own page, key and
 *      build id (src/apps/store/shell/native.ts), with the old app's key so a phone it updated settles.
 *   3. The pushes: the phone is signed up on sign-in, and a tapped push opens its screen by the one map.
 *   4. The old page's own layer (old/store.html, until 2026-12-12): in <head>, out of the browser's way.
 *   5. The shell: its own app id, version over the old app's, the workflow builds on src/.
 *
 * Run: node test/store-native-app.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, read, createReporter } = require('./_extract');

const t = createReporter('store native app');
const transform = require(path.join(__dirname, '..', 'apps', 'store', 'src', 'transform.js'));
const src = read('store.html');
const old = read('old/store.html');
const U = require(path.join(ROOT, 'src/native/update.ts')).updater({ role: 'store', source: 'https://omni-ware.vercel.app/store.html', key: 'ow-store-bundle', build: 'owStoreBuild' });

/* ---------- 1. the page the app ships ---------- */
{
  t.check(src.slice(0, 300).includes('GENERATED from src/apps/store'), 'store.html is the page built from src/apps/store');
  const html = transform(src);
  t.check(html.includes('<link rel="stylesheet" href="fonts/fonts.css">') && !/fonts\.googleapis\.com/.test(html), 'the fonts come from inside the app, not Google');
  t.check(html.includes('<script src="vendor/supabase.js"></script>') && !/cdn\.jsdelivr\.net/.test(html), 'and so does the Supabase client');
  t.check(/<head>\n<script src="transform\.js"><\/script>\n<meta/.test(html), 'the live-update swaps load first');
  t.check(!/rel="manifest"/.test(html), 'the browser install manifest is left out');
  t.check(transform(html) === html, 'a page that has been through it once is unchanged by a second pass');
  const build = read('apps/store/scripts/build-www.js');
  t.check(/const PAGES = ROOT;/.test(build) && /'store\.html'/.test(build) && /GENERATED from src\//.test(build) && /data-ow-native/.test(build),
    'the build packages the built store.html and fails without its native layer');
  t.check(/store-\$\{a\}\.js/.test(build) && /\['pack', 'in', 'shelf', 'out'\]/.test(build) && /is not of the page's build/.test(build), 'and its four area files, each of the page\'s build');
  const files = ((src.match(/<meta name="ow-files" content="([^"]*)">/) || [])[1] || '').split(/\s+/);
  t.check(['store-pack.js', 'store-in.js', 'store-shelf.js', 'store-out.js'].every((f) => files.includes(f)), 'the page names its area files');
  t.check(!!U.builtPage(src), 'the built page passes the live update\'s safety rule (its build id and file list)');
  t.check(U.builtPage(old) === null, 'and the old page does not: an installed new app never turns back into the old one');
}

/* ---------- 2. the new native layer ---------- */
{
  const w = read('src/apps/store/shell/native.ts'), n = read('src/native/start.ts');
  t.check(/from '\.\.\/\.\.\/\.\.\/native\/start\.ts'/.test(w), 'the Store uses the shared layer, not a copy');
  t.check(/source: 'https:\/\/omni-ware\.vercel\.app\/store\.html'/.test(w) && /key: 'ow-store-bundle'/.test(w) && /build: 'owStoreBuild'/.test(w),
    'on its own page, the old app\'s key and its own build id (as this test does)');
  t.check(/sheet\.isOpen/.test(w) && /nav\.back\(\)/.test(w) && /nav\.home\(\)/.test(w), 'Back reads the Store\'s own sheet and stack');
  t.check(/if \(!C \|\| h\.isDemo\) return;/.test(n), 'the layer does nothing in a browser or in the demo');
  t.check(src.includes('window.owStoreBuild="') && src.includes('data-ow-native'), 'the built page carries its build id and the layer');
  t.check(/startNative\(\);/.test(read('src/apps/store/main.tsx')), 'main.tsx starts it');
}

/* ---------- 3. the pushes ---------- */
{
  const w = read('src/apps/store/shell/native.ts');
  t.check(/pushNotificationActionPerformed/.test(w) && /registerPush\(\)/.test(w), 'a tapped push opens its screen; signed in, the phone is signed up');
  t.check(/pushRoute\(String\(d\.kind \|\| ''\), d, books\.value, me\.value\)/.test(w) && /from '\.\/pushes\.ts'/.test(w), 'by the one push map (shell/pushes.ts), the one the demo\'s &push opens by');
  t.check(/pushOnShared\(sb\(\), me\(\)\)/.test(read('src/core/store/supabase/index.ts')), 'the sign-up is the shared one (src/core/supabase/push.ts)');
}

/* ---------- 4. the old page's own layer (old/store.html): in the page, and out of the browser's way ---------- */
{
  const at = old.indexOf("The phone app's native layer");
  t.check(at > 0 && at < old.indexOf('</head>') && at < old.indexOf('<script src="https://cdn.jsdelivr.net'), 'the native layer is in <head>, ahead of everything else the page runs');
  const native = old.slice(at, old.indexOf('</script>', at));
  t.check(/if\(!C \|\| typeof C\.isNativePlatform !== 'function' \|\| !C\.isNativePlatform\(\)\) return;/.test(native), 'and does nothing in a browser');
  t.check(/window\.stBack\(\)/.test(native) && /window\.stBack = function\(\)/.test(old), 'Back closes a sheet, then a page, then the tab, before it leaves the app');
  t.check(/var SOURCE = 'https:\/\/omni-ware\.vercel\.app\/store\.html';/.test(native) && /var KEY = 'ow-store-bundle';/.test(native),
    'it fetches newer copies of store.html, kept apart from the sales app\'s');
  t.check(/App\.addListener\('pause'/.test(native) && /setServerBasePath/.test(native), 'a newer page is switched to only when the app goes to the background');
  t.check(/html\.length < 100000 \|\| html\.indexOf\('<\/html>'\) === -1/.test(native), 'and a cut-off download is never switched to');
  t.check(old.length > 100000, 'the page itself is big enough to pass that check');
  t.check(/#st_pages \.st-page:last-child/.test(native) && /\.st-auth/.test(native) && /\.st-scrim/.test(native) && !/sx_pages|\.sx-auth|\.sx-scrim/.test(native),
    'the strip behind the clock reads this page\'s own screens, not the sales app\'s');
  t.check(/--safe-t:var\(--safe-area-inset-top\); --safe-b:var\(--safe-area-inset-bottom\);/.test(old), 'and the bars\' size it measures is the one the page pads by');
  t.check(/kind === 'warn' \? H\.notification\(\{ type: 'WARNING' \}\)/.test(native), 'a problem or a short line buzzes as a warning, not a tap');
}

/* ---------- 5. the shell ---------- */
{
  const cfg = JSON.parse(read('apps/store/capacitor.config.json'));
  t.check(cfg.appId === 'com.omniware.store' && cfg.appName === 'Omni-Ware Store' && cfg.webDir === 'www', 'its own app id and name, separate from the sales app');
  t.check(cfg.plugins && cfg.plugins.SystemBars && cfg.plugins.SystemBars.insetsHandling === 'css' && cfg.plugins.SystemBars.initialViewportFitValueHint === 'cover',
    'Android measures the bars into --safe-area-inset-* and draws edge to edge');
  const gradle = read('apps/store/android/app/build.gradle');
  t.check(/namespace = "com\.omniware\.store"/.test(gradle) && /applicationId "com\.omniware\.store"/.test(gradle), 'Android installs it beside the sales app, not over it');
  t.check(/versionCode 3/.test(gradle), 'it installs over the old Store app (a higher version)');
  t.check(/package com\.omniware\.store;/.test(read('apps/store/android/app/src/main/java/com/omniware/store/MainActivity.java')), 'its activity lives in its own package');
  t.check(/<string name="app_name">Omni-Ware Store<\/string>/.test(read('apps/store/android/app/src/main/res/values/strings.xml')), 'and is called Omni-Ware Store on the phone');
  const wf = read('.github/workflows/build-store-app.yml');
  t.check(/- 'store\.html'/.test(wf) && /- 'store-\*\.js'/.test(wf) && /- 'src\/\*\*'/.test(wf) && /- 'apps\/store\/\*\*'/.test(wf) && /workflow_dispatch/.test(wf), 'every change to the page, its files, src/ or the shell is built, and it can be built by hand');
  t.check(/name: omniware-store-debug-apk/.test(wf) && /apps\/store\/android\/app\/build\/outputs\/apk\/debug\/app-debug\.apk/.test(wf), 'and hands back the APK under the run\'s Artifacts');
}

process.exit(t.done() ? 1 : 0);
