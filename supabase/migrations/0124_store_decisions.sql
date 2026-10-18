-- The Store's half of docs/decision-rights.md: the Store does the work and
-- proposes the exceptions, the Manager decides them, nothing waits for the
-- owner.
--
-- What 0115 left with the owner and this moves:
--
--   stock.receive   The shop's count of a trip puts its goods on the shelf.
--                   receive_trip() writes the count, receives every line the
--                   way the console's confirmCollectionTrip/receiveQuoteLine
--                   does (the order line marked received at what was paid,
--                   stock in, a cost lot, a 'restock' stock_log row), moves
--                   an order whose goods are all in from Buying to Packing,
--                   and closes the trip. Before this, "the console still puts
--                   it on the shelf".
--   trip.difference Where the shop counted a line differently from the Buyer,
--                   the shelf takes the shop's count and the trip carries the
--                   difference for the Manager: accept_trip_difference().
--   stock.report    The Store reports damaged, lost or stolen stock
--                   (stock_reports). Nothing moves on the shelf yet.
--   stock.writeoff  The Manager writes it off: write_off_stock() takes it off
--                   the shelf, oldest lots first, one 'damaged' stock_log row.
--                   Or asks about it: ask_about_report().
--   pick.settle     A short pick is settled by the Manager: bill what went, or
--                   the full quantity (settle_short_pick()). The 24-hour
--                   invoice run (0119) skips an order while a short line on it
--                   has no settlement.
--   returns         The Store proposes goods coming back at the gate
--                   (stock_returns). Raising the credit note is the Manager's
--                   (credit_note.raise), built with credit notes (0122).
--   route.lock      The Store names the delivery directions on the load map
--                   (road_names), the owner no longer does.
--   trip.collect    Store staff may ride a buying trip the Buyer sends them
--                   on. The trip row is already open to the shop's members
--                   (0070); this grants the task so it reads true.
--
-- Push for any of these is the shared build's (0120), not this file's.
--
-- Migrations are applied by hand. Safe to run twice.
--
-- ROLLBACK:
--   delete from role_tasks where (role, task) in (('store','stock.receive'),
--     ('store','stock.report'),('store','trip.collect'),('manager','trip.difference'),
--     ('manager','stock.writeoff'),('manager','pick.settle'));
--   drop function if exists receive_trip(uuid, text, jsonb);
--   drop function if exists accept_trip_difference(uuid, text, boolean);
--   drop function if exists write_off_stock(uuid);
--   drop function if exists ask_about_report(uuid);
--   drop function if exists settle_short_pick(uuid, bigint, text, text);
--   drop table if exists stock_reports, stock_returns, road_names;
--   alter table collection_trips drop column if exists yard_received_at,
--     drop column if exists yard_received_by, drop column if exists difference,
--     drop column if exists difference_status, drop column if exists difference_by,
--     drop column if exists difference_at;

/* ---- 1. tasks ---- */
insert into role_tasks (role, task) values
  ('store', 'stock.receive'),
  ('store', 'stock.report'),
  ('store', 'trip.collect'),
  ('manager', 'trip.difference'),
  ('manager', 'stock.writeoff'),
  ('manager', 'pick.settle')
on conflict do nothing;

/* ---- 2. a trip received, and its difference ---- */
do $$
begin
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips columns: table not on this database';
  else
    alter table collection_trips add column if not exists yard_received_at timestamptz;
    alter table collection_trips add column if not exists yard_received_by uuid;
    -- [{i, productName, unit, buyer, shop}] -- lines the shop counted
    -- differently from the Buyer. The shelf already took the shop's count.
    alter table collection_trips add column if not exists difference jsonb;
    alter table collection_trips add column if not exists difference_status text;
    alter table collection_trips add column if not exists difference_by uuid;
    alter table collection_trips add column if not exists difference_at timestamptz;
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
         status = 'confirmed', confirmed_at = now(),
         difference = case when jsonb_array_length(diffs) > 0 then diffs end,
         difference_status = case when jsonb_array_length(diffs) > 0 then 'open' end
   where shop_id = p_shop and id = p_trip;

  return jsonb_build_object('ok', true, 'received', received, 'missing', missing, 'moved', moved, 'differences', jsonb_array_length(diffs));
