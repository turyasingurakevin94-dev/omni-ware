/*
 * The yard's day as jobs (docs/spec/04-screens-store.md §2 TD01, TD09; routes §1 "the red centre").
 * One rule for Today's hero ("7 jobs left · 5 done", the bar "5 done · 5 ready · 2 later"), its
 * Next job card ("then #0556"), Needs you, Done today, and the red button's badge (5 at 10:41).
 *
 *   yardJobs(b, me, now)    every job, in the yard's order; each ready now or later
 *   nextJobs(j)             the Next job and the one after it ("then #0556")
 *   needsYou(j, now)        the rest: what is ready, and what lands within the hour
 *   badge(j)                the red button's count: the jobs ready now (the close counts at 17:30)
 *   doneToday(b, now)       what the yard finished today, newest first
 *
 * The yard's order (store.html:2988 nextJob, as the provisional shell/next-job.ts had it, with the
 * jobs the boards add): at the door (a drop of the run you are on: the shutter is the next tap) · your pack in progress · an order Ruth gave you · a trip back at the yard ·
 * a supplier's delivery at the gate · a trip Denis sent you to ride · the next to pack · a return
 * at the gate · a trip or delivery still on its way (later) · damage found and not reported · an
 * aisle due for a count · a delivery to load · a pickup to hand over · from 17:30, close the yard.
 *
 * At 10:41 (FACTS): ready #0552 carry on, #0556, #0548's return, the 3 bent sheets, aisle C's
 * count = 5; later Denis's trip (~11:30) and Hima Cement (12:00) = 2; done 5.
 *
 * Not paid yet is never a job: the salesperson takes the money or Ruth lets it go, and the yard
 * taps nothing (IM-07). Such an order is "Waiting on others" (waitingOnOthers).
 */
import { clock, dayOf } from '../time.ts';
import type { Ms } from '../types.ts';
import { aislesDue } from './counts.ts';
import { isAgent } from './gate.ts';
import { roundsOf } from './keys.ts';
import type { StoreReturn, Trip, YardBooks, YardOrder } from './types.ts';
import { isCancelled, isPickup, moneyHeld, ordersAt } from './yard.ts';

export type JobKind = 'door' | 'carry-on' | 'for-you' | 'checkin' | 'delivery' | 'ride' | 'pack' | 'return' | 'coming' | 'report' | 'count' | 'load' | 'gate' | 'close';

/** The yard's order of jobs (head of file). */
export const JOB_ORDER: JobKind[] = ['door', 'carry-on', 'for-you', 'checkin', 'delivery', 'ride', 'pack', 'return', 'coming', 'report', 'count', 'load', 'gate', 'close'];

export interface Job {
  kind: JobKind;
  /** One per job ("pack:552", "trip:TRIP-1017B|st-do", "count:Fasteners"). */
  key: string;
  /** Ready now, or later (a trip or delivery still on its way). */
  ready: boolean;
  /** The route it opens and its params (routes §2). */
  route: string;
  params: Record<string, string | number>;
  /** When: due at the yard (later), found, back, or since. */
  at: Ms | null;
  orderId?: number;
  /** The stops of one trip (keys.ts roundsOf). */
  trips?: Trip[];
  ret?: StoreReturn;
  aisle?: string;
  itemKey?: string;
}

/** Close the yard from this time (spec §4.6). */
export const CLOSE_FROM = '17:30';
/** Later jobs show in Needs you when they land within this many minutes. */
export const SOON_MIN = 60;

const yardLogin = (b: YardBooks, userId: string | null): boolean => !!userId && b.people.some((p) => p.userId === userId && p.role === 'store');
const isToday = (at: Ms | null | undefined, now: Ms): boolean => at != null && dayOf(at) === dayOf(now);
const minutes = (hm: string): number => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

/** The yard closed today already (a 'close' ask). */
export function closedToday(b: YardBooks, now: Ms): boolean {
  return b.asks.some((a) => a.kind === 'close' && isToday(a.createdAt, now));
}

function pack(kind: JobKind, o: YardOrder): Job {
  return { kind, key: 'pack:' + o.id, ready: true, route: 'pack/order', params: { id: o.id }, at: o.workerAcceptedAt ?? o.stageEnteredAt, orderId: o.id };
}

/** A return asked by the salesperson that the yard has not checked at the gate yet (§4.3). */
function returnsAtGate(b: YardBooks): StoreReturn[] {
  return b.returns.filter((r) => r.status === 'sent' && !yardLogin(b, r.by)
    && !b.returns.some((y) => y.orderId === r.orderId && yardLogin(b, y.by) && y.createdAt >= r.createdAt));
}

/** Damage found and not reported since (YardFound). */
function foundOpen(b: YardBooks): NonNullable<YardBooks['found']> {
  return (b.found || []).filter((f) => !b.reports.some((r) => r.key === f.key && r.createdAt >= f.at));
}

