-- The pushes the notifications canvas added: eleven handoffs that waited
-- on someone and told nobody. The owner reviewed them on the canvas
-- ("Omni-Ware Notifications") and kept all eleven.
--
-- Each one goes through 0120's outbox (ow_push): to the task that decides
-- it (role_tasks, so it follows docs/decision-rights.md and never queues
-- the owner), or to the one person who asked. Whoever made the write is
-- never pushed about it; a dedupe key keeps one push per thing. Every
-- trigger runs after the write and never stops it.
--
--   to the Manager
--     An invoice to void or credit   invoice_asks, sent          invoice.void / credit_note.raise
--   to the salesperson
--     Credit released                creditCheck release / cash  the order's takenBy
--     Your void ask was decided      invoice_asks, decided       the asker
--   to the Buyer
--     An order needs buying          an order enters Buying      trip.plan
--     Cash for the trip is ready     trip_cash hand-off done     the Buyer who asked
--   to the Store
--     Your report was decided        stock_reports, decided      the reporter
--   to Accounts
--     A trip needs cash              trip_cash hand-off passed   trip.cash
--     A supplier bill is due tomorrow  every morning, 07:00       bill.pay
--   to Sourcing
--     A new request                  a sourcing.ask request      sourcing.lead
--     A line was dropped at Checking a dropped-line request      sourcing.lead
--     N prices to confirm today      every working day, 08:00    Sourcing, while price.confirm is on
--
-- Applied by hand like every migration here, after 0120 (the outbox),
-- 0122 (stock_reports), 0123 (invoice_asks), 0125 (buyer_handoffs) and
-- 0126 (the Sourcing requests); a table this database does not have yet
-- is skipped and named, and running the file again attaches it. Every
-- function and trigger is replaced or dropped before it is created. Safe
-- to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname like '%_ow_push2' order by 1;
--   -- buyer_handoffs_ow_push2, invoice_asks_ow_push2, saved_quotes_ow_push2,
--   -- sourcing_leads_ow_push2, stock_reports_ow_push2
--   select jobname, schedule from cron.job where jobname in ('ow-bills-due', 'ow-prices-to-confirm');
--   -- '0 4 * * *' and '0 5 * * 1-6' (07:00 and 08:00 in Kampala; only where pg_cron is on)
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_push2 on saved_quotes;
--   drop trigger if exists invoice_asks_ow_push2 on invoice_asks;
--   drop trigger if exists stock_reports_ow_push2 on stock_reports;
--   drop trigger if exists buyer_handoffs_ow_push2 on buyer_handoffs;
--   drop trigger if exists sourcing_leads_ow_push2 on sourcing_leads;
--   select cron.unschedule('ow-bills-due'); select cron.unschedule('ow-prices-to-confirm');
-- ---------------------------------------------------------------------

-- A person's first name, as the pushes say it ("Ruth"), from their staff row.
create or replace function ow_first_name(p_shop_id uuid, p_user uuid)
returns text
language sql stable security definer set search_path = public as $$
  select nullif(split_part(btrim(coalesce(s.name, '')), ' ', 1), '')
    from staff s where s.shop_id = p_shop_id and s.user_id = p_user limit 1
$$;
revoke all on function ow_first_name(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Orders: credit released, and an order that needs buying.
create or replace function saved_quotes_ow_push2() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := case when tg_op = 'UPDATE' then coalesce(old.payload, '{}'::jsonb) else '{}'::jsonb end;
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'An order');
  taker uuid := ow_uuid(p ->> 'takenBy');
  ref jsonb := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  dec text := p -> 'creditCheck' ->> 'decision';
  who text;
  line jsonb;
  lines int;
