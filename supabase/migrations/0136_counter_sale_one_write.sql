-- 0136: the audit of 19 October 2026, part one. Five things the apps did in
-- several writes, or never, now happen in one place in the database, so a
-- phone that loses signal half-way leaves nothing behind, and a role that
-- the table says may do a job can finish it.
--
--   1. counter_sale(): a Sales login's counter sale was REFUSED at the cash
--      write. 0123's restrictive policy on cash_txns lets payment.receive
--      insert only a debt/invoice/customer payment; the counter sale wrote
--      a 'Sales Revenue' receipt, so every counter sale by a salesperson
--      ended "new row violates row-level security policy", after the order
--      row had already been placed -- a ghost order in the Store's Packing
--      queue at every attempt. Now one function places the sale, takes the
--      money, marks it delivered and paid, and invoices it through
--      ow_invoice_core, in ONE transaction. A sale under the shop's price
--      is placed as a draft and waits for the Manager's yes, as before.
--   2. receive_trip(): a trip line bought for the shelf (buy.restock, the
--      Buyer writes orderId 'restock') was counted as "no order left" and
--      never reached stock: no stock row, no lot, no cost. Restock goods now
--      go on the shelf like any other line.
--   3. ow_gate_reason(): the Manager's "cash first" answer on a credit hold
--      let the order leave Checking at once. The screen says "it stays held
--      until Sales collects"; now the gate agrees: 'cash' holds until the
--      order is paid.
--   4. buyer_confirm_price() and trip_prices_to_list() set price_source, so
--      a price the Buyer confirms by phone or pays on a trip counts toward
--      the day's share (the Sourcing app and 0131's count both read
--      price_source in confirmed/purchase and ignored them).
--   5. The Manager's restock hold moves to restock_buys, the table the Buyer
--      actually writes (0125). restock_lines (0122) had no writer: the
--      Manager's list was always empty and a hold never reached the Buyer.
--      restock_lines, hold_restock_line and its push trigger are retired.
--   6. A line the Buyer drops at Checking tells the salesperson (push
--      line.dropped); docs/decision-rights.md says Sales is told, and
--      nothing did.
--
-- Run after 0135. Re-runnable.
--
-- VERIFY
--   select proname from pg_proc where proname in ('counter_sale', 'hold_restock_buy');
--   select to_regclass('public.restock_lines');   -- null
--
-- ROLLBACK (the functions redefined here come back by re-running 0119,
-- 0124, 0125; restock_lines by re-running 0122 and 0129):
--   drop function if exists counter_sale(uuid, bigint, jsonb, text, numeric);
--   drop function if exists hold_restock_buy(uuid, boolean);
--   drop trigger if exists restock_buys_ow_push on restock_buys;
--   drop trigger if exists saved_quotes_ow_push3 on saved_quotes;

