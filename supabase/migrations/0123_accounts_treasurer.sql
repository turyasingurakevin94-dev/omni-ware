-- Accounts becomes the treasurer: everything finance, nothing waiting on the owner.
--
-- docs/decision-rights.md section 2 hands the Accounts login the money jobs
-- the owner used to do at the desk. 0117 gave it the daily close, customer
-- payments and paying bills. This gives it the rest, and accounts.html is
-- built around exactly these:
--
--   day.open        set a day's opening by hand; reopen a closed day.
--   cash.expense    money paid out: fuel, transport, power, anything.
--   cash.income     other money in: a loan received, the owner's money, other.
--   cash.transfer   Cash, Mobile Money and Bank: the two linked lines
--                   ('Account Transfer', transfer_id) the console writes.
--   payment.edit    correct a customer's payment, or move it to the
--                   invoice it was for. The cash line keeps its id; the
--                   invoices, the debt log and the debt follow it.
--   bill.record     a supplier's paper bill (their number, photo, lines) or
--                   a credit from them. Accounts never moves stock: a bill
--                   it records carries payload.noStock, the goods come in
--                   through the Store's count.
--   consign.settle  pay a consignor for what sold: the console's own
--                   settlement bill (payload.consignSettlement), then paid.
--   payroll.run     wages and rent: the month's dues, absences, paying them.
--   loan.edit       a loan received, and repaying it.
--   asset.edit      an asset bought, sold, thrown away or written off.
--   agent.pay       a commission claim paid, and cash an agent brings in.
--   trip.cash       a buying trip's cash back against the cash given and
--                   what was paid at each stop; a difference is booked
--                   like a close difference (Cash Shortage / Overage).
--   finance.see     every figure: profit, what we own and owe, cash flow.
--   promise.record  a customer's promise to pay (shared with Sales and the
--                   Manager; this grants Accounts only).
--
-- Accounts PROPOSES voids and credit notes; the Manager decides
-- (invoice.void, credit_note.raise). The ask is a row in invoice_asks,
-- below. Deciding it is the Manager's build (0122), not this one.
--
-- EVERY DECISION IS LOGGED, not approved: decision_log, below, keeps who,
-- when, what and what it was before. The Owner app reads it (0127).
--
-- The headers of 0117 say openings, reopening and editing a payment stay
-- the owner's. That described the first build; docs/decision-rights.md is
-- the policy, and the guards below are re-drawn to it. Applied migrations
-- are left as they are.
--
-- Applied by hand like every migration here. Every policy, trigger and
-- function is dropped or replaced before it is created; a table this
-- database never got is skipped and named. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select task from role_tasks where role = 'accounts' order by task;
--   -- 21 rows
--
-- ROLLBACK:
--   delete from role_tasks where role = 'accounts' and task in ('day.open',
--     'cash.expense','cash.income','cash.transfer','payment.edit','bill.record',
--     'consign.settle','payroll.run','loan.edit','asset.edit','agent.pay',
--     'trip.cash','finance.see','promise.record');
--   (every policy below still lets the owner do everything, and without
--   the tasks an Accounts login can write nothing it could not under 0117)

-- ---------------------------------------------------------------------
-- 1. The tasks.
insert into role_tasks (role, task) values
  ('accounts', 'day.open'),
  ('accounts', 'cash.expense'),
  ('accounts', 'cash.income'),
  ('accounts', 'cash.transfer'),
  ('accounts', 'payment.edit'),
  ('accounts', 'bill.record'),
  ('accounts', 'consign.settle'),
  ('accounts', 'payroll.run'),
  ('accounts', 'loan.edit'),
  ('accounts', 'asset.edit'),
  ('accounts', 'agent.pay'),
  ('accounts', 'trip.cash'),
  ('accounts', 'finance.see'),
  ('accounts', 'promise.record')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. The cash book.
