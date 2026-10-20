-- 0141: the treasurer's cash-first actions are one write each.
--
-- accounts.html wrote the cash line first (addCash) and then the row it
-- belonged to: wages and rent (the due's payments), a loan repaid (the
-- loan's repayments), a loan received (the loan itself), an asset bought
-- (the asset), an asset sold or gone (the asset's disposal), and an agent
-- settled (each order's payment, each claim paid). A lost signal or a
-- refused write between the two left the money in the book with nothing
-- against it; since 0136 the screen at least said so ("… is in the book,
-- but the rest did not save"). The counter sale (0136), the trip's cash
-- (0138) and the customer's payment (0140) are one write each; these six
-- now are too. Each takes the task docs/decision-rights.md gives Accounts,
-- writes the cash line, the row and the owner's log line in one
-- transaction, and hands the phone back the rows it wrote.
--
--   pay_dues(shop, dues, account)         payroll.run   wages and rent
--   repay_loan(shop, loan, amount, acct)  loan.edit     a repayment on the loan
--   receive_loan(shop, row, account)      loan.edit     the loan in, net of fees
--   buy_asset(shop, row, account, photo)  asset.edit    the asset, paid for
--   dispose_asset(shop, asset, how, …)    asset.edit    sold (proceeds in), stolen or thrown away
--   settle_agent(shop, agent, account)    agent.pay     cash brought in onto its orders, claims paid
--
-- Safe to re-run.

-- The owner's log line the apps wrote through logDecision (0123).
create or replace function ow_accounts_log(p_shop_id uuid, p_task text, p_what text, p_amount numeric, p_ref jsonb, p_after jsonb default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.decision_log') is null then return; end if;
  insert into decision_log (shop_id, by, by_name, role, task, what, amount, ref, after)
       values (p_shop_id, auth.uid(), ow_staff_name_of(auth.uid(), p_shop_id), 'accounts', p_task, p_what,
               case when p_amount is null then null else round(p_amount) end, p_ref, p_after);
end $$;
revoke all on function ow_accounts_log(uuid, text, text, numeric, jsonb, jsonb) from public;

-- A cash line the treasurer writes: id from the one sequence (0138).
create or replace function ow_accounts_cash(p_shop_id uuid, p_account text, p_type text, p_category text, p_amount numeric, p_description text, p_quote_id bigint default null, p_photo text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  id bigint := ow_next_row_id(p_shop_id, 'row:cash_txn', 0);
begin
  if not (p_amount > 0) then raise exception 'A cash line is never zero.' using errcode = '22023'; end if;
  insert into cash_txns (id, shop_id, date, account, type, category, amount, description, time, quote_id, entered_by, photo)
       values (id, p_shop_id, ow_today(), coalesce(nullif(btrim(p_account), ''), 'cash'), p_type, p_category, round(p_amount), p_description,
               to_char(now() at time zone ow_shop_tz(), 'HH24:MI'), p_quote_id, auth.uid(), p_photo);
  return id;
end $$;
revoke all on function ow_accounts_cash(uuid, text, text, text, numeric, text, bigint, text) from public;

create or replace function ow_cash_rows(p_ids bigint[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb) from cash_txns c where c.id = any(p_ids)
$$;
revoke all on function ow_cash_rows(bigint[]) from public;

-- The month, in words, the way the app shows it (periodLabel: "October 2026").
create or replace function ow_period_word(p_period text) returns text
language sql immutable as $$
  select case when p_period ~ '^\d{4}-\d{2}$' then to_char(to_date(p_period || '-01', 'YYYY-MM-DD'), 'FMMonth YYYY') else coalesce(p_period, '') end
$$;

/* ---------------- wages and rent ---------------- */
-- p_dues: the month's dues to pay, each {id (null when the console only
-- imagined it yet), kind ('wage'|'rent'), refId, period, dueDate, amount,
-- days, rate, basis, notes, payments, absences, proposed, pay}. A due with no
-- row yet gets one; each is paid its balance (never more than `pay`).
create or replace function pay_dues(p_shop_id uuid, p_dues jsonb, p_account text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  d jsonb;
  row dues%rowtype;
  did bigint;
  pay numeric;
  want numeric;
  nm text;
  kind_label text;
  cat text;
  cid bigint;
  pays jsonb;
  total numeric := 0;
  cash_ids bigint[] := '{}';
  out_rows jsonb := '[]'::jsonb;
begin
  if uid is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'payroll.run')) then
    raise exception 'Paying wages and rent needs payroll.run.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_dues) <> 'array' or jsonb_array_length(p_dues) = 0 then
    raise exception 'Nothing is ticked to pay.' using errcode = '22023';
  end if;
  for d in select * from jsonb_array_elements(p_dues) loop
    if (d ->> 'kind') not in ('wage', 'rent') or coalesce(d ->> 'refId', '') = '' or coalesce(d ->> 'period', '') = '' then
      raise exception 'A due needs its kind, person and month.' using errcode = '22023';
    end if;
    -- The row: by id, else by (kind, person, month), else made now from what the console computed.
    row := null;
    if ow_num(d ->> 'id') is not null then
      select * into row from dues where shop_id = p_shop_id and id = ow_num(d ->> 'id')::bigint for update;
    end if;
    if row.id is null then
      select * into row from dues where shop_id = p_shop_id and kind = d ->> 'kind' and ref_id = d ->> 'refId' and period = d ->> 'period' for update;
    end if;
    if row.id is null then
      did := ow_next_row_id(p_shop_id, 'row:due', 0);
      insert into dues (id, shop_id, kind, ref_id, period, due_date, amount, days, rate, paid, notes, payload)
           values (did, p_shop_id, d ->> 'kind', d ->> 'refId', d ->> 'period', nullif(d ->> 'dueDate', '')::date, ow_num(d ->> 'amount'), ow_num(d ->> 'days'), coalesce(ow_num(d ->> 'rate'), 0), 0, nullif(d ->> 'notes', ''),
                   jsonb_build_object('payments', '[]'::jsonb, 'absences', coalesce(d -> 'absences', '[]'::jsonb), 'basis', d -> 'basis')
                   || case when jsonb_typeof(d -> 'proposed') = 'array' then jsonb_build_object('proposed', d -> 'proposed') else '{}'::jsonb end)
        returning * into row;
    end if;
    want := coalesce(ow_num(d ->> 'pay'), greatest(0, coalesce(row.amount, 0) - coalesce(row.paid, 0)));
    pay := round(least(want, greatest(0, coalesce(row.amount, 0) - coalesce(row.paid, 0))));
    continue when not (pay > 0);
    if row.kind = 'rent' then
      select coalesce(nullif(r.premises, ''), 'Premises') into nm from rent_agreements r where r.shop_id = p_shop_id and r.id::text = row.ref_id;
      nm := coalesce(nm, 'Rent (agreement removed)'); kind_label := 'Rent'; cat := 'Rent';
    else
      select s.name into nm from staff s where s.shop_id = p_shop_id and s.id = row.ref_id;
      nm := coalesce(nm, 'Staff member (removed)'); kind_label := 'Wages'; cat := 'Salaries & Wages';
    end if;
    cid := ow_accounts_cash(p_shop_id, p_account, 'payment', cat, pay, kind_label || ' — ' || nm || ' — ' || ow_period_word(row.period));
    cash_ids := cash_ids || cid;
    pays := case when jsonb_typeof(row.payload -> 'payments') = 'array' then row.payload -> 'payments' else '[]'::jsonb end;
    pays := pays || jsonb_build_object('date', ow_today(), 'amount', pay, 'account', coalesce(nullif(btrim(p_account), ''), 'cash'), 'cashTxnId', cid);
    update dues set paid = coalesce(paid, 0) + pay, payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('payments', pays)
     where shop_id = p_shop_id and id = row.id returning * into row;
    perform ow_accounts_log(p_shop_id, 'payroll.run', 'Paid ' || lower(kind_label) || ': ' || nm || ', ' || ow_period_word(row.period) || ' — ' || ow_money(pay), pay, jsonb_build_object('table', 'dues', 'id', row.id));
    total := total + pay;
    out_rows := out_rows || to_jsonb(row);
  end loop;
  return jsonb_build_object('paid', total, 'dues', out_rows, 'cashRows', ow_cash_rows(cash_ids));
end $$;
grant execute on function pay_dues(uuid, jsonb, text) to authenticated;

/* ---------------- loans ---------------- */
create or replace function repay_loan(p_shop_id uuid, p_loan_id bigint, p_amount numeric, p_account text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l loans%rowtype;
  amt numeric := round(coalesce(p_amount, 0));
  cid bigint;
  reps jsonb;
  acct text := coalesce(nullif(btrim(p_account), ''), 'cash');
begin
  if auth.uid() is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'loan.edit')) then
    raise exception 'Repaying a loan needs loan.edit.' using errcode = '42501';
  end if;
  if not (amt > 0) then raise exception 'Nothing to repay: the amount is zero.' using errcode = '22023'; end if;
  select * into l from loans where shop_id = p_shop_id and id = p_loan_id for update;
  if not found then raise exception 'That loan is no longer in the books.' using errcode = 'P0002'; end if;
  if l.closed_on is not null then raise exception 'That loan is closed.' using errcode = '22023'; end if;
  cid := ow_accounts_cash(p_shop_id, acct, 'payment', 'Loan Repayment', amt, coalesce(l.lender, 'Loan') || ' — repayment');
  reps := case when jsonb_typeof(l.payload -> 'repayments') = 'array' then l.payload -> 'repayments' else '[]'::jsonb end;
  reps := reps || jsonb_build_object('date', ow_today(), 'amount', amt, 'note', '', 'cashTxnId', cid);
  update loans set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('repayments', reps) where shop_id = p_shop_id and id = l.id returning * into l;
  perform ow_accounts_log(p_shop_id, 'loan.edit', 'Repaid ' || coalesce(l.lender, 'the loan') || ' ' || ow_money(amt) || ' from ' || acct, amt, jsonb_build_object('table', 'loans', 'id', l.id));
  return jsonb_build_object('loan', to_jsonb(l), 'cashTxnId', cid, 'cashRows', ow_cash_rows(array[cid]));
end $$;
grant execute on function repay_loan(uuid, bigint, numeric, text) to authenticated;

-- p_row: {lender, principal, ratePct, termMonths, fees}
create or replace function receive_loan(p_shop_id uuid, p_row jsonb, p_account text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l loans%rowtype;
  lid bigint;
  amt numeric := round(coalesce(ow_num(p_row ->> 'principal'), 0));
  fees numeric := round(coalesce(ow_num(p_row ->> 'fees'), 0));
  lender text := btrim(coalesce(p_row ->> 'lender', ''));
  months integer := greatest(1, coalesce(ow_num(p_row ->> 'termMonths'), 12))::integer;
  cid bigint;
begin
  if auth.uid() is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'loan.edit')) then
    raise exception 'Recording a loan needs loan.edit.' using errcode = '42501';
  end if;
  if not (amt > 0) then raise exception 'Nothing to record: the amount is zero.' using errcode = '22023'; end if;
  if not (amt - fees > 0) then raise exception 'The fees are the whole loan; nothing came in.' using errcode = '22023'; end if;
  if lender = '' then lender := 'Lender'; end if;
  cid := ow_accounts_cash(p_shop_id, p_account, 'receipt', 'Loan Received', amt - fees, lender || case when fees > 0 then ' — ' || ow_money(fees) || ' kept in fees' else '' end);
  lid := ow_next_row_id(p_shop_id, 'row:loan', 0);
  insert into loans (id, shop_id, lender, principal, rate_pct, method, term_months, fees, round_to, frequency, fee_per_instalment, started_on, closed_on, notes, cash_txn_id, payload)
       values (lid, p_shop_id, lender, amt, coalesce(ow_num(p_row ->> 'ratePct'), 20), 'reducing_balance', months, fees, 1000, 'monthly', 0, ow_today(), null, null, cid, jsonb_build_object('repayments', '[]'::jsonb))
    returning * into l;
  perform ow_accounts_log(p_shop_id, 'loan.edit', 'Loan received from ' || lender || ': ' || ow_money(amt) || ' over ' || months || ' months', amt, jsonb_build_object('table', 'loans', 'id', lid));
  return jsonb_build_object('loan', to_jsonb(l), 'cashTxnId', cid, 'cashRows', ow_cash_rows(array[cid]));
end $$;
grant execute on function receive_loan(uuid, jsonb, text) to authenticated;

/* ---------------- assets ---------------- */
-- p_row: {name, category, cost, years, from}
create or replace function buy_asset(p_shop_id uuid, p_row jsonb, p_account text, p_photo text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a fixed_assets%rowtype;
  aid bigint;
  cost numeric := round(coalesce(ow_num(p_row ->> 'cost'), 0));
  nm text := btrim(coalesce(p_row ->> 'name', ''));
  cat text := coalesce(nullif(btrim(p_row ->> 'category'), ''), 'Machine');
  years integer := greatest(1, least(30, coalesce(ow_num(p_row ->> 'years'), 5)))::integer;
  acct text := coalesce(nullif(btrim(p_account), ''), 'bank');
  cid bigint;
begin
  if auth.uid() is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'asset.edit')) then
    raise exception 'Recording an asset needs asset.edit.' using errcode = '42501';
  end if;
  if not (cost > 0) then raise exception 'Nothing to record: what did it cost?' using errcode = '22023'; end if;
  if nm = '' then raise exception 'Name the asset.' using errcode = '22023'; end if;
  cid := ow_accounts_cash(p_shop_id, acct, 'payment', 'Equipment purchase', cost, nm || ' — ' || cat, null, p_photo);
  aid := ow_next_row_id(p_shop_id, 'row:fixed_asset', 0);
  insert into fixed_assets (id, shop_id, name, category, cost, acquired_on, method, life_months, rate_pct, salvage, disposed_on, disposal_proceeds, notes, cash_txn_id, disposal_cash_txn_id, loan_id)
       values (aid, p_shop_id, nm, cat, cost, ow_today(), 'straight_line', years * 12, null, 0, null, null, nullif('From ' || btrim(coalesce(p_row ->> 'from', '')), 'From '), cid, null, null)
    returning * into a;
  perform ow_accounts_log(p_shop_id, 'asset.edit', 'Bought ' || nm || ' (' || cat || ') for ' || ow_money(cost) || ' from ' || acct || ', over ' || years || ' years', cost, jsonb_build_object('table', 'fixed_assets', 'id', aid));
  return jsonb_build_object('asset', to_jsonb(a), 'cashTxnId', cid, 'cashRows', ow_cash_rows(array[cid]));
end $$;
grant execute on function buy_asset(uuid, jsonb, text, text) to authenticated;

-- p_how: 'sold' (p_proceeds in), 'stolen' or 'gone'. p_nbv: what it stood at on the books, for the log line.
create or replace function dispose_asset(p_shop_id uuid, p_asset_id bigint, p_how text, p_proceeds numeric, p_account text, p_nbv numeric default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a fixed_assets%rowtype;
  proceeds numeric := case when p_how = 'sold' then round(coalesce(p_proceeds, 0)) else 0 end;
  cid bigint := null;
  note text;
begin
  if auth.uid() is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'asset.edit')) then
    raise exception 'Selling or writing off an asset needs asset.edit.' using errcode = '42501';
  end if;
  if coalesce(p_how, '') not in ('sold', 'stolen', 'gone') then raise exception 'Sold, stolen or thrown away?' using errcode = '22023'; end if;
  select * into a from fixed_assets where shop_id = p_shop_id and id = p_asset_id for update;
  if not found then raise exception 'That asset is no longer in the books.' using errcode = 'P0002'; end if;
  if a.disposed_on is not null then raise exception '% is off the books already.', a.name using errcode = '22023'; end if;
  if proceeds > 0 then
    cid := ow_accounts_cash(p_shop_id, p_account, 'receipt', 'Asset Sale', proceeds, 'Sold ' || a.name);
  end if;
  note := concat_ws(' · ', nullif(a.notes, ''), case p_how when 'stolen' then 'Stolen' when 'gone' then 'Thrown away' else null end);
  update fixed_assets set disposed_on = ow_today(), disposal_proceeds = case when proceeds > 0 then proceeds else null end, disposal_cash_txn_id = cid, notes = nullif(note, '')
   where shop_id = p_shop_id and id = a.id returning * into a;
  perform ow_accounts_log(p_shop_id, 'asset.edit',
    a.name || ': ' || case p_how when 'sold' then 'sold for ' || ow_money(proceeds) when 'stolen' then 'stolen' else 'thrown away' end
      || case when p_nbv is not null then ' (on the books at ' || ow_money(p_nbv) || ')' else '' end,
    proceeds, jsonb_build_object('table', 'fixed_assets', 'id', a.id));
  return jsonb_build_object('asset', to_jsonb(a), 'cashTxnId', cid, 'cashRows', case when cid is null then '[]'::jsonb else ow_cash_rows(array[cid]) end);
