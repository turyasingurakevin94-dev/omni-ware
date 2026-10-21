-- 0150 Buyer, fourth: a trip's runner is told.
--
-- A trip sent to somebody waited on them in silence: nothing pushed the
-- runner when a trip (or a round) was sent, and when the Buyer chased a trip
-- nobody had taken -- giving it to someone else, or cancelling it -- neither
-- runner heard. Every hand-off that waits on someone pushes that person
-- (docs/decision-rights.md), so collection_trips_ow_push now also:
--
--   trip.sent       the runner a trip is sent or given to, once per round
--   trip.taken      the runner a trip is taken from, when it is given on
--   trip.cancelled  the runner of a trip the Buyer cancels (voided, note
--                   'Cancelled…'); its lines go back to To plan
--
-- Everything 0147 did stays as it was. Applied by hand, after 0147.
-- Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname = 'collection_trips_ow_push';
--   select kind, title, body from push_outbox where kind like 'trip.%' order by id desc limit 5;
--
-- ROLLBACK: run 0147_buyer_round_handed_in_once.sql again.
-- ---------------------------------------------------------------------

create or replace function collection_trips_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sup text;
  stops integer := 1;
  rnd text := ow_trip_round(new.id);
  ref jsonb := jsonb_build_object('table', 'collection_trips', 'id', new.id, 'round', ow_trip_round(new.id));
  lead text;
  runner uuid;
  was uuid;
  who text;
begin
  begin
    -- 0150: the runner a trip waits on is told, once per round; the runner it
    -- is taken from is told too, and so is the runner of a trip cancelled.
    if new.assigned_worker_id is not null and new.assigned_worker_id <> '__supplier__' then
      select s.user_id, s.name into runner, who from staff s where s.shop_id = new.shop_id and s.id = new.assigned_worker_id;
    end if;
    if tg_op = 'UPDATE' and old.assigned_worker_id is not null and old.assigned_worker_id <> '__supplier__' then
      select s.user_id into was from staff s where s.shop_id = new.shop_id and s.id = old.assigned_worker_id;
    end if;
    select s.name into sup from suppliers s where s.shop_id = new.shop_id and s.id = new.supplier_id;
    sup := coalesce(sup, 'the supplier');
    if tg_op = 'UPDATE' and coalesce(new.voided, false) and not coalesce(old.voided, false)
       and coalesce(new.note, '') ilike 'cancelled%' and was is not null then
      perform ow_push(new.shop_id, 'trip.cancelled', 'A trip is cancelled', 'The trip to ' || sup || ' is off: its lines are back on To plan.',
        was, null, null, ref, 'tripcancel:' || new.id);
    end if;
  exception when others then
    raise notice 'push (trip %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  if coalesce(new.voided, false) then return null; end if;
  begin
    if runner is not null and new.status = 'assigned'
       and (tg_op = 'INSERT' or old.assigned_worker_id is distinct from new.assigned_worker_id) then
      perform ow_push(new.shop_id, 'trip.sent', case when tg_op = 'INSERT' then 'A trip for you' else 'A trip is yours now' end,
        case when rnd <> new.id then 'A round, starting at ' || sup || ': open it to set off.' else 'To ' || sup || ': open it to set off.' end,
        runner, null, null, ref, 'tripsent:' || rnd || ':' || new.assigned_worker_id);
    end if;
    if tg_op = 'UPDATE' and was is not null and old.assigned_worker_id is distinct from new.assigned_worker_id then
      perform ow_push(new.shop_id, 'trip.taken', 'A trip went to someone else', 'The trip to ' || sup || ' is ' || coalesce(who, 'someone else') || '''s now.',
        was, null, null, ref, 'triptaken:' || new.id || ':' || old.assigned_worker_id);
    end if;
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
