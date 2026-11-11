/*
 * The red centre button (P16, routes §1): "Start the next job", with a badge of the
 * jobs ready now. It is not a route: it opens the first of the day's jobs.
 *
 * PROVISIONAL, for the Today builder to replace: the day's job list (ready · later ·
 * done, TD01's bar "5 done · 5 ready · 2 later" and TD09) is Today's rule, and belongs
 * in src/core/store/jobs.ts once it is written. Until then the order here is the yard's
 * own: your order in progress, an order given to you, a trip back at the yard, the first
 * to pack, a return at the gate, a packed delivery free to load, a pickup free to hand over.
 * At 10:41 that is 3 ready (#0552, #0556, #0548's return), where TD01 draws 5: the bent
 * sheets (no record in the books until reported) and aisle C's count (counts.ts countDue,
 * the Shelf builder's) are the other two.
 */
import { computed } from '@preact/signals';
import { orderNo } from '../../../core/names.ts';
import { roundsOf } from '../../../core/store/keys.ts';
import { moneyHeld, ordersAt } from '../../../core/store/yard.ts';
import type { YardBooks } from '../../../core/store/types.ts';
import type { Params } from './nav.ts';
import { books, me, now } from './store.ts';

export interface Job { id: string; params: Params; label: string }

export function jobsOf(b: YardBooks, mine: string | null, at: number): Job[] {
  const jobs: Job[] = [];
  ordersAt(b, 'packing', mine, at).filter((o) => o.assignedWorkerId === mine).forEach((o) => jobs.push({ id: 'pack/order', params: { id: o.id }, label: `Carry on packing ${orderNo(o.id)}` }));
  ordersAt(b, 'for-you', mine, at).forEach((o) => jobs.push({ id: 'pack/order', params: { id: o.id }, label: `Pack ${orderNo(o.id)}` }));
  roundsOf(b.trips.filter((x) => !x.voided && x.status === 'collected' && !x.yardCheckedAt)).forEach((r) => jobs.push({ id: r[0].runnerId === '__supplier__' ? 'in/delivery' : 'in/checkin', params: { trip: r[0].id }, label: 'Check in' }));
  ordersAt(b, 'to-pack', mine, at).forEach((o) => jobs.push({ id: 'pack/order', params: { id: o.id }, label: `Pack ${orderNo(o.id)}` }));
  b.returns.filter((r) => r.status === 'sent' && r.by !== b.me.userId).forEach((r) => jobs.push({ id: 'in/return', params: { order: r.orderId }, label: 'Check a return' }));
  if (ordersAt(b, 'packed', mine, at).some((o) => !moneyHeld(o))) jobs.push({ id: 'out/load', params: {}, label: 'Load' });
  ordersAt(b, 'ready', mine, at).filter((o) => !moneyHeld(o)).forEach((o) => jobs.push({ id: 'out/gate', params: { id: o.id }, label: 'Hand over' }));
  return jobs;
}

export const jobs = computed<Job[]>(() => (books.value ? jobsOf(books.value, me.value, now.value) : []));
export const nextJob = computed<Job | null>(() => jobs.value[0] || null);
