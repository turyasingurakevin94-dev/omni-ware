/*
 * The Buyer's rules, each in one place (docs/spec/04-screens-buyer.md). Pure:
 * books in, words and figures out. Every screen reads these; none works a
 * rule out again for itself.
 *
 *   lineState(o, l, trip)   where a line stands, in the shared words
 *   askGroups(b)            Today's "Needs you": one row per supplier to ask, all orders together
 *   replyRows(b, now)       Replies: one row per supplier asked and not answered yet, late after 30 min
 *   tiles(b)                On the move: To ask · Asked · Found · On the trip
 *   tripPlan(b)             the trip the app proposes: found lines by supplier, in route order, and the cash
 *   handIn(trip, b)         what was paid, the cash back, what came short
 *   readyForBuying(o)       every line found or off the bill: the order moves to Buying by itself
 */
import type { Ms, UGX } from '../types.ts';
import type { BLine, BOrder, BuyerBooks, LineState, Stop, Supplier, Trip } from './types.ts';

/** An ask with no answer is late after this long (buyer.html's chase after 30 minutes). */
export const LATE_MS = 30 * 60 * 1000;

/** The order the trip drives the markets in. A place not here goes last, by name. */
export const ROUTE = ['Nakawa', 'Owino', 'Kiseka', 'Katwe', 'Ndeeba', 'Namanve'];

/** The word Sales and the Buyer both show for a line state (handover.md §6). */
export const WORD: Record<LineState, string> = {
  toask: 'To ask', asked: 'Asked', found: 'Found', notfound: 'Not found', priceup: 'Price up',
  clientwaits: 'Client waits', removed: 'Removed', ontrip: 'On the trip', short: 'Short', in: 'In',
};

const onTrip = (trip: Trip | null, o: BOrder, l: BLine): Stop | null => {
  if (!trip || trip.state === 'planned' || trip.state === 'in') return null;
  return trip.stops.find((s) => !s.off && s.lines.some((x) => x.orderId === o.id && x.key === l.key)) || null;
};

/** Where a line stands. The order of the checks is the rule: off the bill first, the yard last. */
export function lineState(o: BOrder, l: BLine, trip: Trip | null = null): LineState {
  if (l.removed) return 'removed';
  if (l.got != null) return l.got < l.qty ? 'short' : 'in';
  if (l.clientWaits && !l.supplierId) return 'clientwaits';
  if (!l.supplierId) return 'toask';
  if (onTrip(trip, o, l)) return 'ontrip';
  if (l.ruthDecides) return 'priceup';
  const c = o.confirms[l.supplierId];
  if (!c || !c.askedAt) return 'toask';
  if (c.state === 'found') return 'found';
  if (c.state === 'notfound') return 'notfound';
  return 'asked';
}

/** The live orders the Buyer works: still checking or buying. */
export function liveOrders(b: BuyerBooks): BOrder[] {
  return b.orders.filter((o) => o.status === 'draft' || o.status === 'awaiting_goods');
}

export interface LineRef { order: BOrder; line: BLine; state: LineState }

export function lineRefs(b: BuyerBooks): LineRef[] {
  return liveOrders(b).flatMap((order) => order.lines.map((line) => ({ order, line, state: lineState(order, line, b.trip) })));
}

export interface SupplierGroup {
  supplier: Supplier;
  lines: LineRef[];
  /** The orders in it, oldest first. */
  orders: BOrder[];
  askedAt: Ms | null;
  answeredAt: Ms | null;
  /** Asked over 30 minutes ago with no answer. */
  late: boolean;
  total: UGX;
}

function group(b: BuyerBooks, refs: LineRef[], now: Ms): SupplierGroup[] {
  const by = new Map<string, LineRef[]>();
  refs.forEach((r) => { const k = r.line.supplierId as string; by.set(k, [...(by.get(k) || []), r]); });
  const out: SupplierGroup[] = [];
  by.forEach((lines, sid) => {
    const supplier = b.suppliers.find((s) => s.id === sid);
    if (!supplier) return;
    const orders = [...new Set(lines.map((r) => r.order))].sort((x, y) => x.placedAt - y.placedAt);
    const cs = orders.map((o) => o.confirms[sid]).filter(Boolean);
    const askedAt = cs.reduce<Ms | null>((m, c) => (c.askedAt && (m == null || c.askedAt < m) ? c.askedAt : m), null);
    const answeredAt = cs.reduce<Ms | null>((m, c) => (c.answeredAt && (m == null || c.answeredAt > m) ? c.answeredAt : m), null);
    out.push({
      supplier, lines, orders, askedAt, answeredAt,
      late: askedAt != null && answeredAt == null && now - askedAt > LATE_MS,
      total: lines.reduce((t, r) => t + r.line.cost * r.line.qty, 0),
    });
  });
  return out;
}

/** Suppliers to ask, one row each with every order's lines (one message per supplier). Oldest order first. */
export function askGroups(b: BuyerBooks, now: Ms): SupplierGroup[] {
  return group(b, lineRefs(b).filter((r) => r.state === 'toask' && r.line.supplierId), now)
    .sort((x, y) => x.orders[0].placedAt - y.orders[0].placedAt);
}

