-- Two handoffs the Buyer canvas promises and nothing sent yet:
--
--   sourcing.found  Sourcing found a supplier   the Buyer who marked the line
--                   for a line nobody had       "client waits" (droppedBy),
--                                               else the Buyer (supplier.confirm)
--   trip.short      A trip came back short      each short order's salesperson
--                   on an order's line          (takenBy), else Sales (quote.make)
--
-- "Client waits" on a line nobody sells (buyer.html, Find a supplier) is how
-- the Buyer asks Sourcing to find one: 0139 makes it a Sourcing request and
-- 0131 pushes Sourcing. When the request leaves asked/looking (sourced,
-- priced or listed), the Buyer who sent it is pushed, so they ask the new
-- supplier. When a trip is handed in, the salesperson of every order with a
-- short line is told what is short; the line stays on the buying list.
--
-- Through 0120's outbox (ow_push): whoever made the write is never pushed
-- about it, one push per thing (dedupe), and the triggers run after the
-- write and never stop it.
--
-- Applied by hand, after 0120 (the outbox), 0126 (sourcing_leads), 0131
-- (ow_first_name) and 0139 (client-waits requests). A table this database
-- does not have yet is skipped and named; run the file again once it is
-- in. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname in ('sourcing_leads_ow_push4', 'collection_trips_ow_push4');
--
-- ROLLBACK:
--   drop trigger if exists sourcing_leads_ow_push4 on sourcing_leads;
--   drop trigger if exists collection_trips_ow_push4 on collection_trips;
--   drop function if exists sourcing_leads_ow_push4();
--   drop function if exists collection_trips_ow_push4();
-- ---------------------------------------------------------------------

-- 1. Sourcing found a supplier for a line the client waits for.
create or replace function sourcing_leads_ow_push4() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  who uuid;
  src text := coalesce(ow_first_name(new.shop_id, auth.uid()), 'Sourcing');
begin
  if coalesce(new.voided, false) or tg_op <> 'UPDATE' then return null; end if;
  if new.status not in ('sourced', 'priced', 'listed') or old.status not in ('asked', 'looking') then return null; end if;
  for r in
    select e from jsonb_array_elements(case when jsonb_typeof(new.requests) = 'array' then new.requests else '[]'::jsonb end) e
     where e ->> 'source' = 'dropped' and coalesce(e ->> 'withdrawn', '') not in ('true')
  loop
    begin
      who := ow_uuid(r ->> 'droppedBy');
      perform ow_push(new.shop_id, 'sourcing.found', src || ' found a supplier',
        coalesce(new.name, 'An item') || coalesce(' for ' || nullif(btrim(coalesce(r ->> 'customerName', '')), ''), '')
          || ' · ask them, the client waits',
        who, case when who is null then 'supplier.confirm' end, null,
        jsonb_build_object('table', 'sourcing_leads', 'id', new.id, 'orderId', r ->> 'orderId'),
        'found:' || new.id || ':' || coalesce(r ->> 'orderId', '') || ':' || coalesce(r ->> 'droppedBy', ''));
    exception when others then
      raise notice 'push (found): % (%)', sqlerrm, sqlstate;
    end;
  end loop;
  return null;
exception when others then
  raise notice 'push (found): % (%)', sqlerrm, sqlstate;
  return null;
end $$;

-- 2. A trip handed in short: each order's salesperson, once per trip.
create or replace function collection_trips_ow_push4() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o record;
  sup text;
begin
  if coalesce(new.voided, false) then return null; end if;
  if new.status <> 'collected' or (tg_op = 'UPDATE' and old.status is not distinct from 'collected') then return null; end if;
  select s.name into sup from suppliers s where s.shop_id = new.shop_id and s.id = new.supplier_id;
  for o in
    select l ->> 'orderId' as order_id,
           string_agg(trim_scale(ow_num(l ->> 'qty') - ow_num(l ->> 'gotQty'))::text || ' ' || coalesce(nullif(l ->> 'productName', ''), 'items'), ', ') as what
      from jsonb_array_elements(case when jsonb_typeof(new.lines) = 'array' then new.lines else '[]'::jsonb end) l
     where coalesce(l ->> 'orderId', 'restock') <> 'restock'
       and l ? 'gotQty' and ow_num(l ->> 'gotQty') < ow_num(l ->> 'qty')
     group by l ->> 'orderId'
  loop
    begin
      perform ow_push(new.shop_id, 'trip.short', 'Short from ' || coalesce(sup, 'the supplier'),
        coalesce(nullif(btrim(coalesce(q.client_name, '')), ''), 'An order') || ' — ' || o.what || ' short · back on the buying list',
        q.taker, case when q.taker is null then 'quote.make' end, null,
        jsonb_build_object('table', 'collection_trips', 'id', new.id, 'orderId', o.order_id),
        'tripshort:' || new.id || ':' || o.order_id)
      from (select sq.client_name,
                   case when exists (
                     select 1 from shop_members m join role_tasks rt on rt.role = m.role and rt.task = 'quote.make'
                      where m.shop_id = new.shop_id and m.user_id = ow_uuid(sq.payload ->> 'takenBy')
                        and not exists (select 1 from shop_task_off x where x.shop_id = m.shop_id and x.role = m.role and x.task = 'quote.make'))
                   then ow_uuid(sq.payload ->> 'takenBy') end as taker
              from saved_quotes sq
             where sq.shop_id = new.shop_id and sq.id::text = o.order_id) q;
    exception when others then
      raise notice 'push (short %): % (%)', o.order_id, sqlerrm, sqlstate;
    end;
  end loop;
  return null;
exception when others then
  raise notice 'push (short): % (%)', sqlerrm, sqlstate;
  return null;
end $$;

do $$
begin
  if to_regclass('public.sourcing_leads') is null then
    raise notice 'skipped sourcing_leads_ow_push4: sourcing_leads is not on this database yet. Run this file again once 0126 is in.';
  else
    drop trigger if exists sourcing_leads_ow_push4 on sourcing_leads;
    create trigger sourcing_leads_ow_push4 after update on sourcing_leads
      for each row execute function sourcing_leads_ow_push4();
  end if;
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips_ow_push4: collection_trips is not on this database yet.';
  else
    drop trigger if exists collection_trips_ow_push4 on collection_trips;
    create trigger collection_trips_ow_push4 after insert or update on collection_trips
      for each row execute function collection_trips_ow_push4();
  end if;
end $$;
