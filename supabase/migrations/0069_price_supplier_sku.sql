-- The code THIS supplier uses for this item.
--
-- Two suppliers stocking the same runner call it two different things on
-- their invoices, so the code belongs to the price row (product + variant
-- + supplier), not to the product. The product's own SKU stays where it
-- is on the variant.
--
-- Nullable: most rows will not have one, and a blank is the absence of a
-- code rather than an empty code.
alter table public.prices
  add column if not exists supplier_sku text;

comment on column public.prices.supplier_sku is
  'The code this supplier uses for this item on their own quotes and invoices. Distinct from the variant SKU, which is ours.';
