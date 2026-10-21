-- 0154: Accounts and the Buyer's money (the cross-app test of 21 Oct 2026).
--
-- The test found three gaps where the Buyer hands over to Accounts:
--   1. A round the Buyer paid from their own pocket still showed in Accounts
--      as cash that "should come back".
--   2. Nothing in Accounts paid the Buyer back: the Buyer's app said Accounts
--      owed them 465,000 and Accounts listed none of it.
--   3. A 150,000 handover that no round used was accounted for nowhere.
-- The Buyer's 0151 puts what was only on the Buyer's phone into the shop's
-- data: each stop's `pay` on collection_trips ({ own, amount, receipt:
-- 'photo'|'none', photoPath?, at }), and an 'own_money' hand-off for
-- Accounts at the hand-in of a round paid on the Buyer's money (payload
-- { buyer, amount, round, stops: [{ tripId, supplier, amount, receipt }] }).
-- A trip_cash hand-off from 0151 on carries payload.v = 2, and payload.round
-- once a round starts on that cash.
--
-- This migration is Accounts' side, both under trip.cash (docs/decision-rights.md):
--   buyer_payback  -- pay the Buyer back for an own-money round, in one write:
--                     a 'Stock Purchase' payment per stop from the account
--                     picked, the orders' bills marked paid by the trip, the
--                     stops marked paid back (cash_count), the hand-off closed,
--                     the owner's log line. Each stop is paid once.
--   buyer_cash_back -- take back cash handed over that no round used: the
--                     difference booked like a close difference, the hand-off
--                     marked counted back (cash_back), the owner's log line.
-- The handover itself wrote no cash line (accounts.html ACT.hocash closes the
-- hand-off only), so cash that comes back whole books nothing.
--
-- Safe to run twice. Undo:
--   (0138's purchase_invoices_born_paid is redefined in section 4: re-run its definition from 0138 to undo that.)
--   drop function if exists buyer_payback(uuid, uuid, text);
--   drop function if exists buyer_cash_back(uuid, uuid, numeric);
--   drop trigger if exists buyer_handoffs_cash_back_guard on buyer_handoffs;
--   drop function if exists buyer_handoffs_cash_back_guard();
--   alter table buyer_handoffs drop column if exists cash_back;

/* ---------------- 1. a handover counted back is marked on it ---------------- */
alter table buyer_handoffs add column if not exists cash_back jsonb;

-- Only buyer_cash_back writes it (0125's guard keeps the rest of the row as it was),
-- and once it is written no round can claim that cash.
create or replace function buyer_handoffs_cash_back_guard() returns trigger
language plpgsql as $$
begin
  if new.cash_back is distinct from old.cash_back and coalesce(current_setting('ow.cash_back', true), '') <> '1' then
    raise exception 'A handover is counted back from Accounts'' trip cash only.' using errcode = '42501';
  end if;
  -- Cash counted back is back in the drawer: no round can claim it after (0151 sets payload.round once).
  if old.cash_back is not null and (new.payload ->> 'round') is distinct from (old.payload ->> 'round') then
    raise exception 'This cash was counted back; no round can use it now.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists buyer_handoffs_cash_back_guard on buyer_handoffs;
create trigger buyer_handoffs_cash_back_guard before update on buyer_handoffs
  for each row execute function buyer_handoffs_cash_back_guard();

/* ---------------- 2. pay the Buyer back ---------------- */
create or replace function buyer_payback(p_shop_id uuid, p_handoff_id uuid, p_account text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := ow_today();
  hm text := to_char(now() at time zone ow_shop_tz(), 'HH24:MI');
  h buyer_handoffs%rowtype;
  t collection_trips%rowtype;
  ids text[];
  pay jsonb;
  amt numeric;
  total numeric := 0;
  buyer_name text;
  sup_name text;
  floor_id bigint;
  line_id bigint;
  lines jsonb := '[]'::jsonb;
  b record;
  bill_paid numeric;
  pays jsonb;
  bills jsonb := '[]'::jsonb;
  n integer := 0;
begin
  if uid is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'trip.cash')) then
    raise exception 'Paying the Buyer back needs trip.cash.' using errcode = '42501';
  end if;
  if p_account is null or p_account not in ('cash', 'momo', 'bank') then
    raise exception 'Pay from cash, mobile money or the bank.' using errcode = '22023';
  end if;
  select * into h from buyer_handoffs where id = p_handoff_id and shop_id = p_shop_id for update;
  if not found or h.kind <> 'own_money' or h.for_role <> 'accounts' then
    raise exception 'No such own-money hand-in.' using errcode = 'P0002';
  end if;
  if h.status <> 'open' then
    raise exception 'This hand-in is paid back already.' using errcode = '22023';
  end if;

  -- The stops: those the hand-off names, else the round's own-money stops.
  select array_agg(x ->> 'tripId') into ids from jsonb_array_elements(coalesce(h.payload -> 'stops', '[]'::jsonb)) x where x ->> 'tripId' is not null;
  if ids is null and h.payload ->> 'round' is not null then
    select array_agg(ct.id) into ids from collection_trips ct
     where ct.shop_id = p_shop_id and ow_trip_round(ct.id) = h.payload ->> 'round' and (to_jsonb(ct) -> 'pay' ->> 'own') = 'true';
  end if;
  if ids is null then
    raise exception 'The hand-in names no stop.' using errcode = '22023';
  end if;

  buyer_name := nullif(h.payload ->> 'buyer', '');
  if buyer_name is null then
    select s.name into buyer_name from staff s where s.shop_id = p_shop_id and s.user_id = h.created_by limit 1;
  end if;
  buyer_name := coalesce(buyer_name, 'the buyer');

  for t in select * from collection_trips where shop_id = p_shop_id and id = any(ids) order by collected_at, id for update loop
    pay := to_jsonb(t) -> 'pay';
    if coalesce(t.voided, false) then continue; end if;
    if pay is null or (pay ->> 'own') is distinct from 'true' then
      raise exception 'Trip % was not paid on the Buyer''s own money.', t.id using errcode = '22023';
    end if;
    if t.cash_count is not null then
      raise exception 'Trip % is paid back or counted already.', t.id using errcode = '22023';
    end if;
    -- What was paid at the stop: the Buyer's figure from the receipt, else the lines.
    amt := ow_num(pay ->> 'amount');
    if amt is null or amt <= 0 then
      select coalesce(sum(ow_trip_line_paid(l)), 0) into amt from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) l;
    end if;
    amt := round(amt);
    n := n + 1;
    line_id := null;
    if amt > 0 then
      select coalesce(s.name, t.supplier_id) into sup_name from suppliers s where s.shop_id = p_shop_id and s.id = t.supplier_id;
      select coalesce(max(id), 0) into floor_id from cash_txns;
      line_id := ow_next_row_id(p_shop_id, 'row:cash_txn', floor_id);
      insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, entered_by)
           values (line_id, p_shop_id, d, p_account, 'payment', 'Stock Purchase', amt,
                   'Paid back to ' || buyer_name || ' for ' || coalesce(sup_name, 'the supplier') || ' (own money, trip ' || t.id || ')', hm, uid);
      total := total + amt;
      lines := lines || jsonb_build_object('tripId', t.id, 'cashTxnId', line_id, 'amount', amt, 'supplierId', t.supplier_id, 'receipt', pay ->> 'receipt');
      -- The bills raised for orders on this stop: paid by the trip.
      for b in select pi.id, pi.payload, pi.quote_id from purchase_invoices pi
                where pi.shop_id = p_shop_id and pi.payload ->> 'supplierId' = t.supplier_id
                  and coalesce(pi.payload ->> 'voided', 'false') <> 'true'
                  and pi.quote_id in (select ow_num(l ->> 'orderId')::bigint from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) l where ow_num(l ->> 'orderId') is not null)
      loop
        select coalesce(sum(ow_trip_line_paid(l)), 0) into bill_paid
          from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) l where ow_num(l ->> 'orderId')::bigint = b.quote_id;
        bill_paid := round(least(bill_paid, amt));
        if bill_paid <= 0 then continue; end if;
        pays := case when jsonb_typeof(b.payload -> 'payments') = 'array' then b.payload -> 'payments' else '[]'::jsonb end;
        if exists (select 1 from jsonb_array_elements(pays) p where p ->> 'tripId' = t.id) then continue; end if;
        update purchase_invoices
           set payload = b.payload || jsonb_build_object('payments', pays || jsonb_build_object('date', d, 'amount', bill_paid, 'note', 'Paid on trip ' || t.id || ' (own money, paid back)', 'via', 'trip', 'tripId', t.id, 'cashTxnId', line_id),
                                                         'amountPaid', coalesce(ow_num(b.payload ->> 'amountPaid'), 0) + bill_paid)
         where id = b.id;
        bills := bills || jsonb_build_object('id', b.id, 'amount', bill_paid);
      end loop;
    end if;
    update collection_trips
       set cash_count = jsonb_build_object('own', true, 'paidBack', amt, 'account', p_account, 'cashTxnId', line_id, 'handoffId', h.id,
                                           'by', uid, 'byName', ow_staff_name_of(uid, p_shop_id), 'at', now())
     where shop_id = p_shop_id and id = t.id;
  end loop;
  if n = 0 then
    raise exception 'No stop of this hand-in is left to pay back.' using errcode = '22023';
  end if;

  update buyer_handoffs set status = 'done' where id = h.id;
  if to_regclass('public.decision_log') is not null then
    execute 'insert into decision_log (shop_id, by, role, task, what, amount, ref, after)
             values ($1, $2, ''accounts'', ''trip.cash'', $3, $4, $5, $6)'
      using p_shop_id, uid,
            'Paid ' || buyer_name || ' back ' || ow_money(total) || ' for ' || n || ' stop' || case when n = 1 then '' else 's' end || ' on their own money, from '
              || case p_account when 'momo' then 'mobile money' else p_account end,
            total, jsonb_build_object('table', 'buyer_handoffs', 'id', h.id), jsonb_build_object('paid', lines, 'account', p_account);
  end if;
  return jsonb_build_object('total', total, 'stops', n, 'paidTxns', lines, 'bills', bills,
                            'cashRows', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from cash_txns c
                                          where c.id in (select (x ->> 'cashTxnId')::bigint from jsonb_array_elements(lines) x)));
