#!/usr/bin/env node
'use strict';
/*
 * A worker who belongs to no shop must not be offered one.
 *
 * ensureAuthAndShop is shared, and its answer to "you are a member of no
 * shop" was the admin app's: a Create your shop form. In a picker's hands
 * that is the wrong answer. They reach it because their membership is
 * missing -- an invite not yet processed, an admin removing them, a personal
 * account signed in by mistake -- and creating a shop would make them the
 * owner of an empty one, cut off from the orders they were trying to reach,
 * with a junk shop left behind in the database.
 *
 * What they need is an invite, which only their admin can send. So the host
 * answers this rather than the shared file, and the admin app's behaviour is
 * unchanged.
 *
 * Run: node test/worker-no-shop.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('worker no shop');
const sharedJs = read('shared-worker.js');
const workerHtml = read('worker.html');
const adminHtml = read('index.html');

// The real ensureAuthAndShop, with each host's answer supplied or withheld.
function build({ memberships, hostAnswers }) {
  const seen = [];
  const scope = (new Function(
    'sb', 'getAuthedUser', 'showLoginScreen', 'showSetPasswordScreen',
    'showCreateShopScreen', 'showNoShopDefaultScreen', 'showShopPicker', 'hideAuthOverlay', 'showNoShopScreen',
    'initialAuthLinkType', `
    let currentUser = null, currentShopId = null, currentMemberRole = null;
    ${extractFunction(sharedJs, 'ensureAuthAndShop', 'shared-worker.js')}
    return { ensureAuthAndShop, state: () => ({ currentShopId, currentMemberRole }) };
  `))(
    {
      from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: memberships, error: null }) }) }),
    },
    async () => ({ id: 'U1' }),
    async () => { seen.push('login'); },
    async () => { seen.push('setPassword'); },
    async () => { seen.push('CREATE SHOP OFFERED'); return 'shop-new'; },   // a canary: nothing should ever call it
    async () => { seen.push('DEFAULT DEAD END'); },
    async () => { seen.push('shopPicker'); return 'shop-2'; },
    () => seen.push('overlayHidden'),
    hostAnswers ? async () => { seen.push('NO SHOP MESSAGE'); } : undefined,
    null,
  );
  return { scope, seen };
}

(async () => {

/* ---------- 1. the worker app says ask your admin --------------------- */
{
  const { scope, seen } = build({ memberships: [], hostAnswers: true });
  await scope.ensureAuthAndShop();

  t.check(seen.includes('NO SHOP MESSAGE'), 'a worker with no membership is told what to do about it');
  t.check(!seen.includes('CREATE SHOP OFFERED'), 'and is not offered a shop of their own');
  t.check(scope.state().currentShopId === null,
    'nothing is loaded against a shop that does not exist');
  t.check(!seen.includes('overlayHidden'),
    'and the overlay stays up, because there is nothing behind it to show');
}

/* ---------- 2. the admin app gets the dead end too -------------------- */
/*
 * This section used to assert the opposite -- "a host that offers no
 * opinion still gets the create-shop flow". That flow is gone: with email
 * verification off it was the door any stranger could walk through, and
 * migration 0059 bricked it server-side. A host with no opinion now gets
 * the shared dead end, never an offer.
 */
{
  const { scope, seen } = build({ memberships: [], hostAnswers: false });
  await scope.ensureAuthAndShop();

  t.check(seen.includes('DEFAULT DEAD END'),
    'a host that offers no opinion gets the shared dead end');
  t.check(!seen.includes('CREATE SHOP OFFERED'),
    'and nobody is offered a shop — the canary stays silent');
  t.check(scope.state().currentShopId === null,
    'nothing is loaded against a shop that does not exist');
}

/* ---------- 3. having a shop is unaffected either way ----------------- */
{
  for (const hostAnswers of [true, false]) {
    const one = build({ memberships: [{ shop_id: 'shop-1', role: 'member' }], hostAnswers });
    await one.scope.ensureAuthAndShop();
    t.check(one.scope.state().currentShopId === 'shop-1' && one.seen.includes('overlayHidden'),
      `a single membership loads straight through (host answers: ${hostAnswers})`);
    t.check(!one.seen.includes('NO SHOP MESSAGE') && !one.seen.includes('CREATE SHOP OFFERED'),
      `with neither screen shown (host answers: ${hostAnswers})`);

    const many = build({
      memberships: [{ shop_id: 'shop-1', role: 'member' }, { shop_id: 'shop-2', role: 'owner' }],
      hostAnswers,
    });
    await many.scope.ensureAuthAndShop();
    t.check(many.seen.includes('shopPicker') && many.scope.state().currentShopId === 'shop-2',
      `two memberships still ask which shop (host answers: ${hostAnswers})`);
  }
}

/* ---------- 4. the worker app actually provides the answer ------------ */
{
  t.check(/function showNoShopScreen\(\)/.test(workerHtml),
    'worker.html defines it');
  t.check(!/function showNoShopScreen\(\)/.test(adminHtml),
    'and index.html deliberately does not — it falls back to the shared dead end');

  const fn = extractFunction(workerHtml, 'showNoShopScreen', 'worker.html');
  t.check(/return new Promise\(\(\)=>\{/.test(fn),
    'it never resolves -- there is nothing to load, so boot stops with the message up');
  t.check(/worker invite/i.test(fn), 'it says what to ask for');
  t.check(/signOutAndReload/.test(fn),
    'and offers a way out, since signing in with the wrong account is the usual cause');

  // The shared file must only take the host's answer when there is one.
  const shared = extractFunction(sharedJs, 'ensureAuthAndShop', 'shared-worker.js');
  t.check(/if\(typeof showNoShopScreen === 'function'\)\{ await showNoShopScreen\(\); return; \}/.test(shared),
    'and the shared file checks before calling, so a host without one is unaffected');
  t.check(shared.indexOf('showNoShopScreen') < shared.indexOf('showNoShopDefaultScreen'),
    'asking the host first, so a host with its own wording keeps it');
}

process.exit(t.done() ? 1 : 0);
})();
