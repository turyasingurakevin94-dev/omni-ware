#!/usr/bin/env node
'use strict';
/*
 * Three doors, three jobs.
 *
 * The sign-in screen was one generic dark box with inline styles and a
 * blue button (#2F7FBF) that appears nowhere else in the product. Two of
 * the three apps shared it verbatim, so an admin at a desk and a worker
 * holding a phone in a yard got the identical screen.
 *
 * They are now three:
 *
 *   admin    dark steel, split layout, "Create a new shop".
 *   worker   LIGHT, because it is read on a phone in midday sun where a
 *            dark screen is a mirror. 56px controls. No signup.
 *   agent    oxide ground, its own app, no webfont at all.
 *
 * Two things here are correctness rather than decoration:
 *
 *   the signup button   only the admin app can legitimately create an
 *                       account. A worker or agent is invited to a shop
 *                       that already exists, and an account made from
 *                       their screen belongs to no shop -- landing them
 *                       on the dead-end no-shop screen. The button was an
 *                       invitation to get stuck.
 *
 *   no host tokens      the shared screen ships literal hex and its own
 *                       <style>. --ow-steel-950 is defined in index.html
 *                       and NOT in worker.html, and a var() that resolves
 *                       to nothing takes its whole declaration with it --
 *                       which is how the admin board's Assign button once
 *                       turned white-on-white. A sign-in screen has no app
 *                       behind it to fall back on.
 *
 * Run: node test/auth-login-screens.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('auth login screens');
const sharedJs = read('shared-worker.js');
const adminHtml = read('index.html');
const workerHtml = read('worker.html');
const agentHtml = read('agent.html');

const stripComments = (s) => s
  // Lookbehind: `accept="image/*"` is not a comment opener, and treating
  // it as one hides 104,248 characters of markup from every check below.
  .replace(/(?<![\w"'])\/\*[\s\S]*?\*\//g, '')
  .split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. which app am I ----------------------------------------- */
{
  // Read at CALL time, not parse time: both hosts load shared-worker.js
  // before their own script, so the global does not exist yet when this
  // file is evaluated.
  const withRole = (role) => compileScope([
    role === undefined ? '' : `var OW_APP_ROLE = ${JSON.stringify(role)};`,
    extractFunction(sharedJs, 'authAppRole', 'shared-worker.js'),
  ].filter(Boolean), {}, ['authAppRole']).authAppRole();

  t.check(withRole('worker') === 'worker', 'the worker app gets the worker screen');
  t.check(withRole('admin') === 'admin', 'the admin app gets the admin one');
  t.check(withRole(undefined) === 'admin',
    'and a host that declares nothing gets admin -- the only app that can legitimately create an account');
  t.check(withRole('') === 'admin' && withRole('WORKER') === 'admin',
    'anything that is not exactly "worker" falls to admin rather than guessing');

  t.check(/typeof OW_APP_ROLE !== 'undefined'/.test(extractFunction(sharedJs, 'authAppRole', 'shared-worker.js')),
    'guarded with typeof, so an undeclared global is a fallback and not a ReferenceError');

  const admin = stripComments(adminHtml), worker = stripComments(workerHtml);
  t.check(/var OW_APP_ROLE = 'admin';/.test(admin), 'the admin host declares itself');
  t.check(/var OW_APP_ROLE = 'worker';/.test(worker), 'and so does the worker host');
  t.check(admin.indexOf("<script src=\"shared-worker.js\">") < admin.indexOf("var OW_APP_ROLE"),
    'after the shared file loads, which is why it has to be read at call time');
}