-- ---------------------------------------------------------------------
-- 1. The counter sale, as one write.
create or replace function counter_sale(p_shop_id uuid, p_quote_id bigint, p_row jsonb, p_method text, p_given numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes;
  p jsonb;
  items jsonb;
  v_name text;
  v_role text;
  v_task text;
  total numeric;
  pay numeric;
  floor_id bigint;
  cash_id bigint := null;
  pay_id int;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  d date := ow_today();
  hm text := to_char(now() at time zone ow_shop_tz(), 'HH24:MI');
  why text;
  saved jsonb;
  res jsonb;
  short jsonb;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Sign in to this shop first.' using errcode = '42501';
  end if;
  if has_task(p_shop_id, 'counter.sell') then v_task := 'counter.sell';
  elsif has_task(p_shop_id, 'invoice.make') then v_task := 'invoice.make';
  else raise exception 'Selling over the counter is Sales'' (counter.sell).' using errcode = '42501';
  end if;
  if coalesce(p_method, '') not in ('cash', 'momo', 'bank') then
    raise exception 'They pay by cash, MoMo or bank.' using errcode = '22023';
  end if;
  select s.name into v_name from staff s where s.shop_id = p_shop_id and s.user_id = uid limit 1;
  select m.role into v_role from shop_members m where m.shop_id = p_shop_id and m.user_id = uid limit 1;

  -- The sale: placed now from p_row, or the one already waiting.
  if p_quote_id is null then
    if jsonb_typeof(p_row) <> 'object' or jsonb_typeof(p_row -> 'payload') <> 'object' then
      raise exception 'Nothing to sell.' using errcode = '22023';
    end if;
    p := p_row -> 'payload';
    select coalesce(max(id), 0) into floor_id from saved_quotes;  -- ids are one sequence across shops (0001)
    q.id := ow_next_row_id(p_shop_id, 'row:saved_quote', floor_id);
    q.shop_id := p_shop_id;
    q.client_name := coalesce(nullif(btrim(coalesce(p_row ->> 'client_name', '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'Walk-in');
    q.client_phone := nullif(btrim(coalesce(p_row ->> 'client_phone', p -> 'client' ->> 'phone', '')), '');
    q.date := d;
    q.status := 'draft';
    q.invoiced := false; q.voided := false; q.amount_paid := 0;
    p := p || jsonb_build_object('counter', true, 'savedAt', now_iso, 'createdAt', now_iso, 'stageEnteredAt', now_ms,
           'takenBy', uid::text, 'payments', coalesce(case when jsonb_typeof(p -> 'payments') = 'array' then p -> 'payments' end, '[]'::jsonb),
           'debtCharged', 0, 'stageLog', jsonb_build_array(jsonb_build_object('status', 'draft', 'at', now_ms)));
    q.payload := p;
  else
    select * into q from saved_quotes where id = p_quote_id and shop_id = p_shop_id for update;
    if not found then raise exception 'That sale is not in this shop.' using errcode = 'P0002'; end if;
    p := coalesce(q.payload, '{}'::jsonb);
  end if;

  if coalesce(q.voided, false) then raise exception 'That sale was cancelled.' using errcode = 'OWCTR'; end if;
  if coalesce(q.invoiced, false) then raise exception 'That sale is already invoiced.' using errcode = 'OWCTR'; end if;
  if q.status not in ('draft', 'preparing') then raise exception 'That sale has moved on (%).', q.status using errcode = 'OWCTR'; end if;
  if coalesce(p ->> 'counter', '') <> 'true' then raise exception 'Only a counter sale is sold this way.' using errcode = 'OWCTR'; end if;
  items := case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end;
  if jsonb_array_length(items) = 0 then raise exception 'Nothing is on the counter.' using errcode = 'OWCTR'; end if;
  if exists (select 1 from jsonb_array_elements(items) e where coalesce(e ->> 'supplierId', '') <> '__stock__') then
    raise exception 'A counter sale is only for goods on the shelf.' using errcode = 'OWCTR';
  end if;

  -- A price under the shop's price waits for the Manager: the sale is
  -- placed (so the push goes out and the Manager sees it) and nothing is
  -- taken yet.
  why := ow_gate_reason(p_shop_id, p, q.amount_paid);
  if why = 'price' then
    if p_quote_id is null then
      insert into saved_quotes (id, shop_id, client_name, client_phone, date, status, invoiced, invoiced_at, invoiced_ts, amount_paid, voided, payload)
           values (q.id, q.shop_id, q.client_name, q.client_phone, q.date, 'draft', false, null, null, 0, false, q.payload);
    end if;
    return jsonb_build_object('ok', true, 'waiting', 'price', 'id', q.id);
  end if;

  total := round(ow_order_total(p_shop_id, p, false));
  pay := greatest(0, total - coalesce(q.amount_paid, 0));

  -- From here the shop's own hand writes: the gate and the role guards
  -- have been answered above, and a paid counter sale is never a credit
  -- question.
  saved := ow_system_begin();
  if p_quote_id is null then
    insert into saved_quotes (id, shop_id, client_name, client_phone, date, status, invoiced, invoiced_at, invoiced_ts, amount_paid, voided, payload)
         values (q.id, q.shop_id, q.client_name, q.client_phone, q.date, 'draft', false, null, null, 0, false, q.payload);
  end if;
  if pay > 0 then
    select coalesce(max(id), 0) into floor_id from cash_txns;
    cash_id := ow_next_row_id(p_shop_id, 'row:cash_txn', floor_id);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (cash_id, p_shop_id, d, p_method, 'receipt', 'Sales Revenue', pay, 'Counter sale — order #' || lpad(q.id::text, 4, '0'), hm, q.id, uid);
    select coalesce(max((e ->> 'id')::int), 0) + 1 into pay_id
      from jsonb_array_elements(case when jsonb_typeof(p -> 'payments') = 'array' then p -> 'payments' else '[]'::jsonb end) e;
    p := p || jsonb_build_object('payments',
           coalesce(case when jsonb_typeof(p -> 'payments') = 'array' then p -> 'payments' end, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('id', pay_id, 'date', d, 'amount', pay, 'note', 'Counter sale', 'cashTxnId', cash_id, 'method', p_method)));
  end if;
  p := p || jsonb_build_object('deliveredAt', now_ms, 'stageEnteredAt', now_ms,
         'stageLog', coalesce(case when jsonb_typeof(p -> 'stageLog') = 'array' then p -> 'stageLog' end, '[]'::jsonb)
                     || jsonb_build_array(jsonb_build_object('status', 'completed', 'at', now_ms, 'counter', true)));
  update saved_quotes
     set status = 'completed', amount_paid = coalesce(amount_paid, 0) + pay, payload = p
   where shop_id = p_shop_id and id = q.id;

  res := ow_invoice_core(p_shop_id, q.id, 'counter_sale', uid, nullif(btrim(coalesce(v_name, '')), ''));
  if coalesce((res ->> 'shortOnShelf')::boolean, false) then
    -- The shelf had less than the counter believed: nothing is sold.
    select jsonb_agg(coalesce(e ->> 'productName', e ->> 'productId')) into short
      from jsonb_array_elements(items) e
      left join stock s on s.shop_id = p_shop_id
       and s.key = case when coalesce(e ->> 'variantIdx', '') = '' then e ->> 'productId' else (e ->> 'productId') || '::' || (e ->> 'variantIdx') end
     where coalesce(s.qty, 0) < coalesce((e ->> 'qty')::numeric, 0);
    raise exception 'Not enough on the shelf: %', coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(coalesce(short, '[]'::jsonb)) x), 'a line')
      using errcode = 'OWSHP';
  end if;
  perform ow_system_end(saved);

  perform ow_log(p_shop_id, uid, nullif(btrim(coalesce(v_name, '')), ''), v_role, v_task,
    'Sold over the counter ' || (res ->> 'invoice') || coalesce(' to ' || nullif(q.client_name, ''), '') || ' · ' || ow_money(pay) || ' ' || p_method,
    pay, jsonb_build_object('table', 'saved_quotes', 'id', q.id),
    jsonb_build_object('status', q.status, 'invoiced', false),
    jsonb_build_object('status', 'completed', 'invoiced', true, 'cashTxnId', cash_id, 'method', p_method));

  return jsonb_build_object('ok', true, 'id', q.id, 'invoice', res ->> 'invoice', 'total', total, 'pay', pay,
    'cashTxnId', cash_id, 'change', greatest(0, coalesce(p_given, 0) - pay), 'invoiced', true);
end $$;
revoke all on function counter_sale(uuid, bigint, jsonb, text, numeric) from public, anon;
grant execute on function counter_sale(uuid, bigint, jsonb, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 2. A trip's restock lines reach the shelf.
create or replace function receive_trip(p_shop uuid, p_trip text, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t collection_trips%rowtype;
  l jsonb;
  i int;
  lines_out jsonb := '[]'::jsonb;
  diffs jsonb := '[]'::jsonb;
  inp jsonb;
  n numeric;
  pk numeric;
  buyer numeric;
  price numeric;
  shelf_qty numeric;
  q record;
  items jsonb;
  it jsonb;
  j int;
  k text;
  before numeric;
  after numeric;
  log_id bigint;
  sup_name text;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  received int := 0;
  missing int := 0;
  moved int := 0;
  restocked int := 0;
  touched bigint[] := '{}';
  oid bigint;
  waiting boolean;
  prepay_blocked boolean;
begin
  if not has_task(p_shop, 'stock.receive') then
    raise exception 'Putting a trip on the shelf is for the Store, a manager or the owner.' using errcode = '42501';
  end if;
  select * into t from collection_trips where shop_id = p_shop and id = p_trip for update;
  if not found then raise exception 'That trip is gone.'; end if;
  if t.voided then raise exception 'That trip was called off.'; end if;
  if t.status = 'confirmed' then return jsonb_build_object('ok', true, 'already', true); end if;
  if t.status <> 'collected' then raise exception 'That trip is not back yet.'; end if;

  select name into sup_name from suppliers where shop_id = p_shop and id::text = t.supplier_id;

  for l, i in select e, (o - 1)::int from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) with ordinality as x(e, o)
  loop
    inp := coalesce(p_lines -> i, '{}'::jsonb);
    buyer := case when jsonb_typeof(l -> 'gotQty') = 'number' then (l ->> 'gotQty')::numeric end;
    n := greatest(0, coalesce((inp ->> 'shop')::numeric, buyer, (l ->> 'qty')::numeric, 0));
    pk := greatest(1, coalesce((inp ->> 'pack')::numeric, 1));
    lines_out := lines_out || jsonb_build_array(l || jsonb_build_object('yardQty', n));
    if buyer is not null and buyer <> n then
      diffs := diffs || jsonb_build_array(jsonb_build_object('i', i, 'productName', l ->> 'productName', 'unit', l ->> 'unit', 'buyer', buyer, 'shop', n));
    end if;
    if n <= 0 then continue; end if;

    -- Goods bought for the shelf, no order behind them (buy.restock, 0125):
    -- straight onto the shelf, at the price paid.
    if coalesce(l ->> 'orderId', '') = 'restock' and coalesce(l ->> 'productId', '') <> '' then
      price := coalesce((l ->> 'gotPrice')::numeric, (l ->> 'expectedPrice')::numeric, 0);
      shelf_qty := round(n * pk, 6);
      k := case when coalesce(l ->> 'variantIdx', '') = '' then l ->> 'productId' else (l ->> 'productId') || '::' || (l ->> 'variantIdx') end;
      select qty into before from stock where shop_id = p_shop and key = k for update;
      before := coalesce(before, 0);
      after := round(before + shelf_qty, 6);
      insert into stock (shop_id, key, product_id, variant_idx, qty)
           values (p_shop, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), after)
      on conflict (shop_id, key) do update set qty = excluded.qty;
      insert into stock_lots (shop_id, key, qty, cost) values (p_shop, k, shelf_qty, case when price > 0 then round(price / pk, 6) end);
      log_id := next_stock_log_id(p_shop);
      insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at)
           values (log_id, p_shop, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), l ->> 'productName', 'restock',
                   shelf_qty, after,
                   'Received from ' || coalesce(sup_name, 'the supplier') || ' for the shelf'
                     || case when pk > 1 then ' — ' || n || ' ' || coalesce(l ->> 'unit', '') else '' end || ' · counted at the shop',
                   current_date, now());
      if to_regclass('public.restock_buys') is not null then
        update restock_buys set status = 'collected' where shop_id = p_shop and id::text = l ->> 'lineId' and status in ('planned', 'on_trip');
      end if;
      received := received + 1; restocked := restocked + 1;
      continue;
    end if;

    -- The order line the goods are for. A line amended away is real goods
    -- nothing here knows what to do with: counted and reported, not shelved.
    oid := case when (l ->> 'orderId') ~ '^\d+$' then (l ->> 'orderId')::bigint end;
    if oid is null then missing := missing + 1; continue; end if;
    select id, status, payload into q from saved_quotes where shop_id = p_shop and id = oid and not voided for update;
    if not found then missing := missing + 1; continue; end if;
    items := coalesce(q.payload -> 'items', '[]'::jsonb);
    j := null;
    for x in 0 .. jsonb_array_length(items) - 1 loop
      if (items -> x ->> 'lineId') = (l ->> 'lineId') then j := x; exit; end if;
    end loop;
    if j is null then missing := missing + 1; continue; end if;
    it := items -> j;

    -- setLineSupplier: a trip is the record of where somebody went.
    if t.supplier_id is not null and t.supplier_id <> '__stock__' and coalesce(it ->> 'supplierId', '') <> t.supplier_id then
      it := it || jsonb_build_object('supplierId', t.supplier_id) || case when sup_name is not null then jsonb_build_object('supplierName', sup_name) else '{}'::jsonb end;
    end if;
    -- receiveQuoteLine: adds to what already came, each arrival its own receipt.
    price := coalesce((l ->> 'gotPrice')::numeric, (l ->> 'expectedPrice')::numeric, (it ->> 'price')::numeric, 0);
    shelf_qty := round(n * pk, 6);
    it := it || jsonb_build_object(
      'receivedQty', coalesce((it ->> 'receivedQty')::numeric, 0) + n,
      'receivedPrice', price,
      'receipts', coalesce(case when jsonb_typeof(it -> 'receipts') = 'array' then it -> 'receipts' end, '[]'::jsonb)
                    || jsonb_build_array(jsonb_build_object('qty', n, 'price', price, 'at', now_iso)),
      'receivedAt', now_iso,
      'receivedOnShelf', coalesce((it ->> 'receivedOnShelf')::numeric, 0) + shelf_qty);
    items := jsonb_set(items, array[j::text], it);
    update saved_quotes set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{items}', items) where shop_id = p_shop and id = oid;
    if not (oid = any(touched)) then touched := touched || oid; end if;

    -- applyStockDelta, in the shelf's unit, at the cost per shelf unit.
    k := case when coalesce(it ->> 'variantIdx', '') = '' then it ->> 'productId' else (it ->> 'productId') || '::' || (it ->> 'variantIdx') end;
    select qty into before from stock where shop_id = p_shop and key = k for update;
    before := coalesce(before, 0);
    after := round(before + shelf_qty, 6);
    insert into stock (shop_id, key, product_id, variant_idx, qty)
         values (p_shop, k, it ->> 'productId', nullif(it ->> 'variantIdx', ''), after)
    on conflict (shop_id, key) do update set qty = excluded.qty;
    insert into stock_lots (shop_id, key, qty, cost) values (p_shop, k, shelf_qty, case when price > 0 then round(price / pk, 6) end);
    log_id := next_stock_log_id(p_shop);
    insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at)
         values (log_id, p_shop, k, it ->> 'productId', nullif(it ->> 'variantIdx', ''), coalesce(it ->> 'productName', l ->> 'productName'), 'restock',
                 shelf_qty, after,
                 'Received from ' || coalesce(sup_name, 'the supplier') || coalesce(' for ' || nullif(q.payload -> 'client' ->> 'name', ''), '')
                   || case when pk > 1 then ' — ' || n || ' ' || coalesce(it ->> 'unit', '') else '' end || ' · counted at the shop',
                 current_date, now());
    received := received + 1;
  end loop;

  -- Buying -> Packing for an order whose goods are all in now
  -- (orderAwaitsGoods; the prepay gate holds, as orderLeaveDraft does).
  foreach oid in array touched loop
    select id, status, payload into q from saved_quotes where shop_id = p_shop and id = oid;
    if q.status <> 'awaiting_goods' then continue; end if;
    select exists (
      select 1 from jsonb_array_elements(coalesce(q.payload -> 'items', '[]'::jsonb)) e
       where coalesce(e ->> 'supplierId', '') not in ('', '__stock__')
         and not (coalesce(e ->> 'receivedAt', '') <> '' and coalesce((e ->> 'receivedQty')::numeric, 0) > 0)
    ) into waiting;
    if waiting then continue; end if;
    select exists (
      select 1 from agents a
       where a.shop_id = p_shop and a.id::text = q.payload ->> 'originAgentId'
         and coalesce(a.payment_term, 'prepay') = 'prepay' and coalesce(q.payload ->> 'agentPaymentStatus', '') <> 'paid'
    ) into prepay_blocked;
    if prepay_blocked then continue; end if;
    update saved_quotes
       set status = 'preparing',
           payload = coalesce(payload, '{}'::jsonb)
             || jsonb_build_object('stageEnteredAt', now_ms,
                  'stageLog', coalesce(case when jsonb_typeof(payload -> 'stageLog') = 'array' then payload -> 'stageLog' end, '[]'::jsonb)
                              || jsonb_build_array(jsonb_build_object('status', 'preparing', 'at', now_ms, 'auto', true)))
     where shop_id = p_shop and id = oid;
    moved := moved + 1;
  end loop;

  update collection_trips
     set lines = lines_out,
         yard_checked_at = coalesce(yard_checked_at, now()),
         yard_checked_by = coalesce(yard_checked_by, auth.uid()),
         yard_received_at = now(), yard_received_by = auth.uid(),
         status = 'confirmed', confirmed_at = now()
   where shop_id = p_shop and id = p_trip;

  return jsonb_build_object('ok', true, 'received', received, 'missing', missing, 'moved', moved, 'restocked', restocked, 'differences', jsonb_array_length(diffs));
