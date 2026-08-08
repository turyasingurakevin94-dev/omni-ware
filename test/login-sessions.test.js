#!/usr/bin/env node
'use strict';
/*
 * Who is signed in to this shop.
 *
 * Three apps sign in against one shop -- admin, worker, agent -- and
 * nothing recorded that a sign-in had happened at all. A phone left in a
 * taxi, a password shared between two workers, or somebody still signed
 * in months after they stopped working here were invisible to the person
 * whose money and customer list were behind that login.
 *
 * WHAT A MONITOR MUST NOT DO IS LIE ABOUT SILENCE. A device that cannot
 * be read is not a device that is absent, and a shop whose session list
 * fails to load must be told it failed rather than shown an empty list
 * that reads as "nothing signed in" -- the same rule the whole app
 * follows about null against zero.
 *
 * REVOKING IS NOT REMOVING, and the wording has to say so. Signing a
 * device out stops that device; it does not take the person's password
 * away. A shopkeeper who thinks it does is worse off than one who knows
 * it does not.
 *
 * Run: node test/login-sessions.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('login sessions');
const src = read('index.html');
const sharedJs = read('shared-worker.js');
const agentHtml = read('agent.html');
const workerHtml = read('worker.html');

const NAMES = ['lsIsLive', 'lsAgo', 'lsWhoName', 'lsSortRows'];
const scope = compileScope([
  extractDeclaration(src, 'LS_LIVE_MS', 'index.html'),
  ...NAMES.map((n) => extractFunction(src, n, 'index.html')),
], {}, NAMES);

const label = compileScope(
  [extractFunction(sharedJs, 'owDeviceLabel', 'shared-worker.js')], {}, ['owDeviceLabel']);

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const NOW = Date.parse('2026-08-08T12:00:00Z');
const agoMin = (m) => new Date(NOW - m * 60000).toISOString();

/* ---------- 1. what a device is, from its user agent ----------------- *
 * ORDER IS THE WHOLE THING: Edge's user agent contains "Chrome",
 * Chrome's contains "Safari", and every Android browser's contains
 * "Linux". Each test has to come before the one it would be mistaken
 * for, or every phone in the shop is labelled the same thing.
 */
{
  const UA = {
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 Edg/120',
    chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    chromeAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/604.1',
    firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    opera: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36 OPR/106',
  };
  eq(label.owDeviceLabel(UA.edge), 'Edge on Windows', 'Edge is not reported as Chrome');
  eq(label.owDeviceLabel(UA.chromeWin), 'Chrome on Windows', 'Chrome is Chrome');
  eq(label.owDeviceLabel(UA.chromeAndroid), 'Chrome on Android',
    'an Android phone is Android, not Linux — the shop\'s workers are all on one');
  eq(label.owDeviceLabel(UA.safariIphone), 'Safari on iPhone', 'Safari is not reported as Chrome');
  eq(label.owDeviceLabel(UA.firefoxLinux), 'Firefox on Linux', 'and a desktop Linux really is Linux');
  eq(label.owDeviceLabel(UA.opera), 'Opera on Windows', 'Opera is not reported as Chrome either');
  eq(label.owDeviceLabel(''), 'Unknown device', 'nothing recognised is said to be unknown, not guessed at');
  eq(label.owDeviceLabel(null), 'Unknown device', 'and an absent agent does not crash the monitor');

  /* The agent app is deliberately self-contained, so it carries its own
     copy. Two apps parsing user agents two different ways is a monitor
     that quietly disagrees with itself about what a device is. */
  eq(extractFunction(agentHtml, 'owDeviceLabel', 'agent.html'),
    extractFunction(sharedJs, 'owDeviceLabel', 'shared-worker.js'),
    'the agent app\'s copy of the label parser is byte-identical to the shared one');
  eq(extractFunction(agentHtml, 'owDeviceId', 'agent.html'),
    extractFunction(sharedJs, 'owDeviceId', 'shared-worker.js'),
    'and so is its copy of the device id');
}

