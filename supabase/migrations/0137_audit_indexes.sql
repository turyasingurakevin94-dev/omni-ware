-- 0137: the audit of 19 October 2026, part two: the indexes the apps' reads
-- and the hourly jobs were missing. Measured on a shop of 1,500 orders and
-- 3,000 cash lines: the cash book's date window, the stock log's date
-- window and the Store's "last count" read were sequential scans, and
-- ow_invoice_due_orders (0119, every hour) read every shop's whole order
-- table to find the handful delivered a day ago and not yet invoiced.
--
-- Safe to re-run. Each index is created only if it is not there.
create index if not exists cash_txns_shop_date_idx on cash_txns (shop_id, date);
create index if not exists stock_log_shop_date_idx on stock_log (shop_id, date);
create index if not exists stock_log_shop_counts_idx on stock_log (shop_id, id desc) where type in ('count', 'correction');
create index if not exists saved_quotes_shop_status_idx on saved_quotes (shop_id, status);
-- The hourly run's exact question (0119 ow_invoice_due_orders).
create index if not exists saved_quotes_due_invoice_idx on saved_quotes (shop_id) where status = 'completed' and not invoiced and not voided;
-- The orders a refresh reads: anything not delivered, not invoiced, voided, or invoiced lately.
create index if not exists saved_quotes_live_idx on saved_quotes (shop_id, invoiced_ts);
-- A login's own pushes, newest first (push_outbox's select policy, 0120).
do $$
begin
  if to_regclass('public.push_outbox') is not null then
    create index if not exists push_outbox_to_user_idx on push_outbox (to_user, id desc) where to_user is not null;
  end if;
end $$;