begin
  if coalesce(new.voided, false) or new.invoiced then return null; end if;
  begin
    -- Credit released (or cash first): the salesperson tells the customer.
    if dec in ('release', 'cash') and (o -> 'creditCheck' ->> 'decision') is distinct from dec and taker is not null then
      who := coalesce(nullif(split_part(btrim(coalesce(p -> 'creditCheck' ->> 'byName', '')), ' ', 1), ''), 'The Manager');
      perform ow_push(new.shop_id, 'credit.decided',
        case when dec = 'release' then 'Credit released' else 'Cash first' end,
        client || case when dec = 'release' then ' — ' || who || ' said yes; the order moves on.'
                       else ' — ' || who || ' asks for the money first. Tell them.' end,
        taker, null, null, ref, 'credit:' || new.id || ':' || dec || ':' || coalesce(p -> 'creditCheck' ->> 'at', ''));
    end if;

    -- An order needs buying: it has just entered Buying.
    if new.status = 'awaiting_goods' and (tg_op = 'INSERT' or old.status is distinct from 'awaiting_goods') then
      select e into line from jsonb_array_elements(case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end) e
       where coalesce(e ->> 'supplierId', '') not in ('', '__stock__') limit 1;
      select count(*) into lines from jsonb_array_elements(case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end) e
       where coalesce(e ->> 'supplierId', '') not in ('', '__stock__');
      perform ow_push(new.shop_id, 'order.buying', 'An order needs buying',
        client || coalesce(' — ' || trim_scale(ow_num(line ->> 'qty'))::text || ' '
          || coalesce(nullif(line ->> 'unit', '') || ' ', '') || coalesce(line ->> 'productName', 'items')
          || coalesce(' from ' || coalesce((select s.name from suppliers s where s.shop_id = new.shop_id and s.id = line ->> 'supplierId'), nullif(line ->> 'supplierName', '')), ''), '')
          || case when lines > 1 then ' · ' || (lines - 1) || ' more' else '' end,
        null, 'trip.plan', null, ref, 'buying:' || new.id || ':' || coalesce(p ->> 'stageEnteredAt', ''));
    end if;
  exception when others then
    raise notice 'push (order %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists saved_quotes_ow_push2 on saved_quotes;
create trigger saved_quotes_ow_push2 after insert or update on saved_quotes
  for each row execute function saved_quotes_ow_push2();

-- ---------------------------------------------------------------------
-- 2. Invoice asks (0123): to the Manager when asked, to the asker when decided.
create or replace function invoice_asks_ow_push2() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  client text;
  inv text := 'INV-' || lpad(coalesce(new.quote_id, 0)::text, 4, '0');
  who text;
  ref jsonb := jsonb_build_object('table', 'invoice_asks', 'id', new.id, 'quote', new.quote_id);
begin
  begin
    select nullif(btrim(coalesce(q.client_name, '')), '') into client from saved_quotes q where q.shop_id = new.shop_id and q.id = new.quote_id;
    if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
      perform ow_push(new.shop_id, 'invoice.ask', 'An invoice to void or credit',
        coalesce(nullif(split_part(btrim(coalesce(new.asked_by_name, '')), ' ', 1), ''), 'Someone')
          || case when new.kind = 'void' then ' asks to void ' else ' asks to credit ' end || inv
          || coalesce(' · ' || client, '') || ' · ' || ow_money(new.amount)
          || coalesce(' — ' || nullif(btrim(coalesce(new.reason, '')), ''), ''),
        null, case when new.kind = 'void' then 'invoice.void' else 'credit_note.raise' end, null, ref, 'invask:' || new.id);
    end if;
    if tg_op = 'UPDATE' and old.status = 'sent' and new.status in ('accepted', 'declined') then
      who := coalesce(ow_first_name(new.shop_id, new.decided_by), 'the Manager');
      perform ow_push(new.shop_id, 'invoice.ask.decided',
        case when new.kind = 'void' then 'Your void ask was decided' else 'Your credit ask was decided' end,
        inv || coalesce(' · ' || client, '') || ' — '
          || case when new.status = 'declined' then 'declined by ' when new.kind = 'void' then 'voided by ' else 'credit note raised by ' end || who || '.',
        new.asked_by, null, null, ref, 'invaskdone:' || new.id);
    end if;
  exception when others then
    raise notice 'push (invoice ask): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 3. A stock report decided (0122): to the Store person who reported it.
create or replace function stock_reports_ow_push2() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'sent' and new.status in ('written_off', 'dismissed') then
    perform ow_push(new.shop_id, 'stock.report.decided', 'Your report was decided',
      trim_scale(coalesce(new.qty, 0))::text || ' ' || coalesce(new.name, 'items')
        || case when new.status = 'written_off' then ' written off by ' else ' — dismissed by ' end
        || coalesce(ow_first_name(new.shop_id, new.decided_by), 'the Manager'),
      new.reported_by, null, null, jsonb_build_object('table', 'stock_reports', 'id', new.id), 'reportdone:' || new.id);
  end if;
  return null;
