-- The Manager decides: prices, markups, credit, invoicing, returns, voids,
-- write-offs, goals and limits, and none of it waits for the owner.
--
-- docs/decision-rights.md section 2 gives the Manager the day-to-day
-- decisions the owner used to make at the desk. 0116 gave the role the
-- team's jobs (moving orders, handing them on, the credit yes, payments
-- and statements) and said everything else stayed the owner's. That
-- described the first build; the decision rights are the policy, and
-- this migration grants the Manager the rest of its rows. manager.html is
-- built around exactly these:
--
--   price.approve      a line below the shop's price (at or above cost), or
--                      one with no price or no known cost: approve it, set
--                      a price, or put it back to the shop's price. The
--                      decision rides the order line (payload.items[]
--                      .priceReview); the guard that only this task may
--                      write it is the shared foundation's (0119).
--   markup.set         a product's markups and the shop's default markup.
--                      Only through set_product_markup() and
--                      set_shop_preset('defaultMarkup'): products and
--                      app_settings stay closed to direct writes (0083).
--   margin.see         costs and margins on the Manager's screens.
--   invoice.make       invoicing a delivered order. THE ONE INVOICING
--                      FUNCTION IS THE SHARED FOUNDATION'S (0119), NOT
--                      BUILT YET. The task is granted now so the Manager's
--                      button works the moment 0119 lands; until then the
--                      guard below still refuses invoicing from any desk
--                      login, the Manager's included.
--   pick.settle        a short pick: bill what went, or the full quantity
--                      (on the order, payload; desk logins write payload).
--   credit_note.raise  a customer's return: the goods come back onto the
--                      shelf through manager_stock_move(), and Accounts'
--                      ask for one is closed by decide_invoice_ask().
--   invoice.void       voiding an order: the saved_quotes guard lets this
--                      task set voided (never unset it), the goods come
--                      back through manager_stock_move(), the supplier
--                      bills the sale raised go through void_sale_bills().
--   credit.set         a customer's credit limit and payment terms (the
--                      customers guard), and the shop's hold days
--                      (set_shop_preset('creditHold')).
--   promise.record     a customer's promise to pay. 0123 already re-drew
--                      payment_promises to has_task('promise.record'), so
--                      for the Manager this is the grant alone.
--   agent.change       an agent's change or cancel. It lives on the order
--                      (payload.agentChange / payload.agentCancel) and is
--                      decided line by line in the app, as index.html
--                      decideAgentChange() does; desk logins already write
--                      payload. Closing a cancelled agent order is
--                      voiding it (index.html cancelSavedQuote), so the
--                      saved_quotes guard lets agent.change void an order
--                      that carries payload.agentCancel and is not
--                      invoiced -- and nothing else.
--   trip.difference    the yard's count differs from the Buyer's:
--                      accept_trip_difference(). It records the
--                      acceptance and moves NO stock -- putting goods on
--                      the shelf from the yard's count is the Store's
--                      stock.receive, a later build (0124).
--   stock.writeoff     damaged, lost or stolen stock: write_off_stock()
--                      and manager_stock_move(), from the Store's reports
--                      (stock_reports, below) or the Manager's own count.
--   restock.hold       "not yet" on a restock line: hold_restock_line().
--   goal.set           each salesperson's goal: set_person_goal().
--   team.limits        how long an order may sit in each stage:
--                      set_shop_preset('orderStageLimits').
--
-- TWO NEW TABLES, shared homes other builds write into:
--   restock_lines   the Buyer's restock list (0125, buy.restock) writes
--                   here; the Manager holds a line. Nobody holds
--                   buy.restock yet, so today only the owner adds lines.
--   stock_reports   the Store's damaged / lost / stolen reports (0124,
--                   stock.report); the Manager writes them off or
--                   dismisses them. Nobody holds stock.report yet either.
--
-- EVERY DECISION IS LOGGED, not approved: each function here writes one
-- row to decision_log (0123) with who, when, what and what it was before.
-- The two guards log the decisions made by a plain save -- a credit limit
-- or terms changed, an order voided -- so the app must NOT log those
-- again. Logging is skipped, quietly, on a database that has not had 0123
-- yet; every function below needs 0123 applied to do its work.
--
-- The headers of 0113, 0115 and 0116 say costs, prices, credit limits and
-- terms, invoicing, voiding and stock stay the owner's. That described
-- the first build; docs/decision-rights.md is the policy. Applied
-- migrations are left as they are.
--
-- Applied by hand like every migration here. Every policy, trigger and
-- function is dropped or replaced before it is created; a table this
-- database never got is skipped and named. Safe to run twice.
-- 0113 and 0116 make the same two guards this file redraws: pasting
-- either of them again puts the old guards back, so run this file again
-- after them.
--
-- CHECK AFTERWARDS:
--   select task from role_tasks where role = 'manager' order by task;
--   -- 23 rows (8 from 0115/0116, 15 here)
--   select proname from pg_proc where proname in ('set_shop_preset',
--     'set_product_markup','manager_stock_move','decide_invoice_ask',
--     'void_sale_bills','accept_trip_difference','hold_restock_line',
--     'write_off_stock','dismiss_stock_report','set_person_goal');
--   -- 10 rows
--
-- ROLLBACK:
--   delete from role_tasks where role = 'manager' and task in ('price.approve',
--     'markup.set','margin.see','invoice.make','pick.settle','credit_note.raise',
--     'invoice.void','credit.set','promise.record','agent.change',
--     'trip.difference','stock.writeoff','restock.hold','goal.set','team.limits');
--   (without the tasks every function below refuses a Manager, and both
--   guards refuse a desk login what they refused under 0116; the owner
--   keeps everything. The two tables can stay: nobody else writes them.)

