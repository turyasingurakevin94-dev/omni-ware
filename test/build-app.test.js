#!/usr/bin/env node
'use strict';
/*
 * The new apps' build (docs/spec/07-stack.md §3, §6): src/apps/<role> is
 * built into one page, next/<role>.html, and the committed page must be
 * exactly what src/ builds.
 *
 * `npm test` installs nothing (test.yml), so esbuild is usually absent
 * there: this test then checks only what it can read (the committed page's
 * marker and its Supabase tag) and says it skipped the build. The build
 * check itself runs in .github/workflows/build-check.yml, after `npm ci`.
 *
 * Run: node test/build-app.test.js   (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('build-app');
const PAGE = path.join(ROOT, 'next/sales.html');
const tool = require(path.join(ROOT, 'tools/build-app.js'));

let esbuild = null;
try { esbuild = require.resolve('esbuild', { paths: [ROOT] }); } catch (_e) { esbuild = null; }

(async () => {
  t.check(fs.existsSync(PAGE), 'next/sales.html is committed');
  const page = fs.existsSync(PAGE) ? fs.readFileSync(PAGE, 'utf8') : '';
  const first = page.split('\n')[0];
  t.check(first.includes('GENERATED from src/'), 'its first line says GENERATED from src/ (test/file-size.test.js, test/retire-list.test.js)');
  t.check(page.includes(tool.SUPABASE_TAG), 'it loads the pinned supabase-js with the tag the old apps use');

  // The phone apps swap that tag for their own copy (apps/sales/src/transform.js): the swap must still land.
  const transform = require(path.join(ROOT, 'apps/sales/src/transform.js'));
  t.check(transform(page).includes('<script src="vendor/supabase.js"></script>'), "the phone app's transform swaps it for vendor/supabase.js");

  t.check(!page.includes('Mukasa Hardware'), 'the page itself carries no sample shop (it is in next/sales-demo.js, loaded only on ?demo)');
  t.check(fs.existsSync(path.join(ROOT, 'next/sales-demo.js')) && fs.readFileSync(path.join(ROOT, 'next/sales-demo.js'), 'utf8').startsWith('// GENERATED from src/'), 'next/sales-demo.js is committed, built from src/');

  const gz = zlib.gzipSync(Buffer.from(page), { level: 9 }).length;
  t.check(gz <= tool.BUDGET, `it is within budget: ${(gz / 1024).toFixed(1)} KB of ${tool.BUDGET / 1024} KB compressed`);

  if (!esbuild) {
    console.log('  (skipped: esbuild is not installed here, so the build itself is checked by build-check.yml)');
  } else {
    const built = await tool.build('sales');
    t.check(built.html === page, 'next/sales.html is exactly what src/ builds (run `npm run build:sales` and commit it)');
    const demo = fs.existsSync(built.demoOut) ? fs.readFileSync(built.demoOut, 'utf8') : '';
    t.check(built.demo === demo, 'next/sales-demo.js is exactly what src/core/demo builds');
    t.check(built.gz <= tool.BUDGET, 'the fresh build is within budget');
  }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
