'use strict';
/*
 * 0139 receive_payment, as the database does it, for the app tests' fake
 * database: a customer's payment spread over the open invoices (oldest
 * first, or the ones ticked) with a receipt per invoice, the invoice's
 * payments and share of the debt, the debt lowered and logged, the rest on
 * account -- or one receipt on an order before its invoice. Writes land in
 * `tables` and are recorded in `writes` the way the fake's own inserts and
 * updates are, so the tests read the same rows they always did.
 *
 *   fakeReceivePayment(tables, writes, nextId, args, uid)
 *     nextId(kind) hands out 'row:cash_txn' and 'row:debt_log' ids.
 */
module.exports = function fakeReceivePayment(tables, writes, nextId, a, uid){
  const clone = x => JSON.parse(JSON.stringify(x));
  const today = new Date().toISOString().slice(0, 10), hm = '09:00';
  const err = m => ({ data: null, error: { message: m } });
  const num = v => (v == null || v === '' || !isFinite(Number(v))) ? null : Number(v);
  // ow_order_total: goods at the selling price, charges, discount, the credit charge, credit notes off.
  const total = q => {
    const p = q.payload || {};
    const goods = (p.items || []).reduce((s, it) => s + (num(it.qty) || 0) * (num(it.sellPrice) || 0), 0);
    const charges = (p.charges || []).reduce((s, ch) => { const v = num(ch && ch.value) || 0; return v > 0 ? s + (ch.type === 'percent' ? Math.round(goods * v / 100) : Math.round(v)) : s; }, 0);
    const gross = goods + charges, cash = gross - Math.min(Math.max(0, num(p.discount) || 0), gross);
    const credit = p.credit && (num(p.credit.pct) || 0) > 0 ? Math.round(cash * num(p.credit.pct) / 100) : 0;
    const credited = (p.creditNotes || []).reduce((s, cn) => s + (cn && !cn.voided ? (num(cn.amount) || 0) : 0), 0);
    return cash + credit - credited;
  };
  const ins = (t, row) => { writes.push(['insert', t, clone(row)]); (tables[t] || (tables[t] = [])).push(clone(row)); };
  const upd = (t, row, patch) => { writes.push(['update', t, clone(patch), [row.id]]); Object.assign(row, clone(patch)); };
  const nextPayId = pays => pays.reduce((m, p) => Math.max(m, num(p.id) || 0), 0) + 1;
  const shop = a.p_shop_id, method = String(a.p_method || 'cash').trim() || 'cash', amount = Math.round(num(a.p_amount) || 0);
  if (!(amount > 0)) return err('Nothing to record: the amount is zero.');
  const cashRows = [];

  /* an order before its invoice */
  if (a.p_order_id != null) {
    const q = (tables.saved_quotes || []).find(r => Number(r.id) === Number(a.p_order_id));
    if (!q) return err('This order is no longer in the books.');
    if (q.voided) return err('The order was cancelled.');
    if (q.invoiced) return err('This order has just been invoiced — take it from the customer\'s bills.');
    const tot = Math.round(total(q)), due = Math.max(0, tot - (num(q.amount_paid) || 0)), pay = Math.min(amount, due);
    if (!(pay > 0)) return err('Nothing is left to pay on this order.');
    const label = '#' + String(q.id).padStart(4, '0'), id = nextId('row:cash_txn');
    const row = { id, shop_id: shop, date: today, account: method, type: 'receipt', category: 'Invoice Payment', amount: pay, description: 'Payment — order ' + label, time: hm, quote_id: q.id, entered_by: uid };
    ins('cash_txns', row); cashRows.push(row);
    const pays = ((q.payload || {}).payments || []).slice(); pays.push({ date: today, amount: pay, note: '', cashTxnId: id, method, id: nextPayId(pays) });
    upd('saved_quotes', q, { amount_paid: (num(q.amount_paid) || 0) + pay, payload: { ...(q.payload || {}), payments: pays } });
    return { data: { kind: 'order', orderId: q.id, amount: pay, method, time: hm, date: today, name: q.client_name || 'Walk-in', phone: q.client_phone || '', id: (q.payload || {}).customerId || null, before: due, after: due - pay,
      bills: [{ quoteId: q.id, label: 'Order ' + label, pay, cleared: pay >= due, left: due - pay, total: tot }], cashRows }, error: null };
  }

  /* a customer's payment */
  if (!a.p_customer_id) return err('Whose payment is it? Pick the customer.');
  const c = (tables.customers || []).find(r => String(r.id) === String(a.p_customer_id));
  if (!c) return err('That customer is no longer in the books.');
  let debt = num(c.debt) || 0; const debt0 = debt;
  const name = String(c.name || '').trim().toLowerCase();
  const oneName = name ? (tables.customers || []).filter(r => String(r.name || '').trim().toLowerCase() === name).length === 1 : false;
  const mine = q => { const cid = (q.payload || {}).customerId; return String(cid || '') === String(c.id) || (!cid && oneName && String(q.client_name || (q.payload && q.payload.client && q.payload.client.name) || '').trim().toLowerCase() === name); };
  const open = (tables.saved_quotes || []).filter(q => q.invoiced && !q.voided && mine(q) && Math.round(total(q)) - (num(q.amount_paid) || 0) > 0)
    .sort((x, y) => String(x.invoiced_ts || x.invoiced_at || x.date || '').localeCompare(String(y.invoiced_ts || y.invoiced_at || y.date || '')) || (Number(x.id) - Number(y.id)));
  let ordered = open;
  if (a.p_picks != null) { ordered = []; a.p_picks.forEach(id => { const q = open.find(x => Number(x.id) === Number(id)); if (q && !ordered.includes(q)) ordered.push(q); }); }
  let left = amount; const bills = [];
  for (const q of ordered) {
    if (!(left > 0)) break;
    const tot = Math.round(total(q)), due = Math.max(0, tot - (num(q.amount_paid) || 0)), pay = Math.min(left, due);
    if (!(pay > 0)) continue;
    const label = 'INV-' + String(q.id).padStart(4, '0'), id = nextId('row:cash_txn');
    const row = { id, shop_id: shop, date: today, account: method, type: 'receipt', category: 'Debt Payment', amount: pay, description: 'Payment — ' + label, time: hm, quote_id: q.id, entered_by: uid };
    ins('cash_txns', row); cashRows.push(row);
    const pays = ((q.payload || {}).payments || []).slice(); pays.push({ date: today, amount: pay, note: '', cashTxnId: id, method, id: nextPayId(pays) });
    const desired = Math.max(0, tot - ((num(q.amount_paid) || 0) + pay)), current = num((q.payload || {}).debtCharged) || 0;
    const after = Math.max(0, debt + (desired - current)), applied = after - debt;
    upd('saved_quotes', q, { amount_paid: (num(q.amount_paid) || 0) + pay, payload: { ...(q.payload || {}), payments: pays, debtCharged: applied > 0 ? current : desired, customerId: c.id } });
    if (applied < 0) {
      ins('customer_debt_log', { id: nextId('row:debt_log'), shop_id: shop, customer_id: c.id, date: today, type: 'payment', amount: -applied, note: 'Auto-sync — ' + label, quote_id: q.id, cash_txn_id: null });
      upd('customers', c, { debt: after }); debt = after;
    }
    bills.push({ quoteId: q.id, label, pay, cleared: pay >= due, left: Math.max(0, due - pay), total: tot });
    left -= pay;
  }
  if (left > 0) {
    const after = Math.max(0, debt - left), id = nextId('row:cash_txn');
    const row = { id, shop_id: shop, date: today, account: method, type: 'receipt', category: 'Debt Payment', amount: left, description: 'Payment — ' + (c.name || c.id), time: hm, quote_id: null, entered_by: uid };
    ins('cash_txns', row); cashRows.push(row);
    if (after !== debt) {
      upd('customers', c, { debt: after });
      ins('customer_debt_log', { id: nextId('row:debt_log'), shop_id: shop, customer_id: c.id, date: today, type: 'payment', amount: debt - after, note: '', quote_id: null, cash_txn_id: id });
      debt = after;
    }
    bills.push({ label: 'On account', pay: left, cleared: after === 0, left: after, onAccount: true });
  }
  return { data: { kind: 'cust', id: c.id, name: c.name || c.id, phone: c.phone || c.phone2 || '', amount, method, time: hm, date: today, bills, before: debt0, after: debt, cashRows }, error: null };
};
