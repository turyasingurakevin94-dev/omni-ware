-- Assets, loans and the cash book were not wired together.
--
-- 0042 and 0043 gave fixed_assets and loans a cash_txn_id column, but
-- nothing ever wrote to them: adding a 20,000,000 asset raised the
-- register and moved no cash, so the balance sheet showed a shop richer
-- for having spent the money. Drawing a loan did the reverse. The app now
-- writes those entries, and the existing columns hold the link.
--
-- Selling an asset is the one movement with nowhere to record itself. The
-- proceeds are money coming IN, a second and separate cash-book entry from
-- the one that paid for the thing, so it needs its own column rather than
-- overwriting the purchase link.
--
-- Without this column the id is dropped on the next sync, and the guard
-- that stops a disposal being banked twice ("has this asset already
-- written a receipt?") reads null again after a reload -- so re-saving a
-- sold asset to fix a typo would bank the proceeds a second time.

alter table public.fixed_assets
  add column if not exists disposal_cash_txn_id bigint;

comment on column public.fixed_assets.disposal_cash_txn_id is
  'The cash_txns row recording the proceeds when this asset was sold. Null while the asset is still in use, or when the sale was not put through the cash book. Deleting the asset removes this entry with it.';
