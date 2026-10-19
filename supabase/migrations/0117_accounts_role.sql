-- An Accounts login: the person who closes the money every day.
--
-- 0113 let the role exist and gave it nothing. This gives it the work the
-- Accounts app (accounts.html) is built around -- and nothing that would
-- let it rewrite what somebody else already put in the books.
--
-- WHAT AN ACCOUNTS LOGIN MAY WRITE, and nothing more:
--
--   payment.receive   a customer's payment, exactly as Sales takes one:
--                     a receipt in the cash book, a 'payment' line in the
--                     debt log, the invoice's own payments, and the
--                     customer's debt coming DOWN. (0113's policies on
--                     cash_txns and customer_debt_log already answer from
--                     this task; customers is widened below.)
--   statement.send    the record that a statement went (0101 / 0113).
--   invoice.send      the record that an invoice went, kept on the order
--                     (saved_quotes payload.invoiceSends) -- saved_quotes
--                     is already open to members (0083), the guard below
--                     keeps Accounts off invoicing and voiding.
--   day.count         what was counted in each account at close
--                     (cash_days.actual), never the opening the owner set.
--   day.close         marking a counted, agreeing day closed. Reopening a
--                     closed day stays the owner's.
--   variance.book     a difference nobody can trace, booked as Cash
--                     Shortage (a payment) or Cash Overage (a receipt).
--   bill.pay          paying a supplier's bills: a cash-book payment and
--                     that bill's own payments and amountPaid going UP.
--
-- STILL THE OWNER'S: editing or deleting a payment or any cash-book line
-- (0083's "owner updates only" on cash_txns and customer_debt_log stays),
-- invoicing, voiding, credit notes, credit limits and terms, a day's
-- opening and reopening a closed day, supplier records and prices,
-- stock, and every delete (0058).
--
-- Applied by hand like every migration here. Every policy and trigger is
-- dropped before it is created; a table this database never got is
-- skipped and named.
--
-- MAKE SOMEBODY ACCOUNTS:
--   update shop_members set role = 'accounts'
--   where shop_id = 'YOUR-SHOP-ID' and user_id = 'THEIR-USER-ID';
--
-- CHECK AFTERWARDS:
--   select task from role_tasks where role = 'accounts' order by task;
--
-- ROLLBACK:
--   delete from role_tasks where role = 'accounts';
--   (the policies below still let the owner do everything, and with no
--   tasks an Accounts login can write nothing staff cannot)

-- ---------------------------------------------------------------------
-- 1. The tasks.
insert into role_tasks (role, task) values
  ('accounts', 'payment.receive'),
  ('accounts', 'statement.send'),
  ('accounts', 'invoice.send'),
  ('accounts', 'day.count'),
  ('accounts', 'day.close'),
  ('accounts', 'variance.book'),
  ('accounts', 'bill.pay')
on conflict do nothing;

-- Whether the caller is an Accounts login in this shop. The guards ask
-- this, as 0113's ask is_shop_sales, so the owner, staff, agents and the
-- Edge Functions (service role) are untouched.
create or replace function is_shop_accounts(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from shop_members
    where shop_id = p_shop_id and user_id = auth.uid() and role = 'accounts'
  );
$$;

-- ---------------------------------------------------------------------
-- 2. The walls, re-drawn where Accounts writes. Still RESTRICTIVE.
do $$
begin
  -- customers: a payment lowers the debt. The update wall lets a login
  -- with payment.receive through; the guard (section 3) keeps an Accounts
  -- login to that one column, and down only. Inserting a customer stays
  -- with customer.edit (Sales and the owner).
  if to_regclass('public.customers') is null then
    raise notice 'skipped customers: not on this database';
  else
    drop policy if exists "owner or sales updates" on customers;
    drop policy if exists "owner, sales or accounts updates" on customers;
    create policy "owner, sales or accounts updates" on customers
      as restrictive for update
      using (has_task(shop_id, 'customer.edit') or has_task(shop_id, 'payment.receive'))
      with check (has_task(shop_id, 'customer.edit') or has_task(shop_id, 'payment.receive'));
  end if;

  -- cash_txns: what each role may add. Sales and Accounts add a customer's
  -- payment; Accounts also books a count difference and pays a supplier.
  if to_regclass('public.cash_txns') is null then
    raise notice 'skipped cash_txns: not on this database';
  else
    drop policy if exists "owner or sales writes" on cash_txns;
    drop policy if exists "owner, sales or accounts writes" on cash_txns;
    create policy "owner, sales or accounts writes" on cash_txns
      as restrictive for insert with check (
        is_shop_admin(shop_id)
        or (has_task(shop_id, 'payment.receive') and type = 'receipt' and amount > 0
            and category in ('Debt Payment', 'Invoice Payment', 'Customer Payment'))
        or (has_task(shop_id, 'variance.book') and amount > 0
            and ((type = 'payment' and category = 'Cash Shortage')
              or (type = 'receipt' and category = 'Cash Overage')))
        or (has_task(shop_id, 'bill.pay') and type = 'payment' and amount > 0
            and category in ('Stock Purchase', 'Supplier Payment')));
  end if;

  -- cash_days: the count and the close.
  if to_regclass('public.cash_days') is null then
    raise notice 'skipped cash_days: not on this database';
  else
    drop policy if exists "owner writes only" on cash_days;
    drop policy if exists "owner updates only" on cash_days;
    drop policy if exists "owner or accounts writes" on cash_days;
    drop policy if exists "owner or accounts updates" on cash_days;
    create policy "owner or accounts writes" on cash_days
      as restrictive for insert with check (is_shop_admin(shop_id) or has_task(shop_id, 'day.count'));
    create policy "owner or accounts updates" on cash_days
      as restrictive for update
      using (is_shop_admin(shop_id) or has_task(shop_id, 'day.count'))
      with check (is_shop_admin(shop_id) or has_task(shop_id, 'day.count'));
  end if;

  -- purchase_invoices: paying a bill.
  if to_regclass('public.purchase_invoices') is null then
    raise notice 'skipped purchase_invoices: not on this database';
  else
    drop policy if exists "owner updates only" on purchase_invoices;
    drop policy if exists "owner or accounts updates" on purchase_invoices;
    create policy "owner or accounts updates" on purchase_invoices
      as restrictive for update
      using (is_shop_admin(shop_id) or has_task(shop_id, 'bill.pay'))
      with check (is_shop_admin(shop_id) or has_task(shop_id, 'bill.pay'));
    -- "owner writes only" (insert) from 0083 stays: bills come from invoicing.
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Inside the rows Accounts may write.

-- A customer: only the debt moves, and only down.
create or replace function customers_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' then
    -- An upsert of a row that exists is judged as the update it becomes.
    if exists (select 1 from customers c where c.shop_id = new.shop_id and c.id = new.id) then return new; end if;
    raise exception 'An Accounts login does not add customers.' using errcode = '42501';
  end if;
  if coalesce(new.debt, 0) > coalesce(old.debt, 0) then
    raise exception 'A payment lowers what a customer owes; it never raises it.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'debt') is distinct from (to_jsonb(old) - 'debt') then
    raise exception 'An Accounts login changes only what a customer owes, through a payment.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists customers_accounts_guard on customers;
create trigger customers_accounts_guard before insert or update on customers
  for each row execute function customers_accounts_guard();

-- An order: payments against it and the record that its invoice went --
-- never invoicing, taking an invoice back, or voiding.
create or replace function saved_quotes_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from saved_quotes q where q.id = new.id) then return new; end if;
    raise exception 'An Accounts login does not start orders.' using errcode = '42501';
  end if;
  if new.invoiced is distinct from old.invoiced or new.voided is distinct from old.voided then
    raise exception 'Invoicing and voiding are done by the owner.' using errcode = '42501';
  end if;
  if coalesce(new.amount_paid, 0) < coalesce(old.amount_paid, 0) then
    raise exception 'A recorded payment is changed only by the owner.' using errcode = '42501';
  end if;
  if (coalesce(new.payload, '{}'::jsonb) - 'payments' - 'debtCharged' - 'customerId' - 'invoiceSends')
     is distinct from (coalesce(old.payload, '{}'::jsonb) - 'payments' - 'debtCharged' - 'customerId' - 'invoiceSends') then
    raise exception 'An Accounts login records payments and sends; the order itself is not theirs to change.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists saved_quotes_accounts_guard on saved_quotes;
