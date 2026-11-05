#!/usr/bin/env node
'use strict';
/*
 * The Sales app for Android (apps/sales) ships the new app: next/sales.html, built from
 * src/apps/sales (docs/spec/07-stack.md §4, §5), not the old root sales.html.
 *
 *   1. The phone's swaps (apps/sales/src/transform.js) each land on the new page's head, leave no
 *      CDN link, and a second pass changes nothing.
 *   2. scripts/build-www.js packages it: www/index.html is the new page through the swaps, with
 *      its native layer; every file its <meta name="ow-files"> names is beside it, as next/ has
 *      it and of the page's build; bundle.json names the page's hash, its build and every file.
 *      (Needs apps/sales/node_modules for the Supabase client and the fonts: where `npm ci` has
 *      not run there, as in test.yml, this part says it skipped; build-sales-app.yml runs it.)
 *   3. The shell: the app id stays com.omniware.sales, and a merge that changes the new app
 *      (next/**, src/**) builds a new APK.
 *
 * Run: node test/sales-phone-app.test.js   (or: npm test)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales phone app');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const transform = require(path.join(ROOT, 'apps/sales/src/transform.js'));
const page = read('next/sales.html');
const CDN = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com/;

/* ---------- 1. the swaps, on the new page ---------- */
{
  transform.SWAPS.forEach(([re, to], i) => t.check(re.test(page), `swap ${i + 1} lands on next/sales.html (${to ? to.split('\n').pop() : 'removes ' + re.source.slice(0, 40)})`));
  const html = transform(page);
  t.check(!CDN.test(html), 'no CDN link is left in the page the app ships');
  t.check(/<head>\n<script src="transform\.js"><\/script>\n<meta charset/.test(html), 'the swaps for live updates load first');
  t.check(html.includes('<link rel="stylesheet" href="fonts/fonts.css">') && html.includes('<script src="vendor/supabase.js"></script>'), 'the fonts and the Supabase client come from inside the app');
  t.check(!/rel="manifest"/.test(html), 'the browser install manifest is left out');
  t.check(transform(html) === html, 'a page that has been through it once is unchanged by a second pass');
  const asked = (page.match(/family=Figtree:wght@([\d;]+)&family=IBM\+Plex\+Mono:wght@([\d;]+)/) || []).slice(1).map((x) => x.split(';').map(Number));
  const build = read('apps/sales/scripts/build-www.js');
  const shipped = [...build.matchAll(/\['(Figtree|IBM Plex Mono)', '[^']+', '[^']+', \[([\d, ]+)\]\]/g)].map((m) => m[2].split(',').map(Number));
  t.check(asked.length === 2 && shipped.length === 2 && asked.every((w, i) => w.every((x) => shipped[i].includes(x))), `the app carries every font weight the page asks for (${JSON.stringify(asked)})`);
}

/* ---------- 2. build-www packages the new page ---------- */
(async () => {
  const NM = path.join(ROOT, 'apps/sales/node_modules');
  const deps = ['@supabase/supabase-js/dist/umd/supabase.js', '@fontsource/figtree', '@fontsource/ibm-plex-mono'].every((p) => fs.existsSync(path.join(NM, p)));
  const B = require(path.join(ROOT, 'apps/sales/scripts/build-www.js'));
  t.check(B.PAGES === path.join(ROOT, 'next'), 'build-www reads the built page in next/, not the root sales.html');
  if (!deps) {
    console.log('  (skipped the build: apps/sales/node_modules is not installed here; build-sales-app.yml runs it after `npm ci`)');
  } else {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ow-sales-www-'));
    try {
      const r = B.buildWww(out);
      const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
      t.check(index === transform(page), 'www/index.html is next/sales.html through the swaps');
      t.check(index.includes('data-ow-native'), 'with its native layer inside');
      const named = (page.match(/<meta name="ow-files" content="([^"]*)">/) || [, ''])[1].split(/\s+/).filter(Boolean);
      const build = (page.match(/window\.owSalesBuild="(\w+)"/) || [])[1];
      t.check(named.length === 5, `the page names its files: ${named.join(', ')}`);
      for (const f of named) {
        const got = path.join(out, f);
        t.check(fs.existsSync(got) && fs.readFileSync(got, 'utf8') === read('next/' + f) && fs.readFileSync(got, 'utf8').includes(`"${build}"`), `www/${f} is beside it, as next/ has it, of build ${build}`);
      }
      t.check(fs.existsSync(path.join(out, 'sales-demo.js')), 'www/sales-demo.js is there, so www/index.html?demo opens without a login');
      const bundle = JSON.parse(fs.readFileSync(path.join(out, 'bundle.json'), 'utf8'));
      t.check(bundle.source === crypto.createHash('sha256').update(page).digest('hex') && bundle.build === build, 'bundle.json names the page\'s hash and build');
      t.check(bundle.files.every((f) => fs.existsSync(path.join(out, f))) && named.every((f) => bundle.files.includes(f)), `bundle.json lists every file, and each is in www/ (${bundle.files.length})`);
      t.check(['vendor/supabase.js', 'transform.js', 'fonts/fonts.css'].every((f) => bundle.files.includes(f)), 'the shell\'s own files are there: the Supabase client, the swaps, the fonts');
      const css = fs.readFileSync(path.join(out, 'fonts/fonts.css'), 'utf8');
      t.check((css.match(/@font-face/g) || []).length === 8 && /font-weight:800/.test(css), 'the fonts sheet names each weight it carries');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  }

  /* ---------- 3. the shell ---------- */
  const cfg = JSON.parse(read('apps/sales/capacitor.config.json'));
  t.check(cfg.appId === 'com.omniware.sales' && cfg.webDir === 'www', 'the app id stays com.omniware.sales: the APK installs over today\'s');
  const gradle = read('apps/sales/android/app/build.gradle');
  t.check(/applicationId "com\.omniware\.sales"/.test(gradle), 'and Android builds it under that id');
  const wf = read('.github/workflows/build-sales-app.yml');
  t.check(["'next/**'", "'src/**'", "'apps/sales/**'"].every((p) => wf.includes(p)), 'a merge to main that changes the new app (next/**, src/**) or the shell builds the APK');
  t.check(/npm run build/.test(wf) && /assembleDebug/.test(wf), 'the workflow builds www/ and the debug APK');

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
