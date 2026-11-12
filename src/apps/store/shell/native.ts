/*
 * The Store app's native layer: the shared one (src/native/start.ts) on the Store's own page, key, build
 * id and stack, plus its pushes (as the old store.html's enablePush and pushOpen did). Inert in a browser
 * and in the demo.
 *
 *   - Signed in inside the phone app, the phone is signed up for the yard's pushes (src/core/supabase/push.ts).
 *   - A tapped push opens what it is about, by the one map (shell/pushes.ts pushRoute, routes §5).
 */
import type { NativeApp } from '../../../native/update.ts';
import { inPhoneApp, startNative as start } from '../../../native/start.ts';
import { sheet } from '../../../ui/sheet.tsx';
import { areaOf, loadArea } from './areas.ts';
import { nav, stack } from './nav.ts';
import { pushRoute } from './pushes.ts';
import { books, isDemo, me, phase, refresh, registerPush } from './store.ts';

export { inPhoneApp };

/** The old store.html's own page and key, so a phone its layer updated settles here. */
export const STORE_APP: NativeApp = {
  role: 'store',
  source: 'https://omni-ware.vercel.app/store.html',
  key: 'ow-store-bundle',
  build: 'owStoreBuild',
};

export type PushData = Record<string, string | undefined>;

/** Open the screen a push names: Today under it, so Back lands on Today. Read live first, as the old app did. */
export function openPush(d: PushData): void {
  const go = () => {
    const r = pushRoute(String(d.kind || ''), d, books.value, me.value);
    const a = areaOf(r.id);
    const open = () => {
      if (sheet.isOpen) sheet.close();
      nav.home();
      if (r.id !== 'today') nav.push(r.id, r.params);
    };
    // A screen of a lazy area: its file first (shell/areas.ts); with no signal its loading state says so.
    if (a) void loadArea(a).catch(() => undefined).then(open); else open();
  };
  const fresh = () => { if (phase.value === 'ready') void refresh().then(go, go); else go(); };
  if (books.value) { fresh(); return; }
  const stop = books.subscribe((b) => { if (b) { queueMicrotask(() => stop()); go(); } });
}

interface Tap { notification?: { data?: PushData } }

/** Start the layer, the pushes' sign-up once signed in, and the taps. */
export function startNative(): void {
  start({
    app: STORE_APP,
    isDemo,
    back: () => ({
      sheetOpen: sheet.isOpen,
      depth: stack.value.length,
      rootId: stack.value[0].id,
      closeSheet: () => sheet.close(),
      pop: () => nav.back(),
      today: () => nav.home(),
    }),
  });
  const C = inPhoneApp();
  if (!C || isDemo) return;
  const P = C.Plugins && C.Plugins.PushNotifications;
  if (!P) return;
  P.addListener('pushNotificationActionPerformed', (a: Tap) => openPush((a && a.notification && a.notification.data) || {}));
  // Signed in (now or later): this phone gets the pushes.
  const stop = phase.subscribe((ph) => { if (ph === 'ready') { queueMicrotask(() => stop()); void registerPush(); } });
}
