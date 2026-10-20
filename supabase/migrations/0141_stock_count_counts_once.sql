-- The stock take counted delivered goods out twice (found while fixing the
-- end-to-end test of 19 Oct 2026; the owner said fix it).
--
-- Stock leaves the books when an order is invoiced (ow_invoice_core), which
-- can be a day after delivery or later. A blind count in between finds the
-- shelf without those goods, and accept_stock_count (0115) set the books to
-- the number counted: the goods came off the books there, and then again
-- when the invoice took them. Stock ended understated by every order that
-- was picked but not yet invoiced when the count was accepted.
--
-- Accepting a count now adds back what such orders have taken off the
-- shelf (ow_held_gone): for each order not invoiced, voided or cancelled
-- whose goods have left the shelf (packed: picking done, or out for
-- delivery, or delivered), each line the invoice will take (from the
-- shelf, or bought in and received), at what was picked, in shelf units
-- the way the invoice converts them (ow_on_shelf). The stock log line
-- says how much was counted back in. Nothing else changes.
--
-- Applied by hand after 0115 and 0119. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select ow_held_gone(shop_id, key), key from stock where qty > 0 limit 20;
--
-- ROLLBACK: run 0115's accept_stock_count again; drop function if exists ow_held_gone(uuid, text);
-- ---------------------------------------------------------------------

create or replace function ow_held_gone(p_shop_id uuid, p_key text)
returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  q record;
  it jsonb;
  vi numeric;
  picked numeric;
  total numeric := 0;
begin
  for q in
    select s.payload from saved_quotes s
     where s.shop_id = p_shop_id and not s.invoiced and not coalesce(s.voided, false)
       and coalesce(s.payload ->> 'cancelledAt', '') = ''
       and (s.status in ('pending_delivery', 'completed')
            or (s.status = 'preparing' and s.payload ->> 'pickingStatus' = 'done'))
  loop
    for it in select e from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'items') = 'array' then q.payload -> 'items' else '[]'::jsonb end) e loop
      if jsonb_typeof(it) <> 'object' then continue; end if;
      if not (coalesce(it ->> 'supplierId', '') = '__stock__' or ow_line_received(it)) then continue; end if;
      vi := ow_num(it ->> 'variantIdx');
      if ow_stock_key(it ->> 'productId', vi) is distinct from p_key then continue; end if;
      picked := case when it ->> 'pickStatus' = 'short' then coalesce(ow_num(it ->> 'pickedQty'), 0)
                     else coalesce(ow_num(it ->> 'qty'), 0) end;
      if picked <= 0 then continue; end if;
      total := total + coalesce((ow_on_shelf(p_shop_id, it ->> 'productId', vi, picked, it ->> 'unit', it, null)).qty, 0);
    end loop;
  end loop;
  return round(total, 6);
end $$;
revoke all on function ow_held_gone(uuid, text) from public, anon;

-- accept_stock_count: 0115's, with the marked change (0141:).
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
  gone numeric;
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
    if k is null then continue; end if;
    -- 0141: what live orders have already taken off the shelf, and their invoices
    -- will take off the books, is counted back in, so it comes off once.
    gone := ow_held_gone(c.shop_id, k);
    after := greatest(0, round(coalesce((l ->> 'counted')::numeric, 0), 6)) + gone;
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
                 delta, after, 'Stock take' || coalesce(' · ' || c.aisle, '') || coalesce(' · counted by ' || c.counted_by_name, '')
                   || case when gone > 0 then ' · ' || trim_scale(gone) || ' out on orders not yet invoiced' else '' end,
                 current_date, now());
    changed := changed + 1;
  end loop;

  update stock_counts set status = 'accepted', decided_by = auth.uid(), decided_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'changed', changed);
end;
$$;