--
-- One restrictive insert policy, as 0117 left it, with the treasurer's
-- lines added. Each clause names the task that allows it and the exact
-- category strings the console writes (index.html addCashPayment and
-- friends), so the console's reports read these rows as its own.
do $$
begin
  if to_regclass('public.cash_txns') is null then
    raise notice 'skipped cash_txns: not on this database';
    return;
  end if;
  drop policy if exists "owner or sales writes" on cash_txns;
  drop policy if exists "owner, sales or accounts writes" on cash_txns;
  create policy "owner, sales or accounts writes" on cash_txns
    as restrictive for insert with check (
      is_shop_admin(shop_id)
      or (amount > 0 and (
        -- a customer's payment (0113, 0117)
        (has_task(shop_id, 'payment.receive') and type = 'receipt'
          and category in ('Debt Payment', 'Invoice Payment', 'Customer Payment'))
        -- a count's difference, at close or on a trip's cash (0117)
        or ((has_task(shop_id, 'variance.book') or has_task(shop_id, 'trip.cash'))
          and ((type = 'payment' and category = 'Cash Shortage')
            or (type = 'receipt' and category = 'Cash Overage')))
        -- a supplier's bill paid, a consignor settled (0117)
        or ((has_task(shop_id, 'bill.pay') or has_task(shop_id, 'consign.settle'))
          and type = 'payment' and category in ('Stock Purchase', 'Supplier Payment'))
        -- anything else paid out
        or (has_task(shop_id, 'cash.expense') and type = 'payment'
          and category not in ('Account Transfer', 'Cash Shortage', 'Cash Overage', 'Customer Refund',
                               'Debt Payment', 'Invoice Payment', 'Customer Payment'))
        -- other money in
        or (has_task(shop_id, 'cash.income') and type = 'receipt'
          and category in ('Loan Received', 'Owner Investment', 'Other Income'))
        -- one account to another: both legs
        or (has_task(shop_id, 'cash.transfer') and category = 'Account Transfer'
          and type in ('payment', 'receipt'))
        -- wages and rent
        or (has_task(shop_id, 'payroll.run') and type = 'payment'
          and category in ('Salaries & Wages', 'Rent'))
        -- a loan in, a repayment out
        or (has_task(shop_id, 'loan.edit')
          and ((type = 'receipt' and category = 'Loan Received')
            or (type = 'payment' and category = 'Loan Repayment')))
        -- an asset bought, an asset sold
        or (has_task(shop_id, 'asset.edit')
          and ((type = 'payment' and category = 'Equipment purchase')
            or (type = 'receipt' and category = 'Asset Sale')))
        -- an agent's commission out, an agent's cash in
        or (has_task(shop_id, 'agent.pay')
          and ((type = 'payment' and category = 'Agent Commission')
            or (type = 'receipt' and category = 'Agent Payment')))
      )));

  -- Correcting a payment: the receipt line itself, kept in the customer
  -- payment categories. Everything else stays the owner's (0083).
  drop policy if exists "owner updates only" on cash_txns;
  drop policy if exists "owner or accounts corrects payments" on cash_txns;
  create policy "owner or accounts corrects payments" on cash_txns
    as restrictive for update
    using (is_shop_admin(shop_id)
      or (has_task(shop_id, 'payment.edit') and type = 'receipt'
          and category in ('Debt Payment', 'Invoice Payment', 'Customer Payment', 'Agent Payment')))
    with check (is_shop_admin(shop_id)
      or (has_task(shop_id, 'payment.edit') and type = 'receipt' and amount > 0
          and category in ('Debt Payment', 'Invoice Payment', 'Customer Payment', 'Agent Payment')));
end $$;

-- Whether a day is closed. A correction on a closed day is refused until
-- the day is reopened (day.open), so a close never moves under anyone.
create or replace function cash_day_is_closed(p_shop_id uuid, p_date date)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from cash_days d where d.shop_id = p_shop_id and d.date = p_date and d.closed_at is not null);
$$;

-- A corrected payment: what was paid, on which account and day, and which
-- invoice it was for. Never who entered it, its kind, or its photo.
create or replace function cash_txns_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if (to_jsonb(new) - 'amount' - 'account' - 'date' - 'time' - 'quote_id' - 'description' - 'category')
     is distinct from (to_jsonb(old) - 'amount' - 'account' - 'date' - 'time' - 'quote_id' - 'description' - 'category') then
    raise exception 'A correction changes the amount, account, day or invoice of a payment, nothing else.' using errcode = '42501';
  end if;
  if cash_day_is_closed(old.shop_id, old.date) or cash_day_is_closed(new.shop_id, new.date) then
    raise exception 'That day is closed. Reopen it from Days first.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.cash_txns') is null then
    raise notice 'skipped cash_txns guard: not on this database';
  else
    drop trigger if exists cash_txns_accounts_guard on cash_txns;
    create trigger cash_txns_accounts_guard before update on cash_txns
      for each row execute function cash_txns_accounts_guard();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. A payment moved or corrected: the debt log and the debt follow it.