end;
$$;
revoke all on function receive_trip(uuid, text, jsonb) from public, anon;
grant execute on function receive_trip(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3. "Cash first" holds until the order is paid.
create or replace function ow_gate_reason(p_shop_id uuid, p_payload jsonb, p_amount_paid numeric)
returns text
language plpgsql stable as $$
declare
  presets jsonb := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  it jsonb;
  c customers;
  amt numeric;
  dec jsonb := p_payload -> 'creditCheck';
begin
  for it in select e from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'items') = 'array' then p_payload -> 'items' else '[]'::jsonb end) e loop
    if ow_line_waits_price(p_shop_id, it, presets) then return 'price'; end if;
  end loop;
  if coalesce(p_payload ->> 'customerId', '') <> '' then
    select * into c from customers where shop_id = p_shop_id and id = p_payload ->> 'customerId';
    if found and coalesce(c.credit_limit, 0) > 0 then
      amt := greatest(0, round(ow_order_total(p_shop_id, p_payload, true)) - coalesce(p_amount_paid, 0));
      if coalesce(c.debt, 0) + amt > c.credit_limit
         and (jsonb_typeof(dec) is distinct from 'object'
              or dec ->> 'decision' = 'hold'
              -- The Manager said "cash first": held until the order is paid.
              or (dec ->> 'decision' = 'cash' and amt > 0)) then
        return 'credit';
      end if;
    end if;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 4. A phone confirmation and a trip's prices count toward the day's share.
