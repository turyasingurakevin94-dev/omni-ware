#!/usr/bin/env node
'use strict';
/*
 * mtn-payment-webhook / airtel-payment-webhook -- where the providers post
 * the outcome of a request-to-pay.
 *
 * These are public by necessity: a provider cannot present a Supabase JWT.
 * They were deployed verify_jwt=true, so every callback was answered 401
 * and no payment was ever resolved by one -- polling did all the work. The
 * fix was not simply to open them. Opened as they stood, each read the
 * status out of the request body and wrote it to the ledger, so anyone who
 * learned a reference could mark a payment successful with no money behind
 * it. MTN does not sign its callbacks at all, so no signature check was
 * available to make that safe.
 *
 * So the callback stopped being a source of truth. It is now trusted for
 * exactly one thing -- WHICH payment to look at -- and the answer comes
 * from asking the provider directly, authenticated with the shop's own
 * credentials, through check-momo-payment-status. A forged callback can do
 * no more than cause a question we already had the right to ask.
 *
 * That also collapsed three copies of applyMomoPaymentToOrder into one.
 *
 * Run: node test/payment-webhooks.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('payment webhooks');

// Lookbehind matters: a plain //-strip truncates any line holding a URL.
const strip = (s) => s.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

const HOOKS = [
  ['mtn-payment-webhook', read('supabase/functions/mtn-payment-webhook/index.ts')],
  ['airtel-payment-webhook', read('supabase/functions/airtel-payment-webhook/index.ts')],
];

/* ---------- 1. the body decides nothing ------------------------------- */
HOOKS.forEach(([name, src]) => {
  const code = strip(src);

  t.check(!/function applyMomoPaymentToOrder/.test(code),
    `${name} no longer carries its own copy of applyMomoPaymentToOrder`);
  t.check(!/from\("cash_txns"\)/.test(code),
    `${name} does not bank money itself`);
  t.check(!/from\("saved_quotes"\)/.test(code),
    `${name} does not touch an order itself`);

  // The give-away of the old design: writing a status taken from the body.
  t.check(!/\.update\(\{ status,/.test(code),
    `${name} does not write a status it was handed`);

  t.check(/requestAuthoritativeCheck\(txn\.shop_id, txn\.id\)/.test(code),
    `${name} asks check-momo-payment-status for the real answer`);
});

/* ---------- 2. the lookup is a lookup, and only matches pending ------- */
HOOKS.forEach(([name, src]) => {
  const code = strip(src);
  t.check(/\.select\("id, shop_id"\)/.test(code),
    `${name} reads only what it needs to identify the payment`);
  t.check(/\.eq\("status", "pending"\)/.test(code),
    `${name} only acts on a payment that is still pending`);
  t.check(/no matching pending payment/.test(code),
    `${name} answers harmlessly when the reference means nothing`);
});

/* ---------- 3. the hand-off runs as the service role ------------------ */
HOOKS.forEach(([name, src]) => {
  const code = strip(src);
  t.check(/Authorization: `Bearer \$\{SERVICE_ROLE_KEY\}`/.test(code),
    `${name} calls the checker on the service-role key`);
  t.check(/functions\/v1\/check-momo-payment-status/.test(code),
    `${name} calls the one function that knows how to ask a provider`);
  // A failed check must leave the row alone, not guess.
  t.check(/status: "pending", note: "status check failed, left pending"/.test(code),
    `${name} leaves the payment pending when the check itself fails`);
});

/* ---------- 4. the checker accepts that hand-off, and only that ------- */
{
  const checker = read('supabase/functions/check-momo-payment-status/index.ts');
  const code = strip(checker);

  t.check(/const isServiceRole = authHeader === `Bearer \$\{SERVICE_ROLE_KEY\}`;/.test(code),
    'check-momo-payment-status recognises a service-role caller');
  t.check(/if \(!isServiceRole\) \{/.test(code),
    'and skips the agent/admin ownership check only for that caller');

  // The bypass must not skip the part that matters: the provider is still
  // the one who decides, and the row is still only updated from pending.
  t.check(/fetchMtnStatus|fetchAirtelStatus/.test(code),
    'the status still comes from the provider, whoever asked');
  t.check(/\.eq\("id", paymentId\)\.eq\("status", "pending"\)/.test(code),
    'and the update still only fires on a row that is still pending');

  // Anchored on the CALL, not the name -- fetchMtnStatus is defined above
  // the handler, so matching the identifier finds the definition and the
  // comparison means nothing.
  const iBypass = code.indexOf('isServiceRole');
  const iFetch = code.indexOf('await fetchMtnStatus(providerRow.credentials');
  t.check(iBypass > 0 && iFetch > 0 && iBypass < iFetch,
    'the caller is established before any provider call is made');

  // A missing Authorization header must still be refused -- the bypass is a
  // comparison against a secret, not an absence of one.
  t.check(/if \(!authHeader\) return json\(\{ error: "Missing Authorization header" \}, 401\)/.test(code),
    'a caller with no Authorization header is still refused');
}

/* ---------- 5. Airtel keeps its signature check ----------------------- */
/*
 * Airtel, unlike MTN, does offer callback signing. It is a second lock on
 * a door the re-check already holds shut, so it stays optional -- but it
 * must not be quietly dropped, and it must run before anything else.
 */
{
  const src = read('supabase/functions/airtel-payment-webhook/index.ts');
  const code = strip(src);
  t.check(/AIRTEL_CALLBACK_HMAC_KEY/.test(code) && /async function computeHmac/.test(code),
    'airtel-payment-webhook still verifies a signature when one is configured');
  t.check(/const rawBody = await req\.text\(\);/.test(code) && !/await req\.json\(\)/.test(code),
    'over the raw bytes, so the hash is of exactly what was sent');
  t.check(code.indexOf('computeHmac(rawBody') < code.indexOf('from("agent_mobile_payments")'),
    'and before any payment row is looked at');

  const mtn = strip(read('supabase/functions/mtn-payment-webhook/index.ts'));
  t.check(!/hmac|signature/i.test(mtn),
    'mtn-payment-webhook claims no signature check, because MTN provides none');
}

process.exit(t.done() ? 1 : 0);
