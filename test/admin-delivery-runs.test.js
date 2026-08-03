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
  extractFunction(src, 'orderNeedsDelivery', 'index.html'),
  extractFunction(src, 'deliveryRuns', 'index.html'),
  extractFunction(src, 'pendingDeliveryOrders', 'index.html'),
  extractFunction(src, 'deliveryRunsBannerHTML', 'index.html'),
], {
  data,
  savedQuoteTotal: (q) => (q.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sellPrice) || 0), 0),
  esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  fmtUGX: (n) => Number(n || 0).toLocaleString('en-US') + ' UGX',
  ICON_ROUTE: '<svg data-i="route"></svg>', ICON_PIN: '<svg data-i="pin"></svg>',
  ICON_WARN: '<svg data-i="warn"></svg>', ICON_TRUCK: '<svg data-i="truck"></svg>',
  openModal: (id) => { modal.opened = id; },
}, ['orderDestination', 'orderIsCollected', 'destinationKey', 'deliveryRuns',
  'pendingDeliveryOrders', 'deliveryRunsBannerHTML']);

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

/* ---------- 7. the banner ---------------------------------------------- */
{
  reset();
  data.customers = [
    { id: 'k1', name: 'A', location: 'Ntinda' }, { id: 'k2', name: 'B', location: 'Ntinda' },
    { id: 'k3', name: 'C', location: 'Nakawa' }];

  const alone = [order({ id: 1, customerId: 'k1' }), order({ id: 3, customerId: 'k3' })];
  t.check(scope.deliveryRunsBannerHTML(alone) === '',
    'nothing going the same way renders no banner at all, rather than one announcing a run of one');
  t.check(scope.deliveryRunsBannerHTML([]) === '', 'an empty column renders none');
  t.check(scope.deliveryRunsBannerHTML(undefined) === '', 'and neither does a column that has not loaded');

  const together = alone.concat([order({ id: 2, customerId: 'k2' }), order({ id: 9, client: { name: 'Wilson' } })]);
  const html = scope.deliveryRunsBannerHTML(together);
  t.check(/Ntinda/.test(html) && /Going the same way/.test(html), 'two for one place raises the banner');
  t.check(/2 orders<\/span>/.test(html.replace(/\s+/g, ' ')) || /2 orders/.test(html),
    'counting only the orders that actually share a destination');
  t.check(/1 going somewhere of its own/.test(html),
    'and saying what is left over rather than quietly omitting it');
  t.check(/1 with no address yet/.test(html), 'including the one nobody has an address for');

  // A cancelled order in the column is not going anywhere. Checked on the
  // FIGURE, not the number of run chips -- a voided order joining an
  // existing run leaves the chip count identical and only the count wrong,
  // which is exactly the way this would slip through unnoticed.
  const figure = (h) => (h.match(/([\d]+) orders?<\/span>/) || [])[1];
  const withVoid = together.concat([order({ id: 10, customerId: 'k1', voided: true })]);
  t.check(figure(html) === '2', `the banner counts the two that share Ntinda (got ${figure(html)})`);
  t.check(figure(scope.deliveryRunsBannerHTML(withVoid)) === '2',
    `and a cancelled order joins neither the run nor the count (got ${figure(scope.deliveryRunsBannerHTML(withVoid))})`);

  const aged = together.concat([order({ id: 11, customerId: 'k1', invoiced: true, invoicedTs: Date.now() - 3 * 24 * 3600 * 1000 })]);
  t.check(figure(scope.deliveryRunsBannerHTML(aged)) === '2',
    'nor does one long since aged off the board');
}

/* ---------- 8. wired onto the right column ---------------------------- */
{
  const code = src.split(/\r?\n/).map((l) => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
  t.check(/\$\{status==='pending_delivery' \? deliveryRunsBannerHTML\(group\) : ''\}/.test(code),
    'the banner sits over Pending Delivery, where the question is asked');
  t.check(/\$\{status==='preparing' \? cashToBuyBannerHTML\(group\) : ''\}/.test(code),
    'and the cash banner still sits over Being Prepared');
  t.check(/if\(runsBanner\) runsBanner\.addEventListener\('click', openDeliveryRuns\)/.test(code),
    'tapping it opens the runs');
  t.check(/id="deliveryRunsBody"/.test(code) && /id="deliveryRunsModal"/.test(code),
    'into its own modal rather than over the buying list');
}

process.exit(t.done() ? 1 : 0);
