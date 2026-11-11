'use strict';
/*
 * No signal, a failed save, and the tap counts, by taps (test/e2e/store-flows.cjs runs them).
 *
 * &offline: the demo refuses every write as 'offline' and the outbox keeps it ("Not sent yet"). The signal
 * comes back by the browser's own 'online' event (context.setOffline), which the demo listens for
 * (src/core/store/demo/index.ts). &fail=<write>: that write fails once with its board code; Try again goes.
 */
const { NEXT, checkinTo } = require('./store-yard.cjs');
const { order, trips, returns, counter, barTone } = require('./store-lib.cjs');

/** The signal goes, then comes back: the browser's own events. */
async function signalBack(ph) {
  await ph.ctx.setOffline(true);
  await ph.p.waitForTimeout(150);
  await ph.ctx.setOffline(false);
  await ph.p.waitForTimeout(1200);
}

/**
 * The app sends what it kept when the signal is back: by itself when it listens for it, else from the bar's
 * Try again. The demo's shell does not listen (store.ts ready() returns before its 'online' listener when
 * isDemo), so it is said once as a note and the bar's Try again is tapped.
 */
async function sendKept(ph, sent) {
  if (await sent()) { ph.note('the kept write went by itself when the signal came back'); return; }
  ph.note('the kept write did not go by itself on the demo (store.ts ready() skips its \'online\' listener when isDemo); sent with the bar\'s Try again');
  await ph.tap('Try again');
  await ph.p.waitForTimeout(900);
}

/** 5. &offline at 11:30: the check-in is kept (amber, Not sent yet); the signal back sends it (IN07). */
async function offline(open) {
  const ph = await open('&at=1130&offline');
  await checkinTo(ph);
  await ph.p.waitForTimeout(700);
  const s = await ph.text();
  ph.check(/Not sent yet/.test(s) && /No signal · kept on this phone/.test(s), 'offline: the check-in says Not sent yet · No signal · kept on this phone (IN07)', s.slice(0, 1200));
  const tone = await barTone(ph, /^No signal/);
  ph.check(tone === 'amber', 'offline: the No signal bar is amber', tone);
  ph.check(/saved 7:52/.test(s), 'offline: the copy says saved 7:52', s.slice(-400));
  const checked = async () => (await trips(ph)).filter((x) => /^TRIP-1017B/.test(x.id)).every((x) => x.yardCheckedAt);
  ph.check(!(await checked()), 'offline: nothing reached the books while there was no signal');
  await signalBack(ph);
  await sendKept(ph, checked);
  ph.check(await checked(), 'offline: back online, the check-in reaches the books (both stops checked in)');
  const after = await ph.text();
  ph.check(/You checked it in/.test(after) && !/Not sent yet/.test(after), 'offline: the trip now reads You checked it in, nothing Not sent yet', after.slice(0, 600));
}

/**
 * 5b. &offline at 10:41: #0552's last line packed with no signal (PK11 "Packed · not sent", "Back online to
 * finish"); back online the line goes, and the order must still finish (Packed, PK06).
 */
async function offlinePack(open) {
  const ph = await open('&offline');
  await ph.tap(NEXT);
  await ph.tap('Packed · 2 pc');
  await ph.p.waitForTimeout(700);
  let s = await ph.text();
  ph.check(/Packed · not sent/i.test(s) && /not sent yet/.test(s) && /Back online to finish/.test(s), 'offline-pack: Packed · not sent, No signal · 1 not sent yet, Back online to finish (PK11)', s.slice(0, 900));
  const tone = await barTone(ph, /^No signal/);
  ph.check(tone === 'amber', 'offline-pack: the No signal bar is amber', tone);
  const picked = async () => (await order(ph, 552)).lines[1].pickedQty === 2;
  ph.check(!(await picked()), 'offline-pack: nothing reached the books while there was no signal');
  await signalBack(ph);
  await sendKept(ph, picked);
  ph.check(await picked(), 'offline-pack: back online, the wheelbarrows\' 2 pc reach the books');
  await ph.p.waitForTimeout(500);
  s = await ph.text();
  const finish = await ph.p.locator('button.pk-finishing, button.pk-btn').count();
  const packed = /^Packed$/m.test(s) || /finishing #0552/.test(s) || finish > 0;
  ph.check(packed, 'offline-pack: back online, #0552 finishes (Packed, or a control to finish it): the board says "Back online to finish"',
    `pack/order shows every line in ("Grace sees: Packing · 2 of 2") and no control at all; the books have pickingStatus "${(await order(ph, 552)).pickingStatus}". Screen: ${s.slice(0, 400)}`);
}

