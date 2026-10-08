#!/usr/bin/env node
'use strict';
/*
 * Every tap on Today and on an order has a page of its own, and the order
 * itself says where it is without a word of explanation.
 *
 *  - Items are ticked one at a time, as each supplier says yes, and the
 *    order reads "1 of 3 confirmed". Pay opens only once they are all in.
 *  - The steps are named tiles and circles -- never an unlabelled bar.
 *  - Once the lines are settled (packing onwards) they fold into one row.
 *  - Sending plays a short moment, then opens the order by itself.
 *  - Receipt and Update show what will be sent before it goes; Shop rings
 *    or messages the shop, and only appears when there is a number.
 *  - Done ends on a thank-you whose main button is ordering again.
 *  - Today's header: the ring opens the goal, the figure the money, the
 *    glass bar what is within reach and where you stand, your initials you.
 *
 * Run: node test/agent-order-pages.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent order pages');
const src = read('agent.html');
const fn = (n) => extractFunction(src, n, 'agent.html');

/* ---------- 1. one line at a time ------------------------------------ */
{
  const api = compileScope(['const orderStaffNames = new Map();',
    ...['agentOrderTerms', 'orderShopChecked', 'supplierLineTerms', 'lineCheck', 'orderCheckCount', 'staffName', 'orderOwedAmount', 'orderStage'].map(fn)],
    { myAgent: { paymentTerm: 'prepay' }, fmtNum: (n) => String(n) }, ['lineCheck', 'orderCheckCount', 'orderStage', 'agentOrderTerms']);
  const cem = { productId: 'cem', variantIdx: null, qty: 40, price: 31000, sellPrice: 32000, supplierId: 'S1' };
  const iron = { productId: 'ir', variantIdx: null, qty: 60, price: 35000, sellPrice: 36500, supplierId: 'S2' };
  const nails = { productId: 'n', variantIdx: null, qty: 4, price: 3400, sellPrice: 3600, supplierId: 'S3' };
  const shelf = { productId: 'sh', variantIdx: null, qty: 2, price: 100, sellPrice: 120, supplierId: '__stock__' };
  const order = (confirms, extra) => Object.assign({ status: 'draft', items: [cem, iron, nails], supplierConfirms: confirms }, extra || {});

  const o1 = order({ S1: { state: 'confirmed', terms: 'cem::40:31000', at: 1 }, S2: { state: 'pending', askedAt: 2 } });
  t.check(api.lineCheck(o1, cem).state === 'ok', 'a line is ticked as soon as its own supplier says yes');
  t.check(api.lineCheck(o1, iron).state === 'asking', 'one being asked about right now shows as being checked');
  t.check(api.lineCheck(o1, nails).state === 'wait', 'and one nobody has rung yet waits');
  t.check(api.orderStage(o1).sub === '1 of 3 confirmed with the supplier', `the order says how far along it is (${api.orderStage(o1).sub})`);

  const stale = order({ S1: { state: 'confirmed', terms: 'cem::30:31000' } });
  t.check(api.lineCheck(stale, cem).state === 'wait', 'a yes to different terms is not a yes -- edit the line and the tick goes');
  t.check(api.lineCheck(order({ S3: { state: 'problem' } }), nails).state === 'problem', 'a supplier with a problem is flagged, not ticked');
  t.check(api.lineCheck(order({}, { items: [shelf] }), shelf).state === 'ok', 'off the shop\'s own shelf there is nobody to ring, so it is ticked');

  const signed = order({}, { shopConfirmedAt: 5 });
  signed.shopConfirmedTerms = api.agentOrderTerms(signed);
  t.check([cem, iron, nails].every((it) => api.lineCheck(signed, it).state === 'ok'), 'once the shop signs the order off, every line is ticked');
}

/* ---------- 2. pay waits, and says so -------------------------------- */
{
  const track = fn('openTrackSheet');
  t.check(/st\.key === 'checking' && prepay/.test(track) && /Pay opens when all \$\{k\.items\} are checked/.test(track),
    'while it is being checked, a prepay agent sees that paying opens once every line is checked');
  t.check(/const pay = st\.needs === 'pay' \? payPanelHTML/.test(track), 'and the pay buttons appear only when there is something to pay');
}

