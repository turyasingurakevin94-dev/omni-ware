-- A Manager login: the person who runs the team day to day -- the
-- salespeople, the buyer, the packers and the drivers (manager.html).
--
-- 0113 allowed the role and gave it no tasks. This gives it its tasks.
--
-- Already open to any shop member, and so already open to a manager:
--
--   saved_quotes      handing a packing job to another packer, a delivery
--                     to another driver, and the yes / hold / cash-first
--                     decision on an order held for credit
--                     (payload.creditCheck). Invoicing and voiding stay
--                     the owner's: the guard below now covers a manager
--                     the way it covers Sales.
--   collection_trips  giving a buying trip to another buyer.
--
-- Opened by the tasks below, through the has_task() policies 0113 wrote:
--
--   cash_txns           a customer's payment, as a receipt
--   customer_debt_log   the payment line that lowers what they owe
--   customers           lowering a customer's debt by that payment
--   statements_sent     the record that a statement went out
--
-- What stays the owner's, at the database:
--   credit limits and payment terms (the customers guard), raising a
--   debt, invoicing and voiding (the saved_quotes guard), recording a
--   customer's promise to pay (0089), costs, prices, stock, cash other
--   than a customer's payment, staff and pay, suppliers, backups.
--
-- The rest of the Manager app needs no new rows:
--   per-person sales goals are the owner's manager_notes 'target' rows,
--     with body.who set to the salesperson's login (user id). A target
--     with no body.who is the shop's.
--   the credit hold line is presets.creditHold = { days: 21 } in
--     app_settings, which only the owner writes.
--
-- Migrations are applied by hand. Safe to run twice.
--
-- MAKE SOMEBODY A MANAGER:
--   update shop_members set role = 'manager'
--   where shop_id = 'YOUR-SHOP-ID' and user_id = 'THEIR-USER-ID';
-- and give them a staff row with user_id set, so the team can see them.
--
-- ROLLBACK:
--   delete from role_tasks where role = 'manager';
--   then re-run 0113 sections 5 to put the two guards back on Sales only.

insert into role_tasks (role, task) values
  ('manager', 'order.move'),
  ('manager', 'order.assign'),
  ('manager', 'credit.release'),
  ('manager', 'team.nudge'),
  ('manager', 'customer.edit'),
  ('manager', 'payment.receive'),
  ('manager', 'statement.send')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- The desk roles: a login that sells or manages, and is not the owner.
-- The two guards from 0113 apply to both.
create or replace function is_shop_desk(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from shop_members
    where shop_id = p_shop_id and user_id = auth.uid() and role in ('sales', 'manager')
  );
$$;

-- A customer: a payment may LOWER what they owe. Nobody but the owner
-- raises a debt or sets a credit limit or payment terms.
create or replace function customers_sales_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_desk(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' and exists (select 1 from customers c where c.shop_id = new.shop_id and c.id = new.id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.debt, 0) <> 0 then
      raise exception 'A new customer owes nothing; the debt comes from their invoices.' using errcode = '42501';
    end if;
    if new.credit_limit is not null or new.terms_days is not null then
      raise exception 'Credit limits and payment terms are set by the owner.' using errcode = '42501';
    end if;
    return new;
  end if;
  if coalesce(new.debt, 0) > coalesce(old.debt, 0) then
    raise exception 'This login can lower what a customer owes (a payment), not raise it.' using errcode = '42501';
  end if;
  if new.credit_limit is distinct from old.credit_limit or new.terms_days is distinct from old.terms_days then
    raise exception 'Credit limits and payment terms are set by the owner.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists customers_sales_guard on customers;
create trigger customers_sales_guard before insert or update on customers
  for each row execute function customers_sales_guard();

-- An order: never invoiced, taken back or voided from a desk login.
create or replace function saved_quotes_sales_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_desk(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' and exists (select 1 from saved_quotes q where q.id = new.id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.invoiced or new.voided then
      raise exception 'Invoicing and voiding are done by the owner.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.invoiced is distinct from old.invoiced or new.voided is distinct from old.voided then
    raise exception 'Invoicing and voiding are done by the owner.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists saved_quotes_sales_guard on saved_quotes;
create trigger saved_quotes_sales_guard before insert or update on saved_quotes
  for each row execute function saved_quotes_sales_guard();