/** 6. &fail=checkIn: the red "That did not save · tell Kevin · code CI-502", and Try again checks it in (IN08). */
async function failed(open) {
  const ph = await open('&at=1130&fail=checkIn');
  await checkinTo(ph);
  await ph.p.waitForTimeout(800);
  let s = await ph.text();
  ph.check(/That did not save · tell Kevin/.test(s) && /code CI-502/.test(s) && /your counts are kept/.test(s), 'failed: That did not save · tell Kevin · code CI-502 · your counts are kept', s.slice(0, 1200));
  const tone = await barTone(ph, /That did not save/);
  ph.check(tone === 'red', 'failed: the bar is red', tone);
  const checked = async () => (await trips(ph)).filter((x) => /^TRIP-1017B/.test(x.id)).every((x) => x.yardCheckedAt);
  ph.check(!(await checked()), 'failed: nothing reached the books');
  await ph.tap('Try again');
  await ph.wait('Sent to Ruth · 1 differs');
  s = await ph.text();
  ph.check(/^Checked in$/m.test(s), 'failed: Try again: Checked in · Sent to Ruth · 1 differs', s.slice(0, 400));
  ph.check(await checked(), 'failed: Try again: the books have the trip checked in');

  // A pack line too (PK12): its own words, the same code rule (PK-502).
  const p = await open('&fail=pick');
  await p.tap(NEXT);
  await p.tap('Packed · 2 pc');
  await p.p.waitForTimeout(800);
  s = await p.text();
  p.check(/that did not save/i.test(s) && /tell Kevin · PK-502/.test(s) && /kept on this phone/.test(s), 'failed: a pack line says that did not save · tell Kevin · PK-502 · kept on this phone (PK12)', s.slice(0, 900));
  const ptone = await barTone(p, /did not save/);
  p.check(ptone === 'red', 'failed: the pack bar is red', ptone);
  await p.tap('Try again');
  await p.p.waitForTimeout(900);
  p.check((await order(p, 552)).lines[1].pickedQty === 2, 'failed: Try again: the wheelbarrows reach the books');
}


/*
 * 7. The tap counts of docs/audit/store/FLOW.md §5, measured: from a fresh open of the app at Today, each job by
 * its shortest way the app offers, every press or slide counted (typed text apart). A job that needs more taps
 * than FLOW.md says fails, naming the taps it took. Fewer is a pass (and is said).
 *
 *   pack       PK04  Next job 1 · Packed × (lines − 1) · the short's tile 1 · Pack short 1   (8 for 6 lines)
 *              The demo's #0552 at 10:41 has one line left and it is short: 1 + 0 + 1 + 1 = 3.
 *   load       OU02  To load 1 · All on 1 · slide 1 = 3       (13:15, #0552 paid, our driver)
 *   gate       OU10  Ready card 1 · slide 1 = 2               (10:47, #0555 paid, name from the order)
 *   agent      OU11  card 1 · code 4 · slide 1 = 6            (10:47 &state=agent, #0554, code 0554)
 *   deliver    OU21  Next job "At the door" 1 · the shutter 1 = 2   (14:05, #0552 at the Ntinda site)
 *   checkin    IN02/IN03  open 1 · 3 quick tiles · 1 why chip · slide 1 = 6   (11:30, Denis's trip)
 *   return     IN20  open 1 · photo 1 · Send to Ruth 1 = 3    (#0548 at the gate)
 */

const FLOW = { pack: 3, load: 3, gate: 2, agent: 6, deliver: 2, checkin: 6, return: 3 };

