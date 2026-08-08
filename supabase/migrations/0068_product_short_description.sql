-- A one-line description of what the product IS.
--
-- Separate from notes, which are internal and free-form -- whose van it
-- comes on, which backstreet the supplier is down. This is the line you
-- would read out to a customer: "Heavy duty steel wheelbarrow, 90 litre".
--
-- Nullable, and no default: a product without one has no description, not
-- an empty one, and nothing should render a blank line as though a
-- description had been written.
alter table public.products
  add column if not exists short_description text;

comment on column public.products.short_description is
  'One-line customer-facing description of the product. Distinct from notes, which are internal.';
