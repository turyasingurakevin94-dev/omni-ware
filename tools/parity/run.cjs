#!/usr/bin/env node
'use strict';
/*
 * Canvas parity: one board beside the app, at 360 × 800, the app reached by
 * real taps from Today (docs/spec/04-screens-sales.md §1, "Proof that the
 * app matches"; docs/audit/sales/CANVAS-PARITY.md).
 *
 *   node tools/parity/run.cjs TD01Today.dc.html                 the spec for that board, found in test/parity/*.json
 *   node tools/parity/run.cjs TD01Today.dc.html test/parity/today.json
 *   node tools/parity/run.cjs TD05ToCollect.dc.html '{"demo":"","steps":[{"tap":"To collect"}]}'
 *   node tools/parity/run.cjs --tab today                       every spec in test/parity/today.json
 *   node tools/parity/run.cjs --all                             every spec of every tab
 *
 * For each board it writes docs/audit/sales/parity/<Board>.png (the board
 * left, the app right, same scale), <Board>.diff.png (what differs, in red
 * over the board in grey) and the pixel difference into results.json, which
 * tools/parity/report.cjs turns into the table in CANVAS-PARITY.md.
 *
 * The board is drawn as docs/canvas/sales-agent/tools/shot.cjs draws it (the
 * x-dc and helmet wrappers stripped, fonts through HTTPS_PROXY). The app is
 * next/sales.html?demo<flags>, served from this checkout (run
 * `npm run build:sales` first). Playwright is preinstalled:
 *   NODE_PATH=$(npm root -g) node tools/parity/run.cjs …
 *
 * A step (test/parity/README.md):
 *   {"tap": "Orders"}                      by aria-label, else visible text (exact, then contained)
 *   {"tap": {"label": "Close"}} · {"tap": {"text": "Kato"}} · {"tap": {"sel": "nav a:nth-child(2)"}}
 *   {"type": "Kato", "into": "Name, phone or what they said"}   into a field by its label or placeholder (or "sel")
 *   {"press": "Enter"} · {"wait": 400} · {"wait": "Placed"} (until that text shows) · {"scroll": 300} or {"scroll": "Show 34 more"}
 * A spec may also name a "region": [x, y, w, h] in board pixels, measured on its own as well
 * (TD01's tab bar: [0, 716, 360, 84]).
 *
 * Each board is shot at its own size, its "$preview" (360 × 800 for a screen; the parts
 * boards Main and Main2 are 1600 × 1600 and 1600 × 1000, reached at ?demo&parts=main|main2,
 * test/parity/parts.json), and the app at the same viewport. Animations are stopped in both
 * shots (each at its first frame), so a pulse or a nudge never counts as a difference.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const BOARDS = path.join(ROOT, 'docs/canvas/sales-agent/boards');
const SPECS = path.join(ROOT, 'test/parity');
const OUT = path.join(ROOT, 'docs/audit/sales/parity');
const ORIGIN = 'http://omni.local';

/** A board's own size: its $preview (shot.cjs reads it the same way); 360 × 800 when it says none. */
function sizeOf(board) {
  const m = fs.readFileSync(path.join(BOARDS, board), 'utf8').match(/"\$preview":\{"width":(\d+),"height":(\d+)\}/);
  return m ? { W: +m[1], H: +m[2] } : { W: 360, H: 800 };
}

function allSpecs() {
  const out = [];
  if (!fs.existsSync(SPECS)) return out;
  for (const f of fs.readdirSync(SPECS).filter((x) => x.endsWith('.json')).sort()) {
    const tab = f.replace(/\.json$/, '');
    const list = JSON.parse(fs.readFileSync(path.join(SPECS, f), 'utf8'));
    (Array.isArray(list) ? list : []).forEach((s) => out.push({ tab, ...s }));
  }
  return out;
}

function pick(args) {
  if (args[0] === '--all') return allSpecs();
  if (args[0] === '--tab') return allSpecs().filter((s) => s.tab === args[1]);
  const board = path.basename(args[0] || '');
  if (!board) throw new Error('usage: run.cjs <Board.dc.html> [spec file or JSON] | --tab <tab> | --all');
  if (args[1] && args[1].trim().startsWith('{')) return [{ tab: tabOf(board), board, ...JSON.parse(args[1]) }];
  const pool = args[1] ? JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8')).map((s) => ({ tab: path.basename(args[1], '.json'), ...s })) : allSpecs();
  const hit = pool.find((s) => s.board === board);
  if (!hit) throw new Error(`No parity spec for ${board} (add one to test/parity/<tab>.json)`);
  return [hit];
}

