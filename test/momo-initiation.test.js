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
const airtelCb = read('supabase/functions/airtel-collection-callback/index.ts');

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
 * Three functions apply a successful payment. Only airtel-collection-callback
 * checked whether the money covered the order; the other two marked it paid
 * for any amount at all, which matters the moment a partial payment is
 * possible -- which is exactly what asking for the balance makes possible.
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
  t.check(carriers.length >= 3,
    `every copy of applyMomoPaymentToOrder is found by search, not by name (found ${carriers.length}: ${carriers.map(c => c[0]).join(', ')})`);
  carriers.forEach(([name, src]) => {
    t.check(/if \(newAmountPaid \+ 0\.5 >= orderTotal\) nextPayload\.agentPaymentStatus = "paid";/.test(src),
      `${name} only marks an order paid once the money covers it`);
    t.check(!/payload: \{ \.\.\.payload, payments, agentPaymentStatus: "paid" \}/.test(src),
      `${name} no longer marks an order paid for whatever arrived`);
  });
  t.check(/if \(amount >= owed\)/.test(airtelCb),
    'airtel-collection-callback still holds the same rule it always did');

  // They all bank the money regardless -- a short payment is still money
  // received, and the earlier bug was it vanishing entirely.
  carriers.concat([['airtel-collection-callback', airtelCb]]).forEach(([name, src]) => {
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

/* ---------- 7. the second Airtel path ---------------------------------- */
/*
 * airtel-collection-initiate is a parallel Airtel implementation on its own
 * ledger table (airtel_transactions), and no client calls it -- the agent
 * app goes through agent-initiate-momo-payment for both providers. It is
 * still deployed and ACTIVE though, so any signed-in agent can reach it,
 * and it carried the exact three bugs that were fixed in its twin: the
 * amount came from the request body, the owed figure was the order total
 * with amount_paid never fetched, and nothing stopped a second push.
 *
 * These checks hold it level with the twin for as long as it exists. If the
 * path is retired, delete this block with it.
 */
{
  const airtelInit = read('supabase/functions/airtel-collection-initiate/index.ts');
  const code = airtelInit.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n');

  t.check(!/\bamount\b[^\n]*\}\s*=\s*body/.test(code),
    'the request body amount is not destructured, so it cannot be spent by accident');
  t.check(/Number\(amount\)\s*>\s*0\s*\?/.test(code) === false,
    'the pushed amount is no longer whatever the caller asked for');
  t.check(/select\("payload, amount_paid"\)/.test(code),
    'amount_paid is fetched so the balance can be worked out');
  t.check(/amountOwed\(quote\.payload\)\s*-\s*alreadyPaid/.test(code),
    'and the push is for the balance, not the order total');

  t.check(/function normaliseUgandaMsisdn/.test(code) && /normaliseUgandaMsisdn\(rawMsisdn\)/.test(code),
    'the msisdn goes through the same normaliser as the twin');
  t.check(!/replace\(\/\^\\\+\?256\/, ""\)/.test(code),
    'the old prefix-only strip, which left a local 0 in place, is gone');

  t.check(/from\("airtel_transactions"\)[\s\S]{0,220}?\.eq\("status", "pending"\)/.test(code)
    && /PENDING_REUSE_MS/.test(code),
    'a second push inside the reuse window hands back the outstanding request');
  t.check(code.includes('in_flight_lookup') && code.indexOf('in_flight_lookup') < code.indexOf('crypto.randomUUID'),
    'the duplicate check runs before a new reference is minted');
}
{
  // The normaliser is the twin's, so the local form an agent types is the
  // case that has to work. Extraction is guarded: when the function is
  // absent this has to say so as a failed check, not die with a stack
  // trace and take every check after it down as well.
  let n = null, extractErr = null;
  try {
    ({ normaliseUgandaMsisdn: n } = compileScope(
      [extractFunction(read('supabase/functions/airtel-collection-initiate/index.ts'), 'normaliseUgandaMsisdn', 'airtel-collection-initiate')],
      {}, ['normaliseUgandaMsisdn'], { typescript: true },
    ));
  } catch (e) { extractErr = e; }
  t.check(typeof n === 'function',
    `airtel-collection-initiate defines normaliseUgandaMsisdn${extractErr ? ` (${extractErr.message})` : ''}`);
  const call = v => { try { return n(v); } catch { return undefined; } };
  t.check(call('0772123456')?.local === '772123456', 'a local 0772... loses its zero');
  t.check(call('+256772123456')?.local === '772123456', 'an international +256 form normalises the same');
  t.check(call('256772123456')?.local === '772123456', 'and a bare 256 form too');
  t.check(call('0712345') === null, 'a number that is too short is refused, not truncated');
}

process.exit(t.done() ? 1 : 0);
