-- 0138: the audit of 19 October 2026, part three -- found by driving one
-- order from Sales through Buyer, Store and Manager on a database with two
-- shops in it.
--
-- 1. Row ids are one sequence per table, so the allocator floors there.
--
--    cash_txns, customer_debt_log, prices, purchase_invoices, saved_quotes,
--    stock_log, fixed_assets, loans, rent_agreements, dues, media,
--    media_folders and wa_posts all have `primary key (id)` -- one id space
--    per table, every shop in it. 0034 moved their ids to counters in
--    entity_id_counters keyed by (shop, kind), each floored by "the highest
--    id THIS shop has". Two shops in one database (environments.md: every
--    owner who signs up gets one) therefore issue the same numbers, and the
--    second write fails on the primary key. The Manager's invoice hit it
--    first: ow_invoice_core's debt-log line and supplier bill floor per shop
--    (0119, kept by 0135 and 0136), so "Invoice" said "duplicate key value
--    violates unique constraint customer_debt_log_pkey" and the order stayed
--    unbilled. ow_stock_move, accept_stock_count, manager_apply_stock_lines
--    and next_stock_log_id floor stock_log the same way; every app's
--    issueRowId floors by what it has loaded. 0136 had already floored the
--    counter sale's order and cash line table-wide; this does it once, for
--    every caller, inside the two allocators.
--
--    apply_momo_payment (0109) inserts its cash line WITHOUT an id and so
--    draws from cash_txns' identity sequence, which nothing has advanced
--    since 0034: on an established shop its next value is an id the counter
--    issued long ago, and the mobile-money receipt fails on the primary key.
--    The allocator now keeps each table's sequence at or above what it
--    issues, and floors on the sequence too, so a default insert and a
--    counter never meet.
--
--    How: ow_next_row_id and next_row_id_blocks take one advisory
--    transaction lock per kind (every shop waits its turn, microseconds),
--    raise the floor to the greatest of the caller's floor, the table's
--    max(id), every shop's counter for that kind and the identity sequence,
--    reserve from the shop's counter as before, and setval the sequence past
--    the run. Kinds whose tables key on (shop_id, id) -- follow_ups,
--    payment_promises, product_links, briefs_sent, statements_sent -- and the
--    two document-number kinds (credit notes, supplier credits) keep their
--    per-shop numbering: nothing else shares it.
--
-- 2. The price a trip paid, or a supplier said on the phone, lands on the
--    side of the list it was bought on.
--
--    A price row carries a wholesale price (per unit, buying a pack or more)
--    and a retail one (per unit, under a pack). The order costs a line on the
--    natural side for its quantity (sales.html purchaseSideAtQty), but
--    trip_prices_to_list (0136) and buyer_confirm_price (0136) always wrote
--    the price paid to `wholesale`. Three lengths of hollow section at the
--    retail 55,000 came back from Kiseka and overwrote the wholesale 52,000.
--    Both now pick the side the quantity was bought on (ow_price_side); the
--    phone confirmation takes the quantity as a new optional argument and
--    keeps writing wholesale when not told.
--
-- 3. 'price.changed' (0120) pushes the salesperson only when the price THEIR
--    line carries has moved.
--
--    prices_ow_push fired on any change to wholesale, retail or tiers and
--    told the taker "X is now <retail or wholesale>. Tell them." -- after
--    item 2's trip, Grace was told a price changed on Kato's order when the
--    line's own price was the same 55,000. It now prices each matching line
--    at its quantity (ow_units_bought, ow_tiered_unit_price) and pushes only
--    when that figure differs from the price on the line, naming the new
--    figure.
--
-- Safe to re-run.

/* ---------------- 1. the allocators ---------------- */
-- The table a row-id kind numbers, when that table keys on id alone.
create or replace function ow_row_id_table(p_kind text) returns text
language sql immutable as $$
  select case p_kind
    when 'row:cash_txn' then 'cash_txns'
    when 'row:debt_log' then 'customer_debt_log'
    when 'row:price' then 'prices'
    when 'row:purchase_invoice' then 'purchase_invoices'
    when 'row:saved_quote' then 'saved_quotes'
    when 'row:stock_log' then 'stock_log'
    when 'row:fixed_asset' then 'fixed_assets'
    when 'row:loan' then 'loans'
    when 'row:rent_agreement' then 'rent_agreements'
    when 'row:due' then 'dues'
    when 'row:media' then 'media'
    when 'row:media_folder' then 'media_folders'
    when 'row:wa_post' then 'wa_posts'
    else null end
