-- Push for every app: every handoff that waits on someone sends that
-- person a push.
--
-- docs/decision-rights.md section 3, "Push notifications are part of the
-- system", and section 5 step 0. What lives here:
--
--   1. ANY LOGIN CAN TAKE PUSHES. push_subscriptions (0011, 0015) was keyed
--      to a staff row, so a login without one (the owner) could not
--      register a phone. staff_id may now be empty; the row is the login's
--      (user_id), as its policy always said.
--
--   2. THE OUTBOX, push_outbox. One row per push, written by the database
--      in the same transaction as the handoff, so a push is never sent for
--      a write that did not happen and never lost for one that did. A row
--      names who it is for in one of three ways:
--        to_user   one login (the salesperson who took the order)
--        to_task   every login whose role holds the task (role_tasks), so
--                  the push follows the decision rights: a price to the
--                  Manager, a trip's cash to Accounts. The owner and an
--                  admin hold every task without a role_tasks row, so a
--                  day-to-day push never reaches them: the owner watches
--                  the machine and gets a digest, not a queue.
--        to_role   every login with that role (the owner's digest)
--      Whoever made the write is never pushed about it (from_user). A
--      dedupe key keeps one push per thing: saving an order again does not
--      ring the Manager again.
--
--   3. WHAT SENDS ONE (each trigger is AFTER the write and never stops it):
--        to the Manager
--          a price to approve           price.approve     (counter sale too)
--          a credit hold                credit.release
--          a short pick                 pick.settle
--          a trip difference            trip.difference
--          a write-off report           stock.writeoff
--          an agent's request           agent.change
--          an order delivered           invoice.make      (it invoices itself in 24 hours)
--        to the Store and to Accounts
--          a trip back                  stock.receive, trip.cash
--        to the Buyer
--          a restock line held          buy.restock
--        to the salesperson who took it (payload.takenBy)
--          the Manager decided a price  ("tell them")
--          a price changed on a supplier line of an open order
--          a request listed by Sourcing (sourcing_leads -> 'listed'): the
--          salesperson who asked (sourcing.ask) or took the order
--        to the owner
--          the day's log, as one digest at 19:00 Kampala (pg_cron)
--
--   4. DELIVERY is the push-send Edge Function (supabase/functions/
--      push-send), the same native FCM sender notify-worker uses
--      (FIREBASE_SERVICE_ACCOUNT_JSON). It is driven two ways, so a push
--      is not lost when one fails:
--        - a Database Webhook on push_outbox INSERT (Dashboard ->
--          Database -> Webhooks -> push_outbox, Insert, the push-send
--          function, header x-webhook-secret = PUSH_SEND_SECRET);
--        - and on every call it sweeps every unsent row of the last day.
--      It reads the outbox with the service key; no login reads another's.
--
-- Applied by hand like every migration here, after 0119. Every function,
-- trigger and policy is replaced or dropped before it is created. Safe to
-- run twice -- and RUN IT AGAIN AFTER 0122: the write-off reports and the
-- restock lines are 0122's tables, so on a database without them yet
-- those two triggers are skipped and named, and a second run attaches
-- them.
--
-- CHECK AFTERWARDS:
--   select count(*) from pg_trigger where tgname like '%_ow_push';
--   -- 6
--   select jobname, schedule from cron.job where jobname = 'ow-owner-digest';
--   -- 1 row, '0 16 * * *' (16:00 UTC is 19:00 in Kampala; only where pg_cron is on)
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_push on saved_quotes;
--   drop trigger if exists collection_trips_ow_push on collection_trips;
--   drop trigger if exists stock_reports_ow_push on stock_reports;
--   drop trigger if exists restock_lines_ow_push on restock_lines;
--   drop trigger if exists prices_ow_push on prices;
--   drop trigger if exists sourcing_leads_ow_push on sourcing_leads;
--   select cron.unschedule('ow-owner-digest');
--   (the outbox and its rows may stay; nothing reads them once the
--   webhook is off)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Any login can take pushes.
alter table push_subscriptions alter column staff_id drop not null;
create index if not exists push_subscriptions_shop_user_idx on push_subscriptions(shop_id, user_id);

-- ---------------------------------------------------------------------
-- 2. The outbox.
create table if not exists push_outbox (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  to_user uuid,
  to_task text,
  to_role text,
  from_user uuid,
  ref jsonb,
  dedupe text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_to int,
  tries int not null default 0,
  last_error text,
  constraint push_outbox_names_someone check (to_user is not null or to_task is not null or to_role is not null)
);
create unique index if not exists push_outbox_dedupe_idx on push_outbox(shop_id, dedupe) where dedupe is not null;
create index if not exists push_outbox_unsent_idx on push_outbox(created_at) where sent_at is null;
alter table push_outbox enable row level security;
-- A login reads the pushes sent to it by name (an in-app list, later);
-- nobody writes the outbox but the database itself.
drop policy if exists "own pushes" on push_outbox;
create policy "own pushes" on push_outbox for select using (to_user = auth.uid());

-- Who a push goes to: members of its shop, by login, task or role, never
-- the login that made the write.
create or replace function ow_push_recipients(p_id bigint)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct m.user_id
    from push_outbox o
    join shop_members m on m.shop_id = o.shop_id
   where o.id = p_id
     and m.user_id is distinct from o.from_user
     and ((o.to_user is not null and m.user_id = o.to_user)
       or (o.to_task is not null and exists (select 1 from role_tasks rt where rt.role = m.role and rt.task = o.to_task))
       or (o.to_role is not null and m.role = o.to_role))
$$;
revoke all on function ow_push_recipients(bigint) from public, anon, authenticated;
grant execute on function ow_push_recipients(bigint) to service_role;

-- One push into the outbox. Never stops the write that asked for it.
create or replace function ow_push(p_shop_id uuid, p_kind text, p_title text, p_body text,
                                   p_to_user uuid, p_to_task text, p_to_role text, p_ref jsonb, p_dedupe text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_to_user is null and p_to_task is null and p_to_role is null then return; end if;
  if p_to_user is not null and p_to_user = auth.uid() then return; end if;
  insert into push_outbox (shop_id, kind, title, body, to_user, to_task, to_role, from_user, ref, dedupe)
       values (p_shop_id, p_kind, left(p_title, 120), left(p_body, 400), p_to_user, p_to_task, p_to_role, auth.uid(), p_ref, p_dedupe)
  on conflict (shop_id, dedupe) where dedupe is not null do nothing;
exception when others then
  raise notice 'push_outbox: % (%)', sqlerrm, sqlstate;
end $$;
revoke all on function ow_push(uuid, text, text, text, uuid, text, text, jsonb, text) from public, anon, authenticated;

create or replace function ow_money(n numeric) returns text
language sql immutable as $$ select to_char(round(coalesce(n, 0)), 'FM999,999,999,990') $$;

create or replace function ow_uuid(v text) returns uuid
language plpgsql immutable as $$
begin
  if v is null or btrim(v) = '' then return null; end if;
  return v::uuid;
exception when others then return null;
end $$;

-- ---------------------------------------------------------------------
-- 3. What sends one.

-- 3a. Orders.
create or replace function saved_quotes_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := case when tg_op = 'UPDATE' then coalesce(old.payload, '{}'::jsonb) else '{}'::jsonb end;
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'an order');
  taker uuid := ow_uuid(p ->> 'takenBy');
  ref jsonb := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  presets jsonb;
  n_why text;
  o_why text;
  terms text;
  line jsonb;
  c customers;
  counter boolean := coalesce(p ->> 'counter', '') = 'true' or coalesce(p ->> 'counterSale', '') = 'true';
begin
  if coalesce(new.voided, false) then return null; end if;
  begin
    presets := coalesce((select a.presets from app_settings a where a.shop_id = new.shop_id), '{}'::jsonb);
    terms := ow_gate_terms(p);
    if new.status = 'draft' and not new.invoiced then
      n_why := ow_gate_reason(new.shop_id, p, new.amount_paid);
    end if;
    if tg_op = 'UPDATE' and old.status = 'draft' and not old.invoiced and not coalesce(old.voided, false) then
      o_why := ow_gate_reason(old.shop_id, o, old.amount_paid);
    end if;

    -- A price to approve, and a counter sale's price with the customer at
    -- the counter.
    if n_why = 'price' then
      select e into line from jsonb_array_elements(case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end) e
       where ow_line_waits_price(new.shop_id, e, presets) limit 1;
      perform ow_push(new.shop_id, 'price.waits',
        case when counter then 'A counter sale waits for your price' else 'A price waits for you' end,
        client || ' — ' || coalesce(line ->> 'productName', 'a line') || ' at '
          || ow_money(coalesce(ow_num(line ->> 'sellPrice'), ow_line_sell_price(new.shop_id, line, presets))),
        null, 'price.approve', null, ref, 'price:' || new.id || ':' || terms);
    end if;

    -- A credit hold.
    if n_why = 'credit' then
      select * into c from customers where shop_id = new.shop_id and id = p ->> 'customerId';
      perform ow_push(new.shop_id, 'credit.hold', 'An order waits on credit',
        client || ' would owe ' || ow_money(coalesce(c.debt, 0) + greatest(0, round(ow_order_total(new.shop_id, p, true)) - coalesce(new.amount_paid, 0)))
          || ' of a ' || ow_money(c.credit_limit) || ' limit',
        null, 'credit.release', null, ref, 'credit:' || new.id || ':' || terms);
    end if;

    -- The Manager decided the price: the salesperson tells the customer.
    if o_why = 'price' and n_why is distinct from 'price' and taker is not null then
      perform ow_push(new.shop_id, 'price.decided', 'The Manager decided the price',
        client || case when new.status <> 'draft' then ' — the order moves on. Tell them.' else ' — tell them.' end,
        taker, null, null, ref, 'decided:' || new.id || ':' || terms);
    end if;

    -- A short pick.
    if ow_pick_shortfall(p) and (tg_op = 'INSERT' or not ow_pick_shortfall(o)) then
      perform ow_push(new.shop_id, 'pick.short', 'A short pick to settle',
        client || ' — the shelf did not have it all. Bill what went, or the full quantity.',
        null, 'pick.settle', null, ref, 'short:' || new.id || ':' || md5(coalesce(p -> 'items', '[]'::jsonb)::text));
    end if;

    -- An agent's request: a change asked for, or a cancel to close.
    if p -> 'agentChange' ->> 'state' = 'asked' and (o -> 'agentChange' ->> 'state') is distinct from 'asked' then
      perform ow_push(new.shop_id, 'agent.change', 'An agent asks to change an order',
        client || case when p -> 'agentChange' ->> 'cancel' = 'true' then ' — they ask to cancel it.' else ' — they ask for fewer.' end,
        null, 'agent.change', null, ref, 'agentchange:' || new.id || ':' || coalesce(p -> 'agentChange' ->> 'at', ''));
    end if;
    if p ? 'agentCancel' and not o ? 'agentCancel' and not new.invoiced then
      perform ow_push(new.shop_id, 'agent.cancel', 'An agent cancelled an order', client || ' — close it.',
        null, 'agent.change', null, ref, 'agentcancel:' || new.id);
    end if;

    -- Delivered: the Manager invoices it, or it invoices itself in 24 hours.
    if new.status = 'completed' and not new.invoiced and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
      perform ow_push(new.shop_id, 'order.delivered', 'Delivered — ready to invoice',
        client || ' — it invoices itself 24 hours after delivery.',
        null, 'invoice.make', null, ref, 'delivered:' || new.id);
    end if;
  exception when others then
    raise notice 'push (order %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists saved_quotes_ow_push on saved_quotes;
create trigger saved_quotes_ow_push after insert or update on saved_quotes
  for each row execute function saved_quotes_ow_push();

-- 3b. Trips: back from the supplier, and a difference at the yard.
create or replace function collection_trips_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sup text;
  ref jsonb := jsonb_build_object('table', 'collection_trips', 'id', new.id);
begin
  if coalesce(new.voided, false) then return null; end if;
  begin
    select s.name into sup from suppliers s where s.shop_id = new.shop_id and s.id = new.supplier_id;
    sup := coalesce(sup, 'the supplier');
    if new.status = 'collected' and (tg_op = 'INSERT' or old.status is distinct from 'collected') then
      perform ow_push(new.shop_id, 'trip.back', 'A trip is back — count it in', 'From ' || sup || ': onto the shelf after the yard count.',
        null, 'stock.receive', null, ref, 'tripback:' || new.id || ':store');
      perform ow_push(new.shop_id, 'trip.cash', 'A trip is back — settle its cash', 'From ' || sup || ': the change and the receipts.',
        null, 'trip.cash', null, ref, 'tripback:' || new.id || ':cash');
    end if;
    if new.yard_checked_at is not null and (tg_op = 'INSERT' or old.yard_checked_at is null)
       and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(new.lines) = 'array' then new.lines else '[]'::jsonb end) l
                    where l ? 'yardQty' and ow_num(l ->> 'yardQty') is distinct from ow_num(l ->> 'gotQty')) then
      perform ow_push(new.shop_id, 'trip.difference', 'A trip came in short or over', 'From ' || sup || ': the yard''s count is not what the Buyer brought.',
        null, 'trip.difference', null, ref, 'tripdiff:' || new.id);
    end if;
  exception when others then
    raise notice 'push (trip %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists collection_trips_ow_push on collection_trips;
