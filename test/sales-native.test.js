#!/usr/bin/env node
'use strict';
/*
 * The Sales app's native layer (src/apps/sales/shell/native*.ts; spec 07 §4, spec 06 §4), the part
 * that runs only inside the Android app:
 *
 *   1. Back takes one step a press, in this order: a sheet, then a screen, then Today, then the
 *      background. It never closes the app.
 *   2. The live update stages only a build of this app (the safety rule): the live page without
 *      the build id and <meta name="ow-files"> that tools/build-app.js writes is refused, so a phone
 *      that ships the new app never turns back into the old one.
 *   3. It is all or nothing: the page's files come from the server, beside the page, each of the
 *      page's build; one missing or of another build and nothing is written.
 *   4. The shell's own files (the Supabase client, the fonts, the swaps) come from the copy running.
 *   5. A copy the old layer staged, without its tab files, is fetched whole once.
 *   6. After the switch, the new copy is kept and the others go.
 *   7. The layer is inert in a browser and in the demo, and its parts are wired in.
 *
 * Node 22 runs the TypeScript as it is. Run: node test/sales-native.test.js (or: npm test)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales native layer');
const B = require(path.join(ROOT, 'src/native/back.ts'));
// The shared update on Sales' own page, key and build id (src/apps/sales/shell/native.ts SALES_APP).
const U = require(path.join(ROOT, 'src/native/update.ts')).updater({ role: 'sales', source: 'https://omni-ware.vercel.app/sales.html', key: 'ow-sales-bundle', build: 'owSalesBuild' });
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ---------- 1. Back: sheet → screen → Today → background ---------- */
{
  // A phone: Orders tab, an order on it, a sheet over it.
  const did = [];
  const ui = {
    sheetOpen: true, depth: 2, rootId: 'orders',
    closeSheet() { did.push('sheet'); this.sheetOpen = false; },
    pop() { did.push('screen'); this.depth -= 1; },
    today() { did.push('today'); this.rootId = 'today'; },
    background() { did.push('background'); },
  };
  const steps = [];
  for (let i = 0; i < 5; i++) steps.push(B.pressBack(ui));
  t.check(steps.join(' ') === 'sheet screen today background background', `five presses: ${steps.join(' → ')}`);
  t.check(did.join(' ') === steps.join(' '), 'each press does the step it names, and only that');
  t.check(B.backStep({ sheetOpen: true, depth: 1, rootId: 'today' }) === 'sheet', 'a sheet on Today closes before the app goes');
  t.check(B.backStep({ sheetOpen: false, depth: 3, rootId: 'customers' }) === 'screen', 'a screen pops before its tab goes to Today');
  t.check(B.backStep({ sheetOpen: false, depth: 1, rootId: 'chats' }) === 'today', 'a tab other than Today goes to Today');
  t.check(B.backStep({ sheetOpen: false, depth: 1, rootId: 'today' }) === 'background', 'only Today with nothing open puts the app in the background');
  t.check(!/exitApp/.test(read('src/native/start.ts')) && /minimizeApp/.test(read('src/native/start.ts')), 'it never exits the app: the background is minimizeApp');
}

/* ---------- the live update, on a fake phone and server ---------- */
const BUILD = 'abc123def456';
const pageOf = (build, files) => '<!-- GENERATED from src/apps/sales -->\n<!doctype html>\n<html lang="en">\n<head>\n'
  + (files ? `<meta name="ow-files" content="${files.join(' ')}">\n` : '') + '</head>\n<body>\n<script>'
  + (build ? `window.owSalesBuild="${build}";` : '') + 'x'.repeat(120000) + '</script>\n</body>\n</html>\n';
const OLD_PAGE = '<!doctype html>\n<html><head><title>Sales</title></head><body><script>' + 'y'.repeat(150000) + '</script></body></html>';
const TABS = ['sales-chats.js', 'sales-sell.js'];
const tab = (name, build) => `// GENERATED ${name}\nwindow.owSalesTab("${name}",t,"${build}");`;
const SHELL = ['vendor/supabase.js', 'transform.js', 'fonts/fonts.css'];