$$;

-- Reserves `p_count` ids of `p_kind` for `p_shop_id`, never at or below
-- `p_floor`, never at or below anything already in the table, issued to any
-- shop, or handed out by the table's own sequence. Returns the LAST id of the
-- run. Serialised per kind.
create or replace function ow_reserve_row_ids(p_shop_id uuid, p_kind text, p_floor bigint, p_count integer)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  t text := ow_row_id_table(p_kind);
  seq text;
  f bigint := greatest(coalesce(p_floor, 0), 0);
  m bigint;
  n integer := greatest(coalesce(p_count, 1), 1);
  v bigint;
begin
  if t is not null and to_regclass('public.' || t) is not null then
    perform pg_advisory_xact_lock(hashtext('ow_row_id:' || p_kind));
    execute format('select coalesce(max(id), 0) from %I', t) into m;
    f := greatest(f, m);
    select coalesce(max(last_issued), 0) into m from entity_id_counters where kind = p_kind;
    f := greatest(f, m);
    seq := pg_get_serial_sequence(t, 'id');
    if seq is not null then
      execute format('select case when is_called then last_value else last_value - 1 end from %s', seq) into m;
      f := greatest(f, coalesce(m, 0));
    end if;
  end if;
  -- The ON CONFLICT branch takes a row lock, so two callers on one shop
  -- serialise here even for a kind with no table of its own.
  insert into entity_id_counters (shop_id, kind, last_issued)
       values (p_shop_id, p_kind, f + n)
  on conflict (shop_id, kind) do update
          set last_issued = greatest(entity_id_counters.last_issued, f) + n
    returning last_issued into v;
  if seq is not null then
    perform setval(seq, v, true);
  end if;
  return v;
end $$;
revoke all on function ow_reserve_row_ids(uuid, text, bigint, integer) from public;

-- 0119's one-id form, used inside the server's own writes.
create or replace function ow_next_row_id(p_shop_id uuid, p_kind text, p_floor bigint) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  return ow_reserve_row_ids(p_shop_id, p_kind, p_floor, 1);
end $$;

