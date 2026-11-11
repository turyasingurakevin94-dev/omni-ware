/*
 * The check-in (docs/spec/04-screens-store.md §4.3; boards IN02–IN16): a Buyer's trip, or a
 * supplier's delivery, counted blind at the yard and put where it goes.
 *
 *   tripOf        a trip and every stop of it, as one check-in ("Denis's trip · 2 suppliers"; keys.ts roundsOf)
 *   groupsOf      its lines by where they go: the order's drop, or the shelf (shareOf)
 *   quickTiles    the count in the unit you can see: 1–4 and Other, or stacks (10 … 120 bag)
 *   whyChips      a count unlike the Buyer's asks why, on that line only (WHY_UNDER / WHY_OVER)
 *   payload       the lines for W14 (receive_trip), in the shelf's unit
 *   outcome       what the check-in moves: each order all in (→ Packing) or "18 of 20 came", and what differs
 *
 * Blind (STORE-TODAY §5): the Buyer's figure is never shown before a line is counted; `expected`
 * is read only to compare. Pure functions over the yard's books; no screen, no money.
 */
import type { Ms } from '../types.ts';
import { roundsOf } from './keys.ts';
import type { CheckInLine } from './source.ts';
import type { Trip, TripLine, YardBooks, YardOrder } from './types.ts';
import { isCancelled, onATruck } from './yard.ts';

/** A supplier's own delivery (Hima Cement brings it): the trip's runner is '__supplier__' (store.html:1783). */
export const SUPPLIER = '__supplier__';
export const isDelivery = (t: Pick<Trip, 'runnerId'>): boolean => t.runnerId === SUPPLIER;

/** One line to count. `id` is "<trip>#<idx>": the draft's key. */
export interface CheckLine {
  id: string;
  trip: string;
  idx: number;
  key: string;
  productId: string | null;
  name: string;
  unit: string;
  packQty: number;
  packUnit: string;
  orderId: number | null;
  supplier: string;
  /** The Buyer's figure (what he got, else what was asked): compared, never shown first. */
  expected: number;
  /** The Buyer could not find it: nothing to count ("not found · Grace tells Lubowa"). */
  notFound: boolean;
  /** The yard's count once checked in (null before). */
  yard: number | null;
  /** What the order asked of the Buyer (a line not found keeps it: "Gutter bracket · 6 pc"). */
  asked: number;
}

export interface CheckTrip {
  /** The first stop's id: the route's param. */
  id: string;
  stops: Trip[];
  runnerId: string | null;
  delivery: boolean;
  lines: CheckLine[];
  /** Checked in already (by anyone): when and by which login. */
  checkedAt: Ms | null;
  checkedBy: string | null;
  /** Every stop collected: the trip is back at the yard. */
  back: boolean;
}

export const lineId = (trip: string, idx: number): string => `${trip}#${idx}`;

/** The stops of the trip `id` belongs to (the same id stem and runner), not voided, in their order. */
export function stopsOf(b: Pick<YardBooks, 'trips'>, id: string): Trip[] {
  const live = b.trips.filter((t) => !t.voided);
  return roundsOf(live).find((r) => r.some((t) => t.id === id)) || [];
}

export function tripOf(b: Pick<YardBooks, 'trips'>, id: string): CheckTrip | null {
  const stops = stopsOf(b, id);
  if (!stops.length) return null;
  const lines: CheckLine[] = [];
  stops.forEach((s) => s.lines.forEach((l) => lines.push(checkLine(s, l))));
  const checked = stops.filter((s) => s.yardCheckedAt != null);
  return {
    id: stops[0].id, stops, runnerId: stops[0].runnerId, delivery: isDelivery(stops[0]), lines,
    checkedAt: checked.length === stops.length ? Math.max(...checked.map((s) => s.yardCheckedAt as number)) : null,
    checkedBy: checked.length === stops.length ? checked[0].yardCheckedBy : null,
    back: stops.every((s) => s.status === 'collected' || s.status === 'confirmed'),
  };
}

function checkLine(s: Trip, l: TripLine): CheckLine {
  return {
    id: lineId(s.id, l.idx), trip: s.id, idx: l.idx, key: l.key, productId: l.productId, name: l.name, unit: l.unit,
    packQty: l.packQty || 1, packUnit: l.packUnit, orderId: l.orderId, supplier: s.supplierName,
    expected: l.gotQty ?? l.qty, notFound: l.notFound, yard: l.yardQty ?? null, asked: l.qty,
  };
}

/** The lines there is something to count (not the ones the Buyer could not find). */
export const toCount = (t: CheckTrip): CheckLine[] => t.lines.filter((l) => !l.notFound);

/**
 * Where a line goes (store.html:3767 rcShareOf): its order, unless that order is gone (cancelled,
 * already out of the gate, delivered): then it all goes on the shelf (null).
 */
export function shareOf(l: Pick<CheckLine, 'orderId'>, orders: YardOrder[]): number | null {
  const o = l.orderId != null ? orders.find((x) => x.id === l.orderId) : null;
  if (!o || isCancelled(o) || onATruck(o) || o.status === 'completed') return null;
  return o.id;
}

export interface Group { orderId: number | null; order: YardOrder | null; lines: CheckLine[] }

