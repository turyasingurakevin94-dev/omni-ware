/*
 * The Manager app's state: signals over the ManagerSource. Screens read these and call
 * `answer` (a tap: waits 10 s with Undo, then goes) or `act` (a slide or a page's Save:
 * goes at once). Every write goes through the one outbox (spec 06 Q4), so with no signal
 * it is kept on the phone and sent once; a live read follows, so every screen sees the
 * same books.
 *
 *   phase     starting → login | no-reach | ready
 *   books     the shop as last read (null while it loads)
 *   kept      answers kept on this phone (no signal: "Waits")
 *   notDone   the bar: amber no signal · red "Not sent · tell Kevin · code" · blue someone else
 *   held      the answer waiting its 10 s (Undo), or null
 */
import { computed, effect, signal } from '@preact/signals';
import { isDataError } from '../../../core/datasource.ts';
import { Held, type HeldNow, type HeldWrite } from '../../../core/held.ts';
import { idbStore, isOffline, memoryStore, Outbox, type Kept } from '../../../core/outbox.ts';
import { notDone as wordIt, type NotDone } from '../../../core/manager/errors.ts';
import { queue } from '../../../core/manager/queue.ts';
import type { ManagerSource, WriteName } from '../../../core/manager/source.ts';
import type { ManagerBooks, ManagerSession } from '../../../core/manager/types.ts';
import { toast } from '../../../ui/toast.tsx';
import { nav, top } from './nav.ts';

declare global {
  interface Window { owManagerDemo?: { managerDemo: (search: string) => ManagerSource } }
}

export type Phase = 'starting' | 'login' | 'no-reach' | 'ready';

export const isDemo = typeof location !== 'undefined' && /[?&]demo(&|=|$)/.test(location.search);
let source: ManagerSource | null = null;

export const phase = signal<Phase>('starting');
export const session = signal<ManagerSession | null>(null);
export const books = signal<ManagerBooks | null>(null);
export const online = signal(true);
export const kept = signal<Kept[]>([]);
export const now = signal<number>(Date.now());
export const notDone = signal<(NotDone & { retry: (() => void) | null }) | null>(null);
export const held = signal<HeldNow | null>(null);
export const saved = signal<ManagerBooks | null>(null);


const holder = new Held();
holder.onChange((h) => { held.value = h; });
let outbox: Outbox | null = null;
/** Answers being sent now (after their 10 s): All decided waits for them. */
export const sending = signal<string[]>([]);
/** The last answer the books refused or that did not send: its decision is back, with Try again. */
export const failed = signal<{ key: string; label: string; retry: () => void } | null>(null);
/** Keys answered on this phone and not yet read back: they leave the queue at once. */
export const answered = signal<string[]>([]);
/** The queue, in order, less what this phone just answered: the + badge, Needs you, the sheet's "n of N". */
export const waiting = computed(() => (books.value ? queue(books.value).filter((a) => !answered.value.includes(a.key)) : []));

function src(): ManagerSource {
  if (!source) throw new Error('The app has not started');
  return source;
}

/** The real books: loaded on first use, so the demo page never pulls the Supabase layer in. */
export function useSource(s: ManagerSource): void { source = s; }

function loadDemo(): Promise<ManagerSource> {
  return new Promise((resolve, reject) => {
    const done = () => (window.owManagerDemo ? resolve(window.owManagerDemo.managerDemo(location.search)) : reject(new Error('The demo did not load')));
    if (window.owManagerDemo) { done(); return; }
    const el = document.createElement('script');
    el.src = location.pathname.replace(/[^/]*$/, '') + 'manager-demo.js';
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
  const store = isDemo || typeof indexedDB === 'undefined' ? memoryStore([]) : idbStore('manager', userId);
  outbox = new Outbox(store, send, () => src().now());
  outbox.onChange((l) => { kept.value = l; });
  kept.value = await outbox.items();
}

/** Read the books: the whole snapshot first, then the live refresh. A failed read keeps the copy on screen. */
export async function refresh(whole = false): Promise<void> {
  try {
    const b = whole || !books.value ? await src().snapshot() : await src().live();
    books.value = b;
    answered.value = answered.value.filter((k) => b.asks.some((a) => a.key === k));
    online.value = src().online();
    if (notDone.value && notDone.value.retry === reread) notDone.value = null;
  } catch (e) {
    online.value = !isOffline(e) && src().online();
    if (!isOffline(e)) notDone.value = { ...wordIt(e, 'snapshot'), retry: reread };
  }
  now.value = src().now();
}
const reread = (): void => { void refresh(true); };

function openDemoPush(): void {
  const m = /[?&]push=([a-z_.]+)(?::([^&]+))?/.exec(location.search);
  if (!m) return;
  // The demo's push opens the decision it names (shell/pushes.ts does the same for the phone's).
  const key = m[2] ? decodeURIComponent(m[2]) : null;
  nav.push('decide', key ? { id: key } : {});
}

let timers = false;
async function ready(s: ManagerSession): Promise<void> {
  session.value = s;
  now.value = src().now();
  await openOutbox(s.userId);
  await refresh(true);
  phase.value = books.value || online.value ? 'ready' : 'no-reach';
  if (phase.value === 'no-reach' && src().savedCopy) saved.value = await src().savedCopy!().catch(() => null);
  if (isDemo) openDemoPush();
  if (timers) return;
  timers = true;
  window.addEventListener('online', () => { void flush(); });
  if (isDemo) return;
  setInterval(() => { now.value = src().now(); }, 30000);
  setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 45000);
  let hidden = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hidden = Date.now(); void holder.flush(); } else if (Date.now() - hidden > 30000) void refresh(true);
  });
  void flush();
}