exception when others then
  raise notice 'push (report decided): % (%)', sqlerrm, sqlstate;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 4. Cash for a trip (0125 buyer_handoffs, trip_cash): asked, to Accounts;
--    handed over, to the Buyer who asked.
create or replace function buyer_handoffs_ow_push2() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  sup text := coalesce(nullif(p ->> 'supplier', ''), (select s.name from suppliers s where s.shop_id = new.shop_id and s.id = p ->> 'supplierId'), 'the supplier');
  amt text := case when ow_num(p ->> 'amount') > 0 then ow_money(ow_num(p ->> 'amount')) end;
  ref jsonb := jsonb_build_object('table', 'buyer_handoffs', 'id', new.id);
begin
  if new.kind <> 'trip_cash' then return null; end if;
  begin
    if tg_op = 'INSERT' and new.status = 'open' then
      perform ow_push(new.shop_id, 'trip.cash.ask', 'A trip needs cash',
        coalesce(nullif(split_part(btrim(coalesce(p ->> 'for', '')), ' ', 1), ''), ow_first_name(new.shop_id, new.created_by), 'The Buyer')
          || ' — ' || coalesce(amt || ' for ', 'cash for ') || sup,
        null, 'trip.cash', null, ref, 'tripcash:' || new.id);
    end if;
    if tg_op = 'UPDATE' and old.status = 'open' and new.status = 'done' and new.done_by is distinct from new.created_by then
      perform ow_push(new.shop_id, 'trip.cash.ready', 'Cash for the trip is ready',
        coalesce(amt || ' for ', 'Cash for ') || sup || ' — collect it from ' || coalesce(ow_first_name(new.shop_id, new.done_by), 'Accounts'),
        new.created_by, null, null, ref, 'tripcashdone:' || new.id);
    end if;
  exception when others then
    raise notice 'push (trip cash): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 5. Sourcing's requests (0126): each new ask on a lead, from Sales
--    (sourcing.ask) or a line dropped at Checking.
create or replace function sourcing_leads_ow_push2() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  ref jsonb := jsonb_build_object('table', 'sourcing_leads', 'id', new.id);
  qty text;
begin
  if coalesce(new.voided, false) then return null; end if;
  for r in
    select e from jsonb_array_elements(case when jsonb_typeof(new.requests) = 'array' then new.requests else '[]'::jsonb end) e
     where coalesce(e ->> 'withdrawn', '') not in ('true')
       and e ->> 'source' in ('sourcing.ask', 'dropped')
       and (tg_op = 'INSERT' or not exists (
             select 1 from jsonb_array_elements(case when jsonb_typeof(old.requests) = 'array' then old.requests else '[]'::jsonb end) o
              where o ->> 'source' is not distinct from e ->> 'source' and o ->> 'at' is not distinct from e ->> 'at'
                and o ->> 'by' is not distinct from e ->> 'by' and o ->> 'orderId' is not distinct from e ->> 'orderId'))
  loop
    begin
      qty := case when ow_num(r ->> 'qty') > 0 then trim_scale(ow_num(r ->> 'qty'))::text end;
      if r ->> 'source' = 'sourcing.ask' then
        perform ow_push(new.shop_id, 'sourcing.request', 'A new request',
          coalesce(nullif(split_part(btrim(coalesce(r ->> 'salesName', '')), ' ', 1), ''), ow_first_name(new.shop_id, ow_uuid(r ->> 'by')), 'Sales')
            || ' asks for ' || coalesce(new.name, 'an item') || coalesce(' · ' || qty, '')
            || coalesce(' for ' || nullif(btrim(coalesce(r ->> 'customerName', '')), ''), ''),
          null, 'sourcing.lead', null, ref, 'req:' || new.id || ':' || md5(r::text));
      else
        perform ow_push(new.shop_id, 'sourcing.dropped', 'A line was dropped at Checking',
          coalesce(nullif(r ->> 'reason', ''), 'Dropped') || ': ' || coalesce(new.name, 'an item')
            || coalesce(' · ' || nullif(btrim(coalesce(r ->> 'customerName', '')), ''), ''),
          null, 'sourcing.lead', null, ref, 'req:' || new.id || ':' || md5(r::text));
      end if;
    exception when others then
      raise notice 'push (request): % (%)', sqlerrm, sqlstate;
    end;
  end loop;
  return null;