create or replace function buyer_confirm_price(p_shop_id uuid, p_price_id bigint, p_wholesale numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare
  was prices%rowtype;
begin
  if not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'price.confirm')) then
    raise exception 'Confirming a price needs price.confirm.' using errcode = '42501';
  end if;
  if p_wholesale is not null and p_wholesale < 0 then
    raise exception 'A price is never below zero.' using errcode = '22023';
  end if;
  select * into was from prices where id = p_price_id and shop_id = p_shop_id;
  if not found then
    raise exception 'No such price on this shop''s list.' using errcode = 'P0002';
  end if;
  update prices
     set wholesale = coalesce(p_wholesale, wholesale),
         date = current_date,
         price_source = 'confirmed',
         last_asked_at = null,
         confirmed_by = auth.uid(),
         confirmed_via = 'phone'
   where id = p_price_id and shop_id = p_shop_id;
  if to_regclass('public.decision_log') is not null then
    execute 'insert into decision_log (shop_id, by, role, task, what, amount, ref, before, after)
             values ($1, auth.uid(), ''buyer'', ''price.confirm'', $2, $3, $4, $5, $6)'
      using p_shop_id,
            'Price confirmed by phone: ' || coalesce(was.wholesale::text, '—') || ' → ' || coalesce(p_wholesale, was.wholesale)::text,
            coalesce(p_wholesale, was.wholesale),
            jsonb_build_object('table', 'prices', 'id', p_price_id),
            jsonb_build_object('wholesale', was.wholesale),
            jsonb_build_object('wholesale', coalesce(p_wholesale, was.wholesale), 'how', 'phone');
  end if;
