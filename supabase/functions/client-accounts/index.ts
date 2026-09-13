// Admin-only: opens a customer's portal account, and issues the PIN the
// shop reads out to them.
//
// WHY THIS EXISTS AT ALL. client-portal mints a PIN and stores only a
// PBKDF2 hash of it. That is correct, and it also means nobody can read
// one back afterwards — not the shop, not this function, not somebody
// with the database in front of them. So the PIN a customer is actually
// given has to be minted HERE, in a reply to an admin who is looking at
// the screen, and shown once. There is no "resend": there is only another
// PIN. The admin screen says so.
//
// WHY IT IS A SEPARATE FUNCTION rather than two more actions on
// client-portal. That endpoint is reachable by anyone with the URL and
// authorises per action — by PIN, by session token, or not at all. This
// one refuses everything that is not a shop admin's own JWT, before it
// touches the service-role key. Putting both routers in one `if` chain
// would mean one misplaced branch stands between a stranger and the
// ability to mint a PIN for any customer in the shop. The identity a
// function serves is the right seam to split on; it is the same reason
// agents got their own catalogue function rather than a flag on the
// admin one.
//
// WHAT NEVER LEAVES HERE. A PIN is returned exactly once, to the admin
// who asked for it, in the reply to `open` or `reissue`. It is never
// stored in plaintext, never written to another table, never logged, and
// never included in `list` — there is no code path that could put one
// there, because the only variable that ever holds a PIN is local to the
// branch that minted it.
//
// The identity helpers below are duplicated VERBATIM from client-portal
// rather than imported. Edge Functions here are deployed by pasting one
// file at a time into the Supabase dashboard, which has no way to pull in
// a second file, so a shared-module import would fail to deploy. That is
// the house pattern (see agent-catalog's header for the same note about
// its pricing helpers); test/client-accounts.test.js pins the two copies
// character for character so they cannot drift.
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

// ---------------------------------------------------------------------
// Identity — duplicated verbatim from client-portal. See the header.
// ---------------------------------------------------------------------

// The last nine digits, and nothing else. 0772418903, +256772418903,
// 256 772 418 903 and 0772-418-903 are one person, and a portal that
// treats them as four is a portal that cannot find anybody's orders.
// Matches nothing about country codes deliberately: this shop's
// customers are all on the same one, and a rule that tries to parse
// them is a rule that mis-parses one.
export function normalisePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

// Four figures, from the platform's own CSPRNG. Never Math.random: a PIN
// that can be predicted from the clock is not a PIN.
function mintPin(): string {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 10000).padStart(4, "0");
}

