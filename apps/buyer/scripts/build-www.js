#!/usr/bin/env node
'use strict';
/*
 * Builds www/, the web content the Android and iPhone apps ship, from the
 * one buyer.html at the repo root. Nothing here is edited by hand: run
 * this, then `npx cap sync`.
 *
 *   www/index.html        buyer.html with the swaps in src/transform.js
 *   www/vendor/           the Supabase client, pinned by package-lock.json
 *   www/fonts/            Figtree and IBM Plex Mono, the weights the page uses
 *   www/transform.js      the swaps again, for the live updates (the
 *                         native layer itself is inside buyer.html)
 *   www/bundle.json       which buyer.html this is, and the files beside it
 *
 * Run: node scripts/build-www.js   (or: npm run build)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const transform = require('../src/transform.js');

const APP = path.join(__dirname, '..');
const ROOT = path.join(APP, '..', '..');
const WWW = path.join(APP, 'www');
const NM = path.join(APP, 'node_modules');

const src = fs.readFileSync(path.join(ROOT, 'buyer.html'), 'utf8');
const html = transform(src);

// Every swap has to land here, where a miss is a failed build -- in the
// installed app a miss only falls back to the CDN.
const must = [
  ['the local fonts', '<link rel="stylesheet" href="fonts/fonts.css">'],
  ['the local Supabase client', '<script src="vendor/supabase.js"></script>'],
  ['the swaps for live updates', '<script src="transform.js"></script>'],
  ['the native layer', "The phone app's native layer"],
];
for (const [what, needle] of must) {
  if (!html.includes(needle)) throw new Error(`build-www: ${what} did not go in -- has the top of buyer.html changed? See src/transform.js`);
}
if (/fonts\.googleapis\.com|cdn\.jsdelivr\.net/.test(html)) throw new Error('build-www: a CDN link is still in the page');

fs.rmSync(WWW, { recursive: true, force: true });
const files = [];
function put(rel, data) {
  const to = path.join(WWW, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, data);
  files.push(rel);
}

put('index.html', html);
put('vendor/supabase.js', fs.readFileSync(path.join(NM, '@supabase/supabase-js/dist/umd/supabase.js')));
put('transform.js', fs.readFileSync(path.join(APP, 'src/transform.js')));

const faces = [
  ['Figtree', '@fontsource/figtree', 'figtree', [400, 500, 600, 700]],
  ['IBM Plex Mono', '@fontsource/ibm-plex-mono', 'ibm-plex-mono', [500, 600]],
];
let css = '/* Built by scripts/build-www.js from @fontsource. Latin only: the page is English and UGX. */\n';
for (const [family, pkg, stem, weights] of faces) {
  for (const w of weights) {
    const file = `${stem}-latin-${w}-normal.woff2`;
    put(`fonts/${file}`, fs.readFileSync(path.join(NM, pkg, 'files', file)));
    css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(${file}) format('woff2');}\n`;
  }
}
put('fonts/fonts.css', css);

const source = crypto.createHash('sha256').update(src).digest('hex');
files.push('bundle.json');
fs.writeFileSync(path.join(WWW, 'bundle.json'), JSON.stringify({ source, files }, null, 2) + '\n');

const kb = files.reduce((n, f) => n + fs.statSync(path.join(WWW, f)).size, 0) / 1024;
console.log(`www/ built from buyer.html ${source.slice(0, 12)} -- ${files.length} files, ${Math.round(kb)} KB`);
