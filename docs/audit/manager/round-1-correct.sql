-- Manager round 1: the one-off correction of the old rows, with Kevin's choices.
--
-- Run ONCE, in the Supabase SQL editor, RIGHT AFTER
-- supabase/migrations/0169_manager_money_integrity.sql (which needs 0165 and
-- 0167, and Sales' round-2-correct.sql, all run on live — Kevin, 25 Oct).
-- 0169 makes stock and its lots strict: until the lots step below has run,
-- a stock move on a key whose lots are already apart is refused.
--
-- Kevin's choices (25 Oct 2026, docs/audit/manager/ROUND-1.md), already set below:
--   #0415   its 400,000 cash payment gets its own cash receipt; the momo
--           receipt it named (18965, 500,000 "Debt Payment") is left as the
--           debt payment it is
--   lots    every stock key whose lots don't add up to its stock: the NEWEST
--           layers that add up to the stock stay (the oldest goods left
--           first); a key short of lots gets one layer at its last known cost
--   #0166, #0148  test data: marked test (0167's qa — kept, listed, in no
--           figure), no refund and no deposit
--   fractions of a shilling in the cash book rounded (each one listed)
--   targets past their last day ended, with their result
--   payments dated before their order labelled "Deposit" (those Sales
--           round 2 already noted "Deposit" are left as they are)
--
-- How it is safe:
--   * It first checks that 0165, 0167 and 0169 are in, and stops if not.
--   * One transaction. Any error and nothing is changed.
--   * Each fix checks that the rows still look as the brief described them;
--     if not, it is skipped and a NOTICE says why. Nothing is guessed.
--   * Each change writes a line to the owner's decision log (task
--     'books.correct'), with the before and after.
--   * Each fix is a switch below; false or null leaves its case alone.
--   * The 0165 money checks are paused for this transaction only
--     (ow.money_fix); the stock-and-lots check is not: it judges the result
--     at COMMIT.
--   * A second run changes nothing.
--
-- Step 1: run the PREREQUISITES block, then the REPORT queries (read-only).
-- Step 2: run from BEGIN to COMMIT.
-- Step 3: run the CHECK AFTERWARDS block, and round-1-check.sql again.

-- =====================================================================
-- PREREQUISITES (read-only): stops with a clear message if a migration is missing.
-- =====================================================================
do $pre$
declare
  missing text[] := '{}';
begin
  if to_regprocedure('ow_patch_order(uuid, bigint, jsonb, text, text, text[], text)') is null
     or not exists (select 1 from pg_trigger where tgname = 'saved_quotes_zz_money_check') then missing := missing || '0165'::text; end if;
  if to_regprocedure('ow_qa_name(text)') is null
     or not exists (select 1 from information_schema.columns where table_name = 'saved_quotes' and column_name = 'qa') then missing := missing || '0167'::text; end if;
  if to_regprocedure('void_with_money(uuid, bigint, text, text)') is null or to_regprocedure('ow_end_targets(uuid)') is null
     or not exists (select 1 from pg_trigger where tgname = 'stock_zz_lots_add_up') then missing := missing || '0169'::text; end if;
  if array_length(missing, 1) is not null then
    raise exception 'Not run: migration(s) % are not in this database yet. Run them first, in order, then this.', array_to_string(missing, ', ');
  end if;
  raise notice 'Prerequisites: 0165, 0167 and 0169 are in.';
end $pre$;

-- =====================================================================
-- REPORT (read-only): the facts each switch depends on.
-- =====================================================================
-- #0415: its payments and the receipts they name.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select '#0415 payment' as what, p ->> 'id' as ref, p ->> 'date' as day, p ->> 'method' as account, ow_num(p ->> 'amount') as amount, p ->> 'cashTxnId' as receipt,
       c.account as receipt_account, c.amount as receipt_amount, c.quote_id as receipt_order, c.description
  from saved_quotes q cross join shop
  cross join lateral jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) p
  left join cash_txns c on c.shop_id = shop.id and c.id::text = p ->> 'cashTxnId'
 where q.shop_id = shop.id and q.id = 415;

