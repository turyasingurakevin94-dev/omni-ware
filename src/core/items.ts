/*
 * Finding items, once (docs/spec/04-screens-sales.md §4): what a search box reads ("2 paint" is
 * 2 of paint), and the items it finds. Pure functions over the books' items.
 */
import type { Item, Ms, Order } from './types.ts';

/** "2 paint" → 2 of paint; "paint 2", "2x paint", "paint ×2" too; no count is 1. */
export function readQuery(text: string): { qty: number; words: string; counted: boolean } {
  const t = text.trim(), lead = t.match(/^(\d+)\s*[x×]?\s+(.+)$/i), tail = t.match(/^(.+?)\s+[x×]?(\d+)$/i);
  if (lead) return { qty: Math.max(1, Number(lead[1])), words: lead[2].trim(), counted: true };
  if (tail) return { qty: Math.max(1, Number(tail[2])), words: tail[1].trim(), counted: true };
  return { qty: 1, words: t, counted: false };
}

/**
 * Items with a price that the words find (the lead's rulings, 4 Nov): first those whose own name holds
 * every word, what is on the shelf first (most first), then what can be ordered in; then the items of an
 * aisle whose name holds the words, but only those sold in the last 90 days, the most sold first (in how
 * many orders). "paint" gives Roof paint, Gloss paint, then Emulsion; "plumbing" lists what sells in
 * Plumbing. An item that never sells is still found by its own name, not by its aisle's.
 */
export function findItems(items: Item[], words: string, sold: { orders: Order[]; now: Ms }): Item[] {
  const ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  if (!ws.length) return [];
  const priced = items.filter((i) => i.price != null);
  const byName = priced.filter((i) => ws.every((w) => i.name.toLowerCase().includes(w)))
    .sort((x, y) => (y.onShelf || 0) - (x.onShelf || 0) || Number(y.orderIn) - Number(x.orderIn));
  const since = sold.now - 90 * 864e5, n = new Map<string, number>();
  sold.orders.filter((o) => !o.voided && !o.cancelled && !o.qa && o.placedAt >= since && o.placedAt <= sold.now)
    .forEach((o) => new Set(o.lines.map((l) => l.itemId)).forEach((id) => n.set(id, (n.get(id) || 0) + 1)));
  const named = new Set(byName.map((i) => i.id));
  const byAisle = priced.filter((i) => !named.has(i.id) && (n.get(i.id) || 0) > 0 && ws.every((w) => i.aisle.toLowerCase().includes(w)))
    .sort((x, y) => (n.get(y.id) || 0) - (n.get(x.id) || 0));
  return [...byName, ...byAisle];
}
