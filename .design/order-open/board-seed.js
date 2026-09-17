/* Eleven live orders across the five lanes — a working Monday, not the
   three-card board a demo shows. Built on the real record shape so the
   screen's own derivations do the reading. */
(function(){
  const H = 3600000, M = 60000;
  const ago = (ms)=> Date.now() - ms;
  const line = (n, name, unit, qty, sup, supName, price, sell)=> ({
    lineId: n, productId: 'P00' + ((n % 6) + 1), productName: name, unit,
    packUnit: '', packQty: 0, qty, supplierId: sup, supplierName: supName,
    price, sellPrice: sell,
  });
  const ord = (id, name, place, status, ageMs, items, extra)=> Object.assign({
    id, client: { name, location: place, phone: '0772 000 0' + id },
    date: new Date().toISOString().slice(0, 10),
    items, charges: [], savedAt: new Date().toISOString(),
    status, stageEnteredAt: ago(ageMs),
    assignedWorkerId: null, assignedDeliveryId: null,
    invoiced: false, invoicedAt: null, invoicedTs: null,
    amountPaid: 0, payments: [], voided: false, customerId: null, debtCharged: 0,
  }, extra || {});

  const S1 = 'S001', S1n = 'Kirinya Steel & Hardware Ltd';
  const S2 = 'S002', S2n = 'Mukwano Building Supplies';
  const S3 = 'S003', S3n = 'Nakawa Hardware Wholesalers';
  const SH = '__stock__', SHn = 'From the shelf';

  data.savedQuotes = [
    // TAKEN — 4
    ord(365, 'A99 Trade Center', 'Trade Center', 'draft', 28 * H,
      [line(1, 'Runners — Masasi / 14"', 'Ctn', 1, S1, S1n, 120000, 125000)]),
    ord(366, 'Adinan', 'Industrial Area', 'draft', 28 * H,
      [line(2, 'Iron Sheets (28 gauge, plain)', 'Pc', 30, S1, S1n, 34000, 35000),
       line(3, 'Barbed Wire', 'Roll', 5, S1, S1n, 71400, 75000)]),
    ord(371, 'Kato Construction Ltd', 'Nakawa', 'draft', 5 * H + 12 * M,
      [line(4, 'Cement (Tororo 50kg)', 'Bag', 60, S2, S2n, 37000, 41000),
       line(5, 'Steel Nails 3 inch', 'Kg', 40, S3, S3n, 7800, 9000),
       line(6, 'PVC Pipe 1 inch', 'Pc', 25, S1, S1n, 25000, 28000)],
      { supplierConfirms: { S002: { state: 'confirmed', at: ago(2 * H) },
                            S003: { state: 'confirmed', at: ago(3 * H) },
                            S001: { askedAt: ago(4 * H) } } }),
    ord(372, 'Namirembe Hardware', 'Bwaise', 'draft', 2 * H + 40 * M,
      [line(7, 'Gloss Paint - White', 'Tin', 12, S2, S2n, 21000, 24000)],
      { supplierConfirms: { S002: { state: 'confirmed', at: ago(30 * M) } } }),

    // BUYING — 2
    ord(368, 'Mukwaya & Sons', 'Kisenyi', 'awaiting_goods', 22 * H + 10 * M,
      [line(8, 'Cement (Tororo 50kg)', 'Bag', 20, S2, S2n, 37000, 41000),
       line(9, 'Steel Nails 3 inch', 'Kg', 15, S3, S3n, 7800, 9000)]),
    ord(369, 'Bright Star Hardware', 'Ndeeba', 'awaiting_goods', 6 * H + 5 * M,
      [line(10, 'PVC Pipe 1 inch', 'Pc', 18, S1, S1n, 25000, 28000),
       line(11, 'Barbed Wire', 'Roll', 2, S1, S1n, 71400, 76000)]),

    // PREPARING — 3
    ord(364, 'Ronald · 7th Street', 'Industrial Area', 'preparing', 29 * H,
      [line(12, 'Gloss Paint - White', 'Tin', 8, SH, SHn, 21000, 23750)]),
    (function(){
      const a = line(13, 'Cement (Tororo 50kg)', 'Bag', 40, SH, SHn, 37000, 41000);
      const b = line(14, 'Iron Sheets (28 gauge, plain)', 'Pc', 14, SH, SHn, 34000, 37500);
      const c = line(19, 'Barbed Wire', 'Roll', 2, SH, SHn, 71400, 78000);
      a.pickStatus = 'done'; b.pickStatus = 'done';
      c.pickStatus = 'short'; c.pickedQty = 1;
      return ord(367, 'Ssekitoleko Hardware', 'Kireka', 'preparing', 8 * H + 30 * M, [a, b, c],
        { assignedWorkerId: 'ST001', pickingStatus: 'picking', pickCursor: 2 });
    })(),
    ord(370, 'Nakato Builders', 'Nansana', 'pending_delivery', 1 * H + 5 * M,
      [line(15, 'Steel Nails 3 inch', 'Kg', 30, SH, SHn, 7800, 9000)],
      { customerId: 'C010', assignedWorkerId: 'ST001', pickingStatus: 'done',
        assignedDeliveryId: 'ST002',
        carrier: { name: 'Grace Namuli', phone: '0700 555 222', at: ago(65 * M) } }),
    ord(373, 'Katende Hardware', 'Nansana', 'pending_delivery', 1 * H + 5 * M,
      [line(20, 'Cement (Tororo 50kg)', 'Bag', 16, SH, SHn, 37000, 42500)],
      { customerId: 'C011', assignedDeliveryId: 'ST002',
        carrier: { name: 'Grace Namuli', phone: '0700 555 222', at: ago(65 * M) } }),
    ord(374, 'Muyenga Stores', 'Mukono', 'pending_delivery', 25 * M,
      [line(21, 'PVC Pipe 1 inch', 'Pc', 15, SH, SHn, 25000, 26000)],
      { customerId: 'C012' }),

    // OUT — 1
    ord(362, 'Kyeyune Metals', 'Mukono', 'pending_delivery', 4 * H + 20 * M,
      [line(16, 'Iron Sheets (28 gauge, plain)', 'Pc', 25, SH, SHn, 34000, 38000),
       line(17, 'Barbed Wire', 'Roll', 1, SH, SHn, 71400, 78000)],
      { assignedDeliveryId: 'ST002', deliveryAddress: 'Mukono, past the police post',
        carrier: { name: 'Grace Namuli', phone: '0700 555 222', at: ago(2 * H) } }),

    // DELIVERED, not invoiced — 1
    ord(361, 'Ggaba Road Traders', 'Katwe', 'completed', 2 * H + 5 * M,
      [line(18, 'Steel Nails 3 inch', 'Kg', 10, SH, SHn, 7800, 8800)]),
  ];
  data.customers.push(
    { id:'C010', name:'Nakato Builders',  phone:'0772 000 370', location:'Nansana', debt:0, notes:'', debtLog:[] },
    { id:'C011', name:'Katende Hardware', phone:'0772 000 373', location:'Nansana', debt:0, notes:'', debtLog:[] },
    { id:'C012', name:'Muyenga Stores',   phone:'0772 000 374', location:'Mukono',  debt:0, notes:'', debtLog:[] });
  data.nextQuoteLineId = 40;
  // Limits the shop itself set, so "past its limit" means something.
  data.presetOrderStageLimits = { draft: 1440, awaiting_goods: 1440, preparing: 720, pending_delivery: 720 };
})();
