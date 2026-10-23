-- 0159 · Store, fourth: no money reaches a Store phone (the browser test of
-- 23 Oct 2026: the Store app said "No prices, costs, payments or pay on this
-- phone" while it downloaded and kept ~1,900 price, amount and payment fields,
-- because every shop table let any member read it).
--
-- docs/decision-rights.md: the yard handles goods; money is the Manager's,
-- Accounts' and the Buyer's. So the database, not the screen, keeps it apart.
--
--   1. ow_yard_only(shop): the caller's login in this shop is the Store role
--      (and nothing else). The legacy worker login ('staff') is not touched:
--      worker.html still reads orders directly.
--   2. "The yard reads no books": a restrictive SELECT policy on every shop
--      table except the few the yard works in directly (stock, counts,
--      reports, its asks, places, roads, its push sign-up, the roster, the
--      agents list). Deny by default: a new table is closed to the yard until
--      someone opens it here.
--   3. store_snapshot(shop): what the Store app needs, in one call, with every
--      money field taken out (ow_strip_money): the live orders (not drafts;
--      delivered ones for 35 days), trips, products and their units,
--      customers' names and places, the team, suppliers, the shop's settings,
--      the last 35 days of stock moves (no cost), return asks, and which
--      packed orders wait on money (no amounts).
--   4. The Store's writes, now that it cannot read those rows itself:
--      store_order (one order, stripped), store_patch_order (only the
--      Store's own fields; a line's pick fields merged into the line, never
--      the whole line), store_patch_trip (a line counted onto the truck, a
--      round handed in), store_return_ask (a return, priced here from the
--      order -- the phone sends no prices).
--   5. stock_counts.missing: what a partial count could not find. The count's
--      lines hold only what was counted, so accepting it never reads a
--      missing item as nought.
--   6. A new item recorded at check-in (store_asks kind 'extra' with
--      payload.newItem) also pushes Sourcing (product.edit), who adds items.
--
-- Run AFTER the Store app that uses store_snapshot is live (it falls back to
-- direct reads when the function is missing, so the app goes first; this file
-- second). Applied by hand, after 0157. Safe to run twice.
--
-- CHECK AFTERWARDS (as a Store login, in the app's browser console):
--   await sb.from('saved_quotes').select('id').limit(1)  -- returns no rows
--   await sb.rpc('store_snapshot', { p_shop: S.shopId })  -- returns the yard's data
--
-- ROLLBACK:
--   do $$ declare t text; begin for t in select tablename from pg_policies where policyname = 'the yard reads no books' loop
--     execute format('drop policy "the yard reads no books" on %I', t); end loop; end $$;
--   drop function if exists store_snapshot(uuid); drop function if exists store_order(uuid, bigint);
--   drop function if exists store_patch_order(uuid, bigint, jsonb, text, jsonb);
--   drop function if exists store_patch_trip(uuid, text, jsonb, text);
--   drop function if exists store_return_ask(uuid, bigint, jsonb, text, text);
-- ---------------------------------------------------------------------

-- 1. Who is the yard.
create or replace function ow_yard_only(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.role = 'store');
$$;
revoke all on function ow_yard_only(uuid) from public, anon;
grant execute on function ow_yard_only(uuid) to authenticated;

-- A timestamp from a payload field written as ISO text or epoch ms, or null.
create or replace function ow_ts(v text) returns timestamptz
language plpgsql immutable as $$
begin
  if v is null or btrim(v) = '' then return null; end if;
  if v ~ '^\d{10,}$' then return to_timestamp(v::numeric / 1000); end if;
  return v::timestamptz;
exception when others then return null;
end $$;

-- Every money key out of a JSON value, at any depth. A key is money when its
-- name says so; the two status words the yard needs stay.
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
      if k ~* '(price|cost|amount|paid|payment|total|owed|debt|cash|balance|margin|markup|discount|profit|commission|wholesale|retail|tiers?$|^pay$|^vat$|^tax|fee$|deposit|creditlimit|credit_limit|sell)' then continue; end if;
      out := out || jsonb_build_object(k, ow_strip_money(v));
    end loop;
    return out;
  elsif jsonb_typeof(j) = 'array' then
    return coalesce((select jsonb_agg(ow_strip_money(e)) from jsonb_array_elements(j) e), '[]'::jsonb);
  end if;
  return j;
end $$;

-- 2. The yard reads no books.
do $$
declare
  t text;
  open_to_yard text[] := array['stock', 'stock_counts', 'stock_reports', 'store_asks', 'places', 'place_routes',
                               'road_names', 'push_subscriptions', 'shop_members', 'agents'];
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and exists (select 1 from information_schema.columns x where x.table_schema = 'public' and x.table_name = c.relname and x.column_name = 'shop_id')
  loop
    if t = any(open_to_yard) then continue; end if;
    execute format('drop policy if exists "the yard reads no books" on %I', t);
    execute format('create policy "the yard reads no books" on %I as restrictive for select to authenticated using (not ow_yard_only(shop_id))', t);
  end loop;
end $$;

-- 5. What a partial count could not find.
alter table stock_counts add column if not exists missing jsonb not null default '[]'::jsonb;

-- 3. The yard's day, without money.
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
        'invoiced', q.invoiced, 'invoiced_ts', q.invoiced_ts, 'voided', q.voided, 'payload', ow_strip_money(q.payload)) order by q.id)
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

