-- Shop creation stops being a client power.
--
-- With email verification off, anyone who found the login page could sign
-- up and stand up a shop: the "any authenticated user can create a shop"
-- policy let the insert through, and the bootstrap arm of the invites
-- policy let them file themselves as its owner. One stranger shop existed
-- (the vimbopay one, deleted 2026-08-07). This app runs ONE shop; a new
-- one is created by the operator in the SQL editor, not by whoever signs
-- up.
drop policy if exists "any authenticated user can create a shop" on shops;

-- The bootstrap arm existed only so a shop's creator could file the first
-- membership row. With client-side creation gone it is a leftover door --
-- a user who once created a shop could still re-file themselves into it.
-- Membership rows now come from an admin's session or from the
-- invite-worker function, which writes with the service role and is not
-- subject to RLS at all.
drop policy if exists "bootstrap owner or admin invites" on shop_members;
create policy "admin invites only" on shop_members
  for insert
  to authenticated
  with check (is_shop_admin(shop_id));
