-- Sales round 2: the one-off correction of the old rows, with Kevin's choices.
-- (Replaces round-1-correct.sql, which never ran on live. If it did, every fix
-- here that it already made is skipped with a NOTICE.)
--
-- Run ONCE, in the Supabase SQL editor, right after
-- supabase/migrations/0165_sales_money_holds_together.sql and
-- supabase/migrations/0167_sales_credit_and_test_records.sql.
--
-- Kevin's choices (24 Oct 2026, docs/audit/sales/ROUND-2.md), already set below:
--   #446  link the 5,000 to Baker's own 5,000 receipt of 5 Oct if there is
--         exactly one; otherwise nothing changes and a NOTICE says so
--   #226  remove the copy of 1 Aug (receipt 15544)
--   #484  link its payment to receipt 22096
--   #264, #301, #360  the extra was given back as change
--   C953  move the 540,000 of 16 Oct from #408 to #390
--   C1005, C979, C110, C114  each bill's share of the balance set to what it says is due
--   C925  the two copies of the 85,000 charge taken off
--   the payments dated before their order labelled "Deposit"
--   the test records marked test (kept, in no figure)
--
-- How it is safe:
--   * One transaction. Any error and nothing is changed.
--   * Each fix checks that the row still looks the way the brief described it
--     (the amount, the receipt, the date). If it doesn't, the fix is skipped and
--     a NOTICE says why. Nothing is guessed.
--   * Each change writes a line to the owner's decision log
--     (task 'books.correct'), with the before and after.
--   * Each fix is a switch below; a switch set to false or null leaves its case alone.
--   * The 0165 checks are paused for this transaction only (ow.money_fix), as
--     these rows are the ones that broke them; they are back on at COMMIT.
--   * A second run changes nothing.
--
-- Step 1: run the REPORT block (read-only) and read it.
-- Step 2: run from BEGIN to COMMIT.
-- Step 3: run the CHECK AFTERWARDS block.

-- =====================================================================
-- REPORT (read-only): the facts each switch depends on.
-- =====================================================================
with shop as (select id from shops where name = 'Omni-ware (old records)')
select 'C925 charges 28-29 Sep' as what, l.id::text as ref, l.date::text as day, l.type, l.amount, l.note, l.quote_id::text as on_order
  from customer_debt_log l, shop where l.shop_id = shop.id and l.customer_id = 'C925' and l.date between date '2026-09-28' and date '2026-09-29'
union all
select '#446 a 5,000 receipt on 5 Oct', c.id::text, c.date::text, c.type, c.amount, c.description, c.quote_id::text
  from cash_txns c, shop where c.shop_id = shop.id and c.date = date '2026-10-05' and c.amount = 5000 and c.type = 'receipt'
union all
select '#226 receipt 15544', c.id::text, c.date::text, c.type, c.amount, c.description, c.quote_id::text
  from cash_txns c, shop where c.shop_id = shop.id and c.id = 15544
union all
select '#226 payments', x ->> 'cashTxnId', x ->> 'date', 'payment', ow_num(x ->> 'amount'), x ->> 'note', '226'
  from saved_quotes q, shop, jsonb_array_elements(q.payload -> 'payments') x where q.shop_id = shop.id and q.id = 226
union all
select 'balance vs bills · ' || b.name, b.customer_id, null, 'gap', b.gap, 'balance ' || b.balance || ' · old book ' || b.opening || ' · open bills ' || b.open_bills, null
  from ow_balance_check b, shop where b.shop_id = shop.id
order by 1, 3, 2;

-- =====================================================================
-- THE CORRECTION
-- =====================================================================
begin;
select set_config('ow.money_fix', 'on', true);

