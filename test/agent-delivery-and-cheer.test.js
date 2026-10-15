#!/usr/bin/env node
'use strict';
/*
 * Delivering to an agent's client, and the shop cheering its agents on.
 *
 * DELIVERY. An agent's order the shop delivers now carries who takes it
 * in and when, and the shop's own delivery fee as a charge on the order
 * -- so the board, the agent's payment and the client's price all count
 * it the same way. The board asks "Delivered?" when the order lands, and
 * the agent sees who received it and the photo, if there is one.
 *
 * PERSONAL. A shout-out from the owner lands on the agent's Today and
 * phone; regulars gone quiet are drawn against their own rhythm with a
 * hello ready; the month becomes a picture for WhatsApp Status, with the
 * agent's earnings left off unless they choose otherwise.
 *
 * Run: node test/agent-delivery-and-cheer.test.js   (or: npm test)
 */
const { read, extractFunction, compileScope, createReporter } = require('./_extract');

const t = createReporter('agent delivery and cheer');
const agent = read('agent.html');
const board = read('index.html');
const mig = read('supabase/migrations/0111_delivery_proof_and_shoutouts.sql');
const submit = read('supabase/functions/agent-submit-order/index.ts');
const catalogFn = read('supabase/functions/agent-catalog/index.ts');
const nudge = read('supabase/functions/agent-nudge/index.ts');
const a = (name) => extractFunction(agent, name, 'agent.html');
const b = (name) => extractFunction(board, name, 'index.html');

/* ---------- 1. the shop's fee, found the same way on both sides ------- */
{
  const ts = (src, where) => extractFunction(src, 'shopDeliveryFee', where);
  const s1 = ts(submit, 'agent-submit-order'), s2 = ts(catalogFn, 'agent-catalog');
  t.check(s1 === s2, 'agent-catalog shows the agent the same fee agent-submit-order charges');
  const { shopDeliveryFee } = compileScope([s1], {}, ['shopDeliveryFee'], { typescript: true });
  const fee = shopDeliveryFee({ services: [{ name: 'Loading', type: 'fixed', value: 2000 }, { name: 'Delivery', type: 'fixed', value: 10000 }] });
  t.check(fee && fee.label === 'Delivery' && fee.value === 10000 && fee.type === 'fixed', 'the fee is the service the shop already named Delivery (or Transport)');
  t.check(shopDeliveryFee({ services: [{ name: 'Delivery', value: 0 }] }) === null && shopDeliveryFee(null) === null,
    'a delivery service with no amount, or none at all, is no fee -- never a 0 line on the client\'s price');
}

/* ---------- 2. what the order carries ---------------------------------- */
t.check(/const DELIVERY_WHEN = \["today_pm", "tomorrow_am", "tomorrow_pm"\]/.test(submit) && /DELIVERY_WHEN\.includes/.test(submit),
  'when it should arrive is one of three slots, checked on the server');
t.check(/agentDelivery: true/.test(submit), 'the fee is marked as the agent\'s delivery charge');
t.check(/filter\(\(ch: any\) => !\(ch && ch\.agentDelivery\)\)/.test(submit),
  'an edit swaps only that charge, never one the shop added on its board');
for (const f of ['agent-initiate-momo-payment', 'check-momo-payment-status', 'agent-change-order']) {
  const src = read(`supabase/functions/${f}/index.ts`);
  const ct = extractFunction(src, 'chargesTotal', f);
  // Its parameter types written out by hand: the shared stripper does not
  // reach inside a reduce callback's arguments.
  const { chargesTotal } = compileScope([ct.replace(/: (any|number)\b/g, '')], {}, ['chargesTotal']);
  t.check(chargesTotal({ charges: [{ type: 'fixed', value: 10000 }, { type: 'percent', value: 2 }, { type: 'fixed', value: -5 }] }, 500000) === 20000,
    `${f}: the order's charges are in what the agent pays -- fixed as written, a percent of the goods, nothing negative`);
}
{
  const api = compileScope([a('chargeValue'), a('orderShopGoods'), a('orderChargesAmount')], {}, ['orderChargesAmount']);
  const o = { items: [{ sellPrice: 31800, qty: 20 }], charges: [{ type: 'fixed', value: 10000 }] };
  t.check(api.orderChargesAmount(o) === 10000, 'the agent app totals a charge exactly as the board does');
  t.check(/orderShopGoods\(o\) \+ orderChargesAmount\(o\)/.test(a('orderOwedAmount')), 'and what the agent owes the shop includes it');
}