/* ---------- 2. only the admin can create an account ------------------- */
{
  const fn = extractFunction(sharedJs, 'showLoginScreen', 'shared-worker.js');
  const [adminMarkup, workerMarkup] = fn.split('` : `');

  t.check(/auth_signup_btn/.test(adminMarkup), 'the admin screen offers account sign-up (an account, never a shop)');
  t.check(!/auth_signup_btn/.test(workerMarkup.split('const signupBtn')[0]),
    'the worker screen does not, because an account made there would belong to no shop');
  t.check(!/auth_signup_btn/.test(extractFunction(agentHtml, 'showLoginScreen', 'agent.html')),
    'and neither does the agent screen -- agents are invited too');

  // The handler has to survive the button being absent.
  t.check(/const signupBtn = el\.querySelector\('#auth_signup_btn'\);/.test(fn),
    'the button is looked up once');
  t.check(/if\(signupBtn\) signupBtn\.addEventListener/.test(fn),
    'and wired only if it is there -- an unguarded null here breaks the one screen between a person and their work');
  t.check(/if\(signupBtn\) signupBtn\.disabled = on;/.test(fn),
    'including when the form is disabled mid-request');
  t.check(!/el\.querySelector\('#auth_signup_btn'\)\.addEventListener/.test(fn),
    'with no unguarded reference left anywhere');

  // Both screens still tell an invited person how to get in.
  t.check(/Staff tab/.test(workerMarkup), 'the worker screen says how to get an account instead');
  t.check(/invited by the shop/.test(extractFunction(agentHtml, 'showLoginScreen', 'agent.html')),
    'and so does the agent screen');
}

