-- Volume/tiered pricing: a price entry can quote a different unit price
-- once the ordered quantity crosses a threshold (e.g. 1,500/pc, but
-- 150,000/ctn once buying 12+ pcs, 1,400,000 once buying 120+ pcs).
-- Wholesale and retail get independent tier ladders since a supplier's
-- bulk discount and the shop's bulk selling discount don't necessarily
-- kick in at the same quantities. Each element is {minQty, price} with
-- minQty always expressed in the entry's base unit (pack-based
-- thresholds are converted to base units client-side before saving).
alter table prices
  add column wholesale_tiers jsonb not null default '[]'::jsonb,
  add column retail_tiers jsonb not null default '[]'::jsonb;
