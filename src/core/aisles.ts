/*
 * The aisles a Sell screen offers, said once (the lead's rulings, 3 and 4 Nov): five aisles, by how
 * many orders hold an item from each, along a fallback chain: the customer's own when one is chosen
 * (the chips, SL04, SL10, SL27, SL34), then the seller's own orders (the aisle tiles before a
 * customer's own count, SL03, SL31), then the shop's most-sold to fill. A tie keeps the shop's order.
 */
import { lineTotal } from './money.ts';
import { dayOf } from './time.ts';
import type { Books, Item, Ms, Order } from './types.ts';

const live = (o: Order) => !o.voided && !o.cancelled && !o.qa;

/** How many of these orders hold an item from each aisle. */
function inOrders(orders: Order[], aisleOf: Map<string, string>): Map<string, number> {
  const by = new Map<string, number>();
  orders.forEach((o) => new Set(o.lines.map((l) => aisleOf.get(l.itemId)).filter((a): a is string => !!a)).forEach((a) => by.set(a, (by.get(a) || 0) + 1)));
  return by;
}

export function chipAisles(items: Item[], orders: Order[], customerId: string | null, seller: string | null, n = 5): string[] {
  const aisleOf = new Map(items.map((i) => [i.id, i.aisle]));
  const shopOrder = [...new Set(items.map((i) => i.aisle))];
  const ranked = (by: Map<string, number>) => shopOrder.filter((a) => (by.get(a) || 0) > 0).sort((x, y) => (by.get(y) || 0) - (by.get(x) || 0) || shopOrder.indexOf(x) - shopOrder.indexOf(y));
  const all = orders.filter(live);
  const theirs = customerId ? ranked(inOrders(all.filter((o) => o.customerId === customerId), aisleOf)) : [];
  const mine = seller ? ranked(inOrders(all.filter((o) => o.placedBy === seller), aisleOf)) : [];
  const shop = ranked(inOrders(all, aisleOf));
  return [...new Set([...theirs, ...mine, ...shop, ...shopOrder])].slice(0, n);
}

/*
 * The shop's aisles and the aisles near a search that found nothing (spec 04 §4.1, TD14; moved from
 * Today so Today's Find and the Counter's "Nothing called …" read one rule).
 */

/** Money sold in a month by aisle, the whole shop's (every seller and the counter; invoiced, up to now). */
export function soldByAisle(b: Books, month: string, now: Ms): Map<string, number> {
  const by = new Map<string, number>();
  b.orders.filter((o) => live(o) && o.invoiced && o.invoicedAt != null && o.invoicedAt <= now && dayOf(o.invoicedAt).startsWith(month)).forEach((o) => o.lines.forEach((l) => {
    const it = b.items.find((i) => i.id === l.itemId);
    if (it && it.aisle) by.set(it.aisle, (by.get(it.aisle) || 0) + lineTotal(l));
  }));
  return by;
}

/** The shop's aisles with how many products each holds (Books.aisles), the ones selling most this month first, then the most products. */
export function shopAisles(b: Books, now: Ms): { name: string; count: number }[] {
  const by = soldByAisle(b, dayOf(now).slice(0, 7), now);
  return b.aisles.slice().sort((x, y) => (by.get(y.name) || 0) - (by.get(x.name) || 0) || y.count - x.count);
}

/**
 * The aisles closest to what was searched: the closest items' own aisle first, then the aisles bought with
 * them most often in the shop's orders, then the shop's aisles as shopAisles orders them (TD14: Tools,
 * Cement, Roofing … for a wheelbarrow).
 */
export function nearAisles(b: Books, close: Item[], now: Ms): { name: string; count: number }[] {
  const all = shopAisles(b, now), ids = new Set(close.map((i) => i.id)), own = close[0] ? close[0].aisle : null, by = new Map<string, number>();
  b.orders.filter((o) => !o.voided && !o.qa && o.lines.some((l) => ids.has(l.itemId))).forEach((o) => {
    new Set(o.lines.filter((l) => !ids.has(l.itemId)).map((l) => (b.items.find((i) => i.id === l.itemId) || { aisle: '' }).aisle)).forEach((a) => { if (a) by.set(a, (by.get(a) || 0) + 1); });
  });
  const rank = (a: string) => (a === own ? -1e9 : -(by.get(a) || 0));
  return all.slice().sort((x, y) => rank(x.name) - rank(y.name) || all.indexOf(x) - all.indexOf(y));
}

/** How many times each item was sold: its lines on orders not voided or cancelled. What "most sold" means on an aisle. */
export function timesSold(b: Books): Map<string, number> {
  const sold = new Map<string, number>();
  b.orders.forEach((o) => { if (!o.voided && !o.cancelled) o.lines.forEach((l) => sold.set(l.itemId, (sold.get(l.itemId) || 0) + 1)); });
  return sold;
}

/**
 * An aisle open (SL12, and a tile or chip at the counter): every item in it, the most sold first, then by
 * name. Sell's sell/aisle and the Counter list an aisle with this, never with a word search.
 */
export function aisleItems(b: Books, aisle: string): Item[] {
  const sold = timesSold(b);
  return b.items.filter((i) => i.aisle === aisle).sort((x, y) => (sold.get(y.id) || 0) - (sold.get(x.id) || 0) || x.name.localeCompare(y.name));
}
