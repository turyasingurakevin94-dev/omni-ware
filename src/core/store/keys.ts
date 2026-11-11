/*
 * The yard's keys, each the server's own rule (docs/spec/04-screens-store-data.md §4):
 *
 *   stockKey      productId, or productId::variantIdx (store.html:1700; the stock table's key)
 *   countPlace    'aisle:<category>' or 'item:<key>' (store.html:1158; ow_count_place, 0161)
 *   tripRoundKey  trips with the same id stem and runner are one trip (store.html:1569; ow_trip_round, 0147)
 *   lineKey       a pick draft's key: L<lineId>, else I<index> (store.html:1535)
 *   msOf          a time the books keep as ISO text or ms, as ms
 */
import { stockKey } from '../supabase/rows.ts';
import type { Ms } from '../types.ts';

export { stockKey };

export function countPlace(aisle: string, keys: string[] = []): string | null {
  const a = String(aisle || ''), i = a.indexOf(' · ');
  if (/^spot count/i.test(a)) return 'item:' + (keys[0] || a.trim().toLowerCase());
  return /^aisle /i.test(a) && i > 0 ? 'aisle:' + a.slice(i + 3).trim().toLowerCase() : null;
}

export function tripRoundKey(t: { id: string; runnerId: string | null }): string {
  const m = /^(TRIP-[A-Za-z0-9]+)-\d+$/.exec(String(t.id || ''));
  return (m ? m[1] : String(t.id || '')) + '|' + (t.runnerId || '');
}

/** The trips of one round, together ("Denis's trip · 2 suppliers" is one check-in). */
export function roundsOf<T extends { id: string; runnerId: string | null }>(trips: T[]): T[][] {
  const g = new Map<string, T[]>();
  trips.forEach((t) => { const k = tripRoundKey(t); g.set(k, [...(g.get(k) || []), t]); });
  return [...g.values()];
}

export function lineKey(l: { lineId: string | null }, idx: number): string {
  return l.lineId ? 'L' + l.lineId : 'I' + idx;
}

export function msOf(v: unknown): Ms | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v);
  if (/^\d{10,}(\.\d+)?$/.test(s)) return Number(s);
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}
