-- 0169 Manager, first audit round (data and money integrity, 25 Oct 2026;
-- docs/audit/manager/ROUND-1.md): the money and the stock hold together on
-- the server, whoever writes.
--
-- Cowork's Manager round 1 found, on live: a cash payment naming a momo
-- receipt, and one receipt named by two payments (MGR-DATA-01); balances
-- that are not their bills (-02); stock keys whose lots do not add up to
-- the stock (-03); voided orders still holding the money paid on them
-- (-07); lines billed at 0 with no word why (-09); wages in fractions of a
-- shilling (-10); payments typed with a day before the order (-11); one
-- customer twice (-13); targets still open after their last day (-14);
-- a 567 invoice raised by the hourly run (-15). From now on:
--
--   1. receive_payment     takes p_date (the day it was paid; never after
--                          today; the receipt, the payment and the
--                          balance's log line all carry it) and p_label
--                          ('Deposit' for money paid before the order:
--                          the payment's label and note). One function:
--                          the old signature is dropped first.
--   2. saved_quotes_zz_money_check (0165's, widened) also refuses a payment
--                          whose receipt is in another account than the
--                          payment says (cash / momo / bank), a receipt
--                          already named by another payment (this order or
--                          any other), and an invoiced line at 0 that is
--                          not given away on purpose
--                          (items[i].givenAway = {why, by, at}). A line
--                          given away is priced (at 0): ow_line_to_confirm
--                          no longer holds it as one still to price.
--   3. saved_quotes_zz_void_money  a phone app (any login but the owner's
--                          console) can't void an order that holds money
--                          unless the money is settled in the same write
--                          (payload.voidMoney.done): OWVMN. A test record
--                          (qa, 0167) is never held. void_sale_bills
--                          refuses the same.
--   4. void_with_money     the Manager's void (invoice.void) with its money
--                          in one transaction: 'refund' (a cash payment out,
--                          category Refund) or 'deposit' (the customer's
--                          balance goes down by what was paid; a debt-log
--                          line on no order, 'Deposit — void #0166').
--   5. ow_customer_balance opening balance (debt-log lines on no order) +
--                          what each live invoice still owes: round-1-check
--                          query 4's rule, for any app to read.
--   6. merge_customers     the Manager (customer.merge, new: Manager only,
--                          Kevin 25 Oct; Sales holds customer.edit too)
--                          merges one customer
--                          into another: their orders, debt log, promises,
--                          statements, asks and every other customer_id
--                          row move, the balances add, the second goes.
--   7. ow_end_targets      a target past its last day is 'ended' with its
--                          result {actual, aim, reached}. The hourly run
--                          calls it; the apps may call it on load.
--   8. ow_invoice_due_orders  the hourly run leaves an order under 1,000
--                          to the Manager (OWSML, pushed as invoice.held).
--   9. cash_txns_round_amount  every cash line is whole shillings.
--  10. stock_zz_lots_add_up / stock_lots_zz_lots_add_up  STRICT (Kevin,
--                          25 Oct): at commit, every stock key the
--                          transaction touched must have lots that add up
--                          to its stock, or the whole write is refused
--                          (OWLOT). Every server function already moves
--                          both together; the owner console saves both
--                          through replace_stock_and_lots (one transaction)
--                          and falls back to its old path only before this
--                          is applied.
--
-- docs/audit/manager/round-1-correct.sql corrects the old rows this finds
-- (#0415, the stock keys whose lots don't add up, the test voids #0166 and
-- #0148, fractions, ended targets, early payments): run it RIGHT AFTER
-- this, in the same sitting. Until it has run, a stock move on a key whose
-- lots are already apart is refused.
--
-- Deploy: index.html (its stock save goes through replace_stock_and_lots
-- once this exists, and keeps the old path until then) first, then this,
-- then round-1-correct.sql.
--
-- Applied by hand, after 0168. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'receive_payment';   -- one row, 10 arguments
--   select proname from pg_proc where proname in ('void_with_money', 'ow_customer_balance', 'merge_customers', 'ow_end_targets', 'replace_stock_and_lots', 'ow_lots_add_up');   -- 6 rows
--   select tgname from pg_trigger where tgname in ('saved_quotes_zz_void_money', 'cash_txns_round_amount', 'stock_zz_lots_add_up', 'stock_lots_zz_lots_add_up');   -- 4 rows
--   then round-1-check.sql: queries 1, 2, 5, 7, 8 and 11 empty once round-1-correct.sql has run.
--
-- ROLLBACK:
--   delete from role_tasks where role = 'manager' and task = 'customer.merge';
--   drop trigger if exists stock_zz_lots_add_up on stock; drop trigger if exists stock_lots_zz_lots_add_up on stock_lots;
--   drop trigger if exists cash_txns_round_amount on cash_txns; drop trigger if exists saved_quotes_zz_void_money on saved_quotes;
--   drop function if exists replace_stock_and_lots(uuid, text[], jsonb, jsonb); drop function if exists ow_lots_add_up();
--   drop function if exists void_with_money(uuid, bigint, text, text); drop function if exists ow_customer_balance(uuid, text);
--   drop function if exists merge_customers(uuid, text, text); drop function if exists ow_end_targets(uuid);
--   drop function if exists receive_payment(uuid, text, numeric, text, bigint[], bigint, text, text, date, text);
--   then run 0165 again (receive_payment, the money check, the debt sync), 0122's void_sale_bills,
--   0119's ow_line_to_confirm and 0139's ow_invoice_due_orders. (The index can stay.)

-- ---------------------------------------------------------------------
-- 0. The one new task: merging two customers is the Manager's.
insert into role_tasks (role, task) values ('manager', 'customer.merge') on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. A payment's day and label. 0165's receive_payment, with p_date and
--    p_label (marked 0169).
drop function if exists receive_payment(uuid, text, numeric, text, bigint[], bigint, text);
drop function if exists receive_payment(uuid, text, numeric, text, bigint[], bigint, text, text);
create or replace function receive_payment(p_shop_id uuid, p_customer_id text, p_amount numeric, p_method text,
                                           p_picks bigint[] default null, p_order_id bigint default null, p_ref text default null,
                                           p_over text default null, p_date date default null, p_label text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  -- 0169: the day it was paid (never after today).
  d date := coalesce(p_date, ow_today());
  hm text := to_char(now() at time zone ow_shop_tz(), 'HH24:MI');
  method text := coalesce(nullif(btrim(p_method), ''), 'cash');
  amount numeric := round(coalesce(p_amount, 0));
  over_how text := nullif(lower(btrim(coalesce(p_over, ''))), '');
  c customers%rowtype;
  q saved_quotes%rowtype;
  pay_q numeric;
  total numeric;
  due numeric;
  left_amt numeric;
  lower_by numeric;
  over_amt numeric := 0;
  debt0 numeric;
  debt numeric;
  cash_id bigint;
  pays jsonb;
  next_pay_id integer;
  label text;
  bills jsonb := '[]'::jsonb;
  cash_ids bigint[] := '{}';
  open_ids bigint[];
  ordered_ids bigint[];
  i integer;
  one_name boolean;
  cid text;
  floor_id bigint;
  v_ref text := nullif(left(regexp_replace(btrim(coalesce(p_ref, '')), '[^A-Za-z0-9._/:-]', '', 'g'), 40), '');
  -- 0169: 'Deposit' for money paid before the order (its label and its note).
  v_label text := nullif(left(btrim(coalesce(p_label, '')), 40), '');
  v_tag jsonb := case when nullif(left(btrim(coalesce(p_label, '')), 40), '') is null then '{}'::jsonb
                      else jsonb_build_object('label', left(btrim(p_label), 40), 'note', left(btrim(p_label), 40)) end;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'payment.receive')) then
    raise exception 'Taking a payment needs payment.receive.' using errcode = '42501';
  end if;
  if not (amount > 0) then
    raise exception 'Nothing to record: the amount is zero.' using errcode = '22023';
  end if;
  if over_how is not null and over_how not in ('change', 'deposit') then
    raise exception 'Over what is owed is change or a deposit.' using errcode = '22023';
  end if;
  if d > ow_today() then
    raise exception 'A payment can''t be dated after today.' using errcode = '22023';
  end if;
  -- The balance's own log line (saved_quotes_zz_sync_debt) carries the same day.
  perform set_config('ow.pay_date', d::text, true);

  /* ---------------- an order before its invoice ---------------- */
  if p_order_id is not null then
    select * into q from saved_quotes where shop_id = p_shop_id and id = p_order_id for update;
    if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
    if coalesce(q.voided, false) then raise exception 'The order was cancelled.' using errcode = '22023'; end if;
    if q.invoiced then raise exception 'This order has just been invoiced — take it from the customer''s bills.' using errcode = '22023'; end if;
    total := round(ow_order_total(p_shop_id, coalesce(q.payload, '{}'::jsonb), true));
    due := greatest(0, total - coalesce(q.amount_paid, 0));
    over_amt := greatest(0, amount - due);
    if over_amt > 0 and over_how is null then
      raise exception 'Paid over by %: give change, or keep it as a deposit.', over_amt using errcode = 'OWOVR';
    end if;
    cid := nullif(q.payload ->> 'customerId', '');
    if over_amt > 0 and over_how = 'deposit' and cid is null then
      raise exception 'Name the customer to keep a deposit.' using errcode = 'OWDEP';
    end if;
    pay_q := least(amount, due);
    if not (pay_q > 0) and not (over_amt > 0 and over_how = 'deposit') then
      raise exception 'Nothing is left to pay on this order.' using errcode = '22023';
    end if;
    label := '#' || case when length(q.id::text) < 4 then lpad(q.id::text, 4, '0') else q.id::text end;
    if pay_q > 0 then
      cash_id := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
      insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
           values (cash_id, p_shop_id, d, method, 'receipt', 'Invoice Payment', pay_q, 'Payment — order ' || label || coalesce(' · ref ' || v_ref, ''), hm, q.id, uid);
      cash_ids := cash_ids || cash_id;
      pays := case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end;
      select coalesce(max(ow_num(p ->> 'id')), 0) + 1 into next_pay_id from jsonb_array_elements(pays) p;
      pays := pays || (jsonb_build_object('date', d, 'amount', pay_q, 'note', '', 'cashTxnId', cash_id, 'method', method, 'id', next_pay_id) || case when v_ref is null then '{}'::jsonb else jsonb_build_object('ref', v_ref) end || v_tag);
      update saved_quotes set amount_paid = coalesce(amount_paid, 0) + pay_q, payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('payments', pays)
       where shop_id = p_shop_id and id = q.id;
    end if;
    if over_amt > 0 and over_how = 'deposit' then
      select * into c from customers where shop_id = p_shop_id and id = cid for update;
      if not found then raise exception 'Name the customer to keep a deposit.' using errcode = 'OWDEP'; end if;
      cash_ids := cash_ids || ow_deposit_in(p_shop_id, c.id, over_amt, method, 'Deposit — ' || coalesce(c.name, c.id) || ' · order ' || label || coalesce(' · ref ' || v_ref, ''), d, hm, uid);
    end if;
    perform set_config('ow.pay_date', '', true);
    return jsonb_build_object('kind', 'order', 'orderId', q.id, 'amount', pay_q + case when over_how = 'deposit' then over_amt else 0 end, 'method', method, 'time', hm, 'date', d,
                              'name', coalesce(nullif(q.client_name, ''), 'Walk-in'), 'phone', coalesce(q.client_phone, ''),
                              'id', cid, 'before', due, 'after', due - pay_q, 'label', v_label,
                              'change', case when over_how = 'change' then over_amt else 0 end,
                              'deposit', case when over_how = 'deposit' then over_amt else 0 end,
                              'bills', jsonb_build_array(jsonb_build_object('quoteId', q.id, 'label', 'Order ' || label, 'pay', pay_q, 'cleared', pay_q >= due, 'left', due - pay_q, 'total', total))
                                       || case when over_how = 'deposit' and over_amt > 0 then jsonb_build_array(jsonb_build_object('label', 'Deposit', 'pay', over_amt, 'deposit', true)) else '[]'::jsonb end,
                              'cashRows', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from cash_txns x where x.id = any(cash_ids)));
  end if;

  /* ---------------- a customer's payment ---------------- */
  if coalesce(p_customer_id, '') = '' then
    raise exception 'Whose payment is it? Pick the customer.' using errcode = '22023';
  end if;
  select * into c from customers where shop_id = p_shop_id and id = p_customer_id for update;
  if not found then raise exception 'That customer is no longer in the books.' using errcode = 'P0002'; end if;
  debt0 := coalesce(c.debt, 0);
  select count(*) = 1 into one_name from customers x where x.shop_id = p_shop_id and lower(btrim(coalesce(x.name, ''))) = lower(btrim(coalesce(c.name, '')));
  select coalesce(array_agg(s.id order by coalesce(s.invoiced_ts, (coalesce(s.invoiced_at, s.date) + time '00:00') at time zone ow_shop_tz()), s.id), '{}')
    into open_ids
    from saved_quotes s
   where s.shop_id = p_shop_id and s.invoiced and not coalesce(s.voided, false)
     and (s.payload ->> 'customerId' = c.id
          or (coalesce(s.payload ->> 'customerId', '') = '' and one_name and lower(btrim(coalesce(s.client_name, ''))) = lower(btrim(coalesce(c.name, '')))))
     and round(ow_order_total(p_shop_id, coalesce(s.payload, '{}'::jsonb), false)) - coalesce(s.amount_paid, 0) > 0;
  if p_picks is not null then
    ordered_ids := '{}';
    foreach i in array p_picks loop
      if i = any(open_ids) and not (i = any(ordered_ids)) then ordered_ids := ordered_ids || i; end if;
    end loop;
  else
    ordered_ids := open_ids;
  end if;
  left_amt := amount;
  foreach i in array ordered_ids loop
    exit when not (left_amt > 0);
    select * into q from saved_quotes where shop_id = p_shop_id and id = i for update;
    total := round(ow_order_total(p_shop_id, coalesce(q.payload, '{}'::jsonb), false));
    due := greatest(0, total - coalesce(q.amount_paid, 0));
    pay_q := least(left_amt, due);
    continue when not (pay_q > 0);
    label := 'INV-' || case when length(q.id::text) < 4 then lpad(q.id::text, 4, '0') else q.id::text end;
    cash_id := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (cash_id, p_shop_id, d, method, 'receipt', 'Debt Payment', pay_q, 'Payment — ' || label || coalesce(' · ref ' || v_ref, ''), hm, q.id, uid);
    cash_ids := cash_ids || cash_id;
    pays := case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end;
    select coalesce(max(ow_num(p ->> 'id')), 0) + 1 into next_pay_id from jsonb_array_elements(pays) p;
    pays := pays || (jsonb_build_object('date', d, 'amount', pay_q, 'note', '', 'cashTxnId', cash_id, 'method', method, 'id', next_pay_id) || case when v_ref is null then '{}'::jsonb else jsonb_build_object('ref', v_ref) end || v_tag);
    -- The balance follows the invoice down: saved_quotes_zz_sync_debt moves it and logs it.
    update saved_quotes
       set amount_paid = coalesce(amount_paid, 0) + pay_q,
           payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('payments', pays, 'customerId', c.id)
     where shop_id = p_shop_id and id = q.id;
    bills := bills || jsonb_build_object('quoteId', q.id, 'label', label, 'pay', pay_q, 'cleared', pay_q >= due, 'left', greatest(0, due - pay_q), 'total', total);
    left_amt := left_amt - pay_q;
  end loop;
  select coalesce(x.debt, 0) into debt from customers x where x.shop_id = p_shop_id and x.id = c.id;
  if left_amt > 0 then
    lower_by := least(left_amt, greatest(debt, 0));          -- an older balance, not on a bill
    over_amt := left_amt - lower_by;                          -- more than they owe at all
    if over_amt > 0 and over_how is null then
      raise exception 'Paid over by %: give change, or keep it as a deposit.', over_amt using errcode = 'OWOVR';
    end if;
    if lower_by > 0 or (over_amt > 0 and over_how = 'deposit') then
      left_amt := lower_by + case when over_how = 'deposit' then over_amt else 0 end;
      cash_ids := cash_ids || ow_deposit_in(p_shop_id, c.id, left_amt, method,
        case when over_amt > 0 and over_how = 'deposit' then 'Deposit — ' else 'Payment — ' end || coalesce(c.name, c.id) || coalesce(' · ref ' || v_ref, ''), d, hm, uid);
      if lower_by > 0 then bills := bills || jsonb_build_object('label', 'Older balance', 'pay', lower_by, 'cleared', lower_by >= debt, 'left', greatest(0, debt - lower_by), 'onAccount', true); end if;
      if over_amt > 0 and over_how = 'deposit' then bills := bills || jsonb_build_object('label', 'Deposit', 'pay', over_amt, 'deposit', true); end if;
    end if;
    select coalesce(x.debt, 0) into debt from customers x where x.shop_id = p_shop_id and x.id = c.id;
  end if;
  perform set_config('ow.pay_date', '', true);
  return jsonb_build_object('kind', 'cust', 'id', c.id, 'name', coalesce(c.name, c.id), 'phone', coalesce(nullif(c.phone, ''), c.phone2, ''),
                            'amount', amount - case when over_how = 'change' then over_amt else 0 end, 'method', method, 'time', hm, 'date', d, 'bills', bills,
                            'before', debt0, 'after', debt, 'label', v_label,
                            'change', case when over_how = 'change' then over_amt else 0 end,
                            'deposit', case when over_how = 'deposit' then over_amt else 0 end,
                            'cashRows', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from cash_txns x where x.id = any(cash_ids)));
end $$;
revoke all on function receive_payment(uuid, text, numeric, text, bigint[], bigint, text, text, date, text) from public, anon;
grant execute on function receive_payment(uuid, text, numeric, text, bigint[], bigint, text, text, date, text) to authenticated;

-- The balance's log line carries the payment's day (0165's, marked 0169).
create or replace function saved_quotes_sync_debt() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid text := nullif(new.payload ->> 'customerId', '');
  desired numeric;
  cur numeric;
  delta numeric;
  saved jsonb;
  floor_id bigint;
  -- 0169: receive_payment's p_date, when it set one for this transaction.
  on_day date := coalesce(nullif(current_setting('ow.pay_date', true), '')::date, ow_today());
begin
  if coalesce(current_setting('ow.money_fix', true), '') = 'on' then return new; end if;
  if not (coalesce(new.invoiced, false) and coalesce(old.invoiced, false)) or cid is null then return new; end if;
  if coalesce(old.voided, false) then return new; end if;
  -- A voided invoice owes nothing: its share comes off the balance as it is voided.
  desired := case when coalesce(new.voided, false) then 0
                  else greatest(0, round(ow_order_total(new.shop_id, new.payload, false)) - round(coalesce(new.amount_paid, 0))) end;
  cur := round(coalesce(ow_num(new.payload ->> 'debtCharged'), 0));
  if desired = cur then return new; end if;
  delta := desired - cur;
  saved := ow_system_begin();
  update customers set debt = coalesce(debt, 0) + delta where shop_id = new.shop_id and id = cid;
  if found then
    select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = new.shop_id;
    insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id)
         values (ow_next_row_id(new.shop_id, 'row:debt_log', floor_id), new.shop_id, cid, on_day,
                 case when delta > 0 then 'charge' else 'payment' end, abs(delta),
                 'Auto-sync — INV-' || case when length(new.id::text) < 4 then lpad(new.id::text, 4, '0') else new.id::text end, new.id);
    new.payload := new.payload || jsonb_build_object('debtCharged', desired);
  end if;
  perform ow_system_end(saved);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. What an order's money may be: 0165's check, widened (marked 0169).
-- A line given away on purpose is priced: at 0 (0119's ow_line_to_confirm, marked 0169).
do $mig$
declare
  src text := pg_get_functiondef('ow_line_to_confirm(uuid, jsonb, jsonb)'::regprocedure);
  was text := 'if coalesce(ow_num(it ->> ''sellPrice''), 0) > 0 then return false; end if;';
begin
  if position('givenAway' in src) > 0 then return; end if;
  if position(was in src) = 0 then raise exception '0169: ow_line_to_confirm is not the shape 0119 left; not changed.'; end if;
  src := replace(src, was, was || chr(10) || '  -- 0169: given away on purpose, with a reason: priced at 0.' || chr(10)
    || '  if it ? ''sellPrice'' and ow_num(it ->> ''sellPrice'') = 0 and coalesce(btrim(it -> ''givenAway'' ->> ''why''), '''') <> '''' then return false; end if;');
  execute src;
end $mig$;

create index if not exists saved_quotes_payments_gin on saved_quotes using gin ((payload -> 'payments') jsonb_path_ops);

create or replace function saved_quotes_money_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  newp jsonb := case when jsonb_typeof(new.payload -> 'payments') = 'array' then new.payload -> 'payments' else '[]'::jsonb end;
  oldp jsonb := '[]'::jsonb;
  oldi jsonb := '[]'::jsonb;
  p jsonb;
  it jsonb;
  c cash_txns%rowtype;
  s numeric;
  cn numeric;
  tot numeric;
  other bigint;
begin
  -- The round's correction script (and only it) sets this for its own transaction.
  if coalesce(current_setting('ow.money_fix', true), '') = 'on' then return new; end if;
  -- An upsert of a row that is there already (the owner console saves so) is judged by its update.
  if tg_op = 'INSERT' and exists (select 1 from saved_quotes x where x.shop_id = new.shop_id and x.id = new.id) then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.payload -> 'payments') = 'array' then oldp := old.payload -> 'payments'; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.payload -> 'items') = 'array' then oldi := old.payload -> 'items'; end if;

  -- SAL-006: a count or a price is never below 0 (0 stays possible: a short pick billed as what went).
  if tg_op = 'INSERT' or new.payload -> 'items' is distinct from old.payload -> 'items' then
    for it in select e from jsonb_array_elements(case when jsonb_typeof(new.payload -> 'items') = 'array' then new.payload -> 'items' else '[]'::jsonb end) e loop
      continue when jsonb_typeof(it) <> 'object';
      if coalesce(ow_num(it ->> 'qty'), 0) < 0 then
        raise exception 'A line can''t have a count below 0 (%).', coalesce(it ->> 'productName', 'a line') using errcode = 'OWQTY';
      end if;
      if coalesce(ow_num(it ->> 'price'), 0) < 0 or coalesce(ow_num(it ->> 'sellPrice'), 0) < 0 then
        raise exception 'A price can''t be below 0 (%).', coalesce(it ->> 'productName', 'a line') using errcode = 'OWQTY';
      end if;
    end loop;
  end if;

  -- 0169 MGR-DATA-09: a line billed at 0 is given away on purpose, with a reason.
  -- Judged as the order is invoiced, and on any line changed on an invoice since.
  if coalesce(new.invoiced, false)
     and (tg_op = 'INSERT' or not coalesce(old.invoiced, false) or new.payload -> 'items' is distinct from old.payload -> 'items') then
    for it in select e from jsonb_array_elements(case when jsonb_typeof(new.payload -> 'items') = 'array' then new.payload -> 'items' else '[]'::jsonb end) e loop
      continue when jsonb_typeof(it) <> 'object';
      continue when not (coalesce(ow_num(it ->> 'qty'), 0) > 0);
      continue when not (it ? 'sellPrice' and ow_num(it ->> 'sellPrice') = 0);
      continue when coalesce(btrim(it -> 'givenAway' ->> 'why'), '') <> '';
      continue when tg_op = 'UPDATE' and coalesce(old.invoiced, false) and oldi @> jsonb_build_array(it);
      raise exception '% is at 0 on the bill: give it away with a reason, or price it.', coalesce(it ->> 'productName', 'A line') using errcode = 'OWGIV';
    end loop;
  end if;

  -- SAL-010 / SAL-012 / SAL-013: the payments, their receipts, and what is paid.
  if tg_op = 'INSERT' or newp is distinct from oldp or new.amount_paid is distinct from old.amount_paid then
    for p in select e from jsonb_array_elements(newp) e loop
      continue when tg_op = 'UPDATE' and oldp @> jsonb_build_array(p);
      -- A refund on a credit note is money out: below 0, its cash row a payment of the same amount.
      if coalesce(p ->> 'refund', '') = 'true' then
        if not (coalesce(ow_num(p ->> 'amount'), 0) < 0) or coalesce(p ->> 'cashTxnId', '') = '' then
          raise exception 'A refund is money given back: below 0, with its cash row.' using errcode = 'OWPAY';
        end if;
        select * into c from cash_txns x where x.shop_id = new.shop_id and x.id::text = p ->> 'cashTxnId';
        if found and (c.type <> 'payment' or round(c.amount) <> -round(ow_num(p ->> 'amount'))) then
          raise exception 'That refund doesn''t match its cash row (#%).', c.id using errcode = 'OWPAY';
        end if;
        continue;
      end if;
      if not (coalesce(ow_num(p ->> 'amount'), 0) > 0) then
        raise exception 'A payment must be more than 0.' using errcode = 'OWPAY';
      end if;
      if coalesce(p ->> 'cashTxnId', '') = '' then
        if not (coalesce(p ->> 'creditFrom', '') <> '' or coalesce(p ->> 'fromDeposit', '') = 'true') then
          raise exception 'A payment needs its receipt.' using errcode = 'OWPAY';
        end if;
      else
        select * into c from cash_txns x where x.shop_id = new.shop_id and x.id::text = p ->> 'cashTxnId';
        if found and (c.type <> 'receipt' or round(c.amount) <> round(ow_num(p ->> 'amount')) or c.quote_id is distinct from new.id) then
          raise exception 'That payment doesn''t match its receipt (#%): % on the order, % on the receipt.',
            c.id, round(ow_num(p ->> 'amount')), round(c.amount) using errcode = 'OWPAY';
        end if;
        -- 0169 MGR-DATA-01: the receipt is in the account the payment says (cash, momo, bank).
        if found and coalesce(btrim(p ->> 'method'), '') <> '' and coalesce(btrim(c.account), '') <> ''
           and lower(btrim(p ->> 'method')) <> lower(btrim(c.account)) then
          raise exception 'That payment says % but its receipt (#%) is in %.', p ->> 'method', c.id, c.account using errcode = 'OWPAY';
        end if;
        -- 0169 MGR-DATA-01: one receipt, one payment.
        if (select count(*) from jsonb_array_elements(newp) e where e ->> 'cashTxnId' = p ->> 'cashTxnId') > 1 then
          raise exception 'Receipt #% is named twice on this order.', p ->> 'cashTxnId' using errcode = 'OWPAY';
        end if;
        select x.id into other from saved_quotes x
         where x.shop_id = new.shop_id and x.id <> new.id
           and (x.payload -> 'payments' @> jsonb_build_array(jsonb_build_object('cashTxnId', p ->> 'cashTxnId'))
                or ((p ->> 'cashTxnId') ~ '^\d+$' and x.payload -> 'payments' @> jsonb_build_array(jsonb_build_object('cashTxnId', (p ->> 'cashTxnId')::numeric))))
         limit 1;
        if other is not null then
          raise exception 'Receipt #% is already a payment on #%.', p ->> 'cashTxnId', lpad(other::text, 4, '0') using errcode = 'OWPAY';
        end if;
      end if;
    end loop;
    if tg_op = 'UPDATE' then
      for p in select e from jsonb_array_elements(oldp) e loop
        continue when coalesce(p ->> 'cashTxnId', '') = '';
        continue when exists (select 1 from jsonb_array_elements(newp) n where n ->> 'cashTxnId' = p ->> 'cashTxnId');
        if exists (select 1 from cash_txns x where x.shop_id = new.shop_id and x.id::text = p ->> 'cashTxnId' and x.quote_id = new.id) then
          raise exception 'A payment can''t be dropped while its receipt still names the order: correct it in Accounts.' using errcode = 'OWPAY';
        end if;
      end loop;
    end if;
    select coalesce(sum(ow_num(e ->> 'amount')), 0) into s from jsonb_array_elements(newp) e;
    if round(coalesce(new.amount_paid, 0)) <> round(s) then
      raise exception 'Paid (%) is not the sum of the payments (%).', round(coalesce(new.amount_paid, 0)), round(s) using errcode = 'OWPAY';
    end if;
  end if;

  -- SAL-004: credit notes never add up to more than the bill.
  if (tg_op = 'INSERT' or new.payload -> 'creditNotes' is distinct from old.payload -> 'creditNotes') and jsonb_typeof(new.payload -> 'creditNotes') = 'array' then
    select coalesce(sum(round(coalesce(ow_num(e ->> 'amount'), 0))), 0) into cn
      from jsonb_array_elements(new.payload -> 'creditNotes') e
     where jsonb_typeof(e) = 'object' and coalesce(e ->> 'voided', 'false') <> 'true';
    tot := ow_order_total(new.shop_id, new.payload - 'creditNotes', false);
    if cn > tot then
      raise exception 'Credit notes (%) can''t be more than the bill (%).', cn, tot using errcode = 'OWCRN';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists saved_quotes_zz_money_check on saved_quotes;
