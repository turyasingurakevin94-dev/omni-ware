#!/usr/bin/env node
'use strict';
/*
 * Which department a decision belongs to (Q2), which others it moves,
 * and how sure the Manager is of it (Q6).
 *
 * A department is the meeting's own when it named a valid one, and
 * derived otherwise -- from what the move does, the screen it opens, the
 * lever it pulls, then what it is about. Confidence is COUNTED from the
 * books wherever they hold evidence about the move, and the weakest
 * evidence wins; only when nothing is counted is the meeting's own 1-5
 * shown, and then it says it is judged.
 *
 * Run: node test/manager-depts-confidence.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('manager departments and confidence');
const src = read('index.html');
const fn = (n) => extractFunction(src, n, 'index.html');
const decl = (n) => extractDeclaration(src, n, 'index.html');
const eq = (got, want, msg) => t.check(JSON.stringify(got) === JSON.stringify(want),
  `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`);
const TODAY = '2026-10-07';

const D = compileScope([fn('mgrDept'), fn('mgrMoveBody'), fn('mgrDeptOf'), fn('mgrTouchesOf'),
  decl('MGR_DEPTS'), decl('MGR_WHOLE_SHOP'), decl('MGR_KIND_DEPT'), decl('MGR_DOOR_DEPT'), decl('MGR_LEVER_DEPT')], {},
['mgrDept', 'mgrDeptOf', 'mgrTouchesOf']);

/* ---------- 1. the six departments ------------------------------------ */
{
  const depts = new Function(decl('MGR_DEPTS') + ' return MGR_DEPTS;')();
  eq(depts.map((d) => d.id), ['finance', 'sales', 'procurement', 'store', 'people', 'marketing'], 'six departments, in the board\'s order');
  eq(depts.map((d) => d.name), ['Finance', 'Sales', 'Procurement', 'Store', 'People', 'Marketing'], 'named as the owner approved');
  eq(depts.map((d) => [d.tint, d.ink]), [['--ow-sky-soft', '--ow-sky'], ['--ow-oxide-soft', '--ow-oxide-deep'],
    ['--ow-indigo-soft', '--ow-indigo'], ['--ow-verdigris-soft', '--ow-verdigris'], ['--ow-teal-soft', '--ow-teal'],
    ['--ow-plum-soft', '--ow-plum']], 'each in an ow category tint, ink on its own soft ground');
  const root = src.slice(src.indexOf(':root{'), src.indexOf('}', src.indexOf(':root{')));
  depts.forEach((d) => t.check(new RegExp(d.tint + ':\\s*#[0-9A-Fa-f]{6}').test(root) && new RegExp(d.ink + ':\\s*#[0-9A-Fa-f]{6}').test(root),
    `${d.name}'s tint and ink are real tokens on :root`));
  const ds = read('test/design-system.test.js');
  depts.forEach((d) => t.check(ds.includes(`['${d.ink}', hex('${d.tint}')`), `${d.name}'s pairing is held to 4.5:1 by the contrast test`));
}

/* ---------- 2. where a move belongs ----------------------------------- */
{
  const mv = (b) => ({ body: b });
  eq(D.mgrDeptOf(mv({ dept: 'marketing', mkind: 'chase' })), 'marketing', 'the meeting\'s own department wins when it is a real one');
  eq(D.mgrDeptOf(mv({ dept: 'Logistics', mkind: 'chase' })), 'finance', 'an unknown one is ignored and the move derived');
  eq(['chase', 'settle', 'buy', 'invoice', 'price'].map((k) => D.mgrDeptOf(mv({ mkind: k }))),
    ['finance', 'finance', 'procurement', 'sales', 'sales'], 'by what it does: chasing and paying are finance, buying procurement, invoicing and pricing sales');
  eq(['inventory', 'payroll', 'followups', 'creditors', 'sourcing'].map((door) => D.mgrDeptOf(mv({ mkind: 'policy', door }))),
    ['store', 'people', 'marketing', 'finance', 'procurement'], 'a standing rule goes where its door opens');
  eq(D.mgrDeptOf(mv({ mkind: 'other', door: 'presets', lever: 'sell' })), 'sales', 'then by its lever');
  eq(D.mgrDeptOf(mv({ mkind: 'other', subject: { key: 'P1' } })), 'store', 'then by what it is about');
  eq(D.mgrDeptOf(mv({ mkind: 'other' })), null, 'and nothing at all names no department — the whole shop, not a guess');
  eq(D.mgrDeptOf({ mkind: 'buy' }), 'procurement', 'a bare body reads the same as a row');

  eq(D.mgrTouchesOf(mv({ mkind: 'chase', subject: { customerId: 'C1' } })), ['sales'],
    'a chase moves sales — the customer — beside its own finance');
  eq(D.mgrTouchesOf(mv({ mkind: 'buy', subject: { key: 'P1', supplierId: 'S1' } })), ['finance', 'sales', 'store'],
    'a buy moves the cash it spends, and the line\'s shelf and sales');
  eq(D.mgrTouchesOf(mv({ mkind: 'settle', subject: { supplierId: 'S1' } })), ['procurement'], 'paying a supplier keeps them supplying');
  eq(D.mgrTouchesOf(mv({ mkind: 'chase', subject: { customerId: 'C1' }, touches: ['store', 'finance', 'nowhere'] })), ['store'],
    'the meeting\'s own list when it gave one — valid ones only, never the move\'s own department');
  eq(D.mgrTouchesOf(mv({ mkind: 'chase', subject: { customerId: 'C1' }, touches: [] })), ['sales'], 'an empty list is read as unsaid');
}

