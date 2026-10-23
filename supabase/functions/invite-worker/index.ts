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
// Where the invite email's link lands a worker -- the standalone worker
// app, not the admin app, so they land straight on their orders instead of
// having to find their way there. Override via `supabase secrets set
// WORKER_APP_URL=...` if the production domain ever changes; this must
// also be added to Supabase Auth's Redirect URLs allow-list (Dashboard ->
// Authentication -> URL Configuration) or the link will be rejected.
const WORKER_APP_URL = Deno.env.get("WORKER_APP_URL") || "https://omni-ware.vercel.app/worker.html";
// A Sales login works in the admin app, on the Sales desk -- not in the
// worker app -- so its invite lands there instead. Same allow-list rule.
const ADMIN_APP_URL = Deno.env.get("ADMIN_APP_URL") || "https://omni-ware.vercel.app/";
// A Buyer login works in the Buyer app (buyer.html). Same allow-list rule.
const BUYER_APP_URL = Deno.env.get("BUYER_APP_URL") || "https://omni-ware.vercel.app/buyer.html";
// An Accounts login keeps the books in the Accounts app (accounts.html, 0117).
const ACCOUNTS_APP_URL = Deno.env.get("ACCOUNTS_APP_URL") || "https://omni-ware.vercel.app/accounts.html";
// The memberships this function hands out and may move a login between.
// An owner's or admin's membership is never touched from here.
// A Store login works in the Store app (store.html). Same allow-list rule.
const STORE_APP_URL = Deno.env.get("STORE_APP_URL") || "https://omni-ware.vercel.app/store.html";
// A Manager login works in the Manager app (manager.html). Same allow-list
// rule. A manager is not an admin (is_shop_admin is owner/admin only): what
// they may write is their role_tasks (0116), so the owner may hand it out.
const MANAGER_APP_URL = Deno.env.get("MANAGER_APP_URL") || "https://omni-ware.vercel.app/manager.html";
// A Sourcing login finds items and suppliers in the Sourcing app
// (sourcing.html, 0126). Same allow-list rule.
const SOURCING_APP_URL = Deno.env.get("SOURCING_APP_URL") || "https://omni-ware.vercel.app/sourcing.html";
const DESK_ROLES = ["staff", "sales", "buyer", "store", "manager", "accounts", "sourcing"];

// The browser sends an OPTIONS preflight before the real POST (it carries
// custom headers like apikey/authorization). Without these on every
// response -- including the preflight's own -- the browser refuses to ever
// send the actual request and this function never even gets invoked.
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

