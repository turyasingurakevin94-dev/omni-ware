'use strict';
/*
 * The yard's flows, from Today, by taps (test/e2e/store-flows.cjs runs them): the order's way out (pack, load,
 * deliver; they collect) and goods in (the check-in, a return at the gate).
 * FACTS: docs/canvas/store-agent/FACTS.md §2 (10:41), §3, §4 and §8 (the later moments).
 *
 * A tap cannot move the demo's clock, so #0552's day is three phones at three moments of FACTS §8:
 * 10:41 packing (Musa), 13:15 paid and Ssali back (load), 14:05 at the Ntinda site (deliver).
 */
const { order, trips, returns, slideWords } = require('./store-lib.cjs');

const NEXT = { sel: "[aria-label^='Start the next job']" };

/** 1. #0552: pack its last line with one short (PK04) → Packed (PK06) · load our driver (OU02) · deliver (OU21 → OU22). */
async function packLoadDeliver(open) {
  // Pack, 10:41: the Next job carries on #0552 at line 2 of 3, the wheelbarrows; the hinge is dropped.
  const a = await open('');
  let s = await a.text();
  a.check(/Carry on/.test(s), 'pack: Today\'s Next job is Carry on (#0552)', s.slice(0, 600));
  await a.tap(NEXT);
  s = await a.text();
  a.check(/#0552/.test(s) && /LINE 2 OF 3/i.test(s) && /Wheelbarrow/.test(s), 'pack: #0552 opens at line 2 of 3, the wheelbarrows', s.slice(0, 500));
  a.check(/Hinge dropped/.test(s) && /not found · nothing to pack/.test(s), 'pack: the hinge shows dropped, nothing to pack', s.slice(0, 600));
  await a.tap('Short');
  s = await a.text();
  a.check(/the order asks 2 pc/.test(s) && /1 pc short/.test(s) && /Ruth settles the short/.test(s) && /Grace is told/.test(s), 'pack: Short asks how many (2 asked, 1 short), Ruth settles, Grace is told', s.slice(0, 700));
  a.check(await a.p.locator('button.pk-tile.on:has-text("1")').count() === 1, 'pack: Short opens on 1 pc (one short), no tile to tap');
  await a.tap('Pack short · 1 of 2 pc');
  await a.wait('Sent to Ruth');
  s = await a.text();
  a.check(/1 SHORT/i.test(s) && /Grace told/.test(s) && /1 short · Ruth settles/.test(s), 'pack: Pack short says Sent to Ruth · Grace told, 1 short · Ruth settles', s.slice(0, 700));
  // The finish waits its 10 s ("Every line done · finishing #0552"); its tap goes now.
  await a.tap({ sel: 'button.pk-finishing' });
  await a.wait('Picked for you');
  s = await a.text();
  a.check(/^Packed$/m.test(s) && /Bay 1 · picked for you/i.test(s), 'pack: Packed · Bay 1 · picked for you (PK06)', s.slice(0, 500));
  a.check(/Not paid yet · Grace takes the money/.test(s) && /To load → Ntinda/.test(s), 'pack: Packed says Not paid yet · Grace takes the money, To load → Ntinda', s.slice(0, 900));
  await a.tap('Back to Today');
  await a.p.waitForTimeout(600);
  const o1 = await order(a, 552);
  a.check(o1.pickingStatus === 'done' && o1.bay === 1, 'pack: the demo has #0552 packed on bay 1', JSON.stringify({ ps: o1.pickingStatus, bay: o1.bay }));
  a.check(o1.lines[1].pickedQty === 1 && o1.lines[1].qty === 2, 'pack: the demo has the wheelbarrows 1 of 2 packed', JSON.stringify(o1.lines[1]));
  s = await a.text();
  a.check(/Kato · Not paid yet/.test(s), 'pack: Today waits on others for Kato · Not paid yet', s.slice(0, 1500));

  // Load, 13:15: Grace took Kato's money; To load with our driver (Ssali, remembered), All on, the slide.
  const b = await open('&at=1315');
  await b.tap({ sel: "[aria-label*='to load' i]" });
  s = await b.text();
  b.check(/→ Ntinda/.test(s) && /Kato Construction/.test(s), 'load: To load has → Ntinda with Kato Construction', s.slice(-900));
  b.check(await b.p.locator('button.ou-chip.on:has-text("Ssali")').count() === 1, 'load: our driver Ssali is chosen');
  await b.tap({ text: 'Kato Construction' });
  s = await b.text();
  b.check(/Paid · it can leave/.test(s) && /Who drives/.test(s) && /What goes on the truck/.test(s), 'load: the run says Paid · it can leave, Who drives, What goes on the truck (OU02)', s.slice(0, 800));
  await b.tap('All on');
  s = await b.text();
  b.check(/2 of 2 on/.test(s), 'load: All on: 2 of 2 on', s.slice(0, 900));
  b.check(/^Slide to send Ssali/.test(await slideWords(b)), 'load: the slide says Slide to send Ssali', await slideWords(b));
  await b.slide();
  await b.wait('On the road');
  s = await b.text();
  b.check(/^On the road$/m.test(s) && /Ssali/.test(s) && /Grace sees · On the road · Ssali/.test(s) && /Kato sees · On the road · Ssali/.test(s), 'load: On the road · Ssali; Grace and Kato see it (OU05)', s.slice(0, 600));
  b.check(/Undo/.test(s), 'load: the end screen has Undo', s.slice(0, 600));
  await b.tap('Back to Today');
  await b.p.waitForTimeout(700);
  const o2 = await order(b, 552);
  b.check(o2.status === 'pending_delivery' && o2.carrier && o2.carrier.name === 'Ssali' && o2.carrier.kind === 'staff', 'load: the demo has #0552 on the road with Ssali', JSON.stringify({ st: o2.status, c: o2.carrier }));

  // Deliver, 14:05 at the Ntinda site: the door, the shutter takes the photo and marks it Delivered.
  const c = await open('&at=1405');
  await c.tap({ sel: "[aria-label*='on the road' i]" });
  await c.tap({ label: 'Delivered: Kato Construction, #0552' });
  s = await c.text();
  c.check(/At the door · Ntinda site/.test(s) && /2 of 2/.test(s) && /No photo\?/.test(s) && /Can’t deliver/.test(s), 'deliver: At the door · Ntinda site, all comes off 2 of 2, No photo?, Can’t deliver (OU21)', s.slice(0, 600));
  await c.tap({ label: 'Take the photo: marks #0552 delivered' });
  await c.wait('WHAT HAPPENS NEXT');
  s = await c.text();
  c.check(/^Delivered$/m.test(s) && /Grace sees · Delivered · at the door/.test(s) && /photo kept/.test(s), 'deliver: Delivered · Grace sees it at the door, photo kept (OU22)', s.slice(0, 600));
  c.check(/The bill\s*goes by itself after 24 h/.test(s), 'deliver: the bill goes by itself after 24 h', s.slice(0, 600));
  const undo = c.p.locator('button:has-text("Undo")');
  c.check(await undo.count() === 1 && /\d+ s/.test(await undo.first().innerText()), 'deliver: the Undo chip shows with its seconds', s.slice(0, 600));
  await c.tap('Back to Today');
  await c.p.waitForTimeout(700);
  const o3 = await order(c, 552);
  c.check(o3.status === 'completed' && o3.deliveredAt && o3.deliveredPhoto, 'deliver: the demo has #0552 delivered with its photo', JSON.stringify({ st: o3.status, at: o3.deliveredAt, ph: !!o3.deliveredPhoto }));
}

/** 2. #0556 they collect: pack 2 lines → Ready to collect (PK07) → the gate's slide (OU10 → OU12); the agent's code; Not paid yet held. */
async function collect(open) {
  const a = await open('');
  await a.tap({ sel: "[aria-label*='to pack' i]" });
  await a.tap({ label: 'Pack #0556' });
  let s = await a.text();
  a.check(/#0556/.test(s) && /LINE 1 OF 2/i.test(s) && /They collect · at the gate/.test(s), 'collect: #0556 opens at line 1 of 2, they collect at the gate', s.slice(0, 600));
  await a.tap({ sel: 'button.pk-btn.red' });
  await a.wait('LINE 2 OF 2');
  await a.tap({ sel: 'button.pk-btn.red' });
  await a.wait('Ready to collect');
  s = await a.text();
  a.check(/At the gate · they collect/i.test(s) && /Grace sees: Ready to collect/.test(s), 'collect: Ready to collect · at the gate, Grace sees it (PK07)', s.slice(0, 700));
  await a.tap({ sel: '.mo-back-r:has-text("Hand over")' });
  s = await a.text();
  a.check(/#0556/.test(s) && /Paid/.test(s) && /Who collects · from the order/.test(s) && /Nansana Hardware · 0752 610 044/.test(s), 'collect: the gate has #0556, Paid, who collects from the order (OU10)', s.slice(0, 700));
  a.check(/^Slide to hand over #0556/.test(await slideWords(a)), 'collect: the slide says Slide to hand over #0556', await slideWords(a));
  await a.slide();
  await a.wait('Handed over');
  s = await a.text();
  a.check(/Delivered · collected/.test(s) && !/at the door/.test(s), 'collect: Handed over · Delivered · collected, never at the door (OU12)', s.slice(0, 600));
  await a.tap('Back to Today');
  await a.p.waitForTimeout(700);
  const o = await order(a, 556);
  a.check(o.status === 'completed' && o.carrier && o.carrier.kind === 'client' && o.deliveredTo === 'Nansana Hardware', 'collect: the demo has #0556 collected by Nansana Hardware', JSON.stringify({ st: o.status, c: o.carrier, to: o.deliveredTo }));

  // The agent's code (OU11): #0554, Peter Sserwadda, code 0554.
  const g = await open('&at=1047&state=agent');
  await g.tap({ label: 'Hand over #0554 at the gate' });
  s = await g.text();
  g.check(/Peter Sserwadda/.test(s) && /Code first/.test(await slideWords(g)), 'agent: #0554 at the gate waits for the code (Code first)', s.slice(0, 600));
  await g.tap({ sel: '.ow-lslide' }, 350, { force: true });
  for (const d of '0554') await g.tap({ sel: `.gc-key:text-is("${d}")` });
  s = await g.text();
  g.check(/Matches #0554 · Peter Sserwadda/.test(s), 'agent: 0554 matches #0554 · Peter Sserwadda', s.slice(0, 500));
  g.check(/^Slide to hand over to Peter/.test(await slideWords(g)), 'agent: the slide says Slide to hand over to Peter', await slideWords(g));
  await g.slide();
  await g.p.waitForTimeout(500);
  s = await g.all();
  g.check(/Delivered · collected/.test(s), 'agent: handed over · Delivered · collected', s.slice(0, 600));
  const back = g.p.getByText('Back to Today', { exact: true });
  if (await back.count()) await g.tap('Back to Today');
  await g.p.waitForTimeout(700);
  const o4 = await order(g, 554);
  g.check(o4.status === 'completed' && o4.carrier && o4.carrier.kind === 'agent', 'agent: the demo has #0554 collected by the agent', JSON.stringify({ st: o4.status, c: o4.carrier }));

  // Not paid yet held at the gate (OU13): #0555 at 10:41, before Grace takes the money.
  const n = await open('');
  await n.tap({ sel: "[aria-label*='on the road' i]" });
  await n.tap({ text: 'Walk-in' });
  s = await n.text();
  n.check(/Not paid yet · leaves when paid/.test(s) && /Grace takes the money/.test(s) && /Ask Ruth/.test(s), 'not paid: #0555 says Not paid yet · leaves when paid, Grace takes the money, Ask Ruth (OU13)', s.slice(0, 700));
  n.check(await slideWords(n) === 'Stays until paid' && await n.p.locator('.ow-knob').count() === 0, 'not paid: the slide is locked, Stays until paid', await slideWords(n));
  const o5 = await order(n, 555);
  n.check(o5.status === 'pending_delivery' && !o5.deliveredAt, 'not paid: the demo still has #0555 at the gate', JSON.stringify({ st: o5.status, at: o5.deliveredAt }));
}

// Goods in. FACTS §3, §4, §8: Denis's trip back at 11:30 (#0549: Concrete nails 2" 4 box, Emulsion 1 tin; #0546:
// Iron sheet G30 20 pc; Gutter bracket not found); #0548's 2 torn bags of Cement back at the gate with Ssali.

/** Denis's trip to the check-in and through it, blind: 4 box · 1 tin · 18 pcs · Never came · the slide (IN02, IN03, IN06). */
async function checkinTo(ph) {
  await ph.tap(NEXT);
  let s = await ph.text();
  ph.check(/Denis's trip/.test(s) && /back at the yard/.test(s) && /line 1 of 3/.test(s), 'check-in: the Next job opens Denis\'s trip, back at the yard, line 1 of 3 (IN02)', s.slice(0, 500));
  ph.check(!/Denis\s*20 pc/.test(s) && !/\b20 pc\b/.test(s), 'check-in: blind: Denis\'s 20 pc is not shown before the count', s);
  await ph.tap('4 box');
  await ph.tap('1 tin');
  s = await ph.text();
  ph.check(/#0549 Ggaba Stores\s*4 box · 1 tin/.test(s), 'check-in: #0549 reads 4 box · 1 tin', s.slice(0, 600));
  await ph.tap('18 pcs');
  s = await ph.text();
  ph.check(/2 pc differ · why\?/.test(s) && /Ruth decides the difference/.test(s), 'check-in: 18 of 20 asks why on that line only: 2 pc differ · why? (IN03)', s.slice(0, 900));
  ph.check(await ph.p.locator('button.in-chip').count() === 4, 'check-in: four why chips, on the one line', await ph.p.locator('button.in-chip').count());
  ph.check(/Say why first/.test(s) && await ph.p.locator('.ow-knob').count() === 0, 'check-in: the slide waits: Say why first', s.slice(-300));
  await ph.tap('Never came');
  ph.check(/^Slide to check in · 3 lines/.test(await slideWords(ph)), 'check-in: the slide says Slide to check in · 3 lines', await slideWords(ph));
  await ph.slide();
}

/** 3. The check-in, ending on "Sent to Ruth · 1 differs", and the trip checked in the demo's books. */
async function checkin(open) {
  const ph = await open('&at=1130');
  await checkinTo(ph);
  await ph.wait('Checked in');
  const s = await ph.text();
  ph.check(/^Checked in$/m.test(s) && /Sent to Ruth · 1 differs/.test(s) && /Denis told/.test(s), 'check-in: Checked in · Sent to Ruth · 1 differs · Denis told (IN06)', s.slice(0, 500));
  ph.check(/#0549 · pack it now/.test(s) && /pack 18 of 20/.test(s) && /Ruth decides the 2 pc/.test(s), 'check-in: #0549 pack it now, #0546 pack 18 of 20, Ruth decides the 2 pc', s.slice(0, 900));
  await ph.tap('Back to Today');
  const t = (await trips(ph)).filter((x) => /^TRIP-1017B/.test(x.id));
  ph.check(t.length === 2 && t.every((x) => x.yardCheckedAt), 'check-in: the demo has both stops of Denis\'s trip checked in', JSON.stringify(t.map((x) => [x.id, x.yardCheckedAt])));
  const sheet = t.flatMap((x) => x.lines).find((l) => /Iron sheet G30/.test(l.name));
  ph.check(sheet && sheet.yardQty === 18 && sheet.qty === 20, 'check-in: the demo has the yard\'s 18 of Denis\'s 20 iron sheets', JSON.stringify(sheet));
}

/** 4. #0548 at the gate: photo, Send to Ruth (IN20 → IN21); the return is asked in the demo's books. */
async function returnAtGate(open) {
  const ph = await open('');
  await ph.tap({ sel: "[aria-label^='Return from Ggaba']" });
  let s = await ph.text();
  ph.check(/Ggaba Stores · return/.test(s) && /#0548 · at the gate/.test(s) && /Grace asked\s*2 of 3/.test(s), 'return: #0548 at the gate, Grace asked 2 of 3 bag (IN20)', s.slice(0, 500));
  ph.check(await ph.p.locator('button.bad.on:has-text("Damaged")').count() === 1, 'return: Damaged is prefilled from Grace');
  await ph.tap('Take a photo');
  await ph.tap({ text: 'Send to Ruth' });
  await ph.wait('Checked at the gate');
  s = await ph.text();
  ph.check(/Sent to Ruth/.test(s) && /2\s*bag\s*Damaged/.test(s) && /Ruth checks it/.test(s) && /Grace tells Ggaba/.test(s), 'return: Sent to Ruth · 2 bag damaged · Ruth checks it · Grace tells Ggaba (IN21)', s.slice(0, 600));
  ph.check(/Undo/.test(s), 'return: Undo shows', s.slice(0, 200));
  await ph.tap('Back to Today');
  await ph.p.waitForTimeout(600);
  const r = (await returns(ph)).filter((x) => x.orderId === 548 && x.by !== null && x.status === 'sent');
  const mine = r.find((x) => x.byName && /Musa/.test(x.byName));
  ph.check(mine && mine.lines.some((l) => l.qty === 2 && l.condition === 'damaged'), 'return: the demo has Musa\'s return of #0548, 2 bag damaged, sent to Ruth', JSON.stringify(r));
}

module.exports = { packLoadDeliver, collect, checkin, checkinTo, returnAtGate, NEXT };
