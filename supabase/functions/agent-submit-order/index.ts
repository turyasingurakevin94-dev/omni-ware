// Creates an agent-originated order. This does NOT run as a plain
// client-side insert (even though agents' own RLS policy would technically
// allow one) because RLS only controls which ROWS an agent can touch, not
// whether the VALUES inside are honest -- a client-side insert would let a
// tampered request declare an artificially low price for what the agent
// actually owes the shop. Every item's floor price is recomputed here,
// server-side, from live data, the same way agent-catalog computes it --
// the client's own idea of the floor price is never trusted, only used as
// a display figure earlier in the flow.
//
// The pricing helpers below are deliberately duplicated verbatim in
// agent-catalog rather than imported from a shared file -- these functions
// are deployed by pasting one file at a time into the Supabase Dashboard,
// which has no way to pull in a second file, so a shared-module import
// would silently fail to deploy. If either copy ever needs to change,
// change both.
//
// The shop-facing side of this order is built to look exactly like a
// normal order an admin/rep created themselves: `client` is the AGENT's
// own name/phone (never the real end client's -- see 0012_sales_agents.sql
// and agent_clients for why), `items[].price`/`sellPrice` are the real
// supplier cost and the floor price respectively, so every existing
// admin-side analytics function (profit, demand, etc.) already treats this
// order correctly with zero special-casing. The agent's own price to their
// client is carried separately as `agentSellPrice`, purely for the agent's
// own commission tracking -- the shop never transacts at that number and
// has no stake in it.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// How long two identical submissions are treated as one. Short on purpose
// -- see the note at the dedupe lookup.
const SUBMIT_DEDUPE_MS = 90 * 1000;

