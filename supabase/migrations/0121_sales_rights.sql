-- Sales under the decision rights (docs/decision-rights.md, number 0121).
--
-- What this grants the Sales login, and nothing more:
--
--   promise.record  a customer's promise to pay: how much and by when.
--                   The salesperson at the counter hears it first. The
--                   Manager sees it (Told); nobody approves it.
--
-- The rest of what the Sales app now shows needs no grant here:
--
--   * A price under the shop's waits for the Manager. Sales already
--     writes priceNote / priceBy / priceShop / priceAt on the line
--     (quote.make). The Manager's decision, priceReview, is written by
--     the price.approve build (0122) and read by the Sales app.
--   * An order filled entirely from our own shelf is placed at Packing,
--     not Checking: there is no supplier to ask. The Checking gate the
--     shared foundation adds (0119) still holds any order with a price
--     or credit decision waiting, and the app never skips those.
--   * Asking for a void or a credit note is a row in invoice_asks, which
--     the Accounts build (0123) creates and lets Sales add to.
--
-- Not built here, and still planned in the table: counter.sell (needs
-- the one invoicing function, 0119) and sourcing.ask (needs the Sourcing
-- requests, 0126).
--
-- payment_promises (0089) let only the owner write. The policies below
-- are drawn exactly as 0123 draws them for Accounts, so whichever of the
-- two runs first, the result is the same: the task, not the role, opens
-- the door.
--
-- Applied by hand like every migration here. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select task from role_tasks where role = 'sales' order by task;
--   -- 7 rows, promise.record among them
--
-- ROLLBACK:
--   delete from role_tasks where role = 'sales' and task = 'promise.record';

insert into role_tasks (role, task) values
  ('sales', 'promise.record')
on conflict do nothing;

do $$
begin
  if to_regclass('public.payment_promises') is null then
    raise notice 'skipped payment_promises: not on this database';
    return;
  end if;
  drop policy if exists "owner writes only" on payment_promises;
  drop policy if exists "owner updates only" on payment_promises;
  drop policy if exists "owner or treasurer writes" on payment_promises;
  drop policy if exists "owner or treasurer updates" on payment_promises;
  create policy "owner or treasurer writes" on payment_promises
    as restrictive for insert with check (is_shop_admin(shop_id) or has_task(shop_id, 'promise.record'));
  create policy "owner or treasurer updates" on payment_promises
    as restrictive for update using (is_shop_admin(shop_id) or has_task(shop_id, 'promise.record'))
    with check (is_shop_admin(shop_id) or has_task(shop_id, 'promise.record'));
end $$;
