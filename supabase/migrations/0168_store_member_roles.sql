-- 0168 Store, eleventh (audit round 10, final polish, 24 Oct 2026; docs/audit/store/ROUND-10.md).
--
--   STO-WORD-11 A member with no name the apps can show (the owner's login,
--     on live) read "Someone" on every Store screen: the snapshot sent their
--     name as "The Store", which the phone rightly refuses as a name, and did
--     not say who they are. store_live's members now carry their role, and no
--     name when they have none, so the phone says "The owner", "The manager".
--     ow_member_name() is unchanged: "The Store" stays the marker the other
--     Store functions test for, and the names they write are read by login.
--   No money, and no role, task or push changes.
--
-- Run after 0166 (and 0167). Safe to run twice.
--
-- CHECK AFTERWARDS (as a Store login, in the app's browser console):
--   (await sb.rpc('store_live', { p_shop: S.shopId })).data.members   -- every row has user_id, role, and name or null
--
-- ROLLBACK: run 0166 again (it redefines store_live as it was; safe to run twice).
-- ---------------------------------------------------------------------

/* ---- what changes all day: members now carry their role, and no name when they have none ---- */
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
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', nullif(ow_member_name(p_shop, m.user_id), 'The Store'), 'role', m.role))
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

/* ---- CHECK ---- */
do $$
begin
  if to_regprocedure('store_live(uuid)') is null then raise exception '0168: store_live is missing'; end if;
  if exists (select 1 from pg_roles where rolname = 'anon') and has_function_privilege('anon', 'store_live(uuid)', 'execute') then
    raise exception '0168: store_live must not be open to anon';
  end if;
end $$;
