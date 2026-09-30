-- What the Rivals side's "Feed the engine" form asks about a sighting,
-- beyond the one price 0087 kept.
--
--   in_stock   was it on their shelf: 'yes', 'low' or 'out'. A rival that
--              is out of a line cannot take the sale, and the tactical
--              engine reads that as room to hold or lift rather than as
--              a price to chase.
--   tiers      their volume steps, the same shape the registry keeps for
--              suppliers: [{"minQty": 50, "price": 39800}, ...], each
--              price per the sighting's unit. The row's own price stays
--              the price for one; a step only applies from its quantity.
--   source     how the shop knows: 'tag' (a shelf ticket), 'asked' (a
--              person asked them) or 'told' (a customer said). The
--              engine trusts a ticket more than hearsay.
--
-- NULLABLE WITH NO DEFAULT, nothing back-filled: a sighting is removed,
-- never rewritten, and a row written before this file cannot be told
-- any of it. Null means nobody said.
--
-- The client writes these only when the insert accepts them: a shop that
-- has not pasted this file keeps recording the price itself, exactly as
-- before, rather than losing the sighting to an unknown column.

alter table rival_prices add column if not exists in_stock text;
alter table rival_prices add column if not exists tiers jsonb;
alter table rival_prices add column if not exists source text;

alter table rival_prices drop constraint if exists rival_prices_in_stock_check;
alter table rival_prices add constraint rival_prices_in_stock_check
  check (in_stock is null or in_stock in ('yes', 'low', 'out'));

alter table rival_prices drop constraint if exists rival_prices_source_check;
alter table rival_prices add constraint rival_prices_source_check
  check (source is null or source in ('tag', 'asked', 'told'));
