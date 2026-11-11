#!/usr/bin/env node
'use strict';
/*
 * The Buyer app end to end, on the demo (buyer.html?demo; this test reads the built buyer.html): the canvas's
 * day driven by taps and slides, and every screen it passes through checked
 * at 360 px (no page error, no sideways scroll, every control at least 44 px,
 * no text under 11 px).
 *
 *   ask        morning: Ask on the row (WhatsApp opens), the no-WhatsApp sheet, Yes · same
 *   trip       midday: the trip in route order, the cash ask slide → On the trip
 *   handin     on the trip: Got it all, Undo (5 s), Got it all again, Short (36 of 40), Hand in → Handed in · Musa counts it in
 *   notfound   midday: Kiseka's Not found → Client waits
 *   nomatch    Suppliers: a search nobody sells → Ask Moses to find it
 *   suppliers  Back keeps the search, Ask again on the row, a double × pops one screen; offline: Sends later
 *
 * Needs Playwright with Chromium (the container has it). Run: node test/buyer-e2e.test.js
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_e) { console.log('skip: playwright is not installed'); process.exit(0); }

const t = createReporter('buyer e2e');
const PAGE = 'file://' + path.join(ROOT, 'buyer.html');

async function open(b, q) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 } });
  const p = await ctx.newPage();
  // WhatsApp opens in a new window: close it, as the phone would hand it to WhatsApp.
  ctx.on('page', (np) => { if (np !== p) np.close().catch(() => {}); });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(/wa\.me|api\.whatsapp\.com/, (r) => r.abort());
  await p.goto(PAGE + q);
  await p.waitForTimeout(900);
  const s = {
    p, errors,
    btn: (name) => p.getByRole('button', { name, exact: true }).or(p.getByRole('link', { name, exact: true })).first(),
    async tap(name) { await s.btn(name).click(); await p.waitForTimeout(600); await s.fit(name); },
    async slide(name) {
      const k = s.btn(name), bb = await k.boundingBox();
      await p.mouse.move(bb.x + 20, bb.y + bb.height / 2); await p.mouse.down();
      await p.mouse.move(bb.x + 340, bb.y + bb.height / 2, { steps: 12 }); await p.mouse.up();
      await p.waitForTimeout(900); await s.fit(name);
    },
    text: async () => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' '),
    /** The screen after a step fits the phone: no sideways scroll, targets at least 44 px, text at least 11 px. */
    async fit(step) {
      const r = await p.evaluate(() => {
        const wide = document.documentElement.scrollWidth > 361;
        const small = [...document.querySelectorAll('button, a[href], [role=button], input')].filter((e) => {
          const b = e.getBoundingClientRect(); if (!b.width || !e.offsetParent) return false;
          return b.height < 43.5 && !e.closest('[aria-hidden=true]');
        }).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30));
        const tiny = [...document.querySelectorAll('body *')].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 10.5).map((e) => e.textContent.trim().slice(0, 20));
        return { wide, small: [...new Set(small)], tiny: [...new Set(tiny)] };
      });
      if (r.wide) t.fail(`${step}: the screen scrolls sideways at 360 px`);
      if (r.small.length) small.add(r.small.join(' | '));
      if (r.tiny.length) t.fail(`${step}: text under 11 px: ${r.tiny.join(' | ')}`);
    },
  };
  return s;
}
const small = new Set();

