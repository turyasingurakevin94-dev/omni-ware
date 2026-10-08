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
// everywhere else in the app -- an agent's discount is a share of the
// margin between that real number and cost, not of a separately-invented
// one.
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

// The photo for one row of the catalogue.
//
// A variant carries its own image: the admin has written
// {sku, combo, image} into products.variants since variants existed, shows
// a per-variant preview while editing, and deletes those files with the
// product. Every read path here ignored it and sent products.image for
// every row -- so a variable product showed one picture repeated across
// all its variants, and a product whose photos live only on the variants
// (the normal case for colours and finishes) showed the placeholder on
// every one of them.
//
// Falls back to the product's image, so a variant without its own photo is
// still illustrated rather than blank.
function itemImage(product: any, variantIdx: number | null): string | null {
  const v = variantIdx != null && Array.isArray(product?.variants) ? product.variants[variantIdx] : null;
  return (v && v.image) || product?.image || null;
}

function effectiveMarkupRule(product: any, variantIdx: number | null, kind: MarkupKind, dflt: any = null): MarkupRule {
  if (variantIdx != null && Array.isArray(product.variants) && product.variants[variantIdx]) {
    const v = product.variants[variantIdx];
    const vVal = Number(v[kind + "MarkupValue"]) || 0;
    if (vVal > 0) return { type: v[kind + "MarkupType"], value: vVal };
  }
  const colVal = Number(product[kind + "_markup_value"]) || 0;
  if (colVal > 0) return { type: product[kind + "_markup_type"], value: colVal };
  // The shop default rule (app_settings.presets.defaultMarkup), threaded in
  // as an ARGUMENT per request -- never module state; requests interleave in
  // one isolate. Mirrors the last step of index.html's effectiveMarkupRule.
  const dVal = dflt ? Number(dflt[kind + "Value"]) || 0 : 0;
  if (dVal > 0) return { type: dflt[kind + "Type"] === "fixed" ? "fixed" : "percent", value: dVal };
  return null;
}

// A fixed wholesale markup is naturally an amount added to the PACK price
// (e.g. +10,000 on a 300,000/ctn cost -> 310,000/ctn = 15,500/dzn), not the
// per-unit price -- wholesale is bought and sold by the pack. Percent
// markups don't need this (they scale identically either way). Mirrors
// index.html's own suggestedSellingPrice() exactly.
function suggestedSellingPrice(product: any, basePrice: number | null, kind: MarkupKind, variantIdx: number | null, packQty = 0, dflt: any = null): number | null {
  if (basePrice == null) return null;
  const rule = effectiveMarkupRule(product, variantIdx, kind, dflt);
  if (!rule) return null;
  if (rule.type === "fixed") {
    const fixedPerUnit = (kind === "wholesale" && packQty > 0) ? rule.value / packQty : rule.value;
    return basePrice + fixedPerUnit;
  }
  return basePrice * (1 + rule.value / 100);
}

