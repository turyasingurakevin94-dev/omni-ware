#!/usr/bin/env node
'use strict';
/*
 * What is going the same way.
 *
 * The Pending Delivery column lists orders. A driver planning a morning
 * needs the other reading of that same list -- three of these are in
 * Ntinda, so they are one trip -- and there was no way to see it without
 * opening every card.
 *
 * Where an order is going, in the order the answer is actually known:
 *
 *   agent order   the address the agent typed for their own client. Their
 *                 client is deliberately never in `customers`
 *                 (0012_sales_agents.sql), so there is nothing else to go
 *                 on -- and if that client's name happened to match a shop
 *                 customer's, that customer's location would be the wrong
 *                 answer. Checked FIRST for exactly that reason.
 *   shop order    the customer's location, the field we actually maintain.
 *   neither       a delivery address typed on the order itself.
 *
 * And two ways to have no destination at all, which look identical on a
 * board and mean opposite things:
 *
 *   collected     the agent is picking it up. Settled; nothing to plan.
 *   no address    somebody has to be rung. A chore, not a state.
 *
 * Filing those together was a real fault in the first cut of this screen:
 * a self-pickup order sat under "cannot be planned until somebody has an
 * address", which is false and turns finished business into a task.
 *
 * Run: node test/admin-delivery-runs.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('admin delivery runs');
const src = read('index.html');
const sharedJs = read('shared-worker.js');

const data = { savedQuotes: [], customers: [], staff: [], products: [] };
const modal = {};

const scope = compileScope([
  extractDeclaration(sharedJs, 'SQ_BOARD_HIDE_AFTER_MS', 'shared-worker.js'),
  extractFunction(sharedJs, 'quoteAgedOffBoard', 'shared-worker.js'),
  extractFunction(src, 'orderCustomerLocation', 'index.html'),
  extractFunction(src, 'orderIsCollected', 'index.html'),
  extractFunction(src, 'orderDestination', 'index.html'),
  extractFunction(src, 'destinationKey', 'index.html'),
  // orderNeedsDelivery asks this whether somebody outside the shop
  // is carrying it, so the scope has to hold it too.
  extractDeclaration(src, 'DELIVERY_SELF_CARRIERS', 'index.html'),
  extractFunction(src, 'deliveryIsSelfCarried', 'index.html'),
  extractFunction(src, 'orderNeedsDelivery', 'index.html'),
  extractFunction(src, 'deliveryRuns', 'index.html'),
  extractFunction(src, 'pendingDeliveryOrders', 'index.html'),
  extractFunction(src, 'otDuration', 'index.html'),
  extractFunction(src, 'otStageSince', 'index.html'),
  extractFunction(src, 'orderOutPanelHTML', 'index.html'),
], {
  data,
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
  esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  ICON_ROUTE: '<svg data-i="route"></svg>', ICON_PIN: '<svg data-i="pin"></svg>',
  ICON_GO: '<svg data-i="go"></svg>',
  ICON_WARN: '<svg data-i="warn"></svg>', ICON_TRUCK: '<svg data-i="truck"></svg>',
  openModal: (id) => { modal.opened = id; },
  quoteClientName: (q) => (q.client && q.client.name) || 'Unnamed client',
  deliveryAssigneeLabel: (q) => (q.assignedDeliveryId ? 'Kasule' : ''),
}, ['orderDestination', 'orderIsCollected', 'destinationKey', 'deliveryRuns',
  'pendingDeliveryOrders', 'orderOutPanelHTML']);

const order = (over) => Object.assign({
  id: 900, client: { name: 'Moses' }, date: '2026-08-03', status: 'pending_delivery',
  items: [{ qty: 10, sellPrice: 45000 }], voided: false, invoiced: false, invoicedTs: null,
  customerId: null, assignedDeliveryId: null, deliveryMode: 'shop_delivery',
  deliveryAddress: '', originAgentId: null, stageEnteredAt: Date.now(),
}, over);

const reset = () => { data.savedQuotes = []; data.customers = []; data.staff = []; };

/* ---------- 1. where an order is going -------------------------------- */
{
  reset();
  data.customers = [{ id: 'k1', name: 'Moses', location: 'Ntinda' }];

  t.check(scope.orderDestination(order({ customerId: 'k1' })) === 'Ntinda',
    "a shop order goes to its customer's location");
  t.check(scope.orderDestination(order({ client: { name: 'Moses' } })) === 'Ntinda',
    'matched by name when no customer is linked, the way the rest of the app matches one');
  t.check(scope.orderDestination(order({ client: { name: 'Nobody' }, deliveryAddress: 'Plot 14 Ntinda' })) === 'Plot 14 Ntinda',
    'a walk-in with no customer record falls back to the address typed on the order');

  // The agent case, and the collision it is ordered to avoid.
  t.check(scope.orderDestination(order({ originAgentId: 'AG1', deliveryAddress: 'Kisenyi' })) === 'Kisenyi',
    'an agent order goes to the address the agent typed');
  t.check(scope.orderDestination(order({ originAgentId: 'AG1', client: { name: 'Moses' }, deliveryAddress: 'Kisenyi' })) === 'Kisenyi',
    "even when the agent's client shares a name with a shop customer -- that customer's location is not where it is going");
  t.check(scope.orderDestination(order({ originAgentId: 'AG1', deliveryAddress: '   ' })) === null,
    'an agent order with nothing typed has no destination rather than a blank one');
}

