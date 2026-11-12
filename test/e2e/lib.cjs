'use strict';
/*
 * The plumbing of the end-to-end runs (test/e2e/sales-flows.cjs, test/e2e/store-flows.cjs):
 *   - a tiny static server for this checkout (next/<app>.html, or <app>.html at the root once switched, and its files);
 *   - one fresh phone per flow: 360 × 800, touch, ?demo plus only the flags a tap cannot cause;
 *   - the guards every flow carries: no console error and no pageerror; on every screen
 *     visited, nothing wider than the phone (scrollWidth ≤ clientWidth), and every visible
 *     button or link at least 44 × 44 (the exceptions are recorded, never hidden);
 *   - the taps: by aria-label, else by visible text (exact, then contained), as
 *     tools/parity/run.cjs finds them, so the paths of test/parity/<tab>.json read the same;
 *     a real drag for a slide.
 *
 * Nothing here reaches the network: the fonts and the database client the page asks for are
 * answered empty (the demo needs neither), so a run is the same on any machine.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const W = 360, H = 800, MIN = 44;

function loadPlaywright() {
  try { return require('playwright'); } catch (_e) { /* fall through */ }
  try {
    const root = require('child_process').execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(path.join(root, 'playwright'));
  } catch (_e) { return null; }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

/** Serves this checkout on 127.0.0.1 (a free port). Resolves { url, close }. */
function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  })));
}

/** What every flow records. One per flow. */
function newRecord(name) {
  return { name, ok: true, failures: [], checks: [], errors: [], wide: [], small: [], screens: 0, ms: 0, notes: [] };
}

/**
 * The phone app's own fonts: the files apps/sales ships in the installed app (scripts/build-www.js FACES, from
 * its @fontsource packages), served from this checkout, never the network. CSS for them, or null when a file is
 * not installed here (apps/sales: npm ci).
 */
function localFonts(base) {
  const { FACES } = require(path.join(ROOT, 'apps/sales/scripts/build-www.js'));
  const css = [];
  for (const [family, pkg, stem, weights] of FACES) {
    for (const w of weights) {
      const rel = `apps/sales/node_modules/${pkg}/files/${stem}-latin-${w}-normal.woff2`;
      if (!fs.existsSync(path.join(ROOT, rel))) return null;
      css.push(`@font-face{font-family:'${family}';font-weight:${w};font-display:block;src:url(${base}/${rel}) format('woff2')}`);
    }
  }
  return css.join('\n');
}

/** The page of an app: next/<app>.html, or <app>.html at the root once it is switched (docs/rebuild.md, the Store 2026-11-12). */
const SWITCHED = ['store'];
const pageOf = (app) => (SWITCHED.includes(app) ? '' : 'next/') + app + '.html';

/**
 * A fresh phone on the app's page (pageOf) ?demo<flags>, at Today. Returns the flow's toolkit.
 *   opts.app    the app ('sales' by default, next/sales.html; 'store', the switched store.html)
 *   opts.init   [fn, arg] run in the page before it loads (page.addInitScript), e.g. the phone's large text
 *   opts.fonts  the phone app's own fonts (measuring room needs the real letters): the files apps/sales ships
 */
async function phone(browser, base, rec, flags = '', opts = {}) {
  const fonts = opts.fonts ? localFonts(base) : '';
  // Room measured with other letters is no measure: say why once, rather than a list of false overflows.
  if (fonts === null) throw new Error('the phone app\'s own fonts are not installed in this checkout: run `npm ci` in apps/sales (the fit flow measures with them, never the network)');
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: 'block' });
  if (opts.init) await ctx.addInitScript(opts.init[0], opts.init[1]);
  await ctx.route((u) => !u.href.startsWith(base), (r) => {
    const u = r.request().url();
    if (/fonts\.googleapis\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'text/css', body: fonts });
    if (/\.js(\?|$)/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    return r.fulfill({ status: 204, body: '' });
  });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') rec.errors.push('console: ' + m.text()); });
  p.on('pageerror', (e) => rec.errors.push('pageerror: ' + (e.message || String(e)).split('\n')[0]));
  await p.goto(`${base}/${pageOf(opts.app || 'sales')}?demo${flags}`, { waitUntil: 'load' });
  await p.locator('#app > *').first().waitFor({ timeout: 10000 });
  await p.waitForFunction(() => document.documentElement.dataset.tabs, null, { timeout: 10000 }).catch(() => {});
  if (fonts) await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const kit = toolkit(p, rec);
  await kit.look('Today');
  return { ctx, p, ...kit };
}

