-- Manager round 1, follow-up correction: what check query 1 still listed on
-- live (Kevin, 28 Oct 2026). Run AFTER round-1-correct.sql.
--
--   A. 35 receipts written before cash rows named their order: the amount and
--      account match the payment and the description already names the
--      invoice ("Payment — INV-0150"); only the order link is missing.
--      Filled in automatically, and only when ALL of these hold: the receipt
--      names no order, is a receipt, has the payment's amount, the payment's
--      account (when the payment says one), no other payment names it, and
--      its description names this order (INV-0150 / #0150 / 0150).
--   B. Payments whose receipt does not exist (#0232 Maria 560,000 cash 26 Aug,
--      receipt 11374; #0266 Grace Hardware 20,000 momo 31 Aug, receipt 12919)
--      and #0446 Baker's 5,000 that names Mulongo's 871,500 receipt.
--      Each is a switch, OFF until Kevin chooses:
--        'record'  the money came in: a receipt is written on the payment's
--                  day and account, and the payment names it
--        'remove'  it never came in: the payment comes off; the order owes it again
--        null      leave it (it stays in check query 1)
--   (#0148 and #0166 are test records; check query 1 now skips test records.)
--
-- Safe: one transaction; the 0165/0169 money checks paused for it only
-- (ow.money_fix); each change checks the row still looks as described and
-- writes a 'books.correct' line to the owner's log; a second run changes nothing.
--
-- Step 1: the REPORT (read-only). Step 2: set the switches, run BEGIN to COMMIT.
-- Step 3: run round-1-check.sql query 1 again.

-- =====================================================================
-- REPORT (read-only)
-- =====================================================================
with shop as (select id from shops where name = 'Omni-ware (old records)'),
p as (
  select q.id as order_id, q.client_name, pay, pay ->> 'cashTxnId' as cash_id, ow_num(pay ->> 'amount') as paid, lower(coalesce(pay ->> 'method', '')) as method
    from saved_quotes q, shop,
         jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) pay
   where q.shop_id = shop.id and not coalesce(q.qa, false) and coalesce(pay ->> 'cashTxnId', '') <> ''
)
select p.order_id, p.client_name, p.paid, p.method, p.cash_id, c.amount, c.account, c.description,
       case when c.id is null then 'B: no receipt (switch)'
            when c.quote_id is null and round(c.amount) = round(p.paid)
                 and (p.method = '' or lower(coalesce(c.account, '')) = p.method)
                 and c.description ~ ('\m(INV-|#)?0*' || p.order_id || '\M') then 'A: link filled in'
            else 'B: other (switch or by hand)' end as what_happens
  from p cross join shop
  left join cash_txns c on c.shop_id = shop.id and c.id::text = p.cash_id
 where c.id is null or round(c.amount) <> round(p.paid)
    or (p.method <> '' and lower(coalesce(c.account, '')) <> p.method)
    or c.quote_id is distinct from p.order_id
 order by 5 desc, 1;

-- =====================================================================
-- RUN
-- =====================================================================
begin;
select set_config('ow.money_fix', 'on', true);
do $fix$
declare
  -- ---- Kevin's switches ------------------------------------------------
  fix_link_old boolean := true;   -- A: fill in the 35 missing order links
  fix_232 text := null;           -- 'record' | 'remove' | null
  fix_266 text := null;           -- 'record' | 'remove' | null
  fix_446 text := null;           -- 'record' | 'remove' | null
  -- ---------------------------------------------------------------------
  shop uuid := (select id from shops where name = 'Omni-ware (old records)');
  own uuid;
  own_name text;
  r record;
  q saved_quotes%rowtype;
  c cash_txns%rowtype;
  p jsonb;
  ch text;
  floor_id bigint;
  n int := 0;
begin
  if shop is null then raise exception 'No shop called Omni-ware (old records).'; end if;
  select mm.user_id into own from shop_members mm where mm.shop_id = shop and mm.role = 'owner' limit 1;
  own_name := coalesce((select s.name from staff s where s.shop_id = shop and s.user_id = own limit 1), 'Owner');

  -- ---- A. the missing order links.
  if fix_link_old then
    for r in
      select sq.id as order_id, ct.id as cash_id, ct.amount
        from saved_quotes sq
        cross join lateral jsonb_array_elements(case when jsonb_typeof(sq.payload -> 'payments') = 'array' then sq.payload -> 'payments' else '[]'::jsonb end) pay
        join cash_txns ct on ct.shop_id = sq.shop_id and ct.id::text = pay ->> 'cashTxnId'
       where sq.shop_id = shop and not coalesce(sq.qa, false)
         and ct.quote_id is null and ct.type = 'receipt'
         and round(ct.amount) = round(ow_num(pay ->> 'amount'))
         and (coalesce(pay ->> 'method', '') = '' or lower(coalesce(ct.account, '')) = lower(pay ->> 'method'))
         and ct.description ~ ('\m(INV-|#)?0*' || sq.id || '\M')
         and (select count(*) from saved_quotes q2
                cross join lateral jsonb_array_elements(case when jsonb_typeof(q2.payload -> 'payments') = 'array' then q2.payload -> 'payments' else '[]'::jsonb end) p2
               where q2.shop_id = shop and p2 ->> 'cashTxnId' = ct.id::text) = 1
    loop
      update cash_txns set quote_id = r.order_id where shop_id = shop and id = r.cash_id and quote_id is null;
      perform ow_log(shop, own, own_name, 'owner', 'books.correct',
        'Receipt ' || r.cash_id || ' now names ' || '#' || lpad(r.order_id::text, 4, '0') || ' (its description already did)', r.amount,
        jsonb_build_object('table', 'cash_txns', 'id', r.cash_id), jsonb_build_object('quote_id', null), jsonb_build_object('quote_id', r.order_id));
      n := n + 1;
    end loop;
    raise notice 'A: % receipt(s) now name their order.', n;
  end if;

  -- ---- B. #0232, #0266 (no receipt) and #0446 (another customer's receipt).
  for r in select * from (values (232, fix_232, '11374', 560000), (266, fix_266, '12919', 20000), (446, fix_446, '20166', 5000)) v(order_id, choice, cash_id, amount) loop
    continue when r.choice is null;
    select * into q from saved_quotes where shop_id = shop and id = r.order_id for update;
    p := (select e from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) e
           where e ->> 'cashTxnId' = r.cash_id and round(ow_num(e ->> 'amount')) = r.amount limit 1);
    if p is null then raise notice '#%: skipped, no % payment naming receipt % (already fixed?).', lpad(r.order_id::text, 4, '0'), r.amount, r.cash_id; continue; end if;
    if r.choice = 'record' then
      select coalesce(max(id), 0) into floor_id from cash_txns where shop_id = shop;
      insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
      values (ow_next_row_id(shop, 'row:cash_txn', floor_id), shop, (p ->> 'date')::date, coalesce(nullif(lower(p ->> 'method'), ''), 'cash'),
              'receipt', 'Invoice Payment', r.amount, 'Payment — #' || lpad(r.order_id::text, 4, '0') || ' (recorded in Manager round 1)', '00:00', r.order_id, own)
      returning * into c;
      update saved_quotes set payload = payload || jsonb_build_object('payments',
               (select jsonb_agg(case when e = p then e || jsonb_build_object('cashTxnId', c.id) else e end) from jsonb_array_elements(q.payload -> 'payments') e))
       where shop_id = shop and id = r.order_id;
      perform ow_log(shop, own, own_name, 'owner', 'books.correct',
        '#' || lpad(r.order_id::text, 4, '0') || ': the ' || r.amount || ' paid on ' || (p ->> 'date') || ' gets its receipt ' || c.id, r.amount,
        jsonb_build_object('table', 'saved_quotes', 'id', r.order_id), jsonb_build_object('cashTxnId', r.cash_id), jsonb_build_object('cashTxnId', c.id));
      raise notice '#%: receipt % written.', lpad(r.order_id::text, 4, '0'), c.id;
    elsif r.choice = 'remove' then
      update saved_quotes set payload = payload || jsonb_build_object('payments',
               (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(q.payload -> 'payments') e where e is distinct from p))
       where shop_id = shop and id = r.order_id;
      update saved_quotes set amount_paid = (select coalesce(sum(ow_num(e ->> 'amount')), 0)
               from jsonb_array_elements(case when jsonb_typeof(payload -> 'payments') = 'array' then payload -> 'payments' else '[]'::jsonb end) e)
       where shop_id = shop and id = r.order_id;
      perform ow_log(shop, own, own_name, 'owner', 'books.correct',
        '#' || lpad(r.order_id::text, 4, '0') || ': the ' || r.amount || ' that never came in comes off', r.amount,
        jsonb_build_object('table', 'saved_quotes', 'id', r.order_id), jsonb_build_object('paid', q.amount_paid),
        jsonb_build_object('paid', (select amount_paid from saved_quotes where shop_id = shop and id = r.order_id)));
      raise notice '#%: payment removed; the order owes it again.', lpad(r.order_id::text, 4, '0');
    else
      raise notice '#%: unknown choice %, left alone.', lpad(r.order_id::text, 4, '0'), r.choice;
    end if;
  end loop;
end $fix$;
commit;
