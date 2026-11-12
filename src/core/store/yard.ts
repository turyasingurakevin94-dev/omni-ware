/*
 * The yard's states and counts, once (docs/spec/04-screens-store.md §4.1, §4.4;
 * IB02StateWords, the Store column). Every Today tile, stage sheet, bar and push
 * route reads these; no screen works a stage out for itself (WORD-04).
 *
 *   stageOf(o, me, now)     one yard stage per order (YardStage)
 *   stageWord(o, …)         its word, the Store's column of IB02
 *   counts(b, me, now)      To pack 1 · Packing now 1 · Packed 1 · On the road 3 · Delivered today 1 · +2 waiting
 *   NOT_PAID                "Not paid yet": a label, never a figure (WORD-03)
 *
 * `me` is the phone holder's staff id (StoreSession.staffId), null with no staff row.
 */
import { dayOf } from '../time.ts';
import type { Ms } from '../types.ts';
import type { YardBooks, YardLine, YardOrder } from './types.ts';

/** One label for an unpaid order, everywhere (store.html:1498 NOT_PAID; WORD-03). Never a figure. */
export const NOT_PAID = 'Not paid yet';
/** The one reason, on the order only (store.html:1499 notPaidWhy). */
export function notPaidWhy(seller: string, manager: string): string {
  return `${seller} takes the money before it leaves, or ${manager} lets it go on credit.`;
}

/** The yard's stages, finer than the five shared ones (IB02's Store rows). */
export type YardStage =
  | 'look'          // Checking (draft), or a copy: Look only
  | 'waiting'       // Waiting on goods · Denis is buying
  | 'to-pack'       // To pack
  | 'for-you'       // For you · Ruth's pick
  | 'packing'       // Packing now (yours, or someone else's: look only)
  | 'packed'        // Packed · Bay 1 (a delivery waiting for the truck)
  | 'ready'         // Ready to collect · Gate
  | 'road'          // On the road · Ssali
  | 'coming-back'   // Coming back · bring it back
  | 'delivered'     // Delivered · at the door / collected
  | 'cancelled'     // Cancelled · put it back (in the yard) / bring it back (on a truck)
  | 'gone';         // off the board (invoiced 24 h ago), or never the yard's

const DAY_MS = 864e5;

export const isCancelled = (o: YardOrder): boolean => o.voided || o.cancelledAt != null || o.status === 'cancelled';

/** A called-off order once put back (W7, 0182 payload.putBack, any phone) asks the yard nothing more: it leaves the day. */
export const putAway = (o: YardOrder): boolean => !!o.putBack && isCancelled(o);

/** An invoiced order leaves the board 24 h after its invoice (store.html:1751 quoteAgedOffBoard). */
export function onBoard(o: YardOrder, now: Ms): boolean {
  return !(o.invoiced && o.invoicedAt != null && now - o.invoicedAt > DAY_MS);
}

/**
 * Where it goes: the order's own deliverTo (0182), else, for an old order with none, as store.html:1521
 * orderDestination did (an agent's address; the customer's location; a shop delivery's address).
 * An agent pickup goes nowhere.
 */
export function destinationOf(o: YardOrder, customers: YardBooks['customers']): string | null {
  if (o.deliveryMode === 'agent_pickup' || o.assignedDeliveryId === '__agent__') return null;
  if (o.deliverTo != null) return o.deliverTo.trim() || null;
  if (o.originAgentId) return (o.deliveryAddress || '').trim() || null;
  const c = customers.find((x) => x.id === o.customerId) || customers.find((x) => !!o.client.name && x.name.trim().toLowerCase() === o.client.name.trim().toLowerCase());
  return ((c && c.location) || (o.deliveryMode === 'shop_delivery' ? o.deliveryAddress || '' : '')).trim() || null;
}

/** Nobody of ours drives it: an agent pickup, or nowhere to deliver (store.html:1494; Sales' core/orders.ts isPickup). */
export function isPickup(o: YardOrder, customers: YardBooks['customers']): boolean {
  return destinationOf(o, customers) == null;
}

/** A bought-in line not yet here (store.html:1767–1770). A dropped line waits for nothing. */
export function lineAwaited(l: YardLine): boolean {
  return !!l.supplierId && l.supplierId !== '__stock__' && !l.dropped && !(l.receivedAt != null && (l.receivedQty || 0) > 0);
}
export const awaitsGoods = (o: YardOrder): boolean => o.lines.some(lineAwaited);

/** An agent who pays first, not settled: not packed yet (store.html:1772). */
export function agentBlocks(o: YardOrder, agents: YardBooks['agents']): boolean {
  if (!o.originAgentId) return false;
  const a = agents.find((x) => x.id === o.originAgentId);
  return !!a && a.terms === 'before' && !o.agentSettled;
}

/** A backdated order is left off To pack (store.html:1480). */
export function isBackdated(o: YardOrder): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date || '') || o.createdAt == null) return false;
  return o.date < dayOf(o.createdAt);
}

export const isMine = (o: YardOrder, me: string | null): boolean => !!me && o.assignedWorkerId === me;
export const waitingSince = (o: YardOrder): Ms => o.stageEnteredAt ?? o.savedAt ?? o.createdAt ?? 0;

/** Held for the money (store.html:1502 moneyHold), widened by 0182 to a ready-to-collect order (§6a). */
export function moneyHeld(o: YardOrder): boolean {
  return o.moneyHold && (o.status === 'preparing' || o.status === 'pending_delivery') && !o.deliveredAt;
}

