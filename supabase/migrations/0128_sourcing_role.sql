-- The Sourcing login role: somebody who finds new items and suppliers and
-- keeps the price list right signs in to the Sourcing app (sourcing.html).
--
-- docs/decision-rights.md planned the role as part of the shared foundation
-- (0119). The foundation's other parts -- the Checking gate, the one
-- invoicing function and the 24-hour automatic invoice -- are still to be
-- built, and the owner chose not to wait on them: this adds the role alone,
-- under the next number after the reserved ones (section 5), and 0119 stays
-- the foundation's.
--
-- 0113 made the role check the one list every membership is held to. This
-- adds 'sourcing' to it and changes nothing else: what a Sourcing login may
-- write is its role_tasks (0126), and without them it may write nothing a
-- worker cannot.
--
-- Migrations are applied by hand. Safe to run twice.
--
-- MAKE SOMEBODY SOURCING: in the console's Staff form pick "Sources" and
-- invite them (or move their existing login), or by hand:
--   update shop_members set role = 'sourcing'
--   where shop_id = 'YOUR-SHOP-ID' and user_id = 'THEIR-USER-ID';
--
-- CHECK AFTERWARDS:
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'shop_members_role_check';
--
-- ROLLBACK (only once nobody holds the role):
--   update shop_members set role = 'staff' where role = 'sourcing';
--   then re-run the constraint from 0113.

alter table shop_members drop constraint if exists shop_members_role_check;
alter table shop_members add constraint shop_members_role_check
  check (role in ('owner', 'admin', 'staff', 'sales', 'manager', 'buyer', 'store', 'accounts', 'sourcing'));
