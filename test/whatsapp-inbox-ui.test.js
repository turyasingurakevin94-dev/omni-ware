#!/usr/bin/env node
'use strict';
/*
 * WhatsApp: the queue, and the record inside an open row.
 *
 * WHAT THIS FILE USED TO ASSERT, AND WHY IT STOPPED BEING TRUE.
 *
 * It used to hold "the clothes of a real messaging app": an avatar with
 * initials and a STABLE hue per contact, chat bubbles clustering by
 * side, a timestamp floated into the last line's trailing space, and
 * pre-wrap on the text span but never on the bubble. Every one of those
 * assertions was correct about the code it guarded. They are gone
 * because the screen they guarded is gone.
 *
 * The argument: the owner already has WhatsApp on the phone in their
 * pocket, and it is better at being WhatsApp than this ever will be.
 * The only thing this screen can do that the phone cannot is PRICE the
 * ask from the shop's own books -- and that was the one thing it did
 * not show. So the page is a work queue now: who is WAITING (they spoke
 * last and nothing has gone back), oldest ask first, and the row opens
 * in place onto the thread as a transcript, what the ask matched to at
 * today's price, and the reply already written.
 *
 * The avatar went with the bubbles. A hue per contact was the clearest
 * case in the app of colour that means nothing: it identified nobody,
 * it repeated the name already on the row, and it put a dozen saturated
 * circles on a screen whose accent is meant to appear exactly once.
 * waInitials and waAvatarHue are deleted, not merely unused.
 *
 * WHAT SURVIVED, unchanged and still asserted here: the snippet each
 * chat shows, the unread count taken off the read marker, the day
 * grouping, the tick ladder, and the search that narrows without
 * flooding. Those are facts about messages, not about bubbles.
 *
 * WHAT IS NEW: waWaitingConvs, which is the whole thesis of the
 * redesign expressed as a function -- waiting is not unread -- and
 * waFmtWait, the age that never says "0 min".
 *
 * Run: node test/whatsapp-inbox-ui.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp inbox ui');
const src = read('index.html');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const NAMES = ['waConvSnippets', 'waSnippetText', 'waConvUnreadCount', 'waThreadGroups',
  'waTickHTML', 'waConvFilter', 'waWaitingConvs', 'waFmtWait'];
let scope = null; let err = null;
try {
  scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the queue's furniture compiles${err ? ` (${err.message})` : ''}`);
if (!scope) process.exit(1);

/* ---------- 1. WAITING is not UNREAD ---------------------------------
   The distinction this screen is built on. Unread asks whether the
   owner OPENED a chat; waiting asks whether the shop ANSWERED it, and
   only the second one costs money -- a question read on the phone at
   the counter and never replied to is a sale walking next door, and the
   old screen counted it as handled. */
{
  const NOW = Date.parse('2026-09-04T12:00:00Z');
  const convs = [
    { id: 1, profile_name: 'Kato Construction Ltd', wa_id: '256772333444' },
    { id: 2, profile_name: 'Sarah Namono', wa_id: '256700111222' },
    { id: 3, profile_name: 'Answered Already', wa_id: '256700000003' },
    { id: 4, profile_name: 'Never Wrote', wa_id: '256700000004' },
  ];
  const msgs = [
    { conversation_id: 1, direction: 'in', sent_at: '2026-09-04T11:19:00Z' },   // 41 min
    { conversation_id: 2, direction: 'in', sent_at: '2026-09-04T09:00:00Z' },   // 3 h
    { conversation_id: 3, direction: 'in', sent_at: '2026-09-04T08:00:00Z' },
    { conversation_id: 3, direction: 'out', sent_at: '2026-09-04T08:05:00Z' },  // answered
  ];
  const w = scope.waWaitingConvs(convs, msgs, NOW);
  eq(w.length, 2, 'only chats whose NEWEST message came in are waiting');
  eq(w[0].conv.id, 2, 'and the longest wait leads — the person most likely to have given up');
  eq(Math.round(w[1].waitedMins), 41, 'the age is counted from their last message');
  t.check(!w.some((x) => x.conv.id === 3), 'a chat the shop answered is not waiting, read or unread');
  t.check(!w.some((x) => x.conv.id === 4), 'a chat with no message in the window is not waiting either');

  /* A conversation the owner has READ but not answered is still
     waiting. This is the case the old "unread chats" tile lost. */
  const readNotAnswered = scope.waWaitingConvs(
    [{ id: 1, profile_name: 'X', wa_id: '1', last_read_at: '2026-09-04T11:59:00Z' }],
    [{ conversation_id: 1, direction: 'in', sent_at: '2026-09-04T11:19:00Z' }], NOW);
  eq(readNotAnswered.length, 1, 'read is not answered — it still owes a reply');

  eq(scope.waWaitingConvs(null, null, NOW).length, 0, 'no data is no queue, not a crash');
}

