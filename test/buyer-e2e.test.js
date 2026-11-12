#!/usr/bin/env node
'use strict';
/*
 * The Buyer app end to end, on the demo (buyer.html?demo; this test reads the built buyer.html): the canvas's
 * day driven by taps and slides, and every screen it passes through checked
 * at 360 px (no page error, no sideways scroll, every control at least 44 px,
 * no text under 11 px).
 *
 *   ask        morning: Ask on the row (WhatsApp opens), the no-WhatsApp sheet, Yes · same
 *   history    To ask › an order › Ask › New price › Save, 5 times: still on buyer.html, history.state is the screen (BUY-01)
 *   you        the avatar opens You, Sign out; the start shows Opening… on the navy head (BUY-14)
 *   undo       a toast's Undo outlasts 5 s and goes on the next tap after 10 s (BUY-10)
 *   trip       midday: the trip in route order, the cash ask slide → On the trip
 *   handin     on the trip: Got it all, Undo (5 s), Got it all again, Short (36 of 40), all done (Undo, cash back), Hand in → Handed in
 *   paid       paid 650,000 at Nakawa: #0550 2,018,000, the orders add up to what was paid
 *   offline    stops saved on the phone count as done; Hand in saves on the phone
 *   off        a stop off the plan: Today's figure follows
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
    // Board Today phone 1: while a supplier is still to ask, the ask comes first: no trip card, no badge on Found.
    let txt = await s.text();
    t.check(!txt.includes('NEXT MOVE'), 'one still to ask: no Next move trip card yet');
    t.check(!(await s.p.getByRole('button', { name: /^Found: .*waits on you/ }).count()), 'one still to ask: Found waits on nobody');
    t.check(/Grace · Faith see Found · \d\d:\d\d/.test(txt), 'Grace · Faith see Found under Today (no trip card in its place)');

    /* ---- history (BUY-01): screens and sheets in and out 5 times, still on buyer.html, history.state = the screen ---- */
    s = await open(b, '?demo');
    const at = async (id, depth, sheet, step) => {
      const h = await s.p.evaluate(() => ({ url: location.pathname, st: history.state }));
      const ok = /buyer\.html$/.test(h.url) && h.st && h.st.id === id && h.st.depth === depth && h.st.sheet === sheet;
      if (!ok) t.fail(`history ${step}: wanted ${id}/${depth}${sheet ? '+sheet' : ''}, got ${h.url} ${JSON.stringify(h.st)}`);
      return ok;
    };
    let fine = true;
    const price = async () => {
      await s.p.locator('input').first().fill('40000'); await s.p.waitForTimeout(200);
      await s.p.getByRole('button', { name: /^Save/ }).first().click(); await s.p.waitForTimeout(700);
    };
    for (let i = 0; i < 5; i++) {
      await s.p.getByRole('button', { name: /^To ask: / }).click(); await s.p.waitForTimeout(500);
      fine = (await at('orders', 2, false, `${i} To ask`)) && fine;
      await s.p.getByRole('button', { name: /: open$/ }).first().click(); await s.p.waitForTimeout(500);
      fine = (await at('orders/order', 3, false, `${i} an order`)) && fine;
      await s.p.goBack(); await s.p.waitForTimeout(500);
      fine = (await at('orders', 2, false, `${i} Back from the order`)) && fine;
      const ask = s.p.getByRole('button', { name: /^Ask .+/ }).first(), who = ((await ask.getAttribute('aria-label')) || (await ask.textContent())).replace(/^Ask /, '').trim();
      await ask.click(); await s.p.waitForTimeout(600);
      if (await s.btn('Call Nakawa Cement Depot').count()) {
        fine = (await at('orders', 2, true, `${i} the Ask sheet`)) && fine;
        await s.p.getByRole('button', { name: /^New price/ }).click(); await s.p.waitForTimeout(500);
        fine = (await at('replies/price', 3, false, `${i} New price from the sheet`)) && fine;
        await price();
        fine = (await at('orders', 2, false, `${i} saved`)) && fine;
        await s.tap('Back to Today');
      } else {
        await s.tap('Back to Today');
        await s.p.getByLabel(/suppliers found\. Open Replies/).click(); await s.p.waitForTimeout(500);
        await s.p.getByRole('button', { name: `New price: ${who}` }).click(); await s.p.waitForTimeout(500);
        fine = (await at('replies/price', 3, false, `${i} New price for ${who}`)) && fine;
        await price();
        fine = (await at('replies', 2, false, `${i} saved`)) && fine;
        await s.p.getByRole('button', { name: /^Back to Today/ }).first().click(); await s.p.waitForTimeout(500);
      }
      fine = (await at('today', 1, false, `${i} Today`)) && fine;
    }
    t.check(fine, 'Today › To ask › an order › Ask › New price › Save, 5 times: on buyer.html, history.state is the screen');
    await s.p.goBack(); await s.p.waitForTimeout(500);
    t.check((await at('today', 1, false, 'Back on Today')) && (await s.text()).includes('Good morning, Denis'), 'Back on Today stays in the app');
    t.check(!s.errors.length, `no page errors (history) ${s.errors.join('; ')}`);
    // Not found: the sheet's entry, Back closes only the sheet; Other item takes the sheet's entry; Client waits pops it.
    s = await open(b, '?demo&state=midday');
    await s.p.getByRole('button', { name: /^To ask/ }).click(); await s.p.waitForTimeout(500);
    await s.tap('Ggaba Stores, #0553: open');
    const nf = () => s.p.getByRole('button', { name: /^Y12 rebar 12 m: not found/ }).first().click().then(() => s.p.waitForTimeout(600));
    await nf();
    fine = await at('orders/order', 3, true, 'Not found sheet');
    await s.p.goBack(); await s.p.waitForTimeout(500);
    fine = (await at('orders/order', 3, false, 'Back closes the sheet')) && !(await s.p.getByRole('button', { name: 'Client waits' }).count()) && fine;
    await nf(); await s.tap('Other item');
    fine = (await at('orders/switch', 4, false, 'Other item')) && fine;
    await s.p.goBack(); await s.p.waitForTimeout(500);
    fine = (await at('orders/order', 3, false, 'Back from Other item')) && fine;
    await nf(); await s.tap('Client waits');
    fine = (await at('orders/order', 3, false, 'Client waits')) && fine;
    t.check(fine, 'Not found: Back closes the sheet; Other item and Client waits leave history.state on the screen');
    t.check(!s.errors.length, `no page errors (history, Not found) ${s.errors.join('; ')}`);

    /* ---- You and the start (BUY-14): the avatar opens You; Sign out lands on the sign-in; never a blank start ---- */
    s = await open(b, '?demo');
    await s.tap('Denis, you');
    txt = await s.text();
    t.check(/Denis Okello Buyer · Mukasa Hardware/.test(txt) && /Role Buyer/.test(txt) && /Shop Mukasa Hardware/.test(txt) && /Pushes on this phone (On|Off)/.test(txt), 'the avatar opens You: name, role, shop, pushes');
    await s.p.goBack(); await s.p.waitForTimeout(400);
    t.check(!(await s.btn('Sign out').count()) && (await at('today', 1, false, 'Back closes You')), 'Back closes You and stays on Today');
    await s.tap('Denis, you'); await s.tap('Sign out');
    t.check(await s.p.getByRole('button', { name: 'Sign in' }).isVisible(), 'Sign out lands on the sign-in page');
    {
      const ctx = await b.newContext({ viewport: { width: 360, height: 780 } }), p = await ctx.newPage();
      await p.route(/buyer-demo\.js/, async (r) => { await new Promise((ok) => setTimeout(ok, 2000)); await r.continue(); });
      await p.goto(PAGE + '?demo', { waitUntil: 'commit' });
      await p.waitForTimeout(250);
      t.check(/Opening…/.test(await p.evaluate(() => document.body.innerText)) && await p.locator('.ow-b-today-hero').isVisible(), 'the start: the navy head says Opening… at once, never blank');
      await p.waitForTimeout(2600);
      await p.goto(PAGE + '?demo', { waitUntil: 'commit' }); await p.waitForTimeout(250);
      t.check(/Opening…[\s\S]*TO BUY TODAY/.test(await p.evaluate(() => document.body.innerText)), 'the next start: the copy kept on this phone shows under Opening…');
      await ctx.close();
    }

    /* ---- Undo (BUY-10): a toast's Undo is still there after 5 s, and goes on the next tap after 10 s ---- */
    s = await open(b, '?demo&state=midday');
    await s.p.getByRole('button', { name: /^Y12 rebar 12 m not found for order 0553/ }).first().click(); await s.p.waitForTimeout(600);
    await s.p.getByRole('button', { name: /^Switch to / }).first().click();
    await s.p.waitForTimeout(5600);
    const undoBtn = s.p.locator('.ow-toast').getByRole('button', { name: 'Undo' });
    t.check(await undoBtn.isVisible(), 'Switch to another supplier: its Undo is still on screen after 5 s');
    await s.p.waitForTimeout(5000);
    t.check(await undoBtn.isVisible(), 'after 10 s the Undo stays until the next tap');
    await s.p.mouse.click(180, 400); await s.p.waitForTimeout(300);
    t.check(!(await undoBtn.count()), 'the next tap: the Undo goes');

    /* ---- Today: who sees an ask, a kept ask, the Ask sheet's Not found ---- */
    s = await open(b, '?demo');
    await s.tap('Ask Namanve Sheets on WhatsApp, 3 lines');
    txt = await s.text();
    t.check(txt.includes('Grace · Faith see Asked') && !/Brian[^.]*see Asked/.test(txt), 'asked Namanve: Grace and Faith see Asked, not Brian (his order is still to ask)');
    s = await open(b, '?demo&offline=1');
    await s.tap('Ask Namanve Sheets on WhatsApp, 3 lines');
    t.check(!(await s.btn('Ask Namanve Sheets on WhatsApp, 3 lines').count()) && (await s.text()).includes('Waiting'), 'no signal: the asked row waits, no second Ask');
    t.check((await s.text()).includes('No signal · 1 tap waits to send') && !(await s.btn('Try again').count()), 'no signal: 1 tap waits, no Try again');
    s = await open(b, '?demo');
    await s.tap('Ask Nakawa Cement Depot, 1 line');
    await s.p.getByRole('button', { name: /^Not found: / }).click();
    await s.p.waitForTimeout(700);
    t.check(/Cement 50 kg 20 bag × 34,000.*Client waits/.test(await s.text()), 'Ask sheet Not found: the Not found sheet opens, as Replies "No" does');

    /* ---- Orders: the way in and the chip ---- */
    s = await open(b, '?demo&state=midday');
    await s.tap('To ask: none');
    txt = await s.text();
    t.check(/All 3 Asked/.test(txt) && !txt.includes('Nothing to ask'), 'nothing to ask: the tile opens Orders on All (no To ask chip)');
    await s.p.getByRole('button', { name: /^Not found 1/ }).first().click(); await s.p.waitForTimeout(500);
    await s.tap('Ggaba Stores, #0553: open');
    await s.p.goBack(); await s.p.waitForTimeout(600);
    txt = await s.text();
    t.check(txt.includes('Ggaba Stores') && !txt.includes('Lubowa Builders'), 'back from an order: the Not found chip is still chosen');
    t.check(!s.errors.length, `no page errors (orders) ${s.errors.join('; ')}`);

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
    // Stop 3 in full above the dock (nothing under it).
    const room = await s.p.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((e) => e.getAttribute('aria-label') === 'Short at Namanve Sheets');
      const dock = document.querySelector('.ow-dock, [class*=dock]');
      return btn && dock ? btn.getBoundingClientRect().bottom <= dock.getBoundingClientRect().top + 1 : false;
    });
    t.check(room, 'stop 3: Got it all and Short sit above the dock');
    await s.tap('Short at Namanve Sheets');
    for (let i = 0; i < 4; i++) await s.tap('Fewer Iron sheet G28 for #0550');
    await s.tap('Done');
    txt = await s.text();
    // TripOn phone 4: every stop done, the last one's Undo, the cash back, the Hand in slide.
    t.check(txt.includes('CASH BACK TO ESTHER UGX 152,000') && /Undo \d/.test(txt), 'all stops done: cash back 152,000 and Undo on the last stop');
    await s.p.waitForTimeout(5600);
    txt = await s.text();
    t.check(txt.includes('Short · got 36 of 40'), 'Grace sees: Short · got 36 of 40');
    t.check(txt.includes('3,348,000 paid of 3,500,000') && txt.includes('152,000'), 'paid 3,348,000 of 3,500,000 · 152,000 back');
    await s.slide('Hand in');
    txt = await s.text();
    t.check(txt.includes('Musa counts it in') && txt.includes('Cash back') && txt.includes('Back to Today') && !txt.includes('Told'), 'Handed in: Musa counts it in, Esther\'s cash back, then Back to Today');
    const end = await s.btn('Back to Today').boundingBox();
    t.check(end && end.y + end.height <= 780, 'Back to Today in view without scrolling');
    t.check(!s.errors.length, `no page errors (hand in) ${s.errors.join('; ')}`);

    /* ---- paid differently: every order's figure from what was really paid ---- */
    s = await open(b, '?demo&state=trip');
    await s.tap('The trip, 3 stops to buy');
    await s.p.getByRole('button', { name: /^Pay 680,000/ }).click(); await s.p.waitForTimeout(400);
    await s.p.getByRole('textbox', { name: /^Paid at Nakawa/ }).fill('650000'); await s.p.waitForTimeout(300);
    await s.tap('Done');
    await s.tap('Got it all at Owino Plumbing');
    await s.tap('Short at Namanve Sheets');
    for (let i = 0; i < 4; i++) await s.tap('Fewer Iron sheet G28 for #0550');
    await s.tap('Done');
    await s.p.waitForTimeout(5600);
    txt = await s.text();
    t.check(txt.includes('Kato Construction 2,018,000 of 2,200,000') && txt.includes('3,318,000 paid of 3,500,000'), 'Hand in: #0550 2,018,000 of 2,200,000, the orders add up to 3,318,000 paid');

    /* ---- offline: stops save on the phone, the money still adds up, Hand in still goes ---- */
    s = await open(b, '?demo&state=trip&offline=1');
    await s.tap('The trip, 3 stops to buy');
    await s.tap('Got it all at Nakawa Cement Depot');
    await s.tap('Got it all at Owino Plumbing');
    txt = await s.text();
    t.check(txt.includes('CASH IN HAND UGX 2,280,000') && txt.includes('Got it all · sends when back'), 'offline: in hand 2,280,000, Got it all · sends when back');
    await s.tap('Got it all at Namanve Sheets');
    await s.slide('Hand in');
    txt = await s.text();
    t.check(txt.includes('Saved on this phone') && txt.includes('Waiting to send 3,500,000'), 'offline hand in: Saved on this phone · Waiting to send 3,500,000');
    t.check(!s.errors.length, `no page errors (offline trip) ${s.errors.join('; ')}`);

    /* ---- a stop off: Today reads the Plan's figure ---- */
    s = await open(b, '?demo&state=midday');
    await s.tap('The trip, 3 stops to buy');
    t.check((await s.text()).includes('Faith sees: Price up · Ruth decides'), 'Plan: the held Ridge cap shows on the closed Namanve stop');
    await s.tap('Stop 2, Owino Plumbing, 1 line, 540,000');
    await s.tap('Take Owino Plumbing off this trip');
    await s.tap('Close the trip');
    txt = await s.text();
    t.check(txt.includes('TO BUY TODAY › 2,960,000') && await s.btn('The trip, 2 stops to buy').isVisible(), 'Owino off: Today says 2,960,000 and 2 stops');

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
