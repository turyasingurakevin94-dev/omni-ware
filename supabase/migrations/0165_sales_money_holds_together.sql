-- 0165 Sales, fifth (audit round 1, data integrity, 23 Oct 2026; docs/audit/sales/ROUND-1.md):
-- an order's money holds together, on the server.
--
-- Cowork's round 1 found, on live: a payment linked to another customer's
-- receipt (SAL-010); customer balances that disagree with their open bills
-- (SAL-011); lines nobody priced billed at their cost (SAL-007); money paid
-- over a bill that went nowhere (SAL-005); an amount paid that is not the
-- sum of its payments (SAL-012); a paid order with no payment list (SAL-013);
-- negative counts and prices accepted (SAL-006); half shillings (SAL-003);
-- credit notes above the bill (SAL-004). This makes each of them impossible
-- from now on, whichever app writes:
--
--   1. ow_order_total     a line nobody priced is never in a total (never
--                         at cost), each line is whole UGX, never below 0.
--   2. saved_quotes_zz_money_check  (before insert/update) refuses: a count
--                         or price below 0; a payment of 0 or less; a new or
--                         changed payment whose receipt has another amount,
--                         another order, or is not a receipt; a payment with
--                         no receipt (except agent credit and a deposit
--                         used); a payment dropped while its receipt still
--                         names the order; amount_paid that is not the sum of
--                         the payments; credit notes above the bill.
--   3. saved_quotes_zz_sync_debt  (before update) keeps an invoice's share
--                         of the customer's balance (debtCharged) equal to
--                         what is still due on it, and moves the balance and
--                         its log with it — whoever changed the invoice.
--   4. cash_txns_zz_payment_check  (before update) a receipt a payment
--                         points to can't change its amount, order or type
--                         on its own.
--   5. receive_payment    takes p_over ('change' | 'deposit'): money over
--                         what is owed is refused without one. Change: only
--                         what is owed is money in. Deposit: all of it is,
--                         and the extra is the customer's deposit (a balance
--                         below 0). Kevin, 23 Oct: "an overpayment should be
--                         confirmed as deposit first, otherwise return change."
--   6. ow_invoice_core    a balance may go below 0 (a deposit); a new
--                         invoice uses the customer's deposit first.
--   7. ow_patch_order     merges only the keys it is given into an order, so
--                         a stale copy never writes over a payment.
--   8. ow_correct_payment Accounts' payment correction in one transaction;
--                         ow_settle_over: an order paid over becomes a
--                         deposit, or change given back.
--   9. payment_asks       'over' (a paid-over order) and 'balance' (a
--                         balance that doesn't add up, no receipt).
--  10. ow_balance_check   one row per customer whose balance is not their
--                         opening balance plus their open bills.
--  11. apply_momo_payment its receipt names the order.
--
-- docs/audit/sales/round-1-correct.sql corrects the old rows this finds; run
-- it right after this. Until then an old row whose payments don't add up
-- can't take a new payment (it is refused, not written wrong).
--
-- Applied by hand, after 0164. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select pg_get_function_identity_arguments(oid) from pg_proc where proname in ('receive_payment', 'ow_patch_order', 'ow_correct_payment');
--   select tgname from pg_trigger where tgname like '%_zz_%';
--   select * from ow_balance_check limit 20;
--
-- ROLLBACK (puts back 0155's receive_payment and 0139's ow_invoice_core by re-running them):
--   drop trigger if exists saved_quotes_zz_money_check on saved_quotes;
--   drop trigger if exists saved_quotes_zz_sync_debt on saved_quotes;
--   drop trigger if exists cash_txns_zz_payment_check on cash_txns;
--   drop function if exists receive_payment(uuid, text, numeric, text, bigint[], bigint, text, text);
--   drop function if exists ow_patch_order(uuid, bigint, jsonb, text, text, text[], text);
--   drop function if exists ow_settle_over(uuid, bigint, text);
--   drop function if exists ow_correct_payment(uuid, bigint, text, numeric, date, text, bigint, boolean, boolean);
--   drop view if exists ow_balance_check;
--   then run 0119's ow_order_total, 0139's ow_invoice_core, 0155 and 0109's apply_momo_payment again.

-- ---------------------------------------------------------------------
-- 1. The total: priced lines only, whole UGX per line, never below 0.
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
  -- p_known_only stays for its callers; 0165 leaves a line nobody priced out of every total.
  for it in select e from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'items') = 'array' then p_payload -> 'items' else '[]'::jsonb end) e loop
    continue when jsonb_typeof(it) <> 'object';
    continue when ow_line_to_confirm(p_shop_id, it, presets);
    goods := goods + round(greatest(0, coalesce(ow_num(it ->> 'qty'), 0)) * coalesce(ow_line_sell_price(p_shop_id, it, presets), 0));
  end loop;
  for ch in select e from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'charges') = 'array' then p_payload -> 'charges' else '[]'::jsonb end) e loop
    continue when jsonb_typeof(ch) <> 'object';
    v := coalesce(ow_num(ch ->> 'value'), 0);
    continue when not (v > 0);
    charges := charges + case when ch ->> 'type' = 'percent' then round(goods * v / 100) else round(v) end;
  end loop;
  gross := goods + charges;
  cash := gross - least(greatest(0, round(coalesce(ow_num(p_payload ->> 'discount'), 0))), gross);
  pct := ow_num(p_payload -> 'credit' ->> 'pct');
  if jsonb_typeof(p_payload -> 'credit') = 'object' and coalesce(pct, 0) > 0 then
    credit := round(cash * pct / 100);
  end if;
  select coalesce(sum(round(coalesce(ow_num(cn ->> 'amount'), 0))), 0) into credited
    from jsonb_array_elements(case when jsonb_typeof(p_payload -> 'creditNotes') = 'array' then p_payload -> 'creditNotes' else '[]'::jsonb end) cn
   where jsonb_typeof(cn) = 'object' and coalesce(cn ->> 'voided', 'false') not in ('true');
  return greatest(0, cash + credit - credited);