/* ---------- 2. an age that never lies ------------------------------- */
{
  eq(scope.waFmtWait(0.4), 'just now', 'less than a minute has not waited "0 min"');
  eq(scope.waFmtWait(41), '41 min', 'minutes up to the hour');
  eq(scope.waFmtWait(190), '3 h', 'then hours');
  eq(scope.waFmtWait(60 * 60), '3 d', 'then days, once hours stop meaning anything');
  eq(scope.waFmtWait(null), '—', 'an age nobody can compute is a dash, never a zero');
}

/* ---------- 3. the queue row's second line --------------------------- */
{
  const msgs = [
    { conversation_id: 1, direction: 'in', msg_type: 'text', body: 'old line', sent_at: '2026-08-06T09:00:00Z' },
    { conversation_id: 1, direction: 'out', msg_type: 'text', body: 'newest line', sent_at: '2026-08-06T11:00:00Z' },
    { conversation_id: 2, direction: 'in', msg_type: 'order', body: '[order]', sent_at: '2026-08-06T10:00:00Z' },
  ];
  const snips = scope.waConvSnippets(msgs);
  eq(scope.waSnippetText(snips.get(1)), 'You: newest line',
    'the snippet is the NEWEST message, and the shop\'s own words say You:');
  t.check(scope.waSnippetText(snips.get(2)).includes('Order'),
    'an order snippet reads as an order, not as [order]');
  /* Never emoji: the design system says draw the mark or say the word,
     and a cart glyph in a queue row was the app's own copy breaking it. */
  t.check(!/[\u{1F300}-\u{1FAFF}]/u.test(scope.waSnippetText(snips.get(2))),
    'and it says the word rather than drawing a shopping-trolley emoji');
  eq(scope.waSnippetText(undefined), '', 'no messages yet is an empty line, not a crash');
}

/* ---------- 4. the count, off the read marker ------------------------ */
{
  const msgs = [
    { conversation_id: 1, direction: 'in', sent_at: '2026-08-06T10:00:00Z' },
    { conversation_id: 1, direction: 'in', sent_at: '2026-08-06T11:00:00Z' },
    { conversation_id: 1, direction: 'out', sent_at: '2026-08-06T11:30:00Z' },   // the shop's reply is not unread
    { conversation_id: 2, direction: 'in', sent_at: '2026-08-06T10:00:00Z' },
  ];
  eq(scope.waConvUnreadCount({ id: 1, last_read_at: '2026-08-06T10:30:00Z' }, msgs), 1,
    'only inbound past the read marker counts');
  eq(scope.waConvUnreadCount({ id: 1, last_read_at: null }, msgs), 2,
    'never opened: everything inbound counts');
  eq(scope.waConvUnreadCount({ id: 3, last_read_at: null }, msgs), 0,
    'a silent conversation counts nothing');
}

/* ---------- 5. the transcript, cut into days ------------------------- */
{
  const NOW = Date.parse('2026-08-06T12:00:00Z');
  const groups = scope.waThreadGroups([
    { sent_at: '2026-08-04T10:00:00Z' },
    { sent_at: '2026-08-05T09:00:00Z' },
    { sent_at: '2026-08-05T10:00:00Z' },
    { sent_at: '2026-08-06T08:00:00Z' },
  ], NOW);
  eq(groups.length, 3, 'four messages across three days make three groups');
  t.check(/Aug/.test(groups[0].label), 'an older day wears its date');
  eq(groups[1].label, 'Yesterday', 'yesterday is Yesterday');
  eq(groups[1].msgs.length, 2, 'and holds both of its messages');
  eq(groups[2].label, 'Today', 'today is Today');
}

/* ---------- 6. the tick ladder ---------------------------------------
   Kept, and renamed into the screen's own namespace with the rest of
   the block. "Did my reply land" is a real question about money owed an
   answer; it did not belong to the bubbles. */
{
  eq(scope.waTickHTML(null), '', 'inbound has no ladder to climb');
  t.check(scope.waTickHTML('sent').includes('✓') && !scope.waTickHTML('sent').includes('✓✓'),
    'sent is one tick');
  t.check(scope.waTickHTML('delivered').includes('✓✓'), 'delivered is two');
  t.check(scope.waTickHTML('read').includes('✓✓') && /class="wa-tick wa-read"/.test(scope.waTickHTML('read')),
    'read is two, coloured');
  t.check(/class="wa-tick wa-failed"/.test(scope.waTickHTML('failed')), 'failed says so');
}