/* ---------- 3. the board keeps it, shows it, asks "Delivered?" -------- */
t.check(/\.\.\.\(q\.deliveryContact \? \{deliveryContact:q\.deliveryContact\} : \{\}\)/.test(board)
  && /\.\.\.\(q\.deliveryWhen \? \{deliveryWhen:q\.deliveryWhen\} : \{\}\)/.test(board)
  && /deliveredTo:q\.deliveredTo \|\| null, deliveredAt:q\.deliveredAt, deliveredPhoto:q\.deliveredPhoto \|\| null/.test(board),
  'a save from the board keeps the receiver, the slot and the proof -- a key not named is stripped');
{
  const api = compileScope([b('agentDeliveryWhenLabel'), b('agentDeliveryHandover')],
    { AGENT_DELIVERY_WHEN: { today_pm: ['today', 'afternoon'], tomorrow_am: ['tomorrow', 'morning'], tomorrow_pm: ['tomorrow', 'afternoon'] } },
    ['agentDeliveryHandover']);
  const q = { deliveryMode: 'shop_delivery', deliveryContact: { name: 'Okello', phone: '0772 111 333' }, deliveryWhen: 'tomorrow_am', createdAt: '2026-10-14T09:00:00' };
  t.check(api.agentDeliveryHandover(q, '2026-10-15T08:00:00') === 'Hand to Okello · 0772 111 333 · This morning',
    'the driver reads who to hand it to, their number, and when -- "tomorrow" said from the day it was sent, not the day it is read');
  t.check(api.agentDeliveryHandover(q, '2026-10-14T10:00:00') === 'Hand to Okello · 0772 111 333 · Tomorrow morning', 'the same order, read the day it came in');
  t.check(api.agentDeliveryHandover(Object.assign({}, q, { deliveryMode: 'agent_pickup' })) === '', 'and nothing for an order being collected');
}
t.check(/if\(status === 'completed' && typeof openDeliveredProof === 'function'\) openDeliveredProof\(q\);/.test(b('announceOrderMove')),
  'every move to Delivered by a person asks -- the one place a move is announced');
