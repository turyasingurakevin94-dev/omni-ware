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
 *                           (a stop taken off the planned trip is left out: it is not bought today)
 *   handIn(trip, b)         what was paid, the cash back, what came short, and each order's share of what was paid
 *   paidShares(paid, came)  a stop's payment shared over its lines by what came at cost (the books' gotPrice too)
 *   readyForBuying(o)       every line found or off the bill: the order moves to Buying by itself
 *   askMessage(s, lines, shop) the WhatsApp message one Ask sends: every line of that supplier, all orders
 *   waLink(phone, text)     the wa.me link; intlPhone(p) a Ugandan number for wa.me and tel:
 */
import { LINE_WORD, lineWord } from '../lineword.ts';
import { phone9 } from '../names.ts';
import type { Ms, UGX } from '../types.ts';
import type { BLine, BOrder, BuyerBooks, LineState, Stop, Supplier, Trip } from './types.ts';

/** An ask with no answer is late after this long (buyer.html's chase after 30 minutes). */
export const LATE_MS = 30 * 60 * 1000;

/** The order the trip drives the markets in. A place not here goes last, by name. */
export const ROUTE = ['Nakawa', 'Owino', 'Kiseka', 'Katwe', 'Ndeeba', 'Namanve'];

/** The word Sales and the Buyer both show for a line state (handover.md §6; the one list in core/lineword.ts). */
export const WORD: Record<LineState, string> = LINE_WORD;

const onTrip = (trip: Trip | null, o: BOrder, l: BLine): Stop | null => {
  if (!trip || trip.state === 'planned' || trip.state === 'in') return null;
  return trip.stops.find((s) => !s.off && s.lines.some((x) => x.orderId === o.id && x.key === l.key)) || null;
};

/** Where a line stands: the shared rule (core/lineword.ts), from the Buyer's books. */
export function lineState(o: BOrder, l: BLine, trip: Trip | null = null): LineState {
  const c = l.supplierId ? o.confirms[l.supplierId] : undefined;
  return lineWord({
    removed: !!l.removed, got: l.got, qty: l.qty, supplierId: l.supplierId, clientWaits: !!l.clientWaits,
    onTrip: !!l.supplierId && !!onTrip(trip, o, l), priceWaits: l.ruthDecides, priceComing: !!l.priceComing,
    asked: !!(c && c.askedAt), answer: c && (c.state === 'found' || c.state === 'notfound') ? c.state : null,
  });
}

