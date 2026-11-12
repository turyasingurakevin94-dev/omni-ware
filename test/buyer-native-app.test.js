#!/usr/bin/env node
'use strict';
/*
 * The Buyer app for Android (apps/buyer): the new Buyer app (this test reads the built buyer.html,
 * src/apps/buyer, switched 2026-11-11) inside its native shell.
 *
 *   1. The page the app ships: the phone's swaps (apps/buyer/src/transform.js) take the CDN links out,
 *      and apps/buyer/scripts/build-www.js packages the built page, never the old one.
 *   2. The native layer: the shared one (src/native/start.ts), wired to the Buyer's own page, key and
 *      build id (src/apps/buyer/shell/native.ts), with the old app's key so a phone it updated settles.
 *   3. The pushes: the phone is signed up on sign-in, and a tapped push opens a drawn screen.
 *   4. The shell: its own app id, version over the old app's, the workflow builds on src/.
 *
 * Run: node test/buyer-native-app.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, read, createReporter } = require('./_extract');

const t = createReporter('buyer native app');
const transform = require(path.join(ROOT, 'apps', 'buyer', 'src', 'transform.js'));
const src = read('buyer.html');
const U = require(path.join(ROOT, 'src/native/update.ts')).updater({ role: 'buyer', source: 'https://omni-ware.vercel.app/buyer.html', key: 'ow-buyer-bundle', build: 'owBuyerBuild' });

/* ---------- 1. the page the app ships ---------- */
{
  t.check(src.slice(0, 300).includes('GENERATED from src/apps/buyer'), 'buyer.html is the page built from src/apps/buyer');
  const html = transform(src);
  t.check(html.includes('<link rel="stylesheet" href="fonts/fonts.css">') && !/fonts\.googleapis\.com/.test(html), 'the fonts come from inside the app, not Google');
  t.check(html.includes('<script src="vendor/supabase.js"></script>') && !/cdn\.jsdelivr\.net/.test(html), 'and so does the Supabase client');
  t.check(/<head>\n<script src="transform\.js"><\/script>\n<meta/.test(html), 'the live-update swaps load first');
  t.check(!/rel="manifest"/.test(html), 'the browser install manifest is left out');
  t.check(transform(html) === html, 'a page that has been through it once is unchanged by a second pass');
  const build = read('apps/buyer/scripts/build-www.js');
  t.check(/const PAGES = ROOT;/.test(build) && /'buyer\.html'/.test(build) && /GENERATED from src\//.test(build) && /data-ow-native/.test(build),
    'the build packages the built buyer.html and fails without its native layer');
  t.check(!!U.builtPage(src), 'the built page passes the live update\'s safety rule (its build id and file list)');
  t.check(U.builtPage(read('old/buyer.html')) === null, 'and the old page does not: an installed new app never turns back into the old one');
}

/* ---------- 2. the native layer ---------- */
{
  const w = read('src/apps/buyer/shell/native.ts'), n = read('src/native/start.ts');
  t.check(/from '\.\.\/\.\.\/\.\.\/native\/start\.ts'/.test(w), 'the Buyer uses the shared layer, not a copy');
  t.check(/source: 'https:\/\/omni-ware\.vercel\.app\/buyer\.html'/.test(w) && /key: 'ow-buyer-bundle'/.test(w) && /build: 'owBuyerBuild'/.test(w),
    'on its own page, the old app\'s key and its own build id (as this test does)');
  t.check(/sheet\.isOpen/.test(w) && /nav\.back\(\)/.test(w) && /nav\.home\(\)/.test(w), 'Back reads the Buyer\'s own sheet and stack');
  t.check(/if \(!C \|\| h\.isDemo\) return;/.test(n), 'the layer does nothing in a browser or in the demo');
  t.check(src.includes('window.owBuyerBuild="') && src.includes('data-ow-native'), 'the built page carries its build id and the layer');
  t.check(/startNative\(\);/.test(read('src/apps/buyer/main.tsx')), 'main.tsx starts it');
}

/* ---------- 3. the pushes ---------- */
{
  const w = read('src/apps/buyer/shell/native.ts');
  t.check(/pushNotificationActionPerformed/.test(w) && /registerPush\(\)/.test(w), 'a tapped push opens its screen; signed in, the phone is signed up');
  t.check(/pushOn\(sb\(\), me\(\)\)|pushOnShared\(sb\(\), me\(\)\)/.test(read('src/core/buyer/supabase/index.ts')), 'the sign-up is the shared one (src/core/supabase/push.ts)');
  for (const [kind, id] of [['supplier.answered', "'replies'"], ['trip.cash.ready', "'trip'"], ['order.buying', "'orders/order'"]]) {
    t.check(w.includes(`'${kind}'`) || (kind.startsWith('trip.') && /\^trip\\\./.test(w)), `${kind} has a screen`);
    t.check(w.includes(id), `${kind} opens ${id}`);
  }
}

/* ---------- 4. the shell ---------- */
{
  const cfg = JSON.parse(read('apps/buyer/capacitor.config.json'));
  t.check(cfg.appId === 'com.omniware.buyer' && cfg.appName === 'Omni-Ware Buyer' && cfg.webDir === 'www', 'its own app id and name, separate from the sales app');
  t.check(cfg.plugins && cfg.plugins.SystemBars && cfg.plugins.SystemBars.insetsHandling === 'css', 'Android measures the bars into --safe-area-inset-*');
  const gradle = read('apps/buyer/android/app/build.gradle');
  t.check(/applicationId "com\.omniware\.buyer"/.test(gradle) && /versionCode 3/.test(gradle), 'it installs over the old Buyer app (a higher version)');
  const wf = read('.github/workflows/build-buyer-app.yml');
  t.check(/'src\/\*\*'/.test(wf) && /'buyer\.html'/.test(wf) && /npm run build/.test(wf) && /assembleDebug/.test(wf), 'the workflow builds an APK whenever the page or src/ changes');
}

process.exit(t.done() ? 1 : 0);
