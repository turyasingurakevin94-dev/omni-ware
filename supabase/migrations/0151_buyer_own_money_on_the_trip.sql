-- 0151 Buyer, fifth: a round's own money and receipts on the trip, and the
-- Buyer's pay-back passed to Accounts.
--
-- Until now "I paid myself" and "no receipt" lived only on the Buyer's phone,
-- so Accounts asked for cash back from rounds paid out of the Buyer's pocket,
-- had no task to pay them back, and asked for a paper bill that does not
-- exist. Agreed with the Accounts session (its 0152 reads these):
--
--   1. collection_trips.pay (jsonb), per stop, written by the Buyer at Done
--      here and at hand-in: { own: bool, amount: number, receipt: 'photo' |
--      'none', photoPath?, at }. A stop with no receipt sends no paper bill.
--   2. buyer_handoffs kind 'own_money', for Accounts: at the hand-in of a
--      round paid on the Buyer's money, ref 'round:<stem>', payload { buyer,
--      round, amount, stops: [{ tripId, supplier, amount, receipt }] }. The
--      Buyer passes it (trip.collect); Accounts closes it (trip.cash).
--      Pushed to the trip.cash task (trip.own_money).
--   4. A carton far bigger than the sale (the shelf part over ten times what
--      the order needs) waits for the Manager: the Buyer adds the shelf part
--      to restock_buys as 'held', tied to the order line (for_line =
--      '<order id>:<line id>'), and the Manager is pushed (restock.hold,
--      kind carton.ask). Letting it go (0136 hold_restock_buy) is the OK;
--      cancelling it is a no.
--   3. A trip_cash hand-off may gain, once, payload.round = the round its
--      cash started (ow_trip_round of the trip id) and payload.v = 2, so the
--      cash belongs to that round only. Everything else a hand-off says
--      still never changes (0125's guard).
--
-- Applied by hand, after 0125, 0134 and 0150. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select column_name from information_schema.columns where table_name = 'collection_trips' and column_name = 'pay';
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'buyer_handoffs_kind_check';
--   select tgname from pg_trigger where tgname = 'restock_buys_ow_ask';
--
-- ROLLBACK:
--   run 0125's section 3 policies and guard, and 0134, again; then
--   alter table collection_trips drop column if exists pay;
--   drop trigger if exists restock_buys_ow_ask on restock_buys; drop function if exists restock_buys_ow_ask();
--   alter table restock_buys drop column if exists for_line;
-- ---------------------------------------------------------------------

alter table collection_trips add column if not exists pay jsonb;
alter table restock_buys add column if not exists for_line text;

-- A carton's shelf part asked of the Manager (held, no held_by, for a line).
create or replace function restock_buys_ow_ask() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text; who text;
begin
  if new.status = 'held' and new.held_by is null and coalesce(new.for_line, '') <> '' then
    select coalesce(p.name, new.product_id) into nm from products p where p.shop_id = new.shop_id and p.id = new.product_id;
    who := coalesce(ow_first_name(new.shop_id, new.created_by), 'The Buyer');
    perform ow_push(new.shop_id, 'carton.ask', 'A carton to OK',
      who || ' asks: ' || new.qty || ' ' || coalesce(nm, 'of an item') || ' for the shelf, the rest of a carton bought for one order'
        || coalesce(' · ' || case when new.price is not null then ow_money(new.price * new.qty) end, '') || '.',
      null, 'restock.hold', null, jsonb_build_object('table', 'restock_buys', 'id', new.id, 'line', new.for_line), 'cartonask:' || new.id);
  end if;
  return null;
exception when others then
  raise notice 'push (carton ask): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists restock_buys_ow_ask on restock_buys;
create trigger restock_buys_ow_ask after insert on restock_buys
  for each row execute function restock_buys_ow_ask();

alter table buyer_handoffs drop constraint if exists buyer_handoffs_kind_check;
alter table buyer_handoffs add constraint buyer_handoffs_kind_check
  check (kind in ('paper_bill', 'sourcing_fix', 'trip_cash', 'item_switch', 'yard_note', 'own_money'));

drop policy if exists "the buyer passes it on" on buyer_handoffs;
create policy "the buyer passes it on" on buyer_handoffs for insert
  with check (created_by = auth.uid() and status = 'open' and (
    is_shop_admin(shop_id)
    or (kind = 'paper_bill' and has_task(shop_id, 'trip.collect'))
    or (kind = 'sourcing_fix' and (has_task(shop_id, 'supplier.confirm') or has_task(shop_id, 'trip.collect')))
    or (kind = 'trip_cash' and has_task(shop_id, 'trip.plan'))
    or (kind = 'item_switch' and has_task(shop_id, 'line.switch'))
    or (kind = 'yard_note' and has_task(shop_id, 'trip.collect'))
    or (kind = 'own_money' and has_task(shop_id, 'trip.collect'))));
drop policy if exists "the role it is for closes it" on buyer_handoffs;
create policy "the role it is for closes it" on buyer_handoffs for update
  using (is_shop_admin(shop_id) or created_by = auth.uid()
    or (kind = 'paper_bill' and has_task(shop_id, 'bill.record'))
    or (kind = 'trip_cash' and (has_task(shop_id, 'trip.cash') or has_task(shop_id, 'trip.plan')))
    or (kind = 'sourcing_fix' and (has_task(shop_id, 'price.list') or has_task(shop_id, 'supplier.edit')))
    or (kind = 'item_switch' and has_task(shop_id, 'quote.make'))
    or (kind = 'yard_note' and has_task(shop_id, 'trip.difference'))
    or (kind = 'own_money' and has_task(shop_id, 'trip.cash')))
  with check (status in ('open', 'done', 'withdrawn'));

create or replace function buyer_handoffs_guard() returns trigger
language plpgsql as $$
begin
  -- 0151: a trip_cash hand-off may gain, once, the round its cash was used
  -- for (payload.round, with payload.v); nothing else in a hand-off changes.
  if (new.kind, new.for_role, new.ref, new.created_by, new.created_at, new.shop_id)
     is distinct from (old.kind, old.for_role, old.ref, old.created_by, old.created_at, old.shop_id)
     or (new.payload is distinct from old.payload and not (
          old.kind = 'trip_cash' and coalesce(old.payload ->> 'round', '') = ''
          and coalesce(new.payload ->> 'round', '') <> ''
          and (new.payload - 'round' - 'v') = (old.payload - 'round' - 'v'))) then
    raise exception 'A hand-off says what it said; only its status changes.' using errcode = '42501';
  end if;
  if new.status = 'withdrawn' and old.created_by is distinct from auth.uid() and not is_shop_admin(old.shop_id) then
    raise exception 'Only whoever passed it on can withdraw it.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    new.done_by := auth.uid();
    new.done_at := now();
  end if;
  return new;
end $$;
drop trigger if exists buyer_handoffs_guard on buyer_handoffs;
create trigger buyer_handoffs_guard before update on buyer_handoffs
  for each row execute function buyer_handoffs_guard();

create or replace function buyer_handoffs_ow_push3() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  sup text := coalesce(nullif(btrim(coalesce(p ->> 'supplier', '')), ''),
    (select s.name from suppliers s where s.shop_id = new.shop_id and s.id = p ->> 'supplierId'), 'a supplier');
  buyer text := coalesce(ow_first_name(new.shop_id, new.created_by), 'the Buyer');
  n int;
  q record;
  client text;
begin
  if tg_op <> 'INSERT' or new.status <> 'open' or new.kind = 'trip_cash' then return null; end if;
  begin
    if new.kind = 'paper_bill' then
      perform ow_push(new.shop_id, 'bill.paper', 'A paper bill to record',
        sup || coalesce(' — bill ' || nullif(btrim(coalesce(p ->> 'billNo', '')), ''), '')
          || coalesce(' · ' || case when ow_num(p ->> 'total') > 0 then ow_money(ow_num(p ->> 'total')) end, '')
          || ' · from ' || buyer,
        null, 'bill.record', null,
        jsonb_build_object('table', 'buyer_handoffs', 'id', new.id, 'supplierId', p ->> 'supplierId'), 'paperbill:' || new.id);

    elsif new.kind = 'sourcing_fix' then
      n := case when jsonb_typeof(p -> 'fixes') = 'array' then jsonb_array_length(p -> 'fixes') else 0 end;
      perform ow_push(new.shop_id, 'sourcing.fix', 'A supplier’s details to fix',
        sup || ' — ' || case when n > 0 then n || ' fix' || case when n = 1 then '' else 'es' end else 'a fix' end
          || ' from ' || buyer || '. Check each one.',
        null, 'price.list', null,
        jsonb_build_object('table', 'buyer_handoffs', 'id', new.id, 'supplierId', p ->> 'supplierId'), 'srcfix:' || new.id);

    elsif new.kind = 'item_switch' then
      -- The salesperson on the order, while they are still in the shop with
      -- quote.make on; otherwise (gone, switched off, or the order has none)
      -- Sales by task, so the push always reaches someone who can tell them.
      select case when exists (
               select 1 from shop_members m join role_tasks rt on rt.role = m.role and rt.task = 'quote.make'
                where m.shop_id = new.shop_id and m.user_id = ow_uuid(sq.payload ->> 'takenBy')
                  and not exists (select 1 from shop_task_off x where x.shop_id = m.shop_id and x.role = m.role and x.task = 'quote.make'))
             then ow_uuid(sq.payload ->> 'takenBy') end as taker,
             sq.client_name into q
        from saved_quotes sq
       where sq.shop_id = new.shop_id and sq.id::text = coalesce(p ->> 'orderId', new.ref);
      client := coalesce(nullif(btrim(coalesce(p ->> 'client', '')), ''), nullif(btrim(coalesce(q.client_name, '')), ''), 'An order');
      perform ow_push(new.shop_id, 'item.switch', 'An item was switched',
        client || ' — ' || coalesce(nullif(p ->> 'from', ''), 'an item') || ' → ' || coalesce(nullif(p ->> 'to', ''), 'another')
          || coalesce(' (' || nullif(btrim(coalesce(p ->> 'why', '')), '') || ')', '') || '. Tell them.',
        q.taker, case when q.taker is null then 'quote.make' end, null,
        jsonb_build_object('table', 'buyer_handoffs', 'id', new.id, 'orderId', coalesce(p ->> 'orderId', new.ref)), 'switch:' || new.id);

    elsif new.kind = 'own_money' then
      -- 0151: the Buyer paid a round from their own pocket; Accounts pays them back.
      n := case when jsonb_typeof(p -> 'stops') = 'array' then jsonb_array_length(p -> 'stops') else 0 end;
      perform ow_push(new.shop_id, 'trip.own_money', 'Pay ' || buyer || ' back',
        coalesce(case when ow_num(p ->> 'amount') > 0 then ow_money(ow_num(p ->> 'amount')) end, 'A round')
          || ' of ' || buyer || '''s own money' || case when n > 0 then ' · ' || n || ' stop' || case when n = 1 then '' else 's' end else '' end
          || ': a round paid from their pocket.',
        null, 'trip.cash', null,
        jsonb_build_object('table', 'buyer_handoffs', 'id', new.id, 'round', p ->> 'round'), 'ownmoney:' || new.id);

    elsif new.kind = 'yard_note' then
      n := case when jsonb_typeof(p -> 'lines') = 'array' then jsonb_array_length(p -> 'lines') else 0 end;
      perform ow_push(new.shop_id, 'trip.yard_note', 'Why the trip’s count differs',
        'From ' || sup || ' — ' || buyer || ': '
          || coalesce(nullif(btrim(coalesce(p ->> 'words', '')), ''), 'a note on the count')
          || case when n > 0 then ' · ' || n || ' line' || case when n = 1 then '' else 's' end else '' end,
        null, 'trip.difference', null,
        jsonb_build_object('table', 'buyer_handoffs', 'id', new.id, 'tripId', coalesce(p ->> 'tripId', new.ref)), 'yardnote:' || new.id);
    end if;
  exception when others then
    raise notice 'push (hand-off %): % (%)', new.kind, sqlerrm, sqlstate;
  end;
  return null;
end $$;

drop trigger if exists buyer_handoffs_ow_push3 on buyer_handoffs;
create trigger buyer_handoffs_ow_push3 after insert on buyer_handoffs
  for each row execute function buyer_handoffs_ow_push3();