-- ---------------------------------------------------------------------
-- 1. The tasks.
insert into role_tasks (role, task) values
  ('manager', 'price.approve'),
  ('manager', 'markup.set'),
  ('manager', 'margin.see'),
  ('manager', 'invoice.make'),
  ('manager', 'pick.settle'),
  ('manager', 'credit_note.raise'),
  ('manager', 'invoice.void'),
  ('manager', 'credit.set'),
  ('manager', 'promise.record'),
  ('manager', 'agent.change'),
  ('manager', 'trip.difference'),
  ('manager', 'stock.writeoff'),
  ('manager', 'restock.hold'),
  ('manager', 'goal.set'),
  ('manager', 'team.limits')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. The owner's log, written from inside the functions below.
--
-- One row: the task, one plain line as the owner reads it, the amount,
-- what it touched ({table, id}), and the parts that changed. by_name is
-- the caller's staff name when they have one; role is their membership.
-- Not callable from a client: only the functions and guards here write
-- through it, after they have checked the task.
create or replace function manager_log_decision(
  p_shop_id uuid, p_task text, p_what text, p_amount numeric,
  p_ref jsonb, p_before jsonb, p_after jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_role text;
begin
  if to_regclass('public.decision_log') is null then return; end if;
  select s.name into v_name from staff s
   where s.shop_id = p_shop_id and s.user_id = auth.uid() limit 1;
  select m.role into v_role from shop_members m
   where m.shop_id = p_shop_id and m.user_id = auth.uid() limit 1;
  insert into decision_log (shop_id, by, by_name, role, task, what, amount, ref, before, after)
       values (p_shop_id, auth.uid(), nullif(trim(coalesce(v_name, '')), ''), v_role, p_task, p_what,
               p_amount, p_ref, p_before, p_after);
end $$;
revoke all on function manager_log_decision(uuid, text, text, numeric, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. The guards, re-drawn. Everything they enforced for Sales stays.

-- A customer: a payment may LOWER what they owe; nobody at a desk raises
-- a debt. A credit limit and payment terms are the Manager's (credit.set),
-- on a new customer or an old one, and each change is logged.
create or replace function customers_sales_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_desk(new.shop_id) then return new; end if;
  -- An upsert of an existing row is judged as the update it becomes.
  if tg_op = 'INSERT' and exists (select 1 from customers c where c.shop_id = new.shop_id and c.id = new.id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.debt, 0) <> 0 then
      raise exception 'A new customer owes nothing; the debt comes from their invoices.' using errcode = '42501';
    end if;
    if new.credit_limit is not null or new.terms_days is not null then
      if not has_task(new.shop_id, 'credit.set') then
        raise exception 'Credit limits and payment terms are the Manager''s to set (credit.set).' using errcode = '42501';
      end if;
      perform manager_log_decision(new.shop_id, 'credit.set',
        'Credit for ' || coalesce(nullif(new.name, ''), new.id) || ': limit ' || coalesce(new.credit_limit::text, 'none')
          || ', terms ' || coalesce(new.terms_days::text || ' days', 'none'),
        new.credit_limit, jsonb_build_object('table', 'customers', 'id', new.id),
        jsonb_build_object('credit_limit', null, 'terms_days', null),
        jsonb_build_object('credit_limit', new.credit_limit, 'terms_days', new.terms_days));
    end if;
    return new;
  end if;
  if coalesce(new.debt, 0) > coalesce(old.debt, 0) then
    raise exception 'This login can lower what a customer owes (a payment), not raise it.' using errcode = '42501';
  end if;
  if new.credit_limit is distinct from old.credit_limit or new.terms_days is distinct from old.terms_days then
    if not has_task(new.shop_id, 'credit.set') then
      raise exception 'Credit limits and payment terms are the Manager''s to set (credit.set).' using errcode = '42501';
    end if;
    perform manager_log_decision(new.shop_id, 'credit.set',
      'Credit for ' || coalesce(nullif(new.name, ''), new.id) || ': limit ' || coalesce(new.credit_limit::text, 'none')
        || ', terms ' || coalesce(new.terms_days::text || ' days', 'none'),
      new.credit_limit, jsonb_build_object('table', 'customers', 'id', new.id),
      jsonb_build_object('credit_limit', old.credit_limit, 'terms_days', old.terms_days),
      jsonb_build_object('credit_limit', new.credit_limit, 'terms_days', new.terms_days));
  end if;
  return new;
end $$;

drop trigger if exists customers_sales_guard on customers;
create trigger customers_sales_guard before insert or update on customers
  for each row execute function customers_sales_guard();

-- An order: never invoiced or taken back from a desk login's save (the
-- one invoicing function, 0119, does that), and never un-voided. A void
-- -- voided false to true -- is the Manager's (invoice.void), and closing
-- an agent's cancelled, uninvoiced order is agent.change. Each is logged.
create or replace function saved_quotes_sales_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_task text;
begin
  if not is_shop_desk(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' and exists (select 1 from saved_quotes q where q.id = new.id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.invoiced or new.voided then
      raise exception 'A new order starts neither invoiced nor voided.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.invoiced is distinct from old.invoiced then
    raise exception 'An order is invoiced, or taken back, by the invoicing function, not by saving it.' using errcode = '42501';
  end if;
  if new.voided is distinct from old.voided then
    if old.voided then
      raise exception 'A voided order stays voided. Make a new order instead.' using errcode = '42501';
    end if;
    if has_task(new.shop_id, 'invoice.void') then
      v_task := 'invoice.void';
    elsif has_task(new.shop_id, 'agent.change') and coalesce(new.payload, '{}'::jsonb) ? 'agentCancel'
          and not coalesce(old.invoiced, false) then
      v_task := 'agent.change';
    else
      raise exception 'Voiding an order is the Manager''s (invoice.void). Ask for it from the invoice.' using errcode = '42501';
    end if;
    perform manager_log_decision(new.shop_id, v_task,
      case when v_task = 'agent.change' then 'Closed an agent''s cancelled order #' else 'Voided order #' end
        || new.id || coalesce(' for ' || nullif(new.client_name, ''), ''),
      null, jsonb_build_object('table', 'saved_quotes', 'id', new.id),
      jsonb_build_object('voided', false, 'invoiced', old.invoiced),
      jsonb_build_object('voided', true, 'invoiced', new.invoiced));
  end if;
  return new;
end $$;

drop trigger if exists saved_quotes_sales_guard on saved_quotes;
create trigger saved_quotes_sales_guard before insert or update on saved_quotes
  for each row execute function saved_quotes_sales_guard();

-- Products stay closed to a Manager's direct writes (0083's "owner
-- updates only" is untouched): markup.set changes the eight markup
-- columns through set_product_markup() in section 5 and nothing else.

-- ---------------------------------------------------------------------
-- 4. One setting in the shop's presets (app_settings.presets).
--
--   defaultMarkup     markup.set   {wholesaleType, wholesaleValue,
--                                   retailType, retailValue}
--   creditHold        credit.set   {days: 21, on: true}
--   orderStageLimits  team.limits  {draft: 120, awaiting_goods: 1440,
--                                   preparing: 120, pending_delivery: 240}
--                                  (minutes; 0 or absent = no limit)
--
-- Only the one key changes; the rest of the row is left as it was.
create or replace function set_shop_preset(p_shop_id uuid, p_key text, p_value jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_task text;
  v_old jsonb;
  v_new jsonb;
  k text;
  v jsonb;
begin
  v_task := case p_key when 'defaultMarkup' then 'markup.set' when 'creditHold' then 'credit.set'
                       when 'orderStageLimits' then 'team.limits' else null end;
  if v_task is null then
    raise exception 'That setting is not one a role sets here.' using errcode = '22023';
  end if;
  if not has_task(p_shop_id, v_task) then
    raise exception 'Changing this setting needs %.', v_task using errcode = '42501';
  end if;
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception 'The setting must be a set of named values.' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(p_value) loop
    if p_key = 'defaultMarkup' then
      if k in ('wholesaleType', 'retailType') then
        if v #>> '{}' not in ('percent', 'fixed') then
          raise exception 'A markup is a percent or a fixed amount.' using errcode = '22023';
        end if;
      elsif k in ('wholesaleValue', 'retailValue') then
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 then
          raise exception 'A markup is a number, zero or more.' using errcode = '22023';
        end if;
      else
        raise exception 'The default markup has no "%".', k using errcode = '22023';
      end if;
    elsif p_key = 'creditHold' then
      if k = 'days' then
        if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 1 or (v #>> '{}')::numeric > 365 then
          raise exception 'The hold line is a number of days, 1 to 365.' using errcode = '22023';
        end if;
      elsif k = 'on' then
        if jsonb_typeof(v) <> 'boolean' then
          raise exception 'The hold is on or off.' using errcode = '22023';
        end if;
      else
        raise exception 'The credit hold has no "%".', k using errcode = '22023';
      end if;
    else
      if k not in ('draft', 'awaiting_goods', 'preparing', 'pending_delivery') then
        raise exception 'An order has no "%" stage to limit.', k using errcode = '22023';
      end if;
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0 then
        raise exception 'A stage limit is minutes, zero or more.' using errcode = '22023';
      end if;
    end if;
  end loop;

  select presets into v_old from app_settings where shop_id = p_shop_id for update;
  insert into app_settings (shop_id, presets) values (p_shop_id, jsonb_build_object(p_key, p_value))
  on conflict (shop_id) do update
     set presets = coalesce(app_settings.presets, '{}'::jsonb) || jsonb_build_object(p_key, p_value),
         updated_at = now()
  returning presets into v_new;

  perform manager_log_decision(p_shop_id, v_task,
    case p_key when 'defaultMarkup' then 'Shop''s default markup changed'
               when 'creditHold' then 'Credit hold line set' || coalesce(' to ' || (p_value ->> 'days') || ' days', '')
               else 'Time limits for each order stage changed' end,
    null, jsonb_build_object('table', 'app_settings', 'id', p_shop_id, 'key', p_key),
    jsonb_build_object(p_key, coalesce(v_old, '{}'::jsonb) -> p_key),
    jsonb_build_object(p_key, p_value));
  return jsonb_build_object('ok', true, 'presets', v_new);
end $$;
revoke all on function set_shop_preset(uuid, text, jsonb) from public, anon;
grant execute on function set_shop_preset(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. A product's markups (markup.set): the eight markup columns, nothing
-- else on the product. Keys as the apps name them; a key left out stays
-- as it is. Types are what index.html writes: 'percent' or 'fixed'.
create or replace function set_product_markup(p_shop_id uuid, p_product_id text, p_fields jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_cols constant jsonb := jsonb_build_object(
    'wholesaleMarkupType', 'wholesale_markup_type', 'wholesaleMarkupValue', 'wholesale_markup_value',
    'retailMarkupType', 'retail_markup_type', 'retailMarkupValue', 'retail_markup_value',
    'stockWholesaleMarkupType', 'stock_wholesale_markup_type', 'stockWholesaleMarkupValue', 'stock_wholesale_markup_value',
    'stockRetailMarkupType', 'stock_retail_markup_type', 'stockRetailMarkupValue', 'stock_retail_markup_value');
  k text;
  v jsonb;
  v_name text;
  v_old jsonb;
  v_new jsonb;
begin
  if not has_task(p_shop_id, 'markup.set') then
    raise exception 'Changing a markup is the Manager''s (markup.set).' using errcode = '42501';
  end if;
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' or p_fields = '{}'::jsonb then
    raise exception 'Say which markup to change.' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(p_fields) loop
    if not v_cols ? k then
      raise exception 'Only a product''s markups change here, not "%".', k using errcode = '42501';
    end if;
    if k like '%Type' then
      if jsonb_typeof(v) <> 'null' and v #>> '{}' not in ('percent', 'fixed') then
        raise exception 'A markup is a percent or a fixed amount.' using errcode = '22023';
      end if;
    elsif jsonb_typeof(v) <> 'null' and (jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric < 0) then
      raise exception 'A markup is a number, zero or more.' using errcode = '22023';
    end if;
  end loop;

  select p.name,
         jsonb_build_object(
           'wholesaleMarkupType', p.wholesale_markup_type, 'wholesaleMarkupValue', p.wholesale_markup_value,
           'retailMarkupType', p.retail_markup_type, 'retailMarkupValue', p.retail_markup_value,
           'stockWholesaleMarkupType', p.stock_wholesale_markup_type, 'stockWholesaleMarkupValue', p.stock_wholesale_markup_value,
           'stockRetailMarkupType', p.stock_retail_markup_type, 'stockRetailMarkupValue', p.stock_retail_markup_value)
    into v_name, v_old
    from products p where p.shop_id = p_shop_id and p.id = p_product_id for update;
  if not found then raise exception 'That product is not in this shop.'; end if;

  update products p set
    wholesale_markup_type        = case when p_fields ? 'wholesaleMarkupType' then p_fields ->> 'wholesaleMarkupType' else p.wholesale_markup_type end,
    wholesale_markup_value       = case when p_fields ? 'wholesaleMarkupValue' then (p_fields ->> 'wholesaleMarkupValue')::numeric else p.wholesale_markup_value end,
    retail_markup_type           = case when p_fields ? 'retailMarkupType' then p_fields ->> 'retailMarkupType' else p.retail_markup_type end,
    retail_markup_value          = case when p_fields ? 'retailMarkupValue' then (p_fields ->> 'retailMarkupValue')::numeric else p.retail_markup_value end,
    stock_wholesale_markup_type  = case when p_fields ? 'stockWholesaleMarkupType' then p_fields ->> 'stockWholesaleMarkupType' else p.stock_wholesale_markup_type end,
    stock_wholesale_markup_value = case when p_fields ? 'stockWholesaleMarkupValue' then (p_fields ->> 'stockWholesaleMarkupValue')::numeric else p.stock_wholesale_markup_value end,
    stock_retail_markup_type     = case when p_fields ? 'stockRetailMarkupType' then p_fields ->> 'stockRetailMarkupType' else p.stock_retail_markup_type end,
    stock_retail_markup_value    = case when p_fields ? 'stockRetailMarkupValue' then (p_fields ->> 'stockRetailMarkupValue')::numeric else p.stock_retail_markup_value end
  where p.shop_id = p_shop_id and p.id = p_product_id;

  v_new := v_old || p_fields;
  perform manager_log_decision(p_shop_id, 'markup.set',
    'Markup changed on ' || coalesce(nullif(v_name, ''), p_product_id),
    null, jsonb_build_object('table', 'products', 'id', p_product_id),
    (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from jsonb_each(v_old) where p_fields ? key),
    p_fields);
  return jsonb_build_object('ok', true, 'product', jsonb_build_object('id', p_product_id) || v_new);
end $$;
revoke all on function set_product_markup(uuid, text, jsonb) from public, anon;
grant execute on function set_product_markup(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Moving stock for a decision: a write-off (goods gone) or a return
-- or void (goods back). The same mechanics as accept_stock_count (0115):
-- the stock row upserted, the oldest lots used up first when stock goes
-- down (never below zero) or a lot added at the given cost when it comes
-- back, and one stock_log row per line with its id from the same counter
-- the apps use ('row:stock_log', 0034).
--
--   p_lines  [{key, productId, variantIdx, name, delta, cost}]
--   p_sign   -1: every delta must be below zero; 1: every delta above.
--
-- Not callable from a client: manager_stock_move() and write_off_stock()
-- check the task first.
create or replace function manager_apply_stock_lines(p_shop_id uuid, p_lines jsonb, p_type text, p_note text, p_sign int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  l jsonb;
  k text;
  want numeric;
  v_cost numeric;
  v_before numeric;
  v_after numeric;
  v_delta numeric;
  left_to_take numeric;
  lot record;
  log_id bigint;
  floor_id bigint;
  changed int := 0;
  moved jsonb := '[]'::jsonb;
  v_value numeric := 0;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Say which goods move.' using errcode = '22023';
  end if;
  for l in select * from jsonb_array_elements(p_lines) loop
    if nullif(l ->> 'key', '') is null then
      raise exception 'Every line needs its stock key.' using errcode = '22023';
    end if;
    want := coalesce((l ->> 'delta')::numeric, 0);
    if (p_sign < 0 and want >= 0) or (p_sign > 0 and want <= 0) then
      raise exception '%', case when p_sign < 0 then 'A write-off takes goods off the shelf: every line below zero.'
                                else 'Goods coming back: every line above zero.' end using errcode = '22023';
    end if;
  end loop;

  for l in select * from jsonb_array_elements(p_lines) loop
    k := l ->> 'key';
    want := round((l ->> 'delta')::numeric, 6);
    v_cost := nullif(l ->> 'cost', '')::numeric;
    select qty into v_before from stock where shop_id = p_shop_id and key = k for update;
    v_before := coalesce(v_before, 0);
    v_after := greatest(0, round(v_before + want, 6));
    v_delta := round(v_after - v_before, 6);
    if v_delta = 0 then continue; end if;

    insert into stock (shop_id, key, product_id, variant_idx, qty)
         values (p_shop_id, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), v_after)
    on conflict (shop_id, key) do update set qty = excluded.qty;

    -- consumeStockLots / addStockLot (index.html): the oldest lots go first.
    if v_delta < 0 then
      left_to_take := -v_delta;
      for lot in select id, qty from stock_lots where shop_id = p_shop_id and key = k order by id loop
        exit when left_to_take <= 0;
        if lot.qty <= left_to_take then
          left_to_take := left_to_take - lot.qty;
          delete from stock_lots where id = lot.id;
        else
          update stock_lots set qty = qty - left_to_take where id = lot.id;
          left_to_take := 0;
        end if;
      end loop;
    else
      insert into stock_lots (shop_id, key, qty, cost) values (p_shop_id, k, v_delta, v_cost);
    end if;

    select coalesce(max(id), 0) into floor_id from stock_log where shop_id = p_shop_id;
    insert into entity_id_counters (shop_id, kind, last_issued)
         values (p_shop_id, 'row:stock_log', floor_id + 1)
    on conflict (shop_id, kind) do update
            set last_issued = greatest(entity_id_counters.last_issued, floor_id) + 1
      returning last_issued into log_id;

    insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at)
         values (log_id, p_shop_id, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), l ->> 'name', p_type,
                 v_delta, v_after, p_note, current_date, now());
    changed := changed + 1;
    v_value := v_value + abs(v_delta) * coalesce(v_cost, 0);
    moved := moved || jsonb_build_object('key', k, 'name', l ->> 'name', 'before', v_before, 'after', v_after, 'delta', v_delta);
  end loop;
  return jsonb_build_object('changed', changed, 'moved', moved, 'value', v_value);
end $$;
revoke all on function manager_apply_stock_lines(uuid, jsonb, text, text, int) from public, anon, authenticated;

-- The Manager's stock move. p_task names the decision it is part of:
--   stock.writeoff     goods gone          type 'writeoff', every delta < 0
--   credit_note.raise  a customer return   type 'reversal', every delta > 0
--   invoice.void       a voided sale       type 'reversal', every delta > 0
create or replace function manager_stock_move(p_shop_id uuid, p_lines jsonb, p_type text, p_note text, p_task text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  res jsonb;
begin
  if p_task not in ('stock.writeoff', 'credit_note.raise', 'invoice.void') then
    raise exception 'Stock moves here for a write-off, a return or a void only.' using errcode = '22023';
  end if;
  if not has_task(p_shop_id, p_task) then
    raise exception 'Moving stock for this needs %.', p_task using errcode = '42501';
  end if;
  if p_type not in ('writeoff', 'reversal')
     or (p_task = 'stock.writeoff') <> (p_type = 'writeoff') then
    raise exception 'A write-off is type writeoff; a return or a void is type reversal.' using errcode = '22023';
  end if;
  res := manager_apply_stock_lines(p_shop_id, p_lines, p_type, nullif(trim(coalesce(p_note, '')), ''),
                                   case when p_task = 'stock.writeoff' then -1 else 1 end);
  perform manager_log_decision(p_shop_id, p_task,
    case p_task when 'stock.writeoff' then 'Wrote off ' when 'credit_note.raise' then 'Took back on a return: '
                else 'Put back on the shelf from a void: ' end
      || coalesce((select string_agg(abs((m ->> 'delta')::numeric)::text || ' × ' || coalesce(m ->> 'name', m ->> 'key'), ', ')
                     from jsonb_array_elements(res -> 'moved') m), 'nothing (no change on the shelf)')
      || coalesce(' · ' || nullif(trim(coalesce(p_note, '')), ''), ''),
    nullif((res ->> 'value')::numeric, 0), jsonb_build_object('table', 'stock_log'),
    (select coalesce(jsonb_agg(jsonb_build_object('key', m ->> 'key', 'qty', (m ->> 'before')::numeric)), '[]'::jsonb)
       from jsonb_array_elements(res -> 'moved') m),
    (select coalesce(jsonb_agg(jsonb_build_object('key', m ->> 'key', 'qty', (m ->> 'after')::numeric)), '[]'::jsonb)
       from jsonb_array_elements(res -> 'moved') m));
  return jsonb_build_object('ok', true, 'changed', (res ->> 'changed')::int);
end $$;
revoke all on function manager_stock_move(uuid, jsonb, text, text, text) from public, anon;
grant execute on function manager_stock_move(uuid, jsonb, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. An ask for a void or a credit note (invoice_asks, 0123), closed.
-- The app performs the void or the credit note on the order itself; this
-- only records the Manager's answer.
create or replace function decide_invoice_ask(p_id uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  a record;
  v_task text;
begin
  if p_status not in ('accepted', 'declined') then
    raise exception 'An ask is accepted or declined.' using errcode = '22023';
  end if;
  select * into a from invoice_asks where id = p_id for update;
  if not found then raise exception 'That ask is gone.'; end if;
  v_task := case a.kind when 'void' then 'invoice.void' else 'credit_note.raise' end;
  if not has_task(a.shop_id, v_task) then
    raise exception 'Deciding this ask is the Manager''s (%).', v_task using errcode = '42501';
  end if;
  if a.status <> 'sent' then
    raise exception 'That ask is % already.', a.status;
  end if;
  update invoice_asks set status = p_status, decided_by = auth.uid(), decided_at = now() where id = p_id;
  perform manager_log_decision(a.shop_id, v_task,
    initcap(p_status) || ' ' || coalesce(nullif(a.asked_by_name, ''), 'an') || '''s ask to '
      || case a.kind when 'void' then 'void' else 'raise a credit note on' end || ' order #' || a.quote_id,
    a.amount, jsonb_build_object('table', 'invoice_asks', 'id', a.id, 'quote_id', a.quote_id),
    jsonb_build_object('status', a.status), jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true, 'id', p_id, 'status', p_status);
end $$;
revoke all on function decide_invoice_ask(uuid, text) from public, anon;
grant execute on function decide_invoice_ask(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. The supplier bills a voided sale raised. A bill raised by invoicing
-- an order carries that order's id in purchase_invoices.quote_id (index
-- html generatePurchaseInvoicesForQuote; 0123's guard refuses Accounts
-- one). A bill with nothing paid on it is voided (payload.voided, as the
-- console voids one); a bill with money paid on it is kept and named --
-- that is a real payment to a real supplier, and Accounts sorts it out.
create or replace function void_sale_bills(p_shop_id uuid, p_quote_id bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  b record;
  v_voided bigint[] := '{}';
  v_kept bigint[] := '{}';
  v_total numeric := 0;
begin
  if not has_task(p_shop_id, 'invoice.void') then
    raise exception 'Voiding a sale''s bills is the Manager''s (invoice.void).' using errcode = '42501';
  end if;
  if to_regclass('public.purchase_invoices') is null then
    return jsonb_build_object('ok', true, 'voided', '[]'::jsonb, 'kept', '[]'::jsonb, 'skipped', 'purchase_invoices is not on this database');
  end if;
  for b in
    select id, payload from purchase_invoices
     where shop_id = p_shop_id and quote_id = p_quote_id
       and not coalesce((payload ->> 'voided')::boolean, false)
     order by id for update
  loop
    if coalesce((b.payload ->> 'amountPaid')::numeric, 0) <> 0
       or jsonb_array_length(coalesce(b.payload -> 'payments', '[]'::jsonb)) <> 0 then
      v_kept := v_kept || b.id;
    else
      update purchase_invoices
         set payload = coalesce(payload, '{}'::jsonb)
                       || jsonb_build_object('voided', true, 'voidedAt', now(), 'voidedBy', auth.uid(), 'voidedWith', p_quote_id)
       where id = b.id;
      v_voided := v_voided || b.id;
      v_total := v_total + coalesce((select sum(coalesce((i ->> 'qty')::numeric, 0) * coalesce((i ->> 'price')::numeric, 0))
                                       from jsonb_array_elements(coalesce(b.payload -> 'items', '[]'::jsonb)) i), 0);
    end if;
  end loop;
  if array_length(v_voided, 1) is not null or array_length(v_kept, 1) is not null then
    perform manager_log_decision(p_shop_id, 'invoice.void',
      'Voided ' || coalesce(array_length(v_voided, 1), 0) || ' supplier bill(s) raised by order #' || p_quote_id
        || case when array_length(v_kept, 1) is not null then '; kept ' || array_length(v_kept, 1) || ' with money paid' else '' end,
      nullif(v_total, 0), jsonb_build_object('table', 'purchase_invoices', 'quote_id', p_quote_id),
      jsonb_build_object('voided', false, 'ids', to_jsonb(v_voided)),
      jsonb_build_object('voided', true, 'ids', to_jsonb(v_voided), 'kept', to_jsonb(v_kept)));
  end if;
  return jsonb_build_object('ok', true, 'voided', to_jsonb(v_voided), 'kept', to_jsonb(v_kept));
end $$;
revoke all on function void_sale_bills(uuid, bigint) from public, anon;
grant execute on function void_sale_bills(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 9. A trip's count: the Buyer's against the yard's (trip.difference).
--
-- The Buyer's count is lines[].gotQty (0070; the qty sent when nobody
-- said), the yard's is lines[].yardQty (0115; the Buyer's when the yard
-- left it). Accepting records who and when, and logs every line that
-- differs. IT MOVES NO STOCK: the yard's count goes onto the shelf
-- through the Store's stock.receive, a later build (0124).
do $$
begin
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips difference columns: table not on this database';
  else
    alter table collection_trips add column if not exists difference_accepted_at timestamptz;
    alter table collection_trips add column if not exists difference_accepted_by uuid;
  end if;
end $$;

-- collection_trips stays open to members (0083). Only the acceptance is
-- fenced, to trip.difference.
create or replace function collection_trips_difference_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if (new.difference_accepted_at is not null or new.difference_accepted_by is not null)
       and not has_task(new.shop_id, 'trip.difference') then
      raise exception 'Accepting a trip''s difference is the Manager''s (trip.difference).' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.difference_accepted_at is distinct from old.difference_accepted_at
      or new.difference_accepted_by is distinct from old.difference_accepted_by)
     and not has_task(new.shop_id, 'trip.difference') then
    raise exception 'Accepting a trip''s difference is the Manager''s (trip.difference).' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips difference guard: not on this database';
  else
    drop trigger if exists collection_trips_difference_guard on collection_trips;
    create trigger collection_trips_difference_guard before insert or update on collection_trips
      for each row execute function collection_trips_difference_guard();
  end if;
end $$;

-- Trip ids are unique within a shop; the trip is looked for among the
-- shops where the caller holds trip.difference.
create or replace function accept_trip_difference(p_trip_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  tr record;
  n int;
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  v_value numeric := 0;
  l jsonb;
  i int := 0;
  v_got numeric;
  v_yard numeric;
begin
  if to_regclass('public.collection_trips') is null then
    raise exception 'Trips are not on this database.';
  end if;
  select count(*) into n from collection_trips t where t.id = p_trip_id;
  if n = 0 then raise exception 'That trip is gone.'; end if;
  select count(*) into n from collection_trips t where t.id = p_trip_id and has_task(t.shop_id, 'trip.difference');
  if n = 0 then
    raise exception 'Accepting a trip''s difference is the Manager''s (trip.difference).' using errcode = '42501';
  end if;
  if n > 1 then raise exception 'That trip id is in more than one of your shops.'; end if;
  select * into tr from collection_trips t
   where t.id = p_trip_id and has_task(t.shop_id, 'trip.difference') for update;
  if tr.yard_checked_at is null then
    raise exception 'The yard has not counted this trip yet.';
  end if;
  if tr.difference_accepted_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'at', tr.difference_accepted_at);
  end if;

  for l in select * from jsonb_array_elements(coalesce(tr.lines, '[]'::jsonb)) loop
    v_got := coalesce(nullif(l ->> 'gotQty', '')::numeric, nullif(l ->> 'qty', '')::numeric, 0);
    v_yard := coalesce(nullif(l ->> 'yardQty', '')::numeric, v_got);
    if v_yard <> v_got then
      v_before := v_before || jsonb_build_object('idx', i, 'name', coalesce(l ->> 'productName', l ->> 'productId'), 'gotQty', v_got);
      v_after := v_after || jsonb_build_object('idx', i, 'name', coalesce(l ->> 'productName', l ->> 'productId'), 'yardQty', v_yard);
      v_value := v_value + (v_yard - v_got) * coalesce(nullif(l ->> 'gotPrice', '')::numeric, nullif(l ->> 'expectedPrice', '')::numeric, 0);
    end if;
    i := i + 1;
  end loop;
  if jsonb_array_length(v_before) = 0 then
    return jsonb_build_object('ok', true, 'lines', 0, 'nothing', true);
  end if;

  update collection_trips set difference_accepted_at = now(), difference_accepted_by = auth.uid()
   where shop_id = tr.shop_id and id = tr.id;
  perform manager_log_decision(tr.shop_id, 'trip.difference',
    'Accepted the yard''s count on trip ' || tr.id || ': ' || jsonb_array_length(v_before) || ' line(s) differ from the Buyer''s',
    nullif(v_value, 0), jsonb_build_object('table', 'collection_trips', 'id', tr.id),
    v_before, v_after);
  return jsonb_build_object('ok', true, 'lines', jsonb_array_length(v_before), 'at', now());
end $$;
revoke all on function accept_trip_difference(text) from public, anon;
grant execute on function accept_trip_difference(text) to authenticated;

-- ---------------------------------------------------------------------
-- 10. The restock list: the shared home the Buyer's restock list (0125,
-- buy.restock) writes into. The Manager says "not yet" on a line
-- (restock.hold). Nobody updates a row directly; hold_restock_line() is
-- the way on, and the Buyer's own functions (0125) mark lines bought or
-- dropped.
create table if not exists restock_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  key text,
  product_id text,
  variant_idx text,
  name text not null,
  qty numeric not null check (qty > 0),
  unit text,
  cost numeric,
  supplier_id text,
  for_date date,
  status text not null default 'planned' check (status in ('planned', 'held', 'bought', 'dropped')),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  held_by uuid,
  held_at timestamptz
);
create index if not exists restock_lines_shop_idx on restock_lines(shop_id, status, created_at desc);
alter table restock_lines enable row level security;

drop policy if exists "members read restock" on restock_lines;
create policy "members read restock" on restock_lines
  for select using (is_shop_member(shop_id));
drop policy if exists "restock buyers add lines" on restock_lines;
create policy "restock buyers add lines" on restock_lines
  for insert with check (has_task(shop_id, 'buy.restock') and created_by = auth.uid()
    and status = 'planned' and held_by is null and held_at is null);
-- No update or delete policy.

create or replace function hold_restock_line(p_id uuid, p_hold boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  select * into r from restock_lines where id = p_id for update;
  if not found then raise exception 'That restock line is gone.'; end if;
  if not has_task(r.shop_id, 'restock.hold') then
    raise exception 'Holding a restock line is the Manager''s (restock.hold).' using errcode = '42501';
  end if;
  if p_hold and r.status = 'held' or not p_hold and r.status = 'planned' then
    return jsonb_build_object('ok', true, 'id', p_id, 'status', r.status, 'already', true);
  end if;
  if r.status <> (case when p_hold then 'planned' else 'held' end) then
    raise exception 'That line is % already; only a planned line is held, and only a held one let go.', r.status;
  end if;
  update restock_lines
     set status = case when p_hold then 'held' else 'planned' end,
         held_by = case when p_hold then auth.uid() else null end,
         held_at = case when p_hold then now() else null end
   where id = p_id;
  perform manager_log_decision(r.shop_id, 'restock.hold',
    case when p_hold then 'Held restock: ' else 'Let restock go ahead: ' end || r.qty || ' × ' || r.name,
    case when r.cost is not null then r.cost * r.qty end,
    jsonb_build_object('table', 'restock_lines', 'id', r.id),
    jsonb_build_object('status', r.status), jsonb_build_object('status', case when p_hold then 'held' else 'planned' end));
  return jsonb_build_object('ok', true, 'id', p_id, 'status', case when p_hold then 'held' else 'planned' end);
end $$;
revoke all on function hold_restock_line(uuid, boolean) from public, anon;
grant execute on function hold_restock_line(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 11. Damaged, lost or stolen: the Store reports (stock.report, 0124),
-- the Manager writes it off or dismisses it (stock.writeoff). Shaped like
-- stock_counts (0115): the reporter inserts one row, status 'sent';
-- nobody updates it from a client.
create table if not exists stock_reports (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  key text,
  product_id text,
  variant_idx text,
  name text not null,
  qty numeric not null check (qty > 0),
  why text check (why in ('damaged', 'lost', 'stolen', 'expired', 'other')),
  note text,
  photo_path text,
  reported_by uuid default auth.uid(),
  reported_by_name text,
  status text not null default 'sent' check (status in ('sent', 'written_off', 'dismissed')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists stock_reports_shop_idx on stock_reports(shop_id, status, created_at desc);
alter table stock_reports enable row level security;

drop policy if exists "members read reports" on stock_reports;
create policy "members read reports" on stock_reports
  for select using (is_shop_member(shop_id));
drop policy if exists "reporters add reports" on stock_reports;
create policy "reporters add reports" on stock_reports
  for insert with check (has_task(shop_id, 'stock.report') and reported_by = auth.uid() and status = 'sent'
    and decided_by is null and decided_at is null);
-- No update or delete policy.

-- Writes the goods off the shelf (type 'writeoff', every delta below
-- zero) and marks the reports written off. With no p_lines, the lines
-- are the reports' own: each report's qty off its key.
create or replace function write_off_stock(p_shop_id uuid, p_report_ids uuid[], p_lines jsonb, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(p_report_ids, '{}');
  v_lines jsonb := p_lines;
  n int;
  res jsonb;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not has_task(p_shop_id, 'stock.writeoff') then
    raise exception 'Writing off stock is the Manager''s (stock.writeoff).' using errcode = '42501';
  end if;
  if array_length(v_ids, 1) is not null then
    select count(*) into n from stock_reports where shop_id = p_shop_id and id = any(v_ids) and status = 'sent';
    if n <> (select count(distinct x) from unnest(v_ids) x) then
      raise exception 'One of those reports is decided already, or is not this shop''s.';
    end if;
    perform 1 from stock_reports where id = any(v_ids) for update;
  end if;
  if v_lines is null or jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) = 0 then
    select coalesce(jsonb_agg(jsonb_build_object('key', r.key, 'productId', r.product_id, 'variantIdx', r.variant_idx,
                                                 'name', r.name, 'delta', -r.qty)), '[]'::jsonb)
      into v_lines from stock_reports r where r.id = any(v_ids);
  end if;
  res := manager_apply_stock_lines(p_shop_id, v_lines, 'writeoff',
           'Write-off' || coalesce(' · ' || v_reason, ''), -1);
  if array_length(v_ids, 1) is not null then
    update stock_reports set status = 'written_off', decided_by = auth.uid(), decided_at = now()
     where id = any(v_ids);
  end if;
  perform manager_log_decision(p_shop_id, 'stock.writeoff',
    'Wrote off ' || coalesce((select string_agg(abs((m ->> 'delta')::numeric)::text || ' × ' || coalesce(m ->> 'name', m ->> 'key'), ', ')
                                from jsonb_array_elements(res -> 'moved') m), 'nothing (the shelf was already empty)')
      || coalesce(' · ' || v_reason, ''),
    nullif((res ->> 'value')::numeric, 0),
    jsonb_build_object('table', 'stock_reports', 'ids', to_jsonb(v_ids)),
    (select coalesce(jsonb_agg(jsonb_build_object('key', m ->> 'key', 'qty', (m ->> 'before')::numeric)), '[]'::jsonb)
       from jsonb_array_elements(res -> 'moved') m),
    (select coalesce(jsonb_agg(jsonb_build_object('key', m ->> 'key', 'qty', (m ->> 'after')::numeric)), '[]'::jsonb)
       from jsonb_array_elements(res -> 'moved') m));
  return jsonb_build_object('ok', true, 'changed', (res ->> 'changed')::int, 'reports', to_jsonb(v_ids));
end $$;
revoke all on function write_off_stock(uuid, uuid[], jsonb, text) from public, anon;
grant execute on function write_off_stock(uuid, uuid[], jsonb, text) to authenticated;

create or replace function dismiss_stock_report(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  r record;
begin
  select * into r from stock_reports where id = p_id for update;
  if not found then raise exception 'That report is gone.'; end if;
  if not has_task(r.shop_id, 'stock.writeoff') then
    raise exception 'Deciding a stock report is the Manager''s (stock.writeoff).' using errcode = '42501';
  end if;
  if r.status <> 'sent' then raise exception 'That report is % already.', r.status; end if;
  update stock_reports set status = 'dismissed', decided_by = auth.uid(), decided_at = now() where id = p_id;
  perform manager_log_decision(r.shop_id, 'stock.writeoff',
    'Dismissed a report of ' || r.qty || ' × ' || r.name || coalesce(' ' || r.why, '')
      || coalesce(' from ' || nullif(r.reported_by_name, ''), '') || ': nothing written off',
    null, jsonb_build_object('table', 'stock_reports', 'id', r.id),
    jsonb_build_object('status', 'sent'), jsonb_build_object('status', 'dismissed'));
  return jsonb_build_object('ok', true, 'id', p_id, 'status', 'dismissed');
end $$;
revoke all on function dismiss_stock_report(uuid) from public, anon;
grant execute on function dismiss_stock_report(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 12. A salesperson's goal (goal.set).
--
-- The shape manager.html personGoal() and sales.html read: a
-- manager_notes row of kind 'target', status 'open', with
--   body {who: <their login>, metric: 'sales', aim, from, to}
-- plus what index.html's scoreboard reads on every target (baseline,
-- unit) and who set it. An open goal of theirs that overlaps the new
-- period is closed (status 'closed'), so only one is live; finished goals
-- are left as the record they are.
create or replace function set_person_goal(p_shop_id uuid, p_who text, p_aim numeric, p_from date, p_to date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_closed bigint[];
  v_prev jsonb;
  v_id bigint;
  v_name text;
  v_body jsonb;
begin
  if not has_task(p_shop_id, 'goal.set') then
    raise exception 'Setting a salesperson''s goal is the Manager''s (goal.set).' using errcode = '42501';
  end if;
  if p_aim is null or p_aim <= 0 then raise exception 'A goal needs an aim above zero.' using errcode = '22023'; end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'A goal needs a first and a last day, in that order.' using errcode = '22023';
  end if;
  if not exists (select 1 from shop_members m where m.shop_id = p_shop_id and m.user_id::text = p_who) then
    raise exception 'That person has no login in this shop.' using errcode = '22023';
  end if;
  select s.name into v_name from staff s where s.shop_id = p_shop_id and s.user_id::text = p_who limit 1;

  select coalesce(array_agg(n.id order by n.id), '{}'),
         coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'aim', n.body -> 'aim', 'from', n.body -> 'from', 'to', n.body -> 'to') order by n.id), '[]'::jsonb)
    into v_closed, v_prev
    from manager_notes n
   where n.shop_id = p_shop_id and n.kind = 'target' and n.status = 'open'
     and n.body ->> 'who' = p_who and n.body ->> 'metric' = 'sales'
     and coalesce(n.body ->> 'to', '9999-12-31') >= p_from::text;
  if array_length(v_closed, 1) is not null then
    update manager_notes set status = 'closed' where id = any(v_closed);
  end if;

  v_body := jsonb_build_object('who', p_who, 'metric', 'sales', 'aim', round(p_aim),
    'from', to_char(p_from, 'YYYY-MM-DD'), 'to', to_char(p_to, 'YYYY-MM-DD'),
    'baseline', 0, 'unit', 'ugx', 'source', 'manager', 'setBy', auth.uid());
  insert into manager_notes (shop_id, kind, date, body, status)
       values (p_shop_id, 'target', current_date, v_body, 'open')
    returning id into v_id;

  perform manager_log_decision(p_shop_id, 'goal.set',
    'Goal for ' || coalesce(nullif(v_name, ''), 'a salesperson') || ': ' || round(p_aim) || ' in sales, '
      || to_char(p_from, 'DD Mon') || ' to ' || to_char(p_to, 'DD Mon YYYY'),
    round(p_aim), jsonb_build_object('table', 'manager_notes', 'id', v_id),
    jsonb_build_object('goals', v_prev), jsonb_build_object('goal', v_body));
  return jsonb_build_object('ok', true, 'id', v_id, 'body', v_body, 'closed', to_jsonb(v_closed));
end $$;
revoke all on function set_person_goal(uuid, text, numeric, date, date) from public, anon;
grant execute on function set_person_goal(uuid, text, numeric, date, date) to authenticated;