/**
 * At the door (OU21, FLOW.md §5 "Next job 'At the door'"): a drop on the road with our driver, for the one on the run.
 * The driver himself (store.html:2783 myDrops: carrier.staffId or assignedDeliveryId is me); a driver with no login
 * of his own (a staff driver without one, or hired) is gone with the phone that sent him (carrier.by, the loader's
 * name). Cancelled on the truck or coming back is not a door (OU27, OU24). Spec §3 lists the second half as open.
 */
export function atTheDoor(b: YardBooks, me: string | null): YardOrder[] {
  return b.orders.filter((o) => {
    const c = o.carrier;
    if (o.status !== 'pending_delivery' || !c || (c.kind !== 'staff' && c.kind !== 'hired') || isCancelled(o) || o.comingBack) return false;
    if (me && (c.staffId === me || o.assignedDeliveryId === me)) return true;
    const driver = c.staffId ? b.people.find((p) => p.id === c.staffId) : null;
    return !(driver && driver.userId) && !!c.by && c.by === b.me.name;
  });
}

/** Every job, in the yard's order: ready ones and later ones together. */
export function yardJobs(b: YardBooks, me: string | null, now: Ms): Job[] {
  const jobs: Job[] = [];
  atTheDoor(b, me).forEach((o) => jobs.push({ kind: 'door', key: 'door:' + o.id, ready: true, route: 'out/door', params: { id: o.id }, at: o.carrier?.at ?? null, orderId: o.id }));
  ordersAt(b, 'packing', me, now).filter((o) => o.assignedWorkerId === me).forEach((o) => jobs.push(pack('carry-on', o)));
  ordersAt(b, 'for-you', me, now).forEach((o) => jobs.push(pack('for-you', o)));
  roundsOf(b.trips.filter((t) => !t.voided && !t.yardCheckedAt)).forEach((r) => {
    const t0 = r[0], supplier = t0.runnerId === '__supplier__', back = r.every((t) => t.status === 'collected' || t.status === 'confirmed');
    const key = 'trip:' + t0.id;
    if (!supplier && me && t0.runnerId === me && !back) {
      jobs.push({ kind: 'ride', key, ready: true, route: 'in/ride', params: { trip: t0.id }, at: t0.assignedAt ?? t0.createdAt, trips: r });
    } else if (back) {
      const at = r.reduce<number | null>((m, t) => (t.collectedAt == null ? m : Math.max(m ?? 0, t.collectedAt)), null);
      jobs.push({ kind: supplier ? 'delivery' : 'checkin', key, ready: true, route: supplier ? 'in/delivery' : 'in/checkin', params: { trip: t0.id }, at, trips: r });
    } else {
      const due = r.reduce<number | null>((m, t) => (t.dueAt == null ? m : m == null ? t.dueAt : Math.max(m, t.dueAt)), null);
      jobs.push({ kind: 'coming', key, ready: false, route: supplier ? 'in/delivery' : 'in', params: supplier ? { trip: t0.id } : {}, at: due, trips: r });
    }
  });
  ordersAt(b, 'to-pack', me, now).forEach((o) => jobs.push(pack('pack', o)));
  returnsAtGate(b).forEach((r) => jobs.push({ kind: 'return', key: 'return:' + r.id, ready: true, route: 'in/return', params: { order: r.orderId }, at: r.dueAt ?? r.createdAt, orderId: r.orderId, ret: r }));
  foundOpen(b).forEach((f) => jobs.push({ kind: 'report', key: 'report:' + f.key, ready: true, route: 'shelf/item', params: { key: f.key }, at: f.at, itemKey: f.key }));
  aislesDue(b, now).forEach((a) => jobs.push({ kind: 'count', key: 'count:' + a.aisle, ready: true, route: 'shelf/count', params: { aisle: a.aisle }, at: null, aisle: a.aisle }));
  const loadable = ordersAt(b, 'packed', me, now).filter((o) => !moneyHeld(o) && !isPickup(o, b.customers));
  if (loadable.length) jobs.push({ kind: 'load', key: 'load', ready: true, route: 'out/load', params: {}, at: loadable[0].pickingDoneAt, orderId: loadable[0].id });
  ordersAt(b, 'ready', me, now).filter((o) => !moneyHeld(o)).forEach((o) => jobs.push({ kind: 'gate', key: 'gate:' + o.id, ready: true,
    // An agent collects by his code: the job opens on the keypad (OU11, FLOW.md §5 "card 1 · code 4 · slide 1").
    route: isAgent(o) ? 'out/gate-code' : 'out/gate', params: { id: o.id }, at: o.pickingDoneAt, orderId: o.id }));
  if (!jobs.some((j) => j.ready) && minutes(clock(now)) >= minutes(CLOSE_FROM) && !closedToday(b, now)) {
    jobs.push({ kind: 'close', key: 'close', ready: true, route: 'today/close-yard', params: {}, at: null });
  }
  const rank = (k: JobKind) => JOB_ORDER.indexOf(k);
  return jobs.map((j, i) => [j, i] as const).sort((x, y) => rank(x[0].kind) - rank(y[0].kind) || x[1] - y[1]).map((x) => x[0]);
}