/* ---------- 2. no destination is two different things ----------------- */
{
  reset();
  const collected = order({ id: 1, deliveryMode: 'agent_pickup' });
  const sentinel = order({ id: 2, assignedDeliveryId: '__agent__' });
  const noAddress = order({ id: 3, client: { name: 'Wilson' } });

  t.check(scope.orderIsCollected(collected) && scope.orderIsCollected(sentinel),
    'an order the agent collects is recognised by either the mode or the sentinel');
  t.check(!scope.orderIsCollected(noAddress), 'while one with no address is not being collected, it is unaddressed');
  t.check(scope.orderDestination(collected) === null && scope.orderDestination(noAddress) === null,
    'neither has a destination...');

  const { collected: c, unknown: u } = scope.deliveryRuns([collected, sentinel, noAddress]);
  t.check(c.length === 2 && u.length === 1,
    `...but they are kept apart (${c.length} collected, ${u.length} unaddressed)`);
  t.check(u[0].id === 3,
    'so a settled self-pickup is never listed as something somebody has to chase an address for');
}

/* ---------- 3. the same place, spelled differently -------------------- */
{
  t.check(scope.destinationKey('Ntinda') === scope.destinationKey('ntinda '),
    'case and stray spaces do not make a second destination');
  t.check(scope.destinationKey('Plot  14   Ntinda') === scope.destinationKey('Plot 14 Ntinda'),
    'nor does a doubled space in the middle');
  t.check(scope.destinationKey('Ntinda') !== scope.destinationKey('Nakawa'), 'while two places stay two');

  reset();
  data.customers = [{ id: 'k1', name: 'A', location: 'Ntinda' }, { id: 'k2', name: 'B', location: 'ntinda ' }];
  const { runs } = scope.deliveryRuns([
    order({ id: 1, customerId: 'k1' }), order({ id: 2, customerId: 'k2' })]);
  t.check(runs.length === 1 && runs[0].orders.length === 2, 'so both orders land in one run');
  t.check(runs[0].label === 'Ntinda',
    'labelled how somebody actually typed it, not normalised into something nobody wrote');
}