function phone(o = {}) {
  const server = Object.assign({
    [U.SOURCE]: pageOf(BUILD, TABS),
    [U.beside('sales-chats.js')]: tab('chats', BUILD),
    [U.beside('sales-sell.js')]: tab('sell', BUILD),
  }, o.server || {});
  const ph = {
    state: o.state || {},
    disk: {},
    asked: [],
    removed: [],
    io: null,
  };
  ph.io = {
    load: () => JSON.parse(JSON.stringify(ph.state)),
    save: (s) => { ph.state = JSON.parse(JSON.stringify(s)); },
    now: () => 10 * U.EVERY,
    running: async () => o.running || { source: 'old-hash', files: ['index.html', 'sales-chats.js', 'sales-sell.js', 'sales-demo.js', ...SHELL, 'bundle.json'] },
    runningNames: () => o.runningNames || TABS,
    get: async (url, etag) => {
      ph.asked.push([url, etag || null]);
      if (o.offline) throw new Error('Failed to fetch');
      if (o.notModified && url === U.SOURCE && etag) return { status: 304, text: '', etag };
      return url in server ? { status: 200, text: server[url], etag: url === U.SOURCE ? '"e2"' : '' } : { status: 404, text: 'not found', etag: '' };
    },
    local: async (f) => { if (!SHELL.includes(f)) throw new Error('not in this copy: ' + f); return 'B64(' + f + ')'; },
    sha256: async (s) => (s === OLD_PAGE ? 'f'.repeat(64) : (s.length.toString(16) + 'a'.repeat(64)).slice(0, 64)),
    transform: (html) => html.replace('<head>', '<head>\n<script src="transform.js"></script>'),
    write: async (p, data, utf8) => { if (o.diskFull && p.endsWith('bundle.json')) throw new Error('disk full'); ph.disk[p] = { data, utf8 }; },
    uri: async (dir) => 'file:///data/user/0/com.omniware.sales/files/' + dir,
    remove: async (dir) => { ph.removed.push(dir); Object.keys(ph.disk).forEach((k) => { if (k.startsWith(dir + '/')) delete ph.disk[k]; }); },
  };
  return ph;
}

