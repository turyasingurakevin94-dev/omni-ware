/*
 * What the books say about a customer and the shop, for starting and
 * filling an order: their rhythm (FACTS §3.2: last order = the most recent
 * placed), their usual, what they buy with an item ("Often with", as the
 * agent app counts it: agent.html oftenWith), what the shop sells most
 * (agent.html sellMostItems, the last 30 days), the aisles, and finding an
 * item or a customer by what was typed or said.
 *
 * Pure functions over the books: no screen, no clock of its own.
 */
import { short } from '../../../core/money.ts';
import { addDays, dayLabel, dayOf, daysApart } from '../../../core/time.ts';
import type { Books, Customer, Item, Order } from '../../../core/types.ts';

const live = (o: Order) => !o.voided && !o.cancelled && !o.qa;

/** Their orders, newest first. */
export function ordersOf(b: Books, customerId: string): Order[] {
  return b.orders.filter((o) => o.customerId === customerId && live(o)).sort((x, y) => y.placedAt - x.placedAt);
}

export interface Rhythm { every: number; last: Order | null; next: string | null; late: number; dueToday: boolean }

export function rhythm(b: Books, c: Customer, now: number): Rhythm {
  const last = ordersOf(b, c.id)[0] || null, today = dayOf(now);
  if (!c.everyDays || !last) return { every: c.everyDays || 0, last, next: null, late: 0, dueToday: false };
  const next = addDays(dayOf(last.placedAt), c.everyDays), d = daysApart(next, today);
  return { every: c.everyDays, last, next, late: Math.max(0, d), dueToday: d === 0 };
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** The who pill's line and dot (SL03, SL04, SL25, SL30, SL23). */
export function whoLine(b: Books, c: Customer, now: number): { text: string; dot: string } {
  const r = rhythm(b, c, now), owes = c.owes > 0 ? `owes ${short(c.owes)}` : '';
  if (r.late) return { text: `${days(r.late)} late · ${owes || `every ${days(r.every)}`}`, dot: '#95530C' };
  if (r.dueToday) return { text: `Due today · ${owes || `every ${days(r.every)}`}`, dot: '#0F6B43' };
  if (owes) return { text: `Every ${days(r.every)} · ${owes}`, dot: '#0F6B43' };
  const credit = ordersOf(b, c.id).some((o) => o.credit);
  return { text: credit ? 'on credit before' : 'cash so far', dot: '#9AA1AE' };
}

/** "Due today · every 7 days", "4 days late · every 14 days" (SL01 Who's due). */
export function dueLine(r: Rhythm): string {
  return `${r.dueToday ? 'Due today' : `${days(r.late)} late`} · every ${days(r.every)}`;
}

/** Who's due: late or due today, due today first, then the latest. FACTS §3.2: 3. */
export function whosDue(b: Books, now: number): { c: Customer; r: Rhythm }[] {
  return b.customers.filter((c) => !c.qa).map((c) => ({ c, r: rhythm(b, c, now) }))
    // Late by more than a whole round is gone quiet (FACTS §3.2: 8), not due.
    .filter((x) => x.r.next && (x.r.dueToday || (x.r.late > 0 && x.r.late <= x.r.every)))
    .sort((x, y) => (y.r.dueToday ? 1 : 0) - (x.r.dueToday ? 1 : 0) || y.r.late - x.r.late);
}

/** "Kato Construction" → "Kato"; "Kyaligonza & Sons" → "Kyaligonza". */
export const first = (name: string) => name.split(/\s+/)[0];
export const whose = (name: string) => `${first(name)}’s`;

/* ---------------- items ---------------- */

const key = (itemId: string, vi: number | null) => `${itemId}::${vi ?? ''}`;
export const itemKey = (i: { id?: string; itemId?: string; variantIdx: number | null }) => key((i.itemId || i.id) as string, i.variantIdx);

/** How many of these orders hold each item. */
function tally(orders: Order[]): Map<string, number> {
  const by = new Map<string, number>();
  orders.forEach((o) => new Set(o.lines.map(itemKey)).forEach((k) => by.set(k, (by.get(k) || 0) + 1)));
  return by;
}

export function item(b: Books, k: string): Item | undefined {
  return b.items.find((i) => itemKey(i) === k);
}

/**
 * "Often with" an item: what came in the same orders as it, across this customer's orders when they
 * have had it twice or more (else across all of mine), less what is in the order already; each with
 * how many of their orders had it (agent.html oftenWith). Most often together first.
 */
export function oftenWith(b: Books, customerId: string | null, anchor: string, inOrder: Set<string>, me: string, n = 3): { mine: boolean; of: number; rows: { it: Item; had: number }[] } {
  const scan = (orders: Order[]) => {
    const withIt = orders.filter((o) => o.lines.some((l) => itemKey(l) === anchor));
    const together = tally(withIt), had = tally(orders);
    const rows = [...together.entries()].filter(([k]) => k !== anchor && !inOrder.has(k))
      .sort((x, y) => y[1] - x[1] || (had.get(y[0]) || 0) - (had.get(x[0]) || 0))
      .map(([k]) => ({ it: item(b, k), had: had.get(k) || 0 })).filter((r): r is { it: Item; had: number } => !!r.it);
    return { of: orders.length, with: withIt.length, rows };
  };
  let got = customerId ? scan(ordersOf(b, customerId)) : null, mine = true;
  // A customer's own orders only (SL10: nothing for cement Kato had once); a walk-in's, mine.
  if (got && got.with < 2) got = { ...got, rows: [] };
  if (!got) { got = scan(b.orders.filter((o) => live(o) && o.placedBy === me)); mine = false; }
  return { mine, of: got.of, rows: got.rows.slice(0, n) };
}

/** What I sell most, the last 30 days (agent.html sellMostItems): how many of my orders had each. */
export function sellMost(b: Books, me: string, now: number, n = 3): { it: Item; sold: number }[] {
  const since = now - 30 * 864e5;
  const by = tally(b.orders.filter((o) => live(o) && o.placedBy === me && o.placedAt >= since));
  return [...by.entries()].sort((x, y) => y[1] - x[1]).map(([k, sold]) => ({ it: item(b, k) as Item, sold })).filter((x) => x.it).slice(0, n);
}

/** A customer's own items: their usual, and anything in half their orders or more (the aisles they buy from). */
export function theirItems(b: Books, c: Customer): Set<string> {
  const orders = ordersOf(b, c.id), had = tally(orders), out = new Set(c.usual.map(itemKey));
  had.forEach((n, k) => { if (orders.length && n >= 3 && n * 2 >= orders.length) out.add(k); });
  return out;
}

/** How a found item ranks for them: their own (2), had in the last 7 days (1), else 0. */
export function rankFor(b: Books, c: Customer | null, now: number): (key: string) => number {
  if (!c) return () => 0;
  const theirs = theirItems(b, c), week = new Set<string>();
  ordersOf(b, c.id).filter((o) => now - o.placedAt <= 7 * 864e5).forEach((o) => o.lines.forEach((l) => week.add(itemKey(l))));
  return (k) => (theirs.has(k) ? 2 : week.has(k) ? 1 : 0);
}

/** Per aisle, how many of their own items it holds. */
export function aisleMarks(b: Books, c: Customer | null): Map<string, number> {
  const m = new Map<string, number>();
  if (!c) return m;
  theirItems(b, c).forEach((k) => { const it = item(b, k); if (it) m.set(it.aisle, (m.get(it.aisle) || 0) + 1); });
  return m;
}

/** The aisles in the shop's order (as its items list them), with how many items each holds. */
export function aisles(b: Books): { name: string; count: number }[] {
  const m = new Map<string, number>();
  b.items.forEach((i) => m.set(i.aisle, (m.get(i.aisle) || 0) + 1));
  return [...m].map(([name, count]) => ({ name, count }));
}

/** Their last order (SL03 "Last order #0553 · today 10:16 · 170,000"). */
export function lastOrder(b: Books, customerId: string): Order | null {
  return ordersOf(b, customerId)[0] || null;
}

export function dayWord(ms: number, now: number): string {
  const d = daysApart(dayOf(ms), dayOf(now));
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : dayLabel(ms);
}

/** How many of an item this customer had the last time (the hinge: 10 pair, SL21). */
export function lastQty(b: Books, customerId: string, itemId: string): number | null {
  for (const o of ordersOf(b, customerId)) {
    const l = o.lines.find((x) => x.itemId === itemId);
    if (l) return l.qty;
  }
  return null;
}

/** What this customer paid each for an item the last time they had it (SL06 "last 38,000"). */
export function lastPaid(b: Books, customerId: string, itemId: string, vi: number | null): number | null {
  for (const o of ordersOf(b, customerId)) {
    const l = o.lines.find((x) => x.itemId === itemId && x.variantIdx === vi && x.price != null && x.state !== 'dropped');
    if (l) return l.price;
  }
  return null;
}
