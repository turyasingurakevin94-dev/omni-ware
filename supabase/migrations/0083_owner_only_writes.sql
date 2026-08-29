-- Writing the books becomes the owner's alone, at the database.
--
-- Until now the shop's money was guarded by the SCREENS. Every login
-- attached to the shop is a shop_member, and every books table carries
-- one permissive policy -- "shop members full access" (0001) -- so a
-- worker's phone, or anyone reaching the database directly instead of
-- through the app, could insert a cash payment or rewrite a debt. The
-- app would show nothing, because nothing in the app did it.
--
-- 0058 solved exactly this for DELETE and proved the shape: a
-- RESTRICTIVE policy ANDs with the permissive one, so members keep the
-- access they have and the new condition binds on top. This does the
-- same for INSERT and UPDATE.
--
-- WHAT THE WORKER APP KEEPS. worker.html writes exactly two tables --
-- saved_quotes and collection_trips, through addDiffOps, and never
-- deletes. They are deliberately NOT locked here: a picker must be able
-- to record a pick and a driver a collection. What may be written on
-- those rows is already fenced in the app (WORKER_OWNED_KEYS,
-- WORKER_STATUS_MOVES, the read-modify-write merge and neverDelete),
-- and that fence is where it belongs -- it is about which FIELDS move,
-- which no policy can express.
--
-- is_shop_admin (owner or admin, 0001) rather than is_shop_owner:
-- today the shop has one owner and staff, so this means the owner
-- alone, and it leaves room to promote a trusted manager later without
-- a second migration.
--
-- Agents are not shop_members (0012), and every edge function writes
-- with the service-role key, which bypasses RLS -- so agent orders, the
-- MoMo and Airtel webhooks, wa-webhook and notify-worker are unaffected.
--
-- THIS IS A WRITE BOUNDARY, NOT A READ ONE. A worker login can still
-- read the shop's data; the worker app needs products, prices and
-- orders to function at all.
--
-- LOOK FIRST -- who is attached to the shop, and with what rights:
--   select role, count(*) from shop_members
--   where shop_id = 'YOUR-SHOP-ID' group by role;
--
-- ROLLBACK -- restores exactly today's behaviour:
--   do $$ declare t text; begin
--     foreach t in array array[
--       'suppliers','customers','customer_debt_log','products','prices',
--       'stock','stock_lots','stock_log','cash_days','cash_txns',
--       'purchase_invoices','app_settings','staff','supplier_commissions',
--       'fixed_assets','loans','rent_agreements','dues','media',
--       'media_folders','wa_posts','wa_numbers','sourcing_leads',
--       'follow_ups','places','manager_notes','airtel_transactions'
--     ] loop
--       execute format('drop policy if exists "owner writes only" on %I', t);
--       execute format('drop policy if exists "owner updates only" on %I', t);
--     end loop;
--   end $$;

do $$
declare t text;
begin
  foreach t in array array[
    -- the books: money, debt, stock, prices and what they are worth
    'suppliers','customers','customer_debt_log','products','prices',
    'stock','stock_lots','stock_log','cash_days','cash_txns',
    'purchase_invoices','app_settings',
    -- who works here, what they are owed, and what the shop owns or owes
    'staff','supplier_commissions','fixed_assets','loans','rent_agreements','dues',
    -- the shop's own material and its outward voice
    'media','media_folders','wa_posts','wa_numbers',
    -- the working queues the owner alone keeps
    'sourcing_leads','follow_ups','places','manager_notes',
    -- payment records a client must never author
    'airtel_transactions'
    -- NOT saved_quotes, NOT collection_trips: see the note above.
  ] loop
    execute format(
      'create policy "owner writes only" on %I as restrictive for insert with check (is_shop_admin(shop_id))', t);
    execute format(
      'create policy "owner updates only" on %I as restrictive for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id))', t);
  end loop;
end $$;
