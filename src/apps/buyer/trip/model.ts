/*
 * The trip tab's readings of the books: pure helpers over src/core/buyer/rules.ts.
 * No rule is worked out here that rules.ts already has (tripPlan, tripCash,
 * handIn, lineState); these only look things up and put words together.
 */
import { handIn, tripCash, tripPlan, withStopDone, type LineRef } from '../../../core/buyer/rules.ts';
import type { StopCount } from '../../../core/buyer/source.ts';
import type { Kept } from '../../../core/outbox.ts';
import type { BLine, BOrder, BuyerBooks, Stop, Supplier, Trip } from '../../../core/buyer/types.ts';
import { firstWord } from '../../../core/names.ts';
import type { Member, Role } from '../../../core/types.ts';

export type TripView = 'plan' | 'on' | 'handin';

/**
 * Plan when no trip is on (none, planned, or the last one handed in), and while the cash ask waits on
 * Accounts (TripPlan.dc.html phone 2, "Waiting for Esther"); On the trip once the cash is in hand.
 */
export function viewOf(b: BuyerBooks): TripView {
  const t = b.trip;
  if (!t || t.state === 'planned' || t.state === 'cash' || t.state === 'in') return 'plan';
  return liveStops(t).length > 0 && liveStops(t).every((s) => s.done) ? 'handin' : 'on';
}

export const liveStops = (t: Trip): Stop[] => t.stops.filter((s) => !s.off);

export const supplierOf = (b: BuyerBooks, id: string): Supplier | undefined => b.suppliers.find((s) => s.id === id);

export const memberOf = (b: BuyerBooks, id: string | null): Member | undefined => (id ? b.team.find((m) => m.id === id) : undefined);

/** The one person in a role (Esther, accounts; Musa, store; Ruth, manager). */
export const byRole = (b: BuyerBooks, role: Role): Member | undefined => b.team.find((m) => m.role === role);

export interface StopRow { order: BOrder; line: BLine }

/** A stop's lines, with their orders. */
export function stopLines(b: BuyerBooks, s: Stop): StopRow[] {
  return s.lines.map((x) => {
    const order = b.orders.find((o) => o.id === x.orderId);
    const line = order?.lines.find((l) => l.key === x.key);
    return order && line ? { order, line } : null;
  }).filter((r): r is StopRow => !!r);
}

/** The order ids on a stop, in order, once each. */
export const stopOrders = (s: Stop): number[] => [...new Set(s.lines.map((l) => l.orderId))];

/** "Grace · Faith": the first names of the people who took these orders, once each. */
export function sellersOf(b: BuyerBooks, orders: BOrder[]): string {
  const ids = [...new Set(orders.map((o) => o.sellerId))];
  return ids.map((id) => firstWord(memberOf(b, id)?.name || '')).filter(Boolean).join(' · ');
}

/** The plan as it stands: the trip's own stops once planned (they carry "off"), else the app's proposal. */
export interface PlanNow { stops: Stop[]; cash: number; held: LineRef[]; lines: number; asking: boolean }

export function planNow(b: BuyerBooks): PlanNow {
  const p = tripPlan(b);
  const stops = b.trip && (b.trip.state === 'planned' || b.trip.state === 'cash') ? b.trip.stops : p.stops;
  const on = stops.filter((s) => !s.off);
  return {
    stops, cash: tripCash(stops), held: p.held,
    lines: on.reduce((t, s) => t + s.lines.length, 0),
    asking: b.trip?.state === 'cash',
  };
}

/** Per order on the trip: planned, its share of what was really paid (rules.handIn), and its lines. */
export interface OrderCame { order: BOrder; rows: StopRow[]; planned: number; came: number }

export function ordersCame(b: BuyerBooks, t: Trip): OrderCame[] {
  const rows = liveStops(t).flatMap((s) => stopLines(b, s));
  return handIn(t, b).byOrder.map((o) => ({ ...o, rows: rows.filter((r) => r.order.id === o.order.id) }));
}

/**
 * The books as the trip screens show them: a stop done with no signal waits on this phone (kept), and
 * reads as done, with what came and what was paid, until it is sent (rules.withStopDone, the demo's write too).
 */
export function tripBooks(b: BuyerBooks, kept: Kept[]): BuyerBooks {
  return kept.filter((k) => k.kind === 'stopDone' && k.state !== 'refused' && Array.isArray(k.args)).reduce((x, k) => {
    const [sid, counts, paid] = k.args as [string, StopCount[], number];
    return withStopDone(x, String(sid), counts, Number(paid) || 0, k.at);
  }, b);
}

/** The supplier ids whose stop is saved on this phone, waiting for signal. */
export function keptStops(kept: { kind: string; args: unknown }[]): Set<string> {
  return new Set(kept.filter((k) => k.kind === 'stopDone').map((k) => (Array.isArray(k.args) ? String(k.args[0]) : '')));
}
