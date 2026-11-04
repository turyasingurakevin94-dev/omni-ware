/*
 * Finding items, once (docs/spec/04-screens-sales.md §4): what a search box reads ("2 paint" is
 * 2 of paint), and the items it finds. Pure functions over the books' items.
 */
import type { Item } from './types.ts';

/** "2 paint" → 2 of paint; "paint 2", "2x paint", "paint ×2" too; no count is 1. */
export function readQuery(text: string): { qty: number; words: string; counted: boolean } {
  const t = text.trim(), lead = t.match(/^(\d+)\s*[x×]?\s+(.+)$/i), tail = t.match(/^(.+?)\s+[x×]?(\d+)$/i);
  if (lead) return { qty: Math.max(1, Number(lead[1])), words: lead[2].trim(), counted: true };
  if (tail) return { qty: Math.max(1, Number(tail[2])), words: tail[1].trim(), counted: true };
  return { qty: 1, words: t, counted: false };
}

/**
 * Items with a price that the words find (the lead's ruling, 4 Nov): those whose own name holds every
 * word; only when no item's name does, those whose aisle holds them ("plumbing" lists the aisle; "paint"
 * finds the items called paint). Each group: what is on the shelf first (most first), then what can be
 * ordered in, then the rest.
 */
export function findItems(items: Item[], words: string): Item[] {
  const ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  if (!ws.length) return [];
  const priced = items.filter((i) => i.price != null);
  const byName = priced.filter((i) => ws.every((w) => i.name.toLowerCase().includes(w)));
  const found = byName.length ? byName : priced.filter((i) => ws.every((w) => i.aisle.toLowerCase().includes(w)));
  return found.sort((x, y) => (y.onShelf || 0) - (x.onShelf || 0) || Number(y.orderIn) - Number(x.orderIn));
}
