/*
 * The shop's price for a line (docs/spec/02-money.md §3), ported from the
 * phone money block (sales.html:4281-4410) as Kevin decided it (spec 02 §8):
 * no rule is no price (Q4, never the cost), FIFO cost weighted over the
 * lots the quantity takes (Q5). The server's copy is 0119 (ow_markup_rule,
 * ow_tiered_unit_price, ow_apply_rule, ow_line_sell_price).
 *
 * Only the supabase source uses this, to turn the raw products, prices and
 * stock lots into Item.price and Line.price. The demo seeds prices as FACTS
 * states them.
 */
import { whole } from './money.ts';

export type MarkupType = 'percent' | 'fixed';
export interface Markup { type: MarkupType; value: number }

/** A product as products rows carry it (sales.html:3920-3925). */
export interface ProductRow {
  id: string;
  wholesaleMarkupType: MarkupType; wholesaleMarkupValue: number;
  retailMarkupType: MarkupType; retailMarkupValue: number;
  stockWholesaleMarkupType: MarkupType; stockWholesaleMarkupValue: number;
  stockRetailMarkupType: MarkupType; stockRetailMarkupValue: number;
  variants: Record<string, unknown>[];
}

/** A supplier's price row (prices table; spec 02 §3.1). */
export interface PriceRow {
  productId: string;
  variantIdx: number | null;
  supplierId: string;
  wholesale: number | null;
  retail: number | null;
  unit: string;
  packUnit: string;
  packQty: number;
  outOfStock: boolean;
  tiers: { minQty: number; price: number | null }[];
}

type Kind = 'wholesale' | 'retail';

/** sales.html:4300 tiersForKind. */
function tiersForKind(row: PriceRow, kind: Kind) {
  const pq = Number(row.packQty) || 0;
  return (row.tiers || []).filter((t) => (kind === 'wholesale' ? pq > 0 && t.minQty >= pq : pq === 0 || t.minQty < pq));
}

/** sales.html:4301 tieredUnitPrice; 0119 ow_tiered_unit_price. */
export function tieredUnitPrice(row: PriceRow | null, qty: number, kind: Kind): number | null {
  if (!row) return null;
  const base = row[kind], tiers = tiersForKind(row, kind);
  if (!tiers.length) return base;
  let best = base, bestMin = 0;
  tiers.forEach((t) => { if (t.price != null && qty >= t.minQty && t.minQty >= bestMin) { best = t.price; bestMin = t.minQty; } });
  return best;
}

/** sales.html:4310 purchasePriceAtQty; 0119 ow_purchase_side. */
export function purchasePriceAtQty(row: PriceRow, qty: number): number | null {
  const pq = Number(row.packQty) || 0;
  const natural: Kind = pq > 0 && qty >= pq ? 'wholesale' : 'retail', other: Kind = natural === 'wholesale' ? 'retail' : 'wholesale';
  const p = tieredUnitPrice(row, qty, natural);
  return p != null ? p : tieredUnitPrice(row, qty, other);
}

function purchaseSideAtQty(row: PriceRow | null, qty: number): Kind | null {
  if (!row) return null;
  const pq = Number(row.packQty) || 0;
  const natural: Kind = pq > 0 && qty >= pq ? 'wholesale' : 'retail', other: Kind = natural === 'wholesale' ? 'retail' : 'wholesale';
  if (tieredUnitPrice(row, qty, natural) != null) return natural;
  return tieredUnitPrice(row, qty, other) != null ? other : null;
}

/** sales.html:4325 sellSideFor; 0119 ow_sell_side. */
function sellSideFor(row: PriceRow | null, qty: number, packQty: number, ruleAt: (k: Kind) => Markup | null): Kind {
  const natural: Kind = packQty > 0 && qty >= packQty ? 'wholesale' : 'retail', other: Kind = natural === 'wholesale' ? 'retail' : 'wholesale';
  const fromRow = purchaseSideAtQty(row, qty);
  if (fromRow) return fromRow;
  if (!ruleAt(natural) && ruleAt(other)) return other;
  return natural;
}

