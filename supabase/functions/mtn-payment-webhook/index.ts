// MTN MoMo's async callback for a requesttopay.
//
// This is a PUBLIC endpoint and it is meant to be: MTN calls it directly
// with no Supabase JWT, and MTN does not sign its callbacks -- there is no
// HMAC, no signature header, nothing in their API to verify a delivery
// against. So this function trusts the callback for exactly one thing:
// WHICH payment to go and check.
//
// It decides nothing itself. It resolves the reference to a pending
// agent_mobile_payments row and hands off to check-momo-payment-status,
// which asks MTN's own API -- authenticated with this shop's credentials --
// what actually happened, and applies the result. A forged callback can
// therefore do no more than make us ask MTN a question we already had the
// right to ask, and MTN's answer is what counts.
//
// That is what makes it safe to expose. The previous version read the
// status out of the request body and wrote it straight to the ledger, so
// anyone who learned a reference could mark a payment successful with no
// money behind it.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Hands the payment to check-momo-payment-status on the service-role key.
// One implementation of "ask the provider, then apply" now serves the
// poller and both webhooks. There were three copies of the applying half,
// and one of them missed a fix because a test named the other two by hand.
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
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

    // The reference is the only thing taken from the body, and only as a
    // lookup key. The status MTN claims here is deliberately ignored.
    const referenceId = body.referenceId || body.externalId || req.headers.get("X-Reference-Id");
    if (!referenceId) return json({ error: "No reference id in callback payload" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: txn, error: txnErr } = await admin
      .from("agent_mobile_payments")
      .select("id, shop_id")
      .eq("external_reference", referenceId)
      .eq("status", "pending")
      .maybeSingle();
    if (txnErr) return json({ error: txnErr.message, stage: "txn_lookup" }, 500);
    if (!txn) {
      // Already resolved by a poll, or a reference that means nothing here.
      return json({ ok: true, ignored: true, reason: "no matching pending payment" });
    }

    try {
      const result = await requestAuthoritativeCheck(txn.shop_id, txn.id);
      console.log("mtn-payment-webhook: checked", { paymentId: txn.id, status: result?.status });
      return json({ ok: true, status: result?.status ?? "pending" });
    } catch (err) {
      console.error("mtn-payment-webhook: status check failed", err);
      // Leave it pending; the agent app's polling still covers this.
      return json({ ok: true, status: "pending", note: "status check failed, left pending" });
    }
  } catch (err) {
    console.error("mtn-payment-webhook: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err) }, 500);
  }
});