create trigger saved_quotes_zz_money_check before insert or update on saved_quotes
  for each row execute function saved_quotes_money_check();

-- ---------------------------------------------------------------------
-- 3. A void never keeps the money paid on it (MGR-DATA-07).
-- Whether an order may be voided as it stands: nothing paid, the money
-- settled (voidMoney), or a test record. The owner's console (owner, admin)
-- and the server's own runs (no login) are not held.
create or replace function ow_void_money_open(p_shop_id uuid, q saved_quotes) returns boolean
language sql stable security definer set search_path = public as $$
  select round(coalesce(q.amount_paid, 0)) > 0
     and coalesce(q.payload -> 'voidMoney' ->> 'done', '') <> 'true'
     and not coalesce(q.qa, false)
     and auth.uid() is not null and not is_shop_admin(p_shop_id)
$$;
revoke all on function ow_void_money_open(uuid, saved_quotes) from public, anon, authenticated;

create or replace function saved_quotes_void_money() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ow.money_fix', true), '') = 'on' then return new; end if;
  if coalesce(new.voided, false) and not coalesce(old.voided, false) and ow_void_money_open(new.shop_id, new) then
    raise exception '% was paid on this order: refund it or keep it as a deposit as you void it.', round(new.amount_paid) using errcode = 'OWVMN';
  end if;
  return new;