-- Stock keys whose lots don't add up (every shop), and what the newest-layers rule keeps.
with l as (select shop_id, key, sum(coalesce(qty, 0)) as lots, count(*) as layers from stock_lots group by 1, 2),
k as (select coalesce(s.shop_id, l.shop_id) as shop_id, coalesce(s.key, l.key) as key, greatest(0, coalesce(s.qty, 0)) as stock, coalesce(l.lots, 0) as lots, coalesce(l.layers, 0) as layers
        from stock s full join l on l.shop_id = s.shop_id and l.key = s.key)
select (select name from shops where id = k.shop_id) as shop, k.key, trim_scale(k.stock) as stock, trim_scale(k.lots) as lots, k.layers,
       case when k.lots > k.stock then 'trim ' || trim_scale(k.lots - k.stock) || ' from the oldest layers'
            else 'add one layer of ' || trim_scale(k.stock - k.lots) || ' at ' || coalesce(ow_last_known_cost(k.shop_id, k.key, (select product_id from stock where shop_id = k.shop_id and key = k.key), (select variant_idx from stock where shop_id = k.shop_id and key = k.key))::text, 'no known cost') end as rule
  from k where abs(k.lots - k.stock) > 0.0001
 order by 1, abs(k.lots - k.stock) desc;

-- #0166 and #0148 (test data, voided with money), and whether they are marked test yet.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id, q.client_name, q.voided, q.amount_paid, q.qa, q.payload -> 'voidMoney' as void_money,
       (select array_agg(c.id || ' qa=' || c.qa) from cash_txns c where c.shop_id = shop.id and c.quote_id = q.id) as receipts
  from saved_quotes q, shop where q.shop_id = shop.id and q.id in (166, 148);

-- Cash lines with fractions of a shilling, and the adjustment each gets.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select c.id, c.date, c.account, c.type, c.category, c.amount, round(c.amount) as rounded, round(c.amount) - c.amount as adjustment
  from cash_txns c, shop where c.shop_id = shop.id and c.amount <> round(c.amount) order by c.id;

-- Targets past their last day, still open.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select n.id, n.body ->> 'metric' as metric, n.body ->> 'aim' as aim, n.body ->> 'from' as from_day, n.body ->> 'to' as to_day
  from manager_notes n, shop where n.shop_id = shop.id and n.kind = 'target' and n.status = 'open'
   and (n.body ->> 'to') ~ '^\d{4}-\d{2}-\d{2}$' and (n.body ->> 'to')::date < ow_today();

