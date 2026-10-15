// Admin-only: invites a supplier to the supplier portal (supplier.html)
// and issues the four-figure PIN the shop sends them on WhatsApp.
//
// The supplier twin of client-accounts, and separate from supplier-portal
// for the reason client-accounts is separate from client-portal: that
// endpoint is reachable by anyone with the URL and authorises per action,
// while this one refuses everything that is not a shop admin's own JWT
// before it touches the service-role key.
//
// ACCOUNTS ARE CREATED BY THE SHOP, NEVER BY SIGNING UP. There is no
// supplier-side action that mints a PIN. "Forgot PIN?" in the app only
// raises pin_requested_at, which `list` reports so the owner can reissue.
//
// WHAT NEVER LEAVES HERE. A PIN is returned exactly once, in the reply to
// `open` or `reissue`. It is never stored in plaintext, never written to
// another table and never included in `list`.
//
// The identity helpers are duplicated VERBATIM from client-portal (the
// house pattern: functions are pasted into the dashboard one file at a
// time). test/supplier-portal.test.js pins the copies so they cannot
// drift.
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
// Identity — duplicated verbatim from client-portal.
// ---------------------------------------------------------------------

export function normalisePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

function mintPin(): string {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return String(b[0] % 10000).padStart(4, "0");
}

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

// A supplier PIN lasts seven days: it travels in a WhatsApp invite the
// supplier may not open until they are back at their stall. Kept in step
// with supplier-portal's ceiling by test.
const INVITE_PIN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PIN_MAX_ATTEMPTS = 5;

// The salt prefix keeps a supplier's PIN hash from ever colliding with a
// customer whose id happens to match: one shop, two identity tables.
function pinSubject(supplierId: string): string {
  return `supplier:${supplierId}`;
}