end;
$$;
revoke all on function receive_trip(uuid, text, jsonb) from public, anon;
grant execute on function receive_trip(uuid, text, jsonb) to authenticated;

-- The Manager on a difference: accept the shop's count (the shelf already
-- has it), or ask the Buyer about it.
create or replace function accept_trip_difference(p_shop uuid, p_trip text, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_task(p_shop, 'trip.difference') then
    raise exception 'A trip difference is the Manager''s to decide.' using errcode = '42501';
  end if;
  update collection_trips
     set difference_status = case when p_accept then 'accepted' else 'asked' end,
         difference_by = auth.uid(), difference_at = now()
   where shop_id = p_shop and id = p_trip and difference is not null;
  if not found then raise exception 'That trip has no difference to decide.'; end if;
end;
$$;
revoke all on function accept_trip_difference(uuid, text, boolean) from public, anon;
grant execute on function accept_trip_difference(uuid, text, boolean) to authenticated;

/* ---- 3. damaged, lost or stolen ---- */
create table if not exists stock_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  key text not null,
  product_id text,
  variant_idx text,
  name text,
  qty numeric not null,
  reason text not null,
  photo text,
  note text,
  reported_by uuid not null default auth.uid(),
  reported_by_name text,
  status text not null default 'reported',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint stock_reports_qty_check check (qty > 0),
  constraint stock_reports_reason_check check (reason in ('damaged', 'lost', 'stolen')),
  constraint stock_reports_status_check check (status in ('reported', 'written_off', 'asked'))
);
create index if not exists stock_reports_shop_idx on stock_reports(shop_id, created_at desc);
alter table stock_reports enable row level security;

drop policy if exists "members read stock reports" on stock_reports;
create policy "members read stock reports" on stock_reports
  for select using (is_shop_member(shop_id));
drop policy if exists "reporters add stock reports" on stock_reports;
create policy "reporters add stock reports" on stock_reports
  for insert with check (has_task(shop_id, 'stock.report') and reported_by = auth.uid() and status = 'reported');

create or replace function write_off_stock(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r stock_reports%rowtype;
  before numeric;
  after numeric;
  left_to_take numeric;
  lot record;
  log_id bigint;
begin
  select * into r from stock_reports where id = p_id for update;
  if not found then raise exception 'That report is gone.'; end if;
  if not has_task(r.shop_id, 'stock.writeoff') then
    raise exception 'Writing stock off is the Manager''s.' using errcode = '42501';
  end if;
  if r.status = 'written_off' then return jsonb_build_object('ok', true, 'already', true); end if;

  select qty into before from stock where shop_id = r.shop_id and key = r.key for update;
  before := coalesce(before, 0);
  after := greatest(0, round(before - r.qty, 6));
  insert into stock (shop_id, key, product_id, variant_idx, qty)
       values (r.shop_id, r.key, r.product_id, r.variant_idx, after)
  on conflict (shop_id, key) do update set qty = excluded.qty;
  left_to_take := before - after;
  for lot in select id, qty from stock_lots where shop_id = r.shop_id and key = r.key order by id loop
    exit when left_to_take <= 0;
    if lot.qty <= left_to_take then
      left_to_take := left_to_take - lot.qty;
      delete from stock_lots where id = lot.id;
    else
      update stock_lots set qty = qty - left_to_take where id = lot.id;
      left_to_take := 0;
    end if;
  end loop;
  log_id := next_stock_log_id(r.shop_id);
  insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at)
       values (log_id, r.shop_id, r.key, r.product_id, r.variant_idx, r.name, 'damaged', round(after - before, 6), after,
               initcap(r.reason) || coalesce(' — reported by ' || r.reported_by_name, '') || ' · written off', current_date, now());
  update stock_reports set status = 'written_off', decided_by = auth.uid(), decided_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'qtyAfter', after);
end;
$$;
revoke all on function write_off_stock(uuid) from public, anon;
grant execute on function write_off_stock(uuid) to authenticated;