/** The lines by where they go, in the order they first appear; the shelf is one group. */
export function groupsOf(t: CheckTrip, orders: YardOrder[]): Group[] {
  const out: Group[] = [];
  t.lines.forEach((l) => {
    const to = shareOf(l, orders);
    let g = out.find((x) => x.orderId === to);
    if (!g) { g = { orderId: to, order: to != null ? orders.find((o) => o.id === to) || null : null, lines: [] }; out.push(g); }
    g.lines.push(l);
  });
  return out;
}

/** Quick tiles: few (1–4, then Other) or stacks of a step (10 … 120 bag) with a loose stepper under them. */
export interface Tiles { kind: 'few' | 'stack'; step: number; values: number[] }
const STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export function quickTiles(expected: number): Tiles {
  if (expected <= 4) return { kind: 'few', step: 1, values: [1, 2, 3, 4] };
  // Twelve tiles reach a fifth past what was bought, so the count is never the last tile.
  const step = STEPS.find((s) => s * 12 >= expected * 1.2) || STEPS[STEPS.length - 1];
  return { kind: 'stack', step, values: Array.from({ length: 12 }, (_, i) => (i + 1) * step) };
}

/** Why a count is unlike the Buyer's (store.html:3750 WHY, WHY_OVER; IN03). "I miscounted" keeps nothing and reopens the number. */
export const WHY_UNDER = ['Never came', 'Bent or broken', 'Wrong kind', 'I miscounted'];
export const WHY_OVER = ['Bought extra', 'Sent by mistake', 'I miscounted'];
export const MISCOUNTED = 'I miscounted';
/** Not on the list: why it is on the truck (IN04). */
export const EXTRA_WHY = ['Sent by mistake', 'Bought extra', 'Don’t know'];

export function whyChips(counted: number, expected: number): string[] {
  return counted < expected ? WHY_UNDER : counted > expected ? WHY_OVER : [];
}

export const differs = (l: CheckLine, counted: number | undefined): boolean => counted != null && counted !== l.expected;

/** The draft on the phone: a count per line id, a why per differing line. */
export interface Draft { counts: Record<string, number>; whys: Record<string, string> }

/** A line is done: counted, and if it differs, a why that is not "I miscounted". */
export function lineDone(l: CheckLine, d: Draft): boolean {
  const c = d.counts[l.id];
  if (c == null) return false;
  return !differs(l, c) || (!!d.whys[l.id] && d.whys[l.id] !== MISCOUNTED);
}

/** How many of the lines to count are counted (the dock's ring: "1/3"). */
export function progress(t: CheckTrip, d: Draft): { done: number; of: number } {
  const ls = toCount(t);
  return { done: ls.filter((l) => d.counts[l.id] != null).length, of: ls.length };
}

/** Ready to slide: every line counted, and every difference has its why. */
export const ready = (t: CheckTrip, d: Draft): boolean => toCount(t).every((l) => lineDone(l, d));

/** W14's lines: each counted line in the shelf's unit, with its why; a line not found goes as 0. */
export function payload(t: CheckTrip, d: Draft): CheckInLine[] {
  return t.lines.map((l) => {
    const counted = l.notFound ? 0 : d.counts[l.id] ?? l.expected;
    const why = l.notFound ? 'Not found' : differs(l, counted) ? d.whys[l.id] : undefined;
    return why ? { trip: l.trip, idx: l.idx, counted, why } : { trip: l.trip, idx: l.idx, counted };
  });
}

export interface OrderMove { orderId: number; order: YardOrder | null; got: number; want: number; allIn: boolean }
export interface Difference { line: CheckLine; counted: number; diff: number; why: string }

/**
 * What the check-in moves (IN05, IN06): each order's lines counted so far (got of want; all in moves it
 * to Packing, short still goes, "pack 18 of 20", IM-36), and each line that differs, for Ruth (IM-23).
 */
export function outcome(t: CheckTrip, d: Draft, orders: YardOrder[]): { orders: OrderMove[]; differs: Difference[] } {
  const moves: OrderMove[] = [];
  groupsOf(t, orders).forEach((g) => {
    if (g.orderId == null) return;
    const counted = g.lines.filter((l) => !l.notFound && d.counts[l.id] != null);
    if (!counted.length) return;
    const got = counted.reduce((s, l) => s + (d.counts[l.id] as number), 0), want = counted.reduce((s, l) => s + l.expected, 0);
    moves.push({ orderId: g.orderId, order: g.order, got, want, allIn: got >= want });
  });
  const diffs = toCount(t).filter((l) => differs(l, d.counts[l.id])).map((l) => {
    const c = d.counts[l.id] as number;
    return { line: l, counted: c, diff: c - l.expected, why: d.whys[l.id] || '' };
  });
  return { orders: moves, differs: diffs };
}

/** The draft as the books hold it after a check-in (each stop's yard count): for a trip already checked in. */
export function draftOf(t: CheckTrip): Draft {
  const d: Draft = { counts: {}, whys: {} };
  t.lines.forEach((l) => { if (!l.notFound) d.counts[l.id] = l.yard ?? l.expected; });
  return d;
}

/** "4 box · 1 tin": a group's counted lines, in their units. */
export function countedWords(ls: CheckLine[], d: Draft): string {
  return ls.filter((l) => !l.notFound && d.counts[l.id] != null).map((l) => `${d.counts[l.id]} ${l.unit}`).join(' · ');
}
