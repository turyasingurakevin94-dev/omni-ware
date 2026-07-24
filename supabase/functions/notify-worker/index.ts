// Fired by a Supabase Database Webhook on `saved_quotes` UPDATE (see
// README.md in this directory for the one-time deploy + Dashboard setup).
// Sends a push notification to whichever staff member an order's
// assignedWorkerId just changed to -- covers manual assignment, deny +
// reassignment, and autoAssignNextOrder() alike, since all three just
// mutate the same payload.assignedWorkerId field on this table.
//
// Delivery is native FCM only (see 0014_native_push.sql for the
// push_subscriptions.fcm_token column) -- Web Push was retired since every
// worker install is the Android APK now, and browser-based delivery
// couldn't reliably foreground the installed app on tap.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

let firebaseServiceAccount: { project_id: string; client_email: string; private_key: string } | null = null;
if (FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    firebaseServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error("notify-worker: FIREBASE_SERVICE_ACCOUNT_JSON did not parse as JSON", e);
  }
}

console.log("notify-worker: boot", {
  hasUrl: !!SUPABASE_URL,
  hasServiceKey: !!SERVICE_ROLE_KEY,
  hasFirebaseServiceAccount: !!firebaseServiceAccount,
});

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/* ---------------- FCM (native Android push) ----------------
   FCM's HTTP v1 API is authenticated with a short-lived OAuth2 access
   token obtained via a service-account JWT assertion -- built and RS256
   signed here with Deno's Web Crypto API so no extra JWT dependency is
   needed. The token is cached at module scope for its ~1h lifetime so a
   warm function instance doesn't re-authenticate on every notification. */
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

async function sendFcmNotification(
  projectId: string,
  accessToken: string,
  fcmToken: string,
  title: string,
  body: string,
  orderId: number,
): Promise<Response> {
  return fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        data: { orderId: String(orderId) },
        android: { priority: "high" },
      },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const payload = await req.json().catch(() => null);
  console.log("notify-worker: payload received", {
    table: payload?.table,
    type: payload?.type,
    newAssignedWorkerId: payload?.record?.payload?.assignedWorkerId,
    oldAssignedWorkerId: payload?.old_record?.payload?.assignedWorkerId,
  });
  if (!payload || payload.table !== "saved_quotes" || payload.type !== "UPDATE") {
    return json({ ok: true, skipped: "not a saved_quotes update" });
  }

  const record = payload.record ?? {};
  const oldRecord = payload.old_record ?? {};
  const newWorkerId = record.payload?.assignedWorkerId ?? null;
  const oldWorkerId = oldRecord.payload?.assignedWorkerId ?? null;

  if (!newWorkerId || newWorkerId === oldWorkerId) {
    return json({ ok: true, skipped: "assignedWorkerId unchanged or cleared" });
  }

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id, fcm_token")
    .eq("shop_id", record.shop_id)
    .eq("staff_id", newWorkerId)
    .not("fcm_token", "is", null);
  console.log("notify-worker: subscription lookup", {
    shopId: record.shop_id,
    staffId: newWorkerId,
    subCount: subs?.length,
    subErr,
  });
  if (subErr) return json({ error: subErr.message }, 500);
  if (!subs?.length) return json({ ok: true, skipped: "worker has no push subscription" });

  if (!firebaseServiceAccount) {
    return json({ ok: true, skipped: "FIREBASE_SERVICE_ACCOUNT_JSON not configured" });
  }
  const fsa = firebaseServiceAccount;

  const itemCount = Array.isArray(record.payload?.items) ? record.payload.items.length : 0;
  const clientName = record.client_name || "a client";
  const title = "New order to prepare";
  const body = `${clientName} — ${itemCount} item${itemCount === 1 ? "" : "s"}`;

  let fcmAccessToken: string;
  try {
    fcmAccessToken = await getFcmAccessToken(fsa);
  } catch (e) {
    console.error("notify-worker: FCM auth failed", e);
    return json({ error: "FCM auth failed" }, 500);
  }

  const results = await Promise.allSettled(
    subs.map((sub) =>
      sendFcmNotification(fsa.project_id, fcmAccessToken, sub.fcm_token as string, title, body, record.id)
        .then(async (resp) => {
          if (!resp.ok) {
            const errBody = await resp.json().catch(() => ({}));
            console.error("notify-worker: FCM send failed", { status: resp.status, errBody });
            const fcmStatus = errBody?.error?.status;
            if (fcmStatus === "UNREGISTERED" || fcmStatus === "NOT_FOUND" || resp.status === 404) {
              await admin.from("push_subscriptions").delete().eq("id", sub.id);
            }
            throw new Error(`FCM send failed: ${JSON.stringify(errBody)}`);
          }
          return resp;
        })
    ),
  );
  console.log("notify-worker: send results", results.map((r) => r.status === "fulfilled" ? "ok" : String(r.reason)));

  return json({ ok: true, sent: results.filter((r) => r.status === "fulfilled").length, total: subs.length });
});
