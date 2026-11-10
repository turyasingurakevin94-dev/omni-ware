/*
 * The Buyer's real books (docs/spec/04-screens-buyer-data.md): reads and
 * writes exactly as buyer.html does. Stand-in until it is built: signed out.
 */
import { dataError } from '../datasource.ts';
import type { BuyerSource } from './source.ts';

export function buyerSupabase(): BuyerSource {
  const no = (): Promise<never> => Promise.reject(dataError('missing', 'Not built yet'));
  return {
    kind: 'supabase', now: () => Date.now(), online: () => navigator.onLine,
    session: async () => null, signIn: no, signOut: async () => undefined, books: no,
    ask: no, answerYes: no, answerPrice: no, answerNo: no, otherSupplier: no, clientWaits: no, removeLine: no, switchItem: no,
    setStopOff: no, askCash: no, stopDone: no, handIn: no, confirmPrice: no, suggestPhone: no, askSourcing: no,
  };
}
