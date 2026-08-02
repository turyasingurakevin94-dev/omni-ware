#!/usr/bin/env node
'use strict';
/*
 * invite-worker and invite-agent -- the two functions that create a login
 * and attach it to a staff or agent row. Both run on the service-role key,
 * and invite-worker is deployed with verify_jwt=false, so the only thing
 * standing between an anonymous caller and a shop_members write is the
 * is_shop_admin() check inside the function.
 *
 * The bug: when inviteUserByEmail() fails because the address already
 * belongs to a user, both fell back to admin.auth.admin.listUsers() with no
 * arguments and searched the result. That call is paginated -- the client
 * sends no page size, so the server picks one -- and neither looked past
 * the first page or at nextPage. Once a project had more auth users than
 * one page, re-inviting an existing address returned
 * "invite_no_existing_match" while the user sat on page two, and it failed
 * for exactly the people most likely to be re-invited: the long-standing
 * ones. Searching for the pattern rather than opening one file is what
 * showed it was in both.
 *
 * Run: node test/invite-functions.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('invite functions');

const FILES = [
  ['invite-worker', read('supabase/functions/invite-worker/index.ts')],
  ['invite-agent', read('supabase/functions/invite-agent/index.ts')],
];

/* ---------- 1. the lookup actually walks the pages -------------------- */
async function checkPagination([name, src]) {
  let findUserByEmail = null, err = null;
  try {
    ({ findUserByEmail } = compileScope(
      [
        extractFunction(src, 'findUserByEmail', name),
        `const LIST_PER_PAGE = ${/const LIST_PER_PAGE = (\d+)/.exec(src)?.[1] || 0};`,
        `const LIST_MAX_PAGES = ${/const LIST_MAX_PAGES = (\d+)/.exec(src)?.[1] || 0};`,
      ],
      {}, ['findUserByEmail'], { typescript: true },
    ));
  } catch (e) { err = e; }

  t.check(typeof findUserByEmail === 'function',
    `${name} has a paginated findUserByEmail${err ? ` (${err.message})` : ''}`);
  if (typeof findUserByEmail !== 'function') return;

  const perPage = Number(/const LIST_PER_PAGE = (\d+)/.exec(src)[1]);

  // A directory big enough that the wanted user is not on page one.
  const makeAdmin = (total, wantedAt) => {
    const calls = [];
    const users = Array.from({ length: total }, (_, i) => ({
      id: `u${i}`, email: i === wantedAt ? 'Wanted@Example.com' : `other${i}@example.com`,
    }));
    return {
      calls,
      auth: {
        admin: {
          listUsers: async ({ page, perPage: pp }) => {
            calls.push(page);
            const start = (page - 1) * pp;
            return { data: { users: users.slice(start, start + pp) }, error: null };
          },
        },
      },
    };
  };

  {
    // On page one: found without extra requests.
    const a1 = makeAdmin(perPage * 3, 0);
    const r1 = await findUserByEmail(a1, 'wanted@example.com');
    t.check(r1.user && r1.user.id === 'u0', `${name}: a user on the first page is found`);
    t.check(a1.calls.length === 1, `${name}: and no further pages are fetched (${a1.calls.length} request)`);

    // Past page one -- the case that used to fail.
    const a2 = makeAdmin(perPage * 3, perPage * 2 + 5);
    const r2 = await findUserByEmail(a2, 'wanted@example.com');
    t.check(r2.user && r2.user.id === `u${perPage * 2 + 5}`,
      `${name}: a user on page three is found (${r2.user ? r2.user.id : 'MISSED'})`);
    t.check(a2.calls.length === 3, `${name}: it walked the pages (${a2.calls.join(',')})`);

    // Genuinely absent: stops at the short page rather than looping.
    const a3 = makeAdmin(perPage + 7, -1);
    const r3 = await findUserByEmail(a3, 'nobody@example.com');
    t.check(r3.user === null && r3.error === null, `${name}: an absent user returns cleanly`);
    t.check(a3.calls.length === 2, `${name}: and it stops on the short page (${a3.calls.length} requests)`);

    // Case-insensitive, since the stored address may differ in case.
    const a4 = makeAdmin(perPage, 3);
    const r4 = await findUserByEmail(a4, 'WANTED@EXAMPLE.COM');
    t.check(r4.user && r4.user.id === 'u3', `${name}: the match ignores case on both sides`);

    // A listUsers error is surfaced, not swallowed into "not found" --
    // those mean different things to the caller (500 vs "no match").
    const failing = { auth: { admin: { listUsers: async () => ({ data: null, error: { message: 'boom' } }) } } };
    const r5 = await findUserByEmail(failing, 'x@example.com');
    t.check(r5.user === null && r5.error && r5.error.message === 'boom',
      `${name}: a failed page read is reported as an error`);

    // The bound exists so a server that always returns a full page cannot
    // spin here forever.
    const endless = {
      n: 0,
      auth: { admin: { listUsers: async ({ perPage: pp }) => {
        endless.n++;
        return { data: { users: Array.from({ length: pp }, (_, i) => ({ id: 'x', email: 'no@example.com' })) }, error: null };
      } } },
    };
    const r6 = await findUserByEmail(endless, 'wanted@example.com');
    const maxPages = Number(/const LIST_MAX_PAGES = (\d+)/.exec(src)[1]);
    t.check(r6.user === null && endless.n === maxPages,
      `${name}: an endless directory stops at the page bound (${endless.n} of ${maxPages})`);
  }
}

