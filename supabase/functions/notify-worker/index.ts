// Fired by a Supabase Database Webhook on `saved_quotes` UPDATE (see
// ../README.md for the one-time deploy + Dashboard setup).
// Two pushes come out of it:
//
//   "New order to prepare"   to the one staff member an order was just put
//                            in front of -- autoAssignNextOrder() after a
//                            finished pick, or a re-offer after a step back;
//                            all of them set payload.pickingStatus to
//                            'awaiting_accept' on this table.
//   "Next to pick"           to EVERY worker in the shop, when an order
//                            enters Preparing with nobody on it. That order
//                            is in the pickers' queue on each of their
//                            phones (workerPickQueue, shared-worker.js) and
//                            the next free one takes it; an app that is
//                            open sees it on the next poll, and this is what
//                            reaches an app that is closed.
//
// Delivery is native FCM only (see 0014_native_push.sql for the
// push_subscriptions.fcm_token column) -- Web Push was retired since every
// worker install is the Android APK now, and browser-based delivery
// couldn't reliably foreground the installed app on tap.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
// This function is deployed verify_jwt=false because the Database Webhook
// that drives it cannot present a Supabase JWT -- which left it accepting
// requests from anyone. Set NOTIFY_WORKER_SECRET and add a matching
// `x-webhook-secret` header to the webhook (Dashboard -> Database ->
// Webhooks -> the saved_quotes hook -> HTTP Headers) to close it. Dormant
// while unset so notifications keep working until that is done; the
// re-read below is what limits the damage in the meantime.
const NOTIFY_WORKER_SECRET = Deno.env.get("NOTIFY_WORKER_SECRET");

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

  if (NOTIFY_WORKER_SECRET) {
    if ((req.headers.get("x-webhook-secret") || "") !== NOTIFY_WORKER_SECRET) {
      console.warn("notify-worker: rejected a request with a bad or missing webhook secret");
      return json({ error: "Bad or missing webhook secret" }, 401);
    }
  } else {
    console.warn("notify-worker: NOTIFY_WORKER_SECRET is not set -- this endpoint accepts requests from anyone");
  }

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

  // What means "this worker has to do something" is the order being put in
  // front of them, which is pickingStatus going to 'awaiting_accept'. Every
  // writer that hands an order over sets it: the admin's assign dialog,
  // autoAssignNextOrder, and the backward step that sends an order back to
  // be picked again.
  //
  // Keying on assignedWorkerId changing missed that last one. It re-offers
  // the order to the SAME worker -- they keep it, they just have to accept
  // and pick it again -- so the id is unchanged and no notification was
  // sent. The order reappeared on their device silently, and they found out
  // whenever they next happened to look.
  //
  // A changed id still counts on its own, so a path that hands an order over
  // without setting pickingStatus would not go silent.
  const newPicking = record.payload?.pickingStatus ?? null;
  const oldPicking = oldRecord.payload?.pickingStatus ?? null;
  const handedOver = newWorkerId !== oldWorkerId;
  const offeredAgain = newPicking === "awaiting_accept" && oldPicking !== "awaiting_accept";

  // NEXT TO PICK. An order that has just entered Preparing with nobody on
  // it is in the pickers' queue. Keyed on the transition, so an edit to an
  // order already waiting there does not ring every phone again, and
  // checked before the assignment path below, which would otherwise turn
  // it away for having no assignee -- that is the point of it.
  const enteredPreparing = record.status === "preparing" && oldRecord.status !== "preparing";
  if (enteredPreparing && !newWorkerId) {
    return await notifyPickQueue(record);
  }

  if (!newWorkerId || !(handedOver || offeredAgain)) {
    return json({ ok: true, skipped: "no new assignment to announce" });
  }

  // Re-read the order FIRST. The request body identifies WHICH row changed
  // and nothing else -- this endpoint is deployed verify_jwt=false and had
  // no authentication of any kind, so a crafted POST could previously put
  // arbitrary text on a worker's phone (the body was built straight from
  // record.client_name) and any id at all behind the notification tap.
  // Everything below is anchored to this row, including which shop's
  // subscriptions get looked up, so a forged event is turned away before it
  // can probe anything.
  const { data: order, error: orderErr } = await admin
    .from("saved_quotes")
    .select("id, shop_id, client_name, payload")
    .eq("shop_id", record.shop_id)
    .eq("id", record.id)
    .maybeSingle();
  if (orderErr) return json({ error: orderErr.message, stage: "order_reread" }, 500);
  if (!order) return json({ ok: true, skipped: "order not found" });

  // Confirm the assignment the payload claims is the one actually on the
  // row, so a forged or stale event cannot summon a notification for an
  // assignment that never happened or has already moved on.
  const assignedNow = order.payload?.assignedWorkerId ?? null;
  if (assignedNow == null || String(assignedNow) !== String(newWorkerId)) {
    return json({ ok: true, skipped: "assignment does not match the stored order" });
  }

  // ...and that the order is still sitting there waiting to be accepted.
  // Anchored to the row for the same reason as the line above, and it also
  // keeps the notification honest about what the app can show: the worker
  // view lists orders awaiting acceptance and orders in progress, nothing
  // else, so a push for an order in any other state would open on a screen
  // that does not have it. Covers a worker who accepted in the moment
  // between the update and this read, too -- they already have it.
  const pickingNow = order.payload?.pickingStatus ?? null;
  if (pickingNow !== "awaiting_accept") {
    return json({ ok: true, skipped: "order is not awaiting acceptance" });
  }

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id, fcm_token")
    .eq("shop_id", order.shop_id)
    .eq("staff_id", assignedNow)
    .not("fcm_token", "is", null);
  console.log("notify-worker: subscription lookup", {
    shopId: order.shop_id,
    staffId: assignedNow,
    subCount: subs?.length,
    subErr,
  });
  if (subErr) return json({ error: subErr.message }, 500);
  if (!subs?.length) return json({ ok: true, skipped: "worker has no push subscription" });

  if (!firebaseServiceAccount) {
    return json({ ok: true, skipped: "FIREBASE_SERVICE_ACCOUNT_JSON not configured" });
  }
  const fsa = firebaseServiceAccount;

  const itemCount = Array.isArray(order.payload?.items) ? order.payload.items.length : 0;
  const clientName = order.client_name || "a client";
  const title = "New order to prepare";
  const body = `${clientName} — ${itemCount} item${itemCount === 1 ? "" : "s"}`;

  return await pushToDevices(fsa, subs, title, body, order.id);
});

