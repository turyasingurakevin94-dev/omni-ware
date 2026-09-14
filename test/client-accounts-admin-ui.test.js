#!/usr/bin/env node
'use strict';
/*
 * The customer form's portal block, and the two columns 0096 adds.
 *
 * Two separate risks, and the second is the bigger one:
 *
 *   · A PIN is the only secret this app ever puts on screen. It exists in
 *     the reply to a button press and in the DOM, and nowhere else --
 *     there is no copy to read back. So it must never reach `data`, which
 *     is diffed against the server every few seconds and lands in every
 *     backup the shop takes.
 *
 *   · terms_days and credit_limit are hand-applied columns on the busiest
 *     write in the app. Sent to a shop whose 0096 has not landed,
 *     PostgREST rejects the whole upsert for the unknown column and EVERY
 *     customer stops syncing -- over two fields nothing else reads. The
 *     app already carries this scar (see the site_stage note in the write
 *     payload) and the same guard is the fix.
 *
 * The null handling is pinned too, because `|| null` reads correctly and
 * is wrong: 0 days is cash terms and a 0 limit is a customer barred from
 * owing anything. Both are real agreements, and both are the strictest in
 * the book -- exactly the ones an app must not silently read as "nobody
 * said".
 *
 * Run: node test/client-accounts-admin-ui.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('portal account admin UI');
const src = read('index.html');

/* ---------- 1. the PIN never reaches the saved record ----------------- */
{
  // `data` is what saveData() diffs and uploads. The PIN lives in a
  // module-level variable and the DOM, and this is what says so.
  t.check(/let cfPinShown = null;/.test(src), 'the PIN on screen is held in its own variable');
  t.check(!/data\.customers\[[^\]]*\][^\n]*pin/i.test(src) && !/pin:\s*cfPinShown/i.test(src),
    'and is never written onto a customer record');

  const save = src.slice(src.indexOf("document.getElementById('c_save').addEventListener"));
  const upTo = save.slice(0, save.indexOf('function '));
  t.check(!/pin/i.test(upTo.replace(/picker|Picker/g, '')),
    'the save handler does not touch it at all');

  // Cleared with the form, or the next customer opened in this modal
  // shows the last one's credential for the moment before it redraws.
  const reset = src.slice(src.indexOf('function resetCustomerForm()'));
  t.check(/cfPinShown = null;/.test(reset.slice(0, reset.indexOf('\n}'))),
    'closing the form loses it, which is what the screen promises');

  // localStorage would survive the tab, which is worse than surviving the
  // modal.
  t.check(!/lsSet\([^)]*pin|localStorage[^\n]*pin/i.test(src),
    'and it is never put in storage');
}

/* ---------- 2. the screen promises what the function does ------------- */
{
  const block = src.slice(src.indexOf('function cfShowPortal'), src.indexOf('async function cfPortalAct'));
  t.check(/only time they will be shown/i.test(block),
    'the note says the figures are shown once');
  t.check(/keeps no copy/i.test(block),
    'and that the shop keeps no copy — because it does not, and could not');
  // A 4-figure PIN read down a telephone off a proportional font at 13px
  // is how a customer ends up typing 7ttt for 7111.
  t.check(/cf-pin-figs/.test(block) && /IBM Plex Mono/.test(src.slice(src.indexOf('.cf-pin-figs'), src.indexOf('.cf-pin-figs') + 200)),
    'and the figures themselves are monospaced, to be read aloud');

  t.check(/three wrong tries/i.test(block),
    'a locked-out account says so — the customer cannot fix it from their end');
  t.check(/will not help them; only a new PIN from here will/i.test(block),
    'and names the only thing that lets them back in');

  // The quiet one: sign-in is by the account's phone, orders are found by
  // the customer row's phone, and anyone can edit the latter afterwards.
  t.check(/phoneMatchesCustomer/.test(block) && /find none of their own orders/i.test(block),
    'a drifted phone number is surfaced, not left to be discovered by the customer');
}

