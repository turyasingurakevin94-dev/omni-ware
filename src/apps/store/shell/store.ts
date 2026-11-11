/*
 * The Store app's state: signals over the StoreSource. Screens read these and call
 * `act` (or `hold`, for a write that waits its 10 s with Undo) to write; every write
 * goes through the one outbox (spec 06 Q4) and is followed by a live read, so every
 * screen sees the same yard.
 *
 *   phase     starting → login | checking | no-reach | ready
 *   books     the yard as last read (null while it loads)
 *   status    'live' after fresh data · 'updating' while reading or on the copy ("Updating · saved 7:52")
 *   kept      writes kept on this phone (Waiting to send; "Not sent · N")
 *   notDone   the bar: amber no signal · red "That did not save · tell Kevin · code" · blue someone else
 *   held      the write waiting its 10 s (Undo), or null
 */
import { computed, effect, signal } from '@preact/signals';
import { isDataError } from '../../../core/datasource.ts';
import { idbStore, isOffline, memoryStore, Outbox, type Kept } from '../../../core/outbox.ts';
import { notDone as wordIt, type NotDone } from '../../../core/store/errors.ts';
import { Held, type HeldNow, type HeldWrite } from '../../../core/store/held.ts';
import type { StoreSource, WriteName } from '../../../core/store/source.ts';
import { storeSupabase } from '../../../core/store/supabase.ts';
import { toast } from '../../../ui/toast.tsx';
import { top } from './nav.ts';
import type { StoreSession, YardBooks } from '../../../core/store/types.ts';

declare global {
  interface Window { owStoreDemo?: { storeDemo: (search: string) => StoreSource } }
}

export type Phase = 'starting' | 'login' | 'checking' | 'no-reach' | 'ready';

export const isDemo = typeof location !== 'undefined' && /[?&]demo(&|=|$)/.test(location.search);
let source: StoreSource | null = isDemo ? null : storeSupabase();

export const phase = signal<Phase>('starting');
export const session = signal<StoreSession | null>(null);
export const books = signal<YardBooks | null>(null);
export const status = signal<'live' | 'updating'>('updating');
export const online = signal(true);
export const kept = signal<Kept[]>([]);
export const now = signal<number>(Date.now());
export const notDone = signal<(NotDone & { retry: (() => void) | null }) | null>(null);
export const held = signal<HeldNow | null>(null);
/** A new build is waiting (TD08 "Update ready · Reload"): set by the service worker, or the demo's &update. */
export const updateReady = signal(isDemo && typeof location !== 'undefined' && /[?&]update(=1)?(&|$)/.test(location.search));

/** The holder's staff id: what "mine" means on an order (null with no staff row, data D12). */
export const me = computed(() => (session.value ? session.value.staffId : null));

const holder = new Held();
holder.onChange((h) => { held.value = h; });
let outbox: Outbox | null = null;

function src(): StoreSource {
  if (!source) throw new Error('The app has not started');
  return source;
}

function loadDemo(): Promise<StoreSource> {
  return new Promise((resolve, reject) => {
    const done = () => (window.owStoreDemo ? resolve(window.owStoreDemo.storeDemo(location.search)) : reject(new Error('The demo did not load')));
    if (window.owStoreDemo) { done(); return; }
    const el = document.createElement('script');
    el.src = location.pathname.replace(/[^/]*$/, '') + 'store-demo.js';
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
  const store = isDemo || typeof indexedDB === 'undefined' ? memoryStore() : idbStore('store', userId);
  outbox = new Outbox(store, send, () => src().now());
  outbox.onChange((l) => { kept.value = l; });
  kept.value = await outbox.items();
}

/**
 * Read the yard: the whole snapshot first, then store_live. A failed read keeps the copy on screen and
 * says why (TD07 "Could not load the yard · code ST-104"); it is never filled from direct reads (PRIV-03).
 * No signal is not a bar of its own here: the amber bar follows `online` and `kept` (App.tsx).
 */
export async function refresh(whole = false): Promise<void> {
  status.value = 'updating';
  try {
    const b = whole || !books.value ? await src().snapshot() : await src().live();
    books.value = b;
    online.value = src().online();
    status.value = online.value ? 'live' : 'updating';
    if (notDone.value && notDone.value.retry === reread) notDone.value = null;
  } catch (e) {
    online.value = !isOffline(e) && src().online();
    if (!isOffline(e)) notDone.value = { ...wordIt(e, 'snapshot'), retry: reread };
  }
  now.value = src().now();
}
const reread = (): void => { void refresh(true); };

let timers = false;
async function ready(s: StoreSession): Promise<void> {
  session.value = s;
  phase.value = 'checking';
  await openOutbox(s.userId);
  await refresh(true);
  if (books.value && session.value && !session.value.staffId && isDemo) session.value = { ...session.value, staffId: books.value.me.id };
  // No yard and no signal: "Could not reach the shop" (TD22). A refused read: Today says so (TD07).
  phase.value = books.value || online.value ? 'ready' : 'no-reach';
  if (isDemo || timers) return;
  timers = true;
  setInterval(() => { now.value = src().now(); }, 30000);
  // The 45 s store_live refresh while visible (data §1d); the whole snapshot after 30 s away.
  setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 45000);
  let hidden = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hidden = Date.now(); void holder.flush(); } else if (Date.now() - hidden > 30000) void refresh(true);
  });
  window.addEventListener('online', () => { void flush(); });
  void flush();
}

