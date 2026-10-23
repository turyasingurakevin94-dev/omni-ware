-- 0160 Store, fifth (the browser test of 23 Oct 2026, round 4): the yard's
-- data by what it reads, not by what it must not.
--
-- 0159 took money out by name (price, cost, amount, paid ...). The shop's
-- orders carry money under other names too (a charge's "amt", a "rate",
-- "receipts", a credit note's sums), and on a real shop about 2,200 such
-- fields still reached the phone. So:
--   1. ow_store_payload(payload): an order's payload as the Store reads it --
--      only the keys store.html uses (an allow-list), each line only its
--      line keys, a credit note only which lines and how many, a short pick
--      only what was picked. Anything new stays off the phone until the app
--      asks for it.
--   2. ow_strip_money also knows amt, rate, charges, receipts, sum, value,
--      due, refunds and credit (trips, products and settings still go by it).
--   3. store_snapshot and store_order give orders through ow_store_payload.
--   4. store_patch_order lets the Store write deliveredNote: why a delivery
--      has no photo (the camera would not open, the client said no).
--   5. store_return_ask refuses a return bigger than the line has left (the
--      test found 20 Ctn pending against 1 Ctn bought).
--
-- Run after 0159. Safe to run twice.
--
-- CHECK AFTERWARDS (as a Store login, in the app's browser console):
--   JSON.stringify(await sb.rpc('store_snapshot', { p_shop: S.shopId })).match(/amt|rate|receipts|charges/g)  -- null
--
-- ROLLBACK: run 0159 again (it redefines these functions as they were).
-- ---------------------------------------------------------------------

-- 2. More money names.
create or replace function ow_strip_money(j jsonb) returns jsonb
language plpgsql immutable as $$
declare
  k text;
  v jsonb;
  out jsonb;
begin
  if j is null then return null; end if;
  if jsonb_typeof(j) = 'object' then
    out := '{}'::jsonb;
    for k, v in select * from jsonb_each(j) loop
      if k in ('agentPaymentStatus', 'paymentTerm', 'payment_term') then out := out || jsonb_build_object(k, v); continue; end if;
      if k ~* '(price|cost|amount|paid|payment|total|owed|debt|cash|balance|margin|markup|discount|profit|commission|wholesale|retail|tiers?$|^pay$|^vat$|^tax|fee$|fees$|deposit|creditlimit|credit_limit|sell|amt$|^amt|rate$|^rates?$|charges?$|receipts?$|^sum$|^value$|^due|refund|^credit$|credits$|agentcredit|invoicenote|invoicesends|^money)' then continue; end if;
      out := out || jsonb_build_object(k, ow_strip_money(v));
    end loop;
    return out;
  elsif jsonb_typeof(j) = 'array' then
    return coalesce((select jsonb_agg(ow_strip_money(e)) from jsonb_array_elements(j) e), '[]'::jsonb);
  end if;
  return j;
end $$;

-- 1. An order as the Store reads it.
create or replace function ow_store_payload(p jsonb) returns jsonb
language plpgsql immutable as $$
declare
  top_keys text[] := array['agentPaymentStatus', 'assignedDeliveryId', 'assignedWorkerId', 'bay', 'cancelledAt', 'cancelledByName', 'carrier',
    'client', 'createdAt', 'creditAsk', 'creditCheck', 'customerId', 'date', 'deliveredAt', 'deliveredNote', 'deliveredPhoto', 'deliveredPhotoKind',
    'deliveredTo', 'deliveryAddress', 'deliveryMode', 'handoverCheckedAt', 'originAgentId', 'pickCursor', 'pickShortfallAckAt', 'pickingAssignedAt',
    'pickingDoneAt', 'pickingStatus', 'runDriver', 'savedAt', 'stageEnteredAt', 'stageLog', 'takenBy', 'voidedAt', 'workerAcceptedAt'];
  line_keys text[] := array['lineId', 'productId', 'productName', 'variantIdx', 'qty', 'unit', 'packQty', 'packUnit', 'supplierId', 'clientWaits',
    'pickStatus', 'pickedQty', 'receivedAt', 'receivedQty', 'qtyIn'];
  out jsonb := '{}'::jsonb;
  k text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return '{}'::jsonb; end if;
  foreach k in array top_keys loop
    if p ? k then out := out || jsonb_build_object(k, ow_strip_money(p -> k)); end if;
  end loop;
  if jsonb_typeof(p -> 'items') = 'array' then
    out := out || jsonb_build_object('items', coalesce((select jsonb_agg(coalesce((select jsonb_object_agg(x.key, x.value) from jsonb_each(case when jsonb_typeof(it) = 'object' then it else '{}'::jsonb end) x
        where x.key = any(line_keys)), '{}'::jsonb) order by o) from jsonb_array_elements(p -> 'items') with ordinality y(it, o)), '[]'::jsonb));
  end if;
  if jsonb_typeof(p -> 'creditNotes') = 'array' then
    out := out || jsonb_build_object('creditNotes', coalesce((select jsonb_agg(jsonb_build_object('askId', cn -> 'askId', 'voided', cn -> 'voided',
        'lines', coalesce((select jsonb_agg(jsonb_build_object('idx', e -> 'idx', 'qty', e -> 'qty')) from jsonb_array_elements(case when jsonb_typeof(cn -> 'lines') = 'array' then cn -> 'lines' else '[]'::jsonb end) e), '[]'::jsonb)))
      from jsonb_array_elements(p -> 'creditNotes') cn where jsonb_typeof(cn) = 'object'), '[]'::jsonb));
  end if;
  if jsonb_typeof(p -> 'pickSettle') = 'object' then
    out := out || jsonb_build_object('pickSettle', jsonb_build_object('pick', p -> 'pickSettle' -> 'pick', 'at', p -> 'pickSettle' -> 'at',
      'lines', coalesce((select jsonb_agg(jsonb_build_object('idx', e -> 'idx', 'picked', e -> 'picked', 'ordered', e -> 'ordered'))
        from jsonb_array_elements(case when jsonb_typeof(p -> 'pickSettle' -> 'lines') = 'array' then p -> 'pickSettle' -> 'lines' else '[]'::jsonb end) e), '[]'::jsonb)));
  end if;
  return out;
end $$;

-- 3. The snapshot and one order, through the allow-list.
create or replace function store_snapshot(p_shop uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  since date := current_date - 35;
begin
  if not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'client_name', q.client_name, 'client_phone', q.client_phone, 'date', q.date, 'status', q.status,
        'invoiced', q.invoiced, 'invoiced_ts', q.invoiced_ts, 'voided', q.voided, 'payload', ow_store_payload(q.payload)) order by q.id)
      from saved_quotes q
     where q.shop_id = p_shop and q.status <> 'draft'
       and (q.status <> 'completed' or coalesce(ow_ts(q.payload ->> 'deliveredAt'), q.invoiced_ts, now()) >= now() - interval '35 days')
       and (not coalesce(q.voided, false) or coalesce(ow_ts(q.payload ->> 'stageEnteredAt'), now()) >= now() - interval '14 days')), '[]'::jsonb),
    'trips', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'supplier_id', t.supplier_id, 'status', t.status, 'assigned_worker_id', t.assigned_worker_id, 'created_at', t.created_at,
        'assigned_at', t.assigned_at, 'accepted_at', t.accepted_at, 'collected_at', t.collected_at, 'confirmed_at', t.confirmed_at,
        'note', t.note, 'lines', ow_strip_money(t.lines), 'voided', t.voided, 'yard_checked_at', t.yard_checked_at, 'yard_checked_by', t.yard_checked_by,
        'yard_received_at', t.yard_received_at, 'difference_accepted_at', t.difference_accepted_at) order by t.id)
      from collection_trips t
     where t.shop_id = p_shop and (t.status not in ('confirmed') or coalesce(t.confirmed_at, t.created_at) >= now() - interval '14 days')), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'category', p.category, 'image', p.image,
        'variants', ow_strip_money(coalesce(p.variants, '[]'::jsonb)))) from products p where p.shop_id = p_shop), '[]'::jsonb),
    'units', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'product_id', r.product_id, 'variant_idx', r.variant_idx, 'unit', r.unit,
        'pack_unit', r.pack_unit, 'pack_qty', r.pack_qty, 'pieces_per_unit', r.pieces_per_unit)) from prices r where r.shop_id = p_shop), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'location', c.location))
      from customers c where c.shop_id = p_shop), '[]'::jsonb),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'role', s.role, 'unavailable', s.unavailable, 'user_id', s.user_id))
      from staff s where s.shop_id = p_shop), '[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'location', s.location)) from suppliers s where s.shop_id = p_shop), '[]'::jsonb),
    'presets', coalesce((select ow_strip_money(a.presets) from app_settings a where a.shop_id = p_shop), '{}'::jsonb),
    'log', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'key', l.key, 'type', l.type, 'delta', l.delta, 'qty_after', l.qty_after,
        'date', l.date, 'at', l.at, 'note', l.note) order by l.id) from stock_log l where l.shop_id = p_shop and l.date >= since), '[]'::jsonb),
    'counted', coalesce((select jsonb_object_agg(x.key, x.at) from (
        select distinct on (l.key) l.key, coalesce(l.at, l.date::timestamptz) as at from stock_log l
         where l.shop_id = p_shop and l.type in ('count', 'correction') order by l.key, l.id desc) x), '{}'::jsonb),
    'returns', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'quote_id', a.quote_id, 'kind', a.kind, 'lines', ow_strip_money(a.lines),
        'reason', a.reason, 'note', a.note, 'asked_by', a.asked_by, 'asked_by_name', a.asked_by_name, 'status', a.status,
        'decided_at', a.decided_at, 'created_at', a.created_at) order by a.created_at desc)
      from (select * from invoice_asks i where i.shop_id = p_shop and i.kind = 'credit' order by i.created_at desc limit 40) a), '[]'::jsonb),
    'holds', coalesce((select jsonb_object_agg(q.id::text, jsonb_build_object('decision', h ->> 'decision'))
      from saved_quotes q cross join lateral (select ow_money_hold(q.shop_id, q.payload, q.amount_paid) as h) x
     where q.shop_id = p_shop and q.status = 'preparing' and not coalesce(q.voided, false) and not coalesce(q.invoiced, false) and x.h is not null), '{}'::jsonb)
  );