/** The live orders the Buyer works: still checking or buying, not held (a cancel asked, X-1) and not a test record. */
export function liveOrders(b: BuyerBooks): BOrder[] {
  return b.orders.filter((o) => (o.status === 'draft' || o.status === 'awaiting_goods') && !o.hold && !o.test);
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

/** On the move: suppliers to ask, asked, found, on the trip; and of all suppliers in play, how many found. */
export function tiles(b: BuyerBooks, now: Ms): Tiles {
  const refs = lineRefs(b), sup = (st: LineState) => new Set(refs.filter((r) => r.state === st).map((r) => r.line.supplierId)).size;
  // A supplier asked for a live order stays in play after its line moves on (Client waits, another supplier):
  // the count of suppliers never drops because one said no.
  const inPlay = new Set<string>(refs.filter((r) => r.line.supplierId && r.state !== 'removed').map((r) => r.line.supplierId as string));
  liveOrders(b).forEach((o) => Object.entries(o.confirms).forEach(([sid, c]) => { if (c && c.askedAt && o.lines.some((l) => !l.removed)) inPlay.add(sid); }));
  return {
    // To ask counts the suppliers one Ask goes to (Kevin, 11 Nov: suppliers), the very rows Today lists (BUY-2).
    // Every tile counts suppliers (BUY-03): On the trip too, the suppliers with a line on the road.
    toask: askGroups(b, now).length, asked: sup('asked'), found: sup('found'), ontrip: sup('ontrip'),
    suppliers: inPlay.size, foundSuppliers: sup('found'),
  };
}

/*
 * One definition per number (Buyer round 1, BUY-03; ROUND-1.md "the one definition per number"). Each
 * number on a Buyer screen is one of these, and says its unit word beside it (UNIT, with counted()).
 *
 *   To ask · Asked · Found · On the trip   suppliers (tiles)
 *   Checking                               orders still being checked (checking)
 *   Needs you                              jobs: a supplier to ask, a line with no supplier, a Not found line (jobs)
 *   the red +                              stops on the plan; a held line is not a stop (planStops)
 *   a supplier's record                    asks over the last 30 days: said yes N of M; none at 0 of 0 (record)
 */
export const UNIT = { tile: 'supplier', checking: 'order', needs: 'job', stop: 'stop', record: 'ask' } as const;

/** Still in Checking: a draft with a line not found yet, oldest first (Orders' head and Today's "On the move"). */
export function checking(b: BuyerBooks): BOrder[] {
  return b.orders.filter((o) => o.status === 'draft' && !readyForBuying(o)).sort((x, y) => x.placedAt - y.placedAt);
}

/** Needs you: one job per row Today draws — each supplier to ask, each line with no supplier, each Not found line. */
export function jobs(b: BuyerBooks, now: Ms): number {
  const refs = lineRefs(b);
  return askGroups(b, now).length + refs.filter((r) => r.state === 'nosupplier' || r.state === 'notfound').length;
}

/**
 * The stops the red +, the Plan's head and Today's trip card count. Before the cash ask: the plan's stops not
 * taken off, and a stop whose every line is held (Price up, Asked) is no stop. Once asked: the trip's stops
 * not off; on the road, those still to do.
 */
export function planStops(b: BuyerBooks): Stop[] {
  const t = b.trip;
  if (t && t.state === 'cash') return t.stops.filter((s) => !s.off);
  if (t && t.state === 'on') return t.stops.filter((s) => !s.off && !s.done);
  return planned(b).filter((s) => !s.off);
}

/** The plan's stops before the cash ask, off ones kept (Put back): the trip's own once planned, else the proposal; held-only stops gone. */
export function planned(b: BuyerBooks): Stop[] {
  const p = tripPlan(b), t = b.trip;
  const stops = t && (t.state === 'planned' || t.state === 'cash') ? t.stops : p.stops;
  if (t && t.state === 'cash') return stops;
  const held = new Set(p.held.map((r) => `${r.order.id}|${r.line.key}`));
  return stops.filter((s) => s.lines.some((l) => !held.has(`${l.orderId}|${l.key}`)));
}

/** A supplier's record, over the last 30 days: said yes `yes` of `asks`. Null at 0 of 0 (nothing to show). */
export function record(s: Supplier): { yes: number; asks: number } | null {
  return s.asked > 0 ? { yes: s.found, asks: s.asked } : null;
}

/** "said yes 9 of 10 asks". */
export function recordWord(r: { yes: number; asks: number }): string {
  return `said yes ${r.yes} of ${r.asks} ${r.asks === 1 ? 'ask' : 'asks'}`;
}

/** A unit for "/ pcs" and "per pcs": the price's own, else the line's, else "each" (BUY-12). */
export function unitOr(unit: string | null | undefined, lineUnit?: string | null): string {
  const u = String(unit || '').trim();
  if (u) return u;
  const l = String(lineUnit || '').trim();
  return l || 'each';
}

/** "To buy today": what the trip as planned costs (the found lines, less any stop taken off this trip). */
export function toBuy(b: BuyerBooks): UGX {
  return tripPlan(b).cash;
}

const routeIndex = (place: string): number => { const i = ROUTE.indexOf(place); return i < 0 ? ROUTE.length : i; };

export interface TripPlan {
  /** The stops to make, in route order (without those taken off this trip). */
  stops: Stop[];
  cash: UGX;
  /** Lines held off the trip and why: the Manager decides a price, or the supplier has not answered. */
  held: LineRef[];
}

/**
 * The trip the app proposes: every found line, one stop per supplier, in route order; the cash is their cost.
 * A stop the Buyer took off the planned trip is not in it: Today, the + and the Plan read one figure.
 */
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
  const planned = b.trip && (b.trip.state === 'planned' || b.trip.state === 'cash') ? b.trip : null;
  const off = new Set(planned ? planned.stops.filter((s) => s.off).map((s) => s.supplierId) : []);
  const go = stops.filter((s) => !off.has(s.supplierId));
  return { stops: go, cash: tripCash(go), held: refs.filter((r) => r.state === 'priceup' || r.state === 'asked') };
}

/** A stop's cash: what is planned on it, unless it is off the trip. */
export function tripCash(stops: Stop[]): UGX {
  return stops.filter((s) => !s.off).reduce((t, s) => t + s.planned, 0);
}

/**
 * A stop's payment shared over its lines in proportion to what came at cost (got × cost), in whole
 * shillings that add up to the payment exactly (the largest remainders take the odd shilling). Paid
 * 650,000 for 20 bags planned at 34,000: the line carries 650,000. With nothing to weigh by, evenly.
 * The books keep the same share as the line's price paid (supabase/trip.ts gotPrice).
 */
