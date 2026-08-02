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

// See the matching note in invite-worker: listUsers() is paginated and a
// bare call reads one page, so re-inviting an address that already existed
// failed once the project outgrew that page. Kept identical to that copy.
const LIST_PER_PAGE = 200;
const LIST_MAX_PAGES = 50;
async function findUserByEmail(admin: any, email: string): Promise<{ user: any; error: any }> {
  const want = String(email || "").toLowerCase();
  for (let page = 1; page <= LIST_MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LIST_PER_PAGE });
    if (error) return { user: null, error };
    const users = (data && data.users) || [];
    const hit = users.find((u: any) => (u.email || "").toLowerCase() === want);
    if (hit) return { user: hit, error: null };
    if (users.length < LIST_PER_PAGE) return { user: null, error: null }; // last page
  }
  return { user: null, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    // agentId is deliberately NOT accepted from the caller any more. The id
    // is issued by the database (0029_agent_identity_rebuild) and returned
    // below, because a caller-chosen id is what allowed one agent's order
    // history to be handed to another by re-typing or re-using a value.
    let shopId: string, name: string, phone: string | undefined, email: string, paymentTerm: string | undefined;
    try {
      ({ shopId, name, phone, email, paymentTerm } = await req.json());
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    if (!shopId || !name || !email) {
      return json({ error: "shopId, name and email are required" }, 400);
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
      const { user: existing, error: listErr } = await findUserByEmail(admin, email);
      if (listErr) return json({ error: inviteErr.message, stage: "invite_and_list_fallback" }, 500);
      if (!existing) return json({ error: inviteErr.message, stage: "invite_no_existing_match" }, 500);
      userId = existing.id;
    } else {
      userId = invited.user!.id;
    }

    // One login is one agent row (agents_user_unique, 0029), so a person who
    // is already an agent -- here or at another shop, active or retired --
    // must be restored rather than added again. Adding them again is what
    // used to strand their existing orders under an id nobody was using.
    const { data: existingAgent } = await admin
      .from("agents")
      .select("id, shop_id, name, retired_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingAgent) {
      return json({
        error: existingAgent.retired_at
          ? `${existingAgent.name} is already an agent (${existingAgent.id}) but retired. Restore them instead of inviting again, so their order history stays attached.`
          : `${email} is already an agent (${existingAgent.id})${existingAgent.shop_id !== shopId ? " at another shop" : ""}.`,
      }, 409);
    }

    // id is omitted on purpose -- the column default assigns it (0029).
    const { data: inserted, error: insertErr } = await admin.from("agents").insert({
      shop_id: shopId,
      user_id: userId,
      name,
      phone: phone || null,
      email,
      payment_term: paymentTerm || "prepay",
    }).select("id").single();
    if (insertErr) return json({ error: insertErr.message, stage: "agents_insert" }, 500);

    return json({ ok: true, userId, agentId: inserted.id });
  } catch (err) {
    console.error("invite-agent: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
