-- 0164 Store, ninth (audit round 5: roles and privacy, 23 Oct 2026; docs/audit/ROUND-5.md).
--
--   PRIV-02 store_snapshot (0160) calls ow_money_hold, which 0156 makes. The live
--     database did not have it, so a Store login got "function does not exist"
--     and an empty yard. This file brings back 0156's money hold, its list for the
--     Store and the gate that keeps an unpaid cash order from leaving (the same
--     functions as 0156, safe to run again).
--   PRIV-01 The snapshot gives no money to any login of the Store app:
--     - stock_log and trip notes lose the money in them (ow_strip_note:
--       "counted in at 10,750 UGX per Kg" -> "counted in");
--     - the money hold's names, which carry no figure, are renamed on the way
--       out so the phone holds no money words at all: creditAsk -> letGoAsk,
--       creditCheck -> letGo, creditNotes -> takenBack, agentPaymentStatus ->
--       agentSettled (true/false), an agent's payment_term -> terms
--       ("before" / "on_delivery"). The books keep their own names;
--       store_patch_order takes letGoAsk and writes creditAsk;
--     - the shop's settings are an allow-list (categories, places, bays);
--     - what the app read directly before (agents, counts, reports, its asks,
--       the Manager's, Buyer's and Sourcing's logins) now comes in the snapshot.
--   PRIV-04 Every member has a name: shop_members.display_name (filled from the
--     linked staff name, or the login's own name), ow_member_name() for the
--     names the database writes (counted by, asked by), set_my_name() for a
--     person to change their own, and the snapshot's "me" and "members".
--   PRIV-05 A Store login writes only through its functions: a restrictive
--     INSERT/UPDATE/DELETE policy on every table it cannot read (it could insert
--     an order before), and it reads only its own shop_members row.
--
-- Run after 0161, 0162 and 0163 (and 0119, which makes ow_order_total). Safe to run twice.
--
-- CHECK AFTERWARDS (as a Store login, in the app's browser console):
--   JSON.stringify(await sb.rpc('store_snapshot', { p_shop: S.shopId })).match(/price|cost|amount|paid|payment|credit|UGX/i)  -- null
--   await sb.from('saved_quotes').insert({ shop_id: S.shopId, status: 'draft', payload: {} })  -- refused
--
-- ROLLBACK: run 0160, 0161 and 0162 again (they redefine the snapshot and the
-- Store's functions as they were); then
--   do $$ declare t text; begin for t in select tablename from pg_policies where policyname like 'the yard writes through its functions%' loop
--     execute format('drop policy %I on %I', (select policyname from pg_policies p where p.tablename = t and p.policyname like 'the yard writes%' limit 1), t); end loop; end $$;
--   drop policy if exists "the yard sees only itself" on shop_members;
-- ---------------------------------------------------------------------

do $$ begin
  if to_regprocedure('ow_order_total(uuid, jsonb, boolean)') is null then
    raise exception '0164 needs ow_order_total, from 0119. Run 0119 first.';
  end if;
end $$;

/* ---- PRIV-02: 0156's money hold, again ---- */
-- 1. Why an order waits on money, or null.
create or replace function ow_money_hold(p_shop_id uuid, p_payload jsonb, p_amount_paid numeric)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p jsonb := coalesce(p_payload, '{}'::jsonb);
  c customers;
  owed numeric;
  dec text := p -> 'creditCheck' ->> 'decision';
begin
  if coalesce(p ->> 'originAgentId', '') <> '' then return null; end if;
  if dec = 'release' then return null; end if;
  if coalesce(p ->> 'customerId', '') <> '' then
    select * into c from customers where shop_id = p_shop_id and id = p ->> 'customerId';
    if found and coalesce(c.credit_limit, 0) > 0 then return null; end if;
  end if;
  owed := greatest(0, round(ow_order_total(p_shop_id, p, true)) - coalesce(p_amount_paid, 0));
  if owed <= 0 then return null; end if;
  return jsonb_build_object('owed', owed, 'cash', true, 'decision', dec);
end $$;
revoke all on function ow_money_hold(uuid, jsonb, numeric) from public, anon, authenticated;

-- 2. The packed orders that wait on money, for the Store.
create or replace function store_money_holds(p_shop uuid)
returns table (id bigint, owed numeric, decision text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_shop_admin(p_shop) or has_task(p_shop, 'order.load') or has_task(p_shop, 'order.pick') or has_task(p_shop, 'credit.release')
          or exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.role = 'staff')) then
    raise exception 'Seeing what waits on money is for the Store, the Manager or the owner.' using errcode = '42501';
  end if;
  return query
    select q.id, (h ->> 'owed')::numeric, h ->> 'decision'
      from saved_quotes q
      cross join lateral (select ow_money_hold(q.shop_id, q.payload, q.amount_paid) as h) x
     where q.shop_id = p_shop and q.status = 'preparing' and not coalesce(q.voided, false) and not coalesce(q.invoiced, false)
       and x.h is not null;
end $$;
revoke all on function store_money_holds(uuid) from public, anon;
grant execute on function store_money_holds(uuid) to authenticated;

-- 3. A Store or worker login cannot send it out of Packing.
create or replace function saved_quotes_ow_money_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  h jsonb;
begin
  if not (old.status = 'preparing' and new.status in ('pending_delivery', 'completed')) then return new; end if;
  if coalesce(new.voided, false) or coalesce(new.invoiced, false) then return new; end if;
  select m.role into v_role from shop_members m where m.shop_id = new.shop_id and m.user_id = auth.uid() limit 1;
  if v_role is null or v_role not in ('store', 'staff') or has_task(new.shop_id, 'credit.release') then return new; end if;
  begin
    h := ow_money_hold(new.shop_id, new.payload, new.amount_paid);
  exception when others then
    raise notice 'money gate (order %): % (%)', new.id, sqlerrm, sqlstate;
    return new;
  end;
  if h is not null then
    raise exception 'Not paid · cash customer. The Manager decides whether it goes on credit.' using errcode = '42501', hint = 'OWCSH';
  end if;
  return new;
end $$;
drop trigger if exists saved_quotes_ow_money_gate on saved_quotes;
create trigger saved_quotes_ow_money_gate before update on saved_quotes
  for each row execute function saved_quotes_ow_money_gate();

/* ---- PRIV-01: money out of a note ---- */
create or replace function ow_strip_note(t text) returns text
language sql immutable as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(t, ''),
    '\s*(@|\mat\M)?\s*(UGX|USh|Ushs?|Shs?)\.?\s*[0-9][0-9,.]*(\s*(per|/)\s*[[:alpha:]]+)?', '', 'gi'),
    '\s*(@|\mat\M)?\s*[0-9][0-9,.]*\s*(UGX|USh|Ushs?|Shs?|/=)(\s*(per|/)\s*[[:alpha:]]+)?', '', 'gi'),
    '\m(cost|price|paid|amount|payment|credit)\M[^·;,]*', '', 'gi'),
    '\s*[·;,]\s*([·;,]\s*)+', ' · ', 'g'),
    '^[\s·;,]+|[\s·;,]+$', '', 'g')), '');