/* ---------- 3. named steps, never a bare bar ------------------------- */
{
  const tiles = fn('stepTilesHTML'), dots = fn('stepDotsHTML');
  t.check(/stepLabel\(s, i < at \|\| all\)/.test(tiles) && /stepLabel\(s, done\)/.test(dots), 'every step is drawn with its name');
  t.check(!/class="bar"|width:\$\{/.test(tiles + dots), 'and neither draws a progress bar an agent would have to decode');
  t.check(/orderStepTimes\(o\)/.test(tiles), 'a step that is done carries when it happened');
  t.check(/stepDotsHTML\(o, st\)/.test(fn('orderCardHTML')), 'the cards on a stage page use the same named steps');
  t.check(/o\.createdAt \? whenShort\(o\.createdAt\)/.test(fn('orderStepTimes')),
    'Sent shows the time it was sent where the server recorded it, never savedAt -- the shop rewrites that');
  t.check(/createdAt: now,/.test(read('supabase/functions/agent-submit-order/index.ts')), 'and the server records it');
}

/* ---------- 4. the items fold once they are settled ------------------- */
{
  const fold = /const FOLD_ITEMS_AT = \[([^\]]*)\]/.exec(src);
  const keys = fold ? fold[1].replace(/'/g, '').split(',').map((s) => s.trim()) : [];
  t.check(['packing', 'ready', 'out', 'done'].every((k) => keys.includes(k)), `from packing on, the lines fold into one row (${keys.join(', ')})`);
  t.check(!keys.includes('checking') && !keys.includes('pay'), 'but stay open while they are being checked and paid for');
  t.check(/<details class="ax-card ax-gets"\$\{open \? ' open' : ''\}/.test(fn('openTrackSheet')), 'and one tap opens them');
}

/* ---------- 5. every button has its page ----------------------------- */
{
  const track = fn('openTrackSheet');
  t.check(/data-update\]'\)\)\{ openUpdateSheet\(o\.id\)/.test(track), 'Update opens a page showing the message before it goes');
  t.check(/data-receipt\]'\)\)\{ openReceiptSheet\(o\.id\)/.test(track), 'Receipt opens a preview of what the client gets');
  t.check(/data-finish\]'\)\)\{ sheet\.close\(\); openThankYou\(o\.id\)/.test(track), 'Finish on a done order opens the thank-you');
  t.check(/const sh = shopInfo && shopInfo\.phone \? shopInfo : null;/.test(track), 'the Shop button shows only when the shop has a number to ring');
  t.check(/orderShopChecked\(o\) \? '' : `<span class="ax-pill warn sm">\$\{AX_ICON\.clip\}Being checked · may change/.test(fn('openReceiptSheet')),
    'a receipt for an order still being checked says the total may change');
  t.check(/data-ty-again\]'\)\)\{ close\(\); orderUsual\(c\); \}/.test(fn('openThankYou')), 'the thank-you\'s main button is ordering again for the same client');
}

/* ---------- 6. sent is a moment, then the order ------------------------ */
{
  const sent = fn('showSent');
  t.check(/setTimeout\(finish, SENT_MS\)/.test(sent) && /el\.addEventListener\('click', finish\)/.test(sent),
    'it plays, then moves on by itself -- or at once, on a tap');
  t.check(/openSentOrder\(orderId\)/.test(sent) && /openTrackSheet\(orderId\)/.test(fn('openSentOrder')), 'and what it moves on to is the order');
  t.check(!/Track this order|What happens next/.test(src), 'the old list of next steps and its button are gone');
}

/* ---------- 7. the shop's number comes from the shop ------------------- */
{
  const cat = read('supabase/functions/agent-catalog/index.ts');
  const block = cat.slice(cat.indexOf('if (action === "shop")'), cat.indexOf('if (action === "promotions")')).replace(/^\s*\/\/.*$/gm, '');
  t.check(block.length > 0, 'agent-catalog answers "shop"');
  t.check(/shop: \{\s*name:[\s\S]*phone:[\s\S]*address:[^}]*\}/.test(block) && !/discount|markup|presets,/.test(block.replace(/const presets[^;]*;/, '')),
    'with the name, phone and address and nothing else from the shop\'s settings');
}

/* ---------- 8. Today's header: every part is a door -------------------- */
{
  t.check(/getElementById\('ag_ringBtn'\)\.addEventListener\('click', \(\)=> openGoalSheet\(\)\)/.test(src), 'the ring opens the goal');
  t.check(/getElementById\('ag_moneyBtn'\)\.addEventListener\('click', \(\)=> openMoneySheet\(\)\)/.test(src), 'the figure opens the money');
  t.check(/getElementById\('ag_meBtn'\)\.addEventListener\('click', \(\)=> openProfileSheet\(\)\)/.test(src), 'your initials open you');
  t.check(/b\.dataset\.hero === 'near'\) openNearSheet\(\);\s*else openStandingSheet\(\);/.test(src), 'and the glass bar opens what is within reach, and where you stand');
  t.check(/if\(key !== 'needs'\)\{ openStageSheet\(key\); return; \}/.test(src), 'each stage tile opens its own page');
}

process.exit(t.done() ? 1 : 0);
