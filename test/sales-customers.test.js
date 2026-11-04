#!/usr/bin/env node
'use strict';
/*
 * The Customers tab works, not only looks (boards CU01–CU43): on
 * next/sales.html?demo it taps from Today the way a finger does and checks
 * what each flow writes and where it lands:
 *   - Take payment, cash, all of it, from the list's row: Paid, owes now 0,
 *     the receipt sent; the list then has 3 who owe;
 *   - Mobile with no transaction ID: the slide waits (Q6);
 *   - change and deposit: what is recorded (420,000 and 430,000);
 *   - a promise to pay is recorded; a bill being checked goes to Esther; Message Esther is a team note;
 *   - a new customer from the newest unsaved chat is added; a number
 *     already saved is caught and opens that customer;
 *   - no signal: the payment is kept on the phone;
 *   - every control on the main screens has a name and a 44 px target,
 *     and no text is under 11 px.
 *
 * Playwright is on the session machines, not in CI's install-free `npm
 * test`: there this test says it skipped (the parity run is the session's).
 *   NODE_PATH=$(npm root -g) node test/sales-customers.test.js      (after npm run build:sales)
 */
const fs = require('fs');
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('sales customers');
let chromium = null;
try { ({ chromium } = require('playwright')); } catch (_e) { chromium = null; }
const ORIGIN = 'http://omni.local';

async function open(browser, flags = '') {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1, hasTouch: true });
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
  await p.goto(`${ORIGIN}/next/sales.html?demo${flags}`);
  await p.locator('#app > *').first().waitFor({ timeout: 8000 });
  await p.getByLabel('Customers', { exact: true }).or(p.getByText('Customers', { exact: true })).first().click();
  await p.waitForTimeout(200);
  return { ctx, p, errors };
}

const text = (p) => p.locator('#app').innerText();
const toastText = async (p) => { await p.waitForTimeout(400); return (await p.locator('[role=status], [role=alert]').allInnerTexts()).join(' | '); };

/** The slide from the keyboard: focus its knob, press Enter (as a screen reader or a keyboard does). */
async function slide(p) {
  await p.locator('.ow-knob').focus();
  await p.keyboard.press('Enter');
  await p.getByText('Back to Today').waitFor({ timeout: 4000 });
}

