#!/usr/bin/env node
'use strict';
/*
 * mtn-provision-apiuser / mtn-provision-sandbox -- the one-time setup that
 * creates an MTN MoMo API user and key, and the ONLY place MTN's callback
 * destination is ever registered.
 *
 * Both registered a full URL as `providerCallbackHost`:
 *
 *   providerCallbackHost: "https://<ref>.functions.supabase.co/mtn-payment-webhook"
 *
 * MTN's field is a HOST. Its rule is that the per-request X-Callback-Url
 * must belong to the same domain as the registered ProviderCallbackHost,
 * with subdomains disallowed, and a mismatch is reported as
 * INVALID_CALLBACK_URL_HOST on the payment call -- never at provisioning
 * time. So provisioning returned 201, looked healthy, and registered a
 * domain that does not exist.
 *
 * Nothing in this repo sets X-Callback-Url yet, so MTN has no per-request
 * URL to check and no callback is attempted at all. That is the next link
 * in the same chain, and it must not be added before a shop is
 * re-provisioned with a correct host -- otherwise the payment call starts
 * failing INVALID_CALLBACK_URL_HOST where today it merely gets no callback
 * and is resolved by check-momo-payment-status polling.
 *
 * Run: node test/mtn-provision.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('mtn provision');

const FILES = [
  ['mtn-provision-apiuser', read('supabase/functions/mtn-provision-apiuser/index.ts')],
  ['mtn-provision-sandbox', read('supabase/functions/mtn-provision-sandbox/index.ts')],
];

/* ---------- 1. a host is registered, not a URL ------------------------ */
FILES.forEach(([name, src]) => {
  const code = src.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n');

  t.check(/providerCallbackHost: callbackHost/.test(code),
    `${name} registers the host`);
  t.check(!/providerCallbackHost: callbackUrl/.test(code),
    `${name} no longer registers a full URL as the host`);
  // Greedy to the line end: the expression contains its own parentheses,
  // so a [^)]* run stops inside .replace() and never reaches .host.
  t.check(/const callbackHost = new URL\(.*\)\.host;/.test(code),
    `${name} derives the host through URL().host rather than string surgery`);
});

/* ---------- 2. the host and the URL cannot drift apart ---------------- */
/*
 * The registered host and the URL MTN would be asked to call have to stay
 * the same domain. Reproducing the derivation is the point: if someone
 * changes how either is built, this fails.
 */
{
  const derive = (supabaseUrl) => {
    const callbackHost = new URL(supabaseUrl.replace(/\.supabase\.co\/?$/, '.functions.supabase.co')).host;
    return { callbackHost, callbackUrl: `https://${callbackHost}/mtn-payment-webhook` };
  };

  const real = derive('https://hgywjaifdmgrcnwxstxg.supabase.co');
  t.check(real.callbackHost === 'hgywjaifdmgrcnwxstxg.functions.supabase.co',
    `the registered host is a bare hostname (${real.callbackHost})`);
  t.check(!/[/:]/.test(real.callbackHost),
    'with no scheme and no path in it');
  t.check(new URL(real.callbackUrl).host === real.callbackHost,
    'and the callback URL sits on exactly that host, which is what MTN checks');

  // A trailing slash on SUPABASE_URL must not change the answer.
  const slashed = derive('https://hgywjaifdmgrcnwxstxg.supabase.co/');
  t.check(slashed.callbackHost === real.callbackHost,
    'a trailing slash on SUPABASE_URL makes no difference');

  // Both files must derive it the same way, or one shop gets provisioned
  // against a host the other would not recognise.
  const lines = FILES.map(([, src]) =>
    (/const callbackHost = .*/.exec(src.replace(/\r/g, '')) || [''])[0].trim());
  t.check(lines[0] && lines[0] === lines[1],
    'both provisioning functions derive the host identically');
}

/* ---------- 3. X-Callback-Url is deliberately absent ------------------ */
/*
 * Pinned so adding it is a decision rather than an accident. It only
 * becomes correct once a shop has been re-provisioned with a valid host
 * AND mtn-payment-webhook is actually reachable -- it is deployed
 * verify_jwt=true today and answers a provider callback with 401.
 */
{
  const initiate = read('supabase/functions/agent-initiate-momo-payment/index.ts');
  t.check(!/X-Callback-Url/i.test(initiate),
    'agent-initiate-momo-payment does not yet send X-Callback-Url');
  t.check(/check-momo-payment-status/.test(read('agent.html')),
    'and the agent app polls for the result, which is what actually resolves payments');
}

/* ---------- 4. authorization ------------------------------------------ */
/*
 * These write payment credentials, so who may call them matters.
 */
FILES.forEach(([name, src]) => {
  t.check(/if \(!authHeader\) return json\(\{ error: "Missing Authorization header" \}, 401\)/.test(src),
    `${name} refuses a request with no Authorization header`);
  t.check(/createClient\(SUPABASE_URL, ANON_KEY, \{ global: \{ headers: \{ Authorization: authHeader \} \} \}\)/.test(src),
    `${name} runs the admin check as the caller, not the service role`);
  t.check(/if \(!isAdmin\) return json\(\{ error: "Only a shop admin\/owner can do this" \}, 403\)/.test(src),
    `${name} refuses a non-admin`);
  t.check(src.indexOf('is_shop_admin') < src.indexOf('SERVICE_ROLE_KEY)'),
    `${name} checks admin before creating the service-role client`);
});

/* ---------- 5. the credentials are not readable by ordinary staff ----- */
{
  const mig = read('supabase/migrations/0022_agent_mobile_money.sql');
  t.check(/create policy "admin manages payment providers" on shop_payment_providers\s*\n\s*for all using \(is_shop_admin\(shop_id\)\)/.test(mig),
    'shop_payment_providers is admin-only, so the MTN api key is not exposed to every shop member');
}

process.exit(t.done() ? 1 : 0);
