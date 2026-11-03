/*
 * What the counter reads from the books, once: today's counter sales (KC01's "6 sales · 412,000",
 * KC14's bars) and the shelf's best sellers (KC01 tiles; the rows under a basket). The search and
 * who is due are core rules (core/items.ts, core/customers.ts).
 */
import { orderTotal } from '../../../core/money.ts';
import { dueCustomers, dueWords } from '../../../core/customers.ts';
import { dayOf } from '../../../core/time.ts';
import type { Books, Customer, Item, Line, Method, Order } from '../../../core/types.ts';

/** Today's counter sales, oldest first: each with its amount and how it was paid. */
export function counterToday(b: Books, now: number): { o: Order; amount: number; method: Method }[] {
  const today = dayOf(now);
  return b.orders
    .filter((o) => o.counter && o.invoiced && !o.voided && !o.cancelled && o.invoicedAt != null && dayOf(o.invoicedAt) === today)
    .sort((x, y) => (x.invoicedAt || 0) - (y.invoicedAt || 0))
    .map((o) => ({ o, amount: orderTotal(o), method: o.payments.length ? o.payments[0].method : 'cash' }));
}

const sellable = (it: Item | undefined): it is Item => !!it && it.price != null && (it.onShelf || 0) > 0;

/** Sold most today at the counter: by how many sales had it, then by what it took. Only what is on the shelf. */
export function bestSellers(b: Books, now: number): Item[] {
  const n = new Map<string, number>(), took = new Map<string, number>();
  counterToday(b, now).forEach(({ o }) => o.lines.forEach((l) => {
    n.set(l.itemId, (n.get(l.itemId) || 0) + 1);
    took.set(l.itemId, (took.get(l.itemId) || 0) + l.qty * (l.price || 0));
  }));
  return [...n.keys()].sort((a, c) => (n.get(c) || 0) - (n.get(a) || 0) || (took.get(c) || 0) - (took.get(a) || 0))
    .map((id) => b.items.find((i) => i.id === id)).filter(sellable);
}

/** Under a basket: the day's four best sellers not in it, those sold most often with what is in it first. */
export function soldWith(b: Books, now: number, lines: Line[]): Item[] {
  const inBasket = new Set(lines.map((l) => l.itemId)), sales = counterToday(b, now).map(({ o }) => new Set(o.lines.map((l) => l.itemId)));
  const best = bestSellers(b, now).slice(0, 4).filter((i) => !inBasket.has(i.id));
  const withIt = (id: string) => sales.filter((s) => s.has(id) && [...inBasket].some((x) => s.has(x))).length;
  return best.map((it, rank) => ({ it, rank, w: withIt(it.id) })).sort((x, y) => y.w - x.w || x.rank - y.rank).map((x) => x.it);
}

/** The name's part the words found, to mark it ("Roof paint" in "Roof paint · maroon 20L"). */
export function markOf(name: string, words: string): [string, string] | null {
  const head = name.split(' · ')[0], ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  return ws.length && ws.every((w) => head.toLowerCase().includes(w)) ? [head, name.slice(head.length)] : null;
}

export interface Due { c: Customer; late: number; words: string }

/** Who is due (core/customers.ts), with the words KC04 draws. */
export function dueOf(b: Books, now: number): Due[] {
  return dueCustomers(b.customers, b.orders, dayOf(now)).map(({ c, r }) => ({ c, late: r.late || 0, words: dueWords(r) }));
}