// The same order described the same way, independent of the order items
// happen to sit in the array. Built only from the four fields the agent
// actually chooses: everything else on a stored line -- supplier, cost,
// floor price, bonus -- is derived server-side and would legitimately
// differ between two runs if a price moved in between, which must not stop
// a genuine re-send being recognised.
function orderFingerprint(agentClientId: any, items: any): string {
  const lines = (Array.isArray(items) ? items : [])
    .map((it: any) => [
      String(it?.productId ?? ""),
      String(it?.variantIdx ?? ""),
      String(Number(it?.qty) || 0),
      String(Number(it?.agentSellPrice) || 0),
    ].join("|"))
    .sort();
  return `${String(agentClientId ?? "")}#${lines.join(";")}`;
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

// A fixed wholesale markup is naturally an amount added to the PACK price
// (e.g. +10,000 on a 300,000/ctn cost -> 310,000/ctn = 15,500/dzn), not the
// per-unit price -- wholesale is bought and sold by the pack. Percent
// markups don't need this (they scale identically either way). Mirrors
// index.html's own suggestedSellingPrice() exactly.
function suggestedSellingPrice(product: any, basePrice: number | null, kind: MarkupKind, variantIdx: number | null, packQty = 0): number | null {
  if (basePrice == null) return null;
  const rule = effectiveMarkupRule(product, variantIdx, kind);
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
// minQty does. Duplicated verbatim in agent-catalog (see that file's
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

// The agent's discount is a SHARE OF THE MARGIN between cost and our own
// price, not a percentage off that price -- 50% hands the agent half of
// what we would have made, 100% hands over all of it and the item changes
// hands at exactly cost. Never below it. See agent-catalog's copy for why
// it stopped being a percentage off the price.
//
// This is the copy that CHARGES, so it is the one that has to agree with
// the shown figure; tier-pricing-parity compares the two line by line.
function computeFloorPrice(product: any, priceRow: any, qty: number, discountWholesalePct: number, discountRetailPct: number) {
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
  const ourPrice = suggestedSellingPrice(product, costNum, tier, variantIdx, packQty) ?? costNum;
  const discountPct = tier === "wholesale" ? discountWholesalePct : discountRetailPct;
  // A product with no markup rule has ourPrice == costNum above, so its
  // margin is zero and no discount can find anything to give away -- the
  // agent pays cost.
  const margin = ourPrice - costNum;
  const discounted = costNum + margin * (1 - (discountPct || 0) / 100);
  return {
    tier,
    // An agent never gets an item below what it cost us. Stated here as
    // well as in the formula, because this function is also called with
    // percentages that never passed through resolveDiscountPcts' clamp.
    floorPrice: Math.max(costNum, discounted),
    cost: costNum,
    unit: priceRow.unit || "",
    packUnit: priceRow.pack_unit || "",
    packQty,
  };
}

// Held to 0-100, since the number is a share of the margin and a share
// outside that range is not one. Neither column carries a constraint, so
// this bounds what is on file rather than trusting the admin app's own
// clamp on the way in.
function resolveDiscountPcts(product: any, presets: any) {
  const clamp = (v: number) => Math.min(100, Math.max(0, Number(v) || 0));
  const defaultWholesalePct = clamp(presets?.agentDiscountWholesalePct);
  const defaultRetailPct = clamp(presets?.agentDiscountRetailPct);
  return {
    discountWholesalePct: product.agent_discount_wholesale_pct != null ? clamp(product.agent_discount_wholesale_pct) : defaultWholesalePct,
    discountRetailPct: product.agent_discount_retail_pct != null ? clamp(product.agent_discount_retail_pct) : defaultRetailPct,
  };
}

// How long an item must have already sat in an agent's cluster before a
// sale of it can earn the cluster bonus -- closes the obvious hole where
// an agent stars a high-bonus item right before checkout, sells it, then
// un-stars it again with no real "cluster building" behind it. Shop-wide,
// configurable in Presets; 7 days when the shop hasn't set one.
const DEFAULT_CLUSTER_WAIT_DAYS = 7;
function resolveClusterWaitDays(presets: any): number {
  const v = presets?.agentClusterWaitDays;
  return v != null && v !== "" ? Math.max(0, Number(v) || 0) : DEFAULT_CLUSTER_WAIT_DAYS;
}

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { shopId, agentClientId, items, deliveryMode, deliveryAddress } = body;
    if (!shopId || !agentClientId || !Array.isArray(items) || !items.length) {
      return json({ error: "shopId, agentClientId and a non-empty items array are required" }, 400);
    }
    if (deliveryMode !== "agent_pickup" && deliveryMode !== "shop_delivery") {
      return json({ error: "deliveryMode must be 'agent_pickup' or 'shop_delivery'" }, 400);
    }
    if (deliveryMode === "shop_delivery" && !String(deliveryAddress || "").trim()) {
      return json({ error: "deliveryAddress is required when the shop is delivering" }, 400);
    }
    for (const it of items) {
      if (!it.productId || !(Number(it.qty) > 0) || !(Number(it.agentSellPrice) >= 0)) {
        return json({ error: "Each item needs productId, a positive qty, and a non-negative agentSellPrice" }, 400);
      }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: agentId, error: agentIdErr } = await callerClient.rpc("current_agent_id", { p_shop_id: shopId });
    if (agentIdErr) return json({ error: agentIdErr.message, stage: "current_agent_id" }, 500);
    if (!agentId) return json({ error: "Not an agent of this shop" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: agent, error: agentErr }, { data: client, error: clientErr }, { data: settingsRow, error: settingsErr }] = await Promise.all([
      admin.from("agents").select("*").eq("shop_id", shopId).eq("id", agentId).maybeSingle(),
      admin.from("agent_clients").select("*").eq("shop_id", shopId).eq("id", agentClientId).maybeSingle(),
      admin.from("app_settings").select("presets").eq("shop_id", shopId).maybeSingle(),
    ]);
    if (agentErr) return json({ error: agentErr.message, stage: "agent_lookup" }, 500);
    if (clientErr) return json({ error: clientErr.message, stage: "client_lookup" }, 500);
    if (settingsErr) return json({ error: settingsErr.message, stage: "settings_lookup" }, 500);
    if (!agent) return json({ error: "Agent not found" }, 404);
    // A paused agent. `unavailable` was written by the admin roster and
    // read by nothing anywhere -- not current_agent_id(), not this
    // function, not agent.html -- so "Mark inactive" greyed a card in the
    // admin's browser and left the agent free to keep placing orders.
    //
    // Checked HERE rather than in current_agent_id() on purpose. That
    // function is what every agent-scoped policy resolves through, so
    // failing it closes their clients, goals, catalogues and order
    // history all at once -- which is retirement, and is already what
    // retirement does. A pause is meant to stop the new business and
    // leave the rest, so it belongs on the one door new business comes
    // through.
    if (agent.unavailable) {
      return json({
        error: "Your account is paused. Talk to the shop before placing new orders.",
        paused: true,
      }, 403);
    }
    if (!client || client.agent_id !== agentId) return json({ error: "That client doesn't belong to this agent" }, 403);
    const presets = settingsRow?.presets || {};

    // A submit that lands server-side while the agent's connection drops
    // looks like a failure to them: agent.html re-enables its button in a
    // finally block, they tap again, and the shop gets two identical orders
    // to prepare and invoice. The button guard only covers a double tap on
    // a working connection.
    //
    // So an identical order from the same agent to the same client inside a
    // short window is treated as that same submission arriving twice, and
    // the original is handed back. Deliberately short: an agent who really
    // does want to place the same order twice waits a moment rather than
    // losing the second one. `duplicate` says which happened.
    const fingerprint = orderFingerprint(agentClientId, items);
    const cutoff = new Date(Date.now() - SUBMIT_DEDUPE_MS).toISOString();
    const { data: recent, error: recentErr } = await admin
      .from("saved_quotes")
      .select("id, payload")
      .eq("shop_id", shopId)
      .eq("agent_id", agentId)
      .eq("voided", false)
      .gte("payload->>savedAt", cutoff);
    if (recentErr) return json({ error: recentErr.message, stage: "dedupe_lookup" }, 500);
    const alreadyIn = (recent || []).find((q: any) =>
      orderFingerprint(q.payload?.agentClientId, q.payload?.items) === fingerprint
    );
    if (alreadyIn) {
      console.log("agent-submit-order: duplicate submission returned existing order", { orderId: alreadyIn.id });
      return json({ ok: true, orderId: alreadyIn.id, duplicate: true });
    }

    const productIds = [...new Set(items.map((it: any) => String(it.productId)))];
    const [
      { data: products, error: productsErr },
      { data: priceRows, error: priceErr },
      { data: clusterRows, error: clusterErr },
      { data: promoRows, error: promoErr },
      { data: suppliers, error: suppliersErr },
    ] = await Promise.all([
      admin.from("products").select("*").eq("shop_id", shopId).in("id", productIds),
      admin.from("prices").select("*").eq("shop_id", shopId).in("product_id", productIds),
      admin.from("agent_clusters").select("product_id, variant_idx, added_at").eq("shop_id", shopId).eq("agent_id", agentId).in("product_id", productIds),
      admin.from("agent_promotions").select("product_id, variant_idx, bonus_type, bonus_value, starts_at, ends_at").eq("shop_id", shopId).eq("active", true).in("product_id", productIds),
      admin.from("suppliers").select("id, name").eq("shop_id", shopId),
    ]);
    if (productsErr) return json({ error: productsErr.message, stage: "products_lookup" }, 500);
    if (priceErr) return json({ error: priceErr.message, stage: "prices_lookup" }, 500);
    if (clusterErr) return json({ error: clusterErr.message, stage: "cluster_lookup" }, 500);
    if (promoErr) return json({ error: promoErr.message, stage: "promo_lookup" }, 500);
    if (suppliersErr) return json({ error: suppliersErr.message, stage: "suppliers_lookup" }, 500);
    const productsById = new Map<string, any>((products || []).map((p) => [p.id, p]));
    const supplierNamesById = new Map<string, string>((suppliers || []).map((s) => [s.id, s.name]));

    // Bonus commission only ever locks in if the item has been sitting in
    // the agent's cluster for at least resolveClusterWaitDays() already --
    // not merely "in the cluster right now" (see 0012_sales_agents.sql for
    // the original, weaker version of this comment). Otherwise an agent
    // could star a high-bonus item moments before checkout, collect the
    // bonus, then un-star it -- no real cluster-building behind it. The
    // bonus itself is computed here, once, as a snapshot: it's based on
    // the real floor price (what the shop actually sold at), never the
    // agent's own resale price to their client, so an agent can't inflate
    // their own bonus just by typing a higher client-facing price.
    const clusterWaitDays = resolveClusterWaitDays(presets);
    const clusterWaitMs = clusterWaitDays * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const eligibleClusterKeys = new Set(
      (clusterRows || [])
        .filter((c) => nowMs - new Date(c.added_at).getTime() >= clusterWaitMs)
        .map((c) => `${c.product_id}::${c.variant_idx || ""}`)
    );
    const today = todayISO();
    const promoByKey = new Map(
      (promoRows || [])
        .filter((p) => (!p.starts_at || p.starts_at <= today) && (!p.ends_at || p.ends_at >= today))
        .map((p) => [`${p.product_id}::${p.variant_idx || ""}`, p])
    );

    const lineItems: any[] = [];
    for (const it of items) {
      const product = productsById.get(String(it.productId));
      if (!product) return json({ error: `Product ${it.productId} not found` }, 404);
      const variantIdx = it.variantIdx == null ? null : Number(it.variantIdx);
      const rowsForItem = (priceRows || []).filter((r) =>
        r.product_id === it.productId && (variantIdx == null ? r.variant_idx == null : String(r.variant_idx) === String(variantIdx))
      );
      const best = pickBestPriceRow(rowsForItem);
      if (!best) return json({ error: `No supplier price on file for ${product.name}` }, 409);
      const { discountWholesalePct, discountRetailPct } = resolveDiscountPcts(product, presets);
      const priced = computeFloorPrice(product, best, Number(it.qty), discountWholesalePct, discountRetailPct);
      if (!priced) return json({ error: `Could not price ${product.name}` }, 409);

      const key = `${product.id}::${variantIdx == null ? "" : variantIdx}`;
      const promo = promoByKey.get(key);
      const bonusCommission = promo && eligibleClusterKeys.has(key)
        ? (promo.bonus_type === "fixed"
          ? Number(promo.bonus_value) * Number(it.qty)
          : (Number(promo.bonus_value) / 100) * priced.floorPrice * Number(it.qty))
        : 0;

      // The variant belongs IN the name, matching what the admin's own
      // quote builder stores (productVariantLabel, index.html).
      //
      // Every admin surface -- the tracking board, the order edit view, the
      // customer's A5 invoice, the WhatsApp share, the supplier receipt and
      // the purchase invoice generated from the order -- prints
      // productName and none of them look the variant up from variantIdx.
      // Writing the bare product name here meant a variable item ordered by
      // an agent arrived with no indication of WHICH variant, all the way
      // through to the paperwork the customer and the supplier are handed.
      const variantCombo = variantIdx != null && Array.isArray(product.variants) && product.variants[variantIdx]
        ? Object.values(product.variants[variantIdx].combo || {}).join(" / ")
        : "";

      lineItems.push({
        productId: product.id,
        variantIdx,
        productName: variantCombo ? `${product.name} — ${variantCombo}` : product.name,
        unit: priced.unit,
        packUnit: priced.packUnit,
        packQty: priced.packQty,
        qty: Number(it.qty),
        // The supplier this floor price was actually costed from -- carried
        // forward (unlike the rest of this line, nothing about supplierId is
        // agent-facing or trust-sensitive) so the shop can see where to buy
        // the item from, and so marking the order invoiced auto-generates a
        // purchase invoice against this supplier the same way it already
        // does for a staff-built quote. Still just a starting point: an
        // admin can reassign it to a different supplier from the order's
        // edit view like any other line item, e.g. if this one's since sold
        // out or a better price came in after the order was placed.
        supplierId: best.supplier_id, supplierName: supplierNamesById.get(best.supplier_id) || null,
        price: priced.cost, // the real supplier cost this floor price was computed from
        sellPrice: priced.floorPrice, // what the shop is actually owed for this line
        agentSellPrice: Number(it.agentSellPrice), // the agent's own price to their client -- their business, not the shop's
        bonusCommission, // snapshot supplier-funded bonus, locked in at submit time -- see comment above
      });
    }

    const now = new Date().toISOString();
    const insertRow = {
      shop_id: shopId,
      client_name: agent.name,
      client_phone: agent.phone,
      date: todayISO(),
      status: "draft",
      invoiced: false,
      voided: false,
      amount_paid: 0,
      payload: {
        client: { name: agent.name, phone: agent.phone },
        items: lineItems,
        savedAt: now,
        payments: [],
        customerId: null,
        debtCharged: 0,
        originAgentId: agentId,
        agentClientId: client.id,
        deliveryMode,
        deliveryAddress: deliveryMode === "shop_delivery" ? String(deliveryAddress).trim() : null,
        agentPaymentStatus: "unpaid",
      },
    };

    const { data: inserted, error: insertErr } = await admin.from("saved_quotes").insert(insertRow).select("id").single();
    if (insertErr) return json({ error: insertErr.message, stage: "insert" }, 500);

    return json({ ok: true, orderId: inserted.id });
  } catch (err) {
    console.error("agent-submit-order: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
