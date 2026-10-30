#!/usr/bin/env node
'use strict';
/*
 * Builds one role's page from src/ (docs/spec/07-stack.md §3, §6).
 *
 *   node tools/build-app.js sales            src/apps/sales/main.tsx -> next/sales.html
 *                                            src/core/demo/entry.ts  -> next/sales-demo.js
 *   node tools/build-app.js sales --check    builds in memory; fails if either file differs
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
 * Fails when the page is over its budget: 200 KB gzip (spec 07 §4; Kevin, 30 Oct 2026).
 *
 * The demo (the sample shop of the canvas, src/core/demo) is its own file
 * beside the page, loaded only on ?demo: the page never carries it, so its
 * budget is the real app's. The phone apps never fetch it. So is the parts
 * gallery (src/ui/gallery, next/<role>-parts.js), loaded only on
 * ?demo&parts=main|main2: its CSS rides inside the script.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const BUDGET = 200 * 1024;
// The pinned client, the same file and tag as sales.html:3565 (apps/sales/src/transform.js swaps it).
const SUPABASE_TAG = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>';
const FONTS = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap';

const ROLES = {
  sales: { title: 'Sales', theme: '#16203C', manifest: '/manifest-sales.json', demo: 'src/core/demo/entry.ts', parts: 'src/ui/gallery/entry.tsx' },
};
const OPTS = { bundle: true, write: false, minify: true, format: 'iife', target: ['es2020'], legalComments: 'none', charset: 'utf8', logLevel: 'silent' };

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
  const res = await esbuild.build({ ...OPTS, entryPoints: [entry], jsx: 'automatic', jsxImportSource: 'preact', outdir: path.join(ROOT, '.build-tmp') });
  const js = res.outputFiles.filter((f) => f.path.endsWith('.js')).map((f) => f.text).join('\n');
  const css = res.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n');
  const html = page(role, js.trim(), css.trim());
  const gz = zlib.gzipSync(Buffer.from(html), { level: 9 }).length;
  const demoRes = await esbuild.build({ ...OPTS, entryPoints: [path.join(ROOT, ROLES[role].demo)] });
  const demo = `// GENERATED from src/core/demo by tools/build-app.js for ${role}.html?demo. Do not edit: run \`npm run build:${role}\`.\n${demoRes.outputFiles[0].text.trim()}\n`;
  const partsRes = await esbuild.build({ ...OPTS, entryPoints: [path.join(ROOT, ROLES[role].parts)], jsx: 'automatic', jsxImportSource: 'preact', outdir: path.join(ROOT, '.build-tmp') });
  const pjs = partsRes.outputFiles.filter((f) => f.path.endsWith('.js')).map((f) => f.text).join('\n').trim();
  const pcss = partsRes.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n').trim();
  const parts = `// GENERATED from src/ui/gallery by tools/build-app.js for ${role}.html?demo&parts=main|main2. Do not edit: run \`npm run build:${role}\`.\n`
    + `(function(){var s=document.createElement("style");s.textContent=${JSON.stringify(pcss)};document.head.appendChild(s)})();\n${pjs}\n`;
  return { html, gz, out: path.join(ROOT, 'next', role + '.html'), demo, demoOut: path.join(ROOT, 'next', role + '-demo.js'), parts, partsOut: path.join(ROOT, 'next', role + '-parts.js') };
}

async function main() {
  const args = process.argv.slice(2);
  const role = args.find((a) => !a.startsWith('--'));
  const check = args.includes('--check');
  if (!role) { console.error('usage: node tools/build-app.js <role> [--check]'); process.exit(2); }
  const { html, gz, out, demo, demoOut, parts, partsOut } = await build(role);
  const rel = path.relative(ROOT, out);
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  if (gz > BUDGET) {
    console.error(`build-app: ${rel} is ${kb(gz)} compressed, over the ${kb(BUDGET)} budget (docs/spec/07-stack.md §4)`);
    process.exit(1);
  }
  if (check) {
    for (const [file, want] of [[out, html], [demoOut, demo], [partsOut, parts]]) {
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (cur !== want) {
        console.error(`build-app: ${path.relative(ROOT, file)} is not what src/ builds. Run \`npm run build:${role}\` and commit it.`);
        process.exit(1);
      }
    }
    console.log(`build-app: ${rel} and its demo match src/ (${kb(gz)} compressed of ${kb(BUDGET)})`);
    return;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  fs.writeFileSync(demoOut, demo);
  fs.writeFileSync(partsOut, parts);
  console.log(`build-app: wrote ${rel}, ${kb(Buffer.byteLength(html))} raw, ${kb(gz)} compressed of ${kb(BUDGET)}`);
}

module.exports = { build, page, BUDGET, SUPABASE_TAG, ROLES };

if (require.main === module) {
  main().catch((e) => { console.error('build-app:', e.message || e); process.exit(1); });
}
