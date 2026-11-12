/*
 * Riding a trip (docs/spec/04-screens-store.md §4.3; IN30–IN35): the Buyer sends someone from the
 * yard to fetch goods (Denis sends Musa to Katwe Timber, Hassan drives). The rider ticks each line
 * onto the truck ("All on"), says Done at the stop, and hands the trip in at the yard; someone else
 * checks it in, so the count stays blind (screens Q4). No money on this phone: the Buyer pays.
 *
 *   rideOf(b, me, id?)   the trip this person rides (every stop of it), its driver and its phase
 *   tripLineGot          a line's answer (null = not answered; 0 is an answer)
 *   rideStops            Left the yard · each stop · The yard, for the head's rail
 */
import type { Ms } from '../types.ts';
import { tripOf, type CheckTrip } from './checkin.ts';
import { roundsOf } from './keys.ts';
import type { TripLine, YardBooks, YardPerson } from './types.ts';

/** load: ticking at the stop · back: Done, on the way or at the yard, to hand in · handed: handed in. */
export type RidePhase = 'load' | 'back' | 'handed';

export interface Ride {
  trip: CheckTrip;
  /** Who drives (a person named in the Buyer's note: "Hassan drives"). */
  driver: YardPerson | null;
  /** Who sent it (the Buyer). */
  from: YardPerson | null;
  phase: RidePhase;
  left: Ms | null;
}

/** null = not answered; 0 is an answer (store.html:2552 tripLineGot). */
export const tripLineGot = (l: Pick<TripLine, 'gotQty'>): number | null => (l.gotQty == null ? null : l.gotQty);

const answered = (t: CheckTrip): boolean => t.stops.every((s) => s.lines.every((l) => tripLineGot(l) != null));

export function phaseOf(t: CheckTrip): RidePhase {
  if (t.back) return 'handed';
  return answered(t) && t.stops.some((s) => s.acceptedAt != null) ? 'back' : 'load';
}

/** The trips this person rides: theirs, not checked in yet (the one asked for, else the first). */
export function rideOf(b: YardBooks, me: string | null, id?: string | null): Ride | null {
  const mine = roundsOf(b.trips.filter((t) => !t.voided && !!me && t.runnerId === me && t.yardCheckedAt == null));
  const r = (id ? mine.find((x) => x.some((t) => t.id === id)) : null) || mine[0];
  if (!r) return null;
  const trip = tripOf(b, r[0].id);
  if (!trip) return null;
  const note = r.map((s) => s.note).join(' ');
  const driver = b.people.find((p) => p.id !== me && p.role === 'driver' && note.includes(p.name.split(' ')[0])) || null;
  const from = b.people.find((p) => p.role === 'buyer') || null;
  const left = r.map((s) => s.assignedAt ?? s.acceptedAt).find((x) => x != null) ?? null;
  return { trip, driver, from, phase: phaseOf(trip), left };
}

export type RideStep = { word: string; at: Ms | null; state: 'done' | 'now' | 'next' };

/** The head's rail: Left the yard ✓ · the stop (now while loading) · The yard (now once Done). */
export function rideStops(r: Ride, doneAt: Record<string, Ms | null> = {}): RideStep[] {
  const steps: RideStep[] = [{ word: 'Left the yard', at: r.left, state: 'done' }];
  r.trip.stops.forEach((s) => {
    const done = r.phase !== 'load';
    steps.push({ word: s.supplierName, at: done ? doneAt[s.id] ?? s.collectedAt ?? s.acceptedAt : null, state: done ? 'done' : 'now' });
  });
  const due = r.trip.stops.find((s) => s.dueAt != null)?.dueAt ?? null;
  steps.push({ word: 'The yard', at: r.phase === 'load' ? due : null, state: r.phase === 'load' ? 'next' : 'now' });
  return steps;
}

/** The ticks on the phone: per line id, what went on the truck (the line's qty when ticked). */
export type Ticks = Record<string, number | null>;

/** W19's ticks for one stop: idx → got. */
export function ticksFor(t: CheckTrip, stopId: string, ticks: Ticks): Record<number, number | null> {
  const out: Record<number, number | null> = {};
  t.lines.filter((l) => l.trip === stopId).forEach((l) => { out[l.idx] = ticks[l.id] ?? null; });
  return out;
}

export const allOn = (t: CheckTrip, ticks: Ticks): boolean => t.lines.every((l) => ticks[l.id] != null);
