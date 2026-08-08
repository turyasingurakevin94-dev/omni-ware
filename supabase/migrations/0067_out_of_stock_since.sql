-- When a supplier's price row was marked out of stock.
--
-- The flag on its own could say THAT a supplier had run out but not for
-- how long, so the quote screen could not tell "ran out this morning"
-- from "ran out in March". Nullable on purpose: rows flagged before this
-- column existed have no date, and the app reports those as "date not
-- recorded" rather than inventing a zero.
alter table public.prices
  add column if not exists out_of_stock_since date;

comment on column public.prices.out_of_stock_since is
  'Date this row was marked out of stock; null when in stock, or when the row was flagged before this column existed.';
