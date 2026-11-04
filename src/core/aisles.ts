/*
 * The aisles an order screen offers as chips, said once (the lead's ruling, 3 Nov; SL04, SL10, SL27,
 * SL34): five aisles, the ones this customer buys from most (in how many of their orders), filled up
 * from the shop's most-sold aisles (in how many of all its orders) when they buy from fewer; a tie
 * keeps the shop's own aisle order. No customer (a walk-in): the shop's five.
 */
import type { Item, Order } from './types.ts';

const live = (o: Order) => !o.voided && !o.cancelled && !o.qa;

/** How many of these orders hold an item from each aisle. */
function inOrders(orders: Order[], aisleOf: Map<string, string>): Map<string, number> {
  const by = new Map<string, number>();
  orders.forEach((o) => new Set(o.lines.map((l) => aisleOf.get(l.itemId)).filter((a): a is string => !!a)).forEach((a) => by.set(a, (by.get(a) || 0) + 1)));
  return by;
}

export function chipAisles(items: Item[], orders: Order[], customerId: string | null, n = 5): string[] {
  const aisleOf = new Map(items.map((i) => [i.id, i.aisle]));
  const shopOrder = [...new Set(items.map((i) => i.aisle))];
  const ranked = (by: Map<string, number>) => shopOrder.filter((a) => (by.get(a) || 0) > 0).sort((x, y) => (by.get(y) || 0) - (by.get(x) || 0) || shopOrder.indexOf(x) - shopOrder.indexOf(y));
  const all = orders.filter(live);
  const theirs = customerId ? ranked(inOrders(all.filter((o) => o.customerId === customerId), aisleOf)) : [];
  const shop = ranked(inOrders(all, aisleOf));
  return [...new Set([...theirs, ...shop, ...shopOrder])].slice(0, n);
}