/** sales.html:4340 effectiveMarkupRule: variant → product → the shop's default (presets.defaultMarkup). */
export function markupRule(p: ProductRow, vi: number | null, kind: Kind, shopDefault: Record<string, unknown>): Markup | null {
  const v = vi != null ? (p.variants[vi] as Record<string, unknown> | undefined) : undefined;
  const vVal = v ? Number(v[kind + 'MarkupValue']) || 0 : 0;
  if (v && vVal > 0) return { type: v[kind + 'MarkupType'] === 'fixed' ? 'fixed' : 'percent', value: vVal };
  const pVal = Number(p[`${kind}MarkupValue`]) || 0;
  if (pVal > 0) return { type: p[`${kind}MarkupType`], value: pVal };
  const dVal = Number(shopDefault[kind + 'Value']) || 0;
  if (dVal > 0) return { type: shopDefault[kind + 'Type'] === 'fixed' ? 'fixed' : 'percent', value: dVal };
  return null;
}

/** sales.html:4352 effectiveStockMarkupRule: a shelf line tries the stock markup first. */
export function stockMarkupRule(p: ProductRow, vi: number | null, kind: Kind, shopDefault: Record<string, unknown>): Markup | null {
  const K = kind === 'wholesale' ? 'Wholesale' : 'Retail';
  const v = vi != null ? (p.variants[vi] as Record<string, unknown> | undefined) : undefined;
  const vVal = v ? Number(v['stock' + K + 'MarkupValue']) || 0 : 0;
  if (v && vVal > 0) return { type: v['stock' + K + 'MarkupType'] === 'fixed' ? 'fixed' : 'percent', value: vVal };
  const pVal = Number(p[`stock${K}MarkupValue`]) || 0;
  if (pVal > 0) return { type: p[`stock${K}MarkupType`], value: pVal };
  return markupRule(p, vi, kind, shopDefault);
}

/** sales.html:4361 applyRule; 0119 ow_apply_rule. */
export function applyRule(rule: Markup | null, base: number, kind: Kind, packQty: number): number | null {
  if (!rule) return null;
  if (rule.type === 'fixed') return base + (kind === 'wholesale' && packQty > 0 ? rule.value / packQty : rule.value);
  return base * (1 + rule.value / 100);
}

export interface PriceInput {
  product: ProductRow | null;
  variantIdx: number | null;
  /** '__stock__' = our shelf. */
  supplierId: string;
  qty: number;
  packQty: number;
  /** The cost each (items[].price); 0 or less = not known. */
  cost: number;
  /** The supplier's row this line is bought on, when not from our shelf. */
  row: PriceRow | null;
  shopDefault: Record<string, unknown>;
}

/**
 * The shop's price each, or null when there is none: no cost, or no rule (spec 02 Q4, "Price coming").
 * sales.html:4367 quoteItemSellPrice + 4406 shopSellPrice + 4392 linePriceToConfirm.
 */
export function shopPrice(i: PriceInput): number | null {
  if (!i.product || !(i.cost > 0)) return null;
  const fromStock = i.supplierId === '__stock__';
  const ruleAt = (k: Kind) => (fromStock ? stockMarkupRule(i.product as ProductRow, i.variantIdx, k, i.shopDefault) : markupRule(i.product as ProductRow, i.variantIdx, k, i.shopDefault));
  const kind = sellSideFor(fromStock ? null : i.row, i.qty, i.packQty, ruleAt);
  const s = applyRule(ruleAt(kind), i.cost, kind, i.packQty);
  return s == null ? null : whole(s);
}

/** sales.html:4281 getFIFOUnitCost (SAL-008; spec 02 Q5): weighted over the lots qty takes; past the last lot at its cost. */
export function fifoUnitCost(lots: { qty: number; cost: number | null }[], qty: number): number | null {
  const ls = lots.filter((l) => l.qty > 0 && l.cost != null);
  if (!ls.length) return null;
  let need = Math.max(1, Number(qty) || 1), sum = 0, got = 0;
  for (const l of ls) { if (!(need > 0)) break; const take = Math.min(need, l.qty); sum += take * (l.cost as number); got += take; need -= take; }
  if (need > 0) { sum += need * (ls[ls.length - 1].cost as number); got += need; }
  return sum / got;
}

/** The cheapest supplier row in stock: cheapest wholesale, then cheapest retail (sales.html:4291 rankedPriceRows). */
export function cheapestRow(rows: PriceRow[], qty: number): PriceRow | null {
  const ranked = rows.filter((r) => !r.outOfStock).map((r) => ({ r, p: purchasePriceAtQty(r, qty) }));
  ranked.sort((a, b) => (a.p ?? Infinity) - (b.p ?? Infinity));
  return ranked.length ? ranked[0].r : null;
}