/**
 * One job: the taps, then whether it got done (the books say so). A write held for its 10 s Undo goes when the
 * screen changes, so after counting, "Back to Today" (not counted: the job is over) sends it before the books are read.
 */
async function job(ph, name, steps, done) {
  const c = counter(ph);
  await steps(c);
  if (await ph.p.getByText('Back to Today', { exact: true }).count()) await ph.tap('Back to Today');
  await ph.p.waitForTimeout(700);
  const ok = await done();
  ph.check(ok, `taps ${name}: the job is done in the demo's books`);
  const max = FLOW[name];
  ph.check(c.n <= max, `taps ${name}: at most ${max} taps (FLOW.md §5)`, `${c.n} taps: ${c.log.join(' · ')}`);
  ph.note(`${name}: ${c.n} taps (FLOW.md ${max})${c.n < max ? ' · fewer' : ''}: ${c.log.join(' · ')}`);
  return c.n;
}

async function taps(open) {
  const a = await open('');
  await job(a, 'pack', async (c) => {
    await c.tap(NEXT);
    await c.tap('Short');
    await c.tap('Pack short · 1 of 2 pc');
    await a.wait('Sent to Ruth');
    await a.wait('Picked for you', 15000); // the finish shows Packed by itself after its 10 s; no tap
  }, async () => (await order(a, 552)).pickingStatus === 'done');

  const b = await open('&at=1315');
  await job(b, 'load', async (c) => {
    await c.tap({ sel: "[aria-label*='to load' i]" });
    await c.slide();
    await b.wait('On the road');
  }, async () => { const o = await order(b, 552); return o.status === 'pending_delivery' && !!o.carrier; });

  const g = await open('&at=1047');
  await job(g, 'gate', async (c) => {
    await c.tap({ label: 'Hand over #0555 at the gate' });
    await c.slide();
    await g.wait('Handed over');
  }, async () => (await order(g, 555)).status === 'completed');

  const h = await open('&at=1047&state=agent');
  await job(h, 'agent', async (c) => {
    // Today's card opens the gate on #0554, whose slide is locked "Code first"; its tap opens the keypad.
    await c.tap({ label: 'Hand over #0554 at the gate' });
    await c.tap({ sel: '.ow-lslide' }, 350, { force: true });
    for (const d of '0554') await c.tap({ sel: `.gc-key:text-is("${d}")` });
    await c.slide();
    await h.wait('Delivered · collected');
  }, async () => (await order(h, 554)).status === 'completed');

  const d = await open('&at=1405');
  await job(d, 'deliver', async (c) => {
    // No "At the door" job on Today (core/store/jobs.ts has none): On the road, the order's Delivered, the shutter.
    const s = await d.text();
    d.check(/At the door/.test(s), 'taps deliver: Today\'s Next job is "At the door" (OU21, FLOW.md §5)', `Today's Next job: ${(/Next job\s*([\s\S]{0,120})/.exec(s) || [])[1]}`);
    await c.tap({ sel: "[aria-label*='on the road' i]" });
    await c.tap({ label: 'Delivered: Kato Construction, #0552' });
    await c.tap({ label: 'Take the photo: marks #0552 delivered' });
    await d.wait('WHAT HAPPENS NEXT');
  }, async () => (await order(d, 552)).status === 'completed');

  const k = await open('&at=1130');
  await job(k, 'checkin', async (c) => {
    await c.tap(NEXT);
    await c.tap('4 box');
    await c.tap('1 tin');
    await c.tap('18 pcs');
    await c.tap('Never came');
    await c.slide();
    await k.wait('Sent to Ruth · 1 differs');
  }, async () => (await trips(k)).filter((x) => /^TRIP-1017B/.test(x.id)).every((x) => x.yardCheckedAt));

  const r = await open('');
  await job(r, 'return', async (c) => {
    await c.tap({ sel: "[aria-label^='Return from Ggaba']" });
    await c.tap('Take a photo');
    await c.tap({ text: 'Send to Ruth' });
    await r.wait('Checked at the gate');
  }, async () => (await returns(r)).some((x) => x.orderId === 548 && /Musa/.test(x.byName || '')));
}

module.exports = { offline, offlinePack, failed, taps, FLOW };