/** Start: the demo or the real books; signed in or the sign-in. With no signal it never hangs. */
export async function start(real?: () => Promise<ManagerSource>): Promise<void> {
  try {
    source = isDemo ? await loadDemo() : real ? await real() : source;
    const s = await src().session();
    if (!s) { phase.value = 'login'; return; }
    await ready(s);
  } catch (e) {
    phase.value = isOffline(e) ? 'no-reach' : 'login';
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  await ready(await src().signIn(email, password));
}

export async function signOut(): Promise<void> {
  await holder.flush();
  await src().signOut();
  books.value = null; session.value = null; phase.value = 'login';
}

export function openCopy(): void {
  if (!saved.value) return;
  books.value = saved.value; online.value = false; phase.value = 'ready';
}

/**
 * A write now (a slide, a Save): through the outbox, then a live read. Kept (no signal): resolves
 * { kept: true }. Refused: the bar or a toast says it in plain words, Try again sends it again, and
 * it rejects so the screen keeps its work.
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
    if (n.tone === 'refused') toast.show(n.text, { kind: 'error' });
    else notDone.value = { ...n, retry: n.tone === 'failed' ? () => { notDone.value = null; void act(kind, ...args).catch(() => undefined); } : null };
    if (isDataError(e) && e.kind === 'clash') await refresh();
    throw e;
  }
}

/**
 * An answer by a tap: the decision leaves the queue at once and the next one comes; the write waits
 * 10 s with Undo (the strip "Approved · #0555 · Grace sees it"), then goes through `act`.
 * `label` is what the strip says; `then` is told how it went.
 */
export function answer(key: string | null, label: string, kind: WriteName, args: unknown[],
  o: { quiet?: boolean; undo?: () => void; then?: (r: { kept: boolean } | null, e?: unknown) => void } = {}): void {
  if (key) answered.value = [...answered.value, key];
  if (key && failed.value && failed.value.key === key) failed.value = null;
  const back = () => { if (key) answered.value = answered.value.filter((k) => k !== key); if (o.undo) o.undo(); };
  const w: HeldWrite = {
    label, quiet: o.quiet, undo: back,
    send: () => {
      if (key) sending.value = [...sending.value, key];
      const done = () => { if (key) sending.value = sending.value.filter((k) => k !== key); };
      return act(kind, ...args).then((r) => { done(); if (o.then) o.then(r); }, (e) => {
        done();
        // Refused or failed: the decision comes back with why, and Try again sends the same answer (the work is kept).
        if (key && !isOffline(e)) failed.value = { key, label, retry: () => answer(key, label, kind, args, o) };
        back(); if (o.then) o.then(null, e);
      });
    },
  };
  holder.hold(w);
  heldOn = top.peek().key;
}
let heldOn = 0;
// Leaving the sheet or page an answer was made on sends it at once — except Decide, which moves on by itself.
effect(() => { const t = top.value; if (holder.current && t.key !== heldOn && t.id !== 'decide') void holder.flush(); });
export const undoHeld = (): void => holder.undo();
export const flushHeld = (): Promise<unknown> => holder.flush();

export async function flush(): Promise<void> {
  if (!outbox) return;
  await outbox.flush();
  const left = (await outbox.items()).filter((k) => k.state !== 'refused').length;
  if (!left) online.value = src().online();
  await refresh();
}

export async function registerPush(): Promise<void> {
  const s = source;
  if (!s || !s.pushOn) return;
  try { await s.pushOn(); } catch (_e) { /* no Play services, permission off, no signal */ }
}
