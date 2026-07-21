// Admin-only: invites a staff member's login by email and links it to
// their `staff` row. Runs with the service-role key so it can both create
// the auth user and write shop_members/staff.user_id in one step -- neither
// of which an ordinary shop member's RLS-scoped session is allowed to do
// (staff.user_id is deliberately not writable by any client-side policy,
// see supabase/migrations/0011_staff_login_and_push.sql).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let shopId: string, staffId: string, email: string;
  try {
    ({ shopId, staffId, email } = await req.json());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!shopId || !staffId || !email) {
    return json({ error: "shopId, staffId and email are required" }, 400);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  // Bound to the caller's own JWT, so is_shop_admin() below reflects them,
  // not the service role.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isAdmin, error: adminCheckErr } = await callerClient.rpc(
    "is_shop_admin",
    { p_shop_id: shopId },
  );
  if (adminCheckErr) return json({ error: adminCheckErr.message }, 500);
  if (!isAdmin) return json({ error: "Only a shop admin/owner can send login invites" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: staffRow, error: staffErr } = await admin
    .from("staff")
    .select("id, user_id")
    .eq("shop_id", shopId)
    .eq("id", staffId)
    .maybeSingle();
  if (staffErr) return json({ error: staffErr.message }, 500);
  if (!staffRow) return json({ error: "Staff member not found" }, 404);
  if (staffRow.user_id) return json({ error: "This staff member already has a login" }, 409);

  // inviteUserByEmail creates the auth user (sends the invite email) if the
  // address is new; if it already belongs to an existing user, fall back to
  // looking that user up so this staff row can still be linked to it.
  let userId: string;
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteErr) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) return json({ error: inviteErr.message }, 500);
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) return json({ error: inviteErr.message }, 500);
    userId = existing.id;
  } else {
    userId = invited.user!.id;
  }

  const { error: memberErr } = await admin
    .from("shop_members")
    .upsert({ shop_id: shopId, user_id: userId, role: "staff" }, { onConflict: "shop_id,user_id", ignoreDuplicates: true });
  if (memberErr) return json({ error: memberErr.message }, 500);

  const { error: linkErr } = await admin
    .from("staff")
    .update({ user_id: userId })
    .eq("shop_id", shopId)
    .eq("id", staffId);
  if (linkErr) return json({ error: linkErr.message }, 500);

  return json({ ok: true, userId });
});
