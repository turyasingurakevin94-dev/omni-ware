#!/usr/bin/env node
'use strict';
/*
 * Every order a customer has placed, and one of them in full.
 *
 * Two things make this screen different from the others. The first is
 * that it is the RECORD rather than the reckoning: a cancelled order is
 * in it, because a customer wondering where an order went is owed the
 * answer "we cancelled it", and leaving it out so the list looks tidier
 * is how they end up ringing to ask. Every other read in client-portal
 * drops voided rows, and must.
 *
 * The second is the ladder. Nothing anywhere in this app records when an
 * order's status changed -- there is no stage history, only the day it
 * was sent and the day it was invoiced. So the ladder shows where an
 * order has reached and dates almost none of it, and the one rule that
 * matters is that it must not invent a day it cannot derive. An invoice
 * date standing in for a delivery date is exactly that, and is what the
 * first version did.
 *
 * Run: node test/client-orders.test.js   (or: npm test)
 */
const { read, extractFunction, extractDeclaration, compileScope, createReporter } = require('./_extract');

const t = createReporter('client orders');
const fn = read('supabase/functions/client-portal/index.ts');
const page = read('client.html');
const app = read('index.html');
const noComments = fn.replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map(l => l.replace(/(?<!:)\/\/.*$/, '')).join('\n');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const BLOCK = (() => {
  const start = noComments.indexOf('action === "orders" || action === "order"');
  const rest = noComments.slice(start);
  /* The next TOP-LEVEL action, found by its indentation. Searching for
     any "if (action === " cut this block off after 900 characters,
     because the orders block contains a nested one of its own -- and a
     slice that ends early makes every check over it pass for the worst
     possible reason: there was nothing left to look at. */
  const next = rest.indexOf('\n    if (action === ', 10);
  return next > 0 ? rest.slice(0, next) : rest;
})();

/* A slice that ends early makes every check over it pass for the worst
   possible reason: there was nothing left to look at. Measured once,
   loudly, before anything is asserted about it. */