/* ---------- 4. runs are ordered by what makes a trip worth it --------- */
{
  reset();
  data.customers = [
    { id: 'k1', name: 'A', location: 'Ntinda' }, { id: 'k2', name: 'B', location: 'Ntinda' },
    { id: 'k3', name: 'C', location: 'Ntinda' }, { id: 'k4', name: 'D', location: 'Kisenyi' },
    { id: 'k5', name: 'E', location: 'Kisenyi' }, { id: 'k6', name: 'F', location: 'Nakawa' }];
  const { runs } = scope.deliveryRuns([
    order({ id: 6, customerId: 'k6' }),
    order({ id: 4, customerId: 'k4' }), order({ id: 5, customerId: 'k5' }),
    order({ id: 1, customerId: 'k1' }), order({ id: 2, customerId: 'k2' }), order({ id: 3, customerId: 'k3' })]);

  t.check(runs.map((r) => r.label).join(',') === 'Ntinda,Kisenyi,Nakawa',
    `most orders first, because that is what makes combining worth doing (${runs.map((r) => `${r.label}:${r.orders.length}`).join(' ')})`);
  t.check(runs[0].value === 3 * 450000, 'each run carries what it is worth');
  t.check(runs[2].orders.length === 1,
    'and a destination with one order is still a run -- the column has to add up');

  // Count beats value, and the two have to actually disagree for that to
  // mean anything: two orders worth ten times as much still make one trip,
  // and one trip of three is the thing worth combining.
  const rich = scope.deliveryRuns([
    order({ id: 1, customerId: 'k1' }), order({ id: 2, customerId: 'k2' }), order({ id: 3, customerId: 'k3' }),
    order({ id: 4, customerId: 'k4', items: [{ qty: 100, sellPrice: 500000 }] }),
    order({ id: 5, customerId: 'k5', items: [{ qty: 100, sellPrice: 500000 }] })]).runs;
  t.check(rich[0].label === 'Ntinda' && rich[0].orders.length === 3,
    `three cheap drops outrank two rich ones (${rich.map((r) => `${r.label}:${r.orders.length}@${r.value}`).join(' ')})`);
  t.check(rich[1].value > rich[0].value,
    'even though the run below it is worth more, because this screen is about trips, not takings');
}

/* ---------- 5. what the run says about itself ------------------------- */
{
  reset();
  data.staff = [{ id: 'ST8', name: 'Alice' }, { id: 'ST9', name: 'Musa' }];
  data.customers = [{ id: 'k1', name: 'A', location: 'Ntinda' }, { id: 'k2', name: 'B', location: 'Ntinda' }];

  const split = scope.deliveryRuns([
    order({ id: 1, customerId: 'k1', assignedDeliveryId: 'ST8' }),
    order({ id: 2, customerId: 'k2', assignedDeliveryId: 'ST9' })]).runs[0];
  t.check(split.drivers.length === 2,
    'a run split across two drivers says so -- one destination, two vans, which is the thing worth noticing');
  t.check(split.unassigned === 0, 'with nobody outstanding');

  const bare = scope.deliveryRuns([
    order({ id: 1, customerId: 'k1', assignedDeliveryId: 'ST9' }),
    order({ id: 2, customerId: 'k2' })]).runs[0];
  t.check(bare.unassigned === 1,
    'and a run counts how many of it still have nobody, since one driver could take the lot');
  t.check(bare.drivers.length === 1, 'counting only drivers actually on it');
}

/* ---------- 6. which orders are in scope ------------------------------ */
{
  reset();
  data.customers = [{ id: 'k1', name: 'A', location: 'Ntinda' }];
  data.savedQuotes = [
    order({ id: 1, customerId: 'k1' }),
    order({ id: 2, customerId: 'k1', status: 'preparing' }),
    order({ id: 3, customerId: 'k1', status: 'completed' }),
    order({ id: 4, customerId: 'k1', voided: true }),
    order({ id: 5, customerId: 'k1', invoiced: true, invoicedTs: Date.now() - 3 * 24 * 3600 * 1000 }),
  ];
  const ids = scope.pendingDeliveryOrders().map((q) => q.id);
  t.check(JSON.stringify(ids) === '[1]',
    `only live orders waiting to go out are grouped (got ${JSON.stringify(ids)})`);
}