create or replace function ask_about_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s uuid;
begin
  select shop_id into s from stock_reports where id = p_id;
  if s is null then raise exception 'That report is gone.'; end if;
  if not has_task(s, 'stock.writeoff') then
    raise exception 'Deciding a report is the Manager''s.' using errcode = '42501';
  end if;
  update stock_reports set status = 'asked', decided_by = auth.uid(), decided_at = now() where id = p_id and status = 'reported';
end;
$$;
revoke all on function ask_about_report(uuid) from public, anon;
grant execute on function ask_about_report(uuid) to authenticated;

/* ---- 4. a short pick, settled ---- */
-- p_mode 'went': bill what was picked (the line's qty becomes pickedQty, the
-- order's own figure kept as orderedQty); 'full': bill the full quantity.
create or replace function settle_short_pick(p_shop uuid, p_order bigint, p_line text, p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  items jsonb;
  it jsonb;
  j int;
  who text;
begin
  if not has_task(p_shop, 'pick.settle') then
    raise exception 'Settling a short pick is the Manager''s.' using errcode = '42501';
  end if;
  if p_mode not in ('went', 'full') then raise exception 'Bill what went, or the full quantity.'; end if;
  select id, payload, invoiced into q from saved_quotes where shop_id = p_shop and id = p_order and not voided for update;
  if not found then raise exception 'That order is gone.'; end if;
  if q.invoiced then raise exception 'That order is invoiced already.'; end if;
  items := coalesce(q.payload -> 'items', '[]'::jsonb);
  for x in 0 .. jsonb_array_length(items) - 1 loop
    if (items -> x ->> 'lineId') = p_line then j := x; exit; end if;
  end loop;
  if j is null then raise exception 'That line is gone.'; end if;
  it := items -> j;
  if coalesce(it ->> 'pickStatus', '') <> 'short' then raise exception 'That line is not short.'; end if;
  select coalesce(nullif(s.name, ''), 'the manager') into who from staff s where s.shop_id = p_shop and s.user_id = auth.uid() limit 1;
  it := it || jsonb_build_object('pickSettle', jsonb_build_object('bill', p_mode, 'by', auth.uid(), 'byName', coalesce(who, 'the manager'),
                                   'at', (extract(epoch from now()) * 1000)::bigint));
  if p_mode = 'went' and it -> 'orderedQty' is null then
    it := it || jsonb_build_object('orderedQty', it -> 'qty', 'qty', coalesce((it ->> 'pickedQty')::numeric, 0));
  end if;
  update saved_quotes set payload = jsonb_set(payload, array['items', j::text], it) where shop_id = p_shop and id = p_order;
end;
$$;
revoke all on function settle_short_pick(uuid, bigint, text, text) from public, anon;
grant execute on function settle_short_pick(uuid, bigint, text, text) to authenticated;

/* ---- 5. goods coming back at the gate ---- */
create table if not exists stock_returns (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  order_id bigint,
  client_name text,
  -- [{lineId, productId, variantIdx, name, unit, qty, sent, condition: 'good'|'damaged'}]
  lines jsonb not null default '[]'::jsonb,
  photo text,
  note text,
  proposed_by uuid not null default auth.uid(),
  proposed_by_name text,
  status text not null default 'proposed',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint stock_returns_status_check check (status in ('proposed', 'credited', 'declined'))
);
create index if not exists stock_returns_shop_idx on stock_returns(shop_id, created_at desc);
alter table stock_returns enable row level security;

drop policy if exists "members read returns" on stock_returns;
create policy "members read returns" on stock_returns
  for select using (is_shop_member(shop_id));
-- Proposed by whoever is at the gate or the counter; decided only through the
-- credit note (credit_note.raise), never by editing this row.
drop policy if exists "the gate proposes returns" on stock_returns;
create policy "the gate proposes returns" on stock_returns
  for insert with check ((has_task(shop_id, 'order.deliver') or has_task(shop_id, 'credit_note.raise'))
                         and proposed_by = auth.uid() and status = 'proposed');

/* ---- 6. the delivery directions, named by the Store ---- */
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
