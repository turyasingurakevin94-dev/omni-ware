#!/usr/bin/env node
'use strict';
/*
 * Builds www/, the web content the Android app ships, from the one
 * supplier.html at the repo root. Nothing here is edited by hand: run
 * this, then `npx cap sync`.
 *
 *   www/index.html     supplier.html, its fonts from the phone instead of
 *                      Google, and no manifest (the app is the install)
 *   www/fonts/         Figtree and IBM Plex Mono, the weights the page uses
 *   www/bundle.json    which supplier.html this is, and the files beside it
 *
 * The page talks to the supplier-portal function with fetch and ships no
 * key, so unlike the staff apps there is no Supabase client to bundle.
 * Inside the app there is no invite link to carry ?s=, so signing in
 * finds the shop from the phone number (supplier-portal, shopForPhone).
 *
 * Run: node scripts/build-www.js   (or: npm run build)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP = path.join(__dirname, '..');
const ROOT = path.join(APP, '..', '..');
const WWW = path.join(APP, 'www');
const NM = path.join(APP, 'node_modules');

const src = fs.readFileSync(path.join(ROOT, 'supplier.html'), 'utf8');

// Each swap must land exactly once: a miss is a failed build, never an app
// that quietly waits on Google for its type.
const swaps = [
  ['the manifest', /<link rel="manifest" href="\/manifest-supplier\.json">\n/, ''],
  ['the font preconnects', /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n/, ''],
  ['the local fonts', /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]*">/, '<link rel="stylesheet" href="fonts/fonts.css">'],
];
let html = src;
for (const [what, re, to] of swaps) {
  const n = (html.match(new RegExp(re.source, 'g')) || []).length;
  if (n !== 1) throw new Error(`build-www: ${what} matched ${n} times -- has the top of supplier.html changed?`);
  html = html.replace(re, to);
}
if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html)) throw new Error('build-www: a Google Fonts link is still in the page');

fs.rmSync(WWW, { recursive: true, force: true });
const files = [];
function put(rel, data) {
  const to = path.join(WWW, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, data);
  files.push(rel);
}

put('index.html', html);

const faces = [
  ['Figtree', '@fontsource/figtree', 'figtree', [400, 500, 600, 700]],
  ['IBM Plex Mono', '@fontsource/ibm-plex-mono', 'ibm-plex-mono', [300, 400, 500, 600]],
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
console.log(`www/ built from supplier.html ${source.slice(0, 12)} -- ${files.length} files, ${Math.round(kb)} KB`);