/* ---------- 7. the rail's out-for-delivery panel ---------------------- */
{
  reset();
  data.customers = [
    { id: 'k1', name: 'A', location: 'Ntinda' }, { id: 'k2', name: 'B', location: 'Ntinda' },
    { id: 'k3', name: 'C', location: 'Nakawa' }];

  const rows = (h) => (h.match(/class="ow-sr ow-sr-2"/g) || []).length;
  const places = (h) => (h.match(/([\d]+) places? to reach/) || [])[1];

  t.check(/Nothing is out for delivery/.test(scope.orderOutPanelHTML([])), 'an empty board says so rather than drawing nothing');
  t.check(/Nothing is out for delivery/.test(scope.orderOutPanelHTML(undefined)),
    "and so does one that has not loaded, read off the board's own set");
  const self = scope.orderOutPanelHTML([order({ id: 1, deliveryMode: 'agent_pickup' })]);
  t.check(!places(self) && /1 collecting from the shop/.test(self),
    'a board of self-pickups has no place to reach -- the panel says who is collecting instead');

  // Every destination counts, a single order included: a place with one
  // delivery today is still a place somebody has to drive to.
  const lone = scope.orderOutPanelHTML([order({ id: 1, customerId: 'k1' })]);
  t.check(rows(lone) === 1 && places(lone) === '1', `one order to one place is one row and one place (${rows(lone)}/${places(lone)})`);
  t.check(/Ntinda/.test(lone), 'named on the row');
  t.check(/data-act="runs"/.test(lone) && /title="What is going the same way"/.test(lone),
    'and the panel opens the runs, saying what they are');

  const mixed = [order({ id: 1, customerId: 'k1' }), order({ id: 2, customerId: 'k2' }),
    order({ id: 3, customerId: 'k3' }), order({ id: 9, client: { name: 'Wilson' } })];
  const html = scope.orderOutPanelHTML(mixed);
  t.check(places(html) === '2', `two Ntinda and one Nakawa is two places (got ${places(html)})`);
  t.check(rows(html) === 4, `and four rows, the one going nowhere yet included (got ${rows(html)})`);
  t.check(/Ntinda/.test(html) && /Nakawa/.test(html), 'both named');
  t.check(/1 with no address/.test(html),
    'with the one nobody has an address for counted separately, since it is going nowhere yet');

  // Checked on the rows, not the places -- a voided order joining an
  // existing place leaves the place count identical.
  const withVoid = mixed.concat([order({ id: 10, customerId: 'k1', voided: true })]);
  t.check(rows(scope.orderOutPanelHTML(withVoid)) === 4,
    `a cancelled order joins neither a place nor the list (got ${rows(scope.orderOutPanelHTML(withVoid))})`);
  const aged = mixed.concat([order({ id: 11, customerId: 'k1', invoiced: true, invoicedTs: Date.now() - 3 * 24 * 3600 * 1000 })]);
  t.check(rows(scope.orderOutPanelHTML(aged)) === 4, 'nor does one long since aged off the board');

  // The rail is the plan, not a glance: every place is listed.
  reset();
  data.customers = ['Ntinda', 'Nakawa', 'Bwaise', 'Gayaza', 'Kisenyi']
    .map((location, i) => ({ id: 'p' + i, name: 'C' + i, location }));
  const many = data.customers.map((c, i) => order({ id: i + 1, customerId: c.id }));
  const manyHtml = scope.orderOutPanelHTML(many);
  t.check(rows(manyHtml) === 5 && places(manyHtml) === '5',
    `every place is on the rail (${rows(manyHtml)} rows, ${places(manyHtml)} places)`);
  t.check(places(manyHtml) === '5' && rows(manyHtml) === 5,
    'while the headline still covers every one of them');
}