do $$
begin
  if to_regclass('public.customer_debt_log') is null then
    raise notice 'skipped customer_debt_log: not on this database';
    return;
  end if;
  drop policy if exists "owner or sales writes" on customer_debt_log;
  create policy "owner or sales writes" on customer_debt_log
    as restrictive for insert with check (
      is_shop_admin(shop_id)
      or (has_task(shop_id, 'payment.receive') and type = 'payment' and amount >= 0)
      -- the two lines a moved payment leaves: a charge back on the invoice
      -- it left, a payment on the one it went to
      or (has_task(shop_id, 'payment.edit') and type in ('charge', 'payment') and amount >= 0));
  drop policy if exists "owner updates only" on customer_debt_log;
  drop policy if exists "owner or accounts corrects lines" on customer_debt_log;
  create policy "owner or accounts corrects lines" on customer_debt_log
    as restrictive for update
    using (is_shop_admin(shop_id) or has_task(shop_id, 'payment.edit'))
    with check (is_shop_admin(shop_id) or has_task(shop_id, 'payment.edit'));
end $$;

-- A line keeps its customer, kind and day; a correction changes its
-- amount, the invoice it belongs to, or its note.
create or replace function customer_debt_log_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if (to_jsonb(new) - 'amount' - 'quote_id' - 'note') is distinct from (to_jsonb(old) - 'amount' - 'quote_id' - 'note') then
    raise exception 'A correction changes a debt line''s amount, invoice or note, nothing else.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.customer_debt_log') is null then
    raise notice 'skipped customer_debt_log guard: not on this database';
  else
    drop trigger if exists customer_debt_log_accounts_guard on customer_debt_log;
    create trigger customer_debt_log_accounts_guard before update on customer_debt_log
      for each row execute function customer_debt_log_accounts_guard();
  end if;
end $$;

-- A customer: still only the debt, and down only -- unless a payment is
-- being corrected (payment.edit), which may raise it back.
create or replace function customers_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from customers c where c.shop_id = new.shop_id and c.id = new.id) then return new; end if;
    raise exception 'An Accounts login does not add customers.' using errcode = '42501';
  end if;
  if coalesce(new.debt, 0) > coalesce(old.debt, 0) and not has_task(new.shop_id, 'payment.edit') then
    raise exception 'A payment lowers what a customer owes; it never raises it.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'debt') is distinct from (to_jsonb(old) - 'debt') then
    raise exception 'An Accounts login changes only what a customer owes, through a payment.' using errcode = '42501';
  end if;
  return new;
end $$;

-- An order: payments against it, the record that its invoice went, and
-- -- with agent.pay -- that an agent's cash for it came in. Never
-- invoicing or voiding: those are the Manager's (invoice.void), asked
-- for through invoice_asks. A payment moved off an invoice
-- (payment.edit) lowers what it has paid.
create or replace function saved_quotes_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  free_keys text[] := array['payments', 'debtCharged', 'customerId', 'invoiceSends'];
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from saved_quotes q where q.id = new.id) then return new; end if;
    raise exception 'An Accounts login does not start orders.' using errcode = '42501';
  end if;
  if new.invoiced is distinct from old.invoiced or new.voided is distinct from old.voided then
    raise exception 'Invoicing and voiding are the Manager''s. Ask for it from the invoice.' using errcode = '42501';
  end if;
  if coalesce(new.amount_paid, 0) < coalesce(old.amount_paid, 0) and not has_task(new.shop_id, 'payment.edit') then
    raise exception 'Moving a payment off an invoice needs payment.edit.' using errcode = '42501';
  end if;
  if has_task(new.shop_id, 'agent.pay') then free_keys := free_keys || 'agentPaymentStatus'; end if;
  if (coalesce(new.payload, '{}'::jsonb) - free_keys) is distinct from (coalesce(old.payload, '{}'::jsonb) - free_keys) then
    raise exception 'An Accounts login records payments and sends; the order itself is not theirs to change.' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. The day: openings and reopening are the treasurer's (day.open).
