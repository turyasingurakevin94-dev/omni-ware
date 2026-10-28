-- 0173 The rebuild's third backend fix (docs/rebuild.md, "Backend fixes
-- decided"; docs/spec/01-order-journey.md §5 Q2, Kevin 28 Oct 2026): moving
-- an order's stage needs order.move, and only to an allowed next stage.
--
-- order.move (Sales, Manager) was granted but never checked: any login that
-- could write saved_quotes could set any status (ow_patch_order takes
-- p_status as given, 0165). Only store_patch_order (0164) limited its own
-- moves. Now the database checks every stage write by a person, whichever
-- path it takes. The moves the apps make, and who makes them
-- (docs/spec/01-order-journey.md §2b):
--
--   Checking → Buying | Packing     order.move, or supplier.confirm (the
--                                   Buyer, when the last supplier says yes:
--                                   buyer.html orderLeaveDraft)
--   Buying → Packing                order.move, or stock.receive
--                                   (receive_trip, the yard counts it in)
--   Packing → On the road           order.move, or order.load (the Store)
--   Packing | On the road → Delivered  order.move, or order.deliver (the Store)
--   any → Delivered                 order.move (the Manager's "mark done")
--   back to an earlier stage        order.move (the Manager's undo)
--
-- Anything else is refused (OWSTG): a skip forward other than "mark done",
-- a stage that is not one of the five, and any move on an order that is
-- invoiced or voided (manager.html obMove refused those already). A new
-- order is placed in Checking; one placed further on is judged as a move out
-- of Checking in the same write (the gate holds it there as it holds any
-- move, 0119 "held at insert too"), and one placed straight in Packing (a
-- shelf-only order, sales.html nwShelfOnly) also passes with quote.make;
-- supplier.confirm never places one.
-- A missing task is refused 42501.
--
-- Not judged: writes with no login (the Edge Functions, the hourly run, and
-- a server function's own hand after ow_system_begin, such as the counter
-- sale), and the owner's console (owner, admin), as 0169 left them. The
-- trigger runs before the Checking gate (0119), so it judges the move the
-- person asked for; the gate's own moves (sending a shelf-only order to
-- Packing, a held move made when the last yes comes) are the gate's.
--
-- Applied by hand, after 0172. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname = 'saved_quotes_ow_a_stage_move';
--   -- who could move what (each role's tasks):
--   select role, string_agg(task, ' ' order by task) from role_tasks
--    where task in ('order.move','supplier.confirm','stock.receive','order.load','order.deliver') group by role;
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_a_stage_move on saved_quotes;
--   drop function if exists saved_quotes_stage_move();
--   drop function if exists ow_stage_word(text);
-- ---------------------------------------------------------------------

-- The word on screen for a stage (docs/audit/GLOSSARY.md).
create or replace function ow_stage_word(p_status text) returns text
language sql immutable as $$
  select case p_status when 'draft' then 'Checking' when 'awaiting_goods' then 'Buying' when 'preparing' then 'Packing'
                       when 'pending_delivery' then 'On the road' when 'completed' then 'Delivered'
                       else coalesce(nullif(p_status, ''), 'no stage') end
$$;

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
  raise exception 'Moving an order from % to % is not yours to do (%).', ow_stage_word(was), ow_stage_word(new.status),
    array_to_string(tasks, ' or ') using errcode = '42501';
end $$;
-- Named to run before saved_quotes_ow_checking_gate (BEFORE triggers fire by name).
drop trigger if exists saved_quotes_ow_a_stage_move on saved_quotes;
create trigger saved_quotes_ow_a_stage_move before insert or update on saved_quotes
  for each row execute function saved_quotes_stage_move();