do $fix$
declare
  -- ---- Kevin's switches (set as he chose, 24 Oct 2026) ----------------
  -- #446 Baker: the 5,000 that points at Mulongo's 871,500 receipt.
  --   'relink'  the payment points at its own 5,000 receipt of 5 Oct: the one
  --             named below, or, when none is named, the one free 5,000 receipt
  --             of that day that names Baker or #0446 (none, or more than one:
  --             nothing changes, and a NOTICE says so)
  --   'record'  it was paid but never written: a 5,000 receipt is added for it
  --   'remove'  it wasn't paid: the payment comes off the order
  --   null      leave it
  fix_446 text := 'relink';
  fix_446_receipt bigint := null;
  -- #226 Jackson: the 1,600,000 of 1 Aug (receipt 15544), before the order.
  --   'remove'  a second copy of a real payment: taken off #226 (the receipt stays in the cash book)
  --             Live, 23 Oct: receipts 15544 (1 Aug) and 11385 (26 Aug) are both 1,600,000 "Payment — INV-0226",
  --             every other Jackson order is paid in full, and #226's paid is already 4,600,000: 'remove'.
  --   <id>      it belongs to that order: moved there (write the order id as text, e.g. '201')
  --   null      leave it
  fix_226 text := 'remove';
  -- C925 Ambrose: three 85,000 charges on 28-29 Sep; true takes off the two later copies.
  fix_c925 boolean := true;
  -- Balances that are not their bills (C1005 Ken, C979 Hajat, C110 Sadat, C114 Sam):
  -- true sets each invoice's share of the balance to what its bill says is due,
  -- as the server now keeps it (one Auto-sync line per invoice that moves).
  -- An old-book balance (a line with no order) is never touched.
  fix_resync boolean := true;
  resync_for text[] := array['C1005', 'C979', 'C110', 'C114'];
  -- #484: link its payment to receipt 22096.
  fix_484 boolean := true;
  -- C953 Eddy: move his 540,000 of 16 Oct from #408 to #390.
  fix_c953 boolean := true;
  -- Payments dated before their order: labelled "Deposit", nothing moves.
  fix_labels boolean := true;
  -- #264, #301, #360 paid over: 'change' (given back), 'deposit' (the customer
  -- kept it), 'ask' (sent to Accounts to settle), null (leave it).
  fix_over text := 'change';
  -- The test records: TEST Claude QA, #554, #556, #562, #564, receipts 22655
  -- and 22656, and anything else a TEST name or a TESTQA ref marks (0167).
  fix_test boolean := true;
  -- ---------------------------------------------------------------------
  shop uuid := (select id from shops where name = 'Omni-ware (old records)');
  own uuid;
  own_name text;
  q saved_quotes%rowtype;
  q2 saved_quotes%rowtype;
  c cash_txns%rowtype;
  pays jsonb;
  p jsonb;
  n int;
  due numeric;
  cur numeric;
  delta numeric;
  r record;
  floor_id bigint;

