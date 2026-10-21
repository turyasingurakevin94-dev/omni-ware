-- 0153 Sales, third: a supplier's price up that puts a line under its sale.
--
-- When the Buyer takes a supplier's new price (in person, by phone, or from
-- the supplier app) the line's cost rises (payload.items[].price, the old
-- one kept as priceWas). If it rises above what the line sells at, the line
-- sells at a loss, and that is the Manager's call (decision-rights.md §3,
-- manager.html lineBelowCost): Decide shows it whether or not anyone tagged
-- it. But nothing told the Manager, and when they set the new price nothing
-- told the salesperson, who has to tell the customer. Order #0554 (the
-- cross-app test of 21 Oct 2026) waited that way in silence.
--
-- Every hand-off that waits on someone pushes that person, so a new trigger
-- on saved_quotes pushes:
--
--   price.waits    the Manager (price.approve), when a line comes to sell
--                  under its cost with no answer from them for its price
--   price.decided  the salesperson who took the order, when the Manager
--                  sets the price on such a line: "Tell them."
--
-- A line a salesperson priced and tagged (priceBy) is left to 0120's
-- saved_quotes_ow_push, which already pushes both; this one only reads the
-- untagged lines, so nobody hears twice. Nothing else changes: the gate
-- (ow_gate_reason) and invoicing read what they read before.
--
-- Applied by hand, after 0152. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname = 'saved_quotes_ow_price_up';
--   select kind, title, body from push_outbox where dedupe like 'under:%' or dedupe like 'upset:%' order by id desc limit 5;
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_price_up on saved_quotes;
--   drop function if exists saved_quotes_ow_price_up();
--   drop function if exists ow_line_under_cost(uuid, jsonb, jsonb);
-- ---------------------------------------------------------------------

-- An untagged line selling under its cost with no fresh answer from the
-- Manager (manager.html lineWaitsPrice, its lineBelowCost half).
create or replace function ow_line_under_cost(p_shop_id uuid, it jsonb, p_presets jsonb)
returns boolean
language plpgsql stable as $$
declare
  cost numeric;
  now_price numeric;
  r jsonb;
begin
  if jsonb_typeof(it) <> 'object' then return false; end if;
  if coalesce(it ->> 'priceBy', '') <> '' and coalesce(it ->> 'priceBy', '') <> 'false' then return false; end if;
  cost := ow_num(it ->> 'price');
  if coalesce(cost, 0) <= 0 or coalesce(ow_num(it ->> 'qty'), 0) <= 0 then return false; end if;
  now_price := round(case when coalesce(ow_num(it ->> 'sellPrice'), 0) > 0 then ow_num(it ->> 'sellPrice')
                          else ow_line_sell_price(p_shop_id, it, p_presets) end);
  if coalesce(now_price, 0) <= 0 or now_price >= cost then return false; end if;
  r := it -> 'priceReview';
  if jsonb_typeof(r) = 'object' and ow_num(r ->> 'price') = now_price and ow_num(r ->> 'qty') = ow_num(it ->> 'qty') then return false; end if;
  return true;
end $$;

create or replace function saved_quotes_ow_price_up() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := case when tg_op = 'UPDATE' then coalesce(old.payload, '{}'::jsonb) else '{}'::jsonb end;
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'an order');
  taker uuid := ow_uuid(p ->> 'takenBy');
  ref jsonb := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  presets jsonb;
  items jsonb := case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end;
  olds jsonb := case when jsonb_typeof(o -> 'items') = 'array' then o -> 'items' else '[]'::jsonb end;
  it jsonb;
  was jsonb;
  i integer;
  first_line jsonb;
  waiting text := '';
  r jsonb;
begin
  if coalesce(new.voided, false) or coalesce(new.invoiced, false) or new.status = 'completed' then return null; end if;
  begin
    presets := coalesce((select a.presets from app_settings a where a.shop_id = new.shop_id), '{}'::jsonb);
    for i in 0 .. jsonb_array_length(items) - 1 loop
      it := items -> i;
      -- The same line before this write: by its id, else by its place.
      was := null;
      if coalesce(it ->> 'lineId', '') <> '' then
        select e into was from jsonb_array_elements(olds) e where e ->> 'lineId' = it ->> 'lineId' limit 1;
      elsif i < jsonb_array_length(olds) then
        was := olds -> i;
      end if;

      if ow_line_under_cost(new.shop_id, it, presets) then
        if first_line is null then first_line := it; end if;
        waiting := waiting || coalesce(it ->> 'lineId', i::text) || '@' || coalesce(it ->> 'price', '') || ';';
      elsif was is not null and ow_line_under_cost(new.shop_id, was, presets) and taker is not null then
        -- The Manager answered a line that sold under its cost.
        r := it -> 'priceReview';
        if jsonb_typeof(r) = 'object' and (r ->> 'state') = 'changed'
           and (was -> 'priceReview') is distinct from r then
          perform ow_push(new.shop_id, 'price.decided', 'The Manager set a new price',
            client || ' — ' || coalesce(it ->> 'productName', 'an item') || ' is now ' || ow_money(ow_num(r ->> 'price')) || ' each. Tell them.',
            taker, null, null, ref, 'upset:' || new.id || ':' || coalesce(it ->> 'lineId', i::text) || ':' || coalesce(r ->> 'at', ''));
        end if;
      end if;
    end loop;

    -- Lines under their cost wait for the Manager: told once for each set of them.
    if waiting <> '' then
      perform ow_push(new.shop_id, 'price.waits', 'A price went up past the sale',
        client || ' — ' || coalesce(first_line ->> 'productName', 'a line') || ' now costs '
          || ow_money(ow_num(first_line ->> 'price')) || ', more than it sells at. Set the price.',
        null, 'price.approve', null, ref, 'under:' || new.id || ':' || md5(waiting));
    end if;
  exception when others then
    raise notice 'push (price up): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

drop trigger if exists saved_quotes_ow_price_up on saved_quotes;
create trigger saved_quotes_ow_price_up after insert or update on saved_quotes
  for each row execute function saved_quotes_ow_price_up();