end $$;
drop trigger if exists saved_quotes_zz_void_money on saved_quotes;
create trigger saved_quotes_zz_void_money before update on saved_quotes
  for each row execute function saved_quotes_void_money();

-- 0122's void_sale_bills, refusing an order whose money is not settled (marked 0169).
create or replace function void_sale_bills(p_shop_id uuid, p_quote_id bigint)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  b record;
  v_voided bigint[] := '{}';
  v_kept bigint[] := '{}';
  v_total numeric := 0;
  q saved_quotes%rowtype;
begin
  if not has_task(p_shop_id, 'invoice.void') then
    raise exception 'Voiding a sale''s bills is the Manager''s (invoice.void).' using errcode = '42501';
  end if;
  -- 0169: the money paid on the order is settled first (void_with_money).
  select * into q from saved_quotes where shop_id = p_shop_id and id = p_quote_id;
  if found and ow_void_money_open(p_shop_id, q) then
    raise exception '% was paid on this order: void it with its money (refund or deposit) first.', round(q.amount_paid) using errcode = 'OWVMN';
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
-- 4. The Manager's void with its money, in one transaction.
--   p_choice 'refund'   the money goes back: a cash payment out (category
--                       Refund) from p_account, naming the order;
--            'deposit'  the customer keeps it: their balance goes down by
--                       what was paid (below 0 is a deposit), one debt-log
--                       line on no order ("Deposit — void #0166").
--            null       only when nothing was paid.
-- The order is voided as the caller (0122's guard checks and logs it), its
-- supplier bills through void_sale_bills; the goods coming back stay the
-- app's manager_stock_move, as before.
create or replace function void_with_money(p_shop_id uuid, p_order bigint, p_choice text, p_account text default 'cash')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes%rowtype;
  cu customers%rowtype;
  choice text := nullif(lower(btrim(coalesce(p_choice, ''))), '');
  acct text := coalesce(nullif(lower(btrim(coalesce(p_account, ''))), ''), 'cash');
  amt numeric;
  cid text;
  lbl text;
  hm text := to_char(now() at time zone ow_shop_tz(), 'HH24:MI');
  cash_id bigint;
  floor_id bigint;
  saved jsonb;
  vm jsonb;
  bills jsonb;
  debt0 numeric;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not has_task(p_shop_id, 'invoice.void') then
    raise exception 'Voiding an order is the Manager''s (invoice.void).' using errcode = '42501';
  end if;
  if choice is not null and choice not in ('refund', 'deposit') then
    raise exception 'The money is refunded or kept as a deposit.' using errcode = '22023';
  end if;
  select * into q from saved_quotes where shop_id = p_shop_id and id = p_order for update;
  if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
  if coalesce(q.voided, false) then raise exception 'This order is voided already.' using errcode = '22023'; end if;
  amt := round(coalesce(q.amount_paid, 0));
  lbl := '#' || lpad(q.id::text, 4, '0');
  cid := nullif(q.payload ->> 'customerId', '');
  if amt > 0 and choice is null then
    raise exception '% was paid on %: refund it, or keep it as a deposit.', amt, lbl using errcode = 'OWVMN';
  end if;
  if amt > 0 and choice = 'deposit' then
    select * into cu from customers where shop_id = p_shop_id and id = cid for update;
    if cid is null or not found then raise exception 'Name the customer to keep a deposit.' using errcode = 'OWDEP'; end if;
  end if;
  if amt > 0 and choice = 'refund' then
    cash_id := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (cash_id, p_shop_id, ow_today(), acct, 'payment', 'Refund', amt, 'Refund — void ' || lbl || coalesce(' · ' || nullif(q.client_name, ''), ''), hm, q.id, uid);
  end if;
  vm := jsonb_build_object('done', true, 'choice', case when amt > 0 then choice else 'none' end, 'amount', amt,
                           'account', case when amt > 0 and choice = 'refund' then acct end, 'cashTxnId', cash_id,
                           'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', uid);
  -- The void and what was done with the money, in one write (saved_quotes_zz_void_money reads it).
  update saved_quotes set voided = true, payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('voidMoney', vm)
   where shop_id = p_shop_id and id = q.id;
  if amt > 0 and choice = 'deposit' then
    debt0 := (select debt from customers where shop_id = p_shop_id and id = cid);
    saved := ow_system_begin();
    update customers set debt = coalesce(debt, 0) - amt where shop_id = p_shop_id and id = cid;
    select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = p_shop_id;
    insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id)
         values (ow_next_row_id(p_shop_id, 'row:debt_log', floor_id), p_shop_id, cid, ow_today(), 'payment', amt, 'Deposit — void ' || lbl, null);
    perform ow_system_end(saved);
  end if;
  bills := void_sale_bills(p_shop_id, q.id);
  if amt > 0 then
    perform manager_log_decision(p_shop_id, 'invoice.void',
      'Voided ' || lbl || coalesce(' for ' || nullif(q.client_name, ''), '') || ' with ' || amt || ' paid: '
        || case when choice = 'refund' then 'refunded from ' || acct else 'kept as ' || coalesce(cu.name, cid) || '''s deposit' end,
      amt, jsonb_build_object('table', 'saved_quotes', 'id', q.id),
      jsonb_build_object('voided', false, 'amountPaid', amt, 'debt', debt0),
      jsonb_build_object('voided', true, 'voidMoney', vm, 'debt', (select debt from customers where shop_id = p_shop_id and id = cid)));
  end if;
  return jsonb_build_object('ok', true, 'orderId', q.id, 'choice', vm ->> 'choice', 'amount', amt, 'account', vm ->> 'account',
                            'cashTxnId', cash_id, 'bills', bills,
                            'cashRows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from cash_txns x where x.shop_id = p_shop_id and x.id = cash_id));
end $$;
revoke all on function void_with_money(uuid, bigint, text, text) from public, anon;
grant execute on function void_with_money(uuid, bigint, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. A customer's balance from their books (MGR-DATA-02): the opening
-- balance (debt-log lines that name no order: an old-book balance, a
-- deposit in or used) plus what each live invoice still owes. The rule of
-- round-1-check.sql query 4. Read under the reader's own policies.
create or replace function ow_customer_balance(p_shop_id uuid, p_customer text)
returns numeric
language sql stable security invoker set search_path = public as $$
  select round(
    coalesce((select sum(case when l.type = 'charge' then l.amount else -l.amount end)
                from customer_debt_log l
               where l.shop_id = p_shop_id and l.customer_id = p_customer and l.quote_id is null), 0)
  + coalesce((select sum(greatest(0, round(ow_order_total(q.shop_id, q.payload, false)) - coalesce(q.amount_paid, 0)))
                from saved_quotes q
               where q.shop_id = p_shop_id and q.invoiced and not coalesce(q.voided, false)
                 and q.payload ->> 'customerId' = p_customer), 0))
$$;
revoke all on function ow_customer_balance(uuid, text) from public, anon;
grant execute on function ow_customer_balance(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. One customer, not two (MGR-DATA-13): the Manager merges p_drop into
-- p_keep (customer.merge). Every row that names p_drop by customer_id moves
-- to p_keep (orders by payload.customerId), the balances add, and p_drop
-- is deleted. One transaction; the decision log holds both as they were.
create or replace function merge_customers(p_shop_id uuid, p_keep text, p_drop text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  k customers%rowtype;
  d customers%rowtype;
  r record;
  n int;
  moved jsonb := '{}'::jsonb;
  saved jsonb;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not has_task(p_shop_id, 'customer.merge') then
    raise exception 'Merging customers is the Manager''s (customer.merge).' using errcode = '42501';
  end if;
  if coalesce(p_keep, '') = '' or coalesce(p_drop, '') = '' or p_keep = p_drop then
    raise exception 'Pick two different customers.' using errcode = '22023';
  end if;
  -- Locked in id order, so two merges never wait on each other.
  perform 1 from customers where shop_id = p_shop_id and id in (p_keep, p_drop) order by id for update;
  select * into k from customers where shop_id = p_shop_id and id = p_keep;
  if not found then raise exception 'The customer to keep is no longer in the books.' using errcode = 'P0002'; end if;
  select * into d from customers where shop_id = p_shop_id and id = p_drop;
  if not found then raise exception 'That customer is merged already, or gone.' using errcode = 'P0002'; end if;

  -- Their orders.
  update saved_quotes
     set payload = jsonb_set(payload, '{customerId}', to_jsonb(p_keep)),
         client_name = case when client_name is not distinct from d.name then k.name else client_name end
   where shop_id = p_shop_id and payload ->> 'customerId' = p_drop;
  get diagnostics n = row_count;
  if n > 0 then moved := moved || jsonb_build_object('saved_quotes', n); end if;

  -- Every other table that names a customer (debt log, promises, statements, asks, follow-ups, client accounts...).
  for r in select c.table_name, c.column_name
             from information_schema.columns c
             join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
            where c.table_schema = 'public' and c.column_name in ('customer_id', 'linked_customer_id') and c.table_name <> 'customers'
              and exists (select 1 from information_schema.columns s where s.table_schema = 'public' and s.table_name = c.table_name and s.column_name = 'shop_id')
            order by c.table_name loop
    begin
      execute format('update %I set %I = $1 where shop_id = $2 and %I = $3', r.table_name, r.column_name, r.column_name) using p_keep, p_shop_id, p_drop;
    exception when unique_violation then
      raise exception 'Both customers have their own % (%): sort that one first.', replace(r.table_name, '_', ' '), sqlerrm using errcode = '23505';
    end;
    get diagnostics n = row_count;
    if n > 0 then moved := moved || jsonb_build_object(r.table_name, n); end if;
  end loop;

  -- The balances add (the server's own write: no desk guard raises a debt here).
  saved := ow_system_begin();
  update customers
     set debt = coalesce(debt, 0) + coalesce(d.debt, 0),
         phone = coalesce(nullif(btrim(coalesce(phone, '')), ''), d.phone)
   where shop_id = p_shop_id and id = p_keep;
  delete from customers where shop_id = p_shop_id and id = p_drop;
  perform ow_system_end(saved);

  perform manager_log_decision(p_shop_id, 'customer.merge',
    'Merged ' || coalesce(nullif(d.name, ''), d.id) || ' (' || d.id || ') into ' || coalesce(nullif(k.name, ''), k.id) || ' (' || k.id || ')',
    nullif(round(coalesce(d.debt, 0)), 0), jsonb_build_object('table', 'customers', 'id', p_keep, 'merged', p_drop),
    jsonb_build_object('keep', to_jsonb(k), 'drop', to_jsonb(d)),
    jsonb_build_object('keep', (select to_jsonb(x) from customers x where x.shop_id = p_shop_id and x.id = p_keep), 'moved', moved));
  return jsonb_build_object('ok', true, 'keep', p_keep, 'dropped', p_drop, 'moved', moved,
                            'debt', (select debt from customers where shop_id = p_shop_id and id = p_keep));
end $$;
revoke all on function merge_customers(uuid, text, text) from public, anon;
grant execute on function merge_customers(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. A target ends on its last day (MGR-DATA-14), with its result.
-- 'sales' is measured as the apps measure it (manager.html invoicedBy /
-- nmInvoiceSales): completed, invoiced, not voided, not test, by the
-- invoice's day; goods less the discount less what credit notes took back;
-- one person's when the target names one (body.who). Any other measure is
-- closed with actual null (the apps read it from the books).
create or replace function ow_end_targets(p_shop_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n record;
  v_from date;
  v_to date;
  v_aim numeric;
  v_actual numeric;
  v_reached boolean;
  v_res jsonb;
  ended jsonb := '[]'::jsonb;
begin
  if uid is not null and not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  for n in select * from manager_notes m
            where m.shop_id = p_shop_id and m.kind = 'target' and m.status = 'open'
              and (m.body ->> 'to') ~ '^\d{4}-\d{2}-\d{2}$' and (m.body ->> 'to')::date < ow_today()
            order by m.id for update loop
    v_to := (n.body ->> 'to')::date;
    v_from := case when (n.body ->> 'from') ~ '^\d{4}-\d{2}-\d{2}$' then (n.body ->> 'from')::date else v_to end;
    v_aim := ow_num(n.body ->> 'aim');
    v_actual := null;
    if lower(coalesce(n.body ->> 'metric', '')) = 'sales' then
      select coalesce(sum(
               ow_order_total(q.shop_id, q.payload - 'charges' - 'credit' - 'creditNotes', false)
               - coalesce((select sum(coalesce(ow_num(l ->> 'qty'), 0) * coalesce(ow_num(l ->> 'price'), 0))
                             from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'creditNotes') = 'array' then q.payload -> 'creditNotes' else '[]'::jsonb end) cn,
                                  jsonb_array_elements(case when jsonb_typeof(cn -> 'lines') = 'array' then cn -> 'lines' else '[]'::jsonb end) l
                            where coalesce(cn ->> 'voided', 'false') <> 'true'), 0)), 0)
        into v_actual
        from saved_quotes q
       where q.shop_id = p_shop_id and q.status = 'completed' and q.invoiced and not coalesce(q.voided, false) and not coalesce(q.qa, false)
         and coalesce(q.invoiced_at, q.date) between v_from and v_to
         and (coalesce(n.body ->> 'who', '') = '' or q.payload ->> 'takenBy' = n.body ->> 'who');
      v_actual := round(v_actual);
    end if;
    v_reached := case when v_actual is null or v_aim is null then null else v_actual >= v_aim end;
    v_res := jsonb_build_object('actual', v_actual, 'aim', v_aim, 'reached', v_reached, 'endedOn', ow_today());
    update manager_notes set status = 'ended', body = body || jsonb_build_object('result', v_res) where id = n.id;
    perform ow_log(p_shop_id, uid, case when uid is null then 'The hourly run' end, case when uid is null then 'auto' end, 'goal.set',
      'Target ended ' || to_char(v_to, 'DD Mon') || ': ' || coalesce(n.body ->> 'metric', 'target')
        || case when v_reached is null then '' when v_reached then ' · reached' else ' · missed' end
        || coalesce(' (' || v_actual || ' of ' || v_aim || ')', ''),
      v_actual, jsonb_build_object('table', 'manager_notes', 'id', n.id), jsonb_build_object('status', 'open'), jsonb_build_object('status', 'ended', 'result', v_res));
    ended := ended || jsonb_build_object('id', n.id, 'result', v_res);
  end loop;
  return jsonb_build_object('ok', true, 'ended', ended);
end $$;
revoke all on function ow_end_targets(uuid) from public, anon;
grant execute on function ow_end_targets(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. The hourly run: 0139's, leaving an order under 1,000 to the Manager
-- (MGR-DATA-15), and ending the targets past their day (marked 0169).
create or replace function ow_invoice_due_orders()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  res jsonb;
  done int := 0;
  skipped jsonb := '[]'::jsonb;
  v_code text;
  v_why text;
  v_total numeric;
begin
  for r in
    select q.shop_id, q.id, q.client_name, q.payload
      from saved_quotes q
     where q.status = 'completed' and not q.invoiced and not q.voided
       and coalesce(ow_ts(q.payload ->> 'deliveredAt'),
                    case when ow_num(q.payload ->> 'stageEnteredAt') > 0
                         then to_timestamp(ow_num(q.payload ->> 'stageEnteredAt') / 1000) end)
           <= now() - interval '24 hours'
     order by q.shop_id, q.id
  loop
    begin
      -- 0169: a bill under 1,000 waits for the Manager's second look ("Only 567 · check it").
      v_total := round(ow_order_total(r.shop_id, coalesce(r.payload, '{}'::jsonb), false));
      if v_total < 1000 then
        raise exception 'Only % · the Manager checks it before billing.', v_total using errcode = 'OWSML';
      end if;
      res := ow_invoice_core(r.shop_id, r.id, 'auto', null, 'The 24-hour run');
      perform ow_log(r.shop_id, null, 'The 24-hour run', 'auto', 'invoice.make',
        'Invoiced ' || (res ->> 'invoice') || coalesce(' for ' || nullif(r.client_name, ''), '') || ', 24 hours after delivery',
        (res ->> 'total')::numeric, jsonb_build_object('table', 'saved_quotes', 'id', r.id),
        jsonb_build_object('invoiced', false), jsonb_build_object('invoiced', true, 'debtCharged', res -> 'debtCharged', 'bills', res -> 'bills'));
      done := done + 1;
    exception when others then
      v_code := sqlstate; v_why := sqlerrm;
      skipped := skipped || jsonb_build_array(jsonb_build_object('shop', r.shop_id, 'id', r.id, 'code', v_code, 'why', v_why));
      begin
        perform ow_push(r.shop_id, 'invoice.held', 'Delivered, not invoiced',
          coalesce(nullif(btrim(coalesce(r.client_name, '')), ''), 'An order') || ' — ' || v_why,
          null, case when v_code in ('OWTPC', 'OWPRC', 'OWGIV') then 'price.approve' when v_code = 'OWSHP' then 'pick.settle' else 'invoice.make' end, null,
          jsonb_build_object('table', 'saved_quotes', 'id', r.id, 'code', v_code),
          'invheld:' || r.id || ':' || v_code || ':' || ow_today());
      exception when others then
        raise notice 'push (invoice held %): % (%)', r.id, sqlerrm, sqlstate;
      end;
    end;
  end loop;
  -- 0169: targets past their last day are ended, with their result.
  for r in select distinct m.shop_id from manager_notes m
            where m.kind = 'target' and m.status = 'open' and (m.body ->> 'to') ~ '^\d{4}-\d{2}-\d{2}$' and (m.body ->> 'to')::date < ow_today() loop
    begin
      perform ow_end_targets(r.shop_id);
    exception when others then
      raise notice 'ending targets (%): % (%)', r.shop_id, sqlerrm, sqlstate;
    end;
  end loop;
  return jsonb_build_object('invoiced', done, 'skipped', skipped);
end $$;
revoke all on function ow_invoice_due_orders() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Whole shillings in the cash book (MGR-DATA-10), whoever writes.
create or replace function cash_txns_round_amount() returns trigger
language plpgsql as $$
begin
  if new.amount is not null and new.amount <> round(new.amount) then new.amount := round(new.amount); end if;
  return new;
end $$;
drop trigger if exists cash_txns_round_amount on cash_txns;
create trigger cash_txns_round_amount before insert or update of amount on cash_txns
  for each row execute function cash_txns_round_amount();

-- ---------------------------------------------------------------------
-- 10. Stock and its lots, strict (MGR-DATA-03; Kevin, 25 Oct).
-- At commit, for each key a write touched: the lots add up to the stock
-- (a stock below 0, which no app writes, has no lots), or the transaction
-- is refused. Deferred, so a function that moves the count and then its
-- lots, in either order, is judged once it is done.
create or replace function ow_lots_add_up() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  k text;
  s numeric;
  l numeric;
  i int;
begin
  for i in 1 .. case when tg_op = 'UPDATE' and (old.key is distinct from new.key or old.shop_id is distinct from new.shop_id) then 2 else 1 end loop
    if tg_op = 'DELETE' or i = 2 then sid := old.shop_id; k := old.key; else sid := new.shop_id; k := new.key; end if;
    continue when k is null;
    select qty into s from stock where shop_id = sid and key = k;
    select coalesce(sum(qty), 0) into l from stock_lots where shop_id = sid and key = k;
    if abs(coalesce(l, 0) - greatest(0, coalesce(s, 0))) > 0.0001 then
      raise exception 'The stock of % is % but its lots add up to %: save the stock and its lots together.', k, trim_scale(coalesce(s, 0)), trim_scale(coalesce(l, 0))
        using errcode = 'OWLOT';
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists stock_zz_lots_add_up on stock;
create constraint trigger stock_zz_lots_add_up after insert or update or delete on stock
  deferrable initially deferred for each row execute function ow_lots_add_up();
drop trigger if exists stock_lots_zz_lots_add_up on stock_lots;
create constraint trigger stock_lots_zz_lots_add_up after insert or update or delete on stock_lots
  deferrable initially deferred for each row execute function ow_lots_add_up();

-- The owner console's stock save, in one transaction: for each key in
-- p_keys, its stock row as p_stock has it (no row there: the stock row
-- goes) and exactly the lots p_lots has for it. As the caller, so 0083's
-- owner-only writes still decide. p_stock: [{key, qty, product_id?,
-- variant_idx?}]; p_lots: [{key, qty, cost, consign}].
create or replace function replace_stock_and_lots(p_shop_id uuid, p_keys text[], p_stock jsonb, p_lots jsonb)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  n_stock int;
  n_lots int;
begin
  if not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_keys, 1), 0) = 0 then return jsonb_build_object('ok', true, 'keys', 0); end if;
  delete from stock s
   where s.shop_id = p_shop_id and s.key = any(p_keys)
     and not exists (select 1 from jsonb_to_recordset(coalesce(p_stock, '[]'::jsonb)) as r(key text) where r.key = s.key);
  insert into stock (shop_id, key, product_id, variant_idx, qty)
  select p_shop_id, r.key, r.product_id, r.variant_idx, coalesce(r.qty, 0)
    from jsonb_to_recordset(coalesce(p_stock, '[]'::jsonb)) as r(key text, qty numeric, product_id text, variant_idx text)
   where r.key = any(p_keys)
  on conflict (shop_id, key) do update
     set qty = excluded.qty,
         product_id = coalesce(excluded.product_id, stock.product_id),
         variant_idx = coalesce(excluded.variant_idx, stock.variant_idx);
  get diagnostics n_stock = row_count;
  delete from stock_lots where shop_id = p_shop_id and key = any(p_keys);
  insert into stock_lots (shop_id, key, qty, cost, consign)
  select p_shop_id, r.key, r.qty, r.cost, r.consign
    from jsonb_to_recordset(coalesce(p_lots, '[]'::jsonb)) as r(key text, qty numeric, cost numeric, consign text)
   where r.key = any(p_keys);
  get diagnostics n_lots = row_count;
  -- Judged now as well as at commit, so the refusal comes back on this call.
  set constraints stock_zz_lots_add_up, stock_lots_zz_lots_add_up immediate;
  set constraints stock_zz_lots_add_up, stock_lots_zz_lots_add_up deferred;
  return jsonb_build_object('ok', true, 'keys', array_length(p_keys, 1), 'stock', n_stock, 'lots', n_lots);
end $$;
revoke all on function replace_stock_and_lots(uuid, text[], jsonb, jsonb) from public, anon;
grant execute on function replace_stock_and_lots(uuid, text[], jsonb, jsonb) to authenticated;
