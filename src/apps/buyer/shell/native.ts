/*
 * The Buyer app's native layer: the shared one (src/native/start.ts) on the Buyer's own page, key, build
 * id and stack, plus its pushes (as buyer.html:1664 phonePush and 1688 pushOpen did). Inert in a browser
 * and in the demo.
 *
 *   - Signed in inside the phone app, the phone is signed up for the Buyer's pushes (src/core/supabase/push.ts).
 *   - A tapped push opens what it is about, on the screens the canvas draws (pushRoute).
 */
import type { NativeApp } from '../../../native/update.ts';
import { inPhoneApp, startNative as start } from '../../../native/start.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { sheet } from '../../../ui/sheet.tsx';
import { nav, stack, type Params } from './nav.ts';
import { books, isDemo, phase, refresh, registerPush } from './store.ts';

export { inPhoneApp };

/** The old buyer.html's own page and key, so a phone its layer updated settles here. */
export const BUYER_APP: NativeApp = {
  role: 'buyer',
  source: 'https://omni-ware.vercel.app/buyer.html',
  key: 'ow-buyer-bundle',
  build: 'owBuyerBuild',
};

export type PushData = Record<string, string | undefined>;

/**
 * Which screen a push opens (push-send: data = { kind, ...ref }, every value a string). The old app's
 * kinds, each onto a drawn screen; one with nothing drawn for it (the restock pushes) opens Today.
 */
export function pushRoute(d: PushData, b: BuyerBooks | null): { id: string; params?: Params } {
  const k = String(d.kind || ''), id = Number(d.orderId || d.id || 0);
  const order = id && b && b.orders.some((o) => o.id === id) ? { id: 'orders/order', params: { id } } : null;
  if (k === 'supplier.answered') return { id: 'replies' };
  if (k === 'order.buying' || k === 'carton.refused' || k === 'sourcing.found') return order || { id: 'orders' };
  if (/^trip\./.test(k)) return { id: 'trip' };
  return { id: 'today' };
}

/** Open the screen a push names: Today under it, so Back lands on Today. */
export function openPush(d: PushData): void {
  const go = () => {
    const r = pushRoute(d, books.value);
    if (sheet.isOpen) sheet.close();
    nav.home();
    if (r.id !== 'today') nav.push(r.id, r.params || {});
    if (phase.value === 'ready') void refresh();
  };
  if (books.value) { go(); return; }
  const stop = books.subscribe((b) => { if (b) { queueMicrotask(() => stop()); go(); } });
}

interface Tap { notification?: { data?: PushData } }

/** Start the layer, the pushes' sign-up once signed in, and the taps. */
export function startNative(): void {
  start({
    app: BUYER_APP,
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
