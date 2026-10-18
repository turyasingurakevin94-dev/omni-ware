-- The Buyer, as docs/decision-rights.md now has it (0125 is the Buyer's
-- reserved number). Nothing here waits for the owner.
--
-- 1. Two tasks the table grants the Buyer:
--      buy.restock   buy to refill the shelf when no order needs it; the
--                    Manager is told.
--      price.confirm confirm a supplier's price on their behalf, by phone,
--                    when they are slow or can't; it counts toward the
--                    day's share the owner sets (presets.priceReview).
--    Switching a line to another ITEM (another make or size) is part of
--    line.switch, granted in 0114; Sales is told.
--
-- 2. restock_buys: the lines the Buyer chose from "what to buy". They join
--    the buying list next to the orders' lines, ride a trip, and the
--    Store's yard count puts them on the shelf. A line the Manager holds
--    ("not yet") is the Manager's restock.hold, read from presets.buyHolds;
--    it is not written here.
--
-- 3. buyer_handoffs: what the Buyer passes to another role, waiting for
--    them. One row per hand-off, each with the role it is for:
--      paper_bill    a supplier's paper bill, photo in bill-photos (0100),
--                    for Accounts to record (bill.record)
--      sourcing_fix  a wrong name, unit, pack, price or supplier detail,
--                    with what it should be, for Sourcing (price.list,
--                    supplier.edit)
--      trip_cash     cash asked for a trip, for Accounts (trip.cash)
--      item_switch   a line switched to another item, for Sales to tell
--                    the client
--      yard_note     why the Buyer's count differs from the yard's, for
--                    the Manager (trip.difference)
--    The role it is for marks it done. The Buyer can withdraw their own.
--
-- 4. Two narrow writes to the price list, which 0083 keeps owner-only:
--      buyer_confirm_price  price.confirm: the supplier said so on the
--                           phone. Sets the price (if it changed), today's
--                           date, and who confirmed and how, and logs it
--                           in decision_log (0123) as Sourcing does.
--      trip_prices_to_list  "the Buyer's prices paid update the supplier
--                           price list automatically": on hand-in, each
--                           line's price paid becomes that supplier's
--                           price for the item. trip.collect, own trips.
--
-- Migrations are applied by hand. Safe to run twice.
--
-- ROLLBACK:
--   delete from role_tasks where role = 'buyer' and task in ('buy.restock', 'price.confirm');
--   drop function if exists buyer_confirm_price(uuid, bigint, numeric);
--   drop function if exists trip_prices_to_list(uuid, text);
--   drop table if exists buyer_handoffs;
--   drop table if exists restock_buys;
--   alter table prices drop column if exists confirmed_by, drop column if exists confirmed_via;

insert into role_tasks (role, task) values
  ('buyer', 'buy.restock'),
  ('buyer', 'price.confirm')
on conflict do nothing;

-- ---------------------------------------------------------------- 2
create table if not exists restock_buys (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id text not null,
  variant_idx integer,
  qty numeric not null check (qty > 0),
  unit text not null default '',
  supplier_id text not null,
  price numeric check (price is null or price >= 0),
  status text not null default 'planned' check (status in ('planned', 'on_trip', 'collected', 'cancelled')),
  trip_id text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists restock_buys_shop_idx on restock_buys(shop_id, status);
alter table restock_buys enable row level security;
drop policy if exists "members read restock buys" on restock_buys;
create policy "members read restock buys" on restock_buys for select
  using (is_shop_member(shop_id));
drop policy if exists "restock buyers write" on restock_buys;
create policy "restock buyers write" on restock_buys for insert
  with check (is_shop_admin(shop_id) or has_task(shop_id, 'buy.restock'));
drop policy if exists "restock buyers change" on restock_buys;
create policy "restock buyers change" on restock_buys for update
  using (is_shop_admin(shop_id) or has_task(shop_id, 'buy.restock') or has_task(shop_id, 'trip.collect'))
  with check (is_shop_admin(shop_id) or has_task(shop_id, 'buy.restock') or has_task(shop_id, 'trip.collect'));

-- ---------------------------------------------------------------- 3
create table if not exists buyer_handoffs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  kind text not null check (kind in ('paper_bill', 'sourcing_fix', 'trip_cash', 'item_switch', 'yard_note')),
  for_role text not null check (for_role in ('accounts', 'sourcing', 'sales', 'manager')),
  ref text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'done', 'withdrawn')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  done_by uuid,
  done_at timestamptz
);
create index if not exists buyer_handoffs_open_idx on buyer_handoffs(shop_id, for_role, status);
alter table buyer_handoffs enable row level security;
drop policy if exists "members read handoffs" on buyer_handoffs;
create policy "members read handoffs" on buyer_handoffs for select
  using (is_shop_member(shop_id));
