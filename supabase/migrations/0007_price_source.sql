-- Tracks whether a price entry's current wholesale/retail value came from
-- someone editing it by hand in the Price Registry ('manual'), or was
-- picked up automatically because a stock purchase at that supplier was
-- recorded at a different price ('purchase'). Blank/null means the entry
-- predates this tracking and its origin isn't known.

alter table prices
  add column price_source text;
