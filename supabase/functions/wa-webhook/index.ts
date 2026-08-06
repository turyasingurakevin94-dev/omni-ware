// Receives everything WhatsApp has to say to the shop: customer
// messages, echoes of what the shop sends from its own phone
// (coexistence mirrors both directions through here), and delivery
// statuses for replies sent from the admin.
//
// Deployed with verify_jwt=false out of necessity -- Meta cannot present
// a Supabase JWT -- and protected instead the way Meta specifies:
//   GET  is the subscription handshake, gated on WHATSAPP_VERIFY_TOKEN.
//   POST is authenticated by the X-Hub-Signature-256 header, an
//        HMAC-SHA256 of the raw body under WHATSAPP_APP_SECRET.
//        Dormant while the secret is unset (same pattern and reasoning
//        as NOTIFY_WORKER_SECRET in notify-worker) so setup can be done
//        in either order -- but until it is set, anyone who finds the
//        URL can write fiction into the inbox, so set it.
//
// ALWAYS ANSWERS 200 to a signed POST, even when a payload makes no
// sense: Meta retries non-200 deliveries for hours and then disables
// the subscription -- a parsing bug must cost one lost event, not the
// whole channel. Errors are logged, never thrown at Meta.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// HMAC-SHA256 of the raw body, hex, compared against "sha256=<hex>".
// Comparison is constant-time-ish via length check + single pass; the
// value being compared is itself a MAC, so timing leaks reveal nothing
// usable, but there is no reason to be sloppy.
async function validSignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice("sha256=".length).toLowerCase();
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

// What a human would read of a message, for the conversation list.
// Anything without text becomes a bracketed kind -- "[image]", "[order]"
// -- rather than an empty row that looks like a bug.
// deno-lint-ignore no-explicit-any -- typed loosely on purpose: these two
// parsers are extracted verbatim into the Node test harness, whose type
// stripper handles annotations but not `as` casts with generic commas.
function messageBody(m: any) {
  const type = String(m.type || "");
  if (type === "text") return String((m.text && m.text.body) ?? "");
  const withCaption = m[type];
  if (withCaption && typeof withCaption.caption === "string" && withCaption.caption) {
    return `[${type}] ${withCaption.caption}`;
  }
  return `[${type}]`;
}

type WaEvent =
  | { kind: "in"; waId: string; name: string | null; wamid: string; type: string; body: string | null; payload: unknown; ts: string }
  | { kind: "out"; waId: string; wamid: string; type: string; body: string | null; payload: unknown; ts: string }
  | { kind: "status"; wamid: string; status: string; ts: string };

// One webhook `change` normalised into flat events. Pure, so the test
// suite can hold every mapping to account without an HTTP server.
//
// Coexistence detail that matters: a message the shop sends FROM ITS
// PHONE arrives under `message_echoes`/`smb_message_echoes`, not under
// `messages` -- treating those as inbound would file the shop's own
// words as a customer speaking, and reopen 24-hour windows the customer
// never opened.
// deno-lint-ignore no-explicit-any -- see messageBody
function normalizeChange(value: any) {
  const metadata = value.metadata ?? {};
  const phoneNumberId = metadata.phone_number_id == null ? null : String(metadata.phone_number_id);
  const events: WaEvent[] = [];
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const nameOf = (waId: string) => {
    const c = contacts.find((x: any) => String(x.wa_id ?? "") === waId);
    const profile = (c && c.profile) ?? {};
    return typeof profile.name === "string" && profile.name ? profile.name : null;
  };
  const tsIso = (t: unknown) => {
    const n = Number(t);
    return isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : new Date().toISOString();
  };

  for (const m of (Array.isArray(value.messages) ? value.messages : [])) {
    const waId = String(m.from ?? "");
    if (!waId || !m.id) continue;
    events.push({
      kind: "in", waId, name: nameOf(waId), wamid: String(m.id),
      type: String(m.type ?? "unknown"), body: messageBody(m), payload: m, ts: tsIso(m.timestamp),
    });
  }
  const echoes = Array.isArray(value.message_echoes) ? value.message_echoes
    : Array.isArray(value.smb_message_echoes) ? value.smb_message_echoes : [];
  for (const m of echoes) {
    const waId = String(m.to ?? "");
    if (!waId || !m.id) continue;
    events.push({
      kind: "out", waId, wamid: String(m.id),
      type: String(m.type ?? "unknown"), body: messageBody(m), payload: m, ts: tsIso(m.timestamp),
    });
  }
  for (const s of (Array.isArray(value.statuses) ? value.statuses : [])) {
    if (!s.id || !s.status) continue;
    events.push({ kind: "status", wamid: String(s.id), status: String(s.status), ts: tsIso(s.timestamp) });
  }
  return { phoneNumberId, events };
}

