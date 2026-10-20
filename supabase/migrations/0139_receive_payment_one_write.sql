-- 0139: a customer's payment is one database write.
--
-- sales.html, manager.html and accounts.html each carried the same payment,
-- line for line: re-read the debt, spread the money over the open invoices
-- (oldest first, or the ones ticked), and then three to five writes with no
-- transaction around them -- a receipt per invoice, the invoice's payments
-- and amount_paid, its share of the debt, the debt itself, a debt-log line,
-- a receipt and a line for anything left on account. A lost signal, or a
-- refused write (0138 item 6 was one), between any two of those left the
-- money in the cash book and the debt standing, with "Stopped part-way …
-- Tell Accounts" to show for it. The counter sale (0136) and the trip's cash
-- (0138) are one write each; the most-used money action was not.
--
-- receive_payment(p_shop_id, p_customer_id, p_amount, p_method, p_picks,
-- p_order_id) does the whole thing in one transaction and returns what the
-- Paid screen shows. Two shapes:
--
--   a customer's payment  p_customer_id, p_amount, p_method, p_picks (the
--                         invoice ids ticked, in the order ticked, or null
--                         for oldest first): a 'Debt Payment' receipt per
--                         invoice paid, the invoice's payments and
--                         amount_paid, its debtCharged brought to its
--                         balance (syncInvoiceDebtCharge), the customer's
--                         debt lowered and logged ('Auto-sync — INV-…'),
--                         the rest as a receipt on account with its own log
--                         line.
--   an order before its   p_order_id, p_amount, p_method: one 'Invoice
--   invoice               Payment' receipt on the order and a line in its
--                         payments; no debt is touched (the invoice raises
--                         what is still due).
--
-- Both re-read and lock the rows they change, so two phones cannot spread
-- one payment over stale balances. payment.receive (Sales, Manager,
-- Accounts) is the task, as in docs/decision-rights.md. The guards of 0123
-- still run under the login: a desk login lowers a debt and never raises
-- one; an Accounts login touches payments, debtCharged and customerId.
--
-- Safe to re-run.