(async () => {
  /* ---------- 2. the safety rule ---------- */
  {
    t.check(U.SOURCE === 'https://omni-ware.vercel.app/sales.html', 'it asks the live sales.html the spec names');
    t.check(U.builtPage(OLD_PAGE) === null, 'the old sales.html (no build id, no ow-files) is not a build of this app');
    t.check(U.builtPage(pageOf(BUILD, null)) === null, 'nor is a page with the build id but no ow-files');
    t.check(U.builtPage(pageOf(null, TABS)) === null, 'nor one with ow-files but no build id');
    t.check(U.builtPage(pageOf(BUILD, TABS).slice(0, 90000)) === null, 'nor a cut-off download');
    t.check(U.builtPage(pageOf(BUILD, ['../evil.js'])) === null, 'nor a page naming a file outside its folder');
    const ok = U.builtPage(pageOf(BUILD, TABS));
    t.check(!!ok && ok.build === BUILD && ok.files.join(' ') === TABS.join(' '), 'a build of this app gives its build id and files');
    const real = read('next/sales.html');
    const mine = U.builtPage(real);
    t.check(!!mine && mine.files.length === 5 && real.includes(`window.owSalesBuild="${mine.build}"`), `the committed next/sales.html passes it (build ${mine && mine.build}, ${mine && mine.files.length} files)`);
    // The live page: the old app until Sales is switched, then this test reads the built sales.html.
    const live = read('sales.html');
    if (live.slice(0, 300).includes('GENERATED from src/')) t.check(!!U.builtPage(live), 'the root sales.html is the built page: the phones take it');
    else t.check(U.builtPage(live) === null, 'and the old root sales.html does not: an APK of the new app stays on what it shipped until the switch');

    const ph = phone({ server: { [U.SOURCE]: OLD_PAGE } });
    const r = await U.check(ph.io);
    t.check(r === 'refused' && Object.keys(ph.disk).length === 0 && !ph.state.staged, `the live page is the old app: ${r}, nothing written, nothing staged`);
    t.check(ph.asked.length === 1, 'and nothing beside it is fetched');
  }

  /* ---------- 3. all or nothing ---------- */
  {
    const ph = phone();
    const r = await U.check(ph.io);
    const dir = Object.keys(ph.disk)[0].split('/').slice(0, 2).join('/');
    t.check(r === 'staged' && /^live\/[0-9a-f]{16}$/.test(dir), `a new build is staged in its own folder (${dir})`);
    t.check(ph.asked.some(([u]) => u === 'https://omni-ware.vercel.app/sales-chats.js') && ph.asked.some(([u]) => u === 'https://omni-ware.vercel.app/sales-sell.js'),
      'every file the page names is fetched from the server, beside the page');
    t.check(ph.disk[dir + '/sales-chats.js'].data === tab('chats', BUILD) && ph.disk[dir + '/sales-sell.js'].utf8, 'and written as the server sent it');
    t.check(ph.disk[dir + '/index.html'].data.includes('<script src="transform.js"></script>'), 'the page goes through the phone\'s swaps');
    const bundle = JSON.parse(ph.disk[dir + '/bundle.json'].data);
    t.check(bundle.build === BUILD && bundle.files.includes('sales-chats.js') && bundle.files.includes('vendor/supabase.js') && bundle.files[0] === 'index.html',
      'its bundle.json names the build and every file in the copy');
    t.check(ph.state.staged && ph.state.staged.dir === dir && ph.state.staged.path === '/data/user/0/com.omniware.sales/files/' + dir && ph.state.staged.etag === '"e2"',
      'it waits, staged, for the app to go to the background');
    t.check(await U.check(ph.io) === 'staged-already', 'and nothing more is fetched while it waits');

    const noSell = phone();
    const get = noSell.io.get;
    noSell.io.get = (url, etag) => (url === U.beside('sales-sell.js') ? Promise.resolve({ status: 404, text: 'not found', etag: '' }) : get(url, etag));
    const r1 = await U.check(noSell.io);
    t.check(r1 === 'missing' && Object.keys(noSell.disk).length === 0 && !noSell.state.staged, `a tab file missing on the server: ${r1}, nothing written, nothing staged`);
    const mixed = phone({ server: { [U.beside('sales-sell.js')]: tab('sell', 'ffffffffffff') } });
    const r2 = await U.check(mixed.io);
    t.check(r2 === 'missing' && Object.keys(mixed.disk).length === 0 && !mixed.state.staged, `a tab file of another build (a deploy half-way): ${r2}, nothing written, nothing staged`);

    const full = phone({ diskFull: true });
    const r3 = await U.check(full.io);
    t.check(r3 === 'failed' && Object.keys(full.disk).length === 0 && full.removed.length === 1 && !full.state.staged, `a write that fails half-way: ${r3}, the half copy removed, nothing staged`);

    const off = phone({ offline: true });
    t.check(await U.check(off.io) === 'failed' && !off.state.staged && off.state.checked, 'no signal: the copy here carries on, and it asks again later');
    t.check(await U.check(off.io) === 'waiting', 'not before EVERY has passed');
  }

  /* ---------- 4. the shell's files from the running copy ---------- */
  {
    t.check(U.shellFiles(['index.html', 'sales-chats.js', 'sales-demo.js', 'vendor/supabase.js', 'transform.js', 'fonts/figtree-latin-400-normal.woff2', 'bundle.json']).join(' ')
      === 'vendor/supabase.js transform.js fonts/figtree-latin-400-normal.woff2', 'the shell\'s own files are transform.js and those in folders; a build\'s files are not');
    const ph = phone();
    await U.check(ph.io);
    const dir = ph.state.staged.dir;
    t.check(SHELL.every((f) => ph.disk[dir + '/' + f] && ph.disk[dir + '/' + f].data === 'B64(' + f + ')' && !ph.disk[dir + '/' + f].utf8), 'the Supabase client, the fonts and the swaps are copied from the copy running');
    t.check(!ph.asked.some(([u]) => /vendor|fonts|transform/.test(u)), 'and never fetched from the server');
  }

  /* ---------- 5. the same page; a copy without its tab files ---------- */
  {
    const page = pageOf(BUILD, TABS);
    const hash = (page.length.toString(16) + 'a'.repeat(64)).slice(0, 64);
    const same = phone({ running: { source: hash, files: ['index.html', ...TABS, ...SHELL, 'bundle.json'] }, state: { etag: '"e1"' } });
    t.check(await U.check(same.io) === 'current' && same.state.etag === '"e2"' && Object.keys(same.disk).length === 0, 'the live page is the one running: nothing staged');
    t.check(same.asked[0][1] === '"e1"', 'and it was asked with its ETag');

    // The old layer stages the new page with only the old app's files: the tab files are not on the phone.
    const half = phone({ running: { source: hash, files: ['index.html', ...SHELL, 'bundle.json'] }, state: { etag: '"e1"' } });
    const r = await U.check(half.io);
    t.check(half.asked[0][1] === null && r === 'staged' && half.disk[half.state.staged.dir + '/sales-chats.js'], `a copy missing a file its page names is fetched whole, without the ETag: ${r}`);
  }

  /* ---------- 6. after the switch ---------- */
  {
    let state = { staged: { dir: 'live/aaaa', path: '/p/live/aaaa', etag: '"e2"' } };
    const gone = [];
    let persisted = false;
    const io = {
      load: () => JSON.parse(JSON.stringify(state)), save: (s) => { state = s; },
      basePath: async () => '/p/live/aaaa', persist: async () => { persisted = true; },
      dirs: async () => ['aaaa', 'bbbb', 'cccc'], remove: async (d) => { gone.push(d); },
    };
    await U.settle(io);
    t.check(persisted && !state.staged && state.etag === '"e2"' && gone.join(' ') === 'live/bbbb live/cccc', 'the new copy is kept as the one the app opens with, and the old copies go');
    state = { staged: { dir: 'live/aaaa', path: '/p/live/aaaa', etag: '"e2"' } }; persisted = false;
    await U.settle(Object.assign({}, io, { basePath: async () => '/p/www' }));
    t.check(!persisted && state.staged, 'before the switch has happened, nothing is settled');
  }

  /* ---------- 7. inert in a browser and the demo; wired in ---------- */
  {
    const n = read('src/native/start.ts'), w = read('src/apps/sales/shell/native.ts');
    t.check(/if \(!C \|\| h\.isDemo\) return;/.test(n) && /C\.isNativePlatform\(\)/.test(n) && /isDemo,/.test(w), 'the layer does nothing in a browser or in the demo');
    t.check(/addListener\('pause'/.test(n) && /setServerBasePath/.test(n), 'a staged copy is switched to only when the app goes to the background');
    t.check(/addListener\('backButton'/.test(n) && /sheet\.isOpen/.test(w) && /nav\.back\(\)/.test(w) && /nav\.home\(\)/.test(w), 'Back reads the app\'s own sheet and stack');
    t.check(/source: 'https:\/\/omni-ware\.vercel\.app\/sales\.html'/.test(w) && /key: 'ow-sales-bundle'/.test(w) && /build: 'owSalesBuild'/.test(w), 'Sales wires the shared layer to its own page, key and build id (as this test does)');
    const m = read('src/apps/sales/main.tsx');
    t.check(/startNative\(\)/.test(m) && /!inPhoneApp\(\)/.test(m), 'main.tsx starts it, and the phone app keeps itself current without the service worker');
    t.check(read('next/sales.html').includes('data-ow-native'), 'the built page carries it (apps/sales/scripts/build-www.js checks the same marker)');
    t.check(/the old page's native layer/.test(read('docs/rebuild.md')), 'the old page\'s own copy of the layer is on the retire list (docs/rebuild.md)');
  }

  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
