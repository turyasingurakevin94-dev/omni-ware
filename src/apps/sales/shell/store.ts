/*
 * The app's state: typed signals over the DataSource. Screens read these
 * signals and call `act` to write; they never call the source themselves,
 * so every write goes through the one outbox (spec 06 Q4) and every read
 * refreshes the same copy.
 *
 *   phase     starting → login | signed-elsewhere | ready
 *   books     the shop as last read (null while it loads: screens draw their skeleton)
 *   chats     the WhatsApp side, refreshed more often (spec 06 §2)
 *   online    signal on this phone; kept: what the outbox holds
 *   drafts    orders not placed yet (the red +'s count), kept on this phone
 */
import { computed, signal } from '@preact/signals';
import { waitingChats } from '../../../core/chats.ts';
import type { DataSource, OrderDraft } from '../../../core/datasource.ts';
import type { DemoSource } from '../../../core/demo/index.ts';
import { readFlags } from '../../../core/demo/flags.ts';
import { idbStore, memoryStore, Outbox, type Kept } from '../../../core/outbox.ts';
import { supabaseSource } from '../../../core/supabase/index.ts';
import type { Books, ChatBooks, Member, Session } from '../../../core/types.ts';

export type Phase = 'starting' | 'login' | 'signed-elsewhere' | 'ready';

/** An order being built and not placed yet (sales.html nwDrafts: kept on the phone). */
export interface Draft extends OrderDraft {
  key: string;
  at: number;
}

const flags = readFlags(typeof location === 'undefined' ? '' : location.search);
/** The demo when the address says ?demo (next/sales-demo.js, loaded only then); the real books otherwise. */
export const isDemo = flags.on;
export let source: DataSource = isDemo ? (null as unknown as DataSource) : supabaseSource();

/** ?demo: load the sample shop beside the page (tools/build-app.js builds it from src/core/demo/entry.ts). */
function loadDemo(): Promise<DataSource> {
  return new Promise((resolve, reject) => {
    if (window.owDemo) { resolve(window.owDemo.demoSource(flags)); return; }
    const el = document.createElement('script');
    el.src = location.pathname.replace(/[^/]*$/, '') + 'sales-demo.js';
    el.onload = () => (window.owDemo ? resolve(window.owDemo.demoSource(flags)) : reject(new Error('The demo did not load')));
    el.onerror = () => reject(new Error('The demo did not load'));
    document.head.appendChild(el);
  });
}

export const phase = signal<Phase>('starting');
export const session = signal<Session | null>(null);
export const books = signal<Books | null>(null);
export const chats = signal<ChatBooks | null>(null);
export const online = signal<boolean>(true);
export const kept = signal<Kept[]>([]);
export const now = signal<number>(Date.now());
export const drafts = signal<Draft[]>([]);
/** The last read that failed, in words for the person ("No signal"). */
export const readError = signal<string | null>(null);
/** Who is signed in under this screen when it is someone else (TD10). */
export const elsewhere = signal<Member | null>(null);

export const me = computed(() => (books.value ? books.value.me : null));
/** Chats waiting for this salesperson (the Chats tab's count). */
export const waitingCount = computed(() => {
  const cb = chats.value, m = me.value;
  return cb && m ? waitingChats(cb, m.id, now.value).length : 0;
});

let outbox: Outbox | null = null;

