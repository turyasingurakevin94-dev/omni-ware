/*
 * The Manager demo: the sample day of docs/canvas/manager/BRIEF.md in memory, behind
 * ManagerSource. Every read hands out a copy; every write changes the day as its server
 * function would (writes.ts), after a short wait so "Sending…" is seen.
 *
 *   ?demo                 Sat 17 Oct 2026 09:40, Ruth's phone: the eight asks
 *   &at=1005 … 1620       a later card's moment (asks.ts MOMENTS); after 09:59 the eight are answered
 *   &state=markup         + D-33, Moses's new item
 *   &state=nocost         (with &at=1015) #0553's line has no known cost: Cost ? · Ask Denis
 *   &state=twins          #0545 not billed yet: Taken twice? can be cancelled (Orders p4)
 *   &state=empty          nothing waits (the + a tick, All decided)
 *   &state=signed-out     the sign-in
 *   &state=no-reach       the shop cannot be reached; the copy saved 09:38
 *   &offline              no signal: reads give the copy saved 09:38, writes are kept
 *   &fail=<write>         that write fails once ("Not sent · Try again"); &clash=<write>: "Someone else just did this"
 *   &slow=1               every write waits 60 s (the Sending… states)
 *   &push=<kind>:<key>    a push tapped as the app opens
 */
import { dataError } from '../../datasource.ts';
import type { ManagerSource, WriteName } from '../source.ts';
import type { ManagerBooks, ManagerSession } from '../types.ts';
import { markupAsk, MOMENTS, morning, morningDone } from './asks.ts';
import { laterOrders, orders } from './orders.ts';
import { customers, shop, t, team } from './shop.ts';
import { demoWrites } from './writes.ts';

export interface ManagerDemoFlags {
  at: number;
  state: string | null;
  offline: boolean;
  fail: string | null;
  clash: string | null;
  slow: boolean;
}

export function readFlags(search: string): ManagerDemoFlags {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const raw = (q.get('at') || '').replace(':', '');
  const at = /^\d{3,4}$/.test(raw) && Number(raw) % 100 < 60 && Number(raw) < 2400 ? Number(raw) : 940;
  const on = (k: string) => q.has(k) && q.get(k) !== '0';
  const name = (k: string) => { const v = (q.get(k) || '').trim(); return /^[a-zA-Z]+$/.test(v) ? v : null; };
  return { at, state: q.get('state'), offline: on('offline'), fail: name('fail'), clash: name('clash'), slow: on('slow') };
}

const hm = (n: number) => `${String(Math.floor(n / 100)).padStart(2, '0')}:${String(n % 100).padStart(2, '0')}`;
const copy = <T>(x: T): T => structuredClone(x);

/** The day at a moment: the books, and the clock. */
export function dayAt(f: ManagerDemoFlags): ManagerBooks {
  const ppl = team();
  const after = f.at >= 959;
  const moment = MOMENTS.filter((m) => m.at <= f.at).pop();
  const asks = f.state === 'empty' ? [] : after ? (moment ? moment.asks() : []) : morning();
  // The later cards' orders exist only from their own moment (BRIEF: "anything later sits only on a card labelled with its time").
  const os = [...orders(), ...(after ? laterOrders().filter((o) => o.createdAt <= t(hm(f.at))) : [])];
  if (f.state === 'twins') os.filter((o) => o.id === 545).forEach((o) => { o.invoiced = false; o.invoiceNo = null; });
  if (after) {
    // The eight answered 09:41–09:59 (Today p4): what the books show after them.
    os.forEach((o) => {
      if (o.id === 556) o.stage = 'cancelled';
      if (o.id === 550) o.lines[0].qty = 36;
      if (o.id === 552) o.lines[1].price = 33_750;
    });
    os.forEach((o) => { o.total = o.lines.reduce((s, l) => s + (l.price != null ? Math.round(l.price * l.qty) : 0), 0); });
  }
  if (moment && moment.at === 1015) os.filter((o) => o.id === 553).forEach((o) => { o.lines[0].cost = 31_000; o.lines[0].price = null; o.lines[0].buying = 'found'; o.lines[0].supplierName = 'Katwe'; });
  if (f.state === 'markup') asks.push(markupAsk(hm(f.at)));
  // &state=nocost (with &at=1015): #0553's Y12 has no known cost yet (DecidePrice disabled · no known cost).
  if (f.state === 'nocost') os.filter((o) => o.id === 553).forEach((o) => { o.lines[0].cost = null; o.lines[0].shopPrice = null; });
  return {
    at: t(hm(f.at)),
    me: ppl[0],
    shop: shop(),
    team: ppl,
    customers: customers(),
    orders: os,
    asks,
    restock: [
      // Denis's list for this trip (Added p4, AD05): 4,450,000 planned.
      { id: 'rb-80', name: 'Cement 50 kg', unit: 'bag', qty: 40, cost: 34_000, weeksLeft: 6, held: false },
      { id: 'rb-81', name: 'Iron sheet G28', unit: 'sht', qty: 60, cost: 38_000, weeksLeft: 2, held: false },
      { id: 'rb-82', name: 'Ridge cap 3 m', unit: 'pcs', qty: 30, cost: 27_000, weeksLeft: 3, held: true, heldBy: 'ruth', heldAt: t('16:40', '2026-10-15') },
    ],
    inToday: { cash: 1_960_000, momo: 876_000, bank: 0 },
    done: morningDone(after),
  };
}