async function flows(browser) {
  let { ctx, p, errors } = await open(browser);
  // Take a full cash payment from the row.
  await p.getByLabel('Take payment from Kato Construction').click();
  await p.waitForTimeout(200);
  t.check((await p.getByLabel('Amount Kato pays now').inputValue()) === '420,000', 'pay: all of it is prefilled (420,000)');
  t.check((await p.locator('.ow-slide-l').innerText()) === 'Slide to record 420,000', 'pay: the slide says what it records');
  await slide(p);
  await p.waitForTimeout(500);
  let s = await text(p);
  t.check(/Paid/.test(s) && /Owes now/.test(s) && /Cash/.test(s), 'pay: Paid, with the slip and how they paid');
  t.check(/Receipt sent to Kato/.test(s), 'pay: the receipt went to Kato on WhatsApp');
  await p.getByText('Back to Today').click();
  await p.getByText('Customers', { exact: true }).last().click();
  await p.waitForTimeout(300);
  s = await text(p);
  t.check(/3 owe/.test(s) && /1,490,000/.test(s), 'pay: the list now has 3 who owe, 1,490,000');
  await ctx.close();

  ({ ctx, p, errors } = await open(browser));
  await p.getByLabel('Take payment from Kato Construction').click();
  await p.getByRole('radio', { name: 'Mobile' }).click();
  t.check(await p.getByText('Mobile needs its transaction ID').isVisible(), 'mobile: the ID is asked for');
  t.check((await p.locator('.ow-knob').count()) === 0 && /Type the transaction ID/.test(await text(p)), 'mobile: the slide waits for the ID');
  await p.getByLabel('Transaction ID').fill('12046113570');
  t.check((await p.locator('.ow-knob').count()) === 1, 'mobile: with the ID the slide can go');
  await p.getByRole('radio', { name: 'Cash' }).click();
  await p.getByRole('radio', { name: '430,000' }).click();
  t.check(/10,000 change/.test(await text(p)), 'cash over: 10,000 change');
  t.check((await p.locator('.ow-slide-l').innerText()) === 'Slide to record 420,000', 'cash over, change: records 420,000');
  await p.getByRole('radio', { name: 'Deposit' }).click();
  t.check((await p.locator('.ow-slide-l').innerText()) === 'Slide to record 430,000', 'cash over, deposit: records 430,000');
  await slide(p);
  s = await text(p);
  t.check(/Deposit/.test(s) && /Kato said keep 10,000/.test(s), 'deposit: on the slip, and said on Paid');
  await ctx.close();

  ({ ctx, p, errors } = await open(browser));
  await p.getByText('Kato Construction', { exact: true }).first().click();
  await p.getByText('Promise', { exact: true }).click();
  t.check(/Fri 23 Oct · in 6 days/.test(await text(p)) || /Fri 23 Oct · in 6 days/.test(await p.locator('.ow-sheet').innerText()), 'promise: the hold day is prefilled');
  await p.getByRole('button', { name: 'Record the promise' }).click();
  t.check(/Promise recorded · Fri 23 Oct/.test(await toastText(p)), 'promise: recorded');
  await p.locator('.ow-shead-x').click();
  await p.waitForTimeout(300);
  await p.getByText('Ggaba Stores', { exact: true }).first().click();
  await p.getByText('#0528 · paid already?').click();
  await p.getByRole('button', { name: 'Send to Esther' }).click();
  t.check(/Sent to Esther/.test(await toastText(p)), 'bill being checked: sent to Esther');
  await ctx.close();

  ({ ctx, p, errors } = await open(browser));
  await p.getByText('Lubowa Builders', { exact: true }).first().click();
  await p.getByRole('button', { name: 'Message Esther', exact: true }).click();
  t.check(/Esther gets a push/.test(await toastText(p)), 'being checked: Message Esther puts a team note on their chat that mentions Esther');
  await ctx.close();

  ({ ctx, p, errors } = await open(browser));
  await p.locator('input[aria-label="Find a customer"]').fill('Nansana');
  await p.getByText('Nansana Hardware', { exact: true }).first().click();
  let s16 = await text(p);
  t.check(/Paid 560,000/.test(s16) && /90,000 paid over/.test(s16) && /No limit set · Ruth decides/.test(s16) && /last order today 10:02/.test(s16), 'nothing owed: today\'s money, the over, her credit, the last order (not the copy)');
  await p.getByLabel('Order #0557, the copy, Packing').click();
  await p.waitForTimeout(300);
  t.check(/Entered twice\?/.test(await text(p)) || await p.getByText('Entered twice?').count() > 0, 'nothing owed: the copy #0557 opens Entered twice? (OR19)');
  await ctx.close();

  ({ ctx, p, errors } = await open(browser));
  await p.getByLabel('New customer').first().click();
  await p.getByText('From their chat · 10:37').click();
  t.check((await p.locator('input[aria-label=Name]').inputValue()) === 'Mama Shine', 'new: filled from their chat');
  await p.getByRole('button', { name: 'Just add' }).click();
  t.check(/Mama Shine added/.test(await toastText(p)), 'new: added');
  await p.getByRole('button', { name: /^All/ }).click();
  t.check(/Everyone39/.test((await text(p)).replace(/\s/g, '')), 'new: the list has 39');
  await p.getByLabel('New customer').first().click();
  await p.locator('input[aria-label="Phone number after +256"]').fill('772 418 220');
  t.check(/This number is already Kato Construction/.test(await text(p)), 'new: a number already saved is caught');
  await p.getByRole('button', { name: 'It’s Kato' }).click();
  await p.waitForTimeout(300);
  t.check(/Kato Construction/.test(await text(p)) && /Order usual/.test(await text(p)), 'new: It’s Kato opens Kato');
  t.check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();

  ({ ctx, p, errors } = await open(browser, '&offline=1'));
  t.check(/No signal · the list saved 7:52/.test(await text(p)), 'offline: the saved list says when');
  await p.getByLabel('Take payment from Kato Construction').click();
  await slide(p);
  let k = await text(p);
  t.check(/Not sent yet/.test(k) && /Once it records/.test(k) && !/Owes now/.test(k), 'offline: Not sent yet, and nothing says it is owed 0 before it records');
  t.check(/The receipt goes to Kato once it records/.test(k), 'offline: the receipt waits for the payment');
  await p.getByRole('button', { name: 'Try again' }).click();
  t.check(/Still no signal/.test(await toastText(p)), 'offline: Try again with no signal says so');
  await ctx.close();

  // CU46: kept, then refused (Brian took 120,000 meanwhile); Throw it away with Undo; Fix it as change.
  ({ ctx, p, errors } = await open(browser, '&fail=pay'));
  await p.getByLabel('Take payment from Kato Construction').click();
  await slide(p);
  await p.getByRole('button', { name: 'Try again' }).click();
  await p.waitForTimeout(700);
  k = await text(p);
  t.check(/Not recorded/.test(k) && /The shop said no/.test(k) && /more than they owe/.test(k), 'refused: Not recorded, with the shop\'s reason');
  t.check(/Brian took 120,000 at 10:50/.test(k) && /so Kato owes 300,000 now/.test(k) && /Also on Today · Not sent/.test(k), 'refused: why, with what the books say now');
  t.check((await p.locator('.ow-end-bar:visible').count()) === 0, 'refused: no countdown, an error never leaves by itself');
  await p.getByRole('button', { name: 'Throw it away' }).click();
  k = await text(p);
  t.check(/Thrown away/.test(await toastText(p)) && /Still owes/.test(k) && /300,000/.test(k) && !/The shop said no/.test(k), 'thrown away: Not recorded, still owes 300,000 (the books), and an Undo');
  await p.getByRole('button', { name: 'Undo' }).click();
  t.check(/The shop said no/.test(await text(p)), 'Undo: the refused payment is back');
  await p.getByRole('button', { name: 'Fix it' }).click();
  await p.waitForTimeout(300);
  k = await text(p);
  t.check(/Give change/.test(k) && /Deposit/.test(k) && /120,000/.test(k), 'Fix it: Take payment again, 120,000 over: Give change or Deposit');
  t.check((await p.getByLabel('Amount Kato pays now').inputValue()) === '300,000' && (await p.getByRole('radio', { name: '420,000' }).getAttribute('aria-checked')) === 'true',
    'Fix it opens as CU35: All 300,000, they gave the kept 420,000');
  t.check(/pays now\s*300,000/.test(await p.locator('.cu-gave-h').innerText()), 'Fix it: pays now 300,000 (payPlan toDebt)');
  await slide(p).catch(() => {});
  await p.waitForTimeout(800);
  k = await text(p);
  t.check(/Paid/.test(k) && !/Not recorded/.test(k) && /120,000/.test(k), 'fixed: it goes, with 120,000 change');
  t.check(errors.length === 0, `refused: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();

  // Kept with no signal, then refused (&fail=pay): the screen it ends on, ready for Fix it or Throw it away.
  const refusedKato = async (how) => {
    const r = await open(browser, '&fail=pay');
    await r.p.getByLabel('Take payment from Kato Construction').click();
    if (how === 'momo') {
      await r.p.getByRole('radio', { name: 'Mobile' }).click();
      await r.p.getByLabel('Transaction ID').fill('12046113570');
    }
    await slide(r.p);
    await r.p.getByRole('button', { name: 'Try again' }).click();
    await r.p.waitForTimeout(700);
    return r;
  };

  // Fix it by Mobile: a cash payment refused, sent again by Mobile with its ID; Paid says Mobile and the ID, never Cash.
  ({ ctx, p, errors } = await refusedKato('cash'));
  await p.getByRole('button', { name: 'Fix it' }).click();
  await p.getByRole('radio', { name: 'Mobile' }).click();
  await p.getByLabel('Transaction ID').fill('12049988776');
  await slide(p).catch(() => {});
  await p.waitForTimeout(800);
  k = await text(p);
  t.check(/Paid/.test(k) && /Mobile · ID 1204…8776/.test(k) && !/\bCash\b/.test(k), 'Fix it by Mobile: Paid says Mobile with its ID');
  await ctx.close();

  // Fix it by Bank: the same, by Bank with its reference.
  ({ ctx, p, errors } = await refusedKato('cash'));
  await p.getByRole('button', { name: 'Fix it' }).click();
  await p.getByRole('radio', { name: 'Bank' }).click();
  await p.getByLabel('Bank reference').fill('STB 99120');
  await slide(p).catch(() => {});
  await p.waitForTimeout(800);
  k = await text(p);
  t.check(/Paid/.test(k) && /Bank · ref STB 99120/.test(k) && !/\bCash\b/.test(k), 'Fix it by Bank: Paid says Bank with its reference');
  await ctx.close();

  // A Mobile payment refused, fixed as it was: 300,000 to the books, 120,000 change; they sent 420,000.
  ({ ctx, p, errors } = await refusedKato('momo'));
  await p.getByRole('button', { name: 'Fix it' }).click();
  await p.waitForTimeout(300);
  await slide(p).catch(() => {});
  await p.waitForTimeout(800);
  k = await text(p);
  t.check(/Mobile · ID/.test(k) && /they sent\s*420,000/.test(k) && !/they gave/.test(k), 'Fix it, Mobile kept: they sent 420,000, the change is 120,000');
  await ctx.close();

  // Take it again (CU47): opens as Fix it does, with the 420,000 she still holds as what they gave.
  ({ ctx, p, errors } = await refusedKato('cash'));
  await p.getByRole('button', { name: 'Throw it away' }).click();
  await p.getByRole('button', { name: 'Take it again' }).click();
  await p.waitForTimeout(300);
  t.check((await p.getByLabel('Amount Kato pays now').inputValue()) === '300,000' && (await p.getByRole('radio', { name: '420,000' }).getAttribute('aria-checked')) === 'true',
    'Take it again: All 300,000, they gave the 420,000 she holds');
  const tn = await toastNow(p);
  t.check(!tn || !/Thrown away/.test(tn), 'Take it again: the Thrown away Undo closes when Paid is left');
  t.check(/Give change/.test(await text(p)) && /120,000/.test(await text(p)), 'Take it again: Give change 120,000');
  await ctx.close();

  // New customer for a typed number with no chat: the newest unknown chat (Mama Shine) is not offered for it.
  ({ ctx, p, errors } = await open(browser));
  await p.locator('input[aria-label="Find a customer"]').fill('0772 999 111');
  await p.getByText('Someone new', { exact: true }).click();
  await p.waitForTimeout(300);
  k = await p.locator('.ow-sheet').innerText();
  t.check(!/Mama Shine/.test(k) && !/From their chat/.test(k), 'new: a typed number with no chat does not fill from another chat');
  t.check((await p.locator('input[aria-label="Phone number after +256"]').inputValue()).replace(/\D/g, '') === '772999111', 'new: the typed number is the phone');
  await ctx.close();

  // SL30 / Today "Take 1.1M": Mukono's bills (780,000) and the live #0551 held for the money (320,000), in one payment.
  ({ ctx, p, errors } = await open(browser));
  await p.getByText('Today', { exact: true }).last().click().catch(() => {});
  await p.locator(':is(a,button):has-text("Not paid yet")').first().click();
  await p.waitForTimeout(400);
  k = await text(p);
  t.check(/#0551/.test(k) && /the order · not paid yet/.test(k) && /Slide to record 1,100,000/.test(k), 'held order: #0551 is offered with the bills, 1,100,000 in all');
  await slide(p);
  await p.waitForTimeout(500);
  k = await text(p);
  t.check(/Paid/.test(k) && /1,100,000/.test(k) && /#0551/.test(k) && /#0532/.test(k), 'held order: Paid 1,100,000, #0532 and #0551 on the slip');
  await p.getByText('Back to Today').click();
  await p.waitForTimeout(400);
  t.check(!/#0551 · Not paid yet/.test(await text(p)), 'held order: #0551 is paid, so it no longer waits on Today');
  await p.getByText('Customers', { exact: true }).last().click();
  await p.waitForTimeout(300);
  t.check(/3 owe/.test(await text(p)), 'held order: Mukono\'s bills are cleared (3 owe)');
  await ctx.close();

  // Paid over by Mobile (CU41's path): 500,000 sent for 420,000 owed; they sent 500,000, 80,000 change.
  ({ ctx, p, errors } = await open(browser));
  await p.getByLabel('Take payment from Kato Construction').click();
  await p.getByRole('radio', { name: 'Mobile' }).click();
  await p.getByLabel('Amount Kato pays now').fill('500000');
  await p.getByLabel('Transaction ID').fill('12046113570');
  await slide(p).catch(() => {});
  await p.waitForTimeout(800);
  k = await text(p);
  t.check(/they sent\s*500,000/.test(k) && /80,000/.test(k) && !/they gave/.test(k), 'Mobile paid over: they sent 500,000, 80,000 change');
  await ctx.close();
}

/** The toast showing now, or null. */
async function toastNow(p) {
  const el = p.locator('[role=status]');
  return (await el.count()) ? el.first().innerText() : null;
}

/** Every control: a name, at least 44 px tall; no text under 11 px. */
async function audit(browser, name, steps) {
  const { ctx, p, errors } = await open(browser);
  for (const s of steps) { await s(p); await p.waitForTimeout(250); }
  const r = await p.evaluate(() => {
    const small = [], unnamed = [], tiny = [];
    document.querySelectorAll('#app a, #app button, #app input').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (!b.width || el.closest('.ow-tabbar, nav[aria-label=Main]')) return;
      const n = el.getAttribute('aria-label') || el.textContent.trim() || el.getAttribute('placeholder') || (el.labels && el.labels[0] && el.labels[0].textContent.trim());
      if (!n) unnamed.push(el.outerHTML.slice(0, 80));
      if (b.height < 44 && !el.closest('label') && !el.matches('.ow-grab, .ow-full-back') && el.tagName !== 'INPUT') small.push(`${(el.textContent.trim() || el.getAttribute('aria-label') || '').slice(0, 24)} ${Math.round(b.height)}`);
    });
    const walk = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue;
      const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (fs < 11) tiny.push(`${n.textContent.trim()} ${fs}px`);
    }
    return { small, unnamed, tiny };
  });
  t.check(r.unnamed.length === 0, `${name}: every control has a name${r.unnamed.length ? ': ' + r.unnamed.join(' | ') : ''}`);
  t.check(r.small.length === 0, `${name}: every tap target is at least 44 px${r.small.length ? ': ' + r.small.join(', ') : ''}`);
  t.check(r.tiny.length === 0, `${name}: no text under 11 px${r.tiny.length ? ': ' + r.tiny.join(', ') : ''}`);
  t.check(errors.length === 0, `${name}: no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  if (!chromium) {
    console.log('  (skipped: Playwright is not installed here; run it in a session: NODE_PATH=$(npm root -g) node test/sales-customers.test.js)');
    process.exit(t.done() ? 1 : 0);
  }
  if (!fs.existsSync(path.join(ROOT, 'next/sales.html'))) { t.fail('next/sales.html is built (npm run build:sales)'); process.exit(t.done() ? 1 : 0); }
  const browser = await chromium.launch();
  try {
    await flows(browser);
    await audit(browser, 'the list', []);
    await audit(browser, 'Due', [(p) => p.locator('div[role=group][aria-label=Show] button').nth(1).click()]);
    await audit(browser, 'All', [(p) => p.locator('div[role=group][aria-label=Show] button').nth(3).click()]);
    await audit(browser, 'Kato', [(p) => p.getByText('Kato Construction', { exact: true }).first().click()]);
    await audit(browser, 'Take payment', [(p) => p.getByLabel('Take payment from Kato Construction').click()]);
    await audit(browser, 'New customer', [(p) => p.getByLabel('New customer').first().click()]);
  } finally {
    await browser.close();
  }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