create or replace function cash_days_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
declare existing cash_days%rowtype;
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' then
    select * into existing from cash_days d where d.shop_id = new.shop_id and d.date = new.date;
    if found then return new; end if;
    if coalesce(new.opening_set, false) and not has_task(new.shop_id, 'day.open') then
      raise exception 'Setting a day''s opening needs day.open.' using errcode = '42501';
    end if;
    if new.closed_at is not null and not has_task(new.shop_id, 'day.close') then
      raise exception 'Closing a day needs the day.close task.' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.opening is distinct from old.opening or new.opening_set is distinct from old.opening_set)
     and not has_task(new.shop_id, 'day.open') then
    raise exception 'Setting a day''s opening needs day.open.' using errcode = '42501';
  end if;
  if old.closed_at is not null and new.closed_at is null and not has_task(new.shop_id, 'day.open') then
    raise exception 'Reopening a closed day needs day.open.' using errcode = '42501';
  end if;
  if old.closed_at is not null and new.closed_at is not null and new.actual is distinct from old.actual then
    raise exception 'This day is closed. Reopen it before a count can change.' using errcode = '42501';
  end if;
  if new.closed_at is distinct from old.closed_at and new.closed_at is not null and not has_task(new.shop_id, 'day.close') then
    raise exception 'Closing a day needs the day.close task.' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 5. Supplier bills: a paper bill or a credit (bill.record), a consignor
-- settled (consign.settle).
do $$
begin
  if to_regclass('public.purchase_invoices') is null then
    raise notice 'skipped purchase_invoices: not on this database';
    return;
  end if;
  drop policy if exists "owner writes only" on purchase_invoices;
  drop policy if exists "owner or accounts writes" on purchase_invoices;
  create policy "owner or accounts writes" on purchase_invoices
    as restrictive for insert with check (
      is_shop_admin(shop_id) or has_task(shop_id, 'bill.record') or has_task(shop_id, 'consign.settle'));
  drop policy if exists "owner or accounts updates" on purchase_invoices;
  create policy "owner or accounts updates" on purchase_invoices
    as restrictive for update
    using (is_shop_admin(shop_id) or has_task(shop_id, 'bill.pay') or has_task(shop_id, 'bill.record'))
    with check (is_shop_admin(shop_id) or has_task(shop_id, 'bill.pay') or has_task(shop_id, 'bill.record'));
end $$;

-- A bill Accounts makes moves no stock and starts unpaid. On a bill that
-- exists: its payments (bill.pay, up only), and its paper -- the
-- supplier's number, the photo, transport, the day it is due, and a
-- credit from them (bill.record). Never its lines or its supplier.
create or replace function purchase_invoices_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  free_keys text[] := array['payments', 'amountPaid'];
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'INSERT' then
    if new.quote_id is not null then
      raise exception 'A bill raised by an order comes from invoicing, not from Accounts.' using errcode = '42501';
    end if;
    if coalesce((new.payload->>'amountPaid')::numeric, 0) <> 0
       or jsonb_array_length(coalesce(new.payload->'payments', '[]'::jsonb)) <> 0 then
      raise exception 'A bill starts unpaid; pay it from Bills.' using errcode = '42501';
    end if;
    if coalesce((new.payload->>'consignSettlement')::boolean, false) then
      if not has_task(new.shop_id, 'consign.settle') then
        raise exception 'Settling a consignor needs consign.settle.' using errcode = '42501';
      end if;
    elsif not (has_task(new.shop_id, 'bill.record') and coalesce((new.payload->>'noStock')::boolean, false)) then
      raise exception 'A bill Accounts records moves no stock (payload.noStock); the Store counts goods in.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.quote_id is distinct from old.quote_id or new.date is distinct from old.date then
    raise exception 'A supplier bill''s order and date stay as they are.' using errcode = '42501';
  end if;
  if coalesce((new.payload->>'amountPaid')::numeric, 0) < coalesce((old.payload->>'amountPaid')::numeric, 0) then
    raise exception 'A payment to a supplier is taken back only by the owner.' using errcode = '42501';
  end if;
  if (coalesce(new.payload->'payments', '[]'::jsonb) is distinct from coalesce(old.payload->'payments', '[]'::jsonb)
      or new.payload->'amountPaid' is distinct from old.payload->'amountPaid')
     and not has_task(new.shop_id, 'bill.pay') then
    raise exception 'Paying a bill needs bill.pay.' using errcode = '42501';
  end if;
  if has_task(new.shop_id, 'bill.record') then
    free_keys := free_keys || array['supplierRef', 'photo', 'transport', 'dueDate', 'credits', 'docLog'];
  end if;
  if (coalesce(new.payload, '{}'::jsonb) - free_keys) is distinct from (coalesce(old.payload, '{}'::jsonb) - free_keys) then
    raise exception 'An Accounts login pays a bill and records its paper; its lines are not theirs to change.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.purchase_invoices') is null then
    raise notice 'skipped purchase_invoices guard: not on this database';
  else
    drop trigger if exists purchase_invoices_accounts_guard on purchase_invoices;
    create trigger purchase_invoices_accounts_guard before insert or update on purchase_invoices
      for each row execute function purchase_invoices_accounts_guard();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6. Wages and rent, loans, assets, promises: the owner's walls (0083,
