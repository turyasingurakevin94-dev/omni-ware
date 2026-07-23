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
// The pricing math lives in ../_shared/agent-pricing.ts, shared with
// agent-submit-order -- so the number an agent sees while browsing here
// and the number actually charged at order submission can never drift
// apart from each other.
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeFloorPrice, pickBestPriceRow, resolveDiscountPcts } from "../_shared/agent-pricing.ts";

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
          const priced = best ? computeFloorPrice(p, best, 1, discountWholesalePct, discountRetailPct) : null;
          return {
            productId: p.id,
            variantIdx,
            name: p.name,
            category: p.category,
            subcategory: p.subcategory,
            image: p.image,
            createdAt: p.created_at,
            available: !!priced,
            floorPrice: priced?.floorPrice ?? null,
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
        .from("products").select("id, name, image, category").eq("shop_id", shopId).in("id", productIds);
      if (productsErr) return json({ error: productsErr.message, stage: "promotion_products_lookup" }, 500);
      const byId = new Map<string, any>((products || []).map((p) => [p.id, p]));

      const items = live.map((pr) => {
        const p = byId.get(pr.product_id);
        return {
          productId: pr.product_id,
          variantIdx: pr.variant_idx === "" ? null : pr.variant_idx,
          name: p?.name || "Item",
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