-- 0034's block form, called by every app.
create or replace function next_row_id_blocks(p_shop_id uuid, p_kinds text[], p_count integer default 10, p_floors jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text;
  n int := greatest(coalesce(p_count, 10), 1);
  v bigint;
  out jsonb := '{}'::jsonb;
begin
  if not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop';
  end if;
  if p_kinds is null or array_length(p_kinds, 1) is null then
    raise exception 'at least one kind is required';
  end if;
  foreach k in array p_kinds loop
    if k !~ '^row:[a-z_]+$' then
      raise exception 'unknown row id kind: %', k;
    end if;
    v := ow_reserve_row_ids(p_shop_id, k, coalesce((p_floors ->> k)::bigint, 0), n);
    out := out || jsonb_build_object(k, v - n + 1);
  end loop;
  return out;
end $$;

-- Bring every shop's counters and every sequence up to what is in the tables
-- today, so the first allocation after this file is already clear.
do $$
declare
  k text;
  t text;
  seq text;
  m bigint;
begin
  foreach k in array array['row:cash_txn', 'row:debt_log', 'row:price', 'row:purchase_invoice', 'row:saved_quote', 'row:stock_log',
                           'row:fixed_asset', 'row:loan', 'row:rent_agreement', 'row:due', 'row:media', 'row:media_folder', 'row:wa_post'] loop
    t := ow_row_id_table(k);
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select coalesce(max(id), 0) from %I', t) into m;
    select greatest(m, coalesce(max(last_issued), 0)) into m from entity_id_counters where kind = k;
    update entity_id_counters set last_issued = m where kind = k and last_issued < m;
    seq := pg_get_serial_sequence(t, 'id');
    if seq is not null and m > 0 then
      perform setval(seq, m, true);
    end if;
  end loop;
end $$;

/* ---------------- 2. the side of the list a price lands on ---------------- */
-- 'wholesale' when the quantity (in base units) makes a pack or more and the
-- row has a wholesale price, else 'retail'; the other side when the natural
-- one is empty. sales.html purchaseSideAtQty, without the tiers.
create or replace function ow_price_side(r prices, p_units numeric) returns text
language sql immutable as $$
  select case
    when (coalesce(r.pack_qty, 0) > 0 and coalesce(p_units, 0) >= r.pack_qty) then
      case when r.wholesale is null and r.retail is not null then 'retail' else 'wholesale' end
    else
      case when r.retail is null and r.wholesale is not null then 'wholesale' else 'retail' end
  end
$$;

create or replace function trip_prices_to_list(p_shop_id uuid, p_trip_id text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  t collection_trips%rowtype;
  l jsonb;
  r prices%rowtype;
  n integer := 0;
  each_price numeric;
  side text;
  was numeric;
begin
  if not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'trip.collect')) then
    raise exception 'Updating prices from a trip needs trip.collect.' using errcode = '42501';
  end if;
  select * into t from collection_trips where shop_id = p_shop_id and id = p_trip_id;
  if not found then
    raise exception 'No such trip.' using errcode = 'P0002';
  end if;
  for l in select * from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) loop
    if (l->>'gotPrice') is null or (l->>'productId') is null then continue; end if;
    -- gotPrice is kept per base unit, the way the price list keeps it.
    each_price := (l->>'gotPrice')::numeric;
    if each_price is null or each_price < 0 then continue; end if;
    for r in select * from prices
              where shop_id = p_shop_id and supplier_id = t.supplier_id and product_id = l->>'productId'
                and coalesce(variant_idx::text, '') = coalesce(l->>'variantIdx', '')
    loop
      side := ow_price_side(r, ow_units_bought(p_shop_id, l || jsonb_build_object('supplierId', t.supplier_id)));
      was := case when side = 'retail' then r.retail else r.wholesale end;
      update prices
         set wholesale = case when side = 'retail' then wholesale else each_price end,
             retail = case when side = 'retail' then each_price else retail end,
             date = current_date, price_source = 'purchase', last_asked_at = null,
             confirmed_by = auth.uid(), confirmed_via = 'trip'
       where id = r.id;
      n := n + 1;
      if to_regclass('public.decision_log') is not null then
        execute 'insert into decision_log (shop_id, by, role, task, what, amount, ref, before, after)
                 values ($1, auth.uid(), ''buyer'', ''price.confirm'', $2, $3, $4, $5, $6)'
          using p_shop_id,
                'Price paid on trip ' || p_trip_id || ' (' || side || '): ' || coalesce(was::text, '—') || ' → ' || each_price::text,
                each_price,
                jsonb_build_object('table', 'prices', 'id', r.id),
                jsonb_build_object(side, was),
                jsonb_build_object(side, each_price, 'how', 'trip');
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- The phone confirmation, now with the quantity it was said for. Without one
-- it keeps 0136's behaviour (the wholesale side).
drop function if exists buyer_confirm_price(uuid, bigint, numeric);
create or replace function buyer_confirm_price(p_shop_id uuid, p_price_id bigint, p_wholesale numeric, p_qty numeric default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  was prices%rowtype;
  side text := 'wholesale';
  before_price numeric;
begin
  if not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'price.confirm')) then
    raise exception 'Confirming a price needs price.confirm.' using errcode = '42501';
  end if;
  if p_wholesale is not null and p_wholesale < 0 then
    raise exception 'A price is never below zero.' using errcode = '22023';
  end if;
  select * into was from prices where id = p_price_id and shop_id = p_shop_id;
  if not found then
    raise exception 'No such price on this shop''s list.' using errcode = 'P0002';
  end if;
  if p_qty is not null then side := ow_price_side(was, p_qty); end if;
  before_price := case when side = 'retail' then was.retail else was.wholesale end;
  update prices
     set wholesale = case when side = 'retail' then wholesale else coalesce(p_wholesale, wholesale) end,
         retail = case when side = 'retail' then coalesce(p_wholesale, retail) else retail end,
         date = current_date,
         price_source = 'confirmed',
         last_asked_at = null,
         confirmed_by = auth.uid(),
         confirmed_via = 'phone'
   where id = p_price_id and shop_id = p_shop_id;
  if to_regclass('public.decision_log') is not null then
    execute 'insert into decision_log (shop_id, by, role, task, what, amount, ref, before, after)
             values ($1, auth.uid(), ''buyer'', ''price.confirm'', $2, $3, $4, $5, $6)'
      using p_shop_id,
            'Price confirmed by phone (' || side || '): ' || coalesce(before_price::text, '—') || ' → ' || coalesce(p_wholesale, before_price)::text,
            coalesce(p_wholesale, before_price),
            jsonb_build_object('table', 'prices', 'id', p_price_id),
            jsonb_build_object(side, before_price),
            jsonb_build_object(side, coalesce(p_wholesale, before_price), 'how', 'phone');
  end if;