-- 0089) re-drawn so the task that runs each one may write it.
do $$
declare
  t text; task text;
begin
  foreach t in array array['dues', 'loans', 'fixed_assets', 'payment_promises'] loop
    task := case t when 'dues' then 'payroll.run' when 'loans' then 'loan.edit'
                   when 'fixed_assets' then 'asset.edit' else 'promise.record' end;
    if to_regclass('public.' || t) is null then
      raise notice 'skipped %: not on this database', t;
      continue;
    end if;
    execute format('drop policy if exists "owner writes only" on %I', t);
    execute format('drop policy if exists "owner updates only" on %I', t);
    execute format('drop policy if exists "owner or treasurer writes" on %I', t);
    execute format('drop policy if exists "owner or treasurer updates" on %I', t);
    execute format(
      'create policy "owner or treasurer writes" on %I as restrictive for insert with check (is_shop_admin(shop_id) or has_task(shop_id, %L))', t, task);
    execute format(
      'create policy "owner or treasurer updates" on %I as restrictive for update using (is_shop_admin(shop_id) or has_task(shop_id, %L)) with check (is_shop_admin(shop_id) or has_task(shop_id, %L))', t, task, task);
  end loop;
end $$;

-- A month's due keeps the rate it was costed at: pay rates are the
-- owner's, set when hiring (section 4 of the decision rights).
create or replace function dues_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if tg_op = 'UPDATE' and (new.rate is distinct from old.rate or new.kind is distinct from old.kind
     or new.ref_id is distinct from old.ref_id or new.period is distinct from old.period) then
    raise exception 'A due keeps its rate, person and month; pay rates are the owner''s.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and coalesce(new.paid, 0) < coalesce(old.paid, 0) then
    raise exception 'A wage or rent payment is taken back only by the owner.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.dues') is null then
    raise notice 'skipped dues guard: not on this database';
  else
    drop trigger if exists dues_accounts_guard on dues;
    create trigger dues_accounts_guard before insert or update on dues
      for each row execute function dues_accounts_guard();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 7. Agents: their names, their claims, and a claim paid.
do $$
begin
  if to_regclass('public.agents') is null then
    raise notice 'skipped agents: not on this database';
  else
    drop policy if exists "treasurer reads agents" on agents;
    create policy "treasurer reads agents" on agents
      for select using (has_task(shop_id, 'agent.pay') or has_task(shop_id, 'finance.see'));
  end if;
  if to_regclass('public.agent_commission_claims') is null then
    raise notice 'skipped agent_commission_claims: not on this database';
  else
    drop policy if exists "treasurer reads claims" on agent_commission_claims;
    create policy "treasurer reads claims" on agent_commission_claims
      for select using (has_task(shop_id, 'agent.pay') or has_task(shop_id, 'finance.see'));
    drop policy if exists "treasurer pays claims" on agent_commission_claims;
    create policy "treasurer pays claims" on agent_commission_claims
      for update using (has_task(shop_id, 'agent.pay')) with check (has_task(shop_id, 'agent.pay'));
  end if;
end $$;

-- A claim moves from requested to paid, with the day and the cash line.
-- Its amount and its month stay the agent's.
create or replace function agent_claims_accounts_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not is_shop_accounts(new.shop_id) then return new; end if;
  if (to_jsonb(new) - 'status' - 'paid_at' - 'cash_txn_id') is distinct from (to_jsonb(old) - 'status' - 'paid_at' - 'cash_txn_id') then
    raise exception 'Paying a claim marks it paid; its amount is the agent''s.' using errcode = '42501';
  end if;
  if old.status = 'paid' or new.status <> 'paid' then
    raise exception 'A claim is paid once, and not taken back here.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.agent_commission_claims') is null then
    raise notice 'skipped agent_commission_claims guard: not on this database';
  else
    drop trigger if exists agent_claims_accounts_guard on agent_commission_claims;
    create trigger agent_claims_accounts_guard before update on agent_commission_claims
      for each row execute function agent_claims_accounts_guard();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8. A buying trip's cash, counted back (trip.cash).
--
-- cash_count = {given, paid, expected, counted, diff, cashTxnId, by,
-- byName, at}. collection_trips stays open to members (0083: the worker
-- and buyer apps write it); only the count is fenced, to trip.cash.
do $$
begin
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips.cash_count: table not on this database';
  else
    alter table collection_trips add column if not exists cash_count jsonb;
  end if;
