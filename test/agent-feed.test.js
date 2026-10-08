#!/usr/bin/env node
'use strict';
/*
 * The agent Feed: one full-screen card at a time, built from what the app
 * already holds. These checks pin the parts that decide what an agent is
 * told -- what one sale pays him, which items count as bought together,
 * how the cards are ordered, and that "Not for me" actually hides a card
 * -- plus the wiring that puts the feed's best cards on Today as "Next
 * move". The feed stopped being a tab of its own when Feed and Home
 * merged into Today; its ranking is what decides that row.
 *
 * Run: node test/agent-feed.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent feed');
const src = read('agent.html');

const fn = (name) => extractFunction(src, name, 'agent.html');

/* ---------- 1. what one sale pays him --------------------------------- */
{
  let feedEarnEach;
  try { ({ feedEarnEach } = compileScope([fn('feedEarnEach')], {}, ['feedEarnEach'])); } catch (e) { /* reported below */ }
  t.check(typeof feedEarnEach === 'function', 'feedEarnEach compiles');
  if (feedEarnEach) {
    const it = { floorPrice: 131000, ourPrice: 145000 };
    const plain = feedEarnEach(it, null);
    t.check(plain.margin === 14000 && plain.bonus === 0 && plain.total === 14000,
      'without a bonus, one sale is the room between his cost and the suggested price');
    const fixed = feedEarnEach(it, { bonusType: 'fixed', bonusValue: 5000 });
    t.check(fixed.bonus === 5000 && fixed.total === 19000, 'a fixed bonus is added as it stands');
    const pct = feedEarnEach(it, { bonusType: 'percent', bonusValue: 2 });
    t.check(pct.bonus === 2900, 'a percentage bonus is taken on the suggested price');
    const under = feedEarnEach({ floorPrice: 100, ourPrice: 90 }, null);
    t.check(under.margin === 0, 'a suggested price under his cost is not drawn as a loss he will make');
  }
}

/* ---------- 2. bought together means at least twice ------------------- */
{
  let feedPairs;
  try {
    ({ feedPairs } = compileScope([fn('feedItemKey'), fn('feedPairs')], {}, ['feedPairs']));
  } catch (e) { /* reported below */ }
  t.check(typeof feedPairs === 'function', 'feedPairs compiles');
  if (feedPairs) {
    const L = (id) => ({ productId: id, variantIdx: null });
    const pairs = feedPairs([
      { items: [L('grinder'), L('disc')] },
      { items: [L('grinder'), L('disc'), L('disc')] },
      { items: [L('drill'), L('bits')] },
      { voided: true, items: [L('drill'), L('bits')] },
    ]);
    t.check(pairs.get('grinder::').get('disc::') === 2, 'a pair is counted once per order, not once per line');
    t.check(pairs.get('drill::').get('bits::') === 1, 'a voided order never happened');
    t.check(!pairs.get('grinder::').has('grinder::'), 'an item is not its own add-on');
  }
}

/* ---------- 3. the feed is built, ordered and ends --------------------- */
{
  const names = ['feedPrefs', 'saveFeedPrefs', 'feedItemKey', 'feedEarnEach', 'feedTaste', 'feedBuyersOf',
    'feedPairs', 'feedDaysLeft', 'buildFeedCards', 'feedLesson'];
  const store = {};
  const catalog = [
    { productId: 'g', variantIdx: null, name: 'Grinder', category: 'Power tools', floorPrice: 131000, ourPrice: 145000 },
    { productId: 'd', variantIdx: null, name: 'Discs', category: 'Accessories', floorPrice: 50000, ourPrice: 55000 },
  ];
  const promotions = [{ productId: 'g', variantIdx: null, bonusType: 'fixed', bonusValue: 5000 }];
  const today = new Date().toISOString().slice(0, 10);
  const env = {
    localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } },
    agentLocalKey: (p) => p + '_u1',
    catalog, promotions, cluster: [], myOrders: [{ id: 1, agentClientId: 1, date: today, items: [] }],
    agentClients: [{ id: 1, name: 'John' }],
    myGoals: null,
    AGENT_OTHER_CATEGORY: 'Other', FEED_NOT_ME_DAYS: 30, FEED_MAX_MONEY_CARDS: 8,
    itemCategory: (it) => it.category || 'Other',
    orderDate: (o) => o.date,
    orderEarnings: () => ({ margin: 0, bonus: 0, total: 0 }),
    agentLinePriced: () => false,
    catalogEntry: (pid) => catalog.find((c) => c.productId === pid),
    isInCluster: () => false,
    clusterEligibility: () => null,
    clientOrderCounts: () => new Map(),
    clientCadence: () => null,
    clientRegulars: () => [],
    promotedMap: () => new Map(promotions.map((p) => [`${p.productId}::`, p])),
    computeAchievements: () => [],
    seenAchievementIds: () => new Set(),
    myInquiries: [], usualQty: () => 0, feedInquiryMatch: () => ({ item: null, matches: [] }),
    feedMoneyWaiting: () => [], feedPushPrefsSoon: () => {},
  };
  let api;
  try { api = compileScope(names.map(fn), env, ['buildFeedCards', 'feedPrefs', 'saveFeedPrefs']); }
  catch (e) { t.check(false, `the feed builder compiles (${e.message})`); }
  if (api) {
    const cards = api.buildFeedCards(new Date());
    const kinds = cards.map((c) => c.kind);
    t.check(kinds[0] === 'hello', 'the feed opens on the morning card');
    t.check(kinds[kinds.length - 1] === 'done', 'and it ends -- "all caught up" is the last card');
    t.check(kinds.includes('bonus'), 'a bonus item he can earn on today gets a card');
    t.check(kinds.includes('goal'), 'his goal always has a place in it');
    t.check(!kinds.includes('about'), 'what the feed has learnt about him waits until there are orders to learn from');
    const bonus = cards.find((c) => c.kind === 'bonus');
    t.check(bonus && bonus.earn.total === 19000, 'the bonus card says what ONE sale pays him, bonus included');

    const p = api.feedPrefs();
    p.notMe[bonus.itemKey] = Date.now();
    api.saveFeedPrefs(p);
    const after = api.buildFeedCards(new Date()).map((c) => c.kind);
    t.check(!after.includes('bonus'), '"Not for me" hides that item from the next feed');

    p.notMe[bonus.itemKey] = Date.now() - 31 * 86400000;
    api.saveFeedPrefs(p);
    t.check(api.buildFeedCards(new Date()).some((c) => c.kind === 'bonus'),
      'and it comes back once the 30 days are up');
  }
}