// What the shop may see about an account, key by key from named columns.
function accountView(row: any, sessions: number) {
  const attempts = Number(row.pin_attempts) || 0;
  const expires = row.pin_expires_at ? Date.parse(row.pin_expires_at) : 0;
  return {
    supplierId: row.supplier_id,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    devices: sessions,
    pinLive: !!row.pin_hash && expires > Date.now() && attempts < PIN_MAX_ATTEMPTS,
    pinExpiresAt: row.pin_hash && expires > Date.now() ? row.pin_expires_at : null,
    triesLeft: Math.max(0, PIN_MAX_ATTEMPTS - attempts),
    lockedOut: attempts >= PIN_MAX_ATTEMPTS,
    pinRequestedAt: row.pin_requested_at || null,
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

  // The caller's own JWT decides, BEFORE the service-role client exists.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isAdmin, error: adminCheckErr } = await callerClient.rpc("is_shop_admin", { p_shop_id: shopId });
  if (adminCheckErr) return json({ error: adminCheckErr.message, stage: "is_shop_admin" }, 500);
  if (!isAdmin) return json({ error: "Only a shop admin or owner can manage supplier accounts" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  async function deviceCounts(): Promise<Record<string, number>> {
    const { data } = await admin
      .from("supplier_sessions")
      .select("supplier_id, expires_at, revoked_at")
      .eq("shop_id", shopId);
    const out: Record<string, number> = {};
    (data || []).forEach((s: any) => {
      if (s.revoked_at) return;
      if (Date.parse(s.expires_at) <= Date.now()) return;
      out[s.supplier_id] = (out[s.supplier_id] || 0) + 1;
    });
    return out;
  }

  const ACCOUNT_COLS = "supplier_id, phone, status, pin_hash, pin_expires_at, pin_attempts, pin_requested_at, created_at, last_seen_at";

  async function loadAccount(supplierId: string) {
    const { data } = await admin
      .from("supplier_accounts")
      .select(ACCOUNT_COLS)
      .eq("shop_id", shopId).eq("supplier_id", supplierId).maybeSingle();
    return data;
  }

  try {
    if (action === "list") {
      const [{ data: rows }, counts] = await Promise.all([
        admin.from("supplier_accounts").select(ACCOUNT_COLS).eq("shop_id", shopId),
        deviceCounts(),
      ]);
      return json({
        ok: true,
        accounts: (rows || []).map((r: any) => accountView(r, counts[r.supplier_id] || 0)),
      });
    }

    const supplierId = String(body.supplierId ?? "");
    if (!supplierId) return json({ error: "supplierId is required" }, 400);

    // open / reissue — the only two actions that produce a PIN.
    if (action === "open" || action === "reissue") {
      const { data: supplier } = await admin
        .from("suppliers").select("id, name, phone, phone2")
        .eq("shop_id", shopId).eq("id", supplierId).maybeSingle();
      if (!supplier) return json({ error: "No such supplier" }, 404);

      // contactPhones: a supplier's number can sit in phone2.
      const phone = normalisePhone(supplier.phone) || normalisePhone((supplier as any).phone2);
      if (!phone) {
        return json({
          error: `${supplier.name || supplierId} has no full phone number on file. The supplier app signs people in by number, so add one first.`,
        }, 400);
      }

      const { data: clash } = await admin
        .from("supplier_accounts").select("supplier_id")
        .eq("shop_id", shopId).eq("phone", phone).maybeSingle();
      if (clash && clash.supplier_id !== supplierId) {
        const { data: holder } = await admin
          .from("suppliers").select("name").eq("shop_id", shopId).eq("id", clash.supplier_id).maybeSingle();
        return json({
          error: `That number already signs in as ${holder?.name || clash.supplier_id}. One number is one account.`,
        }, 409);
      }

      const existing = await loadAccount(supplierId);
      if (action === "open" && existing) {
        return json({ error: "This supplier already has an account. Issue a new PIN instead." }, 409);
      }
      if (action === "reissue" && !existing) {
        return json({ error: "This supplier has no account yet." }, 404);
      }

      const pin = mintPin();
      const row = {
        shop_id: shopId,
        supplier_id: supplierId,
        phone,
        pin_hash: await hashPin(pin, shopId, pinSubject(supplierId)),
        pin_expires_at: new Date(Date.now() + INVITE_PIN_TTL_MS).toISOString(),
        pin_attempts: 0,
        pin_requested_at: null,
        status: "active",
      };
      const { error } = existing
        ? await admin.from("supplier_accounts").update(row).eq("shop_id", shopId).eq("supplier_id", supplierId)
        : await admin.from("supplier_accounts").insert(row);
      if (error) return json({ error: error.message, stage: action }, 500);

      return json({
        ok: true,
        pin,
        expiresAt: row.pin_expires_at,
        opened: !existing,
        name: supplier.name || supplierId,
        phone,
      });
    }

    if (action === "suspend" || action === "restore") {
      const existing = await loadAccount(supplierId);
      if (!existing) return json({ error: "This supplier has no account yet." }, 404);
      const suspending = action === "suspend";
      const { error } = await admin.from("supplier_accounts")
        .update(suspending
          ? { status: "suspended", pin_hash: null, pin_expires_at: null }
          : { status: "active" })
        .eq("shop_id", shopId).eq("supplier_id", supplierId);
      if (error) return json({ error: error.message, stage: action }, 500);
      if (suspending) {
        await admin.from("supplier_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("shop_id", shopId).eq("supplier_id", supplierId).is("revoked_at", null);
      }
      return json({ ok: true, status: suspending ? "suspended" : "active" });
    }

    if (action === "revoke") {
      const existing = await loadAccount(supplierId);
      if (!existing) return json({ error: "This supplier has no account yet." }, 404);
      const { data, error } = await admin.from("supplier_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("shop_id", shopId).eq("supplier_id", supplierId).is("revoked_at", null)
        .select("id");
      if (error) return json({ error: error.message, stage: "revoke" }, 500);
      return json({ ok: true, revoked: (data || []).length });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: String((err as Error)?.message || err), stage: "uncaught" }, 500);
  }
});
