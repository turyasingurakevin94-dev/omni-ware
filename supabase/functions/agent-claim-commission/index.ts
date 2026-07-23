// Lets an agent request payout of a completed month's supplier-funded
// bonus commission. Unlike the agent's own margin (which they already
// collect directly from their own client, never touching the shop's
// books), this bonus is real money the shop owes the agent -- so, same
// reasoning as agent-submit-order's floor-price recompute, the claimed
// amount is always computed here from the agent's own order history,
// never trusted from the client. A tampered request declaring a bigger
// bonus than was actually earned would otherwise mean the shop overpays.
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

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
    const { shopId, month } = body;
    if (!shopId || !month) return json({ error: "shopId and month are required" }, 400);
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: "month must be in 'YYYY-MM' form" }, 400);
    if (month >= currentMonthKey()) return json({ error: "Can only claim a month once it has ended" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: agentId, error: agentIdErr } = await callerClient.rpc("current_agent_id", { p_shop_id: shopId });
    if (agentIdErr) return json({ error: agentIdErr.message, stage: "current_agent_id" }, 500);
    if (!agentId) return json({ error: "Not an agent of this shop" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Already requested or paid? Return it as-is rather than re-deriving --
    // a claim, once made, is a fixed snapshot; it shouldn't silently change
    // if e.g. an order for that month gets edited afterward.
    const { data: existing, error: existingErr } = await admin
      .from("agent_commission_claims")
      .select("*")
      .eq("shop_id", shopId).eq("agent_id", agentId).eq("month", month)
      .maybeSingle();
    if (existingErr) return json({ error: existingErr.message, stage: "existing_lookup" }, 500);
    if (existing) return json({ ok: true, claim: existing });

    const { data: orders, error: ordersErr } = await admin
      .from("saved_quotes")
      .select("payload")
      .eq("shop_id", shopId)
      .eq("voided", false)
      .eq("payload->>originAgentId", agentId);
    if (ordersErr) return json({ error: ordersErr.message, stage: "orders_lookup" }, 500);

    let bonusAmount = 0;
    for (const row of orders || []) {
      const payload = row.payload || {};
      if (!payload.savedAt || !String(payload.savedAt).startsWith(month)) continue;
      for (const it of payload.items || []) {
        bonusAmount += Number(it.bonusCommission) || 0;
      }
    }
    if (!(bonusAmount > 0)) return json({ error: "No bonus commission earned that month" }, 400);

    const { data: inserted, error: insertErr } = await admin
      .from("agent_commission_claims")
      .insert({ shop_id: shopId, agent_id: agentId, month, bonus_amount: bonusAmount, status: "requested" })
      .select().single();
    if (insertErr) return json({ error: insertErr.message, stage: "insert" }, 500);

    return json({ ok: true, claim: inserted });
  } catch (err) {
    console.error("agent-claim-commission: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
