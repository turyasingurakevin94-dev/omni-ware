/*
 * The Buyer app's state: signals over the BuyerSource. Screens read these
 * and call `act` to write; every write goes through the one outbox (spec 06
 * Q4) and is followed by a fresh read, so every screen sees the same books.
 *
 *   phase   starting → login | ready
 *   books   the shop as last read (null while it loads)
 *   kept    writes kept on this phone (no signal) or refused
 */
import { computed, signal } from '@preact/signals';
import { buyerSupabase } from '../../../core/buyer/supabase.ts';
import type { BuyerSource } from '../../../core/buyer/source.ts';
import type { BuyerBooks } from '../../../core/buyer/types.ts';
import { idbStore, memoryStore, Outbox, isOffline, type Kept } from '../../../core/outbox.ts';
import type { Session } from '../../../core/types.ts';

declare global {
  interface Window { owBuyerDemo?: { buyerDemo: (search: string) => BuyerSource } }
}

export type Phase = 'starting' | 'login' | 'ready';

export const isDemo = typeof location !== 'undefined' && /[?&]demo(&|=|$)/.test(location.search);
let source: BuyerSource | null = isDemo ? null : buyerSupabase();

export const phase = signal<Phase>('starting');
export const session = signal<Session | null>(null);
export const books = signal<BuyerBooks | null>(null);
export const online = signal(true);
export const kept = signal<Kept[]>([]);
export const now = signal<number>(Date.now());
export const readError = signal<string | null>(null);

export const me = computed(() => (books.value ? books.value.me : null));

let outbox: Outbox | null = null;

function src(): BuyerSource {
  if (!source) throw new Error('The app has not started');
  return source;
}

function loadDemo(): Promise<BuyerSource> {
  return new Promise((resolve, reject) => {
    const done = () => (window.owBuyerDemo ? resolve(window.owBuyerDemo.buyerDemo(location.search)) : reject(new Error('The demo did not load')));
    if (window.owBuyerDemo) { done(); return; }
    const el = document.createElement('script');
    el.src = location.pathname.replace(/[^/]*$/, '') + 'buyer-demo.js';
    el.onload = done;
    el.onerror = () => reject(new Error('The demo did not load'));
    document.head.appendChild(el);
  });
}

function send(kind: string, args: unknown): Promise<unknown> {
  const s = src() as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  if (typeof s[kind] !== 'function') return Promise.reject(new Error('No such write: ' + kind));
  return s[kind].apply(s, Array.isArray(args) ? args : [args]);
}

async function openOutbox(userId: string): Promise<void> {
  const store = isDemo || typeof indexedDB === 'undefined' ? memoryStore() : idbStore('buyer', userId);
  outbox = new Outbox(store, send, () => src().now());
  outbox.onChange((l) => { kept.value = l; });
  kept.value = await outbox.items();
}

/** Read the books again. A failed read keeps the copy on screen and says why. */
export async function refresh(): Promise<void> {
  try {
    const b = await src().books();
    books.value = b;
    readError.value = null;
    online.value = src().online();
  } catch (e) {
    readError.value = isOffline(e) ? 'No signal' : String((e as Error).message || e);
    online.value = !isOffline(e) && src().online();
  }
  now.value = src().now();
}

/** Start: the demo or the real books; signed in or the login. */
export async function start(): Promise<void> {
  if (isDemo) source = await loadDemo();
  const s = await src().session();
  if (!s) { phase.value = 'login'; return; }
  session.value = s;
  await openOutbox(s.userId);
  await refresh();
  phase.value = 'ready';
  if (!isDemo) {
    setInterval(() => { now.value = src().now(); }, 30000);
    setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
    window.addEventListener('online', () => { void flush(); });
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const s = await src().signIn(email, password);
  session.value = s;
  await openOutbox(s.userId);
  await refresh();
  phase.value = 'ready';
}

/** This phone gets the Buyer's pushes (the real books in the phone app; nothing in the demo). A failure is quiet: it asks again next start. */
export async function registerPush(): Promise<void> {
  const s = source;
  if (!s || !s.pushOn) return;
  try { await s.pushOn(); } catch (_e) { /* no Play services, permission off, no signal */ }
}

export async function signOut(): Promise<void> {
  await src().signOut();
  books.value = null; session.value = null; phase.value = 'login';
}

/** A write: through the outbox, then a fresh read. Rejects only when the server refused it. */
export async function act(kind: keyof BuyerSource, ...args: unknown[]): Promise<{ kept: boolean }> {
  if (!outbox) throw new Error('Not signed in');
  const r = await outbox.run(kind, args);
  if (r.kept) online.value = false;
  await refresh();
  return { kept: r.kept };
}

export async function flush(): Promise<void> {
  if (!outbox) return;
  await outbox.flush();
  await refresh();
}

export async function discard(id: string): Promise<void> {
  if (outbox) await outbox.discard(id);
}
