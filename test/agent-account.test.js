#!/usr/bin/env node
'use strict';
/*
 * The agent Account screen.
 *
 * It held an avatar, a name, one contact line, a link to order history and
 * a sign-out row -- the thinnest screen in the app, and it left out the one
 * fact that governs how this agent has to work.
 *
 * payment_term ('prepay' | 'pay_on_delivery', 0012_sales_agents.sql)
 * decides whether a draft order moves after it is submitted. A prepay
 * agent's order sits until they have paid the shop for it. The app applied
 * that rule in three places and never once stated it, so you learned your
 * own terms by submitting an order that would not budge.
 *
 * The other thing this screen owns is the sign-out button, and sign-out
 * calls clearOfflineCache(). That is the only copy of an agent's clients,
 * orders and prices when there is no signal, and signing back in needs a
 * connection -- so an accidental tap offline strands them, from a row that
 * looked exactly like "Order history" one line above it.
 *
 * Run: node test/agent-account.test.js   (or: npm test)
 */
const { read, extractFunction, createReporter } = require('./_extract');

const t = createReporter('agent account');
const src = read('agent.html');
const code = src.split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');

/* ---------- 1. every token used is a token defined ------------------- */
/*
 * A swept check rather than a list, because the bug it catches is exactly
 * the kind a list misses: --ink-faint was referenced by four rules in this
 * file and defined by none of them (only worker.html declared it). CSS
 * fails silently -- an unresolvable var() leaves the property unset, so
 * every one of those rules quietly rendered at inherited full ink and the
 * text meant to recede was the same weight as the text above it.
 */
{
  const styleBlock = (/<style>([\s\S]*?)<\/style>/.exec(src) || ['', ''])[1];
  // Definitions look like "--name:" at the start of a declaration.
  //
  // Only bare `var(--name)` references have to resolve. `var(--name, 0)`
  // carries its own fallback and is allowed to be undefined at parse time
  // -- --pct is exactly that: declared nowhere in CSS and set per-element
  // at runtime via style.setProperty. Accepting the comma here reported it
  // as missing, which is the same false-positive trap the flex-gap lint
  // rule fell into twice.
  const defined = new Set([...styleBlock.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const used = new Set([...styleBlock.matchAll(/var\((--[\w-]+)\s*\)/g)].map(m => m[1]));
  const missing = [...used].filter(v => !defined.has(v));
  t.check(missing.length === 0,
    `every custom property agent.html uses, agent.html defines${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  t.check(used.size > 40, `and the sweep actually looked (${used.size} distinct properties referenced)`);

  // The one that was missing, pinned by name.
  t.check(/--ink-faint: var\(--ow-ink-400\);/.test(src), '--ink-faint is defined');
  t.check(/--ow-ink-400:#6B7480;/.test(src), 'as a real third ink step');
  t.check((styleBlock.match(/var\(--ink-faint\)/g) || []).length >= 4,
    'and the rules that were silently inheriting now resolve');
}

/* ---------- 2. contrast on the two amber grounds --------------------- */
/*
 * Amber text on the amber ground measured 3.57:1. 12.5px bold is nowhere
 * near the 18.66px that would let it off at 3:1, so the offline banner --
 * the one element whose entire job is to be read while something is wrong
 * -- was the least readable thing on the screen.
 */
{
  const lum = (hex) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const AMBER = '#B0700A', AMBER_BG = '#FBEFD9', INK = '#14171B', PAPER = '#FFFFFF', INK_FAINT = '#6B7480';

  t.check(ratio(AMBER, AMBER_BG) < 4.5,
    `amber on amber fails AA (${ratio(AMBER, AMBER_BG).toFixed(2)}:1) -- which is why neither surface uses it for text`);
  t.check(ratio(INK, AMBER_BG) >= 4.5, `ink on the amber ground clears it (${ratio(INK, AMBER_BG).toFixed(2)}:1)`);
  t.check(ratio(INK_FAINT, PAPER) >= 4.5,
    `and the new faint ink clears it on paper (${ratio(INK_FAINT, PAPER).toFixed(2)}:1), so quieter is not unreadable`);

  t.check(/\.ag-offline-banner\{[^}]*color:var\(--ink\)/.test(src), 'the banner text is ink');
  t.check(/\.ag-offline-banner \.icon\{color:var\(--bonus\);?\}/.test(src),
    'and the amber survives on the icon, which carries no words');
  // border-color is exactly how it signals, so only a bare `color:` counts.
  const syncWarn = (/\.ag-sync-card\.warn\{([^}]*)\}/.exec(src) || ['', ''])[1];
  t.check(syncWarn.length > 0 && !/(^|;)\s*color:/.test(syncWarn),
    'the sync card lets the border and ground do the signalling rather than colouring its text');
}

/* ---------- 3. the terms of the working relationship ----------------- */
{
  t.check(/PAYMENT_TERM_COPY = \{/.test(code), 'both settlement terms have copy');
  ['prepay', 'pay_on_delivery'].forEach(k => {
    t.check(new RegExp(`${k}: \\{`).test(code), `${k} is covered -- the two values 0012_sales_agents.sql allows`);
  });
  t.check(/const term = PAYMENT_TERM_COPY\[myAgent\.paymentTerm\];/.test(code), 'the agent\'s own term is looked up');
  t.check(/if\(!term\)\{[\s\S]{0,120}Ask the shop how your orders are settled/.test(code),
    'an unrecognised term is admitted, not guessed at -- inventing the wrong one is worse than saying nothing');

  // No edit affordance: it is a trust setting only an admin can change.
  t.check(/Only the shop can change this\./.test(code),
    'and the card says who can change it, so it does not read as a broken control');
  t.check(!/id="ag_termCard"[^>]*>\s*<(button|input|select)/.test(src),
    'with nothing on it to tap');
}

/* ---------- 4. what the screen shows about you ----------------------- */
{
  t.check(/\[myAgent\.phone, myAgent\.email\]\.filter\(Boolean\)/.test(code),
    'phone and email are both shown -- it was `phone || email`, which hid whichever came second');
  t.check(/No phone or email on file/.test(code), 'and an agent with neither is told so');

  t.check(/const s = computeAgentStats\(\);/.test(code),
    'the lifetime figures reuse the stats Home already computes -- no new query');
  t.check(/fmtCompactUGX\(s\.lifetimeEarnings\)/.test(code), 'earnings are compacted to fit a third of a phone');
  t.check(/s\.completedOrders===1\?'order done':'orders done'/.test(code)
    && /agentClients\.length===1\?'client':'clients'/.test(code),
    'and the labels are pluralised, since a new agent sees exactly one of each');
}

/* ---------- 5. the sync card, and why it is on this screen ----------- */
{
  // Scoped to the function. `const cached = ownCachedSnapshot();` appears
  // three times in this file, so an unscoped match is satisfied by any of
  // them -- a mutation swapping THIS one for loadOfflineCache() slipped
  // straight past the first version of this check.
  let body = '';
  try { body = extractFunction(src, 'renderSyncCard', 'agent.html'); } catch (e) { /* reported below */ }
  t.check(body.length > 0, 'renderSyncCard is found');
  t.check(/ownCachedSnapshot\(\)/.test(body) && !/loadOfflineCache\(\)/.test(body),
    'it reads the snapshot belonging to THIS login -- loadOfflineCache would hand back whatever agent used the device last, and that roster is private to them');
  t.check(/const stale = isOffline \|\| dataLooksSuspect;/.test(body),
    'and both "no signal" and "the read looked wrong" count as working from a copy');
  t.check(/card\.classList\.toggle\('warn', stale\)/.test(body), 'which is what colours it');
  t.check(/if\(!cached\)\{[\s\S]{0,140}Nothing is saved on this phone yet/.test(body),
    'a device with no snapshot says so rather than claiming a fresh sync');
}

/* ---------- 6. sign-out asks first ----------------------------------- */
/*
 * The consequence is specific and worth spelling out: offline, sign-out is
 * not reversible until you have a connection again.
 */
{
  t.check(/ag_signout_btn'\)\.addEventListener\('click', confirmSignOut\)/.test(code),
    'the sign-out row opens a confirmation instead of signing out');
  t.check(/function confirmSignOut\(\)/.test(code), 'which exists');
  t.check(/signOutAndReload\(\)/.test(code) && /id="ag_signout_confirm"/.test(code),
    'and only the confirm button actually signs out');
  t.check(/const offline = isOffline;/.test(code) && /You are offline\.<\/b>/.test(code),
    'the offline case gets its own wording');
  t.check(/signing back in needs a connection/.test(code),
    'naming the part that makes it unrecoverable -- the cache is gone and you cannot re-authenticate');
  t.check(/Stay signed in/.test(code), 'the way out is a plain label, not "Cancel"');

  // clearOfflineCache is what makes this destructive; it must still be
  // reached only through signOutAndReload.
  t.check(/async function signOutAndReload\(\)\{\s*[\s\S]{0,300}?clearOfflineCache\(\);/.test(code),
    'sign-out still clears the snapshot -- the confirmation is the guard, not a change of behaviour');
}

/* ---------- 7. the screen is ordered by what it is for --------------- */
{
  const view = (/<div id="ag_accountView"[\s\S]*?\n  <\/div>/.exec(src) || [''])[0];
  const seq = [...view.matchAll(/id="(ag_termCard|ag_lifetimeStats|ag_menu_orders|ag_syncCard|ag_signout_btn)"/g)].map(m => m[1]);
  t.check(seq.join(',') === 'ag_termCard,ag_lifetimeStats,ag_menu_orders,ag_syncCard,ag_signout_btn',
    `who you are, then what you have done, then where to go, then the device, then the way out (${seq.join(' -> ')})`);
  t.check(view.indexOf('ag_syncCard') < view.indexOf('ag_signout_btn'),
    'and what sign-out destroys is stated directly above the button that destroys it');
}

process.exit(t.done() ? 1 : 0);
