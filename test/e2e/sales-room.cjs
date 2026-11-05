#!/usr/bin/env node
'use strict';
/*
 * Room on real phones, every board's screen (the rough-edge hunt, kept): each parity spec's taps
 * (test/parity/<tab>.json) walked again under conditions the boards never draw, and the screen it
 * reaches checked for what a person would see as broken.
 *
 *   small    320 × 640, 100% text
 *   z130     360 × 800, the phone's text at 130% (as the WebView's textZoom scales it, flows-fit.cjs)
 *   big130   360 × 800, 130% text, more data than any board draws (&state=stretched); a spec whose taps
 *            name the sample shop's people may not reach its screen there: what it reaches is checked
 *
 * On every screen reached:
 *   - no page wider than the phone, and no words off it unless in a row that slides sideways;
 *   - no money figure cut with "…" (a figure inside words that give way is kept whole: util.tsx Keep);
 *   - nothing under a dock: scrolled to the end, the last of the page clears the dock; with a field in
 *     focus and the keyboard up (the screen 300 px shorter), the field is not under the dock;
 *   - no tap target under 44 × 44 (its own box, a ::after hit area, or the label it sits in).
 *
 *   npm run e2e:sales:room                  all three
 *   npm run e2e:sales:room -- z130 CU       one condition, boards matching CU
 * Needs next/sales.html (npm run build:sales) and Playwright.
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const { phoneLike } = require('./flows-fit.cjs');

const ROOT = path.join(__dirname, '..', '..');
const { allSpecs, serve, step, ORIGIN } = require(path.join(ROOT, 'tools/parity/run.cjs'));

const CONDS = {
  small: { W: 320, H: 640, zoom: 1, extra: '' },
  z130: { W: 360, H: 800, zoom: 1.3, extra: '' },
  big130: { W: 360, H: 800, zoom: 1.3, extra: '&state=stretched' },
};
const KEYBOARD = 300;

/** The checks, in the page. */
function audit(narrow) {
  const W = innerWidth, out = [], MONEY = /\d{1,3}(,\d{3})+|\d{4,}/;
  const seen = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0' || a.getAttribute('aria-hidden') === 'true') return null; }
    return r;
  };
  const say = (el) => (el.innerText || el.getAttribute('aria-label') || el.className || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 50);
  if (document.documentElement.scrollWidth > W + 1) out.push(`page ${document.documentElement.scrollWidth} wide`);
  for (const el of document.querySelectorAll('#app *, body > [role] *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = seen(el);
    if (!r) continue;
    const cs = getComputedStyle(el), text = el.textContent.trim();
    // A money figure cut: one whose own letters run past what the element shows (a figure in a cut message preview is fine while it shows).
    // Not a chat's words: a figure inside what someone wrote is theirs, and the preview shows its start.
    if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1 && !el.closest('.ch-ell')) {
      const edge = r.right - parseFloat(cs.paddingRight) - 1;
      for (const n of el.childNodes) {
        if (n.nodeType !== 3) continue;
        for (const m of n.textContent.matchAll(new RegExp(MONEY.source, 'g'))) {
          const g = document.createRange(); g.setStart(n, m.index); g.setEnd(n, m.index + m[0].length);
          if (g.getBoundingClientRect().right > edge) out.push(`money cut: "${m[0]}" in "${text.slice(0, 40)}"`);
        }
      }
    }
    if (r.right > W + 1 || r.left < -1) {
      // A row that slides sideways, or a box on the screen that clips it on purpose (the heard words show their end), is fine.
      let slides = false;
      for (let a = el.parentElement; a && !slides; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === 'visible') continue;
        const q = a.getBoundingClientRect();
        slides = /(auto|scroll)/.test(ox) ? a.scrollWidth > a.clientWidth : q.left >= -1 && q.right <= W + 1;
      }
      if (!slides) out.push(`off the screen: "${text.slice(0, 40)}" (.${String(el.className || el.tagName).split(' ')[0]} in .${String(el.parentElement && el.parentElement.className).split(' ')[0]})`);
    }
  }
  const hit = (el, r) => {
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
    for (const pseudo of ['::before', '::after']) {
      const p = getComputedStyle(el, pseudo);
      if (p.content === 'none' || p.position !== 'absolute') continue;
      const px = (v) => (/px$/.test(v) ? parseFloat(v) : 0);
      x0 = Math.min(x0, r.left + px(p.left)); y0 = Math.min(y0, r.top + px(p.top)); x1 = Math.max(x1, r.right - px(p.right)); y1 = Math.max(y1, r.bottom - px(p.bottom));
    }
    // A field's target is the box it sits in: its label, or a field box of 44 (a search, the counter's find).
    const lab = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && (el.closest('label') || (el.parentElement && el.parentElement.getBoundingClientRect().height >= 43.5 ? el.parentElement : null));
    if (lab) { const q = lab.getBoundingClientRect(); x0 = Math.min(x0, q.left); y0 = Math.min(y0, q.top); x1 = Math.max(x1, q.right); y1 = Math.max(y1, q.bottom); }
    return { w: x1 - x0, h: y1 - y0 };
  };
  for (const el of document.querySelectorAll('#app button, #app a[href], #app [role=button], #app input:not([type=hidden]), #app textarea, [role=dialog] button')) {
    const r = seen(el);
    if (!r || r.bottom < 0 || r.top > innerHeight || el.disabled) continue;
    const h = hit(el, r);
    // Named exceptions (the lead's ruling, 5 Nov 2026), at 320 only, where seven or four segments in a row cannot
    // each be 44 across and keep their full height: Due's seven days (CU03), a promise's seven days (CU15) and an
    // aisle card's units (SL12). At 360 they are held to 44 like every other target (the z130 walk).
    // Add none without a ruling.
    if (narrow && h.h >= 43.5 && el.matches('.ow-week-d, .cu-pr-days button, .sl-card2-u button')) continue;
    if (h.w < 43.5 || h.h < 43.5) out.push(`small: "${say(el)}" ${Math.round(h.w)}×${Math.round(h.h)}`);
  }
  return out;
}

