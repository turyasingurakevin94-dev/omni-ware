/*
 * Prices, for the Manager's price sheets (D-1 … D-4, D-33): the shop's price, the
 * scale's rungs, the gain. One rule each (spec 04-screens-manager §6).
 *
 *   never under cost (0171), except a line given away (D-10)
 *   the shop's price = cost × (1 + the item's markup), else the shop's default markup
 *   "same gain" = the old gain a piece on the new cost (D-3)
 */
import type { MLine, UGX } from './types.ts';

/** The shop's price for a cost and a markup (a fraction), whole shillings. */
export function shopPriceOf(cost: UGX, markup: number): UGX {
  return Math.round(cost * (1 + markup));
}

/** The markup a line sells at: its own, else the shop's. */
export function markupOf(l: Pick<MLine, 'markup'>, shopDefault: number): number {
  return l.markup != null ? l.markup : shopDefault;
}

/** The shop's price of a line now (its own figure, else cost × markup), or null with no cost. */
export function lineShopPrice(l: Pick<MLine, 'shopPrice' | 'cost' | 'markup'>, shopDefault: number): UGX | null {
  if (l.shopPrice != null) return l.shopPrice;
  return l.cost != null ? shopPriceOf(l.cost, markupOf(l, shopDefault)) : null;
}

/** Under cost: refused (0171), unless the line is given away. */
export function underCost(price: UGX, cost: UGX | null): boolean {
  return cost != null && price < cost;
}

/** D-3: the old gain a piece, kept on the new cost. Null when the old figures are not known. */
export function sameGain(oldCost: UGX | null, oldPrice: UGX | null, newCost: UGX): UGX | null {
  if (oldCost == null || oldPrice == null) return null;
  return newCost + Math.max(0, oldPrice - oldCost);
}

/** What a price gives on a line: a piece over cost, the line's total, the difference from the shop's on the line. */
export function priceOutcome(price: UGX, cost: UGX | null, shop: UGX | null, qty: number): { gain: UGX | null; total: UGX; gainTotal: UGX | null; underShop: UGX | null; underShopTotal: UGX | null } {
  const total = Math.round(price * qty);
  const gain = cost != null ? price - cost : null;
  const underShop = shop != null ? price - shop : null;
  return {
    gain,
    total,
    gainTotal: gain != null ? Math.round(gain * qty) : null,
    underShop,
    underShopTotal: underShop != null ? Math.round(underShop * qty) : null,
  };
}

/**
 * Where a figure sits on the scale (0–100), from a little under cost to a little over the highest.
 * The scale is the evidence of every price sheet: cost · the asker · the shop's on one track.
 */
export function scale(points: (UGX | null)[]): (v: UGX) => number {
  const xs = points.filter((x): x is UGX => x != null);
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const pad = Math.max(1, (hi - lo) * 0.18);
  const a = lo - pad, b = hi + pad;
  return (v: UGX) => Math.max(0, Math.min(100, ((v - a) / (b - a)) * 100));
}

/** The markup as the screens say it: 0.25 → "25%". */
export function pct(markup: number): string {
  return `${Math.round(markup * 100)}%`;
}
