/*
 * The Manager's real books, behind ManagerSource (docs/spec/04-screens-manager-data.md).
 * Being built: until every read and write is here, the app runs on ?demo only.
 */
import { dataError } from '../../datasource.ts';
import type { ManagerSource } from '../source.ts';

export function managerSupabase(): ManagerSource {
  const no = () => Promise.reject(dataError('refused', 'The real books are not connected yet', 'MG-000'));
  return new Proxy({ kind: 'supabase', now: () => Date.now(), online: () => true, session: async () => null, signIn: no, signOut: async () => undefined, snapshot: no, live: no } as unknown as ManagerSource, {
    get: (t, k) => (k in t ? (t as unknown as Record<string | symbol, unknown>)[k] : no),
  });
}
