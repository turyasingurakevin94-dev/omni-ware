#!/usr/bin/env node
'use strict';
/*
 * The agent app for Android and iPhone (apps/agent).
 *
 * The app is agent.html inside a native shell. Its build swaps the page's
 * CDN links for copies it carries, and puts native.js first in <head>. If
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
  t.check(/<head>\n<script src="transform\.js"><\/script>\n<script src="native\.js"><\/script>/.test(html), 'native.js is the first script in the page');
  t.check(!/rel="manifest"/.test(html), 'the browser install manifest is left out');
  t.check(transform(html) === html, 'a page that has been through it once is unchanged by a second pass');
}

/* ---------- 2. the native layer parses and stays out of the browser ---------- */
{
  for (const f of ['native.js', 'transform.js']) {
    let err = null;
    try { new Function(read(`apps/agent/src/${f}`)); } catch (e) { err = e; }
    t.check(!err, err ? `${f} does not parse -- ${err.message}` : `${f} parses`);
  }
  const native = read('apps/agent/src/native.js');
  t.check(/if\(!C \|\| typeof C\.isNativePlatform !== 'function' \|\| !C\.isNativePlatform\(\)\) return;/.test(native), 'native.js does nothing in a browser');
  t.check(/App\.addListener\('pause'/.test(native) && /setServerBasePath/.test(native), 'a newer page is switched to only when the app goes to the background');
  t.check(/html\.length < 100000 \|\| html\.indexOf\('<\/html>'\) === -1/.test(native), 'and a cut-off download is never switched to');
}

/* ---------- 3. the shell ---------- */
{
  const cfg = JSON.parse(read('apps/agent/capacitor.config.json'));
  t.check(cfg.appId === 'com.omniware.agent' && cfg.webDir === 'www', 'its own app id, separate from the worker app');
  t.check(cfg.plugins && cfg.plugins.SystemBars && cfg.plugins.SystemBars.insetsHandling === 'css', 'Android measures the status bar into --safe-area-inset-*');
  t.check(/--safe-t: var\(--safe-area-inset-top, env\(safe-area-inset-top, 0px\)\);/.test(src), 'and the page reads it, falling back to env() on iPhone and in the browser');
  t.check(/\.ax-hero\{[^}]*padding:calc\(18px \+ var\(--safe-t\)\)/.test(src), 'so the Today header runs under the clock rather than behind it');
  t.check(/redirectTo: window\.Capacitor \? 'https:\/\/omni-ware\.vercel\.app\/agent\.html'/.test(src), 'a password reset link opens the web page, which a phone can reach');
}

process.exit(t.done() ? 1 : 0);
