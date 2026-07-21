-- Lets a shop set a markup rule that applies only when quoting straight off
-- the shelf ("Our stock" in the item picker / Inventory tab), separate from
-- the product's default rule (used for supplier-sourced quotes). A blank/0
-- value here means "no override" -- the app falls back to the product's
-- (or variant's) default rule automatically.

alter table products
  add column stock_wholesale_markup_type text,
  add column stock_wholesale_markup_value numeric,
  add column stock_retail_markup_type text,
  add column stock_retail_markup_value numeric;