end $$;

-- ---------------------------------------------------------------------
-- 2. What an order's money may be.
create or replace function saved_quotes_money_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  newp jsonb := case when jsonb_typeof(new.payload -> 'payments') = 'array' then new.payload -> 'payments' else '[]'::jsonb end;
  oldp jsonb := '[]'::jsonb;
  p jsonb;
  it jsonb;
  c cash_txns%rowtype;
  s numeric;
  cn numeric;
  tot numeric;
begin
  -- The round's correction script (and only it) sets this for its own transaction.
  if coalesce(current_setting('ow.money_fix', true), '') = 'on' then return new; end if;
  -- An upsert of a row that is there already (the owner console saves so) is judged by its update.
  if tg_op = 'INSERT' and exists (select 1 from saved_quotes x where x.shop_id = new.shop_id and x.id = new.id) then return new; end if;
  if tg_op = 'UPDATE' and jsonb_typeof(old.payload -> 'payments') = 'array' then oldp := old.payload -> 'payments'; end if;

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
-- 3. An invoice's share of the balance follows what is still due on it.
create or replace function saved_quotes_sync_debt() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid text := nullif(new.payload ->> 'customerId', '');
  desired numeric;
  cur numeric;
  delta numeric;
  saved jsonb;
  floor_id bigint;
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
         values (ow_next_row_id(new.shop_id, 'row:debt_log', floor_id), new.shop_id, cid, ow_today(),
                 case when delta > 0 then 'charge' else 'payment' end, abs(delta),
                 'Auto-sync — INV-' || case when length(new.id::text) < 4 then lpad(new.id::text, 4, '0') else new.id::text end, new.id);
    new.payload := new.payload || jsonb_build_object('debtCharged', desired);
  end if;
  perform ow_system_end(saved);
  return new;
end $$;
drop trigger if exists saved_quotes_zz_sync_debt on saved_quotes;
create trigger saved_quotes_zz_sync_debt before update on saved_quotes
  for each row execute function saved_quotes_sync_debt();

-- ---------------------------------------------------------------------
-- 4. A receipt a payment points to moves only with its payment.
create or replace function cash_txns_payment_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ow.money_fix', true), '') = 'on' then return new; end if;
  if old.type = 'receipt' and old.quote_id is not null
     and (new.amount is distinct from old.amount or new.quote_id is distinct from old.quote_id or new.type is distinct from old.type)
     and exists (select 1 from saved_quotes q, jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) p
                  where q.shop_id = old.shop_id and q.id = old.quote_id and p ->> 'cashTxnId' = old.id::text) then
    raise exception 'This receipt belongs to a payment on #%: correct the payment, and the receipt moves with it.', old.quote_id using errcode = 'OWPAY';
  end if;
  return new;