async function conversationFor(shopId: string, waId: string, name: string | null, ts: string, inbound: boolean): Promise<number | null> {
  // Upsert keyed on (shop_id, wa_id); last_inbound_at only ever moves
  // FORWARD and only for real inbound -- it is the 24h window's anchor.
  const { data: existing, error: selErr } = await admin.from("wa_conversations")
    .select("id, last_message_at, last_inbound_at").eq("shop_id", shopId).eq("wa_id", waId).maybeSingle();
  if (selErr) { console.error("wa-webhook: conversation lookup failed", selErr); return null; }
  if (!existing) {
    const { data: ins, error: insErr } = await admin.from("wa_conversations").insert({
      shop_id: shopId, wa_id: waId, profile_name: name,
      last_message_at: ts, last_inbound_at: inbound ? ts : null,
    }).select("id").single();
    if (insErr) {
      // Two events for a brand-new conversation can race; the unique
      // (shop_id, wa_id) makes one lose -- re-read instead of failing.
      const { data: again } = await admin.from("wa_conversations")
        .select("id").eq("shop_id", shopId).eq("wa_id", waId).maybeSingle();
      return again ? Number(again.id) : null;
    }
    return Number(ins.id);
  }
  const patch: Record<string, unknown> = {};
  if (name) patch.profile_name = name;
  if (!existing.last_message_at || ts > existing.last_message_at) patch.last_message_at = ts;
  if (inbound && (!existing.last_inbound_at || ts > existing.last_inbound_at)) patch.last_inbound_at = ts;
  if (Object.keys(patch).length) {
    const { error } = await admin.from("wa_conversations").update(patch).eq("id", existing.id);
    if (error) console.error("wa-webhook: conversation update failed", error);
  }
  return Number(existing.id);
}

async function handleEvents(shopId: string, events: WaEvent[]) {
  for (const ev of events) {
    if (ev.kind === "status") {
      const { error } = await admin.from("wa_messages")
        .update({ status: ev.status }).eq("shop_id", shopId).eq("wamid", ev.wamid);
      if (error) console.error("wa-webhook: status update failed", error);
      continue;
    }
    const convId = await conversationFor(shopId, ev.waId, ev.kind === "in" ? ev.name : null, ev.ts, ev.kind === "in");
    if (convId == null) continue;
    const { error } = await admin.from("wa_messages").upsert({
      shop_id: shopId, conversation_id: convId, wamid: ev.wamid,
      direction: ev.kind === "in" ? "in" : "out",
      msg_type: ev.type, body: ev.body, payload: ev.payload,
      status: ev.kind === "out" ? "sent" : null, sent_at: ev.ts,
    }, { onConflict: "shop_id,wamid", ignoreDuplicates: true });
    if (error) console.error("wa-webhook: message insert failed", error);
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    // Meta's subscription handshake.
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return json({ error: "verification failed" }, 403);
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const raw = await req.text();
  if (APP_SECRET) {
    const ok = await validSignature(raw, req.headers.get("x-hub-signature-256"), APP_SECRET);
    if (!ok) return json({ error: "bad signature" }, 401);
  } else {
    console.error("wa-webhook: WHATSAPP_APP_SECRET unset — accepting unsigned traffic until it is set");
  }

  try {
    const body = JSON.parse(raw);
    for (const entry of (Array.isArray(body.entry) ? body.entry : [])) {
      for (const change of (Array.isArray(entry.changes) ? entry.changes : [])) {
        const { phoneNumberId, events } = normalizeChange(change.value ?? {});
        if (!events.length) continue;
        if (!phoneNumberId) { console.error("wa-webhook: change without phone_number_id"); continue; }
        const { data: numRow, error } = await admin.from("wa_numbers")
          .select("shop_id").eq("phone_number_id", phoneNumberId).maybeSingle();
        if (error || !numRow) {
          console.error("wa-webhook: no shop mapped for phone_number_id", phoneNumberId, error);
          continue;
        }
        await handleEvents(String(numRow.shop_id), events);
      }
    }
  } catch (e) {
    console.error("wa-webhook: processing failed", e);
  }
  // 200 no matter what happened above -- see the header comment.
  return json({ received: true });
});
