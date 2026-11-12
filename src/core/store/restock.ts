/*
 * We need more (docs/spec/04-screens-store.md §4.5; store.html:2495 restockUnit, 2496 sendRestock, 5617).
 *
 *   restockUnit(it)      asked in the unit the Buyer buys: the pack when the item has one
 *   restockWhen(...)     how soon, prefilled: "We're out" when orders wait for it, else "Running low"
 *   restockGuess(...)    about how many, prefilled: four weeks' worth less the shelf, in round numbers
 *   shortFor(b, key)     the orders short of it (named in the ask)
 *   restockOf(...)       the W16 write
 *   askedFor(b, key)     the last ask for this item and its answer ("On the restock list · next trip")
 *
 * Denis decides (buy.restock); Ruth sees the list. The yard's phone shows no price.
 */
import type { Restock } from './source.ts';
import type { ShelfItem, StoreAsk, YardBooks } from './types.ts';
import { isCancelled } from './yard.ts';

export function restockUnit(it: Pick<ShelfItem, 'unit' | 'packUnit' | 'packQty'>): string {
  return it.packQty > 1 && it.packUnit ? it.packUnit : it.unit;
}

/** Orders in the yard that want it and are not packed (store.html:5617 shortFor). */
export function shortFor(b: Pick<YardBooks, 'orders'>, key: string, shelf: number): number[] {
  let left = shelf;
  const ids: number[] = [];
  b.orders.filter((o) => o.status === 'preparing' && !isCancelled(o) && o.pickingStatus !== 'done').forEach((o) => o.lines.forEach((l) => {
    if (l.key !== key || l.dropped || l.pickStatus === 'done' || l.pickStatus === 'short') return;
    left -= l.qty;
    if (left < 0 && !ids.includes(o.id)) ids.push(o.id);
  }));
  return ids;
}

export const restockWhen = (short: number[], shelf: number): 'out' | 'low' => (short.length || shelf <= 0 ? 'out' : 'low');

/** Four weeks' worth less the shelf, never under 1, rounded to 5 above 10 (a guess: Denis decides). */
export function restockGuess(weekOut: number, shelf: number): number {
  const n = Math.max(1, Math.ceil(weekOut * 4 - shelf));
  return n > 10 ? Math.round(n / 5) * 5 : n;
}

export function restockOf(it: ShelfItem, qty: number, when: 'out' | 'low', short: number[]): Restock {
  return { key: it.key, productId: it.productId, variantIdx: it.variantIdx, name: it.name, qty, unit: restockUnit(it), when, shortFor: short };
}

/** The last ask for more of this item (sent, or answered), or null. */
export function askedFor(b: Pick<YardBooks, 'asks'>, key: string): StoreAsk | null {
  return b.asks.filter((a) => a.kind === 'restock' && a.ref === key && a.status !== 'withdrawn').sort((x, y) => y.createdAt - x.createdAt)[0] || null;
}