end $$;
drop trigger if exists cash_txns_zz_payment_check on cash_txns;
create trigger cash_txns_zz_payment_check before update on cash_txns
  for each row execute function cash_txns_payment_check();

-- ---------------------------------------------------------------------
-- 5. A payment, with what is paid over said: change or deposit.
drop function if exists receive_payment(uuid, text, numeric, text, bigint[], bigint, text);
create or replace function receive_payment(p_shop_id uuid, p_customer_id text, p_amount numeric, p_method text,
                                           p_picks bigint[] default null, p_order_id bigint default null, p_ref text default null,
                                           p_over text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := ow_today();
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
      pays := pays || (jsonb_build_object('date', d, 'amount', pay_q, 'note', '', 'cashTxnId', cash_id, 'method', method, 'id', next_pay_id) || case when v_ref is null then '{}'::jsonb else jsonb_build_object('ref', v_ref) end);
      update saved_quotes set amount_paid = coalesce(amount_paid, 0) + pay_q, payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('payments', pays)
       where shop_id = p_shop_id and id = q.id;
    end if;
    if over_amt > 0 and over_how = 'deposit' then
      select * into c from customers where shop_id = p_shop_id and id = cid for update;
      if not found then raise exception 'Name the customer to keep a deposit.' using errcode = 'OWDEP'; end if;
      cash_ids := cash_ids || ow_deposit_in(p_shop_id, c.id, over_amt, method, 'Deposit — ' || coalesce(c.name, c.id) || ' · order ' || label || coalesce(' · ref ' || v_ref, ''), d, hm, uid);
    end if;
    return jsonb_build_object('kind', 'order', 'orderId', q.id, 'amount', pay_q + case when over_how = 'deposit' then over_amt else 0 end, 'method', method, 'time', hm, 'date', d,
                              'name', coalesce(nullif(q.client_name, ''), 'Walk-in'), 'phone', coalesce(q.client_phone, ''),
                              'id', cid, 'before', due, 'after', due - pay_q,
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
    pays := pays || (jsonb_build_object('date', d, 'amount', pay_q, 'note', '', 'cashTxnId', cash_id, 'method', method, 'id', next_pay_id) || case when v_ref is null then '{}'::jsonb else jsonb_build_object('ref', v_ref) end);
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
  return jsonb_build_object('kind', 'cust', 'id', c.id, 'name', coalesce(c.name, c.id), 'phone', coalesce(nullif(c.phone, ''), c.phone2, ''),
                            'amount', amount - case when over_how = 'change' then over_amt else 0 end, 'method', method, 'time', hm, 'date', d, 'bills', bills,
                            'before', debt0, 'after', debt,
                            'change', case when over_how = 'change' then over_amt else 0 end,
                            'deposit', case when over_how = 'deposit' then over_amt else 0 end,
                            'cashRows', (select coalesce(jsonb_agg(to_jsonb(x) order by x.id), '[]'::jsonb) from cash_txns x where x.id = any(cash_ids)));
end $$;
revoke all on function receive_payment(uuid, text, numeric, text, bigint[], bigint, text, text) from public, anon;
grant execute on function receive_payment(uuid, text, numeric, text, bigint[], bigint, text, text) to authenticated;

-- Money in that is on no bill: an older balance lowered, or a deposit kept.
-- One receipt (no order), the balance lowered (below 0 is a deposit), one log line.
create or replace function ow_deposit_in(p_shop_id uuid, p_customer_id text, p_amount numeric, p_method text, p_text text, p_date date, p_time text, p_by uuid)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  cash_id bigint := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
  floor_id bigint;
begin
  insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
       values (cash_id, p_shop_id, p_date, p_method, 'receipt', 'Debt Payment', p_amount, p_text, p_time, null, p_by);
  update customers set debt = coalesce(debt, 0) - p_amount where shop_id = p_shop_id and id = p_customer_id;
  select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = p_shop_id;
  insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id, cash_txn_id)
       values (ow_next_row_id(p_shop_id, 'row:debt_log', floor_id), p_shop_id, p_customer_id, p_date, 'payment', p_amount,
               case when p_text like 'Deposit — %' then 'Deposit' else '' end, null, cash_id);
  return cash_id;
end $$;
revoke all on function ow_deposit_in(uuid, text, numeric, text, text, date, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Change an order without writing over its money.
-- Merges the keys it is given, drops the keys named in p_drop, and may move
-- the status — never the money keys, which only the payment functions write.
-- Runs as the caller, so every guard, gate and policy on saved_quotes still applies.
drop function if exists ow_patch_order(uuid, bigint, jsonb, text, text);
create or replace function ow_patch_order(p_shop_id uuid, p_id bigint, p_patch jsonb, p_client_name text default null, p_client_phone text default null,
                                          p_drop text[] default null, p_status text default null)
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  bad text;
  q saved_quotes%rowtype;
begin
  select k into bad from (select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) k union all select unnest(coalesce(p_drop, '{}'::text[]))) x
   where k in ('payments', 'debtCharged', 'amountPaid') limit 1;
  if bad is not null then
    raise exception 'An order''s % is not changed this way.', bad using errcode = '22023';
  end if;
  update saved_quotes
     set payload = (coalesce(payload, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)) - coalesce(p_drop, '{}'::text[]),
         status = coalesce(p_status, status),
         client_name = coalesce(p_client_name, client_name),
         client_phone = case when p_client_phone is null then client_phone else nullif(p_client_phone, '') end
   where shop_id = p_shop_id and id = p_id
  returning * into q;
  if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
  return to_jsonb(q);
end $$;
revoke all on function ow_patch_order(uuid, bigint, jsonb, text, text, text[], text) from public, anon;
grant execute on function ow_patch_order(uuid, bigint, jsonb, text, text, text[], text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Accounts corrects a payment: amount, day, method, which bill, or a
-- deposit — the payment, its receipt, what is paid and the balance together.
create or replace function ow_correct_payment(p_shop_id uuid, p_order_id bigint, p_payment_id text,
                                              p_amount numeric default null, p_date date default null, p_account text default null,
                                              p_move_to bigint default null, p_to_deposit boolean default false, p_remove boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes%rowtype;
  t saved_quotes%rowtype;
  pays jsonb;
  p jsonb;
  rest jsonb;
  amt numeric;
  cash_id bigint;
  cid text;
  floor_id bigint;
  next_pay_id integer;
  label text;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'payment.edit')) then
    raise exception 'Correcting a payment needs payment.edit.' using errcode = '42501';
  end if;
  select * into q from saved_quotes where shop_id = p_shop_id and id = p_order_id for update;
  if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
  pays := case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end;
  -- By its id; a payment from before ids were given is found by its receipt.
  select e into p from jsonb_array_elements(pays) e where e ->> 'id' = p_payment_id limit 1;
  if p is null then select e into p from jsonb_array_elements(pays) e where e ->> 'id' is null and e ->> 'cashTxnId' = p_payment_id limit 1; end if;
  if p is null then raise exception 'That payment is not on the order.' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into rest from jsonb_array_elements(pays) e where e is distinct from p;
  amt := round(coalesce(p_amount, ow_num(p ->> 'amount')));
  if not (amt > 0) and not p_remove then raise exception 'A payment must be more than 0.' using errcode = '22023'; end if;
  cash_id := ow_num(p ->> 'cashTxnId')::bigint;
  cid := nullif(q.payload ->> 'customerId', '');
  -- The receipt moves first, inside this transaction only (cash_txns_zz_payment_check lets this one through).
  perform set_config('ow.money_fix', 'on', true);
  if cash_id is not null then
    if p_remove then
      delete from cash_txns where shop_id = p_shop_id and id = cash_id;
    else
      update cash_txns
         set amount = amt, date = coalesce(p_date, date), account = coalesce(nullif(p_account, ''), account),
             quote_id = case when p_to_deposit then null else coalesce(p_move_to, p_order_id) end,
             description = case when p_to_deposit then 'Deposit — ' || coalesce((select name from customers where shop_id = p_shop_id and id = cid), cid, '')
                                when p_move_to is not null then 'Payment — INV-' || lpad(p_move_to::text, 4, '0') else description end
       where shop_id = p_shop_id and id = cash_id;
    end if;
  end if;
  perform set_config('ow.money_fix', '', true);
  if p_remove or p_to_deposit or p_move_to is not null then
    -- Off this order: what is paid comes down, and the sync trigger raises the balance by the same.
    update saved_quotes set amount_paid = coalesce(amount_paid, 0) - round(ow_num(p ->> 'amount')),
           payload = payload || jsonb_build_object('payments', rest)
     where shop_id = p_shop_id and id = q.id;
  else
    update saved_quotes set amount_paid = coalesce(amount_paid, 0) - round(ow_num(p ->> 'amount')) + amt,
           payload = payload || jsonb_build_object('payments', (
             select jsonb_agg(case when e = p
                                   then e || jsonb_build_object('amount', amt, 'date', coalesce(p_date::text, e ->> 'date'), 'method', coalesce(nullif(p_account, ''), e ->> 'method'))
                                   else e end) from jsonb_array_elements(pays) e))
     where shop_id = p_shop_id and id = q.id;
  end if;
  if p_move_to is not null and not p_remove then
    select * into t from saved_quotes where shop_id = p_shop_id and id = p_move_to for update;
    if not found or coalesce(t.voided, false) then raise exception 'That bill is not open.' using errcode = 'P0002'; end if;
    pays := case when jsonb_typeof(t.payload -> 'payments') = 'array' then t.payload -> 'payments' else '[]'::jsonb end;
    select coalesce(max(ow_num(e ->> 'id')), 0) + 1 into next_pay_id from jsonb_array_elements(pays) e;
    update saved_quotes set amount_paid = coalesce(amount_paid, 0) + amt,
           payload = payload || jsonb_build_object('payments', pays || (p || jsonb_build_object('id', next_pay_id, 'amount', amt, 'date', coalesce(p_date::text, p ->> 'date'))))
     where shop_id = p_shop_id and id = t.id;
  end if;
  if p_to_deposit and not p_remove then
    if cid is null then raise exception 'Name the customer to keep a deposit.' using errcode = 'OWDEP'; end if;
    update customers set debt = coalesce(debt, 0) - amt where shop_id = p_shop_id and id = cid;
    select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = p_shop_id;
    insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id, cash_txn_id)
         values (ow_next_row_id(p_shop_id, 'row:debt_log', floor_id), p_shop_id, cid, coalesce(p_date, ow_today()), 'payment', amt, 'Deposit', null, cash_id);
  end if;
  label := 'INV-' || lpad(q.id::text, 4, '0');
  perform ow_log(p_shop_id, uid, null, null, 'payment.edit',
    'Corrected a payment on ' || label || case when p_remove then ': taken off' when p_to_deposit then ': now a deposit'
                                               when p_move_to is not null then ': moved to INV-' || lpad(p_move_to::text, 4, '0') else '' end,
    amt, jsonb_build_object('table', 'saved_quotes', 'id', q.id), p, jsonb_build_object('amount', amt, 'moveTo', p_move_to, 'deposit', p_to_deposit, 'removed', p_remove));
  return jsonb_build_object('ok', true, 'orderId', q.id, 'amount', amt);