/* "Next to pick": every worker's device in the shop, for an order that has
   just joined the pickers' queue. Re-read first, for the same reason the
   assignment path does -- the body says which row changed and nothing
   else -- and with its own guard: the row must still be in Preparing with
   nobody on it and not yet packed, or a stale event would announce an
   order somebody already took. */
async function notifyPickQueue(record: { id?: number; shop_id?: string }) {
  const { data: order, error: orderErr } = await admin
    .from("saved_quotes")
    .select("id, shop_id, status, client_name, payload")
    .eq("shop_id", record.shop_id)
    .eq("id", record.id)
    .maybeSingle();
  if (orderErr) return json({ error: orderErr.message, stage: "queue_reread" }, 500);
  if (!order) return json({ ok: true, skipped: "order not found" });

  const stillQueued = order.status === "preparing"
    && (order.payload?.assignedWorkerId ?? null) == null
    && (order.payload?.pickingStatus ?? null) !== "done";
  if (!stillQueued) return json({ ok: true, skipped: "order is no longer in the pickers' queue" });

  // Workers only: a delivery-only staff member does not pick.
  const { data: workers, error: staffErr } = await admin
    .from("staff")
    .select("id")
    .eq("shop_id", order.shop_id)
    .eq("role", "worker");
  if (staffErr) return json({ error: staffErr.message, stage: "queue_staff" }, 500);
  const workerIds = (workers ?? []).map((w) => String(w.id));
  if (!workerIds.length) return json({ ok: true, skipped: "no workers on staff" });

  const { data: subs, error: subErr } = await admin
    .from("push_subscriptions")
    .select("id, fcm_token")
    .eq("shop_id", order.shop_id)
    .in("staff_id", workerIds)
    .not("fcm_token", "is", null);
  console.log("notify-worker: queue subscription lookup", { shopId: order.shop_id, workers: workerIds.length, subCount: subs?.length, subErr });
  if (subErr) return json({ error: subErr.message, stage: "queue_subs" }, 500);
  if (!subs?.length) return json({ ok: true, skipped: "no worker has a push subscription" });

  if (!firebaseServiceAccount) {
    return json({ ok: true, skipped: "FIREBASE_SERVICE_ACCOUNT_JSON not configured" });
  }
  const itemCount = Array.isArray(order.payload?.items) ? order.payload.items.length : 0;
  const clientName = order.client_name || "a client";
  const title = "Next to pick";
  const body = `${clientName} — ${itemCount} item${itemCount === 1 ? "" : "s"} · the next free picker takes it`;
  return await pushToDevices(firebaseServiceAccount, subs, title, body, order.id);
}

/* One send loop for both pushes. A token FCM has retired is dropped from
   push_subscriptions rather than retried forever. */
async function pushToDevices(
  fsa: { project_id: string; client_email: string; private_key: string },
  subs: { id: unknown; fcm_token: unknown }[],
  title: string,
  body: string,
  orderId: number,
) {
  let fcmAccessToken: string;
  try {
    fcmAccessToken = await getFcmAccessToken(fsa);
  } catch (e) {
    console.error("notify-worker: FCM auth failed", e);
    return json({ error: "FCM auth failed" }, 500);
  }

  const results = await Promise.allSettled(
    subs.map((sub) =>
      // orderId is order.id from the row that was read back, never the id
      // supplied in the request body.
      sendFcmNotification(fsa.project_id, fcmAccessToken, sub.fcm_token as string, title, body, orderId)
        .then(async (resp: Response) => {
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
  console.log("notify-worker: send results", { title, results: results.map((r) => r.status === "fulfilled" ? "ok" : String(r.reason)) });

  return json({ ok: true, sent: results.filter((r) => r.status === "fulfilled").length, total: subs.length });
}
