-- A pairing can name a size, at either end.
--
-- A pairing says "buy these with those", and prices and stock are both
-- kept per SIZE. Most of this shop's products come in sizes, so a
-- picture has to settle which size before it can put a figure beside a
-- companion. It already does that from what the books say -- the size
-- this customer buys, the only size priced, the size matching the
-- first product's -- and where none of those settle it the line is left
-- off and the owner is told to "point the pairing at the size you
-- mean". Until now there was nowhere to point it.
--
-- TWO NULLABLE COLUMNS, one per end of the sentence.
--   from_variant_idx  null = the sentence holds for every size of the
--                     first product; a number = for that size only.
--   to_variant_idx    null = "the size that follows", which the picture
--                     works out; a number = that size of the second.
-- A sentence written for one size sits beside the general one and wins
-- for that size, so "Runners goes with Soft Close" and "Runners 16"
-- goes with Soft Close 18"" are both on file and neither is repeated
-- per size.
--
-- Integer indexes into the product's variants, as every other size
-- reference in this app is (prices, stock, order lines), so a size
-- renamed in the catalogue stays the same size here. Not foreign keys,
-- like to_id itself: a product may leave the catalogue, and the
-- pairing simply stops resolving.
--
-- SAFE TO RUN TWICE: add column if not exists is idempotent, and a shop
-- that ran the first cut of this file (one column) gets the second by
-- running it again. The app probes for BOTH columns on load and neither
-- reads nor writes them until both are there, so this can be pasted
-- before or after the release.

alter table product_links add column if not exists to_variant_idx integer;
alter table product_links add column if not exists from_variant_idx integer;

-- Which pairings name a size:
-- select from_id, from_variant_idx, to_id, to_variant_idx from product_links
--   where to_variant_idx is not null or from_variant_idx is not null order by 1, 2;
