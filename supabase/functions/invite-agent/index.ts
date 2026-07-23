// Admin-only: invites an external sales agent's login by email and creates
// their `agents` row in the same step. Unlike invite-worker (which links an
// already-existing staff row), an agent has no reason to exist in the
// system before they're invited -- there's no "add them to the roster now,
// send the login later" scenario for an external partner -- so this does
// both at once. Runs with the service-role key because agents are
// deliberately NOT shop_members (see 0012_sales_agents.sql): an ordinary
// admin session can update payment_term/notes on an existing agents row
// directly via RLS, but creating the auth user and the first agents row
// together needs to bypass RLS in one atomic-ish step the same way
// invite-worker does.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
// Where the invite email's link lands an agent -- the standalone agent
// app, not the admin app. Override via `supabase secrets set
// AGENT_APP_URL=...` if the production domain ever changes; this must also
// be added to Supabase Auth's Redirect URLs allow-list (Dashboard ->
// Authentication -> URL Configuration) or the link will be rejected.
const AGENT_APP_URL = Deno.env.get("AGENT_APP_URL") || "https://omni-ware.vercel.app/agent.html";

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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let shopId: string, agentId: string, name: string, phone: string | undefined, email: string, paymentTerm: string | undefined;
    try {
      ({ shopId, agentId, name, phone, email, paymentTerm } = await req.json());
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!shopId || !agentId || !name || !email) {
      return json({ error: "shopId, agentId, name and email are required" }, 400);
    }
    if (paymentTerm && paymentTerm !== "prepay" && paymentTerm !== "pay_on_delivery") {
      return json({ error: "paymentTerm must be 'prepay' or 'pay_on_delivery'" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    // Bound to the caller's own JWT, so is_shop_admin() reflects them, not
    // the service role.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin, error: adminCheckErr } = await callerClient.rpc(
      "is_shop_admin",
      { p_shop_id: shopId },
    );
    if (adminCheckErr) return json({ error: adminCheckErr.message, stage: "is_shop_admin" }, 500);
    if (!isAdmin) return json({ error: "Only a shop admin/owner can send agent invites" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: existingAgent } = await admin
      .from("agents")
      .select("id")
      .eq("shop_id", shopId)
      .eq("id", agentId)
      .maybeSingle();
    if (existingAgent) return json({ error: "An agent with this id already exists" }, 409);

    // inviteUserByEmail creates the auth user (sends the invite email) if
    // the address is new; if it already belongs to an existing user
    // (e.g. they're also a customer or already an agent at another shop),
    // fall back to looking that user up so this agent row can still be
    // linked to it.
    let userId: string;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: AGENT_APP_URL,
    });
    if (inviteErr) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers();
      if (listErr) return json({ error: inviteErr.message, stage: "invite_and_list_fallback" }, 500);
      const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) return json({ error: inviteErr.message, stage: "invite_no_existing_match" }, 500);
      userId = existing.id;
    } else {
      userId = invited.user!.id;
    }

    const { error: insertErr } = await admin.from("agents").insert({
      shop_id: shopId,
      id: agentId,
      user_id: userId,
      name,
      phone: phone || null,
      email,
      payment_term: paymentTerm || "prepay",
    });
    if (insertErr) return json({ error: insertErr.message, stage: "agents_insert" }, 500);

    return json({ ok: true, userId });
  } catch (err) {
    console.error("invite-agent: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