end $$;
revoke all on function ow_correct_payment(uuid, bigint, text, numeric, date, text, bigint, boolean, boolean) from public, anon;
grant execute on function ow_correct_payment(uuid, bigint, text, numeric, date, text, bigint, boolean, boolean) to authenticated;

-- 8b. Esther settles an order paid over (Kevin, 23 Oct: a deposit if the
-- customer confirms it, otherwise change). The receipt that took the money is
-- split: the bill's part stays on the order; the rest is the customer's
-- deposit, or change given back (a payment out, today).
create or replace function ow_settle_over(p_shop_id uuid, p_order_id bigint, p_how text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes%rowtype;
  total numeric;
  over_amt numeric;
  p jsonb;
  cash_id bigint;
  c cash_txns%rowtype;
  cid text;
  cname text;
  label text;
  out_id bigint;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'payment.edit')) then
    raise exception 'Settling a payment needs payment.edit.' using errcode = '42501';
  end if;
  if p_how not in ('deposit', 'change') then raise exception 'Settle it as a deposit or as change.' using errcode = '22023'; end if;
  select * into q from saved_quotes where shop_id = p_shop_id and id = p_order_id for update;
  if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
  total := round(ow_order_total(p_shop_id, q.payload, false));
  over_amt := round(coalesce(q.amount_paid, 0)) - total;
  if not (over_amt > 0) then raise exception 'Nothing is paid over on this order.' using errcode = '22023'; end if;
  select e into p from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) e
   where coalesce(e ->> 'cashTxnId', '') <> '' and ow_num(e ->> 'amount') >= over_amt
   order by ow_num(e ->> 'id') desc nulls last limit 1;
  if p is null then raise exception 'No one payment on this order is big enough to take the %: correct the payments first.', over_amt using errcode = '22023'; end if;
  cash_id := ow_num(p ->> 'cashTxnId')::bigint;
  select * into c from cash_txns where shop_id = p_shop_id and id = cash_id;
  if not found then raise exception 'That payment''s receipt is missing: correct it first.' using errcode = 'P0002'; end if;
  cid := nullif(q.payload ->> 'customerId', '');
  if p_how = 'deposit' and cid is null then raise exception 'Name the customer to keep a deposit.' using errcode = 'OWDEP'; end if;
  label := '#' || lpad(q.id::text, 4, '0');
  select name into cname from customers where shop_id = p_shop_id and id = cid;
  perform set_config('ow.money_fix', 'on', true);
  update cash_txns set amount = amount - over_amt where shop_id = p_shop_id and id = cash_id;
  update saved_quotes set amount_paid = coalesce(amount_paid, 0) - over_amt,
         payload = payload || jsonb_build_object('payments', (
           select jsonb_agg(case when e ->> 'cashTxnId' = cash_id::text then e || jsonb_build_object('amount', ow_num(e ->> 'amount') - over_amt) else e end)
             from jsonb_array_elements(q.payload -> 'payments') e))
   where shop_id = p_shop_id and id = q.id;
  perform set_config('ow.money_fix', '', true);
  if p_how = 'deposit' then
    out_id := ow_deposit_in(p_shop_id, cid, over_amt, c.account, 'Deposit — ' || coalesce(cname, cid) || ' · paid over on ' || label, c.date, c.time, uid);
  else
    out_id := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (out_id, p_shop_id, c.date, c.account, 'receipt', 'Customer Payment', over_amt, 'Paid over on ' || label || ' · given back', c.time, null, uid);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (ow_next_row_id(p_shop_id, 'row:cash_txn', 0), p_shop_id, ow_today(), c.account, 'payment', 'Change given back', over_amt,
                 'Change given back · paid over on ' || label, to_char(now() at time zone ow_shop_tz(), 'HH24:MI'), null, uid);
  end if;
  perform ow_log(p_shop_id, uid, null, null, 'payment.edit',
    'Settled ' || over_amt || ' paid over on ' || label || case when p_how = 'deposit' then ' as a deposit' else ' as change given back' end,
    over_amt, jsonb_build_object('table', 'saved_quotes', 'id', q.id), jsonb_build_object('amountPaid', q.amount_paid), jsonb_build_object('how', p_how));
  return jsonb_build_object('ok', true, 'orderId', q.id, 'over', over_amt, 'how', p_how);
