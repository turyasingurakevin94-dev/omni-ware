#!/usr/bin/env node
'use strict';
/*
 * Mobile money payment initiation -- the push sent to an agent's phone.
 *
 * This is the one place in the system that asks a real person's wallet for
 * money, so the two things that matter are that it asks for the right
 * amount and that it asks once.
 *
 * Both were wrong. The owed amount was recomputed from the order's items
 * and `amount_paid` was fetched and then ignored, so an order the agent had
 * part-paid was pushed for its full value again -- and both webhooks ADD to
 * amount_paid rather than replacing it, so approving that charged them the
 * settled part twice. Nothing stopped a second push either.
 *
 * The crediting side is checked here too, because three functions apply a
 * successful payment to an order and only one of them checked whether the
 * money actually covered it.
 *
 * Run: node test/momo-initiation.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('momo initiation');
const initSrc = read('supabase/functions/agent-initiate-momo-payment/index.ts');
const mtnHook = read('supabase/functions/mtn-payment-webhook/index.ts');
const statusFn = read('supabase/functions/check-momo-payment-status/index.ts');

// Every deployed Edge Function directory that has an index.ts, so checks
// below can search for a pattern instead of trusting a hand-written list.
function fnDirs() {
  const fs = require('fs'), path = require('path');
  const root = path.join(__dirname, '..', 'supabase', 'functions');
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(root, d.name, 'index.ts')))
    .map(d => d.name).sort();
}

/* ---------- 1. phone numbers ------------------------------------------ */
/*
 * Agents type these however they think of them, and the two providers want
 * different shapes. Only MTN's was handled, and only for a number that
 * already arrived with a "+", so the local form an agent actually uses went
 * out as an MSISDN of "0772123456" -- not their line, and not anyone's.
 */
const { normaliseUgandaMsisdn } = compileScope(
  [extractFunction(initSrc, 'normaliseUgandaMsisdn', 'agent-initiate-momo-payment')], {}, ['normaliseUgandaMsisdn'], { typescript: true },
);
{
  const SAME = ['0772123456', '+256772123456', '256772123456', '+256 772 123 456', '0772 123 456', '256-772-123-456'];
  const got = SAME.map((s) => normaliseUgandaMsisdn(s));
  const allSame = got.every((g) => g && g.international === '256772123456' && g.local === '772123456');
  t.check(allSame,
    allSame ? `every way of writing one number lands on the same MSISDN (${SAME.length} forms)`
            : `these did not normalise alike: ${SAME.map((s, i) => `${s} -> ${JSON.stringify(got[i])}`).join('; ')}`);
  t.check(normaliseUgandaMsisdn('0772123456').international === '256772123456'
    && normaliseUgandaMsisdn('0772123456').local === '772123456',
    'MTN gets the international form and Airtel the bare nine digits');
}
{
  const BAD = ['', null, undefined, '077212345', '07721234567', '0812345678', '256812345678', 'not a phone', '+254772123456'];
  const accepted = BAD.filter((b) => normaliseUgandaMsisdn(b) !== null);
  t.check(accepted.length === 0,
    accepted.length ? `these were accepted as Ugandan mobile numbers: ${JSON.stringify(accepted)}`
                    : `too short, too long, wrong prefix and junk are all refused (${BAD.length} cases)`);
}
{
  // Refused at the door rather than pushed and left to fail somewhere in a
  // provider's API.
  t.check(/const msisdn = normaliseUgandaMsisdn\(phone\);[\s\S]{0,120}if \(!msisdn\) return json/.test(initSrc),
    'an unusable number is rejected before any provider is called');
  t.check(/phone: msisdn\.international/.test(initSrc) && /phone: msisdn\.local/.test(initSrc),
    'each provider is handed the shape it expects');
  t.check(!/opts\.phone\.replace/.test(initSrc),
    'no provider is left doing its own ad-hoc phone parsing');
}

/* ---------- 2. it asks for what is still owed ------------------------- */
{
  t.check(/const alreadyPaid = Number\(order\.amount_paid\) \|\| 0;/.test(initSrc)
    && /const amount = Math\.round\(orderTotal - alreadyPaid\);/.test(initSrc),
    'the amount pushed is the order total less what has already been paid');
  t.check(!/const amount = \(payload\.items \|\| \[\]\)\.reduce/.test(initSrc),
    'the full order total is no longer pushed regardless of payments');
  t.check(/if \(!\(amount > 0\)\)/.test(initSrc) && /already settled/.test(initSrc),
    'a fully settled order is refused rather than pushed for zero or less');

  // The arithmetic itself, on the case that was being charged twice.
  const owed = (total, paid) => Math.round(total - paid);
  t.check(owed(500000, 200000) === 300000,
    `a part-paid order asks only for the balance (${owed(500000, 200000)})`);
  t.check(owed(500000, 0) === 500000, 'an untouched order asks for the whole thing');
  t.check(!(owed(500000, 500000) > 0) && !(owed(500000, 600000) > 0),
    'a settled or overpaid order asks for nothing');
}