end $$;
grant execute on function buyer_confirm_price(uuid, bigint, numeric, numeric) to authenticated;

/* ---------------- 3. price.changed only when the line's price moved ---------------- */
create or replace function prices_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  q record;
  pname text;
  units numeric;
  side text;
  now_each numeric;
begin
  if new.wholesale is not distinct from old.wholesale and new.retail is not distinct from old.retail
     and new.tiers is not distinct from old.tiers then
    return null;
  end if;
  select name into pname from products where shop_id = new.shop_id and id = new.product_id;
  for q in
    select s.id, coalesce(nullif(s.client_name, ''), 'an order') as client, ow_uuid(s.payload ->> 'takenBy') as taker, e.line
      from saved_quotes s
      cross join lateral jsonb_array_elements(case when jsonb_typeof(s.payload -> 'items') = 'array' then s.payload -> 'items' else '[]'::jsonb end) as e(line)
     where s.shop_id = new.shop_id and s.status in ('draft', 'awaiting_goods') and not s.invoiced and not s.voided
       and ow_uuid(s.payload ->> 'takenBy') is not null
       and e.line ->> 'productId' = new.product_id and e.line ->> 'supplierId' = new.supplier_id
       and ow_num(e.line ->> 'variantIdx') is not distinct from ow_num(new.variant_idx)
  loop
    -- What the line would cost now, at its quantity, on the side it buys on.
    units := ow_units_bought(new.shop_id, q.line);
    side := ow_price_side(new, units);
    now_each := coalesce(ow_tiered_unit_price(new, units, side), ow_tiered_unit_price(new, units, case when side = 'wholesale' then 'retail' else 'wholesale' end));
    if now_each is null or now_each is not distinct from ow_num(q.line ->> 'price') then continue; end if;
    perform ow_push(new.shop_id, 'price.changed', 'A price changed on your order',
      q.client || ' — ' || coalesce(pname, 'an item') || ' is now ' || ow_money(now_each) || '. Tell them.',
      q.taker, null, null, jsonb_build_object('table', 'saved_quotes', 'id', q.id),
      'pricechg:' || q.id || ':' || new.id || ':' || ow_today());
  end loop;
  return null;
exception when others then
  raise notice 'push (price): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists prices_ow_push on prices;
create trigger prices_ow_push after update on prices
  for each row execute function prices_ow_push();

/* ---------------- 4. a cash trip's money reaches the books ---------------- */
-- Driving the order through: Denis left with 200,000, paid Kiseka 165,000 for
-- Kato's steel, brought 35,000 back; Esther counted it and the app said
-- "it agrees". The cash book had none of it -- the 165,000 paid at the stop
-- was never written -- and the supplier bill the invoice raised for the same
-- steel stood at 165,000 OWED. The day's close would then find the drawer
-- 165,000 short and book a shortage, and Bills would say we owe Kiseka for
-- goods paid in cash at their yard. accounts.html's slide booked only the
-- difference (0123).
--
-- trip_cash_count does the count in one write: one 'Stock Purchase' cash
-- line per stop for what was paid there, a short/over line for the
-- difference (as before), the trips' cash_count, the bills of the orders on
-- the trip marked paid by it, and the owner's log line. A bill raised later
-- for goods a cash trip already paid for is born paid (the before-insert
-- trigger below, so the hourly auto-invoice is covered too) and names the
-- trip; when the count comes after the bill, the count links its cash line
-- to that payment instead of adding a second one.

