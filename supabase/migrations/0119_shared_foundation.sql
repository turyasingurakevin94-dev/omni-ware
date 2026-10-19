-- The shared foundation: the Checking gate, the one invoicing function,
-- and the run that invoices a delivered order after 24 hours.
--
-- docs/decision-rights.md section 5 step 0. Every role app builds on these
-- and none of them carries its own copy. What lives here:
--
--   1. THE CHECKING GATE (saved_quotes_ow_checking_gate). An order cannot
--      leave Checking while a line waits for the Manager's price decision,
--      or while the Manager's credit hold holds it. The gate is the same
--      test manager.html draws its "Needs a yes" from:
--        a price    lineWaitsPrice(): the salesperson set the price
--                   (priceBy), it is 'under', 'nomargin' or 'nocost', and
--                   there is no priceReview for the price and quantity the
--                   line stands at now.
--        credit     heldWaiting(), its over-the-limit half: the customer's
--                   debt plus this order would go over their credit limit,
--                   and the Manager has not said Release or Cash first.
--                   The old-bill half (owed past the hold days) is the
--                   apps' to show; the database never holds an order the
--                   Manager's screen does not also show as waiting.
--      A move out of Checking that the gate refuses is not an error. The
--      rest of the write is kept (a supplier's yes, a price) and the move
--      is kept back on the order as payload.gateHeldMove. When the last
--      decision clears the gate, that write moves the order on itself:
--      whoever clears the last gate moves the order. A held move goes
--      stale, and is dropped, when the lines, the suppliers' answers or an
--      agent's change move underneath it.
--      Only has_task('price.approve') may write a line's priceReview.
--      An order a salesperson places entirely from our own shelf skips
--      Checking and goes straight to Packing.
--      The gate binds every login, the owner's too: the owner steps in by
--      making the decision (owner and admin hold every task), not by
--      moving past it. Edge Functions and the hourly run (no login) are
--      not gated.
--
--   2. ONE INVOICING FUNCTION, invoice_order(shop, order). What the
--      console's toggleQuoteInvoiced() does, on the server:
--        stock     every line that comes off the shelf (quoted from stock,
--                  or bought in and received) leaves in the shelf's unit,
--                  oldest lots first, one stock_log row of type 'sale'
--                  (applyQuoteStockDeduction); a supplier's pack that could
--                  not be broken leaves its surplus on the shelf
--                  (applyQuoteSurplusToStock)
--        bills     one purchase invoice per supplier on the order, billed
--                  at what was received, or else at what was bought
--                  (generatePurchaseInvoicesForQuote)
--        debt      the customer's debt brought to the balance due, one
--                  "Auto-sync — INV-…" line, the customer made from the
--                  order's name when there is none (syncInvoiceDebtCharge)
--      and the same keys on the order (_stockTaken, _stockLots,
--      _surplusStocked, debtCharged), so the console can still take an
--      invoice back the way it always has. Refused, as the console refuses
--      it, for an unsettled short pick; refused too for a price still
--      waiting for the Manager.
--      Callers: invoice.make (the Manager), and counter.sell for a counter
--      sale (payload.counter or counterSale). The caller's right is checked
--      first; the writes then run as the system, the way an Edge Function
--      with the service key writes, so the role guards on orders and
--      customers (0113, 0116, 0122) do not refuse the invoicing function
--      they were written to wait for.
--
--   3. THE 24-HOUR RUN, ow_invoice_due_orders(), on pg_cron every hour.
--      Every order delivered 24 hours ago or more and not invoiced is
--      invoiced through the same function. One that cannot be (a short
--      pick, a price undecided) is skipped and stays on the Manager's
--      Decide list. Nothing waits for the owner.
--
--   4. THE OWNER'S LOG, decision_log, made here if 0123 has not made it
--      yet, so every build can write to it whatever order they are run in.
--      Its author may be empty: the hourly run decides as nobody's login.
--
--   5. A stale copy cannot take an invoice back. An order invoiced here
--      carries payload.invoicedBy; a save that sets invoiced back to false
--      from a copy that never saw that stamp (the console's memory from
--      before the run) keeps the invoice as it is.
--
-- Sales gets counter.sell here: a counter sale, pay and go for goods
-- on our own shelf, is invoiced by the salesperson through the same
-- function (0121 left it for this build). Every line must come off the
-- shelf; an order with a supplier line is the Manager's to invoice.
--
-- The 'sourcing' role, planned for this build, came ahead of it in 0128.
--
-- Applied by hand like every migration here, before 0120 and the apps'
-- own builds (0121-0127). Every function and trigger is replaced or
-- dropped before it is created. Safe to run twice.
--
-- THE SHOP'S CLOCK. Today, a late entry's date and the 24 hours are read
-- on Kampala time (ow_shop_tz), as the phones read them.
--
-- CHECK AFTERWARDS:
--   select proname from pg_proc where proname in ('invoice_order',
--     'ow_invoice_due_orders', 'saved_quotes_ow_checking_gate',
--     'saved_quotes_ow_keep_invoice', 'ow_order_total', 'ow_gate_reason');
--   -- 6 rows
--   select jobname, schedule from cron.job where jobname = 'ow-invoice-due';
--   -- 1 row, '7 * * * *' (only where pg_cron is switched on)
--   select 1 from role_tasks where role = 'sales' and task = 'counter.sell';
--   -- 1 row
--
-- IF THE HOURLY RUN IS NOT SCHEDULED: switch pg_cron on (Supabase
-- Dashboard -> Database -> Extensions -> pg_cron) and run this file again.
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_checking_gate on saved_quotes;
--   drop trigger if exists saved_quotes_ow_keep_invoice on saved_quotes;
--   select cron.unschedule('ow-invoice-due');
--   drop function if exists invoice_order(uuid, bigint);
--   delete from role_tasks where role = 'sales' and task = 'counter.sell';
--   (the order guards then refuse invoicing from a desk login again, as
--   0122 left them; the console invoices as it always has)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 0. Small readers.

create or replace function ow_shop_tz() returns text language sql immutable as $$ select 'Africa/Kampala'::text $$;
create or replace function ow_today() returns date language sql stable as $$ select (now() at time zone ow_shop_tz())::date $$;

-- A number from a jsonb text value, or null. Number(x) || 0 in the apps
-- is coalesce(ow_num(x), 0) here.
create or replace function ow_num(v text) returns numeric
language plpgsql immutable as $$
begin
  if v is null or btrim(v) = '' then return null; end if;
  return v::numeric;
exception when others then return null;
end $$;

create or replace function ow_ts(v text) returns timestamptz
language plpgsql stable as $$
begin
  if v is null or btrim(v) = '' then return null; end if;
  return v::timestamptz;
exception when others then return null;
end $$;

-- stockKey() (index.html): the product, or the product and its variant.
create or replace function ow_stock_key(p_product text, p_vi numeric) returns text
language sql immutable as $$
  select case when p_vi is null then p_product else p_product || '::' || p_vi::text end
$$;

-- An id from the shop's own counters (entity_id_counters), the same ones
-- next_row_id_blocks() and next_entity_id() hand the apps -- without
-- their membership check, because the hourly run has no login. Never
-- granted to a login.
create or replace function ow_next_row_id(p_shop_id uuid, p_kind text, p_floor bigint)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  insert into entity_id_counters (shop_id, kind, last_issued)
       values (p_shop_id, p_kind, greatest(0, coalesce(p_floor, 0)) + 1)
  on conflict (shop_id, kind) do update
          set last_issued = greatest(entity_id_counters.last_issued, coalesce(p_floor, 0)) + 1
    returning last_issued into v;
  return v;
end $$;
revoke all on function ow_next_row_id(uuid, text, bigint) from public, anon, authenticated;

-- Writing as the system. The caller's right is checked before this; the
-- writes after it run with no login, as an Edge Function with the
-- service key writes. Both of auth.uid()'s settings are cleared and put
-- back exactly as they were. Never granted to a login.
create or replace function ow_system_begin() returns jsonb
language plpgsql as $$
declare s jsonb := jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true),
                                      'claims', current_setting('request.jwt.claims', true));
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  return s;
end $$;
create or replace function ow_system_end(p_saved jsonb) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_saved ->> 'sub', ''), true);
  perform set_config('request.jwt.claims', coalesce(p_saved ->> 'claims', ''), true);
