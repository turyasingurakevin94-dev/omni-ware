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
     registry and its look-back one of the layer's fields; five until
     Margin and Clearance merged into Pricing and their two panels -- an
     icon, a title, a subtitle and a single number field apiece, above
     the money, on every visit -- became one field each in that screen's
     rail. Three form panels remain, all on the real head.

     The count is a guard that this check is still finding panels to
     check, not a claim that there should be a particular number of them.
     What it protects is the line below: whatever panels exist wrap their
     icon in .fp-icon, which is the only thing that sizes it. */
  t.check(heads >= 3, `the preset panels use the real head (${heads} found)`);
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
  t.check(literal.length >= 2, `the literal icons were found (${literal.length})`);
  eq(literal.filter((x) => !/class="icon/.test(x)).length, 0,
    'every one of them wraps an svg that carries the class which sizes it');
}

/* ---------- the hidden attribute, and the rule that outranks it ------ *
 * [hidden]{display:none} lives in the BROWSER's stylesheet, which every
 * author rule outranks. So a class that sets display and is toggled by
 * the hidden attribute never hides, and nothing warns: the markup says
 * hidden, the JS sets .hidden = true, and the element paints anyway.
 *
 * This file has been bitten three times.
 *   .mp-empty      a 94% white sheet over the whole map, permanently --
 *                  reported live as "the map is blurry, it's whitish".
 *                  The tiles were loading; they were being read through
 *                  it, and it cost a wrong diagnosis before the right
 *                  one.
 *   .ap-photo-chip the assistant panel saying "Photo ready to send" over
 *                  an empty thumbnail whether or not one was attached --
 *                  a screen looking like it was already carrying
 *                  something it was not.
 * Six other classes carry the companion rule longhand, which is the clue
 * that this was always going to keep happening.
 *
 * THE RULE, and it is narrower than "sets display". What matters is what
 * the class does when nothing else applies. A base rule of display:none
 * -- .ow-q-x, which the queue component shows only via
 * .ow-q.ow-open .ow-q-x -- hides the element on its own, so the
 * attribute being inert costs nothing and the two mechanisms agree in
 * both states (measured: a Compare Prices row opens to 193px and closes
 * to none). The bug is a class whose base rule makes the element
 * VISIBLE: then hidden is the only thing asked to hide it, and it
 * cannot.
 *
 * So: a class that appears in the markup with a hidden attribute, and
 * whose own rule sets display to anything other than none, needs its own
 * [hidden] companion.
 */
{
  /* Deliberate, and measured at both widths: .pr-tb-more is
     display:contents on a desktop, which dissolves the wrapper so the
     filters lay out as children of the toolbar -- there is no fold at
     that width, so the attribute is inert BY DESIGN. Its real companion
     lives in the phone media query, where the fold exists. Named here
     rather than silently skipped, so the exemption has to be argued
     again if anyone adds a second one. */
  const DELIBERATE = new Set(['pr-tb-more']);

  const unguarded = [];
  let seen = 0;
  APPS.forEach((app) => {
    let text;
    try { text = read(app); } catch (e) { return; }
    /* Only the classes that PAINT by default. A base rule of
       display:none needs no companion -- it is already hiding. */
    const setsDisplay = new Set([...text.matchAll(/\n\s*\.([a-zA-Z0-9_-]+)\{([^}]*)\}/g)]
      .filter((m) => {
        const d = /(?:^|;)\s*display\s*:\s*([a-z-]+)/.exec(m[2]);
        return d && d[1] !== 'none';
      })
      .map((m) => m[1]));
    const guarded = new Set([...text.matchAll(/\.([a-zA-Z0-9_-]+)\[hidden\]/g)].map((m) => m[1]));
    /* Every element in the static markup carrying a hidden attribute. */
    [...text.matchAll(/<[a-z]+\b[^>]*\shidden(?=[\s>])[^>]*>/g)].map((m) => m[0]).forEach((tag) => {
      const cls = /class="([^"]+)"/.exec(tag);
      if (!cls) return;
      seen += 1;
      cls[1].split(/\s+/).forEach((c) => {
        if (setsDisplay.has(c) && !guarded.has(c) && !DELIBERATE.has(c)) unguarded.push(`${app} → ${c}`);
      });
    });
  });
  t.check(seen >= 3, `elements written with a hidden attribute were found (${seen})`);
  eq([...new Set(unguarded)].join(', '), '',
    'every class that sets display and is toggled by the hidden attribute has its own [hidden] companion');

  /* The companion has to come AFTER the rule it beats: equal specificity
     means the later one wins, so written above it does nothing at all. */
  const idx = read('index.html');
  ['mp-empty', 'ap-photo-chip'].forEach((c) => {
    const base = idx.indexOf(`.${c}{`);
    const comp = idx.indexOf(`.${c}[hidden]{`);
    t.check(base > -1 && comp > base,
      `.${c}'s [hidden] companion is written after the rule it has to outrank`);
  });
}

process.exit(t.done() ? 1 : 0);
