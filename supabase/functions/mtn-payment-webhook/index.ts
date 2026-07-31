// MTN MoMo's async callback for a requesttopay -- register this
// function's deployed URL as the callback host in the MTN MoMo
// developer portal for each shop's subscription (see
// supabase/functions/README.md for the general webhook-registration
// pattern already used by notify-worker).
//
// Public endpoint: MTN calls this directly, with no Supabase JWT --
// there is deliberately no Authorization check here, only proof that
// the referenced payment actually exists and is still pending (a random
// POST to this URL just won't match a real external_reference).
//
// MTN's exact callback payload shape isn't pinned down without live
// sandbox access to observe a real delivery -- this reads the reference
// id and status defensively from the field names MTN's docs describe,
// but verify against an actual sandbox callback and adjust before
// relying on this in production. check-momo-payment-status's polling is
// the safety net either way if this needs adjusting after the fact.
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
  const providerLabel = "MTN MoMo";
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

    const referenceId = body.referenceId || body.externalId || req.headers.get("X-Reference-Id");
    const rawStatus = String(body.status || "").toUpperCase();
    if (!referenceId) return json({ error: "No reference id in callback payload" }, 400);
    const map: Record<string, string> = { SUCCESSFUL: "successful", FAILED: "failed" };
    const status = map[rawStatus];
    if (!status) return json({ ok: true, ignored: true, reason: `unrecognized status '${rawStatus}'` }); // e.g. still PENDING -- nothing to do yet

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: updated, error: updateErr } = await admin.from("agent_mobile_payments")
      .update({ status, raw_response: body, updated_at: new Date().toISOString() })
      .eq("external_reference", referenceId).eq("status", "pending")
      .select().maybeSingle();
    if (updateErr) return json({ error: updateErr.message }, 500);
    if (!updated) return json({ ok: true, ignored: true, reason: "no matching pending payment (already resolved, or unknown reference)" });

    if (status === "successful") {
      try {
        await applyMomoPaymentToOrder(admin, updated);
      } catch (err) {
        console.error("mtn-payment-webhook: apply failed", err);
        return json({ ok: true, warning: "recorded but failed to apply to order -- needs manual review" });
      }
    }
    return json({ ok: true });
  } catch (err) {
    console.error("mtn-payment-webhook: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err) }, 500);
  }
});
