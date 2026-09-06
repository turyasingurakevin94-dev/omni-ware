-- A pairing can name a size.
--
-- A pairing says "buy these with those", and prices and stock are both
-- kept per SIZE. Where the second product comes in sizes, a picture has
-- to settle which one before it can put a figure beside it. It already
-- does that from what the books say -- the size this customer buys, the
-- only size priced, the size matching the first product's -- and where
-- none of those settle it the line is left off and the owner is told to
-- "point the pairing at the size you mean". Until now there was nowhere
-- to point it.
--
-- ONE NULLABLE COLUMN. Null is not "no size" but "the size that
-- follows", which is what every pairing written before this meant and
-- what most will go on meaning. An integer index into the product's
-- variants, as every other size reference in this app is (prices,
-- stock, order lines), so a size renamed in the catalogue stays the
-- same size here.
--
-- NOT A FOREIGN KEY, like to_id itself: the second product may leave
-- the catalogue, and the pairing simply stops resolving.
--
-- SAFE TO RUN TWICE: add column if not exists is idempotent. The app
-- probes for the column on load and neither reads nor writes it until
-- it is there, so this can be pasted before or after the release.

alter table product_links add column if not exists to_variant_idx integer;

-- Which pairings name a size:
-- select from_id, to_id, to_variant_idx from product_links
--   where to_variant_idx is not null order by 1, 2;
