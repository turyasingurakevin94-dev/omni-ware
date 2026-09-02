#!/usr/bin/env node
'use strict';
/*
 * A class name the file never styles fails silently too.
 *
 * css-custom-properties.test.js catches an invented var(); nothing caught
 * an invented CLASS, and it cost this shop two screens.
 *
 * The Clearance and Your-margin screens were written with a preset panel
 * copied from memory rather than from the file:
 *
 *     <div class="fp-head">
 *       <svg class="fp-icon" viewBox="0 0 24 24"><circle r="9"/>…</svg>
 *
 * The real pattern is `.form-panel-head` wrapping a `<span class="fp-icon">`
 * around an `<svg class="icon">`, and `.fp-icon` is only ever styled as a
 * CHILD of `.form-panel-head`. So `fp-head` matched nothing, `fp-row`
 * matched nothing, and the svg — outside the one selector that would have
 * sized it and given it `fill:none` — expanded to its container and
 * painted a black circle the width of the screen over both screens. It
 * shipped, and the owner saw it before the suite did.
 *
 * Nothing warns. It is valid HTML and valid CSS; the class simply matches
 * no rule, and the browser draws the default.
 *
 * THE RULE. A class in the static markup that NOTHING styles and NOTHING
 * scripts is a class somebody invented. A class that is only a JS handle
 * (`chase-send`, `cred-due-set`) is legitimate and common, so the check
 * asks for either — a rule in the stylesheet, or a mention in the script.
 * Neither, and it is a typo wearing a class attribute.
 *
 * The known ones are PINNED rather than cleaned: they are on screens this
 * check was not written to rewrite, and a list that must be edited to
 * grow is the point. Adding a name here should always cost a moment's
 * thought about whether the class is real.
 *
 * Run: node test/css-class-hooks.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('css class hooks');
const eq = (got, want, msg) => t.check(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);

/* Dead on arrival before this check existed, on screens it is not this
   file's business to rewrite. Every one is a class the markup carries
   that nothing styles and nothing reads. */
const KNOWN = [
  /* agent.html addresses this one by id and styles it nowhere. */
  'ag-lb-you',
  'assign-staff-self', 'buy-why', 'cf-duplicate', 'cf-phone', 'cmp-ask-product',
  'cmp-ask-qty', 'cst-print', 'ip-item', 'ls-tidy', 'panel-head',
  'pr-bulk-tier-price', 'q-more-btn', 'sf-card', 'sf-phone', 'sf-role-warn',
  'stock-log-edit', 'wa-desk-main', 'wv-active-header', 'wv-eyebrow',
];

const APPS = ['index.html', 'worker.html', 'agent.html', 'catalogue.html'];
let checked = 0;
const orphans = [];

APPS.forEach((app) => {
  let src;
  try { src = read(app); } catch (e) { return; }
  const style = (src.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
  const script = (src.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) || []).join('\n');
  if (!style) return;

  const defined = new Set((style.match(/\.[A-Za-z][\w-]*/g) || []).map((x) => x.slice(1)));

  /* STATIC MARKUP ONLY. A class built by interpolation is the script's
     own business and cannot be read off the source. */
  const body = src.slice(src.indexOf('</style>'));
  const used = new Set();
  (body.match(/\sclass="[^"${}]+"/g) || []).forEach((m) => {
    m.slice(m.indexOf('"') + 1, -1).split(/\s+/).filter(Boolean).forEach((c) => used.add(c));
  });
  checked += used.size;

  used.forEach((c) => {
    if (defined.has(c)) return;
    /* A JS handle: named in the script as a selector or a string. */
    const esc = c.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
    if (new RegExp('[.\'"\\[]' + esc + '[\'"\\]\\s.,)]').test(script)) return;
    orphans.push(app + ' → ' + c);
  });
});

t.check(checked > 500, `the markup was read, not silently skipped (${checked} class uses)`);

const unexpected = orphans.filter((o) => !KNOWN.includes(o.split(' → ')[1]));
unexpected.forEach((o) => t.check(false,
  `INVENTED CLASS — the markup carries it, no rule styles it and no script reads it: ${o}`));
eq(unexpected.length, 0,
  'every class in the markup is either styled or scripted — a name that is neither is a typo that renders as the browser default');

/* And the two that cost the owner a black circle across two screens are
   named here, so nobody reintroduces them by copying the old markup. */
['fp-head', 'fp-row'].forEach((c) => {
  t.check(!read('index.html').includes('class="' + c + '"'),
    `${c} is gone — it never existed, and the svg it wrapped painted a black circle the width of the screen`);
});

/* The repaired markup uses the real one, and the svg inside it carries
   the class that actually sizes it. `.fp-icon` is styled ONLY as a child
   of .form-panel-head, so the wrapper is not decoration: without it the
   icon has no size and no fill:none. */
{
  const src = read('index.html');
  const heads = (src.match(/<div class="form-panel-head">/g) || []).length;
  /* Seven until What to buy's two figures moved into its header as
     fields; six until Supplier prices became the Paid side of the Price
     registry and its look-back one of the layer's fields. Five form
     panels remain, all on the real head. */
  t.check(heads >= 5, `the preset panels use the real head (${heads} found)`);
  /* fp-icon must WRAP the svg, never be put on it: the only rule that
     sizes the icon and gives it fill:none is
     `.form-panel-head .fp-icon .icon`, so an svg wearing fp-icon itself
     is outside every rule that would stop it painting a black shape. */
  eq((src.match(/<svg[^>]*class="fp-icon"/g) || []).length, 0,
    'and fp-icon wraps the svg rather than being put on it — the rule that sizes it is .form-panel-head .fp-icon .icon');
  /* Every literal svg inside one carries the sizing class. An icon put
     there by an ICON_* constant is that constant's business, and every
     one of those already spells `class="icon"` itself. */
  const literal = (src.match(/<span class="fp-icon">\s*<svg[^>]*>/g) || []);
  t.check(literal.length >= 4, `the literal icons were found (${literal.length})`);
  eq(literal.filter((x) => !/class="icon/.test(x)).length, 0,
    'every one of them wraps an svg that carries the class which sizes it');
}

process.exit(t.done() ? 1 : 0);
