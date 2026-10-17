-- A Store login: the person in the yard and the storeroom (store.html).
-- Takes trips in, packs orders, loads the truck, hands goods over at the
-- door or the gate, and counts the shelf.
--
-- 0113 allowed the role and gave it no tasks. What the Store app writes
-- that was already open to any shop member, and stays so:
--
--   saved_quotes      picking (pickStatus / pickedQty on the lines,
--                     pickingStatus, pickCursor), the carrier, the move
--                     from Preparing to Out for delivery, and -- new for
--                     this app -- the move to Completed with the delivery
--                     proof (deliveredTo / deliveredAt / deliveredPhoto),
--                     the same keys the owner's "Delivered" sheet writes.
--   collection_trips  the yard's count of what came off a trip.
--   delivery-photos   the picture at the door (0111).
--
-- What stays the owner's, at the database, exactly as 0083 left it:
-- stock, stock lots and the stock log, purchase bills, places. Checking
-- a trip in on the console is still what puts goods on the shelf.
--
-- This migration adds:
--
--   1. The Store's tasks in role_tasks, and 'stock.correct' for a
--      manager, so a count can be accepted from the manager's phone.
--   2. collection_trips.yard_checked_at / yard_checked_by: the yard has
--      counted the trip off the truck. The per-line count rides in the
--      lines themselves (yardQty), like gotQty does. The trip stays
--      'collected' until the console confirms it.
--   3. stock_counts: a blind stock take. The count is written first; what
--      the books said is only captured when the counter saves, and the
--      phone shows it only after. Nobody changes a row here directly:
--      accept_stock_count() and ask_recount() are the only ways on.
--   4. accept_stock_count(): sets each counted item to what was counted,
--      the way the console's stock count does (applyStockDelta: stock,
--      the oldest lots used up first or a lot added, one stock_log row of
--      type 'count'). Needs 'stock.correct' -- owner, admin, or a manager.
--   5. place_routes: a road route from the shop to a pinned place, asked
--      once of the OpenStreetMap router and then locked, so the distance
--      and the time never change under anybody and nothing is paid for.
--
-- Migrations are applied by hand. Safe to run twice.
--
-- MAKE SOMEBODY STORE:
--   update shop_members set role = 'store'
--   where shop_id = 'YOUR-SHOP-ID' and user_id = 'THEIR-USER-ID';
-- and give them a staff row with user_id set (role 'worker' or 'delivery'
-- if they also drive), so orders can be put in front of them.
--
-- THE MANAGER'S PUSH for a finished count is the notify-stock-count Edge
-- Function: deploy it and add a Database Webhook on stock_counts INSERT
-- (see supabase/functions/notify-stock-count/index.ts).
--
-- ROLLBACK:
--   delete from role_tasks where role = 'store';
--   delete from role_tasks where role = 'manager' and task = 'stock.correct';
--   drop function if exists accept_stock_count(uuid);
--   drop function if exists ask_recount(uuid);
--   drop table if exists stock_counts;
--   drop table if exists place_routes;
--   alter table collection_trips drop column if exists yard_checked_at,
--     drop column if exists yard_checked_by;

insert into role_tasks (role, task) values
  ('store', 'trip.checkin'),
  ('store', 'order.pick'),
  ('store', 'order.load'),
  ('store', 'order.deliver'),
  ('store', 'stock.count'),
  ('store', 'route.lock'),
  ('manager', 'stock.correct')
on conflict do nothing;

/* ---- 2. the yard's count of a trip ---- */
do $$
begin
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips yard columns: table not on this database';
  else
    alter table collection_trips add column if not exists yard_checked_at timestamptz;
    alter table collection_trips add column if not exists yard_checked_by uuid;
  end if;
end $$;

/* ---- 3. blind stock takes ---- */
create table if not exists stock_counts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  aisle text,
  counted_by uuid not null default auth.uid(),
  counted_by_name text,
  -- [{key, productId, variantIdx, name, counted, system}] -- base units.
  -- system is what the books said at the moment the line was saved.
  lines jsonb not null default '[]'::jsonb,
  status text not null default 'sent',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint stock_counts_status_check check (status in ('sent', 'accepted', 'recount'))
);
create index if not exists stock_counts_shop_idx on stock_counts(shop_id, created_at desc);

alter table stock_counts enable row level security;

drop policy if exists "members read counts" on stock_counts;
create policy "members read counts" on stock_counts
  for select using (is_shop_member(shop_id));

drop policy if exists "counters add counts" on stock_counts;
create policy "counters add counts" on stock_counts
  for insert with check (has_task(shop_id, 'stock.count') and counted_by = auth.uid() and status = 'sent');