end $$;
revoke all on function store_snapshot(uuid) from public, anon;
grant execute on function store_snapshot(uuid) to authenticated;

create or replace function store_order(p_shop uuid, p_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q saved_quotes%rowtype;
begin
  if not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  select * into q from saved_quotes where shop_id = p_shop and id = p_id;
  if not found then return null; end if;
  return jsonb_build_object('id', q.id, 'client_name', q.client_name, 'client_phone', q.client_phone, 'date', q.date, 'status', q.status,
    'invoiced', q.invoiced, 'invoiced_ts', q.invoiced_ts, 'voided', q.voided, 'payload', ow_store_payload(q.payload));
end $$;
revoke all on function store_order(uuid, bigint) from public, anon;
grant execute on function store_order(uuid, bigint) to authenticated;

-- 4. The Store's fields on an order, deliveredNote among them.
create or replace function store_patch_order(p_shop uuid, p_id bigint, p_patch jsonb, p_status text, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q saved_quotes%rowtype;
  allowed text[] := array['assignedWorkerId', 'assignedDeliveryId', 'pickingStatus', 'pickCursor', 'pickingAssignedAt', 'workerAcceptedAt',
                          'pickingDoneAt', 'bay', 'carrier', 'stageEnteredAt', 'stageLog', 'deliveredTo', 'deliveredAt', 'deliveredPhoto',
                          'deliveredPhotoKind', 'deliveredNote', 'handoverCheckedAt', 'creditAsk'];
  line_keys text[] := array['pickStatus', 'pickedQty'];
  p jsonb;
  items jsonb;
  it jsonb;
  ch jsonb;
  k text;
  i int;
begin
  if not (is_shop_admin(p_shop) or has_task(p_shop, 'order.pick') or has_task(p_shop, 'order.load') or has_task(p_shop, 'order.deliver')
          or exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.role in ('store', 'staff'))) then
    raise exception 'Packing, loading and delivering are the Store''s.' using errcode = '42501';
  end if;
  select * into q from saved_quotes where shop_id = p_shop and id = p_id for update;
  if not found then raise exception 'That order is no longer on the books.'; end if;
  if coalesce(q.voided, false) then return null; end if;
  if p_status is not null and p_status <> q.status then
    if not ((q.status = 'preparing' and p_status in ('pending_delivery', 'completed')) or (q.status = 'pending_delivery' and p_status = 'completed')) then
      raise exception 'That order has moved on.' using errcode = 'P0001';
    end if;
  end if;
  p := coalesce(q.payload, '{}'::jsonb);
  for k in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if not (k = any(allowed)) then continue; end if;
    if jsonb_typeof(p_patch -> k) = 'null' then p := p - k; else p := p || jsonb_build_object(k, p_patch -> k); end if;
  end loop;
  -- A line's pick fields, merged into that line (found by lineId, else by index).
  if jsonb_typeof(p_items) = 'array' then
    items := coalesce(p -> 'items', '[]'::jsonb);
    for ch in select e from jsonb_array_elements(p_items) e loop
      i := null;
      if coalesce(ch ->> 'lineId', '') <> '' then
        select (o - 1)::int into i from jsonb_array_elements(items) with ordinality x(e, o) where x.e ->> 'lineId' = ch ->> 'lineId' limit 1;
      end if;
      if i is null and (ch ->> 'idx') ~ '^\d+$' then i := (ch ->> 'idx')::int; end if;
      if i is null or i >= jsonb_array_length(items) then continue; end if;
      it := items -> i;
      foreach k in array line_keys loop
        if not (ch ? k) then continue; end if;
        if jsonb_typeof(ch -> k) = 'null' then it := it - k; else it := it || jsonb_build_object(k, ch -> k); end if;
      end loop;
      items := jsonb_set(items, array[i::text], it);
    end loop;
    p := jsonb_set(p, '{items}', items);
  end if;
  update saved_quotes set payload = p, status = coalesce(p_status, status) where shop_id = p_shop and id = p_id;
  return store_order(p_shop, p_id);
end $$;
revoke all on function store_patch_order(uuid, bigint, jsonb, text, jsonb) from public, anon;
grant execute on function store_patch_order(uuid, bigint, jsonb, text, jsonb) to authenticated;

-- 5. A return never bigger than the line has left.
create or replace function store_return_ask(p_shop uuid, p_order bigint, p_lines jsonb, p_reason text, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q saved_quotes%rowtype;
  l jsonb;
  it jsonb;
  priced jsonb := '[]'::jsonb;
  price numeric;
  total numeric := 0;
  nm text;
  new_id uuid;
  left_qty numeric;
begin
  if not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  select * into q from saved_quotes where shop_id = p_shop and id = p_order;
  if not found then raise exception 'That order is gone.'; end if;
  for l in select e from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) e loop
    if not ((l ->> 'idx') ~ '^\d+$') or coalesce((l ->> 'qty')::numeric, 0) <= 0 then continue; end if;
    it := q.payload -> 'items' -> ((l ->> 'idx')::int);
    if it is null then continue; end if;
    -- Never more back than the line had, less what is already on its way back or credited.
    left_qty := coalesce((it ->> 'qty')::numeric, 0) - coalesce((
        select sum((e ->> 'qty')::numeric) from invoice_asks a cross join lateral jsonb_array_elements(coalesce(a.lines, '[]'::jsonb)) e
         where a.shop_id = p_shop and a.quote_id = p_order and a.kind = 'credit' and (e ->> 'idx') = (l ->> 'idx')
           and (a.status = 'sent' or (a.status = 'accepted' and not exists (
                 select 1 from jsonb_array_elements(coalesce(q.payload -> 'creditNotes', '[]'::jsonb)) cn where cn ->> 'askId' = a.id::text)))), 0)
      - coalesce((
        select sum((e ->> 'qty')::numeric) from jsonb_array_elements(coalesce(q.payload -> 'creditNotes', '[]'::jsonb)) cn
         cross join lateral jsonb_array_elements(coalesce(cn -> 'lines', '[]'::jsonb)) e
         where not coalesce((cn ->> 'voided')::boolean, false) and (e ->> 'idx') = (l ->> 'idx')), 0);
    if (l ->> 'qty')::numeric > left_qty then
      raise exception 'More than that line can take back: % left of %.', greatest(left_qty, 0), coalesce(it ->> 'qty', '0') using errcode = '22023';
    end if;
    price := coalesce((it ->> 'sellPrice')::numeric, (it ->> 'price')::numeric, 0);
    priced := priced || jsonb_build_array(jsonb_build_object('idx', (l ->> 'idx')::int, 'name', coalesce(l ->> 'name', it ->> 'productName'),
      'unit', coalesce(l ->> 'unit', it ->> 'unit'), 'qty', (l ->> 'qty')::numeric, 'shown', l ->> 'shown',
      'condition', case when l ->> 'condition' = 'damaged' then 'damaged' else 'good' end)
      || case when price > 0 then jsonb_build_object('price', price, 'amount', round(price * (l ->> 'qty')::numeric)) else '{}'::jsonb end);
    total := total + case when price > 0 then round(price * (l ->> 'qty')::numeric) else 0 end;
  end loop;
  if jsonb_array_length(priced) = 0 then raise exception 'Nothing to send back.'; end if;
  select coalesce(nullif(btrim(s.name), ''), 'The Store') into nm from staff s where s.shop_id = p_shop and s.user_id = auth.uid() limit 1;
  insert into invoice_asks (shop_id, quote_id, customer_id, kind, lines, amount, reason, note, asked_by, asked_by_name, asked_role, status)
       values (p_shop, p_order, nullif(q.payload ->> 'customerId', ''), 'credit', priced, total,
               left(coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Came back'), 200), left(nullif(btrim(coalesce(p_note, '')), ''), 500),
               auth.uid(), coalesce(nm, 'The Store'),
               (select m.role from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() limit 1), 'sent')
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'quote_id', p_order, 'kind', 'credit', 'lines', ow_strip_money(priced), 'reason', p_reason, 'note', p_note,
    'asked_by', auth.uid(), 'asked_by_name', coalesce(nm, 'The Store'), 'status', 'sent', 'created_at', now());
end $$;
revoke all on function store_return_ask(uuid, bigint, jsonb, text, text) from public, anon;
grant execute on function store_return_ask(uuid, bigint, jsonb, text, text) to authenticated;