function tabOf(board) {
  const c = JSON.parse(fs.readFileSync(path.join(BOARDS, 'canvas.json'), 'utf8'));
  const page = (c.boards[board] && c.boards[board].page) || 'unknown';
  return page === 'lang' ? 'parts' : page;
}

/** The board as shot.cjs draws it. */
async function shootBoard(browser, board, { W, H }) {
  const src = fs.readFileSync(path.join(BOARDS, board), 'utf8');
  const html = src.replace('<script src="./support.js"></script>', '').replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/, '')
    .replace(/<x-dc>/g, '<div class="xdc">').replace(/<\/x-dc>/g, '</div>').replace(/<helmet>/g, '').replace(/<\/helmet>/g, '');
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
  await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await p.waitForTimeout(400);
  const png = await p.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, animations: 'disabled' });
  await ctx.close();
  return png;
}

/** Serve this checkout to the page (no local port: the proxy would carry it). */
async function serve(ctx) {
  await ctx.route(`${ORIGIN}/**`, (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, '');
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'not found' });
    const type = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    return r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: type });
  });
  // The demo never needs the database client; on ?demo it would only slow the page.
  await ctx.route('**/supabase-js@**', (r) => r.abort());
}

async function find(p, target) {
  const t = typeof target === 'string' ? { any: target } : target;
  if (t.sel) return p.locator(t.sel).first();
  if (t.label) return p.locator(`[aria-label="${t.label.replace(/"/g, '\\"')}"]`).first();
  if (t.text) return p.getByText(t.text, { exact: true }).first();
  const label = p.locator(`[aria-label="${t.any.replace(/"/g, '\\"')}"]`);
  if (await label.count()) return label.first();
  const exact = p.getByText(t.any, { exact: true });
  if (await exact.count()) return exact.first();
  return p.getByText(t.any).first();
}

async function step(p, s) {
  if (s.tap != null) { const el = await find(p, s.tap); await el.scrollIntoViewIfNeeded(); await el.tap(); }
  else if (s.type != null) {
    const into = s.into;
    const el = !into ? p.locator(':focus') : typeof into === 'object' && into.sel ? p.locator(into.sel).first()
      : p.getByLabel(into).or(p.getByPlaceholder(into)).first();
    await el.fill(String(s.type));
  } else if (s.press) await p.keyboard.press(s.press);
  else if (typeof s.wait === 'number') await p.waitForTimeout(s.wait);
  else if (typeof s.wait === 'string') await p.getByText(s.wait).first().waitFor({ timeout: 8000 });
  else if (typeof s.scroll === 'number') await p.mouse.wheel(0, s.scroll);
  else if (typeof s.scroll === 'string') await (await find(p, s.scroll)).scrollIntoViewIfNeeded();
  else throw new Error('Unknown step ' + JSON.stringify(s));
  await p.waitForTimeout(s.settle ?? 350);
}

