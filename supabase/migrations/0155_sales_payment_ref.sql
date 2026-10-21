-- 0155 Sales, fourth: a mobile money or bank payment carries its transaction ID.
--
-- The QA retest of 21 Oct 2026 (SAL-19): a payment by mobile money or bank
-- had nowhere to put the transaction ID from the customer's SMS or the bank
-- slip, so Accounts could not match a receipt to the statement. Both money
-- writes take it now, as an optional last argument:
--
--   counter_sale(..., p_ref)      the counter sale (0136)
--   receive_payment(..., p_ref)   a customer's payment or an order's (0140)
--
-- It rides on the cash line's description ("Payment — #0556 · ref 3829…"),
-- where Accounts' cash book already shows and searches it, and on the
-- order's payments entry (payments[].ref). Nothing else changes: the bodies
-- are 0136's and 0140's as they stand. Letters, digits and . _ / : - only,
-- at most 40; blank is no reference.
--
-- The old signatures are dropped first so PostgREST never has two functions
-- to choose between. sales.html sends p_ref only when one was typed and, if
-- this has not been run yet, records the payment without it and says so.
--
-- Applied by hand, after 0154. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select pg_get_function_identity_arguments(oid) from pg_proc where proname in ('counter_sale', 'receive_payment');
--   select description from cash_txns where description like '% · ref %' order by id desc limit 5;

drop function if exists counter_sale(uuid, bigint, jsonb, text, numeric);
drop function if exists receive_payment(uuid, text, numeric, text, bigint[], bigint);

