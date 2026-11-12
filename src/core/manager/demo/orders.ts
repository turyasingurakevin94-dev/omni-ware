/*
 * The Manager demo's orders at 09:40 (docs/canvas/manager/BRIEF.md "Orders on the move",
 * "Reconciled"): 8 on the move (8,810,000), 2 delivered and billing themselves, the
 * Kato twins, and the orders of the later cards (#0553's price, #0560, #0561 …).
 */
import type { MLine, MOrder, Stage } from '../types.ts';
import { t } from './shop.ts';

const l = (idx: number, name: string, unit: string, qty: number, cost: number | null, price: number | null, x: Partial<MLine> = {}): MLine => ({
  idx, name, unit, qty, cost, price, shopPrice: cost != null ? Math.round(cost * 1.25) : null, markup: 0.25,
  supplierId: '__stock__', supplierName: 'Shelf', buying: null, packed: null, givenAway: null, productId: 'p-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), ...x,
});

const o = (id: number, customerId: string, customerName: string, sellerId: string, stage: Stage, stageAt: string, lines: MLine[], x: Partial<MOrder> = {}): MOrder => {
  const total = lines.reduce((s, ln) => s + (ln.price != null ? Math.round(ln.price * ln.qty) : 0), 0);
  return {
    id, customerId, customerName, sellerId, stage, stageAt: t(stageAt), createdAt: t(stageAt), lines, total, paid: 0, paidBy: null, holderId: null,
    deliveredAt: null, invoiced: false, invoiceNo: null, credit: false, driver: null, heldCode: null, twinOk: [], counter: false, ...x,
  };
};

export function orders(): MOrder[] {
  return [
    // Checking (3)
    o(554, 'lubowa', 'Lubowa Builders', 'brian', 'draft', '07:00', [l(0, 'Timber 2×4', 'pcs', 40, 9_000, 11_250, { supplierId: 'ndeeba', supplierName: 'Ndeeba Timber' })], { holderId: 'denis' }),
    o(555, 'kyaligonza', 'Kyaligonza & Sons', 'grace', 'draft', '08:35', [l(0, 'Iron sheet G28', 'sht', 30, 38_000, 46_000, { shopPrice: 47_500 })], { holderId: 'ruth', credit: true }),
    o(556, 'ggaba', 'Ggaba Stores', 'grace', 'draft', '08:20', [l(0, 'Cement 50 kg', 'bag', 10, 34_000, 43_000, { supplierId: 'hima', supplierName: 'Hima Cement' })], { holderId: 'ruth' }),
    // Buying (2)
    o(552, 'mukono', 'Mukono Roofing', 'faith', 'awaiting_goods', '07:20', [
      l(0, 'Iron sheet G28', 'sht', 20, 38_000, 47_500, { supplierId: 'namanve', supplierName: 'Namanve Sheets', buying: 'found' }),
      l(1, 'Ridge cap 3 m', 'pcs', 10, 27_000, 26_000, { supplierId: 'kiseka', supplierName: 'Kiseka Steel', buying: 'up', shopPrice: 33_750 }),
    ], { holderId: 'denis', credit: true }),
    o(553, 'ggaba', 'Ggaba Stores', 'brian', 'awaiting_goods', '08:10', [
      l(0, 'Y12 rebar 12 m', 'pcs', 20, null, 38_750, { supplierId: 'katwe', supplierName: 'Katwe Steel', buying: 'notfound' }),
    ], { holderId: 'denis', credit: true }),
    // Packing (2)
    o(550, 'kato', 'Kato Construction', 'grace', 'preparing', '08:30', [l(0, 'Iron sheet G28', 'sht', 40, 38_000, 47_500, { packed: 36 })], { holderId: 'musa', credit: true }),
    o(551, 'nansana', 'Nansana Hardware', 'grace', 'preparing', '08:40', [l(0, 'Cement 50 kg', 'bag', 29, 34_000, 42_500), l(1, 'Wall plugs', 'pack', 5, 1_500, 1_500)], { holderId: 'musa', driver: 'Ssali' }),
    // On the road (1)
    o(549, 'kyaligonza', 'Kyaligonza & Sons', 'brian', 'pending_delivery', '09:05', [l(0, 'Iron sheet G28', 'sht', 30, 38_000, 47_500)], { holderId: 'ssali', driver: 'Ssali', credit: true, createdAt: t('15:30', '2026-10-15') }),
    // Delivered, billing themselves
    o(548, 'kato', 'Kato Construction', 'grace', 'completed', '16:10', [l(0, 'Cement 50 kg', 'bag', 10, 34_000, 43_000)], { stageAt: t('16:10', '2026-10-16'), createdAt: t('09:00', '2026-10-16'), deliveredAt: t('16:10', '2026-10-16'), driver: 'Ssali', credit: true }),
    o(557, 'lubowa', 'Lubowa Builders', 'brian', 'completed', '08:50', [l(0, 'PVC pipe 4 in', 'pcs', 9, 28_000, 35_000), l(1, 'Wall plugs', 'pack', 2, 1_500, 1_500)], { deliveredAt: t('08:50'), createdAt: t('07:15'), driver: 'Ssali', credit: true }),
    // The Kato twins (D-21): both billed on 16 Oct; #0545 paid 200,000 (void asked at 14:20, D-19)
    o(544, 'kato', 'Kato Construction', 'grace', 'completed', '15:00', twin(), { stageAt: t('15:00', '2026-10-16'), createdAt: t('10:02', '2026-10-16'), deliveredAt: t('15:00', '2026-10-16'), invoiced: true, invoiceNo: 'INV-0544', credit: true }),
    o(545, 'kato', 'Kato Construction', 'grace', 'completed', '15:05', twin(), { stageAt: t('15:05', '2026-10-16'), createdAt: t('10:20', '2026-10-16'), deliveredAt: t('15:05', '2026-10-16'), invoiced: true, invoiceNo: 'INV-0545', paid: 200_000, paidBy: 'momo', credit: true }),
    // Billed: the return's order (D-18), Lubowa's 22 Sep bill
    o(547, 'lubowa', 'Lubowa Builders', 'brian', 'completed', '10:00', [l(0, 'Timber 2×4', 'pcs', 60, 9_000, 11_250)], { stageAt: t('10:00', '2026-09-22'), createdAt: t('08:00', '2026-09-22'), deliveredAt: t('10:00', '2026-09-22'), invoiced: true, invoiceNo: 'INV-0547', paid: 13_000, paidBy: 'cash', credit: true }),
  ];
}

