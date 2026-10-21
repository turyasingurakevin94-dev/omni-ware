-- 0147 Buyer, third: a round is handed in once.
--
-- The Buyer's round (Plan the round) is one trip per stop, started in one
-- slide; their ids share a stem, TRIP-<stamp>-1, TRIP-<stamp>-2, ... The
-- Buyer now says "Done here" at each stop and hands the whole round in once,
-- back at the yard: every stop becomes 'collected' in the same hand-in.
--
-- 0120 told the Store ("count it in") and Accounts ("settle its cash") once
-- per trip, so a round of eight told Musa and Esther eight times. They are
-- now told once per round: the push is keyed on the round (ow_trip_round),
-- and says how many stops came back with it. A single trip reads as before.
-- The yard difference stays per trip: each is its own count.
--
-- Applied by hand, after 0120 (ow_push, collection_trips_ow_push).
-- Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select ow_trip_round('TRIP-MG3K2A-3'), ow_trip_round('TRIP-MG3K2A');   -- TRIP-MG3K2A twice
--   select tgname from pg_trigger where tgname = 'collection_trips_ow_push';
--
-- ROLLBACK: run section 3b of 0120_push_for_every_app.sql again, then
--   drop function if exists ow_trip_round(text);
-- ---------------------------------------------------------------------

-- The round a trip belongs to: its id without the stop number.
create or replace function ow_trip_round(p_id text) returns text
language sql immutable as $$
  select coalesce(substring(p_id from '^(TRIP-[A-Za-z0-9]+)-[0-9]+$'), p_id)
$$;

create or replace function collection_trips_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sup text;
  stops integer := 1;
  rnd text := ow_trip_round(new.id);
  ref jsonb := jsonb_build_object('table', 'collection_trips', 'id', new.id, 'round', ow_trip_round(new.id));
  lead text;
begin
  if coalesce(new.voided, false) then return null; end if;
  begin
    select s.name into sup from suppliers s where s.shop_id = new.shop_id and s.id = new.supplier_id;
    sup := coalesce(sup, 'the supplier');
    if new.status = 'collected' and (tg_op = 'INSERT' or old.status is distinct from 'collected') then
      if rnd <> new.id then
        select count(*) into stops from collection_trips c
         where c.shop_id = new.shop_id and not coalesce(c.voided, false) and ow_trip_round(c.id) = rnd;
      end if;
      lead := 'From ' || sup || case when stops > 1 then ' +' || (stops - 1) || ' · one round of ' || stops || ' stops' else '' end;
      perform ow_push(new.shop_id, 'trip.back', case when stops > 1 then 'A round is back — count it in' else 'A trip is back — count it in' end,
        lead || ': onto the shelf after the yard count.',
        null, 'stock.receive', null, ref, 'tripback:' || rnd || ':store');
      perform ow_push(new.shop_id, 'trip.cash', case when stops > 1 then 'A round is back — settle its cash' else 'A trip is back — settle its cash' end,
        lead || ': the change and the receipts.',
        null, 'trip.cash', null, ref, 'tripback:' || rnd || ':cash');
    end if;
    if new.yard_checked_at is not null and (tg_op = 'INSERT' or old.yard_checked_at is null)
       and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(new.lines) = 'array' then new.lines else '[]'::jsonb end) l
                    where l ? 'yardQty' and ow_num(l ->> 'yardQty') is distinct from ow_num(l ->> 'gotQty')) then
      perform ow_push(new.shop_id, 'trip.difference', 'A trip came in short or over', 'From ' || sup || ': the yard''s count is not what the Buyer brought.',
        null, 'trip.difference', null, ref, 'tripdiff:' || new.id);
    end if;
  exception when others then
    raise notice 'push (trip %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists collection_trips_ow_push on collection_trips;
create trigger collection_trips_ow_push after insert or update on collection_trips
  for each row execute function collection_trips_ow_push();
