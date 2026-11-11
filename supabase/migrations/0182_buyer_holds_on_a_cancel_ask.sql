-- 0182 The Buyer holds an order while Sales' ask to cancel it waits
-- (Sales+Buyer cross-app round 1, BUY-1; docs/audit/cross-app/ROUND-1.md;
-- the Buyer canvas, board XR1Hold). 0181 lets Sales ask the Manager to
-- cancel; the Buyer kept asking suppliers and buying for the order, and
-- once it was on a live buying trip 0177's cancel_order refused the
-- cancel. Now the ask holds the order on the Buyer's side:
--
--   collection_trips_ow_hold   a trip line for an order with an open ask
--       (cancel_asks status 'sent') is refused when it is new on the row:
--       "#0604 is on hold: Daphine asked to cancel it. The manager decides
--       first." (OWHLD). Lines already on the row stay (an ask made after
--       the cash: the Buyer counts 0 for them and Ruth cancels after the
--       hand-in). A write with no login (the owner's console, the server)
--       is not judged.
--
--   cancel_asks_ow_push_buyer  the Buyer (trip.plan) is pushed, while the
--       order is still in Checking or Buying:
--         the ask         order.hold       "On hold · #0604"
--                         "Daphine asked Ruth to cancel · Muyanja · don't ask or buy it"
--         the Manager's no order.hold.kept "Not cancelled · #0604"
--                         "Ruth kept it · Muyanja · back to To ask"
--       A yes sends nothing new: the order is cancelled (0177 tells the
--       yard and the salesperson) and leaves the Buyer's lists. 0181's own
--       push trigger is left exactly as it is.
--
-- No role or task changes (the Buyer already reads cancel_asks: 0181's
-- policy keeps out only the yard).
--
-- Applied by hand, after 0181. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname in ('collection_trips_ow_hold', 'cancel_asks_ow_push_buyer');
--
-- ROLLBACK:
--   drop trigger if exists collection_trips_ow_hold on collection_trips;
--   drop function if exists collection_trips_ow_hold();
--   drop trigger if exists cancel_asks_ow_push_buyer on cancel_asks;
--   drop function if exists cancel_asks_ow_push_buyer();
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. No new trip line for an order on hold.
create or replace function collection_trips_ow_hold() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  held bigint;
  asker text;
begin
  if auth.uid() is null then return new; end if;
  select a.quote_id, coalesce(nullif(split_part(btrim(coalesce(a.asked_by_name, '')), ' ', 1), ''), 'Sales')
    into held, asker
    from jsonb_array_elements(case when jsonb_typeof(new.lines) = 'array' then new.lines else '[]'::jsonb end) l
    join cancel_asks a on a.shop_id = new.shop_id and a.status = 'sent' and a.quote_id::text = (l ->> 'orderId')
   where tg_op = 'INSERT'
      or not exists (
           select 1 from jsonb_array_elements(case when jsonb_typeof(old.lines) = 'array' then old.lines else '[]'::jsonb end) o
            where (o ->> 'orderId') = (l ->> 'orderId') and coalesce(o ->> 'lineId', '') = coalesce(l ->> 'lineId', ''))
   limit 1;
  if held is not null then
    raise exception '#% is on hold: % asked to cancel it. The manager decides first.', lpad(held::text, 4, '0'), asker
      using errcode = 'OWHLD';
  end if;
  return new;
end $$;
drop trigger if exists collection_trips_ow_hold on collection_trips;
create trigger collection_trips_ow_hold before insert or update of lines on collection_trips
  for each row execute function collection_trips_ow_hold();

-- ---------------------------------------------------------------------
-- 2. The Buyer is told: the hold, and the Manager's no.
create or replace function cancel_asks_ow_push_buyer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  client text;
  q_status text;
  lbl text := '#' || lpad(new.quote_id::text, 4, '0');
  asker text := coalesce(nullif(split_part(btrim(coalesce(new.asked_by_name, '')), ' ', 1), ''), 'Sales');
  mgr text;
  who text;
  ref jsonb := jsonb_build_object('table', 'cancel_asks', 'id', new.id, 'quote', new.quote_id, 'orderId', new.quote_id);
begin
  begin
    select coalesce(nullif(btrim(coalesce(q.client_name, '')), ''), nullif(btrim(coalesce(q.payload -> 'client' ->> 'name', '')), '')), q.status
      into client, q_status from saved_quotes q where q.shop_id = new.shop_id and q.id = new.quote_id;
    -- Only while the Buyer works the order: Checking or Buying.
    if q_status is null or q_status not in ('draft', 'awaiting_goods') then return null; end if;
    if tg_op = 'INSERT' and new.status = 'sent' then
      mgr := coalesce((select nullif(split_part(btrim(m.display_name), ' ', 1), '') from shop_members m
                        where m.shop_id = new.shop_id and m.role = 'manager' order by m.user_id limit 1), 'the manager');
      perform ow_push(new.shop_id, 'order.hold', 'On hold · ' || lbl,
        asker || ' asked ' || mgr || ' to cancel' || coalesce(' · ' || client, '') || ' · don''t ask or buy it',
        null, 'trip.plan', null, ref, 'hold:' || new.id);
    elsif tg_op = 'UPDATE' and old.status = 'sent' and new.status = 'declined' then
      who := coalesce((select nullif(split_part(btrim(m.display_name), ' ', 1), '') from shop_members m
                        where m.shop_id = new.shop_id and m.user_id = new.decided_by limit 1),
                      ow_first_name(new.shop_id, new.decided_by), 'The manager');
      perform ow_push(new.shop_id, 'order.hold.kept', 'Not cancelled · ' || lbl,
        who || ' kept it' || coalesce(' · ' || client, '') || ' · back to To ask',
        null, 'trip.plan', null, ref, 'holdkept:' || new.id);
    end if;
  exception when others then
    raise notice 'push (hold): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists cancel_asks_ow_push_buyer on cancel_asks;
create trigger cancel_asks_ow_push_buyer after insert or update on cancel_asks
  for each row execute function cancel_asks_ow_push_buyer();
