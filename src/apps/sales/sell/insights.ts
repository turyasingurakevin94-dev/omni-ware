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
import { dueCustomers, rhythm, type Rhythm } from '../../../core/customers.ts';
import { oftenWith as often } from '../../../core/often.ts';
import { dayLabel, dayOf, daysApart } from '../../../core/time.ts';
import type { Books, Customer, Item, Order } from '../../../core/types.ts';

const live = (o: Order) => !o.voided && !o.cancelled && !o.qa;

/** Their orders, newest first. */
export function ordersOf(b: Books, customerId: string): Order[] {
  return b.orders.filter((o) => o.customerId === customerId && live(o)).sort((x, y) => y.placedAt - x.placedAt);
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

/** A customer's rhythm, by the one rule (core/customers.ts), over these books. */
export const rhythmOf = (b: Books, c: Customer, now: number): Rhythm => rhythm(c, b.orders, dayOf(now));

/** The who pill's line and dot (SL03, SL04, SL25, SL30, SL23): late or due by the one rule, else their gap and what they owe. */
export function whoLine(b: Books, c: Customer, now: number): { text: string; dot: string } {
  const r = rhythmOf(b, c, now), owes = c.owes > 0 ? `owes ${short(c.owes)}` : '', late = r.late || 0;
  if (late > 0) return { text: `${days(late)} late · ${owes || `every ${days(r.every || 0)}`}`, dot: '#95530C' };
  if (r.due) return { text: `Due today · ${owes || `every ${days(r.every || 0)}`}`, dot: '#0F6B43' };
  if (owes && r.every) return { text: `Every ${days(r.every)} · ${owes}`, dot: '#0F6B43' };
  const credit = ordersOf(b, c.id).some((o) => o.credit);
  return { text: credit ? 'on credit before' : 'cash so far', dot: '#9AA1AE' };
}

/** Who's due (SL01), by the one rule: FACTS §3.2, 3. */
export const whosDue = (b: Books, now: number): { c: Customer; r: Rhythm }[] => dueCustomers(b.customers, b.orders, dayOf(now));

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

/** "Often with" an item (P13), by the one rule (core/often.ts), as items: less what is in the order already. */
export function oftenWith(b: Books, customerId: string | null, anchor: { itemId: string; variantIdx: number | null }, inOrder: Set<string>, me: string, n = 3): { mine: boolean; of: number; rows: { it: Item; had: number }[] } {
  const w = often(b.orders, anchor, { customerId, me, skip: inOrder, n });
  const rows = w.rows.map((r) => ({ it: item(b, key(r.itemId, r.variantIdx)), had: r.n })).filter((r): r is { it: Item; had: number } => !!r.it);
  return { mine: w.theirs, of: w.of, rows };
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
