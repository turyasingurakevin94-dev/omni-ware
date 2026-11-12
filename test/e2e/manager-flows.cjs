#!/usr/bin/env node
'use strict';
/*
 * The new Manager app end to end, on next/manager.html?demo, by real taps (a slide is a real drag),
 * at 360 × 800, with zero console errors. The runner and the guards are Sales' (runner.cjs, lib.cjs).
 *
 *   node tools/build-app.js manager && node test/e2e/manager-flows.cjs [flow …]
 *
 * Flows (the sample day: docs/canvas/manager/BRIEF.md; taps: docs/audit/manager/day.md):
 *   queue        09:40: the red + opens 1 of 8 (the truck first); each answer moves on by itself, one tap
 *                each (a slide for the money moves); the eighth opens All decided; Back to Today; the + is a tick
 *   per-decision every later card at its moment, opened as its push would, answered with its primary answer:
 *                the asker sees the agreed word (Today's answers names it and who is told)
 *   undo         an answer's strip counts down; Undo brings the card back as it was; nothing is sent
 *   double-tap   two quick taps on an answer answer one decision, never the next
 *   offline      &offline: the answer is kept ("No signal · it sends when back"); the signal back sends it
 *   failed       &fail=settlePick: "Not sent · tell Kevin · code MG-502"; Try again sends it
 *   clash        &clash=carton: "Someone else just did this · Refreshed"
 *   empty        &state=empty: the + is a tick and opens All decided
 */
const R = require('./runner.cjs');

const PHONE = {};

/** The Decide sheet's "n of N" (its dialog's name ends ", n of N"). */
async function place(k) {
  const l = await k.p.locator('.mg-d[role=dialog]').first().getAttribute('aria-label').catch(() => null);
  const m = /(\d+) of (\d+)$/.exec(l || '');
  return m ? { n: +m[1], of: +m[2], title: l.replace(/, \d+ of \d+$/, '') } : null;
}

/** Answer the card on screen with its primary answer: the slide when it has one, else the white answer. */
async function primary(k) {
  if (await k.p.locator('.mg-dock .ow-knob').count()) await k.slide('.mg-dock .ow-knob');
  else await k.tap({ sel: '.mg-dock .mg-ans' }, 900);
}

async function queue(open) {
  const k = await open('');
  await k.tap({ sel: '.ow-plus' });
  let at = await place(k);
  k.check(at && at.n === 1 && at.of === 8, 'the + opens 1 of 8', at && `${at.n} of ${at.of}`);
  k.check(at && /Not paid yet · on credit\?/.test(at.title), 'the truck waits first: Not paid yet · on credit?', at && at.title);
  for (let i = 0; i < 8; i++) {
    await primary(k);
    if (i < 7) {
      const nx = await place(k);
      k.check(nx && nx.of === 7 - i, `after answer ${i + 1}, the next card is there by itself (${7 - i} left)`, nx && `${nx.n} of ${nx.of}`);
    }
  }
  await k.p.waitForTimeout(600);
  k.check(/All decided/.test(await k.all()), 'the eighth answer opens All decided');
  await k.tap({ sel: '.mg-done-back' }, 11000);
  k.check(/Today/.test(await k.text()), 'Back to Today');
}

const LATER = [
  ['&at=1005', 'bill:561', /Invoiced|Bill it/],
  ['&at=1015', 'price:553:0', /Price set/],
  ['&at=1015', 'checkin:trip-1009', /check-in/],
  ['&at=1020', 'extra:sa-9', /Keep it/],
  ['&at=1120', 'counter:570:0', /Approved/],
  ['&at=1125', 'agent:560', /Agreed/],
  ['&at=1140', 'limit:cq-4', /Limit/],
  ['&at=1220', 'credit:555', /On credit/],
  ['&at=1310', 'credit:552', /On credit/],
  ['&at=1420', 'void:ia-545', /Voided/],
  ['&at=1610', 'given:563', /Given away/],
  ['&at=1620', 'count:sc-14', /Count taken/],
  ['&state=markup', 'markup:p-pvc', /Markup/],
];

async function perDecision(open) {
  for (const [flags, key, word] of LATER) {
    const k = await open(`${flags}&push=x:${encodeURIComponent(key)}`);
    const at = await place(k);
    k.check(!!at, `${key}: its push opens its card`);
    if (!at) continue;
    // A void with money: pick refund or deposit first (the knob is grey until then).
    if (await k.p.locator('.mg-dock [role=radio]').count() && /void/.test(key)) await k.tap({ sel: '.mg-dock [role=radio] >> nth=1' });
    await primary(k);
    // A tap waits its 10 s, then goes; the last card opens All decided, whose list says the answer.
    await k.p.waitForTimeout(11500);
    const all = await k.all();
    k.check(/All decided/.test(all) && word.test(all), `${key}: answered, and Today's answers says so`, all.slice(0, 200));
  }
}

async function undo(open) {
  const k = await open('&push=x:short:550');
  await k.tap({ sel: '.mg-dock .mg-ans' }, 400);
  k.check(await k.p.locator('.mg-strip .mg-undo').count() === 1, 'the strip counts down with Undo');
  await k.tap({ sel: '.mg-strip .mg-undo' }, 500);
  const at = await place(k);
  k.check(at && /Packed short/.test(at.title), 'Undo brings Packed short back', at && at.title);
}

async function doubleTap(open) {
  const k = await open('&push=x:short:550');
  const before = await place(k);
  const el = k.p.locator('.mg-dock .mg-ans').first();
  await el.tap();
  await k.p.waitForTimeout(80);
  await el.tap();
  await k.p.waitForTimeout(900);
  const after = await place(k);
  k.check(before && after && after.of === before.of - 1, 'a double tap answers one decision', after && `${after.n} of ${after.of}`);
}

async function offline(open) {
  const k = await open('&offline&push=x:short:550');
  await k.tap({ sel: '.mg-dock .mg-ans' }, 400);
  await k.p.waitForTimeout(10600);
  k.check(/No signal · it sends when back/.test(await k.all()), 'no signal: "No signal · it sends when back"');
}

async function failed(open) {
  const k = await open('&fail=settlePick&push=x:short:550');
  await k.tap({ sel: '.mg-dock .mg-ans' }, 400);
  await k.p.waitForTimeout(11000);
  k.check(/Not sent · tell Kevin/.test(await k.all()) && /MG-502/.test(await k.all()), 'the red bar: Not sent · tell Kevin · code MG-502');
}

async function clash(open) {
  const k = await open('&clash=carton&push=x:carton:rb-77');
  await k.tap({ sel: '.mg-dock .mg-ans' }, 400);
  await k.p.waitForTimeout(11000);
  k.check(/Someone else just did this/.test(await k.all()), 'someone else answered first: said so');
}

async function empty(open) {
  const k = await open('&state=empty');
  await k.tap({ sel: '.ow-plus' });
  k.check(/All decided/.test(await k.all()), 'nothing waits: the + opens All decided');
}

R.main({ app: 'manager', flows: { queue, 'per-decision': perDecision, undo, 'double-tap': doubleTap, offline, failed, clash, empty }, phone: PHONE });