end $$;
revoke all on function ow_system_begin() from public, anon, authenticated;
revoke all on function ow_system_end(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. The owner's log (0123 makes the same table; whichever runs first
--    makes it, and the author may be empty).

create table if not exists decision_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  at timestamptz not null default now(),
  by uuid default auth.uid(),
  by_name text,
  role text,
  task text not null,
  what text not null,
  amount numeric,
  ref jsonb,
  before jsonb,
  after jsonb
);
alter table decision_log alter column by drop not null;
create index if not exists decision_log_shop_at_idx on decision_log(shop_id, at desc);
alter table decision_log enable row level security;

create or replace function ow_log(p_shop_id uuid, p_by uuid, p_by_name text, p_role text, p_task text, p_what text,
                                  p_amount numeric, p_ref jsonb, p_before jsonb, p_after jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into decision_log (shop_id, by, by_name, role, task, what, amount, ref, before, after)
       values (p_shop_id, p_by, p_by_name, p_role, p_task, p_what, p_amount, p_ref, p_before, p_after);
exception when others then
  -- The log never stops the decision it records.
  raise notice 'decision_log: % (%)', sqlerrm, sqlstate;
end $$;
revoke all on function ow_log(uuid, uuid, text, text, text, text, numeric, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. A line's selling price: quoteItemSellPrice() and what it reads.

-- effectiveMarkupRule / effectiveStockMarkupRule (index.html 60097, 60119).
create or replace function ow_markup_rule(p products, p_vi numeric, p_kind text, p_from_stock boolean, p_presets jsonb)
returns jsonb
language plpgsql stable as $$
declare
  v jsonb;
  val numeric;
  k text := case when p_kind = 'wholesale' then 'Wholesale' else 'Retail' end;
  d jsonb := coalesce(p_presets -> 'defaultMarkup', '{}'::jsonb);
begin
  if p.id is null then return null; end if;
  if p_vi is not null and jsonb_typeof(p.variants) = 'array' and p_vi >= 0 and p_vi < jsonb_array_length(p.variants) then
    v := p.variants -> p_vi::int;
    if jsonb_typeof(v) <> 'object' then v := null; end if;
  end if;
  if p_from_stock then
    if v is not null then
      val := coalesce(ow_num(v ->> ('stock' || k || 'MarkupValue')), 0);
      if val > 0 then return jsonb_build_object('type', v ->> ('stock' || k || 'MarkupType'), 'value', val); end if;
    end if;
    val := coalesce(case when p_kind = 'wholesale' then p.stock_wholesale_markup_value else p.stock_retail_markup_value end, 0);
    if val > 0 then
      return jsonb_build_object('type', case when p_kind = 'wholesale' then p.stock_wholesale_markup_type else p.stock_retail_markup_type end, 'value', val);
    end if;
  end if;
  if v is not null then
    val := coalesce(ow_num(v ->> (p_kind || 'MarkupValue')), 0);
    if val > 0 then return jsonb_build_object('type', v ->> (p_kind || 'MarkupType'), 'value', val); end if;
  end if;
  val := coalesce(case when p_kind = 'wholesale' then p.wholesale_markup_value else p.retail_markup_value end, 0);
  if val > 0 then
    return jsonb_build_object('type', case when p_kind = 'wholesale' then p.wholesale_markup_type else p.retail_markup_type end, 'value', val);
  end if;
  val := coalesce(ow_num(d ->> (p_kind || 'Value')), 0);
  if val > 0 then
    return jsonb_build_object('type', case when d ->> (p_kind || 'Type') = 'fixed' then 'fixed' else 'percent' end, 'value', val);
  end if;
  return null;
end $$;

-- applyRule (index.html 116750).
create or replace function ow_apply_rule(p_rule jsonb, p_base numeric, p_kind text, p_pack numeric)
returns numeric language sql immutable as $$
  select case
    when p_rule is null then null
    when p_rule ->> 'type' = 'fixed' then
      p_base + case when p_kind = 'wholesale' and coalesce(p_pack, 0) > 0
                    then (p_rule ->> 'value')::numeric / p_pack else (p_rule ->> 'value')::numeric end
    else p_base * (1 + (p_rule ->> 'value')::numeric / 100)
  end
$$;

-- tieredUnitPrice / tiersForKind (index.html).
create or replace function ow_tiered_unit_price(r prices, p_qty numeric, p_kind text)
returns numeric
language plpgsql stable as $$
declare
  base numeric;
  pack numeric := coalesce(r.pack_qty, 0);
  t jsonb;
  mq numeric;
  pr numeric;
  best numeric;
  best_min numeric := 0;
  n int := 0;
begin
  if r.id is null then return null; end if;
  base := case when p_kind = 'wholesale' then r.wholesale else r.retail end;
  best := base;
  for t in select e from jsonb_array_elements(case when jsonb_typeof(r.tiers) = 'array' then r.tiers else '[]'::jsonb end) e loop
    mq := ow_num(t ->> 'minQty');
    if p_kind = 'wholesale' then
      continue when not (pack > 0 and mq is not null and mq >= pack);
    else
      continue when not (pack = 0 or (mq is not null and mq < pack));
    end if;
    n := n + 1;
    pr := ow_num(t ->> 'price');
    if pr is not null and mq is not null and p_qty >= mq and mq >= best_min then
      best := pr; best_min := mq;
    end if;
  end loop;
  if n = 0 then return base; end if;
  return best;
end $$;

-- purchaseSideAtQty (index.html 59522).
create or replace function ow_purchase_side(r prices, p_qty numeric)
returns text
language plpgsql stable as $$
declare
  pack numeric := coalesce(r.pack_qty, 0);
  nat text;
  oth text;
begin
  if r.id is null then return null; end if;
  nat := case when pack > 0 and p_qty >= pack then 'wholesale' else 'retail' end;
  oth := case when nat = 'wholesale' then 'retail' else 'wholesale' end;
  if ow_tiered_unit_price(r, p_qty, nat) is not null then return nat; end if;
  if ow_tiered_unit_price(r, p_qty, oth) is not null then return oth; end if;
  return null;
end $$;

-- The supplier's price row a line was bought on: productPriceRows(...)
-- .find(r => r.supplierId === it.supplierId), oldest row first.
create or replace function ow_line_row(p_shop_id uuid, it jsonb)
returns prices
language sql stable as $$
  select r.* from prices r
   where r.shop_id = p_shop_id and r.product_id = it ->> 'productId'
     and ow_num(r.variant_idx) is not distinct from ow_num(it ->> 'variantIdx')
     and r.supplier_id = it ->> 'supplierId'
   order by r.id limit 1
$$;

-- sellSideFor (manager.html, index.html).
create or replace function ow_sell_side(r prices, p_qty numeric, p_pack numeric, p products, p_vi numeric, p_from_stock boolean, p_presets jsonb)
returns text
language plpgsql stable as $$
declare
  nat text := case when coalesce(p_pack, 0) > 0 and p_qty >= p_pack then 'wholesale' else 'retail' end;
  oth text;
  from_row text;
begin
  oth := case when nat = 'wholesale' then 'retail' else 'wholesale' end;
  if r.id is not null then
    from_row := ow_purchase_side(r, p_qty);
    if from_row is not null then return from_row; end if;
  end if;
  if ow_markup_rule(p, p_vi, nat, p_from_stock, p_presets) is null
     and ow_markup_rule(p, p_vi, oth, p_from_stock, p_presets) is not null then
    return oth;
  end if;
  return nat;
end $$;

-- quoteItemSellPrice (index.html 59846): a line's price, each.
create or replace function ow_line_sell_price(p_shop_id uuid, it jsonb, p_presets jsonb)
returns numeric
language plpgsql stable as $$
declare
  buy numeric := coalesce(ow_num(it ->> 'price'), 0);
  p products;
  r prices;
  vi numeric := ow_num(it ->> 'variantIdx');
  qty numeric := coalesce(ow_num(it ->> 'qty'), 0);
  pack numeric := coalesce(ow_num(it ->> 'packQty'), 0);
  from_stock boolean := coalesce(it ->> 'supplierId', '') = '__stock__';
  kind text;
  s numeric;
begin
  if it ? 'sellPrice' and jsonb_typeof(it -> 'sellPrice') <> 'null' and coalesce(it ->> 'sellPrice', '') <> '' then
    return coalesce(ow_num(it ->> 'sellPrice'), 0);
  end if;
  select * into p from products where shop_id = p_shop_id and id = it ->> 'productId';
  if not found then return buy; end if;
  if not from_stock then r := ow_line_row(p_shop_id, it); end if;
  kind := ow_sell_side(r, qty, pack, p, vi, from_stock, p_presets);
  s := ow_apply_rule(ow_markup_rule(p, vi, kind, from_stock, p_presets), buy, kind, pack);
  return coalesce(s, buy);
end $$;

-- lineHasRule / linePriceToConfirm (manager.html): a line with no price
-- the shop decided, left out of what is quoted until somebody prices it.
create or replace function ow_line_to_confirm(p_shop_id uuid, it jsonb, p_presets jsonb)
returns boolean
language plpgsql stable as $$
declare
  p products;
  r prices;
  vi numeric := ow_num(it ->> 'variantIdx');
  from_stock boolean := coalesce(it ->> 'supplierId', '') = '__stock__';
  kind text;
begin
  if coalesce(ow_num(it ->> 'sellPrice'), 0) > 0 then return false; end if;
  if not (coalesce(ow_num(it ->> 'price'), 0) > 0) then return true; end if;
  select * into p from products where shop_id = p_shop_id and id = it ->> 'productId';
  if not found then return true; end if;
  if not from_stock then r := ow_line_row(p_shop_id, it); end if;
  kind := ow_sell_side(r, coalesce(ow_num(it ->> 'qty'), 0), coalesce(ow_num(it ->> 'packQty'), 0), p, vi, from_stock, p_presets);
  return ow_markup_rule(p, vi, kind, from_stock, p_presets) is null;
end $$;

-- savedQuoteTotal (index.html 63778): the goods, the charges, less the
-- discount, the credit on top, less the credit notes. p_known_only is
-- pricedView()'s total: lines still to be priced left out.
create or replace function ow_order_total(p_shop_id uuid, p_payload jsonb, p_known_only boolean default false)
returns numeric
language plpgsql stable as $$
declare
  presets jsonb := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  it jsonb;
  ch jsonb;
  goods numeric := 0;
  charges numeric := 0;
  gross numeric;
  cash numeric;
  credit numeric := 0;
  credited numeric := 0;
  v numeric;
  pct numeric;
begin
  for it in select e from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'items') = 'array' then p_payload -> 'items' else '[]'::jsonb end) e loop
    continue when jsonb_typeof(it) <> 'object';
    continue when p_known_only and ow_line_to_confirm(p_shop_id, it, presets);
    goods := goods + coalesce(ow_num(it ->> 'qty'), 0) * ow_line_sell_price(p_shop_id, it, presets);
  end loop;
  for ch in select e from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'charges') = 'array' then p_payload -> 'charges' else '[]'::jsonb end) e loop
    continue when jsonb_typeof(ch) <> 'object';
    v := coalesce(ow_num(ch ->> 'value'), 0);
    continue when not (v > 0);
    charges := charges + case when ch ->> 'type' = 'percent' then round(goods * v / 100) else round(v) end;
  end loop;
  gross := goods + charges;
  cash := gross - least(greatest(0, coalesce(ow_num(p_payload ->> 'discount'), 0)), gross);
  pct := ow_num(p_payload -> 'credit' ->> 'pct');
  if jsonb_typeof(p_payload -> 'credit') = 'object' and coalesce(pct, 0) > 0 then
    credit := round(cash * pct / 100);
  end if;
  select coalesce(sum(coalesce(ow_num(cn ->> 'amount'), 0)), 0) into credited
    from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'creditNotes') = 'array' then p_payload -> 'creditNotes' else '[]'::jsonb end) cn
   where jsonb_typeof(cn) = 'object' and coalesce(cn ->> 'voided', 'false') not in ('true');
  return cash + credit - credited;
