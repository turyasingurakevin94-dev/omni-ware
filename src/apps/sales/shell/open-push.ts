/*
 * A tapped push opens its page (spec 06 Q8: "Open from the copy, refresh behind"). The page is put on
 * the stack at once, drawn from what this phone holds, with no reload first; a fresh read runs behind it
 * and the screen follows when it lands. With no signal the page still opens, from the copy.
 *
 * The taps come three ways, all into openPush:
 *   - the phone app: Capacitor PushNotifications 'pushNotificationActionPerformed' (a tap that starts
 *     the app is held by the plugin until this listener is added);
 *   - the web: sales-sw.js's 'notificationclick' focuses an open Sales window and posts it the push,
 *     or opens the page at #push=<kind>&… (shell/pushes.ts pushQuery);
 *   - the demo: ?demo&push=<kind>&<key>=<value>, a tapped push without FCM.
 *
 * Which page: shell/pushes.ts. The stack becomes the page's bar tab with the page on top, so Back
 * lands on that tab's list (as sales.html:4932 pushOpen does), and any open sheet closes.
 */
import { sheet } from '../../../ui/sheet.tsx';
import { nav } from './nav.ts';
import { PUSHES, pushFrom, routeOf, type PushData } from './pushes.ts';
import { books, isDemo, phase, refresh } from './store.ts';
import { tabOfId } from './tabs.ts';

/** Open the page a push names. A kind the app has no page for leaves the app where it is. */
export function openPush(d: PushData): void {
  const p = PUSHES[String(d.kind || '')];
  if (!p) return;
  // Found through the copy, and the copy is not drawn yet (the app is just starting): once it is.
  if (p.copy && !books.value) {
    const stop = books.subscribe((b) => { if (b) { queueMicrotask(() => stop()); go(d); } });
    return;
  }
  go(d);
}

function go(d: PushData): void {
  const r = routeOf(d, books.value);
  const t = r && tabOfId(r.id);
  if (!r || !t) return;
  if (sheet.isOpen) sheet.close();
  nav.tab(t);
  if (r.id !== t) nav.push(r.id, r.params);
  // Refresh behind. Before the app is ready, starting it reads the books anyway.
  if (phase.value === 'ready') void refresh();
}

interface Tap { notification?: { data?: PushData } }
interface PushPlugin { addListener(e: 'pushNotificationActionPerformed', fn: (a: Tap) => void): unknown }

function nativePushes(): PushPlugin | null {
  const C = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { PushNotifications?: PushPlugin } } }).Capacitor;
  return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.PushNotifications ? C.Plugins.PushNotifications : null;
}

/** At start: listen for taps, and open the push the page was opened for (#push=…, or the demo's ?push=…). */
export function listenForPushes(): void {
  const P = nativePushes();
  if (P) P.addListener('pushNotificationActionPerformed', (a) => openPush((a && a.notification && a.notification.data) || {}));
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      const d = e.data && (e.data as { owPush?: PushData }).owPush;
      if (d && typeof d === 'object') openPush(d);
    });
  }
  const fromHash = pushFrom(location.hash);
  // Opened once: a reload does not open it again.
  if (fromHash) history.replaceState(history.state, '', location.pathname + location.search);
  const d = fromHash || (isDemo ? pushFrom(location.search) : null);
  if (d) openPush(d);
}
