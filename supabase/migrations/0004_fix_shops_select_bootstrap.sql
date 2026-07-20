-- Fixes the real cause of "new row violates row-level security policy for
-- table shops" on shop creation. It was never the INSERT policy (checked
-- and re-checked in 0003) -- it's the SELECT policy.
--
-- The app does `sb.from('shops').insert({...}).select().single()`. A
-- RETURNING clause on INSERT requires the new row to also satisfy any
-- applicable FOR SELECT policy, not just the INSERT policy's WITH CHECK --
-- and Postgres reports a failure of either one with the same error text,
-- which is what made this look like an INSERT-policy problem.
--
-- The old SELECT policy only allowed rows visible via is_shop_member(id),
-- but the creator isn't a shop_members row yet at insert time (that insert
-- happens second, after this one returns). Bootstrap the creator the same
-- way "bootstrap owner or admin invites" already does for shop_members.

drop policy if exists "members can view their shop" on shops;
create policy "members can view their shop" on shops
  for select
  to authenticated
  using (is_shop_member(id) or created_by = auth.uid());