end $$;
revoke all on function buyer_payback(uuid, uuid, text) from public;
grant execute on function buyer_payback(uuid, uuid, text) to authenticated;

/* ---------------- 3. cash handed over that no round used ---------------- */
create or replace function buyer_cash_back(p_shop_id uuid, p_handoff_id uuid, p_counted numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := ow_today();
  hm text := to_char(now() at time zone ow_shop_tz(), 'HH24:MI');
  h buyer_handoffs%rowtype;
  given numeric;
  counted numeric := round(coalesce(p_counted, 0));
  diff numeric;
  buyer_name text;
  floor_id bigint;
  diff_id bigint := null;
  back jsonb;
begin
  if uid is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'trip.cash')) then
    raise exception 'Taking back the Buyer''s cash needs trip.cash.' using errcode = '42501';
  end if;
  select * into h from buyer_handoffs where id = p_handoff_id and shop_id = p_shop_id for update;
  if not found or h.kind <> 'trip_cash' then
    raise exception 'No such handover.' using errcode = 'P0002';
  end if;
  if h.status <> 'done' then
    raise exception 'This cash was never handed over.' using errcode = '22023';
  end if;
  if coalesce(ow_num(h.payload ->> 'v'), 0) < 2 or h.payload ->> 'round' is not null then
    raise exception 'A round used this cash: count it with that round''s trips.' using errcode = '22023';
  end if;
  if h.cash_back is not null then
    raise exception 'This cash is counted back already.' using errcode = '22023';
  end if;
  given := round(coalesce(ow_num(h.payload ->> 'amount'), 0));
  select s.name into buyer_name from staff s where s.shop_id = p_shop_id and s.user_id = h.created_by limit 1;
  buyer_name := coalesce(buyer_name, 'the buyer');

  diff := counted - given;
  if abs(diff) >= 1 then
    select coalesce(max(id), 0) into floor_id from cash_txns;
    diff_id := ow_next_row_id(p_shop_id, 'row:cash_txn', floor_id);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, entered_by)
         values (diff_id, p_shop_id, d, 'cash', case when diff < 0 then 'payment' else 'receipt' end,
                 case when diff < 0 then 'Cash Shortage' else 'Cash Overage' end, abs(diff),
                 (case when diff < 0 then 'Short' else 'Over' end) || ' on cash handed to ' || buyer_name || ' that no round used', hm, uid);
  end if;
  back := jsonb_build_object('given', given, 'counted', counted, 'diff', diff, 'cashTxnId', diff_id, 'by', uid, 'byName', ow_staff_name_of(uid, p_shop_id), 'at', now());
  perform set_config('ow.cash_back', '1', true);
  update buyer_handoffs set cash_back = back where id = h.id;
  perform set_config('ow.cash_back', '', true);
  if to_regclass('public.decision_log') is not null then
    execute 'insert into decision_log (shop_id, by, role, task, what, amount, ref, after)
             values ($1, $2, ''accounts'', ''trip.cash'', $3, $4, $5, $6)'
      using p_shop_id, uid,
            'Cash handed to ' || buyer_name || ' that no round used: given ' || ow_money(given) || ', back ' || ow_money(counted)
              || case when abs(diff) >= 1 then ' — ' || (case when diff < 0 then 'short ' else 'over ' end) || ow_money(abs(diff)) || ', booked' else ', agrees' end,
            diff, jsonb_build_object('table', 'buyer_handoffs', 'id', h.id), back;
  end if;
  return jsonb_build_object('given', given, 'counted', counted, 'diff', diff, 'cashTxnId', diff_id, 'back', back,
                            'cashRows', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from cash_txns c where c.id = diff_id));
