#!/usr/bin/env node
'use strict';
/*
 * Builds www/, the web content the Android and iPhone apps ship, from the
 * new Store app's built page, store.html at the root (made from src/apps/store
 * by `npm run build:store`; switched 2026-11-12, docs/rebuild.md). The same
 * steps as apps/buyer/scripts/build-www.js. Nothing here is edited by hand:
 * run this, then `npx cap sync`.
 *
 *   www/index.html        store.html with the swaps in src/transform.js
 *                         (its native layer, src/native/start.ts wired by
 *                         src/apps/store/shell/native.ts, is inside it)
 *   www/<files>           the files the page loads beside itself, which it lists in
 *                         <meta name="ow-files"> (store-pack.js, store-in.js,
 *                         store-shelf.js, store-out.js), from the root
 *   www/store-demo.js     the sample day, so www/index.html?demo can be checked
 *                         without a login (the installed app never opens it)
 *   www/vendor/           the Supabase client, pinned by package-lock.json
 *   www/fonts/            Figtree and IBM Plex Mono, the weights the page asks for
 *   www/transform.js      the swaps again, for the live updates
 *   www/bundle.json       which page this is (its hash and build id), and every file
 *
 * Run: node scripts/build-www.js   (or: npm run build)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const transform = require('../src/transform.js');

const APP = path.join(__dirname, '..');
const ROOT = path.join(APP, '..', '..');
const PAGES = ROOT;
const NM = path.join(APP, 'node_modules');

// The weights the page asks Google Fonts for (tools/build-app.js FONTS). The e2e measures with these same files (test/e2e/lib.cjs).
const FACES = [
  ['Figtree', '@fontsource/figtree', 'figtree', [400, 500, 600, 700, 800]],
  ['IBM Plex Mono', '@fontsource/ibm-plex-mono', 'ibm-plex-mono', [400, 500, 600]],
];

/** Builds www/ into `out` (default apps/store/www). Returns { out, files, source, build }. */
function buildWww(out = path.join(APP, 'www')) {
  const src = fs.readFileSync(path.join(PAGES, 'store.html'), 'utf8');
  if (!src.slice(0, 300).includes('GENERATED from src/')) throw new Error('build-www: store.html is not the page built from src/ (run `npm run build:store`)');
  const build = (src.match(/window\.owStoreBuild="(\w+)"/) || [])[1];
  if (!build) throw new Error('build-www: store.html has no build id: its live update would refuse it');
  const html = transform(src);

  // Every swap has to land here, where a miss is a failed build -- in the
  // installed app a miss only falls back to the CDN.
  const must = [
    ['the local fonts', '<link rel="stylesheet" href="fonts/fonts.css">'],
    ['the local Supabase client', '<script src="vendor/supabase.js"></script>'],
    ['the swaps for live updates', '<script src="transform.js"></script>'],
    ['the native layer', 'data-ow-native'],
  ];
  for (const [what, needle] of must) {
    if (!html.includes(needle)) throw new Error(`build-www: ${what} did not go in -- has the head of store.html changed? See src/transform.js`);
  }
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com/.test(html)) throw new Error('build-www: a CDN link is still in the page');

  fs.rmSync(out, { recursive: true, force: true });
  const files = [];
  const put = (rel, data) => {
    const to = path.join(out, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, data);
    files.push(rel);
  };

  put('index.html', html);
  // The page loads its tabs from files beside it: they ship with it, and a page that names a
  // file not there, or of another build, is a failed build, never a tab that cannot open offline.
  const named = ((html.match(/<meta name="ow-files" content="([^"]*)">/) || [])[1] || '').split(/\s+/).filter(Boolean);
  // The Store's four area files: each must be named, or an area would never open offline.
  if (!/<meta name="ow-files" content="[^"]*">/.test(html)) throw new Error('build-www: store.html has no <meta name="ow-files">: its live update would refuse it');
  for (const a of ['pack', 'in', 'shelf', 'out']) if (!named.includes(`store-${a}.js`)) throw new Error(`build-www: store.html does not name store-${a}.js`);
  for (const f of named) {
    const from = path.join(PAGES, f);
    if (!/^[\w.-]+$/.test(f) || !fs.existsSync(from)) throw new Error(`build-www: store.html loads ${f}, which is not beside it`);
    const text = fs.readFileSync(from, 'utf8');
    if (!text.includes(`"${build}"`)) throw new Error(`build-www: ${f} is not of the page's build ${build} (run \`npm run build:store\`)`);
    put(f, text);
  }
  if (!named.includes('store-demo.js')) put('store-demo.js', fs.readFileSync(path.join(PAGES, 'store-demo.js')));
  put('vendor/supabase.js', fs.readFileSync(path.join(NM, '@supabase/supabase-js/dist/umd/supabase.js')));
  put('transform.js', fs.readFileSync(path.join(APP, 'src/transform.js')));

  let css = '/* Built by scripts/build-www.js from @fontsource. Latin only: the page is English and UGX. */\n';
  for (const [family, pkg, stem, weights] of FACES) {
    for (const w of weights) {
      const file = `${stem}-latin-${w}-normal.woff2`;
      put(`fonts/${file}`, fs.readFileSync(path.join(NM, pkg, 'files', file)));
      css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format('woff2');}\n`;
    }
  }
  put('fonts/fonts.css', css);

  const source = crypto.createHash('sha256').update(src).digest('hex');
  files.push('bundle.json');
  fs.writeFileSync(path.join(out, 'bundle.json'), JSON.stringify({ source, build, files }, null, 2) + '\n');
  return { out, files, source, build };
}

module.exports = { buildWww, PAGES, FACES };

if (require.main === module) {
  const r = buildWww();
  const kb = r.files.reduce((n, f) => n + fs.statSync(path.join(r.out, f)).size, 0) / 1024;
  console.log(`www/ built from store.html ${r.source.slice(0, 12)} (build ${r.build}) -- ${r.files.length} files, ${Math.round(kb)} KB`);
}
