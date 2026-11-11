-- Cross-app round 1 (Sales → Manager → Buyer handoff): read-only checks before Phase B.
-- Paste into the live project's SQL editor, one query at a time. Nothing here writes.
-- The shop: change the name on each "shop" line if the live shop is named differently.

-- 1 · BUY-4: #0212, line by line, beside the price-list rows the Buyer prices it from.
--     If a line's qty is in packs (unit = the row's pack_unit) while the row's pack_qty counts the loose unit,
--     the Buyer rounds 2 up to a carton of pack_qty and the stop reads 10 × 42,000 + 10 × 50,000 = 920,000.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id, q.status, q.invoiced, it ->> 'lineId' as line, it ->> 'productName' as item,
       it ->> 'supplierId' as supplier, (it ->> 'qty')::numeric as qty, it ->> 'unit' as line_unit,
       it ->> 'qtyIn' as qty_in, it ->> 'packUnit' as line_pack_unit, it ->> 'packQty' as line_pack_qty,
       (it ->> 'price')::numeric as cost, (it ->> 'sellPrice')::numeric as sell,
       p.unit as row_unit, p.pack_unit as row_pack_unit, p.pack_qty as row_pack_qty, p.wholesale, p.retail, p.date as row_date
  from shop
  join saved_quotes q on q.shop_id = shop.id and q.id = 212
  cross join lateral jsonb_array_elements(q.payload -> 'items') it
  left join prices p on p.shop_id = shop.id and p.product_id = it ->> 'productId' and p.supplier_id = it ->> 'supplierId'
 order by line;

-- 2 · BUY-5: #0148 — stage, invoiced when, and which lines are still to come.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id, q.status, q.invoiced, q.invoiced_ts, now() - q.invoiced_ts as since_invoiced, q.voided,
       it ->> 'productName' as item, it ->> 'supplierId' as supplier, it ->> 'qty' as qty, it ->> 'receivedQty' as received
  from shop join saved_quotes q on q.shop_id = shop.id and q.id = 148
  cross join lateral jsonb_array_elements(q.payload -> 'items') it;

-- 3 · BUY-5: every order the Buyer hides today ("invoiced over 24 h ago") that still waits for goods.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id, q.client_name, q.status, q.invoiced_ts::date as invoiced, (now()::date - q.invoiced_ts::date) as days
  from shop join saved_quotes q on q.shop_id = shop.id
 where q.status in ('draft', 'awaiting_goods') and q.invoiced and not q.voided
   and q.invoiced_ts < now() - interval '24 hours'
 order by q.invoiced_ts;

-- 4 · X-1: every cancel ask still waiting, oldest first (#0604 since 10 Nov, #0608).
with shop as (select id from shops where name = 'Omni-ware (old records)')
select a.quote_id, a.status, a.why, a.amount, a.stage, a.asked_by_name, a.created_at, q.status as order_status, q.invoiced, q.voided
  from shop join cancel_asks a on a.shop_id = shop.id
  left join saved_quotes q on q.shop_id = shop.id and q.id = a.quote_id
 where a.status = 'sent' order by a.created_at;

-- 5 · SAL-3: #0586 — is it in the books at all? (The phone's kept ask to cancel it failed 8 times.)
with shop as (select id from shops where name = 'Omni-ware (old records)')
select (select count(*) from saved_quotes q where q.shop_id = shop.id and q.id = 586) as order_rows,
       (select count(*) from cancel_asks a where a.shop_id = shop.id and a.quote_id = 586) as cancel_asks
  from shop;

-- 6 · SAL-4: orders placed twice from one draft (two rows with one placeKey would be a server fault; expect none).
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.payload ->> 'placeKey' as place_key, array_agg(q.id order by q.id) as orders
  from shop join saved_quotes q on q.shop_id = shop.id
 where q.payload ? 'placeKey'
 group by 1 having count(*) > 1;

-- 7 · X-2: open orders with a line that has no stock tag and no supplier, and no client waiting (the gate's 'unsourced').
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id, q.client_name, q.status, it ->> 'productName' as item, it ->> 'qty' as qty
  from shop join saved_quotes q on q.shop_id = shop.id
  cross join lateral jsonb_array_elements(q.payload -> 'items') it
 where q.status in ('draft', 'awaiting_goods') and not q.voided and not q.invoiced
   and coalesce(it ->> 'supplierId', '') = '' and coalesce(it ->> 'clientWaits', '') in ('', 'false', '0')
 order by q.id;

-- 8 · X-3: who has a login but no staff card (the Manager's "login with no staff card"), and who holds 'buyer'.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select m.user_id, m.role, m.display_name, s.name as staff_name, s.role as staff_role
  from shop join shop_members m on m.shop_id = shop.id
  left join staff s on s.shop_id = shop.id and s.user_id = m.user_id
 order by m.role;
