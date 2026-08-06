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

Deno.serve(async (req) => {
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

  const { data: numRow } = await admin.from("wa_numbers")
    .select("phone_number_id").eq("shop_id", shopId).maybeSingle();

  if (action === "status") {
    return json({
      configured: !!ACCESS_TOKEN && !!numRow,
      hasToken: !!ACCESS_TOKEN,
      hasNumber: !!numRow,
    });
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
    const { error: insErr } = await admin.from("wa_messages").insert({
      shop_id: shopId, conversation_id: conv.id, wamid: wamid || `local:${crypto.randomUUID()}`,
      direction: "out", msg_type: "text", body: text, status: "sent", sent_at: now,
    });
    if (insErr) console.error("wa-send: message record failed AFTER delivery", insErr);
    const { error: updErr } = await admin.from("wa_conversations")
      .update({ last_message_at: now }).eq("id", conv.id);
    if (updErr) console.error("wa-send: conversation bump failed", updErr);

    return json({ sent: true, wamid, recorded: !insErr });
  }

  return json({ error: `Unknown action "${action}"` }, 400);
});