create or replace function receive_payment(p_shop_id uuid, p_customer_id text, p_amount numeric, p_method text,
                                           p_picks bigint[] default null, p_order_id bigint default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := ow_today();
  hm text := to_char(now() at time zone ow_shop_tz(), 'HH24:MI');
  method text := coalesce(nullif(btrim(p_method), ''), 'cash');
  amount numeric := round(coalesce(p_amount, 0));
  c customers%rowtype;
  q saved_quotes%rowtype;
  pay_q numeric;
  total numeric;
  due numeric;
  left_amt numeric;
  debt numeric;
  debt0 numeric;
  v_after numeric;
  applied numeric;
  desired numeric;
  current_charged numeric;
  cash_id bigint;
  log_id bigint;
  pays jsonb;
  next_pay_id integer;
  label text;
  bills jsonb := '[]'::jsonb;
  cash_ids bigint[] := '{}';
  open_ids bigint[];
  ordered_ids bigint[];
  i integer;
  one_name boolean;
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

  /* ---------------- an order before its invoice ---------------- */
  if p_order_id is not null then
    select * into q from saved_quotes where shop_id = p_shop_id and id = p_order_id for update;
    if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
    if coalesce(q.voided, false) then raise exception 'The order was cancelled.' using errcode = '22023'; end if;
    if q.invoiced then raise exception 'This order has just been invoiced — take it from the customer''s bills.' using errcode = '22023'; end if;
    total := round(ow_order_total(p_shop_id, coalesce(q.payload, '{}'::jsonb), true));
    due := greatest(0, total - coalesce(q.amount_paid, 0));
    pay_q := least(amount, due);
    if not (pay_q > 0) then raise exception 'Nothing is left to pay on this order.' using errcode = '22023'; end if;
    label := '#' || case when length(q.id::text) < 4 then lpad(q.id::text, 4, '0') else q.id::text end;
    cash_id := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (cash_id, p_shop_id, d, method, 'receipt', 'Invoice Payment', pay_q, 'Payment — order ' || label, hm, q.id, uid);
    pays := case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end;
    select coalesce(max(ow_num(p ->> 'id')), 0) + 1 into next_pay_id from jsonb_array_elements(pays) p;
    pays := pays || jsonb_build_object('date', d, 'amount', pay_q, 'note', '', 'cashTxnId', cash_id, 'method', method, 'id', next_pay_id);
    update saved_quotes set amount_paid = coalesce(amount_paid, 0) + pay_q, payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('payments', pays)
     where shop_id = p_shop_id and id = q.id;
    return jsonb_build_object('kind', 'order', 'orderId', q.id, 'amount', pay_q, 'method', method, 'time', hm, 'date', d,
                              'name', coalesce(nullif(q.client_name, ''), 'Walk-in'), 'phone', coalesce(q.client_phone, ''),
                              'id', nullif(q.payload ->> 'customerId', ''),
                              'before', due, 'after', due - pay_q,
                              'bills', jsonb_build_array(jsonb_build_object('quoteId', q.id, 'label', 'Order ' || label, 'pay', pay_q, 'cleared', pay_q >= due, 'left', due - pay_q, 'total', total)),
                              'cashRows', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from cash_txns x where x.id = cash_id));
  end if;

  /* ---------------- a customer's payment ---------------- */
  if coalesce(p_customer_id, '') = '' then
    raise exception 'Whose payment is it? Pick the customer.' using errcode = '22023';
  end if;
  select * into c from customers where shop_id = p_shop_id and id = p_customer_id for update;
  if not found then raise exception 'That customer is no longer in the books.' using errcode = 'P0002'; end if;
  debt := coalesce(c.debt, 0); debt0 := debt;
  -- Their open invoices, oldest first: linked to them, or carrying only their
  -- name when that name is theirs alone (customerOrdersFor).
  select count(*) = 1 into one_name from customers x where x.shop_id = p_shop_id and lower(btrim(coalesce(x.name, ''))) = lower(btrim(coalesce(c.name, '')));
  select coalesce(array_agg(s.id order by coalesce(s.invoiced_ts, (coalesce(s.invoiced_at, s.date) + time '00:00') at time zone ow_shop_tz()), s.id), '{}')
    into open_ids
    from saved_quotes s
   where s.shop_id = p_shop_id and s.invoiced and not coalesce(s.voided, false)
     and (s.payload ->> 'customerId' = c.id
          or (coalesce(s.payload ->> 'customerId', '') = '' and one_name and lower(btrim(coalesce(s.client_name, ''))) = lower(btrim(coalesce(c.name, '')))))
     and round(ow_order_total(p_shop_id, coalesce(s.payload, '{}'::jsonb), false)) - coalesce(s.amount_paid, 0) > 0;
  -- The ticked invoices first, in the order ticked; the rest only when none were ticked.
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
         values (cash_id, p_shop_id, d, method, 'receipt', 'Debt Payment', pay_q, 'Payment — ' || label, hm, q.id, uid);
    cash_ids := cash_ids || cash_id;
    pays := case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end;
    select coalesce(max(ow_num(p ->> 'id')), 0) + 1 into next_pay_id from jsonb_array_elements(pays) p;
    pays := pays || jsonb_build_object('date', d, 'amount', pay_q, 'note', '', 'cashTxnId', cash_id, 'method', method, 'id', next_pay_id);
    -- syncInvoiceDebtCharge: the invoice's share of the debt follows its balance down.
    desired := greatest(0, total - (coalesce(q.amount_paid, 0) + pay_q));
    current_charged := coalesce(ow_num(q.payload ->> 'debtCharged'), 0);
    v_after := greatest(0, debt + (desired - current_charged));
    applied := v_after - debt;
    update saved_quotes
       set amount_paid = coalesce(amount_paid, 0) + pay_q,
           payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('payments', pays, 'debtCharged', case when applied > 0 then current_charged else desired end, 'customerId', c.id)
     where shop_id = p_shop_id and id = q.id;
    if applied < 0 then
      log_id := ow_next_row_id(p_shop_id, 'row:debt_log', 0);
      insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id, cash_txn_id)
           values (log_id, p_shop_id, c.id, d, 'payment', -applied, 'Auto-sync — ' || label, q.id, null);
      update customers set debt = v_after where shop_id = p_shop_id and id = c.id;
      debt := v_after;
    end if;
    bills := bills || jsonb_build_object('quoteId', q.id, 'label', label, 'pay', pay_q, 'cleared', pay_q >= due, 'left', greatest(0, due - pay_q), 'total', total);
    left_amt := left_amt - pay_q;
  end loop;
  -- What is left goes on account.
  if left_amt > 0 then
    v_after := greatest(0, debt - left_amt);
    cash_id := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (cash_id, p_shop_id, d, method, 'receipt', 'Debt Payment', left_amt, 'Payment — ' || coalesce(c.name, c.id), hm, null, uid);
    cash_ids := cash_ids || cash_id;
    if v_after <> debt then
      update customers set debt = v_after where shop_id = p_shop_id and id = c.id;
      log_id := ow_next_row_id(p_shop_id, 'row:debt_log', 0);
      insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id, cash_txn_id)
           values (log_id, p_shop_id, c.id, d, 'payment', debt - v_after, '', null, cash_id);
      debt := v_after;
    end if;
    bills := bills || jsonb_build_object('label', 'On account', 'pay', left_amt, 'cleared', v_after = 0, 'left', v_after, 'onAccount', true);
  end if;
  return jsonb_build_object('kind', 'cust', 'id', c.id, 'name', coalesce(c.name, c.id), 'phone', coalesce(nullif(c.phone, ''), c.phone2, ''),
                            'amount', amount, 'method', method, 'time', hm, 'date', d, 'bills', bills, 'before', debt0, 'after', debt,
                            'cashRows', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from cash_txns x where x.id = any(cash_ids)));
end $$;
grant execute on function receive_payment(uuid, text, numeric, text, bigint[], bigint) to authenticated;