-- No update or delete policy: a decision goes through the functions below.

/* ---- 4. accepting a count ---- */
create or replace function accept_stock_count(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c stock_counts%rowtype;
  l jsonb;
  k text;
  before numeric;
  after numeric;
  delta numeric;
  left_to_take numeric;
  lot record;
  log_id bigint;
  floor_id bigint;
  changed int := 0;
begin
  select * into c from stock_counts where id = p_id for update;
  if not found then raise exception 'That count is gone.'; end if;
  if not has_task(c.shop_id, 'stock.correct') then
    raise exception 'Correcting stock is for the owner or a manager.' using errcode = '42501';
  end if;
  if c.status = 'accepted' then return jsonb_build_object('ok', true, 'changed', 0, 'already', true); end if;

  for l in select * from jsonb_array_elements(c.lines)
  loop
    k := l ->> 'key';
    after := greatest(0, round(coalesce((l ->> 'counted')::numeric, 0), 6));
    if k is null then continue; end if;
    select qty into before from stock where shop_id = c.shop_id and key = k for update;
    before := coalesce(before, 0);
    delta := round(after - before, 6);
    if delta = 0 then continue; end if;

    insert into stock (shop_id, key, product_id, variant_idx, qty)
         values (c.shop_id, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), after)
    on conflict (shop_id, key) do update set qty = excluded.qty;

    -- consumeStockLots / addStockLot (index.html): the oldest lots go first.
    if delta < 0 then
      left_to_take := -delta;
      for lot in select id, qty from stock_lots where shop_id = c.shop_id and key = k order by id loop
        exit when left_to_take <= 0;
        if lot.qty <= left_to_take then
          left_to_take := left_to_take - lot.qty;
          delete from stock_lots where id = lot.id;
        else
          update stock_lots set qty = qty - left_to_take where id = lot.id;
          left_to_take := 0;
        end if;
      end loop;
    else
      insert into stock_lots (shop_id, key, qty, cost) values (c.shop_id, k, delta, null);
    end if;

    -- The same id counter the apps draw stock_log ids from (0034).
    select coalesce(max(id), 0) into floor_id from stock_log where shop_id = c.shop_id;
    insert into entity_id_counters (shop_id, kind, last_issued)
         values (c.shop_id, 'row:stock_log', floor_id + 1)
    on conflict (shop_id, kind) do update
            set last_issued = greatest(entity_id_counters.last_issued, floor_id) + 1
      returning last_issued into log_id;

    insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at)
         values (log_id, c.shop_id, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), l ->> 'name', 'count',
                 delta, after, 'Stock take' || coalesce(' · ' || c.aisle, '') || coalesce(' · counted by ' || c.counted_by_name, ''),
                 current_date, now());
    changed := changed + 1;
  end loop;

  update stock_counts set status = 'accepted', decided_by = auth.uid(), decided_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'changed', changed);
end;
$$;

revoke all on function accept_stock_count(uuid) from public, anon;
grant execute on function accept_stock_count(uuid) to authenticated;

create or replace function ask_recount(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare s uuid;
begin
  select shop_id into s from stock_counts where id = p_id;
  if s is null then raise exception 'That count is gone.'; end if;
  if not has_task(s, 'stock.correct') then
    raise exception 'Asking for a recount is for the owner or a manager.' using errcode = '42501';
  end if;
  update stock_counts set status = 'recount', decided_by = auth.uid(), decided_at = now()
   where id = p_id and status = 'sent';
end;
$$;

revoke all on function ask_recount(uuid) from public, anon;
grant execute on function ask_recount(uuid) to authenticated;

/* ---- 5. locked routes ---- */
create table if not exists place_routes (
  shop_id uuid not null references shops(id) on delete cascade,
  from_place text not null,
  to_place text not null,
  km numeric not null,
  mins numeric not null,
  -- [[lat, lng], ...] along the road, thinned to what a phone map needs.
  line jsonb,
  locked_by uuid default auth.uid(),
  locked_at timestamptz not null default now(),
  primary key (shop_id, from_place, to_place),
  constraint place_routes_km_check check (km >= 0),
  constraint place_routes_mins_check check (mins >= 0)
);

alter table place_routes enable row level security;

drop policy if exists "members read routes" on place_routes;
create policy "members read routes" on place_routes
  for select using (is_shop_member(shop_id));

-- Locked means locked: a route is added once and never edited from a
-- phone. The owner deletes one (SQL editor) to have it asked again.
drop policy if exists "route lockers add routes" on place_routes;
create policy "route lockers add routes" on place_routes
  for insert with check (has_task(shop_id, 'route.lock'));
