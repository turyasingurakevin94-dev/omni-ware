// Delivers push_outbox (0120_push_for_every_app.sql): every handoff that
// waits on someone, to that person's phone.
//
// Driven by a Supabase Database Webhook on push_outbox INSERT (see
// ../README.md). Each call does not trust the request body beyond "there
// is something to send": it sweeps every unsent row of the last day,
// oldest first, so a push missed by one call goes out with the next.
// Rows are claimed first (ow_push_claim), so two calls at once never send
// the same push twice; a row remembers the phones that already have it
// (delivered), so a retry reaches only the ones that missed.
//
// Who a row is for is the database's answer (ow_push_recipients): one
// login, everyone whose role holds a task, or everyone with a role --
// never the login that made the write. The phones are push_subscriptions
// rows with an FCM token, for that shop and those logins.
//
// Delivery is native FCM, exactly as notify-worker sends it
// (FIREBASE_SERVICE_ACCOUNT_JSON). The data block carries the kind and
// what it is about ({kind, table, id}) so the app can open on it.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
// Deployed verify_jwt=false, because a Database Webhook cannot present a
// Supabase JWT. Set PUSH_SEND_SECRET and the same value in the webhook's
// x-webhook-secret header. The body is never trusted either way: the
// function only sends what is already in the outbox.
const PUSH_SEND_SECRET = Deno.env.get("PUSH_SEND_SECRET");
const BATCH = 100;

let fsa: { project_id: string; client_email: string; private_key: string } | null = null;
if (FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    fsa = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error("push-send: FIREBASE_SERVICE_ACCOUNT_JSON did not parse as JSON", e);
  }
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/* ---------------- FCM, as notify-worker authenticates it ---------------- */
let cachedFcmToken: { accessToken: string; expiresAt: number } | null = null;

function base64UrlEncode(bytes: Uint8Array | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getFcmAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmToken && cachedFcmToken.expiresAt > now + 60) return cachedFcmToken.accessToken;
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;
  const pkcs8 = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pkcs8), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", keyBytes.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`);
  cachedFcmToken = { accessToken: data.access_token, expiresAt: now + (data.expires_in || 3600) };
  return data.access_token;
}

type Row = { id: number; shop_id: string; kind: string; title: string; body: string; ref: Record<string, unknown> | null; tries: number; delivered: number[] | null };

/* One outbox row to every phone it is for that does not have it yet.
   Returns the phones that have it now and the errors from the rest; a row
   with errors stays unsent and is tried again on a later call. */
async function deliver(token: string, row: Row): Promise<{ delivered: number[]; errors: string[] }> {
  const done = new Set<number>((row.delivered ?? []).map(Number));
  const { data: who, error: whoErr } = await admin.rpc("ow_push_recipients", { p_id: row.id });
  if (whoErr) throw new Error(`recipients: ${whoErr.message}`);
  const users = (who ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean);
  if (!users.length) return { delivered: [...done], errors: [] };

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id, fcm_token")
    .eq("shop_id", row.shop_id)
    .in("user_id", users)
    .not("fcm_token", "is", null);
  if (subErr) throw new Error(`subscriptions: ${subErr.message}`);
  const todo = (subs ?? []).filter((sub) => !done.has(Number(sub.id)));
  if (!todo.length) return { delivered: [...done], errors: [] };

  const data: Record<string, string> = { kind: String(row.kind) };
  if (row.ref && typeof row.ref === "object") {
    for (const [k, v] of Object.entries(row.ref)) if (v != null) data[k] = String(v);
  }
  // notify-worker's tap handler reads orderId; keep it for an order.
  if (data.table === "saved_quotes" && data.id) data.orderId = data.id;

  const errors: string[] = [];
  await Promise.all(todo.map(async (sub) => {
    // A phone whose send throws (the network) is an error like any other,
    // so the phones that did get it are still recorded.
    let resp: Response;
    try {
      resp = await fetch(`https://fcm.googleapis.com/v1/projects/${fsa!.project_id}/messages:send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: { token: sub.fcm_token, notification: { title: row.title, body: row.body }, data, android: { priority: "high" } },
        }),
      });
    } catch (e) {
      errors.push(String((e as Error)?.message || e).slice(0, 80));
      return;
    }
    if (resp.ok) { done.add(Number(sub.id)); return; }
    const errBody = await resp.json().catch(() => ({}));
    const fcmStatus = errBody?.error?.status;
    // A phone FCM has retired is dropped, not retried for ever.
    if (fcmStatus === "UNREGISTERED" || fcmStatus === "NOT_FOUND" || resp.status === 404) {
      await admin.from("push_subscriptions").delete().eq("id", sub.id);
      return;
    }
    errors.push(`${resp.status} ${fcmStatus || ""}`.trim());
  }));
  return { delivered: [...done], errors };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (PUSH_SEND_SECRET) {
    if ((req.headers.get("x-webhook-secret") || "") !== PUSH_SEND_SECRET) return json({ error: "Bad or missing webhook secret" }, 401);
  } else {
    console.warn("push-send: PUSH_SEND_SECRET is not set -- anyone can ask this function to send what is already in the outbox");
  }
  if (!fsa) return json({ ok: true, skipped: "FIREBASE_SERVICE_ACCOUNT_JSON not configured" });

  const { data: rows, error } = await admin.rpc("ow_push_claim", { p_limit: BATCH });
  if (error) return json({ error: error.message, stage: "claim" }, 500);
  if (!rows?.length) return json({ ok: true, sent: 0 });

  let token: string;
  try {
    token = await getFcmAccessToken(fsa);
  } catch (e) {
    console.error("push-send: FCM auth failed", e);
    return json({ error: "FCM auth failed" }, 500);
  }

  const results = [];
  for (const row of rows as Row[]) {
    try {
      const { delivered, errors } = await deliver(token, row);
      const finished = !errors.length;
      await admin.from("push_outbox").update({
        delivered,
        claimed_at: null,
        ...(finished ? { sent_at: new Date().toISOString(), sent_to: delivered.length, last_error: null }
                     : { last_error: `FCM refused: ${errors.join(", ")}`.slice(0, 300) }),
      }).eq("id", row.id);
      results.push({ id: row.id, sent: delivered.length, ...(finished ? {} : { errors }) });
    } catch (e) {
      const msg = String((e as Error)?.message || e).slice(0, 300);
      await admin.from("push_outbox").update({ claimed_at: null, last_error: msg }).eq("id", row.id);
      results.push({ id: row.id, error: msg });
    }
  }
  console.log("push-send: results", results);
  return json({ ok: true, rows: rows.length, results });
});
