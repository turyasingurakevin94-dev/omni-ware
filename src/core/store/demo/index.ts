/*
 * The Store demo: the sample day of docs/canvas/store-agent/FACTS.md in memory, behind
 * StoreSource. Every read hands out a copy; every write changes the day as its server
 * function would (writes.ts), after a short wait so "Sending…" is seen. The switches
 * (?demo&at=1130&state=…&offline&fail=checkIn) are in flags.ts.
 *
 *   storeDemo('?demo')                          10:41, Musa's phone
 *   storeDemo('?demo&at=1130', { instant: true })  for tests: writes land at once
 *
 * Offline: reads give the copy saved 7:52 (YardBooks.at), writes are refused as
 * 'offline' (the outbox keeps them: "Not sent yet"). &fail=<write> refuses that write
 * once with its board code (the red bar); the next try goes.
 */
import { dataError } from '../../datasource.ts';
import type { StoreSource, WriteName } from '../source.ts';
import type { StoreSession, YardBooks } from '../types.ts';
import { FAIL_CODE, readStoreFlags, type StoreDemoFlags } from './flags.ts';
import { dayAt, okelloTakes0556 } from './moments.ts';
import { earlier } from './moments-out.ts';
import { t } from './shop.ts';
import { demoWrites } from './writes.ts';
import { shelfClash } from './shelf.ts';
import { WRITE_CODE } from '../errors.ts';
import { putAway } from '../yard.ts';
import type { Kept } from '../../outbox.ts';

/** TD06: #0552's iron sheets packed at 10:30 and the bent sheets reported at 10:24, both kept (no signal). */
function keptSeed(): Kept[] {
  const k = (id: string, kind: string, args: unknown, hm: string): Kept => ({ id, kind, args, at: t(hm), tries: 1, state: 'kept', reason: '' });
  return [
    k('kept-pick', 'pick', [552, [{ idx: 0, status: 'done', qty: 40 }], 1], '10:30'),
    k('kept-rep', 'reportLoss', [{ key: 'p-is28', productId: 'p-is28', variantIdx: null, name: 'Iron sheet G28 · 3m', qty: 3, why: 'damaged', photo: null, note: 'Bent' }], '10:24'),
  ];
}

const WRITE_MS = 250;
/** The demo's sign-in takes this long (TD23 "Signing in…"). */
const SIGN_IN_MS = 1500;
/** &slow=1: long enough for a board's "Sending…" to be seen and shot. */
const SLOW_MS = 60000;
const copy = <T>(x: T): T => structuredClone(x);

export interface StoreDemo extends StoreSource {
  /** The day itself, for tests. */
  readonly day: YardBooks;
  readonly flags: StoreDemoFlags;
  /** Writes already kept on this phone when the app opens (&kept: TD06's Waiting to send). */
  readonly kept: Kept[];
}

