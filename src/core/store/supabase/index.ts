/*
 * The Store's real books: StoreSource over Supabase, read and written as
 * store.html does (docs/spec/04-screens-store-data.md). Reads in read.ts, rows
 * mapped in rows.ts, order writes in order.ts, the rest in yard.ts. The client,
 * the session and the error classing are the shared core's (src/core/supabase).
 *
 * The source keeps the snapshot as last read: a live read lays store_live over
 * it, and an order write sends what the phone saw of that order (p_expect).
 * W7 (put back) is stamped on the order (0182 payload.putBack), so every phone sees it.
 */
import { dataError, isDataError } from '../../datasource.ts';
import { client, isNetwork, type Row, type Sb } from '../../supabase/client.ts';
import { pushOn as pushOnShared } from '../../supabase/push.ts';
import type { StoreSource } from '../source.ts';
import type { StoreSession, YardBooks } from '../types.ts';
import { orderWrites } from './order.ts';
import { readCountArrived, readLive, readOrderRow, readSide, readSnapshot, readStoreSession, readWaitingCount } from './read.ts';
import { booksOf, orderOf, type Snap } from './rows.ts';
import { yardWrites } from './yard.ts';

/** The Store keeps its own sign-in (as Sales 'ow-sales-auth', the Buyer 'ow-buyer-auth'). */
export const STORE_AUTH_KEY = 'ow-store-auth';

function classify(e: unknown): never {
  if (isDataError(e)) throw e;
  if (isNetwork(e)) throw dataError('offline', 'No signal');
  throw dataError('refused', String((e as Error)?.message || e));
}

export function storeSupabase(): StoreSource {
  let session: StoreSession | null = null;
  let snap: Snap | null = null;
  let books: YardBooks | null = null;

  const sb = (): Sb => {
    const c = client(STORE_AUTH_KEY);
    if (!c) throw dataError('offline', 'No signal');
    return c.sb;
  };
  const me = (): StoreSession => {
    if (!session) throw dataError('signed-out', 'Sign in again');
    return session;
  };
  const take = (d: Snap): YardBooks => {
    snap = d;
    const s = me();
    if (d.me && d.me.staff_id) s.staffId = String(d.me.staff_id);
    books = booksOf(d, s, Date.now());
    return books;
  };
  const seen = (id: number): Row | null => {
    const r = snap && (snap.orders || []).find((x: Row) => Number(x.id) === Number(id));
    if (!r) return null;
    const p = r.payload || {};
    return { status: r.status, pickingStatus: p.pickingStatus ?? null, pickingDoneAt: p.pickingDoneAt ?? null, carrierAt: p.carrier && p.carrier.at != null ? p.carrier.at : null };
  };
  /** A write, then nothing cached about the order it changed: the shell reads live again after every write. */
  const w = <A extends unknown[]>(fn: (...a: A) => Promise<unknown>) => async (...a: A): Promise<void> => {
    try { await fn(...a); } catch (e) { classify(e); }
  };
  const O = () => orderWrites(sb(), me(), seen, () => books);
  const Y = () => yardWrites(sb(), me(), () => snap);

  const src: StoreSource = {
    kind: 'supabase',
    now: () => Date.now(),
    online: () => typeof navigator === 'undefined' || navigator.onLine !== false,

    async session() {
      try { session = await readStoreSession(sb()); } catch (e) { classify(e); }
      return session;
    },
    async signIn(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw isNetwork(error) ? dataError('offline', 'No signal') : dataError('refused', 'Wrong email or password', 'auth');
      const s = await src.session();
      if (!s) throw dataError('signed-out', 'Sign in again');
      return s;
    },
    async signOut() {
      session = null; snap = null; books = null;
      await sb().auth.signOut();
    },
    async resetPassword(email) {
      const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + '/store.html' });
      if (error) classify(error);
    },

    async snapshot() { try { return take(await readSnapshot(sb(), me())); } catch (e) { return classify(e); } },
    async live() {
      try { return take(snap ? await readLive(sb(), me(), snap) : await readSnapshot(sb(), me())); } catch (e) { return classify(e); }
    },
    async order(id) {
      try { const r = await readOrderRow(sb(), me(), id); return r ? orderOf(r, (snap && snap.holds) || {}) : null; } catch (e) { return classify(e); }
    },
    async side() { try { return await readSide(sb(), me()); } catch (e) { return classify(e); } },
    async waitingCount(place) { try { return await readWaitingCount(sb(), me(), place); } catch (e) { return classify(e); } },
    async countArrived(aisle, since) { try { return await readCountArrived(sb(), me(), aisle, since); } catch (e) { return classify(e); } },

    claim: w((id: number) => O().claim(id)),
    pick: w((id, answers, cursor) => O().pick(id, answers, cursor)),
    finishPack: w((id, bay) => O().finishPack(id, bay)),
    setBay: w((id, bay) => O().setBay(id, bay)),
    unpack: w((id: number) => O().unpack(id)),
    release: w((id, putBack) => O().release(id, putBack)),
    putBack: w((id: number) => O().putBack(id)),
    load: w((ids, c) => O().load(ids, c)),
    handOver: w((id, name, agent) => O().handOver(id, name, agent)),
    deliver: w((id, proof) => O().deliver(id, proof)),
    cantDeliver: w((id, why) => O().cantDeliver(id, why)),
    askLetGo: w((id, c) => O().askLetGo(id, c)),
    withdrawLetGo: w((id: number) => O().withdrawLetGo(id)),
    nameDirection: w((key, name) => Y().nameDirection(key, name)),
    lockRoute: w((from, to) => Y().lockRoute(from, to)),
    checkIn: w((lines) => Y().checkIn(lines)),
    notOnList: w((x) => Y().notOnList(x)),
    returnAsk: w((r) => Y().returnAsk(r)),
    withdrawReturn: w((id: string) => Y().withdrawReturn(id)),
    rideTick: w((id, got) => Y().rideTick(id, got)),
    rideHandIn: w((ids) => Y().rideHandIn(ids)),
    restock: w((r) => Y().restock(r)),
    reportLoss: w((r) => Y().reportLoss(r)),
    sendCount: w((c) => Y().sendCount(c)),
    replaceCount: w((id, c) => Y().replaceCount(id, c)),
    passYard: w((p) => Y().passYard(p)),
    gotYard: w((id: string) => Y().gotYard(id)),
    closeYard: w((c) => Y().closeYard(c)),
    setMyName: w((name: string) => Y().setMyName(name)),
    async pushOn() { await pushOnShared(sb(), me()); },
  };
  return src;
}
