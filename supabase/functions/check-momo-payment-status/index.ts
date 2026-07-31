// Re-queries MTN/Airtel directly for a pending payment's real status --
// the safety net for when a webhook callback never arrives (unreachable
// in local/sandbox testing, or just dropped in production). Called both
// by the agent app while it's polling a payment it just started, and by
// the admin "Re-check" button in the Mobile Money ledger.
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
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS_HEADERS } });
}

// Mirrors applyMomoPaymentToOrder's twin in the webhook functions --
// duplicated rather than imported from a shared module, same convention
// this project already uses for agent-submit-order/agent-catalog's
// parallel pickBestPriceRow()/tieredUnitPrice() implementations, since
// each Edge Function here is deployed as one standalone file.
async function applyMomoPaymentToOrder(admin: any, txn: any) {
  if (txn.order_id == null) return;
  const { data: agentRow } = await admin.from("agents").select("name").eq("shop_id", txn.shop_id).eq("id", txn.agent_id).maybeSingle();
  const providerLabel = txn.provider === "mtn" ? "MTN MoMo" : "Airtel Money";
  const now = new Date();
  const { data: cashTxn, error: cashErr } = await admin.from("cash_txns").insert({
    shop_id: txn.shop_id, date: now.toISOString().slice(0, 10), account: providerLabel,
    type: "receipt", category: "Mobile Money",
    amount: txn.amount,
    description: `${providerLabel} payment from ${agentRow?.name || txn.agent_id} -- order #${txn.order_id}`,
    time: now.toTimeString().slice(0, 8),
  }).select().single();
  if (cashErr) throw new Error(`cash_txns insert failed: ${cashErr.message}`);

  const { data: order, error: orderErr } = await admin.from("saved_quotes")
    .select("payload, amount_paid").eq("shop_id", txn.shop_id).eq("id", txn.order_id).maybeSingle();
  if (orderErr || !order) throw new Error(orderErr?.message || "order not found");
  const payload = order.payload || {};
  const payments = Array.isArray(payload.payments) ? payload.payments.slice() : [];
  payments.push({ date: now.toISOString().slice(0, 10), amount: txn.amount, note: providerLabel, cashTxnId: cashTxn.id });
  const newAmountPaid = (Number(order.amount_paid) || 0) + Number(txn.amount);
  const { error: updateErr } = await admin.from("saved_quotes").update({
    amount_paid: newAmountPaid,
    payload: { ...payload, payments, agentPaymentStatus: "paid" },
  }).eq("shop_id", txn.shop_id).eq("id", txn.order_id);
  if (updateErr) throw new Error(`saved_quotes update failed: ${updateErr.message}`);
}

// MTN's sandbox WAF sometimes rejects requests with a generic block page
// instead of a real API response -- observed to correlate with Deno's
// fetch() sending no User-Agent, which some WAF rulesets flag as bot
// traffic. See agent-initiate-momo-payment's identical comment.
const MTN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; omni-ware/1.0; +https://omni-ware.example)",
  "Accept": "application/json",
};
function describeMtnFailure(status: number, text: string) {
  if (/<html/i.test(text)) return `MTN's servers rejected the request (HTTP ${status}) -- looks like a firewall block on MTN's side, not a real API error.`;
  return `MTN request failed (${status}): ${text}`;
}
async function fetchMtnStatus(creds: any, environment: string, referenceId: string) {
  const base = environment === "production" ? "https://proxy.momoapi.mtn.com" : "https://sandbox.momodeveloper.mtn.com";
  const tokenRes = await fetch(`${base}/collection/token/`, {
    method: "POST",
    headers: { ...MTN_HEADERS, "Ocp-Apim-Subscription-Key": creds.subscriptionKey, "Authorization": "Basic " + btoa(`${creds.apiUser}:${creds.apiKey}`) },
  });
  if (!tokenRes.ok) throw new Error(describeMtnFailure(tokenRes.status, await tokenRes.text()));
  const { access_token } = await tokenRes.json();
  const statusRes = await fetch(`${base}/collection/v1_0/requesttopay/${referenceId}`, {
    headers: {
      ...MTN_HEADERS,
      "Authorization": `Bearer ${access_token}`,
      "X-Target-Environment": environment === "production" ? "mtnuganda" : "sandbox",
      "Ocp-Apim-Subscription-Key": creds.subscriptionKey,
    },
  });
  if (!statusRes.ok) throw new Error(describeMtnFailure(statusRes.status, await statusRes.text()));
  const body = await statusRes.json();
  const map: Record<string, string> = { SUCCESSFUL: "successful", FAILED: "failed", PENDING: "pending" };
  return { status: map[body.status] || "pending", raw: body };
}