export function storeDemo(search: string = '?demo', opts: { instant?: boolean } = {}): StoreDemo {
  const f = readStoreFlags(search);
  // &offline: the browser's own 'online' event brings the signal back (the e2e turns it with
  // context.setOffline), so a kept write can then be sent. Nothing else fires it on the demo.
  if (f.offline && typeof window !== 'undefined') window.addEventListener('online', () => { f.offline = false; });
  const { books: b, now } = dayAt(f);
  earlier(b, f.at); // &at=930 · 1010: the Out area's empty boards (OU14, OU15)
  let signedIn = f.state !== 'signed-out', failed = false, beaten = false;
  const session = (): StoreSession => ({ userId: b.me.userId || 'u-mk', shopId: 'shop-mukasa', shopName: b.shopName, role: b.me.role, name: b.me.name, staffId: b.me.id });
  const clock = () => now;
  const W = demoWrites(() => b, clock);

  const wait = <T>(fn: () => T, write = false): Promise<T> => new Promise((resolve, reject) => {
    const run = () => { try { resolve(fn()); } catch (e) { reject(e); } };
    if (opts.instant) run(); else setTimeout(run, f.slow && write ? SLOW_MS : WRITE_MS);
  });
  /** A write: offline is kept; &fail=<name> fails once with its board code; else it lands. */
  const clashed = { v: false };
  let clashArgs: unknown[] | null = null;
  const later = (name: WriteName, fn: () => void): Promise<void> => {
    if (f.offline) return Promise.reject(dataError('offline', 'No signal'));
    if (f.fail === name && !failed) { failed = true; return wait(() => { throw dataError('refused', 'That did not save', FAIL_CODE[name] || `${WRITE_CODE[name] || 'ST'}-502`); }); }
    if (clashArgs && shelfClash(b, f, name, clashArgs, now, clashed)) return wait(() => { throw dataError('clash', 'Someone else just did this'); });
    return wait(() => { fn(); b.at = now; }, true);
  };
  const read = (): Promise<YardBooks> => {
    if (f.state === 'loading') return new Promise(() => { /* never answers: "Checking your shop…" */ });
    if (f.state === 'no-reach') return Promise.reject(dataError('offline', 'No signal'));
    if (f.fail === 'snapshot' && !failed) { failed = true; return wait(() => { throw dataError('refused', 'Could not load the yard', FAIL_CODE.snapshot); }); }
    // No signal: the copy this phone saved at 7:52. A put-back order leaves the day, as the real books read it (rows.ts).
    return wait(() => { const c = copy(b); return { ...c, orders: c.orders.filter((o) => !putAway(o)), at: f.offline ? t('7:52') : now }; });
  };

  const src: StoreDemo = {
    kind: 'demo',
    get day() { return b; },
    flags: f,
    // TD22: the shop cannot be reached, but this phone kept its 7:52 copy and two writes (as &offline&kept=1).
    kept: f.kept || f.state === 'no-reach' ? keptSeed() : [],
    now: clock,
    online: () => !f.offline && f.state !== 'no-reach',

    session: async () => (signedIn ? session() : null),
    signIn: async (email, password) => {
      if (!email.trim() || !password) throw dataError('refused', 'Wrong email or password', 'auth');
      if (f.offline) throw dataError('offline', 'No signal');
      // As long as a real sign-in on yard signal, so Signing in… can be seen (TD23).
      if (!opts.instant) await new Promise((r) => setTimeout(r, SIGN_IN_MS));
      signedIn = true;
      return session();
    },
    signOut: async () => { signedIn = false; },
    resetPassword: async () => undefined,

    snapshot: read,
    savedCopy: async () => { if (f.state !== 'no-reach' && !f.offline) return null; const c = copy(b); return { ...c, orders: c.orders.filter((o) => !putAway(o)), at: t('7:52') }; },
    live: read,
    order: async (id) => { const o = b.orders.find((x) => x.id === id); return o ? copy(o) : null; },
    side: async () => ({
      places: [
        { name: 'Mukasa Hardware', lat: 0.3136, lng: 32.5811 }, { name: 'Ntinda', lat: 0.3540, lng: 32.6150 },
        // East of the yard (OU31: Bweyogerere, Kireka and Jinja Rd are "that way", one sector apart from Ntinda).
        { name: 'Bweyogerere', lat: 0.3300, lng: 32.6720 }, { name: 'Kireka', lat: 0.3330, lng: 32.6420 }, { name: 'Jinja Rd', lat: 0.3180, lng: 32.6100 },
        { name: 'Ggaba', lat: 0.2630, lng: 32.6300 }, { name: 'Lubowa', lat: 0.2440, lng: 32.5700 },
      ],
      routes: [], roadNames: { ntinda: 'Ntinda', ggaba: 'Ggaba' },
    }),
    waitingCount: async (place) => copy(b.counts.find((c) => c.status === 'sent' && c.place === place) || null),
    countArrived: async (aisle, since) => b.counts.some((c) => c.aisle === aisle && c.countedBy === b.me.userId && c.createdAt >= since),

    // &state=okello-0556: Musa's first Packed on #0556 finds Okello took it (the clash, PK13).
    claim: (id) => {
      if (f.state === 'okello-0556' && id === 556 && !b.orders.some((o) => o.id === 556 && o.assignedWorkerId === 'st-op')) {
        return wait(() => { okelloTakes0556(b); b.at = now; throw dataError('clash', 'Someone else is packing it'); });
      }
      return later('claim', () => W.claim(id));
    },
    pick: (id, a, cursor) => later('pick', () => W.pick(id, a, cursor)),
    finishPack: (id, bay) => later('finishPack', () => W.finishPack(id, bay)),
    setBay: (id, bay) => later('setBay', () => W.setBay(id, bay)),
    unpack: (id) => later('unpack', () => W.unpack(id)),
    release: (id, putBack) => later('release', () => W.release(id, putBack)),
    // Recorded on the order (0183): no signal keeps it; &fail=putBack fails it once (PK22).
    putBack: (id) => later('putBack', () => W.putBack(id)),
    load: (ids, c) => later('load', () => W.load(ids, c)),
    handOver: (id, name, agent) => later('handOver', () => W.handOver(id, name, agent)),
    deliver: (id, p) => later('deliver', () => W.deliver(id, p)),
    cantDeliver: (id, why) => later('cantDeliver', () => W.cantDeliver(id, why)),
    askLetGo: (id, c) => later('askLetGo', () => W.askLetGo(id, c)),
    withdrawLetGo: (id) => later('withdrawLetGo', () => W.withdrawLetGo(id)),
    nameDirection: (k, n) => later('nameDirection', () => W.nameDirection(k, n)),
    lockRoute: () => later('lockRoute', () => W.lockRoute()),
    checkIn: (lines) => later('checkIn', () => {
      // &state=someone-checkin: Okello checked the same trip in at 11:32, with the same counts (IN09).
      if (f.state === 'someone-checkin' && !beaten) {
        beaten = true;
        W.checkIn(lines, b.people.find((p) => p.id === 'st-op') || null, t('11:32'));
        throw dataError('clash', 'Someone else checked it in');
      }
      W.checkIn(lines);
    }),
    notOnList: (x) => later('notOnList', () => W.notOnList(x)),
    returnAsk: (r) => later('returnAsk', () => W.returnAsk(r)),
    withdrawReturn: (id) => later('withdrawReturn', () => W.withdrawReturn(id)),
    rideTick: (id, got) => later('rideTick', () => W.rideTick(id, got)),
    rideHandIn: (ids) => later('rideHandIn', () => W.rideHandIn(ids)),
    restock: (r) => later('restock', () => W.restock(r)),
    reportLoss: (r) => later('reportLoss', () => W.reportLoss(r)),
    sendCount: (c) => { clashArgs = [c]; const p = later('sendCount', () => W.sendCount(c)); clashArgs = null; return p; },
    replaceCount: (id, c) => { clashArgs = [id, c]; const p = later('replaceCount', () => W.replaceCount(id, c)); clashArgs = null; return p; },
    passYard: (p) => later('passYard', () => W.passYard(p)),
    gotYard: (id) => later('gotYard', () => W.gotYard(id)),
    closeYard: (c) => later('closeYard', () => W.closeYard(c)),
    setMyName: (n) => later('setMyName', () => W.setMyName(n)),
  };
  return src;
}
