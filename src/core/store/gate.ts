/*
 * The gate (docs/spec/04-screens-store.md §4.4; OU10–OU16, OU09, OU11): who collects, by name or by
 * an agent's code, and what waits there. Hand over is the gate's word only (WORD-02).
 *
 *   atTheGate(b, me, now)    ready to collect, oldest first, agents last (Not paid yet included: it stays, OU13)
 *   isAgent(o)               an agent's pickup: collected by the 4-digit code
 *   codeOf(o)                the code is the order number, "0554" (store.html:5065 agTry)
 *   codeSays(o, typed)       'short' · 'match' · 'wrong' ("Not #0554 · ask Peter to read it again")
 *   collector(o)             the name and phone prefilled from the order ("Walk-in · 0772 418 905")
 *   collectedToday(b, now)   "#0543 · collected 8:50"
 *   comingToTheGate(b, …)    what will reach the gate next: pickups packing or to pack (OU15)
 */
import { phoneText } from '../names.ts';
import { dayOf } from '../time.ts';
import type { Ms } from '../types.ts';
import type { YardBooks, YardOrder } from './types.ts';
import { isPickup, ordersAt, stageOf } from './yard.ts';

export function isAgent(o: YardOrder): boolean {
  return o.deliveryMode === 'agent_pickup' || o.assignedDeliveryId === '__agent__' || !!o.originAgentId;
}

export const codeOf = (o: YardOrder): string => String(o.id).padStart(4, '0').slice(-4);

/** What the four boxes say: not all typed yet, the order's code, or another. */
export function codeSays(o: YardOrder, typed: string): 'short' | 'match' | 'wrong' {
  if (typed.length < 4) return 'short';
  return typed === codeOf(o) ? 'match' : 'wrong';
}

/** Ready to collect at the gate, oldest first; agents after the rest, since they come by their code. */
export function atTheGate(b: YardBooks, me: string | null, now: Ms): YardOrder[] {
  return ordersAt(b, 'ready', me, now).slice().sort((x, y) => Number(isAgent(x)) - Number(isAgent(y)));
}

/** The name the gate hands it to, prefilled from the order (store.html:2416 handOver). */
export function collector(o: YardOrder): string {
  const ph = phoneText(o.client.phone);
  return ph ? `${o.client.name} · ${ph}` : o.client.name;
}

/** Collected at the gate today, the latest first. */
export function collectedToday(b: YardBooks, now: Ms): YardOrder[] {
  return b.orders.filter((o) => o.status === 'completed' && o.deliveredAt != null && dayOf(o.deliveredAt) === dayOf(now) && !o.counter
    && !!o.carrier && (o.carrier.kind === 'client' || o.carrier.kind === 'agent')).sort((x, y) => (y.deliveredAt ?? 0) - (x.deliveredAt ?? 0));
}

/** Pickups still in the yard, coming to the gate (OU15): packing first, then to pack. */
export function comingToTheGate(b: YardBooks, me: string | null, now: Ms): YardOrder[] {
  const rank = (o: YardOrder) => ['packing', 'for-you', 'to-pack'].indexOf(stageOf(o, b, me, now));
  return b.orders.filter((o) => isPickup(o, b.customers) && rank(o) >= 0).sort((x, y) => rank(x) - rank(y));
}