end $$;
revoke all on function ow_settle_over(uuid, bigint, text) from public, anon;
grant execute on function ow_settle_over(uuid, bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Two more asks: a paid-over order, and a balance that doesn't add up.
alter table payment_asks alter column cash_txn_id drop not null;
alter table payment_asks drop constraint if exists payment_asks_what_check;
alter table payment_asks add constraint payment_asks_what_check check (what in ('method', 'amount', 'bill', 'day', 'over', 'balance'));
alter table payment_asks drop constraint if exists payment_asks_receipt_check;
alter table payment_asks add constraint payment_asks_receipt_check check (cash_txn_id is not null or what = 'balance');

-- ---------------------------------------------------------------------
-- 10. Whose balance doesn't add up (read under the reader's own policies).
create or replace view ow_balance_check with (security_invoker = true) as
with inv as (
  select q.shop_id, q.payload ->> 'customerId' as cid,
         sum(greatest(0, round(ow_order_total(q.shop_id, q.payload, false)) - coalesce(q.amount_paid, 0))) as due
    from saved_quotes q
   where q.invoiced and not coalesce(q.voided, false) and coalesce(q.payload ->> 'customerId', '') <> ''
   group by 1, 2
), opening as (
  select l.shop_id, l.customer_id as cid, sum(case when l.type = 'charge' then l.amount else -l.amount end) as amt
    from customer_debt_log l
   where l.quote_id is null
   group by 1, 2
)
select c.shop_id, c.id as customer_id, c.name, coalesce(c.debt, 0) as balance, coalesce(o.amt, 0) as opening, coalesce(i.due, 0) as open_bills,
       coalesce(c.debt, 0) - (coalesce(o.amt, 0) + coalesce(i.due, 0)) as gap
  from customers c
  left join inv i on i.shop_id = c.shop_id and i.cid = c.id
  left join opening o on o.shop_id = c.shop_id and o.cid = c.id
 where round(coalesce(c.debt, 0)) <> round(coalesce(o.amt, 0) + coalesce(i.due, 0));
