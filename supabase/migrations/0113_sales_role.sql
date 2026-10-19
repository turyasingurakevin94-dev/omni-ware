-- A Sales login: the first role that is neither the owner nor a picker.
--
-- Until now a login was one of three things: the owner (or an admin,
-- which today is the same person), staff on the worker app, or an agent
-- in their own table. The books were walled for everyone but the owner
-- by 0083. A shop that hires somebody to sell had two choices -- hand
-- them the owner's password, or keep them off the system.
--
-- This adds the role the access plan calls Sales: quotes, orders,
-- customers, chats, and taking a customer's payment. Everything else
-- stays the owner's, at the database, exactly as 0083 left it.
--
-- WHAT A SALES LOGIN MAY WRITE, and nothing more:
--
--   saved_quotes        already open to members (0083 note) -- quotes
--                       and moving an order along the board. NOT
--                       invoicing and NOT voiding: those move stock,
--                       debt and supplier bills together, and the
--                       stock half is walled, so a Sales login doing
--                       either would leave half a sale in the books.
--                       A trigger below refuses both for Sales.
--   customers           add a customer, edit one, and lower a debt when
--                       a payment comes in. NOT raise a debt, and NOT
--                       set credit limits or terms -- the plan keeps
--                       those with the owner (trigger below).
--   customer_debt_log   a 'payment' line only.
--   cash_txns           a receipt only, and only one of the three
--                       customer-payment categories the app writes
--                       (Debt Payment, Invoice Payment, Customer
--                       Payment). Not a cash-out, not a transfer, not
--                       a sale rung at the till, not a loan.
--   statements_sent     the record that a customer's statement went.
--
-- Updates on cash_txns and customer_debt_log stay the owner's: a Sales
-- login adds a payment, it never edits one after the fact. Deletes stay
-- owner-only everywhere (0058).
--
-- HOW: one question, has_task(shop, task), asked by every policy and
-- every trigger here. Owner and admin always answer yes. Any other
-- role answers from role_tasks, which only the SQL editor writes. The
-- later roles in the plan (manager, buyer, store, accounts) are allowed
-- by the role check now so that adding one is rows in role_tasks, not
-- another constraint change -- but none has a task yet, so a login
-- given one of those roles today can write nothing that staff cannot.
--
-- Migrations are applied by hand. Every policy is dropped before it is
-- created, and a table this database never got is skipped and named,
-- the same way 0083 learned to.
--
-- LOOK FIRST -- who is attached to the shop, and with what rights:
--   select role, count(*) from shop_members
--   where shop_id = 'YOUR-SHOP-ID' group by role;
--
-- MAKE SOMEBODY SALES (until the People & access screen exists, the
-- owner's invite does this from Staff when the person's role is Sells):
--   update shop_members set role = 'sales'
--   where shop_id = 'YOUR-SHOP-ID' and user_id = 'THEIR-USER-ID';
--
-- CHECK AFTERWARDS -- what a Sales login may do, as the database says:
--   select task from role_tasks where role = 'sales' order by task;
--
-- ROLLBACK -- restores 0083's owner-only writes on the four tables and
-- removes the Sales guards. Run the two trigger drops, then re-run the
-- 0083 loop for customers, customer_debt_log, cash_txns and 0101's
-- policies for statements_sent:
--   drop trigger if exists saved_quotes_sales_guard on saved_quotes;
--   drop trigger if exists customers_sales_guard on customers;
--   update shop_members set role = 'staff' where role = 'sales';

-- ---------------------------------------------------------------------
-- 1. The roles a membership may carry.
alter table shop_members drop constraint if exists shop_members_role_check;
alter table shop_members add constraint shop_members_role_check
  check (role in ('owner', 'admin', 'staff', 'sales', 'manager', 'buyer', 'store', 'accounts'));

-- ---------------------------------------------------------------------
-- 2. Which role may do which task. Read by anyone signed in (the app
--    reads it to draw only the buttons a login may press); written only
--    from the SQL editor -- no policy grants a write.
create table if not exists role_tasks (
  role text not null,
  task text not null,
  primary key (role, task)
);
alter table role_tasks enable row level security;
drop policy if exists "anyone signed in reads the task list" on role_tasks;
create policy "anyone signed in reads the task list" on role_tasks
  for select using (auth.uid() is not null);

insert into role_tasks (role, task) values
  ('sales', 'quote.make'),
  ('sales', 'order.move'),
  ('sales', 'customer.edit'),
  ('sales', 'payment.receive'),
  ('sales', 'statement.send'),
  ('sales', 'msg.reply')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. The one question. SECURITY DEFINER for the same reason as
--    is_shop_member (0001): it reads shop_members without re-entering
--    that table's own policies.
create or replace function has_task(p_shop_id uuid, p_task text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from shop_members m
    where m.shop_id = p_shop_id and m.user_id = auth.uid()
      and (m.role in ('owner', 'admin')
           or exists (select 1 from role_tasks r where r.role = m.role and r.task = p_task))
  );
$$;

