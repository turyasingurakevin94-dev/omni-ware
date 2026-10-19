-- Money and stock writes that must happen together, done together.
--
-- Four writes in the Edge Functions and the app were a read followed by
-- separate writes, with nothing in the database tying them together.
-- Each was shown to go wrong on this schema (docs/verification/2026-10-09):
--
--   1. An agent's credit (agent-change-order, useCredit). Two requests
--      read the same balance, both paid their order from it, and the
--      second overwrote the first's record of spending it: 100 of credit
--      paid 200 of orders. -> use_agent_credit(), which locks the rows,
--      re-checks the balance under the lock and writes both sides.
--
--   2. A confirmed mobile-money payment (check-momo-payment-status). The
--      payment was marked successful, then the receipt and the order were
--      written one at a time. A failure in between left money nobody
--      applied, and every later check returned early because the payment
--      was no longer pending. -> apply_momo_payment(), one transaction,
--      recorded by applied_at -- which is apart from the provider's status,
--      so a failed apply is retried and a finished one is never repeated.
--
--   3. Two pushes for one order (agent-initiate-momo-payment). "Is there
--      one pending?" and "insert one" were two statements, so two taps
--      that both asked first both inserted and both charged the phone.
--      -> at most one PENDING payment per order, held by a unique index.
--      A request older than the reuse window is set to 'timeout' first so
--      a new one can be raised; 'timeout' stays resolvable (the checker
--      and both webhooks still ask the provider about it), so a late
--      approval of the old prompt is still banked, as it was before.
--
--   4. Replacing a product's stock lots (index.html, addStockLotsDiffOps).
--      A delete and then an insert: when the insert failed, the lots were
--      gone from the database -- FIFO costs and who owns consigned goods.
--      -> replace_stock_lots(), the same delete and insert in one
--      transaction, run as the CALLER so the owner-only write policies
--      of 0083 still decide.
--
-- 1 and 2 are service-role only: they are the Edge Functions' writes and
-- trust the agent id they are handed, which the function establishes
-- from current_agent_id() first. For 4, the app deploys on a push and
-- this is applied by hand, so until it is the app finds the function
-- missing and uses its old two-step path. The Edge Functions need this
-- applied BEFORE the new versions are pasted: useCredit refuses without
-- it, the payment checker falls back to its old (non-atomic) apply, and
-- a second simultaneous push is only refused once the index exists.

