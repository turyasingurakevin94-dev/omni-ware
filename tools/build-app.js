#!/usr/bin/env node
'use strict';
/*
 * Builds one role's page from src/ (docs/spec/07-stack.md §3, §6).
 *
 *   node tools/build-app.js sales            src/apps/sales/main.tsx -> next/sales.html
 *   node tools/build-app.js sales --check    builds in memory; fails if next/sales.html differs
 *
 * One self-contained page, like the old apps: the script and the CSS are
 * inlined, the fonts come from Google Fonts without holding the page up,
 * and the pinned supabase-js is loaded by the same <script> tag the old
 * apps use, so apps/<role>/src/transform.js swaps it for the phone's own
 * copy exactly as it does today.
 *
 * The first line says "GENERATED from src/": test/file-size.test.js then
 * measures src/, not the page, and test/retire-list.test.js knows the role
 * has a built page. Nobody edits the page; it is made again every time.
 *
 * Fails when the page is over its budget: 80 KB gzip (spec 07 §4).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const BUDGET = 80 * 1024;
// The pinned client, the same file and tag as sales.html:3565 (apps/sales/src/transform.js swaps it).
const SUPABASE_TAG = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>';
const FONTS = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

const ROLES = {
  sales: { title: 'Sales', theme: '#16203C', manifest: '/manifest-sales.json' },
};

function page(role, js, css) {
  const r = ROLES[role];
  // Inline script and style may not close their own tag.
  const safeJs = js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  const safeCss = css.replace(/<\/(style)/gi, '<\\/$1');
  return [
    `<!-- GENERATED from src/apps/${role} by tools/build-app.js. Do not edit: change src/ and run \`npm run build:${role}\`. -->`,
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<meta name="theme-color" content="${r.theme}">`,
    `<title>${r.title}</title>`,
    `<link rel="manifest" href="${r.manifest}">`,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    // Non-blocking, as sales.html:217-219: on a dead connection the system stack carries on.
    `<link rel="stylesheet" media="print" onload="this.media='all'" href="${FONTS}">`,
    `<style>${safeCss}</style>`,
    '</head>',
    '<body>',
    '<div id="app"></div>',
    SUPABASE_TAG,
    `<script>${safeJs}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

async function build(role) {
  if (!ROLES[role]) throw new Error(`build-app: unknown role "${role}" (known: ${Object.keys(ROLES).join(', ')})`);
  const entry = path.join(ROOT, 'src/apps', role, 'main.tsx');
  if (!fs.existsSync(entry)) throw new Error(`build-app: ${path.relative(ROOT, entry)} is missing`);
  const esbuild = require('esbuild');
  const res = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    target: ['es2020', 'chrome80', 'safari14'],
    jsx: 'automatic',
    jsxImportSource: 'preact',
    outdir: path.join(ROOT, '.build-tmp'),
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'silent',
  });
  const js = res.outputFiles.filter((f) => f.path.endsWith('.js')).map((f) => f.text).join('\n');
  const css = res.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n');
  const html = page(role, js.trim(), css.trim());
  const gz = zlib.gzipSync(Buffer.from(html), { level: 9 }).length;
  return { html, gz, out: path.join(ROOT, 'next', role + '.html') };
}

async function main() {
  const args = process.argv.slice(2);
  const role = args.find((a) => !a.startsWith('--'));
  const check = args.includes('--check');
  if (!role) { console.error('usage: node tools/build-app.js <role> [--check]'); process.exit(2); }
  const { html, gz, out } = await build(role);
  const rel = path.relative(ROOT, out);
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  if (gz > BUDGET) {
    console.error(`build-app: ${rel} is ${kb(gz)} compressed, over the ${kb(BUDGET)} budget (docs/spec/07-stack.md §4)`);
    process.exit(1);
  }
  if (check) {
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (cur !== html) {
      console.error(`build-app: ${rel} is not what src/ builds. Run \`npm run build:${role}\` and commit it.`);
      process.exit(1);
    }
    console.log(`build-app: ${rel} matches src/ (${kb(gz)} compressed of ${kb(BUDGET)})`);
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`build-app: wrote ${rel}, ${kb(Buffer.byteLength(html))} raw, ${kb(gz)} compressed of ${kb(BUDGET)}`);
}

module.exports = { build, page, BUDGET, SUPABASE_TAG, ROLES };

if (require.main === module) {
  main().catch((e) => { console.error('build-app:', e.message || e); process.exit(1); });
}