/** The checks run on each screen visited. */
async function measure(p) {
  return p.evaluate(({ MIN }) => {
    const d = document.documentElement, b = document.body;
    const wide = [];
    if (d.scrollWidth > d.clientWidth) wide.push(`page ${d.scrollWidth} > ${d.clientWidth}`);
    if (b && b.scrollWidth > b.clientWidth) wide.push(`body ${b.scrollWidth} > ${b.clientWidth}`);
    // A screen or sheet that scrolls on its own (full width, tall) must not be wider than itself either.
    // A row of chips meant to slide sideways is short, so it is not counted.
    for (const el of document.querySelectorAll('#app *, [role=dialog], [role=dialog] *')) {
      if (el.clientWidth < 320 || el.clientHeight < 300 || el.scrollWidth <= el.clientWidth + 1) continue;
      const cs = getComputedStyle(el);
      if (!/(auto|scroll|hidden|clip)/.test(cs.overflowX)) continue;
      wide.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${el.scrollWidth} > ${el.clientWidth}`);
    }
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return null;
      for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.opacity === '0' || a.inert || a.getAttribute('aria-hidden') === 'true') return null; }
      return r;
    };
    const name = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.className || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 60);
    const small = [];
    for (const el of document.querySelectorAll('button, a[href], [role=button], [role=link]')) {
      const r = shown(el);
      if (!r) continue;
      if (r.width < MIN - 0.5 || r.height < MIN - 0.5) small.push({ name: name(el), w: Math.round(r.width), h: Math.round(r.height), cls: String(el.className || '').split(' ')[0] });
    }
    // The screen's name: the sheet on top (its label), else the screen's first words.
    const dlg = [...document.querySelectorAll('[role=dialog]')].filter((x) => x.getBoundingClientRect().height > 0).pop();
    const first = ((document.querySelector('#app') || document.body).innerText || '').split('\n').filter(Boolean).slice(0, 2).join(' ');
    return { wide, small, where: (dlg ? 'sheet: ' + (dlg.getAttribute('aria-label') || '') : first).slice(0, 48) };
  }, { MIN });
}

function toolkit(p, rec) {
  const seenSmall = new Set();
  const fail = (m) => { rec.ok = false; rec.failures.push(m); };
  const kit = {
    p,
    /** A check: recorded, and the flow fails when it does not hold. Never softened. */
    check(cond, m, detail) {
      rec.checks.push({ ok: !!cond, m });
      if (!cond) fail(m + (detail != null ? ` (got: ${String(detail).replace(/\s+/g, ' ').slice(0, 300)})` : ''));
      return !!cond;
    },
    note(m) { rec.notes.push(m); },
    /** Measure the screen now on the phone (called after every tap). */
    async look(label) {
      const m = await measure(p);
      rec.screens++;
      for (const w of m.wide) { rec.wide.push(`${label} [${m.where}]: ${w}`); fail(`wider than 360 at ${label} [${m.where}]: ${w}`); }
      for (const s of m.small) {
        const k = `${m.where}|${s.name}|${s.w}x${s.h}`;
        if (seenSmall.has(k)) continue;
        seenSmall.add(k);
        rec.small.push({ at: `${label} [${m.where}]`, ...s });
      }
    },
    /** Find like the parity harness: {label}, {text}, {sel}, or a string (aria-label, else exact text, else contains). */
    async find(target) {
      const t = typeof target === 'string' ? { any: target } : target;
      const q = (s) => s.replace(/"/g, '\\"');
      if (t.sel) return p.locator(t.sel).first();
      if (t.label) return p.locator(`[aria-label="${q(t.label)}"]`).first();
      if (t.text) return p.getByText(t.text, { exact: true }).first();
      const label = p.locator(`[aria-label="${q(t.any)}"]`);
      if (await label.count()) return label.first();
      const exact = p.getByText(t.any, { exact: true });
      if (await exact.count()) return exact.first();
      return p.getByText(t.any).first();
    },
    /**
     * A real tap (touch), then a settle, then the screen is measured. o.force: tap a control that says
     * aria-disabled yet answers a tap (a locked slide that opens what unlocks it), as a finger would.
     */
    async tap(target, settle = 350, o = {}) {
      const el = await kit.find(target);
      await el.waitFor({ state: 'visible', timeout: 6000 });
      await el.scrollIntoViewIfNeeded();
      await el.tap(o.force ? { force: true } : undefined);
      await p.waitForTimeout(settle);
      await kit.look('after tap ' + JSON.stringify(target).slice(0, 80));
    },
    /** Types into a field found by its aria-label, label or placeholder (or {sel}). */
    async type(text, into, settle = 350) {
      const el = typeof into === 'object' && into.sel ? p.locator(into.sel).first()
        : p.locator(`[aria-label="${into.replace(/"/g, '\\"')}"]`).or(p.getByLabel(into)).or(p.getByPlaceholder(into)).first();
      await el.waitFor({ state: 'visible', timeout: 6000 });
      await el.tap();
      await el.fill(String(text));
      await p.waitForTimeout(settle);
      await kit.look('after typing ' + JSON.stringify(text));
    },
    /**
     * In the Orders list: the row of that order number ("#0558"), opening each group's "Show N more"
     * until it shows (a long group folds its rest, as OR11's "Show 2 more"). Resolves false when absent.
     */
    async orderRow(no) {
      const row = () => p.locator(`button.ow-orow-main:has-text("${no}")`);
      for (let i = 0; i < 6 && !(await row().count()); i++) {
        const more = p.locator('button.ow-more').filter({ hasText: /Show \d+ more/ });
        if (!(await more.count())) break;
        await more.first().scrollIntoViewIfNeeded();
        await more.first().tap();
        await p.waitForTimeout(350);
        await kit.look('after Show more');
      }
      return (await row().count()) > 0;
    },
    /** What the screen says, without the toasts (a toast's words are checked on their own). */
    async screen() {
      return p.evaluate(() => {
        const ts = [...document.querySelectorAll('.ow-toast, .ow-toast-error')], was = ts.map((x) => x.style.display);
        ts.forEach((x) => { x.style.display = 'none'; });
        const t = (document.querySelector('#app') || document.body).innerText;
        ts.forEach((x, i) => { x.style.display = was[i]; });
        return t;
      });
    },
    /** A tab of the bar: 'today', 'chats', 'orders', 'customers'. */
    async tab(id) { await kit.tap({ sel: `nav a[href='#${id}']` }); },
    /** The toast's words (and anything else in a live region), after it has had time to show. */
    async toast(ms = 500) { await p.waitForTimeout(ms); return (await p.locator('[role=status], [role=alert], .ow-toast').allInnerTexts()).join(' | '); },
    async press(key, settle = 350) { await p.keyboard.press(key); await p.waitForTimeout(settle); await kit.look('after ' + key); },
    async wait(text, timeout = 8000) { await p.getByText(text).first().waitFor({ timeout }); await kit.look('at ' + text); },
    /** Drags the slide's red knob across with a finger-like pointer (no keyboard). */
    async slide(sel = '.ow-knob', settle = 900) {
      const knob = p.locator(sel).first();
      await knob.waitFor({ state: 'visible', timeout: 6000 });
      // The knob nudges (a CSS animation) until touched, so it is never "stable": no scrollIntoView. It sits in the foot.
      const k = await knob.boundingBox();
      const track = await knob.locator('xpath=..').boundingBox();
      const y = k.y + k.height / 2;
      await p.mouse.move(k.x + k.width / 2, y);
      await p.mouse.down();
      for (let i = 1; i <= 12; i++) await p.mouse.move(k.x + k.width / 2 + ((track.x + track.width - k.x) * i) / 12, y);
      await p.mouse.up();
      await p.waitForTimeout(settle);
      await kit.look('after slide');
    },
    /** What the slide says: its name, which is its words (P15: one control, named by what it says). */
    slideSays: async () => (await p.locator('.ow-knob').first().getAttribute('aria-label').catch(() => null)) || '',
    /** The app's visible words. */
    text: () => p.locator('#app').innerText(),
    /** The words of what floats over the app (sheets, toasts). */
    async all() { return p.evaluate(() => document.body.innerText); },
    fail,
  };
  return kit;
}

/** Money as the app writes it: 1,810,000. */
const money = (n) => Math.round(n).toLocaleString('en-US');
/** The first figure after a label in a text ("Owes 420,000" → 420000). */
function figureAfter(text, label) {
  const m = new RegExp(label + '[^0-9]{0,40}([0-9][0-9,]*)').exec(text);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

module.exports = { ROOT, W, H, MIN, loadPlaywright, serve, newRecord, phone, pageOf, money, figureAfter };