/* ---------- 3. how sure: counted ------------------------------------- */
const READING = { customers: [
  { customerId: 'C1', chased: { k: 3, n: 4 } }, { customerId: 'C2', chased: { k: 0, n: 3 } }, { customerId: 'C3', chased: { k: 20, n: 20 } }] };
const LEADS = [{ supplierId: 'S1', deliveries: 42, days: 3, typical: true }, { supplierId: 'S2', deliveries: 1, days: 2, typical: false }];
const RIVALS = { P1: [{ rival: 'Ndeeba', price: 47800, daysOld: 3 }, { rival: 'Kasubi', price: 47000, daysOld: 45 }], P2: [{ rival: 'Old', price: 1000, daysOld: 120 }] };
const ITEMS = [{ key: 'P1::', qty: 100, estimatedQty: 0 }, { key: 'P2::', qty: 10, estimatedQty: 3 }];
const C = compileScope([fn('mgrConfidence'), fn('mgrMoveBody'), fn('mgrPipsFromRate'), fn('mgrPipsFromDeliveries'), fn('mgrPipsFromAge'),
  fn('mgrPipsFromEstimateShare'), fn('chaseRate'), fn('anCostConfidence'), fn('anShiftDate')], {
  todayISO: () => TODAY, mgrMemo: (n, f) => f(), chaseResponse: () => READING, supplierLeadTimes: () => LEADS,
  rivalPriceLatest: (pid) => RIVALS[pid] || [], buyKeyParts: (k) => ({ productId: k, variantIdx: null }),
  anRowsByItem: () => ITEMS, anInvoicesInRange: () => [], supplierName: (id) => id,
  mgrLineSupplier: (k) => (k === 'P1' ? { supplierId: 'S1', from: 'its last delivery' } : null),
}, ['mgrConfidence', 'mgrPipsFromRate']);
{
  /* A rate reads by the middle of its 95% range (Wilson):
       3 of 4   → 0.628 × 5 = 3.1 → 3
       4 of 4   → 0.755 × 5 = 3.8 → 4
       9 of 10  → 0.789 × 5 = 3.9 → 4
       0 of 3   → 0.281 × 5 = 1.4 → 1
       20 of 20 → 0.919 × 5 = 4.6 → 5 */
  eq([[3, 4], [4, 4], [9, 10], [0, 3], [20, 20]].map(([k, n]) => C.mgrPipsFromRate(k, n)), [3, 4, 4, 1, 5],
    'a small run is pulled toward even; only a long unbroken one earns five');
  eq(C.mgrPipsFromRate(0, 0), null, 'no evidence is not a pip');

  const chase = C.mgrConfidence({ mkind: 'chase', subject: { customerId: 'C1' } });
  eq([chase.pips, chase.source, chase.basis], [3, 'counted', 'from 4 chases'], 'a chase is counted from the customer\'s chases');
  eq(C.mgrConfidence({ mkind: 'chase', subject: { customerId: 'C3' }, confidence: 2 }).pips, 5,
    'and the books overrule the meeting\'s own guess when they hold evidence');

  const buy = C.mgrConfidence({ mkind: 'buy', subject: { key: 'P1' } });
  eq([buy.pips, buy.source, buy.basis], [5, 'counted', 'from 42 deliveries'], 'a buy by the deliveries from the line\'s supplier');
  eq(C.mgrConfidence({ mkind: 'buy', subject: { supplierId: 'S2' } }).basis, 'from 1 delivery', 'one delivery says so');
  eq(C.mgrConfidence({ mkind: 'buy', subject: { supplierId: 'S2' } }).pips, 1, 'and earns one pip');

  /* Price on P2: a rival seen 120 days ago (1 pip), and 3 of 10 units
     costed by estimate, a share of 0.3 (2 pips). The weakest wins: 1. */
  const price = C.mgrConfidence({ mkind: 'price', subject: { key: 'P2' } });
  eq([price.pips, price.basis, price.evidence.map((e) => [e.what, e.pips])], [1, 'from a rival price 120 days old', [['rival', 1], ['cost', 2]]],
    'a price by the freshest rival sighting and the share costed by estimate — the weakest wins');
  const p1 = C.mgrConfidence({ mkind: 'price', subject: { key: 'P1' } });
  eq([p1.pips, p1.basis], [5, 'from a rival price 3 days old'], 'a fresh sighting and every unit costed is five');

  /* Track record: done 5 times, an event followed in 2 → (2 of 5)
     middle 0.43 → 2.1 → 2. Weaker than the chases' 3, so it binds. */
  const track = { rows: [{ kind: 'chase', id: 'C1', completedScored: 5, completedObserved: 2 }] };
  const withTrack = C.mgrConfidence({ mkind: 'chase', subject: { customerId: 'C1' } }, { track });
  eq([withTrack.pips, withTrack.basis], [2, 'from 5 times done before'], 'the lever\'s own record is counted too, and can bind');
}

/* ---------- 4. how sure: judged, or not known -------------------------- */
{
  const judged = C.mgrConfidence({ mkind: 'other', confidence: 4 });
  eq([judged.pips, judged.source, judged.basis], [4, 'judged', 'the Manager\'s judgement'],
    'with nothing counted, the meeting\'s own 1-5 — labelled as its judgement');
  eq(C.mgrConfidence({ mkind: 'other', confidence: 9 }).source, null, 'an out-of-range judgement is not a judgement');
  const none = C.mgrConfidence({ mkind: 'settle', subject: { supplierId: 'S9' } });
  eq([none.pips, none.source], [null, null], 'neither: not known, never a made-up pip');
  eq(C.mgrConfidence({ body: { mkind: 'chase', subject: { customerId: 'C1' } } }).pips, 3, 'a row and its body read the same');
}

process.exit(t.done() ? 1 : 0);