/* ---------- 2. structural: nothing calls listUsers bare again --------- */
async function main() {
  for (const f of FILES) await checkPagination(f);

  FILES.forEach(([name, src]) => {
    const code = src.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n');
    t.check(!/listUsers\(\s*\)/.test(code),
      `${name} never calls listUsers() with no page arguments`);
    t.check(/listUsers\(\{ page, perPage: LIST_PER_PAGE \}\)/.test(code),
      `${name} asks for an explicit page and size`);
    t.check(code.indexOf('findUserByEmail') < code.indexOf('inviteUserByEmail')
      || /findUserByEmail\(admin, email\)/.test(code),
      `${name} routes the existing-user fallback through the paginated lookup`);
  });

  // Both copies must stay identical -- they drifted into the same bug once.
  // Guarded: when one is missing entirely this has to report, not throw and
  // take the authorization checks below down with it.
  const bodies = FILES.map(([, src]) => {
    try { return extractFunction(src, 'findUserByEmail', 'x').replace(/\s+/g, ' '); }
    catch { return null; }
  });
  t.check(bodies[0] !== null && bodies[0] === bodies[1],
    `the two copies of findUserByEmail are identical${bodies.includes(null) ? ' (one is missing)' : ''}`);

  /* ---------- 3. authorization is the only gate, so check it ---------- */
  // invite-worker is deployed verify_jwt=false. The platform lets an
  // anonymous request through; is_shop_admin() is what stops it.
  const worker = read('supabase/functions/invite-worker/index.ts');
  t.check(/if \(!authHeader\) return json\(\{ error: "Missing Authorization header" \}, 401\)/.test(worker),
    'invite-worker refuses a request with no Authorization header');
  t.check(/createClient\(SUPABASE_URL, ANON_KEY, \{\s*global: \{ headers: \{ Authorization: authHeader \} \}/.test(worker),
    'the admin check runs as the caller, not as the service role');
  t.check(/if \(!isAdmin\) return json\(\{ error: "Only a shop admin\/owner can send login invites" \}, 403\)/.test(worker),
    'a non-admin is refused');
  t.check(worker.indexOf('is_shop_admin') < worker.indexOf('SERVICE_ROLE_KEY)'),
    'the admin check happens before the service-role client is created');

  // The invitee's address should not be sitting in retained logs.
  t.check(!/console\.log\([^)]*\bemail\b[^)]*\)/.test(
    worker.split(/\r?\n/).filter(l => /console\.log/.test(l) && !/emailDomain/.test(l)).join('\n')),
    'invite-worker does not log the invitee email address in full');

  process.exit(t.done() ? 1 : 0);
}
main();