/* ---------- 8. every place gets a card, in one sideways track --------- */
{
  reset();
  data.customers = [
    { id: 'k1', name: 'A', location: 'Ntinda' }, { id: 'k2', name: 'B', location: 'Ntinda' },
    { id: 'k3', name: 'C', location: 'Nakawa' }];
  data.savedQuotes = [
    order({ id: 1, customerId: 'k1' }), order({ id: 2, customerId: 'k2' }),
    order({ id: 3, customerId: 'k3' }),
    order({ id: 4, deliveryMode: 'agent_pickup', client: { name: 'Collected' } }),
    order({ id: 5, client: { name: 'Wilson' } })];

  const body = {};
  const runs = compileScope([
    extractFunction(src, 'openDeliveryRuns', 'index.html'),
    extractFunction(src, 'wireRunCarousel', 'index.html'),
  ], {
    pendingDeliveryOrders: scope.pendingDeliveryOrders,
    deliveryRuns: scope.deliveryRuns,
    savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
    quoteClientName: (q) => (q && q.client && q.client.name) || 'Unnamed client',
    invoiceNumberLabel: (q) => 'INV-' + String(q.id).padStart(4, '0'),
    deliveryAssigneeLabel: (q) => (q.assignedDeliveryId === '__agent__' ? 'Agent pickup' : String(q.assignedDeliveryId)),
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
    ICON_PIN: '<svg data-i="pin"></svg>', ICON_WARN: '<svg data-i="warn"></svg>',
    ICON_TRUCK: '<svg data-i="truck"></svg>', ICON_STORE: '<svg data-i="store"></svg>',
    openModal: (id) => { body.opened = id; },
    // The track is absent, so the wiring block is skipped -- this section is
    // about what gets rendered. The controls are covered structurally below.
    document: { getElementById: (id) => (id === 'deliveryRunsBody'
      ? { set innerHTML(v) { body.html = v; } }
      : null) },
  }, ['openDeliveryRuns']);

  runs.openDeliveryRuns();
  const html = body.html;
  // Bounded: dr-card-head, dr-card-name and friends all start the same way.
  const cards = (html.match(/class="dr-card[ "]/g) || []).length;

  t.check(body.opened === 'deliveryRunsModal', 'it opens its own modal');
  t.check(cards === 4,
    `one card per place plus the two that are not places (got ${cards}: Ntinda, Nakawa, collected, no-address)`);
  t.check(/Nakawa/.test(html),
    'a place with a single order gets a card of its own -- it is still somewhere somebody has to drive to');
  t.check(html.indexOf('Ntinda') < html.indexOf('Nakawa'),
    'with the fullest run first, since that is the one worth planning around');
  t.check(/dr-card collected/.test(html) && /dr-card unknown/.test(html),
    'and the two non-places ride at the end of the same track rather than in a tail nobody scrolls to');
  t.check(html.indexOf('dr-card collected') > html.indexOf('Nakawa'),
    'after every real destination');

  t.check(/class="dr-track"/.test(html) && /dr-nav prev/.test(html) && /dr-nav next/.test(html),
    'in a sideways track with a control at each end');
  t.check(/2 places<\/span>/.test(html.replace(/\s+/g, ' ')) || /2 place/.test(html),
    'headed by how many places there are to reach');

  // The per-card figures an admin plans from.
  t.check(/2 with nobody on them/.test(html),
    'a run says how many of it still have nobody driving');
  t.check(/one driver could take the whole run/.test(html),
    'and why that matters when the run has more than one drop');

  // Names come from customer records and agent-typed addresses, so they are
  // whatever somebody typed.
  reset();
  data.customers = [{ id: 'k1', name: 'X', location: '<img src=x onerror=alert(1)>' }];
  data.savedQuotes = [order({ id: 1, customerId: 'k1' })];
  runs.openDeliveryRuns();
  t.check(!/<img src=x/.test(body.html) && /&lt;img/.test(body.html),
    'a location is escaped into the card, being a string somebody typed');
}