$$;

-- A row the yard may see: money keys out, and the money out of its note.
create or replace function ow_store_row(j jsonb) returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(ow_strip_money(j) -> 'note') = 'string'
              then ow_strip_money(j) || jsonb_build_object('note', ow_strip_note(ow_strip_money(j) ->> 'note'))
              else ow_strip_money(j) end;
$$;

/* ---- PRIV-04: a name for every member ---- */
alter table shop_members add column if not exists display_name text;
update shop_members m set display_name = btrim(s.name)
  from staff s
 where m.display_name is null and s.shop_id = m.shop_id and s.user_id = m.user_id and nullif(btrim(s.name), '') is not null
   and btrim(s.name) !~ '@';
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'raw_user_meta_data') then
    execute $q$update shop_members m set display_name = btrim(coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name'))
                 from auth.users u
                where m.display_name is null and u.id = m.user_id
                  and nullif(btrim(coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name')), '') is not null
                  and coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name') !~ '@'$q$;
  end if;
end $$;

-- The name the database writes for a person: their own choice, else the staff
-- record's, else "The Store". Never an email handle.
create or replace function ow_member_name(p_shop uuid, p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(btrim(m.display_name), '') from shop_members m where m.shop_id = p_shop and m.user_id = p_user limit 1),
    (select nullif(btrim(s.name), '') from staff s where s.shop_id = p_shop and s.user_id = p_user and btrim(s.name) !~ '@' limit 1),
    'The Store');
$$;
revoke all on function ow_member_name(uuid, uuid) from public, anon, authenticated;

-- A person changes their own name, and nobody else's.
create or replace function set_my_name(p_shop uuid, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare nm text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if char_length(nm) < 2 or char_length(nm) > 60 then raise exception 'A name is 2 to 60 letters.' using errcode = '22023'; end if;
  if nm ~ '@' then raise exception 'Use your name, not your email.' using errcode = '22023'; end if;
  update shop_members set display_name = nm where shop_id = p_shop and user_id = auth.uid();
  if not found then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  return nm;
end $$;
revoke all on function set_my_name(uuid, text) from public, anon;
grant execute on function set_my_name(uuid, text) to authenticated;

/* ---- PRIV-01: an order as the Store reads it, with the phone's names ---- */
create or replace function ow_store_payload(p jsonb) returns jsonb
language plpgsql immutable as $$
declare
  top_keys text[] := array['assignedDeliveryId', 'assignedWorkerId', 'bay', 'cancelledAt', 'cancelledByName', 'carrier',
    'client', 'createdAt', 'customerId', 'date', 'deliveredAt', 'deliveredNote', 'deliveredPhoto', 'deliveredPhotoKind',
    'deliveredTo', 'deliveryAddress', 'deliveryMode', 'handoverCheckedAt', 'originAgentId', 'pickCursor', 'pickShortfallAckAt', 'pickingAssignedAt',
    'pickingDoneAt', 'pickingStatus', 'runDriver', 'savedAt', 'stageEnteredAt', 'stageLog', 'takenBy', 'voidedAt', 'workerAcceptedAt'];
  line_keys text[] := array['lineId', 'productId', 'productName', 'variantIdx', 'qty', 'unit', 'packQty', 'packUnit', 'supplierId', 'clientWaits',
    'pickStatus', 'pickedQty', 'receivedAt', 'receivedQty', 'qtyIn'];
  out jsonb := '{}'::jsonb;
  k text;
  a jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return '{}'::jsonb; end if;
  foreach k in array top_keys loop
    if p ? k then out := out || jsonb_build_object(k, ow_strip_money(p -> k)); end if;
  end loop;
  -- The money hold, by the phone's names: whether an agent has settled, the Manager's
  -- answer, and the Store's own ask (who asked, when, and what came back).
  if p ? 'agentPaymentStatus' then out := out || jsonb_build_object('agentSettled', coalesce(p ->> 'agentPaymentStatus', '') = 'paid'); end if;
  if jsonb_typeof(p -> 'creditCheck') = 'object' then
    out := out || jsonb_build_object('letGo', jsonb_build_object('decision', p -> 'creditCheck' -> 'decision', 'at', p -> 'creditCheck' -> 'at'));
  end if;
  if jsonb_typeof(p -> 'creditAsk') = 'object' then
    a := p -> 'creditAsk';
    out := out || jsonb_build_object('letGoAsk', jsonb_strip_nulls(jsonb_build_object('at', a -> 'at', 'by', a -> 'by', 'byName', a -> 'byName',
      'carrier', ow_strip_money(a -> 'carrier'),
      'answer', case when jsonb_typeof(a -> 'answer') = 'object' then jsonb_build_object(
          'decision', case when a -> 'answer' ->> 'decision' = 'credit' then 'letgo' else a -> 'answer' ->> 'decision' end, 'at', a -> 'answer' -> 'at') end)));
  end if;
  if jsonb_typeof(p -> 'items') = 'array' then
    out := out || jsonb_build_object('items', coalesce((select jsonb_agg(coalesce((select jsonb_object_agg(x.key, x.value) from jsonb_each(case when jsonb_typeof(it) = 'object' then it else '{}'::jsonb end) x
        where x.key = any(line_keys)), '{}'::jsonb) order by o) from jsonb_array_elements(p -> 'items') with ordinality y(it, o)), '[]'::jsonb));
  end if;
  if jsonb_typeof(p -> 'creditNotes') = 'array' then
    out := out || jsonb_build_object('takenBack', coalesce((select jsonb_agg(jsonb_build_object('askId', cn -> 'askId', 'voided', cn -> 'voided',
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

/* ---- PRIV-01 / PRIV-04: the yard's day in one call, nothing else read directly ---- */
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
        'note', ow_strip_note(t.note), 'lines', ow_strip_money(t.lines), 'voided', t.voided, 'yard_checked_at', t.yard_checked_at, 'yard_checked_by', t.yard_checked_by,
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
    'presets', coalesce((select jsonb_strip_nulls(jsonb_build_object('categories', ow_strip_money(a.presets -> 'categories'), 'locations', ow_strip_money(a.presets -> 'locations'),
        'shopLocation', a.presets -> 'shopLocation', 'shopAddress', a.presets -> 'shopAddress', 'bays', a.presets -> 'bays'))
      from app_settings a where a.shop_id = p_shop), '{}'::jsonb),
    'log', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'key', l.key, 'type', l.type, 'delta', l.delta, 'qty_after', l.qty_after,
        'date', l.date, 'at', l.at, 'note', ow_strip_note(l.note)) order by l.id) from stock_log l where l.shop_id = p_shop and l.date >= since), '[]'::jsonb),
    'counted', coalesce((select jsonb_object_agg(x.key, x.at) from (
        select distinct on (l.key) l.key, coalesce(l.at, l.date::timestamptz) as at from stock_log l
         where l.shop_id = p_shop and l.type in ('count', 'correction') order by l.key, l.id desc) x), '{}'::jsonb),
    'returns', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'quote_id', a.quote_id, 'lines', ow_strip_money(a.lines),
        'reason', a.reason, 'note', ow_strip_note(a.note), 'asked_by', a.asked_by, 'asked_by_name', a.asked_by_name, 'status', a.status,
        'decided_at', a.decided_at, 'created_at', a.created_at) order by a.created_at desc)
      from (select * from invoice_asks i where i.shop_id = p_shop and i.kind = 'credit' order by i.created_at desc limit 40) a), '[]'::jsonb),
    'holds', coalesce((select jsonb_object_agg(q.id::text, jsonb_build_object('decision', h ->> 'decision'))
      from saved_quotes q cross join lateral (select ow_money_hold(q.shop_id, q.payload, q.amount_paid) as h) x
     where q.shop_id = p_shop and q.status = 'preparing' and not coalesce(q.voided, false) and not coalesce(q.invoiced, false) and x.h is not null), '{}'::jsonb),
    'agents', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name,
        'terms', case when g.payment_term = 'pay_on_delivery' then 'on_delivery' else 'before' end)) from agents g where g.shop_id = p_shop), '[]'::jsonb),
    'counts', coalesce((select jsonb_agg(ow_store_row(to_jsonb(c)) order by c.created_at desc)
      from (select * from stock_counts c where c.shop_id = p_shop order by c.created_at desc limit 40) c), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(ow_store_row(to_jsonb(r)) order by r.created_at desc)
      from (select * from stock_reports r where r.shop_id = p_shop order by r.created_at desc limit 60) r), '[]'::jsonb),
    'asks', coalesce((select jsonb_agg(ow_store_row(to_jsonb(a)) order by a.created_at desc)
      from (select * from store_asks a where a.shop_id = p_shop and a.created_at >= now() - interval '3 days' order by a.created_at desc limit 80) a), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', ow_member_name(p_shop, m.user_id)))
      from shop_members m where m.shop_id = p_shop), '[]'::jsonb),
    'managers', jsonb_build_object(
      'manager', coalesce((select jsonb_agg(m.user_id) from shop_members m where m.shop_id = p_shop and m.role = 'manager'), '[]'::jsonb),
      'buyer', coalesce((select jsonb_agg(m.user_id) from shop_members m where m.shop_id = p_shop and m.role = 'buyer'), '[]'::jsonb),
      'sourcing', coalesce((select jsonb_agg(m.user_id) from shop_members m where m.shop_id = p_shop and m.role = 'sourcing'), '[]'::jsonb)),
    'me', jsonb_build_object('name', nullif(ow_member_name(p_shop, auth.uid()), 'The Store'),
      'staff_id', (select s.id from staff s where s.shop_id = p_shop and s.user_id = auth.uid() limit 1))
  );