// One shared tier list (row.tiers) covers both sides of the wholesale/
// retail curve -- a tier only counts toward "wholesale" if it needs at
// least a full pack to unlock (the same qty-vs-pack-size line that
// already decides which of the two applies below), otherwise it counts
// toward "retail". Nothing declares which side a tier belongs to; its own
// minQty does. Duplicated verbatim in agent-submit-order (see that file's
// module header for why) and mirrors index.html's own tieredUnitPrice()
// exactly.
function tieredUnitPrice(row: any, qty: number, kind: MarkupKind): number | null {
  const base = row[kind];
  if (base == null) return null;
  const packQty = Number(row.pack_qty) || 0;
  const tiers = (Array.isArray(row.tiers) ? row.tiers : []).filter((t: any) =>
    kind === "wholesale" ? (packQty > 0 && t.minQty >= packQty) : (packQty === 0 || t.minQty < packQty)
  );
  if (!tiers.length) return Number(base);
  let best = Number(base), bestMinQty = 0;
  tiers.forEach((t: any) => {
    if (t.price != null && qty >= t.minQty && t.minQty >= bestMinQty) { best = Number(t.price); bestMinQty = t.minQty; }
  });
  return best;
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
// markup turns that tier's raw cost into "our price", and the agent's
// discount is a SHARE OF THE MARGIN between those two -- 50% hands the
// agent half of what we would have made, 100% hands over all of it and
// the item changes hands at exactly cost. Never below it.
//
// It used to be a percentage off "our price", which is a different and
// worse thing: 50% off the price of an item carrying a 25% markup is far
// more than the whole margin, so every such sale was a loss until the
// clamp below caught it at cost -- and once the clamp was catching it,
// the number the shop had typed no longer described what agents got.
// Two products with different markups and the same discount % gave away
// quite different amounts, and there was no way to read that off the
// setting. As a share of margin, 40% means the same thing on every
// product: we keep 60% of what we would have made.
function computeFloorPrice(product: any, priceRow: any, qty: number, discountWholesalePct: number, discountRetailPct: number, dflt: any = null) {
  if (!priceRow) return null;
  const packQty = Number(priceRow.pack_qty) || 0;
  const tier: MarkupKind = packQty > 0 && qty >= packQty ? "wholesale" : "retail";
  const variantIdx = priceRow.variant_idx == null || priceRow.variant_idx === "" ? null : Number(priceRow.variant_idx);
  // Which of wholesale/retail applies is still decided purely by qty vs.
  // pack size above (unchanged) -- but the actual unit price within that
  // tier now also follows the entry's own volume-pricing ladder, if it
  // has one, for this same quantity.
  const costNum = tieredUnitPrice(priceRow, qty, tier);
  if (costNum == null) return null;
  const ourPrice = suggestedSellingPrice(product, costNum, tier, variantIdx, packQty, dflt) ?? costNum;
  const discountPct = tier === "wholesale" ? discountWholesalePct : discountRetailPct;
  // A product with no markup rule ANYWHERE -- variant, product, or the shop
  // default handed in as dflt -- has ourPrice == costNum above, so its
  // margin is zero and no discount can find anything to give away -- the
  // agent pays cost. That is correct rather than a gap: a shop that has
  // not said what it makes on an item has not said what it can afford to
  // share on it either.
  const margin = ourPrice - costNum;
  const discounted = costNum + margin * (1 - (discountPct || 0) / 100);
  return {
    tier,
    // The rule, stated once where the number is finally decided: an agent
    // never gets an item below what it cost us. The line above cannot go
    // under cost on its own for any discount between 0 and 100, which is
    // all resolveDiscountPcts will hand over -- but this function is also
    // called directly, and a figure written straight into the column by
    // hand does not pass through that clamp.
    floorPrice: Math.max(costNum, discounted),
    // The shop's own markup-rule price for this tier, before the agent's
    // personal discount -- safe to expose (unlike `cost`), since it's not
    // raw supplier cost, just the same "our price" figure the admin app's
    // own quote builder already shows. Used client-side as the reference
    // point for pricing guidance (competitive/premium/likely-to-lose).
    ourPrice,
    cost: costNum,
    unit: priceRow.unit || "",
    packUnit: priceRow.pack_unit || "",
    packQty,
  };
}

// A price row saved before the tier-list rework (or one that's only ever
// had flat wholesale/retail typed, never a tier) has no `tiers` of its
// own -- synthesize one so the ladder below still reflects its real
// prices instead of coming back empty. Mirrors index.html's own
// tiersFromLegacyRow() exactly.
function effectiveTiers(row: any): { minQty: number; price: number }[] {
  if (Array.isArray(row.tiers) && row.tiers.length) return row.tiers;
  const synthesized: { minQty: number; price: number }[] = [];
  if (row.retail != null) synthesized.push({ minQty: 1, price: Number(row.retail) });
  if (row.wholesale != null && Number(row.pack_qty) > 0) synthesized.push({ minQty: Number(row.pack_qty), price: Number(row.wholesale) });
  return synthesized;
}

// Every quantity breakpoint this price row has, each resolved into the
// same agent-facing floor price computeFloorPrice() would return for a
// real order placed at exactly that quantity -- markup and discount
// already applied, cost never included. Lets the app show the whole
// price curve at once (so an agent can see what a bigger order would
// cost before typing it) without exposing anything beyond what a single
// "price" call already exposes for one quantity at a time.
function buildFloorPriceLadder(product: any, priceRow: any, discountWholesalePct: number, discountRetailPct: number, dflt: any = null) {
  // qty 1 is always a rung, even when no tier starts there.
  //
  // A row whose breakpoints begin above 1 (say tiers at 10 and 50) charges
  // its flat wholesale/retail figure for anything below the first one --
  // tieredUnitPrice() returns `base` when no tier's minQty is cleared. But
  // effectiveTiers() only ever lists the tiers themselves, so that
  // below-the-first-breakpoint price had no rung describing it, and the
  // ladder simply started at 10.
  //
  // The app then resolved a smaller quantity against that ladder with
  // tierForQty(), which falls back to the lowest rung when nothing
  // matches -- so an order of 5 was shown the qty-10 volume price while
  // agent-submit-order went on to charge the flat one. The agent quoted
  // their customer below the shop's actual floor and saw a margin that
  // wasn't there.
  //
  // Adding the rung makes the ladder describe the whole curve, so
  // tierForQty() always finds a real match and its fallback stops being
  // reachable. Deduped, so rows whose tiers already start at 1 (every row
  // that goes through effectiveTiers()' legacy synthesis) are unchanged.
  const minQtys = Array.from(
    new Set<number>([1, ...effectiveTiers(priceRow).map((t) => Number(t.minQty))]),
  ).filter((q) => q > 0).sort((a, b) => a - b);
  return minQtys.map((minQty) => {
    const resolved = computeFloorPrice(product, priceRow, minQty, discountWholesalePct, discountRetailPct, dflt);
    return resolved ? { minQty, unitPrice: resolved.floorPrice, tier: resolved.tier } : null;
  }).filter((x): x is { minQty: number; unitPrice: number; tier: MarkupKind } => x != null);
}

// Resolves the two agent-discount percentages that apply to a product:
// its own per-product override if set, else the shop-wide preset default.
//
// Held to 0-100 because the number is a share of the margin, and a share
// outside that range is not one: under 0 would charge an agent more than
// the shop's own price, over 100 would sell below cost. The admin app
// already clamps both boxes on save; this is the same bound applied to
// what is actually on file, since neither column carries a constraint and
// a figure typed straight into the database has never passed through it.
function resolveDiscountPcts(product: any, presets: any) {
  const clamp = (v: number) => Math.min(100, Math.max(0, Number(v) || 0));
  const defaultWholesalePct = clamp(presets?.agentDiscountWholesalePct);
  const defaultRetailPct = clamp(presets?.agentDiscountRetailPct);
  return {
    discountWholesalePct: product.agent_discount_wholesale_pct != null ? clamp(product.agent_discount_wholesale_pct) : defaultWholesalePct,
    discountRetailPct: product.agent_discount_retail_pct != null ? clamp(product.agent_discount_retail_pct) : defaultRetailPct,
  };
}

// Duplicated verbatim from agent-submit-order (see that file's module
// header for why) -- how many days a cluster item must have already been
// starred before a sale of it earns its bonus there. Sent to the agent
// app purely so it can explain, before a sale happens, why a given
// cluster item's bonus isn't live yet -- this function never gates
// anything itself here, agent-submit-order's own copy is the only one
// that actually decides what a real order earns.
const DEFAULT_CLUSTER_WAIT_DAYS = 7;
function resolveClusterWaitDays(presets: any): number {
  const v = presets?.agentClusterWaitDays;
  return v != null && v !== "" ? Math.max(0, Number(v) || 0) : DEFAULT_CLUSTER_WAIT_DAYS;
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
      // The shop default price rule, from the same presets blob the agent
      // discounts already ride in. Threaded into every pricing call below;
      // a product's own rule always wins inside effectiveMarkupRule.
      const defaultMarkup = presets.defaultMarkup || null;

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
        const result = computeFloorPrice(product, best, Number(qty), discountWholesalePct, discountRetailPct, defaultMarkup);
        if (!result) return json({ ok: true, available: false });
        const { cost, ...safeResult } = result; // cost never leaves this function
        // The full breakpoint ladder travels alongside the single resolved
        // price for the requested qty -- the app fetches this once when an
        // item's detail panel opens, then resolves every further qty/unit
        // change against it locally instead of calling this action again.
        const tiers = buildFloorPriceLadder(product, best, discountWholesalePct, discountRetailPct, defaultMarkup);
        return json({ ok: true, available: true, ...safeResult, tiers });
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
          let priced = best ? computeFloorPrice(p, best, 1, discountWholesalePct, discountRetailPct, defaultMarkup) : null;
          // A price entry with only a wholesale figure (no retail) fails
          // the qty=1 probe above and would otherwise vanish from Browse
          // entirely, even though it's a real, orderable item -- retry at
          // the pack quantity so it's at least visible. This only affects
          // the display price; the real per-order price (action: "price")
          // always re-derives the correct tier from the agent's actual
          // quantity, so a genuinely small order still correctly gets
          // rejected at submit time if no retail price exists.
          if (!priced && best && Number(best.pack_qty) > 0) {
            priced = computeFloorPrice(p, best, Number(best.pack_qty), discountWholesalePct, discountRetailPct, defaultMarkup);
          }
          // The single cheapest breakpoint this item has, only when it
          // actually beats the headline price above -- lets Browse tease
          // "buy more, pay less" with one number instead of shipping the
          // whole ladder for every item in a list that could be hundreds
          // long (the add-to-quote panel fetches the full ladder itself,
          // once, only for the one item an agent has actually opened).
          let bestTierMinQty: number | null = null, bestTierPrice: number | null = null;
          if (best) {
            const ladder = buildFloorPriceLadder(p, best, discountWholesalePct, discountRetailPct, defaultMarkup);
            if (ladder.length > 1) {
              const cheapest = ladder.reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a));
              if (priced && cheapest.unitPrice < priced.floorPrice) {
                bestTierMinQty = cheapest.minQty;
                bestTierPrice = cheapest.unitPrice;
              }
            }
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
            image: itemImage(p, variantIdx),
            createdAt: p.created_at,
            available: !!priced,
            floorPrice: priced?.floorPrice ?? null,
            ourPrice: priced?.ourPrice ?? null,
            tier: priced?.tier ?? "",
            unit: priced?.unit ?? "",
            packUnit: priced?.packUnit ?? "",
            packQty: priced?.packQty ?? 0,
            bestTierMinQty,
            bestTierPrice,
          };
        });
      });

      return json({ ok: true, items });
    }

    if (action === "shop") {
      // How an agent reaches the shop: its name, phone and address, as the
      // shop typed them for its own receipts (Settings -> receipt details).
      // Agents have no read on app_settings (see promotions below), and
      // the rest of presets -- discounts, price rules -- is not theirs to
      // see, so only these three are handed over. Empty strings when the
      // shop has not filled them in; the app then hides its Shop buttons
      // rather than dial nothing.
      const [{ data: settingsRow, error: settingsErr }, { data: shopRow }] = await Promise.all([
        admin.from("app_settings").select("presets").eq("shop_id", shopId).maybeSingle(),
        admin.from("shops").select("name").eq("id", shopId).maybeSingle(),
      ]);
      if (settingsErr) return json({ error: settingsErr.message, stage: "settings_lookup" }, 500);
      const presets = settingsRow?.presets || {};
      const str = (v: unknown) => (v == null ? "" : String(v).trim());
      return json({
        ok: true,
        shop: {
          name: str(presets.shopLegalName) || str(shopRow?.name),
          phone: str(presets.shopPhone) || str(presets.waPhone),
          address: str(presets.shopAddress),
        },
      });
    }

    if (action === "promotions") {
      // clusterWaitDays travels with every response (even an empty one) so
      // the frontend can explain, for any cluster item, exactly how many
      // days are left before a sale of it would actually earn its bonus --
      // agents have no RLS access to app_settings/presets directly (same
      // reasoning as everywhere else in this file), so this is the only
      // way that number ever reaches them.
      const { data: settingsRow, error: settingsErr } = await admin
        .from("app_settings").select("presets").eq("shop_id", shopId).maybeSingle();
      if (settingsErr) return json({ error: settingsErr.message, stage: "settings_lookup" }, 500);
      const clusterWaitDays = resolveClusterWaitDays(settingsRow?.presets || {});

      // "live" (default) is what Browse's cluster badges have always
      // gotten -- only promotions earnable right now. "all" is for
      // Earnings' Bonus Opportunities list, which also needs to *show*
      // upcoming and recently-ended ones (with a lifecycle pill), not
      // just active ones -- kept as a separate scope rather than changing
      // what Browse gets, so a badge never implies an item is joinable
      // before it's actually started.
      const scope = body.scope === "all" ? "all" : "live";
      const today = new Date().toISOString().slice(0, 10);
      const recentCutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const { data: promos, error: promoErr } = await admin
        .from("agent_promotions")
        .select("id, product_id, variant_idx, bonus_type, bonus_value, starts_at, ends_at")
        .eq("shop_id", shopId)
        .eq("active", true);
      if (promoErr) return json({ error: promoErr.message, stage: "promotions_list" }, 500);

      const filtered = (promos || []).filter((pr) => {
        const notEnded = !pr.ends_at || pr.ends_at >= today;
        if (scope === "live") {
          const started = !pr.starts_at || pr.starts_at <= today;
          return started && notEnded;
        }
        return notEnded || (pr.ends_at as string) >= recentCutoff;
      });
      if (!filtered.length) return json({ ok: true, items: [], clusterWaitDays });

      const productIds = [...new Set(filtered.map((pr) => pr.product_id))];
      const { data: products, error: productsErr } = await admin
        .from("products").select("id, name, image, category, variants").eq("shop_id", shopId).in("id", productIds);
      if (productsErr) return json({ error: productsErr.message, stage: "promotion_products_lookup" }, 500);
      const byId = new Map<string, any>((products || []).map((p) => [p.id, p]));

      const items = filtered.map((pr) => {
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
          image: itemImage(p, variantIdx),
          category: p?.category || "",
          bonusType: pr.bonus_type,
          bonusValue: Number(pr.bonus_value),
          startsAt: pr.starts_at || null,
          endsAt: pr.ends_at || null,
        };
      });
      return json({ ok: true, items, clusterWaitDays });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("agent-catalog: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