/* ---------- 9. the slider lands on a card, however it was left -------- */
/*
 * A drag or a trackpad flick leaves the track a few pixels off a boundary
 * -- it really does; the live track rests at 2 rather than 0 because of
 * its own padding. A purely relative scroll carries that error forward
 * until a card sits half off the edge, so the nav aims at a card index
 * instead of nudging by a card's width.
 */
{
  reset();
  data.customers = ['Ntinda', 'Nakawa', 'Bwaise', 'Gayaza', 'Kisenyi']
    .map((location, i) => ({ id: 'k' + i, name: 'C' + i, location }));
  data.savedQuotes = data.customers.map((c, i) => order({ id: i + 1, customerId: c.id }));

  const CARD = 290, GAP = 12, STRIDE = CARD + GAP;
  const handlers = {};
  const track = {
    scrollLeft: 0, clientWidth: 700, scrollWidth: STRIDE * 5,
    querySelector: () => ({ getBoundingClientRect: () => ({ width: CARD }) }),
    addEventListener: (type, fn) => { handlers.scroll = fn; },
    scrollBy({ left }) {
      const max = this.scrollWidth - this.clientWidth;
      this.scrollLeft = Math.max(0, Math.min(max, this.scrollLeft + left));
      if (handlers.scroll) handlers.scroll();
    },
  };
  const buttons = { dr_prev: { disabled: false }, dr_next: { disabled: false } };
  Object.keys(buttons).forEach((id) => { buttons[id].addEventListener = (type, fn) => { handlers[id] = fn; }; });

  const runs = compileScope([extractFunction(src, 'openDeliveryRuns', 'index.html'),
    extractFunction(src, 'wireRunCarousel', 'index.html')], {
    pendingDeliveryOrders: scope.pendingDeliveryOrders,
    deliveryRuns: scope.deliveryRuns,
    savedQuoteTotal: () => 1000,
    quoteClientName: (q) => (q.client && q.client.name) || '',
    invoiceNumberLabel: (q) => 'INV-' + q.id,
    deliveryAssigneeLabel: () => 'Someone',
    esc: (s) => String(s == null ? '' : s),
    fmtUGX: (n) => String(n),
    ICON_PIN: '', ICON_WARN: '', ICON_TRUCK: '', ICON_STORE: '',
    openModal: () => {},
    getComputedStyle: () => ({ columnGap: GAP + 'px', gap: GAP + 'px' }),
    document: {
      getElementById: (id) => (id === 'deliveryRunsBody' ? { set innerHTML(v) {} }
        : id === 'dr_track' ? track : buttons[id] || null),
    },
  }, ['openDeliveryRuns']);

  runs.openDeliveryRuns();
  t.check(typeof handlers.dr_next === 'function' && typeof handlers.dr_prev === 'function',
    'both controls are wired when the track is there');
  t.check(buttons.dr_prev.disabled === true,
    'and the one that would go nowhere starts disabled, since a control that does nothing should look like it');

  handlers.dr_next();
  t.check(track.scrollLeft === STRIDE, `one tap moves exactly one card (got ${track.scrollLeft}, expected ${STRIDE})`);
  t.check(buttons.dr_prev.disabled === false, 'which re-enables going back');

  // Knocked off a boundary, as a drag leaves it.
  track.scrollLeft = STRIDE + 7;
  handlers.dr_next();
  t.check(track.scrollLeft === STRIDE * 2,
    `a tap after a drag lands flush on the next card rather than carrying the drift (got ${track.scrollLeft}, expected ${STRIDE * 2})`);

  track.scrollLeft = STRIDE * 2 - 7;
  handlers.dr_prev();
  t.check(track.scrollLeft === STRIDE,
    `and going back rounds the same way (got ${track.scrollLeft}, expected ${STRIDE})`);

  // Both ends are dead ends.
  for (let i = 0; i < 10; i++) handlers.dr_next();
  t.check(track.scrollLeft === track.scrollWidth - track.clientWidth, 'it stops at the last card');
  t.check(buttons.dr_next.disabled === true, 'and says so');
  handlers.dr_prev();
  t.check(buttons.dr_next.disabled === false, 'coming back off the end re-enables it');
}

