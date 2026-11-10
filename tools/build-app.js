#!/usr/bin/env node
'use strict';
/*
 * Builds one role's app from src/ (docs/spec/07-stack.md §3, §4, §6).
 *
 *   node tools/build-app.js sales            next/sales.html            the page: the shell, src/ui, src/core, Today
 *                                            next/sales-<tab>.js        Chats, Sell, Counter, Orders, Customers, one file each
 *                                            next/sales-sw.js           the service worker that keeps them all on the phone
 *                                            next/sales-demo.js         the demo (src/core/demo), loaded only on ?demo
 *                                            next/sales-parts.js        the parts gallery, only on ?demo&parts=…
 *   node tools/build-app.js sales --check    builds in memory; fails if any file differs or is over its budget
 *
 * The page is one self-contained file, like the old apps: the script and the
 * CSS inlined, the fonts from Google Fonts without holding it up, the pinned
 * supabase-js by the same <script> tag the old apps use (so
 * apps/<role>/src/transform.js swaps it for the phone's own copy).
 *
 * Per-tab loading (spec 07 §4): a lazy tab's file holds only its own folder
 * (src/apps/<role>/<tab>/) and its CSS. Everything else it imports (src/ui,
 * src/core, the shell, the Today tab, Preact) comes from the page at run
 * time, through window.owSalesMods, which the page fills with exactly the
 * modules the tab files use: one copy of each, one Preact, one store. A tab
 * file that imports another lazy tab's file is refused (use a ROUTES.md id or
 * callTab, src/apps/sales/shell/tabs.ts). Page and tab files carry one build
 * id; the page refuses a tab file from another build.
 *
 * The page lists its files in <meta name="ow-files">, for the phone app's
 * build (apps/<role>/scripts/build-www.js) and its live update to carry.
 *
 * The first line of each says "GENERATED from src/": test/file-size.test.js
 * measures src/, not these. Budgets, gzip: the page 200 KB, each tab file 60 KB.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const BUDGET = 200 * 1024;
const TAB_BUDGET = 60 * 1024;
// The pinned client, the same file and tag as sales.html:3565 (apps/sales/src/transform.js swaps it).
const SUPABASE_TAG = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.js"></script>';
const FONTS = 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
const BUILD_MARK = '__OW_BUILD_ID__';

const ROLES = {
  sales: {
    title: 'Sales', theme: '#16203C', manifest: '/manifest-sales.json', demo: 'src/core/demo/entry.ts', parts: 'src/ui/gallery/entry.tsx',
    lazy: ['chats', 'sell', 'counter', 'orders', 'customers'], sw: 'src/apps/sales/sw.ts',
  },
};
const OPTS = { bundle: true, write: false, minify: true, format: 'iife', target: ['es2020'], legalComments: 'none', charset: 'utf8', logLevel: 'silent' };
const JSX = { jsx: 'automatic', jsxImportSource: 'preact' };
const NPM_SHARED = /^(preact|preact\/hooks|preact\/jsx-runtime|@preact\/signals)$/;

const gz = (s) => zlib.gzipSync(Buffer.from(s), { level: 9 }).length;
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const cssInJs = (css) => (css ? `(function(){var s=document.createElement("style");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n` : '');

function page(role, js, css, files) {
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
    // The files beside this page that it loads: the phone app's build and its live update carry them.
    `<meta name="ow-files" content="${files.join(' ')}">`,
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

/** For a lazy tab's build: its own folder is bundled; the rest is the page's (window.owSalesMods). */
function tabPlugin(role, tab, used) {
  const lazy = ROLES[role].lazy;
  return {
    name: 'ow-tab',
    setup(b) {
      b.onResolve({ filter: NPM_SHARED }, (a) => { used.add('npm:' + a.path); return { path: 'npm:' + a.path, namespace: 'ow-shared' }; });
      b.onResolve({ filter: /^[^./]/ }, (a) => (a.namespace === 'ow-entry' ? undefined
        : { errors: [{ text: `${tab}: "${a.path}" is a package the page does not share; import it from src/ (or add it to NPM_SHARED in tools/build-app.js)` }] }));
      b.onResolve({ filter: /^\.\.?\// }, (a) => {
        const r = rel(path.resolve(a.resolveDir, a.path));
        const m = r.match(/^src\/apps\/([^/]+)\/([^/]+)\//);
        if (m && m[1] === role && m[2] === tab) return undefined;
        if (m && m[1] === role && lazy.includes(m[2])) {
          return { errors: [{ text: `${tab} imports ${r}, another tab's own file: open it by a ROUTES.md id, or callTab() (src/apps/${role}/shell/tabs.ts)` }] };
        }
        used.add(r);
        return { path: r, namespace: r.endsWith('.css') ? 'ow-empty' : 'ow-shared' };
      });
      b.onLoad({ filter: /.*/, namespace: 'ow-shared' }, (a) => ({
        contents: `var m=window.owSalesMods&&window.owSalesMods[${JSON.stringify(a.path)}];if(!m)throw new Error(${JSON.stringify('The page has no ' + a.path)});module.exports=m;`,
        loader: 'js',
      }));
      b.onLoad({ filter: /.*/, namespace: 'ow-empty' }, () => ({ contents: '', loader: 'js' }));
    },
  };
}

/** A virtual entry: `contents` resolved from the repo root. */
function entryPlugin(contents) {
  return {
    name: 'ow-entry',
    setup(b) {
      b.onResolve({ filter: /^ow-entry$/ }, () => ({ path: 'ow-entry', namespace: 'ow-entry' }));
      b.onLoad({ filter: /.*/, namespace: 'ow-entry' }, () => ({ contents, loader: 'tsx', resolveDir: ROOT }));
    },
  };
}

function split(res) {
  const js = res.outputFiles.filter((f) => f.path.endsWith('.js')).map((f) => f.text).join('\n').trim();
  const css = res.outputFiles.filter((f) => f.path.endsWith('.css')).map((f) => f.text).join('\n').trim();
  return { js, css };
}

async function build(role) {
  const r = ROLES[role];
  if (!r) throw new Error(`build-app: unknown role "${role}" (known: ${Object.keys(ROLES).join(', ')})`);
  const main = path.join(ROOT, 'src/apps', role, 'main.tsx');
  if (!fs.existsSync(main)) throw new Error(`build-app: ${rel(main)} is missing`);
  const esbuild = require('esbuild');
  const tmp = path.join(ROOT, '.build-tmp');
  const head = (from, what) => `// GENERATED from ${from} by tools/build-app.js for ${role}.html${what}. Do not edit: run \`npm run build:${role}\`.\n`;

  // 1. Each lazy tab, its own folder only; what it takes from the page is noted.
  const used = new Set();
  const tabs = [];
  for (const tab of r.lazy) {
    const index = path.join(ROOT, 'src/apps', role, tab, 'index.tsx');
    const res = await esbuild.build({
      ...OPTS, ...JSX, entryPoints: ['ow-entry'], outdir: tmp,
      plugins: [entryPlugin(`import * as t from ${JSON.stringify(index)};\nwindow.owSalesTab(${JSON.stringify(tab)}, t, ${JSON.stringify(BUILD_MARK)});`), tabPlugin(role, tab, used)],
    });
    const { js, css } = split(res);
    tabs.push({ tab, file: `${role}-${tab}.js`, text: head(`src/apps/${role}/${tab}`, ` (the ${tab} tab, loaded when first opened)`) + cssInJs(css) + js + '\n' });
  }

  // 2. The page: the app, and the modules the tab files take from it.
  const keys = [...used].sort();
  const imp = keys.map((k, i) => (k.endsWith('.css') ? `import ${JSON.stringify(path.join(ROOT, k))};` : `import * as m${i} from ${JSON.stringify(k.startsWith('npm:') ? k.slice(4) : path.join(ROOT, k))};`));
  const reg = keys.map((k, i) => (k.endsWith('.css') ? '' : `${JSON.stringify(k)}: m${i}`)).filter(Boolean);
  const pageRes = await esbuild.build({
    ...OPTS, ...JSX, entryPoints: ['ow-entry'], outdir: tmp,
    plugins: [entryPlugin(`import ${JSON.stringify(main)};\n${imp.join('\n')}\nwindow.owSalesMods = { ${reg.join(', ')} };`)],
  });
  const p = split(pageRes);

  // 3. One build id over everything; the files get it, the page names them.
  const id = crypto.createHash('sha256').update(p.js + p.css + tabs.map((t) => t.text).join('')).digest('hex').slice(0, 12);
  tabs.forEach((t) => { t.text = t.text.split(BUILD_MARK).join(id); });
  const files = tabs.map((t) => t.file);
  const html = page(role, `window.owSalesBuild=${JSON.stringify(id)};\n${p.js}`, p.css, files);

  // 4. The service worker: this build's page and tab files, kept together.
  const swRes = await esbuild.build({
    ...OPTS, entryPoints: [path.join(ROOT, r.sw)], outdir: tmp,
    define: { __OW_BUILD__: JSON.stringify(id), __OW_FILES__: JSON.stringify([`${role}.html`, ...files]) },
  });
  const sw = head(r.sw, `'s service worker`) + split(swRes).js + '\n';

  const demoRes = await esbuild.build({ ...OPTS, entryPoints: [path.join(ROOT, r.demo)] });
  const demo = head('src/core/demo', '?demo') + demoRes.outputFiles[0].text.trim() + '\n';
  const parts = split(await esbuild.build({ ...OPTS, ...JSX, entryPoints: [path.join(ROOT, r.parts)], outdir: tmp }));
  const gallery = head('src/ui/gallery', '?demo&parts=main|main2') + cssInJs(parts.css) + parts.js + '\n';

  const next = (f) => path.join(ROOT, 'next', f);
  const out = [
    { out: next(`${role}.html`), text: html, budget: BUDGET },
    ...tabs.map((t) => ({ out: next(t.file), text: t.text, budget: TAB_BUDGET })),
    { out: next(`${role}-sw.js`), text: sw },
    { out: next(`${role}-demo.js`), text: demo },
    { out: next(`${role}-parts.js`), text: gallery },
  ];
  out.forEach((o) => { o.gz = gz(o.text); });
  // The names earlier callers (tests) read.
  return { files: out, html, gz: out[0].gz, out: out[0].out, demo, demoOut: next(`${role}-demo.js`), parts: gallery, partsOut: next(`${role}-parts.js`), build: id };
}

async function main() {
  const args = process.argv.slice(2);
  const role = args.find((a) => !a.startsWith('--'));
  const check = args.includes('--check');
  if (!role) { console.error('usage: node tools/build-app.js <role> [--check]'); process.exit(2); }
  const { files } = await build(role);
  const over = files.filter((f) => f.budget && f.gz > f.budget);
  over.forEach((f) => console.error(`build-app: ${rel(f.out)} is ${kb(f.gz)} compressed, over its ${kb(f.budget)} budget (docs/spec/07-stack.md §4)`));
  if (over.length) process.exit(1);
  const sizes = files.map((f) => `  ${rel(f.out)}  ${kb(Buffer.byteLength(f.text))} raw, ${kb(f.gz)} compressed${f.budget ? ` of ${kb(f.budget)}` : ''}`).join('\n');
  if (check) {
    const stale = files.filter((f) => (fs.existsSync(f.out) ? fs.readFileSync(f.out, 'utf8') : '') !== f.text);
    stale.forEach((f) => console.error(`build-app: ${rel(f.out)} is not what src/ builds. Run \`npm run build:${role}\` and commit it.`));
    if (stale.length) process.exit(1);
    console.log(`build-app: every ${role} file matches src/, within budget\n${sizes}`);
    return;
  }
  files.forEach((f) => { fs.mkdirSync(path.dirname(f.out), { recursive: true }); fs.writeFileSync(f.out, f.text); });
  console.log(`build-app: wrote\n${sizes}`);
}

module.exports = { build, page, BUDGET, TAB_BUDGET, SUPABASE_TAG, ROLES };

if (require.main === module) {
  main().catch((e) => { console.error('build-app:', e.message || e); process.exit(1); });
}
