-- 0177 The rebuild's seventh backend fix (docs/rebuild.md, "Backend fixes
-- decided"; docs/spec/01-order-journey.md §5 Q7 and Q8, Kevin 28 Oct 2026):
-- one Cancel, by the Manager (order.cancel), before an order is invoiced.
--
-- Three ways called an order off, each its own way: the console's Cancel
-- (index.html cancelSavedQuote: voided + cancelledAt), the Manager's void of
-- a duplicate (manager.html obVoidDup), and an agent's cancel. None set the
-- stage the Store screen reads (store.html orderCalledOff:
-- status = 'cancelled', cancelledAt, cancelledByName), and nobody told the
-- Store to stop packing. Now:
--
--   cancel_order(shop, order, why, choice, account)
--       order.cancel (the Manager; decision-rights row "Cancel an order
--       before it is invoiced", built here). In one write: status
--       'cancelled' and voided, with cancelledAt (ms, as the console writes
--       it), cancelledBy, cancelledByName, cancelWhy, the stage log and a
--       docLog line; money paid on it refunded or kept as a deposit
--       (voidMoney, as 0169's void_with_money does). Then pushes:
--       'order.cancelled' to the Store (order.pick) when it was in the yard
--       (Packing or On the road) — stop, put back what is out, as the Store
--       screen already shows (store.html pkCancel) — and to the salesperson
--       who took it. The owner's log line comes from the void guard.
--
--   Refused: an invoiced order (that is a void, invoice.void) or a
--   delivered one (invoice it, then void it); one whose bought-in goods came
--   in, or that is on a live buying trip (manager.html obVoidBlock: the
--   supplier is billed, or the trip changed, first); money paid with no
--   choice made (OWVMN).
--
-- Stock moves at the invoice (0119), so nothing comes off the books here:
-- what the yard picked goes back by hand, which the push asks for.
--
-- Also: 0173's stage rule knows 'cancelled' (only with order.cancel, never
-- from Delivered or an invoice, and never back out of it), and 0122's void
-- guard takes order.cancel for a cancel and logs it as one.
--
-- Not built (not decided as a database rule): Sales asking for a cancel
-- (the "Proposes: Sales" column; today they ask the Manager directly), and
-- the console's billing of goods that came in before a cancel.
--
-- Applied by hand, after 0176. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select role, task from role_tasks where task = 'order.cancel';
--   select id, status, voided, payload ->> 'cancelledByName' from saved_quotes where status = 'cancelled' order by id desc limit 5;
--
-- ROLLBACK:
--   drop function if exists cancel_order(uuid, bigint, text, text, text);
--   drop function if exists ow_settle_void_money(uuid, saved_quotes, text, text, text);
--   delete from role_tasks where task = 'order.cancel';
--   then run 0173's saved_quotes_stage_move and 0122's saved_quotes_sales_guard again.
-- ---------------------------------------------------------------------

insert into role_tasks (role, task) values ('manager', 'order.cancel') on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. 0173's stage rule: 'cancelled' is the Manager's, and final.
do $mig$
declare
  -- Line ends as written: a function pasted from Windows has \r\n (live's 0122 guard does).
  src text := replace(pg_get_functiondef('saved_quotes_stage_move()'::regprocedure), chr(13), '');
  was text := '    if new.status is not distinct from old.status then return new; end if;' || chr(10);
begin
  if position('order.cancel' in src) > 0 then return; end if;
  if position(was in src) = 0 then raise exception '0177: saved_quotes_stage_move is not the shape 0173 left; not changed.'; end if;
  src := replace(src, was, was
    || '    -- 0177: Cancel (order.cancel), before the bill; it is final.' || chr(10)
    || '    if new.status = ''cancelled'' then' || chr(10)
    || '      if coalesce(old.invoiced, false) or old.status = ''completed'' then' || chr(10)
    || '        raise exception ''A delivered or invoiced order is not cancelled: invoice it, then void it.'' using errcode = ''OWSTG'';' || chr(10)
    || '      end if;' || chr(10)
    || '      if coalesce(old.voided, false) then raise exception ''This order is voided already.'' using errcode = ''OWSTG''; end if;' || chr(10)
    || '      if has_task(new.shop_id, ''order.cancel'') then return new; end if;' || chr(10)
    || '      raise exception ''Cancelling an order is the Manager''''s (order.cancel).'' using errcode = ''42501'';' || chr(10)
    || '    end if;' || chr(10));
  execute src;
end $mig$;

-- ---------------------------------------------------------------------
-- 2. 0122's void guard: a cancel is voided by order.cancel, and logged as a cancel.
do $mig$
declare
  -- Line ends as written: a function pasted from Windows has \r\n (live's 0122 guard does).
  src text := replace(pg_get_functiondef('saved_quotes_sales_guard()'::regprocedure), chr(13), '');
  was1 text := '    if has_task(new.shop_id, ''invoice.void'') then' || chr(10) || '      v_task := ''invoice.void'';';
  was2 text := 'case when v_task = ''agent.change'' then ''Closed an agent''''s cancelled order #'' else ''Voided order #'' end';
begin
  if position('order.cancel' in src) > 0 then return; end if;
  if position(was1 in src) = 0 or position(was2 in src) = 0 then
    raise exception '0177: saved_quotes_sales_guard is not the shape 0122 left; not changed.';
  end if;
  src := replace(src, was1,
       '    -- 0177: Cancel, before the bill (order.cancel).' || chr(10)
    || '    if new.status = ''cancelled'' and not coalesce(old.invoiced, false) and has_task(new.shop_id, ''order.cancel'') then' || chr(10)
    || '      v_task := ''order.cancel'';' || chr(10)
    || '    elsif has_task(new.shop_id, ''invoice.void'') then' || chr(10) || '      v_task := ''invoice.void'';');
  src := replace(src, was2,
    'case v_task when ''agent.change'' then ''Closed an agent''''s cancelled order #'' when ''order.cancel'' then ''Cancelled order #'' else ''Voided order #'' end');
  execute src;
end $mig$;

-- ---------------------------------------------------------------------
-- 3. The money paid on an order that is called off: refunded, or kept as
-- the customer's deposit (0169 void_with_money's two ways). Returns the
-- voidMoney record that goes in the same write as the void.
create or replace function ow_settle_void_money(p_shop_id uuid, q saved_quotes, p_choice text, p_account text, p_label text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  choice text := nullif(lower(btrim(coalesce(p_choice, ''))), '');
  acct text := coalesce(nullif(lower(btrim(coalesce(p_account, ''))), ''), 'cash');
  amt numeric := round(coalesce(q.amount_paid, 0));
  cid text := nullif(q.payload ->> 'customerId', '');
  cash_id bigint;
  floor_id bigint;
  saved jsonb;
begin
  if choice is not null and choice not in ('refund', 'deposit') then
    raise exception 'The money is refunded or kept as a deposit.' using errcode = '22023';
  end if;
  if amt > 0 and choice is null then
    raise exception '% was paid on %: refund it, or keep it as a deposit.', ow_money(amt), p_label using errcode = 'OWVMN';
  end if;
  if amt > 0 and choice = 'deposit' then
    perform 1 from customers where shop_id = p_shop_id and id = cid for update;
    if cid is null or not found then raise exception 'Name the customer to keep a deposit.' using errcode = 'OWDEP'; end if;
    saved := ow_system_begin();
    update customers set debt = coalesce(debt, 0) - amt where shop_id = p_shop_id and id = cid;
    select coalesce(max(id), 0) into floor_id from customer_debt_log where shop_id = p_shop_id;
    insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note, quote_id)
         values (ow_next_row_id(p_shop_id, 'row:debt_log', floor_id), p_shop_id, cid, ow_today(), 'payment', amt, 'Deposit — ' || p_label, null);
    perform ow_system_end(saved);
  end if;
  if amt > 0 and choice = 'refund' then
    cash_id := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
    insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by)
         values (cash_id, p_shop_id, ow_today(), acct, 'payment', 'Refund', amt, 'Refund — ' || p_label || coalesce(' · ' || nullif(q.client_name, ''), ''),
                 to_char(now() at time zone ow_shop_tz(), 'HH24:MI'), q.id, uid);
  end if;
  return jsonb_build_object('done', true, 'choice', case when amt > 0 then choice else 'none' end, 'amount', amt,
                            'account', case when amt > 0 and choice = 'refund' then acct end, 'cashTxnId', cash_id,
                            'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', uid);
end $$;
revoke all on function ow_settle_void_money(uuid, saved_quotes, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. The Cancel.
create or replace function cancel_order(p_shop_id uuid, p_order bigint, p_why text, p_choice text default null, p_account text default 'cash')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  q saved_quotes%rowtype;
  why text := nullif(btrim(coalesce(p_why, '')), '');
  lbl text;
  who text;
  client text;
  now_ms numeric := floor(extract(epoch from clock_timestamp()) * 1000);
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  vm jsonb;
  in_yard boolean;
  taker uuid;
  ref jsonb;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not has_task(p_shop_id, 'order.cancel') then
    raise exception 'Cancelling an order is the Manager''s (order.cancel).' using errcode = '42501';
  end if;
  if why is null then raise exception 'Say why it is cancelled.' using errcode = '22023'; end if;
  select * into q from saved_quotes where shop_id = p_shop_id and id = p_order for update;
  if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
  lbl := '#' || lpad(q.id::text, 4, '0');
  if coalesce(q.voided, false) then raise exception '% is called off already.', lbl using errcode = '22023'; end if;
  if coalesce(q.invoiced, false) then raise exception '% is invoiced: void it instead (invoice.void).', lbl using errcode = '22023'; end if;
  if q.status = 'completed' then raise exception '% was delivered: invoice it, then void it.', lbl using errcode = '22023'; end if;
  -- manager.html obVoidBlock: goods bought for it came in, or a buying trip carries it.
  if exists (select 1 from jsonb_array_elements(case when jsonb_typeof(q.payload -> 'items') = 'array' then q.payload -> 'items' else '[]'::jsonb end) e
              where jsonb_typeof(e) = 'object' and coalesce(e ->> 'supplierId', '') not in ('', '__stock__')
                and coalesce(e ->> 'receivedAt', '') <> '' and coalesce(ow_num(e ->> 'receivedQty'), 0) > 0) then
    raise exception 'Goods bought for % came in: their supplier is billed first.', lbl using errcode = '22023';
  end if;
  if exists (select 1 from collection_trips t, jsonb_array_elements(case when jsonb_typeof(t.lines) = 'array' then t.lines else '[]'::jsonb end) l
              where t.shop_id = p_shop_id and not t.voided and t.status <> 'confirmed' and l ->> 'orderId' = q.id::text) then
    raise exception 'A buying trip carries %: take it off the trip first.', lbl using errcode = '22023';
  end if;

  vm := ow_settle_void_money(p_shop_id, q, p_choice, p_account, 'cancel ' || lbl);
  who := ow_member_name(p_shop_id, uid);
  in_yard := q.status in ('preparing', 'pending_delivery');
  -- One write: the stage, the void, the money, who and why (the void guard logs it as a cancel).
  update saved_quotes
     set status = 'cancelled', voided = true,
         payload = (coalesce(payload, '{}'::jsonb) - 'gateHeldMove') || jsonb_build_object(
           'voidMoney', vm, 'cancelledAt', now_ms, 'cancelledBy', uid, 'cancelledByName', who, 'cancelWhy', left(why, 200),
           'stageEnteredAt', now_ms,
           'stageLog', coalesce(case when jsonb_typeof(payload -> 'stageLog') = 'array' then payload -> 'stageLog' end, '[]'::jsonb)
                       || jsonb_build_array(jsonb_build_object('status', 'cancelled', 'at', now_ms, 'by', 'manager')),
           'docLog', (select coalesce(jsonb_agg(e order by k), '[]'::jsonb) from (
                        select e, k from jsonb_array_elements(
                          coalesce(case when jsonb_typeof(payload -> 'docLog') = 'array' then payload -> 'docLog' end, '[]'::jsonb)
                          || jsonb_build_array(jsonb_build_object('at', now_iso, 'kind', 'cancelled', 'what', 'Cancelled · ' || left(why, 100))))
                          with ordinality as x(e, k) order by k desc limit 60) d))
   where shop_id = p_shop_id and id = q.id;

  -- Who must stop: the yard, if it was packing or out; the salesperson who took it.
  client := coalesce(nullif(btrim(coalesce(q.client_name, '')), ''), nullif(btrim(coalesce(q.payload -> 'client' ->> 'name', '')), ''), 'An order');
  ref := jsonb_build_object('table', 'saved_quotes', 'id', q.id);
  if in_yard then
    perform ow_push(p_shop_id, 'order.cancelled', 'Called off · stop packing',
      lbl || ' · ' || client || ' — ' || coalesce(split_part(who, ' ', 1), 'The Manager') || ' cancelled it. Put back what is out.',
      null, 'order.pick', null, ref, 'cancel:' || q.id || ':yard');
  end if;
  taker := ow_uuid(q.payload ->> 'takenBy');
  if taker is not null and taker is distinct from uid then
    perform ow_push(p_shop_id, 'order.cancelled', 'Order cancelled',
      client || ' ' || lbl || ' — ' || coalesce(split_part(who, ' ', 1), 'The Manager') || ' cancelled it: ' || left(why, 100),
      taker, null, null, ref, 'cancel:' || q.id || ':sales');
  end if;
  if (vm ->> 'amount')::numeric > 0 then
    perform manager_log_decision(p_shop_id, 'order.cancel',
      'Cancelled ' || lbl || ' for ' || client || ' with ' || ow_money((vm ->> 'amount')::numeric) || ' paid: '
        || case when vm ->> 'choice' = 'refund' then 'refunded from ' || (vm ->> 'account') else 'kept as a deposit' end,
      (vm ->> 'amount')::numeric, ref, jsonb_build_object('amountPaid', q.amount_paid), jsonb_build_object('voidMoney', vm));
  end if;
  return jsonb_build_object('ok', true, 'orderId', q.id, 'status', 'cancelled', 'wasInYard', in_yard, 'money', vm);
end $$;
revoke all on function cancel_order(uuid, bigint, text, text, text) from public, anon;
grant execute on function cancel_order(uuid, bigint, text, text, text) to authenticated;
