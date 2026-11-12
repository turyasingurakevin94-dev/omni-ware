/*
 * The Manager app's native layer: the shared one (src/native/start.ts) on the Manager's own page, key,
 * build id and stack, plus its pushes. Inert in a browser and in the demo.
 *
 *   - Signed in inside the phone app, the phone is signed up for the Manager's pushes.
 *   - A tapped push opens the decision it is about (shell/pushes.ts), read live first; one already
 *     answered says "Someone else just did this" and opens what is left.
 */
import { inPhoneApp, startNative as start } from '../../../native/start.ts';
import type { NativeApp } from '../../../native/update.ts';
import { sheet } from '../../../ui/sheet.tsx';
import { toast } from '../../../ui/toast.tsx';
import { nav, stack } from './nav.ts';
import { pushRoute } from './pushes.ts';
import { books, isDemo, phase, refresh, registerPush, waiting } from './store.ts';

export const MANAGER_APP: NativeApp = {
  role: 'manager',
  source: 'https://omni-ware.vercel.app/manager.html',
  key: 'ow-manager-bundle',
  build: 'owManagerBuild',
};

type PushData = Record<string, string | undefined>;

export function openPush(d: PushData): void {
  const go = () => {
    const r = pushRoute(String(d.kind || ''), d, books.value, waiting.value.map((a) => a.key));
    if (sheet.isOpen) sheet.close();
    nav.home();
    if (r.id !== 'today') nav.push(r.id, r.params);
    if (r.gone) toast.show('Someone else just did this', { kind: 'warn' });
  };
  if (books.value) { if (phase.value === 'ready') void refresh().then(go, go); else go(); return; }
  const stop = books.subscribe((b) => { if (b) { queueMicrotask(() => stop()); go(); } });
}

interface Tap { notification?: { data?: PushData } }

export function startNative(): void {
  start({
    app: MANAGER_APP,
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
  const stop = phase.subscribe((ph) => { if (ph === 'ready') { queueMicrotask(() => stop()); void registerPush(); } });
}
