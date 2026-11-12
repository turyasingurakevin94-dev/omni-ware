/*
 * The yard's bays (docs/spec/04-screens-store.md §4.2 "The bay is picked for you";
 * store.html:2828 bayMap, 2837 freeBay, 4214 pkFinish, 4319 pkbay). One order per bay.
 * Bays are presets.bays (default 4, 1 to 12).
 *
 *   bayCount(b)      how many bays the shop has (1–12)
 *   bayMap(b)        bay → the order on it: every order still in the yard with a bay, and a packed
 *                    order with no valid bay shown in the first free one, so none is hidden
 *   freeBays(b)      the bays nobody is on
 *   bayFor(o, b)     the order's own bay if it has one, else the bay the map shows it on, else the
 *                    first free bay; null: every bay is full, "leave it by the gate"
 */
import { isCancelled } from './yard.ts';
import type { YardBooks, YardOrder } from './types.ts';

export const bayCount = (b: Pick<YardBooks, 'bays'>): number => Math.min(12, Math.max(1, Math.round(Number(b.bays) || 4)));

const valid = (b: Pick<YardBooks, 'bays'>, n: number | null): n is number => n != null && Number.isInteger(n) && n >= 1 && n <= bayCount(b);

/** Still in the yard: in Packing, or cancelled before it left (its goods wait to go back). */
function inYard(o: YardOrder): boolean {
  if (o.carrier || o.deliveredAt) return false;
  return o.status === 'preparing' || (isCancelled(o) && o.status !== 'completed' && o.status !== 'pending_delivery');
}

export function bayMap(b: Pick<YardBooks, 'bays' | 'orders'>): Map<number, YardOrder> {
  const map = new Map<number, YardOrder>();
  const yard = b.orders.filter(inYard);
  yard.forEach((o) => { if (valid(b, o.bay) && !map.has(o.bay)) map.set(o.bay, o); });
  // A packed order with no valid bay (or a bay someone else holds) is shown in the first free one.
  yard.filter((o) => o.pickingStatus === 'done' && ![...map.values()].includes(o)).forEach((o) => {
    for (let n = 1; n <= bayCount(b); n++) if (!map.has(n)) { map.set(n, o); return; }
  });
  return map;
}

export function freeBays(b: Pick<YardBooks, 'bays' | 'orders'>): number[] {
  const map = bayMap(b), out: number[] = [];
  for (let n = 1; n <= bayCount(b); n++) if (!map.has(n)) out.push(n);
  return out;
}

/** The bay picked for you. */
export function bayFor(o: YardOrder, b: Pick<YardBooks, 'bays' | 'orders'>): number | null {
  const map = bayMap(b);
  if (valid(b, o.bay) && (!map.has(o.bay) || map.get(o.bay)?.id === o.id)) return o.bay;
  for (const [n, x] of map) if (x.id === o.id) return n;
  const free = freeBays(b);
  return free.length ? free[0] : null;
}