end $$;

-- ---------------------------------------------------------------------
-- 3. The gate's two questions.

-- lineWaitsPrice (manager.html): a salesperson's price the Manager has not
-- decided at the price and quantity the line stands at now.
create or replace function ow_line_waits_price(p_shop_id uuid, it jsonb, p_presets jsonb)
returns boolean
language plpgsql stable as $$
declare
  r jsonb := it -> 'priceReview';
  now_price numeric;
begin
  if jsonb_typeof(it) <> 'object' then return false; end if;
  if coalesce(it ->> 'priceBy', '') = '' or jsonb_typeof(it -> 'priceBy') = 'boolean' and it ->> 'priceBy' = 'false' then return false; end if;
  if coalesce(it ->> 'priceNote', '') not in ('under', 'nomargin', 'nocost') then return false; end if;
  if jsonb_typeof(r) <> 'object' then return true; end if;
  now_price := round(case when coalesce(ow_num(it ->> 'sellPrice'), 0) > 0 then ow_num(it ->> 'sellPrice')
                          else ow_line_sell_price(p_shop_id, it, p_presets) end);
  return not coalesce(ow_num(r ->> 'price') = now_price and ow_num(r ->> 'qty') = ow_num(it ->> 'qty'), false);
end $$;

-- What holds an order in Checking, or null when nothing does.
-- 'price' a line waits for the Manager's price; 'credit' the customer would
-- go over their limit with it and the Manager has not said Release or
-- Cash first (manager.html creditCase / heldWaiting, its over-limit half).
create or replace function ow_gate_reason(p_shop_id uuid, p_payload jsonb, p_amount_paid numeric)
returns text
language plpgsql stable as $$
declare
  presets jsonb := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  it jsonb;
  c customers;
  amt numeric;
  dec jsonb := p_payload -> 'creditCheck';
