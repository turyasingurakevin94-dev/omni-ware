#!/usr/bin/env node
'use strict';
/*
 * client-accounts -- the admin side of the portal, and the only place a
 * PIN is ever readable.
 *
 * client-portal stores a PBKDF2 hash and nothing else, which means the
 * figures a customer is given exist in exactly one place for exactly one
 * moment: the reply to an admin pressing a button. Three things therefore
 * have to hold, and none of them is obvious from reading the file:
 *
 *   1. Only a shop admin can reach it, and that is settled BEFORE the
 *      service-role key is in scope.
 *   2. A PIN leaves in the reply to `open`/`reissue` and nowhere else --
 *      not in `list`, not in a log, not into another table.
 *   3. The identity helpers match client-portal's character for
 *      character. They are duplicated because Edge Functions here deploy
 *      one file at a time, and a copy that drifts is a customer who can
 *      sign in on one endpoint and not the other.
 *
 * Also pinned here: the attempt ceiling, which is the whole defence for a
 * four-figure secret. Without it, "ask for another PIN" hands out three
 * fresh guesses on demand and the shop's own rate limit is the only thing
 * between an attacker and a one-in-ten-thousand lottery they can re-enter
 * as often as they like.
 *
 * Run: node test/client-accounts.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('client accounts');
const src = read('supabase/functions/client-accounts/index.ts');
const portal = read('supabase/functions/client-portal/index.ts');
const strip = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const code = strip(src);
const portalCode = strip(portal);

/* ---------- 1. only an admin, and before the service role ------------- */
{
  t.check(/if \(!authHeader\) return json\(\{ error: "Missing Authorization header" \}, 401\)/.test(code),
    'a request with no Authorization header is refused');
  t.check(/rpc\("is_shop_admin", \{ p_shop_id: shopId \}\)/.test(code),
    'admin identity comes from the database, not from the body');
  t.check(/if \(!isAdmin\) return json\(\{ error: "[^"]*" \}, 403\)/.test(code),
    'a non-admin is refused');
  // The ordering agent-catalog pins for the same reason: a service-role
  // handle created before the check is one a later edit can reach past.
  t.check(code.indexOf('is_shop_admin') < code.indexOf('SERVICE_ROLE_KEY)'),
    'and that happens before the service-role client exists');
  // is_shop_MEMBER would put every counter hand in the shop one button
  // away from issuing themselves a login as any customer.
  t.check(!/is_shop_member/.test(code),
    'membership is not enough — this is admin-or-owner only');
}

/* ---------- 2. where a PIN may and may not go ------------------------- */
{
  // Every response in the file, and which of them mention a pin.
  const replies = code.match(/return json\(\{[\s\S]{0,400}?\}(?:, \d+)?\);/g) || [];
  const withPin = replies.filter(r => /\bpin\b/.test(r));
  t.check(withPin.length === 1,
    `exactly one reply in the whole file carries a PIN (${withPin.length})`);
  t.check(/ok: true,\s*pin,/.test(withPin[0] || ''),
    'and it is the one the open/reissue branch returns');

  // The list branch is the one a screen calls repeatedly, so it is the one
  // worth proving separately.
  const list = code.slice(code.indexOf('action === "list"'), code.indexOf('const customerId'));
  t.check(!/\bpin\b/.test(list.replace(/pinLive|pinExpiresAt|pin_hash|pin_expires_at|pin_attempts/g, '')),
    'list carries no PIN of any kind');
  // Matched first, then checked. `.match(...)[0]` on a regex that stops
  // matching throws a TypeError, and a thrown test prints a stack trace
  // where a sentence should be.
  const viewFn = code.match(/function accountView[\s\S]*?\n\}/);
  t.check(!!viewFn, 'accountView is found');
  t.check(!!viewFn && /pin_hash/.test(viewFn[0]) && !/pin_hash:/.test(viewFn[0]),
    'and it reads pin_hash only to say whether one is outstanding, never to return it');

  t.check(!/console\.log|console\.error|console\.warn/.test(code),
    'nothing is logged — a logged PIN is a PIN in a retention system');
  t.check(!/\.\.\.(row|customer|existing|account)[,}\s]/.test(code),
    'and no row is ever spread into a response');
}

/* ---------- 3. the helpers have not drifted --------------------------- */
/*
 * Character for character, because this is a duplicate by policy and a
 * duplicate by policy is a duplicate that gets edited on one side.
 */
{
  ['normalisePhone', 'mintPin', 'hashPin'].forEach((fn) => {
    const a = extractFunction(src, fn, 'client-accounts');
    const b = extractFunction(portal, fn, 'client-portal');
    t.check(a === b, `${fn}() is identical in both functions${a === b ? '' : '\n--- client-accounts\n' + a + '\n--- client-portal\n' + b}`);
  });
  t.check(/duplicated VERBATIM from client-portal/.test(src),
    'and the file says it is a copy, so the next reader knows to edit both');

  // The salt is what ties a hash to one account. If these ever disagreed,
  // a PIN issued here would not verify there -- and the failure would look
  // like the customer typing it wrong.
  const salt = /salt: new TextEncoder\(\)\.encode\(`\$\{shopId\}:\$\{customerId\}`\)/;
  t.check(salt.test(code) && salt.test(portalCode),
    'both salt the PIN hash with shop and customer, so one verifies the other');

  const { normalisePhone } = compileScope(
    [extractFunction(src, 'normalisePhone', 'client-accounts')], {}, ['normalisePhone'], { typescript: true });
  t.check(normalisePhone('0772418903') === '772418903'
    && normalisePhone('+256772418903') === '772418903'
    && normalisePhone('256 772 418 903') === '772418903'
    && normalisePhone('0772-418-903') === '772418903',
    'one person written four ways is one account');
  t.check(normalisePhone('12345') === '' && normalisePhone(null) === '' && normalisePhone('') === '',
    'and too few digits is not a number at all');
}