-- Whether the caller is a Sales login in this shop. The triggers below
-- narrow what Sales may change inside a row it is allowed to write; they
-- ask this rather than "not an admin" so the worker app, agents and the
-- Edge Functions (service role, no auth.uid()) are untouched.
create or replace function is_shop_sales(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from shop_members
    where shop_id = p_shop_id and user_id = auth.uid() and role = 'sales'
  );
$$;

-- ---------------------------------------------------------------------
-- 4. The write walls, re-drawn on the four tables Sales writes. 0083's
--    "owner writes only" / "owner updates only" are replaced by policies
--    that still let the owner do everything and let a Sales login do
--    exactly its task. Still RESTRICTIVE: they narrow the members' grant,
--    they never widen it.
do $$
begin
  -- customers: insert and update. What may change inside the row is the
  -- trigger's business (section 5).
  if to_regclass('public.customers') is null then
    raise notice 'skipped customers: not on this database';
  else
    drop policy if exists "owner writes only" on customers;
    drop policy if exists "owner updates only" on customers;
    drop policy if exists "owner or sales writes" on customers;
    drop policy if exists "owner or sales updates" on customers;
    create policy "owner or sales writes" on customers
      as restrictive for insert with check (has_task(shop_id, 'customer.edit'));
    create policy "owner or sales updates" on customers
      as restrictive for update using (has_task(shop_id, 'customer.edit')) with check (has_task(shop_id, 'customer.edit'));
  end if;

  -- customer_debt_log: Sales adds a payment line; only the owner adds
  -- anything else or amends a line.
  if to_regclass('public.customer_debt_log') is null then
    raise notice 'skipped customer_debt_log: not on this database';
  else
    drop policy if exists "owner writes only" on customer_debt_log;
    drop policy if exists "owner or sales writes" on customer_debt_log;
    create policy "owner or sales writes" on customer_debt_log
      as restrictive for insert with check (
        is_shop_admin(shop_id)
        or (has_task(shop_id, 'payment.receive') and type = 'payment' and amount >= 0));
    -- "owner updates only" from 0083 stays as it is.
  end if;

  -- cash_txns: Sales adds a customer's payment as a receipt, nothing else.
  if to_regclass('public.cash_txns') is null then
    raise notice 'skipped cash_txns: not on this database';
  else
    drop policy if exists "owner writes only" on cash_txns;
    drop policy if exists "owner or sales writes" on cash_txns;
    create policy "owner or sales writes" on cash_txns
      as restrictive for insert with check (
        is_shop_admin(shop_id)
        or (has_task(shop_id, 'payment.receive') and type = 'receipt' and amount > 0
            and category in ('Debt Payment', 'Invoice Payment', 'Customer Payment')));
    -- "owner updates only" from 0083 stays as it is.
  end if;

  -- statements_sent: the record that a statement went to a customer.
  if to_regclass('public.statements_sent') is null then
    raise notice 'skipped statements_sent: not on this database';
  else
    drop policy if exists "owner writes only" on statements_sent;
    drop policy if exists "owner or sales writes" on statements_sent;
    create policy "owner or sales writes" on statements_sent
      as restrictive for insert with check (has_task(shop_id, 'statement.send'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5. Inside the rows Sales may write.

-- A customer: Sales may add one and edit their details, and a payment
-- may LOWER what they owe. Sales may not raise a debt (only an invoice
-- does that, and Sales does not invoice), and may not set or change a
-- credit limit or payment terms -- those are the owner's promise to a
-- customer, and the plan keeps them with the owner.
create or replace function customers_sales_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_sales(new.shop_id) then return new; end if;
  -- The app saves by upsert, and Postgres runs the INSERT trigger on the
  -- proposed row even when it is about to become an update of a row that
  -- exists. That row is judged by the UPDATE branch, which fires next.
  if tg_op = 'INSERT' and exists (select 1 from customers c where c.shop_id = new.shop_id and c.id = new.id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.debt, 0) <> 0 then
      raise exception 'A Sales login adds a customer owing nothing; the debt comes from their invoices.' using errcode = '42501';
    end if;
    if new.credit_limit is not null or new.terms_days is not null then
      raise exception 'Credit limits and payment terms are set by the owner.' using errcode = '42501';
    end if;
    return new;
  end if;
  if coalesce(new.debt, 0) > coalesce(old.debt, 0) then
    raise exception 'A Sales login can lower what a customer owes (a payment), not raise it.' using errcode = '42501';
  end if;
  if new.credit_limit is distinct from old.credit_limit or new.terms_days is distinct from old.terms_days then
    raise exception 'Credit limits and payment terms are set by the owner.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists customers_sales_guard on customers;
create trigger customers_sales_guard before insert or update on customers
  for each row execute function customers_sales_guard();

-- An order: Sales quotes it, moves it along the board and records what
-- was paid against it -- but does not invoice it, take an invoice back,
-- or void it. Each of those moves stock and supplier bills that a Sales
-- login cannot write, so letting the order half through alone would
-- leave the books disagreeing with the shelf.
create or replace function saved_quotes_sales_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_sales(new.shop_id) then return new; end if;
  -- Upsert again: an existing order is judged as the update it becomes.
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