/* ---------- 2. live, and the honesty of "last seen" ------------------ */
{
  eq(scope.lsIsLive({ last_seen_at: agoMin(1) }, NOW), true, 'a device heard from a minute ago is online');
  eq(scope.lsIsLive({ last_seen_at: agoMin(4) }, NOW), true,
    'and one heard from four minutes ago still is — a single late heartbeat is not a death');
  eq(scope.lsIsLive({ last_seen_at: agoMin(90) }, NOW), false, 'an hour and a half of silence is not online');
  /* A revoked device may still be sending heartbeats in the seconds
     before it notices. It is not online: it has been signed out. */
  eq(scope.lsIsLive({ last_seen_at: agoMin(0), revoked_at: agoMin(0) }, NOW), false,
    'a revoked device is never shown as online, however recently it spoke');
  eq(scope.lsIsLive({ last_seen_at: 'nonsense' }, NOW), false, 'an unreadable timestamp claims nothing');
  eq(scope.lsIsLive(null, NOW), false, 'and neither does no row at all');

  eq(scope.lsAgo(agoMin(0), NOW), 'just now', 'under a minute reads as just now, not "0 minutes ago"');
  eq(scope.lsAgo(agoMin(1), NOW), '1 minute ago', 'one minute is singular');
  eq(scope.lsAgo(agoMin(42), NOW), '42 minutes ago', 'minutes up to the hour');
  eq(scope.lsAgo(agoMin(60), NOW), '1 hour ago', 'then hours');
  eq(scope.lsAgo(agoMin(60 * 26), NOW), '1 day ago', 'then days');
  eq(scope.lsAgo(agoMin(60 * 24 * 9), NOW), '9 days ago', 'and keeps counting them');
  /* Null in, null out. A device that has never been heard from makes no
     claim about when it was -- the render says "never" rather than
     inventing 1970. */
  eq(scope.lsAgo(null, NOW), null, 'no timestamp is no answer, not the epoch');
  eq(scope.lsAgo('', NOW), null, 'nor is an empty one');
}

/* ---------- 3. whose account is this ---------------------------------- */
{
  const staff = [{ id: 'S1', name: 'Daphne', userId: 'u-daphne' }, { id: 'S2', name: 'No login', userId: null }];
  eq(scope.lsWhoName({ user_id: 'u-daphne' }, staff, 'u-me'), 'Daphne', 'a staff member is named');
  /* The owner is a shop member but not on the staff list, so an
     unmatched account must not read as nobody. */
  eq(scope.lsWhoName({ user_id: 'u-me' }, staff, 'u-me'), 'You', 'your own account says so');
  t.check(/^Account /.test(scope.lsWhoName({ user_id: 'u-stranger-1234567890' }, staff, 'u-me')),
    'and an account matching nobody is named by its login rather than hidden');
  /* The trap: a staff member with no login must not match a session
     whose user_id is missing, or every unlinked device is labelled with
     the first person who never accepted their invite. */
  eq(scope.lsWhoName({ user_id: null }, staff, 'u-me'), 'Account ',
    'a staff row with no login matches no session');
}

/* ---------- 4. the rows worth acting on come first -------------------- */
{
  const rows = [
    { id: 1, last_seen_at: agoMin(400) },                    // long gone
    { id: 2, last_seen_at: agoMin(2) },                      // online
    { id: 3, last_seen_at: agoMin(30) },                     // quiet
    { id: 4, last_seen_at: agoMin(1), revoked_at: agoMin(1) }, // revoked, recent
  ];
  const sorted = scope.lsSortRows(rows, NOW);
  eq(sorted[0].id, 2, 'the device that is signed in right now is first');
  eq(sorted[1].id, 4, 'then the rest by how recently they were heard from');
  eq(sorted[2].id, 3, 'newest first');
  eq(sorted[3].id, 1, 'oldest last');
  eq(rows[0].id, 1, 'and the caller\'s array is not reordered underneath it');
}