end $$;
revoke all on function buyer_cash_back(uuid, uuid, numeric) from public;
grant execute on function buyer_cash_back(uuid, uuid, numeric) to authenticated;

/* ---------------- 4. a bill raised after the payback is born paid ---------------- */
-- 0138's trigger, with one change: a stop the Buyer paid on their own money
-- and Accounts has paid back counts as paid by the trip, like a cash stop.
create or replace function purchase_invoices_born_paid() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t record;
  amt numeric;
  pays jsonb := '[]'::jsonb;
  total numeric := 0;
  link bigint;
begin
  if new.quote_id is null or coalesce(ow_num(new.payload ->> 'amountPaid'), 0) <> 0
     or jsonb_array_length(coalesce(new.payload -> 'payments', '[]'::jsonb)) <> 0 then
    return new;
  end if;
  for t in select ct.* from collection_trips ct
            where ct.shop_id = new.shop_id and ct.supplier_id = new.payload ->> 'supplierId' and (ow_trip_is_cash(ct) or (ct.cash_count ->> 'own') = 'true')
              and exists (select 1 from jsonb_array_elements(coalesce(ct.lines, '[]'::jsonb)) l where ow_num(l ->> 'orderId')::bigint = new.quote_id)
            order by ct.collected_at, ct.id
  loop
    select coalesce(sum(ow_trip_line_paid(l)), 0) into amt
      from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) l where ow_num(l ->> 'orderId')::bigint = new.quote_id;
    amt := round(amt);
    if amt <= 0 then continue; end if;
    -- Counted already: the cash line the count wrote for this stop; paid back
    -- to the Buyer (own money): the line the payback wrote.
    link := case when (t.cash_count ->> 'own') = 'true' then ow_num(t.cash_count ->> 'cashTxnId')::bigint
                 else (select (x ->> 'cashTxnId')::bigint from jsonb_array_elements(coalesce(t.cash_count -> 'paidTxns', '[]'::jsonb)) x where x ->> 'tripId' = t.id limit 1) end;
    pays := pays || jsonb_build_object('date', coalesce((t.collected_at at time zone ow_shop_tz())::date, new.date), 'amount', amt,
                                       'note', 'Paid on trip ' || t.id, 'via', 'trip', 'tripId', t.id, 'cashTxnId', link);
    total := total + amt;
  end loop;
  if total > 0 then
    new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object('payments', pays, 'amountPaid', total);
  end if;
  return new;
exception when others then
  raise notice 'bill born paid (%): % (%)', new.id, sqlerrm, sqlstate;
  return new;
end $$;
drop trigger if exists purchase_invoices_born_paid on purchase_invoices;
create trigger purchase_invoices_born_paid before insert on purchase_invoices
  for each row execute function purchase_invoices_born_paid();