begin
  for it in select e from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'items') = 'array' then p_payload -> 'items' else '[]'::jsonb end) e loop
    if ow_line_waits_price(p_shop_id, it, presets) then return 'price'; end if;
  end loop;
  if coalesce(p_payload ->> 'customerId', '') <> '' then
    select * into c from customers where shop_id = p_shop_id and id = p_payload ->> 'customerId';
    if found and coalesce(c.credit_limit, 0) > 0 then
      amt := greatest(0, round(ow_order_total(p_shop_id, p_payload, true)) - coalesce(p_amount_paid, 0));
      if coalesce(c.debt, 0) + amt > c.credit_limit
         and (jsonb_typeof(dec) is distinct from 'object' or dec ->> 'decision' = 'hold') then
        return 'credit';
      end if;
    end if;
  end if;
  return null;
end $$;

-- What a held move was held on: the lines, the suppliers' answers, an
-- agent's change or cancel. Any of them moving makes the held move stale.
create or replace function ow_gate_terms(p_payload jsonb) returns text
language sql immutable as $$
  select md5(coalesce((
    select jsonb_agg(jsonb_build_array(e -> 'productId', e -> 'variantIdx', e -> 'qty', e -> 'supplierId', e -> 'price') order by n)
      from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'items') = 'array' then p_payload -> 'items' else '[]'::jsonb end)
           with ordinality as x(e, n)), '[]'::jsonb)::text
    || coalesce((select jsonb_object_agg(k, v -> 'state') from jsonb_each(
         case when jsonb_typeof(p_payload -> 'supplierConfirms') = 'object' then p_payload -> 'supplierConfirms' else '{}'::jsonb end) s(k, v)), '{}'::jsonb)::text
    || coalesce(p_payload -> 'agentCancel', 'null'::jsonb)::text
    || coalesce(p_payload -> 'agentChange' -> 'state', 'null'::jsonb)::text)
$$;

-- ---------------------------------------------------------------------
-- 4. The gate itself.

create or replace function saved_quotes_ow_checking_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_role text;
  presets jsonb;
  reason text;
  target text;
  held jsonb;
  now_ms numeric := floor(extract(epoch from clock_timestamp()) * 1000);
  it jsonb;
  ot jsonb;
  n int;
  shelf_only boolean;