/* ---------- 5. what the screen promises, and what it does not -------- */
{
  const render = extractFunction(src, 'renderLoginSessions', 'index.html');
  const load = extractFunction(src, 'loadLoginSessions', 'index.html');

  /* A failed read is not an empty shop. Reporting one as the other is
     how a monitor tells a shopkeeper nobody is signed in at the exact
     moment somebody is. */
  t.check(/lsRows = null;/.test(load), 'a failed read is recorded as unknown');
  t.check(/if\(lsRows === null\)\{/.test(render) && /Could not read the signed-in devices/.test(render),
    'and shown as a failure to read, never as an empty list');
  t.check(/Nothing signed in yet/.test(render),
    'while a genuinely empty list says that instead');

  /* Signing a device out is not taking somebody's access away, and the
     confirm has to say so or it sells a protection it does not provide. */
  t.check(/remove them from Staff to stop that/.test(render),
    'the confirm says a revoked device can sign in again, and what actually stops that');
  t.check(/THIS IS THE DEVICE YOU ARE USING/.test(render),
    'and warns before you sign yourself out');
  t.check(/revoked_at: new Date\(\)\.toISOString\(\)/.test(render),
    'revoking stamps the row rather than deleting it, so the record survives');
  t.check(/r\.revoked_at \? '' :/.test(render),
    'an already-revoked device is not offered again');
  t.check(/ls-tag you/.test(render) && /ls-tag live/.test(render) && /ls-tag out/.test(render),
    'this device, online and signed out each read at a glance');
}

/* ---------- 6. all of it is REACHED ----------------------------------- */
{
  t.check(/id="ls_list"/.test(src) && /id="ls_refresh"/.test(src),
    'the panel exists on the Staff tab');
  t.check(/if\(tab==='staff'\) loadLoginSessions\(\);/.test(src),
    'and loads when that tab is opened');
  t.check(/getElementById\('ls_refresh'\)\.addEventListener\('click', loadLoginSessions\);/.test(src),
    'with a way to ask again without leaving');

  /* Every app has to register, or the monitor shows a shop that is
     quieter than it is. */
  const ensure = extractFunction(sharedJs, 'ensureAuthAndShop', 'shared-worker.js');
  t.check(/await owSessionBeat\(true\);/.test(ensure),
    'admin and worker register the moment they are through the door');
  t.check(/owSessionBeat\(true\);/.test(agentHtml) && /app: 'agent'/.test(agentHtml),
    'and so does the agent app, under its own name');
  /* Both halves must agree on that name. Reading under one app while
     writing under another makes a fresh row every heartbeat and leaves
     the agent unrevokable -- the monitor would show a device that could
     never be signed out. */
  t.check(/\.eq\('device_id', owDeviceId\(\)\)\.eq\('app', 'agent'\)/.test(agentHtml),
    'and looks its own session up under that same name');
  t.check(/owSessionBeat\(\);/.test(src), 'the admin poll carries the heartbeat');
  t.check(/owSessionBeat\(\);/.test(workerHtml), 'and so does the worker\'s');

  /* The heartbeat is also how a revoked device learns it is out. */
  const touch = extractFunction(sharedJs, 'owTouchSession', 'shared-worker.js');
  t.check(/if\(mine && mine\.revoked_at\) return true;/.test(touch),
    'a revoked row is reported to the caller before anything is written');
  const beat = extractFunction(sharedJs, 'owSessionBeat', 'shared-worker.js');
  t.check(/await signOutAndReload\(\);/.test(beat),
    'and the device signs itself out when it hears so');
  /* An upsert would rewrite the whole row, letting a revoked device
     clear its own revocation just by reloading. */
  t.check(!/\.upsert\(/.test(touch) && /\.insert\(/.test(touch) && /\.update\(\{ last_seen_at/.test(touch),
    'the heartbeat writes only last_seen_at, so a device cannot un-revoke itself');
  t.check(/console\.error\('login session heartbeat failed'/.test(touch),
    'and a monitor that cannot write never blocks a shop from selling');

  /* The server holds the same line, since a client can be edited. */
  const mig = read('supabase/migrations/0062_login_sessions.sql');
  t.check(/only an owner or admin can revoke a session/.test(mig),
    'the database refuses a non-admin changing revoked_at');
  /* The message existing proves nothing -- the condition that raises it
     is the guard. Without the user_id test a device could point an
     existing row at somebody else's account and inherit their session. */
  t.check(/if new\.user_id <> old\.user_id or new\.shop_id <> old\.shop_id/.test(mig)
    && /new\.device_id <> old\.device_id or new\.app <> old\.app/.test(mig)
    && /a session cannot be re-pointed at another device or person/.test(mig),
    'and refuses a row being re-pointed at another person, device or app');
  /* Scoped to the SELECT policy deliberately: the UPDATE policy carries
     the same clause word for word, so an unscoped search still passed
     with reading thrown wide open to every member of the shop. */
  const selectPolicy = (/create policy "own session or admin sees all"[\s\S]*?;/.exec(mig) || [''])[0];
  t.check(/for select/.test(selectPolicy)
    && /using \(user_id = auth\.uid\(\) or is_shop_admin\(shop_id\)\)/.test(selectPolicy),
    'a device reads its own row; only an owner or admin reads the shop\'s');
  t.check(/with check \(user_id = auth\.uid\(\) and is_shop_member\(shop_id\)\)/.test(mig),
    'and registers only itself, only in a shop it belongs to');
  t.check(/unique \(shop_id, user_id, device_id, app\)/.test(mig),
    'one row per person per device per app — a monitor, not a log that grows forever');
}

process.exit(t.done() ? 1 : 0);
