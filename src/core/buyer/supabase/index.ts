/*
 * The Buyer's real books: BuyerSource over Supabase, read and written as
 * buyer.html does (docs/spec/04-screens-buyer-data.md). Reads in read.ts,
 * rows mapped in rows.ts, order writes in write.ts, the trip in trip.ts,
 * the phone's own keep in keep.ts. The client, the session and the errors
 * are the Sales core's (src/core/supabase).
 *
 * Every write starts from the books as last read (the raw rows), changes
 * each order on the copy just re-read from the server, then reads the
 * books again so the app sees what the server kept.
 */
import { dataError, isDataError } from '../../datasource.ts';
import type { Session } from '../../types.ts';
import { client, isNetwork, type Sb } from '../../supabase/client.ts';
import { askSourcing as askSourcingShared } from '../../supabase/write.ts';
import type { BuyerSource } from '../source.ts';
import { readAppAnswers, readBuyerSession, readRaw } from './read.ts';
import { booksOf, type Raw } from './rows.ts';
import * as T from './trip.ts';
import * as W from './write.ts';

/** The Buyer keeps its own sign-in (as Sales does under 'ow-sales-auth'); the shared login is carried over once. */
export const BUYER_AUTH_KEY = 'ow-buyer-auth';

/** Any failure as a DataError: no signal, refused, missing, signed out (as src/core/supabase does). */
function classify(e: unknown): never {
  if (isDataError(e)) throw e;
  if (isNetwork(e)) throw dataError('offline', 'No signal');
  throw dataError('refused', String((e as Error)?.message || e));
}

export function buyerSupabase(): BuyerSource {
  let session: Session | null = null;
  let raw: Raw | null = null;

  const sb = (): Sb => {
    const c = client(BUYER_AUTH_KEY);
    if (!c) throw dataError('offline', 'No signal');
    return c.sb;
  };
  const me = (): Session => {
    if (!session) throw dataError('signed-out', 'Sign in again');
    return session;
  };
  const read = async (): Promise<Raw> => {
    raw = await readRaw(sb(), me(), Date.now());
    return raw;
  };
  const last = async (): Promise<Raw> => raw || read();
  /** A write: the books as last read in, the books read again after (even when it failed half way). */
  const write = async (fn: (sb: Sb, s: Session, r: Raw, now: number) => Promise<unknown>): Promise<void> => {
    try { await fn(sb(), me(), await last(), Date.now()); } catch (e) { raw = null; classify(e); }
    raw = null;
  };

  const src: BuyerSource = {
    kind: 'supabase',
    now: () => Date.now(),
    online: () => typeof navigator === 'undefined' || navigator.onLine !== false,

    async session() {
      try { session = await readBuyerSession(sb()); } catch (e) { classify(e); }
      return session;
    },
    async signIn(email, password) {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw isNetwork(error) ? dataError('offline', 'No signal') : dataError('refused', String(error.message || error));
      const s = await src.session();
      if (!s) throw dataError('signed-out', 'Sign in again');
      return s;
    },
    async signOut() {
      session = null; raw = null;
      await sb().auth.signOut();
    },

    async books() {
      const s = me();
      let r = await read();
      // buyer.html:1611 readAppAnswers on every load: a supplier-app answer is folded into its order (W3).
      const answers = await readAppAnswers(sb(), s, r.now);
      if (answers.length && await W.foldAnswers(sb(), s, r, answers, Date.now())) r = await read();
      return booksOf(r);
    },

    ask: (sid, way) => write((c, s, r, now) => W.ask(c, s, r, sid, way, now)),
    answerYes: (sid) => write((c, s, r, now) => W.answer(c, s, r, sid, 'confirmed', now)),
    answerPrice: (sid, prices) => write((c, s, r, now) => W.answerPrice(c, s, r, sid, prices, now)),
    answerNo: (sid) => write((c, s, r, now) => W.answer(c, s, r, sid, 'problem', now)),
    undoAnswer: (sid) => write((c, s, r, now) => W.undoAnswer(c, s, r, sid, now)),

    otherSupplier: (id, key, sid, cost) => write((c, s, r, now) => W.otherSupplier(c, s, r, id, key, sid, cost, now)),
    clientWaits: (id, key) => write((c, s, r, now) => W.clientWaits(c, s, r, id, key, now)),
    removeLine: (id, key, reason) => write((c, s, r, now) => W.removeLine(c, s, r, id, key, reason, now)),
    switchItem: (id, key, to) => write((c, s, r, now) => W.switchItem(c, s, r, id, key, to, now)),

    setStopOff: (sid, off) => write((c, s, r) => T.setStopOff(c, s, r, sid, off)),
    askCash: () => write((c, s, r) => T.askCash(c, s, r)),
    stopDone: (sid, counts, paid) => write((c, s, r, now) => T.stopDone(c, s, r, sid, counts, paid, now)),
    undoStop: (sid) => write((c, s, r) => T.undoStop(c, s, r, sid)),
    handIn: () => write((c, s, r, now) => T.handIn(c, s, r, now)),

    confirmPrice: (sid, productId, item, price) => write((c, s, r) => W.confirmPrice(c, s, r, sid, productId, item, price)),
    suggestPhone: (sid, phone) => write((c, s, r) => W.suggestPhone(c, s, r, sid, phone)),
    // An item nobody sells (the canvas's "Ask Moses to find it"): the same Sourcing ask Sales makes
    // (sourcing_leads, its push to Sourcing), with no customer or chat.
    askSourcing: (item) => write((c, s, _r, now) => askSourcingShared(c, s, { name: item, qty: 1, customerId: null, chatId: null }, null, now)),
  };
  return src;
}
