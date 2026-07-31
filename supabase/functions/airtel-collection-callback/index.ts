// Receives Airtel Money's Collection-APIs transaction callback (see
// "Callback Without Authentication" / "Callback With Authentication" in the
// Airtel developer docs). Airtel posts here once a USSD Push payment
// reaches a final state (status_code TS/TF) -- this only updates the
// airtel_transactions ledger row matching transaction.id; it does NOT
// initiate payments. That row is expected to already exist (status
// 'pending') by the time this fires, created by whatever code kicks off
// the USSD Push request with the same transaction.id as `reference`.
//
// If the Airtel app has "Callback Authentication" enabled (Security tab),
// set AIRTEL_CALLBACK_HMAC_KEY to the private key shown there and every
// callback's HMAC is verified before anything is written. Leave it unset
// while that toggle is off.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CALLBACK_HMAC_KEY = Deno.env.get("AIRTEL_CALLBACK_HMAC_KEY");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const rawBody = await req.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const txn = payload?.transaction;
  if (!txn?.id || !txn?.status_code) {
    console.error("airtel-collection-callback: malformed payload", payload);
    return json({ error: "Missing transaction.id or transaction.status_code" }, 400);
  }

  if (CALLBACK_HMAC_KEY) {
    const computed = await computeHmac(rawBody, CALLBACK_HMAC_KEY);
    if (computed !== payload.hash) {
      console.error("airtel-collection-callback: hash mismatch", { reference: txn.id });
      return json({ error: "Signature mismatch" }, 403);
    }
  }

  const status = txn.status_code === "TS" ? "success" : txn.status_code === "TF" ? "failed" : "unknown";

  const { data: existing, error: findErr } = await admin
    .from("airtel_transactions")
    .select("id, shop_id, quote_id, amount, status")
    .eq("reference", txn.id)
    .maybeSingle();
  if (findErr) {
    console.error("airtel-collection-callback: lookup failed", findErr);
    return json({ error: findErr.message }, 500);
  }
  if (!existing) {
    // Ack anyway -- returning an error would make Airtel retry indefinitely
    // for a transaction id this system never recorded initiating.
    console.error("airtel-collection-callback: no matching transaction", { reference: txn.id });
    return json({ ok: true, skipped: "unknown reference" });
  }
  if (existing.status !== "pending") {
    // Airtel can resend the same callback; don't double-apply the payment.
    return json({ ok: true, skipped: "already processed" });
  }

  const { error: updateErr } = await admin
    .from("airtel_transactions")
    .update({
      status,
      airtel_money_id: txn.airtel_money_id ?? null,
      raw_callback: payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  if (updateErr) {
    console.error("airtel-collection-callback: update failed", updateErr);
    return json({ error: updateErr.message }, 500);
  }

  if (status === "success" && existing.quote_id) {
    const { data: quote, error: quoteErr } = await admin
      .from("saved_quotes")
      .select("payload")
      .eq("id", existing.quote_id)
      .eq("shop_id", existing.shop_id)
      .maybeSingle();
    if (quoteErr) {
      console.error("airtel-collection-callback: quote lookup failed", quoteErr);
      return json({ ok: true, warning: "transaction recorded but order lookup failed" });
    }
    if (quote) {
      // This settles what the AGENT owes the SHOP for this order -- the
      // same money flow promptAgentPrepayment()/agentPrepayConfirm handles
      // manually in index.html by flipping agentPaymentStatus once staff
      // confirm cash received. It is unrelated to amount_paid/payments[],
      // which track the order's own end-customer invoice, so those are
      // deliberately left untouched here.
      const quotePayload = quote.payload || {};
      const items = quotePayload.items || [];
      const owed = items.reduce((s: number, it: any) => s + (Number(it.sellPrice) || 0) * (Number(it.qty) || 0), 0);
      const amount = Number(existing.amount) || 0;

      if (amount >= owed) {
        quotePayload.agentPaymentStatus = "paid";
        quotePayload.agentPaymentTxnRef = txn.airtel_money_id || txn.id;
        const { error: quoteUpdateErr } = await admin
          .from("saved_quotes")
          .update({ payload: quotePayload })
          .eq("id", existing.quote_id);
        if (quoteUpdateErr) console.error("airtel-collection-callback: quote update failed", quoteUpdateErr);
      } else {
        console.error("airtel-collection-callback: paid amount short of what's owed, not marking paid", {
          quoteId: existing.quote_id,
          amount,
          owed,
        });
      }
    }
  }

  return json({ ok: true });
});
