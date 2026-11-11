/*
 * The shelf, once (docs/spec/04-screens-store.md §4.5; store.html:1596–1650, 5120–5143).
 *
 *   onShelf(b, key)        "412 on shelf": the books less what has left for orders not invoiced (packed,
 *                          out, delivered; a short at what was picked), never below 0. The figure Sales shows.
 *   packedFor(b, key)      what is packed for an order on a bay ("packed for #0552 · bay 1 · 40"), apart; never "held"
 *   orderIn(b, key)        an order waiting for this item from a supplier ("Order in · for #0546 · ~11:30")
 *   aislesOf(b, now)       the aisles A–L: letter, items, days since counted, what needs a look
 *   lookOf(b, it, now)     what needs a look, worst first: reported · short · out · low · due
 *   moved(b, key, now)     four weeks of what moved, newest first (the log, the counts, the reports, the asks)
 *
 * No money: no price, no cost, no value of the shelf. "Shelf", never "books", beside a figure (DATA-04).
 */
import type { Ms } from '../types.ts';
import { aisleLetter, countDue, daysSince } from './counts.ts';
import type { ShelfItem, StockReport, StoreAsk, YardBooks, YardOrder } from './types.ts';
import { isCancelled } from './yard.ts';

const DAY_MS = 864e5;

/** An aisle's letter by its place in the shop's list ("Roofing" → A); null: no aisle yet (DATA-05). The rule is counts.ts aisleLetter. */
export const letterOf = (b: Pick<YardBooks, 'aisles'>, category: string | null): string | null => aisleLetter(b, category) || null;
export const aisleOfLetter = (b: Pick<YardBooks, 'aisles'>, letter: string): string | null => b.aisles[letter.toUpperCase().charCodeAt(0) - 65] || null;

/** A line has left the shelf: packed (or short at what was picked) on an order not invoiced and not called off. */
function leftFor(o: YardOrder): boolean {
  return !o.invoiced && !isCancelled(o);
}

/** The shelf figure (store.html:1617–1637 heldForOrders, heldGone; ow_held_gone 0142). */
export function onShelf(b: Pick<YardBooks, 'items' | 'orders'>, key: string): number {
  const it = b.items.find((x) => x.key === key);
  if (!it) return 0;
  const gone = b.orders.filter(leftFor).reduce((n, o) => n + o.lines.filter((l) => l.key === key && (l.pickStatus === 'done' || l.pickStatus === 'short'))
    .reduce((m, l) => m + (l.pickedQty || 0), 0), 0);
  return Math.max(0, it.books - gone);
}

export interface Packed { order: YardOrder; qty: number; bay: number | null }

/** Packed for an order still in the yard (on a bay, or being packed): shown apart from the shelf. */
export function packedFor(b: Pick<YardBooks, 'orders'>, key: string): Packed[] {
  return b.orders.filter((o) => leftFor(o) && o.status === 'preparing')
    .map((o) => ({ order: o, qty: o.lines.filter((l) => l.key === key && (l.pickStatus === 'done' || l.pickStatus === 'short')).reduce((m, l) => m + (l.pickedQty || 0), 0), bay: o.bay }))
    .filter((p) => p.qty > 0);
}

export interface OrderIn { order: YardOrder; qty: number; unit: string; due: Ms | null }

/** Bought in for an order and not here yet: "Order in". When it is due, if a trip carrying it says so. */
export function orderIn(b: Pick<YardBooks, 'orders' | 'trips'>, key: string): OrderIn[] {
  const out: OrderIn[] = [];
  b.orders.filter((o) => !isCancelled(o) && (o.status === 'awaiting_goods' || o.status === 'preparing')).forEach((o) => o.lines.forEach((l) => {
    if (l.key !== key || l.dropped || !l.supplierId || l.supplierId === '__stock__' || l.receivedAt != null) return;
    const trip = b.trips.find((t) => !t.voided && !t.yardCheckedAt && t.lines.some((x) => x.key === key && x.orderId === o.id && !x.notFound));
    out.push({ order: o, qty: l.qty, unit: l.unit, due: trip ? trip.dueAt : null });
  }));
  return out;
}

/** Four weeks of what went out, a week's worth (store.html:5133 weeksOf): the "low" rule's yardstick. */
export function weekOut(b: Pick<YardBooks, 'log'>, key: string, now: Ms): number {
  return b.log.filter((r) => r.key === key && r.delta < 0 && now - r.at <= 28 * DAY_MS && r.type !== 'writeoff').reduce((n, r) => n - r.delta, 0) / 4;
}

/** A loss reported and not yet decided. */
export const openReports = (b: Pick<YardBooks, 'reports'>, key: string): StockReport[] => b.reports.filter((r) => r.key === key && r.status === 'sent');

/** What an open order still wants from the shelf (not packed yet), for "short". */
function wanted(b: Pick<YardBooks, 'orders'>, key: string): number {
  return b.orders.filter((o) => o.status === 'preparing' && !isCancelled(o) && o.pickingStatus !== 'done')
    .reduce((n, o) => n + o.lines.filter((l) => l.key === key && !l.dropped && l.pickStatus !== 'done' && l.pickStatus !== 'short' && (!l.supplierId || l.supplierId === '__stock__')).reduce((m, l) => m + l.qty, 0), 0);
}

