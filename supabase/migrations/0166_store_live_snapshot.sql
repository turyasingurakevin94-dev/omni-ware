-- 0166 Store, tenth (audit round 9, speed, 23 Oct 2026; docs/audit/store/ROUND-9.md).
--
--   STO-SPD-03 The Store phone asked for the whole snapshot (347 KB on live) every
--     45 seconds and kept only the half that changes during the day. Now:
--     - store_live(p_shop): what changes all day -- orders, trips, money holds,
--       asks, counts, reports, returns, members, the Manager's / Buyer's /
--       Sourcing's logins, "me" -- and the stock, folded in as one
--       { key: qty } map, so the 45-second refresh is one request of about half
--       the size.
--     - store_snapshot(p_shop) is store_live plus what rarely changes (products,
--       units, customers, staff, suppliers, settings, stock history, last
--       counts, agents), so the two can never disagree. Same keys as 0164, plus
--       "stock".
--     - Trims: stock history 35 -> 28 days (the four weekly bars the item page
--       draws); delivered orders 35 -> 30 days (the window Returns offers);
--       a voided trip goes after 14 days, as a voided order already does; a
--       unit row carries no id (the app never reads it) and no empty fields.
--   No money: the same allow-lists as 0164 (ow_store_payload, ow_strip_money,
--   ow_strip_note); the stock map is quantities only. No role, task or push changes.
--
-- Run after 0164 (and 0165). Safe to run twice. store.html works with or without
-- this file: without store_live it asks for the snapshot and the stock, as before.
--
-- CHECK AFTERWARDS (as a Store login, in the app's browser console):
--   Object.keys((await sb.rpc('store_live', { p_shop: S.shopId })).data)   -- orders … me, stock
--   JSON.stringify(await sb.rpc('store_live', { p_shop: S.shopId })).match(/price|cost|amount|paid|payment|credit|UGX/i)  -- null
--
-- ROLLBACK: run 0164 again (it redefines store_snapshot as it was; safe to run
-- twice), then
--   drop function if exists store_live(uuid);
-- ---------------------------------------------------------------------

/* ---- what changes all day ---- */
create or replace function store_live(p_shop uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'orders', coalesce((select jsonb_agg(jsonb_build_object(
        'id', q.id, 'client_name', q.client_name, 'client_phone', q.client_phone, 'date', q.date, 'status', q.status,
        'invoiced', q.invoiced, 'invoiced_ts', q.invoiced_ts, 'voided', q.voided, 'payload', ow_store_payload(q.payload)) order by q.id)
      from saved_quotes q
     where q.shop_id = p_shop and q.status <> 'draft'
       and (q.status <> 'completed' or coalesce(ow_ts(q.payload ->> 'deliveredAt'), q.invoiced_ts, now()) >= now() - interval '30 days')
       and (not coalesce(q.voided, false) or coalesce(ow_ts(q.payload ->> 'stageEnteredAt'), now()) >= now() - interval '14 days')), '[]'::jsonb),
    'trips', coalesce((select jsonb_agg(jsonb_build_object(
        'id', t.id, 'supplier_id', t.supplier_id, 'status', t.status, 'assigned_worker_id', t.assigned_worker_id, 'created_at', t.created_at,
        'assigned_at', t.assigned_at, 'accepted_at', t.accepted_at, 'collected_at', t.collected_at, 'confirmed_at', t.confirmed_at,
        'note', ow_strip_note(t.note), 'lines', ow_strip_money(t.lines), 'voided', t.voided, 'yard_checked_at', t.yard_checked_at, 'yard_checked_by', t.yard_checked_by,
        'yard_received_at', t.yard_received_at, 'difference_accepted_at', t.difference_accepted_at) order by t.id)
      from collection_trips t
     where t.shop_id = p_shop and (t.status not in ('confirmed') or coalesce(t.confirmed_at, t.created_at) >= now() - interval '14 days')
       and (not t.voided or coalesce(t.confirmed_at, t.collected_at, t.accepted_at, t.assigned_at, t.created_at) >= now() - interval '14 days')), '[]'::jsonb),
    'holds', coalesce((select jsonb_object_agg(q.id::text, jsonb_build_object('decision', h ->> 'decision'))
      from saved_quotes q cross join lateral (select ow_money_hold(q.shop_id, q.payload, q.amount_paid) as h) x
     where q.shop_id = p_shop and q.status = 'preparing' and not coalesce(q.voided, false) and not coalesce(q.invoiced, false) and x.h is not null), '{}'::jsonb),
    'asks', coalesce((select jsonb_agg(ow_store_row(to_jsonb(a)) order by a.created_at desc)
      from (select * from store_asks a where a.shop_id = p_shop and a.created_at >= now() - interval '3 days' order by a.created_at desc limit 80) a), '[]'::jsonb),
    'counts', coalesce((select jsonb_agg(ow_store_row(to_jsonb(c)) order by c.created_at desc)
      from (select * from stock_counts c where c.shop_id = p_shop order by c.created_at desc limit 40) c), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(ow_store_row(to_jsonb(r)) order by r.created_at desc)
      from (select * from stock_reports r where r.shop_id = p_shop order by r.created_at desc limit 60) r), '[]'::jsonb),
    'returns', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'quote_id', a.quote_id, 'lines', ow_strip_money(a.lines),
        'reason', a.reason, 'note', ow_strip_note(a.note), 'asked_by', a.asked_by, 'asked_by_name', a.asked_by_name, 'status', a.status,
        'decided_at', a.decided_at, 'created_at', a.created_at) order by a.created_at desc)
      from (select * from invoice_asks i where i.shop_id = p_shop and i.kind = 'credit' order by i.created_at desc limit 40) a), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', ow_member_name(p_shop, m.user_id)))
      from shop_members m where m.shop_id = p_shop), '[]'::jsonb),
    'managers', jsonb_build_object(
      'manager', coalesce((select jsonb_agg(m.user_id) from shop_members m where m.shop_id = p_shop and m.role = 'manager'), '[]'::jsonb),
      'buyer', coalesce((select jsonb_agg(m.user_id) from shop_members m where m.shop_id = p_shop and m.role = 'buyer'), '[]'::jsonb),
      'sourcing', coalesce((select jsonb_agg(m.user_id) from shop_members m where m.shop_id = p_shop and m.role = 'sourcing'), '[]'::jsonb)),
    'me', jsonb_build_object('name', nullif(ow_member_name(p_shop, auth.uid()), 'The Store'),
      'staff_id', (select s.id from staff s where s.shop_id = p_shop and s.user_id = auth.uid() limit 1)),
    'stock', coalesce((select jsonb_object_agg(s.key, s.qty) from stock s where s.shop_id = p_shop), '{}'::jsonb)
  );
