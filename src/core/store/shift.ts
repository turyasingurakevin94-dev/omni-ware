/*
 * The shift (docs/spec/04-screens-store.md §4.6): Pass the yard and Close the yard.
 *
 *   mates(b, me)                   who can take the yard: a colleague with a Store login who is not
 *                                  away (store.html:6193 mates); the rest listed, locked
 *   passPlan(b, me, now)           what moves to them: this person's packs (their name on the order,
 *                                  the picks kept, Q19: every order they hold in Packing), the jobs
 *                                  left, the asks with Ruth (her answers follow them), the bays
 *   passPayload(plan, to)          W22's payload (data §3)
 *   handoverFor(b, me)             the ask a colleague passed to this person, still waiting on
 *                                  "I've got it" (TD15), or taken today (TD32, "The yard is yours")
 *   closeChecks(b, me, now, set)   from 17:30: nothing half done · every return back or set aside ·
 *                                  what stays on its bay tonight · what waits on Ruth carries over.
 *                                  The slide is off until every red one is sorted (TD28)
 *   closePayload(b, me, now, set)  W23's payload
 *
 * Words: "Pass the yard" / "End my shift" (WORD-02), never "Hand over" (that is the gate).
 */
import { dayOf } from '../time.ts';
import type { Ms } from '../types.ts';
import { jobsLeft, readyJobs, yardJobs, type Job } from './jobs.ts';
import { roundsOf } from './keys.ts';
import type { CloseYard, PassYard } from './source.ts';
import type { StoreAsk, StoreReturn, YardBooks, YardOrder, YardPerson } from './types.ts';
import { onATruck, ordersAt, stageOf } from './yard.ts';
import { withRuth } from './ruth.ts';

/** The yard opens (TD17 "Tomorrow · 7:30"). */
export const YARD_OPENS = '7:30';

export interface Mate { p: YardPerson; can: boolean; why: 'on' | 'away' | 'no-login' }

/** Everyone the picker lists after the holder: Store logins first (on before away), then drivers (no yard login). */
export function mates(b: YardBooks, me: string | null): Mate[] {
  // A driver out with a truck is not in the yard to ask (TD13 lists Hassan, not Ssali).
  const out = new Set(b.orders.filter((o) => onATruck(o) && o.carrier && o.carrier.staffId).map((o) => o.carrier!.staffId as string));
  const yard = b.people.filter((p) => p.id !== me && (p.role === 'store' || (p.role === 'driver' && !out.has(p.id))));
  const m: Mate[] = yard.map((p) => (p.role === 'store' && p.userId
    ? { p, can: !p.away, why: p.away ? 'away' : 'on' }
    : { p, can: false, why: 'no-login' }));
  const rank = (x: Mate) => (x.why === 'on' ? 0 : x.why === 'away' ? 1 : 2);
  return m.sort((x, y) => rank(x) - rank(y));
}

export interface PassPlan {
  /** "7 jobs" (jobs.ts jobsLeft). */
  jobs: number;
  /** "4 asks · she knows": everything with Ruth or waiting on her. */
  asks: number;
  /** The orders this person holds in Packing: their name moves to the colleague (Q19). */
  orders: YardOrder[];
  bays: number[];
  /** The tiles: the jobs that move with the yard (a pack, a return, a count…), not the shared queue to pack and not a draft on this phone. */
  moves: Job[];
}

export function passPlan(b: YardBooks, me: string | null, now: Ms): PassPlan {
  const all = yardJobs(b, me, now);
  const orders = b.orders.filter((o) => o.status === 'preparing' && !!me && o.assignedWorkerId === me && o.pickingStatus !== 'done');
  return {
    jobs: jobsLeft(all),
    asks: withRuth(b, me, now).filter((x) => x.state !== 'answered').length,
    orders,
    bays: orders.map((o) => o.bay).filter((x): x is number => x != null),
    moves: readyJobs(all).filter((j) => j.kind !== 'pack' && j.kind !== 'report' && j.kind !== 'close'),
  };
}

export function passPayload(plan: PassPlan, to: YardPerson): PassYard {
  return { toStaffId: to.id, toUserId: to.userId, toName: to.name, orders: plan.orders.map((o) => o.id), waiting: plan.asks, bays: plan.bays };
}

/** The yard passed to this person today: waiting on "I've got it", or taken. */
export function handoverFor(b: YardBooks, me: YardPerson, now: Ms): StoreAsk | null {
  return b.asks.find((a) => a.kind === 'handover' && dayOf(a.createdAt) === dayOf(now) && (a.ref === me.userId || a.payload.toStaffId === me.id)) || null;
}