/** Scrolled to the end: does the last of the page clear the dock? */
function underDock() {
  const docks = [...document.querySelectorAll('.ow-dock:not(.inline), .ow-dockwrap')].filter((d) => getComputedStyle(d).position === 'fixed' && d.getBoundingClientRect().height > 20);
  if (!docks.length) return null;
  scrollTo(0, 1e6);
  document.querySelectorAll('*').forEach((el) => { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) el.scrollTop = 1e6; });
  const top = Math.min(...docks.map((d) => d.getBoundingClientRect().top));
  let last = null, bottom = 0;
  for (const el of document.querySelectorAll('#app button, #app a, #app [role=button], #app h2, #app p, #app span')) {
    if (docks.some((d) => d.contains(el))) continue;
    let fixed = false;
    for (let a = el; a && !fixed; a = a.parentElement) fixed = getComputedStyle(a).position === 'fixed';
    const r = el.getBoundingClientRect();
    if (fixed || r.height < 1) continue;
    if (r.bottom > bottom) { bottom = r.bottom; last = el; }
  }
  return bottom > top + 1 ? `under the dock: "${(last.innerText || '').replace(/\s+/g, ' ').slice(0, 40)}" ends at ${Math.round(bottom)}, the dock at ${Math.round(top)}` : null;
}

/** The field in focus, with the keyboard up: is it above the dock? */
function fieldCovered() {
  const f = document.activeElement;
  if (!f || !/^(INPUT|TEXTAREA)$/.test(f.tagName)) return null;
  const r = f.getBoundingClientRect(), at = document.elementFromPoint(Math.min(innerWidth - 2, r.left + r.width / 2), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)));
  if (r.bottom > innerHeight || r.top < 0) return `keyboard: the field "${f.getAttribute('aria-label') || f.placeholder}" is off the screen`;
  return at && at !== f && !f.contains(at) && !at.contains(f) && at.closest('.ow-dock, .ow-dockwrap') ? `keyboard: the field "${f.getAttribute('aria-label') || f.placeholder}" is under the dock` : null;
}

