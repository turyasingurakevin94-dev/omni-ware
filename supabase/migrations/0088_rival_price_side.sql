-- Which side of the counter a rival's price was.
--
-- 0087 recorded what another shop charges and said nothing about WHICH
-- PRICE that was. Every reading then compared it against this shop's
-- WHOLESALE price, because that is the only side the market screens
-- ever asked the ladder for.
--
-- A shelf ticket in a rival's shop is usually a RETAIL price. Compared
-- against a wholesale price it is not a gap at all -- it is the
-- difference between two different things, and the screen was then
-- ranking that difference by money and putting it at the top.
--
-- The ladder has always had both sides: a product carries
-- stock_wholesale_markup_* and stock_retail_markup_*, the printed
-- catalogue makes the reader choose which one sets the price, and a
-- quote line picks a side from quantity against pack size. Only the
-- market record had nowhere to say it.
--
-- NULLABLE WITH NO DEFAULT, and nothing is back-filled. An observation
-- is removed but never rewritten -- every argument the manager makes
-- from this table rests on that -- so a row already on file cannot be
-- told which side it was. Null means NOBODY SAID, which is the honest
-- state of every row written before today. The app reads those against
-- the wholesale price, because that is the price the screen was showing
-- beside them when somebody typed them in, and it says so on the row
-- rather than letting the assumption pass as a fact.
--
-- The client probes for this column before writing it, the way it
-- probes for every hand-applied migration: PostgREST refuses a whole
-- insert for one unknown column, so a shop with 0087 and not 0088 would
-- lose the sighting entirely rather than lose the side.

alter table rival_prices
  add column if not exists side text;

alter table rival_prices drop constraint if exists rival_prices_side_check;
alter table rival_prices add constraint rival_prices_side_check
  check (side is null or side in ('wholesale', 'retail'));

comment on column rival_prices.side is
  'Which of this shop''s two prices the sighting should be compared against: wholesale (by the pack) or retail (by the piece). Null means nobody said, which is every row written before this column existed -- read as wholesale, and said out loud as an assumption rather than shown as a fact.';

-- Look first: how much of the record has a side on it.
-- select coalesce(side, 'not said') as side, count(*)
--   from rival_prices group by 1 order by 2 desc;
