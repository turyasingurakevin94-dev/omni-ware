#!/usr/bin/env node
'use strict';
/*
 * WhatsApp inbox: the clothes of a real messaging app.
 *
 * A redesign is structure, not decoration, so its parts are held like
 * logic: initials and a STABLE colour per contact (an avatar that
 * changes hue is a different person), the newest line of each chat for
 * the list, per-chat unread counts counted off the read marker, the
 * thread cut into days, and the tick ladder -- one sent, two delivered,
 * two coloured read, a mark for failed, and NOTHING on inbound, which
 * has no ladder to climb.
 *
 * Run: node test/whatsapp-inbox-ui.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('whatsapp inbox ui');
const src = read('index.html');

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

const NAMES = ['waInitials', 'waAvatarHue', 'waConvSnippets', 'waSnippetText',
  'waConvUnreadCount', 'waThreadGroups', 'waTickHTML', 'waConvFilter'];
let scope = null; let err = null;
try {
  scope = compileScope(NAMES.map((n) => extractFunction(src, n, 'index.html')), {}, NAMES);
} catch (e) { err = e; }
t.check(!!scope, `the inbox furniture compiles${err ? ` (${err.message})` : ''}`);
if (!scope) process.exit(1);

/* ---------- 1. who is who, at a glance ------------------------------- */
{
  eq(scope.waInitials('Kevin Moses'), 'KM', 'two names, two letters');
  eq(scope.waInitials('Daphne~'), 'DA', 'one name, its first two letters');
  eq(scope.waInitials('+256 795 399700'), '00', 'a bare number wears its last two digits');
  eq(scope.waInitials(''), '?', 'nobody is still somebody');

  const h1 = scope.waAvatarHue('256772123456');
  eq(scope.waAvatarHue('256772123456'), h1, 'the same contact wears the same colour, every visit');
  t.check(h1 >= 0 && h1 < 360, 'and the hue is a real hue');
  t.check(scope.waAvatarHue('256772123456') !== scope.waAvatarHue('256700000001'),
    'different contacts differ (for these two, at least)');
}

/* ---------- 2. the list's second line -------------------------------- */
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
  eq(scope.waSnippetText(undefined), '', 'no messages yet is an empty line, not a crash');
}

/* ---------- 3. the badge counts, off the read marker ----------------- */
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

/* ---------- 4. the thread, cut into days ----------------------------- */
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

/* ---------- 5. the tick ladder --------------------------------------- */
{
  eq(scope.waTickHTML(null), '', 'inbound has no ladder to climb');
  t.check(scope.waTickHTML('sent').includes('✓') && !scope.waTickHTML('sent').includes('✓✓'),
    'sent is one tick');
  t.check(scope.waTickHTML('delivered').includes('✓✓'), 'delivered is two');
  t.check(scope.waTickHTML('read').includes('✓✓') && /class="wm-tick read"/.test(scope.waTickHTML('read')),
    'read is two, coloured');
  t.check(/class="wm-tick failed"/.test(scope.waTickHTML('failed')), 'failed says so');
}

/* ---------- 6. search that narrows, never floods --------------------- */
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

/* ---------- 7. worn by the render ------------------------------------ */
{
  t.check(/waInitials\(waConvTitle\(c\)\)/.test(src) && /waAvatarHue\(c\.wa_id\)/.test(src),
    'every list row wears an avatar in its contact\'s own colour');
  t.check(/class="wa-thread-head"/.test(src) && /waInitials\(waConvTitle\(active\)\)/.test(src),
    'the open thread has a header naming who you are talking to');
  t.check(/waThreadGroups\(waInbox\.msgs, Date\.now\(\)\)\.map\(g=>/.test(src)
    && /class="wa-day"><span>\$\{esc\(g\.label\)\}/.test(src),
    'the thread renders in day groups with separator chips');
  t.check(/\$\{m\.direction==='out' \? waTickHTML\(m\.status\) : ''\}/.test(src),
    'ticks ride outbound bubbles only');
  t.check(/waConvUnreadCount\(c, waInbox\.allMsgs\)/.test(src) && /class="wc-badge"/.test(src),
    'the unread badge carries the counted number');
  t.check(/waSnippetText\(snip\)/.test(src), 'the list shows each chat\'s last line');
  /* Learned live: the aggregate fetch fed the snippets [undefined]
     until it actually selected the columns the snippets read. */
  t.check(/select\('conversation_id, direction, sent_at, payload, body, msg_type'\)/.test(src),
    'and the aggregate fetch carries the columns the snippet reads');
  t.check(/id="wa_conv_search"/.test(src) && /waConvFilter\(waInbox\.convs, waInbox\.search\)/.test(src),
    'the search box narrows the list through the filter');
  t.check(/if\(searchFocused\)\{\s*\n\s*searchEl\.focus\(\);/.test(src),
    'and typing in it survives the poll\'s redraw, like the composer learned to');
  t.check(/data-conv="\$\{active\.id\}" placeholder="Reply…" \$\{w\.open\?'':'disabled'\}/.test(src),
    'the composer kept its identity through the restyle — drafts still survive');
}

process.exit(t.done() ? 1 : 0);
