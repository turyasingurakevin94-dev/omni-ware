/*
 * What the counter reads from the books, once: today's counter sales (KC01's "6 sales · 412,000",
 * KC14's bars), the shelf's best sellers (KC01 tiles; the rows under a basket), the search (KC02),
 * and who is due (KC04).
 */
import { orderTotal } from '../../../core/money.ts';
import { addDays, dayOf, daysApart } from '../../../core/time.ts';
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

/** "2 paint" → 2 of paint; "paint 2" too. */
export function readQuery(text: string): { qty: number; words: string } {
  const t = text.trim(), lead = t.match(/^(\d+)\s*[x×]?\s+(.+)$/i), tail = t.match(/^(.+?)\s+[x×]?(\d+)$/i);
  if (lead) return { qty: Math.max(1, Number(lead[1])), words: lead[2].trim() };
  if (tail) return { qty: Math.max(1, Number(tail[2])), words: tail[1].trim() };
  return { qty: 1, words: t };
}

/** Items whose name or aisle has every word; what is on the shelf first (most first), then what is ordered in. */
export function find(b: Books, words: string): Item[] {
  const ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  if (!ws.length) return [];
  return b.items
    .filter((i) => i.price != null && ws.every((w) => i.name.toLowerCase().includes(w) || i.aisle.toLowerCase().includes(w)))
    .sort((x, y) => (y.onShelf || 0) - (x.onShelf || 0) || Number(y.orderIn) - Number(x.orderIn));
}

/** The name's part the words found, to mark it ("Roof paint" in "Roof paint · maroon 20L"). */
export function markOf(name: string, words: string): [string, string] | null {
  const head = name.split(' · ')[0], ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  return ws.length && ws.every((w) => head.toLowerCase().includes(w)) ? [head, name.slice(head.length)] : null;
}

export interface Due { c: Customer; late: number; words: string }

/** Who is due (late or due today by their rhythm: last order + every N days, not gone quiet), the most owed first. */
export function dueCustomers(b: Books, now: number): Due[] {
  const today = dayOf(now), out: Due[] = [];
  b.customers.forEach((c) => {
    if (!c.everyDays || c.qa) return;
    const last = b.orders.filter((o) => o.customerId === c.id && !o.cancelled && !o.voided).reduce((m, o) => Math.max(m, o.placedAt), 0);
    if (!last) return;
    const late = daysApart(addDays(dayOf(last), c.everyDays), today);
    // Gone quiet (twice their gap and more since the last order) is not due: it is its own group (Customers).
    if (late < 0 || daysApart(dayOf(last), today) >= 2 * c.everyDays) return;
    const every = `every ${c.everyDays} days`;
    out.push({ c, late, words: late === 0 ? `Due today · ${every}` : `${late} day${late === 1 ? '' : 's'} late · ${every}` });
  });
  return out.sort((x, y) => y.c.owes - x.c.owes || y.late - x.late);
}