t.check(BLOCK.length > 2000 && /return json\(\{\s*ok: true,\s*stages: ORDER_STAGES/.test(BLOCK),
  `the orders block is read whole (${BLOCK.length} chars, ending at the list reply)`);

/* ---------- 1. the ladder is the shop's own ---------------------------- */
/*
 * client-portal once filtered on a status this app has never written and
 * matched nothing for three commits. A ladder invented here would fail
 * the same way: a customer shown a journey their order is not on.
 */
{
  const theirs = /const SQ_STATUS_ORDER = \[([^\]]*)\]/.exec(app);
  t.check(!!theirs, 'the shop\'s own stage ladder is found');
  const shop = theirs ? (theirs[1].match(/'(\w+)'/g) || []).map(x => x.replace(/'/g, '')) : [];
  const mine = /const ORDER_STAGES = \[([^\]]*)\]/.exec(fn);
  t.check(!!mine, 'and the portal\'s');
  const portal = mine ? (mine[1].match(/"(\w+)"/g) || []).map(x => x.replace(/"/g, '')) : [];
  t.check(JSON.stringify(portal) === JSON.stringify(shop),
    `the same stages in the same order (${portal.join(' → ')})`);

  // Every stage has a customer's word for it, and no word is invented for
  // a stage that does not exist.
  const words = extractDeclaration(page, 'STAGE_WORDS', 'client.html');
  const named = (words.match(/^\s*(\w+):/gm) || []).map(x => x.replace(/[\s:]/g, ''));
  t.check(JSON.stringify(named.slice().sort()) === JSON.stringify(shop.slice().sort()),
    `and each has a customer's word, with none left over (${named.join(', ')})`);

  // ORDER_STAGES rides along, read out of the source rather than written
  // here: a copy would make "a sixth stage cannot appear" a fact about
  // this file rather than about the function.
  const { stageOf } = compileScope(
    [extractDeclaration(fn, 'ORDER_STAGES', 'client-portal'),
     extractFunction(fn, 'stageOf', 'client-portal')],
    {}, ['stageOf'], { typescript: true });
  t.check(stageOf('preparing') === 'preparing', 'a known status passes through');
  t.check(stageOf(null) === 'draft' && stageOf('') === 'draft',
    'a row with no status reads as the first stage, the way the app reads it');
  t.check(stageOf('something_else') === 'draft',
    'and one the board does not know does NOT become a sixth stage');
}

/* ---------- 2. a line gives up sellPrice, never price ------------------ */
{
  /* `function (it: any)` -- a typed parameter on an inner function
     expression. stripTypes confines itself to a function's SIGNATURE by
     design (its own comment explains that the parameter rule cannot tell
     `(a: number)` from an object literal's `{ cost: costNum }`), so
     anything typed inside a body is left alone. Cleared here rather than
     by widening it, the way agent-catalog.test.js clears its own two. */
  const detype = (x) => x.replace(/function \(([\w$]+)\s*:\s*[\w$\[\]]+\)/g, 'function ($1)');
  const { orderLines } = compileScope([detype(extractFunction(fn, 'orderLines', 'client-portal'))], {},
    ['orderLines'], { typescript: true });
  const lines = orderLines({ items: [
    { productName: 'Iron sheets', variantLabel: 'Red', qty: 140, unit: 'sheet',
      sellPrice: 48500, price: 41000, supplierId: 'S1', supplierName: 'Kikuubo Steel' },
  ] });
  t.check(lines.length === 1 && lines[0].unitPrice === 48500,
    `a line carries what the customer was charged (${lines[0] && lines[0].unitPrice})`);
  t.check(lines[0] && lines[0].lineTotal === 6790000, 'and what that came to');
  const keys = Object.keys(lines[0] || {}).sort();
  t.check(JSON.stringify(keys) === JSON.stringify(['lineTotal', 'name', 'qty', 'unit', 'unitPrice', 'variantLabel']),
    `and nothing else at all (${keys.join(', ')})`);
  t.check(!JSON.stringify(lines).includes('41000') && !JSON.stringify(lines).includes('Kikuubo'),
    'not the cost, and not the supplier it came from');
  t.check(orderLines({}).length === 0 && orderLines(null).length === 0,
    'an order with no items is no lines, not a crash');
  t.check(!/\bit\.price\b|supplierId|supplierName/.test(extractFunction(fn, 'orderLines', 'client-portal')),
    'and the function never names either');
}

/* ---------- 3. whose orders ------------------------------------------- */
{
  t.check(/normalisePhone\(q\.client_phone\) === mine/.test(BLOCK),
    'orders are matched on the normalised phone, never the name');
  t.check(/if \(!mine\) return json\(\{ ok: true, orders: \[\], count: 0 \}\)/.test(BLOCK),
    'a customer with no usable number gets none, rather than everyone\'s');
  t.check(/const q = ours\.find/.test(BLOCK),
    'and one order is looked for among THEIRS, not among the shop\'s');
  /* Said the same way whether the order belongs to somebody else or does
     not exist. A portal that distinguishes them will confirm another
     customer's order number to anyone who guesses it. */
  t.check(/return json\(\{ error: "We cannot find that order" \}, 404\)/.test(BLOCK),
    'a missing order and somebody else\'s order read identically');
  const notFounds = (BLOCK.match(/, 404\)/g) || []).length;
  t.check(notFounds === 1, `there is one such reply, not two (${notFounds})`);

  t.check(/sessionAccount\(shopId, String\(body\.token \?\? ""\)\)/.test(BLOCK.slice(0, 400)),
    'and a session is proved first');
}

/* ---------- 4. the record includes what was cancelled ----------------- */
{
  t.check(/voided/.test(BLOCK) && !/\.eq\("voided", false\)/.test(BLOCK),
    'this read does not drop voided rows');
  t.check(/cancelled: !!q\.voided/.test(BLOCK), 'it marks them instead');
  // Every OTHER read still drops them: the balance, the remembered price
  // and the recent five must not count a cancelled order.
  const others = [...noComments.matchAll(/from\("saved_quotes"\)[\s\S]{0,400}?;/g)]
    .map(m => m[0]).filter(r => !BLOCK.includes(r));
  t.check(others.length >= 2 && others.every(r => /\.eq\("voided", false\)/.test(r)),
    `while every other read of them still does (${others.length} reads)`);
}

/* ---------- 5. the screens --------------------------------------------- */
const N = ['esc', 'money', 'plural', 'many', 'longDate', 'monthLabel', 'stageWord',
  'orderRowHTML', 'renderOrders', 'ladderHTML', 'renderOrder'];
const STAGES = ['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'];
function scope() {
  const nodes = {};
  ['ordersBody', 'ordersTitle', 'orderBody', 'orderTitle'].forEach((id) => {
    nodes[id] = { id, innerHTML: '', textContent: '', querySelectorAll: () => [] };
  });
  const fns = compileScope(
    N.map(n => extractFunction(page, n, 'client.html'))
      .concat(['STAGE_WORDS', 'STAGE_SAYS'].map(n => extractDeclaration(page, n, 'client.html'))),
    { document: { getElementById: (id) => nodes[id] || null }, MONTHS, openOrder() {} }, N);
  return { fns, nodes };
}
const words = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const O = (id, date, items, total, stage, extra) => Object.assign(
  { id, date, items, total, stage, cancelled: false, invoiced: false, fromPortal: false }, extra || {});

{
  const { fns, nodes } = scope();
  fns.renderOrders({ stages: STAGES, count: 5, orders: [
    O(2341, '2026-09-13', 4, 7718000, 'awaiting_goods', { fromPortal: true }),
    O(2336, '2026-09-11', 9, 1240000, 'completed'),
    O(2299, '2026-08-28', 1, 90000, 'draft', { cancelled: true }),
    O(2291, '2026-08-21', 12, 880000, 'completed'),
  ] });
  const seen = words(nodes.ordersBody.innerHTML);
  t.check(nodes.ordersTitle.textContent === 'Your 4 orders',
    `the head counts them (${nodes.ordersTitle.textContent})`);
  /* Thirty-four orders in one column is a wall; the month is the only
     thing between them. */
  t.check(/September 2026 .* August 2026/.test(seen), 'they are grouped by month, newest first');
  t.check((seen.match(/September 2026/g) || []).length === 1, 'and each month is headed once');
  t.check(/13 September · 4 items Getting your goods/.test(seen),
    'a row reads date, count and where it has reached');
  t.check(/sent from here/.test(seen), 'an order sent from the portal says so');
  t.check(/Cancelled/.test(seen), 'and a cancelled one is named as cancelled');
  t.check(/var\(--meta\)/.test(nodes.ordersBody.innerHTML),
    'with its figure greyed, so the eye ranks it below the live ones');

  fns.renderOrders({ stages: STAGES, count: 0, orders: [] });
  t.check(/Nothing here yet/.test(words(nodes.ordersBody.innerHTML)),
    'no orders says so, and says what will appear');
}

const L = (name, qty, unit, price) =>
  ({ name, variantLabel: '', qty, unit, unitPrice: price, lineTotal: qty * price });
const ORDER = { id: 2336, date: '2026-09-11', stage: 'completed', stages: STAGES, cancelled: false,
  invoiced: true, invoicedAt: '2026-09-12', sentAt: '2026-09-11T16:12:00Z', deliverTo: 'Kyanja site',
  fromPortal: true, lines: [L('Cement 50kg', 8, 'bag', 39000)], total: 312000, paid: 200000, due: 112000 };
const draw = (o) => { const { fns, nodes } = scope(); fns.renderOrder(o); return { body: nodes.orderBody.innerHTML, title: nodes.orderTitle.textContent }; };

{
  const d = draw(ORDER);
  const seen = words(d.body);
  t.check(d.title === 'Order 2336', `the head is the number a customer rings about (${d.title})`);
  t.check(/11 September · 1 item · to Kyanja site/.test(seen), 'the line under it says when, how many and where');
  t.check(/Cement 50kg 8 bags at 39,000 312,000/.test(seen),
    `a line reads item, quantity, unit price and total (${(seen.match(/Cement[^A-Z]*/) || [])[0]})`);
  t.check(/Order total 312,000/.test(seen), 'and the order totals');
  t.check(/Invoiced 12 September/.test(seen), 'the invoice date is its own fact');
  t.check(/Paid 200,000 Still to pay 112,000/.test(seen), 'with what is paid and what is left');
  t.check(/var\(--owe\)/.test(d.body), 'the outstanding part in oxide, because it is money owed');

  const settled = draw({ ...ORDER, paid: 312000, due: 0 });
  t.check(/Still to pay Nothing/.test(words(settled.body)),
    'a settled order says "Nothing" rather than showing a nought');
}

/* ---------- 6. the ladder invents no day ------------------------------- */
{
  const d = draw(ORDER);
  const seen = words(d.body);
  t.check(/Where it has reached/.test(seen), 'the ladder is drawn');
  STAGES.forEach((s) => {
    const word = { draft: 'With the shop', awaiting_goods: 'Getting your goods', preparing: 'Being prepared',
      pending_delivery: 'On the way', completed: 'Delivered' }[s];
    t.check(seen.includes(word), `every stage is named (${word})`);
  });
  t.check(/With the shop 11 September/.test(seen),
    'the first step carries the day the order was sent, which IS written down');

  /* invoiced_at was going against "Delivered". An invoice date is not a
     delivery date -- different events, and nothing records the second --
     so the ladder now dates only what it can derive, and the invoice date
     appears as itself beside the money. */
  t.check(!/Delivered 12 September/.test(seen),
    'and the invoice date does NOT stand in for a delivery date');
  const dates = seen.slice(seen.indexOf('Where it has reached'));
  t.check((dates.match(/\d+ (January|February|March|April|May|June|July|August|September|October|November|December)/g) || []).length <= 1,
    `at most one day appears in the whole ladder (${(dates.match(/\d+ \w+ember|\d+ \w+/g) || []).join(', ')})`);
  t.check(/We only put a day against a step the books can date/.test(seen),
    'and the screen says why the rest carry none');

  const early = draw({ ...ORDER, stage: 'draft', invoicedAt: null, paid: 0, due: 312000 });
  const earlySeen = words(early.body);
  t.check(/What is not on our shelf, we fetch/.test(earlySeen) === false,
    'nothing is said under a stage the order has not reached');
  t.check(/On the way/.test(earlySeen), 'though every later stage is still named, so the journey is visible');
}

/* ---------- 7. a cancelled order --------------------------------------- */
{
  const d = draw({ ...ORDER, cancelled: true, paid: 0, due: 312000, invoicedAt: null });
  const seen = words(d.body);
  t.check(/Cancelled/.test(seen), 'it says so at the top');
  /* Voiding drives the desired debt charge to nought (invoiceDebtDesired)
     and the sync reverses what was charged, so this is true -- but it is
     put as something the customer can CHECK, because the statement screen
     already admits the ledger and the balance can drift. */
  t.check(/should not appear on your statement — tell us if it does/.test(seen),
    'and what it means for their account, as a claim they can check');
  t.check(!/Where it has reached/.test(seen),
    'no ladder, because a cancelled order is not on its way anywhere');
  t.check(!/We only put a day against a step/.test(seen),
    'and no caption for a ladder that is not there');
  t.check(!/Still to pay/.test(seen), 'nor anything owed on it');
  t.check(/What was on it/.test(seen), 'what was on it is still shown — it is the record');
}

/* ---------- 8. the way in ---------------------------------------------- */
{
  t.check(/id="allOrders"/.test(page), 'the account screen leads to the full list');
  /* This stated the count as a fact for four commits, because the screen
     it would have led to did not exist. */
  t.check(!/Showing the .* most recent of/.test(page),
    'and no longer states the count as a fact with nowhere to go');
  t.check(/All ' \+ esc\(a\.orderCount\) \+ ' orders'/.test(page),
    'the count stays in the row, because it says whether the tap is worth it');
  t.check(/openOrders\(\)/.test(page), 'and it opens the list');
}

process.exit(t.done() ? 1 : 0);
