#!/usr/bin/env node
'use strict';
/*
 * A var() naming a property the file never defines fails silently.
 *
 * With no fallback, an unresolvable var() does not fall back to the previous
 * declaration or to something sane -- it makes the whole declaration invalid
 * at computed-value time, and the property takes its INITIAL value. For a
 * background that is transparent.
 *
 * That is how the board's new Assign button vanished under the cursor:
 *
 *     .sq-assign-btn:hover{background:var(--accent-deep);}
 *
 * --accent-deep is defined in worker.html and not in index.html, so on the
 * admin app's white card the hover state painted no background at all and
 * left white text on white. It looked like a hover animation that deleted
 * the button.
 *
 * Nothing catches this: it is valid CSS, no console warning, and it only
 * shows on the state you have to hover to see. The four app files each carry
 * their own palette and two of them share shared-worker.js, so a token
 * borrowed from the wrong file is an easy mistake to repeat.
 *
 * Run: node test/css-custom-properties.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('css custom properties');

const APPS = ['index.html', 'worker.html', 'agent.html', 'catalogue.html'];
// shared-worker.js is styled by whichever host loads it, so its var() usage
// has to resolve against each of those hosts.
const SHARED_BY = { 'index.html': 'shared-worker.js', 'worker.html': 'shared-worker.js' };

let checked = 0;
const problems = [];

APPS.forEach((app) => {
  let src;
  try { src = read(app); } catch (e) { return; }
  const shared = SHARED_BY[app] ? read(SHARED_BY[app]) : '';

  // Defined anywhere in the file counts -- :root, a nested rule, or an
  // inline style="--x:…" on an element.
  const defined = new Set(
    [...src.matchAll(/(?:^|[;{\s"'])(--[a-zA-Z0-9-]+)\s*:/gm)].map((m) => m[1]),
  );

  [[app, src], [SHARED_BY[app], shared]].forEach(([name, text]) => {
    if (!text) return;
    for (const m of text.matchAll(/var\((--[a-zA-Z0-9-]+)\s*(,)?/g)) {
      checked++;
      if (m[2]) continue;              // has a fallback: renders regardless
      if (defined.has(m[1])) continue;
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      problems.push(`${m[1]} used in ${name}:${line} but not defined in ${app}`);
    }
  });
});

t.check(checked > 100, `swept var() usage across the app files (${checked} references)`);
t.check(problems.length === 0,
  problems.length
    ? `these resolve to nothing and silently drop their declaration: ${problems.join('; ')}`
    : 'every var() without a fallback names a property its file actually defines');

/* ---------- the specific one, by name --------------------------------- */
{
  // Worth pinning: --accent-deep is a real token, just not this file's, and
  // the admin app has its own name for the same idea.
  const admin = read('index.html');
  t.check(!/var\(--accent-deep\)/.test(admin),
    'index.html does not reach for --accent-deep, which only worker.html defines');
  t.check(/\.sq-assign-btn:hover\{background:var\(--ow-oxide-deep\);\}/.test(admin),
    'the Assign button hovers to --ow-oxide-deep, the hover every other accent button here uses');
  t.check(/--ow-oxide-deep:#[0-9A-Fa-f]{6};/.test(admin), 'and that one is defined');
}

/* ---------- and the button still has a background at rest ------------- */
{
  const admin = read('index.html');
  const rest = admin.match(/\.sq-assign-btn\{[^}]*background:var\((--[a-zA-Z0-9-]+)\)/);
  t.check(!!rest, 'the resting state paints a background from a token');
  if (rest) {
    t.check(new RegExp(`(?:^|[;{\\s])${rest[1]}\\s*:`, 'm').test(admin),
      `and ${rest[1]} is defined in index.html`);
  }
}

process.exit(t.done() ? 1 : 0);