/* ---------- 10. wired onto the right panel ---------------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  const panel = extractFunction(src, 'orderOutPanelHTML', 'index.html');
  t.check(/list \|\| pendingDeliveryOrders\(\)/.test(panel) && /deliveryRuns\(orders\)/.test(panel),
    'the rail panel reads the delivery runs over the orders out for delivery, where the question is asked');
  /* The cash to buy in sits on the strip, read over both working stages:
     the money to go and buy belongs beside the orders waiting for it. */
  t.check(/orderBoardCashToBuy\(beingPreparedOrders\(\)\)/.test(extractFunction(src, 'renderSavedQuotes', 'index.html')),
    'and the cash to buy in is on the strip, over the stages still buying');
  t.check(/case 'runs': openDeliveryRuns\(\); break;/.test(code), "tapping the panel's act opens the runs");
  t.check(/id="deliveryRunsBody"/.test(code) && /id="deliveryRunsModal"/.test(code),
    'into its own modal rather than over the buying list');
}

/* ---------- the track scrolls, and stays where it is put ---------- */
{
  /* THE SNAP WAS THE BUG. .dr-track carries three carousels — the pickup
     clusters, the delivery clusters, and the buying list — and all three
     had `scroll-snap-type:x mandatory`. Measured on the real rule in the
     running app: a card is 290px in a 704px track, so a step is 302 and
     half a step is 151. Mandatory snapping puts the track on a snap point
     after EVERY scroll, and anything short of 151px rounds back to the
     card it started on —
     which is every scrollbar drag, every soft trackpad swipe and every
     press of an arrow key. Reported as the track springing back to the
     start and covering the card being scrolled to. Driven in a real
     browser: 60 -> 2, 120 -> 2, and only 200 -> 306. Driven again after,
     on the app's own rule: 40 -> 40, 120 -> 120, and one arrow key -> 40,
     which under the snap was 0.

     `x proximity` is not the fix — measured identically, 60 -> 2 — because
     the nearest snap point to a small scroll is still the one behind it.

     `scroll-behavior:smooth` went with it: it made that correction animate
     against the pointer mid-drag, and the buttons do not need it. */
  const rule = /\.dr-track\{([^}]*)\}/.exec(src);
  t.check(!!rule, 'the track has its rule');
  const body = rule ? rule[1] : '';
  t.check(!/scroll-snap-type/.test(body),
    'and no snap on it — mandatory rounds every small scroll back to the card it started on, which is every drag, swipe and arrow key');
  // Anchored, because `overscroll-behavior-x` contains the same letters.
  t.check(!/(^|;)\s*scroll-behavior:/.test(body),
    'nor a scroll-behavior that would animate that correction against the pointer');
  t.check(/overflow-x:auto/.test(body), 'it still scrolls sideways, which is the whole point of it');
  t.check(/overscroll-behavior-x:contain/.test(body),
    'and reaching its end does not carry the gesture on to the page behind it');

  /* The buttons still glide, because nav() asks for that itself rather
     than leaning on a property on the element. Driven in a browser with
     the element's own scroll-behavior gone: seventeen scroll events to
     cross one card, not a jump. */
  t.check(/track\.scrollBy\(\{ left: target - track\.scrollLeft, behavior: 'smooth' \}\)/.test(src),
    'the nav buttons carry their own smooth, so taking it off the element did not turn them into a jump');
}

process.exit(t.done() ? 1 : 0);