-- 4a. One order, stripped.
create or replace function store_order(p_shop uuid, p_id bigint)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q saved_quotes%rowtype;
begin
  if not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  select * into q from saved_quotes where shop_id = p_shop and id = p_id;
  if not found then return null; end if;
  return jsonb_build_object('id', q.id, 'client_name', q.client_name, 'client_phone', q.client_phone, 'date', q.date, 'status', q.status,
    'invoiced', q.invoiced, 'invoiced_ts', q.invoiced_ts, 'voided', q.voided, 'payload', ow_strip_money(q.payload));
end $$;
revoke all on function store_order(uuid, bigint) from public, anon;
grant execute on function store_order(uuid, bigint) to authenticated;

-- 4b. The Store's own fields on an order, and nothing else.
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

-- 4c. Riding a round: a line counted onto the truck, or the round handed in.
create or replace function store_patch_trip(p_shop uuid, p_id text, p_got jsonb, p_status text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t collection_trips%rowtype;
  me text;
  v_lines jsonb;
  i int;
begin
  select s.id into me from staff s where s.shop_id = p_shop and s.user_id = auth.uid() limit 1;
  select * into t from collection_trips where shop_id = p_shop and id = p_id for update;
  if not found then raise exception 'That trip is gone.'; end if;
  if t.voided then raise exception 'That trip was called off.'; end if;
  if me is null or t.assigned_worker_id is distinct from me then raise exception 'That trip is not yours any more.' using errcode = '42501'; end if;
  if t.status not in ('assigned', 'collecting') then return null; end if;
  v_lines := coalesce(t.lines, '[]'::jsonb);
  -- p_got: { "<line index>": <count or null> }
  if jsonb_typeof(p_got) = 'object' then
    for i in select k::int from jsonb_object_keys(p_got) k where k ~ '^\d+$' loop
      if i >= jsonb_array_length(v_lines) then continue; end if;
      v_lines := jsonb_set(v_lines, array[i::text], (v_lines -> i) || jsonb_build_object('gotQty', p_got -> i::text));
    end loop;
  end if;
  if p_status = 'collected' then
    if exists (select 1 from jsonb_array_elements(v_lines) e where jsonb_typeof(e -> 'gotQty') is distinct from 'number') then
      raise exception 'Load every line first.';
    end if;
    update collection_trips set lines = v_lines, status = 'collected', collected_at = now(), accepted_at = coalesce(accepted_at, now()) where shop_id = p_shop and id = p_id;
  else
    update collection_trips set lines = v_lines, status = 'collecting', accepted_at = coalesce(accepted_at, now()) where shop_id = p_shop and id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function store_patch_trip(uuid, text, jsonb, text) from public, anon;
grant execute on function store_patch_trip(uuid, text, jsonb, text) to authenticated;

-- 4d. A return, priced here from the order's own lines.
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
begin
  if not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  select * into q from saved_quotes where shop_id = p_shop and id = p_order;
  if not found then raise exception 'That order is gone.'; end if;
  for l in select e from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) e loop
    if not ((l ->> 'idx') ~ '^\d+$') or coalesce((l ->> 'qty')::numeric, 0) <= 0 then continue; end if;
    it := q.payload -> 'items' -> ((l ->> 'idx')::int);
    if it is null then continue; end if;
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