/** The sender the outbox calls: a write by its DataSource name, with its arguments. */
function send(kind: string, args: unknown): Promise<unknown> {
  const fn = (source as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[kind];
  if (typeof fn !== 'function') return Promise.reject(new Error('No such write: ' + kind));
  return fn.apply(source, Array.isArray(args) ? args : [args]);
}

async function openOutbox(userId: string): Promise<void> {
  const store = isDemo ? memoryStore((source as DemoSource).kept()) : (typeof indexedDB === 'undefined' ? memoryStore() : idbStore('sales', userId));
  outbox = new Outbox(store, send, () => source.now());
  outbox.onChange((l) => { kept.value = l; });
  kept.value = await outbox.items();
}

/** Read the books and the chats again (every 45 s and 15 s; on signal back; after a write). */
export async function refresh(): Promise<void> {
  try {
    const [b, c] = await Promise.all([source.books(), source.chats()]);
    books.value = b; chats.value = c; readError.value = null;
  } catch (e) {
    readError.value = (e as Error).message || String(e);
  } finally {
    now.value = source.now();
  }
}

/**
 * Every write: through the outbox, then a fresh read. Resolves with the server's answer, or
 * { kept: true } when there is no signal ("Kept on this phone"). A refusal rejects with the
 * server's reason (a DataError: kind, code, message), for the screen to word.
 */
export async function act<T = unknown>(kind: keyof DataSource, ...args: unknown[]): Promise<{ kept: false; value: T } | { kept: true; id: string }> {
  if (!outbox) throw new Error('Not signed in');
  const r = await outbox.run<T>(kind, args);
  if (!r.kept) void refresh();
  return r;
}

/** Try the kept writes again ("Try again"). */
export async function flush(): Promise<void> {
  if (!outbox) return;
  await outbox.flush();
  await refresh();
}

export async function discardKept(id: string): Promise<void> {
  if (outbox) await outbox.discard(id);
}

/** The person's own drafts (localStorage, per login; sales.html keeps them so too). The demo seeds FACTS §4.6. */
function loadDrafts(userId: string): Draft[] {
  if (isDemo) return demoDrafts();
  try { return JSON.parse(localStorage.getItem('ow-sales-drafts:' + userId) || '[]') as Draft[]; } catch (_e) { return []; }
}
export function saveDrafts(list: Draft[]): void {
  drafts.value = list;
  const s = session.value;
  if (!s || isDemo) return;
  try { localStorage.setItem('ow-sales-drafts:' + s.userId, JSON.stringify(list)); } catch (_e) { /* storage full: kept in memory */ }
}

/** FACTS §4.6: Kyaligonza · 2 items · 186,000 and Lubowa · 1 item · 2,280,000, not placed. */
function demoDrafts(): Draft[] {
  const b = (source as DemoSource).state.books, item = (id: string) => b.items.find((i) => i.id === id);
  const line = (id: string, qty: number, n: number) => {
    const it = item(id);
    if (!it) throw new Error('demo draft: no item ' + id);
    return { lineId: n, itemId: it.id, variantIdx: null, name: it.name, unit: it.unit, packUnit: it.packUnit, packQty: it.packQty, qty, price: it.price, cost: it.cost, shopPrice: it.price,
      from: (it.onShelf || 0) >= qty ? 'shelf' as const : 'supplier' as const, supplierId: (it.onShelf || 0) >= qty ? '__stock__' : 'sup-demo', priceBy: null, priceNote: null, priceReview: null, priceToldAt: null, state: null, stateAt: null };
  };
  return [
    { key: 'd-ks', at: source.now() - 40 * 60000, customerId: 'C002', client: { name: 'Kyaligonza & Sons', phone: '0772 455 610' }, lines: [line('ridge-g28', 5, 1), line('nails-4-25kg', 1, 2)], charges: [], credit: null, deliverTo: null, chatId: null },
    { key: 'd-lb', at: source.now() - 10 * 60000, customerId: 'C006', client: { name: 'Lubowa Builders', phone: '0772 410 233' }, lines: [line('iron-g28-3m', 60, 1)], charges: [], credit: null, deliverTo: null, chatId: 102 },
  ];
}

let timers: number[] = [];

/** Start: who is signed in, then the books; timers while the app is open. */
export async function start(): Promise<void> {
  try {
    if (isDemo) source = await loadDemo();
    online.value = source.online();
    now.value = source.now();
    const s = await source.session();
    if (!s) { phase.value = 'login'; return; }
    await enter(s);
  } catch (e) {
    readError.value = (e as Error).message || String(e);
    phase.value = 'login';
  }
}

export async function enter(s: Session): Promise<void> {
  session.value = s;
  if (!['sales', 'owner', 'admin', 'manager'].includes(s.role)) {
    elsewhere.value = { id: s.userId, name: s.name, initials: s.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), role: s.role, tint: 't4', presence: 'on', presenceSince: null, inChat: null, typingIn: null };
    phase.value = 'signed-elsewhere';
    return;
  }
  await openOutbox(s.userId);
  drafts.value = loadDrafts(s.userId);
  phase.value = 'ready';
  void refresh();
  timers.forEach((t) => clearInterval(t));
  if (!isDemo) {
    timers = [
      window.setInterval(() => { void refresh(); }, 45000),
      window.setInterval(() => { now.value = source.now(); }, 30000),
    ];
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  await enter(await source.signIn(email, password));
}

export async function signOut(): Promise<void> {
  timers.forEach((t) => clearInterval(t)); timers = [];
  await source.signOut();
  session.value = null; books.value = null; chats.value = null; elsewhere.value = null;
  phase.value = 'login';
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { online.value = source.online(); void flush(); });
  window.addEventListener('offline', () => { online.value = false; });
}