/* ---------- 5. a catalogue request finds what it is about -------------- */
{
  const catalog = [
    { productId: 'cg', variantIdx: null, name: 'Cordless grinder 18V', category: 'Power tools' },
    { productId: 'd', variantIdx: null, name: 'Cutting discs', category: 'Accessories' },
  ];
  let feedInquiryMatch;
  try {
    ({ feedInquiryMatch } = compileScope([fn('feedInquiryMatch')], {
      catalog, catalogEntry: (pid) => catalog.find((c) => c.productId === pid) || null,
    }, ['feedInquiryMatch']));
  } catch (e) { /* reported below */ }
  t.check(typeof feedInquiryMatch === 'function', 'feedInquiryMatch compiles');
  if (feedInquiryMatch) {
    t.check(feedInquiryMatch({ product_id: 'd' }).item === catalog[1], 'a request sent from an item is about that item');
    const m = feedInquiryMatch({ message: 'Do you have a cordless grinder?' });
    t.check(m.item === null && m.matches[0] === catalog[0], 'a request in words is matched to the items it names');
    t.check(feedInquiryMatch({ message: 'hi' }).matches.length === 0, 'and a greeting matches nothing rather than everything');
  }
}

/* ---------- 6. money waiting on one move ------------------------------ */
{
  const now = new Date('2026-09-27T10:00:00');
  const orders = [
    { id: 1, status: 'pending_delivery', deliveryMode: 'agent_pickup', agentClientId: 1, items: [] },
    { id: 2, status: 'draft', agentPaymentStatus: 'unpaid', amountPaid: 50, agentClientId: 1, checked: true,
      items: [{ sellPrice: 100, qty: 3 }] },
    // Still being checked by the shop: not money waiting on him yet.
    { id: 5, status: 'draft', agentPaymentStatus: 'unpaid', agentClientId: 1, items: [{ sellPrice: 100, qty: 1 }] },
    { id: 3, status: 'draft', agentPaymentStatus: 'paid', items: [] },
    { id: 4, status: 'pending_delivery', deliveryMode: 'agent_pickup', voided: true, items: [] },
  ];
  const env = {
    feedClaimsLoaded: true, myOrders: orders, agentClients: [{ id: 1, name: 'John' }],
    myAgent: { paymentTerm: 'prepay' },
    currentMonthKey: () => '2026-09',
    shiftMonth: (m, d) => ({ '-1': '2026-08', '-2': '2026-07', '-3': '2026-06' })[String(d)],
    monthEarnings: (m) => ({ bonus: m === '2026-08' ? 7000 : m === '2026-07' ? 3000 : 0 }),
    findClaim: (m) => (m === '2026-07' ? { month: m } : null),
    orderTotal: () => 900, orderEarnings: (o) => ({ margin: o.id * 1000 }),
    orderShopChecked: (o) => !!o.checked,
  };
  let feedMoneyWaiting;
  try { ({ feedMoneyWaiting } = compileScope([fn('feedMoneyWaiting')], env, ['feedMoneyWaiting'])); } catch (e) { /* below */ }
  t.check(typeof feedMoneyWaiting === 'function', 'feedMoneyWaiting compiles');
  if (feedMoneyWaiting) {
    const rows = feedMoneyWaiting(now);
    const kinds = rows.map((r) => r.kind).sort().join(',');
    t.check(kinds === 'claim,pickup,prepay', `a finished month's unclaimed bonus, an order at the counter and a prepay to start (${kinds})`);
    t.check(!rows.some((r) => r.kind === 'claim' && r.month === '2026-07'), 'a month already claimed is not asked for again');
    t.check(rows.find((r) => r.kind === 'prepay').amount === 250, 'the prepay row is what is still owed to start it');
    t.check(!rows.some((r) => r.order && r.order.id === 5),
      'an order the shop is still checking asks for no money -- he pays once the lines are confirmed');
    t.check(rows[0].earn >= rows[rows.length - 1].earn, 'what pays him most comes first');
  }
}

