#!/usr/bin/env node
'use strict';
/*
 * WhatsApp: broadcasts (phase 5). The only PAID surface in the front
 * desk, and it behaves like it.
 *
 * The claims that matter:
 *
 *   STOP MEANS STOP, INSTANTLY, IN THE CUSTOMER'S OWN WORDS. The
 *   webhook honours it before anything else touches the message -- an
 *   opt-out answered with a product quote would be the system talking
 *   over the person leaving. START undoes it, nothing else does.
 *
 *   THE AUDIENCE IS CONSENT-SHAPED. People who have messaged the shop,
 *   minus everyone who said stop. Nothing is sent to a number that
 *   never wrote first.
 *
 *   THE COST COMES BEFORE THE SEND, the approval before the campaign:
 *   an unapproved template refuses the whole broadcast, because a
 *   half-failed campaign is worse than one that waits.
 *
 *   STATS ARE DERIVED, NEVER STORED. The campaign id rides each
 *   message; delivered/read are counts over rows the status webhooks
 *   already update. Fourth appearance of the no-drift rule.
 *
 * Run: node test/whatsapp-broadcasts.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp broadcasts');
const src = read('index.html');
const hookSrc = read('supabase/functions/wa-webhook/index.ts');
const sendSrc = read('supabase/functions/wa-send/index.ts');
const migSrc = read('supabase/migrations/0056_wa_broadcasts.sql');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. stop means stop --------------------------------------- */
{
  let hook = null; let err = null;
  try {
    hook = compileScope([extractFunction(hookSrc, 'waOptOutCommand', 'wa-webhook')],
      {}, ['waOptOutCommand'], { typescript: true });
  } catch (e) { err = e; }
  t.check(!!hook, `the command parser compiles${err ? ` (${err.message})` : ''}`);
  if (hook) {
    eq(hook.waOptOutCommand('STOP'), 'stop', 'STOP, however shouted');
    eq(hook.waOptOutCommand('Stop.'), 'stop', 'punctuation does not shield a stop');
    eq(hook.waOptOutCommand('unsubscribe'), 'stop', 'the formal word works too');
    eq(hook.waOptOutCommand('opt out'), 'stop', 'and the two-word one');
    eq(hook.waOptOutCommand('START'), 'start', 'START rejoins');
    eq(hook.waOptOutCommand('please stop sending me cement prices'), null,
      'a sentence CONTAINING stop is a conversation, not a command');
    eq(hook.waOptOutCommand('how much is cement'), null, 'a question is a question');
  }

  /* Honoured FIRST: the opt-out branch runs instead of the auto-quote,
     never after it. */
  const gate = (/const cmd = waOptOutCommand\(ev\.body\);[\s\S]*?\n      \} else \{\s*\n\s*await maybeAutoQuote/.exec(hookSrc) || [''])[0];
  t.check(gate.length > 0,
    'an opt-out is handled INSTEAD of the auto-quote — the system never quotes prices at someone leaving');
  t.check(/update\(\{ opt_out: cmd === "stop" \}\)/.test(hookSrc),
    'stop sets the flag, start clears it — one line, both directions');
  t.check(/you won't receive promotions from us again/i.test(hookSrc),
    'and the customer is told, in words, that it worked');
}

/* ---------- 2. the audience and the arithmetic ----------------------- */
{
  let scope = null; let err = null;
  try {
    scope = compileScope([
      extractFunction(src, 'waBroadcastAudience', 'index.html'),
      extractFunction(src, 'waBroadcastEstimate', 'index.html'),
      extractFunction(src, 'waCampaignStats', 'index.html'),
    ], {}, ['waBroadcastAudience', 'waBroadcastEstimate', 'waCampaignStats']);
  } catch (e) { err = e; }
  t.check(!!scope, `the client broadcast helpers compile${err ? ` (${err.message})` : ''}`);
  if (scope) {
    const convs = [
      { id: 1, opt_out: false }, { id: 2, opt_out: true }, { id: 3, opt_out: false },
    ];
    eq(scope.waBroadcastAudience(convs).length, 2, 'whoever said stop is OUT of the audience');
    eq(scope.waBroadcastEstimate(2, 150), 300, 'the estimate is recipients times the rate');
    eq(scope.waBroadcastEstimate(2, 'garbage'), null, 'a garbage rate is NO estimate, not zero');
    eq(scope.waBroadcastEstimate(2, -5), null, 'and a negative rate is nonsense, not a discount');

    const st = scope.waCampaignStats([
      { status: 'sent' }, { status: 'delivered' }, { status: 'read' }, { status: 'failed' },
    ]);
    eq(st.read, 1, 'one read');
    eq(st.delivered, 2, 'read IMPLIES delivered — the ticks are a ladder, not buckets');
    eq(st.failed, 1, 'a failure is counted, not hidden');
  }
}

/* ---------- 3. the paid path, gated ---------------------------------- */
{
  const bc = (/action === "broadcast"[\s\S]*?action === "send"/.exec(sendSrc) || [''])[0];
  const approvalAt = bc.indexOf('tpl.status !== "APPROVED"');
  const audienceAt = bc.indexOf('.eq("opt_out", false)');
  const loopAt = bc.indexOf('for (const conv of audience)');
  t.check(approvalAt > -1 && loopAt > -1 && approvalAt < loopAt,
    'an unapproved template refuses the WHOLE broadcast before a single send');
  t.check(audienceAt > -1 && audienceAt < loopAt,
    'the audience excludes opt-outs at the query, not in the loop');
  t.check(/payload: \{ broadcast: campaign\.id \},/.test(bc),
    'the campaign id rides every message, so stats can be counted, never stored');
  t.check(/failures\.push/.test(bc) && /failed: failures\.length/.test(bc),
    'per-recipient failures are reported, not swallowed');
  t.check(/category: "MARKETING",/.test(sendSrc) && /Reply STOP to opt out of promotions/.test(sendSrc),
    'the template is honest about being marketing, and carries its own exit');
  t.check(/\n  for select using \(is_shop_member\(shop_id\)\);/.test(migSrc)
    && !/wa_campaigns[\s\S]*?for all/.test(migSrc),
    'campaign rows: members read, only the server writes');

  /* The client's side. */
  t.check(/This is a PAID marketing send\./.test(src),
    'the confirm says PAID, with the count and the estimate in the same sentence');
  t.check(/action: 'template-ensure'/.test(src) && /action: 'broadcast', text/.test(src),
    'the button ensures the template, then sends');
  t.check(/\.eq\('payload->>broadcast', String\(c\.id\)\)/.test(src),
    'campaign stats are read back through the payload marker');
  t.check(/\$\{c\.opt_out \? ' · no promos' : ''\}/.test(src),
    'an opted-out conversation says so in the list');
  t.check(/Estimate only — Meta bills per delivered marketing message/.test(src),
    'the estimate is labelled as one');
}

process.exit(t.done() ? 1 : 0);
