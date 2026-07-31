// Starts a real MTN Mobile Money / Airtel Money "request to pay" push to
// an agent's phone for a specific order, so the shop doesn't have to take
// the agent's word for a cash handoff (see agentPrepayModal/
// promptAgentPrepayment in index.html -- that manual-confirm path is
// unchanged and stays as the fallback for agents who pay cash).
//
// The owed amount is always recomputed here from the order's own items
// (same reasoning as agent-claim-commission's bonus recompute) -- never
// trusted from the client, so a tampered request can't under- or
// over-charge. v1 is exact-amount-only, matching the prepay gate's
// existing binary paid/unpaid semantics: this always charges the order's
// full total, never a partial top-up.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

// --- MTN MoMo (Collections) -------------------------------------------
// https://momodeveloper.mtn.com -- Collections product, requesttopay.
// MTN's sandbox gateway sits behind a WAF that occasionally rejects
// requests with a generic "Request Rejected... consult your
// administrator" HTML page instead of a real API response -- observed
// in practice to correlate with Deno's fetch() sending no User-Agent at
// all, which some WAF rulesets treat as non-browser/bot traffic on this
// endpoint specifically (the token endpoint doesn't seem to trigger it).
// A normal-looking User-Agent + Accept header is the standard fix for
// this class of false positive.
const MTN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; omni-ware/1.0; +https://omni-ware.example)",
  "Accept": "application/json",
};
// A WAF block page is HTML, not the JSON MTN's API actually returns --
// surface that distinction instead of dumping a wall of HTML into an
// error a shop owner has to read.
function describeMtnFailure(status: number, text: string) {
  if (/<html/i.test(text)) return `MTN's servers rejected the request (HTTP ${status}) -- this looks like a firewall block on MTN's side, not a real API error. Try again in a moment.`;
  return `MTN request failed (${status}): ${text}`;
}
async function mtnRequestToPay(creds: any, environment: string, opts: { referenceId: string; amount: number; phone: string; payerMessage: string; payeeNote: string }) {
  const base = environment === "production"
    ? "https://proxy.momoapi.mtn.com"
    : "https://sandbox.momodeveloper.mtn.com";
  const tokenRes = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: {
      ...MTN_HEADERS,
      "Ocp-Apim-Subscription-Key": creds.subscriptionKey,
      "Authorization": "Basic " + btoa(`${creds.apiUser}:${creds.apiKey}`),
    },
  });
  if (!tokenRes.ok) throw new Error(describeMtnFailure(tokenRes.status, await tokenRes.text()));
  const { access_token } = await tokenRes.json();

  const payRes = await fetch(`${base}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      ...MTN_HEADERS,
      "Authorization": `Bearer ${access_token}`,
      "X-Reference-Id": opts.referenceId,
      "X-Target-Environment": environment === "production" ? "mtnuganda" : "sandbox",
      "Ocp-Apim-Subscription-Key": creds.subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: String(Math.round(opts.amount)),
      currency: environment === "production" ? "UGX" : "EUR", // MTN sandbox only accepts EUR test amounts
      externalId: opts.referenceId,
      payer: { partyIdType: "MSISDN", partyId: opts.phone.replace(/^\+/, "") },
      payerMessage: opts.payerMessage,
      payeeNote: opts.payeeNote,
    }),
  });
  if (payRes.status !== 202) throw new Error(describeMtnFailure(payRes.status, await payRes.text()));
  return { accepted: true };
}

// --- Airtel Money (Collections / Merchant API) -------------------------
// https://developers.airtel.africa -- Collections, request-to-pay.
async function airtelRequestToPay(creds: any, environment: string, opts: { referenceId: string; amount: number; phone: string }) {
  const base = environment === "production"
    ? "https://openapiuat.airtel.africa" // swap for the production host once a shop goes live -- Airtel issues it at merchant onboarding
    : "https://openapiuat.airtel.africa";
  const tokenRes = await fetch(`${base}/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: "client_credentials" }),
  });
  if (!tokenRes.ok) throw new Error(`Airtel auth failed (${tokenRes.status}): ${await tokenRes.text()}`);
  const { access_token } = await tokenRes.json();

  const payRes = await fetch(`${base}/merchant/v1/payments/`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${access_token}`,
      "Content-Type": "application/json",
      "X-Country": "UG",
      "X-Currency": "UGX",
    },
    body: JSON.stringify({
      reference: opts.referenceId,
      subscriber: { country: "UG", currency: "UGX", msisdn: opts.phone.replace(/^\+?256/, "").replace(/^0/, "") },
      transaction: { amount: Math.round(opts.amount), country: "UG", currency: "UGX", id: opts.referenceId },
    }),
  });
  if (!payRes.ok) throw new Error(`Airtel payment request failed (${payRes.status}): ${await payRes.text()}`);
  const body = await payRes.json();
  return { providerTransactionId: body?.data?.transaction?.id || null };
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
    const { shopId, orderId, provider, phone } = body;
    if (!shopId || !orderId || !provider || !phone) {
      return json({ error: "shopId, orderId, provider and phone are required" }, 400);
    }
    if (provider !== "mtn" && provider !== "airtel") return json({ error: "provider must be 'mtn' or 'airtel'" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: agentId, error: agentIdErr } = await callerClient.rpc("current_agent_id", { p_shop_id: shopId });
    if (agentIdErr) return json({ error: agentIdErr.message, stage: "current_agent_id" }, 500);
    if (!agentId) return json({ error: "Not an agent of this shop" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: providerRow, error: providerErr } = await admin
      .from("shop_payment_providers").select("*")
      .eq("shop_id", shopId).eq("provider", provider).maybeSingle();
    if (providerErr) return json({ error: providerErr.message, stage: "provider_lookup" }, 500);
    if (!providerRow || !providerRow.enabled) return json({ error: `${provider} is not enabled for this shop` }, 400);

    const { data: order, error: orderErr } = await admin
      .from("saved_quotes").select("id, payload, amount_paid")
      .eq("shop_id", shopId).eq("id", orderId).maybeSingle();
    if (orderErr) return json({ error: orderErr.message, stage: "order_lookup" }, 500);
    if (!order) return json({ error: "Order not found" }, 404);
    const payload = order.payload || {};
    if (payload.originAgentId !== agentId) return json({ error: "This order does not belong to you" }, 403);
    if (payload.agentPaymentStatus === "paid") return json({ error: "This order is already paid" }, 400);

    const amount = (payload.items || []).reduce((s: number, it: any) => s + (Number(it.sellPrice) || 0) * (Number(it.qty) || 0), 0);
    if (!(amount > 0)) return json({ error: "Nothing owed on this order" }, 400);

    const externalReference = crypto.randomUUID();
    const { data: txnRow, error: insertErr } = await admin
      .from("agent_mobile_payments")
      .insert({
        shop_id: shopId, agent_id: agentId, order_id: orderId, provider, phone, amount,
        external_reference: externalReference, status: "pending",
      })
      .select().single();
    if (insertErr) return json({ error: insertErr.message, stage: "insert_pending" }, 500);

    try {
      if (provider === "mtn") {
        await mtnRequestToPay(providerRow.credentials, providerRow.environment, {
          referenceId: externalReference, amount, phone,
          // No "#" here -- MTN's sandbox WAF has been observed to block
          // requesttopay bodies containing it (a common generic-WAF false
          // positive, treating "#" as a comment/fragment-injection marker).
          payerMessage: `Order ${orderId}`, payeeNote: `Agent payment order ${orderId}`,
        });
      } else {
        const res = await airtelRequestToPay(providerRow.credentials, providerRow.environment, {
          referenceId: externalReference, amount, phone,
        });
        if (res.providerTransactionId) {
          await admin.from("agent_mobile_payments").update({ provider_transaction_id: res.providerTransactionId }).eq("id", txnRow.id);
        }
      }
    } catch (err) {
      await admin.from("agent_mobile_payments")
        .update({ status: "failed", raw_response: { error: String((err as Error).message || err) } })
        .eq("id", txnRow.id);
      return json({ error: `Could not reach ${provider}: ${(err as Error).message || err}`, stage: "provider_call" }, 502);
    }

    return json({ ok: true, paymentId: txnRow.id, externalReference });
  } catch (err) {
    console.error("agent-initiate-momo-payment: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});