// The ONLY public, unauthenticated Edge Function in this app. Every other
// function requires an agent/admin session; this one is deliberately
// reachable by anyone with a link, because that's the entire point of a
// shareable catalogue. Treat every input here as hostile.
//
// This is a catalogue, not a storefront: "get" returns product names and
// images, never a price, and there is no "buy"/checkout action anywhere
// in this file -- "inquire" only ever records a request for the AGENT to
// follow up on personally. That split is structural, not just a UI
// choice upstream: there is no code path here that could total an order
// or move money, so there's nothing for a future change to accidentally
// wire a checkout button into.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS_HEADERS } });
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const { action, slug } = body;
    if (!action || !slug || typeof slug !== "string" || !SLUG_RE.test(slug)) {
      return json({ error: "A valid slug is required" }, 400);
    }

    const { data: catalogue, error: catErr } = await admin
      .from("catalogues").select("shop_id, agent_id, headline").eq("slug", slug).maybeSingle();
    if (catErr) return json({ error: catErr.message, stage: "catalogue_lookup" }, 500);
    if (!catalogue) return json({ error: "This catalogue link isn't valid" }, 404);

    const { data: agent, error: agentErr } = await admin
      .from("agents").select("name, phone").eq("shop_id", catalogue.shop_id).eq("id", catalogue.agent_id).maybeSingle();
    if (agentErr) return json({ error: agentErr.message, stage: "agent_lookup" }, 500);
    if (!agent) return json({ error: "This catalogue link isn't valid" }, 404);

    if (action === "get") {
      // Name, image, category only -- deliberately the same "never a
      // price, never a supplier" boundary agent-catalog enforces for
      // logged-in agents, just one notch stricter here since this
      // response goes to a stranger with no session at all.
      const { data: products, error: productsErr } = await admin
        .from("products").select("id, name, image, category, variants")
        .eq("shop_id", catalogue.shop_id);
      if (productsErr) return json({ error: productsErr.message, stage: "products_list" }, 500);

      const items = (products || []).flatMap((p: any) => {
        const variantCount = Array.isArray(p.variants) ? p.variants.length : 0;
        if (variantCount === 0) return [{ productId: p.id, variantIdx: null, name: p.name, image: p.image || null, category: p.category || "" }];
        return p.variants.map((v: any, i: number) => ({
          productId: p.id, variantIdx: i,
          name: p.name,
          variantLabel: Object.values(v.combo || {}).join(" / "),
          image: p.image || null, category: p.category || "",
        }));
      });

      return json({
        ok: true,
        agentName: agent.name,
        agentPhone: agent.phone || null,
        headline: catalogue.headline || null,
        items,
      });
    }

    if (action === "inquire") {
      const customerName = String(body.customerName || "").trim().slice(0, 120);
      const customerPhone = String(body.customerPhone || "").trim().slice(0, 40);
      const message = body.message ? String(body.message).trim().slice(0, 500) : null;
      const productId = body.productId ? String(body.productId).slice(0, 120) : null;
      const variantIdx = body.variantIdx != null ? String(body.variantIdx).slice(0, 20) : null;
      if (!customerName || !customerPhone) return json({ error: "Name and phone are required" }, 400);

      // A catalogue inquiry becomes a real lead the agent can immediately
      // call back -- not a form they have to remember to copy into their
      // own client list by hand. Reuses an existing client by phone
      // number rather than inserting a fresh row every time, so a
      // customer who submits two inquiries doesn't clutter the agent's
      // list with duplicates of themselves. Best-effort throughout: if
      // any of this fails, the inquiry itself still gets recorded below.
      let agentClientId: number | null = null;
      const { data: existingClient } = await admin
        .from("agent_clients")
        .select("id").eq("shop_id", catalogue.shop_id).eq("agent_id", catalogue.agent_id).eq("phone", customerPhone)
        .maybeSingle();
      if (existingClient) {
        agentClientId = existingClient.id;
      } else {
        const { data: clientRow, error: clientErr } = await admin
          .from("agent_clients")
          .insert({ shop_id: catalogue.shop_id, agent_id: catalogue.agent_id, name: customerName, phone: customerPhone })
          .select("id").single();
        if (!clientErr && clientRow) agentClientId = clientRow.id;
      }

      const { error: insertErr } = await admin.from("catalogue_inquiries").insert({
        shop_id: catalogue.shop_id, agent_id: catalogue.agent_id,
        product_id: productId, variant_idx: variantIdx,
        customer_name: customerName, customer_phone: customerPhone, message,
        agent_client_id: agentClientId,
      });
      if (insertErr) return json({ error: insertErr.message, stage: "inquiry_insert" }, 500);

      return json({ ok: true, agentName: agent.name, agentPhone: agent.phone || null });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("catalogue-public: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
