#!/usr/bin/env node
'use strict';
/*
 * Which edge functions are reachable without a Supabase JWT, and whether
 * the repo still agrees with itself about it.
 *
 * `verify_jwt` used to live nowhere but in whoever typed
 * `--no-verify-jwt` at the right moment. Deploying one function at a time
 * by hand, that mostly worked. It stops working the moment anything
 * deploys all eighteen at once -- which is exactly what a CI job does, and
 * what the staging setup needs, because there is no other way to stand a
 * second project up from a browser. A blanket deploy turned verification
 * back ON for the seven that cannot present a JWT, and the symptom is a
 * payment provider's callback quietly vanishing.
 *
 * So config.toml declares it now. This checks the declaration against the
 * code rather than against a list someone keeps by hand: a function that
 * reads the INCOMING request's Authorization header is called by a
 * signed-in user and must verify; one that never looks at it is called by
 * something that has no JWT to give -- a provider, Meta, a Database
 * Webhook, or a portal page that deliberately ships no key -- and must
 * not. Change how a function authenticates and this fails until
 * config.toml is changed with it.
 *
 * Outgoing headers don't count and are the reason this doesn't simply
 * grep for the word: every one of the seven sets an `Authorization` on a
 * request it MAKES.
 *
 * Run: node test/functions-jwt.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, read, createReporter } = require('./_extract');

const t = createReporter('edge function JWT');

const FN_DIR = path.join(ROOT, 'supabase/functions');

// Reading the incoming request's Authorization header — not setting one
// on an outgoing fetch, which every webhook here does.
const READS_INCOMING = /\breq\.headers\.get\(\s*['"]authorization['"]\s*\)/i;

const names = fs.readdirSync(FN_DIR)
  .filter((n) => fs.statSync(path.join(FN_DIR, n)).isDirectory())
  .sort();

// 20 with agent-change-order: an agent cancelling, asking for fewer, or
// spending credit. It reads the caller's JWT like the rest of the agent's.
t.check(names.length === 20, `all ${names.length} functions found`);

const open = [];   // no incoming Authorization — must be verify_jwt = false
const closed = [];
names.forEach((n) => {
  const dir = path.join(FN_DIR, n);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  if (!files.length) throw new Error(`no TypeScript source in supabase/functions/${n}`);
  const src = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  (READS_INCOMING.test(src) ? closed : open).push(n);
});

/* ---------- what config.toml declares -------------------------------- */
const toml = read('supabase/config.toml');
const declared = [...toml.matchAll(/^\[functions\.([a-z0-9-]+)\]\s*\n(?:[^\[]*?)verify_jwt\s*=\s*false/gmi)]
  .map((m) => m[1])
  .sort();

t.check(declared.length > 0, `config.toml declares ${declared.length} function(s) open`);

/* ---------- the two must be the same set ----------------------------- */
{
  const missing = open.filter((n) => declared.indexOf(n) === -1);
  const extra = declared.filter((n) => open.indexOf(n) === -1);

  t.check(missing.length === 0, missing.length
    ? `these read no Authorization header but are not declared verify_jwt = false — a deploy would lock out their callers: ${missing.join(', ')}`
    : `every function that cannot present a JWT is declared open (${open.length})`);

  t.check(extra.length === 0, extra.length
    ? `these are declared open but do read an Authorization header — either the declaration is stale or the function changed sides: ${extra.join(', ')}`
    : `nothing is declared open that authenticates its caller (${closed.length} verify)`);
}

/* ---------- a declaration for a function that does not exist ---------- */
{
  const ghosts = declared.filter((n) => names.indexOf(n) === -1);
  t.check(ghosts.length === 0, ghosts.length
    ? `config.toml names function(s) that do not exist: ${ghosts.join(', ')}`
    : 'every declaration names a real function');
}

/* ---------- the ones the README calls out by name -------------------- */
{
  // Named rather than derived, because these four are the cases where
  // getting it wrong is silent: nobody is watching a provider callback.
  ['notify-worker', 'mtn-payment-webhook', 'airtel-payment-webhook', 'wa-webhook'].forEach((n) => {
    t.check(declared.indexOf(n) !== -1, `${n} is open — its caller is a webhook with no JWT`);
  });
  // And the two the customer portal posts to, from a page asserted to
  // carry no key at all.
  ['client-portal', 'client-submit-order'].forEach((n) => {
    t.check(declared.indexOf(n) !== -1, `${n} is open — client.html ships no key to authenticate with`);
  });
}

process.exit(t.done() ? 1 : 0);