export const readyJobs = (j: Job[]): Job[] => j.filter((x) => x.ready);
export const laterJobs = (j: Job[]): Job[] => j.filter((x) => !x.ready);
/** "7 jobs left": what is still to do today, ready or later (closing the yard is not one). */
export const jobsLeft = (j: Job[]): number => j.filter((x) => x.kind !== 'close').length;
/** The red button's badge: the jobs ready now (routes §1). */
export const badge = (j: Job[]): number => readyJobs(j).length;

/** The Next job and the one after it ("then #0556"). */
export function nextJobs(j: Job[]): { next: Job | null; then: Job | null } {
  const r = readyJobs(j);
  return { next: r[0] || null, then: r[1] || null };
}

/** Needs you: every job after the Next one and its "then"; a later one only when it lands within the hour. */
export function needsYou(j: Job[], now: Ms): Job[] {
  const { next, then } = nextJobs(j);
  return j.filter((x) => x !== next && x !== then && x.kind !== 'close' && (x.ready || (x.at != null && x.at - now <= SOON_MIN * 60e3)));
}

/** Waiting on others: packed on a bay, Not paid yet; the yard taps nothing (IM-07). */
export function waitingOnOthers(b: YardBooks, me: string | null, now: Ms): YardOrder[] {
  return ordersAt(b, 'packed', me, now).filter(moneyHeld);
}

export type DoneKind = 'packed' | 'checked-in' | 'loaded' | 'handed-over' | 'delivered' | 'counted' | 'reported' | 'returned';
export interface Done { kind: DoneKind; at: Ms; orders: YardOrder[]; trips?: Trip[]; name?: string; lines?: number; status?: string }

/** What the yard finished today, newest first: one row per pack, check-in, run loaded, hand-over, door, count, report, return. */
export function doneToday(b: YardBooks, now: Ms): Done[] {
  const out: Done[] = [];
  const live = b.orders.filter((o) => !isCancelled(o) || o.status === 'completed');
  live.forEach((o) => {
    if (o.assignedWorkerId && isToday(o.pickingDoneAt, now)) out.push({ kind: 'packed', at: o.pickingDoneAt as Ms, orders: [o] });
    if (o.deliveredAt != null && isToday(o.deliveredAt, now) && !o.counter) {
      const collected = !o.carrier || o.carrier.kind === 'client' || o.carrier.kind === 'agent';
      out.push({ kind: collected ? 'handed-over' : 'delivered', at: o.deliveredAt, orders: [o] });
    }
  });
  const runs = new Map<string, YardOrder[]>();
  live.filter((o) => o.carrier && (o.carrier.kind === 'staff' || o.carrier.kind === 'hired') && isToday(o.carrier.at, now))
    .forEach((o) => { const k = `${o.carrier?.name}|${o.carrier?.at}`; runs.set(k, [...(runs.get(k) || []), o]); });
  runs.forEach((os) => out.push({ kind: 'loaded', at: os[0].carrier?.at as Ms, orders: os, name: os[0].carrier?.name }));
  roundsOf(b.trips.filter((t) => isToday(t.yardCheckedAt, now))).forEach((r) => out.push({
    kind: 'checked-in', at: Math.max(...r.map((t) => t.yardCheckedAt as Ms)), orders: [], trips: r, lines: r.reduce((n, t) => n + t.lines.filter((l) => !l.notFound).length, 0),
  }));
  b.counts.filter((c) => isToday(c.createdAt, now) && yardLogin(b, c.countedBy) && c.status !== 'replaced')
    .forEach((c) => out.push({ kind: 'counted', at: c.createdAt, orders: [], name: c.lines.length === 1 ? c.lines[0].name : c.aisle, status: c.status }));
  b.reports.filter((r) => isToday(r.createdAt, now)).forEach((r) => out.push({ kind: 'reported', at: r.createdAt, orders: [], name: r.name, status: r.status }));
  b.returns.filter((r) => isToday(r.createdAt, now) && yardLogin(b, r.by) && r.status !== 'withdrawn')
    .forEach((r) => out.push({ kind: 'returned', at: r.createdAt, orders: b.orders.filter((o) => o.id === r.orderId), status: r.status }));
  return out.sort((x, y) => y.at - x.at);
}
