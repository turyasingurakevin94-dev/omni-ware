#!/usr/bin/env node
'use strict';
/*
 * Being paused, from the agent's side.
 *
 * agent-submit-order refuses a paused agent's order with 403 and
 * `paused: true`. Landing that as `toast('Could not submit order: ...')`
 * was legible and wrong in four ways: a toast disappears, "could not
 * submit" invites a retry that will always fail, it arrives only after a
 * whole basket has been built, and nothing else in the app knows -- so
 * the agent goes on browsing, pricing and adding clients for an order
 * that cannot be placed.
 *
 * A pause is a STATE. It gets a banner that stays until the shop lifts
 * it, a submit button that says why it will not work, and a basket that
 * is deliberately left alone so their work survives.
 *
 * It is NOT retirement and must not be treated like it: retiring closes
 * current_agent_id(), so every policy shuts and the app would load empty
 * -- which is why signing in is refused outright for a retired agent. A
 * pause leaves clients, orders, earnings and catalogue open on purpose.
 *
 * Run: node test/agent-paused.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent paused');
const src = read('agent.html');
const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const submitFn = read('supabase/functions/agent-submit-order/index.ts');

/* A DOM small enough to hold the two elements the state touches, so the
   state machine is exercised rather than described. */
const made = [];
const els = {
  ag_pausedBanner: { style: { display: 'none' } },
  ag_submit_btn: { disabled: false, textContent: 'Submit order', parentNode: null },
};
const btnParent = {
  children: [],
  insertBefore(node) { this.children.push(node); els[node.id] = node; },
};
els.ag_submit_btn.parentNode = btnParent;
const document = {
  getElementById: (id) => els[id] || null,
  createElement: () => {
    const n = { className: '', id: '', textContent: '', remove() { delete els[this.id]; btnParent.children = btnParent.children.filter((c) => c !== this); } };
    made.push(n); return n;
  },
};

/* callAgentFn is compiled too, against a stub of what supabase-js hands
   back on a non-2xx: a generic message, with the function's own body
   only reachable through error.context. Running it is the only way to
   show that a refusal WITHOUT a paused flag does not raise the state --
   a regex over the source cannot tell the difference. */
let reply = null;
const sb = { functions: { invoke: async () => reply } };
const NAMES = ['setAgentPaused', 'applyPausedToCart', 'callAgentFn'];
let scope = null; let err = null;
try {
  scope = compileScope([
    'let agentPaused = false;',
    'let currentShopId = "shop-1";',
    ...NAMES.map((n) => extractFunction(src, n, 'agent.html')),
    'function readPaused(){ return agentPaused; }',
  ], { document, sb }, [...NAMES, 'readPaused']);
} catch (e) { err = e; }
t.check(!!scope, `the paused-state helpers compile${err ? ` (${err.message})` : ''}`);

// What supabase-js produces for a non-2xx: the useful body is on .context.
const refusal = (body) => ({
  data: null,
  error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: { status: 403, json: async () => { if (body === undefined) throw new Error('not json'); return body; } },
  }),
});

