#!/usr/bin/env node
'use strict';
/*
 * WhatsApp: the inbox (phase 2).
 *
 * The browser holds no WhatsApp credentials and cannot fabricate a
 * message: inbound traffic is written only by wa-webhook, replies only
 * by wa-send, and the client's sole direct write is its own read
 * marker. What this file holds to account:
 *
 *   THE WEBHOOK'S READING OF META'S PAYLOADS. A coexistence echo (the
 *   shop typing on its own phone) must file as OUTBOUND -- treating it
 *   as a customer speaking would reopen 24-hour windows the customer
 *   never opened. An order message's payload must survive whole,
 *   because phase 3 reads carts out of exactly that column.
 *
 *   THE SIGNATURE. A POST that does not carry a valid HMAC of the raw
 *   body under the app secret is not from Meta and must bounce.
 *
 *   THE 24-HOUR WINDOW, on the server. The composer greying out is a
 *   courtesy; wa-send re-checks and refuses, so a stale tab cannot burn
 *   a send against a closed window. And "never wrote" means CLOSED --
 *   a window that was never opened is not an open window.
 *
 * Run: node test/whatsapp-inbox.test.js   (or: npm test)
 */
const crypto = require('crypto');
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp inbox');
const src = read('index.html');
const hookSrc = read('supabase/functions/wa-webhook/index.ts');
const sendSrc = read('supabase/functions/wa-send/index.ts');
const migSrc = read('supabase/migrations/0052_wa_inbox.sql');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* ---------- 1. the webhook reads Meta's payloads --------------------- */
let hook = null; let err = null;
try {
  hook = compileScope(
    [extractFunction(hookSrc, 'messageBody', 'wa-webhook'),
     extractFunction(hookSrc, 'normalizeChange', 'wa-webhook'),
     extractFunction(hookSrc, 'validSignature', 'wa-webhook')],
    {}, ['messageBody', 'normalizeChange', 'validSignature'], { typescript: true });
} catch (e) { err = e; }
t.check(!!hook, `the webhook helpers compile${err ? ` (${err.message})` : ''}`);
if (!hook) process.exit(1);

{
  const value = {
    metadata: { phone_number_id: '106540' },
    contacts: [{ wa_id: '256772123456', profile: { name: 'Kevin' } }],
    messages: [
      { id: 'wamid.A', from: '256772123456', timestamp: '1785998400', type: 'text', text: { body: 'How much is cement?' } },
      { id: 'wamid.B', from: '256772123456', timestamp: '1785998460', type: 'image', image: { caption: 'this one' } },
      { id: 'wamid.C', from: '256772123456', timestamp: '1785998520', type: 'order', order: { catalog_id: 'x', product_items: [{ id: 'P1', quantity: 3 }] } },
      { from: '256772123456', type: 'text' },   // no id: not a message
    ],
    statuses: [{ id: 'wamid.OUT1', status: 'delivered', timestamp: '1785998600' }],
  };
  const { phoneNumberId, events } = hook.normalizeChange(value);
  eq(phoneNumberId, '106540', 'the business number is read from metadata');
  eq(events.length, 4, 'three messages and a status; the id-less fragment is dropped');
  eq(events[0].kind, 'in', 'a customer message is inbound');
  eq(events[0].name, 'Kevin', 'and carries the profile name from contacts');
  eq(events[0].body, 'How much is cement?', 'text becomes the body');
  eq(events[0].ts, '2026-08-06T06:40:00.000Z', 'the epoch-seconds timestamp becomes ISO');
  eq(events[1].body, '[image] this one', 'an image shows as its kind plus caption');
  eq(events[2].body, '[order]', 'an order shows as its kind');
  t.check(events[2].payload && events[2].payload.order && events[2].payload.order.product_items[0].quantity === 3,
    'and the order payload survives WHOLE — phase 3 reads carts out of it');
  eq(events[3].kind, 'status', 'a delivery status is its own event');
  eq(events[3].status, 'delivered', 'carrying the state');

  /* The coexistence echo: the shop typing on its own phone. */
  const echo = hook.normalizeChange({
    metadata: { phone_number_id: '106540' },
    message_echoes: [{ id: 'wamid.E', to: '256772123456', timestamp: '1785998700', type: 'text', text: { body: 'It is 45,000' } }],
  });
  eq(echo.events[0].kind, 'out', 'an echo files as OUTBOUND, not as the customer speaking');
  eq(echo.events[0].waId, '256772123456', 'attributed to the customer conversation by its `to`');
  const echo2 = hook.normalizeChange({
    metadata: { phone_number_id: '106540' },
    smb_message_echoes: [{ id: 'wamid.F', to: '256772123456', type: 'text', text: { body: 'hi' } }],
  });
  eq(echo2.events[0].kind, 'out', 'under either field name Meta uses for echoes');

  t.check(/inbound: ev\.kind === "in"/.test(hookSrc) || /ev\.kind === "in"\)/.test(hookSrc),
    'and only real inbound moves the 24h window anchor (last_inbound_at)');
}