/** Start: the demo or the real books; signed in or the sign-in. With no signal it never hangs on a blank page. */
export async function start(): Promise<void> {
  try {
    if (isDemo) source = await loadDemo();
    const s = await src().session();
    if (!s) { phase.value = 'login'; return; }
    await ready(s);
  } catch (e) {
    if (isOffline(e)) { phase.value = 'no-reach'; return; }
    phase.value = 'login';
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const s = await src().signIn(email, password);
  await ready(s);
}

export async function signOut(): Promise<void> {
  await holder.flush();
  await src().signOut();
  books.value = null; session.value = null; phase.value = 'login';
}

/**
 * A write: through the outbox, then a live read. Kept (no signal): resolves { kept: true } and the
 * amber bar says so. Refused: the bar says it in plain words ("That did not save · tell Kevin · code
 * CI-502", "Someone else just did this · Refreshed"), Try again sends it again, and it rejects so the
 * screen keeps its work.
 */
export async function act(kind: WriteName, ...args: unknown[]): Promise<{ kept: boolean }> {
  if (!outbox) throw new Error('Not signed in');
  try {
    const r = await outbox.run(kind, args);
    if (r.kept) online.value = false;
    else if (notDone.value && notDone.value.retry !== reread) notDone.value = null;
    await refresh();
    return { kept: r.kept };
  } catch (e) {
    const n = wordIt(e, kind);
    // A refusal the person can act on ("Not paid yet · it leaves when paid") is said where they are, no bar.
    if (n.tone === 'refused') toast.show(n.text, { kind: 'error' });
    else notDone.value = { ...n, retry: n.tone === 'failed' ? () => { notDone.value = null; void act(kind, ...args).catch(() => undefined); } : null };
    if (isDataError(e) && e.kind === 'clash') await refresh();
    throw e;
  }
}

/** A write that waits 10 s with Undo (store.html:991 heldWrite): `label` is what the toast says. */
export function hold(label: string, kind: WriteName, args: unknown[], undo?: () => void): void {
  const w: HeldWrite = { label, send: () => act(kind, ...args).catch(() => undefined), undo };
  holder.hold(w);
  heldOn = top.peek().key;
}
/** The screen a held write was made on: leaving it sends the write at once (store.html:2074 flushHeld). */
let heldOn = 0;
effect(() => { const k = top.value.key; if (holder.current && k !== heldOn) void holder.flush(); });
export const undoHeld = (): void => holder.undo();
/** The screen changed: what waits goes now (nav calls it). */
export const flushHeld = (): Promise<unknown> => holder.flush();

export async function flush(): Promise<void> {
  if (!outbox) return;
  await outbox.flush();
  const left = (await outbox.items()).filter((k) => k.state !== 'refused').length;
  if (!left) online.value = src().online();
  await refresh();
}

export async function discard(id: string): Promise<void> {
  if (outbox) await outbox.discard(id);
}

/** This phone gets the yard's pushes (the real books in the phone app; nothing in the demo). Quiet on failure. */
export async function registerPush(): Promise<void> {
  const s = source;
  if (!s || !s.pushOn) return;
  try { await s.pushOn(); } catch (_e) { /* no Play services, permission off, no signal */ }
}