end $$;

create or replace function collection_trips_cash_guard() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.cash_count is not null and not has_task(new.shop_id, 'trip.cash') then
      raise exception 'Counting a trip''s cash needs trip.cash.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.cash_count is distinct from old.cash_count and not has_task(new.shop_id, 'trip.cash') then
    raise exception 'Counting a trip''s cash needs trip.cash.' using errcode = '42501';
  end if;
  if is_shop_accounts(new.shop_id)
     and (to_jsonb(new) - 'cash_count') is distinct from (to_jsonb(old) - 'cash_count') then
    raise exception 'Accounts counts a trip''s cash; the trip itself is the Buyer''s.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.collection_trips') is null then
    raise notice 'skipped collection_trips guard: not on this database';
  else
    drop trigger if exists collection_trips_cash_guard on collection_trips;
    create trigger collection_trips_cash_guard before insert or update on collection_trips
      for each row execute function collection_trips_cash_guard();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 9. Asking the Manager: a void or a credit note on an invoice.
--
-- Shaped like 0115's stock_counts: the asker inserts one row, status
-- 'sent'; nobody updates it from a client. The Manager's build (0122)
-- decides through its own functions, gated by invoice.void and
-- credit_note.raise, and sets status, decided_by, decided_at.
--
--   kind   'void' | 'credit'
--   lines  [{idx, name, qty, price, amount}]   the lines coming off (credit)
--   amount what comes off the invoice
create table if not exists invoice_asks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  quote_id bigint not null,
  customer_id text,
  kind text not null check (kind in ('void', 'credit')),
  lines jsonb not null default '[]'::jsonb,
  amount numeric not null default 0 check (amount >= 0),
  reason text,
  note text,
  asked_by uuid not null default auth.uid(),
  asked_by_name text,
  asked_role text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists invoice_asks_shop_idx on invoice_asks(shop_id, status, created_at desc);
alter table invoice_asks enable row level security;

-- Who may ask: the roles decision-rights lists as proposers (Sales,
-- Accounts, Store for a credit note; Sales, Accounts for a void).
create or replace function may_ask_invoice(p_shop_id uuid, p_kind text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from shop_members m
    where m.shop_id = p_shop_id and m.user_id = auth.uid()
      and (m.role in ('owner', 'admin', 'manager', 'sales', 'accounts')
        or (m.role = 'store' and p_kind = 'credit'))
  );
$$;

drop policy if exists "members read asks" on invoice_asks;
create policy "members read asks" on invoice_asks
  for select using (is_shop_member(shop_id));
drop policy if exists "proposers add asks" on invoice_asks;
create policy "proposers add asks" on invoice_asks
  for insert with check (may_ask_invoice(shop_id, kind) and asked_by = auth.uid() and status = 'sent'
    and decided_by is null and decided_at is null);

-- The asker may take back an ask nobody has decided.
create or replace function withdraw_invoice_ask(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update invoice_asks set status = 'withdrawn', decided_at = now()
  where id = p_id and asked_by = auth.uid() and status = 'sent';
  if not found then
    raise exception 'That ask is decided already, or it is not yours.' using errcode = '42501';
  end if;
end $$;
revoke all on function withdraw_invoice_ask(uuid) from public;
grant execute on function withdraw_invoice_ask(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. The owner's log: every decision a role makes for the owner, with
-- what it was before. Written beside each change by the app that made
-- it; read by the Owner app. Never edited, never a queue.
--
--   task    the role_tasks name the change used ('cash.expense', ...)
--   what    one line, as the owner will read it
--   ref     what it touched: {table, id}
--   before / after   the parts that changed
create table if not exists decision_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  at timestamptz not null default now(),
  by uuid not null default auth.uid(),
  by_name text,
  role text,
  task text not null,
  what text not null,
  amount numeric,
  ref jsonb,
  before jsonb,
  after jsonb
);
create index if not exists decision_log_shop_at_idx on decision_log(shop_id, at desc);
alter table decision_log enable row level security;

drop policy if exists "members read the log" on decision_log;
create policy "members read the log" on decision_log
  for select using (is_shop_admin(shop_id) or by = auth.uid() or has_task(shop_id, 'finance.see'));
drop policy if exists "a role logs its own decisions" on decision_log;
create policy "a role logs its own decisions" on decision_log
  for insert with check (is_shop_member(shop_id) and by = auth.uid() and has_task(shop_id, task));
-- No update or delete policy: a line in the log stays as it was written.
