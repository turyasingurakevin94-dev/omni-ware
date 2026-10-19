-- A new customer's id, past C999.
--
-- Invoicing an order whose client is not on file yet (a walk-in, say)
-- creates the customer as 'C' || lpad(n, 3, '0'). Postgres's lpad CUTS a
-- longer string down to the width, so the 1000th customer came out as
-- C100 -- an id already in use -- and the invoice stopped with
-- 'duplicate key value violates unique constraint "customers_pkey"'.
-- The console's next_entity_id (0032) padded the same way, so it broke at
-- the same point for customers, suppliers, staff and products alike.
--
-- Now a number wider than the pad keeps every digit, and the invoice's new
-- customer is checked against the ids on file: if the counter has fallen
-- behind them it walks on to the first free one.
--
-- Run after 0119 (it replaces 0119's ow_invoice_core). If 0119 is ever run
-- again, run this file again after it.

create or replace function next_entity_id(
  p_shop_id uuid,
  p_kind text,
  p_prefix text,
  p_pad int default 3,
  p_floor bigint default 0
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  if not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop';
  end if;
  if p_kind is null or p_prefix is null then
    raise exception 'kind and prefix are required';
  end if;

  insert into entity_id_counters (shop_id, kind, last_issued)
       values (p_shop_id, p_kind, greatest(1, coalesce(p_floor, 0) + 1))
  on conflict (shop_id, kind) do update
          set last_issued = greatest(entity_id_counters.last_issued, coalesce(p_floor, 0)) + 1
    returning last_issued into v;

  -- lpad never cuts: 1000 stays C1000, not C100.
  return p_prefix || lpad(v::text, greatest(coalesce(p_pad, 3), 1, length(v::text)), '0');
end;
$$;

revoke all on function next_entity_id(uuid, text, text, int, bigint) from public;
grant execute on function next_entity_id(uuid, text, text, int, bigint) to authenticated;

-- The next customer id nothing on file is using: C001 ... C999, C1000 ...
-- The floor is the highest C-number on file; an id in another form
-- cannot be confused with one of these. Never granted to a login.
create or replace function ow_free_customer_id(p_shop_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  n bigint;
  v_id text;
begin
  n := ow_next_row_id(p_shop_id, 'customer',
         (select coalesce(max((substring(id from '^C(\d+)$'))::bigint), 0)
            from customers where shop_id = p_shop_id and id ~ '^C\d+$'));
  loop
    v_id := 'C' || lpad(n::text, greatest(3, length(n::text)), '0');
    exit when not exists (select 1 from customers where shop_id = p_shop_id and id = v_id);
    n := ow_next_row_id(p_shop_id, 'customer', n);
  end loop;
  return v_id;
end $$;
revoke all on function ow_free_customer_id(uuid) from public, anon, authenticated;

-- 0119's ow_invoice_core, word for word but for the new customer's id.
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
  inv_label text := 'INV-' || lpad(p_quote_id::text, 4, '0');
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
  if exists (select 1 from purchase_invoices b where b.shop_id = p_shop_id and b.quote_id = p_quote_id
              and coalesce(b.payload ->> 'voided', 'false') <> 'true') then
    raise exception 'Supplier bills for % are raised already.', inv_label using errcode = 'OWBIL';
  end if;

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
           'items', bill_items, 'amountPaid', 0, 'payments', '[]'::jsonb, 'voided', false));
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
    if c.id is null and client is not null then
      select * into c from customers where shop_id = p_shop_id and lower(btrim(coalesce(name, ''))) = lower(client)
       order by id limit 1 for update;
      if c.id is null then
        cname := ow_free_customer_id(p_shop_id);
        insert into customers (shop_id, id, name, phone, location, notes, debt)
             values (p_shop_id, cname, client, coalesce(pay -> 'client' ->> 'phone', q.client_phone, ''), '', '', 0)
          returning * into c;
      end if;
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
revoke all on function ow_invoice_core(uuid, bigint, text, uuid, text) from public, anon, authenticated;
