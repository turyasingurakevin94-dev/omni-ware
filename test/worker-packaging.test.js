#!/usr/bin/env node
'use strict';
/*
 * The worker app exists three times over, and a fix that lands in one copy
 * reaches nobody holding a phone.
 *
 *   worker.html, shared-worker.js, manifest-worker.json   the source
 *   worker-www/                                           what Capacitor packs
 *   android/app/src/main/assets/public/                   what it builds from
 *                                                         (git-ignored, made
 *                                                          by `npx cap copy`)
 *
 * order-status-delivery.test.js already compared three named functions across
 * these, which is what it needed for its own subject. But shared-worker.js is
 * the entire worker app -- picking, accepting, finishing, the lot -- and every
 * other function in it was unguarded: the pick-card and pick-reset fixes both
 * changed behaviour no named rule covered, and could have shipped stale
 * without anything saying so. This checks the files whole.
 *
 * The two path rewrites are deliberate -- absolute URLs work on the web and
 * not inside a bundle -- so they are pinned by name here rather than waved
 * through, which also means an edit to either source file cannot quietly skip
 * its packaged copy.
 *
 * Run: node test/worker-packaging.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, read, createReporter } = require('./_extract');

const t = createReporter('worker packaging');

const norm = (s) => s.replace(/\r\n/g, '\n').trimEnd();
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// First line that differs, so a failure says where to look.
function firstDiff(a, b) {
  const x = norm(a).split('\n');
  const y = norm(b).split('\n');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] !== y[i]) return `line ${i + 1}: ${JSON.stringify(x[i])} vs ${JSON.stringify(y[i])}`;
  }
  return 'lengths differ only in trailing lines';
}

function same(label, aRel, bRel, rewrite) {
  const a = rewrite ? rewrite(read(aRel)) : read(aRel);
  const b = read(bRel);
  t.check(norm(a) === norm(b), norm(a) === norm(b) ? label : `${label} — ${firstDiff(a, b)}`);
}

/* ---------- 1. the app logic, byte for byte --------------------------- */
{
  same('shared-worker.js matches worker-www/', 'shared-worker.js', 'worker-www/shared-worker.js');
}

/* ---------- 2. the page, bar the one rewritten path ------------------- */
{
  // worker.html is served from the web root, so its manifest link is
  // absolute. Inside the bundle there is no root to be absolute against.
  const MANIFEST_HREF = ['<link rel="manifest" href="/manifest-worker.json">',
    '<link rel="manifest" href="manifest-worker.json">'];
  const src = read('worker.html');
  t.check(src.includes(MANIFEST_HREF[0]),
    'worker.html still has the absolute manifest link the packaged copy rewrites');
  same('worker.html matches worker-www/index.html apart from that link',
    'worker.html', 'worker-www/index.html',
    (s) => s.split(MANIFEST_HREF[0]).join(MANIFEST_HREF[1]));
}

/* ---------- 3. the manifest, bar its two rewritten paths -------------- */
{
  // Same reason: /worker.html is a web path; in the bundle the page is
  // index.html sitting next to the manifest.
  const src = read('manifest-worker.json');
  t.check(src.includes('"/worker.html"'),
    'manifest-worker.json still has the absolute start_url/scope the packaged copy rewrites');
  same('manifest-worker.json matches worker-www/ apart from start_url and scope',
    'manifest-worker.json', 'worker-www/manifest-worker.json',
    (s) => s.split('"/worker.html"').join('"index.html"'));
}

/* ---------- 4. and what Android would actually build ------------------ */
{
  // Git-ignored and absent on a fresh clone, so missing is fine; present and
  // stale is not, because that is what gets compiled into the APK.
  const BUILT = 'android/app/src/main/assets/public';
  const FILES = ['shared-worker.js', 'index.html', 'manifest-worker.json'];
  if (!exists(BUILT + '/shared-worker.js')) {
    t.pass('android build output not present (run `npx cap copy android` before building)');
  } else {
    const stale = FILES.filter((f) => norm(read(`worker-www/${f}`)) !== norm(read(`${BUILT}/${f}`)));
    t.check(stale.length === 0,
      stale.length
        ? `android build output is stale (${stale.join(', ')}) — run \`npx cap copy android\``
        : `android build output is in step with worker-www/ (${FILES.length} files)`);
  }
}

/* ---------- 5. nothing has appeared in worker-www/ unaccounted for ----- */
{
  // A new file added to the packaged copy but not to this list is a file
  // nothing here is checking.
  const KNOWN = ['index.html', 'manifest-worker.json', 'shared-worker.js'];
  const actual = fs.readdirSync(path.join(ROOT, 'worker-www')).sort();
  const extra = actual.filter((f) => !KNOWN.includes(f));
  t.check(extra.length === 0,
    extra.length
      ? `worker-www/ has unchecked file(s): ${extra.join(', ')} — add them here`
      : `worker-www/ holds only the ${KNOWN.length} files checked above`);
}

process.exit(t.done() ? 1 : 0);
