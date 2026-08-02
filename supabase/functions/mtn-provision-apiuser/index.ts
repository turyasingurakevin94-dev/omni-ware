// One-time setup helper: creates an MTN MoMo API user + API key via
// MTN's own API (there is no portal page for this -- you can only
// create it by calling POST /v1_0/apiuser yourself, and that's also the
// only place the callback URL gets registered, via `providerCallbackHost`
// in that same request). Admin only provides the subscription key
// (obtained from subscribing to the Collections product on
// momodeveloper.mtn.com, or from MTN's go-live approval for production);
// everything else is generated here and wired straight to this project's
// mtn-payment-webhook.
//
// Handles both sandbox and production (body.environment). Sandbox is
// confirmed working end-to-end. Production support is untested against
// a real MTN merchant account -- MTN's docs describe the same
// apiuser/apikey creation flow working against the live host once
// you have a production subscription key from MTN's go-live process,
// but that's the best available guidance, not a verified fact. If it
// fails, ask MTN for the API user/key directly and paste them into the
// admin UI's fields by hand instead -- that path works regardless.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    const { shopId } = body;
    if (!shopId) return json({ error: "shopId is required" }, 400);
    const environment = body.environment === "production" ? "production" : "sandbox";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: isAdmin, error: adminErr } = await callerClient.rpc("is_shop_admin", { p_shop_id: shopId });
    if (adminErr) return json({ error: adminErr.message, stage: "is_shop_admin" }, 500);
    if (!isAdmin) return json({ error: "Only a shop admin/owner can do this" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: existing } = await admin.from("shop_payment_providers").select("credentials").eq("shop_id", shopId).eq("provider", "mtn").maybeSingle();
    const subscriptionKey = body.subscriptionKey || existing?.credentials?.subscriptionKey;
    if (!subscriptionKey) return json({ error: "Enter your MTN subscription key first" }, 400);

    // MTN's sandbox WAF sometimes rejects requests with a generic block
    // page instead of a real API response -- observed to correlate with
    // Deno's fetch() sending no User-Agent, which some WAF rulesets flag
    // as bot traffic. Same fix as agent-initiate-momo-payment.
    const mtnHeaders = {
      "User-Agent": "Mozilla/5.0 (compatible; omni-ware/1.0; +https://omni-ware.example)",
      "Accept": "application/json",
    };
    // providerCallbackHost is a HOST, not a URL. MTN's rule is that the
    // per-request X-Callback-Url must belong to the same domain as the
    // registered ProviderCallbackHost, and subdomains are not allowed --
    // a mismatch surfaces later as INVALID_CALLBACK_URL_HOST on the
    // payment call, not here at provisioning time, which is what let
    // "https://<ref>.functions.supabase.co/mtn-payment-webhook" sit here
    // looking plausible. Register the host; keep the full URL for display.
    const callbackHost = new URL(SUPABASE_URL.replace(/\.supabase\.co\/?$/, ".functions.supabase.co")).host;
    const callbackUrl = `https://${callbackHost}/mtn-payment-webhook`;
    const mtnBase = environment === "production" ? "https://proxy.momoapi.mtn.com" : "https://sandbox.momodeveloper.mtn.com";
    const apiUserId = crypto.randomUUID();

    const createUserRes = await fetch(`${mtnBase}/v1_0/apiuser`, {
      method: "POST",
      headers: {
        ...mtnHeaders,
        "X-Reference-Id": apiUserId,
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ providerCallbackHost: callbackHost }),
    });
    if (createUserRes.status !== 201) {
      return json({ error: `MTN rejected the API user creation (${createUserRes.status}): ${await createUserRes.text()}`, stage: "create_apiuser" }, 502);
    }

    const apiKeyRes = await fetch(`${mtnBase}/v1_0/apiuser/${apiUserId}/apikey`, {
      method: "POST",
      headers: { ...mtnHeaders, "Ocp-Apim-Subscription-Key": subscriptionKey },
    });
    if (!apiKeyRes.ok) {
      return json({ error: `MTN rejected the API key creation (${apiKeyRes.status}): ${await apiKeyRes.text()}`, stage: "create_apikey" }, 502);
    }
    const { apiKey } = await apiKeyRes.json();

    // Record WHICH host was registered with MTN. agent-initiate-momo-payment
    // only sends an X-Callback-Url when this matches the host it would send,
    // because MTN rejects the payment call outright with
    // INVALID_CALLBACK_URL_HOST if the two disagree. Shops provisioned
    // before the host fix have no callbackHost here, so they keep working
    // on polling until someone re-provisions them.
    const credentials = { ...(existing?.credentials || {}), subscriptionKey, apiUser: apiUserId, apiKey, callbackHost };
    const { data: saved, error: upsertErr } = await admin
      .from("shop_payment_providers")
      .upsert({ shop_id: shopId, provider: "mtn", environment, credentials, updated_at: new Date().toISOString() }, { onConflict: "shop_id,provider" })
      .select().single();
    if (upsertErr) return json({ error: upsertErr.message, stage: "save" }, 500);

    return json({ ok: true, provider: saved, callbackUrl });
  } catch (err) {
    console.error("mtn-provision-apiuser: uncaught error", err);
    return json({ error: String(err && (err as Error).message || err), stage: "uncaught" }, 500);
  }
});