t.check(/q\.originAgentId && q\.deliveryMode === 'shop_delivery' && !q\.voided && !q\.deliveredAt/.test(b('deliveredProofWanted')),
  'only for an agent\'s delivery, and only once');
{
  const save = b('saveDeliveredProof');
  t.check(/`\$\{currentShopId\}\/\$\{q\.originAgentId\}\/\$\{q\.id\}-\$\{crypto\.randomUUID\(\)\}/.test(save),
    'the photo goes under the agent\'s own folder, which is the only one their key can read');
  t.check(/err\.hidden = false;\s*return;/.test(save) && save.indexOf('q.deliveredAt =') > save.indexOf('.upload('),
    'a photo that did not upload says so and saves nothing, rather than claiming a picture that is not there');
}
t.check(/<span class="k">\$\{d\.to \? 'Received by' : 'Delivered to'\}<\/span>/.test(agent) && /\$\{d\.at \? ' · the shop confirmed' : ''\}/.test(agent),
  'the agent sees "Received by" and "the shop confirmed" only when the shop said so -- a skipped step is not a confirmation');

/* ---------- 4. the database ------------------------------------------- */
t.check(/values \('delivery-photos', 'delivery-photos', false\)/.test(mig), 'delivery photos are private: they show a client\'s premises');
t.check(/\(storage\.foldername\(name\)\)\[2\] = public\.current_agent_id\(\(storage\.foldername\(name\)\)\[1\]::uuid\)/.test(mig),
  'an agent reads only the photos filed under their own id');
{
  const fnSql = mig.slice(mig.indexOf('create or replace function agent_delivery_driver'), mig.indexOf('revoke all on function agent_delivery_driver'));
  t.check(/security definer/.test(fnSql) && /q\.agent_id = current_agent_id\(p_shop_id\)/.test(fnSql) && /q\.status = 'pending_delivery'/.test(fnSql),
    'a driver\'s phone is handed out only for the caller\'s own order, and only while it is on the road');
}
t.check(/create policy "agent reads own shoutouts" on agent_shoutouts\s+for select using \(agent_id = current_agent_id\(shop_id\)\)/.test(mig)
  && /for all using \(is_shop_admin\(shop_id\)\)/.test(mig), 'admins write shout-outs; an agent reads only their own');
t.check(/where shop_id = p_shop_id and id = p_id and agent_id = current_agent_id\(p_shop_id\)/.test(mig)
  && /p_action not in \('thanks', 'away'\)/.test(mig), 'and can only say thanks or put one away -- never edit what the shop wrote');

/* ---------- 5. the shout-out reaches the phone, once ------------------ */
{
  const send = extractFunction(nudge, 'shoutSend', 'agent-nudge');
  t.check(/createClient\(SUPABASE_URL, ANON_KEY, \{ global: \{ headers: \{ Authorization: auth \} \} \}\)/.test(send)
    && /if \(!row\) return json\(\{ ok: false, why: "not_found" \}, 404\)/.test(send),
    'the row is read with the caller\'s own key: nobody buzzes a phone with a shout-out they could not see');
  const claim = extractFunction(nudge, 'sendShout', 'agent-nudge');
  t.check(/\.is\("notified_at", null\)\.select\("id"\)/.test(claim) && claim.indexOf('notified_at') < claim.indexOf('deliver('),
    'it is claimed before it is sent, so the button and the hourly run never both deliver it');
  t.check(/\.is\("notified_at", null\)\.gte\("created_at"/.test(nudge), 'the hourly run sends any the button missed');
  t.check(/if \(body\.action === "shout"\) return shoutSend\(req, body\);/.test(nudge), 'as its own action');
}
{
  const reasons = b('shoutoutReasons');
  const weeks = Array.from({ length: 12 }, (_, i) => ({ rev: i === 11 ? 900000 : i === 5 ? 400000 : 0, orders: 0 }));
  const api = compileScope([reasons], {
    AG_WEEKS: 12, agentWeeks: () => weeks, agNum: (n) => Math.round(n).toLocaleString('en-US'),
    agentOrders: () => [], daysSinceDate: () => 1, savedQuoteTotal: () => 0,
  }, ['shoutoutReasons']);
  const r = api.shoutoutReasons({ name: 'Brian Kato' }, '2026-10-15T09:00:00');
  t.check(r[0].key === 'week' && /900,000 this week/.test(r[0].msg) && /^Brian,/.test(r[0].msg),
    'a reason comes from the books -- this week against the last eleven -- and the words use their name');
  t.check(r[r.length - 1].key === 'thanks', 'and a plain thank-you is always there, for a quiet month too');
}
t.check(/data-agcheer="\$\{esc\(a\.id\)\}"/.test(b('agentOpenHTML')), 'the owner cheers an agent from their row on Sales agents');
t.check(/\.rpc\('agent_shoutout_react', \{ p_shop_id: currentShopId, p_id: Number\(id\), p_action: action \}\)/.test(a('reactShoutout')),
  'the agent\'s thanks go back through the one door the database leaves open');

/* ---------- 6. gone quiet ---------------------------------------------- */
{
  const { timesLabel } = compileScope([a('timesLabel')], {}, ['timesLabel']);
  t.check(timesLabel(4) === '4×' && timesLabel(2.5) === '2½×' && timesLabel(2.6) === '2½×' && timesLabel(12.4) === '12×',
    'how much longer than usual, in halves while a half matters');
  const today = new Date('2026-10-15T12:00:00');
  const cad = (gap, since) => ({ avgGapDays: gap, daysSince: since, lastDateKey: 'k', avgMargin: 15000 });
  const plan = { A: cad(10, 40), B: cad(10, 15), C: cad(3, 10), D: cad(30, 200), E: cad(14, 35) };
  const store = {};
  const api = compileScope([a('saidHiAll'), a('saidHiSet'), a('quietRegulars')], {
    SAID_HI_KEY: 'k', localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } },
    clientOrderCounts: () => new Map(), liveOrders: () => [{ agentClientId: 'E' }],
    agentClients: ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, name: id })),
    clientCadence: (c) => plan[c.id],
  }, ['quietRegulars']);
  const ids = api.quietRegulars(today).map((r) => r.c.id);
  t.check(ids.join() === 'A',
    'gone quiet means twice their own rhythm and two weeks at least -- not a weekly client a few days late, not one gone half a year, not one with an order on the way');
}
t.check(/No order in 3 days\? We'll remind you once\./.test(a('openSayHiSheet')) && /reminded: false/.test(a('openSayHiSheet')),
  'a hello sent is remembered, so the app can remind once');
t.check(/s\.reminded = true/.test(a('sayHiReminder')), 'and it reminds once, then leaves it alone');

/* ---------- 7. the month as a picture -------------------------------- */
{
  const open = a('openMonthCard');
  t.check(/let showMoney = false;/.test(open), 'the agent\'s earnings are off the card unless they turn them on');
  const draw = a('drawMonthCard');
  t.check(/if\(showMoney\)\{[\s\S]*?fmtNum\(s\.total\)/.test(draw) && (draw.match(/s\.total/g) || []).length === 1,
    'the only place the card draws the money is behind that switch');
  t.check(/<img class="card" src="\$\{cv\.toDataURL\('image\/png'\)\}"/.test(open), 'the preview is the picture itself, so what is shown is what goes out');
}

/* ---------- 8. from our shelf ------------------------------------------ */
{
  // The server: a line the shelf covers arrives as our stock, confirmed.
  const sq = extractFunction(submit, 'shelfQtyOf', 'agent-submit-order');
  const uk = extractFunction(submit, 'unitKey', 'agent-submit-order');
  const { shelfQtyOf } = compileScope([uk, sq].map((x) => x.replace(/: (any\[\]|any|number|string)( \| null)?(?=[,)=\s{])/g, '')), {}, ['shelfQtyOf']);
  const rows = [{ unit: 'Dozen', pack_unit: 'Ctn', pack_qty: 6 }];
  t.check(shelfQtyOf(rows, 10, 'Dozen') === 10 && shelfQtyOf(rows, 2, 'Ctn') === 12,
    'a line is counted in the shelf\'s own unit -- two cartons of six dozen is twelve dozen off the shelf');
  t.check(shelfQtyOf(rows, 3, 'Box') === null, 'and a unit the shelf cannot be restated in is never guessed at');
  t.check(/supplierId: fromShelf \? "__stock__" : best\.supplier_id/.test(submit) && /\.\.\.\(fromShelf \? \{ shelfAuto: true \} : \{\}\)/.test(submit),
    'a covered line goes on as our stock, marked as set on arrival');
  t.check(/\.eq\("invoiced", false\)\.eq\("voided", false\)/.test(submit) && /spoken\.set\(k, /.test(submit),
    'what other open orders were promised from the shelf is taken off first -- stock only leaves on invoicing');
  t.check(/if \(!stockR\.error && !lotsR\.error && !openR\.error\)/.test(submit),
    'and if the shelf cannot be read the order still goes in, every line with its supplier as before');
  t.check(/agentSellPrice: Number\(it\.agentSellPrice\)/.test(submit) && !/fromShelf[^\n]*sellPrice/.test(submit),
    'the agent\'s price is never touched by where the goods come from');

  // The board: one tap to take a line from the shelf, and back.
  const src = board;
  t.check(/var free = on\.qty - ofShelfSpoken\(it\.productId, vi, q\.id\);/.test(src) && /if \(!on\.counted\) return null;/.test(src),
    'the board offers the shelf only for stock that has been counted and is not already promised elsewhere');
  t.check(/it\.supplierId = '__stock__';[\s\S]{0,200}agentShelfConfirm\(q\);/.test(src),
    '"Use our stock" moves the line to our stock and, once every line is settled, confirms the order for the agent');
  t.check(/if \(q\.shopConfirmedAt && q\.agentPaymentStatus !== 'paid'\) \{ q\.shopConfirmedAt = null; q\.shopConfirmedTerms = null; \}/.test(src),
    'taking it back to a supplier withdraws that confirmation, so the agent is never told it is settled when it is not');
  t.check(/Use our stock<\/button>/.test(src) && /\{\{ln\.unShelfLabel\}\}/.test(src), 'both acts are on the line itself');
}

process.exit(t.done() ? 1 : 0);