begin
  if shop is null then raise exception 'No shop called Omni-ware (old records).'; end if;
  select m.user_id into own from shop_members m where m.shop_id = shop and m.role = 'owner' limit 1;
  own_name := coalesce((select s.name from staff s where s.shop_id = shop and s.user_id = own limit 1), 'Owner');

  -- ---- #484 Kadomola (SAL-013): paid 240,000 with no payment; receipt 22096 names it.
  if fix_484 then
  select * into q from saved_quotes where shop_id = shop and id = 484 for update;
  select * into c from cash_txns where shop_id = shop and id = 22096;
  if q.id is null or c.id is null then
    raise notice '#484: skipped, the order or receipt 22096 is not there.';
  elsif round(coalesce(q.amount_paid, 0)) = 240000 and coalesce(jsonb_array_length(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' end), 0) = 0
        and c.quote_id = 484 and round(c.amount) = 240000 and c.type = 'receipt' then
    update saved_quotes set payload = payload || jsonb_build_object('payments', jsonb_build_array(jsonb_build_object(
      'id', 1, 'date', c.date::text, 'amount', 240000, 'note', 'Linked to its receipt (round 1)', 'cashTxnId', c.id, 'method', c.account)))
     where shop_id = shop and id = 484;
    perform ow_log(shop, own, own_name, 'owner', 'books.correct', '#0484: the 240,000 paid gets its payment, linked to receipt 22096', 240000,
      jsonb_build_object('table', 'saved_quotes', 'id', 484), jsonb_build_object('payments', 0), jsonb_build_object('payments', 1, 'cashTxnId', 22096));
  else
    raise notice '#484: skipped, it no longer looks as the brief said (paid %, receipt % on %).', q.amount_paid, c.amount, c.quote_id;
  end if;
  end if;

  -- ---- Payments dated before their order (Kevin's answer 1): labelled Deposit, nothing moves.
  if fix_labels then
  for q in select * from saved_quotes x where x.shop_id = shop and jsonb_typeof(x.payload -> 'payments') = 'array' for update loop
    pays := '[]'::jsonb; n := 0;
    for p in select e from jsonb_array_elements(q.payload -> 'payments') e loop
      if (p ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' and (p ->> 'date')::date < q.date and coalesce(p ->> 'note', '') = '' then
        p := p || jsonb_build_object('note', 'Deposit'); n := n + 1;
      end if;
      pays := pays || jsonb_build_array(p);
    end loop;
    if n > 0 then
      update saved_quotes set payload = payload || jsonb_build_object('payments', pays) where shop_id = shop and id = q.id;
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', '#' || lpad(q.id::text, 4, '0') || ': ' || n || ' payment(s) dated before the order labelled Deposit', null,
        jsonb_build_object('table', 'saved_quotes', 'id', q.id), null, jsonb_build_object('labelled', n));
    end if;
  end loop;
  end if;

  -- ---- #264, #301, #360 (SAL-005): paid over. Kevin: the extra was given back as change.
  -- Settled as Accounts would (ow_settle_over, as the owner): the receipt keeps
  -- what the order took, and the extra goes out of the cash book as change given.
  if fix_over in ('change', 'deposit') then
    perform set_config('request.jwt.claim.sub', own::text, true);
    for q in select * from saved_quotes x where x.shop_id = shop and x.id in (264, 301, 360) loop
      due := round(coalesce(q.amount_paid, 0)) - round(ow_order_total(shop, q.payload, false));
      if due <= 0 then
        raise notice '#%: skipped, not paid over now.', q.id;
        continue;
      end if;
      begin
        perform ow_settle_over(shop, q.id, fix_over);
        perform ow_log(shop, own, own_name, 'owner', 'books.correct', '#' || lpad(q.id::text, 4, '0') || ': ' || due || ' paid over, settled as ' || case when fix_over = 'change' then 'change given back' else 'a deposit' end, due,
          jsonb_build_object('table', 'saved_quotes', 'id', q.id), jsonb_build_object('over', due), jsonb_build_object('settled', fix_over));
      exception when others then
        raise notice '#%: not settled (%).', q.id, sqlerrm;
      end;
      -- ow_settle_over turns the pause off at its end: back on for the rest of this script.
      perform set_config('ow.money_fix', 'on', true);
    end loop;
  elsif fix_over = 'ask' then
  for q in select * from saved_quotes x where x.shop_id = shop and x.id in (264, 301, 360) loop
    due := round(coalesce(q.amount_paid, 0)) - round(ow_order_total(shop, q.payload, false));
    p := (select e from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) e
           where coalesce(e ->> 'cashTxnId', '') <> '' order by (e ->> 'date') desc nulls last limit 1);
    if due <= 0 or p is null then
      raise notice '#%: skipped, not paid over now (or no receipt to point at).', q.id;
    elsif exists (select 1 from payment_asks a where a.shop_id = shop and a.quote_id = q.id and a.what = 'over' and a.status = 'sent') then
      raise notice '#%: an over ask is already waiting.', q.id;
    else
      insert into payment_asks (shop_id, cash_txn_id, customer_id, quote_id, amount, what, want, note, asked_by, asked_by_name, asked_role, status)
      values (shop, (p ->> 'cashTxnId')::bigint, nullif(q.payload ->> 'customerId', ''), q.id, due, 'over', jsonb_build_object('over', due),
              'Paid over before round 1: a deposit if the customer confirms, else change', own, own_name, 'owner', 'sent');
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', '#' || lpad(q.id::text, 4, '0') || ': ' || due || ' paid over, sent to Accounts to settle', due,
        jsonb_build_object('table', 'saved_quotes', 'id', q.id), null, null);
    end if;
  end loop;
  end if;

  -- ---- C953 Eddy (SAL-011): his 540,000 of 16 Oct sits on #408; #390 shows it due.
  if fix_c953 then
  select * into q from saved_quotes where shop_id = shop and id = 408 for update;
  select * into q2 from saved_quotes where shop_id = shop and id = 390 for update;
  p := (select e from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) e
         where round(ow_num(e ->> 'amount')) = 540000 and e ->> 'date' = '2026-10-16' limit 1);
  if q.id is null or q2.id is null or p is null then
    raise notice 'C953: skipped, #408 has no 540,000 payment of 16 Oct (or an order is missing).';
  elsif round((select coalesce(sum(ow_num(e ->> 'amount')), 0) from jsonb_array_elements(q.payload -> 'payments') e)) - 540000 < round(ow_order_total(shop, q.payload, false))
        or round(ow_order_total(shop, q2.payload, false)) - round(coalesce(q2.amount_paid, 0)) < 540000
        or coalesce(q2.payload ->> 'customerId', '') <> coalesce(q.payload ->> 'customerId', '') then
    raise notice 'C953: skipped, #408 is not otherwise paid, or #390 does not owe 540,000 (or they are not the same customer).';
  else
    update saved_quotes set payload = payload || jsonb_build_object('payments', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(q.payload -> 'payments') e where e is distinct from p))
     where shop_id = shop and id = 408;
    update saved_quotes set payload = payload || jsonb_build_object('payments', coalesce(case when jsonb_typeof(q2.payload -> 'payments') = 'array' then q2.payload -> 'payments' end, '[]'::jsonb)
             || jsonb_build_array(p || jsonb_build_object('id', 1 + coalesce((select max(ow_num(e ->> 'id')) from jsonb_array_elements(case when jsonb_typeof(q2.payload -> 'payments') = 'array' then q2.payload -> 'payments' else '[]'::jsonb end) e), 0), 'note', 'Moved from #0408 (round 2)')))
     where shop_id = shop and id = 390;
    -- Paid is the sum of the payments each order now holds (0165's rule), whatever it said before.
    update saved_quotes set amount_paid = (select coalesce(sum(ow_num(e ->> 'amount')), 0) from jsonb_array_elements(case when jsonb_typeof(payload -> 'payments') = 'array' then payload -> 'payments' else '[]'::jsonb end) e) where shop_id = shop and id in (390, 408);
    if coalesce(p ->> 'cashTxnId', '') <> '' then
      update cash_txns set quote_id = 390, description = replace(coalesce(description, ''), '0408', '0390') where shop_id = shop and id = (p ->> 'cashTxnId')::bigint;
    end if;
    perform ow_log(shop, own, own_name, 'owner', 'books.correct', 'C953: the 540,000 of 16 Oct moved from #0408 to #0390', 540000,
      jsonb_build_object('table', 'saved_quotes', 'id', 390, 'from', 408), jsonb_build_object('on', 408), jsonb_build_object('on', 390));
  end if;
  end if;

  -- ---- #446 Baker (SAL-010), on Kevin's word.
  if fix_446 is not null then
    select * into q from saved_quotes where shop_id = shop and id = 446 for update;
    p := (select e from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) e
           where round(ow_num(e ->> 'amount')) = 5000 and e ->> 'cashTxnId' = '20166' limit 1);
    if p is null then
      raise notice '#446: skipped, no 5,000 payment pointing at 20166.';
    elsif fix_446 = 'relink' then
      if fix_446_receipt is null then
        select count(*), min(x.id) into n, fix_446_receipt from cash_txns x
         where x.shop_id = shop and x.date = date '2026-10-05' and round(x.amount) = 5000 and x.type = 'receipt'
           and (x.quote_id is null or x.quote_id = 446)
           and (x.description ilike '%baker%' or x.description ~ '#?0?446\M')
           and not exists (select 1 from saved_quotes o, jsonb_array_elements(case when jsonb_typeof(o.payload -> 'payments') = 'array' then o.payload -> 'payments' else '[]'::jsonb end) e
                            where o.shop_id = shop and e ->> 'cashTxnId' = x.id::text);
        if n <> 1 then fix_446_receipt := null; end if;
      end if;
      select * into c from cash_txns where shop_id = shop and id = fix_446_receipt;
      if c.id is null or round(c.amount) <> 5000 or c.type <> 'receipt' or (c.quote_id is not null and c.quote_id <> 446) then
        raise notice '#446: skipped, no single free 5,000 receipt of 5 Oct for Baker (%). Choose record or remove.', coalesce(fix_446_receipt::text, 'none found');
      else
        update saved_quotes set payload = payload || jsonb_build_object('payments', (select jsonb_agg(case when e = p then e || jsonb_build_object('cashTxnId', c.id) else e end) from jsonb_array_elements(q.payload -> 'payments') e)) where shop_id = shop and id = 446;
        update cash_txns set quote_id = 446 where shop_id = shop and id = c.id;
        perform ow_log(shop, own, own_name, 'owner', 'books.correct', '#0446: the 5,000 payment now points at its own receipt ' || c.id, 5000, jsonb_build_object('table', 'saved_quotes', 'id', 446), jsonb_build_object('cashTxnId', 20166), jsonb_build_object('cashTxnId', c.id));
      end if;
    elsif fix_446 = 'record' then
      select coalesce(max(id), 0) into floor_id from cash_txns where shop_id = shop;
      insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
      values (ow_next_row_id(shop, 'row:cash_txn', floor_id), shop, date '2026-10-05', coalesce(p ->> 'method', 'cash'), 'receipt', 'Invoice Payment', 5000, 'Payment — #0446 (recorded in round 1)', '00:00', 446, own)
      returning * into c;
      update saved_quotes set payload = payload || jsonb_build_object('payments', (select jsonb_agg(case when e = p then e || jsonb_build_object('cashTxnId', c.id) else e end) from jsonb_array_elements(q.payload -> 'payments') e)) where shop_id = shop and id = 446;
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', '#0446: the 5,000 paid on 5 Oct gets its receipt ' || c.id, 5000, jsonb_build_object('table', 'saved_quotes', 'id', 446), jsonb_build_object('cashTxnId', 20166), jsonb_build_object('cashTxnId', c.id));
    elsif fix_446 = 'remove' then
      update saved_quotes set payload = payload || jsonb_build_object('payments', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(q.payload -> 'payments') e where e is distinct from p))
       where shop_id = shop and id = 446;
      update saved_quotes set amount_paid = (select coalesce(sum(ow_num(e ->> 'amount')), 0) from jsonb_array_elements(case when jsonb_typeof(payload -> 'payments') = 'array' then payload -> 'payments' else '[]'::jsonb end) e) where shop_id = shop and id = 446;
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', '#0446: the 5,000 that was never paid comes off', 5000, jsonb_build_object('table', 'saved_quotes', 'id', 446), jsonb_build_object('paid', q.amount_paid), jsonb_build_object('paid', (select amount_paid from saved_quotes where shop_id = shop and id = 446)));
    end if;
  end if;

  -- ---- #226 Jackson (SAL-012), on Kevin's word.
  if fix_226 is not null then
    select * into q from saved_quotes where shop_id = shop and id = 226 for update;
    p := (select e from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) e
           where e ->> 'cashTxnId' = '15544' limit 1);
    if p is null then
      raise notice '#226: skipped, no payment pointing at 15544.';
    else
      update saved_quotes set payload = payload || jsonb_build_object('payments', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(q.payload -> 'payments') e where e is distinct from p))
       where shop_id = shop and id = 226;
      update saved_quotes set amount_paid = (select coalesce(sum(ow_num(e ->> 'amount')), 0) from jsonb_array_elements(case when jsonb_typeof(payload -> 'payments') = 'array' then payload -> 'payments' else '[]'::jsonb end) e) where shop_id = shop and id = 226;
      if fix_226 = 'remove' then
        update cash_txns set quote_id = null where shop_id = shop and id = 15544 and quote_id = 226;
        perform ow_log(shop, own, own_name, 'owner', 'books.correct', '#0226: the second copy of 1 Aug (receipt 15544) comes off the order', ow_num(p ->> 'amount'), jsonb_build_object('table', 'saved_quotes', 'id', 226), null, null);
      else
        select * into q2 from saved_quotes where shop_id = shop and id = fix_226::bigint for update;
        if q2.id is null then raise exception '#226: order % is not there.', fix_226; end if;
        update saved_quotes set payload = payload || jsonb_build_object('payments', coalesce(case when jsonb_typeof(q2.payload -> 'payments') = 'array' then q2.payload -> 'payments' end, '[]'::jsonb)
                 || jsonb_build_array(p || jsonb_build_object('id', 1 + coalesce((select max(ow_num(e ->> 'id')) from jsonb_array_elements(case when jsonb_typeof(q2.payload -> 'payments') = 'array' then q2.payload -> 'payments' else '[]'::jsonb end) e), 0), 'note', 'Moved from #0226 (round 2)')))
         where shop_id = shop and id = q2.id;
        update saved_quotes set amount_paid = (select coalesce(sum(ow_num(e ->> 'amount')), 0) from jsonb_array_elements(case when jsonb_typeof(payload -> 'payments') = 'array' then payload -> 'payments' else '[]'::jsonb end) e) where shop_id = shop and id = q2.id;
        update cash_txns set quote_id = q2.id where shop_id = shop and id = 15544;
        perform ow_log(shop, own, own_name, 'owner', 'books.correct', 'Receipt 15544 moved from #0226 to #' || lpad(q2.id::text, 4, '0'), ow_num(p ->> 'amount'), jsonb_build_object('table', 'saved_quotes', 'id', q2.id, 'from', 226), null, null);
      end if;
    end if;
  end if;

  -- ---- C925 Ambrose, on Kevin's word: two copies of an 85,000 charge.
  if fix_c925 then
    n := 0;
    for r in select l.* from customer_debt_log l where l.shop_id = shop and l.customer_id = 'C925' and l.type = 'charge' and round(l.amount) = 85000
                and l.date between date '2026-09-28' and date '2026-09-29' order by l.date, l.id offset 1 loop
      exit when n = 2;
      delete from customer_debt_log where shop_id = shop and id = r.id;
      update customers set debt = coalesce(debt, 0) - 85000 where shop_id = shop and id = 'C925';
      n := n + 1;
    end loop;
    if n = 0 then
      raise notice 'C925: skipped, no copies of the 85,000 charge left (already corrected?).';
    elsif n = 2 then
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', 'C925: two copies of the 85,000 charge of 28-29 Sep taken off', 170000, jsonb_build_object('table', 'customers', 'id', 'C925'), null, null);
    else
      raise exception 'C925: expected three 85,000 charges on 28-29 Sep, found % to take off. Nothing is changed.', n + 1;
    end if;
  end if;

  -- ---- Balances that are not their bills, on Kevin's word: each invoice's share set to what it says is due.
  if fix_resync then
    for q in select * from saved_quotes x where x.shop_id = shop and x.invoiced and not coalesce(x.voided, false) and x.payload ->> 'customerId' = any(resync_for) for update loop
      due := greatest(0, round(ow_order_total(shop, q.payload, false)) - round(coalesce(q.amount_paid, 0)));
      cur := round(coalesce(ow_num(q.payload ->> 'debtCharged'), 0));
      continue when due = cur;
      delta := due - cur;
      update customers set debt = coalesce(debt, 0) + delta where shop_id = shop and id = q.payload ->> 'customerId';
      select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = shop;
      insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id)
      values (ow_next_row_id(shop, 'row:debt_log', floor_id), shop, q.payload ->> 'customerId', ow_today(), case when delta > 0 then 'charge' else 'payment' end, abs(delta),
              'Auto-sync — INV-' || lpad(q.id::text, 4, '0') || ' (round 2)', q.id);
      update saved_quotes set payload = payload || jsonb_build_object('debtCharged', due) where shop_id = shop and id = q.id;
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', 'INV-' || lpad(q.id::text, 4, '0') || ': its share of the balance set to what it says is due', delta,
        jsonb_build_object('table', 'saved_quotes', 'id', q.id), jsonb_build_object('debtCharged', cur), jsonb_build_object('debtCharged', due));
    end loop;
  end if;

  -- ---- The test records (SAL-018, Kevin: yes; never cash): marked test, kept, in no figure.
  if fix_test then
    update customers set qa = true where shop_id = shop and not qa and (ow_qa_name(name) or name = 'TEST Claude QA');
    get diagnostics n = row_count;
    update saved_quotes set qa = true where shop_id = shop and not qa
       and (id in (554, 556, 562, 564) or ow_qa_name(coalesce(client_name, payload -> 'client' ->> 'name'))
            or payload ->> 'customerId' in (select c2.id from customers c2 where c2.shop_id = shop and c2.qa));
    get diagnostics cur = row_count;
    update cash_txns set qa = true where shop_id = shop and not qa
       and (id in (22655, 22656) or coalesce(description, '') ~ 'TESTQA'
            or quote_id in (select o.id from saved_quotes o where o.shop_id = shop and o.qa));
    get diagnostics delta = row_count;
    if n + cur + delta > 0 then
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', 'Test records marked: ' || n || ' customer(s), ' || cur || ' order(s), ' || delta || ' receipt(s); kept, in no figure', null,
        jsonb_build_object('table', 'saved_quotes', 'ids', jsonb_build_array(554, 556, 562, 564), 'cash', jsonb_build_array(22655, 22656)), null, null);
    else
      raise notice 'Test records: nothing left to mark.';
    end if;
  end if;
end $fix$;

commit;

-- =====================================================================
-- CHECK AFTERWARDS: run round-1-check.sql queries 1-5 and round-2-check.sql again; and these.
-- =====================================================================
-- What this script did:
--   select at, what, amount from decision_log where task = 'books.correct' order by at;
-- The three paid-over orders, settled:
--   select id, amount_paid, round(ow_order_total(shop_id, payload, false)) as total from saved_quotes where id in (264, 301, 360);
-- The test records, marked:
--   select 'order', id::text from saved_quotes where qa union all select 'receipt', id::text from cash_txns where qa union all select 'customer', id from customers where qa;
-- Who still doesn't add up (empty once the switches above are all decided):
--   select * from ow_balance_check where shop_id = (select id from shops where name = 'Omni-ware (old records)');