-- Payments dated before their order, not yet labelled or noted Deposit.
with shop as (select id from shops where name = 'Omni-ware (old records)')
select q.id, q.client_name, q.date as order_date, p ->> 'date' as paid_on, ow_num(p ->> 'amount') as amount, p ->> 'note' as note
  from saved_quotes q, shop, jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) p
 where q.shop_id = shop.id and q.date is not null and (p ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' and (p ->> 'date')::date < q.date
   and coalesce(p ->> 'label', '') <> 'Deposit' and coalesce(p ->> 'note', '') <> 'Deposit'
 order by q.id;

-- =====================================================================
-- THE CORRECTION
-- =====================================================================
begin;
select set_config('ow.money_fix', 'on', true);

do $fix$
declare
  -- ---- Kevin's switches (set as he chose, 25 Oct 2026) ----------------
  -- #0415: the 400,000 cash payment that names a momo receipt of 500,000.
  --   'record'       it was paid in cash: a 400,000 cash receipt of its day is added and the payment names it
  --   'relink:<id>'  it belongs to that existing receipt (a free 400,000 cash receipt), e.g. 'relink:19304'
  --   null           leave it
  fix_415 text := 'record';
  -- Stock keys whose lots don't add up: true rebuilds the lots to the stock.
  fix_lots boolean := true;
  --   'newest'  the newest layers that add up to the stock stay (the oldest goods left first)
  --   'oldest'  the oldest layers stay
  lots_rule text := 'newest';
  --   every shop (the check is strict in every shop), or only the old-records shop
  lots_all_shops boolean := true;
  -- #0166 Muyanja and #0148 Adinan: test data, voided with money on them. true marks them
  -- (and their receipts) test: kept, listed, in no figure. No refund, no deposit.
  fix_test_voids boolean := true;
  test_voids bigint[] := array[166, 148];
  -- Fractions of a shilling in the cash book: rounded, each listed as a NOTICE.
  fix_fractions boolean := true;
  -- Targets past their last day: ended, with their result.
  fix_targets boolean := true;
  -- Payments dated before their order: labelled Deposit (nothing moves).
  fix_labels boolean := true;
  -- ---------------------------------------------------------------------
  shop uuid := (select id from shops where name = 'Omni-ware (old records)');
  own uuid;
  own_name text;
  q saved_quotes%rowtype;
  c cash_txns%rowtype;
  p jsonb;
  pays jsonb;
  n int;
  m int;
  r record;
  lot record;
  sh record;
  k_stock numeric;
  k_lots numeric;
  keep_left numeric;
  v_cost numeric;
  floor_id bigint;
  new_id bigint;
  target bigint;
  res jsonb;
begin
  if shop is null then raise exception 'No shop called Omni-ware (old records).'; end if;
  select mm.user_id into own from shop_members mm where mm.shop_id = shop and mm.role = 'owner' limit 1;
  own_name := coalesce((select s.name from staff s where s.shop_id = shop and s.user_id = own limit 1), 'Owner');

  -- ---- #0415 (MGR-DATA-01): the 400,000 cash payment names a momo receipt.
  if fix_415 is not null then
    select * into q from saved_quotes where shop_id = shop and id = 415 for update;
    select e into p from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end) e
      left join cash_txns x on x.shop_id = shop and x.id::text = e ->> 'cashTxnId'
     where round(ow_num(e ->> 'amount')) = 400000 and coalesce(e ->> 'cashTxnId', '') <> ''
       and (x.id is null or round(x.amount) <> 400000 or lower(coalesce(x.account, '')) <> lower(coalesce(e ->> 'method', 'cash')) or x.quote_id is distinct from 415)
     limit 1;
    if q.id is null or p is null then
      raise notice '#0415: skipped, no 400,000 payment on it naming a receipt that is not its own (already corrected?).';
    else
      if fix_415 = 'record' then
        select coalesce(max(id), 0) into floor_id from cash_txns where shop_id = shop;
        new_id := ow_next_row_id(shop, 'row:cash_txn', floor_id);
        insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
        values (new_id, shop, coalesce(case when (p ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'date')::date end, q.date, ow_today()),
                coalesce(nullif(lower(p ->> 'method'), ''), 'cash'), 'receipt', 'Invoice Payment', 400000,
                'Payment — #0415 (recorded in Manager round 1)', '00:00', 415, own);
      elsif fix_415 like 'relink:%' then
        new_id := nullif(regexp_replace(substr(fix_415, 8), '\D', '', 'g'), '')::bigint;
        select * into c from cash_txns where shop_id = shop and id = new_id;
        if c.id is null or c.type <> 'receipt' or round(c.amount) <> 400000 or (c.quote_id is not null and c.quote_id <> 415)
           or lower(coalesce(c.account, '')) <> lower(coalesce(p ->> 'method', 'cash'))
           or exists (select 1 from saved_quotes o, jsonb_array_elements(case when jsonb_typeof(o.payload -> 'payments') = 'array' then o.payload -> 'payments' else '[]'::jsonb end) e
                       where o.shop_id = shop and e ->> 'cashTxnId' = c.id::text) then
          raise notice '#0415: skipped, receipt % is not a free 400,000 % receipt. Choose record, or another receipt.', new_id, coalesce(p ->> 'method', 'cash');
          new_id := null;
        else
          update cash_txns set quote_id = 415 where shop_id = shop and id = c.id;
        end if;
      else
        raise notice '#0415: skipped, fix_415 is not record or relink:<id>.';
        new_id := null;
      end if;
      if new_id is not null then
        update saved_quotes set payload = payload || jsonb_build_object('payments',
                 (select jsonb_agg(case when e = p then e || jsonb_build_object('cashTxnId', new_id) else e end) from jsonb_array_elements(q.payload -> 'payments') e))
         where shop_id = shop and id = 415;
        perform ow_log(shop, own, own_name, 'owner', 'books.correct',
          '#0415: the 400,000 ' || coalesce(p ->> 'method', 'cash') || ' payment now names its own receipt ' || new_id || ' (it named ' || (p ->> 'cashTxnId') || ', which stays a debt payment)', 400000,
          jsonb_build_object('table', 'saved_quotes', 'id', 415), jsonb_build_object('cashTxnId', p ->> 'cashTxnId'), jsonb_build_object('cashTxnId', new_id, 'how', fix_415));
      end if;
    end if;
  end if;

  -- ---- Stock keys whose lots don't add up (MGR-DATA-03), computed from the data.
  if fix_lots then
    if lots_rule not in ('newest', 'oldest') then raise exception 'lots_rule is newest or oldest.'; end if;
    n := 0;
    for sh in select s.id, (select mm.user_id from shop_members mm where mm.shop_id = s.id and mm.role = 'owner' limit 1) as own_id
                from shops s where lots_all_shops or s.id = shop order by s.id loop
      for r in
        with l as (select key, sum(coalesce(qty, 0)) as lots from stock_lots where shop_id = sh.id group by key)
        select coalesce(s.key, l.key) as key, s.product_id, s.variant_idx, greatest(0, coalesce(s.qty, 0)) as stock, coalesce(l.lots, 0) as lots
          from (select * from stock where shop_id = sh.id) s full join l on l.key = s.key
         where abs(coalesce(l.lots, 0) - greatest(0, coalesce(s.qty, 0))) > 0.0001
         order by 1
      loop
        if r.lots > r.stock then
          -- Keep layers from one end until they hold the stock; trim the layer at the edge; drop the rest.
          keep_left := r.stock;
          for lot in select id, qty from stock_lots where shop_id = sh.id and key = r.key
                      order by case when lots_rule = 'newest' then -id else id end loop
            if keep_left <= 0 or coalesce(lot.qty, 0) <= 0 then
              delete from stock_lots where id = lot.id;
            elsif lot.qty <= keep_left then
              keep_left := keep_left - lot.qty;
            else
              update stock_lots set qty = keep_left where id = lot.id;
              keep_left := 0;
            end if;
          end loop;
        else
          v_cost := ow_last_known_cost(sh.id, r.key, r.product_id, r.variant_idx);
          insert into stock_lots (shop_id, key, qty, cost) values (sh.id, r.key, round(r.stock - r.lots, 6), v_cost);
        end if;
        select coalesce(max(id), 0) into floor_id from stock_log where shop_id = sh.id;
        insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at)
        values (ow_next_row_id(sh.id, 'row:stock_log', floor_id), sh.id, r.key, r.product_id, r.variant_idx,
                coalesce((select name from products where shop_id = sh.id and id = r.product_id), r.key), 'correction', 0, r.stock,
                'Lots matched to stock (Manager round 1): lots ' || trim_scale(r.lots) || ' → ' || trim_scale(r.stock)
                  || case when r.lots > r.stock then ', the ' || lots_rule || ' layers kept' else ', one layer added at ' || coalesce(ow_money(v_cost), 'no known cost') end,
                ow_today(), now());
        perform ow_log(sh.id, sh.own_id, null, 'owner', 'books.correct',
          'Stock ' || r.key || ': its lots (' || trim_scale(r.lots) || ') matched to the stock (' || trim_scale(r.stock) || ')', null,
          jsonb_build_object('table', 'stock_lots', 'key', r.key), jsonb_build_object('lots', r.lots), jsonb_build_object('lots', r.stock, 'rule', lots_rule));
        n := n + 1;
      end loop;
    end loop;
    if n = 0 then raise notice 'Stock lots: every key adds up already.'; else raise notice 'Stock lots: % key(s) matched to their stock.', n; end if;
  end if;

  -- ---- #0166, #0148 (MGR-DATA-07; Kevin: test data): marked test, kept, in no figure.
  if fix_test_voids then
    update saved_quotes set qa = true where shop_id = shop and id = any(test_voids) and not qa;
    get diagnostics n = row_count;
    update cash_txns set qa = true where shop_id = shop and quote_id = any(test_voids) and not qa;
    get diagnostics m = row_count;
    if n + m = 0 then
      raise notice '#0166, #0148: nothing left to mark test (already marked, or not there).';
    else
      perform ow_log(shop, own, own_name, 'owner', 'books.correct',
        'Test records marked: ' || n || ' order(s) (' || array_to_string(test_voids, ', ') || ') and ' || m || ' receipt(s); voided with money, kept, in no figure', null,
        jsonb_build_object('table', 'saved_quotes', 'ids', to_jsonb(test_voids)), jsonb_build_object('qa', false), jsonb_build_object('qa', true));
    end if;
  end if;

  -- ---- Fractions of a shilling (MGR-DATA-10): each cash line rounded, listed.
  if fix_fractions then
    n := 0;
    for c in select * from cash_txns where shop_id = shop and amount <> round(amount) order by id for update loop
      raise notice 'Cash line %: % → % (adjustment %)', c.id, c.amount, round(c.amount), round(c.amount) - c.amount;
      update cash_txns set amount = round(amount) where shop_id = shop and id = c.id;
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', 'Cash line ' || c.id || ' rounded to whole shillings: ' || c.amount || ' → ' || round(c.amount),
        round(c.amount) - c.amount, jsonb_build_object('table', 'cash_txns', 'id', c.id), jsonb_build_object('amount', c.amount), jsonb_build_object('amount', round(c.amount)));
      n := n + 1;
    end loop;
    if n = 0 then raise notice 'Fractions: none left.'; end if;
  end if;

  -- ---- Targets past their last day (MGR-DATA-14).
  if fix_targets then
    res := ow_end_targets(shop);
    n := jsonb_array_length(res -> 'ended');
    if n = 0 then
      raise notice 'Targets: none past their day still open.';
    else
      perform ow_log(shop, own, own_name, 'owner', 'books.correct', n || ' target(s) past their last day ended, with their result', null,
        jsonb_build_object('table', 'manager_notes'), jsonb_build_object('status', 'open'), res -> 'ended');
    end if;
  end if;

  -- ---- Payments dated before their order (MGR-DATA-11): labelled Deposit, nothing moves.
  -- A payment Sales round 2 already noted "Deposit" (its fix_labels) is left as it is.
  if fix_labels then
    for q in select * from saved_quotes x where x.shop_id = shop and x.date is not null and jsonb_typeof(x.payload -> 'payments') = 'array' order by x.id for update loop
      pays := '[]'::jsonb; n := 0;
      for p in select e from jsonb_array_elements(q.payload -> 'payments') e loop
        if (p ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' and (p ->> 'date')::date < q.date
           and coalesce(p ->> 'label', '') <> 'Deposit' and coalesce(p ->> 'note', '') <> 'Deposit' and coalesce(p ->> 'deposit', '') <> 'true' then
          p := p || jsonb_build_object('label', 'Deposit') || case when coalesce(p ->> 'note', '') = '' then jsonb_build_object('note', 'Deposit') else '{}'::jsonb end;
          n := n + 1;
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
end $fix$;

commit;

-- =====================================================================
-- CHECK AFTERWARDS: run round-1-check.sql again (queries 1, 2, 5, 7, 8, 9
-- and 11 should be empty, and #0415 should show its own cash receipt); and:
-- =====================================================================
-- What this script did:
--   select at, what, amount from decision_log where task = 'books.correct' and at > now() - interval '1 hour' order by at;
-- Every stock key adds up (every shop):
--   select s.shop_id, s.key, s.qty, (select sum(qty) from stock_lots l where l.shop_id = s.shop_id and l.key = s.key) from stock s
--    where abs(greatest(0, s.qty) - coalesce((select sum(qty) from stock_lots l where l.shop_id = s.shop_id and l.key = s.key), 0)) > 0.0001;
-- The test voids, marked:
--   select id, voided, amount_paid, qa from saved_quotes where id in (166, 148);