end $$;

create or replace function trip_prices_to_list(p_shop_id uuid, p_trip_id text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  t collection_trips%rowtype;
  l jsonb;
  r prices%rowtype;
  n integer := 0;
  each_price numeric;
begin
  if not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'trip.collect')) then
    raise exception 'Updating prices from a trip needs trip.collect.' using errcode = '42501';
  end if;
  select * into t from collection_trips where shop_id = p_shop_id and id = p_trip_id;
  if not found then
    raise exception 'No such trip.' using errcode = 'P0002';
  end if;
  for l in select * from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) loop
    if (l->>'gotPrice') is null or (l->>'productId') is null then continue; end if;
    -- gotPrice is kept per base unit, the way the price list keeps it.
    each_price := (l->>'gotPrice')::numeric;
    if each_price is null or each_price < 0 then continue; end if;
    for r in select * from prices
              where shop_id = p_shop_id and supplier_id = t.supplier_id and product_id = l->>'productId'
                and coalesce(variant_idx::text, '') = coalesce(l->>'variantIdx', '')
    loop
      update prices
         set wholesale = each_price, date = current_date, price_source = 'purchase', last_asked_at = null,
             confirmed_by = auth.uid(), confirmed_via = 'trip'
       where id = r.id;
      n := n + 1;
      if to_regclass('public.decision_log') is not null then
        execute 'insert into decision_log (shop_id, by, role, task, what, amount, ref, before, after)
                 values ($1, auth.uid(), ''buyer'', ''price.confirm'', $2, $3, $4, $5, $6)'
          using p_shop_id,
                'Price paid on trip ' || p_trip_id || ': ' || coalesce(r.wholesale::text, '—') || ' → ' || each_price::text,
                each_price,
                jsonb_build_object('table', 'prices', 'id', r.id),
                jsonb_build_object('wholesale', r.wholesale),
                jsonb_build_object('wholesale', each_price, 'how', 'trip');
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- 5. The restock hold, on the table the Buyer writes.
do $$
declare c record;
begin
  if to_regclass('public.restock_buys') is null then
    raise notice 'restock_buys is not on this database (0125); the restock hold waits for it.';
    return;
  end if;
  for c in select conname from pg_constraint
            where conrelid = 'public.restock_buys'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%planned%'
  loop
    execute format('alter table restock_buys drop constraint %I', c.conname);
  end loop;
  alter table restock_buys add constraint restock_buys_status_check
    check (status in ('planned', 'held', 'on_trip', 'collected', 'cancelled'));
  alter table restock_buys add column if not exists held_by uuid;
  alter table restock_buys add column if not exists held_at timestamptz;
end $$;