create or replace function counter_sale(p_shop_id uuid, p_quote_id bigint, p_row jsonb, p_method text, p_given numeric, p_ref text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes;
  p jsonb;
  items jsonb;
  v_name text;
  v_role text;
  v_task text;
  total numeric;
  pay numeric;
  floor_id bigint;
  cash_id bigint := null;
  pay_id int;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  d date := ow_today();
  hm text := to_char(now() at time zone ow_shop_tz(), 'HH24:MI');
  why text;
  saved jsonb;
  res jsonb;
  short jsonb;
  v_ref text := nullif(left(regexp_replace(btrim(coalesce(p_ref, '')), '[^A-Za-z0-9._/:-]', '', 'g'), 40), '');
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Sign in to this shop first.' using errcode = '42501';
  end if;
  if has_task(p_shop_id, 'counter.sell') then v_task := 'counter.sell';
  elsif has_task(p_shop_id, 'invoice.make') then v_task := 'invoice.make';
  else raise exception 'Selling over the counter is Sales'' (counter.sell).' using errcode = '42501';
  end if;
  if coalesce(p_method, '') not in ('cash', 'momo', 'bank') then
    raise exception 'They pay by cash, MoMo or bank.' using errcode = '22023';
  end if;
  select s.name into v_name from staff s where s.shop_id = p_shop_id and s.user_id = uid limit 1;
  select m.role into v_role from shop_members m where m.shop_id = p_shop_id and m.user_id = uid limit 1;

  -- The sale: placed now from p_row, or the one already waiting.
  if p_quote_id is null then
    if jsonb_typeof(p_row) <> 'object' or jsonb_typeof(p_row -> 'payload') <> 'object' then
      raise exception 'Nothing to sell.' using errcode = '22023';
    end if;
    p := p_row -> 'payload';
    select coalesce(max(id), 0) into floor_id from saved_quotes;  -- ids are one sequence across shops (0001)
    q.id := ow_next_row_id(p_shop_id, 'row:saved_quote', floor_id);
    q.shop_id := p_shop_id;
    q.client_name := coalesce(nullif(btrim(coalesce(p_row ->> 'client_name', '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'Walk-in');
    q.client_phone := nullif(btrim(coalesce(p_row ->> 'client_phone', p -> 'client' ->> 'phone', '')), '');
    q.date := d;
    q.status := 'draft';
    q.invoiced := false; q.voided := false; q.amount_paid := 0;
    p := p || jsonb_build_object('counter', true, 'savedAt', now_iso, 'createdAt', now_iso, 'stageEnteredAt', now_ms,
           'takenBy', uid::text, 'payments', coalesce(case when jsonb_typeof(p -> 'payments') = 'array' then p -> 'payments' end, '[]'::jsonb),
           'debtCharged', 0, 'stageLog', jsonb_build_array(jsonb_build_object('status', 'draft', 'at', now_ms)));
    q.payload := p;
  else
    select * into q from saved_quotes where id = p_quote_id and shop_id = p_shop_id for update;
    if not found then raise exception 'That sale is not in this shop.' using errcode = 'P0002'; end if;
    p := coalesce(q.payload, '{}'::jsonb);
  end if;

  if coalesce(q.voided, false) then raise exception 'That sale was cancelled.' using errcode = 'OWCTR'; end if;
  if coalesce(q.invoiced, false) then raise exception 'That sale is already invoiced.' using errcode = 'OWCTR'; end if;
  if q.status not in ('draft', 'preparing') then raise exception 'That sale has moved on (%).', q.status using errcode = 'OWCTR'; end if;
  if coalesce(p ->> 'counter', '') <> 'true' then raise exception 'Only a counter sale is sold this way.' using errcode = 'OWCTR'; end if;
  items := case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end;
  if jsonb_array_length(items) = 0 then raise exception 'Nothing is on the counter.' using errcode = 'OWCTR'; end if;
  if exists (select 1 from jsonb_array_elements(items) e where coalesce(e ->> 'supplierId', '') <> '__stock__') then
    raise exception 'A counter sale is only for goods on the shelf.' using errcode = 'OWCTR';
  end if;

  -- A price under the shop's price waits for the Manager: the sale is
  -- placed (so the push goes out and the Manager sees it) and nothing is
  -- taken yet.
  why := ow_gate_reason(p_shop_id, p, q.amount_paid);
  if why = 'price' then
    if p_quote_id is null then
      insert into saved_quotes (id, shop_id, client_name, client_phone, date, status, invoiced, invoiced_at, invoiced_ts, amount_paid, voided, payload)
           values (q.id, q.shop_id, q.client_name, q.client_phone, q.date, 'draft', false, null, null, 0, false, q.payload);
    end if;
    return jsonb_build_object('ok', true, 'waiting', 'price', 'id', q.id);
  end if;

  total := round(ow_order_total(p_shop_id, p, false));
  pay := greatest(0, total - coalesce(q.amount_paid, 0));

  -- From here the shop's own hand writes: the gate and the role guards
  -- have been answered above, and a paid counter sale is never a credit
  -- question.
  saved := ow_system_begin();
  if p_quote_id is null then
    insert into saved_quotes (id, shop_id, client_name, client_phone, date, status, invoiced, invoiced_at, invoiced_ts, amount_paid, voided, payload)
         values (q.id, q.shop_id, q.client_name, q.client_phone, q.date, 'draft', false, null, null, 0, false, q.payload);
  end if;
  if pay > 0 then
    select coalesce(max(id), 0) into floor_id from cash_txns;
    cash_id := ow_next_row_id(p_shop_id, 'row:cash_txn', floor_id);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (cash_id, p_shop_id, d, p_method, 'receipt', 'Sales Revenue', pay, 'Counter sale — order #' || lpad(q.id::text, 4, '0') || coalesce(' · ref ' || v_ref, ''), hm, q.id, uid);
    select coalesce(max((e ->> 'id')::int), 0) + 1 into pay_id
      from jsonb_array_elements(case when jsonb_typeof(p -> 'payments') = 'array' then p -> 'payments' else '[]'::jsonb end) e;
    p := p || jsonb_build_object('payments',
           coalesce(case when jsonb_typeof(p -> 'payments') = 'array' then p -> 'payments' end, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('id', pay_id, 'date', d, 'amount', pay, 'note', 'Counter sale', 'cashTxnId', cash_id, 'method', p_method) || case when v_ref is null then '{}'::jsonb else jsonb_build_object('ref', v_ref) end));
  end if;
  p := p || jsonb_build_object('deliveredAt', now_ms, 'stageEnteredAt', now_ms,
         'stageLog', coalesce(case when jsonb_typeof(p -> 'stageLog') = 'array' then p -> 'stageLog' end, '[]'::jsonb)
                     || jsonb_build_array(jsonb_build_object('status', 'completed', 'at', now_ms, 'counter', true)));
  update saved_quotes
     set status = 'completed', amount_paid = coalesce(amount_paid, 0) + pay, payload = p
   where shop_id = p_shop_id and id = q.id;

  res := ow_invoice_core(p_shop_id, q.id, 'counter_sale', uid, nullif(btrim(coalesce(v_name, '')), ''));
  if coalesce((res ->> 'shortOnShelf')::boolean, false) then
    -- The shelf had less than the counter believed: nothing is sold.
    select jsonb_agg(coalesce(e ->> 'productName', e ->> 'productId')) into short
      from jsonb_array_elements(items) e
      left join stock s on s.shop_id = p_shop_id
       and s.key = case when coalesce(e ->> 'variantIdx', '') = '' then e ->> 'productId' else (e ->> 'productId') || '::' || (e ->> 'variantIdx') end
     where coalesce(s.qty, 0) < coalesce((e ->> 'qty')::numeric, 0);
    raise exception 'Not enough on the shelf: %', coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(coalesce(short, '[]'::jsonb)) x), 'a line')
      using errcode = 'OWSHP';
  end if;
  perform ow_system_end(saved);

  perform ow_log(p_shop_id, uid, nullif(btrim(coalesce(v_name, '')), ''), v_role, v_task,
    'Sold over the counter ' || (res ->> 'invoice') || coalesce(' to ' || nullif(q.client_name, ''), '') || ' · ' || ow_money(pay) || ' ' || p_method,
    pay, jsonb_build_object('table', 'saved_quotes', 'id', q.id),
    jsonb_build_object('status', q.status, 'invoiced', false),
    jsonb_build_object('status', 'completed', 'invoiced', true, 'cashTxnId', cash_id, 'method', p_method));

  return jsonb_build_object('ok', true, 'id', q.id, 'invoice', res ->> 'invoice', 'total', total, 'pay', pay,
    'cashTxnId', cash_id, 'change', greatest(0, coalesce(p_given, 0) - pay), 'invoiced', true);
end $$;
revoke all on function counter_sale(uuid, bigint, jsonb, text, numeric, text) from public, anon;
grant execute on function counter_sale(uuid, bigint, jsonb, text, numeric, text) to authenticated;

create or replace function receive_payment(p_shop_id uuid, p_customer_id text, p_amount numeric, p_method text,
                                           p_picks bigint[] default null, p_order_id bigint default null, p_ref text default null)
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
  v_ref text := nullif(left(regexp_replace(btrim(coalesce(p_ref, '')), '[^A-Za-z0-9._/:-]', '', 'g'), 40), '');
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
         values (cash_id, p_shop_id, d, method, 'receipt', 'Invoice Payment', pay_q, 'Payment — order ' || label || coalesce(' · ref ' || v_ref, ''), hm, q.id, uid);
    pays := case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end;
    select coalesce(max(ow_num(p ->> 'id')), 0) + 1 into next_pay_id from jsonb_array_elements(pays) p;
    pays := pays || (jsonb_build_object('date', d, 'amount', pay_q, 'note', '', 'cashTxnId', cash_id, 'method', method, 'id', next_pay_id) || case when v_ref is null then '{}'::jsonb else jsonb_build_object('ref', v_ref) end);
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
         values (cash_id, p_shop_id, d, method, 'receipt', 'Debt Payment', pay_q, 'Payment — ' || label || coalesce(' · ref ' || v_ref, ''), hm, q.id, uid);
    cash_ids := cash_ids || cash_id;
    pays := case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end;
    select coalesce(max(ow_num(p ->> 'id')), 0) + 1 into next_pay_id from jsonb_array_elements(pays) p;
    pays := pays || (jsonb_build_object('date', d, 'amount', pay_q, 'note', '', 'cashTxnId', cash_id, 'method', method, 'id', next_pay_id) || case when v_ref is null then '{}'::jsonb else jsonb_build_object('ref', v_ref) end);
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
         values (cash_id, p_shop_id, d, method, 'receipt', 'Debt Payment', left_amt, 'Payment — ' || coalesce(c.name, c.id) || coalesce(' · ref ' || v_ref, ''), hm, null, uid);
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
revoke all on function receive_payment(uuid, text, numeric, text, bigint[], bigint, text) from public, anon;
grant execute on function receive_payment(uuid, text, numeric, text, bigint[], bigint, text) to authenticated;
