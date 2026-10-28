-- 0174 The rebuild's fourth backend fix (docs/rebuild.md, "Backend fixes
-- decided"; docs/spec/01-order-journey.md §5 Q1 and docs/spec/02-money.md
-- §8 Q8, Kevin 28 Oct 2026): the Checking gate checks what only the Buyer
-- app checked, and old debt as the apps already do.
--
-- An order leaves Checking (0119's gate, saved_quotes_ow_checking_gate) only
-- when ow_gate_reason finds nothing that holds it. It knew two reasons, a
-- price for the Manager and a credit hold. The Buyer app held an order for
-- three more before moving it (buyer.html orderLeaveDraft), and the
-- Manager's "next" and every other path skipped them. Now the gate holds a
-- move out of Checking, from any app, while:
--
--   'credit'    (widened, money Q8) the customer's oldest open debt is past
--               the hold days (presets.creditHold.days, 21 when unset;
--               sales.html creditHoldFor, manager.html creditCase), and this
--               order adds to what they owe, and the Manager has not said
--               Release (or said Cash first and it is not paid). Aged as the
--               apps age it (custOpenCharges): the debt log oldest first, a
--               payment clears its own bill first, then the oldest; a
--               charge with no date is never aged. The credit.hold push to
--               the Manager names the age.
--   'suppliers' a supplier on the order has not said yes on the terms it
--               was given (buyer.html orderDraftReady: supplierConfirms[id]
--               is 'confirmed' and its terms are the lines as they stand,
--               orderSupplierTerms).
--   'unsourced' a line has no supplier and the client is not told to wait
--               for it (buyer.html noneOpen).
--   'prepay'    an agent who pays first has not paid for it
--               (buyer.html agentPaymentBlocksPreparing).
--
-- Price and credit stay first, so the pushes that read ow_gate_reason
-- (0120's price.waits, credit.hold, price.decided; 0131's credit.decided)
-- and the counter sale (0155, which asks only about a price) see what they
-- saw before. A move held for the new reasons is kept as gateHeldMove like
-- any other, and goes on by itself with the write that clears the last
-- reason (0119 step 4d) unless the order's terms moved meanwhile.
--
-- The gate still binds every login and skips writes with no login (0119).
--
-- Applied by hand, after 0173. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   -- orders in Checking and what holds each now:
--   select id, client_name, ow_gate_reason(shop_id, payload, amount_paid) from saved_quotes
--    where status = 'draft' and not voided order by id desc limit 20;
--   select ow_oldest_debt_days(shop_id, id), name, debt from customers where debt > 0 order by 1 desc nulls last limit 10;
--
-- ROLLBACK: run 0167's ow_gate_reason again; then
--   drop function if exists ow_oldest_debt_days(uuid, text);
--   drop function if exists ow_hold_days(jsonb);
--   drop function if exists ow_supplier_terms(jsonb, text);
--   and put 0167's credit.hold wording back in saved_quotes_ow_push (re-run 0120's, then 0167's step 2).
-- ---------------------------------------------------------------------

-- The hold line in days (sales.html, manager.html holdDays).
create or replace function ow_hold_days(p_presets jsonb) returns integer
language sql immutable as $$
  select case when coalesce(ow_num(p_presets -> 'creditHold' ->> 'days'), 0) > 0
              then ow_num(p_presets -> 'creditHold' ->> 'days')::integer else 21 end
$$;

-- How many days the customer's oldest open, dated charge has been owed; 0
-- when none (sales.html custOpenCharges and custAging, rule B in
-- docs/decision-rights.md). Days by the Kampala date (ow_today).
create or replace function ow_oldest_debt_days(p_shop_id uuid, p_customer text) returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  e record;
  dates date[] := '{}';
  rems numeric[] := '{}';
  qids bigint[] := '{}';
  credit numeric := 0;
  amt numeric;
  rem numeric;
  take numeric;
  i int;
  oldest int := 0;
begin
  for e in select l.date, l.type, coalesce(l.amount, 0) as amount, l.quote_id from customer_debt_log l
            where l.shop_id = p_shop_id and l.customer_id = p_customer and l.type in ('charge', 'payment')
            order by coalesce(l.date::text, ''), l.id loop
    amt := e.amount;
    if e.type = 'charge' then
      take := least(credit, amt); credit := credit - take;
      dates := dates || e.date; rems := rems || (amt - take); qids := qids || e.quote_id;
    else
      rem := amt;
      -- A payment clears its own bill first, then the oldest.
      if e.quote_id is not null then
        for i in 1 .. coalesce(array_length(rems, 1), 0) loop
          exit when rem <= 0;
          continue when qids[i] is distinct from e.quote_id;
          take := least(rems[i], rem); rems[i] := rems[i] - take; rem := rem - take;
        end loop;
      end if;
      for i in 1 .. coalesce(array_length(rems, 1), 0) loop
        exit when rem <= 0;
        take := least(rems[i], rem); rems[i] := rems[i] - take; rem := rem - take;
      end loop;
      if rem > 0 then credit := credit + rem; end if;
    end if;
  end loop;
  for i in 1 .. coalesce(array_length(rems, 1), 0) loop
    continue when rems[i] <= 0.5 or dates[i] is null;
    oldest := greatest(oldest, ow_today() - dates[i]);
  end loop;
  return oldest;
end $$;
revoke all on function ow_oldest_debt_days(uuid, text) from public, anon;
grant execute on function ow_oldest_debt_days(uuid, text) to authenticated;

-- The terms a supplier said yes to: its lines as they stand (buyer.html
-- orderSupplierTerms: productId:variantIdx:qty:price, one per line, in order).
create or replace function ow_supplier_terms(p_items jsonb, p_supplier text) returns text
language sql immutable as $$
  select coalesce(string_agg(
           coalesce(e ->> 'productId', '') || ':' || coalesce(e ->> 'variantIdx', '') || ':'
           || trim_scale(coalesce(ow_num(e ->> 'qty'), 0))::text || ':' || round(coalesce(ow_num(e ->> 'price'), 0))::text,
           '|' order by n), '')
    from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) with ordinality as x(e, n)
   where jsonb_typeof(e) = 'object' and e ->> 'supplierId' = p_supplier