/* ---------- 2. the signature ----------------------------------------- */
{
  const secret = 'shh-testing';
  const body = '{"entry":[{"changes":[]}]}';
  const good = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  const checks = [
    hook.validSignature(body, good, secret).then((ok) => t.check(ok, 'a genuine Meta signature passes')),
    hook.validSignature(body + ' ', good, secret).then((ok) => t.check(!ok, 'a tampered body fails')),
    hook.validSignature(body, 'sha256=' + '0'.repeat(64), secret).then((ok) => t.check(!ok, 'a forged digest fails')),
    hook.validSignature(body, null, secret).then((ok) => t.check(!ok, 'a missing header fails')),
    hook.validSignature(body, 'md5=abc', secret).then((ok) => t.check(!ok, 'a wrong scheme fails')),
  ];
  module.exports = Promise.all(checks);   // awaited at the bottom
}

/* ---------- 3. the window, on the server ----------------------------- */
{
  let send = null; let sErr = null;
  try {
    send = compileScope([extractFunction(sendSrc, 'windowState', 'wa-send')],
      { WINDOW_MS: 24*60*60*1000 }, ['windowState'], { typescript: true });
  } catch (e) { sErr = e; }
  t.check(!!send, `wa-send's window helper compiles${sErr ? ` (${sErr.message})` : ''}`);
  if (send) {
    const now = Date.parse('2026-08-06T12:00:00Z');
    eq(send.windowState('2026-08-05T13:00:00Z', now).open, true, '23 hours after the customer wrote: open');
    eq(send.windowState('2026-08-05T11:00:00Z', now).open, false, '25 hours after: closed');
    eq(send.windowState(null, now).open, false, 'a customer who never wrote: closed, not open-by-default');
    eq(send.windowState('garbage', now).open, false, 'an unparseable date: closed, the safe way to be wrong');
  }
  /* Scoped to the send action: the register action has its own Graph
     call earlier in the file, and a whole-file indexOf would compare
     against the wrong one. */
  const sendBlock = sendSrc.slice(sendSrc.indexOf('action === "send"'));
  const sendIdx = sendBlock.indexOf('windowState(conv.last_inbound_at');
  const graphIdx = sendBlock.indexOf('fetch(`${GRAPH_BASE}');
  t.check(sendIdx > -1 && graphIdx > -1 && sendIdx < graphIdx,
    'wa-send re-checks the window BEFORE any bytes go to Meta');
  t.check(/windowClosed: true/.test(sendSrc), 'and the refusal is machine-readable for the composer');
  /* Present is not enough -- the refusal must be REACHED from the check. */
  t.check(/if \(!win\.open\) \{\s*\n\s*return json\(\{/.test(sendSrc),
    'a closed window actually returns, not merely computes');
  t.check(/if \(!isMember\) return json\(\{ error: "Not a member of this shop" \}, 403\);/.test(sendSrc),
    'a non-member is refused in one unconditional line');
  t.check(/if \(!resp\.ok\) \{/.test(sendSrc) && sendSrc.indexOf('if (!resp.ok) {') < sendSrc.indexOf('sent: true'),
    'a Graph failure is checked before success is claimed');
  const memberIdx = sendSrc.indexOf('is_shop_member');
  t.check(memberIdx > -1 && memberIdx < graphIdx, 'membership is checked before the Graph API is touched');
  t.check(/record failed AFTER delivery/.test(sendSrc),
    'a bookkeeping failure after delivery is reported as such — never as "not sent"');

  /* The order-receipt image travels the same gated road. Scoped to its
     own action — it sits AFTER "send", so the send pins above keep
     measuring the text action. */
  const imgBlock = sendSrc.slice(sendSrc.indexOf('action === "send-image"'));
  t.check(imgBlock.length > 10, 'wa-send knows the send-image action');
  const iWin = imgBlock.indexOf('windowState(conv.last_inbound_at');
  const iGraph = imgBlock.indexOf('fetch(`${GRAPH_BASE}');
  t.check(iWin > -1 && iGraph > -1 && iWin < iGraph,
    'an image re-checks the window BEFORE any bytes go to Meta');
  t.check(/type: "image",\s*\n\s*image: caption \? \{ link, caption \} : \{ link \},/.test(imgBlock),
    'the Graph payload is a real image message, caption optional');
  t.check(imgBlock.includes('!/^https:\\/\\//.test(link)'),
    'only an https link is forwarded — Meta fetches it itself');
  t.check(/msg_type: "image", body: caption \? "\[image\] " \+ caption : "\[image\]"/.test(imgBlock),
    'recorded the way the webhook records inbound media — the thread already knows how to show it');
  t.check(/image record failed AFTER delivery/.test(imgBlock),
    'and a bookkeeping failure after an image delivery is reported as such too');

  /* The register action: the dashboard's opaque toast, replaced by
     Meta's real sentence. */
  const regBlock = (/action === "register"[\s\S]*?action === "send"/.exec(sendSrc) || [''])[0];
  t.check(/err\?\.error_data\?\.details \|\| err\?\.message/.test(regBlock),
    'a failed registration surfaces Meta\'s own reason, detail first');
  t.check(/\/register`/.test(regBlock) && /messaging_product: "whatsapp", pin/.test(regBlock),
    'registration goes to the register endpoint with a PIN');
  const pinSaveAt = regBlock.indexOf('update({ pin })');
  const okCheckAt = regBlock.indexOf('if (!resp.ok)');
  t.check(pinSaveAt > -1 && okCheckAt > -1 && okCheckAt < pinSaveAt,
    'the PIN is persisted only once Meta has accepted it');
}

/* ---------- 4. the client: window label, unread, matching ------------ */
{
  const env = { data: { customers: [] }, WA_WINDOW_MS: 24*60*60*1000 };
  const NAMES = ['waWindowInfo', 'waWindowLabel', 'waConvUnread', 'waMatchCustomer'];
  let scope = null; let cErr = null;
  try {
    scope = compileScope([
      ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
      extractFunction(src, 'cfNormalisedPhone', 'index.html'),
      extractFunction(src, 'contactPhones', 'index.html'),
    ], env, NAMES);
  } catch (e) { cErr = e; }
  t.check(!!scope, `the client inbox helpers compile${cErr ? ` (${cErr.message})` : ''}`);
  if (scope) {
    const now = Date.parse('2026-08-06T12:00:00Z');
    const open = scope.waWindowInfo('2026-08-06T10:30:00Z', now);
    eq(open.open, true, 'ninety minutes in: open');
    eq(open.hoursLeft, 22, 'with the hours left stated');
    t.check(/window open/.test(scope.waWindowLabel(open)), 'and the label says so');
    const closed = scope.waWindowInfo('2026-08-01T10:00:00Z', now);
    t.check(/customer has to message first/.test(scope.waWindowLabel(closed)),
      'a closed window explains itself instead of just greying out');
    eq(scope.waWindowInfo(null, now).open, false, 'never wrote: closed here too');

    eq(scope.waConvUnread({ last_inbound_at: null, last_read_at: null }), false,
      'a conversation with no inbound is not unread');
    eq(scope.waConvUnread({ last_inbound_at: '2026-08-06T10:00:00Z', last_read_at: null }), true,
      'inbound never read: unread');
    eq(scope.waConvUnread({ last_inbound_at: '2026-08-06T10:00:00Z', last_read_at: '2026-08-06T11:00:00Z' }), false,
      'read after the last inbound: read');
    eq(scope.waConvUnread({ last_inbound_at: '2026-08-06T12:30:00Z', last_read_at: '2026-08-06T11:00:00Z' }), true,
      'a newer inbound reopens it');
    eq(scope.waConvUnread({ last_inbound_at: '2026-08-06T11:00:00Z', last_read_at: '2026-08-06T11:00:00Z' }), false,
      'read at the exact moment of the inbound counts as read');

    env.data.customers = [
      { id: 'C1', name: 'Okello', phone: '0772 123 456' },
      { id: 'C2', name: 'Namono', phone: '0700 000 111' },
    ];
    eq((scope.waMatchCustomer('256772123456') || {}).id, 'C1',
      'a WhatsApp id matches the customer whose phone ends the same way');
    eq(scope.waMatchCustomer('256799999999'), null, 'no match, no guess');

    /* People message from whichever line has signal -- which is the
       whole reason for having two. Matching only the first number would
       show a regular customer as an unknown number every time they used
       their other phone.

       The list is put back afterwards: later checks in this block APPEND
       to it, and replacing it outright left them testing a different
       fixture than the one they set up. */
    const savedCustomers = env.data.customers;
    env.data.customers = [{ id: 'C9', name: 'Two Lines', phone: '0772111222', phone2: '0700333444' }];
    eq((scope.waMatchCustomer('256700333444') || {}).id, 'C9',
      'a customer messaging from their SECOND number is still recognised');
    eq((scope.waMatchCustomer('256772111222') || {}).id, 'C9', 'and from their first');
    env.data.customers = savedCustomers;
    env.data.customers.push({ id: 'C3', name: 'Other Okello', phone: '+256 772 123456' });
    eq(scope.waMatchCustomer('256772123456'), null,
      'TWO customers sharing the suffix: no match — a hint must never merge people');
  }
}

/* ---------- 5. custody of the credentials and the writes ------------- */
{
  /* The connect checklist NAMES the secret (telling the user to set it
     in their own terminal) -- naming it is fine; calling Meta or holding
     a bearer token is not. */
  t.check(!/graph\.facebook\.com|Bearer \$\{/.test(src),
    'the browser never calls Meta directly and holds no bearer token');
  const secretMentions = (src.match(/WHATSAPP_ACCESS_TOKEN/g) || []).length;
  const checklist = (/waRenderConnect[\s\S]*?<\/div>`;/.exec(src) || [''])[0];
  t.check(secretMentions > 0 && (checklist.match(/WHATSAPP_ACCESS_TOKEN/g) || []).length === secretMentions,
    'the token is mentioned only in the setup instructions, nowhere executable');
  t.check(!/from\('wa_messages'\)\s*\.\s*(insert|upsert|update|delete)/.test(src),
    'the client never writes a message row');
  const convWrites = src.match(/from\('wa_conversations'\)\s*\.\s*(insert|upsert|update|delete)\(([^)]*)/g) || [];
  t.check(convWrites.length === 1 && /update\(\{ last_read_at/.test(convWrites[0]),
    'the ONLY conversation write from the client is its own read marker');
  t.check(/for select using \(is_shop_member\(shop_id\)\);/.test(migSrc)
    && !/on wa_messages\s+for all/.test(migSrc),
    'and the RLS backs that up: members read messages, nothing more');
  /* Anchored to the line start: a commented-out constraint still
     CONTAINS the words, and this must fail on it. */
  t.check(/\n  unique \(shop_id, wamid\)/.test(migSrc),
    'a retried or echoed message can only land once');
  t.check(/onConflict: "shop_id,wamid", ignoreDuplicates: true/.test(hookSrc),
    'and the webhook expects the bounce instead of erroring on it');
}

/* ---------- 6. all of it is REACHED ---------------------------------- */
{
  /* One door now, and it is Messages. The chats were fetched only when
     a separate WhatsApp page was opened, so Messages' own lanes --
     Waiting on you, Came back -- sat empty for a shop that never
     visited it. Entering Messages starts the desk, which draws the rest
     once it knows whether the number is linked. */
  t.check(/if\(tab==='followups'\)\{ renderFollowUps\(\); waInboxEnter\(\); \}/.test(src),
    'entering Messages starts the desk, which draws the rest once it knows the number is linked');
  t.check(/if\(currentActiveTab !== 'followups' \|\| !waInbox\.configured\)\{\s*\n?\s*clearInterval\(waInbox\.timer\); waInbox\.timer = null; return;/.test(src),
    'the poller stops itself when the user leaves the screen');
  /* "Answer on WhatsApp" on a lane used to change page. It opens the
     thread on Chats now, and hands waOpenConv a NUMBER: the id comes off
     a data attribute as a string, and the queue finds conversations with
     ===, so a string id opened nothing. */
  t.check(/fupTab = 'chats';\s*\n\s*renderFollowUps\(\);\s*\n\s*if\(typeof waOpenConv === 'function' && id\) waOpenConv\(Number\(id\)\);/.test(src),
    'answering from a lane opens the thread on Chats, by its numeric id');
  t.check(/action: 'send', conversationId: waInbox\.active, text/.test(src),
    'a reply goes through the edge function, with the conversation named');
  t.check(/<textarea id="wa_reply" data-conv="\$\{c\.id\}" placeholder="Reply…" \$\{w\.open\?'':'disabled'\}/.test(src),
    'a closed window disables the composer before the server has to refuse');
  t.check(/const body = await error\.context\.json\(\); if\(body && body\.error\) msg = body\.error;/.test(src),
    'a refusal reaches the user as its real sentence, not "non-2xx status code"');
  /* Learned live: the 12s poll re-renders the panel, and the rebuild was
     eating whatever the user had half-typed into the composer. */
  t.check(/if\(prevTa && prevTa\.dataset\.conv\) waInbox\.drafts\[prevTa\.dataset\.conv\] = prevTa\.value;/.test(src),
    'the draft is captured before the panel is rebuilt');
  t.check(/newTa\.value = waInbox\.drafts\[newTa\.dataset\.conv\] \|\| '';/.test(src),
    'and restored to the SAME conversation it was typed for');
  t.check(/if\(!sameThread \|\| nearBottom\) msgsEl\.scrollTop = msgsEl\.scrollHeight;/.test(src),
    'a poll follows new messages only when the reader was already at the bottom');
  t.check(/delete waInbox\.drafts\[String\(waInbox\.active\)\];/.test(src),
    'a sent reply clears its draft');
  t.check(/return json\(\{ received: true \}\);/.test(hookSrc)
    && /console\.error\("wa-webhook: processing failed", e\);/.test(hookSrc),
    'the webhook answers 200 even when processing fails — a bug costs one event, not the channel');
  t.check(/mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN/.test(hookSrc),
    'the GET handshake needs the real verify token — an unset one never matches');
  /* Learned live: the number field lived only inside the unconfigured
     checklist, so once ANY number was saved there was no way to change
     it. The settings button must exist outside the checklist, and
     saving a different number must REPLACE the shop's mapping -- a
     second row makes every maybeSingle() lookup fail. */
  /* The way in moved from a gear beside the inbox heading to the rail's
     own channel panel, beside the facts it governs — the number, what is
     in the catalogue, whether the system answers by itself. Still
     reachable from a connected shop, which is the point of the pin: a
     shop that HAS connected must still be able to get back in. */
  /* Outside the checklist means outside waRenderConnect's own markup:
     a door drawn only by the room it opens is not a door. */
  const chanFn = extractFunction(src, 'waRenderChannel', 'index.html');
  const connFn = extractFunction(src, 'waRenderConnect', 'index.html');
  t.check(/id="wa_conn_open">Connection<\/button>/.test(chanFn)
    && !/id="wa_conn_open"/.test(connFn),
    'connection settings are reachable outside the checklist');
  t.check(/conn\.addEventListener\('click', \(\)=>\{[\s\S]{0,240}?waRenderConnect\(\);/.test(src),
    'and the button actually opens them');
  /* And back out again. The old checklist was a dead end you left by
     switching tabs; a shop that opened it to check one number could not
     return to the desk it came from. */
  t.check(/id="wa_conn_back">Back to the desk<\/button>/.test(src),
    'with a way back to the desk for a shop that is already connected');
  t.check(/\.delete\(\)\.eq\('shop_id', currentShopId\)\.neq\('phone_number_id', v\);/.test(src),
    'saving a new number replaces the old mapping instead of standing beside it');
}

/* async signature checks finish before the verdict */
(module.exports || Promise.resolve()).then(() => {
  process.exit(t.done() ? 1 : 0);
});
