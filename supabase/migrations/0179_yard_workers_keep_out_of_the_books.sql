-- 0179 Yard workers keep out of the books (docs/spec/05-data.md §8 Q1 and
-- Q2, Kevin 28 Oct 2026).
--
-- 0164 kept a Store login to the yard's own functions (ow_yard_only), so it
-- reads no money. A yard worker logs in as 'staff' (invite-worker), and
-- ow_yard_only names 'store' alone: a staff login could read every table a
-- member can -- the cash book, every customer's debt, the supplier bills,
-- payroll, the owner's log. Checked on 28 Oct: a staff login read
-- cash_txns and customers; a Store login read none.
--
-- The worker app (worker.html, left as it is while the rebuild goes on)
-- reads and writes orders, trips, products, suppliers, staff, agents and
-- the settings directly, so 'staff' cannot be shut out the way 'store' is
-- without breaking it. Instead:
--
--   1. A staff login is refused the money and customer tables the worker
--      app never reads (a restrictive "not a yard worker" policy, every
--      operation): cash_txns, cash_days, customers, customer_debt_log,
--      purchase_invoices, dues, loans, fixed_assets, rent_agreements,
--      supplier_commissions, decision_log, payment_asks, invoice_asks,
--      payment_promises, statements_sent, agent_commission_claims,
--      shop_payment_providers, fresh_starts, manager_notes, briefs_sent,
--      login_sessions. The server's own functions and triggers run as the
--      database and are not affected; the three order triggers that run as
--      the caller touch none of these tables.
--   2. 'staff' holds the yard's tasks -- order.pick, order.load,
--      order.deliver -- as docs/decision-rights.md now says, so the rule
--      lives in role_tasks and not in role names written into functions
--      (0164's store_patch_order, 0178).
--
-- Not closed here: an order's prices and payments, which the worker app
-- reads in saved_quotes. That needs the worker app to read through a
-- stripped function, as the Store does (0164 ow_store_payload).
--
-- Applied by hand, after 0178. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select count(*) from pg_policy where polname = 'not a yard worker';   -- 21
--   select task from role_tasks where role = 'staff' order by 1;          -- order.deliver, order.load, order.pick
--
-- ROLLBACK:
--   do $r$ declare t text; begin
--     foreach t in array array['cash_txns','cash_days','customers','customer_debt_log','purchase_invoices','dues','loans','fixed_assets',
--       'rent_agreements','supplier_commissions','decision_log','payment_asks','invoice_asks','payment_promises','statements_sent',
--       'agent_commission_claims','shop_payment_providers','fresh_starts','manager_notes','briefs_sent','login_sessions'] loop
--       execute format('drop policy if exists "not a yard worker" on %I', t);
--     end loop; end $r$;
--   drop function if exists ow_yard_worker(uuid);
--   delete from role_tasks where role = 'staff' and task in ('order.pick', 'order.load', 'order.deliver');
-- ---------------------------------------------------------------------

-- Whether the caller is a yard worker (a staff login) in this shop.
create or replace function ow_yard_worker(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.role = 'staff');
$$;
revoke all on function ow_yard_worker(uuid) from public, anon;
grant execute on function ow_yard_worker(uuid) to authenticated;

do $mig$
declare t text;
begin
  foreach t in array array['cash_txns', 'cash_days', 'customers', 'customer_debt_log', 'purchase_invoices', 'dues', 'loans', 'fixed_assets',
    'rent_agreements', 'supplier_commissions', 'decision_log', 'payment_asks', 'invoice_asks', 'payment_promises', 'statements_sent',
    'agent_commission_claims', 'shop_payment_providers', 'fresh_starts', 'manager_notes', 'briefs_sent', 'login_sessions'] loop
    execute format('drop policy if exists "not a yard worker" on %I', t);
    execute format('create policy "not a yard worker" on %I as restrictive for all to authenticated '
                   'using (not ow_yard_worker(shop_id)) with check (not ow_yard_worker(shop_id))', t);
  end loop;
end $mig$;

insert into role_tasks (role, task) values ('staff', 'order.pick'), ('staff', 'order.load'), ('staff', 'order.deliver') on conflict do nothing;
