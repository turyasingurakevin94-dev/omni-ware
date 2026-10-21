'use strict';
/*
 * The shared Manager fixture plus what the orders screens need: an order
 * nobody holds, one taken twice, a stuck delivery and an old paid order.
 */
const base = require('./_manager-decide-fixture');
const { NOW, H } = base;
const L = (lineId, pid, name, qty, cost, sell) => ({ lineId, productId: pid, variantIdx: null, productName: name, unit: 'pc', packUnit: '', packQty: 0, qtyIn: 'unit', qty, supplierId: '__stock__', supplierName: 'Our stock', price: cost, sellPrice: sell });
const ago = ms => new Date(NOW - ms).toISOString();
function fixture(){
  const d = base.fixture();
  const kato = () => [L(1, 'P1', 'Iron sheet G28 · 3 m', 20, 98000, 112000), L(2, 'P6', 'Ridge cap', 4, 45000, 52000)];
  d.savedQuotes.push(
    // packing, and nobody has it
    { id: 2418, status: 'preparing', invoiced: false, voided: false, client: { name: 'Nansana Hardware' }, customerId: 'C6', items: [L(1, 'P2', 'Hima cement · 50 kg', 50, 34500, 38640)], charges: [], payments: [], takenBy: 'u2', createdAt: ago(9 * H), stageEnteredAt: NOW - 3 * H },
    // Kato taken twice, 40 minutes apart, by Brian
    { id: 2426, status: 'draft', invoiced: false, voided: false, client: { name: 'Kato Construction' }, customerId: 'C5', items: kato(), charges: [], payments: [], takenBy: 'u3', createdAt: ago(70 * 60e3), stageEnteredAt: NOW - 70 * 60e3 },
    { id: 2427, status: 'draft', invoiced: false, voided: false, client: { name: 'Kato Construction' }, customerId: 'C5', items: kato(), charges: [], payments: [], takenBy: 'u3', createdAt: ago(30 * 60e3), stageEnteredAt: NOW - 30 * 60e3 },
    // on the road far past its limit, with Ssali
    { id: 2429, status: 'pending_delivery', invoiced: false, voided: false, client: { name: 'Lubowa Builders' }, customerId: 'C4', items: [L(1, 'P6', 'Ridge cap', 10, 45000, 52000)], charges: [], payments: [], takenBy: 'u4', createdAt: ago(12 * H), stageEnteredAt: NOW - 6 * H, assignedDeliveryId: 'D1' },
    // an old order, paid in full
    { id: 1104, status: 'completed', invoiced: true, invoicedAt: '2025-03-03', date: '2025-03-03', amountPaid: 1040000, voided: false, client: { name: 'Kato Construction' }, customerId: 'C5', items: [L(1, 'P6', 'Ridge cap', 20, 45000, 52000)], charges: [], payments: [], takenBy: 'u3', createdAt: '2025-03-03T09:00:00.000Z', deliveredAt: '2025-03-03T15:00:00.000Z' });
  return d;
}
module.exports = { ...base, fixture };
