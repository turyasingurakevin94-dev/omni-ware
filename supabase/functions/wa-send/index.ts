// Sends the shop's replies, and reports whether the connection is set
// up at all. The browser never touches the Graph API or the access
// token -- it calls here with the member's own JWT, and this function
// holds the credentials.
//
// TWO RULES ARE ENFORCED SERVER-SIDE, NOT IN THE UI:
//
//   Membership. The caller's JWT must belong to a member of the shop it
//   claims (is_shop_member, checked under the caller's own token). The
//   composer being hidden in the admin is a courtesy; this is the gate.
//
//   The 24-hour window. A free-form reply is only deliverable while the
//   customer's last message is under 24 hours old -- outside it, Meta
//   rejects free-form sends and only paid templates go through (phase
//   5's business, not this one's). Checking here rather than trusting
//   the client means a stale tab cannot burn a send against a closed
//   window and report success.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const GRAPH_BASE = "https://graph.facebook.com/v23.0";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

// What stays in the catalog and what leaves it. Pure, so the promise is
// testable: everything desired is pushed (upsert), and anything in the
// catalog that the shop no longer offers is DELETED -- a product taken
// off the shelf must come off the shop window too, or WhatsApp keeps
// selling what the shop cannot deliver.
// deno-lint-ignore no-explicit-any -- extracted into the Node harness
function catalogDiff(existingIds: any, desired: any) {
  const want = new Set(desired.map((d: any) => d.retailerId));
  return {
    toDelete: existingIds.filter((id: string) => !want.has(id)),
  };
}

// The window fact, computed one way for both the refusal and the UI.
// No last_inbound_at means the customer has never written: closed --
// a window that was never opened is not an open window.
function windowState(lastInboundAt: string | null, nowMs: number): { open: boolean; msLeft: number } {
  if (!lastInboundAt) return { open: false, msLeft: 0 };
  const opened = Date.parse(lastInboundAt);
  if (!isFinite(opened)) return { open: false, msLeft: 0 };
  const msLeft = opened + WINDOW_MS - nowMs;
  return { open: msLeft > 0, msLeft: Math.max(0, msLeft) };
}

// A template parameter may not hold a newline, a tab or more than four
// spaces in a row (Meta refuses the send), so a reply's lines are joined
// the way a person would read them aloud.
function replyParam(s: string) {
  return s.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean).join(" · ")
    .replace(/\t/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 900);
}

const MEDIA_MAX = 16 * 1024 * 1024;
// The file's ending, from its type, else the document's own name.
function mediaExt(mime: string, filename?: string) {
  const known: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr",
    "video/mp4": "mp4", "video/3gpp": "3gp", "application/pdf": "pdf",
  };
  if (known[mime]) return known[mime];
  const fromName = /\.([a-z0-9]{1,8})$/i.exec(String(filename || ""));
  return fromName ? fromName[1].toLowerCase() : "bin";
}