create trigger collection_trips_ow_push after insert or update on collection_trips
  for each row execute function collection_trips_ow_push();

-- 3c. A write-off report from the Store.
create or replace function stock_reports_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform ow_push(new.shop_id, 'stock.report', 'Stock reported ' || coalesce(new.why, ''),
    trim_scale(coalesce(new.qty, 0))::text || ' ' || coalesce(new.name, 'items') || coalesce(' — ' || nullif(new.reported_by_name, ''), ''),
    null, 'stock.writeoff', null, jsonb_build_object('table', 'stock_reports', 'id', new.id), 'report:' || new.id);
  return null;
exception when others then
  raise notice 'push (report): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
do $$
begin
  if to_regclass('public.stock_reports') is null then
    raise notice 'skipped stock_reports: not on this database yet (0122 makes it). Run this file again after 0122.';
  else
    drop trigger if exists stock_reports_ow_push on stock_reports;
    create trigger stock_reports_ow_push after insert on stock_reports
      for each row execute function stock_reports_ow_push();
  end if;
end $$;

-- 3d. A restock line the Manager held.
create or replace function restock_lines_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'held' and old.status is distinct from 'held' then
    perform ow_push(new.shop_id, 'restock.held', 'The Manager held a restock line',
      coalesce(new.name, 'A line') || ' — not to buy for now.',
      null, 'buy.restock', null, jsonb_build_object('table', 'restock_lines', 'id', new.id), 'held:' || new.id || ':' || coalesce(new.held_at::text, ''));
  end if;
  return null;