async function shootApp(browser, spec, { W, H }) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, ignoreHTTPSErrors: true });
  await serve(ctx);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${ORIGIN}/next/sales.html?demo${spec.demo || ''}`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await p.locator('#app > *').first().waitFor({ timeout: 8000 });
  await p.waitForTimeout(500);
  let taps = 0;
  for (const s of spec.steps || []) { await step(p, s); if (s.tap != null) taps++; }
  await p.waitForTimeout(spec.settle ?? 300);
  const png = await p.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, animations: 'disabled' });
  await ctx.close();
  return { png, taps, errors };
}

/** Side by side, the diff, and the % of pixels that differ (in the browser: no image package needed). */
async function compare(browser, boardPng, appPng, board, region, { W, H }) {
  const ctx = await browser.newContext({ viewport: { width: W * 2 + 48, height: H + 56 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const url = (b) => 'data:image/png;base64,' + b.toString('base64');
  await p.setContent(`<!doctype html><body style="margin:0;background:#E6E3DD;font:600 13px system-ui">
    <div style="display:flex;gap:16px;padding:12px 16px 0"><div style="width:${W}px">Canvas · ${board}</div><div style="width:${W}px">App · next/sales.html?demo</div></div>
    <div style="display:flex;gap:16px;padding:8px 16px 16px"><img id="a" src="${url(boardPng)}" width="${W}" height="${H}"><img id="b" src="${url(appPng)}" width="${W}" height="${H}"></div>
    <canvas id="d" width="${W}" height="${H}" style="display:none"></canvas></body>`);
  await p.waitForFunction(() => [...document.images].every((i) => i.complete));
  const r = await p.evaluate(({ W, H, region }) => {
    const get = (id) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.drawImage(document.getElementById(id), 0, 0); return x.getImageData(0, 0, W, H).data; };
    const a = get('a'), b = get('b'), d = document.getElementById('d'), dx = d.getContext('2d'), out = dx.createImageData(W, H);
    let n = 0, rn = 0, rAll = 0;
    const [rx, ry, rw, rh] = region || [0, 0, 0, 0];
    for (let i = 0; i < a.length; i += 4) {
      const diff = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      const g = Math.round((a[i] + a[i + 1] + a[i + 2]) / 3 * 0.35 + 165), px = (i / 4) % W, py = Math.floor(i / 4 / W);
      const inR = region && px >= rx && px < rx + rw && py >= ry && py < ry + rh;
      if (inR) rAll++;
      if (diff > 24) { n++; if (inR) rn++; out.data[i] = 201; out.data[i + 1] = 58; out.data[i + 2] = 48; } else { out.data[i] = g; out.data[i + 1] = g; out.data[i + 2] = g; }
      out.data[i + 3] = 255;
    }
    dx.putImageData(out, 0, 0);
    return { pct: (n / (W * H)) * 100, regionPct: region ? (rn / Math.max(1, rAll)) * 100 : null, diff: d.toDataURL('image/png') };
  }, { W, H, region: region || null });
  const side = await p.screenshot({ fullPage: true });
  await ctx.close();
  const round = (x) => (x == null ? null : Math.round(x * 100) / 100);
  return { side, diff: Buffer.from(r.diff.split(',')[1], 'base64'), pct: round(r.pct), regionPct: round(r.regionPct) };
}

async function main() {
  const specs = pick(process.argv.slice(2));
  fs.mkdirSync(OUT, { recursive: true });
  const resultsFile = path.join(OUT, 'results.json');
  const results = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : {};
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch(proxy ? { proxy } : {});
  let failed = 0;
  for (const spec of specs) {
    const name = spec.board.replace(/\.dc\.html$/, '');
    try {
      const size = sizeOf(spec.board);
      const boardPng = await shootBoard(browser, spec.board, size);
      const app = await shootApp(browser, spec, size);
      const c = await compare(browser, boardPng, app.png, spec.board, spec.region, size);
      fs.writeFileSync(path.join(OUT, name + '.png'), c.side);
      fs.writeFileSync(path.join(OUT, name + '.diff.png'), c.diff);
      results[spec.board] = { tab: spec.tab, taps: app.taps, diff: c.pct, region: spec.region || null, regionDiff: c.regionPct, errors: app.errors, at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
      console.log(`${spec.board}: ${c.pct}% of pixels differ${c.regionPct != null ? ` (region ${JSON.stringify(spec.region)}: ${c.regionPct}%)` : ''} · ${app.taps} taps${app.errors.length ? ' · page errors: ' + app.errors.join(' | ') : ''}`);
    } catch (e) {
      failed++;
      results[spec.board] = { tab: spec.tab, taps: null, diff: null, errors: [String(e.message || e).split('\n')[0]], at: new Date().toISOString().slice(0, 16).replace('T', ' ') };
      console.error(`${spec.board}: could not run — ${String(e.message || e).split('\n')[0]}`);
    }
  }
  await browser.close();
  const sorted = Object.fromEntries(Object.keys(results).sort().map((k) => [k, results[k]]));
  fs.writeFileSync(resultsFile, JSON.stringify(sorted, null, 2) + '\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
