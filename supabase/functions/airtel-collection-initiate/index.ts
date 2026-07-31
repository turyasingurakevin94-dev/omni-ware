// Starts an Airtel Money Collection (USSD Push) payment for a sales agent
// settling what they owe the shop for one of their own orders (see
// promptAgentPrepayment()/agentPrepayConfirm in index.html for the existing
// manual "confirm cash received" equivalent this replaces with a real
// mobile-money prompt). The customer -- here, the agent -- gets a prompt on
// their phone and approves/rejects it, so this call only ever returns
// "pending"; the real outcome lands later via airtel-collection-callback
// (see 0016_airtel_transactions.sql for the ledger row both functions
// share). Called directly from the agent app
// (sb.functions.invoke('airtel-collection-initiate', ...)).
//
// Agents are deliberately NOT shop_members (0012_sales_agents.sql), so
// authorization here mirrors agent-submit-order's current_agent_id() RPC
// rather than a shop-membership check.
//
// AIRTEL_ENV controls the sandbox vs production path: the Postman
// collection exported from the portal shows sandbox testing hits the SAME
// openapi.airtel.ug host as production, just with a "/simulate" prefix on
// the payment/enquiry/refund paths (not a separate openapiuat host, despite
// what the docs say) -- so this only toggles that prefix, not the host.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const AIRTEL_CLIENT_ID = Deno.env.get("AIRTEL_CLIENT_ID")!;
const AIRTEL_CLIENT_SECRET = Deno.env.get("AIRTEL_CLIENT_SECRET")!;
const IS_SANDBOX = (Deno.env.get("AIRTEL_ENV") || "sandbox") !== "production";

const AIRTEL_HOST = "https://openapi.airtel.ug";
const PAYMENTS_PATH = IS_SANDBOX ? "/simulate/merchant/v2/payments/" : "/merchant/v2/payments/";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

// What the agent owes the shop for this order -- same formula as
// promptAgentPrepayment() in index.html: sum of each line's real floor
// price (sellPrice), never the agent's own resale price to their client.
function amountOwed(quotePayload: any): number {
  const items = quotePayload?.items || [];
  return items.reduce((s: number, it: any) => s + (Number(it.sellPrice) || 0) * (Number(it.qty) || 0), 0);
}

/* ---------------- OAuth2 ----------------
   Access tokens are short-lived (expires_in, typically ~1h); cached at
   module scope the same way notify-worker caches its FCM token, so a warm
   function instance doesn't re-authenticate on every payment. */
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 30) return cachedToken.accessToken;

  const resp = await fetch(`${AIRTEL_HOST}/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "*/*" },
    body: JSON.stringify({
      client_id: AIRTEL_CLIENT_ID,
      client_secret: AIRTEL_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    throw new Error(`Airtel OAuth2 failed: ${resp.status} ${JSON.stringify(data)}`);
  }

  cachedToken = { accessToken: data.access_token, expiresAt: now + (Number(data.expires_in) || 3600) };
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { shopId, quoteId, msisdn, amount, reference } = body;
    if (!shopId || !quoteId) {
      return json({ error: "shopId and quoteId are required" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: agentId, error: agentIdErr } = await callerClient.rpc("current_agent_id", { p_shop_id: shopId });
    if (agentIdErr) return json({ error: agentIdErr.message, stage: "current_agent_id" }, 500);
    if (!agentId) return json({ error: "Not an agent of this shop" }, 403);

    const { data: agent, error: agentErr } = await admin
      .from("agents")
      .select("phone")
      .eq("shop_id", shopId)
      .eq("id", agentId)
      .maybeSingle();
    if (agentErr) return json({ error: agentErr.message, stage: "agent_lookup" }, 500);

    const { data: quote, error: quoteErr } = await admin
      .from("saved_quotes")
      .select("payload")
      .eq("id", quoteId)
      .eq("shop_id", shopId)
      .maybeSingle();
    if (quoteErr) return json({ error: quoteErr.message, stage: "quote_lookup" }, 500);
    if (!quote || quote.payload?.originAgentId !== agentId) {
      return json({ error: "That order doesn't belong to this agent" }, 403);
    }
    if (quote.payload?.agentPaymentStatus === "paid") {
      return json({ error: "This order is already paid" }, 409);
    }

    const owed = amountOwed(quote.payload);
    const payAmount = Number(amount) > 0 ? Number(amount) : owed;
    if (!(payAmount > 0)) return json({ error: "Nothing owed on this order" }, 400);

    const rawMsisdn = msisdn || agent?.phone;
    if (!rawMsisdn) return json({ error: "No msisdn on file for this agent -- pass one explicitly" }, 400);
    // Airtel's docs: "Do not send country code in msisdn."
    const cleanMsisdn = String(rawMsisdn).replace(/^\+?256/, "").replace(/\D/g, "");
    if (!cleanMsisdn) return json({ error: "Invalid msisdn" }, 400);

    const txnRef = crypto.randomUUID().replace(/-/g, "");
    const { error: insertErr } = await admin.from("airtel_transactions").insert({
      shop_id: shopId,
      quote_id: quoteId,
      reference: txnRef,
      status: "pending",
      amount: payAmount,
      msisdn: cleanMsisdn,
    });
    if (insertErr) return json({ error: insertErr.message, stage: "ledger_insert" }, 500);

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (e) {
      await admin.from("airtel_transactions").update({ status: "failed", raw_callback: { error: String(e) } }).eq("reference", txnRef);
      console.error("airtel-collection-initiate: auth failed", e);
      return json({ error: "Could not authenticate with Airtel" }, 502);
    }

    const airtelResp = await fetch(`${AIRTEL_HOST}${PAYMENTS_PATH}`, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        "X-Country": "UG",
        "X-Currency": "UGX",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        reference: reference || `Agent order ${quoteId}`,
        subscriber: { country: "UG", currency: "UGX", msisdn: cleanMsisdn },
        transaction: { amount: String(payAmount), country: "UG", currency: "UGX", id: txnRef },
      }),
    });
    const airtelData = await airtelResp.json().catch(() => ({}));
    console.log("airtel-collection-initiate: payment request sent", { reference: txnRef, httpStatus: airtelResp.status, airtelData });

    if (!airtelResp.ok || airtelData?.status?.success === false) {
      await admin
        .from("airtel_transactions")
        .update({ status: "failed", raw_callback: airtelData })
        .eq("reference", txnRef);
      return json({ error: airtelData?.status?.message || "Airtel rejected the payment request", airtelData }, 502);
    }

    return json({ ok: true, reference: txnRef, status: "pending", amount: payAmount, message: "USSD push sent — awaiting agent approval" });
  } catch (err) {
    console.error("airtel-collection-initiate: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