const WRITE_MS = 250;
const SIGN_IN_MS = 1200;
const SLOW_MS = 60000;

export interface ManagerDemo extends ManagerSource {
  readonly day: ManagerBooks;
  readonly flags: ManagerDemoFlags;
}

export function managerDemo(search: string = '?demo', opts: { instant?: boolean } = {}): ManagerDemo {
  const f = readFlags(search);
  if (f.offline && typeof window !== 'undefined') window.addEventListener('online', () => { f.offline = false; });
  const b = dayAt(f);
  const now = b.at;
  let signedIn = f.state !== 'signed-out';
  let failed = false, clashed = false;
  const session = (): ManagerSession => ({ userId: 'u-ruth', shopId: 'shop-mukasa', shopName: b.shop.name, email: 'ruth@mukasa.test', role: 'manager', staffId: 'ruth' });
  const W = demoWrites(() => b, () => now) as unknown as Record<WriteName, (...a: unknown[]) => void>;

  const wait = <T>(fn: () => T, write = false): Promise<T> => new Promise((resolve, reject) => {
    const run = () => { try { resolve(fn()); } catch (e) { reject(e); } };
    if (opts.instant) run(); else setTimeout(run, f.slow && write ? SLOW_MS : WRITE_MS);
  });
  const write = (name: WriteName) => (...args: unknown[]): Promise<void> => {
    if (f.offline) return Promise.reject(dataError('offline', 'No signal'));
    if (f.fail === name && !failed) { failed = true; return wait(() => { throw dataError('refused', 'That did not save', 'MG-502'); }, true); }
    if (f.clash === name && !clashed) { clashed = true; return wait(() => { throw dataError('clash', 'Someone else just did this'); }, true); }
    return wait(() => {
      try { W[name](...args); } catch (e) { throw dataError('refused', e instanceof Error ? e.message : String(e)); }
    }, true);
  };
  const read = (): Promise<ManagerBooks> => {
    if (f.state === 'loading') return new Promise(() => { /* never answers */ });
    if (f.state === 'no-reach') return Promise.reject(dataError('offline', 'No signal'));
    return wait(() => ({ ...copy(b), at: f.offline ? t('09:38') : now }));
  };

  const src = {
    kind: 'demo' as const,
    get day() { return b; },
    flags: f,
    now: () => now,
    online: () => !f.offline && f.state !== 'no-reach',
    session: async () => (signedIn ? session() : null),
    signIn: async (email: string, password: string) => {
      if (!email.trim() || !password) throw dataError('refused', 'Wrong email or password', 'auth');
      if (f.offline) throw dataError('offline', 'No signal');
      if (!opts.instant) await new Promise((r) => setTimeout(r, SIGN_IN_MS));
      signedIn = true;
      return session();
    },
    signOut: async () => { signedIn = false; },
    snapshot: read,
    live: read,
    savedCopy: async () => (f.state === 'no-reach' || f.offline ? { ...copy(b), at: t('09:38') } : null),
  } as Record<string, unknown>;
  for (const k of Object.keys(W) as WriteName[]) src[k] = write(k);
  return src as unknown as ManagerDemo;
}
