// Airtel Money's async "Payment Result Notification" for a request-to-pay
// -- register this function's deployed URL as the callback URL in the
// Airtel Money developer portal for each shop's merchant credentials.
//
// Public endpoint, same reasoning as mtn-payment-webhook: no Supabase JWT
// check, only proof the referenced payment actually exists and is still
// pending. Airtel's exact payload field names, like MTN's, aren't pinned
// down without a live sandbox callback to observe -- verify against a
// real delivery and adjust before production. check-momo-payment-status's
// polling is the safety net regardless.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
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
  const { error: updateErr } = await admin.from("saved_quotes").update({
    amount_paid: newAmountPaid,
    payload: { ...payload, payments, agentPaymentStatus: "paid" },
  }).eq("shop_id", txn.shop_id).eq("id", txn.order_id);
  if (updateErr) throw new Error(`saved_quotes update failed: ${updateErr.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

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