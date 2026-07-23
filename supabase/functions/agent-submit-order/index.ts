// Creates an agent-originated order. This does NOT run as a plain
// client-side insert (even though agents' own RLS policy would technically
// allow one) because RLS only controls which ROWS an agent can touch, not
// whether the VALUES inside are honest -- a client-side insert would let a
// tampered request declare an artificially low price for what the agent
// actually owes the shop. Every item's floor price is recomputed here,
// server-side, from live data, the same way agent-catalog computes it (see
// ../_shared/agent-pricing.ts) -- the client's own idea of the floor price
// is never trusted, only used as a display figure earlier in the flow.
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
    if (!client || client.agent_id !== agentId) return json({ error: "That client doesn't belong to this agent" }, 403);
    const presets = settingsRow?.presets || {};

    const productIds = [...new Set(items.map((it: any) => String(it.productId)))];
    const [{ data: products, error: productsErr }, { data: priceRows, error: priceErr }] = await Promise.all([
      admin.from("products").select("*").eq("shop_id", shopId).in("id", productIds),
      admin.from("prices").select("*").eq("shop_id", shopId).in("product_id", productIds),
    ]);
    if (productsErr) return json({ error: productsErr.message, stage: "products_lookup" }, 500);
    if (priceErr) return json({ error: priceErr.message, stage: "prices_lookup" }, 500);
    const productsById = new Map<string, any>((products || []).map((p) => [p.id, p]));

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

      lineItems.push({
        productId: product.id,
        variantIdx,
        productName: product.name,
        unit: priced.unit,
        packUnit: priced.packUnit,
        packQty: priced.packQty,
        qty: Number(it.qty),
        supplierId: null, supplierName: null, // never carried on an agent-originated line -- see module header
        price: priced.cost, // the real supplier cost this floor price was computed from
        sellPrice: priced.floorPrice, // what the shop is actually owed for this line
        agentSellPrice: Number(it.agentSellPrice), // the agent's own price to their client -- their business, not the shop's
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
