// Agent-only, read-only catalog + pricing. This is the ONLY way an agent's
// session ever learns anything about products/pricing -- there is no RLS
// policy granting agents direct access to `products`, `prices`, or
// `suppliers` (see 0012_sales_agents.sql), specifically so there's no
// column-level redaction to get subtly wrong. This function reads those
// tables with the service-role key and hand-picks exactly which fields
// cross the boundary: never a supplier's name/id, never a raw markup rule
// or discount percentage, never the underlying wholesale/retail cost --
// only the single computed floor price a given quantity would cost the
// agent, plus plain display info (name, image, category, packaging size).
//
// The pricing helpers below (effectiveMarkupRule / suggestedSellingPrice /
// pickBestPriceRow / computeFloorPrice / resolveDiscountPcts) are
// deliberately duplicated verbatim in agent-submit-order rather than
// imported from a shared file -- functions here are deployed by pasting
// one file at a time into the Supabase Dashboard, which has no way to
// pull in a second file, so a shared-module import would silently fail to
// deploy. If either copy ever needs to change, change both. This math
// mirrors the admin app's own suggestedSellingPrice()/effectiveMarkupRule()
// (index.html) exactly, so "our price" here means the same thing it means
// everywhere else in the app -- an agent's discount is calculated off of
// that real number, not a separately-invented one.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

type MarkupKind = "wholesale" | "retail";
type MarkupRule = { type: string; value: number } | null;

function effectiveMarkupRule(product: any, variantIdx: number | null, kind: MarkupKind): MarkupRule {
  if (variantIdx != null && Array.isArray(product.variants) && product.variants[variantIdx]) {
    const v = product.variants[variantIdx];
    const vVal = Number(v[kind + "MarkupValue"]) || 0;
    if (vVal > 0) return { type: v[kind + "MarkupType"], value: vVal };
  }
  const colVal = Number(product[kind + "_markup_value"]) || 0;
  if (colVal > 0) return { type: product[kind + "_markup_type"], value: colVal };
  return null;
}

function suggestedSellingPrice(product: any, basePrice: number | null, kind: MarkupKind, variantIdx: number | null): number | null {
  if (basePrice == null) return null;
  const rule = effectiveMarkupRule(product, variantIdx, kind);
  if (!rule) return null;
  return rule.type === "fixed" ? basePrice + rule.value : basePrice * (1 + rule.value / 100);
}