begin
  -- Edge Functions (agents, the portal, WhatsApp) and the hourly run.
  if uid is null then return new; end if;
  select m.role into v_role from shop_members m where m.shop_id = new.shop_id and m.user_id = uid limit 1;
  if v_role is null then return new; end if;
  if jsonb_typeof(new.payload) is distinct from 'object' then return new; end if;
  -- The apps save by upsert: an insert of an order already here is the
  -- update it becomes, and is judged there, against the order as it was.
  if tg_op = 'INSERT' and exists (select 1 from saved_quotes q where q.id = new.id) then return new; end if;

  -- 4a. Only the Manager's task writes a line's priceReview.
  if not has_task(new.shop_id, 'price.approve') then
    n := 0;
    for it in select e from jsonb_array_elements(case when jsonb_typeof(new.payload -> 'items') = 'array' then new.payload -> 'items' else '[]'::jsonb end) e loop
      n := n + 1;
      continue when jsonb_typeof(it -> 'priceReview') is distinct from 'object';
      ot := null;
      if tg_op = 'UPDATE' then
        select e into ot from jsonb_array_elements(case when jsonb_typeof(old.payload -> 'items') = 'array' then old.payload -> 'items' else '[]'::jsonb end)
               with ordinality as x(e, k)
         where (it ? 'lineId' and e ->> 'lineId' = it ->> 'lineId') or (not it ? 'lineId' and k = n)
         limit 1;
      end if;
      if ot is null or (ot -> 'priceReview') is distinct from (it -> 'priceReview') then
        raise exception 'A price below the shop''s is the Manager''s to decide (price.approve).' using errcode = '42501';
      end if;
    end loop;
  end if;

  -- 4b. An order a salesperson places entirely from our own shelf has
  -- nothing to ask a supplier: it goes straight to Packing.
  if tg_op = 'INSERT' and new.status = 'draft' and v_role not in ('owner', 'admin')
     and coalesce(new.payload ->> 'originAgentId', '') = '' and coalesce(new.payload ->> 'originPortal', '') not in ('true')
     and coalesce(new.payload ->> 'originWa', '') not in ('true')
     and jsonb_typeof(new.payload -> 'items') = 'array' and jsonb_array_length(new.payload -> 'items') > 0 then
    select bool_and(coalesce(e ->> 'supplierId', '') = '__stock__') into shelf_only
      from jsonb_array_elements(new.payload -> 'items') e;
    if shelf_only then
      new.status := 'preparing';
      new.payload := jsonb_set(new.payload, '{stageEnteredAt}', to_jsonb(now_ms));
      new.payload := jsonb_set(new.payload, '{stageLog}',
        coalesce(case when jsonb_typeof(new.payload -> 'stageLog') = 'array' then new.payload -> 'stageLog' end, '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('status', 'preparing', 'at', now_ms, 'auto', true, 'shelf', true)));
    end if;
  end if;

  -- 4c. Leaving Checking.
  if (tg_op = 'INSERT' and new.status <> 'draft')
     or (tg_op = 'UPDATE' and old.status = 'draft' and new.status is distinct from 'draft' and not coalesce(new.voided, false)) then
    reason := ow_gate_reason(new.shop_id, new.payload, new.amount_paid);
    if reason is null then
      new.payload := new.payload - 'gateHeldMove';
      return new;
    end if;
    target := new.status;
    new.status := 'draft';
    if tg_op = 'UPDATE' then
      new.payload := jsonb_set(new.payload, '{stageEnteredAt}', coalesce(old.payload -> 'stageEnteredAt', to_jsonb(now_ms)));
      -- The move that did not happen comes back off the log.
      new.payload := jsonb_set(new.payload, '{stageLog}', coalesce((
        select jsonb_agg(e order by k) from jsonb_array_elements(
               case when jsonb_typeof(new.payload -> 'stageLog') = 'array' then new.payload -> 'stageLog' else '[]'::jsonb end) with ordinality as x(e, k)
         where e ->> 'status' = 'draft'
            or exists (select 1 from jsonb_array_elements(
                        case when jsonb_typeof(old.payload -> 'stageLog') = 'array' then old.payload -> 'stageLog' else '[]'::jsonb end) o
                        where o = e)), '[]'::jsonb));
    else
      new.payload := jsonb_set(new.payload, '{stageLog}', coalesce((
        select jsonb_agg(e order by k) from jsonb_array_elements(
               case when jsonb_typeof(new.payload -> 'stageLog') = 'array' then new.payload -> 'stageLog' else '[]'::jsonb end) with ordinality as x(e, k)
         where e ->> 'status' = 'draft'), jsonb_build_array(jsonb_build_object('status', 'draft', 'at', now_ms))));
    end if;
    new.payload := new.payload || jsonb_build_object('gateHeldMove', jsonb_build_object(
      'to', target, 'at', now_ms, 'by', uid, 'why', reason, 'terms', ow_gate_terms(new.payload)));
    return new;
  end if;

  -- 4d. A move kept back, released by the write that clears the gate.
  if new.status = 'draft' and jsonb_typeof(new.payload -> 'gateHeldMove') = 'object' then
    held := new.payload -> 'gateHeldMove';
    if held ->> 'terms' is distinct from ow_gate_terms(new.payload) or coalesce(new.voided, false) then
      new.payload := new.payload - 'gateHeldMove';
    elsif ow_gate_reason(new.shop_id, new.payload, new.amount_paid) is null then
      new.status := held ->> 'to';
      new.payload := (new.payload - 'gateHeldMove')
        || jsonb_build_object('stageEnteredAt', now_ms,
             'stageLog', coalesce(case when jsonb_typeof(new.payload -> 'stageLog') = 'array' then new.payload -> 'stageLog' end, '[]'::jsonb)
               || jsonb_build_array(jsonb_build_object('status', held ->> 'to', 'at', now_ms, 'auto', true, 'gate', true)));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists saved_quotes_ow_checking_gate on saved_quotes;
create trigger saved_quotes_ow_checking_gate before insert or update on saved_quotes
  for each row execute function saved_quotes_ow_checking_gate();

-- ---------------------------------------------------------------------
-- 5. Stock moves, as the console's applyStockDelta() makes them.

-- stockUnitFor (index.html 112191): the shelf's one unit and pack.
create or replace function ow_shelf_unit(p_shop_id uuid, p_product text, p_vi numeric,
                                         out unit text, out pack_qty numeric, out pack_unit text, out has_pack boolean)
language plpgsql stable as $$
declare r prices;
begin
  select * into r from prices x
   where x.shop_id = p_shop_id and x.product_id = p_product and ow_num(x.variant_idx) is not distinct from p_vi
     and coalesce(x.pack_qty, 0) > 0 and coalesce(x.pack_unit, '') <> ''
     and lower(btrim(x.pack_unit)) <> lower(btrim(coalesce(x.unit, '')))
   order by coalesce(x.out_of_stock, false), x.id limit 1;
  if found then
    unit := btrim(coalesce(r.unit, '')); pack_qty := r.pack_qty; pack_unit := btrim(r.pack_unit); has_pack := true;
    return;
  end if;
  select btrim(x.unit) into unit from prices x
   where x.shop_id = p_shop_id and x.product_id = p_product and ow_num(x.variant_idx) is not distinct from p_vi
     and coalesce(x.unit, '') <> ''
   order by x.id limit 1;
  unit := coalesce(unit, ''); pack_qty := 0; pack_unit := ''; has_pack := false;
end $$;

-- stockMoveOnRowUnit (index.html): a movement said in some unit, restated
-- in the shelf's.
create or replace function ow_on_shelf(p_shop_id uuid, p_product text, p_vi numeric, p_qty numeric, p_unit text, p_line jsonb, p_cost numeric,
                                       out qty numeric, out cost numeric)
language plpgsql stable as $$
declare
  s record;
  said text := lower(btrim(coalesce(p_unit, '')));
  pk numeric;
begin
  qty := coalesce(p_qty, 0); cost := p_cost;
  s := ow_shelf_unit(p_shop_id, p_product, p_vi);
  if said = '' or s.unit = '' or said = lower(s.unit) then return; end if;
  if s.has_pack and said = lower(s.pack_unit) then
    pk := case when coalesce(ow_num(p_line ->> 'packQty'), 0) > 0 and lower(btrim(coalesce(p_line ->> 'packUnit', ''))) = said
               then ow_num(p_line ->> 'packQty') else s.pack_qty end;
    qty := qty * pk;
    cost := case when p_cost is null then null else p_cost / pk end;
  end if;
end $$;

-- applyStockDelta (index.html 112490): the count, the FIFO lots, one log
-- row. Returns the lots a reduction took, oldest first, as the console
-- keeps them on the line (_stockLots) to give them back on an undo.
create or replace function ow_stock_move(p_shop_id uuid, p_product text, p_vi numeric, p_label text, p_delta numeric,
                                         p_type text, p_note text, p_cost numeric, p_supplier text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text := ow_stock_key(p_product, p_vi);
  v_before numeric;
  v_after numeric;
  v_change numeric;
  left_to_take numeric;
  lot record;
  take numeric;
  taken jsonb := '[]'::jsonb;
  floor_id bigint;
begin
  -- The row first, so there is always one to lock: two moves on a key
  -- nobody has stocked yet wait for each other instead of both reading 0.
  insert into stock (shop_id, key, product_id, variant_idx, qty)
       values (p_shop_id, k, p_product, p_vi::text, 0)
  on conflict (shop_id, key) do nothing;
  select qty into v_before from stock where shop_id = p_shop_id and key = k for update;
  v_before := coalesce(v_before, 0);
  v_after := greatest(0, round(v_before + p_delta, 6));
  v_change := round(v_after - v_before, 6);
  update stock set qty = v_after where shop_id = p_shop_id and key = k;
  if v_change > 0 then
    insert into stock_lots (shop_id, key, qty, cost) values (p_shop_id, k, v_change, p_cost);
  elsif v_change < 0 then
    left_to_take := -v_change;
    for lot in select id, qty, cost, consign from stock_lots where shop_id = p_shop_id and key = k order by id for update loop
      exit when left_to_take <= 0;
      take := least(lot.qty, left_to_take);
      taken := taken || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('qty', trim_scale(take), 'cost', lot.cost, 'consign', lot.consign)));
      if lot.qty <= left_to_take then delete from stock_lots where id = lot.id;
      else update stock_lots set qty = qty - left_to_take where id = lot.id; end if;
      left_to_take := left_to_take - take;
    end loop;
    -- {qty, cost} with cost kept even when null, as consumeStockLots writes it.
    taken := (select coalesce(jsonb_agg(case when e ? 'cost' then e else e || jsonb_build_object('cost', null) end), '[]'::jsonb)
                from jsonb_array_elements(taken) e);
  end if;
  select coalesce(max(id), 0) into floor_id from stock_log where shop_id = p_shop_id;
  insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at, cost, supplier_id)
       values (ow_next_row_id(p_shop_id, 'row:stock_log', floor_id), p_shop_id, k, p_product, p_vi::text, p_label, p_type,
               v_change, v_after, coalesce(p_note, ''), ow_today(), now(),
               case when p_cost is not null and p_type in ('restock', 'correction') then p_cost end,
               case when p_type = 'restock' and coalesce(p_supplier, '') <> '' then p_supplier end);
  return taken;
