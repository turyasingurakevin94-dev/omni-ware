// Airtel Money's async "Payment Result Notification" for a request-to-pay
// -- register this function's deployed URL as the callback URL in the
// Airtel Money developer portal for each shop's merchant credentials.
//
// Written as a public endpoint -- but it is currently DEPLOYED with
// verify_jwt=true, so Airtel's callback is rejected with 401 before this
// file runs and nothing is ever delivered here. Payments resolve only
// because the agent app polls check-momo-payment-status. Before turning
// verify_jwt off, set AIRTEL_CALLBACK_HMAC_KEY (below): without it this
// marks a payment successful from an unauthenticated request body.
//
// Airtel's exact payload field names, like MTN's, aren't pinned down
// without a live sandbox callback to observe -- verify against a real
// delivery and adjust before production.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Carried over from the retired airtel-collection-callback, which was the
// only function that ever verified a callback signature. Dormant while
// unset, exactly as it was there: set it when "Callback Authentication" is
// switched on in the portal's Security tab.
const CALLBACK_HMAC_KEY = Deno.env.get("AIRTEL_CALLBACK_HMAC_KEY");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Docs: "hash the callback request with the private key ... using
// HmacSHA256, output text format in Base64". The request is hashed as the
// exact raw bytes Airtel sent, so this must run before JSON.parse.
async function computeHmac(rawBody: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(rawBody));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// Duplicated from check-momo-payment-status -- see that file's comment
// on why (each Edge Function here deploys as one standalone file).
async function applyMomoPaymentToOrder(admin: any, txn: any) {
  if (txn.order_id == null) return;
  const { data: agentRow } = await admin.from("agents").select("name").eq("shop_id", txn.shop_id).eq("id", txn.agent_id).maybeSingle();
  const providerLabel = "Airtel Money";
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
  // Only release the order once the money actually covers it -- see the
  // matching note in mtn-payment-webhook. A short payment is still banked
  // and credited above; it just doesn't unlock preparing.
  const orderTotal = (payload.items || []).reduce((s: number, it: any) => s + (Number(it.sellPrice) || 0) * (Number(it.qty) || 0), 0);
  const nextPayload: any = { ...payload, payments };
  if (newAmountPaid + 0.5 >= orderTotal) nextPayload.agentPaymentStatus = "paid";
  const { error: updateErr } = await admin.from("saved_quotes").update({
    amount_paid: newAmountPaid,
    payload: nextPayload,
  }).eq("shop_id", txn.shop_id).eq("id", txn.order_id);
  if (updateErr) throw new Error(`saved_quotes update failed: ${updateErr.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    // Raw bytes first -- the HMAC is over exactly what Airtel sent, so this
    // cannot go through req.json().
    const rawBody = await req.text();
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON body" }, 400); }

    if (CALLBACK_HMAC_KEY) {
      const computed = await computeHmac(rawBody, CALLBACK_HMAC_KEY);
      if (computed !== body.hash) {
        console.error("airtel-payment-webhook: hash mismatch", { reference: body?.transaction?.id });
        return json({ error: "Signature mismatch" }, 403);
      }
    }

    const txnBody = body.transaction || body.data?.transaction || {};
    const providerTransactionId = txnBody.id || txnBody.airtel_money_id || null;
    const reference = txnBody.reference || body.reference || null;
    const code = String(txnBody.status_code || txnBody.status || "").toUpperCase();
    const map: Record<string, string> = { TS: "successful", TF: "failed" };
    const status = map[code];
    if (!status) return json({ ok: true, ignored: true, reason: `unrecognized status code '${code}'` });
    if (!providerTransactionId && !reference) return json({ error: "No transaction id/reference in callback payload" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let query = admin.from("agent_mobile_payments").update({ status, raw_response: body, updated_at: new Date().toISOString() }).eq("status", "pending");
    query = providerTransactionId ? query.eq("provider_transaction_id", providerTransactionId) : query.eq("external_reference", reference);
    const { data: updated, error: updateErr } = await query.select().maybeSingle();
    if (updateErr) return json({ error: updateErr.message }, 500);
    if (!updated) return json({ ok: true, ignored: true, reason: "no matching pending payment (already resolved, or unknown reference)" });

    if (status === "successful") {
      try {
        await applyMomoPaymentToOrder(admin, updated);
      } catch (err) {
        console.error("airtel-payment-webhook: apply failed", err);
        return json({ ok: true, warning: "recorded but failed to apply to order -- needs manual review" });
      }
    }
    return json({ ok: true });
  } catch (err) {
    console.error("airtel-payment-webhook: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err) }, 500);
  }
});