/** The yard this person passed today, and whether the colleague has it ("Okello has it"). */
export function handoverFrom(b: YardBooks, me: YardPerson, now: Ms): StoreAsk | null {
  return b.asks.find((a) => a.kind === 'handover' && dayOf(a.createdAt) === dayOf(now) && a.by === me.userId) || null;
}

export type CheckTone = 'ok' | 'todo' | 'stays' | 'carries';
export interface CloseCheck { kind: 'half' | 'return' | 'bay' | 'ruth'; tone: CheckTone; orders: YardOrder[]; ret?: StoreReturn; at?: Ms | null; what?: string; n?: number }

/** Returns Ruth decided today: back on the shelf (good) or set aside (damaged). */
export function returnsToPutAway(b: YardBooks, now: Ms): StoreReturn[] {
  return b.returns.filter((r) => r.status === 'accepted' && r.decidedAt != null && dayOf(r.decidedAt) === dayOf(now));
}

export function closeChecks(b: YardBooks, me: string | null, now: Ms, setAside: string[]): CloseCheck[] {
  const half = ordersAt(b, 'packing', me, now);
  const back = roundsOf(b.trips.filter((t) => !t.voided && !t.yardCheckedAt && t.status === 'collected'));
  const out: CloseCheck[] = [{ kind: 'half', tone: half.length || back.length ? 'todo' : 'ok', orders: half }];
  returnsToPutAway(b, now).forEach((r) => out.push({ kind: 'return', tone: setAside.includes(r.id) ? 'ok' : 'todo', orders: b.orders.filter((o) => o.id === r.orderId), ret: r }));
  ordersAt(b, 'packed', me, now).forEach((o) => out.push({ kind: 'bay', tone: 'stays', orders: [o] }));
  const counts = b.counts.filter((c) => c.status === 'sent');
  const ruth = withRuth(b, me, now).filter((x) => x.state === 'with-ruth' && x.kind !== 'unpaid');
  // One ask with Ruth is named ("Aisle C count" when it is the count); more are counted ("3 asks"); n is all that carries over (TD16).
  const last = counts.slice().sort((x, y) => y.createdAt - x.createdAt)[0];
  const named = ruth.length === 1 && last && ruth[0].kind === 'count' ? `${last.aisle.replace(/^Aisle (\w+) · .*$/, 'Aisle $1').replace(/^Spot count · /, '')} count` : `${ruth.length} asks`;
  if (ruth.length) out.push({ kind: 'ruth', tone: 'carries', orders: [], at: ruth.length === 1 ? ruth[0].at : last ? last.createdAt : ruth[0].at, what: named, n: ruth.length });
  return out;
}

/** The slide is off until every red check is sorted (TD28). */
export const canClose = (c: CloseCheck[]): boolean => c.every((x) => x.tone !== 'todo');
export const checksDone = (c: CloseCheck[]): number => c.filter((x) => x.tone !== 'todo').length;

/** The day's figures on the close sheet: out (delivered today), in (trips and deliveries checked in), back (returns put away). */
export function closeFigures(b: YardBooks, me: string | null, now: Ms): { out: number; in: number; back: number } {
  const today = dayOf(now);
  const out = b.orders.filter((o) => o.deliveredAt != null && dayOf(o.deliveredAt) === today && !o.counter).length;
  const inn = roundsOf(b.trips.filter((t) => t.yardCheckedAt != null && dayOf(t.yardCheckedAt) === today && (!me || t.runnerId !== me))).length;
  return { out, in: inn, back: returnsToPutAway(b, now).length };
}

/** Each bay tonight, and the gate: the order that stays there, or free. */
export function baysTonight(b: YardBooks, me: string | null, now: Ms): { bay: number | null; order: YardOrder | null }[] {
  const packed = b.orders.filter((o) => stageOf(o, b, me, now) === 'packed');
  const gate = b.orders.find((o) => stageOf(o, b, me, now) === 'ready') || null;
  const bays = Array.from({ length: Math.max(1, Math.min(12, b.bays || 4)) }, (_, i) => i + 1);
  return [...bays.map((n) => ({ bay: n, order: packed.find((o) => o.bay === n) || null })), { bay: null, order: gate }];
}

export function closePayload(b: YardBooks, me: string | null, now: Ms, setAside: string[]): CloseYard {
  const f = closeFigures(b, me, now);
  return { out: f.out, trips: f.in, carries: ordersAt(b, 'packed', me, now).map((o) => String(o.id)), shelved: returnsToPutAway(b, now).filter((r) => setAside.includes(r.id)).map((r) => r.id) };
}