/* ---------- 3. the write is guarded, like every hand-applied column --- */
{
  t.check(/let clientAccountsTable = false;/.test(src) && /let customerTermsColumns = false;/.test(src),
    'both halves of 0096 are probed');
  t.check(/clientAccountsTable = !\(clientAccountsR && clientAccountsR\.error\);/.test(src)
    && /customerTermsColumns = !\(termsColR && termsColR\.error\);/.test(src),
    'and set from a probe query, the way every migration before them is');
  t.check(/sb\.from\('client_accounts'\)\.select\('customer_id'\)\.limit\(1\)/.test(src)
    && /sb\.from\('customers'\)\.select\('terms_days, credit_limit'\)\.limit\(1\)/.test(src),
    'probed apart — a shop can have the table and an older customers row');

  const payload = src.slice(src.indexOf('customers: d.customers.map(c=>({shop_id:shopId'));
  const upTo = payload.slice(0, payload.indexOf('debtLog:'));
  t.check(/\.\.\.\(customerTermsColumns \? \{/.test(upTo),
    'the two columns ride only where the probe says they exist');
  t.check(!/terms_days:/.test(upTo.replace(/\.\.\.\(customerTermsColumns \?[\s\S]*/, '')),
    'and are not sent unconditionally, which would stop every customer syncing');

  // The block is hidden rather than shown broken.
  const show = src.slice(src.indexOf('function cfShowPortal'), src.indexOf('async function cfPortalAct'));
  t.check(/block\.style\.display = \(c && clientAccountsTable\) \? '' : 'none';/.test(show),
    'a shop without the table sees no portal block at all, not a button that cannot work');
}

/* ---------- 4. nought is an agreement, not a silence ------------------ */
{
  const { cfReadTerms } = compileScope(
    [extractFunction(src, 'cfReadTerms', 'index.html')],
    {
      customerTermsColumns: true,
      document: { getElementById: (id) => ({ value: ({ c_terms_days: '0', c_credit_limit: '' })[id] }) },
    },
    ['cfReadTerms'],
  );
  const got = cfReadTerms();
  t.check(got.termsDays === 0,
    `"0 days to pay" is cash terms and survives the read (got ${JSON.stringify(got.termsDays)})`);
  t.check(got.creditLimit === null,
    `an empty box is nobody-has-said, which is not the same thing (got ${JSON.stringify(got.creditLimit)})`);

  const zeroLimit = compileScope(
    [extractFunction(src, 'cfReadTerms', 'index.html')],
    {
      customerTermsColumns: true,
      document: { getElementById: (id) => ({ value: ({ c_terms_days: '', c_credit_limit: '0' })[id] }) },
    },
    ['cfReadTerms'],
  ).cfReadTerms();
  t.check(zeroLimit.creditLimit === 0 && zeroLimit.termsDays === null,
    'and a limit of nought — barred from owing anything — is kept as nought');

  const off = compileScope(
    [extractFunction(src, 'cfReadTerms', 'index.html')],
    { customerTermsColumns: false, document: { getElementById: () => ({ value: '30' }) } },
    ['cfReadTerms'],
  ).cfReadTerms();
  t.check(Object.keys(off).length === 0,
    'with the columns absent the form contributes no fields at all, rather than nulls that would be written');

  // The read and write halves, which is where `||` would quietly do the
  // damage that the test above proves the form avoids.
  t.check(/termsDays: c\.terms_days \?\? null, creditLimit: c\.credit_limit \?\? null/.test(src),
    'loading uses ?? — `||` would read 0 days back as no terms at all');
  t.check(/terms_days: c\.termsDays == null \? null : Number\(c\.termsDays\)/.test(src),
    'and saving compares to null for the same reason');
}

/* ---------- 5. the hint does not overpromise -------------------------- */
/*
 * Nothing in this app enforces a credit limit. A hint that implied
 * otherwise would leave the shop believing an invoice would be stopped.
 */
{
  const hint = src.slice(src.indexOf('function cfTermsHint'), src.indexOf('function cfShowOwed'));
  t.check(/Nothing here stops an invoice/.test(hint),
    'the hint says the limit is a record, not a rule');
  t.check(/Their portal shows neither line/.test(hint),
    'and that with neither set, the customer is shown neither');
  t.check(/Cash — payment on the day/.test(hint),
    'nought days is described as what it is');
}

/* ---------- 6. the block, actually rendered --------------------------- */
/*
 * Sections 1-5 read the source. This one runs cfShowPortal against a stub
 * DOM in each state the shop can put an account into, because reading it
 * missed four things that one pass of rendering showed at once: a
 * suspended account offering "Issue a PIN" (which sets status back to
 * active, so a suspension would be lifted by a button that says nothing
 * about lifting it), "Suspended." printed twice, a locked-out account
 * described as "Open, nobody signed in", and dates in whatever format the
 * browser's locale happened to be.
 */
{
  const render = (account, pin) => {
    const nodes = {};
    ['c_portal_block', 'c_portal'].forEach((id) => {
      nodes[id] = { id, innerHTML: '', style: { display: '' }, addEventListener() {} };
    });
    const scope = compileScope(
      ['cfPhoneAsWritten', 'cfPinGoodUntil', 'cfShowPortal'].map(n => extractFunction(src, n, 'index.html')),
      {
        document: { getElementById: (id) => nodes[id] || null },
        esc: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        data: { customers: [{ id: 'C001', name: 'Nakato Grace', phone: '0772418903' }] },
        editingCustomerId: 'C001',
        clientAccountsTable: true,
        clientAccountsByCustomer: account ? { C001: account } : {},
        cfPinShown: pin || null,
        cfPortalAct: () => {}, toast: () => {}, navigator: {},
        /* The block builds the portal address out of where the admin app
           is being served from, so the scope has to supply a location to
           be served from. A shop on its own domain gets its own link. */
        location: { origin: 'https://omni-ware.vercel.app', pathname: '/index.html' },
        currentShopId: 'SHOP-7',
      },
      ['cfShowPortal'],
    );
    scope.cfShowPortal({ id: 'C001', name: 'Nakato Grace', phone: '0772418903' });
    return nodes.c_portal.innerHTML;
  };
  const base = {
    customerId: 'C001', phone: '772418903', status: 'active', createdAt: '2026-09-01',
    lastSeenAt: null, devices: 0, pinLive: false, pinExpiresAt: null, triesLeft: 3,
    lockedOut: false, phoneMatchesCustomer: true,
  };
  const words = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const count = (h, re) => (words(h).match(re) || []).length;

  // Suspended: issuing a PIN sets status back to active.
  const susp = render({ ...base, status: 'suspended' });
  t.check(!/id="c_portal_reissue"/.test(susp),
    'a suspended account offers no PIN button — issuing one would silently un-suspend it');
  t.check(/id="c_portal_restore"/.test(susp), 'only letting them back in, which is its own decision');
  t.check(count(susp, /Suspended/g) === 1,
    `and says "Suspended" once, not twice (${count(susp, /Suspended/g)})`);

  // Locked out: "Open, nobody signed in" is wrong for an account nobody
  // can sign into.
  const locked = render({ ...base, lockedOut: true, triesLeft: 0 });
  t.check(!/Open, nobody signed in/.test(locked),
    'a locked-out account is not described as open');
  t.check(/only a new PIN from here will/.test(locked), 'and the way out is named');
  t.check(count(locked, /Locked out/g) === 1, 'once');

  // The ordinary states still say something useful.
  t.check(/Open, nobody signed in/.test(render({ ...base })), 'a fresh account reads as open');
  t.check(/A PIN is outstanding/.test(render({ ...base, pinLive: true, pinExpiresAt: new Date(Date.now() + 40 * 60e3).toISOString() })),
    'an outstanding PIN says so');
  t.check(/Signed in on 2 devices/.test(render({ ...base, devices: 2 })), 'and devices are counted');
  t.check(/id="c_portal_revoke"/.test(render({ ...base, devices: 1 }))
    && !/id="c_portal_revoke"/.test(render({ ...base, devices: 0 })),
    'sign-out appears only where there is a device to sign out');

  // No account at all.
  const none = render(null);
  t.check(/id="c_portal_open"/.test(none) && !/id="c_portal_reissue"/.test(none),
    'a customer with no account is offered one');
  t.check(/no supplier and no cost/.test(none),
    'and the offer says what the customer will and will not see');

  // The number, as the shop has it written down.
  t.check(/0772418903/.test(render({ ...base })),
    'the nine-digit stored form goes back on screen with its leading zero');

  // Dates, pinned to a locale rather than the browser's.
  t.check(/toLocaleDateString\('en-GB'/.test(src) && /toLocaleString\('en-GB'/.test(src),
    'dates and times name their locale — 9/12/2026 and 12/9/2026 are different days');
  t.check(!/toLocaleDateString\(\)|toLocaleString\(undefined/.test(
    src.slice(src.indexOf('function cfPinGoodUntil'), src.indexOf('async function cfPortalAct'))),
    'and none is left to whatever the browser happens to be set to');

  // The PIN card, when one is on screen.
  const withPin = render({ ...base }, { pin: '4821', expiresAt: new Date(Date.now() + 24 * 3600e3).toISOString() });
  t.check(/cf-pin-figs">4821</.test(withPin),
    'the figures render as the four digits, selectable as one number');
  t.check(/only time they will be shown/.test(withPin), 'under the warning that says so');

  /* ---------- the address, which the figures are useless without ------ */
  /*
   * Four figures and no link is not a login. The shop had no way to
   * reach the portal from inside the app at all -- the address existed
   * only in a chat message -- and a shop that has to ask what its own
   * portal is called will send the wrong thing or nothing.
   *
   * The shop id matters more than it looks. `start` answers identically
   * whether or not a number has an account, on purpose: a portal that
   * says "no account on that number" tells a stranger who your customers
   * are. The cost of that is that a link carrying the WRONG shop id
   * behaves exactly like a working one -- the customer is told a PIN is
   * coming and then finds that no PIN ever works, with nothing anywhere
   * naming the cause. So the link is never hand-typed.
   */
  const withAccount = render({ ...base });
  t.check(/client\.html\?s=SHOP-7/.test(withAccount),
    'an open account shows the address to sign in at, carrying the shop id');
  t.check(/https:\/\/omni-ware\.vercel\.app\/client\.html/.test(withAccount),
    'built from where this app is served, not from a domain typed into the source');
  t.check(/client\.html\?s=SHOP-7/.test(withPin),
    'and it is there at the moment the figures are, which is when it is needed');
  t.check(!/client\.html/.test(none),
    'but not on a customer with no account, who has nothing to sign in with');

  // Long addresses are the normal case on a preview deployment. The URL
  // gives way; the button does not get pushed out of the card.
  const urlSpan = withAccount.slice(withAccount.indexOf('cf-portal-url'));
  t.check(/title="[^"]*client\.html\?s=SHOP-7[^"]*"/.test(withAccount),
    'the whole address is on the title, so truncating it never hides it');
  t.check(/id="c_portal_copylink"/.test(withAccount) && urlSpan.length > 0,
    'and there is a button to copy it rather than a link to read out down a phone');

  const css = src.slice(src.indexOf('.cf-portal-url{'), src.indexOf('.cf-portal-url{') + 260);
  ['overflow:hidden', 'text-overflow:ellipsis', 'white-space:nowrap', 'min-width:0'].forEach((d) => {
    t.check(css.includes(d), `the address truncates properly — ${d}`);
  });
}

process.exit(t.done() ? 1 : 0);
