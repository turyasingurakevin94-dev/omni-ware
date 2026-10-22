-- 0158 Manager: the three answers the Manager app gives that nobody heard.
--
-- docs/decision-rights.md: every hand-off that waits on someone pushes that
-- person. The Manager app already makes these three calls or writes; the
-- database did not answer them, so the person on the other end was never
-- told:
--
--   1. refuse_restock_buy(p_id): the Manager says no to a carton's shelf
--      part (the Buyer's ask, 0151: 'held', no held_by, for_line set). The
--      line is 'cancelled', the owner's log gets it (restock.hold, as
--      hold_restock_buy writes it), and the Buyer who asked is pushed
--      (carton.refused) -- buyer.html reads a cancelled ask as "<Manager>
--      said no to the carton". Letting it go stays hold_restock_buy(id,
--      false), which pushes restock.released (0136).
--   2. A delivery given to a driver: when an order's payload.assignedDeliveryId
--      changes to a staff member with a login, that login is pushed
--      (job.given), whoever gave it (the Manager's hand-over, or the Store
--      at Load). A packer is not pushed here: handing an order to a packer
--      sets pickingStatus 'awaiting_accept', and notify-worker already sends
--      "New order to prepare" for that. A trip's runner is 0150's
--      (trip.sent, trip.taken), not repeated here.
--   3. tell_customer_change(shop, customer, to, what): after the Manager
--      edits a customer, the salesperson who last sold to them is pushed
--      (customer.changed) with what changed. customer.edit or credit.set.
--      The edit itself is logged by manager.html and 0122's customers guard.
--
-- Applied by hand, after 0120 (ow_push), 0131 (ow_first_name), 0136
-- (hold_restock_buy) and 0151 (restock_buys.for_line). Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select proname from pg_proc where proname in ('refuse_restock_buy', 'tell_customer_change', 'saved_quotes_ow_push_job');
--   select tgname from pg_trigger where tgname = 'saved_quotes_ow_push_job';
--   select kind, title, body from push_outbox where kind in ('carton.refused', 'job.given', 'customer.changed') order by id desc limit 5;
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_push_job on saved_quotes;
--   drop function if exists saved_quotes_ow_push_job();
--   drop function if exists refuse_restock_buy(uuid);
--   drop function if exists tell_customer_change(uuid, text, uuid, text);
-- ---------------------------------------------------------------------

-- 1. No to a carton's shelf part.
create or replace function refuse_restock_buy(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  nm text;
  who text;
  oid text;
begin
  select * into r from restock_buys where id = p_id for update;
  if not found then raise exception 'That restock line is gone.' using errcode = 'P0002'; end if;
  if not has_task(r.shop_id, 'restock.hold') then
    raise exception 'Answering a carton is the Manager''s (restock.hold).' using errcode = '42501';
  end if;
  if r.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'id', p_id, 'status', r.status, 'already', true);
  end if;
  if r.status <> 'held' or r.held_by is not null or coalesce(r.for_line, '') = '' then
    raise exception 'Only a carton the Buyer asked about is refused; this line is % already.', r.status using errcode = 'OWRST';
  end if;
  select coalesce(p.name, r.product_id) into nm from products p where p.shop_id = r.shop_id and p.id = r.product_id;
  update restock_buys set status = 'cancelled' where id = p_id;
  perform manager_log_decision(r.shop_id, 'restock.hold',
    'Said no to a carton''s shelf part: ' || r.qty || ' × ' || coalesce(nm, 'an item'),
    case when r.price is not null then r.price * r.qty end,
    jsonb_build_object('table', 'restock_buys', 'id', r.id, 'line', r.for_line),
    jsonb_build_object('status', r.status), jsonb_build_object('status', 'cancelled'));
  who := coalesce(ow_first_name(r.shop_id, auth.uid()), 'The Manager');
  oid := nullif(split_part(r.for_line, ':', 1), '');
  perform ow_push(r.shop_id, 'carton.refused', who || ' said no to the carton',
    coalesce(nm, 'The item') || ': buy only what the order needs. The ' || r.qty || ' for the shelf stay unbought.',
    r.created_by, case when r.created_by is null then 'buy.restock' end, null,
    jsonb_build_object('table', 'restock_buys', 'id', r.id, 'line', r.for_line, 'orderId', oid),
    'cartonno:' || r.id);
  return jsonb_build_object('ok', true, 'id', p_id, 'status', 'cancelled');
