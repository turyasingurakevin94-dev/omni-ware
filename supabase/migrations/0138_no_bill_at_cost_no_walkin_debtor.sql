-- The end-to-end test of 19 Oct 2026 (Q-0541), fix 2: invoicing never bills
-- a line that still has no selling price, and never makes a debtor out of
-- a generic name.
--
-- 1. A line with no selling price ("price to confirm": no markup, or no
--    cost) was billed AT COST by ow_order_total(..., false), and the
--    balance over what was paid became debt. Q-0541: 6 such lines, a total
--    of 1,726,330 against 1,021,330 paid, 705,000 owed by nobody.
--    ow_invoice_core now refuses such an order (OWTPC), so the Manager's
--    Invoice button says why and the hourly run skips it.
-- 2. With no customer on the order, the balance went to a customer matched
--    or CREATED by the client's name, so "Walk-in" became a 705,000 debtor.
--    A generic name (Walk-in, Cash, Counter, Customer ...) is nobody now:
--    never matched, never created; a balance still owed with no customer
--    to owe it is refused (OWWLK) and goes back to the Manager.
-- 3. Fix 4: an order with a supplier's bill already recorded against it
--    (the console's bill form, "for a sale") could never be invoiced:
--    OWBIL refused it, by the button and the hourly run, so its stock never
--    left the shelf and no debt was raised (Q-0531, Q-0539, Q-0540). That
--    bill is kept now, and only the suppliers without one are billed: one
--    bill per supplier per order.
-- 4. Fix 10: a bill raised here had no dueDate, so Accounts > Bills read
--    "no date" for every one and "nothing due this week" was always true.
--    It is due on the supplier's terms now (suppliers.terms_days, 0106),
--    as Accounts' own bill form sets it. Older open bills: see BACKFILL.
-- 5. The hourly run told nobody what it skipped (the audit's section 4,
--    item 3). Each order it cannot invoice pushes the Manager once a day:
--    a price to set (price.approve), anything else (invoice.make).
--
-- ow_invoice_core is 0136's, with the marked changes (0138:).
-- Applied by hand after 0136. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select ow_generic_client('Walk-in'), ow_generic_client('Kato Construction');  -- true, false
--   select q.id, ow_order_unpriced(q.shop_id, q.payload -> 'items',
--          (select presets from app_settings a where a.shop_id = q.shop_id)) as unpriced
--     from saved_quotes q where q.status = 'completed' and not q.invoiced and not q.voided;
--
-- BACKFILL (fix 10, not run by this file; look first, then run it if the
-- rows are right): open bills with no due date, due on their date plus the
-- supplier's terms.
--   select pi.id, pi.date, s.name, s.terms_days, pi.date + s.terms_days as due
--     from purchase_invoices pi join suppliers s on s.shop_id = pi.shop_id and s.id = pi.payload ->> 'supplierId'
--    where coalesce(pi.payload ->> 'dueDate', '') = '' and s.terms_days is not null
--      and coalesce(pi.payload ->> 'voided', 'false') <> 'true' and pi.date is not null;
--   update purchase_invoices pi set payload = pi.payload || jsonb_build_object('dueDate', to_char(pi.date + s.terms_days, 'YYYY-MM-DD'))
--     from suppliers s where s.shop_id = pi.shop_id and s.id = pi.payload ->> 'supplierId'
--      and coalesce(pi.payload ->> 'dueDate', '') = '' and s.terms_days is not null
--      and coalesce(pi.payload ->> 'voided', 'false') <> 'true' and pi.date is not null;
--
-- ROLLBACK: run 0136's ow_invoice_core and 0119's ow_invoice_due_orders again;
--   drop function if exists ow_order_unpriced(uuid, jsonb, jsonb);
--   drop function if exists ow_generic_client(text);
-- ---------------------------------------------------------------------

-- A name that is nobody in particular.
create or replace function ow_generic_client(p_name text)
returns boolean
language sql immutable as $$
  select coalesce(lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'))
    ~ '^(walk[- ]?in( customer| client)?|walkin|cash( sale| customer| client)?|counter( sale| customer)?|customer|client|unknown|n/?a|none|-+|\.+)?$', true)
$$;

-- How many lines on an order still have no selling price (and are not
-- settled to nothing by a short pick).
create or replace function ow_order_unpriced(p_shop_id uuid, p_items jsonb, p_presets jsonb)
returns int
language sql stable as $$
  select count(*)::int
    from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) e
   where jsonb_typeof(e) = 'object'
     and coalesce(ow_num(e ->> 'qty'), 0) > 0
     and ow_line_to_confirm(p_shop_id, e, coalesce(p_presets, '{}'::jsonb))
$$;
revoke all on function ow_order_unpriced(uuid, jsonb, jsonb) from public, anon;