-- What a trip line's buyer paid at the stop: what came, at the price paid
-- (or the expected price when none was typed). accounts.html tripLinePaid.
create or replace function ow_trip_line_paid(l jsonb) returns numeric
language sql immutable as $$
  select case when ow_num(l ->> 'gotQty') is null or ow_num(l ->> 'gotQty') < 0 then 0
              else ow_num(l ->> 'gotQty') * coalesce(ow_num(l ->> 'gotPrice'), ow_num(l ->> 'expectedPrice'), 0) end
$$;

-- Is this a trip whose buyer paid the stops from the shop's cash?
create or replace function ow_trip_is_cash(t collection_trips) returns boolean
language sql immutable as $$
  select not coalesce(t.voided, false) and t.cash_given is not null
     and coalesce(t.assigned_worker_id, '') <> '__supplier__'
     and t.status in ('collected', 'confirmed')
$$;

-- The counter's name for the log line (staff name, else the login's email).
create or replace function ow_staff_name_of(p_uid uuid, p_shop_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select s.name from staff s where s.shop_id = p_shop_id and s.user_id = p_uid limit 1),
                  (select u.email from auth.users u where u.id = p_uid), '')
$$;
revoke all on function ow_staff_name_of(uuid, uuid) from public;

create or replace function trip_cash_count(p_shop_id uuid, p_trip_ids text[], p_counted numeric)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d date := ow_today();
  hm text := to_char(now() at time zone ow_shop_tz(), 'HH24:MI');
  t collection_trips%rowtype;
  trips collection_trips[] := '{}';
  given numeric := 0;
  paid numeric := 0;
  paid_t numeric;
  counted numeric := round(coalesce(p_counted, 0));
  diff numeric;
  buyer_name text;
  sup_name text;
  floor_id bigint;
  line_id bigint;
  diff_id bigint := null;
  lines jsonb := '[]'::jsonb;
  cnt jsonb;
  b record;
  bill_paid numeric;
  pays jsonb;
  linked boolean;
  i integer;
  bills jsonb := '[]'::jsonb;