/** Suppliers asked and not answered yet: late ones first, then the oldest ask. */
export function replyRows(b: BuyerBooks, now: Ms): SupplierGroup[] {
  return group(b, lineRefs(b).filter((r) => r.state === 'asked'), now)
    .sort((x, y) => Number(y.late) - Number(x.late) || (x.askedAt || 0) - (y.askedAt || 0));
}

/** Suppliers that answered, newest answer first, with the state they answered (Found, Not found, Price up). */
export function answeredRows(b: BuyerBooks, now: Ms): (SupplierGroup & { state: LineState })[] {
  const refs = lineRefs(b).filter((r) => r.state === 'found' || r.state === 'notfound' || r.state === 'priceup');
  return group(b, refs, now).map((g) => {
    const st: LineState = g.lines.some((r) => r.state === 'priceup') ? 'priceup' : g.lines.some((r) => r.state === 'notfound') ? 'notfound' : 'found';
    return { ...g, state: st };
  }).sort((x, y) => (y.answeredAt || 0) - (x.answeredAt || 0));
}

export interface Tiles { toask: number; asked: number; found: number; ontrip: number; suppliers: number; foundSuppliers: number }

/** On the move: suppliers to ask, asked, found; lines on the trip; and of all suppliers in play, how many found. */
export function tiles(b: BuyerBooks, now: Ms): Tiles {
  const refs = lineRefs(b), sup = (st: LineState) => new Set(refs.filter((r) => r.state === st).map((r) => r.line.supplierId)).size;
  const inPlay = new Set(refs.filter((r) => r.line.supplierId && r.state !== 'removed').map((r) => r.line.supplierId));
  void now;
  return {
    toask: sup('toask'), asked: sup('asked'), found: sup('found'), ontrip: refs.filter((r) => r.state === 'ontrip').length,
    suppliers: inPlay.size, foundSuppliers: sup('found'),
  };
}

/** "To buy today": what the found lines cost. */
export function toBuy(b: BuyerBooks): UGX {
  return lineRefs(b).filter((r) => r.state === 'found').reduce((t, r) => t + r.line.cost * r.line.qty, 0);
}

const routeIndex = (place: string): number => { const i = ROUTE.indexOf(place); return i < 0 ? ROUTE.length : i; };

export interface TripPlan {
  stops: Stop[];
  cash: UGX;
  /** Lines held off the trip and why: the Manager decides a price, or the supplier has not answered. */
  held: LineRef[];
}

/** The trip the app proposes: every found line, one stop per supplier, in route order; the cash is their cost. */
export function tripPlan(b: BuyerBooks): TripPlan {
  const refs = lineRefs(b);
  const found = refs.filter((r) => r.state === 'found');
  const by = new Map<string, LineRef[]>();
  found.forEach((r) => { const k = r.line.supplierId as string; by.set(k, [...(by.get(k) || []), r]); });
  const sup = (id: string) => b.suppliers.find((s) => s.id === id);
  const stops: Stop[] = [...by.entries()]
    .sort(([a], [c]) => routeIndex(sup(a)?.place || '') - routeIndex(sup(c)?.place || '') || (sup(a)?.name || '').localeCompare(sup(c)?.name || ''))
    .map(([supplierId, rs]) => ({
      supplierId, lines: rs.map((r) => ({ orderId: r.order.id, key: r.line.key })),
      planned: rs.reduce((t, r) => t + r.line.cost * r.line.qty, 0), paid: null, done: false, off: false,
    }));
  return { stops, cash: stops.reduce((t, s) => t + s.planned, 0), held: refs.filter((r) => r.state === 'priceup' || r.state === 'asked') };
}

/** A stop's cash: what is planned on it, unless it is off the trip. */
export function tripCash(stops: Stop[]): UGX {
  return stops.filter((s) => !s.off).reduce((t, s) => t + s.planned, 0);
}

export interface HandIn {
  paid: UGX;
  back: UGX;
  shorts: { order: BOrder; line: BLine; got: number }[];
  orders: BOrder[];
}

/** What the trip paid, the cash it brings back, and the lines that came short. */
export function handIn(trip: Trip, b: BuyerBooks): HandIn {
  const stops = trip.stops.filter((s) => !s.off);
  const paid = stops.reduce((t, s) => t + (s.paid ?? 0), 0);
  const ids = new Set(stops.flatMap((s) => s.lines.map((l) => l.orderId)));
  const orders = b.orders.filter((o) => ids.has(o.id));
  const shorts = stops.flatMap((s) => s.lines).map((x) => {
    const order = orders.find((o) => o.id === x.orderId), line = order?.lines.find((l) => l.key === x.key);
    return order && line && line.got != null && line.got < line.qty ? { order, line, got: line.got } : null;
  }).filter((x): x is { order: BOrder; line: BLine; got: number } => !!x);
  return { paid, back: Math.max(0, trip.cash.amount - paid), shorts, orders };
}

/** Every line found or off the bill (none to ask, asked, not found, price up or waiting): the order moves to Buying. */
export function readyForBuying(o: BOrder): boolean {
  if (o.status !== 'draft') return false;
  const live = o.lines.filter((l) => !l.removed);
  return live.length > 0 && live.every((l) => lineState(o, l) === 'found');
}

/** "Short · got 36 of 40". */
export function shortWord(got: number, qty: number): string {
  return `Short · got ${got} of ${qty}`;
}