create or replace function hold_restock_buy(p_id uuid, p_hold boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  nm text;
begin
  select * into r from restock_buys where id = p_id for update;
  if not found then raise exception 'That restock line is gone.' using errcode = 'P0002'; end if;
  if not has_task(r.shop_id, 'restock.hold') then
    raise exception 'Holding a restock line is the Manager''s (restock.hold).' using errcode = '42501';
  end if;
  if (p_hold and r.status = 'held') or (not p_hold and r.status = 'planned') then
    return jsonb_build_object('ok', true, 'id', p_id, 'status', r.status, 'already', true);
  end if;
  if r.status <> (case when p_hold then 'planned' else 'held' end) then
    raise exception 'That line is % already; only a planned line is held, and only a held one let go.', r.status using errcode = 'OWRST';
  end if;
  select coalesce(p.name, r.product_id) into nm from products p where p.shop_id = r.shop_id and p.id = r.product_id;
  update restock_buys
     set status = case when p_hold then 'held' else 'planned' end,
         held_by = case when p_hold then auth.uid() else null end,
         held_at = case when p_hold then now() else null end
   where id = p_id;
  perform manager_log_decision(r.shop_id, 'restock.hold',
    case when p_hold then 'Held restock: ' else 'Let restock go ahead: ' end || r.qty || ' × ' || coalesce(nm, 'an item'),
    case when r.price is not null then r.price * r.qty end,
    jsonb_build_object('table', 'restock_buys', 'id', r.id),
    jsonb_build_object('status', r.status), jsonb_build_object('status', case when p_hold then 'held' else 'planned' end));
  return jsonb_build_object('ok', true, 'id', p_id, 'status', case when p_hold then 'held' else 'planned' end);
end $$;
revoke all on function hold_restock_buy(uuid, boolean) from public, anon;
grant execute on function hold_restock_buy(uuid, boolean) to authenticated;

create or replace function restock_buys_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if new.status = 'held' and old.status is distinct from 'held' then
    select coalesce(p.name, new.product_id) into nm from products p where p.shop_id = new.shop_id and p.id = new.product_id;
    perform ow_push(new.shop_id, 'restock.held', 'The Manager held a restock line',
      coalesce(nm, 'A line') || ' — not to buy for now.',
      null, 'buy.restock', null, jsonb_build_object('table', 'restock_buys', 'id', new.id), 'held:' || new.id || ':' || coalesce(new.held_at::text, ''));
  elsif new.status = 'planned' and old.status = 'held' then
    select coalesce(p.name, new.product_id) into nm from products p where p.shop_id = new.shop_id and p.id = new.product_id;
    perform ow_push(new.shop_id, 'restock.released', 'The Manager let a restock line go ahead',
      coalesce(nm, 'A line') || ' — buy it when you next go.',
      null, 'buy.restock', null, jsonb_build_object('table', 'restock_buys', 'id', new.id), 'released:' || new.id || ':' || (extract(epoch from now()) * 1000)::bigint);
  end if;
  return null;
exception when others then
  raise notice 'push (restock): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
do $$
begin
  if to_regclass('public.restock_buys') is not null and to_regclass('public.push_outbox') is not null then
    drop trigger if exists restock_buys_ow_push on restock_buys;
    create trigger restock_buys_ow_push after update on restock_buys
      for each row execute function restock_buys_ow_push();
  end if;
end $$;

-- The table nobody wrote, and what read it.
do $$
begin
  if to_regclass('public.restock_lines') is not null then
    drop trigger if exists restock_lines_ow_push on restock_lines;
  end if;
  drop function if exists restock_lines_ow_push();
  drop function if exists hold_restock_line(uuid, boolean);
  drop table if exists restock_lines;
end $$;

-- ---------------------------------------------------------------------
-- 6. A dropped line tells the salesperson.
create or replace function saved_quotes_ow_push3() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := coalesce(old.payload, '{}'::jsonb);
  nd jsonb := case when jsonb_typeof(p -> 'droppedLines') = 'array' then p -> 'droppedLines' else '[]'::jsonb end;
  od jsonb := case when jsonb_typeof(o -> 'droppedLines') = 'array' then o -> 'droppedLines' else '[]'::jsonb end;
  taker uuid := ow_uuid(p ->> 'takenBy');
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'an order');
  d jsonb;
  i int;
begin
  if coalesce(new.voided, false) or taker is null then return null; end if;
  if jsonb_array_length(nd) <= jsonb_array_length(od) then return null; end if;
  for i in jsonb_array_length(od) .. jsonb_array_length(nd) - 1 loop
    d := nd -> i;
    perform ow_push(new.shop_id, 'line.dropped', 'A line came off the bill',
      client || ' — ' || coalesce(d ->> 'productName', d ->> 'name', 'a line') || ': ' || coalesce(d ->> 'reason', 'nobody has it') || '. Tell them.',
      taker, null, null, jsonb_build_object('table', 'saved_quotes', 'id', new.id), 'dropped:' || new.id || ':' || i);
  end loop;
  return null;
exception when others then
  raise notice 'push (dropped): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
do $$
begin
  if to_regclass('public.push_outbox') is not null then
    drop trigger if exists saved_quotes_ow_push3 on saved_quotes;
    create trigger saved_quotes_ow_push3 after update on saved_quotes
      for each row execute function saved_quotes_ow_push3();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. The invoice label past order 9999. lpad(id, 4) CUTS a longer id to
