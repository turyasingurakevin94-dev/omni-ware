#!/usr/bin/env node
'use strict';
/*
 * Changing an order, as the boards draw it.
 *
 *   - Edit items ends in Was / Now / Re-check.
 *   - Once paid, Ask the shop has three tabs: Fewer, More, Cancel. More
 *     is an add-on -- its own small order that rides with this one
 *     (agent-submit-order's addonOf): checked and paid on its own, packed
 *     with it, sent on the same trip for the one fee already charged.
 *   - Both orders show on one track, and the shop's board says which
 *     order an add-on rides with.
 *   - A cancel ends on a Sorry screen: what went with it, any credit, what
 *     happened (agent-change-order's `why`, for the shop), and the way back.
 *
 * Run: node test/agent-addon.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent add-on');
const app = read('agent.html');
const fn = (n) => extractFunction(app, n, 'agent.html');
const submit = read('supabase/functions/agent-submit-order/index.ts');
const change = read('supabase/functions/agent-change-order/index.ts');
const admin = read('index.html');

/* ---------- 1. the server: which orders take an add-on ---------------- */
{
  const { addonRefusal } = compileScope(
    [`const ADDON_STATUSES = ["draft", "awaiting_goods", "preparing"];`, extractFunction(submit, 'addonRefusal', 'agent-submit-order')],
    {}, ['addonRefusal'], { typescript: true });
  const o = (status, p) => ({ id: 9, status, voided: false, payload: Object.assign({ originAgentId: 'a1', agentClientId: 7 }, p || {}) });
  t.check(addonRefusal(o('preparing'), 'a1', 7) === null, 'an order being packed takes an add-on');
  t.check(addonRefusal(o('draft', { agentPaymentStatus: 'paid' }), 'a1', 7) === null, 'so does one paid and waiting to be packed');
  t.check(/left the shop/.test(addonRefusal(o('pending_delivery'), 'a1', 7)), 'once it is out, more is a new order');
  t.check(/different client/.test(addonRefusal(o('preparing'), 'a1', 8)), 'an add-on is for the same client');
  t.check(/not belong/.test(addonRefusal(o('preparing'), 'a2', 7)), 'and only on the agent\'s own order');
  t.check(/first order/.test(addonRefusal(o('preparing', { addonOf: 3 }), 'a1', 7)), 'never an add-on of an add-on');
  t.check(/cancelled/.test(addonRefusal(o('preparing', { agentCancel: { at: 'x' } }), 'a1', 7)), 'nor on a cancelled order');
}
{
  t.check(/const delivery = rp \? \{/.test(submit) && /deliveryAddress: delivering \? \(rp\.deliveryAddress \|\| null\)/.test(submit),
    'an add-on goes where its order goes: the delivery is the first order\'s, not the request\'s');
  t.check(/const fee = delivering && !rp \?/.test(submit), 'and carries no fee of its own -- one trip, one fee');
  t.check(/\.\.\.\(riding \? \{ addonOf: riding\.id \} : \{\}\)/.test(submit), 'the new order names the one it rides with');
  t.check(/replaceOrderId != null && addonOf != null/.test(submit), 'an edit is never also an add-on');
}

/* ---------- 2. the server: what happened, after a cancel -------------- */
{
  t.check(/action === "why"/.test(change) && /Only a cancelled order takes a reason/.test(change),
    'the reason is taken only on a cancelled order');
  t.check(/CLIENT_WHYS\.includes\(body\.why\)/.test(change), 'and only one of the listed reasons');
  const appWhys = (app.match(/const CLIENT_WHYS = (\[[^\]]*\])/) || [])[1];
  const srvWhys = (change.match(/const CLIENT_WHYS = (\[[^\]]*\])/) || [])[1];
  t.check(appWhys && srvWhys && JSON.stringify(JSON.parse(appWhys.replace(/'/g, '"'))) === JSON.stringify(JSON.parse(srvWhys)),
    'the chips on the Sorry screen are the reasons the server accepts');
}

/* ---------- 3. the shop's board keeps both keys, and says it ---------- */
{
  t.check(/\.\.\.\(q\.addonOf != null \? \{addonOf:q\.addonOf\} : \{\}\)/.test(admin),
    'the board\'s save keeps addonOf -- a key not named is stripped');
  t.check(/\.\.\.\(q\.agentCancelWhy \? \{agentCancelWhy:q\.agentCancelWhy\} : \{\}\)/.test(admin), 'and the agent\'s reason');
  t.check(/agentCancelWhy:payload->agentCancelWhy/.test(admin), 'a reason given after the board read the order is read back before a save');
  const row = extractFunction(admin, 'orderAddonRowHTML', 'index.html');
  t.check(/rides with #/.test(row) && /ADD-ON/.test(row), 'an add-on\'s card says which order it rides with');
  t.check(/\$\{orderAddonRowHTML\(q\)\}/.test(admin), 'and the card draws it');
}

/* ---------- 4. the app: when More is offered --------------------------- */
{
  const S = compileScope([`const ADDON_STATUSES = ['draft', 'awaiting_goods', 'preparing'];`, fn('addonOpen')],
    { changeZone: (o) => o.zone }, ['addonOpen']);
  t.check(S.addonOpen({ status: 'preparing', zone: 'ask' }), 'paid and packing: More is there');
  t.check(!S.addonOpen({ status: 'draft', zone: 'free' }), 'before paying the agent edits the order itself instead');
  t.check(!S.addonOpen({ status: 'pending_delivery', zone: 'ask' }), 'once out, no add-on');
  t.check(!S.addonOpen({ status: 'preparing', zone: 'ask', addonOf: 4 }), 'an add-on takes no add-on of its own');
  const ask = fn('openAskSheet');
  t.check(/data-mode="fewer"/.test(ask) && /data-mode="more"/.test(ask) && /data-mode="cancel"/.test(ask) && /ax-seg3/.test(ask),
    'Ask the shop has three tabs: Fewer, More, Cancel');
  t.check(!/Need more\? Start a new order/.test(ask), 'the old "start a new order" link is gone -- More is the add-on');
  const send = fn('addonClick');
  t.check(/addonOf: o\.id/.test(send) && /'agent-submit-order'/.test(send), 'Send add-on submits an order riding with this one');
  t.check(/openPairWhenIn\(/.test(send), 'and opens both on one track');
}

/* ---------- 5. the add-on starts from the client's regulars ------------ */
{
  const S = compileScope([fn('addonDraft')], {
    orderClient: () => ({ name: 'Kato Construction' }),
    changeLineKey: (x) => `${x.productId}::${x.variantIdx == null ? '' : x.variantIdx}`,
    clientUsuals: () => ({ regs: [{ productId: 'c' }, { productId: 'n' }, { productId: 'gone' }, { productId: 'w' }, { productId: 'b' }] }),
    catalogEntry: (id) => (id === 'gone' ? null : { productId: id }),
  }, ['addonDraft']);
  const d = S.addonDraft({ items: [{ productId: 'c' }] });
  t.check(d.regs.map((r) => r.productId).join(',') === 'n,w,b',
    'what the client usually adds, minus what is on the order and what the shop no longer lists, three at most');
  t.check(d.finding === false && d.lines.length === 0, 'nothing added until the agent taps');
}

/* ---------- 6. edit items ends Was / Now / Re-check -------------------- */
{
  const ed = fn('openEditItemsSheet');
  t.check(/class="ax-edbar"/.test(ed) && />Was</.test(ed) && />Now</.test(ed) && />Re-check</.test(ed),
    'the bar under Edit items is Was / Now / Re-check, as on the board');
  t.check(!/Shop checks/.test(ed), 'not the older Client pays / You earn / Shop checks');
}

/* ---------- 7. both orders on one track -------------------------------- */
{
  const S = compileScope([fn('pairStepIndex')], {}, ['pairStepIndex']);
  t.check(S.pairStepIndex({ key: 'checking' }) === 0 && S.pairStepIndex({ key: 'packing' }) === 3 && S.pairStepIndex({ key: 'done' }) === 5,
    'each order\'s five steps: checking first, packing fourth, done all filled');
  const pair = fn('openPairSheet');
  t.check(/rides together/.test(pair) && /1 fee/.test(pair), 'joined where they ride together, one trip, one fee');
  t.check(/from the add-on/.test(pair) && /for the add-on only/.test(pair), 'what is yours from each, and that the add-on is paid on its own');
  t.check(/One receipt/.test(pair) && /pairReceiptOrder\(/.test(pair), 'one receipt for both');
  t.check(/\$\{pairChipHTML\(o\)\}/.test(fn('openTrackSheet')), 'each order\'s own track leads to the pair');
  const rc = compileScope([fn('pairReceiptOrder')], {
    orderShopGoods: (o) => o.items.reduce((s, i) => s + i.sellPrice * i.qty, 0),
    chargeValue: (ch, goods) => (ch.type === 'percent' ? Math.round(goods * ch.value / 100) : ch.value),
  }, ['pairReceiptOrder']);
  const r = rc.pairReceiptOrder({ id: 1, items: [{ sellPrice: 100, qty: 10 }], charges: [{ label: 'Delivery', type: 'percent', value: 10 }] },
    [{ id: 2, items: [{ sellPrice: 50, qty: 4 }] }]);
  t.check(r.items.length === 2 && r.charges[0].type === 'fixed' && r.charges[0].value === 100,
    'the receipt carries both orders\' lines, and the first order\'s fee as it was charged -- not re-figured on both');
}

/* ---------- 8. sorry, once ---------------------------------------------- */
{
  const store = {};
  const S = compileScope([fn('sorrySeenKey'), fn('sorrySeen'), fn('markSorrySeen')], {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    agentLocalKey: (k) => k,
  }, ['sorrySeen', 'markSorrySeen']);
  S.markSorrySeen(1061); S.markSorrySeen(1061);
  t.check(S.sorrySeen().join() === '1061', 'a Sorry screen is remembered once it has been shown');
  const may = fn('maybeSorry');
  t.check(/agentCancel\.agreed/.test(may) && /3 \* 86400000/.test(may), 'a cancel the shop agreed to shows once, while it is recent');
  const sorry = fn('openSorry');
  t.check(/action: 'why'/.test(sorry) && /only the shop sees this/.test(sorry), 'what happened goes to the shop, and says so');
  t.check(/creditLeftOf\(o\)/.test(sorry) && /applied first/.test(sorry), 'money coming back is shown, and used first on the way back');
  t.check(/goToClientBasket\(cl\)/.test(sorry), 'Win them back starts that client\'s next order');
  t.check(/openSorry\(o\.id, \{ free: true/.test(fn('openCancelSheet')), 'cancelling before paying ends on the Sorry screen, not a toast');
  const back = compileScope([fn('clientsComeBack')], {
    orderDate: (o) => o.date,
    myOrders: [
      { agentClientId: 1, date: '2026-09-01', agentCancel: {} }, { agentClientId: 1, date: '2026-09-10' },
      { agentClientId: 2, date: '2026-09-02', agentCancel: {} }, { agentClientId: 2, date: '2026-09-12' },
      { agentClientId: 3, date: '2026-09-03', voided: true },
    ],
  }, ['clientsComeBack']);
  t.check(Math.abs(back.clientsComeBack() - 2 / 3) < 1e-9, '"most come back" is counted from the agent\'s own books');
}

t.done();