end $$;
revoke all on function ow_stock_move(uuid, text, numeric, text, numeric, text, text, numeric, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Invoicing.

-- quoteLineUnitsBought / ipLineOutlay (index.html 59329): what buying the
-- line from its supplier leaves you holding -- whole packs where the
-- supplier sells no less.
create or replace function ow_units_bought(p_shop_id uuid, it jsonb)
returns numeric
language plpgsql stable as $$
declare
  qty numeric := coalesce(ow_num(it ->> 'qty'), 0);
  r prices;
  pack numeric;
  units numeric;
  nat text;
  oth text;
begin
  if coalesce(it ->> 'supplierId', '') in ('', '__stock__') then return qty; end if;
  r := ow_line_row(p_shop_id, it);
  if r.id is null or not (qty > 0) then return qty; end if;
  pack := coalesce(r.pack_qty, 0);
  units := case when r.retail is null and pack > 0 then ceil(qty / pack) * pack else qty end;
  nat := case when pack > 0 and units >= pack then 'wholesale' else 'retail' end;
  oth := case when nat = 'wholesale' then 'retail' else 'wholesale' end;
  if ow_tiered_unit_price(r, units, nat) is null and ow_tiered_unit_price(r, units, oth) is null then return qty; end if;
  return units;
end $$;

-- orderHasPickShortfall (shared-worker.js 1551).
create or replace function ow_pick_shortfall(p_payload jsonb) returns boolean
language sql immutable as $$
  select coalesce(p_payload ->> 'pickShortfallAckAt', '') in ('', 'false', 'null', '0')
     and exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'items') = 'array' then p_payload -> 'items' else '[]'::jsonb end) e
        where e ->> 'pickStatus' = 'short'
          and least(greatest(0, coalesce(ow_num(e ->> 'qty'), 0)), greatest(0, coalesce(ow_num(e ->> 'pickedQty'), 0)))
              < greatest(0, coalesce(ow_num(e ->> 'qty'), 0)))
$$;

create or replace function ow_line_received(it jsonb) returns boolean
language sql immutable as $$
  select coalesce(it ->> 'receivedAt', '') <> '' and coalesce(ow_num(it ->> 'receivedQty'), 0) > 0
$$;