exception when others then
  raise notice 'push (requests): % (%)', sqlerrm, sqlstate;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Attach each trigger where its table is.
do $$
declare
  t record;
begin
  for t in select * from (values
      ('invoice_asks', 'invoice_asks_ow_push2', 'after insert or update'),
      ('stock_reports', 'stock_reports_ow_push2', 'after update'),
      ('buyer_handoffs', 'buyer_handoffs_ow_push2', 'after insert or update'),
      ('sourcing_leads', 'sourcing_leads_ow_push2', 'after insert or update')) v(tbl, trg, ev)
  loop
    if to_regclass('public.' || t.tbl) is null then
      raise notice 'skipped %: % is not on this database yet. Run this file again once it is.', t.trg, t.tbl;
    else
      execute format('drop trigger if exists %I on %I', t.trg, t.tbl);
      execute format('create trigger %I %s on %I for each row execute function %I()', t.trg, t.ev, t.tbl, t.trg);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. The mornings. A supplier bill due tomorrow (07:00): its balance as
--    the console counts it, purchaseInvoiceTotal less what is paid.
create or replace function ow_push_bills_due()
returns int
language plpgsql security definer set search_path = public as $$
declare
  b record;
  n int := 0;
  tomorrow date := ow_today() + 1;
begin
  for b in
    select pi.shop_id, pi.id, x.sup, x.due
      from purchase_invoices pi,
           lateral (select coalesce(nullif(pi.payload ->> 'supplierName', ''), 'A supplier') as sup,
                           greatest(0,
                             coalesce((select sum(coalesce(ow_num(i ->> 'qty'), 0) * coalesce(ow_num(i ->> 'price'), 0))
                                         from jsonb_array_elements(case when jsonb_typeof(pi.payload -> 'items') = 'array' then pi.payload -> 'items' else '[]'::jsonb end) i), 0)
                             + greatest(0, coalesce(ow_num(pi.payload ->> 'transport'), 0))
                             - coalesce((select sum(coalesce(ow_num(c ->> 'amount'), 0))
                                           from jsonb_array_elements(case when jsonb_typeof(pi.payload -> 'credits') = 'array' then pi.payload -> 'credits' else '[]'::jsonb end) c
                                          where coalesce(c ->> 'voided', '') not in ('true')), 0)
                             - coalesce(ow_num(pi.payload ->> 'amountPaid'), 0)) as due) x
     where coalesce(pi.payload ->> 'voided', '') not in ('true')
       and ow_ts(pi.payload ->> 'dueDate') is not null
       and (pi.payload ->> 'dueDate')::date = tomorrow
       and x.due > 0
  loop
    perform ow_push(b.shop_id, 'bill.due', 'A supplier bill is due tomorrow', b.sup || ' — ' || ow_money(b.due),
      null, 'bill.pay', null, jsonb_build_object('table', 'purchase_invoices', 'id', b.id), 'billdue:' || b.id || ':' || tomorrow);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function ow_push_bills_due() from public, anon, authenticated;

-- The day's prices, counted as the Sourcing app counts them (sourcing.html
-- todaysShare): the owner's number a day (priceReview.perDay, else a
-- 26th of targetPerPeriod, else 6) less those already confirmed today;
-- from prices older than the stale line (staleDays, else 30) for items
-- asked for in the last 90 days or on the shelf; oldest first, a row with
-- no date the oldest. To Sourcing, and only while Sourcing holds
-- price.confirm and the owner has not switched it off (0127).
create or replace function ow_push_prices_to_confirm()
returns int
language plpgsql security definer set search_path = public as $$
declare
  s record;
  pr jsonb;
  per int;
  stale int;
  done int;
  lft int;
  total int;
  top record;
  n int := 0;
  d date := ow_today();
  off boolean;
