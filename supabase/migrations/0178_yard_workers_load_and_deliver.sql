-- 0178 Urgent, after the rebuild's fixes went live (28 Oct 2026): a yard
-- worker can load and deliver again.
--
-- 0173 made every stage move need its task: loading order.load, delivering
-- order.deliver (the 'store' role holds both). But store_patch_order (0164)
-- lets a 'store' OR a 'staff' login pack, load and deliver: yard workers
-- open the Store app with a staff login, and 'staff' holds no task. So
-- since 0173 a worker's Load and Delivered were refused ("not yours to
-- do"). Found by test/store-money-db.test.js once its Store writes went
-- through store_patch_order as the app's do.
--
-- saved_quotes_stage_move, written out whole (0173's rule with 0177's
-- Cancel, so the version in force is in one place), now also lets a
-- 'store' or 'staff' login make the yard's three moves — Packing to On the
-- road, Packing to Delivered, On the road to Delivered — exactly whom
-- store_patch_order lets make them. Nothing else changes.
--
-- Applied by hand, after 0177. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select position('''staff''' in pg_get_functiondef('saved_quotes_stage_move()'::regprocedure)) > 0;   -- true
--
-- ROLLBACK: run 0173's saved_quotes_stage_move, then 0177's step 1.
-- ---------------------------------------------------------------------

create or replace function saved_quotes_stage_move() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  stages text[] := array['draft', 'awaiting_goods', 'preparing', 'pending_delivery', 'completed'];
  f int;
  t int;
  tasks text[];
  k text;
  was text;
begin
  -- No login: the Edge Functions, the hourly run, a server function's own hand.
  if auth.uid() is null then return new; end if;
  -- The owner's console keeps every move (0169 left it so).
  if is_shop_admin(new.shop_id) then return new; end if;
  -- An upsert of an order already here is judged by the update it becomes.
  if tg_op = 'INSERT' and exists (select 1 from saved_quotes x where x.shop_id = new.shop_id and x.id = new.id) then return new; end if;

  -- A new order is placed in Checking; one placed further on is a move out of Checking in the same write.
  if tg_op = 'INSERT' then
    if new.status = 'draft' then return new; end if;
    was := 'draft';
  else
    if new.status is not distinct from old.status then return new; end if;
    -- 0177: Cancel (order.cancel), before the bill; it is final.
    if new.status = 'cancelled' then
      if coalesce(old.invoiced, false) or old.status = 'completed' then
        raise exception 'A delivered or invoiced order is not cancelled: invoice it, then void it.' using errcode = 'OWSTG';
      end if;
      if coalesce(old.voided, false) then raise exception 'This order is voided already.' using errcode = 'OWSTG'; end if;
      if has_task(new.shop_id, 'order.cancel') then return new; end if;
      raise exception 'Cancelling an order is the Manager''s (order.cancel).' using errcode = '42501';
    end if;
    if coalesce(old.invoiced, false) or coalesce(old.voided, false) then
      raise exception 'This order is % — its stage stays %.', case when coalesce(old.voided, false) then 'voided' else 'invoiced' end,
        ow_stage_word(old.status) using errcode = 'OWSTG';
    end if;
    was := old.status;
  end if;
  f := array_position(stages, was);
  t := array_position(stages, new.status);
  if f is null or t is null then
    raise exception 'An order can''t go from % to %.', ow_stage_word(was), ow_stage_word(new.status) using errcode = 'OWSTG';
  end if;

  tasks := case
    when t < f then array['order.move']                                         -- back (the Manager's undo)
    -- Placed straight in Packing (every line on our shelf) is placing it: quote.make.
    when tg_op = 'INSERT' and new.status = 'preparing' then array['quote.make', 'order.move']
    when tg_op = 'INSERT' and new.status = 'awaiting_goods' then array['order.move']  -- the Buyer places no orders
    when was = 'draft' and new.status in ('awaiting_goods', 'preparing') then array['order.move', 'supplier.confirm']
    when was = 'awaiting_goods' and new.status = 'preparing' then array['order.move', 'stock.receive']
    when was = 'preparing' and new.status = 'pending_delivery' then array['order.move', 'order.load']
    when was in ('preparing', 'pending_delivery') and new.status = 'completed' then array['order.move', 'order.deliver']
    when new.status = 'completed' then array['order.move']                      -- "mark done"
  end;
  if tasks is null then
    raise exception 'An order can''t go from % to %.', ow_stage_word(was), ow_stage_word(new.status) using errcode = 'OWSTG';
  end if;
  foreach k in array tasks loop
    if has_task(new.shop_id, k) then return new; end if;
  end loop;
  -- 0178: the yard's own moves, by whom store_patch_order (0164) lets make them: a Store or a staff (worker) login.
  if tg_op = 'UPDATE' and was in ('preparing', 'pending_delivery') and new.status in ('pending_delivery', 'completed') and t > f
     and exists (select 1 from shop_members m where m.shop_id = new.shop_id and m.user_id = auth.uid() and m.role in ('store', 'staff')) then
    return new;
  end if;
  raise exception 'Moving an order from % to % is not yours to do (%).', ow_stage_word(was), ow_stage_word(new.status),
    array_to_string(tasks, ' or ') using errcode = '42501';
end $$;
