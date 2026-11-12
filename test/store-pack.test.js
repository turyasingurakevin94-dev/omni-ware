#!/usr/bin/env node
'use strict';
/*
 * The Pack area's rules (src/core/store/pack.ts, bays.ts, faces.ts) on the sample day: #0552's lines,
 * the strip's names, the bays, a cancelled order's put-back, where · when · phone, and the demo's
 * Pack what-ifs (&state=for-you, &state=okello-0556, &fail=putBack).
 *
 * Run: node test/store-pack.test.js   (or: npm test)
 */
const path = require('path');
const { ROOT, createReporter } = require('./_extract');

const t = createReporter('store pack');
const P = require(path.join(ROOT, 'src/core/store/pack.ts'));
const B = require(path.join(ROOT, 'src/core/store/bays.ts'));
const F = require(path.join(ROOT, 'src/core/store/faces.ts'));
const Y = require(path.join(ROOT, 'src/core/store/yard.ts'));
const { storeDemo } = require(path.join(ROOT, 'src/core/store/demo/index.ts'));

const demo = (q = '?demo') => storeDemo(q, { instant: true });

(async () => {
  let d = demo(), b = await d.snapshot();
  const o552 = b.orders.find((o) => o.id === 552);
  t.check(P.packLines(o552).length === 2 && P.notPicked(o552, o552.lines[2]), '#0552: the hinge is dropped, 2 lines to pack');
  const pr = P.progress(o552);
  t.check(pr.done === 1 && pr.of === 2, `#0552: 1 of 2 packed (got ${pr.done} of ${pr.of})`);
  const cur = P.currentLine(o552);
  t.check(cur && cur.idx === 1, 'the line now is the wheelbarrows (line 2 of 3)');
  t.check(P.currentLine(o552, 0).idx === 1, 'a line already packed is never the line asked for');
  t.check(P.isLastOpen(o552, 1), 'packing the wheelbarrows finishes #0552');
  t.check(o552.lines.map((l) => P.lineMark(o552, l, cur)).join() === 'done,now,dropped', 'the strip: done · now · dropped');
  t.check(P.shortName('Iron sheet G28 · 3m') === 'Iron sheet' && P.shortName('Wheelbarrow, heavy duty') === 'Wheelbarrow' && P.shortName('Soft close hinge · flat') === 'Hinge', 'the strip names: Iron sheet · Wheelbarrow · Hinge');
  t.check(P.shortName('Wire nails 4" · 25kg ctn') === 'Wire nails', 'Wire nails 4" → Wire nails');
  const a = P.aisleOf(b, o552.lines[1]);
  t.check(a && a.letter === 'G' && a.name === 'Tools', 'the wheelbarrow is aisle G, Tools');
  t.check(P.aisleOf(b, o552.lines[0]).letter === 'A', 'iron sheets are aisle A');
  const w = P.whereOf(o552, b);
  t.check(!w.pickup && w.to === 'Ntinda site' && w.when === 'today afternoon' && w.phone === '0772 418 220', 'where · when · phone: Ntinda site · today afternoon · 0772 418 220');
  t.check(P.whereOf(b.orders.find((o) => o.id === 556), b).pickup, '#0556: they collect');
  t.check(P.unitWord('ctn') === 'cartons' && P.unitWord('pc', 1) === 'piece' && P.unitWord('kg') === 'kg', 'the short count asks in words: cartons, piece, kg');
  t.check(!P.shortNow(o552, o552.lines[0]), 'a full line is not short');
  t.check(P.putBack(o552).length === 0, 'an order not cancelled puts nothing back');

  /* ---- bays ---- */
  const map = B.bayMap(b);
  t.check(map.get(1).id === 552 && map.get(2).id === 530 && !map.has(3), 'bays: #0552 on 1, #0530 on 2, 3 and 4 free');
  t.check(B.freeBays(b).join() === '3,4', 'free bays 3, 4');
  t.check(B.bayFor(o552, b) === 1, '#0552 keeps bay 1');
  t.check(B.bayFor(b.orders.find((o) => o.id === 556), b) === 3, '#0556 is picked bay 3, the first free one (FACTS)');
  t.check(B.bayCount({ bays: 40 }) === 12 && B.bayCount({ bays: 0 }) === 4, 'bays: 1 to 12, default 4');
  const full = { bays: 2, orders: b.orders };
  t.check(B.bayFor(b.orders.find((o) => o.id === 556), full) === null, 'every bay full: leave it by the gate (null)');

  /* ---- faces ---- */
  const kc = F.customerFace(o552, b);
  t.check(kc.initials === 'KC' && kc.tint === 't0' && kc.name === 'Kato Construction', 'Kato is KC, light blue (FACTS)');
  t.check(F.whoIs(b, 'u-ga').tint === 'me', 'Grace is navy (FACTS §1)');

  /* ---- cancelled on bay 2: put it back ---- */
  d = demo('?demo&state=cancel-0530'); b = await d.snapshot();
  const o530 = b.orders.find((o) => o.id === 530);
  const back = P.putBack(o530);
  t.check(back.length === 2 && back.map((x) => x.qty).join() === '10,1', '#0530 cancelled: Ridge cap 10 and Wire nails 1 go back');
  t.check(B.bayMap(b).get(2).id === 530, 'a cancelled order stays on its bay until it is put back');

  /* ---- the demo's Pack what-ifs ---- */
  d = demo('?demo&state=for-you'); b = await d.snapshot();
  t.check(Y.stageOf(b.orders.find((o) => o.id === 556), b, b.me.id, d.now()) === 'for-you', '&state=for-you: Ruth gave #0556 to Musa');
  d = demo('?demo&state=okello-0556'); b = await d.snapshot();
  let clash = null;
  try { await d.claim(556); } catch (e) { clash = e; }
  b = await d.snapshot();
  const o556 = b.orders.find((o) => o.id === 556);
  t.check(clash && clash.kind === 'clash' && o556.assignedWorkerId === 'st-op' && o556.pickingStatus === 'in_progress', '&state=okello-0556: the claim clashes, Okello has #0556');
  t.check(P.progress(o556).done === 1, 'Okello packed the cement');
  d = demo('?demo&state=cancel-0530&fail=putBack');
  let failed = false;
  try { await d.putBack(530); } catch (_e) { failed = true; }
  await d.putBack(530);
  const p530 = d.day.orders.find((o) => o.id === 530), stamp = p530.putBack && p530.putBack.at;
  t.check(failed && p530.putBack && p530.putBack.byName === 'Musa Kiggundu' && p530.putBack.lines.length === 2, '&fail=putBack fails once, then the put-back is stamped on the order (0182)');
  await d.putBack(530);
  t.check(d.day.orders.find((o) => o.id === 530).putBack.at === stamp, 'the put-back is stamped once');
  t.check(!(await d.snapshot()).orders.some((o) => o.id === 530), 'put back, #0530 leaves the yard\'s lists');

  /* ---- packing the wheelbarrows finishes #0552 ---- */
  d = demo(); await d.pick(552, [{ idx: 1, status: 'done', qty: 2 }], 2); await d.finishPack(552, 1);
  b = await d.snapshot();
  const p552 = b.orders.find((o) => o.id === 552);
  t.check(p552.pickingStatus === 'done' && p552.bay === 1 && P.currentLine(p552) === null, 'packed onto bay 1, no line open');
  t.done();
})().catch((e) => { console.error(e); process.exit(1); });