-- ---------------------------------------------------------------------
-- A number out of jsonb, or 0. Mirrors `Number(x) || 0` in the functions
-- whose rules these re-check: a missing, null or non-numeric value is 0.
create or replace function public.jsonb_num(v jsonb) returns numeric
language sql immutable set search_path = public
as $$
  select case
    when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric
    when jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then (v #>> '{}')::numeric
    else 0 end
$$;

-- What the shop is owed for an order's lines: sellPrice x qty, summed.
-- The SQL twin of orderShopTotal() in agent-change-order and of the total
-- in applyMomoPaymentToOrder; keep the three in step.
create or replace function public.order_shop_total(p jsonb) returns numeric
language sql immutable set search_path = public
as $$
  select coalesce(sum(public.jsonb_num(it -> 'sellPrice') * public.jsonb_num(it -> 'qty')), 0)
    from jsonb_array_elements(case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end) it
$$;

-- ---------------------------------------------------------------------
-- 1. Spending an agent's credit.
--
-- p_plan is the plan the function made from what it read --
-- [{"from": <order id>, "amount": <n>}, ...], oldest credit first. Every
-- order it names, and the order being paid, are locked (in id order, so
-- two of these can never deadlock), and the plan is CHECKED against the
-- rows as they now are: each source must still have that much left, and
-- the order must still owe at least the total. If anything moved since
-- the read, nothing is written and {ok:false, reason:'changed'} comes
-- back for the function to read again and re-plan.
--
-- Only the keys that change are written (jsonb_set on the locked row),
-- so nothing else on either order can be put back to an older copy.
create or replace function public.use_agent_credit(
  p_shop_id uuid, p_agent_id text, p_order_id bigint, p_plan jsonb, p_at timestamptz default now()
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  dest saved_quotes%rowtype;
  src saved_quotes%rowtype;
  step jsonb;
  amt numeric;
  credit_left numeric;
  total numeric := 0;
  due numeric;
  new_paid numeric;
  pays jsonb := '[]'::jsonb;
  ids bigint[];
  day text := to_char(p_at at time zone 'utc', 'YYYY-MM-DD');
  at_iso text := to_char(p_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  next_payload jsonb;
begin
  if jsonb_typeof(p_plan) is distinct from 'array' or jsonb_array_length(p_plan) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;
  if (select count(distinct e ->> 'from') from jsonb_array_elements(p_plan) e) <> jsonb_array_length(p_plan) then
    return jsonb_build_object('ok', false, 'reason', 'changed');
  end if;
  select array_agg(distinct x) into ids from (
    select p_order_id as x
    union all
    select (e ->> 'from')::bigint from jsonb_array_elements(p_plan) e
  ) s;
  perform 1 from saved_quotes where shop_id = p_shop_id and id = any(ids) order by id for update;

  select * into dest from saved_quotes where shop_id = p_shop_id and id = p_order_id;
  -- useCredit's refusals: not theirs, voided, or cancelled by the
  -- agent (agentCancel present and not null/false).
  if not found or dest.agent_id is distinct from p_agent_id or dest.voided
     or coalesce(dest.payload -> 'agentCancel', 'null'::jsonb) not in ('null'::jsonb, 'false'::jsonb) then
    return jsonb_build_object('ok', false, 'reason', 'changed');
  end if;
  due := round(public.order_shop_total(dest.payload) - coalesce(dest.amount_paid, 0));

  for step in select * from jsonb_array_elements(p_plan) loop
    amt := round(public.jsonb_num(step -> 'amount'));
    if amt <= 0 or (step ->> 'from')::bigint = p_order_id then
      return jsonb_build_object('ok', false, 'reason', 'changed');
    end if;
    select * into src from saved_quotes where shop_id = p_shop_id and id = (step ->> 'from')::bigint;
    if not found or src.agent_id is distinct from p_agent_id
       or jsonb_typeof(src.payload -> 'agentCredit') is distinct from 'object' then
      return jsonb_build_object('ok', false, 'reason', 'changed');
    end if;
    -- creditLeft(): what was given less what was used, rounded, never below 0.
    select greatest(0, round(public.jsonb_num(src.payload -> 'agentCredit' -> 'amount')
             - coalesce(sum(public.jsonb_num(u -> 'amount')), 0)))
      into credit_left
      from jsonb_array_elements(case when jsonb_typeof(src.payload -> 'agentCredit' -> 'used') = 'array'
                                     then src.payload -> 'agentCredit' -> 'used' else '[]'::jsonb end) u;
    if credit_left < amt then
      return jsonb_build_object('ok', false, 'reason', 'changed');
    end if;
    total := total + amt;
  end loop;
  if not (due > 0) or total > due then
    return jsonb_build_object('ok', false, 'reason', 'changed');
  end if;

  -- Checked; now written. The sources first, as before -- inside one
  -- transaction the order no longer matters, but it reads the same way.
  for step in select * from jsonb_array_elements(p_plan) loop
    amt := round(public.jsonb_num(step -> 'amount'));
    update saved_quotes
       set payload = jsonb_set(payload, '{agentCredit,used}',
             (case when jsonb_typeof(payload -> 'agentCredit' -> 'used') = 'array'
                   then payload -> 'agentCredit' -> 'used' else '[]'::jsonb end)
             || jsonb_build_array(jsonb_build_object('to', p_order_id, 'amount', amt, 'at', at_iso)))
     where shop_id = p_shop_id and id = (step ->> 'from')::bigint;
    pays := pays || jsonb_build_array(jsonb_build_object(
      'date', day, 'amount', amt, 'note', 'Credit from order #' || (step ->> 'from'), 'creditFrom', (step ->> 'from')::bigint));
  end loop;

  new_paid := coalesce(dest.amount_paid, 0) + total;
  next_payload := jsonb_set(dest.payload, '{payments}',
    (case when jsonb_typeof(dest.payload -> 'payments') = 'array' then dest.payload -> 'payments' else '[]'::jsonb end) || pays);
  if new_paid + 0.5 >= public.order_shop_total(dest.payload) then
    next_payload := jsonb_set(next_payload, '{agentPaymentStatus}', '"paid"');
  end if;
  update saved_quotes set amount_paid = new_paid, payload = next_payload
   where shop_id = p_shop_id and id = p_order_id;

  return jsonb_build_object('ok', true, 'credited', total, 'owed', greatest(0, due - total),
                            'paid', (next_payload ->> 'agentPaymentStatus') = 'paid');
end;
$$;

revoke all on function public.use_agent_credit(uuid, text, bigint, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.use_agent_credit(uuid, text, bigint, jsonb, timestamptz) to service_role;

-- ---------------------------------------------------------------------
-- 2. Applying a confirmed mobile-money payment, once.
alter table public.agent_mobile_payments
  add column if not exists applied_at timestamptz,
  add column if not exists cash_txn_id bigint;

comment on column public.agent_mobile_payments.applied_at is
  'When the money was written to the Cash Book and the order (apply_momo_payment). Null on a successful payment means it is confirmed by the provider but NOT yet applied, and the next check retries it.';
comment on column public.agent_mobile_payments.cash_txn_id is
  'The cash_txns receipt this payment was banked as. One payment, one receipt.';

-- Payments that were successful before this existed were applied (or
-- warned about) at the time, by the old path. They are marked applied so
-- the retry below never banks them a second time.
update public.agent_mobile_payments
   set applied_at = coalesce(updated_at, created_at)
 where status = 'successful' and applied_at is null;

create unique index if not exists agent_mobile_payments_cash_txn_uniq
  on public.agent_mobile_payments(cash_txn_id) where cash_txn_id is not null;

-- The SQL twin of applyMomoPaymentToOrder in check-momo-payment-status,
-- which stays as the fallback for a database without this function. Keep
-- the two in step: the receipt goes to the "momo" account (the Cash Book
-- keys its totals off that exact id), and the order is marked paid only
-- once the money covers it.
create or replace function public.apply_momo_payment(p_payment_id bigint) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  pay agent_mobile_payments%rowtype;
  ord saved_quotes%rowtype;
  agent_name text;
  label text;
  cash_id bigint;
  new_paid numeric;
  next_payload jsonb;
  t timestamptz := now();
begin
  select * into pay from agent_mobile_payments where id = p_payment_id for update;
  if not found then return jsonb_build_object('applied', false, 'reason', 'not_found'); end if;
  if pay.status <> 'successful' then return jsonb_build_object('applied', false, 'reason', 'not_successful'); end if;
  if pay.applied_at is not null then
    return jsonb_build_object('applied', false, 'reason', 'already_applied', 'cash_txn_id', pay.cash_txn_id);
  end if;
  if pay.order_id is null then
    update agent_mobile_payments set applied_at = t where id = pay.id;
    return jsonb_build_object('applied', true, 'reason', 'no_order');
  end if;

  select * into ord from saved_quotes where shop_id = pay.shop_id and id = pay.order_id for update;
  if not found then raise exception 'order % not found for payment %', pay.order_id, pay.id; end if;

  select name into agent_name from agents where shop_id = pay.shop_id and id = pay.agent_id;
  label := case when pay.provider = 'mtn' then 'MTN MoMo' else 'Airtel Money' end;
  insert into cash_txns(shop_id, date, account, type, category, amount, description, time)
  values (pay.shop_id, (t at time zone 'utc')::date, 'momo', 'receipt', 'Mobile Money', pay.amount,
          label || ' payment from ' || coalesce(agent_name, pay.agent_id) || ' -- order #' || pay.order_id,
          to_char(t at time zone 'utc', 'HH24:MI:SS'))
  returning id into cash_id;

  new_paid := coalesce(ord.amount_paid, 0) + pay.amount;
  next_payload := jsonb_set(ord.payload, '{payments}',
    (case when jsonb_typeof(ord.payload -> 'payments') = 'array' then ord.payload -> 'payments' else '[]'::jsonb end)
    || jsonb_build_array(jsonb_build_object('date', to_char(t at time zone 'utc', 'YYYY-MM-DD'), 'amount', pay.amount,
                                            'note', label, 'cashTxnId', cash_id)));
  if new_paid + 0.5 >= public.order_shop_total(ord.payload) then
    next_payload := jsonb_set(next_payload, '{agentPaymentStatus}', '"paid"');
  end if;
  update saved_quotes set amount_paid = new_paid, payload = next_payload
   where shop_id = pay.shop_id and id = pay.order_id;
  update agent_mobile_payments set applied_at = t, cash_txn_id = cash_id where id = pay.id;
  return jsonb_build_object('applied', true, 'cash_txn_id', cash_id);
end;
$$;

revoke all on function public.apply_momo_payment(bigint) from public, anon, authenticated;
grant execute on function public.apply_momo_payment(bigint) to service_role;

-- ---------------------------------------------------------------------
-- 3. One pending push per order.
--
-- Any order that already has more than one pending request keeps its
-- newest; the older ones become 'timeout', which the checker and the
-- webhooks still resolve against the provider.
update public.agent_mobile_payments p
   set status = 'timeout', updated_at = now()
 where p.status = 'pending' and p.order_id is not null
   and exists (select 1 from public.agent_mobile_payments n
                where n.order_id = p.order_id and n.status = 'pending'
                  and (n.created_at, n.id) > (p.created_at, p.id));

create unique index if not exists agent_mobile_payments_one_pending_per_order
  on public.agent_mobile_payments(order_id) where status = 'pending';

-- ---------------------------------------------------------------------
-- 4. Replacing a product's stock lots in one go.
--
-- SECURITY INVOKER on purpose: the delete and the insert run as the
-- signed-in member, so 0083's owner-only writes and 0058's owner-only
-- deletes apply exactly as they do to the app's own statements. Either
-- both happen or neither does -- a failed insert leaves the old lots.
create or replace function public.replace_stock_lots(p_shop_id uuid, p_keys text[], p_rows jsonb)
returns void
language plpgsql security invoker set search_path = public
as $$
begin
  delete from stock_lots where shop_id = p_shop_id and key = any(p_keys);
  insert into stock_lots(shop_id, key, qty, cost, consign)
  select p_shop_id, r.key, r.qty, r.cost, r.consign
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(key text, qty numeric, cost numeric, consign text)
   where r.key = any(p_keys);
end;
$$;

revoke all on function public.replace_stock_lots(uuid, text[], jsonb) from public, anon;
grant execute on function public.replace_stock_lots(uuid, text[], jsonb) to authenticated;

-- Rollback, in one paste. The app and the functions fall back on their
-- own when these are gone (useCredit refuses until it is back).
-- drop function if exists public.replace_stock_lots(uuid, text[], jsonb);
-- drop index if exists public.agent_mobile_payments_one_pending_per_order;
-- drop function if exists public.apply_momo_payment(bigint);
-- drop index if exists public.agent_mobile_payments_cash_txn_uniq;
-- alter table public.agent_mobile_payments drop column if exists applied_at, drop column if exists cash_txn_id;
-- drop function if exists public.use_agent_credit(uuid, text, bigint, jsonb, timestamptz);
-- drop function if exists public.order_shop_total(jsonb);
-- drop function if exists public.jsonb_num(jsonb);