/* ---------- 7. a bulk nudge is a step, and it pays him ------------------ */
{
  const block = (/\/\/ Buying a few more would drop his cost[\s\S]*?money\.sort/.exec(src) || [''])[0];
  t.check(/usual >= tierQty/.test(block), 'no nudge when the usual order already reaches the tier');
  t.check(/tierQty > usual \* 3/.test(block), 'nor when the tier is more than three times the usual order');
  t.check(/if\(tierEarn <= nowEarn\) return;/.test(block), 'and only when crossing the line pays him more than the usual order');
  let fdUnits;
  try { ({ fdUnits } = compileScope([fn('fdUnits')], {}, ['fdUnits'])); } catch (e) { /* below */ }
  t.check(fdUnits && fdUnits(1, 'box') === '1 box' && fdUnits(10, 'box') === '10 boxes' && fdUnits(3, 'pc') === '3 pcs',
    'counts read aloud correctly: 1 box, 10 boxes, 3 pcs');
}

/* ---------- 8. what the feed learnt follows him to a new phone --------- */
{
  let mergeFeedPrefs;
  try { ({ mergeFeedPrefs } = compileScope([fn('mergeFeedPrefs')], {}, ['mergeFeedPrefs'])); } catch (e) { /* below */ }
  t.check(typeof mergeFeedPrefs === 'function', 'mergeFeedPrefs compiles');
  if (mergeFeedPrefs) {
    const m = mergeFeedPrefs(
      { notMe: { a: 200 }, acted: { Tools: 2 }, lessons: {}, about: null },
      { notMe: { a: 100, b: 50 }, acted: { Tools: 5, Paint: 1 }, lessons: { addon: 9 }, about: 'yes' });
    t.check(m.notMe.a === 200 && m.notMe.b === 50, '"Not for me" from either copy survives, the later one wins');
    t.check(m.acted.Tools === 5 && m.acted.Paint === 1, 'act counts keep the larger of the two');
    t.check(m.lessons.addon === 9, 'a lesson finished on the old phone stays finished');
    t.check(m.about === 'yes', 'and his answer about the profile card carries over');
  }
  const sql = read('supabase/migrations/0102_agent_feed.sql');
  t.check(/create policy "agent manages own feed prefs" on agent_feed_prefs\s+for all using \(agent_id = current_agent_id\(shop_id\)\)/.test(sql),
    'the prefs row is the agent\'s own and nobody else\'s');
  t.check(/"admins read feed events" on agent_feed_events\s+for select using \(is_shop_admin\(shop_id\)\)/.test(sql)
    && !/on agent_feed_events\s+for (update|delete|all)/.test(sql),
    'events: the shop reads them, and nobody edits or deletes one');
  t.check(/"agents read feed pins" on agent_feed_pins\s+for select using \(is_shop_agent\(shop_id\)\)/.test(sql),
    'pins: the shop writes them, its agents only read them');
}

/* ---------- 4. the feed's best cards are Today's "Next move" --------- */
{
  const fnSrc = (n) => { try { return fn(n); } catch (e) { return ''; } };
  const renderNext = fnSrc('renderNext');
  t.check(/buildFeedCards\(new Date\(\)\)/.test(renderNext), 'Next move is drawn from the feed ranking, not a second list');
  t.check(/c\.kind === 'ask'/.test(renderNext) && /\['due','bonus','addon','bulk','pin'\]/.test(renderNext),
    'requests from the shop link come first, then the money cards in the order the feed ranked them');
  t.check(/\.slice\(0, 8\)/.test(renderNext), 'and it stops at eight -- a row that never ends is time not spent with customers');
  t.check(/You're all caught up/.test(renderNext), 'with nothing to suggest, it says so and offers the next order');
  t.check(/const TABS = \['today','clients'\];/.test(src) && !/data-tab="feed"/.test(src),
    'Today and Clients are the two tabs; Feed and Home are one place now');
  t.check(/if\(tab === 'feed' \|\| tab === 'home'\) tab = 'today';/.test(src),
    'a saved "feed" tab or a notification still lands on Today');
}

process.exit(t.done() ? 1 : 0);