// Whatever goes wrong inside, the app gets an answer it can read: an
// exception that escaped would leave the gateway's bare 500, which has no
// CORS header, and the browser reports only "Failed to send a request".
Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("wa-send: unhandled", e);
    return json({ error: `The server stumbled: ${(e as Error)?.message || String(e)}` }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return json({}, 200);
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
  const shopId = String(body.shopId ?? "");
  const action = String(body.action ?? "");
  if (!shopId) return json({ error: "shopId is required" }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  // Bound to the caller's own JWT, so is_shop_member reflects them.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: isMember, error: memberErr } = await callerClient.rpc("is_shop_member", { p_shop_id: shopId });
  if (memberErr) return json({ error: memberErr.message, stage: "is_shop_member" }, 500);
  if (!isMember) return json({ error: "Not a member of this shop" }, 403);

  // Who on the team is sending: their user id and the name the team
  // knows them by (their staff row, else "Owner" for the shop's admin).
  // Stamped on every message this function records (0118), so a thread
  // shows who told the customer what. Asked once, only by a send.
  let senderCache: { sent_by: string | null; sent_by_name: string | null } | null = null;
  async function sender() {
    if (senderCache) return senderCache;
    const { data: who } = await callerClient.auth.getUser();
    const u = who?.user ?? null;
    let name: string | null = null;
    if (u) {
      const { data: st } = await admin.from("staff").select("name")
        .eq("shop_id", shopId).eq("user_id", u.id).limit(1).maybeSingle();
      name = (st && st.name) ? String(st.name) : null;
      if (!name) {
        const { data: isAdm } = await callerClient.rpc("is_shop_admin", { p_shop_id: shopId });
        name = isAdm ? "Owner" : (u.email ? String(u.email).split("@")[0] : null);
      }
    }
    senderCache = { sent_by: u ? u.id : null, sent_by_name: name };
    return senderCache;
  }
  // A message's record, with who sent it. A database that has not had
  // 0118 yet has no such columns: the record is written without them
  // rather than lost, because the message has already gone.
  // deno-lint-ignore no-explicit-any
  async function recordOut(row: Record<string, any>) {
    const { error } = await admin.from("wa_messages").insert({ ...row, ...(await sender()) });
    if (error && /sent_by/.test(error.message || "")) return await admin.from("wa_messages").insert(row);
    return { error };
  }

  // Replying in a chat is any member's work -- a Sales login answers
  // customers all day. Everything else here speaks for the whole shop or
  // rewires it (a broadcast to every customer, re-registering the number,
  // the catalogue, templates), and is the owner's. Asked with
  // is_shop_admin, which every database has had since 0001, so this
  // never depends on a later migration having been pasted.
  const REPLY_ACTIONS = ["status", "send", "send-image", "send-catalog", "send-reply-template", "media"];
  if (!REPLY_ACTIONS.includes(action)) {
    const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_shop_admin", { p_shop_id: shopId });
    if (adminErr) return json({ error: adminErr.message, stage: "is_shop_admin" }, 500);
    if (!isAdmin) return json({ error: "Only the owner can do this — replies are open to the team, the rest is the owner's" }, 403);
  }

  const { data: numRow } = await admin.from("wa_numbers")
    .select("phone_number_id, catalog_id, waba_id").eq("shop_id", shopId).maybeSingle();

  if (action === "status") {
    return json({
      configured: !!ACCESS_TOKEN && !!numRow,
      hasToken: !!ACCESS_TOKEN,
      hasNumber: !!numRow,
    });
  }

  // Registers the shop's saved number with the Cloud API -- the same
  // thing the dashboard's flaky "Register" button does, except Meta's
  // REAL error comes back instead of "Registration failed. Please try
  // again." Registration requires a two-step PIN; one is minted on first
  // use and kept on the wa_numbers row, because the same PIN is required
  // for any future re-registration and losing it strands the number.
  if (action === "register") {
    if (!ACCESS_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN is not set yet" }, 409);
    if (!numRow) return json({ error: "Save the Phone number ID first" }, 400);
    const { data: pinRow } = await admin.from("wa_numbers")
      .select("pin").eq("phone_number_id", numRow.phone_number_id).maybeSingle();
    const pin = (pinRow && pinRow.pin) || String(Math.floor(100000 + Math.random() * 900000));
    const resp = await fetch(`${GRAPH_BASE}/${numRow.phone_number_id}/register`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = (result as { error?: { message?: string; error_data?: { details?: string } } })?.error;
      console.error("wa-send: register failed", resp.status, result);
      return json({
        error: err?.error_data?.details || err?.message || `Graph API error ${resp.status}`,
      }, 502);
    }
    // Persist the PIN only once registration has accepted it.
    const { error: pinErr } = await admin.from("wa_numbers")
      .update({ pin }).eq("phone_number_id", numRow.phone_number_id);
    if (pinErr) console.error("wa-send: pin save failed AFTER registration", pinErr);
    return json({ registered: true });
  }

  // Asks Meta what the saved Phone number ID actually IS -- which
  // display number it belongs to and what state Meta thinks it is in.
  // Exists because a shop can end up holding an ID from a deleted
  // setup, and "which number am I actually connected to?" should be
  // answerable from the app instead of by archaeology in two dashboards.
  if (action === "diagnose") {
    if (!ACCESS_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN is not set yet" }, 409);
    if (!numRow) return json({ error: "Save the Phone number ID first" }, 400);
    const resp = await fetch(
      `${GRAPH_BASE}/${numRow.phone_number_id}?fields=display_phone_number,verified_name,code_verification_status,platform_type,status,quality_rating`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const err = (result as { error?: { message?: string } })?.error;
      return json({ error: err?.message || `Graph API error ${resp.status}` }, 502);
    }
    return json({ number: result });
  }

  // The last link nothing else verifies: an app only receives a WABA's
  // events if it is SUBSCRIBED TO THAT WABA -- separate from the
  // app-level webhook field config, and silently absent after a WABA is
  // deleted and remade. Reads the current state, then subscribes.
  if (action === "subscribe-app") {
    const wabaId = String(body.wabaId ?? "").trim();
    if (!ACCESS_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN is not set yet" }, 409);
    if (!wabaId) return json({ error: "wabaId is required" }, 400);
    const headers = { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` };
    const beforeResp = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, { headers });
    const before = await beforeResp.json().catch(() => ({}));
    if (!beforeResp.ok) {
      const err = (before as { error?: { message?: string } })?.error;
      return json({ error: err?.message || `Graph API error ${beforeResp.status}` }, 502);
    }
    const subResp = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, { method: "POST", headers });
    const sub = await subResp.json().catch(() => ({}));
    if (!subResp.ok) {
      const err = (sub as { error?: { message?: string } })?.error;
      return json({ error: err?.message || `Graph API error ${subResp.status}`, before }, 502);
    }
    return json({ before, subscribed: sub });
  }

  // Walks every WhatsApp Business Account the business owns and lists
  // each one's numbers and subscribed apps -- because after enough
  // delete-and-retry cycles, "which WABA is my number actually in, and
  // is anyone listening to it?" is the question, and the dashboards
  // answer it one page at a time.
  if (action === "find-waba") {
    const businessId = String(body.businessId ?? "").trim();
    if (!ACCESS_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN is not set yet" }, 409);
    if (!businessId) return json({ error: "businessId is required" }, 400);
    const headers = { Authorization: `Bearer ${ACCESS_TOKEN}` };
    const wabasResp = await fetch(`${GRAPH_BASE}/${businessId}/owned_whatsapp_business_accounts?fields=id,name`, { headers });
    const wabas = await wabasResp.json().catch(() => ({}));
    if (!wabasResp.ok) {
      const err = (wabas as { error?: { message?: string } })?.error;
      return json({ error: err?.message || `Graph API error ${wabasResp.status}` }, 502);
    }
    const out = [];
    for (const w of ((wabas as { data?: { id: string; name: string }[] }).data ?? [])) {
      const numsResp = await fetch(`${GRAPH_BASE}/${w.id}/phone_numbers?fields=id,display_phone_number,status`, { headers });
      const nums = await numsResp.json().catch(() => ({}));
      const subsResp = await fetch(`${GRAPH_BASE}/${w.id}/subscribed_apps`, { headers });
      const subs = await subsResp.json().catch(() => ({}));
      out.push({ waba: w, numbers: (nums as { data?: unknown[] }).data ?? nums, subscribedApps: (subs as { data?: unknown[] }).data ?? subs });
    }
    return json({ accounts: out });
  }

  // Asks the token itself which WABAs it can touch (debug_token's
  // granular scopes), then inspects each -- works without the
  // business_management permission the business-node walk needs.
  if (action === "token-wabas") {
    if (!ACCESS_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN is not set yet" }, 409);
    const headers = { Authorization: `Bearer ${ACCESS_TOKEN}` };
    // With an explicit wabaId, skip discovery and inspect just that one.
    const oneWaba = String(body.wabaId ?? "").trim();
    if (oneWaba) {
      const numsResp = await fetch(`${GRAPH_BASE}/${oneWaba}/phone_numbers?fields=id,display_phone_number,status,platform_type`, { headers });
      const nums = await numsResp.json().catch(() => ({}));
      const subsResp = await fetch(`${GRAPH_BASE}/${oneWaba}/subscribed_apps`, { headers });
      const subs = await subsResp.json().catch(() => ({}));
      // The catalog link -- the thing WhatsApp Manager's "Connect
      // catalogue" flow writes, and the thing chats read to decide
      // whether to show the storefront icon.
      const catsResp = await fetch(`${GRAPH_BASE}/${oneWaba}/product_catalogs?fields=id,name`, { headers });
      const cats = await catsResp.json().catch(() => ({}));
      return json({ wabas: [{ wabaId: oneWaba,
        numbers: (nums as { data?: unknown[] }).data ?? nums,
        subscribedApps: (subs as { data?: unknown[] }).data ?? subs,
        productCatalogs: (cats as { data?: unknown[] }).data ?? cats }] });
    }
    const dbgResp = await fetch(`${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(ACCESS_TOKEN)}`, { headers });
    const dbg = await dbgResp.json().catch(() => ({}));
    if (!dbgResp.ok) {
      const err = (dbg as { error?: { message?: string } })?.error;
      return json({ error: err?.message || `Graph API error ${dbgResp.status}` }, 502);
    }
    const scopes = ((dbg as { data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] } }).data?.granular_scopes) ?? [];
    const ids = [...new Set(scopes.filter((s) => s.scope.startsWith("whatsapp_business"))
      .flatMap((s) => s.target_ids ?? []))];
    const out = [];
    for (const id of ids) {
      const numsResp = await fetch(`${GRAPH_BASE}/${id}/phone_numbers?fields=id,display_phone_number,status`, { headers });
      const nums = await numsResp.json().catch(() => ({}));
      const subsResp = await fetch(`${GRAPH_BASE}/${id}/subscribed_apps`, { headers });
      const subs = await subsResp.json().catch(() => ({}));
      out.push({ wabaId: id, numbers: (nums as { data?: unknown[] }).data ?? nums, subscribedApps: (subs as { data?: unknown[] }).data ?? subs });
    }
    return json({ wabas: out });
  }

  // Pushes the shop's sellable products into the Meta catalog connected
  // to the WABA. The client computes WHAT to sell (photo + retail price,
  // the same gates the daily picks use, priced by the same rules the
  // printed catalogue proves); this action only carries it to Meta.
  // Prices ride as feed-style strings ("203000 UGX") -- no cents
  // arithmetic to get wrong on a zero-decimal currency.
  if (action === "catalog-sync") {
    if (!ACCESS_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN is not set yet" }, 409);
    const catalogId = numRow?.catalog_id;
    if (!catalogId) return json({ error: "Save the Catalog ID first (Connection settings)" }, 400);
    const items = Array.isArray(body.items) ? body.items as {
      retailerId: string; name: string; price: number; imageUrl: string; description?: string;
    }[] : [];
    if (!items.length) return json({ error: "Nothing to sync — no product has both a photo and a retail price" }, 400);

    const headers = { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` };
    // Everything currently in the catalog, by retailer id.
    const existing: string[] = [];
    let url = `${GRAPH_BASE}/${catalogId}/products?fields=retailer_id&limit=100`;
    for (let page = 0; page < 50 && url; page++) {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // deno-lint-ignore no-explicit-any
        const err = (result as any)?.error;
        return json({ error: err?.message || `Graph API error ${resp.status}`, stage: "list" }, 502);
      }
      // deno-lint-ignore no-explicit-any
      for (const p of ((result as any).data ?? [])) if (p.retailer_id) existing.push(String(p.retailer_id));
      // deno-lint-ignore no-explicit-any
      url = (result as any).paging?.next ?? "";
    }

    const { toDelete } = catalogDiff(existing, items);
    // deno-lint-ignore no-explicit-any
    const requests: any[] = [
      ...items.map((it) => ({
        method: "UPDATE",
        data: {
          id: it.retailerId,
          title: it.name,
          description: it.description || it.name,
          availability: "in stock",
          condition: "new",
          price: `${Math.round(it.price)} UGX`,
          link: "https://omni-ware.vercel.app/catalogue.html",
          image_link: it.imageUrl,
          brand: "Omni-ware",
        },
      })),
      ...toDelete.map((id) => ({ method: "DELETE", data: { id } })),
    ];

    let sent = 0;
    for (let i = 0; i < requests.length; i += 100) {
      const chunk = requests.slice(i, i + 100);
      const resp = await fetch(`${GRAPH_BASE}/${catalogId}/items_batch`, {
        method: "POST", headers,
        body: JSON.stringify({ item_type: "PRODUCT_ITEM", requests: chunk }),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // deno-lint-ignore no-explicit-any
        const err = (result as any)?.error;
        console.error("wa-send: items_batch failed", resp.status, result);
        return json({
          error: err?.message || `Graph API error ${resp.status}`,
          stage: "batch", pushedBeforeFailure: sent,
        }, 502);
      }
      sent += chunk.length;
    }
    return json({ pushed: items.length, removed: toDelete.length });
  }

  // Pushes the catalog INTO the chat as an interactive card -- the
  // customer browses and carts from it immediately, whether or not the
  // storefront icon has propagated to their phone yet. Same rules as a
  // text reply: member-authed above, window-checked here.
  if (action === "send-catalog") {
    const conversationId = Number(body.conversationId);
    if (!conversationId) return json({ error: "conversationId is required" }, 400);
    if (!ACCESS_TOKEN || !numRow) return json({ error: "WhatsApp is not connected yet" }, 409);
    const { data: conv, error: convErr } = await admin.from("wa_conversations")
      .select("id, wa_id, last_inbound_at").eq("id", conversationId).eq("shop_id", shopId).maybeSingle();
    if (convErr) return json({ error: convErr.message, stage: "conversation" }, 500);
    if (!conv) return json({ error: "Conversation not found" }, 404);
    const win = windowState(conv.last_inbound_at, Date.now());
    if (!win.open) {
      return json({
        error: "The 24-hour reply window is closed — the customer has to message first.",
        windowClosed: true,
      }, 403);
    }
    const headers = { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` };

    // The number's commerce settings gate BOTH the storefront icon and
    // catalog messages -- and default to off on a fresh Cloud API
    // number. Idempotent, so it is simply ensured on every send.
    const csResp = await fetch(
      `${GRAPH_BASE}/${numRow.phone_number_id}/whatsapp_commerce_settings?is_cart_enabled=true&is_catalog_visible=true`,
      { method: "POST", headers });
    if (!csResp.ok) {
      const cs = await csResp.json().catch(() => ({}));
      console.error("wa-send: commerce settings update failed", csResp.status, cs);
    }

    // The card wants a thumbnail product; the first item of the shop's
    // own catalog serves.
    let thumbId = "";
    if (numRow.catalog_id) {
      const listResp = await fetch(
        `${GRAPH_BASE}/${numRow.catalog_id}/products?fields=retailer_id&limit=10`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
      const list = await listResp.json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const first = ((list as any).data ?? [])[0];
      if (first?.retailer_id) thumbId = String(first.retailer_id);
    }

    const catText = "Browse our catalogue and add what you need to the cart 🛒";
    const send = (payload: unknown) => fetch(`${GRAPH_BASE}/${numRow.phone_number_id}/messages`, {
      method: "POST", headers, body: JSON.stringify(payload),
    });
    let resp = await send({
      messaging_product: "whatsapp",
      to: conv.wa_id,
      type: "interactive",
      interactive: {
        type: "catalog_message",
        body: { text: catText },
        action: {
          name: "catalog_message",
          ...(thumbId ? { parameters: { thumbnail_product_retailer_id: thumbId } } : {}),
        },
      },
    });
    let result = await resp.json().catch(() => ({}));
    if (!resp.ok && numRow.catalog_id && thumbId) {
      // Some numbers reject catalog_message but accept an explicit
      // product list -- same shop window, named items.
      console.error("wa-send: catalog_message refused, retrying as product_list", resp.status, result);
      const listResp2 = await fetch(
        `${GRAPH_BASE}/${numRow.catalog_id}/products?fields=retailer_id,name&limit=10`,
        { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
      const list2 = await listResp2.json().catch(() => ({}));
      // deno-lint-ignore no-explicit-any
      const prods = ((list2 as any).data ?? []) as { retailer_id: string }[];
      resp = await send({
        messaging_product: "whatsapp",
        to: conv.wa_id,
        type: "interactive",
        interactive: {
          type: "product_list",
          header: { type: "text", text: "Our products" },
          body: { text: catText },
          action: {
            catalog_id: numRow.catalog_id,
            sections: [{
              title: "Available now",
              product_items: prods.map((pr) => ({ product_retailer_id: pr.retailer_id })),
            }],
          },
        },
      });
      result = await resp.json().catch(() => ({}));
    }
    if (!resp.ok) {
      // deno-lint-ignore no-explicit-any
      const err = (result as any)?.error;
      console.error("wa-send: catalog message failed", resp.status, result);
      return json({ error: err?.message || `Graph API error ${resp.status}` }, 502);
    }
    // deno-lint-ignore no-explicit-any
    const wamid = String((result as any)?.messages?.[0]?.id ?? "");
    const now = new Date().toISOString();
    const { error: insErr } = await recordOut({
      shop_id: shopId, conversation_id: conv.id, wamid: wamid || `local:${crypto.randomUUID()}`,
      direction: "out", msg_type: "interactive", body: "[catalog] " + catText,
      status: "sent", sent_at: now,
    });
    if (insErr) console.error("wa-send: catalog message record failed AFTER delivery", insErr);
    await admin.from("wa_conversations").update({ last_message_at: now }).eq("id", conv.id);
    return json({ sent: true, wamid });
  }

  // ---- Phase 5: the marketing template and the broadcast. ----
  // Business-initiated messages outside a customer's 24h window only
  // travel as pre-approved TEMPLATES. The app owns one: shop_update,
  // "{{1}}" being the campaign text -- created here, approved by Meta
  // (usually minutes), and refused for sending until it is.
  const TEMPLATE_NAME = "shop_update";

  if (action === "template-ensure") {
    if (!ACCESS_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN is not set yet" }, 409);
    const wabaId = numRow?.waba_id;
    if (!wabaId) return json({ error: "Save the WhatsApp Business Account ID first" }, 400);
    const headers = { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` };
    const listResp = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates?name=${TEMPLATE_NAME}`, { headers });
    const list = await listResp.json().catch(() => ({}));
    if (!listResp.ok) {
      // deno-lint-ignore no-explicit-any
      const err = (list as any)?.error;
      return json({ error: err?.message || `Graph API error ${listResp.status}` }, 502);
    }
    // deno-lint-ignore no-explicit-any
    const existing = ((list as any).data ?? []).find((t: any) => t.name === TEMPLATE_NAME);
    if (existing) return json({ status: existing.status, existed: true });
    const createResp = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates`, {
      method: "POST", headers,
      body: JSON.stringify({
        name: TEMPLATE_NAME,
        category: "MARKETING",
        language: "en",
        components: [
          // Meta's template grammar: a variable may not START or END the
          // body -- learned from the live rejection, so the text closes
          // after the variable.
          { type: "BODY", text: "Hello! News from our shop: {{1}}. Reply here to order anytime.", example: { body_text: [["Simba Cement now UGX 43,000 per bag this week"]] } },
          { type: "FOOTER", text: "Reply STOP to opt out of promotions" },
        ],
      }),
    });
    const created = await createResp.json().catch(() => ({}));
    if (!createResp.ok) {
      // deno-lint-ignore no-explicit-any
      const err = (created as any)?.error;
      return json({ error: err?.error_user_msg || err?.message || `Graph API error ${createResp.status}` }, 502);
    }
    // deno-lint-ignore no-explicit-any
    return json({ status: (created as any).status || "PENDING", existed: false });
  }

  if (action === "template-status") {
    if (!ACCESS_TOKEN) return json({ error: "WHATSAPP_ACCESS_TOKEN is not set yet" }, 409);
    const wabaId = numRow?.waba_id;
    if (!wabaId) return json({ error: "Save the WhatsApp Business Account ID first" }, 400);
    const resp = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates?name=${TEMPLATE_NAME}`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      // deno-lint-ignore no-explicit-any
      const err = (result as any)?.error;
      return json({ error: err?.message || `Graph API error ${resp.status}` }, 502);
    }
    // deno-lint-ignore no-explicit-any
    const tpl = ((result as any).data ?? []).find((t: any) => t.name === TEMPLATE_NAME);
    return json({ status: tpl ? tpl.status : "MISSING" });
  }

  if (action === "broadcast") {
    const text = String(body.text ?? "").trim();
    if (!text) return json({ error: "text is required" }, 400);
    if (!ACCESS_TOKEN || !numRow) return json({ error: "WhatsApp is not connected yet" }, 409);
    const wabaId = numRow.waba_id;
    if (!wabaId) return json({ error: "Save the WhatsApp Business Account ID first" }, 400);

    // The template must be APPROVED -- Meta rejects sends otherwise,
    // and a campaign that half-fails is worse than one that waits.
    const tplResp = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates?name=${TEMPLATE_NAME}`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
    const tplList = await tplResp.json().catch(() => ({}));
    // deno-lint-ignore no-explicit-any
    const tpl = ((tplList as any).data ?? []).find((t: any) => t.name === TEMPLATE_NAME);
    if (!tpl || tpl.status !== "APPROVED") {
      return json({ error: `The message template is ${tpl ? tpl.status : "missing"} — it must be APPROVED before broadcasts can go out.` }, 409);
    }

    // The audience: everyone who has messaged the shop, minus everyone
    // who said STOP. Consent by existing relationship, exit by one word.
    const { data: convs, error: convErr } = await admin.from("wa_conversations")
      .select("id, wa_id").eq("shop_id", shopId).eq("opt_out", false);
    if (convErr) return json({ error: convErr.message, stage: "audience" }, 500);
    const audience = convs ?? [];
    if (!audience.length) return json({ error: "Nobody to send to — the audience is empty" }, 400);

    const { data: campaign, error: campErr } = await admin.from("wa_campaigns").insert({
      shop_id: shopId, template_name: TEMPLATE_NAME, body: text, recipients: audience.length,
    }).select("id").single();
    if (campErr) return json({ error: campErr.message, stage: "campaign" }, 500);

    let sent = 0; const failures: string[] = [];
    for (const conv of audience) {
      const resp = await fetch(`${GRAPH_BASE}/${numRow.phone_number_id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: conv.wa_id,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: "en" },
            components: [{ type: "body", parameters: [{ type: "text", text }] }],
          },
        }),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        // deno-lint-ignore no-explicit-any
        const err = (result as any)?.error;
        failures.push(`${conv.wa_id}: ${err?.message || resp.status}`);
        continue;
      }
      // deno-lint-ignore no-explicit-any
      const wamid = String((result as any)?.messages?.[0]?.id ?? "");
      const now = new Date().toISOString();
      const { error } = await recordOut({
        shop_id: shopId, conversation_id: conv.id, wamid: wamid || `local:${crypto.randomUUID()}`,
        direction: "out", msg_type: "template", body: text, status: "sent", sent_at: now,
        // The campaign id rides the message, so sent/delivered/read per
        // campaign is a COUNT over messages -- derived, never stored.
        payload: { broadcast: campaign.id },
      });
      if (error) console.error("wa-send: broadcast record failed AFTER delivery", error);
      sent++;
    }
    return json({ campaignId: campaign.id, sent, failed: failures.length, failures: failures.slice(0, 5) });
  }

  if (action === "send") {
    const conversationId = Number(body.conversationId);
    const text = String(body.text ?? "").trim();
    if (!conversationId || !text) return json({ error: "conversationId and text are required" }, 400);
    if (!ACCESS_TOKEN || !numRow) return json({ error: "WhatsApp is not connected yet" }, 409);

    const { data: conv, error: convErr } = await admin.from("wa_conversations")
      .select("id, wa_id, last_inbound_at").eq("id", conversationId).eq("shop_id", shopId).maybeSingle();
    if (convErr) return json({ error: convErr.message, stage: "conversation" }, 500);
    if (!conv) return json({ error: "Conversation not found" }, 404);

    const win = windowState(conv.last_inbound_at, Date.now());
    if (!win.open) {
      return json({
        error: "The 24-hour reply window is closed — the customer has to message first.",
        windowClosed: true,
      }, 403);
    }

    const resp = await fetch(`${GRAPH_BASE}/${numRow.phone_number_id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conv.wa_id,
        type: "text",
        text: { body: text },
      }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("wa-send: graph call failed", resp.status, result);
      const msg = (result as { error?: { message?: string } })?.error?.message || `Graph API error ${resp.status}`;
      return json({ error: msg }, 502);
    }
    const wamid = String((result as { messages?: { id?: string }[] })?.messages?.[0]?.id ?? "");
    const now = new Date().toISOString();

    // Record what was sent. If this insert fails the message HAS still
    // gone to the customer -- say so loudly rather than pretending the
    // send failed, or the shop would send it twice.
    const { error: insErr } = await recordOut({
      shop_id: shopId, conversation_id: conv.id, wamid: wamid || `local:${crypto.randomUUID()}`,
      direction: "out", msg_type: "text", body: text, status: "sent", sent_at: now,
    });
    if (insErr) console.error("wa-send: message record failed AFTER delivery", insErr);
    const { error: updErr } = await admin.from("wa_conversations")
      .update({ last_message_at: now }).eq("id", conv.id);
    if (updErr) console.error("wa-send: conversation bump failed", updErr);

    return json({ sent: true, wamid, recorded: !insErr });
  }

  // The send action's sibling for the order receipt: same membership
  // auth above, same window law, but the payload is an image Meta
  // fetches from a public link (the receipt PNG the client rendered
  // and uploaded). Kept a separate action so an older client that has
  // never heard of images cannot reach it by accident.
  if (action === "send-image") {
    const conversationId = Number(body.conversationId);
    const link = String(body.link ?? "").trim();
    const caption = String(body.caption ?? "").trim();
    if (!conversationId || !link) return json({ error: "conversationId and link are required" }, 400);
    // Meta fetches this URL itself and requires https; refusing anything
    // else here keeps a garbled caller from burning the send on a link
    // that can only fail downstream.
    if (!/^https:\/\//.test(link)) return json({ error: "link must be an https URL" }, 400);
    if (!ACCESS_TOKEN || !numRow) return json({ error: "WhatsApp is not connected yet" }, 409);

    const { data: conv, error: convErr } = await admin.from("wa_conversations")
      .select("id, wa_id, last_inbound_at").eq("id", conversationId).eq("shop_id", shopId).maybeSingle();
    if (convErr) return json({ error: convErr.message, stage: "conversation" }, 500);
    if (!conv) return json({ error: "Conversation not found" }, 404);

    const win = windowState(conv.last_inbound_at, Date.now());
    if (!win.open) {
      return json({
        error: "The 24-hour reply window is closed — the customer has to message first.",
        windowClosed: true,
      }, 403);
    }

    const resp = await fetch(`${GRAPH_BASE}/${numRow.phone_number_id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conv.wa_id,
        type: "image",
        image: caption ? { link, caption } : { link },
      }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("wa-send: graph call failed", resp.status, result);
      const msg = (result as { error?: { message?: string } })?.error?.message || `Graph API error ${resp.status}`;
      return json({ error: msg }, 502);
    }
    const wamid = String((result as { messages?: { id?: string }[] })?.messages?.[0]?.id ?? "");
    const now = new Date().toISOString();

    // Recorded the way wa-webhook records inbound media — msg_type
    // "image", the caption behind the same "[image]" marker — so the
    // thread bubbles and snippets render it with code they already
    // have. If this insert fails the image HAS still reached the
    // customer; say so rather than pretending the send failed.
    const { error: insErr } = await recordOut({
      shop_id: shopId, conversation_id: conv.id, wamid: wamid || `local:${crypto.randomUUID()}`,
      direction: "out", msg_type: "image", body: caption ? "[image] " + caption : "[image]",
      status: "sent", sent_at: now, payload: { link },
    });
    if (insErr) console.error("wa-send: image record failed AFTER delivery", insErr);
    const { error: updErr } = await admin.from("wa_conversations")
      .update({ last_message_at: now }).eq("id", conv.id);
    if (updErr) console.error("wa-send: conversation bump failed", updErr);

    return json({ sent: true, wamid, recorded: !insErr });
  }

  // ---- Replying after the window has shut. ----
  // A free-form reply is refused once the customer's last message is a
  // day old, and a salesperson is left holding an answer they cannot
  // give. The one road Meta leaves open is an approved template, so the
  // app owns a plain one -- shop_reply, a UTILITY message that carries
  // the salesperson's own words in {{2}}. It is ensured here, by any
  // member, because its text is fixed in this file: there is nothing for
  // a member to choose. Until Meta approves it the send says so, and
  // never pretends to have gone. Someone who said STOP is not written to.
  const REPLY_TEMPLATE = "shop_reply";
  if (action === "send-reply-template") {
    const conversationId = Number(body.conversationId);
    const text = replyParam(String(body.text ?? ""));
    const name = replyParam(String(body.name ?? "")).slice(0, 40) || "there";
    if (!conversationId || !text) return json({ error: "conversationId and text are required" }, 400);
    if (!ACCESS_TOKEN || !numRow) return json({ error: "WhatsApp is not connected yet" }, 409);
    const wabaId = numRow.waba_id;
    if (!wabaId) return json({ error: "The owner has to save the WhatsApp Business Account ID first" }, 409);

    const { data: conv, error: convErr } = await admin.from("wa_conversations")
      .select("id, wa_id, opt_out").eq("id", conversationId).eq("shop_id", shopId).maybeSingle();
    if (convErr) return json({ error: convErr.message, stage: "conversation" }, 500);
    if (!conv) return json({ error: "Conversation not found" }, 404);
    if (conv.opt_out) return json({ error: "They asked the shop to stop messaging them" }, 403);

    const headers = { "content-type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` };
    const listResp = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates?name=${REPLY_TEMPLATE}`, { headers });
    const list = await listResp.json().catch(() => ({}));
    if (!listResp.ok) {
      // deno-lint-ignore no-explicit-any
      return json({ error: (list as any)?.error?.message || `Graph API error ${listResp.status}` }, 502);
    }
    // deno-lint-ignore no-explicit-any
    let tpl = ((list as any).data ?? []).find((t: any) => t.name === REPLY_TEMPLATE);
    if (!tpl) {
      const createResp = await fetch(`${GRAPH_BASE}/${wabaId}/message_templates`, {
        method: "POST", headers,
        body: JSON.stringify({
          name: REPLY_TEMPLATE,
          category: "UTILITY",
          language: "en",
          components: [
            // A variable may not start or end the body (see shop_update).
            { type: "BODY", text: "Hello {{1}}, this is our reply to your message: {{2}}. Reply here to carry on.",
              example: { body_text: [["Kato", "Yes, 40 iron sheets G28 are in stock at 33,000 each"]] } },
          ],
        }),
      });
      const created = await createResp.json().catch(() => ({}));
      if (!createResp.ok) {
        // deno-lint-ignore no-explicit-any
        const err = (created as any)?.error;
        return json({ error: err?.error_user_msg || err?.message || `Graph API error ${createResp.status}` }, 502);
      }
      // deno-lint-ignore no-explicit-any
      tpl = { status: (created as any).status || "PENDING" };
    }
    if (tpl.status !== "APPROVED") {
      return json({
        error: tpl.status === "REJECTED"
          ? "WhatsApp turned down the shop's reply message — the owner can see why in Meta's WhatsApp Manager"
          : "WhatsApp is still approving the shop's reply message — usually a few minutes. Try again shortly.",
        templateStatus: tpl.status,
      }, 409);
    }

    const resp = await fetch(`${GRAPH_BASE}/${numRow.phone_number_id}/messages`, {
      method: "POST", headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conv.wa_id,
        type: "template",
        template: {
          name: REPLY_TEMPLATE,
          language: { code: "en" },
          components: [{ type: "body", parameters: [{ type: "text", text: name }, { type: "text", text }] }],
        },
      }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("wa-send: reply template failed", resp.status, result);
      // deno-lint-ignore no-explicit-any
      return json({ error: (result as any)?.error?.message || `Graph API error ${resp.status}` }, 502);
    }
    // deno-lint-ignore no-explicit-any
    const wamid = String((result as any)?.messages?.[0]?.id ?? "");
    const now = new Date().toISOString();
    const { error: insErr } = await recordOut({
      shop_id: shopId, conversation_id: conv.id, wamid: wamid || `local:${crypto.randomUUID()}`,
      direction: "out", msg_type: "template", body: text, status: "sent", sent_at: now,
      payload: { reply_template: REPLY_TEMPLATE },
    });
    if (insErr) console.error("wa-send: reply template record failed AFTER delivery", insErr);
    await admin.from("wa_conversations").update({ last_message_at: now }).eq("id", conv.id);
    return json({ sent: true, wamid, recorded: !insErr });
  }

  // ---- A customer's picture, voice note or document, to look at. ----
  // The webhook keeps Meta's media id, not the file, and the file sits
  // behind the access token, which never leaves this function. So the
  // first time anyone opens it, it is fetched from Meta (which keeps
  // media for a limited time only), put in the shop's image bucket under
  // an unguessable name, and the link is written onto the message --
  // every later look, in any app, is a plain link with no call here.
  // Only a message of this shop, and only a file a phone can hold.
  if (action === "media") {
    const messageId = Number(body.messageId);
    if (!messageId) return json({ error: "messageId is required" }, 400);
    const { data: msg, error: msgErr } = await admin.from("wa_messages")
      .select("id, msg_type, payload").eq("id", messageId).eq("shop_id", shopId).maybeSingle();
    if (msgErr) return json({ error: msgErr.message, stage: "message" }, 500);
    if (!msg) return json({ error: "Message not found" }, 404);
    // deno-lint-ignore no-explicit-any
    const p = (msg.payload ?? {}) as any;
    if (p.media_link) return json({ link: p.media_link, mime: p.media_mime || "" });
    const mediaId = p?.[msg.msg_type]?.id;
    if (!mediaId) return json({ error: "This message has no file" }, 404);
    if (!ACCESS_TOKEN) return json({ error: "WhatsApp is not connected yet" }, 409);
    const headers = { Authorization: `Bearer ${ACCESS_TOKEN}`, "User-Agent": "omni-ware/1.0" };
    const metaResp = await fetch(`${GRAPH_BASE}/${mediaId}`, { headers, signal: AbortSignal.timeout(15000) });
    const meta = await metaResp.json().catch(() => ({}));
    // deno-lint-ignore no-explicit-any
    const m = meta as any;
    if (!metaResp.ok || !m.url) return json({ error: m?.error?.message || "WhatsApp no longer has this file" }, 410);
    if (Number(m.file_size || 0) > MEDIA_MAX) return json({ error: "The file is too big to open here" }, 413);
    const fileResp = await fetch(m.url, { headers, signal: AbortSignal.timeout(30000) });
    if (!fileResp.ok) return json({ error: `WhatsApp refused the file (${fileResp.status})` }, 502);
    const buf = new Uint8Array(await fileResp.arrayBuffer());
    if (buf.length > MEDIA_MAX) return json({ error: "The file is too big to open here" }, 413);
    const mime = String(m.mime_type || fileResp.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
    const path = `${shopId}/wa-media/${crypto.randomUUID()}.${mediaExt(mime, p?.document?.filename)}`;
    const { error: upErr } = await admin.storage.from("product-images").upload(path, buf, { contentType: mime, upsert: false });
    if (upErr) return json({ error: upErr.message, stage: "storage" }, 500);
    const link = admin.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    const { error: updErr } = await admin.from("wa_messages")
      .update({ payload: { ...p, media_link: link, media_mime: mime } }).eq("id", msg.id).eq("shop_id", shopId);
    if (updErr) console.error("wa-send: media link not kept on the message", updErr);
    return json({ link, mime });
  }

  return json({ error: `Unknown action "${action}"` }, 400);
}