/* ---------- 3. it cannot be broken by a host's missing token ---------- */
{
  const styles = extractFunction(sharedJs, 'injectAuthStyles', 'shared-worker.js');
  const agentStyles = extractFunction(agentHtml, 'injectAgentAuthStyles', 'agent.html');

  t.check(!/var\(--/.test(styles),
    'the shared sign-in screen reads no design token: --ow-steel-950 exists in index.html and not in worker.html');
  t.check(!/var\(--/.test(agentStyles), 'and neither does the agent one');

  const login = extractFunction(sharedJs, 'showLoginScreen', 'shared-worker.js');
  t.check(!/var\(--/.test(login) && !/var\(--/.test(extractFunction(agentHtml, 'showLoginScreen', 'agent.html')),
    'nor does either markup');

  t.check(/#B23A26/.test(styles) && /#14171B/.test(styles),
    'the palette is the same one, written literally');
  t.check(/'Archivo Black','Manrope'/.test(styles) || /'Manrope','Archivo Black'/.test(styles),
    'and the display face names both hosts\' faces, so each app is set in the one it already loads');
  t.check(!/fonts\.googleapis/.test(agentStyles) && !/@import/.test(agentStyles),
    'the agent screen adds no webfont -- that app deliberately ships none, and a door that waits on a font hangs');

  // Injected once, however many times the screen is drawn.
  t.check(/if\(document\.getElementById\('owAuthStyles'\)\) return;/.test(styles),
    'the stylesheet is injected once rather than on every render');
  t.check(/if\(document\.getElementById\('agAuthStyles'\)\) return;/.test(agentStyles), 'same in the agent app');
}

/* ---------- 4. the screens that come after it still work -------------- */
{
  // ensureAuthOverlay hands the SAME element to every auth step. The login
  // paints its own ground over it, so without a reset the next screen --
  // set a password, create a shop, pick a shop -- inherited the login's
  // layout with its own inline styles landing half-applied on top.
  [['shared-worker.js', sharedJs], ['agent.html', agentHtml]].forEach(([where, src]) => {
    const fn = extractFunction(src, 'ensureAuthOverlay', where);
    t.check(!/if\(el\) return el;/.test(fn),
      `${where}: the overlay is no longer returned untouched when it already exists`);
    t.check(/el\.className = '';/.test(fn) && /el\.style\.cssText =/.test(fn),
      `${where}: its default look is re-applied on every call`);
  });
  t.check(/el\.removeAttribute\('data-role'\);/.test(extractFunction(sharedJs, 'ensureAuthOverlay', 'shared-worker.js')),
    'and the role is cleared, so a later screen cannot be styled as a login');
}

/* ---------- 5. reachable, and usable on a phone ----------------------- */
{
  const styles = extractFunction(sharedJs, 'injectAuthStyles', 'shared-worker.js');
  const login = extractFunction(sharedJs, 'showLoginScreen', 'shared-worker.js');
  const agentLogin = extractFunction(agentHtml, 'showLoginScreen', 'agent.html');
  const agentStyles = extractFunction(agentHtml, 'injectAgentAuthStyles', 'agent.html');

  t.check(/min-height:56px/.test(styles),
    'the worker\'s controls are 56px, because they are tapped with one hand while the other holds a bag');
  t.check(/font-size:17px/.test(styles) && /font-size:16\.5px/.test(agentStyles),
    'and the inputs are 16px or over, under which iOS zooms the page on focus');

  [['shared', login], ['agent', agentLogin]].forEach(([which, fn]) => {
    t.check(/type="email"/.test(fn) && /autocomplete="username"/.test(fn)
      && /autocomplete="current-password"/.test(fn),
    `${which}: the fields are typed, so a password manager and the right keyboard both work`);
    t.check(/aria-live="polite"/.test(fn), `${which}: the status line is announced rather than only seen`);
    t.check(/<label for="auth_email">/.test(fn), `${which}: the inputs are labelled`);
    t.check(/if\(e\.key==='Enter'\)/.test(fn),
      `${which}: Enter submits -- the phone keyboard's own go key did nothing before`);
  });

  t.check(/prefers-reduced-motion/.test(styles) && /prefers-reduced-motion/.test(agentStyles),
    'and both respect a reduced-motion preference');
  t.check(/@media \(max-width:820px\)/.test(styles),
    'the admin split collapses on a narrow screen rather than squeezing two columns');
}

/* ---------- 6. the APK copy carries all of it ------------------------- */
{
  const wwShared = read('worker-www/shared-worker.js');
  const wwIndex = read('worker-www/index.html');
  t.check(wwShared === sharedJs, 'worker-www/shared-worker.js is byte-identical to the source');
  t.check(/var OW_APP_ROLE = 'worker';/.test(stripComments(wwIndex)),
    'and the packaged worker app declares its role, or it would ship the admin door');
}

/* ---------- 6. nobody creates a shop from a login screen -------------- *
 * With email verification off, any visitor could sign up and be OFFERED a
 * blank shop -- and the old RLS policy let them take it. One stranger
 * shop existed. The door is closed at both ends: no client app carries a
 * shops insert, and migration 0059 drops the policy that would have
 * allowed one anyway.
 */
{
  [['shared-worker.js', sharedJs], ['index.html', adminHtml], ['agent.html', agentHtml]].forEach(([where, src]) => {
    t.check(!/from\('shops'\)\s*\.\s*insert/.test(src) && !/showCreateShopScreen/.test(src),
      `${where}: no code path creates a shop`);
  });
  const branch = extractFunction(sharedJs, 'ensureAuthAndShop', 'shared-worker.js');
  t.check(/if\(typeof showNoShopScreen === 'function'\)\{ await showNoShopScreen\(\); return; \}[\s\S]{0,40}await showNoShopDefaultScreen\(\); return;/.test(branch),
    'an account with no membership hits a dead end in every host — never an offer');
  const dead = extractFunction(sharedJs, 'showNoShopDefaultScreen', 'shared-worker.js');
  t.check(/shops can't be created from this screen/.test(dead),
    'and the dead end says so in words');
  t.check(/noshop_signout_btn/.test(dead) && /addEventListener\('click', signOutAndReload\)/.test(dead),
    'with a signed-out way back, since it is most often reached with the wrong account');

  const mig = read('supabase/migrations/0059_no_client_shop_creation.sql');
  t.check(/drop policy if exists "any authenticated user can create a shop" on shops;/.test(mig),
    'the policy that let anyone create a shop is dropped');
  t.check(/drop policy if exists "bootstrap owner or admin invites" on shop_members;/.test(mig)
    && /create policy "admin invites only" on shop_members/.test(mig)
    && /with check \(is_shop_admin\(shop_id\)\);/.test(mig),
    'and the bootstrap self-invite goes with it — membership comes from an admin or the invite function');
}

process.exit(t.done() ? 1 : 0);
