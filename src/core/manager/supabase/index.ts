/*
 * The Manager's real books, behind ManagerSource (docs/spec/04-screens-manager-data.md):
 * reads in read.ts, rows mapped in rows.ts (the asks in asks.ts, the line rules in lines.ts),
 * answers in write.ts. The client, the session, the error classing and the push sign-up are the
 * shared core's (src/core/supabase).
 *
 * The source keeps the rows as last read: a live read lays the orders that can change and
 * every queue over them, and an answer looks up what it needs there (the price book, the ask's row).
 * The shell reads live again after every write (src/apps/manager/shell/store.ts).
 */
import { dataError, isDataError } from '../../datasource.ts';
import { client, isNetwork, type Sb } from '../../supabase/client.ts';
import { pushOn as pushOnShared } from '../../supabase/push.ts';
import type { ManagerSource } from '../source.ts';
import type { ManagerBooks, ManagerSession } from '../types.ts';
import { readLive, readManagerSession, readSnapshot, type MSession, type Raw } from './read.ts';
import { booksOf, ctxOf, type Ctx } from './rows.ts';
import { managerWrites } from './write.ts';

/** The Manager keeps its own sign-in (as Sales 'ow-sales-auth', the Store 'ow-store-auth'). */
export const MANAGER_AUTH_KEY = 'ow-manager-auth';

function classify(e: unknown): never {
  if (isDataError(e)) throw e;
  if (isNetwork(e)) throw dataError('offline', 'No signal');
  const x = e as { message?: string; code?: string } | null;
  throw dataError('refused', String((x && x.message) || e), String((x && x.code) || ''));
}

const asSession = (s: MSession): ManagerSession => ({ userId: s.userId, shopId: s.shopId, shopName: s.shopName, email: s.email, role: s.role, staffId: s.staffId });

export function managerSupabase(): ManagerSource {
  let session: MSession | null = null;
  let raw: Raw | null = null;
  let ctx: Ctx | null = null;

  const sb = (): Sb => {
    const c = client(MANAGER_AUTH_KEY);
    if (!c) throw dataError('offline', 'No signal');
    return c.sb;
  };
  const me = (): MSession => {
    if (!session) throw dataError('signed-out', 'Sign in again');
    return session;
  };
  const take = (r: Raw): ManagerBooks => {
    const now = Date.now();
    raw = r; ctx = ctxOf(r, me(), now);
    return booksOf(r, me(), now);
  };
  const writes = () => managerWrites({ sb: sb(), s: me(), ctx: () => ctx });
  type W = ReturnType<typeof managerWrites>;
  const w = <K extends keyof W>(k: K) => (async (...a: Parameters<W[K]>): Promise<void> => {
    try { await (writes()[k] as (...x: Parameters<W[K]>) => Promise<void>)(...a); } catch (e) { classify(e); }
  }) as W[K];

  const src: ManagerSource = {
    kind: 'supabase',
    now: () => Date.now(),
    online: () => typeof navigator === 'undefined' || navigator.onLine !== false,

    async session() {
      try { session = await readManagerSession(sb()); } catch (e) { classify(e); }
      return session ? asSession(session) : null;
    },
    async signIn(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw isNetwork(error) ? dataError('offline', 'No signal') : dataError('refused', 'Wrong email or password', 'auth');
      const s = await src.session();
      if (!s) throw dataError('signed-out', 'Sign in again');
      return s;
    },
    async signOut() {
      session = null; raw = null; ctx = null;
      await sb().auth.signOut();
    },

    async snapshot() { try { return take(await readSnapshot(sb(), me(), Date.now())); } catch (e) { return classify(e); } },
    async live() {
      try { return take(raw ? await readLive(sb(), me(), raw, Date.now()) : await readSnapshot(sb(), me(), Date.now())); } catch (e) { return classify(e); }
    },

    price: w('price'), costAndPrice: w('costAndPrice'), askCost: w('askCost'), markup: w('markup'),
    credit: w('credit'), storeCredit: w('storeCredit'), limitAsk: w('limitAsk'), setLimit: w('setLimit'),
    invoiceNow: w('invoiceNow'), billSmall: w('billSmall'), givenAway: w('givenAway'), settlePick: w('settlePick'),
    takeCheckin: w('takeCheckin'), extra: w('extra'), writeOff: w('writeOff'), keepOnShelf: w('keepOnShelf'),
    countTaken: w('countTaken'), countAgain: w('countAgain'), restock: w('restock'), carton: w('carton'),
    creditNote: w('creditNote'), keepSold: w('keepSold'), voidBill: w('voidBill'), keepBilled: w('keepBilled'),
    cancel: w('cancel'), keepOrder: w('keepOrder'), cancelTwin: w('cancelTwin'), bothReal: w('bothReal'), agent: w('agent'),
    merge: w('merge'), notSame: w('notSame'), opening: w('opening'), promise: w('promise'), goals: w('goals'),
    stageLimits: w('stageLimits'), holdDays: w('holdDays'), nudge: w('nudge'), giveTo: w('giveTo'),

    async pushOn() { try { await pushOnShared(sb(), me()); } catch (e) { classify(e); } },
  };
  return src;
}
