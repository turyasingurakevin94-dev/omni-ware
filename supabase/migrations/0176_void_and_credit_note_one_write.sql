-- 0176 The rebuild's sixth backend fix (docs/rebuild.md, "Backend fixes
-- decided"; docs/spec/01-order-journey.md §5 Q6, Kevin 28 Oct 2026): a void
-- and a credit note are each one database write, like payments and the
-- counter sale.
--
-- The Manager app does each as several calls (manager.html voidAskWrite,
-- ACT['slide:credit']): the why on the order, the void (or 0169's
-- void_with_money), the goods back on the shelf (manager_stock_move), the
-- supplier bills voided (void_sale_bills), the ask closed
-- (decide_invoice_ask); for a credit note the note on the order, the goods
-- back, the ask closed, the log line. A lost signal between two of them left
-- half of one: voided with the goods still off the shelf, a credit note with
-- its ask still open. Now each is one function, one transaction: all of it,
-- or none of it.
--
--   void_invoice(shop, order, why, restock, choice, account, ask)
--       invoice.void. An invoiced order only (before the bill it is a
--       cancel). The why on the order (payload.voidedBy) and its docLog
--       line; the void with its money, refund or deposit, and the supplier
--       bills (void_with_money, 0169); with restock, what the invoice took
--       off the shelf (items[]._stockTaken, 0119) back on it; the ask
--       accepted.
--   raise_credit_note(shop, order, lines, reason, cash_back, ask)
--       credit_note.raise. lines [{idx, qty, restock}]. Each line's price is
--       what it sold at (its typed price, else the shop's), never more than
--       the line has left to credit; the note's number from the shop's one
--       sequence (row:credit_note, as the console numbers them); the note
--       and its docLog line on the order (the bill and the balance follow,
--       0165, 0169); with restock, the goods back; the ask accepted; the
--       owner's log.
--
-- The old Manager app keeps its own path (it is frozen while its new app is
-- built, docs/rebuild.md rule 4); the new apps call these.
--
-- Applied by hand, after 0175. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select proname from pg_proc where proname in ('void_invoice', 'raise_credit_note');
--
-- ROLLBACK:
--   drop function if exists void_invoice(uuid, bigint, text, boolean, text, text, uuid);
--   drop function if exists raise_credit_note(uuid, bigint, jsonb, text, boolean, uuid);
-- ---------------------------------------------------------------------

-- The ask a void or a credit note answers: on this order, of this kind, still open.
create or replace function ow_open_ask(p_ask uuid, p_order bigint, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare a invoice_asks%rowtype;
begin
  select * into a from invoice_asks where id = p_ask for update;
  if not found or a.quote_id is distinct from p_order or a.kind is distinct from p_kind then
    raise exception 'That ask is not for this order.' using errcode = '22023';
  end if;
  if a.status <> 'sent' then raise exception 'That ask is % already.', a.status using errcode = '22023'; end if;
end $$;
revoke all on function ow_open_ask(uuid, bigint, text) from public, anon, authenticated;

create or replace function void_invoice(p_shop_id uuid, p_order bigint, p_why text, p_restock boolean default false,
  p_choice text default null, p_account text default 'cash', p_ask uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes%rowtype;
  why text := nullif(btrim(coalesce(p_why, '')), '');
  lbl text;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  res jsonb;
  back jsonb;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not has_task(p_shop_id, 'invoice.void') then
    raise exception 'Voiding an order is the Manager''s (invoice.void).' using errcode = '42501';
  end if;
  if why is null then raise exception 'Say why it is voided.' using errcode = '22023'; end if;
  select * into q from saved_quotes where shop_id = p_shop_id and id = p_order for update;
  if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
  if coalesce(q.voided, false) then raise exception 'This order is voided already.' using errcode = '22023'; end if;
  if not coalesce(q.invoiced, false) then
    raise exception 'Only an invoice is voided; an order not billed yet is cancelled.' using errcode = '22023';
  end if;
  lbl := 'INV-' || case when length(q.id::text) < 4 then lpad(q.id::text, 4, '0') else q.id::text end;
  if p_ask is not null then perform ow_open_ask(p_ask, q.id, 'void'); end if;

  -- The why first, then the void with its money and the supplier bills (0169).
  update saved_quotes
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
           'voidedBy', jsonb_build_object('by', uid, 'byName', ow_member_name(p_shop_id, uid), 'at', now_iso, 'why', left(why, 100), 'askId', p_ask),
           'docLog', (select coalesce(jsonb_agg(e order by k), '[]'::jsonb) from (
                        select e, k from jsonb_array_elements(
                          coalesce(case when jsonb_typeof(payload -> 'docLog') = 'array' then payload -> 'docLog' end, '[]'::jsonb)
                          || jsonb_build_array(jsonb_build_object('at', now_iso, 'kind', 'voided', 'what', 'Voided · ' || left(why, 100))))
                          with ordinality as x(e, k) order by k desc limit 60) l))
   where shop_id = p_shop_id and id = q.id;
  res := void_with_money(p_shop_id, q.id, p_choice, p_account);

  -- Back on the shelf: what the invoice took off it, never the line's quantity.
  if coalesce(p_restock, false) then
    select coalesce(jsonb_agg(jsonb_build_object(
             'key', (e ->> 'productId') || case when coalesce(e ->> 'variantIdx', '') <> '' then '::' || (e ->> 'variantIdx') else '' end,
             'productId', e ->> 'productId', 'variantIdx', e -> 'variantIdx', 'name', coalesce(e ->> 'productName', 'Item'),
             'delta', ow_num(e ->> '_stockTaken'), 'cost', nullif(ow_num(e ->> 'price'), 0))), '[]'::jsonb)
      into back
      from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'items') = 'array' then q.payload -> 'items' else '[]'::jsonb end) e
     where jsonb_typeof(e) = 'object' and coalesce(e ->> 'productId', '') <> '' and coalesce(ow_num(e ->> '_stockTaken'), 0) > 0;
    if jsonb_array_length(back) > 0 then
      perform manager_stock_move(p_shop_id, back, 'reversal', 'Voided — ' || lbl, 'invoice.void');
    end if;
  end if;
  if p_ask is not null then perform decide_invoice_ask(p_ask, 'accepted'); end if;
  return res || jsonb_build_object('invoice', lbl, 'restocked', coalesce(jsonb_array_length(back), 0));
