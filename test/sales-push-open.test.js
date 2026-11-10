#!/usr/bin/env node
'use strict';
/*
 * A tapped push opens its page (docs/spec/06-offline-sync-push.md Q8, "Open from the copy, refresh
 * behind"; the map is src/apps/sales/shell/pushes.ts, paired by test/sales-push-routes.test.js). On
 * next/sales.html?demo, a push for an order, a chat and a customer each lands on its screen, with no
 * console error, and Back lands on the list it lives in:
 *   - the demo's tap: ?demo&push=<kind>&<key>=<value>;
 *   - with no signal (&offline=1): the page still opens, from the copy;
 *   - the web's tap: the address the service worker opens (#push=…), read once;
 *   - the phone app's tap: Capacitor's pushNotificationActionPerformed, on an app already open, closes
 *     the open sheet and opens the page with no reload.
 *
 * Playwright is on the session machines, not in CI's install-free `npm test`: there this test says it
 * skipped. Run: node test/sales-push-open.test.js   (after npm run build:sales)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales push open');
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (_e) { chromium = null; }
const ORIGIN = 'http://omni.local';

/** A fake phone app: Capacitor with PushNotifications, its tap handler kept for the test to call. */
const NATIVE = () => {
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: { PushNotifications: { addListener: (e, fn) => { if (e === 'pushNotificationActionPerformed') window.__owTap = fn; return { remove() {} }; } } },
  };
};

async function open(browser, address, init) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1, hasTouch: true });
  await ctx.route(`${ORIGIN}/**`, (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, '');
    const f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: 'not found' });
    return r.fulfill({ status: 200, body: fs.readFileSync(f), contentType: f.endsWith('.html') ? 'text/html' : 'text/javascript' });
  });
  // No network here: the fonts and supabase-js answer empty, so nothing fails on the way.
  await ctx.route('**/*.googleapis.com/**', (r) => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  await ctx.route('**/*.gstatic.com/**', (r) => r.fulfill({ status: 200, body: '' }));
  await ctx.route('**/supabase-js@**', (r) => r.fulfill({ status: 200, body: '', contentType: 'text/javascript' }));
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${ORIGIN}/next/sales.html${address}`);
  await p.locator('#app > *').first().waitFor({ timeout: 8000 });
  return { ctx, p, errors };
}

const text = (p) => p.locator('#app').innerText();
/** The screen on top: a full sheet says what Back goes to. */
const backTo = async (p) => { const b = p.locator('.ow-full-back'); return (await b.count()) ? b.last().getAttribute('aria-label') : null; };

const CASES = [
  { name: 'an order (order.invoiced #0552)', q: 'push=order.invoiced&table=saved_quotes&id=552&orderId=552', back: 'Back to Orders', see: ['#0552', 'Kato'], list: 'Orders' },
  { name: 'a chat (chat.handed, Kato)', q: 'push=chat.handed&table=wa_conversations&id=101', back: 'Back to Chats', see: ['Kato'], list: 'Chats' },
  { name: 'a customer (customer.changed, Kato Construction)', q: 'push=customer.changed&table=customers&id=C001', back: 'Back to Customers', see: ['Kato Construction'], list: 'Customers' },
];

/** On its screen: the full sheet whose Back goes to its list, with what the push is about. */
async function lands(p, c, how) {
  await p.locator(`.ow-full-back[aria-label="${c.back}"]`).waitFor({ timeout: 8000 });
  await p.waitForTimeout(250);
  const s = await text(p);
  t.check(c.see.every((x) => s.includes(x)), `${how} ${c.name}: on its screen (${c.see.join(', ')})${c.see.every((x) => s.includes(x)) ? '' : ': ' + s.slice(0, 160).replace(/\s+/g, ' ')}`);
}

async function main(browser) {
  for (const c of CASES) {
    // The demo's tap, then Back: the list it lives in, its tab lit.
    let { ctx, p, errors } = await open(browser, `?demo&${c.q}`);
    await lands(p, c, 'demo tap:');
    await p.locator('.ow-full-back').last().click();
    await p.waitForTimeout(300);
    const lit = await p.locator('[aria-current="page"], [aria-selected="true"]').allInnerTexts();
    t.check((await backTo(p)) === null && lit.join(' ').includes(c.list), `demo tap: ${c.name}: Back lands on ${c.list} (${lit.join(', ') || 'no tab lit'})`);
    t.check(errors.length === 0, `demo tap: ${c.name}: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();

    // No signal: opened from the copy.
    ({ ctx, p, errors } = await open(browser, `?demo&offline=1&${c.q}`));
    await lands(p, c, 'no signal:');
    t.check(errors.length === 0, `no signal: ${c.name}: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  // The web's tap: the page the service worker opens, #push=…; read once (the address loses it).
  let { ctx, p, errors } = await open(browser, `?demo#${CASES[1].q}`);
  await lands(p, CASES[1], 'web tap:');
  t.check(!(await p.evaluate(() => location.hash)), 'web tap: the #push=… is taken off the address, so a reload does not open it again');
  t.check(errors.length === 0, `web tap: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();

  // The phone app's tap, on an app already open with a sheet up: no reload, the sheet closes, the page opens.
  ({ ctx, p, errors } = await open(browser, '?demo', NATIVE));
  await p.waitForTimeout(400);
  t.check(await p.evaluate(() => typeof window.__owTap === 'function'), 'phone tap: the app listens for pushNotificationActionPerformed');
  await p.evaluate(() => { window.__owStill = 1; });
  for (const c of CASES) {
    const d = Object.fromEntries(new URLSearchParams(c.q));
    d.kind = d.push; delete d.push;
    await p.evaluate((data) => window.__owTap({ actionId: 'tap', notification: { data } }), d);
    await lands(p, c, 'phone tap:');
    if (c === CASES[0]) {
      // A sheet up over the order (Tell them): the next tap closes it.
      await p.getByText(/^Tell /).first().click();
      await p.locator('.ow-sheet[role=dialog]').waitFor({ timeout: 4000 });
    }
  }
  t.check((await p.locator('.ow-sheet[role=dialog]').count()) === 0, 'phone tap: the sheet that was up is closed');
  t.check(await p.evaluate(() => window.__owStill === 1), 'phone tap: opened with no reload');
  await p.evaluate(() => window.__owTap({ actionId: 'tap', notification: { data: { kind: 'price.waits', orderId: '552' } } }));
  await p.waitForTimeout(200);
  t.check((await backTo(p)) === 'Back to Customers', 'phone tap: a kind Sales has no page for leaves the app where it is');
  t.check(errors.length === 0, `phone tap: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  if (!chromium) {
    console.log('  (skipped: Playwright is not installed here; run it in a session: node test/sales-push-open.test.js)');
    process.exit(t.done() ? 1 : 0);
  }
  if (!fs.existsSync(path.join(ROOT, 'next/sales.html'))) { t.fail('next/sales.html is built (npm run build:sales)'); process.exit(t.done() ? 1 : 0); }
  const browser = await chromium.launch();
  try { await main(browser); } finally { await browser.close(); }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
