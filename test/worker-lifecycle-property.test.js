#!/usr/bin/env node
'use strict';
/*
 * The pick-and-pack lifecycle, under randomised sequences of real operations.
 *
 * Nearly every bug found in this app has been the same shape: an order left
 * in a state nobody could act on. Accepting a second pick stranded the
 * first. A re-pick arrived already picked. A refresh mid-picker discarded a
 * finished one. Deleting the worker -- then the driver -- left the order
 * pointing at somebody gone. Nudging the board forward left the picker
 * holding an order they could not finish and could not put down.
 *
 * Each was found by reasoning about one path, and each fix was verified on
 * the path it came from. This does the opposite: it runs the real routines
 * in random order against one shared state and checks, after EVERY step,
 * the things that must be true of an order regardless of what happened:
 *
 *   I1  an order held by a worker is held by a worker who exists
 *   I2  a pick in progress belongs to an order still being prepared
 *   I3  no worker holds two open picks at once
 *   I4  an order in Being Prepared can always be moved by somebody
 *   I5  a picked quantity never exceeds what was ordered
 *   I6  an answered line has a number, an unanswered one has none
 *   I7  an order out for delivery has somebody to deliver it
 *
 * I4 is the one that matters. It is the stranding, stated positively: for
 * every order sitting in Being Prepared there is either a worker who can
 * see it in their app, or an admin affordance on the board to reassign it.
 * Neither existing has been the bug, over and over.
 *
 * An invariant set is only as good as the failures it has been shown to
 * catch, so it is measured against the real ones at the bottom.
 *
 * Run: node test/worker-lifecycle-property.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('worker lifecycle (property)');
const sharedJs = read('shared-worker.js');
const adminHtml = read('index.html');

/* ---------- the world ------------------------------------------------- */
const data = { savedQuotes: [], staff: [], agents: [], products: [], suppliers: [] };
let myStaff = null;
const seen = { toasts: [] };