create trigger saved_quotes_accounts_guard before insert or update on saved_quotes
  for each row execute function saved_quotes_accounts_guard();

-- A day: the count, and closing once it agrees. The opening is the
-- owner's, and so is reopening a closed day.
create or replace function cash_days_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
declare existing cash_days%rowtype;
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' then
    select * into existing from cash_days d where d.shop_id = new.shop_id and d.date = new.date;
    if found then return new; end if;
    -- A day nobody has opened: Accounts may start its record, with the
    -- opening the app carried forward and nobody's confirmation on it.
    if coalesce(new.opening_set, false) then
      raise exception 'Confirming a day''s opening is the owner''s.' using errcode = '42501';
    end if;
    if new.closed_at is not null and not has_task(new.shop_id, 'day.close') then
      raise exception 'Closing a day needs the day.close task.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.opening is distinct from old.opening or new.opening_set is distinct from old.opening_set then
    raise exception 'A day''s opening is set by the owner.' using errcode = '42501';
  end if;
  if old.closed_at is not null and new.closed_at is null then
    raise exception 'Only the owner reopens a closed day.' using errcode = '42501';
  end if;
  if old.closed_at is not null and new.actual is distinct from old.actual then
    raise exception 'This day is closed; the owner reopens it before a count can change.' using errcode = '42501';
  end if;
  if new.closed_at is distinct from old.closed_at and not has_task(new.shop_id, 'day.close') then
    raise exception 'Closing a day needs the day.close task.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.cash_days') is null then
    raise notice 'skipped cash_days guard: not on this database';
  else
    drop trigger if exists cash_days_accounts_guard on cash_days;
    create trigger cash_days_accounts_guard before insert or update on cash_days
      for each row execute function cash_days_accounts_guard();
  end if;
end $$;

-- A supplier's bill: its payments and amountPaid, up only.
create or replace function purchase_invoices_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if new.quote_id is distinct from old.quote_id or new.date is distinct from old.date then
    raise exception 'A supplier bill is changed only by the owner.' using errcode = '42501';
  end if;
  if coalesce((new.payload->>'amountPaid')::numeric, 0) < coalesce((old.payload->>'amountPaid')::numeric, 0) then
    raise exception 'A payment to a supplier is taken back only by the owner.' using errcode = '42501';
  end if;
  if (coalesce(new.payload, '{}'::jsonb) - 'payments' - 'amountPaid')
     is distinct from (coalesce(old.payload, '{}'::jsonb) - 'payments' - 'amountPaid') then
    raise exception 'An Accounts login pays a bill; the bill itself is the owner''s.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.purchase_invoices') is null then
    raise notice 'skipped purchase_invoices guard: not on this database';
  else
    drop trigger if exists purchase_invoices_accounts_guard on purchase_invoices;
    create trigger purchase_invoices_accounts_guard before update on purchase_invoices
      for each row execute function purchase_invoices_accounts_guard();
  end if;
end $$;
