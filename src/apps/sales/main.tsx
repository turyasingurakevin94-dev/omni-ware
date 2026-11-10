/*
 * The Sales app (docs/spec/04-screens-sales.md). Built by tools/build-app.js
 * into next/sales.html. ?demo opens the sample shop (src/core/demo/README.md);
 * ?demo&parts=main|main2 the parts gallery (src/ui/README.md).
 */
import { render } from 'preact';
import '../../ui/tokens.css';
import './app.css';
import { watchKeyboard } from '../../ui/keyboard.ts';
import { App } from './shell/App.tsx';
import { inPhoneApp, startNative } from './shell/native.ts';
import { listenForPushes } from './shell/open-push.ts';
import { startPresence } from './shell/presence.ts';
import { start } from './shell/store.ts';
import { preloadTabs } from './shell/tabs.ts';

// ?demo&parts=main|main2: the parts gallery (src/ui/gallery), its own file beside the page.
const parts = /[?&]demo(&|=|$)/.test(location.search) ? new URLSearchParams(location.search).get('parts') : null;
if (parts) {
  const el = document.createElement('script');
  el.src = location.pathname.replace(/[^/]*$/, '') + 'sales-parts.js';
  document.head.appendChild(el);
} else {
  render(<App />, document.getElementById('app') as HTMLElement);
  // Inside the phone app: Back, the bars and the live update (shell/native.ts). Nothing in a browser.
  startNative();
  // The keyboard up for a field above a dock: the dock sits at the end of the page (src/ui/keyboard.ts).
  watchKeyboard();
  void start();
  // Who is on now: written as the old app wrote it (shell/presence.ts).
  startPresence();
  // A tapped push opens its page at once, from the phone's copy (shell/open-push.ts).
  listenForPushes();
  // The other tabs' files, quietly after the first paint, so they are here before the signal goes
  // (shell/tabs.ts); the service worker keeps them on the phone for the next open.
  requestAnimationFrame(() => setTimeout(() => { void preloadTabs(); }, 0));
  // The web keeps itself on the phone with the service worker; the page as the phone app ships it
  // (apps/sales: transform.js loaded) with its live update.
  if (!/[?&]demo(&|=|$)/.test(location.search) && !inPhoneApp() && !window.owAppTransform && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(location.pathname.replace(/[^/]*$/, '') + 'sales-sw.js').catch(() => undefined);
  }
}