async function fetchAirtelStatus(creds: any, environment: string, transactionId: string) {
  const base = "https://openapiuat.airtel.africa";
  const tokenRes = await fetch(`${base}/auth/oauth2/token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: "client_credentials" }),
  });
  if (!tokenRes.ok) throw new Error(`Airtel auth failed (${tokenRes.status})`);
  const { access_token } = await tokenRes.json();
  const statusRes = await fetch(`${base}/standard/v1/payments/${transactionId}`, {
    headers: { "Authorization": `Bearer ${access_token}`, "X-Country": "UG", "X-Currency": "UGX" },
  });
  if (!statusRes.ok) throw new Error(`Airtel status check failed (${statusRes.status})`);
  const body = await statusRes.json();
  // Airtel's transaction.status: TS = success, TF = failed, TIP/TA = still in progress.
  const code = body?.data?.transaction?.status;
  const map: Record<string, string> = { TS: "successful", TF: "failed" };
  return { status: map[code] || "pending", raw: body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const { shopId, paymentId } = body;
    if (!shopId || !paymentId) return json({ error: "shopId and paymentId are required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: txn, error: txnErr } = await admin.from("agent_mobile_payments").select("*").eq("shop_id", shopId).eq("id", paymentId).maybeSingle();
    if (txnErr) return json({ error: txnErr.message, stage: "txn_lookup" }, 500);
    if (!txn) return json({ error: "Payment not found" }, 404);

    // Caller must be either the agent who owns this payment, or a shop admin
    // (the ledger's "Re-check" button calls this too).
    const [{ data: agentId }, { data: isAdmin }] = await Promise.all([
      callerClient.rpc("current_agent_id", { p_shop_id: shopId }),
      callerClient.rpc("is_shop_admin", { p_shop_id: shopId }),
    ]);
    if (!(agentId && agentId === txn.agent_id) && !isAdmin) return json({ error: "Not authorized to view this payment" }, 403);

    if (txn.status !== "pending") return json({ ok: true, status: txn.status });

    const { data: providerRow } = await admin.from("shop_payment_providers").select("*").eq("shop_id", shopId).eq("provider", txn.provider).maybeSingle();
    if (!providerRow) return json({ ok: true, status: "pending" }); // provider got disabled mid-flight; nothing to check against

    let result;
    try {
      result = txn.provider === "mtn"
        ? await fetchMtnStatus(providerRow.credentials, providerRow.environment, txn.external_reference)
        : await fetchAirtelStatus(providerRow.credentials, providerRow.environment, txn.provider_transaction_id || txn.external_reference);
    } catch (err) {
      // Transient network/provider error -- leave the row pending, let the
      // next poll try again rather than marking it failed on a fluke.
      return json({ ok: true, status: "pending", note: String((err as Error).message || err) });
    }
    if (result.status === "pending") return json({ ok: true, status: "pending" });

    const { data: updated, error: updateErr } = await admin.from("agent_mobile_payments")
      .update({ status: result.status, raw_response: result.raw, updated_at: new Date().toISOString() })
      .eq("id", paymentId).eq("status", "pending")
      .select().maybeSingle();
    if (updateErr) return json({ error: updateErr.message, stage: "update" }, 500);
    if (!updated) return json({ ok: true, status: "pending" }); // lost the race to a concurrent webhook/poll -- fine, whoever won already applied it

    if (result.status === "successful") {
      try {
        await applyMomoPaymentToOrder(admin, updated);
      } catch (err) {
        console.error("check-momo-payment-status: apply failed", err);
        return json({ ok: true, status: "successful", warning: "Payment confirmed but applying it to the order failed -- check manually." });
      }
    }
    return json({ ok: true, status: result.status });
  } catch (err) {
    console.error("check-momo-payment-status: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});