-- The work, with no right checked: invoice_order() and the hourly run
-- check theirs first. Errors it raises on purpose:
--   OWSHP  a short pick not settled      OWPRC  a price still waiting
--   OWBIL  supplier bills already raised for this order
create or replace function ow_invoice_core(p_shop_id uuid, p_quote_id bigint, p_via text, p_by uuid, p_by_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q saved_quotes;
  pay jsonb;
  presets jsonb := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  tz text := ow_shop_tz();
  made date;
  inv_at date;
  inv_ts timestamptz;
  client text;
  items jsonb;
  out_items jsonb := '[]'::jsonb;
  it jsonb;
  vi numeric;
  conv record;
  need numeric;
  have numeric;
  take numeric;
  lots jsonb;
  surplus numeric;
  shortfall boolean := false;
  surplus_total numeric := 0;
  sid text;
  sids text[] := '{}';
  bill_items jsonb;
  base jsonb;
  bill_id bigint;
  bills jsonb := '[]'::jsonb;
  floor_id bigint;
  total numeric;
  desired numeric;
  current numeric;
  delta numeric;
  c customers;
  cname text;
  v_before numeric;
  v_after numeric;
  applied numeric;
  inv_label text := 'INV-' || lpad(p_quote_id::text, 4, '0');
begin
  select * into q from saved_quotes where id = p_quote_id and shop_id = p_shop_id for update;
  if not found then raise exception 'That order is not in this shop.' using errcode = 'P0002'; end if;
  if q.voided then raise exception 'That order is voided.' using errcode = '22023'; end if;
  if q.invoiced then raise exception '% is invoiced already.', inv_label using errcode = '22023'; end if;
  if q.status is distinct from 'completed' then raise exception 'Only a delivered order is invoiced.' using errcode = '22023'; end if;
  pay := coalesce(q.payload, '{}'::jsonb);
  items := case when jsonb_typeof(pay -> 'items') = 'array' then pay -> 'items' else '[]'::jsonb end;
  if ow_pick_shortfall(pay) then
    raise exception 'A short pick on % is not settled yet: bill what went, or the full quantity, first.', inv_label using errcode = 'OWSHP';
  end if;
  if exists (select 1 from jsonb_array_elements(items) e where ow_line_waits_price(p_shop_id, e, presets)) then
    raise exception 'A price on % still waits for the Manager.', inv_label using errcode = 'OWPRC';
  end if;
  if exists (select 1 from purchase_invoices b where b.shop_id = p_shop_id and b.quote_id = p_quote_id
              and coalesce(b.payload ->> 'voided', 'false') <> 'true') then
    raise exception 'Supplier bills for % are raised already.', inv_label using errcode = 'OWBIL';
  end if;

  -- orderIsBackdated: a late entry is invoiced on its own date.
  made := (ow_ts(coalesce(nullif(pay ->> 'createdAt', ''), pay ->> 'savedAt')) at time zone tz)::date;
  if q.date is not null and made is not null and q.date < made then
    inv_at := q.date; inv_ts := (q.date + time '12:00') at time zone tz;
  else
    inv_at := ow_today(); inv_ts := now();
  end if;
  client := coalesce(nullif(btrim(coalesce(pay -> 'client' ->> 'name', '')), ''), nullif(btrim(coalesce(q.client_name, '')), ''));

  -- applyQuoteStockDeduction: every line that comes off the shelf.
  for it in select e from jsonb_array_elements(items) e loop
    if jsonb_typeof(it) = 'object' and (coalesce(it ->> 'supplierId', '') = '__stock__' or ow_line_received(it)) then
      vi := ow_num(it ->> 'variantIdx');
      conv := ow_on_shelf(p_shop_id, it ->> 'productId', vi, coalesce(ow_num(it ->> 'qty'), 0), it ->> 'unit', it, null);
      need := conv.qty;
      select coalesce(s.qty, 0) into have from stock s where s.shop_id = p_shop_id and s.key = ow_stock_key(it ->> 'productId', vi);
      have := coalesce(have, 0);
      take := least(have, need);
      if take < need then shortfall := true; end if;
      it := it || jsonb_build_object('_stockTaken', trim_scale(take));
      if take > 0 then
        lots := ow_stock_move(p_shop_id, it ->> 'productId', vi, coalesce(it ->> 'productName', it ->> 'productId'), -take,
                              'sale', 'Quote for ' || coalesce(client, 'Unnamed client'), null, null);
        it := it || jsonb_build_object('_stockLots', lots);
      end if;
    end if;
    out_items := out_items || jsonb_build_array(it);
  end loop;

  -- applyQuoteSurplusToStock: a pack that could not be broken.
  items := out_items; out_items := '[]'::jsonb;
  for it in select e from jsonb_array_elements(items) e loop
    if jsonb_typeof(it) = 'object' and not ow_line_received(it) then
      surplus := ow_units_bought(p_shop_id, it) - coalesce(ow_num(it ->> 'qty'), 0);
      if surplus > 0 then
        vi := ow_num(it ->> 'variantIdx');
        conv := ow_on_shelf(p_shop_id, it ->> 'productId', vi, surplus, it ->> 'unit', it, nullif(coalesce(ow_num(it ->> 'price'), 0), 0));
        it := it || jsonb_build_object('_surplusStocked', trim_scale(conv.qty));
        perform ow_stock_move(p_shop_id, it ->> 'productId', vi, coalesce(it ->> 'productName', it ->> 'productId'), conv.qty, 'restock',
          'Left over from ' || coalesce(client, 'a quote') || ' — '
            || coalesce((select s.name from suppliers s where s.shop_id = p_shop_id and s.id = it ->> 'supplierId'), it ->> 'supplierName', '')
            || ' sells by the ' || coalesce(nullif(it ->> 'packUnit', ''), 'pack'),
          conv.cost, it ->> 'supplierId');
        surplus_total := surplus_total + conv.qty;
      end if;
    end if;
    out_items := out_items || jsonb_build_array(it);
  end loop;

  -- generatePurchaseInvoicesForQuote: one bill per supplier, in the order
  -- the suppliers first appear on the order.
  for it in select e from jsonb_array_elements(out_items) e loop
    sid := it ->> 'supplierId';
    if coalesce(sid, '') not in ('', '__stock__') and not (sid = any(sids)) then sids := sids || sid; end if;
  end loop;
  foreach sid in array sids loop
    bill_items := '[]'::jsonb;
    for it in select e from jsonb_array_elements(out_items) e where e ->> 'supplierId' = sid loop
      select coalesce(jsonb_object_agg(k, it -> k), '{}'::jsonb) into base
        from unnest(array['productId', 'variantIdx', 'productName', 'unit', 'packUnit', 'packQty']) k where it ? k;
      if ow_line_received(it) and jsonb_typeof(it -> 'receipts') = 'array' and jsonb_array_length(it -> 'receipts') > 1 then
        bill_items := bill_items || coalesce((
          select jsonb_agg(base || jsonb_build_object('qty', ow_num(r ->> 'qty'), 'price', ow_num(r ->> 'price')) order by n)
            from jsonb_array_elements(it -> 'receipts') with ordinality as x(r, n)
           where coalesce(ow_num(r ->> 'qty'), 0) > 0), '[]'::jsonb);
      elsif ow_line_received(it) then
        bill_items := bill_items || jsonb_build_array(base || jsonb_build_object('qty', ow_num(it ->> 'receivedQty'), 'price', ow_num(it ->> 'receivedPrice')));
      else
        bill_items := bill_items || jsonb_build_array(base || jsonb_build_object('qty', ow_units_bought(p_shop_id, it), 'price', coalesce(it -> 'price', 'null'::jsonb)));
      end if;
    end loop;
    select coalesce(max(id), 0) into floor_id from purchase_invoices where shop_id = p_shop_id;
    bill_id := ow_next_row_id(p_shop_id, 'row:purchase_invoice', floor_id);
    insert into purchase_invoices (id, shop_id, quote_id, date, payload)
         values (bill_id, p_shop_id, p_quote_id, inv_at, jsonb_build_object(
           'customerName', coalesce(client, ''),
           'supplierId', sid,
           'supplierName', coalesce((select s.name from suppliers s where s.shop_id = p_shop_id and s.id = sid),
                                    (select e ->> 'supplierName' from jsonb_array_elements(out_items) e where e ->> 'supplierId' = sid limit 1), ''),
           'items', bill_items, 'amountPaid', 0, 'payments', '[]'::jsonb, 'voided', false));
    bills := bills || to_jsonb(bill_id);
  end loop;

  -- syncInvoiceDebtCharge: the customer's debt brought to the balance due.
  pay := pay || jsonb_build_object('items', out_items);
  total := trim_scale(round(ow_order_total(p_shop_id, pay, false), 6));
  desired := greatest(0, total - coalesce(q.amount_paid, 0));
  current := coalesce(ow_num(pay ->> 'debtCharged'), 0);
  delta := desired - current;
  if delta <> 0 then
    if coalesce(pay ->> 'customerId', '') <> '' then
      select * into c from customers where shop_id = p_shop_id and id = pay ->> 'customerId' for update;
    end if;
    if c.id is null and client is not null then
      select * into c from customers where shop_id = p_shop_id and lower(btrim(coalesce(name, ''))) = lower(client)
       order by id limit 1 for update;
      if c.id is null then
        cname := 'C' || lpad(ow_next_row_id(p_shop_id, 'customer',
                   (select coalesce(max(nullif(regexp_replace(id, '[^0-9]', '', 'g'), '')::bigint), 0) from customers where shop_id = p_shop_id))::text, 3, '0');
        insert into customers (shop_id, id, name, phone, location, notes, debt)
             values (p_shop_id, cname, client, coalesce(pay -> 'client' ->> 'phone', q.client_phone, ''), '', '', 0)
          returning * into c;
      end if;
    end if;
    if c.id is not null then
      v_before := coalesce(c.debt, 0);
      v_after := greatest(0, v_before + delta);
      applied := v_after - v_before;
      if applied <> 0 then
        update customers set debt = v_after where shop_id = p_shop_id and id = c.id;
        select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = p_shop_id;
        insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id)
             values (ow_next_row_id(p_shop_id, 'row:debt_log', floor_id), p_shop_id, c.id, ow_today(),
                     case when applied > 0 then 'charge' else 'payment' end, abs(applied),
                     'Auto-sync — ' || inv_label, p_quote_id);
      end if;
      pay := pay || jsonb_build_object('customerId', c.id);
    end if;
  end if;
  pay := pay || jsonb_build_object('debtCharged', desired,
    'invoicedBy', jsonb_build_object('via', p_via, 'by', p_by, 'byName', p_by_name, 'at', now()));

  update saved_quotes
     set invoiced = true, invoiced_at = inv_at, invoiced_ts = inv_ts, payload = pay
   where id = p_quote_id and shop_id = p_shop_id;

  return jsonb_build_object('ok', true, 'id', p_quote_id, 'invoice', inv_label, 'invoicedAt', inv_at,
    'total', total, 'debtCharged', desired, 'bills', bills, 'shortOnShelf', shortfall, 'surplusStocked', surplus_total);