--    its first four digits (order 10000 -> 'INV-1000', the same label as
--    order 1000; order 901506 -> 'INV-9015'), while every app pads without
--    cutting. The core is 0135's, with that one line changed.
create or replace function ow_invoice_core(p_shop_id uuid, p_quote_id bigint, p_via text, p_by uuid, p_by_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q saved_quotes;
  pay jsonb;
  presets jsonb := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  tz text := ow_shop_tz();
  made date;
  inv_at date;
  inv_ts timestamptz;
  client text;
  items jsonb;
  out_items jsonb := '[]'::jsonb;
  it jsonb;
  vi numeric;
  conv record;
  need numeric;
  have numeric;
  take numeric;
  lots jsonb;
  surplus numeric;
  shortfall boolean := false;
  surplus_total numeric := 0;
  sid text;
  sids text[] := '{}';
  bill_items jsonb;
  base jsonb;
  bill_id bigint;
  bills jsonb := '[]'::jsonb;
  floor_id bigint;
  total numeric;
  desired numeric;
  current numeric;
  delta numeric;
  c customers;
  cname text;
  v_before numeric;
  v_after numeric;
  applied numeric;
  inv_label text := 'INV-' || case when length(p_quote_id::text) < 4 then lpad(p_quote_id::text, 4, '0') else p_quote_id::text end;
begin
  select * into q from saved_quotes where id = p_quote_id and shop_id = p_shop_id for update;
  if not found then raise exception 'That order is not in this shop.' using errcode = 'P0002'; end if;
  if q.voided then raise exception 'That order is voided.' using errcode = '22023'; end if;
  if q.invoiced then raise exception '% is invoiced already.', inv_label using errcode = '22023'; end if;
  if q.status is distinct from 'completed' then raise exception 'Only a delivered order is invoiced.' using errcode = '22023'; end if;
  pay := coalesce(q.payload, '{}'::jsonb);
  items := case when jsonb_typeof(pay -> 'items') = 'array' then pay -> 'items' else '[]'::jsonb end;
  if ow_pick_shortfall(pay) then
    raise exception 'A short pick on % is not settled yet: bill what went, or the full quantity, first.', inv_label using errcode = 'OWSHP';
  end if;
  if exists (select 1 from jsonb_array_elements(items) e where ow_line_waits_price(p_shop_id, e, presets)) then
    raise exception 'A price on % still waits for the Manager.', inv_label using errcode = 'OWPRC';
  end if;
  if exists (select 1 from purchase_invoices b where b.shop_id = p_shop_id and b.quote_id = p_quote_id
              and coalesce(b.payload ->> 'voided', 'false') <> 'true') then
    raise exception 'Supplier bills for % are raised already.', inv_label using errcode = 'OWBIL';
  end if;

  -- orderIsBackdated: a late entry is invoiced on its own date.
  made := (ow_ts(coalesce(nullif(pay ->> 'createdAt', ''), pay ->> 'savedAt')) at time zone tz)::date;
  if q.date is not null and made is not null and q.date < made then
    inv_at := q.date; inv_ts := (q.date + time '12:00') at time zone tz;
  else
    inv_at := ow_today(); inv_ts := now();
  end if;
  client := coalesce(nullif(btrim(coalesce(pay -> 'client' ->> 'name', '')), ''), nullif(btrim(coalesce(q.client_name, '')), ''));

  -- applyQuoteStockDeduction: every line that comes off the shelf.
  for it in select e from jsonb_array_elements(items) e loop
    if jsonb_typeof(it) = 'object' and (coalesce(it ->> 'supplierId', '') = '__stock__' or ow_line_received(it)) then
      vi := ow_num(it ->> 'variantIdx');
      conv := ow_on_shelf(p_shop_id, it ->> 'productId', vi, coalesce(ow_num(it ->> 'qty'), 0), it ->> 'unit', it, null);
      need := conv.qty;
      select coalesce(s.qty, 0) into have from stock s where s.shop_id = p_shop_id and s.key = ow_stock_key(it ->> 'productId', vi);
      have := coalesce(have, 0);
      take := least(have, need);
      if take < need then shortfall := true; end if;
      it := it || jsonb_build_object('_stockTaken', trim_scale(take));
      if take > 0 then
        lots := ow_stock_move(p_shop_id, it ->> 'productId', vi, coalesce(it ->> 'productName', it ->> 'productId'), -take,
                              'sale', 'Quote for ' || coalesce(client, 'Unnamed client'), null, null);
        it := it || jsonb_build_object('_stockLots', lots);
      end if;
    end if;
    out_items := out_items || jsonb_build_array(it);
  end loop;

  -- applyQuoteSurplusToStock: a pack that could not be broken.
  items := out_items; out_items := '[]'::jsonb;
  for it in select e from jsonb_array_elements(items) e loop
    if jsonb_typeof(it) = 'object' and not ow_line_received(it) then
      surplus := ow_units_bought(p_shop_id, it) - coalesce(ow_num(it ->> 'qty'), 0);
      if surplus > 0 then
        vi := ow_num(it ->> 'variantIdx');
        conv := ow_on_shelf(p_shop_id, it ->> 'productId', vi, surplus, it ->> 'unit', it, nullif(coalesce(ow_num(it ->> 'price'), 0), 0));
        it := it || jsonb_build_object('_surplusStocked', trim_scale(conv.qty));
        perform ow_stock_move(p_shop_id, it ->> 'productId', vi, coalesce(it ->> 'productName', it ->> 'productId'), conv.qty, 'restock',
          'Left over from ' || coalesce(client, 'a quote') || ' — '
            || coalesce((select s.name from suppliers s where s.shop_id = p_shop_id and s.id = it ->> 'supplierId'), it ->> 'supplierName', '')
            || ' sells by the ' || coalesce(nullif(it ->> 'packUnit', ''), 'pack'),
          conv.cost, it ->> 'supplierId');
        surplus_total := surplus_total + conv.qty;
      end if;
    end if;
    out_items := out_items || jsonb_build_array(it);
  end loop;

  -- generatePurchaseInvoicesForQuote: one bill per supplier, in the order
  -- the suppliers first appear on the order.
  for it in select e from jsonb_array_elements(out_items) e loop
    sid := it ->> 'supplierId';
    if coalesce(sid, '') not in ('', '__stock__') and not (sid = any(sids)) then sids := sids || sid; end if;
  end loop;
  foreach sid in array sids loop
    bill_items := '[]'::jsonb;
    for it in select e from jsonb_array_elements(out_items) e where e ->> 'supplierId' = sid loop
      select coalesce(jsonb_object_agg(k, it -> k), '{}'::jsonb) into base
        from unnest(array['productId', 'variantIdx', 'productName', 'unit', 'packUnit', 'packQty']) k where it ? k;
      if ow_line_received(it) and jsonb_typeof(it -> 'receipts') = 'array' and jsonb_array_length(it -> 'receipts') > 1 then
        bill_items := bill_items || coalesce((
          select jsonb_agg(base || jsonb_build_object('qty', ow_num(r ->> 'qty'), 'price', ow_num(r ->> 'price')) order by n)
            from jsonb_array_elements(it -> 'receipts') with ordinality as x(r, n)
           where coalesce(ow_num(r ->> 'qty'), 0) > 0), '[]'::jsonb);
      elsif ow_line_received(it) then
        bill_items := bill_items || jsonb_build_array(base || jsonb_build_object('qty', ow_num(it ->> 'receivedQty'), 'price', ow_num(it ->> 'receivedPrice')));
      else
        bill_items := bill_items || jsonb_build_array(base || jsonb_build_object('qty', ow_units_bought(p_shop_id, it), 'price', coalesce(it -> 'price', 'null'::jsonb)));
      end if;
    end loop;
    select coalesce(max(id), 0) into floor_id from purchase_invoices where shop_id = p_shop_id;
    bill_id := ow_next_row_id(p_shop_id, 'row:purchase_invoice', floor_id);
    insert into purchase_invoices (id, shop_id, quote_id, date, payload)
         values (bill_id, p_shop_id, p_quote_id, inv_at, jsonb_build_object(
           'customerName', coalesce(client, ''),
           'supplierId', sid,
           'supplierName', coalesce((select s.name from suppliers s where s.shop_id = p_shop_id and s.id = sid),
                                    (select e ->> 'supplierName' from jsonb_array_elements(out_items) e where e ->> 'supplierId' = sid limit 1), ''),
           'items', bill_items, 'amountPaid', 0, 'payments', '[]'::jsonb, 'voided', false));
    bills := bills || to_jsonb(bill_id);
  end loop;

  -- syncInvoiceDebtCharge: the customer's debt brought to the balance due.
  pay := pay || jsonb_build_object('items', out_items);
  total := trim_scale(round(ow_order_total(p_shop_id, pay, false), 6));
  desired := greatest(0, total - coalesce(q.amount_paid, 0));
  current := coalesce(ow_num(pay ->> 'debtCharged'), 0);
  delta := desired - current;
  if delta <> 0 then
    if coalesce(pay ->> 'customerId', '') <> '' then
      select * into c from customers where shop_id = p_shop_id and id = pay ->> 'customerId' for update;
    end if;
    if c.id is null and client is not null then
      select * into c from customers where shop_id = p_shop_id and lower(btrim(coalesce(name, ''))) = lower(client)
       order by id limit 1 for update;
      if c.id is null then
        cname := ow_free_customer_id(p_shop_id);
        insert into customers (shop_id, id, name, phone, location, notes, debt)
             values (p_shop_id, cname, client, coalesce(pay -> 'client' ->> 'phone', q.client_phone, ''), '', '', 0)
          returning * into c;
      end if;
    end if;
    if c.id is not null then
      v_before := coalesce(c.debt, 0);
      v_after := greatest(0, v_before + delta);
      applied := v_after - v_before;
      if applied <> 0 then
        update customers set debt = v_after where shop_id = p_shop_id and id = c.id;
        select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = p_shop_id;
        insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id)
             values (ow_next_row_id(p_shop_id, 'row:debt_log', floor_id), p_shop_id, c.id, ow_today(),
                     case when applied > 0 then 'charge' else 'payment' end, abs(applied),
                     'Auto-sync — ' || inv_label, p_quote_id);
      end if;
      pay := pay || jsonb_build_object('customerId', c.id);
    end if;
  end if;
  pay := pay || jsonb_build_object('debtCharged', desired,
    'invoicedBy', jsonb_build_object('via', p_via, 'by', p_by, 'byName', p_by_name, 'at', now()));

  update saved_quotes
     set invoiced = true, invoiced_at = inv_at, invoiced_ts = inv_ts, payload = pay
   where id = p_quote_id and shop_id = p_shop_id;

  return jsonb_build_object('ok', true, 'id', p_quote_id, 'invoice', inv_label, 'invoicedAt', inv_at,
    'total', total, 'debtCharged', desired, 'bills', bills, 'shortOnShelf', shortfall, 'surplusStocked', surplus_total);
end $$;
revoke all on function ow_invoice_core(uuid, bigint, text, uuid, text) from public, anon, authenticated;
