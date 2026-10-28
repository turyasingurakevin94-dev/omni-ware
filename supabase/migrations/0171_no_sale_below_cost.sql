-- 0171 The rebuild's first backend fix (docs/rebuild.md, "Backend fixes
-- decided"; docs/spec/02-money.md §8 Q16, Kevin 28 Oct 2026): no sale below
-- cost. The database refuses a line priced below its cost, except a line
-- given away on purpose, whichever app writes.
--
-- Until now only the apps refused it: Sales' priceTooLow (sales.html) and the
-- Manager's floor (manager.html decidePrice, priceChip). Nothing in SQL did:
-- 0153's ow_line_under_cost only pushes the Manager, and the gate and the
-- invoice let such a line through. A line comes under its cost two ways, and
-- the database answers each the way the apps already do:
--
--   1. Someone types it. A person (any login) writing a line's price
--      (items[].sellPrice) above 0 and under the line's cost (items[].price)
--      is refused: OWCST. Judged only when the price is new: a new line, or
--      one whose price differs from the same line before (by lineId, else
--      by product, variant and name). A cost that rises under a price set
--      earlier (the Buyer takes a supplier's dearer price) is never refused
--      here: that line waits for the Manager, as it does in the apps.
--      Writes with no login (the server's own runs, the agent and customer
--      portals, which price by rule) are judged at the bill instead.
--   2. It is billed. An order is never invoiced while a line sells under its
--      cost, whoever invoices (a phone, the console, the hourly run): OWPRC,
--      "a price still waits for the Manager", the code the apps and the
--      hourly run already route to the Manager's prices (price.approve).
--      The Manager sets a price at or above cost, or gives the line away.
--
-- Given away (items[].givenAway.why, 0169) and a line at 0 are left to
-- 0169: a 0 is free, and an invoiced 0 needs its reason (OWGIV). A line with
-- no known cost or no count is not judged. Lines already invoiced are not
-- judged again, and old orders stand until they are written or billed.
--
-- Applied by hand, after 0170. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname = 'saved_quotes_zz_cost_floor';
--   -- open orders that will wait for the Manager at the bill:
--   select q.id, e ->> 'productName', e ->> 'sellPrice', e ->> 'price' from saved_quotes q, jsonb_array_elements(q.payload -> 'items') e
--    where not q.invoiced and not q.voided and jsonb_typeof(e) = 'object'
--      and ow_line_sells_under_cost(q.shop_id, e, coalesce((select a.presets from app_settings a where a.shop_id = q.shop_id), '{}'));
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_zz_cost_floor on saved_quotes;
--   drop function if exists saved_quotes_cost_floor();
--   drop function if exists ow_line_sells_under_cost(uuid, jsonb, jsonb);
-- ---------------------------------------------------------------------

-- A line that sells under its cost: a count, a known cost, and a price above
-- 0 that is less (sales.html lineBelowCost: the typed price, else the
-- shop's). A 0 and a line given away are 0169's.
create or replace function ow_line_sells_under_cost(p_shop_id uuid, it jsonb, p_presets jsonb)
returns boolean
language plpgsql stable as $$
declare
  cost numeric;
  sell numeric;
  now_price numeric;
begin
  if jsonb_typeof(it) <> 'object' then return false; end if;
  if coalesce(btrim(it -> 'givenAway' ->> 'why'), '') <> '' then return false; end if;
  cost := ow_num(it ->> 'price');
  if coalesce(cost, 0) <= 0 or coalesce(ow_num(it ->> 'qty'), 0) <= 0 then return false; end if;
  sell := ow_num(it ->> 'sellPrice');
  if sell = 0 then return false; end if;
  now_price := round(case when coalesce(sell, 0) > 0 then sell else ow_line_sell_price(p_shop_id, it, p_presets) end);
  return coalesce(now_price, 0) > 0 and now_price < cost;
end $$;

create or replace function saved_quotes_cost_floor() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  items jsonb := case when jsonb_typeof(new.payload -> 'items') = 'array' then new.payload -> 'items' else '[]'::jsonb end;
  oldi jsonb := '[]'::jsonb;
  presets jsonb;
  it jsonb;
  lbl text;
begin
  -- The round's correction scripts (and only they) set this for their own transaction (0165).
  if coalesce(current_setting('ow.money_fix', true), '') = 'on' then return new; end if;
  -- An upsert of a row that is there already (the owner console saves so) is judged by its update.
  if tg_op = 'INSERT' and exists (select 1 from saved_quotes x where x.shop_id = new.shop_id and x.id = new.id) then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.payload -> 'items') = 'array' then oldi := old.payload -> 'items'; end if;
  presets := coalesce((select a.presets from app_settings a where a.shop_id = new.shop_id), '{}'::jsonb);

  -- 1. A price someone types is never under the cost.
  if auth.uid() is not null and (tg_op = 'INSERT' or items is distinct from oldi) then
    for it in select e from jsonb_array_elements(items) e loop
      continue when coalesce(ow_num(it ->> 'sellPrice'), 0) <= 0;
      continue when not ow_line_sells_under_cost(new.shop_id, it, presets);
      -- The same line at the same price before: its cost moved, not its price.
      continue when exists (select 1 from jsonb_array_elements(oldi) o
        where jsonb_typeof(o) = 'object' and ow_num(o ->> 'sellPrice') = ow_num(it ->> 'sellPrice')
          and case when it ? 'lineId' then o ->> 'lineId' = it ->> 'lineId'
                   else o ->> 'productId' is not distinct from it ->> 'productId'
                    and o ->> 'variantIdx' is not distinct from it ->> 'variantIdx'
                    and o ->> 'productName' is not distinct from it ->> 'productName' end);
      raise exception '% can''t sell at % — it costs % each. Never below cost.', coalesce(it ->> 'productName', 'A line'),
        ow_money(ow_num(it ->> 'sellPrice')), ow_money(ow_num(it ->> 'price')) using errcode = 'OWCST';
    end loop;
  end if;

  -- 2. Never billed under the cost: the Manager prices it first.
  if coalesce(new.invoiced, false) and (tg_op = 'INSERT' or not coalesce(old.invoiced, false)) then
    for it in select e from jsonb_array_elements(items) e loop
      continue when not ow_line_sells_under_cost(new.shop_id, it, presets);
      lbl := 'INV-' || case when length(new.id::text) < 4 then lpad(new.id::text, 4, '0') else new.id::text end;
      raise exception 'A price on % still waits for the Manager: % sells under its cost.', lbl, coalesce(it ->> 'productName', 'a line') using errcode = 'OWPRC';
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists saved_quotes_zz_cost_floor on saved_quotes;
create trigger saved_quotes_zz_cost_floor before insert or update on saved_quotes
  for each row execute function saved_quotes_cost_floor();
