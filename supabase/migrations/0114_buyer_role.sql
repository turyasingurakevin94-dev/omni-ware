-- A Buyer login: the person who checks orders with suppliers, plans the
-- collection trips and rides them (buyer.html).
--
-- 0113 allowed the role and gave it no tasks. Everything the Buyer app
-- writes was already open to any shop member, and stays so:
--
--   saved_quotes      a supplier's answer on an order (supplierConfirms),
--                     switching a line to another supplier or the shelf,
--                     dropping a line in Checking (droppedLines, now with
--                     a reason), a new price the supplier gave, and the
--                     order leaving Checking when the last supplier says
--                     yes -- the same moves the owner's board makes.
--   collection_trips  making a trip from the buying list, taking it,
--                     saying what came back and handing it in.
--
-- What stays the owner's, at the database, exactly as 0083 left it:
-- checking a trip in (stock, supplier bills), paying suppliers, editing
-- suppliers and the price registry, sourcing.
--
-- This migration adds two things:
--
--   1. The Buyer's tasks in role_tasks, so the app can read what its
--      login opens and a later policy can be written against has_task()
--      the way 0113 did for Sales. No policy changes here.
--   2. collection_trips.cash_given: the money handed over for a trip, so
--      the trip can say what should come back. Null is "nobody said".
--
-- Migrations are applied by hand. Safe to run twice.
--
-- MAKE SOMEBODY A BUYER:
--   update shop_members set role = 'buyer'
--   where shop_id = 'YOUR-SHOP-ID' and user_id = 'THEIR-USER-ID';
-- and give them a staff row with user_id set, so trips can be assigned to
-- them (the trip's assigned_worker_id is a staff id).
--
-- ROLLBACK:
--   delete from role_tasks where role = 'buyer';
--   alter table collection_trips drop column if exists cash_given;

insert into role_tasks (role, task) values
  ('buyer', 'supplier.confirm'),
  ('buyer', 'line.switch'),
  ('buyer', 'line.drop'),
  ('buyer', 'line.reprice'),
  ('buyer', 'trip.plan'),
  ('buyer', 'trip.collect')
on conflict do nothing;

do $$
begin
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips.cash_given: table not on this database';
  else
    alter table collection_trips add column if not exists cash_given numeric;
    alter table collection_trips drop constraint if exists collection_trips_cash_given_check;
    alter table collection_trips add constraint collection_trips_cash_given_check
      check (cash_given is null or cash_given >= 0);
  end if;
end $$;
