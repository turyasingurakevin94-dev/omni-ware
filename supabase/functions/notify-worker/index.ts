// Fired by a Supabase Database Webhook on `saved_quotes` UPDATE (see
// README.md in this directory for the one-time deploy + Dashboard setup).
// Sends a Web Push notification to whichever staff member an order's
// assignedWorkerId just changed to -- covers manual assignment, deny +
// reassignment, and autoAssignNextOrder() alike, since all three just
// mutate the same payload.assignedWorkerId field on this table.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const payload = await req.json().catch(() => null);
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
    .select("id, endpoint, p256dh, auth_key")
    .eq("shop_id", record.shop_id)
    .eq("staff_id", newWorkerId);
  if (subErr) return json({ error: subErr.message }, 500);
  if (!subs?.length) return json({ ok: true, skipped: "worker has no push subscription" });

  const itemCount = Array.isArray(record.payload?.items) ? record.payload.items.length : 0;
  const clientName = record.client_name || "a client";
  const notificationPayload = JSON.stringify({
    title: "New order to prepare",
    body: `${clientName} — ${itemCount} item${itemCount === 1 ? "" : "s"}`,
    orderId: record.id,
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        notificationPayload,
      ).catch(async (err) => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        throw err;
      })
    ),
  );

  return json({ ok: true, sent: results.filter((r) => r.status === "fulfilled").length, total: subs.length });
});