export function paidShares(paid: UGX, came: number[]): UGX[] {
  if (!came.length) return [];
  const w = came.map((x) => (x > 0 ? x : 0)), sum = w.reduce((t, x) => t + x, 0);
  const ws = sum > 0 ? w : came.map(() => 1), total = sum > 0 ? sum : came.length;
  const whole = Math.round(paid);
  const raw = ws.map((x) => (whole * x) / total), out = raw.map(Math.floor);
  let left = whole - out.reduce((t, x) => t + x, 0);
  raw.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, c) => c.r - a.r || a.i - c.i)
    .forEach(({ i }) => { if (left > 0) { out[i] += 1; left -= 1; } });
  return out;
}

/** One order on the trip: what its lines were planned at, and what was really paid for them. */
export interface OrderPaid { order: BOrder; planned: UGX; came: UGX }

export interface HandIn {
  paid: UGX;
  back: UGX;
  shorts: { order: BOrder; line: BLine; got: number }[];
  orders: BOrder[];
  /** Per order, in the orders' order: planned and its share of what was paid. They add up to `paid`. */
  byOrder: OrderPaid[];
}

/** What the trip paid, the cash it brings back, the lines that came short, and each order's share of the payment. */
export function handIn(trip: Trip, b: BuyerBooks): HandIn {
  const stops = trip.stops.filter((s) => !s.off);
  const paid = stops.reduce((t, s) => t + (s.paid ?? 0), 0);
  const ids = new Set(stops.flatMap((s) => s.lines.map((l) => l.orderId)));
  const orders = b.orders.filter((o) => ids.has(o.id));
  const find = (x: { orderId: number; key: string }) => {
    const order = orders.find((o) => o.id === x.orderId), line = order?.lines.find((l) => l.key === x.key);
    return order && line ? { order, line } : null;
  };
  const shorts = stops.flatMap((s) => s.lines).map((x) => {
    const r = find(x);
    return r && r.line.got != null && r.line.got < r.line.qty ? { ...r, got: r.line.got } : null;
  }).filter((x): x is { order: BOrder; line: BLine; got: number } => !!x);
  const planned = new Map<number, UGX>(), came = new Map<number, UGX>();
  stops.forEach((s) => {
    const rows = s.lines.map(find).filter((r): r is { order: BOrder; line: BLine } => !!r);
    const atCost = rows.map((r) => (r.line.got ?? 0) * r.line.cost);
    const shares = s.done && s.paid != null ? paidShares(s.paid, atCost) : atCost;
    rows.forEach((r, i) => {
      planned.set(r.order.id, (planned.get(r.order.id) || 0) + r.line.qty * r.line.cost);
      came.set(r.order.id, (came.get(r.order.id) || 0) + shares[i]);
    });
  });
  const byOrder = orders.map((order) => ({ order, planned: planned.get(order.id) || 0, came: came.get(order.id) || 0 }));
  return { paid, back: Math.max(0, trip.cash.amount - paid), shorts, orders, byOrder };
}

/** A stop just done, as the books will hold it: what came on each line, what was paid, done. Pure: a new copy. */
export function withStopDone(b: BuyerBooks, sid: string, counts: { orderId: number; key: string; got: number }[], paid: UGX, at: Ms | null = null): BuyerBooks {
  if (!b.trip) return b;
  const orders = b.orders.map((o) => (counts.some((c) => c.orderId === o.id)
    ? { ...o, lines: o.lines.map((l) => { const c = counts.find((k) => k.orderId === o.id && k.key === l.key); return c ? { ...l, got: c.got } : l; }) }
    : o));
  const stops = b.trip.stops.map((s) => (s.supplierId === sid ? { ...s, paid, done: true, doneAt: at } : s));
  return { ...b, orders, trip: { ...b.trip, stops } };
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

/** A Ugandan number for wa.me and tel: links (256 and the last 9 digits). */
export function intlPhone(p: string): string {
  const n = phone9(p);
  return n ? '256' + n : String(p || '').replace(/[^0-9]/g, '');
}

/** The WhatsApp message one Ask sends: every line of that supplier, all orders together. */
export function askMessage(supplier: Supplier, lines: BLine[], shop: string): string {
  const rows = lines.map((l) => `- ${l.name}: ${l.qty} ${l.unit}`);
  return [`Hello ${supplier.name}, ${shop} here. Do you have these today, at the same price?`, ...rows].join('\n');
}

/** The wa.me link, with the message written when there is one. */
export function waLink(phone: string, text?: string): string {
  return `https://wa.me/${intlPhone(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
