/*
 * Coming in (IN01, IN40; Kevin · In: "an arrivals board"): what is on its way to the yard, what is
 * back at the yard waiting to be checked in, and what was checked in today.
 *
 *   arrivals(b, now)   the sheet's sections: Buying (a Buyer's trip, stop by stop), Back at the yard,
 *                      Deliveries (a supplier brings it), Coming back (a return), Checked in today
 *   stopsWord          "Owino 9:50 · Kiseka · now · Yard ~11:30" (the trip's little rail)
 *
 * A ride (a trip the Buyer gave someone in the yard) is not here until it is handed in (ride.ts).
 * Pure; no money.
 */
import type { Ms } from '../types.ts';
import { dayOf } from '../time.ts';
import { tripOf, type CheckTrip } from './checkin.ts';
import { roundsOf } from './keys.ts';
import type { StoreReturn, Trip, YardBooks } from './types.ts';

export type StopState = 'done' | 'now' | 'next';
export interface Stop { name: string; state: StopState; at: Ms | null }

export interface Arrival {
  kind: 'buying' | 'back' | 'delivery' | 'return' | 'checked';
  /** The route's param: a trip id, or the return's order id. */
  trip: CheckTrip | null;
  ret: StoreReturn | null;
  /** When it is expected (null: no time on the books). */
  due: Ms | null;
}

/** A stop is done once every line has the Buyer's answer (got, or not found). */
const stopDone = (s: Trip): boolean => s.status === 'collected' || s.status === 'confirmed' || s.lines.every((l) => l.gotQty != null);

/** A Buyer's trip, stop by stop: done, the one he is at now, then the rest. */
export function stopsOf(t: CheckTrip): Stop[] {
  let now = false;
  return t.stops.map((s) => {
    if (stopDone(s)) return { name: s.supplierName, state: 'done' as const, at: s.collectedAt };
    const st: StopState = now ? 'next' : 'now';
    now = true;
    return { name: s.supplierName, state: st, at: null };
  });
}

/** Rides (a trip given to someone in the yard) are the rider's until handed in. */
const yardRider = (b: YardBooks, t: Trip): boolean => b.people.some((p) => p.id === t.runnerId && p.role === 'store');

export function arrivals(b: YardBooks, now: Ms): Arrival[] {
  const today = dayOf(now), out: Arrival[] = [];
  roundsOf(b.trips.filter((t) => !t.voided)).forEach((r) => {
    const t = tripOf(b, r[0].id);
    if (!t) return;
    const due = r.find((s) => s.dueAt != null)?.dueAt ?? null;
    if (t.checkedAt != null) { if (dayOf(t.checkedAt) === today) out.push({ kind: 'checked', trip: t, ret: null, due: t.checkedAt }); return; }
    if (yardRider(b, r[0]) && !t.back) return;
    if (t.delivery) out.push({ kind: 'delivery', trip: t, ret: null, due });
    else out.push({ kind: t.back ? 'back' : 'buying', trip: t, ret: null, due });
  });
  b.returns.filter((x) => x.status === 'sent' && x.by !== b.me.userId && !b.returns.some((m) => m.orderId === x.orderId && m.by === b.me.userId && m.status !== 'withdrawn'))
    .forEach((x) => out.push({ kind: 'return', trip: null, ret: x, due: x.dueAt ?? null }));
  return out;
}

/** What is still to come (the sheet's count): everything but what was checked in today. */
export const coming = (a: Arrival[]): Arrival[] => a.filter((x) => x.kind !== 'checked');
/** Back at the yard, waiting to be checked in (the green filter). */
export const backNow = (a: Arrival[]): Arrival[] => a.filter((x) => x.kind === 'back' || (x.kind === 'delivery' && !!x.trip && x.trip.back));
/** The next thing expected: its time (the head's "next ~11:00"). */
export function nextDue(a: Arrival[]): Ms | null {
  const t = coming(a).map((x) => x.due).filter((x): x is Ms => x != null);
  return t.length ? Math.min(...t) : null;
}

/** "Denis's trip"; an earlier one the same day is "Denis's first trip" (by when it started). */
export function tripName(first: string, t: CheckTrip, all: Arrival[]): string {
  const his = all.filter((x) => x.trip && !x.trip.delivery && x.trip.runnerId === t.runnerId).map((x) => x.trip as CheckTrip)
    .sort((a, c) => (a.stops[0].createdAt ?? 0) - (c.stops[0].createdAt ?? 0));
  const i = his.findIndex((x) => x.id === t.id);
  const nth = ['first', 'second', 'third', 'fourth'];
  return his.length > 1 && i >= 0 && i < his.length - 1 && i < nth.length ? `${first}'s ${nth[i]} trip` : `${first}'s trip`;
}
