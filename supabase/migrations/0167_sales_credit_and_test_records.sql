-- 0167 Sales, sixth (audit round 2, core workflows, 24 Oct 2026; docs/audit/sales/ROUND-2.md):
-- credit for a customer with no limit set is the Manager's yes, and test
-- records stay in the books but out of every figure.
--
-- Cowork's round 2 found, on live: an order put on credit (+3%) for a
-- customer with no credit limit went straight on, with no ask and no reason
-- (SAL-016); and QA's test orders and receipts counted in October's money in
-- and the goal (SAL-018).
--
--   1. ow_gate_reason     an order on credit for a customer with NO limit set
--                         waits in Checking as 'credit' until the Manager
--                         releases it ("cash first" holds it until paid), as
--                         an order over a set limit already does. Credit
--                         within a set limit is unchanged. The order's own
--                         Checking gate (0119) holds it, the credit.hold push
--                         (0120) tells the Manager, the Manager's queue lists
--                         it — all from this one function.
--   2. saved_quotes_ow_push  the credit.hold push says "· no limit set" when
--                         there is no limit (it said "of a 0 limit").
--   3. qa                 customers.qa, saved_quotes.qa, cash_txns.qa (false
--                         by default). Marked by trigger, never cleared by it:
--                         a customer named "TEST …"; an order for a test
--                         customer, or a walk-in named "TEST …"; a receipt for
--                         a test order, or whose description carries a TESTQA
--                         ref or names a "TEST …" customer. The apps leave qa
--                         rows out of every figure (Kevin, 24 Oct: the TESTQA
--                         payments were never cash, so the cash book too).
--                         Nothing is deleted. Existing rows are marked by
--                         docs/audit/sales/round-2-correct.sql, not here.
--
-- Applied by hand, after 0166. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select column_name, table_name from information_schema.columns where column_name = 'qa' and table_name in ('customers', 'saved_quotes', 'cash_txns');
--   select tgname from pg_trigger where tgname like '%_ow_qa';
--   select position('no limit set' in pg_get_functiondef('saved_quotes_ow_push()'::regprocedure)) > 0;
--
-- ROLLBACK:
--   drop trigger if exists customers_ow_qa on customers; drop trigger if exists saved_quotes_ow_qa on saved_quotes; drop trigger if exists cash_txns_ow_qa on cash_txns;
--   drop function if exists ow_qa_customer(); drop function if exists ow_qa_order(); drop function if exists ow_qa_receipt();
--   (the qa columns can stay: nothing reads them but the apps)
--   then run 0136's ow_gate_reason and 0120's saved_quotes_ow_push again.

-- ---------------------------------------------------------------------
-- 1. Credit with no limit set waits for the Manager.
create or replace function ow_gate_reason(p_shop_id uuid, p_payload jsonb, p_amount_paid numeric)
returns text
language plpgsql stable as $$
declare
  presets jsonb := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  it jsonb;
  c customers;
  amt numeric;
  dec jsonb := p_payload -> 'creditCheck';
  undecided boolean;
begin
  for it in select e from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'items') = 'array' then p_payload -> 'items' else '[]'::jsonb end) e loop
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
    end if;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 2. The credit.hold push names "no limit set".
do $mig$
declare
  src text := pg_get_functiondef('public.saved_quotes_ow_push()'::regprocedure);
  was text := '|| '' of a '' || ow_money(c.credit_limit) || '' limit''';
begin
  if position('no limit set' in src) > 0 then return; end if;
  if position(was in src) = 0 then raise exception '0167: saved_quotes_ow_push is not the shape 0120 left; not changed.'; end if;
  src := replace(src, was, '|| case when coalesce(c.credit_limit, 0) > 0 then '' of a '' || ow_money(c.credit_limit) || '' limit'' else '' · no limit set'' end');
  execute src;
end $mig$;

-- ---------------------------------------------------------------------
-- 3. Test records: marked, kept, out of every figure.
alter table customers add column if not exists qa boolean not null default false;
alter table saved_quotes add column if not exists qa boolean not null default false;
alter table cash_txns add column if not exists qa boolean not null default false;

-- A name is a test name when it starts with the word TEST, in capitals.
create or replace function ow_qa_name(p text) returns boolean
language sql immutable as $$ select coalesce(p, '') ~ '^TEST\M' $$;

create or replace function ow_qa_customer() returns trigger
language plpgsql as $$
begin
  if not new.qa and ow_qa_name(new.name) then new.qa := true; end if;
  return new;
end $$;
drop trigger if exists customers_ow_qa on customers;
create trigger customers_ow_qa before insert or update of name, qa on customers
  for each row execute function ow_qa_customer();

create or replace function ow_qa_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.qa then return new; end if;
  if ow_qa_name(coalesce(new.client_name, new.payload -> 'client' ->> 'name'))
     or exists (select 1 from customers c where c.shop_id = new.shop_id and c.id = new.payload ->> 'customerId' and c.qa) then
    new.qa := true;
  end if;
  return new;
end $$;
drop trigger if exists saved_quotes_ow_qa on saved_quotes;
create trigger saved_quotes_ow_qa before insert or update on saved_quotes
  for each row execute function ow_qa_order();

create or replace function ow_qa_receipt() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.qa then return new; end if;
  if coalesce(new.description, '') ~ 'TESTQA'
     or coalesce(new.description, '') ~ '— TEST\M'
     or (new.quote_id is not null and exists (select 1 from saved_quotes q where q.shop_id = new.shop_id and q.id = new.quote_id and q.qa)) then
    new.qa := true;
  end if;
  return new;
end $$;
drop trigger if exists cash_txns_ow_qa on cash_txns;
create trigger cash_txns_ow_qa before insert or update on cash_txns
  for each row execute function ow_qa_receipt();