grant select on ow_balance_check to authenticated;

-- ---------------------------------------------------------------------
-- 6. Invoicing: a balance may be a deposit (below 0); the deposit is used first.
-- 0139's ow_invoice_core, changed only where the balance moves (marked 0165).
do $mig$
declare
  src text := pg_get_functiondef('ow_invoice_core(uuid, bigint, text, uuid, text)'::regprocedure);
  a text := $a$    if c.id is not null then
      v_before := coalesce(c.debt, 0);
      v_after := greatest(0, v_before + delta);
      applied := v_after - v_before;$a$;
  b text := $b$    if c.id is not null then
      v_before := coalesce(c.debt, 0);
      -- 0165: a deposit (a balance below 0) pays the new invoice first.
      if v_before < 0 and desired > 0 then
        dep_use := least(desired, -v_before);
        pay := pay || jsonb_build_object('payments',
          case when jsonb_typeof(pay -> 'payments') = 'array' then pay -> 'payments' else '[]'::jsonb end
          || jsonb_build_array(jsonb_build_object('id', coalesce((select max(ow_num(e ->> 'id')) from jsonb_array_elements(case when jsonb_typeof(pay -> 'payments') = 'array' then pay -> 'payments' else '[]'::jsonb end) e), 0) + 1,
                                                  'date', ow_today(), 'amount', dep_use, 'note', 'From deposit', 'method', 'deposit', 'fromDeposit', true)));
        desired := desired - dep_use;
        delta := delta - dep_use;
        -- The deposit is spent: the balance rises by it, logged on no bill, so the bill's own lines equal what is due on it.
        update customers set debt = coalesce(debt, 0) + dep_use where shop_id = p_shop_id and id = c.id;
        select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = p_shop_id;
        insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id)
             values (ow_next_row_id(p_shop_id, 'row:debt_log', floor_id), p_shop_id, c.id, ow_today(), 'charge', dep_use, 'Deposit used — ' || inv_label, null);
        v_before := v_before + dep_use;
      end if;
      -- 0165: no clamp at 0: below 0 is the customer's deposit.
      v_after := v_before + delta;
      applied := v_after - v_before;$b$;