-- 6. A new item at check-in also tells Sourcing (0157's push, with that one addition).
create or replace function store_asks_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  who text := coalesce(nullif(split_part(btrim(coalesce(new.asked_by_name, '')), ' ', 1), ''), 'The Store');
  what text := btrim(coalesce(p ->> 'qty', '') || ' ' || coalesce(p ->> 'unit', '') || ' ' || coalesce(p ->> 'name', 'goods'));
  ref jsonb := jsonb_build_object('table', 'store_asks', 'id', new.id);
  by_name text;
begin
  begin
    if tg_op = 'INSERT' then
      if new.kind = 'restock' then
        perform ow_push(new.shop_id, 'store.restock', 'More wanted on the shelf',
          who || ' asks for ' || what
            || case when jsonb_typeof(p -> 'shortFor') = 'array' and jsonb_array_length(p -> 'shortFor') > 0
                    then ' · ' || jsonb_array_length(p -> 'shortFor') || ' order' || case when jsonb_array_length(p -> 'shortFor') = 1 then '' else 's' end || ' short' else '' end
            || case when coalesce(p ->> 'when', '') = 'today' then ' · needed today' else '' end,
          null, 'buy.restock', null, ref, 'storeask:' || new.id);
      elsif new.kind = 'extra' then
        perform ow_push(new.shop_id, 'store.extra', 'Not on the list · keep it?',
          who || ' found ' || what || ' on the truck that was not on the list. Keep it or send it back?',
          null, 'trip.difference', null, ref, 'storeask:' || new.id);
        if coalesce((p ->> 'newItem')::boolean, false) then
          perform ow_push(new.shop_id, 'store.new_item', 'A new item at the yard',
            who || ' checked in ' || what || ' · not on file yet. Add it to what we sell?',
            null, 'product.edit', null, ref, 'storeasknew:' || new.id);
        end if;
      elsif new.kind = 'handover' then
        perform ow_push(new.shop_id, 'store.handover', who || ' handed you the yard',
          case coalesce(jsonb_array_length(case when jsonb_typeof(p -> 'orders') = 'array' then p -> 'orders' end), 0)
            when 0 then 'Nothing half done.' when 1 then '1 half-done job moves to you.'
            else jsonb_array_length(p -> 'orders') || ' half-done jobs move to you.' end || ' Tap "I''ve got it".',
          ow_uuid(p ->> 'toUserId'), null, null, ref, 'storeask:' || new.id);
      elsif new.kind = 'close' then
        perform ow_push(new.shop_id, 'store.closed', 'The yard is closed',
          who || ' closed the yard · ' || coalesce(p ->> 'out', '0') || ' out · ' || coalesce(p ->> 'carries', '0') || ' carried over.',
          null, null, 'manager', ref, 'storeask:' || new.id);
      end if;
    elsif new.status is distinct from old.status and new.status in ('accepted', 'declined') and new.asked_by is not null then
      select name into by_name from staff where shop_id = new.shop_id and user_id = new.decided_by limit 1;
      by_name := coalesce(nullif(split_part(btrim(coalesce(by_name, '')), ' ', 1), ''), case new.kind when 'restock' then 'The Buyer' when 'extra' then 'The Manager' else 'Your colleague' end);
      perform ow_push(new.shop_id, 'store.ask.decided',
        case new.kind when 'handover' then by_name || ' has the yard'
                      when 'restock' then case when new.status = 'accepted' then 'More is coming' else 'Not buying more yet' end
                      else case when new.status = 'accepted' then 'Keep it' else 'It goes back' end end,
        case when new.kind = 'handover' then by_name || case new.status when 'accepted' then ' tapped "I''ve got it".' else ' cannot take the yard.' end
             else by_name || case new.status when 'accepted' then ' said yes' else ' said no' end || ' · ' || what end
          || coalesce(' · ' || new.note, ''),
        new.asked_by, null, null, ref, 'storeaskdone:' || new.id || ':' || new.status);
    end if;
  exception when others then
    raise notice 'push (store ask): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
