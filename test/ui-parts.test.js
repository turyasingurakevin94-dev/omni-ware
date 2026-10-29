#!/usr/bin/env node
'use strict';
/*
 * The shared parts act, not only look (src/ui/README.md): on
 * next/sales.html?demo&parts=try (src/ui/gallery/Try.tsx) this drives the
 * live parts the way a finger and a keyboard do:
 *   - the slide: a tap without a drag asks for the slide; a short drag
 *     springs back; a full drag commits, says "Sending…", and the toast's
 *     Undo undoes it; a keyboard press commits;
 *   - a light sheet opens and a pull down past a third closes it;
 *   - a full sheet goes back by its 40 px strip;
 *   - the stepper counts, the keypad types, chips and methods choose,
 *     the composer sends.
 * It also checks, on both parts boards (?demo&parts=main|main2), that every
 * control is at least 44 px and has a name, and no text is under 11 px.
 *
 * Playwright is on the session machines, not in CI's install-free `npm
 * test`: there this test says it skipped (the parity run is the session's).
 *   NODE_PATH=$(npm root -g) node test/ui-parts.test.js
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('ui parts');
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (_e) { chromium = null; }
const ORIGIN = 'http://omni.local';

async function open(browser, q, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true });
  await ctx.route(`${ORIGIN}/**`, (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, '');
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'not found' });
    return r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: f.endsWith('.html') ? 'text/html' : 'text/javascript' });
  });
  await ctx.route('**/*.googleapis.com/**', (r) => r.abort());
  await ctx.route('**/supabase-js@**', (r) => r.abort());
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${ORIGIN}/next/sales.html?demo&parts=${q}`);
  await p.locator('#app > *').first().waitFor({ timeout: 8000 });
  return { ctx, p, errors };
}

const logOf = (p) => p.locator('#log').innerText();

async function drag(p, dx) {
  const k = await p.getByLabel('Place this order').boundingBox();
  await p.mouse.move(k.x + 25, k.y + 25);
  await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(k.x + 25 + (dx * i) / 8, k.y + 25);
  await p.mouse.up();
}

/** A finger pulling an element down by dy (touch events, as a phone sends them). */
async function pull(p, sel, dy) {
  await p.evaluate(async ({ sel, dy }) => {
    const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 20;
    const touch = (yy) => new Touch({ identifier: 1, target: el, clientX: x, clientY: yy });
    el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(y)], bubbles: true, cancelable: true }));
    // Slowly, as a finger does (a quick flick closes it whatever the distance).
    for (let i = 1; i <= 6; i++) { await new Promise((ok) => setTimeout(ok, 60)); el.dispatchEvent(new TouchEvent('touchmove', { touches: [touch(y + (dy * i) / 6)], bubbles: true, cancelable: true })); }
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true, cancelable: true }));
  }, { sel, dy });
  await p.waitForTimeout(350);
}

async function tryParts(browser) {
  const { ctx, p, errors } = await open(browser, 'try', { width: 360, height: 800 });
  // The slide.
  await p.getByLabel('Place this order').click({ position: { x: 25, y: 25 }, delay: 30, force: true });
  await p.waitForTimeout(100);
  t.check((await logOf(p)).includes('hint'), 'a tap on the knob without a slide asks for the slide');
  await drag(p, 90);
  await p.waitForTimeout(400);
  t.check(!(await logOf(p)).includes('placed 1'), 'a short slide springs back and places nothing');
  await drag(p, 300);
  await p.waitForTimeout(80);
  t.check((await p.locator('.ow-slide-l').innerText()) === 'Sending…', 'a full slide commits: "Sending…"');
  await p.waitForTimeout(400);
  t.check((await logOf(p)).includes('placed 1'), 'and the order is placed');
  t.check(await p.getByText('Placed #0558').isVisible(), 'the toast says so');
  const undo = p.getByRole('button', { name: 'Undo' });
  const ub = await undo.boundingBox();
  t.check(ub && ub.height >= 44, `Undo is 44 px tall (${ub && ub.height})`);
  await undo.click();
  t.check((await logOf(p)).includes('undone 0'), "the toast's Undo undoes it");
  await p.waitForTimeout(300);
  await p.getByLabel('Place this order').focus();
  await p.keyboard.press('Enter');
  await p.waitForTimeout(450);
  t.check((await logOf(p)).includes('placed 1'), 'a keyboard press commits the slide too');
  // The light sheet: open, then pull down past a third.
  await p.getByRole('button', { name: 'Open a sheet' }).click();
  t.check(await p.getByRole('dialog', { name: 'Who is it for?' }).isVisible(), 'a light sheet opens');
  await pull(p, '.ow-sheet', 80);
  t.check(await p.getByRole('dialog').isVisible(), 'a short pull springs it back');
  await pull(p, '.ow-sheet', 320);
  t.check((await p.getByRole('dialog').count()) === 0 && (await logOf(p)).includes('sheet closed'), 'a pull past a third closes it');
  // The full sheet and its back strip.
  await p.getByRole('button', { name: 'Open one order' }).click();
  const strip = await p.getByLabel('Back to Orders').boundingBox();
  t.check(strip && Math.round(strip.height) === 40 && strip.y === 0, 'a full sheet leaves a 40 px strip at the top');
  await p.getByLabel('Back to Orders').click();
  t.check((await logOf(p)).includes('order closed') && !(await p.getByLabel('Back to Orders').count()), 'the strip goes back');
  // The rest.
  await p.getByRole('button', { name: 'More iron sheets' }).click();
  t.check((await logOf(p)).includes('qty 41'), 'the stepper counts');
  for (const k of ['1', '2']) await p.locator('.ow-key', { hasText: new RegExp(`^${k}$`) }).click();
  await p.getByRole('button', { name: 'Delete' }).click();
  t.check((await logOf(p)).includes('typed 3651'), 'the keypad types and deletes');
  await p.getByRole('radio', { name: 'Mobile' }).click();
  t.check((await logOf(p)).includes('method momo') && (await p.getByRole('radio', { name: 'Mobile' }).getAttribute('aria-checked')) === 'true', 'the method picker chooses');
  await p.getByRole('button', { name: 'checking' }).click();
  t.check((await p.getByRole('button', { name: 'checking' }).getAttribute('aria-pressed')) === 'true', 'a filter chip is pressed');
  await p.getByRole('radio', { name: 'Delivery' }).click();
  t.check((await logOf(p)).includes('mode delivery'), 'Pickup · Delivery switches');
  await p.getByLabel('Message Kato Construction').fill('Hello Kato');
  await p.keyboard.press('Enter');
  t.check((await logOf(p)).includes('sent Hello Kato'), 'the composer sends on Enter');
  t.check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

/** Every control on a board: a name, at least 44 × 44 (or a 44 px row); no text under 11 px. */
async function audit(browser, which, size) {
  const { ctx, p, errors } = await open(browser, which, size);
  const r = await p.evaluate(() => {
    const small = [], unnamed = [], tiny = [];
    document.querySelectorAll('a, button, input, [role=radio]').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (el.matches('input[type=radio]')) return;
      const name = el.getAttribute('aria-label') || el.textContent.trim() || (el.labels && el.labels[0] && el.labels[0].textContent.trim());
      if (!name) unnamed.push(el.outerHTML.slice(0, 80));
      if (b.height < 44 && !el.closest('label') && !el.matches('.ow-grab')) small.push(`${el.textContent.trim() || el.getAttribute('aria-label')} ${Math.round(b.width)}×${Math.round(b.height)}`);
    });
    const walk = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue;
      const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (fs < 11) tiny.push(`${n.textContent.trim()} ${fs}px`);
    }
    return { small, unnamed, tiny };
  });
  t.check(r.unnamed.length === 0, `${which}: every control has a name${r.unnamed.length ? ': ' + r.unnamed.join(' | ') : ''}`);
  t.check(r.small.length === 0, `${which}: every tap target is at least 44 px tall${r.small.length ? ': ' + r.small.join(', ') : ''}`);
  t.check(r.tiny.length === 0, `${which}: no text under 11 px${r.tiny.length ? ': ' + r.tiny.join(', ') : ''}`);
  t.check(errors.length === 0, `${which}: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  if (!chromium) {
    console.log('  (skipped: Playwright is not installed here; run it in a session: NODE_PATH=$(npm root -g) node test/ui-parts.test.js)');
    process.exit(t.done() ? 1 : 0);
  }
  const browser = await chromium.launch();
  try {
    await tryParts(browser);
    await audit(browser, 'main', { width: 1600, height: 1600 });
    await audit(browser, 'main2', { width: 1600, height: 1000 });
  } finally {
    await browser.close();
  }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