begin
  for s in
    select distinct m.shop_id from shop_members m
     where m.role = 'sourcing'
       and exists (select 1 from role_tasks rt where rt.role = 'sourcing' and rt.task = 'price.confirm')
  loop
    off := false;
    if to_regclass('public.shop_task_off') is not null then
      execute 'select exists (select 1 from shop_task_off where shop_id = $1 and role = $2 and task = $3)'
        into off using s.shop_id, 'sourcing', 'price.confirm';
    end if;
    continue when off;
    pr := coalesce((select a.presets -> 'priceReview' from app_settings a where a.shop_id = s.shop_id), '{}'::jsonb);
    per := case when coalesce(ow_num(pr ->> 'perDay'), 0) > 0 then ow_num(pr ->> 'perDay')::int
                when coalesce(ow_num(pr ->> 'targetPerPeriod'), 0) > 0 then greatest(1, ceil(ow_num(pr ->> 'targetPerPeriod') / 26))::int
                else 6 end;
    stale := case when coalesce(ow_num(pr ->> 'staleDays'), 0) > 0 then ow_num(pr ->> 'staleDays')::int else 30 end;

    create temporary table if not exists _ow_share (supplier_id text, ord int) on commit drop;
    truncate _ow_share;
    with rows as (
      select r.* from prices r
       where r.shop_id = s.shop_id
         and exists (select 1 from products p where p.shop_id = s.shop_id and p.id = r.product_id)
         and exists (select 1 from suppliers su where su.shop_id = s.shop_id and su.id = r.supplier_id)),
    demand as (
      select ow_stock_key(e ->> 'productId', ow_num(e ->> 'variantIdx')) as k
        from saved_quotes q, jsonb_array_elements(case when jsonb_typeof(q.payload -> 'items') = 'array' then q.payload -> 'items' else '[]'::jsonb end) e
       where q.shop_id = s.shop_id and not q.voided and coalesce(e ->> 'productId', '') <> ''
         and coalesce(ow_ts(coalesce(nullif(q.payload ->> 'savedAt', ''), nullif(q.payload ->> 'createdAt', ''))),
                      (q.date + time '08:00') at time zone ow_shop_tz(), now()) >= now() - interval '90 days'
      union
      select st.key from stock st where st.shop_id = s.shop_id and st.qty > 0),
    due as (
      select r.supplier_id, r.id, case when r.date is null then null else d - r.date end as age
        from rows r
       where not (r.date = d and r.price_source in ('confirmed', 'purchase'))
         and ow_stock_key(r.product_id, ow_num(r.variant_idx)) in (select k from demand))
    insert into _ow_share (supplier_id, ord)
    select x.supplier_id, row_number() over (order by (x.age is null) desc, x.age desc, x.id::text)
      from due x where x.age is null or x.age > stale;
    select count(*) into done from prices r where r.shop_id = s.shop_id and r.date = d and r.price_source in ('confirmed', 'purchase');
    lft := greatest(0, per - done);
    select count(*) into total from _ow_share where ord <= lft;
    continue when total = 0;
    select sh.supplier_id, count(*) as k,
           coalesce((select su.name from suppliers su where su.shop_id = s.shop_id and su.id = sh.supplier_id), 'one supplier') as name
      into top from _ow_share sh where sh.ord <= lft group by sh.supplier_id order by count(*) desc, sh.supplier_id limit 1;
    perform ow_push(s.shop_id, 'prices.confirm', total || ' price' || case when total = 1 then '' else 's' end || ' to confirm today',
      'Oldest first — ' || top.name || ' has ' || top.k,
      null, null, 'sourcing', jsonb_build_object('table', 'prices', 'date', d), 'confirm:' || d);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function ow_push_prices_to_confirm() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not switched on here, so the morning pushes are not scheduled. Switch it on (Database -> Extensions -> pg_cron) and run this file again. (%)', sqlerrm;
    return;
  end;
  begin
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname in ('ow-bills-due', 'ow-prices-to-confirm');
    perform cron.schedule('ow-bills-due', '0 4 * * *', 'select public.ow_push_bills_due()');
    perform cron.schedule('ow-prices-to-confirm', '0 5 * * 1-6', 'select public.ow_push_prices_to_confirm()');
  exception when others then
    raise notice 'The morning pushes could not be scheduled: %', sqlerrm;
  end;
end $$;
