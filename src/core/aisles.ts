/*
 * The aisles a Sell screen offers, said once (the lead's rulings, 3 and 4 Nov): five aisles, by how
 * many orders hold an item from each, along a fallback chain: the customer's own when one is chosen
 * (the chips, SL04, SL10, SL27, SL34), then the seller's own orders (the aisle tiles before a
 * customer's own count, SL03, SL31), then the shop's most-sold to fill. A tie keeps the shop's order.
 */
import type { Item, Order } from './types.ts';

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