const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const callFn = (/async function callAgentFn\(name, body\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
// To the closing brace at column 0 -- `\n  }` stops at the first nested
// block, which cut the extract off above the line this section is about
// and let the check pass on text it had never seen.
const boot = (/async function boot\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
const fetchRows = (/async function fetchAgentHomeRows\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
const loadHome = (/async function loadAgentHomeData\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
const submitClick = (/getElementById\('ag_submit_btn'\)\.addEventListener[\s\S]*?\n\}\);/.exec(code) || [''])[0];
const ensureAuth = (/async function ensureAgentAuth\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];

(async () => {
/* ---------- 1. the state, both ways --------------------------------- */
if (scope) {
  scope.setAgentPaused(true);
  eq(els.ag_pausedBanner.style.display, 'flex', 'a pause raises a banner that stays put');
  eq(els.ag_submit_btn.disabled, true, 'and takes the submit button away');
  eq(els.ag_submit_btn.textContent, 'Orders are paused',
    'which says what it is rather than looking broken');
  t.check(!!els.ag_submit_blocked, 'with the reason written beside it');
  t.check(/stay in your basket until they lift it/.test(els.ag_submit_blocked.textContent),
    'and a promise that their work is not being thrown away');

  scope.setAgentPaused(false);
  eq(els.ag_pausedBanner.style.display, 'none', 'lifting it puts the banner away');
  eq(els.ag_submit_btn.disabled, false, 'gives the button back');
  eq(els.ag_submit_btn.textContent, 'Submit order', 'under its own name again');
  t.check(!els.ag_submit_blocked, 'and clears the note rather than leaving it under a working button');

  // Called twice running, which is what a refresh does, and must not
  // stack a second note under the button.
  scope.setAgentPaused(true); scope.setAgentPaused(true);
  eq(btnParent.children.length, 1, 'and a second pause does not stack a second note');
  scope.setAgentPaused(false);
}

/* ---------- 2. the basket is not touched ----------------------------- *
 * Their work survives the pause. Clearing it would punish the agent for
 * a decision the shop made.
 */
{
  const applied = (/function applyPausedToCart\(\)\{[\s\S]*?\n\}/.exec(code) || [''])[0];
  t.check(!/cart\s*=\s*\[\]/.test(applied) && !/resetCartAfterSubmit/.test(applied),
    'a pause empties nobody’s basket');
}

/* ---------- 3. the refusal has to survive the throw ------------------ *
 * callAgentFn read the function's { error } string and dropped
 * everything around it, so a server that says WHY it refused was
 * indistinguishable from one that just failed.
 */
if (scope) {
  const call = async (name) => {
    try { return { ok: await scope.callAgentFn(name, {}) }; } catch (e) { return { e }; }
  };

  // The pause. An agent who was working when the shop paused them finds
  // out here, not at the next sign-in.
  scope.setAgentPaused(false);
  reply = refusal({ error: 'Your account is paused. Talk to the shop before placing new orders.', paused: true });
  let r = await call('agent-submit-order');
  t.check(!!r.e && r.e.paused === true, 'a refusal that says it was a pause arrives saying so');
  t.check(!!r.e && !!r.e.body, 'with the whole body kept, not only its message');
  eq(r.e.message, 'Your account is paused. Talk to the shop before placing new orders.',
    'and the server\'s own words rather than "returned a non-2xx status code"');
  eq(scope.readPaused(), true, 'and the state is raised the moment the server says so');

  /* A refusal for some OTHER reason must not raise it. This is the case
     a regex over the source cannot see: `if(body)` and `if(body &&
     body.paused)` look equally plausible in the file and differ only
     when a function refuses for a reason of its own. */
  scope.setAgentPaused(false);
  reply = refusal({ error: "That client doesn't belong to this agent" });
  r = await call('agent-submit-order');
  t.check(!!r.e && !r.e.paused, 'while a refusal for any other reason claims no pause');
  eq(scope.readPaused(), false, 'and leaves the agent working');

  // A gateway page, a proxy error -- anything that is not the function
  // answering. It cannot be read, so it must claim nothing.
  scope.setAgentPaused(false);
  reply = refusal(undefined);
  r = await call('agent-submit-order');
  eq(r.e.message, 'Edge Function returned a non-2xx status code',
    'a body that is not JSON leaves the generic message');
  t.check(!r.e.paused && scope.readPaused() === false,
    'and claims no pause, since nothing readable said there was one');

  /* Only THIS function proves anything. agent-submit-order is the one
     the server checks, so its success is the evidence a pause was
     lifted; any other call succeeding says nothing about it. */
  scope.setAgentPaused(true);
  reply = { data: { orderId: 42 }, error: null };
  r = await call('agent-submit-order');
  t.check(!!r.ok && r.ok.orderId === 42, 'a submit that gets through returns what it returned');
  eq(scope.readPaused(), false, 'and clears the state, because the server would have refused it');

  scope.setAgentPaused(true);
  reply = { data: { ok: true }, error: null };
  await call('agent-catalog');
  eq(scope.readPaused(), true,
    'while some other call succeeding proves nothing — only the gated one does');
  scope.setAgentPaused(false);
}

/* ---------- 4. found out before the basket, not after ---------------- */
{
  t.check(/paused: !!agentRow\.unavailable/.test(ensureAuth),
    'signing in reads whether they are paused, off a row it was already selecting');
  /* Refusing to sign in is what RETIREMENT does, and for a reason that
     does not apply here: current_agent_id() no longer resolves, so the
     app would load empty. A paused agent keeps everything. */
  t.check(/if\(agentRow\.retired_at\)\{/.test(ensureAuth)
    && !/if\(agentRow\.unavailable\)\{\s*throw/.test(ensureAuth),
  'and a pause lets them in, unlike a retirement, because everything else still works');
  t.check(/Everything else &mdash; your clients, your orders, your catalogue &mdash; is still here/.test(src),
    'with the banner saying exactly that');
  t.check(/Talk to the shop to have it lifted/.test(src), 'and what to do about it');
}

/* ---------- 5. a cached boot does not guess ------------------------- *
 * The offline snapshot carries whatever was true at the last sign-in.
 * Believing a stale PAUSED would lock a working agent out of the only
 * thing the app is for, with no way to disprove it until they had signal
 * again; a stale ACTIVE costs one refused submit, which now explains
 * itself. So the pessimistic direction is the one that needs a live read.
 */
{
  t.check(/setAgentPaused\(!bootedFromCache && myAgent && myAgent\.paused\);/.test(boot),
    'a boot from cache does not apply a pause it cannot confirm');
}

/* ---------- 6. lifting it reaches them ------------------------------- *
 * The submit button is disabled while paused, so the succeeded-submit
 * path that clears the flag can never be reached from inside the app.
 * Without a re-read an agent would stay visibly paused until they signed
 * in again, long after the shop had let them go.
 */
{
  t.check(/sb\.from\('agents'\)\.select\('unavailable'\)/.test(fetchRows),
    'every refresh re-reads their own row');
  t.check(/Promise\.all\(\[[\s\S]*?sb\.from\('agents'\)\.select\('unavailable'\)[\s\S]*?\]\)/.test(fetchRows),
    'inside the reads already being made, so it costs no extra round trip');
  /* Non-fatal, and it matters more here than for the inquiries: refusing
     to show an agent their orders because a status check failed would be
     a worse outage than the pause. */
  t.check(/if\(meErr\) console\.warn/.test(fetchRows) && !/if\(meErr\) throw/.test(fetchRows),
    'and a failed status check does not take the whole screen down with it');
  t.check(/me: \(!meErr && meData && meData\.length\) \? meData\[0\] : null/.test(fetchRows),
    'reporting absence as absence rather than as not-paused');
  t.check(/if\(rows\.me\) setAgentPaused\(!!rows\.me\.unavailable\);/.test(loadHome),
    'so the state only moves on a row that actually came back');
}

/* ---------- 7. what the agent is told when they tap ------------------ */
{
  t.check(/err\.paused$/m.test(submitClick) || /err\.paused\n/.test(submitClick)
    || /toast\(err\.paused/.test(submitClick),
  'the submit handler tells a pause apart from a failure');
  t.check(/Your account is paused — the shop has to lift it before orders can go through/.test(submitClick),
    'and says whose decision it was and what changes it');
  /* "Could not submit order" is the wrong sentence: it describes a thing
     that might work next time. */
  t.check(/err\.paused\s*\?[\s\S]{0,140}?paused[\s\S]{0,200}?Could not submit order/.test(submitClick),
    'reaching the retry wording only when a retry could actually help');
  /* The finally re-enables the button unconditionally, which would hand
     it straight back and undo the block. */
  t.check(/btn\.disabled = false;\s*\n\s*applyPausedToCart\(\);/.test(submitClick),
    'and re-enabling the button after the attempt does not undo the pause');
}

/* ---------- 8. the server is still the one that decides -------------- */
{
  t.check(/if \(agent\.unavailable\) \{/.test(submitFn) && /paused: true/.test(submitFn),
    'none of this is the gate — the server refuses the order and says why');
  /* Which is what makes guessing ACTIVE on a cached boot safe: the worst
     case is one refused submit, not an order that should not exist. */
  t.check(/403/.test(submitFn), 'as a refusal, not a quiet success');
}

process.exit(t.done() ? 1 : 0);
})();
