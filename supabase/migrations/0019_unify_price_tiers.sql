-- Collapses the separate wholesale_tiers/retail_tiers ladders (0017) into
-- one unified tiers column. Wholesale and retail were never actually two
-- independent things to configure -- they're just two points on the same
-- quantity/price curve a supplier quotes (loose price vs. carton price),
-- so forcing a second parallel ladder made someone re-enter the same
-- breakpoint twice. A single tier now auto-classifies as the wholesale
-- side or the retail side purely by comparing its own minQty to the
-- entry's pack_qty (same rule already used everywhere else in the app to
-- decide which of the two applies), so nothing else about how wholesale
-- vs retail is resolved changes -- only where the extra breakpoints live.
alter table prices add column tiers jsonb not null default '[]'::jsonb;

update prices
  set tiers = coalesce(wholesale_tiers, '[]'::jsonb) || coalesce(retail_tiers, '[]'::jsonb)
  where jsonb_array_length(coalesce(wholesale_tiers, '[]'::jsonb)) > 0
     or jsonb_array_length(coalesce(retail_tiers, '[]'::jsonb)) > 0;

alter table prices drop column wholesale_tiers;
alter table prices drop column retail_tiers;