end $$;
revoke all on function void_invoice(uuid, bigint, text, boolean, text, text, uuid) from public, anon;
grant execute on function void_invoice(uuid, bigint, text, boolean, text, text, uuid) to authenticated;

create or replace function raise_credit_note(p_shop_id uuid, p_order bigint, p_lines jsonb, p_reason text,
  p_cash_back boolean default false, p_ask uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes%rowtype;
  presets jsonb;
  items jsonb;
  it jsonb;
  l jsonb;
  idx int;
  qty numeric;
  room numeric;
  price numeric;
  lines jsonb := '[]'::jsonb;
  back jsonb := '[]'::jsonb;
  seen int[] := '{}';
  amount numeric;
  no bigint;
  floor_no bigint;
  cn jsonb;
  lbl text;
  cnl text;
  before_total numeric;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not has_task(p_shop_id, 'credit_note.raise') then
    raise exception 'A credit note is the Manager''s to raise (credit_note.raise).' using errcode = '42501';
  end if;
  select * into q from saved_quotes where shop_id = p_shop_id and id = p_order for update;
  if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
  if coalesce(q.voided, false) or not coalesce(q.invoiced, false) then
    raise exception 'A credit note is raised on a live invoice.' using errcode = '22023';
  end if;
  if p_ask is not null then perform ow_open_ask(p_ask, q.id, 'credit'); end if;
  lbl := 'INV-' || case when length(q.id::text) < 4 then lpad(q.id::text, 4, '0') else q.id::text end;
  presets := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
  items := case when jsonb_typeof(q.payload -> 'items') = 'array' then q.payload -> 'items' else '[]'::jsonb end;

  for l in select e from jsonb_array_elements(case when jsonb_typeof(p_lines) = 'array' then p_lines else '[]'::jsonb end) e loop
    idx := (l ->> 'idx')::int;
    qty := coalesce(ow_num(l ->> 'qty'), 0);
    continue when not (qty > 0);
    it := items -> idx;
    if idx is null or idx < 0 or jsonb_typeof(it) is distinct from 'object' then
      raise exception 'A line on the credit note is not on %.', lbl using errcode = '22023';
    end if;
    if idx = any(seen) then raise exception 'A line is named twice on the credit note.' using errcode = '22023'; end if;
    seen := seen || idx;
    -- What the line has left to credit (manager.html creditedQty: notes not voided).
    select coalesce(ow_num(it ->> 'qty'), 0) - coalesce(sum(coalesce(ow_num(cl ->> 'qty'), 0)), 0) into room
      from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'creditNotes') = 'array' then q.payload -> 'creditNotes' else '[]'::jsonb end) c,
           jsonb_array_elements(case when jsonb_typeof(c -> 'lines') = 'array' then c -> 'lines' else '[]'::jsonb end) cl
     where jsonb_typeof(c) = 'object' and coalesce(c ->> 'voided', 'false') <> 'true' and (cl ->> 'idx')::int = idx;
    if qty > room + 0.000001 then
      raise exception '%: only % left to credit.', coalesce(it ->> 'productName', 'A line'), trim_scale(greatest(room, 0)) using errcode = '22023';
    end if;
    -- What it sold at, each (manager.html linePriceNow).
    price := round(case when coalesce(ow_num(it ->> 'sellPrice'), 0) > 0 then ow_num(it ->> 'sellPrice')
                        else coalesce(ow_line_sell_price(p_shop_id, it, presets), 0) end);
    lines := lines || jsonb_build_array(jsonb_build_object('idx', idx, 'qty', qty, 'price', price, 'name', coalesce(it ->> 'productName', 'Item')));
    if coalesce(l ->> 'restock', '') = 'true' and coalesce(it ->> 'productId', '') <> '' then
      back := back || jsonb_build_array(jsonb_build_object(
        'key', (it ->> 'productId') || case when coalesce(it ->> 'variantIdx', '') <> '' then '::' || (it ->> 'variantIdx') else '' end,
        'productId', it ->> 'productId', 'variantIdx', it -> 'variantIdx', 'name', coalesce(it ->> 'productName', 'Item'),
        'delta', qty, 'cost', nullif(ow_num(it ->> 'price'), 0)));
    end if;
  end loop;
  if jsonb_array_length(lines) = 0 then raise exception 'Pick at least one line.' using errcode = '22023'; end if;
  select round(sum(ow_num(x ->> 'qty') * ow_num(x ->> 'price'))) into amount from jsonb_array_elements(lines) x;

  -- One number for the shop, as the console numbers credit notes.
  select coalesce(max(ow_num(c ->> 'no')), 0)::bigint into floor_no
    from saved_quotes s, jsonb_array_elements(case when jsonb_typeof(s.payload -> 'creditNotes') = 'array' then s.payload -> 'creditNotes' else '[]'::jsonb end) c
   where s.shop_id = p_shop_id and jsonb_typeof(c) = 'object';
  no := ow_reserve_row_ids(p_shop_id, 'row:credit_note', floor_no, 1);
  cnl := 'CN-' || lpad(no::text, 4, '0');
  cn := jsonb_build_object('id', no, 'no', no, 'date', ow_today()::text, 'reason', left(coalesce(btrim(p_reason), ''), 300),
          'lines', lines, 'amount', amount, 'restocked', jsonb_array_length(back) > 0,
          'refund', case when coalesce(p_cash_back, false) then jsonb_build_object('amount', amount, 'due', true, 'account', null) end,
          'askId', p_ask, 'by', uid, 'byName', ow_member_name(p_shop_id, uid));
  before_total := round(ow_order_total(p_shop_id, q.payload, false));
  -- The note on the invoice: the bill and the balance follow it (0165, 0169 refuse one past the bill).
  update saved_quotes
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
           'creditNotes', coalesce(case when jsonb_typeof(payload -> 'creditNotes') = 'array' then payload -> 'creditNotes' end, '[]'::jsonb) || jsonb_build_array(cn),
           'docLog', (select coalesce(jsonb_agg(e order by k), '[]'::jsonb) from (
                        select e, k from jsonb_array_elements(
                          coalesce(case when jsonb_typeof(payload -> 'docLog') = 'array' then payload -> 'docLog' end, '[]'::jsonb)
                          || jsonb_build_array(jsonb_build_object('at', now_iso, 'kind', 'credited', 'what', cnl || ' raised · ' || ow_money(amount))))
                          with ordinality as x(e, k) order by k desc limit 60) d))
   where shop_id = p_shop_id and id = q.id
  returning * into q;
  if jsonb_array_length(back) > 0 then
    perform manager_stock_move(p_shop_id, back, 'reversal', 'Returned — ' || cnl || ' on ' || lbl, 'credit_note.raise');
  end if;
  if p_ask is not null then perform decide_invoice_ask(p_ask, 'accepted'); end if;
  perform manager_log_decision(p_shop_id, 'credit_note.raise',
    'Credit note ' || cnl || ' · ' || ow_money(amount) || ' on ' || lbl || coalesce(' for ' || nullif(q.client_name, ''), '')
      || case when coalesce(p_cash_back, false) then ' · cash back by Accounts' else '' end,
    amount, jsonb_build_object('table', 'saved_quotes', 'id', q.id, 'creditNote', no),
    jsonb_build_object('total', before_total), jsonb_build_object('total', round(ow_order_total(p_shop_id, q.payload, false))));
  return jsonb_build_object('ok', true, 'orderId', q.id, 'no', no, 'label', cnl, 'amount', amount,
                            'restocked', jsonb_array_length(back), 'creditNote', cn);
end $$;
revoke all on function raise_credit_note(uuid, bigint, jsonb, text, boolean, uuid) from public, anon;
grant execute on function raise_credit_note(uuid, bigint, jsonb, text, boolean, uuid) to authenticated;