end $$;
revoke all on function refuse_restock_buy(uuid) from public, anon;
grant execute on function refuse_restock_buy(uuid) to authenticated;

-- 2. A delivery given to a driver.
create or replace function saved_quotes_ow_push_job() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := coalesce(old.payload, '{}'::jsonb);
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'An order');
  drv text := nullif(btrim(coalesce(p ->> 'assignedDeliveryId', '')), '');
  to_user uuid;
  who text;
begin
  if coalesce(new.voided, false) then return null; end if;
  if drv is null or drv like '\_\_%' or drv is not distinct from nullif(btrim(coalesce(o ->> 'assignedDeliveryId', '')), '') then return null; end if;
  if new.status not in ('preparing', 'pending_delivery') then return null; end if;
  begin
    select s.user_id into to_user from staff s where s.shop_id = new.shop_id and s.id = drv;
    if to_user is null then return null; end if;
    who := coalesce(ow_first_name(new.shop_id, auth.uid()), 'The shop');
    perform ow_push(new.shop_id, 'job.given', 'A delivery for you',
      who || ' gives you ' || client || ' to deliver.',
      to_user, null, null, jsonb_build_object('table', 'saved_quotes', 'id', new.id),
      'jobgiven:' || new.id || ':' || drv || ':' || coalesce(p -> 'carrier' ->> 'at', ''));
  exception when others then
    raise notice 'push (job given): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists saved_quotes_ow_push_job on saved_quotes;
create trigger saved_quotes_ow_push_job after update on saved_quotes
  for each row execute function saved_quotes_ow_push_job();

-- 3. The salesperson told what changed on their customer.
create or replace function tell_customer_change(p_shop_id uuid, p_customer_id text, p_to uuid, p_what text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c customers;
  who text;
begin
  if auth.uid() is null or not is_shop_member(p_shop_id) then
    raise exception 'Sign in to this shop first.' using errcode = '42501';
  end if;
  if not (has_task(p_shop_id, 'customer.edit') or has_task(p_shop_id, 'credit.set')) then
    raise exception 'Telling Sales about a customer is the Manager''s (customer.edit, credit.set).' using errcode = '42501';
  end if;
  select * into c from customers where shop_id = p_shop_id and id = p_customer_id;
  if not found then raise exception 'That customer is gone.' using errcode = 'P0002'; end if;
  if p_to is null or not exists (select 1 from shop_members m where m.shop_id = p_shop_id and m.user_id = p_to) then
    raise exception 'Nobody in this shop to tell.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_what, '')), '') is null then
    raise exception 'Say what changed.' using errcode = '22023';
  end if;
  who := coalesce(ow_first_name(p_shop_id, auth.uid()), 'The Manager');
  perform ow_push(p_shop_id, 'customer.changed', coalesce(nullif(btrim(coalesce(c.name, '')), ''), 'A customer') || ' changed',
    who || ': ' || left(btrim(p_what), 200),
    p_to, null, null, jsonb_build_object('table', 'customers', 'id', c.id),
    'custchg:' || c.id || ':' || p_to || ':' || md5(btrim(p_what)) || ':' || (extract(epoch from now()) / 60)::bigint);
  return jsonb_build_object('ok', true, 'to', p_to);
end $$;
revoke all on function tell_customer_change(uuid, text, uuid, text) from public, anon;
grant execute on function tell_customer_change(uuid, text, uuid, text) to authenticated;
