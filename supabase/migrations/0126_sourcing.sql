-- Sourcing: the person who finds new items and new suppliers, negotiates,
-- and keeps the supplier price list right (sourcing.html).
--
-- docs/decision-rights.md section 2 ("Sourcing") hands this login five
-- jobs, and sourcing.html is built around exactly these:
--
--   sourcing.lead   work a request through asked, looking, found, priced,
--                   listed: sourcing_leads, and the follow-ups that keep
--                   the people who asked on the list to be told.
--   product.edit    add a new item to what we sell, or edit a product's
--                   details -- never its markup. A product Sourcing makes
--                   sells at the shop's default markup until the Manager
--                   sets one (markup.set, the Manager's). Its "goes with"
--                   pairings (product_links) and the pin that puts a new
--                   item on every agent's Feed (agent_feed_pins) go with it.
--   supplier.edit   add or edit suppliers.
--   price.list      the supplier price list (prices) and rival prices
--                   (rival_prices).
--   price.confirm   today's share of prices, oldest first: still right, or
--                   the new figure. The owner sets how many a day
--                   (presets.priceReview). The Buyer confirms by phone for a
--                   supplier who is slow or can't; the Buyer's build grants
--                   it to the Buyer.
--
-- Nothing here waits for the owner. Every decision the app makes for the
-- owner goes in the owner's log (decision_log, 0123), never a queue.
--
-- The 'sourcing' role itself is added to shop_members by the shared
-- foundation (0119), built once and separately. Until it lands, these rows
-- are granted to a role nobody can hold yet, and nothing below lets any
-- existing login do more than it could.
--
-- A LINE DROPPED AT CHECKING becomes a Sourcing request by itself (section
-- 5, "Sourcing and prices"): the trigger in section 7 turns every line the
-- Buyer drops as 'Nobody has it' or 'Too dear' into a request with the
-- customer who asked, the order and the line, and section 8 does the same
-- for every line already dropped. 'Client said no' is the client's own
-- answer and is not a request.
--
-- Agents' stock requests (agent_requests, kind 'stock') land there too:
-- section 6 lets Sourcing read them and mark one taken.
--
-- The walls 0083 and 0087 drew ("owner writes only", "owner updates only")
-- are restrictive, and restrictive policies all have to pass. So each wall
-- below is re-drawn ONCE per table, naming every task that may write it --
-- including tasks other builds grant (sourcing.ask) -- so that
-- a later build adds rows to role_tasks rather than a second wall that
-- would block this one.
--
-- Applied by hand like every migration here. Every policy, trigger and
-- function is dropped or replaced before it is created; a table this
-- database never got is skipped and named. Safe to run twice.
--
-- MAKE SOMEBODY SOURCING (once 0119 allows the role):
--   update shop_members set role = 'sourcing'
--   where shop_id = 'YOUR-SHOP-ID' and user_id = 'THEIR-USER-ID';
--
-- CHECK AFTERWARDS:
--   select task from role_tasks where role = 'sourcing' order by task;
--   -- 5 rows
--
-- ROLLBACK:
--   delete from role_tasks where role = 'sourcing';
--   drop trigger if exists saved_quotes_dropped_to_sourcing on saved_quotes;
--   drop trigger if exists products_sourcing_guard on products;
--   (every wall below still lets the owner do everything, and without the
--   tasks a Sourcing login can write nothing)

-- ---------------------------------------------------------------------
-- 1. The tasks.
insert into role_tasks (role, task) values
  ('sourcing', 'sourcing.lead'),
  ('sourcing', 'product.edit'),
  ('sourcing', 'supplier.edit'),
  ('sourcing', 'price.list'),
  ('sourcing', 'price.confirm')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. The walls, re-drawn per table with the tasks that may write it.
do $$
declare
  t text; tasks text[]; cond text;
begin
  foreach t in array array['sourcing_leads', 'follow_ups', 'suppliers', 'products', 'prices',
                           'rival_prices', 'product_links'] loop
    tasks := case t
      when 'sourcing_leads' then array['sourcing.lead', 'sourcing.ask']
      when 'follow_ups'     then array['sourcing.lead', 'sourcing.ask']
      when 'suppliers'      then array['supplier.edit']
      -- Not markup.set: the Manager changes markups only through
      -- set_product_markup() (0122), never by writing products directly.
      when 'products'       then array['product.edit']
      when 'prices'         then array['price.list', 'price.confirm']
      when 'rival_prices'   then array['price.list']
      when 'product_links'  then array['product.edit']
    end;
    if to_regclass('public.' || t) is null then
      raise notice 'skipped %: not on this database', t;
      continue;
    end if;
    cond := 'is_shop_admin(shop_id)' || (
      select string_agg(format(' or has_task(shop_id, %L)', x), '') from unnest(tasks) x);
    execute format('drop policy if exists "owner writes only" on %I', t);
    execute format('drop policy if exists "owner updates only" on %I', t);
    execute format('drop policy if exists "owner or the task writes" on %I', t);
    execute format('drop policy if exists "owner or the task updates" on %I', t);
    execute format(
      'create policy "owner or the task writes" on %I as restrictive for insert with check (%s)', t, cond);
    execute format(
      'create policy "owner or the task updates" on %I as restrictive for update using (%s) with check (%s)', t, cond, cond);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. A product's markup is the Manager's (markup.set). A login that may
--    edit products but not set markups -- Sourcing -- makes a product at
--    the shop's default (no markup of its own) and never changes one. The
--    owner and admins are never refused here.
create or replace function products_sourcing_guard() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mk text[] := array['wholesale_markup_type', 'wholesale_markup_value', 'retail_markup_type',
    'retail_markup_value', 'stock_wholesale_markup_type', 'stock_wholesale_markup_value',
    'stock_retail_markup_type', 'stock_retail_markup_value',
    'agent_discount_wholesale_pct', 'agent_discount_retail_pct'];
  vk text[] := array['wholesaleMarkupValue', 'retailMarkupValue', 'stockWholesaleMarkupValue',
    'stockRetailMarkupValue'];
  c text; o jsonb; n jsonb; ov jsonb; nv jsonb; i integer;
begin
  -- The server itself (no signed-in user), the owner, admins and the
  -- Manager are never refused here.
  if auth.uid() is null or is_shop_admin(new.shop_id) or has_task(new.shop_id, 'markup.set') then
    return new;
  end if;
  n := to_jsonb(new);
  if tg_op = 'INSERT' then
    -- An upsert of a product already on file is an edit of it: the
    -- comparison is with the row it will update.
    select to_jsonb(p) into o from products p where p.shop_id = new.shop_id and p.id = new.id;
    if o is null then
      if coalesce((n->>'wholesale_markup_value')::numeric, 0) <> 0
         or coalesce((n->>'retail_markup_value')::numeric, 0) <> 0
         or coalesce((n->>'stock_wholesale_markup_value')::numeric, 0) <> 0
         or coalesce((n->>'stock_retail_markup_value')::numeric, 0) <> 0
         or n->>'agent_discount_wholesale_pct' is not null
         or n->>'agent_discount_retail_pct' is not null
         or exists (select 1 from jsonb_array_elements(coalesce(n->'variants', '[]'::jsonb)) v, unnest(vk) k
                    where coalesce((v->>k)::numeric, 0) <> 0) then
        raise exception 'A new product sells at the shop''s default markup. The Manager sets its own.';
      end if;
      return new;
    end if;
  else
    o := to_jsonb(old);
  end if;
  foreach c in array mk loop
    -- A type with no value behind it changes nothing anybody pays (the
    -- console writes the type on every save); with one, it does.
    if c like '%_type' then
      if (o->>c) is distinct from (n->>c)
         and coalesce((n->>replace(c, '_type', '_value'))::numeric, 0) <> 0 then
        raise exception 'Markups are the Manager''s to change.';
      end if;
      continue;
    end if;
    if coalesce((o->>c)::numeric, 0) is distinct from coalesce((n->>c)::numeric, 0)
       and not (c like 'agent_%' and o->>c is null and n->>c is null) then
      raise exception 'Markups are the Manager''s to change.';
    end if;
  end loop;
  -- A variant's own markup rides inside variants: the same rule for each,
  -- and a new variant comes in at the default like a new product.
  i := 0;
  for nv in select * from jsonb_array_elements(coalesce(n->'variants', '[]'::jsonb)) loop
    ov := coalesce(o->'variants', '[]'::jsonb)->i;
    foreach c in array vk loop
      if coalesce((nv->>c)::numeric, 0) <> coalesce((ov->>c)::numeric, 0) then
        raise exception 'Markups are the Manager''s to change.';
      end if;
    end loop;
    i := i + 1;
  end loop;
  return new;
end $$;

do $$
begin
  if to_regclass('public.products') is null then
    raise notice 'skipped products_sourcing_guard: products not on this database';
  else
    drop trigger if exists products_sourcing_guard on products;
    create trigger products_sourcing_guard before insert or update on products
      for each row execute function products_sourcing_guard();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4. A new item on every agent's Feed: the pin 0102 kept for admins, now
--    also made by whoever lists the item. Agent push (0103, 0110) already
--    sends a nudge for a new pin.
do $$
begin
  if to_regclass('public.agent_feed_pins') is null then
    raise notice 'skipped agent_feed_pins: not on this database';
  else
    drop policy if exists "sourcing pins new items" on agent_feed_pins;
    create policy "sourcing pins new items" on agent_feed_pins
      for insert with check (has_task(shop_id, 'product.edit'));
    drop policy if exists "sourcing reads feed pins" on agent_feed_pins;
    create policy "sourcing reads feed pins" on agent_feed_pins
      for select using (has_task(shop_id, 'product.edit'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. The owner's log (decision_log, 0123): Sourcing writes one line per
--    decision through the task it used, and reads its own lines already.
--    Today's share is shared with the Buyer, who confirms by phone for a
--    supplier who is slow, so whoever holds price.confirm also reads the
--    price.confirm lines: that is how the list says who confirmed each one.
do $$
begin
  if to_regclass('public.decision_log') is null then
    raise notice 'skipped decision_log: not on this database (0123 makes it)';
  else
    drop policy if exists "confirmers read the confirmations" on decision_log;
    create policy "confirmers read the confirmations" on decision_log
      for select using (task = 'price.confirm' and has_task(shop_id, 'price.confirm'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Agents' stock requests: Sourcing reads them, and marks one taken
--    (done) once it is a request on the board, or declined.
do $$
begin
  if to_regclass('public.agent_requests') is null then
    raise notice 'skipped agent_requests: not on this database';
  else
    drop policy if exists "sourcing reads stock requests" on agent_requests;
    create policy "sourcing reads stock requests" on agent_requests
      for select using (kind = 'stock' and has_task(shop_id, 'sourcing.lead'));
    drop policy if exists "sourcing takes stock requests" on agent_requests;
    create policy "sourcing takes stock requests" on agent_requests
      for update using (kind = 'stock' and has_task(shop_id, 'sourcing.lead'))
      with check (kind = 'stock' and status in ('open', 'done', 'declined') and has_task(shop_id, 'sourcing.lead'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. A line dropped at Checking becomes a request by itself.
--
--    One request per dropped line, keyed by the order, the line's place on
--    it and the product, so running it twice -- or the order being saved
--    again -- adds nothing. The request is the demand ledger's own shape
--    (0072 requests) with the line riding along: the product we already
--    sell, the quantity, the price it was quoted at and why it was dropped.
--    sourcing.html joins it to an open hunt for the same item, or keeps it
--    apart; a request it has joined elsewhere stays dropped with the lead
--    it went to, so it is never made twice.
create or replace function sourcing_take_dropped_lines(p_shop_id uuid, p_quote_id bigint,
  p_client_name text, p_client_phone text, p_payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb; lid text; n integer := 0; nm text;
begin
  if to_regclass('public.sourcing_leads') is null then return 0; end if;
  for d in select * from jsonb_array_elements(coalesce(p_payload->'droppedLines', '[]'::jsonb)) loop
    if coalesce(d->>'reason', '') not in ('Nobody has it', 'Too dear') then continue; end if;
    lid := 'DRP-' || p_quote_id || '-' || coalesce(d->>'at', 'x') || '-' || coalesce(d->>'productId', '');
    nm := coalesce(nullif(trim(d->>'productName'), ''), 'An item dropped at Checking');
    insert into sourcing_leads (id, shop_id, name, status, created_at, stage_entered_at, requests)
    values (lid, p_shop_id, nm, 'asked',
      coalesce(to_timestamp((d->>'droppedAt')::numeric / 1000), now()),
      coalesce((d->>'droppedAt')::bigint, (extract(epoch from now()) * 1000)::bigint),
      jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'at', coalesce(to_timestamp((d->>'droppedAt')::numeric / 1000), now()),
        'source', 'dropped',
        'customerId', p_payload->>'customerId',
        'customerName', coalesce(p_client_name, ''),
        'phone', coalesce(p_client_phone, ''),
        'qty', d->'qty',
        'orderId', p_quote_id,
        'productId', d->>'productId',
        'variantIdx', d->'variantIdx',
        'unit', d->>'unit',
        'sellPrice', d->'sellPrice',
        'reason', d->>'reason',
        'droppedBy', d->>'by',
        'note', d->>'reason'))))
    on conflict (shop_id, id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function sourcing_take_dropped_lines(uuid, bigint, text, text, jsonb) from public;

create or replace function saved_quotes_dropped_to_sourcing() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(jsonb_array_length(new.payload->'droppedLines'), 0) = 0 then return new; end if;
  if tg_op = 'UPDATE' and (old.payload->'droppedLines') is not distinct from (new.payload->'droppedLines') then
    return new;
  end if;
  perform sourcing_take_dropped_lines(new.shop_id, new.id::bigint, new.client_name, new.client_phone, new.payload);
  return new;
end $$;

do $$
begin
  if to_regclass('public.saved_quotes') is null or to_regclass('public.sourcing_leads') is null then
    raise notice 'skipped saved_quotes_dropped_to_sourcing: saved_quotes or sourcing_leads not on this database';
  else
    drop trigger if exists saved_quotes_dropped_to_sourcing on saved_quotes;
    create trigger saved_quotes_dropped_to_sourcing after insert or update on saved_quotes
      for each row execute function saved_quotes_dropped_to_sourcing();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. Every line already dropped, once. Live orders only: a voided order's
--    dropped lines were never anybody's request.
do $$
declare
  q record; n integer := 0;
begin
  if to_regclass('public.saved_quotes') is null or to_regclass('public.sourcing_leads') is null then
    return;
  end if;
  for q in select shop_id, id, client_name, client_phone, payload from saved_quotes
           where coalesce(voided, false) = false
             and coalesce(jsonb_array_length(payload->'droppedLines'), 0) > 0 loop
    n := n + sourcing_take_dropped_lines(q.shop_id, q.id::bigint, q.client_name, q.client_phone, q.payload);
  end loop;
  raise notice 'dropped lines made into requests: %', n;
end $$;