/* ---------- 3. it asks once ------------------------------------------- */
/*
 * A double tap raised two pushes for the same order. Approve both and both
 * are credited, because every crediting path adds to amount_paid.
 */
{
  t.check(/\.eq\("status", "pending"\)/.test(initSrc) && /order_id", orderId/.test(initSrc),
    'an outstanding request for this order is looked up before a new one is raised');
  t.check(/if \(inFlight && Date\.now\(\) - new Date\(inFlight\.created_at\)\.getTime\(\) < PENDING_REUSE_MS\)/.test(initSrc),
    'a recent outstanding request is reused instead of duplicated');
  t.check(/reused: true/.test(initSrc),
    'the caller is told it got the existing request back, not a new one');

  const window = /const PENDING_REUSE_MS = ([^;]+);/.exec(initSrc);
  const ms = window ? Function(`return ${window[1]}`)() : 0;
  t.check(ms >= 60000 && ms <= 10 * 60000,
    `the reuse window is long enough to cover finding a phone, short enough not to wedge the next attempt (${ms}ms)`);

  // The lookup has to happen before the insert, or it only ever finds the
  // row it just created.
  t.check(initSrc.indexOf('in_flight_lookup') < initSrc.indexOf('insert_pending'),
    'the outstanding-request check runs before the new row is inserted');
}

/* ---------- 4. a payment only releases an order once it covers it ----- */
/*
 * Three functions apply a successful payment, and all three marked an order
 * paid for any amount at all -- which matters the moment a partial payment
 * is possible, and asking for the balance is exactly what makes it possible.
 * (The rule was first written correctly in airtel-collection-callback, since
 * retired with the duplicate Airtel path.)
 */
{
  const covers = (newPaid, total) => newPaid + 0.5 >= total;
  t.check(covers(500000, 500000) === true, 'paying the full amount releases the order');
  t.check(covers(200000, 500000) === false, 'a short payment does not');
  t.check(covers(500000.4, 500000) === true, 'a fractional shilling either way is not treated as short');
  t.check(covers(600000, 500000) === true, 'an overpayment still releases it');
}
{
  /*
   * This used to name the two functions it knew about. A third copy of
   * applyMomoPaymentToOrder lived in airtel-payment-webhook and was never
   * on the list, so it kept marking orders paid for whatever arrived and
   * the suite stayed green. Enumerating the copies is what hid the bug, so
   * this now DISCOVERS every copy: a fourth one cannot opt out by not
   * being mentioned here.
   */
  const carriers = fnDirs()
    .map(name => [name, read(`supabase/functions/${name}/index.ts`)])
    .filter(([, src]) => /function applyMomoPaymentToOrder/.test(src));

  // There is now exactly ONE. The webhooks stopped interpreting callbacks
  // and became thin triggers that ask check-momo-payment-status for an
  // authoritative answer, which took two copies out of existence rather
  // than keeping them in step. Still discovered by search, so a copy
  // reappearing anywhere fails here.
  t.check(carriers.length === 1 && carriers[0][0] === 'check-momo-payment-status',
    `applyMomoPaymentToOrder exists once, in the poller (found ${carriers.length}: ${carriers.map(c => c[0]).join(', ') || 'none'})`);
  carriers.forEach(([name, src]) => {
    t.check(/if \(newAmountPaid \+ 0\.5 >= orderTotal\) nextPayload\.agentPaymentStatus = "paid";/.test(src),
      `${name} only marks an order paid once the money covers it`);
    t.check(!/payload: \{ \.\.\.payload, payments, agentPaymentStatus: "paid" \}/.test(src),
      `${name} no longer marks an order paid for whatever arrived`);
  });
  // They all bank the money regardless -- a short payment is still money
  // received, and the earlier bug was it vanishing entirely.
  carriers.forEach(([name, src]) => {
    t.check(/from\("cash_txns"\)\s*\.insert|from\("cash_txns"\)\.insert/.test(src.replace(/\n\s*/g, '')),
      `${name} banks the money before deciding whether it releases the order`);
  });
}

/* ---------- 5. production means production ---------------------------- */
/*
 * Both branches of the Airtel host pointed at the UAT endpoint. A shop that
 * had switched itself to production would believe it was collecting real
 * money against a test gateway that confirms nothing.
 */
{
  t.check(/const AIRTEL_PRODUCTION_HOST = /.test(initSrc)
    && /if \(environment === "production" && !AIRTEL_PRODUCTION_HOST\)/.test(initSrc),
    'Airtel production is refused outright while no live endpoint is configured');
  const uatHits = (initSrc.match(/openapiuat\.airtel\.africa/g) || []).length;
  t.check(uatHits === 1,
    `the UAT host appears once, on the sandbox branch only (${uatHits} occurrences)`);
  t.check(/Switch this provider back to sandbox/.test(initSrc),
    'and the refusal says what to do about it');
}