async function runOne(browser, spec, cond) {
  const ctx = await browser.newContext({ viewport: { width: cond.W, height: cond.H }, deviceScaleFactor: 1, hasTouch: true, ignoreHTTPSErrors: true });
  await serve(ctx);
  await ctx.addInitScript(phoneLike, [cond.zoom, 0]);
  const p = await ctx.newPage();
  const res = { board: spec.board, problems: [], reached: true };
  try {
    await p.goto(`${ORIGIN}/next/sales.html?demo${spec.demo || ''}${cond.extra}`, { waitUntil: 'load' });
    await p.locator('#app > *').first().waitFor({ timeout: 8000 });
    await p.waitForFunction(() => document.documentElement.dataset.tabs, null, { timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(400);
    for (const s of spec.steps || []) await Promise.race([step(p, s), new Promise((_r, no) => setTimeout(() => no(new Error('step timed out: ' + JSON.stringify(s).slice(0, 60))), 10000 + (typeof s.wait === 'number' ? s.wait : 0)))]);
    await p.waitForTimeout(300);
  } catch (e) { res.reached = false; res.stepError = String(e.message || e).split('\n')[0].slice(0, 120); }
  try {
    res.problems.push(...await p.evaluate(audit, cond.W < 360));
    const typing = await p.evaluate(() => !!document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName));
    if (typing) {
      await p.setViewportSize({ width: cond.W, height: cond.H - KEYBOARD });
      // The phone brings the field into view as the keyboard comes up.
      await p.evaluate(() => document.activeElement && document.activeElement.scrollIntoView({ block: 'nearest' }));
      await p.waitForTimeout(300);
      const c = await p.evaluate(fieldCovered);
      if (c) res.problems.push(c);
      await p.setViewportSize({ width: cond.W, height: cond.H });
      await p.waitForTimeout(200);
    }
    const u = await p.evaluate(underDock);
    if (u) res.problems.push(u);
  } catch (e) { res.problems.push('could not check: ' + String(e.message || e).split('\n')[0].slice(0, 120)); }
  await ctx.close();
  return res;
}

async function main() {
  const pw = L.loadPlaywright();
  if (!pw) { console.log('sales room: skipped (Playwright is not installed here)'); return 0; }
  const args = process.argv.slice(2);
  const conds = args[0] && CONDS[args[0]] ? [args[0]] : Object.keys(CONDS);
  const filt = args[0] && CONDS[args[0]] ? args[1] : args[0];
  const browser = await pw.chromium.launch({ ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}) });
  let bad = 0;
  for (const name of conds) {
    const cond = CONDS[name];
    const specs = allSpecs().filter((s) => s.tab !== 'parts' && (!filt || s.board.includes(filt)) && !(cond.extra && /state=/.test(s.demo || '')));
    const out = [];
    let i = 0;
    await Promise.all(Array.from({ length: 6 }, async () => { while (i < specs.length) { const s = specs[i++]; out.push(await runOne(browser, s, cond)); } }));
    out.sort((a, b) => a.board.localeCompare(b.board));
    const notReached = out.filter((r) => !r.reached);
    // Every board is reached at the canvas's sizes; under the stretched shop some names are not there to tap.
    // Named exception (the lead's ruling, 5 Nov 2026): at 320 × 640 the counter's "Sold most today" draws only the
    // rows that fit above the dock (KC01's rule; search finds every item), so a board reached by tapping a quick
    // row further down is not reached there. At 360 every board is reached.
    const quickRow = (r) => /"tap":"Add one /.test(r.stepError || '');
    const failedSteps = cond.extra ? [] : notReached.filter((r) => !(name === 'small' && quickRow(r)));
    const withProblems = out.filter((r) => r.problems.length);
    bad += withProblems.length + failedSteps.length;
    console.log(`\n${name}: ${out.length} screens · ${withProblems.length} with problems · ${notReached.length} not reached${cond.extra ? ' (stretched: allowed)' : ''}`);
    for (const r of failedSteps) console.log(`  x ${r.board}: not reached (${r.stepError})`);
    for (const r of withProblems) console.log(`  x ${r.board}: ${[...new Set(r.problems)].slice(0, 6).join(' · ')}`);
  }
  await browser.close();
  console.log(`\nsales room: ${bad ? bad + ' problems' : 'all clear'}`);
  return bad ? 1 : 0;
}

if (require.main === module) main().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
module.exports = { audit, underDock, fieldCovered, CONDS };