// Cheapest-by-wholesale, tie-broken by retail -- same ranking
// rankedPriceRows() uses client-side, so "the best supplier" means the
// same thing here that it means on the admin app's own quote builder.
function pickBestPriceRow(rows: any[]): any | null {
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

// The core mechanic: quantity decides whether the wholesale or retail
// tier applies (>= the supplier's own pack size unlocks wholesale), our
// markup turns that tier's raw cost into "our price", the agent's
// discount comes off of THAT -- and the result can never be pushed below
// the actual cost for that tier, no matter what discount is configured.
function computeFloorPrice(product: any, priceRow: any, qty: number, discountWholesalePct: number, discountRetailPct: number) {
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
function resolveDiscountPcts(product: any, presets: any) {
  const defaultWholesalePct = Number(presets?.agentDiscountWholesalePct) || 0;
  const defaultRetailPct = Number(presets?.agentDiscountRetailPct) || 0;
  return {
    discountWholesalePct: product.agent_discount_wholesale_pct != null ? Number(product.agent_discount_wholesale_pct) : defaultWholesalePct,
    discountRetailPct: product.agent_discount_retail_pct != null ? Number(product.agent_discount_retail_pct) : defaultRetailPct,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let shopId: string, action: string, body: any;
    try {
      body = await req.json();
      ({ shopId, action } = body);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!shopId || !action) return json({ error: "shopId and action are required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAgent, error: agentCheckErr } = await callerClient.rpc("is_shop_agent", { p_shop_id: shopId });
    if (agentCheckErr) return json({ error: agentCheckErr.message, stage: "is_shop_agent" }, 500);
    if (!isAgent) return json({ error: "Not an agent of this shop" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (action === "list" || action === "price") {
      const { data: settingsRow, error: settingsErr } = await admin
        .from("app_settings").select("presets").eq("shop_id", shopId).maybeSingle();
      if (settingsErr) return json({ error: settingsErr.message, stage: "settings_lookup" }, 500);
      const presets = settingsRow?.presets || {};

      if (action === "price") {
        const { productId, variantIdx, qty } = body;
        if (!productId || !(Number(qty) > 0)) return json({ error: "productId and a positive qty are required" }, 400);
        // prices.variant_idx is nullable and stores real SQL NULL for a
        // non-variant product (matching how the admin app writes it) --
        // unlike agent_promotions/agent_clusters, which use '' by choice
        // so they can sit in a composite primary key. .is()/.eq() have to
        // be picked per case or a non-variant product's price rows would
        // silently match nothing.
        let priceQuery = admin.from("prices").select("*").eq("shop_id", shopId).eq("product_id", productId);
        priceQuery = variantIdx == null ? priceQuery.is("variant_idx", null) : priceQuery.eq("variant_idx", String(variantIdx));
        const [{ data: product, error: productErr }, { data: priceRows, error: priceErr }] = await Promise.all([
          admin.from("products").select("*").eq("shop_id", shopId).eq("id", productId).maybeSingle(),
          priceQuery,
        ]);
        if (productErr) return json({ error: productErr.message, stage: "product_lookup" }, 500);
        if (priceErr) return json({ error: priceErr.message, stage: "price_lookup" }, 500);
        if (!product) return json({ error: "Product not found" }, 404);

        const best = pickBestPriceRow(priceRows || []);
        if (!best) return json({ ok: true, available: false });
        const { discountWholesalePct, discountRetailPct } = resolveDiscountPcts(product, presets);
        const result = computeFloorPrice(product, best, Number(qty), discountWholesalePct, discountRetailPct);
        if (!result) return json({ ok: true, available: false });
        const { cost, ...safeResult } = result; // cost never leaves this function
        return json({ ok: true, available: true, ...safeResult });
      }

      // action === "list": every product with safe display fields plus a
      // representative (qty=1, always retail-tier) floor price -- good
      // enough for browsing/Explore; the New Quote screen calls "price"
      // again live once a real quantity is entered.
      const [{ data: products, error: productsErr }, { data: priceRows, error: priceErr }] = await Promise.all([
        admin.from("products").select("*").eq("shop_id", shopId),
        admin.from("prices").select("*").eq("shop_id", shopId),
      ]);
      if (productsErr) return json({ error: productsErr.message, stage: "products_list" }, 500);
      if (priceErr) return json({ error: priceErr.message, stage: "prices_list" }, 500);

      const rowsByProduct = new Map<string, any[]>();
      (priceRows || []).forEach((r) => {
        const key = `${r.product_id}::${r.variant_idx || ""}`;
        if (!rowsByProduct.has(key)) rowsByProduct.set(key, []);
        rowsByProduct.get(key)!.push(r);
      });

      const items = (products || []).flatMap((p) => {
        const { discountWholesalePct, discountRetailPct } = resolveDiscountPcts(p, presets);
        const variantCount = Array.isArray(p.variants) ? p.variants.length : 0;
        const variantIdxs: (number | null)[] = variantCount > 0 ? p.variants.map((_: any, i: number) => i) : [null];
        return variantIdxs.map((variantIdx) => {
          const key = `${p.id}::${variantIdx == null ? "" : variantIdx}`;
          const best = pickBestPriceRow(rowsByProduct.get(key) || []);
          let priced = best ? computeFloorPrice(p, best, 1, discountWholesalePct, discountRetailPct) : null;
          // A price entry with only a wholesale figure (no retail) fails
          // the qty=1 probe above and would otherwise vanish from Browse
          // entirely, even though it's a real, orderable item -- retry at
          // the pack quantity so it's at least visible. This only affects
          // the display price; the real per-order price (action: "price")
          // always re-derives the correct tier from the agent's actual
          // quantity, so a genuinely small order still correctly gets
          // rejected at submit time if no retail price exists.
          if (!priced && best && Number(best.pack_qty) > 0) {
            priced = computeFloorPrice(p, best, Number(best.pack_qty), discountWholesalePct, discountRetailPct);
          }
          const variantLabel = variantIdx != null && Array.isArray(p.variants) && p.variants[variantIdx]
            ? Object.values(p.variants[variantIdx].combo || {}).join(" / ")
            : "";
          return {
            productId: p.id,
            variantIdx,
            name: p.name,
            variantLabel,
            category: p.category,
            subcategory: p.subcategory,
            image: p.image,
            createdAt: p.created_at,
            available: !!priced,
            floorPrice: priced?.floorPrice ?? null,
            tier: priced?.tier ?? "",
            unit: priced?.unit ?? "",
            packUnit: priced?.packUnit ?? "",
            packQty: priced?.packQty ?? 0,
          };
        });
      });

      return json({ ok: true, items });
    }

    if (action === "promotions") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: promos, error: promoErr } = await admin
        .from("agent_promotions")
        .select("id, product_id, variant_idx, bonus_type, bonus_value, starts_at, ends_at")
        .eq("shop_id", shopId)
        .eq("active", true);
      if (promoErr) return json({ error: promoErr.message, stage: "promotions_list" }, 500);

      const live = (promos || []).filter((pr) =>
        (!pr.starts_at || pr.starts_at <= today) && (!pr.ends_at || pr.ends_at >= today)
      );
      if (!live.length) return json({ ok: true, items: [] });

      const productIds = [...new Set(live.map((pr) => pr.product_id))];
      const { data: products, error: productsErr } = await admin
        .from("products").select("id, name, image, category, variants").eq("shop_id", shopId).in("id", productIds);
      if (productsErr) return json({ error: productsErr.message, stage: "promotion_products_lookup" }, 500);
      const byId = new Map<string, any>((products || []).map((p) => [p.id, p]));

      const items = live.map((pr) => {
        const p = byId.get(pr.product_id);
        const variantIdx = pr.variant_idx === "" ? null : Number(pr.variant_idx);
        const variantLabel = variantIdx != null && p && Array.isArray(p.variants) && p.variants[variantIdx]
          ? Object.values(p.variants[variantIdx].combo || {}).join(" / ")
          : "";
        return {
          productId: pr.product_id,
          variantIdx,
          name: p?.name || "Item",
          variantLabel,
          image: p?.image || null,
          category: p?.category || "",
          bonusType: pr.bonus_type,
          bonusValue: Number(pr.bonus_value),
        };
      });
      return json({ ok: true, items });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("agent-catalog: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