// PBKDF2 rather than a bare digest, because a four-figure PIN is a
// ten-thousand-item search space and a plain SHA-256 of it is a lookup
// table somebody has already built. 100k iterations turns a leaked
// database from "here is every customer's live PIN" into an attack that
// costs real time for a secret that expires the same day anyway. (The
// copy of this note in client-portal says ten minutes, which is that
// function's TTL — the only line of these three helpers that differs, and
// it is prose. The code is compared character for character by test.)
//
// The salt is the account, not a column: one PIN per account at a time,
// so there is nothing to carry and nothing to forget to write.
async function hashPin(pin: string, shopId: string, customerId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(`${shopId}:${customerId}`), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------

// A PIN the SHOP issues lasts a day; one a customer asks for themselves
// lasts ten minutes (client-portal's PIN_TTL_MS).
//
// The difference is not a relaxation, because after the attempt ceiling
// landed the length of the window stopped being what holds brute force
// off — three tries is three tries whether they are spread over ten
// minutes or a day. What the window governs is how long a handover has
// to complete, and these two handovers are nothing alike. A customer
// asking for a PIN is at the screen with their phone in their hand; ten
// minutes is generous. An owner opening twenty accounts one evening is
// going to ring those people tomorrow, and a code that died before
// breakfast would mean re-issuing every one of them on the call.
const ADMIN_PIN_TTL_MS = 24 * 60 * 60 * 1000;
// Kept in step with client-portal by test, because the admin screen
// reports "N tries left" and reading a different ceiling than the one
// verify enforces would put a wrong number in front of the shop.
const PIN_MAX_ATTEMPTS = 3;

// What the shop may see about an account. Built key by key from named
// columns: pin_hash is not selected, so there is no field to forget to
// drop, and a column added to client_accounts tomorrow cannot arrive
// here by being part of a row somebody spread.
function accountView(row: any, sessions: number, customerPhone: string) {
  const attempts = Number(row.pin_attempts) || 0;
  const expires = row.pin_expires_at ? Date.parse(row.pin_expires_at) : 0;
  const mine = normalisePhone(customerPhone);
  return {
    customerId: row.customer_id,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    devices: sessions,
    // Whether a PIN is outstanding, never which one.
    pinLive: !!row.pin_hash && expires > Date.now() && attempts < PIN_MAX_ATTEMPTS,
    pinExpiresAt: row.pin_hash && expires > Date.now() ? row.pin_expires_at : null,
    triesLeft: Math.max(0, PIN_MAX_ATTEMPTS - attempts),
    lockedOut: attempts >= PIN_MAX_ATTEMPTS,
    // The account signs in on the number held here; the portal finds the
    // customer's ORDERS by the number on their customers row. Those are
    // written together and can still drift, because anyone may edit a
    // customer's phone in the app afterwards — and the failure is quiet
    // and awful: they sign in fine and their own history is missing. The
    // screen says so instead of waiting to be discovered.
    phoneMatchesCustomer: !!mine && mine === row.phone,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const shopId = String(body.shopId ?? "");
  const action = String(body.action ?? "");
  if (!shopId || !action) return json({ error: "shopId and action are required" }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  // Bound to the caller's own JWT, so is_shop_admin() reflects them and
  // not the service role. This happens BEFORE the service-role client is
  // created below — the same ordering agent-catalog's test pins, and for
  // the same reason: a service-role handle that exists before the check
  // is a service-role handle some later edit can reach past it.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isAdmin, error: adminCheckErr } = await callerClient.rpc("is_shop_admin", { p_shop_id: shopId });
  if (adminCheckErr) return json({ error: adminCheckErr.message, stage: "is_shop_admin" }, 500);
  if (!isAdmin) return json({ error: "Only a shop admin or owner can manage portal accounts" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Live sessions per customer, for the device counts. Revoked and
  // expired ones are not devices anybody is signed in on.
  async function deviceCounts(): Promise<Record<string, number>> {
    const { data } = await admin
      .from("client_sessions")
      .select("customer_id, expires_at, revoked_at")
      .eq("shop_id", shopId);
    const out: Record<string, number> = {};
    (data || []).forEach((s: any) => {
      if (s.revoked_at) return;
      if (Date.parse(s.expires_at) <= Date.now()) return;
      out[s.customer_id] = (out[s.customer_id] || 0) + 1;
    });
    return out;
  }

  async function loadAccount(customerId: string) {
    const { data } = await admin
      .from("client_accounts")
      .select("customer_id, phone, status, pin_hash, pin_expires_at, pin_attempts, created_at, last_seen_at")
      .eq("shop_id", shopId).eq("customer_id", customerId).maybeSingle();
    return data;
  }

  try {
    // -----------------------------------------------------------------
    // list — who has an account, and what state it is in
    // -----------------------------------------------------------------
    if (action === "list") {
      const [{ data: rows }, { data: customers }, counts] = await Promise.all([
        admin.from("client_accounts")
          .select("customer_id, phone, status, pin_hash, pin_expires_at, pin_attempts, created_at, last_seen_at")
          .eq("shop_id", shopId),
        admin.from("customers").select("id, phone").eq("shop_id", shopId),
        deviceCounts(),
      ]);
      const phones: Record<string, string> = {};
      (customers || []).forEach((c: any) => { phones[c.id] = c.phone || ""; });
      return json({
        ok: true,
        accounts: (rows || []).map((r: any) => accountView(r, counts[r.customer_id] || 0, phones[r.customer_id] || "")),
      });
    }

    const customerId = String(body.customerId ?? "");
    if (!customerId) return json({ error: "customerId is required" }, 400);

    // -----------------------------------------------------------------
    // open / reissue — the only two actions that produce a PIN
    //
    // One branch, because they differ in exactly one thing: whether a row
    // already exists. Two branches would be two places to remember to
    // reset the attempt count, and forgetting it in one of them is how an
    // admin issues a fresh PIN that is locked out before it is read.
    // -----------------------------------------------------------------
    if (action === "open" || action === "reissue") {
      const { data: customer } = await admin
        .from("customers").select("id, name, phone")
        .eq("shop_id", shopId).eq("id", customerId).maybeSingle();
      if (!customer) return json({ error: "No such customer" }, 404);

      const phone = normalisePhone(customer.phone);
      if (!phone) {
        return json({
          error: customer.phone
            ? `${customer.name || customerId} has ${String(customer.phone).replace(/\D/g, "").length} digits on file, and a number needs nine. Fix the phone number first.`
            : `${customer.name || customerId} has no phone number on file. The portal signs people in by number, so add one first.`,
        }, 400);
      }

      // One number is one account (client_accounts_phone_uniq). Two
      // customers sharing a phone is ordinary in a shop's book — a company
      // and its buyer, a husband and wife — and the insert would fail on
      // the index with a message about a constraint. Said plainly instead,
      // and naming who holds it, because the fix is a decision about which
      // of two people the account belongs to.
      const { data: clash } = await admin
        .from("client_accounts").select("customer_id")
        .eq("shop_id", shopId).eq("phone", phone).maybeSingle();
      if (clash && clash.customer_id !== customerId) {
        const { data: holder } = await admin
          .from("customers").select("name").eq("shop_id", shopId).eq("id", clash.customer_id).maybeSingle();
        return json({
          error: `That number already signs in as ${holder?.name || clash.customer_id}. One number is one account — give this customer their own number, or close the other account first.`,
        }, 409);
      }

      const existing = await loadAccount(customerId);
      if (action === "open" && existing) {
        return json({ error: "This customer already has an account. Issue a new PIN instead." }, 409);
      }
      if (action === "reissue" && !existing) {
        return json({ error: "This customer has no account yet." }, 404);
      }

      const pin = mintPin();
      const row = {
        shop_id: shopId,
        customer_id: customerId,
        // Re-synced from the customers row every time, so an account whose
        // customer changed their number starts signing in on the new one
        // the next time the shop issues a PIN.
        phone,
        pin_hash: await hashPin(pin, shopId, customerId),
        pin_expires_at: new Date(Date.now() + ADMIN_PIN_TTL_MS).toISOString(),
        // The one place that clears the count. An admin issuing a PIN is a
        // person vouching for the customer in front of them, which is
        // exactly what the ceiling in client-portal asks for before it
        // hands out three more tries.
        pin_attempts: 0,
        // Issuing a PIN to a suspended account would be a suspension that
        // does not suspend anything.
        status: "active",
        // agent_id is deliberately left unset. 0096 has the column and the
        // plan wanted it filled from agent_clients, but that table is an
        // agent's PRIVATE roster: 0012 refuses the shop a policy on it on
        // purpose, and matching it to a customer here with the service-role
        // key would tell the shop which of its customers are on which
        // agent's list — the precise leak that boundary exists to prevent.
        // If portal orders are to pay an agent, the source is
        // saved_quotes.agent_id, which the shop already sees.
      };
      const { error } = existing
        ? await admin.from("client_accounts").update(row).eq("shop_id", shopId).eq("customer_id", customerId)
        : await admin.from("client_accounts").insert(row);
      if (error) return json({ error: error.message, stage: action }, 500);

      // The only time a PIN is ever readable. Said out loud in the reply
      // so the shape of this function matches what the screen has to
      // promise: written down now, or gone.
      return json({
        ok: true,
        pin,
        expiresAt: row.pin_expires_at,
        opened: !existing,
        name: customer.name || customerId,
        phone,
      });
    }

    // -----------------------------------------------------------------
    // suspend / restore
    //
    // Never a delete. Closing an account by removing the row would take
    // its sessions with it (0096 cascades) and leave nothing saying the
    // customer ever had one — and the shop's reason for suspending is
    // usually a dispute, which is the moment a record matters most.
    // -----------------------------------------------------------------
    if (action === "suspend" || action === "restore") {
      const existing = await loadAccount(customerId);
      if (!existing) return json({ error: "This customer has no account yet." }, 404);
      const suspending = action === "suspend";
      const { error } = await admin.from("client_accounts")
        .update(suspending
          // A suspended account keeps no live PIN. Leaving one behind
          // means restoring the account silently un-expires a code
          // somebody was given before the trouble started.
          ? { status: "suspended", pin_hash: null, pin_expires_at: null }
          : { status: "active" })
        .eq("shop_id", shopId).eq("customer_id", customerId);
      if (error) return json({ error: error.message, stage: action }, 500);

      // Suspending revokes the devices too. An account that cannot sign in
      // but stays signed in on the phone in somebody's pocket is not
      // suspended; sessions last thirty days.
      if (suspending) {
        await admin.from("client_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("shop_id", shopId).eq("customer_id", customerId).is("revoked_at", null);
      }
      return json({ ok: true, status: suspending ? "suspended" : "active" });
    }

    // -----------------------------------------------------------------
    // revoke — sign every device out, without touching the account
    //
    // For a lost phone. The customer keeps their account and signs in
    // again with a new PIN; whoever has the handset does not.
    // -----------------------------------------------------------------
    if (action === "revoke") {
      const existing = await loadAccount(customerId);
      if (!existing) return json({ error: "This customer has no account yet." }, 404);
      const { data, error } = await admin.from("client_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("shop_id", shopId).eq("customer_id", customerId).is("revoked_at", null)
        .select("id");
      if (error) return json({ error: error.message, stage: "revoke" }, 500);
      return json({ ok: true, revoked: (data || []).length });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: String((err as Error)?.message || err), stage: "uncaught" }, 500);
  }
});
