// Fired by a Supabase Database Webhook on `stock_counts` INSERT (0115).
// One push: "Stock take done" to every owner, admin and manager of the
// shop, with what differs, so the person who can correct stock sees the
// count on their phone and can open it in the Store app to accept it or
// ask for a recount.
//
// Deploy:   supabase functions deploy notify-stock-count --no-verify-jwt
// Webhook:  Dashboard -> Database -> Webhooks -> table stock_counts,
//           event INSERT, HTTP Request to .../functions/v1/notify-stock-count,
//           header x-webhook-secret = NOTIFY_STOCK_SECRET (when set).
// Secrets:  FIREBASE_SERVICE_ACCOUNT_JSON (shared with notify-worker),
//           NOTIFY_STOCK_SECRET (optional, recommended).
//
// The body only says WHICH row was added; everything sent is re-read with
// the service role, so a crafted request cannot put words on a phone.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
const SECRET = Deno.env.get("NOTIFY_STOCK_SECRET");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
let fsa: { project_id: string; client_email: string; private_key: string } | null = null;
try { if (FIREBASE_SERVICE_ACCOUNT_JSON) fsa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON); } catch (_e) { fsa = null; }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
let cachedFcmToken: { accessToken: string; expiresAt: number } | null = null;

function base64UrlEncode(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getFcmAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmToken && cachedFcmToken.expiresAt > now + 60) return cachedFcmToken.accessToken;

  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;

  const pkcs8 = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pkcs8), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sigBuffer))}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`);

  cachedFcmToken = { accessToken: data.access_token, expiresAt: now + (data.expires_in || 3600) };
  return data.access_token;
}

function fmtDelta(n: number) { return (n > 0 ? "+" : "−") + Math.abs(Math.round(n * 100) / 100); }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (SECRET && (req.headers.get("x-webhook-secret") || "") !== SECRET) return json({ error: "Bad or missing webhook secret" }, 401);
  const payload = await req.json().catch(() => null);
  if (!payload || payload.table !== "stock_counts" || payload.type !== "INSERT" || !payload.record?.id) {
    return json({ ok: true, skipped: "not a stock_counts insert" });
  }
  if (!fsa) return json({ ok: true, skipped: "FIREBASE_SERVICE_ACCOUNT_JSON not set" });

  const { data: c } = await admin.from("stock_counts").select("*").eq("id", payload.record.id).maybeSingle();
  if (!c) return json({ ok: true, skipped: "count not found" });

  const lines: { name?: string; counted?: number; system?: number }[] = Array.isArray(c.lines) ? c.lines : [];
  const off = lines.filter((l) => Number(l.counted) !== Number(l.system));
  const title = `Stock take done${c.aisle ? " · " + c.aisle : ""}`;
  const who = c.counted_by_name || "Store";
  const body = off.length
    ? `${who} counted ${lines.length} blind. ${off.length} differ: ` +
      off.slice(0, 3).map((l) => `${l.name} ${fmtDelta(Number(l.counted) - Number(l.system))}`).join(", ") + (off.length > 3 ? "…" : ".")
    : `${who} counted ${lines.length} blind. All match.`;

  const { data: members } = await admin.from("shop_members").select("user_id, role").eq("shop_id", c.shop_id).in("role", ["owner", "admin", "manager"]);
  const userIds = (members || []).map((m: { user_id: string }) => m.user_id).filter((u: string) => u && u !== c.counted_by);
  if (!userIds.length) return json({ ok: true, skipped: "nobody to tell" });
  const { data: subs } = await admin.from("push_subscriptions").select("id, fcm_token").eq("shop_id", c.shop_id).in("user_id", userIds).not("fcm_token", "is", null);
  if (!subs || !subs.length) return json({ ok: true, skipped: "no devices" });

  const token = await getFcmAccessToken(fsa);
  let sent = 0;
  await Promise.all(subs.map(async (s: { id: unknown; fcm_token: string }) => {
    const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${fsa!.project_id}/messages:send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message: { token: s.fcm_token, notification: { title, body }, data: { kind: "stock_count", countId: String(c.id) }, android: { priority: "high" } } }),
    });
    if (resp.ok) { sent++; return; }
    const err = await resp.json().catch(() => ({}));
    const status = err?.error?.details?.[0]?.errorCode || err?.error?.status;
    if (status === "UNREGISTERED" || status === "NOT_FOUND" || resp.status === 404) await admin.from("push_subscriptions").delete().eq("id", s.id);
  }));
  return json({ ok: true, sent });
});