end $$;
revoke all on function ow_invoice_core(uuid, bigint, text, uuid, text) from public, anon, authenticated;

-- The one invoicing function, for a login: the Manager (invoice.make), or
-- a salesperson's counter sale (counter.sell).
create or replace function invoice_order(p_shop_id uuid, p_quote_id bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes;
  v_task text;
  v_name text;
  v_role text;
  saved jsonb;
  res jsonb;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Sign in to this shop first.' using errcode = '42501';
  end if;
  select * into q from saved_quotes where id = p_quote_id and shop_id = p_shop_id;
  if not found then raise exception 'That order is not in this shop.' using errcode = 'P0002'; end if;
  if has_task(p_shop_id, 'invoice.make') then
    v_task := 'invoice.make';
  elsif has_task(p_shop_id, 'counter.sell')
        and (coalesce(q.payload ->> 'counter', '') = 'true' or coalesce(q.payload ->> 'counterSale', '') = 'true')
        and jsonb_typeof(q.payload -> 'items') = 'array' and jsonb_array_length(q.payload -> 'items') > 0
        and not exists (select 1 from jsonb_array_elements(q.payload -> 'items') e
                         where coalesce(e ->> 'supplierId', '') <> '__stock__') then
    v_task := 'counter.sell';
  else
    raise exception 'Invoicing is the Manager''s (invoice.make).' using errcode = '42501';
  end if;
  select s.name into v_name from staff s where s.shop_id = p_shop_id and s.user_id = uid limit 1;
  select m.role into v_role from shop_members m where m.shop_id = p_shop_id and m.user_id = uid limit 1;

  saved := ow_system_begin();
  res := ow_invoice_core(p_shop_id, p_quote_id, 'invoice_order', uid, nullif(btrim(coalesce(v_name, '')), ''));
  perform ow_system_end(saved);

  perform ow_log(p_shop_id, uid, nullif(btrim(coalesce(v_name, '')), ''), v_role, v_task,
    'Invoiced ' || (res ->> 'invoice') || coalesce(' for ' || nullif(q.client_name, ''), ''),
    (res ->> 'total')::numeric, jsonb_build_object('table', 'saved_quotes', 'id', p_quote_id),
    jsonb_build_object('invoiced', false), jsonb_build_object('invoiced', true, 'debtCharged', res -> 'debtCharged', 'bills', res -> 'bills'));
  return res;
end $$;
revoke all on function invoice_order(uuid, bigint) from public, anon;
grant execute on function invoice_order(uuid, bigint) to authenticated;

insert into role_tasks (role, task) values ('sales', 'counter.sell') on conflict do nothing;

-- ---------------------------------------------------------------------
-- 7. The 24-hour run. Every hour: each order delivered 24 hours ago or
-- more, not invoiced, is invoiced. One that cannot be is skipped and
-- stays on the Manager's Decide list; each order is its own attempt, so
-- one that fails changes nothing and does not stop the rest.
create or replace function ow_invoice_due_orders()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  res jsonb;
  done int := 0;
  skipped jsonb := '[]'::jsonb;
begin
  for r in
    select q.shop_id, q.id, q.client_name
      from saved_quotes q
     where q.status = 'completed' and not q.invoiced and not q.voided
       and coalesce(ow_ts(q.payload ->> 'deliveredAt'),
                    case when ow_num(q.payload ->> 'stageEnteredAt') > 0
                         then to_timestamp(ow_num(q.payload ->> 'stageEnteredAt') / 1000) end)
           <= now() - interval '24 hours'
     order by q.shop_id, q.id
  loop
    begin
      res := ow_invoice_core(r.shop_id, r.id, 'auto', null, 'The 24-hour run');
      perform ow_log(r.shop_id, null, 'The 24-hour run', 'auto', 'invoice.make',
        'Invoiced ' || (res ->> 'invoice') || coalesce(' for ' || nullif(r.client_name, ''), '') || ', 24 hours after delivery',
        (res ->> 'total')::numeric, jsonb_build_object('table', 'saved_quotes', 'id', r.id),
        jsonb_build_object('invoiced', false), jsonb_build_object('invoiced', true, 'debtCharged', res -> 'debtCharged', 'bills', res -> 'bills'));
      done := done + 1;
    exception when others then
      skipped := skipped || jsonb_build_array(jsonb_build_object('shop', r.shop_id, 'id', r.id, 'code', sqlstate, 'why', sqlerrm));
    end;
  end loop;
  return jsonb_build_object('invoiced', done, 'skipped', skipped);
end $$;
revoke all on function ow_invoice_due_orders() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not switched on here, so the 24-hour run is not scheduled. Switch it on (Database -> Extensions -> pg_cron) and run this file again. (%)', sqlerrm;
    return;
  end;
  begin
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'ow-invoice-due';
    perform cron.schedule('ow-invoice-due', '7 * * * *', 'select public.ow_invoice_due_orders()');
  exception when others then
    raise notice 'The 24-hour run could not be scheduled: %', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------
-- 8. A stale copy cannot take an invoice back.
create or replace function saved_quotes_ow_keep_invoice() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.invoiced and not coalesce(new.invoiced, false)
     and jsonb_typeof(old.payload -> 'invoicedBy') = 'object'
     and (new.payload -> 'invoicedBy') is distinct from (old.payload -> 'invoicedBy') then
    new.invoiced := old.invoiced;
    new.invoiced_at := old.invoiced_at;
    new.invoiced_ts := old.invoiced_ts;
    new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'invoicedBy', old.payload -> 'invoicedBy',
      'items', old.payload -> 'items',
      'debtCharged', old.payload -> 'debtCharged',
      'customerId', old.payload -> 'customerId'));
  end if;
  return new;
end $$;

drop trigger if exists saved_quotes_ow_keep_invoice on saved_quotes;
create trigger saved_quotes_ow_keep_invoice before update on saved_quotes
  for each row execute function saved_quotes_ow_keep_invoice();
