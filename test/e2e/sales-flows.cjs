#!/usr/bin/env node
'use strict';
/*
 * The Sales app end to end: every main flow on next/sales.html?demo, from Today, by real taps
 * (a slide is a real drag), at 360 × 800, with zero console errors.
 *
 *   npm run e2e:sales                      (after npm run build:sales)
 *   npm run e2e:sales -- sell chats        only the flows named
 *
 * Flows (FACTS: docs/canvas/sales-agent/FACTS.md; tap paths reuse test/parity/<tab>.json):
 *   sell            red + → Kato → an aisle and a search → slide → Placed #0558 → in Orders
 *   counter-cash    Counter → 2 items → 60,000 cash → Sold, change 8,000 → receipt
 *   counter-mobile  Counter → 2 items → Mobile with its transaction ID → Sold
 *   pay             Today's to collect → Take → 150,000 cash → Paid; owed drops by exactly 150,000
 *   pay-offline     &offline=1: the payment is kept on the phone, not taken off what is owed
 *   tell-today      Today's Tell them → Send to Kato → Kato's new price is told
 *   tell-order      an order's Tell (OR10 on #0552, OR11 on #0556) → sent → told; #0559's paper (OR35) → sent → told
 *   chats           reply to Kato; the new number (CH14) → Take → Start order → the item once → placed
 *   give            Kato's chat → Give to Brian with a note → the handover shows
 *   wrong-return    #0548 Fix it (OR20) → items coming back (OR21) → asked Ruth → shows as asked
 *   wrong-pay       #0533 Fix it (OR24) → the cash payment should be Mobile 124,000 (OR25) → asked Esther → shows as asked
 *
 * Every flow also fails on any console error or pageerror, and on any screen wider than the
 * phone (scrollWidth > clientWidth). Buttons and links under 44 × 44 are listed, not failed.
 * A failure is a finding: never soften a check to get green (CLAUDE.md, the rebuild).
 */
const fs = require('fs');
const path = require('path');
const L = require('./lib.cjs');
const S = require('./flows-sell.cjs');
const M = require('./flows-money.cjs');
const T = require('./flows-talk.cjs');
const X = require('./flows-wrong.cjs');

const FLOWS = {
  sell: S.sell,
  'counter-cash': S.counterCash,
  'counter-mobile': S.counterMobile,
  pay: M.takePayment,
  'pay-offline': M.takePaymentOffline,
  'tell-today': T.tellToday,
  'tell-order': T.tellOrder,
  chats: T.chats,
  give: T.give,
  'wrong-return': X.wrongReturn,
  'wrong-pay': X.wrongPay,
};
const PARALLEL = 4;

async function runOne(browser, base, name) {
  const rec = L.newRecord(name);
  const t0 = Date.now();
  const opened = [];
  const open = async (flags) => { const ph = await L.phone(browser, base, rec, flags); opened.push(ph); return ph; };
  try {
    await FLOWS[name](open);
  } catch (e) {
    rec.ok = false;
    rec.failures.push('stopped: ' + String(e.message || e).split('\n')[0]);
  }
  for (const ph of opened) await ph.ctx.close().catch(() => {});
  if (rec.errors.length) { rec.ok = false; rec.failures.push(...rec.errors.map((e) => 'console/page error: ' + e)); }
  rec.ms = Date.now() - t0;
  return rec;
}

function report(recs) {
  const out = [];
  for (const r of recs) {
    out.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.checks.filter((c) => c.ok).length}/${r.checks.length} checks, ${r.screens} screens, ${(r.ms / 1000).toFixed(1)} s)`);
    for (const f of r.failures) out.push(`        x ${f}`);
    for (const n of r.notes) out.push(`        note: ${n}`);
  }
  const small = new Map();
  for (const r of recs) for (const s of r.small) {
    const k = `${s.name} · ${s.w}×${s.h}`;
    if (!small.has(k)) small.set(k, { ...s, flows: new Set() });
    small.get(k).flows.add(r.name);
  }
  out.push('', `Under 44 × 44 (${small.size} distinct; recorded, not failed):`);
  for (const [k, s] of [...small].sort()) out.push(`  - ${k}  (.${s.cls || '?'}; first at ${s.at}; in ${[...s.flows].join(', ')})`);
  const wide = recs.flatMap((r) => r.wide.map((w) => `${r.name}: ${w}`));
  out.push('', `Wider than 360 (${wide.length}):`, ...wide.map((w) => '  - ' + w));
  return out.join('\n');
}

async function main() {
  const pw = L.loadPlaywright();
  if (!pw) { console.log('sales e2e: skipped (Playwright is not installed here)'); return 0; }
  if (!fs.existsSync(path.join(L.ROOT, 'next/sales.html'))) { console.error('sales e2e: next/sales.html is missing (npm run build:sales)'); return 1; }
  const pick = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const unknown = pick.filter((n) => !FLOWS[n]);
  if (unknown.length) { console.error('sales e2e: no such flow: ' + unknown.join(', ') + '\n  flows: ' + Object.keys(FLOWS).join(', ')); return 1; }
  const names = pick.length ? pick : Object.keys(FLOWS);
  const srv = await L.serve();
  const browser = await pw.chromium.launch();
  const t0 = Date.now();
  const recs = [];
  try {
    const queue = names.slice();
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      while (queue.length) { const n = queue.shift(); recs.push(await runOne(browser, srv.url, n)); }
    }));
  } finally {
    await browser.close();
    await srv.close();
  }
  recs.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
  console.log(report(recs));
  const failed = recs.filter((r) => !r.ok);
  console.log(`\nsales e2e: ${recs.length - failed.length} of ${recs.length} flows passed in ${((Date.now() - t0) / 1000).toFixed(1)} s${failed.length ? ' · failed: ' + failed.map((r) => r.name).join(', ') : ''}`);
  if (process.env.E2E_JSON) fs.writeFileSync(process.env.E2E_JSON, JSON.stringify(recs, null, 2));
  return failed.length ? 1 : 0;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
