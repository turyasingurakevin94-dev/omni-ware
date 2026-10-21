'use strict';
/*
 * The shared Manager fixture plus Round 4's three asks:
 *   - Ggaba's wheelbarrows: the Buyer took Katwe's new cost (120,000 ->
 *     165,000), above the 155,000 Faith sold at (PriceAtCost);
 *   - Musa loading Bweyogerere Builders' unpaid first order, a new
 *     cash-only customer: "let it go on credit?" (CreditAsk);
 *   - Denis's carton of wall plugs, 1 pack sold and 199 for the shelf,
 *     held for the Manager's OK (0151 for_line; RestockHold).
 */
const base = require('./_manager-decide-fixture');
const { NOW, H } = base;
const L = (lineId, pid, name, qty, cost, sell, extra) => ({ lineId, productId: pid, variantIdx: null, productName: name, unit: 'pc', packUnit: '', packQty: 0, qtyIn: 'unit', qty, supplierId: '__stock__', supplierName: 'Our stock', price: cost, sellPrice: sell, ...(extra || {}) });
const ago = ms => new Date(NOW - ms).toISOString();
function fixture(){
  const d = base.fixture();
  d.suppliers.push({ id: 'SUP3', name: 'Katwe Fabricators', phone: '' });
  d.products.push({ id: 'P7', name: 'SJS Wall Plugs · pack', type: 'simple', wholesaleMarkupType: 'percent', wholesaleMarkupValue: 33, variants: [] });
  d.customers.push({ id: 'C7', name: 'Bweyogerere Builders', phone: '0700777888', phone2: '', location: 'Bweyogerere', notes: '', debt: 0, termsDays: null, creditLimit: null, debtLog: [] });
  d.savedQuotes.push(
    { id: 2426, status: 'draft', invoiced: false, voided: false, client: { name: 'Ggaba Stores' }, customerId: 'C3',
      items: [L(1, 'P5', 'Wheelbarrow · heavy duty', 6, 165000, 155000, { priceWas: 120000, supplierId: 'SUP3', supplierName: 'Katwe Fabricators', repricedBy: 'u9' })],
      charges: [], payments: [], takenBy: 'u4', createdAt: ago(40 * 60e3), stageEnteredAt: NOW - 40 * 60e3 },
    { id: 2431, status: 'preparing', invoiced: false, voided: false, amountPaid: 0, client: { name: 'Bweyogerere Builders' }, customerId: 'C7',
      items: [L(1, 'P1', 'Iron sheet G28 · 3 m', 20, 98000, 117500, { pickStatus: 'done' })], charges: [], payments: [], takenBy: 'u2', createdAt: ago(3 * H), stageEnteredAt: NOW - H,
      assignedWorkerId: 'W1', pickingStatus: 'done', pickingDoneAt: NOW - 20 * 60e3,
      creditAsk: { at: ago(400e3), by: 'u7', byName: 'Musa Kiggundu', carrier: { kind: 'staff', name: 'Ssali Paul' } } },
    { id: 2432, status: 'awaiting_goods', invoiced: false, voided: false, client: { name: 'Lubowa Builders' }, customerId: 'C4',
      items: [L(1, 'P7', 'SJS Wall Plugs · pack', 1, 1500, 2000)], charges: [], payments: [], takenBy: 'u4', createdAt: ago(2 * H), stageEnteredAt: NOW - H });
  d.restockLines.push({ id: 'rs-3', productId: 'P7', name: 'SJS Wall Plugs · pack', qty: 199, unit: 'packs', cost: 1500, status: 'held', createdBy: 'u9', heldBy: null, forLine: '2432:1', forDate: null });
  return d;
}
module.exports = { ...base, fixture };
