'use strict';
/*
 * One shop with something waiting in every one of the Manager's queues
 * (docs/decision-rights.md): the canvas's Mukasa Hardware on a Saturday.
 * Shared by test/manager-decide.test.js and the screenshot harness.
 */
const NOW = Date.now(), H = 3600e3, DAY = 864e5;
const iso = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const TODAY = iso(NOW), M0 = TODAY.slice(0, 8) + '01';
const monthEnd = (() => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime()); })();
const L = (lineId, pid, name, qty, cost, sell, extra) => ({ lineId, productId: pid, variantIdx: null, productName: name, unit: 'pc', packUnit: '', packQty: 0, qtyIn: 'unit', qty, supplierId: '__stock__', supplierName: 'Our stock', price: cost, sellPrice: sell, ...(extra || {}) });
const ago = ms => new Date(NOW - ms).toISOString();
// A dated bill on a customer's debt log, n days old.
const chg = (id, days, amount, quoteId) => ({ id, date: iso(NOW - days * DAY), type: 'charge', amount, note: 'Auto-sync — INV-' + String(quoteId).padStart(4, '0'), cashTxnId: null, quoteId });
// Delivered and billed over the last six days: [id, customer, name, days back, hours back, qty, unit price, paid, driver photo].
const DEL = [[2380, 'C5', 'Kato Construction', 0, 1.5, 20, 109000, 2180000], [2381, 'C4', 'Lubowa Builders', 0, 3, 4, 134000, 536000], [2382, 'C3', 'Ggaba Stores', 0, 2, 3, 140000, 120000],
  [2383, 'C1', 'Kyaligonza & Sons', 1, 4, 14, 121570, 0], [2384, 'C2', 'Mukono Roofing', 1, 6, 4, 97000, 388000], [2385, 'C6', 'Nansana Hardware', 3, 5, 10, 148000, 404000],
  [2386, 'C5', 'Kato Construction', 3, 7, 8, 117500, 940000], [2387, 'C3', 'Ggaba Stores', 4, 3, 5, 55000, 275000], [2389, 'C2', 'Mukono Roofing', 5, 4, 6, 100000, 600000]];
function DELIVERED(){
  return DEL.map(([id, cid, name, d, h, qty, price, paid], i) => { const at = NOW - d * DAY - h * H;
    return { id, status: 'completed', invoiced: true, invoicedAt: iso(at), date: iso(at), amountPaid: paid, voided: false, client: { name }, customerId: cid, items: [L(1, 'P1', 'Iron sheet G28 · 3 m', qty, 98000, price)], charges: [], payments: [],
      takenBy: ['u2', 'u3', 'u4'][i % 3], createdAt: new Date(at - 5 * H).toISOString(), stageEnteredAt: at, deliveredAt: at, deliveredPhoto: i % 4 === 2 ? null : 'p.jpg', assignedDeliveryId: 'D1' }; });
}
// Money in: today's payments against those deliveries, and the days before.
function RECEIPTS(){
  const r = (id, d, account, amount, time, quoteId) => ({ id, date: iso(NOW - d * DAY), account, type: 'receipt', category: 'Debt Payment', amount, description: 'Payment — INV-' + String(quoteId).padStart(4, '0'), time, quoteId, enteredBy: 'u1' });
  return [r(701, 0, 'cash', 2180000, '09:45', 2380), r(702, 0, 'mobile', 536000, '12:05', 2381), r(703, 0, 'cash', 120000, '14:10', 2382),
    r(704, 1, 'cash', 388000, '16:20', 2384), r(705, 2, 'bank', 1300000, '11:00', 380), r(706, 3, 'bank', 404000, '13:30', 2385), r(707, 3, 'cash', 940000, '15:00', 2386),
    r(708, 4, 'mobile', 275000, '10:10', 2387), r(709, 5, 'cash', 600000, '09:20', 2389)];
}

