/*
 * A line's unit (spec 04 §4.3 "A line's unit", SL42/SL43), as the agent app sells it (agent.html findTileHTML,
 * packOf): an item whose price-list row names a pack (G-MAN Bow Saw: pcs, a bundle of 10) sells by the unit or the
 * pack, and the pack is the unit's price times how many are in it (10,500 a pcs → 105,000 a bundle). There is no
 * separate pack price. The books keep a line as sales.html wrote it (SAL-02/06): `qty` and the price are always
 * of the item's own unit (20 pcs at 10,500), and `qtyIn: 'pack'` says it is counted in bundles, as the Store and the
 * Buyer read it (store.html 1146, 1708). So place_order, the money rules and the other apps see the same figures
 * whichever unit the seller picks.
 *
 *   sellsByPack(it)        whether it may switch at all (it names a pack of more than one, and the pack is not a weight)
 *   shown(l)               how a line reads: 2 bundle × 105,000, or 3 pcs × 10,500
 *   switchQty(q, per, to)  the count in the other unit, whole ones rounding up: 12 pcs → 2 bundles (20 pcs)
 */
import type { Item, Line } from './types.ts';

/** A weight or a length says what is inside, not a pack it sells by (agent.html LOOSE_UNITS): "25kg ctn" nails. */
const LOOSE = ['kg', 'g', 'm', 'ft', 'l', 'litre', 'liter', 'metre', 'meter'];

/** The price of one of the item's unit when it is sold by its pack (the unit's own price); null when it sells by the unit only. */
export function packEach(it: Pick<Item, 'price' | 'packQty' | 'packUnit' | 'unit'>): number | null {
  const pu = (it.packUnit || '').trim().toLowerCase();
  if (it.price == null || !(it.packQty > 1) || !pu || pu === (it.unit || '').trim().toLowerCase() || LOOSE.includes(pu)) return null;
  return it.price;
}

/** The units an item sells in: its own, and its pack. One unit: no switch. */
export const sellsByPack = (it: Pick<Item, 'price' | 'packQty' | 'packUnit' | 'unit'>): boolean => packEach(it) != null;

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
 * the item's unit as that is. 10 pcs → 1 bundle (10); 12 pcs → 2 bundles (20); 1 pcs → 1 bundle (10); 1 bundle →
 * 10 pcs. The seller takes it down with − when they want fewer. Returns the line's new qty, of the item's unit.
 */
export function switchQty(qty: number, per: number, to: 'unit' | 'pack'): number {
  if (to === 'unit' || !(per > 1)) return qty;
  return Math.max(1, Math.ceil(qty / per - 1e-9)) * per;
}

/** A unit's word as the switch says it, first letter up (agent.html's "Pcs | Bundle"). */
export const capWord = (u: string): string => (u ? u[0].toUpperCase() + u.slice(1) : u);