end $$;
revoke all on function store_snapshot(uuid) from public, anon;
grant execute on function store_snapshot(uuid) to authenticated;

/* ---- PRIV-01: the Store's order write takes the phone's name for the ask ---- */
create or replace function store_patch_order(p_shop uuid, p_id bigint, p_patch jsonb, p_status text, p_items jsonb, p_expect jsonb default null)
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
  -- 0162: what the phone saw when the person tapped. If the order has moved since (another phone handed
  -- it over, packed or unpacked it), nothing is written: the phone refreshes and says so.
  if jsonb_typeof(p_expect) = 'object' and (
       (p_expect ? 'status' and (p_expect ->> 'status') is distinct from q.status)
    or (p_expect ? 'pickingStatus' and (p_expect ->> 'pickingStatus') is distinct from (q.payload ->> 'pickingStatus'))
    or (p_expect ? 'pickingDoneAt' and (p_expect ->> 'pickingDoneAt') is distinct from (q.payload ->> 'pickingDoneAt'))
    or (p_expect ? 'carrierAt' and (p_expect ->> 'carrierAt') is distinct from (q.payload -> 'carrier' ->> 'at'))) then
    raise exception 'Someone else just changed this order.' using errcode = '40001', hint = 'OWSTALE';
  end if;
  if p_status is not null and p_status <> q.status then
    if not ((q.status = 'preparing' and p_status in ('pending_delivery', 'completed')) or (q.status = 'pending_delivery' and p_status = 'completed')) then
      raise exception 'That order has moved on.' using errcode = 'P0001';
    end if;
  end if;
  -- The phone calls the money-hold ask letGoAsk (0164); the books keep creditAsk.
  if p_patch ? 'letGoAsk' then p_patch := (p_patch - 'letGoAsk') || jsonb_build_object('creditAsk', p_patch -> 'letGoAsk'); end if;
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
revoke all on function store_patch_order(uuid, bigint, jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function store_patch_order(uuid, bigint, jsonb, text, jsonb, jsonb) to authenticated;

/* ---- PRIV-04: the names the database writes come from ow_member_name ---- */
create or replace function store_count_replace(p_shop uuid, p_old uuid, p_aisle text, p_lines jsonb, p_missing jsonb, p_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o stock_counts%rowtype;
  r stock_counts%rowtype;
  replaced boolean := false;
  nm text;
begin
  if not has_task(p_shop, 'stock.count') then
    raise exception 'Counting stock is not this login''s job (stock.count).' using errcode = '42501';
  end if;
  if p_old is not null then
    select * into o from stock_counts where id = p_old and shop_id = p_shop for update;
    if found and o.status = 'sent' and o.place is not distinct from ow_count_place(p_aisle, p_lines) then
      update stock_counts set status = 'superseded', superseded_at = now() where id = p_old;
      replaced := true;
    end if;
  end if;
  nm := nullif(ow_member_name(p_shop, auth.uid()), 'The Store');
  insert into stock_counts (shop_id, aisle, counted_by, counted_by_name, lines, missing, replaces)
       values (p_shop, p_aisle, auth.uid(), coalesce(nm, nullif(btrim(p_name), ''), 'The Store'),
               coalesce(p_lines, '[]'::jsonb), coalesce(p_missing, '[]'::jsonb), case when replaced then p_old end)
  returning * into r;
  return to_jsonb(r) || jsonb_build_object('replaced', replaced, 'old_status', o.status);
end $$;
revoke all on function store_count_replace(uuid, uuid, text, jsonb, jsonb, text) from public, anon;
grant execute on function store_count_replace(uuid, uuid, text, jsonb, jsonb, text) to authenticated;

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
      'unit', coalesce(it ->> 'unit', l ->> 'unit'), 'qty', (l ->> 'qty')::numeric, 'shown', l ->> 'shown',
      'condition', case when l ->> 'condition' = 'damaged' then 'damaged' else 'good' end)
      || case when price > 0 then jsonb_build_object('price', price, 'amount', round(price * (l ->> 'qty')::numeric)) else '{}'::jsonb end);
    total := total + case when price > 0 then round(price * (l ->> 'qty')::numeric) else 0 end;
  end loop;
  if jsonb_array_length(priced) = 0 then raise exception 'Nothing to send back.'; end if;
  nm := ow_member_name(p_shop, auth.uid());
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

