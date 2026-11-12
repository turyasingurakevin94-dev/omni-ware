/*
 * The Buyer app's state: signals over the BuyerSource. Screens read these
 * and call `act` to write; every write goes through the one outbox (spec 06
 * Q4) and is followed by a fresh read, so every screen sees the same books.
 *
 *   phase   starting → login | ready
 *   books   the shop as last read (null while it loads)
 *   copy    the books as last read on this phone, kept for the next start (BUY-14: never a blank start;
 *           drawn dimmed under "Opening…" until the fresh read lands; forgotten on Sign out)
 *   pushes  whether this phone is signed up for the Buyer's pushes
 *   kept    writes kept on this phone (no signal) or refused
 */
import { computed, signal } from '@preact/signals';
import { buyerSupabase } from '../../../core/buyer/supabase.ts';
import type { BuyerSource } from '../../../core/buyer/source.ts';
import { isDataError } from '../../../core/datasource.ts';
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
export const pushes = signal(false);

/** The kept copy (one per phone: the last person signed in here). */
export interface Copy { userId: string; at: number; books: BuyerBooks }
const COPY_KEY = 'ow-buyer-copy' + (isDemo ? '-demo' : '');
function readCopy(): Copy | null {
  try {
    const c = JSON.parse(localStorage.getItem(COPY_KEY) || 'null') as Copy | null;
    return c && c.userId && c.books && c.books.me ? c : null;
  } catch (_e) { return null; }
}
export const copy = signal<Copy | null>(typeof localStorage !== 'undefined' ? readCopy() : null);
function keepCopy(b: BuyerBooks): void {
  const s = session.value;
  if (!s) return;
  const c: Copy = { userId: s.userId, at: Date.now(), books: b };
  copy.value = c;
  try { localStorage.setItem(COPY_KEY, JSON.stringify(c)); } catch (_e) { /* storage full: the next start opens without it */ }
}
function forgetCopy(): void {
  copy.value = null;
  try { localStorage.removeItem(COPY_KEY); } catch (_e) { /* nothing kept */ }
}

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
  // The Buyer's writes keep one line (a trip is written stop by stop); a stuck one is called Not sent (SAL-3).
  outbox = new Outbox(store, send, () => src().now(), { readsOk: () => src().now() - readOkAt < 120000 });
  outbox.onChange((l) => { kept.value = l; });
  kept.value = await outbox.items();
}

/** Read the books again. A failed read keeps the copy on screen and says why. */
let readOkAt = 0;

export async function refresh(): Promise<void> {
  try {
    const b = await src().books();
    books.value = b;
    keepCopy(b);
    readError.value = null;
    readOkAt = src().now();
    online.value = src().online();
  } catch (e) {
    readError.value = isOffline(e) ? 'No signal' : String((e as Error).message || e);
    online.value = !isOffline(e) && src().online();
  }
  now.value = src().now();
}

/** Signed in: the outbox, the books, then the timers that keep them fresh (once, however the app got here). */
let timers = false;
async function ready(s: Session): Promise<void> {
  session.value = s;
  // Another person's copy is never shown again.
  if (copy.value && copy.value.userId !== s.userId) forgetCopy();
  await openOutbox(s.userId);
  await refresh();
  phase.value = 'ready';
  if (isDemo || timers) return;
  timers = true;
  const waiting = () => kept.value.some((k) => k.state === 'kept');
  setInterval(() => { now.value = src().now(); if (waiting()) void flush(); }, 30000);
  setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
  window.addEventListener('online', () => { void flush(); void refresh(); });
  // Back in the app: send what waits (SAL-3).
  const back = () => { if (document.visibilityState === 'visible' && waiting()) void flush(); };
  document.addEventListener('visibilitychange', back);
  window.addEventListener('focus', back);
  void flush();
}

/** A login that is not the Buyer's (the server said so): signed out, so the next open is the login, never a dead page. */
async function notMine(e: unknown): Promise<boolean> {
  if (!(isDataError(e) && e.kind === 'refused')) return false;
  try { await src().signOut(); } catch (_x) { /* signed out on this phone either way */ }
  session.value = null; books.value = null;
  return true;
}

/**
 * Start: the demo or the real books; signed in or the login. With no signal it never hangs on a blank
 * page: the login shows "No signal", and the app starts again by itself when the signal comes back.
 */
export async function start(): Promise<void> {
  try {
    if (isDemo) source = await loadDemo();
    const s = await src().session();
    if (!s) { forgetCopy(); phase.value = 'login'; return; }
    await ready(s);
  } catch (e) {
    if (isOffline(e)) {
      readError.value = 'No signal';
      online.value = false;
      // With a kept copy the app stays on it, Offline, until the signal comes back; without one, the login says No signal.
      if (!copy.value) phase.value = 'login';
      const again = () => { window.removeEventListener('online', again); void start(); };
      window.addEventListener('online', again);
      return;
    }
    await notMine(e);
    readError.value = null;
    phase.value = 'login';
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  let s: Session;
  try { s = await src().signIn(email, password); } catch (e) { await notMine(e); throw e; }
  readError.value = null;
  await ready(s);
}

/** This phone gets the Buyer's pushes (the real books in the phone app; nothing in the demo). A failure is quiet: it asks again next start. */
export async function registerPush(): Promise<void> {
  const s = source;
  if (!s || !s.pushOn) return;
  try {
    // The shared sign-up says whether it took: refused permission or no Play services is Off.
    pushes.value = (await s.pushOn()).on;
  } catch (_e) { pushes.value = false; /* no Play services, permission off, no signal */ }
}

export async function signOut(): Promise<void> {
  await src().signOut();
  forgetCopy();
  books.value = null; session.value = null; pushes.value = false; phase.value = 'login';
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