function fixture(){
  return {
    suppliers: [{ id: 'SUP1', name: 'Kiseka Steel', phone: '' }, { id: 'SUP2', name: 'Nakawa Cement Depot', phone: '' }],
    staff: [
      { id: 'M1', name: 'Ruth Nakato', phone: '0772000001', role: 'manager', unavailable: false, userId: 'u1' },
      { id: 'S1', name: 'Grace Akello', phone: '0772000101', role: 'sales', unavailable: false, userId: 'u2' },
      { id: 'S2', name: 'Brian Ouma', phone: '0772000102', role: 'sales', unavailable: false, userId: 'u3' },
      { id: 'S3', name: 'Faith Nambi', phone: '0772000103', role: 'sales', unavailable: false, userId: 'u4' },
      { id: 'B1', name: 'Denis Okello', phone: '0772300233', role: 'buyer', unavailable: false, userId: 'u9' },
      { id: 'W1', name: 'Musa Kiggundu', phone: '0772300101', role: 'store', unavailable: false, userId: 'u7' },
      { id: 'W2', name: 'Joy Namata', phone: '0772300102', role: 'store', unavailable: false, userId: 'u8' },
      { id: 'A1', name: 'Esther Auma', phone: '0772300400', role: 'accounts', unavailable: false, userId: 'u10' },
      { id: 'D1', name: 'Ssali Paul', phone: '0772300377', role: 'delivery', unavailable: false, userId: null }],
    customers: [
      { id: 'C1', name: 'Kyaligonza & Sons', phone: '0700111222', phone2: '', location: 'Najjera', notes: '', debt: 746000, termsDays: 7, creditLimit: 600000, debtLog: [chg(1, 12, 746000, 405)] },
      { id: 'C2', name: 'Mukono Roofing', phone: '0700333444', phone2: '', location: 'Mukono', notes: '', debt: 2310000, termsDays: 7, creditLimit: 3000000, debtLog: [chg(2, 38, 878000, 380), chg(3, 3, 1432000, 412)] },
      { id: 'C3', name: 'Ggaba Stores', phone: '0700555666', phone2: '', location: 'Ggaba', notes: '', debt: 2448000, termsDays: 14, creditLimit: 4000000, debtLog: [chg(4, 4, 1224000, 418), chg(5, 4, 1224000, 419)] },
      { id: 'C4', name: 'Lubowa Builders', phone: '', phone2: '', location: 'Lubowa', notes: '', debt: 560000, termsDays: 7, creditLimit: 2000000, debtLog: [chg(6, 16, 560000, 396)] },
      { id: 'C5', name: 'Kato Construction', phone: '', phone2: '', location: 'Kireka', notes: '', debt: 615000, termsDays: 7, creditLimit: null, debtLog: [chg(7, 25, 615000, 388)] },
      { id: 'C6', name: 'Nansana Hardware', phone: '', phone2: '', location: 'Nansana', notes: '', debt: 0, termsDays: null, creditLimit: null, debtLog: [] }],
    products: [
      { id: 'P1', name: 'Iron sheet G28 · 3 m', type: 'simple', wholesaleMarkupType: 'percent', wholesaleMarkupValue: 14, stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 0, variants: [] },
      { id: 'P2', name: 'Hima cement · 50 kg', type: 'simple', wholesaleMarkupType: 'percent', wholesaleMarkupValue: 12, stockWholesaleMarkupType: 'percent', stockWholesaleMarkupValue: 0, variants: [] },
      { id: 'P3', name: 'PVC gutter · 4 m', type: 'simple', variants: [] },
      { id: 'P4', name: 'Binding wire · 25 kg', type: 'simple', variants: [] },
      { id: 'P5', name: 'Wheelbarrow · heavy duty', type: 'simple', wholesaleMarkupType: 'percent', wholesaleMarkupValue: 25, variants: [] },
      { id: 'P6', name: 'Ridge cap', type: 'simple', wholesaleMarkupType: 'percent', wholesaleMarkupValue: 15, variants: [] }],
    prices: [], stock: { P1: 40, P2: 12, P5: 1, P6: 30 }, stockLots: { P1: [{ qty: 40, cost: 98000 }], P2: [{ qty: 12, cost: 34500 }], P6: [{ qty: 30, cost: 45000 }] },
    savedQuotes: [
      // invoiced: Mukono's bill a return is asked on, Ggaba billed twice
      { id: 412, status: 'completed', invoiced: true, invoicedAt: iso(NOW - 3 * DAY), date: iso(NOW - 3 * DAY), amountPaid: 0, voided: false, client: { name: 'Mukono Roofing' }, customerId: 'C2', items: [L(1, 'P1', 'Iron sheet G28 · 3 m', 10, 98000, 112000), L(2, 'P6', 'Ridge cap', 6, 45000, 52000)], charges: [], payments: [], debtCharged: 1432000, takenBy: 'u3', createdAt: ago(4 * DAY) },
      { id: 418, status: 'completed', invoiced: true, invoicedAt: iso(NOW - 4 * DAY), date: iso(NOW - 4 * DAY), amountPaid: 0, voided: false, client: { name: 'Ggaba Stores' }, customerId: 'C3', items: [L(1, 'P1', 'Iron sheet G28 · 3 m', 10, 98000, 112000), L(2, 'P6', 'Ridge cap', 2, 45000, 52000)], charges: [], payments: [], debtCharged: 1224000, takenBy: 'u3', createdAt: ago(4 * DAY + 4 * 60e3) },
      { id: 419, status: 'completed', invoiced: true, invoicedAt: iso(NOW - 4 * DAY), date: iso(NOW - 4 * DAY), amountPaid: 0, voided: false, client: { name: 'Ggaba Stores' }, customerId: 'C3', items: [{ ...L(1, 'P1', 'Iron sheet G28 · 3 m', 10, 98000, 112000), _stockTaken: 10 }, { ...L(2, 'P6', 'Ridge cap', 2, 45000, 52000), _stockTaken: 2 }], charges: [], payments: [], debtCharged: 1224000, takenBy: 'u3', createdAt: ago(4 * DAY + 2 * 60e3) },
      // Checking: a price under the shop's (Kyaligonza, two lines), a line with no
      // selling price (Lubowa), a counter sale (Faith), a line with no known cost (Kato)
      { id: 2415, status: 'draft', invoiced: false, voided: false, client: { name: 'Kyaligonza & Sons' }, customerId: 'C1',
        items: [L(1, 'P1', 'Iron sheet G28 · 3 m', 20, 98000, 102000, { priceBy: 'u3', priceNote: 'under', priceShop: 111720, priceAt: ago(2 * H) }), L(2, 'P2', 'Hima cement · 50 kg', 40, 34500, 36000, { priceBy: 'u3', priceNote: 'under', priceShop: 38640, priceAt: ago(2 * H) })],
        charges: [], payments: [], takenBy: 'u3', createdAt: ago(2 * H + 10 * 60e3), stageEnteredAt: NOW - 2 * H - 10 * 60e3 },
      { id: 2420, status: 'draft', invoiced: false, voided: false, client: { name: 'Lubowa Builders' }, customerId: 'C4',
        items: [L(1, 'P3', 'PVC gutter · 4 m', 40, 18000, 22500, { priceBy: 'u4', priceNote: 'nomargin', priceAt: ago(25 * 60e3) })],
        charges: [], payments: [], takenBy: 'u4', createdAt: ago(25 * 60e3), stageEnteredAt: NOW - 25 * 60e3 },
      { id: 2430, status: 'draft', invoiced: false, voided: false, counter: true, client: { name: 'Walk-in' }, customerId: null,
        items: [L(1, 'P5', 'Wheelbarrow · heavy duty', 1, 120000, 140000, { priceBy: 'u4', priceNote: 'under', priceShop: 150000, priceAt: ago(80e3) })],
        charges: [], payments: [], takenBy: 'u4', createdAt: ago(80e3), stageEnteredAt: NOW - 80e3 },
      { id: 2391, status: 'completed', invoiced: false, voided: false, client: { name: 'Kato Construction' }, customerId: 'C5', deliveredAt: NOW - 30 * H,
        items: [L(1, 'P4', 'Binding wire · 25 kg', 12, 0, 51000, { priceBy: 'u3', priceNote: 'nocost', priceAt: ago(31 * H) })],
        charges: [], payments: [], takenBy: 'u3', createdAt: ago(40 * H), stageEnteredAt: NOW - 30 * H },
      // delivered, ready to bill; and one picked short
      { id: 2402, status: 'completed', invoiced: false, voided: false, client: { name: 'Mukono Roofing' }, customerId: 'C2', deliveredAt: NOW - 5 * H, items: [L(1, 'P1', 'Iron sheet G28 · 3 m', 5, 98000, 112000, { pickStatus: 'done' })], charges: [], payments: [], takenBy: 'u2', createdAt: ago(9 * H), stageEnteredAt: NOW - 5 * H },
      { id: 2400, status: 'preparing', invoiced: false, voided: false, client: { name: 'Nansana Hardware' }, customerId: 'C6', items: [L(1, 'P2', 'Hima cement · 50 kg', 40, 34500, 38640, { pickStatus: 'short', pickedQty: 34 })], charges: [], payments: [], takenBy: 'u2', createdAt: ago(5 * H), stageEnteredAt: NOW - H, assignedWorkerId: 'W1', pickingStatus: 'done' },
      // an agent asks for fewer of a line on a paid order
      { id: 2410, status: 'awaiting_goods', invoiced: false, voided: false, client: { name: 'Ggaba Stores' }, customerId: 'C3', originAgentName: 'Peter Sserwadda', amountPaid: 1120000,
        items: [L(1, 'P1', 'Iron sheet G28 · 3 m', 10, 98000, 112000)], charges: [], payments: [], takenBy: 'u2', createdAt: ago(6 * H), stageEnteredAt: NOW - 3 * H,
        agentChange: { state: 'asked', at: ago(H), lines: [{ productId: 'P1', variantIdx: null, productName: 'Iron sheet G28 · 3 m', from: 10, to: 6 }] } },
      // the week's deliveries, already billed (Money › In today and Orders › Delivered)
      ...DELIVERED(),
    ],
    cashTxns: RECEIPTS(),
    collectionTrips: [{ id: 'TRIP-K1', supplierId: 'SUP1', status: 'collected', assignedWorkerId: 'B1', createdAt: ago(8 * H), assignedAt: ago(8 * H), voided: false, yardCheckedAt: ago(4 * H), yardCheckedBy: 'u7',
      lines: [{ productId: 'P1', productName: 'Iron sheet G28 · 3 m', qty: 50, gotQty: 50, yardQty: 47, gotPrice: 98000 }, { productId: 'P6', productName: 'Ridge cap', qty: 12, gotQty: 12, yardQty: 13, gotPrice: 45000 }, { productId: 'P2', productName: 'Hima cement · 50 kg', qty: 30, gotQty: 30, yardQty: 30, gotPrice: 34500 }],
      cashCount: { given: 5000000, paid: 4690000, counted: 280000, diff: -30000, by: 'u10', byName: 'Esther Auma', at: ago(3 * H) } }],
    targets: [{ id: 1, date: M0, status: 'open', body: { metric: 'sales', aim: 105000000, from: M0, to: monthEnd } },
      { id: 2, date: M0, status: 'open', body: { metric: 'sales', aim: 35000000, from: M0, to: monthEnd, who: 'u2' } },
      { id: 3, date: M0, status: 'open', body: { metric: 'sales', aim: 30000000, from: M0, to: monthEnd, who: 'u3' } },
      { id: 4, date: M0, status: 'open', body: { metric: 'sales', aim: 30000000, from: M0, to: monthEnd, who: 'u4' } }],
    statementsSent: [], promises: [],
    presetCreditPct: 0, presetDefaultMarkup: { wholesaleType: 'percent', wholesaleValue: 25 }, presetChaseAfterDays: 7,
    presetOrderStageLimits: { draft: 120, awaiting_goods: 1440, preparing: 120, pending_delivery: 240 }, presetCreditHold: { days: 21 }, presetShopAddress: '', presetShopPhone: '',
    invoiceAsks: [
      { id: 'ask-cr', quoteId: 412, customerId: 'C2', kind: 'credit', lines: [{ idx: 0, name: 'Iron sheet G28 · 3 m', qty: 4, price: 112000, amount: 448000 }], amount: 448000, reason: '4 sheets came back scratched from the truck', askedByName: 'Brian Ouma', status: 'sent', createdAt: ago(3 * H) },
      { id: 'ask-vd', quoteId: 419, customerId: 'C3', kind: 'void', lines: [], amount: 1224000, reason: 'Raised twice for the same delivery, 2 minutes apart', askedByName: 'Esther Auma', status: 'sent', createdAt: ago(2 * H) }],
    stockCounts: [{ id: 'cnt-1', aisle: 'Aisle 4 · hinges, locks, screws', countedByName: 'Joy Namata', status: 'sent', createdAt: ago(5 * H),
      lines: [{ key: 'P5', productId: 'P5', name: 'Wheelbarrow · heavy duty', counted: 1, system: 1 }, { key: 'P6', productId: 'P6', name: 'Ridge cap', counted: 28, system: 30 }] }],
    stockReports: [{ id: 'rep-1', key: 'P1', productId: 'P1', variantIdx: null, name: 'Iron sheet G28 · 3 m', qty: 2, why: 'damaged', note: 'bent in the rain', reportedBy: 'u7', status: 'sent', createdAt: ago(6 * H) }],
    restockLines: [{ id: 'rs-1', productId: 'P2', name: 'Hima cement · 50 kg', qty: 200, unit: 'bags', cost: 34500, status: 'planned', createdBy: 'u9', forDate: iso(NOW + 2 * DAY) },
      { id: 'rs-2', productId: 'P5', name: 'Wheelbarrow · heavy duty', qty: 10, unit: 'pcs', cost: 120000, status: 'held', createdBy: 'u9', forDate: iso(NOW + 2 * DAY) }],
    rivals: [{ productId: 'P3', variantIdx: null, price: 23000 }],
  };
}
const ALL = ['order.move', 'order.assign', 'credit.release', 'team.nudge', 'customer.edit', 'payment.receive', 'statement.send',
  'price.approve', 'markup.set', 'margin.see', 'invoice.make', 'pick.settle', 'credit_note.raise', 'invoice.void', 'credit.set',
  'promise.record', 'agent.change', 'trip.difference', 'stock.writeoff', 'stock.correct', 'restock.hold', 'goal.set', 'team.limits'];
module.exports = { fixture, ALL, NOW, H, DAY, iso, TODAY };
