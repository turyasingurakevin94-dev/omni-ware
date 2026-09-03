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

/* ---------- A FALLBACK IS NOT A FREE PASS ----------------------------
 *
 * The sweep above skips any var() that carries a fallback, on the
 * grounds that it renders regardless. True of RENDERING. False of
 * MEANING.
 *
 *     .mgr-pace.behind{border-left-color:var(--bad,var(--accent));}
 *
 * There is no --bad in index.html. So the fallback fired every single
 * time, and a target that was BEHIND rendered in exactly the same oxide
 * as one that was on course. The line had a colour, the colour looked
 * deliberate, and it carried no information at all. The same hand wrote
 * var(--bad,var(--line)) on a MISSED target and var(--bad,var(--ink-soft))
 * on its footer -- three dead references, all rendering, none meaning
 * anything, and the app looked completely fine.
 *
 * A fallback is for a property that MIGHT not be set — one a script
 * assigns at runtime, or one a host page may override. A fallback behind
 * a name the codebase has never heard of is a typo with the alarm
 * switched off.
 * ------------------------------------------------------------------- */
const dead = [];
APPS.forEach((app) => {
  let src;
  try { src = read(app); } catch (e) { return; }
  const shared = SHARED_BY[app] ? read(SHARED_BY[app]) : '';
  const known = new Set([
    ...[...src.matchAll(/(?:^|[;{\s"'])(--[a-zA-Z0-9-]+)\s*:/gm)].map((m) => m[1]),
    /* Set from JS rather than declared in CSS -- --tip-x, --sq-accent
       and their kin are real properties with real values, just assigned
       at runtime, and a fallback in front of them is exactly right. */
    ...[...src.matchAll(/setProperty\(\s*['"`](--[a-zA-Z0-9-]+)/g)].map((m) => m[1]),
    ...[...shared.matchAll(/setProperty\(\s*['"`](--[a-zA-Z0-9-]+)/g)].map((m) => m[1]),
  ]);
  [[app, src], [SHARED_BY[app], shared]].forEach(([name, text]) => {
    if (!text) return;
    for (const m of text.matchAll(/var\((--[a-zA-Z0-9-]+)\s*,/g)) {
      if (known.has(m[1])) continue;
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      dead.push(`${m[1]} at ${name}:${line}`);
    }
  });
});
t.check(dead.length === 0,
  dead.length
    ? `these always render their fallback, so the first name means nothing: ${dead.join('; ')}`
    : 'and every var() WITH a fallback names a property that could actually be set — a fallback behind a name nothing defines is a typo with the alarm off');

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
  // The lane board's assign pill, which this once pinned, went with the
  // board: its act is one of the layer's .btn buttons now. The token it
  // hovered to is still the one every accent button uses.
  t.check(/--ow-oxide-deep:#[0-9A-Fa-f]{6};/.test(admin), 'and --ow-oxide-deep is defined');
  t.check(!/\.sq-assign-btn/.test(admin), 'the assign pill is gone rather than left as an orphaned rule');
}

process.exit(t.done() ? 1 : 0);