export type Look = 'reported' | 'short' | 'out' | 'low' | 'due';

/** What is wrong with an item, worst first, or null (store.html:5132 lookOf). An empty shelf nobody asks for is fine. */
export function lookOf(b: YardBooks, it: ShelfItem, now: Ms): Look | null {
  const shelf = onShelf(b, it.key), wk = weekOut(b, it.key, now);
  if (openReports(b, it.key).length) return 'reported';
  if (wanted(b, it.key) > shelf) return 'short';
  if (shelf <= 0 && wk > 0) return 'out';
  if (shelf > 0 && wk >= 1 && shelf < wk) return 'low';
  if (countDue(it, b, now)) return 'due';
  return null;
}

export interface Aisle { name: string; letter: string; items: ShelfItem[]; days: number | null; due: boolean }

/** The aisles A–L. An aisle is as fresh as its oldest count; due when an item in it is (counts.ts countDue: over 21 days, or a recount asked). */
export function aislesOf(b: YardBooks, now: Ms): Aisle[] {
  return b.aisles.map((name) => {
    const items = b.items.filter((x) => x.category === name);
    const oldest = items.reduce<Ms | null>((m, x) => (x.countedAt == null ? m : m == null ? x.countedAt : Math.min(m, x.countedAt)), null);
    const days = oldest == null ? null : daysSince(oldest, now);
    return { name, letter: aisleLetter(b, name), items, days, due: items.some((x) => countDue(x, b, now, onShelf(b, x.key))) };
  });
}

/** Items with no aisle yet (no category, DATA-05). */
export const noAisle = (b: Pick<YardBooks, 'items' | 'aisles'>): ShelfItem[] => b.items.filter((x) => !x.category || !b.aisles.includes(x.category));

/** An aisle's items in the order the shelf shows them: the fullest first, what is only on order last. */
export function aisleItems(b: YardBooks, aisle: string): ShelfItem[] {
  return b.items.filter((x) => x.category === aisle).map((x, i) => ({ x, i, n: onShelf(b, x.key), inn: orderIn(b, x.key).length }))
    .sort((p, q) => q.n - p.n || q.inn - p.inn || p.i - q.i).map((r) => r.x);
}

/** One row of what moved. kind says which picture; delta is null for a count that changed nothing. */
export interface Moved { kind: 'out' | 'packed' | 'in' | 'count' | 'writeoff' | 'kept' | 'ask'; at: Ms; delta: number | null; note: string; who: string; mine: boolean; asked: number | null; unit: string }

/** Four weeks of what moved, newest first (store.html:5256 history; WORD-09). */
export function moved(b: YardBooks, key: string, now: Ms): Moved[] {
  const me = b.me.userId, unit = (b.items.find((x) => x.key === key) || { unit: '' }).unit;
  const rows: Moved[] = b.log.filter((r) => r.key === key && now - r.at <= 28 * DAY_MS && r.type !== 'count' && r.type !== 'writeoff')
    .map((r) => ({ kind: r.type === 'packed' ? 'packed' : r.delta < 0 ? 'out' : 'in', at: r.at, delta: r.delta, note: r.note, who: '', mine: false, asked: null, unit }));
  b.counts.filter((c) => (c.status === 'accepted') && c.decidedAt != null && now - c.decidedAt <= 28 * DAY_MS).forEach((c) => {
    const l = c.lines.find((x) => x.key === key);
    if (l) rows.push({ kind: 'count', at: c.decidedAt as Ms, delta: l.counted - l.system || null, note: c.aisle, who: c.countedByName, mine: c.countedBy === me, asked: c.createdAt, unit });
  });
  b.reports.filter((r) => r.key === key && r.decidedAt != null && (r.status === 'written_off' || r.status === 'dismissed')).forEach((r) => {
    rows.push({ kind: r.status === 'written_off' ? 'writeoff' : 'kept', at: r.decidedAt as Ms, delta: r.status === 'written_off' ? -r.qty : 0, note: r.note || r.why, who: r.byName, mine: r.by === me, asked: r.createdAt, unit });
  });
  b.asks.filter((a: StoreAsk) => a.kind === 'restock' && a.ref === key && a.status !== 'withdrawn').forEach((a) => {
    rows.push({ kind: 'ask', at: a.decidedAt ?? a.createdAt, delta: null, note: String(a.payload.answer || ''), who: a.byName, mine: a.by === me, asked: Number(a.payload.qty) || null, unit: String(a.payload.unit || unit) });
  });
  return rows.sort((x, y) => y.at - x.at);
}

/** The last count of an item Ruth decided (SH16 "18 → 17"), if it is the latest word on it. */
export function lastDecided(b: YardBooks, key: string) {
  const c = b.counts.filter((x) => (x.status === 'accepted' || x.status === 'recount') && x.lines.some((l) => l.key === key))
    .sort((x, y) => (y.decidedAt || 0) - (x.decidedAt || 0))[0];
  return c ? { count: c, line: c.lines.find((l) => l.key === key) as StockCount['lines'][number] } : null;
}
type StockCount = YardBooks['counts'][number];