begin
  if position('dep_use' in src) > 0 then return; end if;   -- already 0165's
  if position(a in src) = 0 then raise exception '0165: ow_invoice_core is not the shape 0139 left; not changed.'; end if;
  src := replace(src, a, b);
  src := replace(src, '  applied numeric;' || chr(10), '  applied numeric;' || chr(10) || '  dep_use numeric := 0;' || chr(10));
  -- What the deposit paid goes in with the invoice itself, so paid and its payments move together.
  if position('set invoiced = true, invoiced_at = inv_at, invoiced_ts = inv_ts, payload = pay' in src) = 0 then
    raise exception '0165: ow_invoice_core''s invoice write is not the shape 0139 left; not changed.';
  end if;
  src := replace(src, 'set invoiced = true, invoiced_at = inv_at, invoiced_ts = inv_ts, payload = pay',
                      'set invoiced = true, invoiced_at = inv_at, invoiced_ts = inv_ts, payload = pay, amount_paid = coalesce(amount_paid, 0) + dep_use');
  execute src;
end $mig$;

-- ---------------------------------------------------------------------
-- 11. An agent's mobile money: the receipt names the order.
do $mig$
declare
  src text := pg_get_functiondef('public.apply_momo_payment(bigint)'::regprocedure);
begin
  if position('quote_id' in src) > 0 then return; end if;
  src := replace(src, 'insert into cash_txns(shop_id, date, account, type, category, amount, description, time)',
                      'insert into cash_txns(shop_id, date, account, type, category, amount, description, time, quote_id)');
  src := replace(src, 'to_char(t at time zone ''utc'', ''HH24:MI:SS''))',
                      'to_char(t at time zone ''utc'', ''HH24:MI:SS''), pay.order_id)');
  if position('pay.order_id)' in src) = 0 then raise exception '0165: apply_momo_payment is not the shape 0109 left; not changed.'; end if;
  execute src;
end $mig$;
