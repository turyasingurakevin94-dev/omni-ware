-- 0142: two "(verify)" items of the audit's section 4, reproduced on the rig
-- and fixed.
--
-- 1. A stock count is accepted once, from 'sent', and a surplus is valued.
--
--    accept_stock_count (0115) took any count that was not yet 'accepted' --
--    one the Manager had sent back for a recount included, so the stale
--    figures could still land while the Store was counting again. And a
--    surplus (more on the shelf than the books) became a lot with cost null,
--    which every FIFO take then carried as a cost of nothing: the next sale
--    of those units showed a margin of 100 %. Reproduced: 305 counted against
--    299 on the books made lot 47, 6 bags, cost null, beside lot 38 at
--    32,500.
--
--    Now: only a count that is 'sent' is accepted ('recount': "accept the
--    recount when it comes"; 'accepted': as before, nothing changes); a
--    surplus lot takes the last cost the shop knew for that item -- its
--    newest lot, else the newest restock or correction in the stock log,
--    else the lowest price on the list -- and the stock log line says so.
--    The log id comes from the one allocator (0138) instead of a per-shop
--    counter of its own.
--
-- 2. An Accounts login cannot book a line on a closed day.
--
--    cash_txns_accounts_guard (0123) ran only on UPDATE, so a correction on a
--    closed day was refused while a new expense dated that day was taken.
--    Reproduced: Transport 20,000 dated a closed day, as Esther, landed. The
--    guard now runs on INSERT too, with the same words.
--
-- Safe to re-run.

/* ---------------- 1. the count ---------------- */
-- The last cost the shop knew for a stock key: its newest lot, else the
-- newest restock or correction logged with a cost, else the lowest price on
-- the list for the product (and variant).
create or replace function ow_last_known_cost(p_shop_id uuid, p_key text, p_product text, p_vi text) returns numeric
language sql stable as $$
  select coalesce(
    (select l.cost from stock_lots l where l.shop_id = p_shop_id and l.key = p_key and l.cost is not null order by l.id desc limit 1),
    (select g.cost from stock_log g where g.shop_id = p_shop_id and g.key = p_key and g.cost is not null and g.type in ('restock', 'correction') order by g.id desc limit 1),
    (select min(coalesce(p.wholesale, p.retail)) from prices p where p.shop_id = p_shop_id and p.product_id = p_product
       and coalesce(p.variant_idx::text, '') = coalesce(nullif(p_vi, ''), '') and coalesce(p.wholesale, p.retail) is not null))
$$;

create or replace function accept_stock_count(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  v_cost numeric;
  changed int := 0;
begin
  select * into c from stock_counts where id = p_id for update;
  if not found then raise exception 'That count is gone.' using errcode = 'P0002'; end if;
  if not has_task(c.shop_id, 'stock.correct') then
    raise exception 'Correcting stock is for the owner or a manager.' using errcode = '42501';
  end if;
  if c.status = 'accepted' then return jsonb_build_object('ok', true, 'changed', 0, 'already', true); end if;
  if c.status = 'recount' then
    raise exception 'This count was sent back for a recount — accept the recount when it comes.' using errcode = '22023';
  end if;
  if c.status is distinct from 'sent' then
    raise exception 'This count is not waiting to be accepted (%).', coalesce(c.status, 'no status') using errcode = '22023';
  end if;

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
    v_cost := null;
    if delta < 0 then
      left_to_take := -delta;
      for lot in select id, qty from stock_lots where shop_id = c.shop_id and key = k order by id for update loop
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
      -- A surplus is worth what the shop last paid for the item, never nothing.
      v_cost := ow_last_known_cost(c.shop_id, k, l ->> 'productId', l ->> 'variantIdx');
      insert into stock_lots (shop_id, key, qty, cost) values (c.shop_id, k, delta, v_cost);
    end if;

    log_id := ow_next_row_id(c.shop_id, 'row:stock_log', 0);
    insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at, cost)
         values (log_id, c.shop_id, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), l ->> 'name', 'count',
                 delta, after,
                 'Stock take' || coalesce(' · ' || c.aisle, '') || coalesce(' · counted by ' || c.counted_by_name, '')
                   || case when delta > 0 then case when v_cost is null then ' · surplus, no cost known' else ' · surplus valued at ' || ow_money(v_cost) end else '' end,
                 current_date, now(), case when delta > 0 then v_cost end);
    changed := changed + 1;
  end loop;

  update stock_counts set status = 'accepted', decided_by = auth.uid(), decided_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'changed', changed);
end $$;

/* ---------------- 2. the closed day ---------------- */
create or replace function cash_txns_accounts_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' then
    if cash_day_is_closed(new.shop_id, new.date) then
      raise exception 'That day is closed. Reopen it from Days first.' using errcode = '42501';
    end if;
    return new;
  end if;
  if (to_jsonb(new) - 'amount' - 'account' - 'date' - 'time' - 'quote_id' - 'description' - 'category')
     is distinct from (to_jsonb(old) - 'amount' - 'account' - 'date' - 'time' - 'quote_id' - 'description' - 'category') then
    raise exception 'A correction changes the amount, account, day or invoice of a payment, nothing else.' using errcode = '42501';
  end if;
  if cash_day_is_closed(old.shop_id, old.date) or cash_day_is_closed(new.shop_id, new.date) then
    raise exception 'That day is closed. Reopen it from Days first.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists cash_txns_accounts_guard on cash_txns;
create trigger cash_txns_accounts_guard before insert or update on cash_txns
  for each row execute function cash_txns_accounts_guard();