/** One stage per order. The order of the tests matters: cancelled wins, then the status, then who holds it. */
export function stageOf(o: YardOrder, b: Pick<YardBooks, 'customers' | 'agents'>, me: string | null, now: Ms): YardStage {
  if (!onBoard(o, now)) return 'gone';
  if (isCancelled(o)) return o.status === 'completed' ? 'gone' : 'cancelled';
  if (o.copyOf != null) return 'look';
  switch (o.status) {
    case 'draft': return 'look';
    case 'awaiting_goods': return 'waiting';
    case 'completed': return 'delivered';
    case 'pending_delivery':
      if (o.comingBack) return 'coming-back';
      return !o.carrier && isPickup(o, b.customers) ? 'ready' : 'road';
    case 'preparing':
      if (o.pickingStatus === 'done') return 'packed';
      if (awaitsGoods(o)) return 'waiting';
      if (o.pickingStatus === 'in_progress') return 'packing';
      if (o.assignedWorkerId && isMine(o, me)) return 'for-you';
      if (o.assignedWorkerId) return 'look';
      if (agentBlocks(o, b.agents) || isBackdated(o)) return 'gone';
      return 'to-pack';
    default: return 'gone';
  }
}

/** On a truck, or still in the yard (a cancelled order's words differ: put it back · bring it back). */
export const onATruck = (o: YardOrder): boolean => !!o.carrier && !o.deliveredAt && o.status !== 'completed';

/** IB02's Store column: one word per state. `driver` is the carrier's name as people.ts says it. */
export function stageWord(o: YardOrder, stage: YardStage, me: string | null): string {
  switch (stage) {
    case 'look': return o.copyOf != null ? 'Look only · a copy' : o.status === 'draft' ? 'Checking · look only' : 'Look only';
    case 'waiting': return 'Waiting on goods';
    case 'to-pack': return 'To pack';
    case 'for-you': return 'For you · Ruth’s pick';
    case 'packing': return isMine(o, me) ? 'Packing now · yours' : 'Packing now';
    case 'packed': return moneyHeld(o) ? NOT_PAID : o.bay != null ? `Packed · Bay ${o.bay}` : 'Packed';
    case 'ready': return moneyHeld(o) ? `Ready to collect · ${NOT_PAID}` : 'Ready to collect · Gate';
    case 'road': return o.carrier ? `On the road · ${o.carrier.name}${o.carrier.kind === 'hired' ? ' (hired)' : ''}` : 'On the road';
    case 'coming-back': return 'Coming back · bring it back';
    case 'delivered': return o.counter ? 'Counter sale · out' : o.carrier && (o.carrier.kind === 'client' || o.carrier.kind === 'agent') || !o.deliveredPhoto && o.handoverCheckedAt ? 'Delivered · collected' : 'Delivered · at the door';
    case 'cancelled': return onATruck(o) ? 'Cancelled · bring it back' : 'Cancelled · put it back';
    default: return '';
  }
}

export interface YardCounts {
  toPack: number;
  forYou: number;
  packingNow: number;
  packed: number;
  onTheRoad: number;
  readyToCollect: number;
  comingBack: number;
  deliveredToday: number;
  collectedToday: number;
  waitingOnGoods: number;
  cancelled: number;
}

/** Delivered today (collected included): the stage entered today (store.html:1509 doneToday). */
function doneToday(o: YardOrder, now: Ms): boolean {
  const t = o.deliveredAt ?? o.stageEnteredAt;
  return t != null && dayOf(t) === dayOf(now);
}

/** One definition per count (WORD-04; store.html:1510 counts). On the road counts the gate's ready-to-collect too. */
export function counts(b: YardBooks, me: string | null, now: Ms): YardCounts {
  const c: YardCounts = { toPack: 0, forYou: 0, packingNow: 0, packed: 0, onTheRoad: 0, readyToCollect: 0, comingBack: 0, deliveredToday: 0, collectedToday: 0, waitingOnGoods: 0, cancelled: 0 };
  for (const o of b.orders) {
    const s = stageOf(o, b, me, now);
    if (s === 'to-pack') c.toPack++;
    else if (s === 'for-you') { c.forYou++; c.toPack++; }
    else if (s === 'packing') c.packingNow++;
    else if (s === 'packed') c.packed++;
    else if (s === 'ready') { c.readyToCollect++; c.onTheRoad++; }
    else if (s === 'road') c.onTheRoad++;
    else if (s === 'coming-back') { c.comingBack++; c.onTheRoad++; }
    else if (s === 'waiting') c.waitingOnGoods++;
    else if (s === 'cancelled') c.cancelled++;
    else if (s === 'delivered' && doneToday(o, now) && !o.counter) {
      c.deliveredToday++;
      if (o.carrier && (o.carrier.kind === 'client' || o.carrier.kind === 'agent')) c.collectedToday++;
    }
  }
  return c;
}

/** The orders of one stage, oldest first; this person's own first (store.html:1488 packQueue). */
export function ordersAt(b: YardBooks, stage: YardStage, me: string | null, now: Ms): YardOrder[] {
  return b.orders.filter((o) => stageOf(o, b, me, now) === stage)
    .sort((x, y) => Number(isMine(y, me)) - Number(isMine(x, me)) || waitingSince(x) - waitingSince(y));
}
