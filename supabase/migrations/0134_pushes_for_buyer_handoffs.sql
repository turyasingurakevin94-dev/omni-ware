-- The other four things the Buyer passes on (0125 buyer_handoffs) now send
-- a push to whoever takes them, as trip_cash does since 0131:
--
--   paper_bill    A paper bill to record       Accounts     bill.record
--   sourcing_fix  A supplier's details to fix  Sourcing     price.list
--   item_switch   An item was switched         the order's salesperson (takenBy),
--                                              else Sales (quote.make)
--   yard_note     Why the trip's count differs  the Manager  trip.difference
--
-- Through 0120's outbox (ow_push), addressed by task so it follows
-- docs/decision-rights.md and never reaches the owner; the Buyer who passed
-- it on is never pushed about it; one push per hand-off (dedupe). The
-- trigger runs after the write and never stops it.
--
-- Applied by hand, after 0120 (the outbox), 0125 (buyer_handoffs) and 0131
-- (ow_first_name). On a database without buyer_handoffs it is skipped and
-- named; run the file again once 0125 is in. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname = 'buyer_handoffs_ow_push3';
--
-- ROLLBACK:
--   drop trigger if exists buyer_handoffs_ow_push3 on buyer_handoffs;
--   drop function if exists buyer_handoffs_ow_push3();
-- ---------------------------------------------------------------------

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

do $$
begin
  if to_regclass('public.buyer_handoffs') is null then
    raise notice 'skipped buyer_handoffs_ow_push3: buyer_handoffs is not on this database yet. Run this file again once 0125 is in.';
  else
    drop trigger if exists buyer_handoffs_ow_push3 on buyer_handoffs;
    create trigger buyer_handoffs_ow_push3 after insert on buyer_handoffs
      for each row execute function buyer_handoffs_ow_push3();
  end if;
end $$;