/* ---------- 6. the order still belongs to the caller ------------------ */
{
  t.check(/if \(payload\.originAgentId !== agentId\) return json\(\{ error: "This order does not belong to you" \}, 403\)/.test(initSrc),
    'an agent can only raise a payment against their own order');
  t.check(/current_agent_id/.test(initSrc) && /if \(!agentId\) return json/.test(initSrc),
    'the agent identity comes from the database, not from the request');
  t.check(initSrc.indexOf('current_agent_id') < initSrc.indexOf('agent_mobile_payments'),
    'identity is established before anything is written');
}

/* ---------- 7. the duplicate Airtel path stays retired ---------------- */
/*
 * There were two Airtel implementations on two ledger tables. The agent app
 * only ever called agent-initiate-momo-payment; airtel-collection-initiate
 * and airtel-collection-callback were a parallel path on airtel_transactions
 * that nothing invoked, but stayed deployed and reachable, and carried the
 * amount/duplicate/msisdn bugs their twin had already been fixed for. The
 * README still described them as live, which is what kept them looking real.
 *
 * They are gone. This holds that: no retired function comes back, no client
 * reaches for one, and the docs do not advertise them again.
 */
{
  const gone = ['airtel-collection-initiate', 'airtel-collection-callback'];
  const dirs = fnDirs();
  gone.forEach(name => {
    t.check(!dirs.includes(name), `${name} is not back in supabase/functions`);
  });

  ['agent.html', 'index.html', 'worker.html', 'shared-worker.js', 'catalogue.html'].forEach(f => {
    const src = read(f).split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n');
    const hit = gone.filter(n => src.includes(n));
    t.check(hit.length === 0, `${f} does not call a retired Airtel function${hit.length ? ` (${hit.join(', ')})` : ''}`);
  });

  // The README may still NAME them -- it explains the retirement, and that
  // history is worth keeping. What it must not do is tell anyone to deploy
  // one or point a provider at one.
  const readme = read('supabase/functions/README.md');
  gone.forEach(name => {
    t.check(!new RegExp(`functions deploy ${name}`).test(readme),
      `README does not tell anyone to deploy ${name}`);
    t.check(!new RegExp(`functions\\.supabase\\.co/${name}`).test(readme),
      `README does not give ${name} as a callback URL`);
  });
  t.check(/functions\.supabase\.co\/airtel-payment-webhook/.test(readme),
    'and it gives the surviving webhook as the Airtel callback URL instead');

  // One Airtel initiator, and it is the shared one. Matched on the merchant
  // payments endpoint specifically -- that is the call that RAISES a charge.
  // check-momo-payment-status also talks to Airtel, on /standard/v1/payments
  // to read a result back, which is not the same thing.
  const initiators = dirs.filter(n => n !== 'agent-initiate-momo-payment'
    && /merchant\/v\d\/payments/.test(read(`supabase/functions/${n}/index.ts`)));
  t.check(initiators.length === 0,
    `agent-initiate-momo-payment is the only function that raises an Airtel payment${initiators.length ? ` (also: ${initiators.join(', ')})` : ''}`);
  t.check(dirs.includes('airtel-payment-webhook'),
    'airtel-payment-webhook is the surviving Airtel callback -- its URL is the one for the portal');
}
{
  /*
   * The retired callback was the only function that ever verified a callback
   * signature. Retiring it without carrying that across would have deleted
   * the one thing standing between "make the webhook reachable" and "anyone
   * with a reference can mark an order paid".
   */
  const hook = read('supabase/functions/airtel-payment-webhook/index.ts');
  t.check(/AIRTEL_CALLBACK_HMAC_KEY/.test(hook) && /async function computeHmac/.test(hook),
    'the HMAC verification survived the retirement');
  t.check(/const rawBody = await req\.text\(\);/.test(hook) && !/await req\.json\(\)/.test(hook),
    'the body is read as raw bytes, because the hash is over exactly what was sent');
  // Comments stripped: the header prose names agent_mobile_payments while
  // explaining the design, and an index comparison against raw source finds
  // that sentence rather than the query.
  const hookCode = hook.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n');
  t.check(hookCode.indexOf('computeHmac(rawBody') < hookCode.indexOf('from("agent_mobile_payments")'),
    'the signature is checked before any payment row is touched');
  t.check(/if \(computed !== body\.hash\)[\s\S]{0,160}403/.test(hook),
    'a mismatched signature is refused outright');
  t.check(/if \(CALLBACK_HMAC_KEY\)/.test(hook),
    'and it stays dormant while the key is unset, so behaviour is unchanged until it is configured');
}


process.exit(t.done() ? 1 : 0);