/* ---------- 7. search that narrows, never floods --------------------- */
{
  const convs = [
    { id: 1, profile_name: 'Kevin Moses', wa_id: '256772123456' },
    { id: 2, profile_name: 'Daphne~', wa_id: '256700000001' },
  ];
  eq(scope.waConvFilter(convs, 'kev').length, 1, 'a name fragment finds its person');
  eq(scope.waConvFilter(convs, '772').length, 1, 'digits search the number');
  eq(scope.waConvFilter(convs, '').length, 2, 'no query, no filter');
  /* The trap: "kev" strips to NO digits, and an empty-digit number
     match would flood the list with everyone. */
  eq(scope.waConvFilter(convs, 'zzz').length, 0, 'a miss is a miss — empty digits match nobody');
}

/* ---------- 8. worn by the render ------------------------------------ */
{
  t.check(/waWaitingConvs\(waInbox\.convs, waInbox\.allMsgs, nowMs\)/.test(src),
    'the queue is built from who is waiting, not from who is unread');
  t.check(/class="ow-q-r wa-ask-r"/.test(src) && /class="ow-q-x"/.test(src),
    'each ask is a work-queue row that opens in place, like every other queue in the app');
  t.check(/waThreadGroups\(waInbox\.msgs, nowMs\)\.map\(g=>/.test(src)
    && /class="wa-tx-day">\$\{esc\(g\.label\)\}/.test(src),
    'the thread renders as a dated transcript, not as bubbles');
  t.check(/\$\{m\.direction==='out' \? waTickHTML\(m\.status\) : ''\}/.test(src),
    'ticks ride outbound lines only');
  t.check(/waConvUnreadCount\(c, waInbox\.allMsgs\)/.test(src),
    'a row says when they have written more than once since you looked');
  t.check(/waSnippetText\(snip\)/.test(src), 'and shows what they last said');
  /* Learned live: the aggregate fetch fed the snippets [undefined]
     until it actually selected the columns the snippets read. The queue
     now also reads `direction` off the same rows to know who spoke
     last, so the column list matters more than it did. */
  t.check(/select\('conversation_id, direction, sent_at, payload, body, msg_type'\)/.test(src),
    'and the aggregate fetch carries the columns the queue reads');
  t.check(/id="wa_conv_search"/.test(src) && /waConvFilter\(waInbox\.convs, query\)/.test(src),
    'searching widens the queue to every chat, waiting or not');
  /* The search box moved into the STATIC markup. It used to be redrawn
     by the poll every twelve seconds, which meant restoring focus and
     the cursor by hand; an element the poll never touches cannot lose
     either. The composer still needs that dance, and still does it. */
  t.check(/<input id="wa_conv_search"/.test(src),
    'and it lives in the markup, so the poll cannot eat what is being typed');
  t.check(/data-conv="\$\{c\.id\}" placeholder="Reply…" \$\{w\.open\?'':'disabled'\}/.test(src),
    'the composer kept its identity through the redesign — drafts still survive the poll');
  t.check(/waInbox\.drafts\[prevTa\.dataset\.conv\] = prevTa\.value;/.test(src),
    'and the draft is still captured before the rebuild replaces the box');

  /* The pre-fill is the redesign's one new risk: a suggestion written
     into the composer could overwrite words the owner typed. It is
     allowed to replace only what THIS screen last wrote. */
  t.check(/if\(!held \|\| \(mine && held === mine\.text\)\)\{/.test(src),
    'a suggestion never overwrites a reply the owner typed themselves');

  /* The bubbles, the hues and the tab strip are gone, and staying gone
     is the point: each was a decision, not an accident. */
  t.check(!/waInitials|waAvatarHue|wc-avatar/.test(src),
    'no avatar, and no hue that identifies nobody');
  t.check(!/class="wa-msg|wa-tabs|wa-tab-badge|wa-stat/.test(src),
    'no bubbles, no tab strip, no bordered stat cards');
  t.check(/id="wa_strip"/.test(src) && /class="ow-strip ow-strip-5"/.test(src),
    'the figures ride the layer\'s own strip: one row, hairline dividers, no cards');
  /* One accent per screen. btn-accent may appear once in the whole
     WhatsApp section's markup and once in its render -- the Send
     button. Everything else is a ghost. */
  const waJs = src.slice(src.indexOf('function waRenderInbox'), src.indexOf('async function waOpenConv'));
  eq((waJs.match(/btn-accent/g) || []).length, 1,
    'exactly one oxide button in the queue and its open row: Send');
}

process.exit(t.done() ? 1 : 0);
