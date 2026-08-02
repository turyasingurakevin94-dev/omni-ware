// Airtel Money's async "Payment Result Notification" for a request-to-pay.
//
// A PUBLIC endpoint, deliberately: Airtel calls it directly with no
// Supabase JWT. Same principle as mtn-payment-webhook -- the callback is
// trusted for exactly one thing, WHICH payment to check. This function
// decides nothing. It resolves the reference to a pending
// agent_mobile_payments row and hands off to check-momo-payment-status,
// which asks Airtel's own API with this shop's credentials and applies
// whatever Airtel says. A forged callback can only cause a question to be
// asked; the answer comes from Airtel.
//
// Unlike MTN, Airtel DOES offer callback signing. Set
// AIRTEL_CALLBACK_HMAC_KEY (portal -> Security -> Callback Authentication)
// and every delivery is verified before anything else happens. That is a
// second lock on a door the re-check already holds shut, so it stays
// optional -- dormant while unset.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

// See the matching note in mtn-payment-webhook: one implementation of
// "ask the provider, then apply", shared by the poller and both webhooks.
async function requestAuthoritativeCheck(shopId: string, paymentId: number | string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/check-momo-payment-status`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ shopId, paymentId }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`status check failed (${res.status}): ${JSON.stringify(out)}`);
  return out;
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

    // Identify the payment. The status code Airtel claims is ignored --
    // the re-check below is what establishes it.
    const txnBody = body.transaction || body.data?.transaction || {};
    const providerTransactionId = txnBody.id || txnBody.airtel_money_id || null;
    const reference = txnBody.reference || body.reference || null;
    if (!providerTransactionId && !reference) {
      return json({ error: "No transaction id/reference in callback payload" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let query = admin.from("agent_mobile_payments").select("id, shop_id").eq("status", "pending");
    query = providerTransactionId
      ? query.eq("provider_transaction_id", providerTransactionId)
      : query.eq("external_reference", reference);
    const { data: txn, error: txnErr } = await query.maybeSingle();
    if (txnErr) return json({ error: txnErr.message, stage: "txn_lookup" }, 500);
    if (!txn) {
      return json({ ok: true, ignored: true, reason: "no matching pending payment" });
    }

    try {
      const result = await requestAuthoritativeCheck(txn.shop_id, txn.id);
      console.log("airtel-payment-webhook: checked", { paymentId: txn.id, status: result?.status });
      return json({ ok: true, status: result?.status ?? "pending" });
    } catch (err) {
      console.error("airtel-payment-webhook: status check failed", err);
      return json({ ok: true, status: "pending", note: "status check failed, left pending" });
    }
  } catch (err) {
    console.error("airtel-payment-webhook: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err) }, 500);
  }
});
