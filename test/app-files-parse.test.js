#!/usr/bin/env node
'use strict';
/*
 * The app files parse.
 *
 * Every other test here extracts a named function and compiles that, which
 * means a syntax error anywhere ELSE in the file goes unnoticed -- all 400
 * checks pass while the page is dead on load. These are single
 * self-contained HTML files with no build step, so nothing else looks at
 * them either.
 *
 * That gap is not hypothetical: this whole suite was written alongside
 * hand-run `new Function(...)` checks after every edit, precisely because
 * nothing automated covered it. This is that check, automated.
 *
 * Run: node test/app-files-parse.test.js   (or: npm test)
 */
const { read, createReporter } = require('./_extract');

const t = createReporter('app files parse');

// Inline blocks only -- <script src="..."> has no body here to check, and
// the external ones are either a CDN or a sibling file checked in its own
// right below.
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push({ body: m[1], at: m.index });
  return out;
}
// Line number of an offset, so a failure points somewhere rather than just
// saying the file is broken.
function lineAt(src, offset) {
  return src.slice(0, offset).split(/\r?\n/).length;
}

const HTML_FILES = ['index.html', 'agent.html', 'worker.html', 'catalogue.html'];
const JS_FILES = ['shared-worker.js', 'worker-www/shared-worker.js'];

for (const file of HTML_FILES) {
  const src = read(file);
  const blocks = inlineScripts(src);
  t.check(blocks.length > 0, `${file}: found ${blocks.length} inline script block(s) to check`);
  blocks.forEach((b, i) => {
    let err = null;
    // Parsed as a function body, which is what a classic (non-module)
    // script is closest to: top-level const/let/function are all legal
    // here, and nothing in these files is a module.
    try { new Function(b.body); } catch (e) { err = e; }
    t.check(!err,
      err
        ? `${file}: script block ${i + 1} (from line ${lineAt(src, b.at)}) does not parse — ${err.message}`
        : `${file}: script block ${i + 1} parses`);
  });
}

for (const file of JS_FILES) {
  let err = null;
  try { new Function(read(file)); } catch (e) { err = e; }
  t.check(!err, err ? `${file} does not parse — ${err.message}` : `${file} parses`);
}

/* ---------- the check itself has to be able to fail -------------------- */
/*
 * A parse check that cannot detect a syntax error is worse than none: it
 * reports green forever. Proving it here costs nothing and means a future
 * change to how these are parsed cannot quietly neuter it.
 */
{
  let caught = false;
  try { new Function('function broken( { return 1;'); } catch (_e) { caught = true; }
  t.check(caught, 'the parser used here does reject a syntax error');

  const found = inlineScripts('<script src="x.js"></script><script>const a = 1;</script>');
  t.check(found.length === 1 && found[0].body === 'const a = 1;',
    'and the extractor takes inline blocks while skipping src ones');
}

process.exit(t.done() ? 1 : 0);
