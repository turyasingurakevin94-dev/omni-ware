-- Lets a price entry be flagged as "this supplier doesn't currently have
-- it" without deleting the entry (so the historical price stays on file).
-- Out-of-stock entries are excluded from rankedPriceRows() and Compare
-- Prices, so they stop being recommended as a best-supplier option for
-- purchasing decisions until someone marks them back in stock.

alter table prices
  add column out_of_stock boolean not null default false;
