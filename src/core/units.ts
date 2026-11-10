/*
 * A line's unit (spec 04 §4.3 "A line's unit", SL42): an item sold by the pair may also sell by its pack (the
 * Zawaina hinge, 1,700 a pair or 80,000 a carton of 50). The books keep a line as sales.html wrote it (SAL-02/06):
 * `qty` and the price are always of the item's own unit (pairs, at 1,600 a pair by the carton), and `qtyIn: 'pack'`
 * says it is counted in cartons, as the Store and the Buyer read it (store.html 1146, 1708). So place_order,
 * the money rules and the other apps see the same figures whichever unit the seller picks.
 *
 *   sellsByPack(it)        whether the line may switch at all (its pack has its own price, a whole price a unit)
 *   shown(l)               how a line reads: 1 carton × 80,000, or 60 pair × 1,700
 *   switchQty(q, per, to)  the count in the other unit, whole ones rounding up: 60 pair → 2 cartons (100 pair)
 */
import type { Item, Line } from './types.ts';

/** The pack's price for one of the item's unit (80,000 a carton of 50 → 1,600 a pair); null when it sells by the unit only. */
export function packEach(it: Pick<Item, 'packPrice' | 'packQty' | 'packUnit'>): number | null {
  if (it.packPrice == null || !(it.packQty > 1) || !it.packUnit) return null;
  const each = it.packPrice / it.packQty;
  // The books keep a whole price a unit (rows.ts reads sellPrice whole): a pack that does not divide is not offered.
  return Number.isInteger(each) ? each : null;
}

/** The units an item sells in: its own, and its pack when the pack has its own price. One unit: no switch. */
export const sellsByPack = (it: Pick<Item, 'packPrice' | 'packQty' | 'packUnit'>): boolean => packEach(it) != null;

/** The line is counted in its pack. */
export const inPack = (l: Pick<Line, 'qtyIn' | 'packQty' | 'packUnit'>): boolean => l.qtyIn === 'pack' && l.packQty > 1 && !!l.packUnit;

/** How many of the unit one of the line's shown unit is: 50 for a carton of 50, else 1. */
export const perShown = (l: Pick<Line, 'qtyIn' | 'packQty' | 'packUnit'>): number => (inPack(l) ? l.packQty : 1);

/** How a line reads: how many, in which word, and the price of one of them (null: Price coming). */
export function shown(l: Pick<Line, 'qty' | 'unit' | 'packUnit' | 'packQty' | 'qtyIn' | 'price'>): { n: number; unit: string; each: number | null } {
  const per = perShown(l);
  return { n: Math.round((l.qty / per) * 100) / 100, unit: per > 1 ? l.packUnit : l.unit, each: l.price == null ? null : l.price * per };
}

/**
 * Switch a count to the other unit (Kevin, 10 Nov: "keep unit simple"): whole ones of it, rounding up, as many of
 * the item's unit as that is. 50 pair → 1 carton (50); 60 pair → 2 cartons (100); 1 pair → 1 carton (50); 1 carton →
 * 50 pair. The seller takes it down with − when they want fewer. Returns the line's new qty, of the item's unit.
 */
export function switchQty(qty: number, per: number, to: 'unit' | 'pack'): number {
  if (to === 'unit' || !(per > 1)) return qty;
  return Math.max(1, Math.ceil(qty / per - 1e-9)) * per;
}