-- ---------------------------------------------------------------------
create or replace function ow_invoice_core(p_shop_id uuid, p_quote_id bigint, p_via text, p_by uuid, p_by_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q saved_quotes;
  pay jsonb;
  presets jsonb := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  tz text := ow_shop_tz();
  made date;
  inv_at date;
  inv_ts timestamptz;
  client text;
  items jsonb;
  out_items jsonb := '[]'::jsonb;
  it jsonb;
  vi numeric;
  conv record;
  need numeric;
  have numeric;
  take numeric;
  lots jsonb;
  surplus numeric;
  shortfall boolean := false;
  surplus_total numeric := 0;
  sid text;
  sids text[] := '{}';
  bill_items jsonb;
  base jsonb;
  bill_id bigint;
  bills jsonb := '[]'::jsonb;
  floor_id bigint;
  total numeric;
  desired numeric;
  current numeric;
  delta numeric;
  c customers;
  cname text;
  v_before numeric;
  v_after numeric;
  applied numeric;
  inv_label text := 'INV-' || case when length(p_quote_id::text) < 4 then lpad(p_quote_id::text, 4, '0') else p_quote_id::text end;
begin
  select * into q from saved_quotes where id = p_quote_id and shop_id = p_shop_id for update;
  if not found then raise exception 'That order is not in this shop.' using errcode = 'P0002'; end if;
  if q.voided then raise exception 'That order is voided.' using errcode = '22023'; end if;
  if q.invoiced then raise exception '% is invoiced already.', inv_label using errcode = '22023'; end if;
  if q.status is distinct from 'completed' then raise exception 'Only a delivered order is invoiced.' using errcode = '22023'; end if;
  pay := coalesce(q.payload, '{}'::jsonb);
  items := case when jsonb_typeof(pay -> 'items') = 'array' then pay -> 'items' else '[]'::jsonb end;
  if ow_pick_shortfall(pay) then
    raise exception 'A short pick on % is not settled yet: bill what went, or the full quantity, first.', inv_label using errcode = 'OWSHP';
  end if;
  if exists (select 1 from jsonb_array_elements(items) e where ow_line_waits_price(p_shop_id, e, presets)) then
    raise exception 'A price on % still waits for the Manager.', inv_label using errcode = 'OWPRC';
  end if;
  -- 0138: a line still with no selling price is never billed (at cost or at all): the Manager prices it first.
  if ow_order_unpriced(p_shop_id, items, presets) > 0 then
    raise exception '% line% on % still % no selling price: the Manager prices % first.',
      ow_order_unpriced(p_shop_id, items, presets), case when ow_order_unpriced(p_shop_id, items, presets) = 1 then '' else 's' end, inv_label,
      case when ow_order_unpriced(p_shop_id, items, presets) = 1 then 'has' else 'have' end,
      case when ow_order_unpriced(p_shop_id, items, presets) = 1 then 'it' else 'them' end using errcode = 'OWTPC';
  end if;
  -- 0138: a supplier bill already on the order (the console's "a supplier's bill ... for a sale")
  -- is kept, and only the suppliers without one are billed below; it is no longer refused (OWBIL).

  -- orderIsBackdated: a late entry is invoiced on its own date.
  made := (ow_ts(coalesce(nullif(pay ->> 'createdAt', ''), pay ->> 'savedAt')) at time zone tz)::date;
  if q.date is not null and made is not null and q.date < made then
    inv_at := q.date; inv_ts := (q.date + time '12:00') at time zone tz;
  else
    inv_at := ow_today(); inv_ts := now();
  end if;
  client := coalesce(nullif(btrim(coalesce(pay -> 'client' ->> 'name', '')), ''), nullif(btrim(coalesce(q.client_name, '')), ''));

  -- applyQuoteStockDeduction: every line that comes off the shelf.
  for it in select e from jsonb_array_elements(items) e loop
    if jsonb_typeof(it) = 'object' and (coalesce(it ->> 'supplierId', '') = '__stock__' or ow_line_received(it)) then
      vi := ow_num(it ->> 'variantIdx');
      conv := ow_on_shelf(p_shop_id, it ->> 'productId', vi, coalesce(ow_num(it ->> 'qty'), 0), it ->> 'unit', it, null);
      need := conv.qty;
      select coalesce(s.qty, 0) into have from stock s where s.shop_id = p_shop_id and s.key = ow_stock_key(it ->> 'productId', vi);
      have := coalesce(have, 0);
      take := least(have, need);
      if take < need then shortfall := true; end if;
      it := it || jsonb_build_object('_stockTaken', trim_scale(take));
      if take > 0 then
        lots := ow_stock_move(p_shop_id, it ->> 'productId', vi, coalesce(it ->> 'productName', it ->> 'productId'), -take,
                              'sale', 'Quote for ' || coalesce(client, 'Unnamed client'), null, null);
        it := it || jsonb_build_object('_stockLots', lots);
      end if;
    end if;
    out_items := out_items || jsonb_build_array(it);
  end loop;

  -- applyQuoteSurplusToStock: a pack that could not be broken.
  items := out_items; out_items := '[]'::jsonb;
  for it in select e from jsonb_array_elements(items) e loop
    if jsonb_typeof(it) = 'object' and not ow_line_received(it) then
      surplus := ow_units_bought(p_shop_id, it) - coalesce(ow_num(it ->> 'qty'), 0);
      if surplus > 0 then
        vi := ow_num(it ->> 'variantIdx');
        conv := ow_on_shelf(p_shop_id, it ->> 'productId', vi, surplus, it ->> 'unit', it, nullif(coalesce(ow_num(it ->> 'price'), 0), 0));
        it := it || jsonb_build_object('_surplusStocked', trim_scale(conv.qty));
        perform ow_stock_move(p_shop_id, it ->> 'productId', vi, coalesce(it ->> 'productName', it ->> 'productId'), conv.qty, 'restock',
          'Left over from ' || coalesce(client, 'a quote') || ' — '
            || coalesce((select s.name from suppliers s where s.shop_id = p_shop_id and s.id = it ->> 'supplierId'), it ->> 'supplierName', '')
            || ' sells by the ' || coalesce(nullif(it ->> 'packUnit', ''), 'pack'),
          conv.cost, it ->> 'supplierId');
        surplus_total := surplus_total + conv.qty;
      end if;
    end if;
    out_items := out_items || jsonb_build_array(it);
  end loop;

  -- generatePurchaseInvoicesForQuote: one bill per supplier, in the order
  -- the suppliers first appear on the order.
  for it in select e from jsonb_array_elements(out_items) e loop
    sid := it ->> 'supplierId';
    if coalesce(sid, '') not in ('', '__stock__') and not (sid = any(sids)) then sids := sids || sid; end if;
  end loop;
  foreach sid in array sids loop
    -- 0138: this supplier's bill for this order is on file already: keep it, raise no second one.
    select b.id into bill_id from purchase_invoices b
     where b.shop_id = p_shop_id and b.quote_id = p_quote_id and b.payload ->> 'supplierId' = sid
       and coalesce(b.payload ->> 'voided', 'false') <> 'true'
     order by b.id limit 1;
    if found then
      bills := bills || to_jsonb(bill_id);
      continue;
    end if;
    bill_items := '[]'::jsonb;
    for it in select e from jsonb_array_elements(out_items) e where e ->> 'supplierId' = sid loop
      select coalesce(jsonb_object_agg(k, it -> k), '{}'::jsonb) into base
        from unnest(array['productId', 'variantIdx', 'productName', 'unit', 'packUnit', 'packQty']) k where it ? k;
      if ow_line_received(it) and jsonb_typeof(it -> 'receipts') = 'array' and jsonb_array_length(it -> 'receipts') > 1 then
        bill_items := bill_items || coalesce((
          select jsonb_agg(base || jsonb_build_object('qty', ow_num(r ->> 'qty'), 'price', ow_num(r ->> 'price')) order by n)
            from jsonb_array_elements(it -> 'receipts') with ordinality as x(r, n)
           where coalesce(ow_num(r ->> 'qty'), 0) > 0), '[]'::jsonb);
      elsif ow_line_received(it) then
        bill_items := bill_items || jsonb_build_array(base || jsonb_build_object('qty', ow_num(it ->> 'receivedQty'), 'price', ow_num(it ->> 'receivedPrice')));
      else
        bill_items := bill_items || jsonb_build_array(base || jsonb_build_object('qty', ow_units_bought(p_shop_id, it), 'price', coalesce(it -> 'price', 'null'::jsonb)));
      end if;
    end loop;
    select coalesce(max(id), 0) into floor_id from purchase_invoices where shop_id = p_shop_id;
    bill_id := ow_next_row_id(p_shop_id, 'row:purchase_invoice', floor_id);
    insert into purchase_invoices (id, shop_id, quote_id, date, payload)
         values (bill_id, p_shop_id, p_quote_id, inv_at, jsonb_build_object(
           'customerName', coalesce(client, ''),
           'supplierId', sid,
           'supplierName', coalesce((select s.name from suppliers s where s.shop_id = p_shop_id and s.id = sid),
                                    (select e ->> 'supplierName' from jsonb_array_elements(out_items) e where e ->> 'supplierId' = sid limit 1), ''),
           'items', bill_items, 'amountPaid', 0, 'payments', '[]'::jsonb, 'voided', false)
           -- 0138: due on the supplier's terms, as Accounts' own bill form sets it (fix 10).
           || coalesce((select jsonb_build_object('dueDate', to_char(inv_at + s.terms_days, 'YYYY-MM-DD'))
                          from suppliers s where s.shop_id = p_shop_id and s.id = sid and s.terms_days is not null), '{}'::jsonb));
    bills := bills || to_jsonb(bill_id);
  end loop;

  -- syncInvoiceDebtCharge: the customer's debt brought to the balance due.
  pay := pay || jsonb_build_object('items', out_items);
  total := trim_scale(round(ow_order_total(p_shop_id, pay, false), 6));
  desired := greatest(0, total - coalesce(q.amount_paid, 0));
  current := coalesce(ow_num(pay ->> 'debtCharged'), 0);
  delta := desired - current;
  if delta <> 0 then
    if coalesce(pay ->> 'customerId', '') <> '' then
      select * into c from customers where shop_id = p_shop_id and id = pay ->> 'customerId' for update;
    end if;
    -- 0138: a generic name ("Walk-in", "Cash") is nobody: never matched, never made a debtor.
    if c.id is null and client is not null and not ow_generic_client(client) then
      select * into c from customers where shop_id = p_shop_id and lower(btrim(coalesce(name, ''))) = lower(client)
       order by id limit 1 for update;
      if c.id is null then
        cname := ow_free_customer_id(p_shop_id);
        insert into customers (shop_id, id, name, phone, location, notes, debt)
             values (p_shop_id, cname, client, coalesce(pay -> 'client' ->> 'phone', q.client_phone, ''), '', '', 0)
          returning * into c;
      end if;
    end if;
    -- 0138: money still owed with nobody to owe it goes back to the Manager, not into a made-up debtor.
    if c.id is null and delta > 0 then
      raise exception '% leaves % unpaid and no customer to owe it: name the customer on the order, or take the money first.',
        inv_label, trim(to_char(desired, 'FM999,999,999,990')) using errcode = 'OWWLK';
    end if;
    if c.id is not null then
      v_before := coalesce(c.debt, 0);
      v_after := greatest(0, v_before + delta);
      applied := v_after - v_before;
      if applied <> 0 then
        update customers set debt = v_after where shop_id = p_shop_id and id = c.id;
        select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = p_shop_id;
        insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id)
             values (ow_next_row_id(p_shop_id, 'row:debt_log', floor_id), p_shop_id, c.id, ow_today(),
                     case when applied > 0 then 'charge' else 'payment' end, abs(applied),
                     'Auto-sync — ' || inv_label, p_quote_id);
      end if;
      pay := pay || jsonb_build_object('customerId', c.id);
    end if;
  end if;
  pay := pay || jsonb_build_object('debtCharged', desired,
    'invoicedBy', jsonb_build_object('via', p_via, 'by', p_by, 'byName', p_by_name, 'at', now()));

  update saved_quotes
     set invoiced = true, invoiced_at = inv_at, invoiced_ts = inv_ts, payload = pay
   where id = p_quote_id and shop_id = p_shop_id;

  return jsonb_build_object('ok', true, 'id', p_quote_id, 'invoice', inv_label, 'invoicedAt', inv_at,
    'total', total, 'debtCharged', desired, 'bills', bills, 'shortOnShelf', shortfall, 'surplusStocked', surplus_total);
end $$;
-- ---------------------------------------------------------------------
-- The hourly run: 0119's, and each order it skips is told to the Manager,
-- once a day (dedupe), by the task that clears it.
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
begin
  for r in
    select q.shop_id, q.id, q.client_name
      from saved_quotes q
     where q.status = 'completed' and not q.invoiced and not q.voided
       and coalesce(ow_ts(q.payload ->> 'deliveredAt'),
                    case when ow_num(q.payload ->> 'stageEnteredAt') > 0
                         then to_timestamp(ow_num(q.payload ->> 'stageEnteredAt') / 1000) end)
           <= now() - interval '24 hours'
     order by q.shop_id, q.id
  loop
    begin
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
          null, case when v_code in ('OWTPC', 'OWPRC') then 'price.approve' when v_code = 'OWSHP' then 'pick.settle' else 'invoice.make' end, null,
          jsonb_build_object('table', 'saved_quotes', 'id', r.id, 'code', v_code),
          'invheld:' || r.id || ':' || v_code || ':' || ow_today());
      exception when others then
        raise notice 'push (invoice held %): % (%)', r.id, sqlerrm, sqlstate;
      end;
    end;
  end loop;
  return jsonb_build_object('invoiced', done, 'skipped', skipped);
end $$;
revoke all on function ow_invoice_due_orders() from public, anon, authenticated;
