-- The Store's half of docs/decision-rights.md: the Store does the work and
-- proposes the exceptions, the Manager decides them (0122), nothing waits
-- for the owner.
--
-- What this moves from the owner to the Store:
--
--   stock.receive   The shop's count of a trip puts its goods on the shelf.
--                   receive_trip() writes the count (lines[].yardQty, as
--                   0115), receives every line the way the console's
--                   confirmCollectionTrip/receiveQuoteLine does (the order
--                   line marked received at what was paid, stock in, a cost
--                   lot, a 'restock' stock_log row), moves an order whose
--                   goods are all in from Buying to Packing, and closes the
--                   trip. Before this, "the console still puts it on the
--                   shelf". Where the shop's count differs from the Buyer's
--                   the shelf takes the shop's, and the Manager accepts the
--                   difference with 0122's accept_trip_difference(), which
--                   reads it off the same lines.
--   stock.report    The Store reports damaged, lost or stolen stock into
--                   0122's stock_reports; the Manager writes it off there.
--   trip.collect    Store staff may ride a buying trip the Buyer sends them
--                   on. The trip row is already open to the shop's members
--                   (0070); this grants the task so the doc reads true.
--   route.lock      The Store names the delivery directions on the load map
--                   (road_names), the owner no longer does.
--
-- Goods coming back at the gate are a credit ask (0123 invoice_asks, kind
-- 'credit', which already lets a Store login ask); the Manager raises the
-- credit note (0122). Push for any of these is 0120's.
--
-- Needs 0122 and 0123 applied first. Migrations are applied by hand. Safe
-- to run twice.
--
-- ROLLBACK:
--   delete from role_tasks where (role, task) in (('store','stock.receive'),
--     ('store','stock.report'),('store','trip.collect'));
--   drop function if exists receive_trip(uuid, text, jsonb);
--   drop function if exists next_stock_log_id(uuid);
--   drop table if exists road_names;
--   alter table collection_trips drop column if exists yard_received_at,
--     drop column if exists yard_received_by;

/* ---- 1. tasks ---- */
insert into role_tasks (role, task) values
  ('store', 'stock.receive'),
  ('store', 'stock.report'),
  ('store', 'trip.collect')
on conflict do nothing;

/* ---- 2. a trip received ---- */
do $$
begin
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips columns: table not on this database';
  else
    alter table collection_trips add column if not exists yard_received_at timestamptz;
    alter table collection_trips add column if not exists yard_received_by uuid;
  end if;
end $$;

-- The same id counter the apps draw stock_log ids from (0034).
create or replace function next_stock_log_id(p_shop uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare floor_id bigint; log_id bigint;
begin
  select coalesce(max(id), 0) into floor_id from stock_log where shop_id = p_shop;
  insert into entity_id_counters (shop_id, kind, last_issued)
       values (p_shop, 'row:stock_log', floor_id + 1)
  on conflict (shop_id, kind) do update
          set last_issued = greatest(entity_id_counters.last_issued, floor_id) + 1
    returning last_issued into log_id;
  return log_id;
end;
$$;
revoke all on function next_stock_log_id(uuid) from public, anon, authenticated;

/* receive_trip: p_lines is one entry per trip line, in the trip's order:
   {"shop": n, "pack": k}. shop is what the shop counted, in the line's own
   unit; pack is how many of the shelf's unit one of those is (cartons on a
   shelf counted in dozens), 1 when they are the same. The phone works pack
   out from the product's price rows, the way stockMoveOnRowUnit does. */
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

  return jsonb_build_object('ok', true, 'received', received, 'missing', missing, 'moved', moved, 'differences', jsonb_array_length(diffs));
end;
$$;
revoke all on function receive_trip(uuid, text, jsonb) from public, anon;
grant execute on function receive_trip(uuid, text, jsonb) to authenticated;

/* ---- 3. the delivery directions, named by the Store ---- */
create table if not exists road_names (
  shop_id uuid not null references shops(id) on delete cascade,
  -- The place a direction is drawn to (its farthest pinned place), as the
  -- load map keys it.
  way_key text not null,
  name text not null,
  named_by uuid default auth.uid(),
  named_at timestamptz not null default now(),
  primary key (shop_id, way_key),
  constraint road_names_name_check check (char_length(name) between 1 and 40)
);
alter table road_names enable row level security;

drop policy if exists "members read road names" on road_names;
create policy "members read road names" on road_names
  for select using (is_shop_member(shop_id));
drop policy if exists "route lockers name roads" on road_names;
create policy "route lockers name roads" on road_names
  for insert with check (has_task(shop_id, 'route.lock'));
drop policy if exists "route lockers rename roads" on road_names;
create policy "route lockers rename roads" on road_names
  for update using (has_task(shop_id, 'route.lock')) with check (has_task(shop_id, 'route.lock'));