function twin(): MLine[] {
  return [l(0, 'Cement 50 kg', 'bag', 5, 34_000, 42_500), l(1, 'Wall plugs', 'pack', 20, 1_500, 2_000), l(2, 'Timber 2×4', 'pcs', 6, 9_000, 11_250)];
}

/** The later cards' orders (named only on a card with its time; BRIEF "Reconciled"). */
export function laterOrders(): MOrder[] {
  return [
    o(560, 'mukono', 'Mukono Roofing', 'peter', 'awaiting_goods', '10:30', [l(0, 'Cement 50 kg', 'bag', 20, 34_000, 42_500)], { holderId: 'denis', paid: 300_000, paidBy: 'cash' }),
    o(561, 'walkin', 'Walk-in', 'grace', 'completed', '09:20', [l(0, 'Wall plugs', 'pack', 1, 450, 567)], { deliveredAt: t('09:20'), counter: true, heldCode: 'OWSML' }),
    o(562, 'mukono', 'Mukono Roofing', 'faith', 'completed', '08:00', [l(0, 'Cement 50 kg', 'bag', 10, 34_000, null)], { deliveredAt: t('08:00'), heldCode: 'OWTPC', credit: true }),
    o(563, 'kyaligonza', 'Kyaligonza & Sons', 'brian', 'completed', '15:00', [l(0, 'Wall plugs', 'pack', 2, 1_500, 0)], { deliveredAt: t('15:00'), heldCode: 'OWGIV', credit: true }),
    o(570, 'walkin', 'Walk-in', 'grace', 'draft', '11:17', [l(0, 'Cement 50 kg', 'bag', 10, 34_000, 40_000, { shopPrice: 42_500 })], { counter: true }),
  ];
}