drop policy if exists "the buyer passes it on" on buyer_handoffs;
create policy "the buyer passes it on" on buyer_handoffs for insert
  with check (created_by = auth.uid() and status = 'open' and (
    is_shop_admin(shop_id)
    or (kind = 'paper_bill' and has_task(shop_id, 'trip.collect'))
    or (kind = 'sourcing_fix' and (has_task(shop_id, 'supplier.confirm') or has_task(shop_id, 'trip.collect')))
    or (kind = 'trip_cash' and has_task(shop_id, 'trip.plan'))
    or (kind = 'item_switch' and has_task(shop_id, 'line.switch'))
    or (kind = 'yard_note' and has_task(shop_id, 'trip.collect'))));
drop policy if exists "the role it is for closes it" on buyer_handoffs;
create policy "the role it is for closes it" on buyer_handoffs for update
  using (is_shop_admin(shop_id) or created_by = auth.uid()
    or (kind = 'paper_bill' and has_task(shop_id, 'bill.record'))
    or (kind = 'trip_cash' and has_task(shop_id, 'trip.cash'))
    or (kind = 'sourcing_fix' and (has_task(shop_id, 'price.list') or has_task(shop_id, 'supplier.edit')))
    or (kind = 'item_switch' and has_task(shop_id, 'quote.make'))
    or (kind = 'yard_note' and has_task(shop_id, 'trip.difference')))
  with check (status in ('open', 'done', 'withdrawn'));

-- What a hand-off says never changes after it is passed: only its status,
-- who closed it and when. The Buyer may only withdraw their own.
create or replace function buyer_handoffs_guard() returns trigger
language plpgsql as $$
begin
  if (new.kind, new.for_role, new.ref, new.payload, new.created_by, new.created_at, new.shop_id)
     is distinct from (old.kind, old.for_role, old.ref, old.payload, old.created_by, old.created_at, old.shop_id) then
    raise exception 'A hand-off says what it said; only its status changes.' using errcode = '42501';
  end if;
  if new.status = 'withdrawn' and old.created_by is distinct from auth.uid() and not is_shop_admin(old.shop_id) then
    raise exception 'Only whoever passed it on can withdraw it.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    new.done_by := auth.uid();
    new.done_at := now();
  end if;
  return new;
end $$;
drop trigger if exists buyer_handoffs_guard on buyer_handoffs;
create trigger buyer_handoffs_guard before update on buyer_handoffs
  for each row execute function buyer_handoffs_guard();

-- ---------------------------------------------------------------- 4
alter table prices add column if not exists confirmed_by uuid;
alter table prices add column if not exists confirmed_via text;

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
         confirmed_by = auth.uid(),
         confirmed_via = 'phone'
   where id = p_price_id and shop_id = p_shop_id;
  -- One line in the owner's log (0123), the shape Sourcing's app writes
  -- for price.confirm, so a phone confirm counts in today's share.
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
revoke all on function buyer_confirm_price(uuid, bigint, numeric) from public;
grant execute on function buyer_confirm_price(uuid, bigint, numeric) to authenticated;

-- Each line of a handed-in trip: what was paid becomes that supplier's
-- price for the item, dated today. Only lines with a price paid, only the
-- trip's own supplier, only rows already on the list (a new supplier or
-- item is Sourcing's to add).
create or replace function trip_prices_to_list(p_shop_id uuid, p_trip_id text)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  t collection_trips%rowtype;
  l jsonb;
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
    update prices
       set wholesale = each_price, date = current_date, confirmed_by = auth.uid(), confirmed_via = 'trip'
     where shop_id = p_shop_id
       and supplier_id = t.supplier_id
       and product_id = l->>'productId'
       and coalesce(variant_idx::text, '') = coalesce(l->>'variantIdx', '');
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function trip_prices_to_list(uuid, text) from public;
grant execute on function trip_prices_to_list(uuid, text) to authenticated;
