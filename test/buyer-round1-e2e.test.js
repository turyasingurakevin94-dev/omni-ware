#!/usr/bin/env node
'use strict';
/*
 * Buyer round 1 (docs/audit/buyer/ROUND-1.md) on the demo at 360 × 780, against the boards
 * R1CostPrice · R1WhoSees · R1NewPrice (docs/canvas/buyer):
 *
 *   BUY-02  the order and its row say Client pays and Cost; a new price leaves Client pays as it was
 *   BUY-04  "{Seller} sees: {word}" everywhere, never "Sales sees"; Replies' foot and the order agree
 *   BUY-05  a held order: "On hold · Cancel asked · Ruth decides", the On hold chip, counted in Ruth decides, lines "On hold"
 *   BUY-06  New price opens with the field focused; the head keeps Asked until the save lands
 *   BUY-07  2,700 for a 9,000 list warns "Far from the list (9,000) · check it" and says Save anyway; 9,500 does not
 *   BUY-08  a line with no selling price: "Price coming · Ruth prices it", "+ 1 price coming", never "sells 0"
 *   BUY-13  no struck text anywhere; the Not found sheet says what Sales sees only after a choice
 *
 * The demo is the canvas's shop; a held order and a line with no selling price are put in it here (the
 * books can hold both: saved_quotes cancel_asks and items[].priceAsk).
 *
 * This test reads the built buyer.html (the new app). Needs Playwright with Chromium. Run: node test/buyer-round1-e2e.test.js
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

let chromium;
try { ({ chromium } = require('playwright')); } catch (_e) { console.log('skip: playwright is not installed'); process.exit(0); }

const t = createReporter('buyer round 1 e2e');
const PAGE = 'file://' + path.join(ROOT, 'buyer.html');

/** The demo, with #0554 held (a cancel asked) and #0550's cement placed with no selling price. */
function shape() {
  let v;
  Object.defineProperty(window, 'owBuyerDemo', {
    configurable: true,
    get() { return v; },
    set(x) {
      v = { ...x, buyerDemo: (q, o) => {
        const d = x.buyerDemo(q, o), b = d.shop;
        const o554 = b.orders.find((y) => y.id === 554); if (o554) o554.hold = 'cancel';
        const o550 = b.orders.find((y) => y.id === 550); if (o550) Object.assign(o550.lines[1], { sell: 0, priceComing: true });
        return d;
      } };
    },
  });
}

async function open(b, q, shaped) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 } });
  const p = await ctx.newPage();
  ctx.on('page', (np) => { if (np !== p) np.close().catch(() => {}); });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route(/wa\.me|api\.whatsapp\.com/, (r) => r.abort());
  if (shaped) await p.addInitScript(shape);
  await p.goto(PAGE + q);
  await p.waitForTimeout(900);
  return {
    p, errors,
    btn: (name) => p.getByRole('button', { name, exact: true }).first(),
    async tap(name) { await p.getByRole('button', { name, exact: true }).first().click(); await p.waitForTimeout(600); },
    text: async () => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' '),
    /** No struck text on screen (BUY-13), no sideways scroll at 360 px. */
    async clean(step) {
      const r = await p.evaluate(() => ({
        struck: [...document.querySelectorAll('body *')].filter((e) => e.offsetParent && getComputedStyle(e).textDecorationLine.includes('line-through')).map((e) => e.textContent.trim().slice(0, 30)),
        wide: document.documentElement.scrollWidth > 361,
      }));
      t.check(!r.struck.length, `${step}: no struck text ${r.struck.join(' | ')}`);
      t.check(!r.wide, `${step}: no sideways scroll at 360 px`);
      t.check(!/sells 0\b/.test(await this.text()), `${step}: no "sells 0"`);
    },
  };
}