$$;

-- What holds an order in Checking, or null when nothing does (0119, 0136,
-- 0167; 0174 adds the old debt and the three reasons after credit).
create or replace function ow_gate_reason(p_shop_id uuid, p_payload jsonb, p_amount_paid numeric)
returns text
language plpgsql stable as $$
declare
  presets jsonb := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  items jsonb := case when jsonb_typeof(p_payload -> 'items') = 'array' then p_payload -> 'items' else '[]'::jsonb end;
  it jsonb;
  c customers;
  amt numeric;
  dec jsonb := p_payload -> 'creditCheck';
  undecided boolean;
  sid text;
  yes jsonb;
begin
  for it in select e from jsonb_array_elements(items) e loop
    if ow_line_waits_price(p_shop_id, it, presets) then return 'price'; end if;
  end loop;
  if coalesce(p_payload ->> 'customerId', '') <> '' then
    select * into c from customers where shop_id = p_shop_id and id = p_payload ->> 'customerId';
    if found then
      amt := greatest(0, round(ow_order_total(p_shop_id, p_payload, true)) - coalesce(p_amount_paid, 0));
      undecided := jsonb_typeof(dec) is distinct from 'object'
                   or dec ->> 'decision' = 'hold'
                   -- The Manager said "cash first": held until the order is paid.
                   or (dec ->> 'decision' = 'cash' and amt > 0);
      if coalesce(c.credit_limit, 0) > 0 then
        if coalesce(c.debt, 0) + amt > c.credit_limit and undecided then return 'credit'; end if;
      -- 0167: on credit with no limit set — the Manager's yes, whatever the amount.
      elsif jsonb_typeof(p_payload -> 'credit') = 'object' and coalesce(ow_num(p_payload -> 'credit' ->> 'pct'), 0) > 0 and undecided then
        return 'credit';
      end if;
      -- 0174 (money Q8): they have owed past the hold line, and this order adds to it.
      if coalesce(c.debt, 0) > 0 and amt > 0 and undecided
         and ow_oldest_debt_days(p_shop_id, c.id) > ow_hold_days(presets) then
        return 'credit';
      end if;
    end if;
  end if;
  -- 0174 (journey Q1): every supplier on the order said yes, on the lines as they stand.
  for sid in select distinct e ->> 'supplierId' from jsonb_array_elements(items) e
              where jsonb_typeof(e) = 'object' and coalesce(e ->> 'supplierId', '') not in ('', '__stock__') loop
    yes := p_payload -> 'supplierConfirms' -> sid;
    if jsonb_typeof(yes) is distinct from 'object' or yes ->> 'state' is distinct from 'confirmed'
       or yes ->> 'terms' is distinct from ow_supplier_terms(items, sid) then
      return 'suppliers';
    end if;
  end loop;
  -- A line nobody is buying, unless the client was told to wait for it.
  if exists (select 1 from jsonb_array_elements(items) e
              where jsonb_typeof(e) = 'object' and coalesce(e ->> 'supplierId', '') = ''
                and coalesce(e ->> 'clientWaits', '') in ('', 'false', '0')) then
    return 'unsourced';
  end if;
  -- An agent who pays first has paid.
  if coalesce(p_payload ->> 'originAgentId', '') <> '' and coalesce(p_payload ->> 'agentPaymentStatus', '') <> 'paid'
     and exists (select 1 from agents a where a.shop_id = p_shop_id and a.id = p_payload ->> 'originAgentId' and a.payment_term = 'prepay') then
    return 'prepay';
  end if;
  return null;
end $$;

-- The credit.hold push names an old debt's age (0167's wording, widened).
do $mig$
declare
  src text := pg_get_functiondef('public.saved_quotes_ow_push()'::regprocedure);
  was text := 'else '' · no limit set'' end';
begin
  if position('ow_oldest_debt_days' in src) > 0 then return; end if;
  if position(was in src) = 0 then raise exception '0174: saved_quotes_ow_push is not the shape 0167 left; not changed.'; end if;
  src := replace(src, was, was || chr(10) || '          || case when coalesce(c.debt, 0) > 0 and ow_oldest_debt_days(new.shop_id, c.id) > ow_hold_days(presets)'
    || ' then '' · owed '' || ow_oldest_debt_days(new.shop_id, c.id) || '' days'' else '''' end');
  execute src;
end $mig$;