end $$;
revoke all on function store_live(uuid) from public, anon;
grant execute on function store_live(uuid) to authenticated;

/* ---- the yard's day in one call: the live part and what rarely changes ---- */
create or replace function store_snapshot(p_shop uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  since date := current_date - 28;
begin
  if not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  return store_live(p_shop) || jsonb_build_object(
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'category', p.category, 'image', p.image,
        'variants', ow_strip_money(coalesce(p.variants, '[]'::jsonb)))) from products p where p.shop_id = p_shop), '[]'::jsonb),
    'units', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('product_id', r.product_id, 'variant_idx', r.variant_idx, 'unit', r.unit,
        'pack_unit', r.pack_unit, 'pack_qty', r.pack_qty, 'pieces_per_unit', r.pieces_per_unit))) from prices r where r.shop_id = p_shop), '[]'::jsonb),
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
    'agents', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name,
        'terms', case when g.payment_term = 'pay_on_delivery' then 'on_delivery' else 'before' end)) from agents g where g.shop_id = p_shop), '[]'::jsonb)
  );
end $$;
revoke all on function store_snapshot(uuid) from public, anon;
grant execute on function store_snapshot(uuid) to authenticated;

/* ---- CHECK ---- */
do $$
begin
  if to_regprocedure('store_live(uuid)') is null or to_regprocedure('store_snapshot(uuid)') is null then
    raise exception '0166: store_live or store_snapshot is missing';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and has_function_privilege('anon', 'store_live(uuid)', 'execute') then
    raise exception '0166: store_live must not be open to anon';
  end if;
end $$;
