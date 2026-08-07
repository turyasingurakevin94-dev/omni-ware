-- After the wipes: deleting shop data becomes an owner-only power.
--
-- The client-side sync engine had two delete-storm bugs (the non-atomic
-- refresh, fixed 0aug1 in a834540; the worker app's unmeant deletes,
-- guarded aug2 in 64a7aed) -- but a staff phone running an APK built
-- BEFORE those fixes still carries them, and no web deploy can reach it.
-- This policy defangs every stale client at the server: a RESTRICTIVE
-- policy ANDs with the existing permissive "shop members full access"
-- ones, so members keep reading and writing, but DELETE now also
-- requires the session to belong to the shop's owner.
--
-- wa_* tables are untouched: they are already read-only to clients.

create or replace function is_shop_owner(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from shop_members
    where shop_id = p_shop_id and user_id = auth.uid() and role = 'owner'
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'suppliers','staff','agents','customers','customer_debt_log',
    'products','prices','stock','stock_lots','stock_log',
    'cash_days','cash_txns','saved_quotes','purchase_invoices',
    'supplier_commissions','fixed_assets','loans','rent_agreements',
    'dues','media','media_folders','wa_posts'
  ] loop
    execute format(
      'create policy "owner only deletes" on %I as restrictive for delete using (is_shop_owner(shop_id))', t);
  end loop;
end $$;