(async () => {
  const b = await chromium.launch();
  try {
    /* ---- ask: one tap per supplier, one per answer ---- */
    let s = await open(b, '?demo');
    t.check((await s.text()).includes('Good morning, Denis'), 'Today greets Denis');
    await s.tap('Ask Namanve Sheets on WhatsApp, 3 lines');
    t.check(await s.btn('Namanve Sheets said yes, same price').isVisible(), 'asked Namanve: its reply is due on Today');
    await s.tap('Ask Nakawa Cement Depot, 1 line');
    t.check(await s.btn('Call Nakawa Cement Depot').isVisible(), 'Nakawa has no WhatsApp: the Ask sheet offers Call');
    await s.tap('Yes, same price: Found');
    await s.tap('Namanve Sheets said yes, same price');
    t.check((await s.text()).includes('2 of 5 suppliers found'), '2 of 5 suppliers found after two answers');
    t.check(!s.errors.length, `no page errors (ask) ${s.errors.join('; ')}`);

    /* ---- trip: route order and the cash ask ---- */
    s = await open(b, '?demo&state=midday');
    await s.tap('The trip, 3 stops to buy');
    for (const n of ['Stop 1, Nakawa Cement Depot, 1 line, 680,000', 'Stop 2, Owino Plumbing, 1 line, 540,000', 'Stop 3, Namanve Sheets, 2 lines, 2,280,000']) {
      t.check(await s.btn(n).isVisible(), n);
    }
    await s.slide('Send cash ask to Esther');
    t.check((await s.text()).includes('CASH IN HAND UGX 3,500,000'), 'the cash ask sent: On the trip with 3,500,000 in hand');
    t.check(!s.errors.length, `no page errors (trip) ${s.errors.join('; ')}`);

    /* ---- hand in: got it all, short 36 of 40, hand in ---- */
    s = await open(b, '?demo&state=trip');
    await s.tap('The trip, 3 stops to buy');
    await s.tap('Got it all at Nakawa Cement Depot');
    // The board's Success state: the stop done, its time, Undo for 5 s; Undo opens it again.
    t.check((await s.text()).includes('Got it all · 11:45'), 'Nakawa done: Got it all · 11:45');
    await s.p.getByRole('button', { name: /^Undo Nakawa Cement Depot/ }).click(); await s.p.waitForTimeout(700); await s.fit('Undo');
    t.check(await s.btn('Got it all at Nakawa Cement Depot').isVisible(), 'Undo: Nakawa is the stop now again');
    await s.tap('Got it all at Nakawa Cement Depot');
    await s.p.waitForTimeout(5600);
    t.check(!(await s.p.getByRole('button', { name: /^Undo Nakawa/ }).count()), 'after 5 s the Undo goes and Nakawa stays done');
    await s.tap('Got it all at Owino Plumbing');
    await s.tap('Short at Namanve Sheets');
    for (let i = 0; i < 4; i++) await s.tap('Fewer Iron sheet G28 for #0550');
    await s.tap('Done');
    let txt = await s.text();
    t.check(txt.includes('Short · got 36 of 40'), 'Grace sees: Short · got 36 of 40');
    t.check(txt.includes('3,348,000 paid of 3,500,000') && txt.includes('152,000'), 'paid 3,348,000 of 3,500,000 · 152,000 back');
    await s.slide('Hand in');
    txt = await s.text();
    t.check(txt.includes('Handed in · Musa counts it in') && txt.includes('Back to Today'), 'Handed in · Musa counts it in, then Back to Today');
    t.check(!s.errors.length, `no page errors (hand in) ${s.errors.join('; ')}`);

    /* ---- not found: the client waits, Moses finds it ---- */
    s = await open(b, '?demo&state=midday');
    t.check((await s.text()).includes('Kiseka said no · #0553'), 'Today: Kiseka said no · #0553 waits on Denis');
    await s.p.getByRole('button', { name: /^Y12 rebar 12 m not found for order 0553/ }).first().click();
    await s.p.waitForTimeout(600); await s.fit('Not found sheet');
    txt = await s.text();
    t.check(txt.includes('#0553') && /Client waits/.test(txt), 'the Not found sheet opens with Client waits');
    t.check(!s.errors.length, `no page errors (not found) ${s.errors.join('; ')}`);

    /* ---- no match: Ask Moses to find it ---- */
    s = await open(b, '?demo&state=midday');
    await s.tap('Suppliers');
    await s.p.getByRole('searchbox').or(s.p.getByRole('textbox')).first().fill('PVC pipe 6 in');
    await s.p.waitForTimeout(500);
    txt = await s.text();
    t.check(txt.includes('Nobody sells it'), 'a search nobody sells: Nobody sells it');
    await s.tap('Ask Moses to find it');
    t.check(!s.errors.length, `no page errors (no match) ${s.errors.join('; ')}`);

    /* ---- Suppliers: Back keeps the search; Ask again shows on the row; a double × pops one screen ---- */
    s = await open(b, '?demo&state=midday');
    await s.tap('Suppliers');
    const find = () => s.p.getByRole('searchbox').or(s.p.getByRole('textbox')).first();
    await find().fill('PVC pipe 6 in'); await s.p.waitForTimeout(400);
    await s.p.getByRole('button', { name: /^PVC pipe 4 in from/ }).first().click(); await s.p.waitForTimeout(400);
    await s.p.goBack(); await s.p.waitForTimeout(500);
    t.check((await find().inputValue()) === 'PVC pipe 6 in' && (await s.text()).includes('Nobody sells it'), 'Back from a close match keeps the search');
    await find().fill(''); await s.p.waitForTimeout(300);
    await s.tap('Ask Ndeeba Timber Works again on WhatsApp');
    txt = await s.text();
    t.check(/found 5 of 10/.test(txt) && /Brian sees: Asked · \d\d:\d\d/.test(txt) && !(await s.p.locator('.ow-toast').count()), 'Ask again: the row says Asked and Brian sees it, no toast over the title');
    await s.p.getByRole('button', { name: /^Katwe Fabricators/ }).first().click(); await s.p.waitForTimeout(400);
    await s.p.getByRole('button', { name: /Fix the price/ }).first().click(); await s.p.waitForTimeout(400);
    await s.p.getByRole('button', { name: 'Close', exact: true }).dblclick(); await s.p.waitForTimeout(700);
    t.check((await s.text()).includes('WhatsApp Katwe'), 'a double tap on the fix sheet × goes back one screen');
    t.check(!s.errors.length, `no page errors (suppliers) ${s.errors.join('; ')}`);

    /* ---- Suppliers offline: a kept ask says Sends later and cannot be sent twice; a kept number is not "Sent" ---- */
    s = await open(b, '?demo&state=midday&offline=1');
    await s.tap('Suppliers');
    await s.tap('Ask Ndeeba Timber Works again on WhatsApp');
    txt = await s.text();
    t.check(txt.includes('Sends later') && !(await s.p.getByRole('button', { name: /again on WhatsApp/ }).count()), 'offline Ask again: the row says Sends later, no second ask');
    t.check(txt.includes('No signal · saved on this phone') && !(await s.p.getByRole('button', { name: 'Try again' }).count()), 'the band, with no Try again');
    await s.p.getByRole('button', { name: /^Katwe Fabricators/ }).first().click(); await s.p.waitForTimeout(400);
    await s.p.getByRole('button', { name: /Fix the price/ }).first().click(); await s.p.waitForTimeout(400);
    await s.p.getByRole('tab', { name: 'Phone' }).click();
    await s.p.getByLabel(/New number/).fill('0782 554 019');
    await s.tap('Send to Moses');
    txt = await s.text();
    t.check(txt.includes('Sends later') && txt.includes('Moses sees it when back') && !txt.includes('Sent ·'), 'offline phone: Sends later, Moses sees it when back, never "Sent"');
    t.check(!s.errors.length, `no page errors (suppliers offline) ${s.errors.join('; ')}`);
  } finally { await b.close(); }
  if (small.size) console.log('\nUnder 44 px tall (recorded):\n  ' + [...small].join('\n  '));
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
