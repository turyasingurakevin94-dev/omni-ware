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

/* ---------- 8. every place gets a group, one under the next ----------

   THE CAROUSEL IS GONE. Delivery runs were cards in a sideways track,
   and so were the pickup clusters and the buying list -- three screens
   answering three questions in one gesture that hid two thirds of the
   answer behind a scroll. The redesign makes all three dialogs the same
   object: one 44px header, hairline-separated blocks, one footer with
   exactly one oxide primary. A run is a group head and its orders are
   rows under it, so a day with four runs is read down the page instead
   of swiped across it.

   What is pinned here is unchanged in substance: one group per place,
   fullest first, the two non-places at the end and not in a tail
   nobody scrolls to, how many of a run still have nobody driving, and
   a typed place escaped into the markup. Sections 9 and the track rule
   below it went with the carousel they were about. */
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

  const spec = () => compileScope([
    extractFunction(src, 'otRunsSpec', 'index.html'),
  ], {
    pendingDeliveryOrders: scope.pendingDeliveryOrders,
    deliveryRuns: scope.deliveryRuns,
    savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
    quoteClientName: (q) => (q && q.client && q.client.name) || 'Unnamed client',
    orderCustomerLocation: (q) => {
      const c = data.customers.find((x) => x.id === q.customerId);
      return (c && c.location) || '';
    },
    orderNeedsDelivery: (q) => !q.assignedDeliveryId,
    staffName: (id) => String(id),
    esc: (s2) => String(s2 == null ? '' : s2).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    otFig: (n) => Number(n || 0).toLocaleString('en-US'),
    otDayName: () => 'Monday',
    /* The third argument is the button's own data and title, which is
       where the runs dialog now says what closing a run does. A stub
       that dropped it hid that from every assertion below. */
    otDlgGhost: (a, label, ds) => `<button data-dlg="${a}"${ds || ''}>${label}</button>`,
    otDlgPrimary: (a, label, ds) => `<button class="btn-accent" data-dlg="${a}"${ds || ''}>${label}</button>`,
  }, ['otRunsSpec']).otRunsSpec();

  let out = spec();
  const html = out.body;
  /* ONE CARD PER PLACE. A delivery round is the same object as a buying
     round pointed the other way, so it wears the buying list's card and
     the two screens are one thing to learn. */
  const groups = (html.match(/class="ow-sc"/g) || []).length;

  t.check(groups === 4,
    `one card per place plus the two that are not places (got ${groups}: Ntinda, Nakawa, collected, no-address)`);
  t.check(/Nakawa/.test(html),
    'a place with a single order gets a group of its own -- it is still somewhere somebody has to drive to');
  t.check(html.indexOf('Ntinda') < html.indexOf('Nakawa'),
    'with the fullest run first, since that is the one worth planning around');
  t.check(/Collecting from the shop/.test(html) && /No place on file/.test(html),
    'and the two non-places are named as what they are rather than drawn as runs');
  t.check(html.indexOf('Collecting from the shop') > html.indexOf('Nakawa'),
    'after every real destination');
  t.check(/2 orders? out/.test(out.sub) === false && /5 orders out/.test(out.sub),
    `the header counts what is out (${out.sub})`);
  t.check(/2 runs/.test(out.sub), 'and how many runs it is on');

  /* The per-run figure an admin plans from, said twice over on the card
     and never twice in the same words: a run nobody is on says so where
     the driver's name would be, and every card's own state line counts
     how many of it are actually out. A run WITH a driver that still has
     orders on nobody keeps the count beside the name. */
  t.check(/Nobody is carrying it/.test(html) && !/Nobody is carrying it · /.test(html),
    'a run nobody is on says so once, where the driver would be named');
  t.check(/0 of 2 are out/.test(html),
    'and the card counts how many of it are actually out');
  t.check(/r\.drivers\.length && r\.unassigned \? `\$\{r\.unassigned\} with nobody carrying/
    .test(extractFunction(src, 'otRunsSpec', 'index.html')),
    'while a run that HAS a driver and orders on nobody keeps that count beside the name');
  /* ONE OXIDE, AND IT NAMES WHAT IT WILL DO. "Close run 1" closes the
     fullest run, and says how many orders that is before it is pressed
     -- never a button that acts on a number the owner has to count. */
  t.check(/class="btn-accent"/.test(out.foot) && /Close run 1 · 2 orders/.test(out.foot),
    'and the footer offers exactly one primary, naming how many it closes');
  t.check((out.foot.match(/btn-accent/g) || []).length === 1,
    'exactly one -- two accents in a dialog and neither of them means anything');
  /* Said ON the button rather than as a standing sentence beside it. It
     is true every time and news once, so it belongs where it is read at
     the moment it matters — on the act, and again in the confirm that
     act raises. */
  t.check(/not invoiced/.test(out.foot),
    'with the act saying where a closed order actually goes');
  t.check(/not invoiced/.test(extractFunction(src, 'otDlgAct', 'index.html')),
    'and saying it again in the confirm, which is the last moment to stop');

  // Names come from customer records and agent-typed addresses, so they are
  // whatever somebody typed.
  reset();
  data.customers = [{ id: 'k1', name: 'X', location: '<img src=x onerror=alert(1)>' }];
  data.savedQuotes = [order({ id: 1, customerId: 'k1' })];
  out = spec();
  t.check(!/<img src=x/.test(out.body) && /&lt;img/.test(out.body),
    'a location is escaped into the row, being a string somebody typed');
}

/* ---------- 9. wired onto the right panel ---------------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  const panel = extractFunction(src, 'orderOutPanelHTML', 'index.html');
  t.check(/list \|\| pendingDeliveryOrders\(\)/.test(panel) && /deliveryRuns\(orders\)/.test(panel),
    'the rail panel reads the delivery runs over the orders out for delivery, where the question is asked');
  /* The cash to buy in sits on the strip, read over both working stages:
     the money to go and buy belongs beside the orders waiting for it. */
  t.check(/orderBoardCashToBuy\(beingPreparedOrders\(\)\)/.test(extractFunction(src, 'renderSavedQuotes', 'index.html')),
    'and the cash to buy in is on the strip, over the stages still buying');
  t.check(/case 'runs': openDeliveryRuns\(\); break;/.test(code), "tapping the Out lane's act opens the runs");
  /* SIX DIALOGS, ONE SHELL. The runs no longer have a modal of their
     own: they are a spec poured into the board's one dialog, which is
     what makes "one 44px header, one footer, one accent" a fact about
     the code rather than a hope about six copies of it. */
  t.check(/const OT_DIALOGS = \{/.test(code) && /runs: otRunsSpec,/.test(code),
    'through the one dialog every other board dialog also opens in');
  t.check(/id="otDlg"/.test(code) && /id="ot_dlg_b"/.test(code),
    'which has exactly one mount in the markup');
}

process.exit(t.done() ? 1 : 0);