// listUsers() is paginated, and calling it bare reads only the first page --
// the client sends no page size, so the server picks one. The old fallback
// searched that single page and gave up, so once this project had more auth
// users than fit on it, re-inviting an address that already existed failed
// with "invite_no_existing_match" while the user sat on page two. It fails
// for the exact people most likely to be re-invited: long-standing ones.
//
// MAX_PAGES is a bound, not an expectation -- it stops a malformed response
// spinning here forever. The same helper is in invite-agent.
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

  console.log("invite-worker: request received", {
    method: req.method,
    hasUrl: !!SUPABASE_URL,
    hasServiceKey: !!SERVICE_ROLE_KEY,
    hasAnonKey: !!ANON_KEY,
  });

  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let shopId: string, staffId: string, email: string;
    try {
      ({ shopId, staffId, email } = await req.json());
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    // The invitee's address is personal data and these logs are retained;
    // enough to trace a failed invite, not the whole address.
    console.log("invite-worker: parsed body", { shopId, staffId, emailDomain: String(email || "").split("@")[1] || null });
    // The email is asked for only when there is no login yet -- see below.
    if (!shopId || !staffId) {
      return json({ error: "shopId and staffId are required" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    console.log("invite-worker: auth header present?", !!authHeader);
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
    console.log("invite-worker: is_shop_admin result", { isAdmin, adminCheckErr });
    if (adminCheckErr) return json({ error: adminCheckErr.message, stage: "is_shop_admin" }, 500);
    if (!isAdmin) return json({ error: "Only a shop admin/owner can send login invites" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: staffRow, error: staffErr } = await admin
      .from("staff")
      .select("id, user_id, role, name")
      .eq("shop_id", shopId)
      .eq("id", staffId)
      .maybeSingle();
    console.log("invite-worker: staff lookup", { staffRow, staffErr });
    if (staffErr) return json({ error: staffErr.message, stage: "staff_lookup" }, 500);
    if (!staffRow) return json({ error: "Staff member not found" }, 404);
    // Who they are decides where they sign in and what the database lets
    // them write: somebody who sells joins as 'sales' (0113), somebody who
    // buys as 'buyer' (0113 allowed it, 0114 gave it its tasks), everybody
    // else as 'staff' on the worker app, exactly as before.
    const isSales = staffRow.role === "sales";
    const isBuyer = staffRow.role === "buyer";
    // Somebody who runs the store joins as 'store' (0113 allowed it, 0115
    // gave it its tasks) and signs in to the Store app.
    const isStore = staffRow.role === "store";
    // Somebody who manages the team joins as 'manager' (0113 allowed it,
    // 0116 gave it its tasks) and signs in to the Manager app.
    const isManager = staffRow.role === "manager";
    // Somebody who keeps the books joins as 'accounts' (0113 allowed it,
    // 0117 gave it its tasks) and signs in to the Accounts app.
    const isAccounts = staffRow.role === "accounts";
    // Somebody who finds new items and suppliers joins as 'sourcing' (the
    // role check allows it from 0128; 0126 gives it its tasks) and
    // signs in to the Sourcing app.
    const isSourcing = staffRow.role === "sourcing";
    const memberRole = isSales ? "sales" : isBuyer ? "buyer" : isStore ? "store" : isManager ? "manager" : isAccounts ? "accounts" : isSourcing ? "sourcing" : "staff";
    const roleUnknown = (msg: string) => (isSales || isBuyer || isStore || isManager || isAccounts || isSourcing) && /shop_members_role_check/.test(msg);
    const roleUnknownSay = isSourcing
      ? "This database does not know the Sourcing role yet — paste migrations 0126_sourcing.sql and 0128_sourcing_role.sql in the SQL editor, then try again."
      : `This database does not know the ${isSales ? "Sales" : isBuyer ? "Buyer" : isStore ? "Store" : isManager ? "Manager" : "Accounts"} role yet — paste migration 0113_sales_role.sql${isBuyer ? " and 0114_buyer_role.sql" : isStore ? " and 0115_store_role.sql" : isManager ? " and 0116_manager_role.sql" : isAccounts ? " and 0117_accounts_role.sql" : ""} in the SQL editor, then try again.`;

    if (staffRow.user_id) {
      // Already signed up. Moving somebody between the floor, the sales
      // desk and the buying desk changes what their EXISTING login may do,
      // so their membership follows their staff role -- between 'staff',
      // the desk roles only. An owner's or admin's membership is never
      // touched from here.
      const { data: member, error: memberReadErr } = await admin
        .from("shop_members").select("role")
        .eq("shop_id", shopId).eq("user_id", staffRow.user_id).maybeSingle();
      if (memberReadErr) return json({ error: memberReadErr.message, stage: "member_lookup" }, 500);
      if (member && DESK_ROLES.includes(member.role) && member.role !== memberRole) {
        const { error: roleErr } = await admin
          .from("shop_members").update({ role: memberRole })
          .eq("shop_id", shopId).eq("user_id", staffRow.user_id).in("role", DESK_ROLES);
        if (roleErr) {
          const say = roleUnknown(roleErr.message) ? roleUnknownSay : roleErr.message;
          return json({ error: say, stage: "member_role_update" }, 500);
        }
        return json({ ok: true, userId: staffRow.user_id, roleChanged: true, role: memberRole });
      }
      return json({ error: "This staff member already has a login" }, 409);
    }
    if (!email) return json({ error: "An email is needed to send the invite" }, 400);

    // inviteUserByEmail creates the auth user (sends the invite email) if the
    // address is new; if it already belongs to an existing user, fall back to
    // looking that user up so this staff row can still be linked to it.
    let userId: string;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: isSales ? ADMIN_APP_URL : isBuyer ? BUYER_APP_URL : isStore ? STORE_APP_URL : isManager ? MANAGER_APP_URL : isAccounts ? ACCOUNTS_APP_URL : isSourcing ? SOURCING_APP_URL : WORKER_APP_URL,
    });
    console.log("invite-worker: inviteUserByEmail result", {
      invitedUserId: invited?.user?.id,
      inviteErr: inviteErr ? { message: inviteErr.message, status: inviteErr.status, name: inviteErr.name } : null,
    });
    if (inviteErr) {
      const { user: existing, error: listErr } = await findUserByEmail(admin, email);
      console.log("invite-worker: existing-user lookup", { found: !!existing, listErr });
      if (listErr) return json({ error: inviteErr.message, stage: "invite_and_list_fallback" }, 500);
      if (!existing) return json({ error: inviteErr.message, stage: "invite_no_existing_match" }, 500);
      userId = existing.id;
    } else {
      userId = invited.user!.id;
    }

    const { error: memberErr } = await admin
      .from("shop_members")
      .upsert({ shop_id: shopId, user_id: userId, role: memberRole, display_name: String(staffRow.name || "").trim() || null }, { onConflict: "shop_id,user_id", ignoreDuplicates: true });
    console.log("invite-worker: shop_members upsert", { memberErr, memberRole });
    if (memberErr) {
      // The one failure a shop can fix itself: the role did not exist yet.
      const say = roleUnknown(memberErr.message) ? roleUnknownSay : memberErr.message;
      return json({ error: say, stage: "shop_members_upsert" }, 500);
    }

    const { error: linkErr } = await admin
      .from("staff")
      .update({ user_id: userId })
      .eq("shop_id", shopId)
      .eq("id", staffId);
    console.log("invite-worker: staff link update", { linkErr });
    if (linkErr) return json({ error: linkErr.message, stage: "staff_link_update" }, 500);

    return json({ ok: true, userId });
  } catch (err) {
    // Catches anything unexpected (a thrown error, not a {data,error} pair)
    // so the caller always sees our JSON shape instead of a generic runtime
    // error -- and so the real cause shows up in the logs either way.
    console.error("invite-worker: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
