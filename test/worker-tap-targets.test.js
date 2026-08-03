#!/usr/bin/env node
'use strict';
/*
 * Everything pressable in the worker app owes 44px.
 *
 * The rule is already written into this app three times over -- the pick
 * card's badge says "44px minimum. This is pressed with one hand, often a
 * dirty one, by someone who has not stopped walking", the quantity sheet
 * repeats it for its buttons and its stepper keys -- and the chrome around
 * them did not follow it. Measured in a browser, Deny and Accept came out
 * 38px tall sitting side by side, "Mark as finished" 36.7, and sign-out
 * 34x34 in the top corner.
 *
 * A rule stated in prose next to the controls that happen to obey it is not
 * a rule. This is it stated once, over every control in the file.
 *
 * Sizes are read from CSS rather than a live layout because a control's
 * declared box is what the rule is about; the browser run that found these
 * agreed with it to the pixel.
 *
 * Run: node test/worker-tap-targets.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('worker tap targets');
const css = read('worker.html');

// Rules for things that get pressed. A control inherits from .btn unless it
// sets its own height, so .btn is the one that carries most of them.
const PRESSABLE = [
  ['.btn', 'every button in the app'],
  ['.wv-carousel-badge', 'the pick badge'],
  ['.wv-carousel-short', 'the short-pick control'],
  ['.wv-qty-step', 'the − / + keys'],
  ['.wv-qty-none', 'the "none on the shelf" button'],
  ['.wv-signout-icon', 'sign out'],
];

// Every rule whose selector ends in this class -- `.btn{…}` and
// `.wv-qty-actions .btn{…}` both count, `.btn-accent{…}` does not, because
// the class has to be followed by whitespace or the brace.
//
// Deliberately not anchored on what PRECEDES the selector: rules here are
// introduced by comments, and an earlier version keyed on the previous
// rule's closing brace found nothing for exactly the two selectors that
// carry a comment, and reported them as missing.
const ruleFor = (sel) => {
  const out = [];
  const re = new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`, 'g');
  let m;
  while ((m = re.exec(css))) out.push(m[1]);
  return out.join(';');
};
const dim = (body, prop) => {
  const m = new RegExp(`(?:^|;)\\s*(?:min-)?${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`).exec(body);
  return m ? Number(m[1]) : null;
};
// An invisible ::after ring counts: it is what the finger lands on.
const ring = (sel) => {
  const m = new RegExp(`${sel.replace('.', '\\.')}::after\\{[^}]*inset:(-?\\d+)px(?:\\s+(-?\\d+)px)?`).exec(css);
  if (!m) return null;
  const v = Math.abs(Number(m[1]));
  return { v, h: m[2] === undefined ? v : Math.abs(Number(m[2])) };
};

/* ---------- 1. every pressable control clears 44px -------------------- */
{
  const small = [];
  PRESSABLE.forEach(([sel, what]) => {
    const body = ruleFor(sel);
    if (!body) { small.push(`${what} (${sel}) has no rule at all`); return; }
    const r = ring(sel);
    const h = (dim(body, 'height') || 0) + (r ? r.v * 2 : 0);
    const w = (dim(body, 'width') || 0) + (r ? r.h * 2 : 0);
    // A control with no declared width is as wide as its label, which on
    // this screen is always more than 44 -- only height binds it.
    if (h < 44) small.push(`${what} (${sel}) is ${h || 'unset'}px tall`);
    if (dim(body, 'width') !== null && w < 44) small.push(`${what} (${sel}) is ${w}px wide`);
  });
  t.check(small.length === 0,
    small.length
      ? `pressed one-handed at a shelf, and under 44px: ${small.join('; ')}`
      : `every pressable control clears 44px (${PRESSABLE.length} checked)`);
}

/* ---------- 2. the base rule is where it belongs ---------------------- */
{
  // Set on .btn rather than on each button, or the next one added starts at
  // 38 again -- which is exactly how Deny, Accept and the finish button got
  // there while the badge beside them was right.
  const base = ruleFor('.btn');
  t.check(dim(base, 'height') >= 44, '.btn carries the minimum itself');
  t.check(/display:inline-flex/.test(base) && /align-items:center/.test(base),
    'and centres its label in the taller box rather than leaving it at the top');
}

/* ---------- 3. sign-out grows its target without growing itself ------- */
{
  // 34px of disc, 44px of target. Blowing it up visually would make the
  // most destructive control on the screen also the most prominent.
  const body = ruleFor('.wv-signout-icon');
  t.check(dim(body, 'width') === 34 && dim(body, 'height') === 34,
    'the disc stays 34px');
  const r = ring('.wv-signout-icon');
  t.check(!!r && 34 + r.v * 2 >= 44, `and an invisible ring takes the target to ${r ? 34 + r.v * 2 : '?'}px`);
  t.check(/\.wv-signout-icon\{position:relative;\}/.test(css),
    'positioned so the ring hangs off it');
}

/* ---------- 4. and it asks before it acts ----------------------------- */
{
  // The other half: a bigger target is easier to hit on purpose AND by
  // accident, and this one ends the session and drops the push subscription.
  const shared = read('shared-worker.js');
  const fn = shared.slice(shared.indexOf('async function signOutAndReload'), shared.indexOf('location.reload()'));
  t.check(/if\(!confirm\(/.test(fn), 'signing out asks first');
  const iAsk = fn.indexOf('confirm(');
  const iDel = fn.indexOf("from('push_subscriptions').delete()");
  t.check(iAsk > -1 && iDel > -1 && iAsk < iDel, 'before anything is torn down');
}

process.exit(t.done() ? 1 : 0);