end $$;
grant execute on function dispose_asset(uuid, bigint, text, numeric, text, numeric) to authenticated;

/* ---------------- an agent settled ---------------- */
-- The cash a prepay agent brings for their confirmed orders goes onto each
-- order (agentPrepayConfirm); each requested commission claim is paid, from
-- cash when the agent nets it off what they brought, else from p_account.
create or replace function settle_agent(p_shop_id uuid, p_agent_id text, p_account text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ag agents%rowtype;
  q saved_quotes%rowtype;
  owed numeric;
  total numeric;
  cash_in numeric := 0;
  paid_out numeric := 0;
  cid bigint;
  pays jsonb;
  c record;
  from_acct text;
  cash_ids bigint[] := '{}';
  orders jsonb := '[]'::jsonb;
  claims jsonb := '[]'::jsonb;
  n_orders integer := 0;
  n_claims integer := 0;
begin
  if uid is null or not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'agent.pay')) then
    raise exception 'Settling with an agent needs agent.pay.' using errcode = '42501';
  end if;
  select * into ag from agents where shop_id = p_shop_id and id = p_agent_id;
  if not found then raise exception 'That agent is not on the books.' using errcode = 'P0002'; end if;
  -- Cash for each order, onto the order.
  if coalesce(ag.payment_term, 'prepay') = 'prepay' then
    for q in select * from saved_quotes s
              where s.shop_id = p_shop_id and s.payload ->> 'originAgentId' = ag.id and not coalesce(s.voided, false)
                and coalesce(s.payload ->> 'agentPaymentStatus', '') <> 'paid' and coalesce(s.payload ->> 'shopConfirmedAt', '') <> ''
              order by s.id for update
    loop
      total := round(ow_order_total(p_shop_id, coalesce(q.payload, '{}'::jsonb), false));
      owed := greatest(0, total - coalesce(q.amount_paid, 0));
      continue when not (owed > 0.5);
      owed := round(owed);
      cid := ow_accounts_cash(p_shop_id, 'cash', 'receipt', 'Agent Payment', owed, 'Cash payment from ' || coalesce(ag.name, ag.id) || ' — order #' || q.id, q.id);
      cash_ids := cash_ids || cid;
      pays := case when jsonb_typeof(q.payload -> 'payments') = 'array' then q.payload -> 'payments' else '[]'::jsonb end;
      pays := pays || jsonb_build_object('date', ow_today(), 'amount', owed, 'note', 'Cash', 'cashTxnId', cid);
      update saved_quotes set amount_paid = coalesce(amount_paid, 0) + owed,
                              payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('payments', pays, 'agentPaymentStatus', 'paid')
       where shop_id = p_shop_id and id = q.id;
      cash_in := cash_in + owed; n_orders := n_orders + 1;
      orders := orders || jsonb_build_object('id', q.id, 'amount', owed, 'cashTxnId', cid);
    end loop;
  end if;
  -- Each claim paid.
  select coalesce(sum(bonus_amount), 0) into paid_out from agent_commission_claims where shop_id = p_shop_id and agent_id = ag.id and status = 'requested';
  from_acct := case when cash_in - paid_out >= 0 then 'cash' else coalesce(nullif(btrim(p_account), ''), 'cash') end;
  for c in select * from agent_commission_claims where shop_id = p_shop_id and agent_id = ag.id and status = 'requested' order by month, id for update loop
    continue when not (coalesce(c.bonus_amount, 0) > 0);
    cid := ow_accounts_cash(p_shop_id, from_acct, 'payment', 'Agent Commission', c.bonus_amount,
                            'Bonus commission — ' || coalesce(ag.name, ag.id) || ' — ' || coalesce(to_char(to_date(c.month || '-01', 'YYYY-MM-DD'), 'FMMonth'), c.month));
    cash_ids := cash_ids || cid;
    update agent_commission_claims set status = 'paid', paid_at = now(), cash_txn_id = cid where shop_id = p_shop_id and id = c.id;
    n_claims := n_claims + 1;
    claims := claims || jsonb_build_object('id', c.id, 'amount', c.bonus_amount, 'cashTxnId', cid);
  end loop;
  if n_orders = 0 and n_claims = 0 then
    raise exception 'Nothing is due between the shop and %.', coalesce(ag.name, 'this agent') using errcode = '22023';
  end if;
  perform ow_accounts_log(p_shop_id, 'agent.pay',
    'Settled with ' || coalesce(ag.name, ag.id) || ': ' || concat_ws(', ', case when n_orders > 0 then ow_money(cash_in) || ' cash in' end, case when n_claims > 0 then ow_money(paid_out) || ' commission paid' end),
    cash_in - paid_out, jsonb_build_object('table', 'agents', 'id', ag.id));
  return jsonb_build_object('cashIn', cash_in, 'paidOut', paid_out, 'orders', orders, 'claims', claims, 'cashRows', ow_cash_rows(cash_ids));
end $$;
grant execute on function settle_agent(uuid, text, text) to authenticated;