const SOURCES = [
  "const SQ_STATUS_ORDER = ['draft','preparing','pending_delivery','completed'];",
  "const SQ_STATUSES = {draft:{label:'Draft'},preparing:{label:'Being Prepared'},pending_delivery:{label:'Pending Delivery'},completed:{label:'Completed'}};",
  "const STAGE_ASSIGNMENT_ROLE = { preparing:'worker', pending_delivery:'delivery' };",
  "const STAGE_ASSIGNMENT_FIELD = { worker:'assignedWorkerId', delivery:'assignedDeliveryId' };",
  extractDeclaration(sharedJs, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
  extractDeclaration(sharedJs, 'PICK_ANSWERED', 'shared-worker.js'),
  // Awaiting Goods: an order cannot be picked while any of it is still
  // in a supplier's shop, so the rule that decides that comes too.
  extractFunction(sharedJs, 'orderLineIsBoughtIn', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteLineReceived', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteLineComesOffShelf', 'shared-worker.js'),
  extractFunction(sharedJs, 'orderIncomingLines', 'shared-worker.js'),
  extractFunction(sharedJs, 'orderAwaitsGoods', 'shared-worker.js'),
  extractFunction(sharedJs, 'goodsBlockPreparing', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteAgedOffBoard', 'shared-worker.js'),
  extractFunction(sharedJs, 'agentPaymentBlocksPreparing', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemPickAnswered', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemOrderedQty', 'shared-worker.js'),
  extractFunction(sharedJs, 'itemPickedQty', 'shared-worker.js'),
  extractFunction(sharedJs, 'pickShortfallLines', 'shared-worker.js'),
  extractFunction(sharedJs, 'resetPickingProgress', 'shared-worker.js'),
  extractFunction(sharedJs, 'myWorkerOrders', 'shared-worker.js'),
  extractFunction(sharedJs, 'orderIsMine', 'shared-worker.js'),
  extractFunction(sharedJs, 'acceptOrderAssignment', 'shared-worker.js'),
  extractFunction(sharedJs, 'denyOrderAssignment', 'shared-worker.js'),
  extractFunction(sharedJs, 'toggleItemPickedAt', 'shared-worker.js'),
  extractFunction(sharedJs, 'setItemPickedQty', 'shared-worker.js'),
  extractFunction(sharedJs, 'autoAssignNextOrder', 'shared-worker.js'),
  extractFunction(adminHtml, 'setSavedQuoteStatus', 'index.html'),
  extractFunction(adminHtml, 'stepSavedQuoteStatus', 'index.html'),
  extractFunction(adminHtml, 'orderNeedsWorker', 'index.html'),
  extractFunction(adminHtml, 'orderNeedsDelivery', 'index.html'),
  // Trips go back on the list when their worker is deleted.
  extractFunction(read('shared-worker.js'), 'tripIsLive', 'shared-worker.js'),
  extractFunction(adminHtml, 'releaseTripsForStaff', 'index.html'),
  extractFunction(adminHtml, 'deleteStaff', 'index.html'),
];
const NAMES = ['myWorkerOrders', 'acceptOrderAssignment', 'denyOrderAssignment',
  'toggleItemPickedAt', 'setItemPickedQty', 'autoAssignNextOrder', 'setSavedQuoteStatus',
  'stepSavedQuoteStatus', 'orderNeedsWorker', 'orderNeedsDelivery', 'deleteStaff',
  'itemPickedQty', 'itemPickAnswered', 'itemOrderedQty', 'pickShortfallLines',
  'resetPickingProgress', 'quoteAgedOffBoard', '__setMyStaff'];

const scope = compileScope(SOURCES.concat(['function __setMyStaff(s){ myStaff = s; }']), {
  data,
  myStaff,
  saveData: () => {},
  renderWorkerView: () => {},
  renderSavedQuotes: () => {},
  renderStaff: () => {},
  refreshAdminOrderBoardIfOpen: () => {},
  toast: (m) => { seen.toasts.push(m); },
  confirm: () => true,
  promptPickedQty: () => {},
  promptAgentPrepayment: () => {},
  // The staff picker is a modal; the property test drives the choice it
  // would have produced, which is what openAssignStaffModal writes.
  openAssignStaffModal: () => {},
}, NAMES);

/* ---------- invariants ------------------------------------------------ */
const staffExists = (id) => data.staff.some((s) => s.id === id);
const HOLDING = ['awaiting_accept', 'in_progress'];

// I4 and I7 say "nobody can see it AND the board offers nothing". They are
// therefore contingent on the board's affordances, and cannot fire while
// those work -- which is the point, but it means the usual "show it rejects
// a bad state" check would be measuring nothing. Routed through here so the
// vacuity section can switch the affordance off and prove each one fires on
// the state it is actually about.
const AFFORDANCE = {
  worker: (q) => scope.orderNeedsWorker(q),
  delivery: (q) => scope.orderNeedsDelivery(q),
};

const INVARIANTS = {
  I1: () => data.savedQuotes
    .filter((q) => !q.voided && HOLDING.includes(q.pickingStatus) && q.assignedWorkerId)
    .filter((q) => !staffExists(q.assignedWorkerId))
    .map((q) => `order ${q.id} is held by ${q.assignedWorkerId}, who is not on staff`),

  I2: () => data.savedQuotes
    .filter((q) => !q.voided && q.pickingStatus === 'in_progress')
    .filter((q) => q.status !== 'preparing' && q.status !== 'draft')
    .map((q) => `order ${q.id} is being picked but sits in ${q.status}`),

  I3: () => {
    const byWorker = {};
    data.savedQuotes.filter((q) => !q.voided && q.pickingStatus === 'in_progress' && q.assignedWorkerId)
      .forEach((q) => { (byWorker[q.assignedWorkerId] = byWorker[q.assignedWorkerId] || []).push(q.id); });
    return Object.entries(byWorker).filter(([, ids]) => ids.length > 1)
      .map(([w, ids]) => `${w} holds ${ids.length} open picks (${ids.join(', ')})`);
  },

  // The stranding, stated positively.
  I4: () => data.savedQuotes
    .filter((q) => !q.voided && q.status === 'preparing' && !scope.quoteAgedOffBoard(q))
    .filter((q) => {
      // Somebody can see it in their app...
      const visibleToWorker = HOLDING.includes(q.pickingStatus)
        && q.assignedWorkerId && staffExists(q.assignedWorkerId);
      // ...or the board offers a way to put it on somebody.
      return !visibleToWorker && !AFFORDANCE.worker(q);
    })
    .map((q) => `order ${q.id} (worker ${q.assignedWorkerId}, picking ${q.pickingStatus}) can be moved by nobody`),

  // The STORED number, not what itemPickedQty reads back. That function
  // clamps -- Math.min(ordered, n) -- so an invariant keyed on it can never
  // fire, which is how the first version of this test passed while the
  // regression below sat right in front of it. The clamp is a good defence
  // at the read; this is the check that the write kept its side of it.
  I5: () => {
    const bad = [];
    data.savedQuotes.forEach((q) => (q.items || []).forEach((it, i) => {
      if (it.pickedQty != null && Number(it.pickedQty) > scope.itemOrderedQty(it)) {
        bad.push(`order ${q.id} line ${i} stores ${it.pickedQty} picked of ${scope.itemOrderedQty(it)} ordered`);
      }
      if (it.pickedQty != null && Number(it.pickedQty) < 0) {
        bad.push(`order ${q.id} line ${i} stores a negative picked quantity`);
      }
    }));
    return bad;
  },

  I6: () => {
    const bad = [];
    data.savedQuotes.forEach((q) => (q.items || []).forEach((it, i) => {
      const answered = scope.itemPickAnswered(it);
      if (answered && scope.itemPickedQty(it) == null) bad.push(`order ${q.id} line ${i} answered with no number`);
      if (!answered && it.pickedQty != null) bad.push(`order ${q.id} line ${i} unanswered but carries ${it.pickedQty}`);
    }));
    return bad;
  },

  I7: () => data.savedQuotes
    .filter((q) => !q.voided && q.status === 'pending_delivery' && !scope.quoteAgedOffBoard(q))
    .filter((q) => {
      const named = q.assignedDeliveryId
        && (q.assignedDeliveryId === '__agent__' || staffExists(q.assignedDeliveryId));
      return !named && !AFFORDANCE.delivery(q);
    })
    .map((q) => `order ${q.id} is out for delivery with nobody on it and no way to name one`),
};

/* ---------- operations ------------------------------------------------ */
let rng = 20260803;
const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
const pick = (arr) => (arr.length ? arr[Math.floor(rand() * arr.length)] : null);

const OPS = {
  adminAssignsWorker: () => {
    const q = pick(data.savedQuotes.filter((x) => !x.voided && x.status === 'preparing' && scope.orderNeedsWorker(x)));
    const s = pick(data.staff.filter((x) => x.role === 'worker'));
    if (!q || !s) return;
    // Exactly what openAssignStaffModal's row handler writes.
    q.assignedWorkerId = s.id;
    q.pickingStatus = 'awaiting_accept';
    q.pickCursor = 0;
    q.pickingAssignedAt = Date.now();
    scope.setSavedQuoteStatus(q.id, 'preparing');
  },
  workerAccepts: () => {
    const q = pick(data.savedQuotes.filter((x) => x.pickingStatus === 'awaiting_accept'));
    if (!q) return;
    scope.__setMyStaff(data.staff.find((s) => s.id === q.assignedWorkerId) || null);
    scope.acceptOrderAssignment(q.id);
  },
  workerDenies: () => {
    const q = pick(data.savedQuotes.filter((x) => x.pickingStatus === 'awaiting_accept'));
    if (!q) return;
    scope.__setMyStaff(data.staff.find((s) => s.id === q.assignedWorkerId) || null);
    scope.denyOrderAssignment(q.id);
  },
  workerPicksLine: () => {
    const q = pick(data.savedQuotes.filter((x) => x.pickingStatus === 'in_progress'));
    if (!q || !(q.items || []).length) return;
    scope.toggleItemPickedAt(q.id, Math.floor(rand() * q.items.length));
  },
  workerRecordsShortfall: () => {
    const q = pick(data.savedQuotes.filter((x) => x.pickingStatus === 'in_progress'));
    if (!q || !(q.items || []).length) return;
    const i = Math.floor(rand() * q.items.length);
    scope.setItemPickedQty(q.id, i, Math.floor(rand() * (scope.itemOrderedQty(q.items[i]) + 2)));
  },
  adminStepsForward: () => {
    const q = pick(data.savedQuotes.filter((x) => !x.voided));
    if (!q) return;
    // The board's forward step hands off to a picker for the role-gated
    // stages; drive the outcome that picker produces.
    const role = { preparing: 'worker', pending_delivery: 'delivery' }[
      ['draft', 'preparing', 'pending_delivery', 'completed'][
        ['draft', 'preparing', 'pending_delivery', 'completed'].indexOf(q.status) + 1] || ''];
    if (role === 'worker') { OPS.adminAssignsWorker(); return; }
    if (role === 'delivery') {
      const d = pick(data.staff.filter((s) => s.role === 'delivery' || s.role === 'worker'));
      if (!d) return;
      q.assignedDeliveryId = d.id;
      scope.setSavedQuoteStatus(q.id, 'pending_delivery');
      return;
    }
    scope.stepSavedQuoteStatus(q.id, +1);
  },
  adminStepsBack: () => {
    const q = pick(data.savedQuotes.filter((x) => !x.voided));
    if (q) scope.stepSavedQuoteStatus(q.id, -1);
  },
  adminDeletesStaff: () => {
    const s = pick(data.staff);
    if (s) scope.deleteStaff(s.id);
  },
  adminHiresStaff: () => {
    const n = data.staff.length + 1;
    data.staff.push({ id: `ST${n}${Math.floor(rand() * 900)}`, name: `Hire ${n}`, role: rand() < 0.6 ? 'worker' : 'delivery' });
  },
  autoAssign: () => {
    const s = pick(data.staff.filter((x) => x.role === 'worker'));
    if (s) scope.autoAssignNextOrder(s.id);
  },
  adminVoids: () => {
    const q = pick(data.savedQuotes.filter((x) => !x.voided));
    if (q) q.voided = true;
  },
};
const OP_NAMES = Object.keys(OPS);

function freshWorld() {
  data.savedQuotes = [];
  data.staff = [
    { id: 'ST1', name: 'Emma', role: 'worker' },
    { id: 'ST2', name: 'Brenda', role: 'worker' },
    { id: 'ST9', name: 'Grace', role: 'delivery' },
  ];
  data.agents = [{ id: 'AG1', name: 'Peter', paymentTerm: 'prepay' }];
  for (let i = 0; i < 4; i++) {
    data.savedQuotes.push({
      id: 100 + i,
      client: { name: `Client ${i}` },
      date: '2026-08-03',
      savedAt: '2026-08-03T09:00:00Z',
      items: Array.from({ length: 1 + Math.floor(rand() * 3) }, (_, j) => ({
        productId: `P${j}`, variantIdx: null, productName: `Item ${j}`, unit: 'pc',
        qty: 1 + Math.floor(rand() * 6), supplierId: '__stock__',
        price: 100, sellPrice: 200, pickStatus: 'pending', pickedQty: null,
      })),
      status: 'preparing',
      assignedWorkerId: null, assignedDeliveryId: null,
      invoiced: false, invoicedTs: null, amountPaid: 0, payments: [], voided: false,
      stageEnteredAt: Date.now() - Math.floor(rand() * 3600000),
      pickingStatus: null, pickCursor: 0, deliveryMode: 'shop_delivery',
    });
  }
}

function run(steps) {
  freshWorld();
  const log = [];
  for (let i = 0; i < steps; i++) {
    const op = OP_NAMES[Math.floor(rand() * OP_NAMES.length)];
    log.push(op);
    try { OPS[op](); } catch (e) { return { broke: `${op} threw: ${e.message}`, log }; }
    for (const [name, check] of Object.entries(INVARIANTS)) {
      const bad = check();
      if (bad.length) return { broke: `${name}: ${bad[0]}`, log };
    }
  }
  return { broke: null, log };
}

/* ---------- 1. the lifecycle holds ------------------------------------ */
{
  let failure = null;
  const RUNS = 60, STEPS = 40;
  for (let r = 0; r < RUNS && !failure; r++) {
    const out = run(STEPS);
    if (out.broke) failure = `${out.broke}\n         after: ${out.log.slice(-8).join(' -> ')}`;
  }
  t.check(!failure, failure || `${RUNS} random lifecycles of ${STEPS} operations hold all 7 invariants`);
}

/* ---------- 2. and the invariants are not vacuous --------------------- */
/*
 * A property test that cannot fail proves nothing. Each invariant is shown
 * to reject a state that really did occur in this app.
 */
{
  const cases = [
    ['I1', 'an order held by a deleted worker', () => {
      freshWorld();
      data.savedQuotes[0].assignedWorkerId = 'ST_GONE';
      data.savedQuotes[0].pickingStatus = 'in_progress';
    }],
    ['I2', 'a pick still in progress on an order moved to Pending Delivery', () => {
      freshWorld();
      Object.assign(data.savedQuotes[0], { status: 'pending_delivery', pickingStatus: 'in_progress', assignedWorkerId: 'ST1' });
    }],
    ['I3', 'one worker holding two open picks', () => {
      freshWorld();
      data.savedQuotes.slice(0, 2).forEach((q) => { q.assignedWorkerId = 'ST1'; q.pickingStatus = 'in_progress'; });
    }],
    ['I4', 'an order in Being Prepared nobody can move', () => {
      freshWorld();
      // pickingStatus 'done' is in neither of the worker app's lists, and a
      // named worker means the board offers no Assign either.
      Object.assign(data.savedQuotes[0], { status: 'preparing', assignedWorkerId: 'ST1', pickingStatus: 'done' });
    }],
    ['I5', 'a line picked above what was ordered', () => {
      freshWorld();
      Object.assign(data.savedQuotes[0].items[0], { qty: 5, pickStatus: 'short', pickedQty: 9 });
    }],
    ['I6', 'an unanswered line carrying a number', () => {
      freshWorld();
      Object.assign(data.savedQuotes[0].items[0], { pickStatus: 'pending', pickedQty: 3 });
    }],
    ['I7', 'an order out for delivery with a driver who has left', () => {
      freshWorld();
      Object.assign(data.savedQuotes[0], { status: 'pending_delivery', assignedDeliveryId: 'ST_GONE' });
    }],
  ];

  const vacuous = [];
  cases.forEach(([name, what, setup]) => {
    setup();
    // I4 and I7 are conjunctions: nobody can see it AND the board offers
    // nothing. With the affordance working they cannot fire, which is the
    // whole point of the affordance -- so asserting they stay silent would
    // measure nothing at all. Switched off for these two, the state itself
    // is what has to be rejected.
    const contingent = { I4: 'worker', I7: 'delivery' }[name];
    let bad;
    if (contingent) {
      const real = AFFORDANCE[contingent];
      AFFORDANCE[contingent] = () => false;
      bad = INVARIANTS[name]();
      AFFORDANCE[contingent] = real;
      // ...and with it back on, the same state is covered. That is the
      // affordance doing its job, asserted rather than assumed.
      if (INVARIANTS[name]().length) vacuous.push(`${name}: the board offers nothing for: ${what}`);
    } else {
      bad = INVARIANTS[name]();
    }
    if (!bad.length) vacuous.push(`${name} did not reject: ${what}`);
  });
  t.check(vacuous.length === 0,
    vacuous.length ? vacuous.join('; ') : 'every invariant rejects a state this app has actually produced, and the two contingent ones are covered by the board when it is working');
}

/* ---------- 3. measured against the bugs it is meant to catch --------- */
/*
 * The real test of an invariant set. Each of these shipped, was reported or
 * found, and was fixed in its own commit -- reproduced here as raw state to
 * confirm the property would have caught it without anyone reasoning about
 * the path that produced it.
 */
{
  const REGRESSIONS = [
    ['0f31c2c  accepting a second pick stranded the first', () => {
      freshWorld();
      data.savedQuotes.slice(0, 2).forEach((q) => { q.assignedWorkerId = 'ST1'; q.pickingStatus = 'in_progress'; });
    }],
    ['6e64103  an order sent back kept a pick nobody could see', () => {
      freshWorld();
      Object.assign(data.savedQuotes[0], { status: 'preparing', assignedWorkerId: 'ST1', pickingStatus: 'done' });
    }],
    ['8d7ba0a  deleting the worker left the order pointing at them', () => {
      freshWorld();
      Object.assign(data.savedQuotes[0], { assignedWorkerId: 'ST_GONE', pickingStatus: 'in_progress' });
    }],
    ['cd18aa2  nudging the board forward trapped the picker', () => {
      freshWorld();
      Object.assign(data.savedQuotes[0], { status: 'pending_delivery', pickingStatus: 'in_progress', assignedWorkerId: 'ST1' });
    }],
    ['short pick  a number above what was ordered', () => {
      freshWorld();
      Object.assign(data.savedQuotes[0].items[0], { qty: 5, pickStatus: 'short', pickedQty: 12 });
    }],
  ];

  // Evaluated with the board's affordances switched off, because that is the
  // honest question: does the invariant set see the bad STATE? Every one of
  // these shipped before the Assign button existed, and some are now covered
  // by it -- which is a fix, not a reason to stop detecting the state.
  const missed = [];
  const realWorker = AFFORDANCE.worker;
  const realDelivery = AFFORDANCE.delivery;
  AFFORDANCE.worker = () => false;
  AFFORDANCE.delivery = () => false;
  REGRESSIONS.forEach(([label, setup]) => {
    setup();
    const caught = Object.entries(INVARIANTS).some(([, check]) => check().length > 0);
    if (!caught) missed.push(label);
  });
  AFFORDANCE.worker = realWorker;
  AFFORDANCE.delivery = realDelivery;
  t.check(missed.length === 0,
    missed.length
      ? `${missed.length} of ${REGRESSIONS.length} real bugs would pass unnoticed: ${missed.join('; ')}`
      : `all ${REGRESSIONS.length} of the real stranding bugs are caught by these invariants`);
}

process.exit(t.done() ? 1 : 0);