exception when others then
  raise notice 'push (restock): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
do $$
begin
  if to_regclass('public.restock_lines') is null then
    raise notice 'skipped restock_lines: not on this database yet (0122 makes it). Run this file again after 0122.';
  else
    drop trigger if exists restock_lines_ow_push on restock_lines;
    create trigger restock_lines_ow_push after update on restock_lines
      for each row execute function restock_lines_ow_push();
  end if;
end $$;

-- 3e. A supplier's price changed: whoever took an open order with that
-- supplier's line on it tells the customer. Once a day per order and row.
create or replace function prices_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  q record;
  pname text;
begin
  if new.wholesale is not distinct from old.wholesale and new.retail is not distinct from old.retail
     and new.tiers is not distinct from old.tiers then
    return null;
  end if;
  select name into pname from products where shop_id = new.shop_id and id = new.product_id;
  for q in
    select s.id, coalesce(nullif(s.client_name, ''), 'an order') as client, ow_uuid(s.payload ->> 'takenBy') as taker
      from saved_quotes s
     where s.shop_id = new.shop_id and s.status in ('draft', 'awaiting_goods') and not s.invoiced and not s.voided
       and ow_uuid(s.payload ->> 'takenBy') is not null
       and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(s.payload -> 'items') = 'array' then s.payload -> 'items' else '[]'::jsonb end) e
                    where e ->> 'productId' = new.product_id and e ->> 'supplierId' = new.supplier_id
                      and ow_num(e ->> 'variantIdx') is not distinct from ow_num(new.variant_idx))
  loop
    perform ow_push(new.shop_id, 'price.changed', 'A price changed on your order',
      q.client || ' — ' || coalesce(pname, 'an item') || ' is now ' || ow_money(coalesce(new.retail, new.wholesale)) || '. Tell them.',
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

-- 3f. Sourcing listed what somebody asked for: each salesperson who asked
-- (a sourcing.ask request's by, as sales.html writes it, or whoever took
-- the order a request came from). A withdrawn ask is nobody's.
create or replace function sourcing_leads_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  u uuid;
begin
  if new.status = 'listed' and old.status is distinct from 'listed' and not coalesce(new.voided, false) then
    for u in
      select distinct x.who from (
        select case when r ->> 'source' = 'sourcing.ask' then ow_uuid(r ->> 'by') end as who
          from jsonb_array_elements(case when jsonb_typeof(new.requests) = 'array' then new.requests else '[]'::jsonb end) r
         where coalesce(r ->> 'withdrawn', '') not in ('true')
        union
        select ow_uuid(s.payload ->> 'takenBy')
          from jsonb_array_elements(case when jsonb_typeof(new.requests) = 'array' then new.requests else '[]'::jsonb end) r
          join saved_quotes s on s.shop_id = new.shop_id and s.id::text = r ->> 'orderId'
         where coalesce(r ->> 'withdrawn', '') not in ('true')
      ) x where x.who is not null
    loop
      perform ow_push(new.shop_id, 'request.listed', 'We sell it now',
        coalesce(new.name, 'What you asked for') || ' is on the list. Tell them.',
        u, null, null, jsonb_build_object('table', 'sourcing_leads', 'id', new.id), 'listed:' || new.id || ':' || u);
    end loop;
  end if;
  return null;
exception when others then
  raise notice 'push (lead): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists sourcing_leads_ow_push on sourcing_leads;
create trigger sourcing_leads_ow_push after update on sourcing_leads
  for each row execute function sourcing_leads_ow_push();

-- ---------------------------------------------------------------------
-- 4. The owner's digest: the day's log, once, at 19:00 Kampala.
create or replace function ow_owner_digest()
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  d date := ow_today();
begin
  for r in
    select l.shop_id, count(*) as decisions,
           (select string_agg(x.task || ' ' || x.k, ', ' order by x.k desc, x.task)
              from (select task, count(*) as k from decision_log l2
                     where l2.shop_id = l.shop_id and (l2.at at time zone ow_shop_tz())::date = d
                     group by task order by count(*) desc limit 3) x) as top
      from decision_log l
     where (l.at at time zone ow_shop_tz())::date = d
     group by l.shop_id
  loop
    perform ow_push(r.shop_id, 'owner.digest', 'Today: ' || r.decisions || ' decision' || case when r.decisions = 1 then '' else 's' end,
      coalesce(r.top, '') || '. The log has each one.', null, null, 'owner',
      jsonb_build_object('table', 'decision_log', 'date', d), 'digest:' || d);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function ow_owner_digest() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not switched on here, so the owner''s digest is not scheduled. Switch it on (Database -> Extensions -> pg_cron) and run this file again. (%)', sqlerrm;
    return;
  end;
  begin
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'ow-owner-digest';
    perform cron.schedule('ow-owner-digest', '0 16 * * *', 'select public.ow_owner_digest()');
  exception when others then
    raise notice 'The owner''s digest could not be scheduled: %', sqlerrm;
  end;
end $$;
