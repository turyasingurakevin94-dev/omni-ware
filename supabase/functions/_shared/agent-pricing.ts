// Shared between agent-catalog (browsing/live price lookups) and
// agent-submit-order (the authoritative recompute at order-creation time).
// Keeping this in one place means the number an agent sees while shopping
// and the number actually charged at submission can never drift apart --
// both call the exact same function against the exact same live data.
//
// This math deliberately mirrors the admin app's own
// suggestedSellingPrice()/effectiveMarkupRule() (index.html) exactly, so
// "our price" here means the same thing it means everywhere else in the
// app -- an agent's discount is calculated off of that real number, not a
// separately-invented one.

export type MarkupKind = "wholesale" | "retail";
export type MarkupRule = { type: string; value: number } | null;

export function effectiveMarkupRule(product: any, variantIdx: number | null, kind: MarkupKind): MarkupRule {
  if (variantIdx != null && Array.isArray(product.variants) && product.variants[variantIdx]) {
    const v = product.variants[variantIdx];
    const vVal = Number(v[kind + "MarkupValue"]) || 0;
    if (vVal > 0) return { type: v[kind + "MarkupType"], value: vVal };
  }
  const colVal = Number(product[kind + "_markup_value"]) || 0;
  if (colVal > 0) return { type: product[kind + "_markup_type"], value: colVal };
  return null;
}

export function suggestedSellingPrice(product: any, basePrice: number | null, kind: MarkupKind, variantIdx: number | null): number | null {
  if (basePrice == null) return null;
  const rule = effectiveMarkupRule(product, variantIdx, kind);
  if (!rule) return null;
  return rule.type === "fixed" ? basePrice + rule.value : basePrice * (1 + rule.value / 100);
}

// Cheapest-by-wholesale, tie-broken by retail -- same ranking
// rankedPriceRows() uses client-side, so "the best supplier" means the
// same thing here that it means on the admin app's own quote builder.
export function pickBestPriceRow(rows: any[]): any | null {
  const priced = rows.filter((r) => !r.out_of_stock);
  if (!priced.length) return null;
  return priced.slice().sort((a, b) => {
    const aw = a.wholesale != null ? a.wholesale : Infinity;
    const bw = b.wholesale != null ? b.wholesale : Infinity;
    if (aw !== bw) return aw - bw;
    const ar = a.retail != null ? a.retail : Infinity;
    const br = b.retail != null ? b.retail : Infinity;
    return ar - br;
  })[0];
}

export type FloorPriceResult = {
  tier: MarkupKind;
  floorPrice: number;
  cost: number;
  unit: string;
  packUnit: string;
  packQty: number;
};

// The core mechanic: quantity decides whether the wholesale or retail
// tier applies (>= the supplier's own pack size unlocks wholesale), our
// markup turns that tier's raw cost into "our price", the agent's
// discount comes off of THAT -- and the result can never be pushed below
// the actual cost for that tier, no matter what discount is configured.
export function computeFloorPrice(
  product: any,
  priceRow: any,
  qty: number,
  discountWholesalePct: number,
  discountRetailPct: number,
): FloorPriceResult | null {
  if (!priceRow) return null;
  const packQty = Number(priceRow.pack_qty) || 0;
  const tier: MarkupKind = packQty > 0 && qty >= packQty ? "wholesale" : "retail";
  const variantIdx = priceRow.variant_idx == null || priceRow.variant_idx === "" ? null : Number(priceRow.variant_idx);
  const cost = tier === "wholesale" ? priceRow.wholesale : priceRow.retail;
  if (cost == null) return null;
  const costNum = Number(cost);
  const ourPrice = suggestedSellingPrice(product, costNum, tier, variantIdx) ?? costNum;
  const discountPct = tier === "wholesale" ? discountWholesalePct : discountRetailPct;
  const discounted = ourPrice * (1 - (discountPct || 0) / 100);
  return {
    tier,
    floorPrice: Math.max(costNum, discounted),
    cost: costNum,
    unit: priceRow.unit || "",
    packUnit: priceRow.pack_unit || "",
    packQty,
  };
}

// Resolves the two agent-discount percentages that apply to a product:
// its own per-product override if set, else the shop-wide preset default.
export function resolveDiscountPcts(product: any, presets: any) {
  const defaultWholesalePct = Number(presets?.agentDiscountWholesalePct) || 0;
  const defaultRetailPct = Number(presets?.agentDiscountRetailPct) || 0;
  return {
    discountWholesalePct: product.agent_discount_wholesale_pct != null ? Number(product.agent_discount_wholesale_pct) : defaultWholesalePct,
    discountRetailPct: product.agent_discount_retail_pct != null ? Number(product.agent_discount_retail_pct) : defaultRetailPct,
  };
}