/* ---- PRIV-05: the yard writes only through its functions ---- */
-- The tables the Store app writes to directly stay open; every other shop table
-- refuses a Store login's INSERT, UPDATE and DELETE. Deny by default, like 0159's reads.
-- shop_members keeps its own rules (only an admin changes roles; anyone may leave).
do $$
declare
  t text;
  open_to_yard text[] := array['stock_counts', 'stock_reports', 'store_asks', 'places', 'place_routes', 'road_names', 'push_subscriptions', 'shop_members'];
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and exists (select 1 from information_schema.columns x where x.table_schema = 'public' and x.table_name = c.relname and x.column_name = 'shop_id')
  loop
    if t = any(open_to_yard) then continue; end if;
    execute format('drop policy if exists "the yard writes through its functions (insert)" on %I', t);
    execute format('drop policy if exists "the yard writes through its functions (update)" on %I', t);
    execute format('drop policy if exists "the yard writes through its functions (delete)" on %I', t);
    execute format('create policy "the yard writes through its functions (insert)" on %I as restrictive for insert to authenticated with check (not ow_yard_only(shop_id))', t);
    execute format('create policy "the yard writes through its functions (update)" on %I as restrictive for update to authenticated using (not ow_yard_only(shop_id)) with check (not ow_yard_only(shop_id))', t);
    execute format('create policy "the yard writes through its functions (delete)" on %I as restrictive for delete to authenticated using (not ow_yard_only(shop_id))', t);
  end loop;
end $$;

-- A Store login reads only its own membership; the team's names come in the snapshot.
drop policy if exists "the yard sees only itself" on shop_members;
create policy "the yard sees only itself" on shop_members as restrictive for select to authenticated
  using (user_id = auth.uid() or not ow_yard_only(shop_id));
