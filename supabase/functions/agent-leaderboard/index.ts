// Agent-only, read-only "this month" sales leaderboard for a shop.
//
// This app goes out of its way everywhere else to never show one party's
// pricing/margin numbers to another (agents never see supplier cost or
// pricing movement; a public catalogue visitor never sees a price at
// all). An agent's own margin is effectively their personal income, so
// that same boundary applies here: another agent's *rank* and *name* are
// shown, but never their exact commission figure -- only the caller's
// own row includes their real amount, exactly like their own Earnings
// tab already does. This is a deliberate, narrower response than a
// typical sales leaderboard, not an oversight.
//
// agent_id lives in saved_quotes.payload->>'originAgentId', not a real
// column (see 0012_sales_agents.sql's "agents manage their own orders"
// policy) -- so this reads shop-wide completed orders with the
// service-role key and attributes each one from its own payload, the
// same place agent.html's mapOrderRow()/orderEarnings() read it from.
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
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS_HEADERS } });
}

// First name + last initial -- recognizable to teammates without
// printing a coworker's full name to everyone else's screen.
function displayName(fullName: string): string {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Agent";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

// Must stay identical to agent.html's orderEarnings -- the rank an agent
// is shown here and the earnings they are shown there are the same money,
// and earnings-commission.test.js holds the two to the same answer.
//
// A line the agent never priced earns them nothing. It does not cost them
// the full shop price, which is what coercing the absent price to 0 did:
// the shop adding a line to an agent's order pushed that agent DOWN the
// league table by its whole value. See the note in agent.html.
function agentLinePriced(it: any): boolean {
  return !!it && it.agentSellPrice !== null && it.agentSellPrice !== undefined
    && it.agentSellPrice !== "" && Number.isFinite(Number(it.agentSellPrice));
}

function orderEarnings(items: any[]): number {
  let total = 0;
  for (const it of items || []) {
    if (agentLinePriced(it)) {
      total += (Number(it.agentSellPrice) - (Number(it.sellPrice) || 0)) * (Number(it.qty) || 0);
    }
    total += Number(it.bonusCommission) || 0;
  }
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let shopId: string, body: any;
    try {
      body = await req.json();
      ({ shopId } = body);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!shopId) return json({ error: "shopId is required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callingAgentId, error: agentIdErr } = await callerClient.rpc("current_agent_id", { p_shop_id: shopId });
    if (agentIdErr) return json({ error: agentIdErr.message, stage: "current_agent_id" }, 500);
    if (!callingAgentId) return json({ error: "Not an agent of this shop" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [{ data: agents, error: agentsErr }, { data: orders, error: ordersErr }] = await Promise.all([
      admin.from("agents").select("id, name").eq("shop_id", shopId),
      admin.from("saved_quotes").select("date, agent_id, payload").eq("shop_id", shopId).eq("status", "completed").eq("voided", false),
    ]);
    if (agentsErr) return json({ error: agentsErr.message, stage: "agents" }, 500);
    if (ordersErr) return json({ error: ordersErr.message, stage: "orders" }, 500);

    const monthKey = new Date().toISOString().slice(0, 7);
    const totals = new Map<string, { amount: number; completedOrders: number }>();
    for (const row of orders || []) {
      const payload = row.payload || {};
      // Same basis as agent-claim-commission, deliberately: this is what
      // the agent sees as earned and that has to be the same set of orders
      // the payout is computed from. The order's own date rather than
      // payload.savedAt, which is rewritten on every save and so moved
      // orders between months; and the FK'd agent_id rather than the
      // payload field, which is what the order policy matches on.
      const orderDate: string | null = row.date || null;
      const agentId: string | null = row.agent_id || null;
      if (!agentId || !orderDate || !String(orderDate).startsWith(monthKey)) continue;
      const entry = totals.get(agentId) || { amount: 0, completedOrders: 0 };
      entry.amount += orderEarnings(payload.items || []);
      entry.completedOrders += 1;
      totals.set(agentId, entry);
    }

    const ranked = (agents || [])
      .map((a: any) => ({ id: a.id, name: a.name, ...(totals.get(a.id) || { amount: 0, completedOrders: 0 }) }))
      .sort((a, b) => b.amount - a.amount)
      .map((a, idx) => ({ ...a, rank: idx + 1 }));

    const you = ranked.find((a) => a.id === callingAgentId) || null;
    // How far to the next place up -- the one number that turns a rank
    // into something to do today. Null at the top, and never negative.
    const above = you && you.rank > 1 ? ranked[you.rank - 2] : null;
    const gapToNext = above ? Math.max(0, above.amount - you!.amount) : null;
    const top = ranked.slice(0, 5).map((a) => ({ rank: a.rank, displayName: displayName(a.name), isYou: a.id === callingAgentId }));

    return json({
      ok: true,
      period: monthKey,
      totalAgents: ranked.length,
      you: you ? { rank: you.rank, amount: you.amount, completedOrders: you.completedOrders, gapToNext } : null,
      top,
    });
  } catch (err) {
    console.error("agent-leaderboard: uncaught error", err);
    return json({ error: String((err as Error).message || err), stage: "uncaught" }, 500);
  }
});
