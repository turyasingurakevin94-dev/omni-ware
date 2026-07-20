-- Re-applies the shops/shop_members policies that gate shop creation,
-- idempotently (drop-if-exists) and with the role scope made explicit
-- (`to authenticated`) rather than left implicit. The original 0001
-- policy was logically the same, so if this still fails after running it,
-- the cause isn't a missing policy -- see the diagnostic queries below.

drop policy if exists "any authenticated user can create a shop" on shops;
create policy "any authenticated user can create a shop" on shops
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "members can view their shop" on shops;
create policy "members can view their shop" on shops
  for select
  to authenticated
  using (is_shop_member(id));

drop policy if exists "bootstrap owner or admin invites" on shop_members;
create policy "bootstrap owner or admin invites" on shop_members
  for insert
  to authenticated
  with check (
    (user_id = auth.uid() and exists (
      select 1 from shops where id = shop_id and created_by = auth.uid()
    ))
    or is_shop_admin(shop_id)
  );

-- Diagnostics -- run these in the SQL editor if creating a shop still
-- fails after the above. Both should return exactly one row for the
-- insert case above; if they return zero rows, the policy really isn't
-- present (e.g. it errored earlier in a script run as one transaction).
--
-- select policyname, cmd, roles, with_check
--   from pg_policies where tablename = 'shops';
--
-- select policyname, cmd, roles, with_check
--   from pg_policies where tablename = 'shop_members';
--
-- If the policies ARE present and this still fails, the request itself
-- isn't authenticated as expected -- in the browser console, after
-- signing in, check that this returns a real uuid (not null/undefined)
-- immediately before the shop-creation click:
--
--   const { data } = await sb.auth.getUser(); console.log(data.user?.id);