begin
  if uid is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'trip.cash')) then
    raise exception 'Counting a trip''s cash needs trip.cash.' using errcode = '42501';
  end if;
  if p_trip_ids is null or array_length(p_trip_ids, 1) is null then
    raise exception 'No trip to count.' using errcode = '22023';
  end if;
  for t in select * from collection_trips where shop_id = p_shop_id and id = any(p_trip_ids) order by collected_at, id for update loop
    if not ow_trip_is_cash(t) then
      raise exception 'Trip % carried no shop cash, or is not back yet.', t.id using errcode = '22023';
    end if;
    if t.cash_count is not null then
      raise exception 'Trip % is counted already.', t.id using errcode = '22023';
    end if;
    trips := trips || t;
    given := given + coalesce(t.cash_given, 0);
  end loop;
  if array_length(trips, 1) is null then
    raise exception 'No such trip.' using errcode = 'P0002';
  end if;
  select coalesce(s.name, 'the buyer') into buyer_name from staff s where s.shop_id = p_shop_id and s.id = trips[1].assigned_worker_id;
  buyer_name := coalesce(buyer_name, 'the buyer');

  -- One line per stop: the cash that stayed at the supplier.
  foreach t in array trips loop
    select coalesce(sum(ow_trip_line_paid(l)), 0) into paid_t from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) l;
    paid_t := round(paid_t);
    paid := paid + paid_t;
    if paid_t <= 0 then continue; end if;
    select coalesce(s.name, t.supplier_id) into sup_name from suppliers s where s.shop_id = p_shop_id and s.id = t.supplier_id;
    select coalesce(max(id), 0) into floor_id from cash_txns;
    line_id := ow_next_row_id(p_shop_id, 'row:cash_txn', floor_id);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, entered_by)
         values (line_id, p_shop_id, d, 'cash', 'payment', 'Stock Purchase', paid_t,
                 'Paid at ' || coalesce(sup_name, 'the supplier') || ' on ' || buyer_name || '''s trip ' || t.id, hm, uid);
    lines := lines || jsonb_build_object('tripId', t.id, 'cashTxnId', line_id, 'amount', paid_t, 'supplierId', t.supplier_id);
    -- The bills already raised for orders on this trip: paid by it.
    for b in select pi.id, pi.payload, pi.quote_id from purchase_invoices pi
              where pi.shop_id = p_shop_id and pi.payload ->> 'supplierId' = t.supplier_id
                and coalesce(pi.payload ->> 'voided', 'false') <> 'true'
                and pi.quote_id in (select ow_num(l ->> 'orderId')::bigint from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) l where ow_num(l ->> 'orderId') is not null)
    loop
      select coalesce(sum(ow_trip_line_paid(l)), 0) into bill_paid
        from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) l where ow_num(l ->> 'orderId')::bigint = b.quote_id;
      bill_paid := round(bill_paid);
      if bill_paid <= 0 then continue; end if;
      pays := case when jsonb_typeof(b.payload -> 'payments') = 'array' then b.payload -> 'payments' else '[]'::jsonb end;
      linked := false;
      -- Born paid by this trip at invoicing (trigger below): link the cash line, add nothing.
      for i in 0 .. jsonb_array_length(pays) - 1 loop
        if pays -> i ->> 'tripId' = t.id and (pays -> i ->> 'cashTxnId') is null then
          pays := jsonb_set(pays, array[i::text, 'cashTxnId'], to_jsonb(line_id));
          linked := true;
        end if;
      end loop;
      if linked then
        update purchase_invoices set payload = b.payload || jsonb_build_object('payments', pays) where id = b.id;
      else
        update purchase_invoices
           set payload = b.payload || jsonb_build_object('payments', pays || jsonb_build_object('date', d, 'amount', bill_paid, 'note', 'Paid on trip ' || t.id, 'via', 'trip', 'tripId', t.id, 'cashTxnId', line_id),
                                                         'amountPaid', coalesce(ow_num(b.payload ->> 'amountPaid'), 0) + bill_paid)
         where id = b.id;
      end if;
      bills := bills || jsonb_build_object('id', b.id, 'amount', bill_paid, 'linked', linked);
    end loop;
  end loop;

  -- The difference, booked the way a close difference is.
  diff := counted - (given - paid);
  if abs(diff) >= 1 then
    select coalesce(max(id), 0) into floor_id from cash_txns;
    diff_id := ow_next_row_id(p_shop_id, 'row:cash_txn', floor_id);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, entered_by)
         values (diff_id, p_shop_id, d, 'cash', case when diff < 0 then 'payment' else 'receipt' end,
                 case when diff < 0 then 'Cash Shortage' else 'Cash Overage' end, abs(diff),
                 (case when diff < 0 then 'Short' else 'Over' end) || ' on ' || buyer_name || '''s trip cash — ' || array_to_string(p_trip_ids, ', '), hm, uid);
  end if;
  cnt := jsonb_build_object('group', to_jsonb(p_trip_ids), 'given', given, 'paid', paid, 'expected', given - paid, 'counted', counted, 'diff', diff,
                            'cashTxnId', diff_id, 'paidTxns', lines, 'by', uid, 'byName', ow_staff_name_of(uid, p_shop_id), 'at', now());
  update collection_trips set cash_count = cnt where shop_id = p_shop_id and id = any(p_trip_ids);
  if to_regclass('public.decision_log') is not null then
    execute 'insert into decision_log (shop_id, by, role, task, what, amount, ref, after)
             values ($1, $2, ''accounts'', ''trip.cash'', $3, $4, $5, $6)'
      using p_shop_id, uid,
            buyer_name || '''s trip cash: given ' || ow_money(given) || ', paid ' || ow_money(paid) || ', back ' || ow_money(counted)
              || case when abs(diff) >= 1 then ' — ' || (case when diff < 0 then 'short ' else 'over ' end) || ow_money(abs(diff)) || ', booked' else ', agrees' end,
            diff, jsonb_build_object('table', 'collection_trips', 'id', trips[1].id), cnt;
  end if;
  return jsonb_build_object('given', given, 'paid', paid, 'counted', counted, 'diff', diff, 'cashTxnId', diff_id, 'paidTxns', lines, 'bills', bills, 'count', cnt,
                            'cashRows', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from cash_txns c
                                          where c.id = diff_id or c.id in (select (x ->> 'cashTxnId')::bigint from jsonb_array_elements(lines) x)));
end $$;
grant execute on function trip_cash_count(uuid, text[], numeric) to authenticated;

-- A bill for an order whose goods a cash trip paid for is born paid by that
-- trip. Runs before the accounts guard (alphabetical: 'born' < 'guard'), on
-- the Manager's invoice and the hourly one alike.
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
            where ct.shop_id = new.shop_id and ct.supplier_id = new.payload ->> 'supplierId' and ow_trip_is_cash(ct)
              and exists (select 1 from jsonb_array_elements(coalesce(ct.lines, '[]'::jsonb)) l where ow_num(l ->> 'orderId')::bigint = new.quote_id)
            order by ct.collected_at, ct.id
  loop
    select coalesce(sum(ow_trip_line_paid(l)), 0) into amt
      from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) l where ow_num(l ->> 'orderId')::bigint = new.quote_id;
    amt := round(amt);
    if amt <= 0 then continue; end if;
    -- Counted already: the cash line the count wrote for this stop.
    link := (select (x ->> 'cashTxnId')::bigint from jsonb_array_elements(coalesce(t.cash_count -> 'paidTxns', '[]'::jsonb)) x where x ->> 'tripId' = t.id limit 1);
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

/* ---------------- 5. an invoice tells Accounts and the salesperson ---------------- */
-- decision-rights.md: "Invoice a delivered order ... Told: Accounts, Sales";
-- the Manager's screen says "Accounts and the salesperson are told". Nothing
-- pushed. Now: 'order.invoiced' to whoever took the order (collect) and to
-- Accounts' invoice.send (send it).
create or replace function saved_quotes_ow_push4() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  client text;
  total numeric;
  label text;
  ref jsonb;
  money_words text;
begin
  if tg_op <> 'UPDATE' or not new.invoiced or old.invoiced or coalesce(new.voided, false) then return null; end if;
  client := coalesce(nullif(new.client_name, ''), 'an order');
  total := coalesce(ow_num(new.payload ->> 'debtCharged'), 0) + coalesce(new.amount_paid, 0);
  label := 'INV-' || case when length(new.id::text) < 4 then lpad(new.id::text, 4, '0') else new.id::text end;
  ref := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  money_words := case when coalesce(new.amount_paid, 0) >= total then ow_money(total) || ', paid'
                      when coalesce(new.amount_paid, 0) > 0 then ow_money(total) || ' · ' || ow_money(new.amount_paid) || ' paid, ' || ow_money(total - new.amount_paid) || ' due'
                      else ow_money(total) || ' due' end;
  perform ow_push(new.shop_id, 'order.invoiced', 'Invoiced — send it',
    label || ' for ' || client || ' — ' || money_words,
    null, 'invoice.send', null, ref, 'invoiced:acc:' || new.id);
  if ow_uuid(new.payload ->> 'takenBy') is not null then
    perform ow_push(new.shop_id, 'order.invoiced', 'Your order is invoiced',
      label || ' for ' || client || ' — ' || replace(money_words, ' due', ' to collect'),
      ow_uuid(new.payload ->> 'takenBy'), null, null, ref, 'invoiced:sales:' || new.id);
  end if;
  return null;
exception when others then
  raise notice 'push (invoiced %): % (%)', new.id, sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists saved_quotes_ow_push4 on saved_quotes;
create trigger saved_quotes_ow_push4 after update on saved_quotes
  for each row execute function saved_quotes_ow_push4();

/* ---------------- 6. Accounts can record a customer's payment ---------------- */
-- Esther slid "Record 243,625" for Kato's invoice: the cash line landed, then
-- the order update failed with "malformed array literal: agentPaymentStatus".
-- 0123's saved_quotes_accounts_guard appends a bare literal to a text array
-- (`free_keys || 'agentPaymentStatus'`), which Postgres reads as array ||
-- array and tries to parse the word as an array. Every Accounts login holds
-- agent.pay, so every payment Accounts recorded against an order stopped
-- part-way, with the money in the book and the debt still standing. The
-- same function, with array['agentPaymentStatus'].
create or replace function saved_quotes_accounts_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  if has_task(new.shop_id, 'agent.pay') then free_keys := free_keys || array['agentPaymentStatus']; end if;
  if (coalesce(new.payload, '{}'::jsonb) - free_keys) is distinct from (coalesce(old.payload, '{}'::jsonb) - free_keys) then
    raise exception 'An Accounts login records payments and sends; the order itself is not theirs to change.' using errcode = '42501';
  end if;
  return new;
end $$

;
