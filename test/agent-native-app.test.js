#!/usr/bin/env node
'use strict';
/*
 * The agent app for Android and iPhone (apps/agent).
 *
 * The app is agent.html inside a native shell. Its build swaps the page's
 * CDN links for copies it carries. The native layer (back button, status
 * bar, live updates) is inside agent.html itself, so a fix to it reaches
 * installed phones like any other change to the page. If
 * the top of agent.html changes shape those swaps miss -- the app build
 * fails, and an installed app that fetches the new page quietly goes back
 * to the CDN. Checked here, against the agent.html in this commit, so the
 * break shows up in the suite and not on someone's phone.
 *
 * Run: node test/agent-native-app.test.js   (or: npm test)
 */
const path = require('path');
const { read, createReporter } = require('./_extract');

const t = createReporter('agent native app');
const transform = require(path.join(__dirname, '..', 'apps', 'agent', 'src', 'transform.js'));
const src = read('agent.html');

/* ---------- 1. the page the app ships ---------- */
{
  const html = transform(src);
  t.check(html.includes('<link rel="stylesheet" href="fonts/fonts.css">') && !/fonts\.googleapis\.com/.test(html), 'the fonts come from inside the app, not Google');
  t.check(html.includes('<script src="vendor/supabase.js"></script>') && !/cdn\.jsdelivr\.net/.test(html), 'and so does the Supabase client');
  t.check(/<head>\n<script src="transform\.js"><\/script>\n<meta/.test(html) && !/<script src="native\.js">/.test(html), 'the live-update swaps load first, and no separate native.js -- the layer is in the page');
  t.check(!/rel="manifest"/.test(html), 'the browser install manifest is left out');
  t.check(transform(html) === html, 'a page that has been through it once is unchanged by a second pass');
}

/* ---------- 2. the native layer: in the page, and out of the browser's way ---------- */
{
  let err = null;
  try { new Function(read('apps/agent/src/transform.js')); } catch (e) { err = e; }
  t.check(!err, err ? `transform.js does not parse -- ${err.message}` : 'transform.js parses');
  const at = src.indexOf("The phone app's native layer");
  t.check(at > 0 && at < src.indexOf('</head>') && at < src.indexOf('<script src="https://cdn.jsdelivr.net'), 'the native layer is in <head>, ahead of everything else the page runs');
  const native = src.slice(at, src.indexOf('</script>', at));
  t.check(/if\(!C \|\| typeof C\.isNativePlatform !== 'function' \|\| !C\.isNativePlatform\(\)\) return;/.test(native), 'and does nothing in a browser');
  t.check(/var legacy = !!document\.querySelector\('script\[src="native\.js"\]'\);/.test(native)
    && /if\(App && !legacy\) App\.addListener\('backButton', back\);/.test(native) && /if\(legacy \|\| !\(WebView/.test(native),
    'on the first installs, whose own native.js is still running, it adds only what is new -- back never fires twice');
  t.check(/var measured = root\.style\.getPropertyValue\('--safe-area-inset-top'\) !== '';/.test(native)
    && /root\.style\.setProperty\('--safe-area-inset-top', \(last\.top \|\| 32\) \+ 'px'\);/.test(native),
    'a page Android has not measured takes the last good status-bar height instead of zero');
  t.check(/App\.addListener\('pause'/.test(native) && /setServerBasePath/.test(native), 'a newer page is switched to only when the app goes to the background');
  t.check(/html\.length < 100000 \|\| html\.indexOf\('<\/html>'\) === -1/.test(native), 'and a cut-off download is never switched to');
}

/* ---------- 3. the shell ---------- */
{
  const cfg = JSON.parse(read('apps/agent/capacitor.config.json'));
  t.check(cfg.appId === 'com.omniware.agent' && cfg.webDir === 'www', 'its own app id, separate from the worker app');
  t.check(cfg.plugins && cfg.plugins.SystemBars && cfg.plugins.SystemBars.insetsHandling === 'css', 'Android measures the status bar into --safe-area-inset-*');
  t.check(cfg.plugins.SystemBars.initialViewportFitValueHint === 'cover', 'and draws edge to edge from the first frame, not only once the page has said so');
  t.check(/--safe-t: var\(--safe-area-inset-top, env\(safe-area-inset-top, 0px\)\);/.test(src), 'and the page reads it, falling back to env() on iPhone and in the browser');
  t.check(/\.ax-hero\{[^}]*padding:calc\(18px \+ var\(--safe-t\)\)/.test(src), 'so the Today header runs under the clock rather than behind it');
  t.check(/redirectTo: window\.Capacitor \? 'https:\/\/omni-ware\.vercel\.app\/agent\.html'/.test(src), 'a password reset link opens the web page, which a phone can reach');
}

process.exit(t.done() ? 1 : 0);
