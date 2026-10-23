-- 0162 Store, seventh (audit round 3: reliability, 23 Oct 2026; docs/audit/ROUND-3.md).
--
--   REL-08 Two phones on one order: store_patch_order read the order, merged the
--   phone's fields and wrote, so the last write won (both hand over; one packs
--   while the other unpacks). It now takes p_expect -- the order as the phone
--   showed it when the person tapped (status, pickingStatus, pickingDoneAt,
--   carrier.at) -- and, with the row locked, refuses with 40001 (hint OWSTALE)
--   when any of them differ. The phone then reloads that order and says
--   "Someone else just did this". With p_expect null it behaves as 0160's.
--
-- The 5-argument function is dropped so a call with or without p_expect has
-- one function to land on (an app not yet updated sends no p_expect).
--
-- Run after 0160 (0161 may come before or after). Safe to run twice.
-- ROLLBACK: drop this 6-argument function and run 0160 again.
-- ---------------------------------------------------------------------

drop function if exists store_patch_order(uuid, bigint, jsonb, text, jsonb);

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