/* ---------- 4. the attempt ceiling ------------------------------------ */
/*
 * The load-bearing one. A four-figure PIN is 1 in 10,000; three tries is
 * 3 in 10,000. What made that number meaningless was resetting the count
 * every time a PIN was minted -- burn three, ask for another, repeat.
 */
{
  const start = portalCode.split('action === "start"')[1].split('action === "verify"')[0];
  t.check(!/pin_attempts: 0/.test(start),
    'start mints a PIN without resetting the attempt count');
  t.check(/const locked = \(account\.pin_attempts \|\| 0\) >= PIN_MAX_ATTEMPTS;/.test(start)
    && /if \(!live && !locked\)/.test(start),
    'and mints nothing at all once the ceiling is reached');
  t.check(/Date\.parse\(account\.pin_expires_at\) > Date\.now\(\)/.test(start),
    'a LIVE PIN is never replaced — which is what lets the shop read one out and have it still work');
  // The inverted-sign guard that shipped before: it suppressed minting for
  // a PIN issued up to nineteen minutes ago, expired ones included.
  t.check(!/Date\.now\(\) - PIN_TTL_MS \+ START_WINDOW_MS/.test(portalCode),
    'and not by the old comparison, which left an expired PIN unreplaceable for nine minutes');

  const open = code.slice(code.indexOf('action === "open" || action === "reissue"'));
  t.check(/pin_attempts: 0,/.test(open),
    'an admin issuing a PIN is the one thing that clears the count');
  const resets = (code.match(/pin_attempts: 0/g) || []).length;
  t.check(resets === 1, `and it is the only place in this file that does (${resets})`);

  // Both files have to agree on the number, because this screen reports
  // "N tries left" and verify is what enforces it.
  const here = /const PIN_MAX_ATTEMPTS = (\d+);/.exec(code);
  const there = /const PIN_MAX_ATTEMPTS = (\d+);/.exec(portalCode);
  t.check(here && there && here[1] === there[1],
    `both functions read the same ceiling (${here && here[1]} / ${there && there[1]})`);

  // A dead end has to name the way out. start will not mint past the
  // ceiling, so "ask for a new PIN" was advice the endpoint had stopped
  // taking.
  t.check(/Ring the shop for a new PIN/.test(portalCode),
    'and a locked-out customer is sent to the one thing that helps');
}

/* ---------- 5. one number is one account ------------------------------ */
{
  const open = code.slice(code.indexOf('action === "open" || action === "reissue"'));
  t.check(/\.eq\("phone", phone\)/.test(open) && /clash\.customer_id !== customerId/.test(open),
    'a number already signing in as somebody else is caught before the insert');
  t.check(/\}, 409\)/.test(open), 'and refused, rather than colliding with the unique index');
  t.check(/holder\?\.name/.test(open),
    'naming who holds it — the fix is a decision about which of two people the account is for');
  t.check(/if \(!phone\) \{/.test(open) && /needs nine/.test(open),
    'a customer with no usable number is told what is wrong with it');
  t.check(/phone,\n/.test(open) || /\s{8}phone,/.test(open),
    'and the account phone is re-synced from the customer row on every issue');
}

/* ---------- 6. suspending actually suspends --------------------------- */
{
  const susp = code.slice(code.indexOf('action === "suspend" || action === "restore"'));
  t.check(/pin_hash: null, pin_expires_at: null/.test(susp),
    'suspending drops any live PIN — restoring must not un-expire an old one');
  t.check(/from\("client_sessions"\)[\s\S]{0,200}revoked_at: new Date\(\)/.test(susp),
    'and signs out the devices, or the account is suspended everywhere except the phone in their pocket');
  t.check(!/\.delete\(\)/.test(code),
    'nothing is ever deleted — a suspension is usually a dispute, which is when a record matters most');
}

/* ---------- 7. nothing supplier-shaped, and no other customer --------- */
{
  const banned = /(supplier|wholesale|markup|rival[_ ]?price|sourcing[_ ]?lead)|\b(margin|cost)\b/i;
  const m = banned.exec(code);
  t.check(!m, `the admin function names nothing supplier-shaped either${m ? ` (found "${m[0]}")` : ''}`);
  // Every read is shop-scoped: an admin of shop A naming shop B's
  // customer id must not open an account on it.
  const reads = code.match(/\.from\("(client_accounts|client_sessions|customers)"\)[\s\S]{0,260}?;/g) || [];
  const unscoped = reads.filter(r => !/\.eq\("shop_id", shopId\)/.test(r));
  t.check(reads.length >= 6 && unscoped.length === 0,
    `every read and write is scoped to the caller's shop (${reads.length} found, ${unscoped.length} unscoped)`);
}

/* ---------- 8. the agent roster is not read --------------------------- */
/*
 * 0096 has an agent_id column and the plan wanted it filled from
 * agent_clients. 0012 refuses the shop any policy on that table on
 * purpose -- it is an agent's private roster, and the shop learning which
 * of its customers are on it is the precise leak that boundary exists to
 * prevent. A service-role read here would walk straight around it.
 */
{
  t.check(!/agent_clients/.test(code),
    'an agent\'s private client roster is never read to attribute an account');
  t.check(/agent_id is deliberately left unset/.test(src),
    'and the file says why, so the next person does not helpfully wire it up');
}

process.exit(t.done() ? 1 : 0);