(async () => {
  const b = await chromium.launch();
  try {
    /* ---- BUY-02 · BUY-04: #0552 in Checking and its sheet ---- */
    let s = await open(b, '?demo&state=midday', true);
    await s.tap('To ask: none');
    let txt = await s.text();
    t.check(/Mukono Roofing.*CLIENT PAYS 1,210,000 Cost 1,030,000/.test(txt), 'BUY-02: the row says Client pays 1,210,000 and Cost 1,030,000');
    await s.clean('Checking');
    await s.tap('Mukono Roofing, #0552: open');
    txt = await s.text();
    t.check(/CLIENT PAYS 1,210,000 UGX COST 1,030,000/.test(txt), 'BUY-02: the order head: Client pays 1,210,000, Cost 1,030,000');
    t.check(txt.includes('10 pcs × 27,000 · was 24,000'), 'BUY-13: the old cost reads "was 24,000"');
    t.check(!txt.includes('Sales sees') && /Faith sees: Found/.test(txt) && /Faith sees: Price up/.test(txt), 'BUY-04: every line says "Faith sees: …", never "Sales sees"');
    t.check(/Faith sees: Price up · Ruth decides/.test(txt), 'BUY-04: the order card: Faith sees: Price up · Ruth decides');
    await s.clean('#0552');
    await s.p.screenshot({ path: path.join(require('os').tmpdir(), 'buyer-r1-0552.png') }).catch(() => {});

    await s.p.goBack(); await s.p.waitForTimeout(500);
    txt = await s.text();
    const ruthChip = /Ruth decides (\d+)/.exec(txt);
    t.check(ruthChip && ruthChip[1] === '2', `BUY-05: Ruth decides counts #0552 and the held #0554 (${ruthChip && ruthChip[1]})`);

    /* ---- BUY-05: #0554 on hold ---- */
    await s.p.getByRole('button', { name: /^On hold 1/ }).first().click(); await s.p.waitForTimeout(400);
    txt = await s.text();
    t.check(txt.includes('Lubowa Builders') && txt.includes('On hold · Cancel asked') && !txt.includes('Mukono Roofing'), 'BUY-05: the On hold chip shows #0554, On hold · Cancel asked');
    await s.tap('Lubowa Builders, #0554: open');
    txt = await s.text();
    t.check(txt.includes('On hold · Cancel asked · Ruth decides'), 'BUY-05: the banner: On hold · Cancel asked · Ruth decides');
    t.check(/Brian sees: On hold/.test(txt) && !txt.includes('Needs a supplier'), 'BUY-05: its line: Brian sees: On hold');
    await s.clean('#0554');
    await s.p.screenshot({ path: path.join(require('os').tmpdir(), 'buyer-r1-0554.png') }).catch(() => {});
    t.check(!s.errors.length, `no page errors (orders) ${s.errors.join('; ')}`);

    /* ---- BUY-08: #0550's cement has no selling price (the morning: #0550 still in Checking) ---- */
    s = await open(b, '?demo', true);
    await s.p.getByRole('button', { name: /^To ask: / }).first().click(); await s.p.waitForTimeout(500);
    await s.tap('Kato Construction, #0550: open');
    txt = await s.text();
    t.check(/CLIENT PAYS 1,900,000 UGX \+ 1 price coming COST 2,200,000/.test(txt), 'BUY-08: Client pays 1,900,000 + 1 price coming, Cost 2,200,000');
    t.check(txt.includes('Price coming · Ruth prices it') && !txt.includes('Ruth decides'), 'BUY-08: Price coming · Ruth prices it, never Ruth decides');
    t.check(/Grace sees: To ask/.test(txt) && !txt.includes('Sales sees'), 'BUY-04: the order card: Grace sees: To ask');
    await s.clean('#0550');
    await s.p.screenshot({ path: path.join(require('os').tmpdir(), 'buyer-r1-0550.png') }).catch(() => {});
    t.check(!s.errors.length, `no page errors (price coming) ${s.errors.join('; ')}`);

    /* ---- BUY-13: the Not found sheet says what Sales sees only after a choice ---- */
    s = await open(b, '?demo&state=midday');
    await s.p.getByRole('button', { name: /^Y12 rebar 12 m not found for order 0553/ }).first().click();
    await s.p.waitForTimeout(600);
    txt = (await s.p.locator('.ow-b-orders-nfs').innerText()).replace(/\s+/g, ' ');
    t.check(txt.includes('Slide to remove') && !/sees:/.test(txt), 'BUY-13: no choice yet, no "Grace sees" on the sheet');
    t.check(/client pays 52,500/.test(txt), 'BUY-02: the other supplier is drawn against what the client pays');
    await s.clean('Not found');
    await s.p.screenshot({ path: path.join(require('os').tmpdir(), 'buyer-r1-notfound.png') }).catch(() => {});

    /* ---- BUY-06 · BUY-07 · BUY-02: New price for Ndeeba (Timber 2×4, list 9,000) ---- */
    s = await open(b, '?demo&state=midday');
    await s.p.getByRole('button', { name: /^Asked: / }).first().click(); await s.p.waitForTimeout(500);
    txt = await s.text();
    t.check(/Brian sees: Asked #0554/.test(txt) || /Brian sees: Asked/.test(txt), 'BUY-04: Replies foot: "Brian sees: Asked" (no chip without a name)');
    t.check(await s.btn('Answered, 4').count() || await s.p.getByRole('button', { name: /^Answered, \d+$/ }).count(), 'BUY-15: the Answered row has a name');
    const t0 = Date.now();
    await s.p.getByRole('button', { name: 'New price: Ndeeba Timber Works', exact: true }).click();
    await s.p.waitForSelector('input[aria-label^="New price for Timber 2×4"]', { timeout: 2000 });
    const focused = await s.p.evaluate(() => (document.activeElement && document.activeElement.getAttribute('aria-label')) || '');
    t.check(focused.startsWith('New price for Timber 2×4'), `BUY-06: the field is focused at once (${focused}, ${Date.now() - t0} ms)`);
    txt = await s.text();
    t.check(/Ndeeba Timber Works Asked · 10:40/.test(txt) && /List 9,000/.test(txt) && txt.includes('Type their price'), 'BUY-06: the head says Asked · 10:40, List 9,000, Type their price');
    await s.p.keyboard.type('2700'); await s.p.waitForTimeout(200);
    txt = await s.text();
    t.check(txt.includes('Far from the list (9,000) · check it') && await s.btn('Save anyway').isVisible(), 'BUY-07: 2,700 for 9,000: Far from the list (9,000) · check it, Save anyway');
    t.check(/Ndeeba Timber Works Asked · 10:40/.test(txt) && /Brian sees: Asked/.test(txt), 'BUY-06: typing changes nothing in the head or what Brian sees');
    await s.clean('New price · far');
    await s.p.screenshot({ path: path.join(require('os').tmpdir(), 'buyer-r1-far.png') }).catch(() => {});
    await s.p.getByLabel(/^New price for Timber 2×4/).fill('9500'); await s.p.waitForTimeout(200);
    txt = await s.text();
    t.check(!txt.includes('Far from the list') && await s.btn('Save').isVisible(), 'BUY-07: 9,500 for 9,000: no warning, Save');
    await s.tap('Save');
    await s.p.waitForTimeout(500);
    txt = await s.text();
    t.check(/#0554 Buying/.test(txt) && /BO Brian sees: Buying #0554/.test(txt), 'the answer lands on Replies: #0554 Buying, and the foot says Brian sees: Buying');
    await s.p.getByRole('button', { name: /^Answered, \d+$/ }).first().click(); await s.p.waitForTimeout(300);
    await s.p.getByRole('button', { name: /^Ndeeba Timber Works: Found/ }).first().click(); await s.p.waitForTimeout(600);
    txt = await s.text();
    t.check(/Lubowa Builders.*CLIENT PAYS 575,000 UGX COST 475,000/.test(txt), 'BUY-02: after the new price #0554 Client pays is still 575,000, the Cost 475,000');
    t.check(/was 9,000/.test(txt) && /Brian sees: Buying/.test(txt), 'BUY-13 · BUY-04: "was 9,000"; the order says Brian sees: Buying, as Replies does');
    await s.clean('#0554 after the new price');
    t.check(!s.errors.length, `no page errors (new price) ${s.errors.join('; ')}`);

    /* ---- BUY-07 on the price list: Fix ---- */
    s = await open(b, '?demo&state=midday');
    await s.p.getByRole('button', { name: 'Suppliers', exact: true }).or(s.p.getByRole('link', { name: 'Suppliers', exact: true })).first().click(); await s.p.waitForTimeout(600);
    await s.p.getByRole('button', { name: /^Katwe Fabricators/ }).first().click(); await s.p.waitForTimeout(400);
    await s.p.getByRole('button', { name: /Fix the price/ }).first().click(); await s.p.waitForTimeout(400);
    await s.p.getByLabel('Their price now').fill('4100'); await s.p.waitForTimeout(200);
    txt = await s.text();
    t.check(/Far from the list \(41,000\) · check it/.test(txt) && await s.btn('Save anyway').isVisible(), 'BUY-07: Fix: 4,100 for 41,000 warns, Save anyway');
    await s.p.screenshot({ path: path.join(require('os').tmpdir(), 'buyer-r1-fix.png') }).catch(() => {});
    await s.p.getByLabel('Their price now').fill('43500'); await s.p.waitForTimeout(200);
    t.check(!(await s.text()).includes('Far from the list'), 'BUY-07: Fix: 43,500 does not');
    t.check(!s.errors.length, `no page errors (fix) ${s.errors.join('; ')}`);
  } finally { await b.close(); }
  process.exit(t.done() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
