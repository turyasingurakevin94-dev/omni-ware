-- The Owner app (owner.html): what only the owner decides, and the log of
-- everything decided for them. docs/decision-rights.md section 4 is the
-- authority on what belongs here; this file builds the parts that need the
-- database:
--
--   1. Switching a role's tasks off and on, per shop (shop_task_off).
--      role_tasks (0113) is the list of what each role CAN be given; it is
--      global and only changes in a migration. The owner switches a task off
--      for their own shop here, and has_task() honours it, so a switched-off
--      task is refused by every guard and function that asks has_task --
--      not only hidden in an app. Switching it back on deletes the row.
--   2. The owner's own settings, one key at a time (owner_set_preset): the
--      policy numbers (prices Sourcing confirms a day, the digest's hour),
--      the receipt details, and the word lists. One key changes and the rest
--      of the presets row is left as it was -- the console's whole-row save
--      is the hazard this avoids.
--   3. Stepping in (owner_step_in): putting a logged decision back, or
--      setting another value, through the same function the role used, so
--      the guards and the log behave exactly as they do for the role. The
--      new log line carries steps_in = the line it answers.
--      A console save that leaves out digestHour or the Manager's
--      creditHold no longer wipes them (app_settings_keep_role_keys).
--   4. The digest at the owner's hour: ow_owner_digest (0120) is replaced so
--      it runs every hour and pushes to each shop at its own digestHour
--      (default 19:00 Kampala), and says whose decisions they were.
--
-- Hiring, pay rates and the shop's monthly goal need nothing new here: the
-- owner already writes staff (0083) and manager_notes (0081), and the app
-- logs each one to decision_log (0123), which the owner already reads.
--
-- Migrations are applied by hand. Safe to run twice.
--
-- RUN AFTER 0120. This file replaces two of 0120's functions
-- (ow_push_recipients, ow_owner_digest) and the digest's schedule. If 0120
-- is ever run again, run this file again after it. The order for a fresh
-- database: 0119, 0120, 0127, 0128, 0129.
--
-- CHECK AFTERWARDS:
--   select * from shop_task_off;                          -- empty at first
--   select has_task('YOUR-SHOP-ID', 'markup.set');        -- as a manager: true
--   select jobname, schedule from cron.job where jobname = 'ow-owner-digest';  -- 0 * * * *
--
-- ROLLBACK:
--   drop trigger app_settings_keep_role_keys on app_settings;
--   drop function app_settings_keep_role_keys();
--   drop function owner_step_in(uuid, jsonb);
--   drop function owner_set_preset(uuid, text, jsonb);
--   drop function owner_set_task(uuid, text, text, boolean);
--   re-run has_task from 0113, ow_push_recipients from 0120 and
--   ow_owner_digest (with its 16:00 schedule) from 0120;
--   drop table shop_task_off;  alter table decision_log drop column steps_in;

-- ---------------------------------------------------------------------
-- 1. A role's task, switched off in one shop.
create table if not exists shop_task_off (
  shop_id uuid not null references shops(id) on delete cascade,
  role text not null,
  task text not null,
  off_at timestamptz not null default now(),
  off_by uuid default auth.uid(),
  primary key (shop_id, role, task)
);
alter table shop_task_off enable row level security;
drop policy if exists "members read the switches" on shop_task_off;
create policy "members read the switches" on shop_task_off
  for select using (is_shop_member(shop_id));
-- Written only through owner_set_task below.

-- has_task (0113), now asking whether the shop switched the task off.
-- The owner and admins still hold every task.
create or replace function has_task(p_shop_id uuid, p_task text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from shop_members m
    where m.shop_id = p_shop_id and m.user_id = auth.uid()
      and (m.role in ('owner', 'admin')
           or (exists (select 1 from role_tasks r where r.role = m.role and r.task = p_task)
               and not exists (select 1 from shop_task_off o
                                where o.shop_id = p_shop_id and o.role = m.role and o.task = p_task)))
  );
$$;

-- A push addressed by task (0120) no longer reaches a role whose task is off.
create or replace function ow_push_recipients(p_id bigint)
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct m.user_id
    from push_outbox o
    join shop_members m on m.shop_id = o.shop_id
   where o.id = p_id
     and m.user_id is distinct from o.from_user
     and ((o.to_user is not null and m.user_id = o.to_user)
       or (o.to_task is not null
           and exists (select 1 from role_tasks rt where rt.role = m.role and rt.task = o.to_task)
           and not exists (select 1 from shop_task_off x where x.shop_id = o.shop_id and x.role = m.role and x.task = o.to_task))
       or (o.to_role is not null and m.role = o.to_role))
$$;
revoke all on function ow_push_recipients(bigint) from public, anon, authenticated;
grant execute on function ow_push_recipients(bigint) to service_role;

-- decision_log (0119 / 0123): the line a step-in answers.
alter table decision_log add column if not exists steps_in uuid;
create index if not exists decision_log_steps_in_idx on decision_log (shop_id, steps_in) where steps_in is not null;

-- The owner's own log line. Owner and admin only (the governance in
-- section 4); never blocks the change it records.
create or replace function owner_log(p_shop_id uuid, p_task text, p_what text, p_ref jsonb, p_before jsonb, p_after jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.decision_log') is null then return; end if;
  insert into decision_log (shop_id, by, by_name, role, task, what, ref, before, after)
  values (p_shop_id, auth.uid(),
          coalesce((select s.name from staff s where s.shop_id = p_shop_id and s.user_id = auth.uid() limit 1), 'The owner'),
          (select m.role from shop_members m where m.shop_id = p_shop_id and m.user_id = auth.uid() limit 1),
          p_task, p_what, p_ref, p_before, p_after);
exception when others then
  raise notice 'decision_log: % (%)', sqlerrm, sqlstate;
end $$;
revoke all on function owner_log(uuid, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- Switch one task off (p_on false) or back on (p_on true) for a role.
create or replace function owner_set_task(p_shop_id uuid, p_role text, p_task text, p_on boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_was boolean;
begin
  if not is_shop_admin(p_shop_id) then
    raise exception 'Only the owner switches a role''s tasks.' using errcode = '42501';
  end if;
  if not exists (select 1 from role_tasks where role = p_role and task = p_task) then
    raise exception 'The % role has no "%" to switch.', p_role, p_task using errcode = '22023';
  end if;
  v_was := not exists (select 1 from shop_task_off where shop_id = p_shop_id and role = p_role and task = p_task);
  if p_on then
    delete from shop_task_off where shop_id = p_shop_id and role = p_role and task = p_task;
  else
    insert into shop_task_off (shop_id, role, task) values (p_shop_id, p_role, p_task)
    on conflict (shop_id, role, task) do nothing;
  end if;
  if v_was is distinct from p_on then
    perform owner_log(p_shop_id, 'role.tasks',
      initcap(p_role) || ': ' || p_task || case when p_on then ' switched on' else ' switched off' end,
      jsonb_build_object('table', 'shop_task_off', 'role', p_role, 'task', p_task),
      jsonb_build_object('on', v_was), jsonb_build_object('on', p_on));
  end if;
  return jsonb_build_object('ok', true, 'role', p_role, 'task', p_task, 'on', p_on);
end $$;
revoke all on function owner_set_task(uuid, text, text, boolean) from public, anon;
grant execute on function owner_set_task(uuid, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 2. The owner's settings, one key at a time.
--   priceReview        {perDay: 1-200}            merged into what is there
--   digestHour         0-23 (Kampala)
--   shopLegalName, shopAddress, shopPhone, shopTin, receiptFooter   text
--   autoPrintReceipt   true / false
--   categories         [{name, subcategories:[text]}]
--   units, locations, incomeCategories, expenseCategories           [text]
create or replace function owner_set_preset(p_shop_id uuid, p_key text, p_value jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_val jsonb := p_value;
  v_new jsonb;
  v_task text;
  e jsonb;
begin
  if not is_shop_admin(p_shop_id) then
    raise exception 'Only the owner changes this.' using errcode = '42501';
  end if;
  select presets into v_old from app_settings where shop_id = p_shop_id for update;

  if p_key = 'priceReview' then
    v_task := 'policy.set';
    if jsonb_typeof(p_value -> 'perDay') <> 'number' or (p_value ->> 'perDay')::numeric < 1 or (p_value ->> 'perDay')::numeric > 200
       or (p_value ->> 'perDay')::numeric <> round((p_value ->> 'perDay')::numeric) then
      raise exception 'Prices a day is a whole number, 1 to 200.' using errcode = '22023';
    end if;
    -- targetPerPeriod is the console's month figure for the same thing
    -- (index.html priceReviewTarget); Sourcing reads perDay first and
    -- falls back to targetPerPeriod / 26, so the two are kept in step.
    v_val := coalesce(case when jsonb_typeof(v_old -> 'priceReview') = 'object' then v_old -> 'priceReview' end, '{}'::jsonb)
             || jsonb_build_object('perDay', (p_value ->> 'perDay')::int, 'targetPerPeriod', (p_value ->> 'perDay')::int * 26);
  elsif p_key = 'digestHour' then
    v_task := 'policy.set';
    if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 0 and 23
       or (p_value #>> '{}')::numeric <> round((p_value #>> '{}')::numeric) then
      raise exception 'The digest hour is 0 to 23.' using errcode = '22023';
    end if;
  elsif p_key in ('shopLegalName', 'shopAddress', 'shopPhone', 'shopTin', 'receiptFooter') then
    v_task := 'setup.set';
    if jsonb_typeof(p_value) <> 'string' or length(p_value #>> '{}') > 300 then
      raise exception 'That is a line of text, 300 letters at most.' using errcode = '22023';
    end if;
  elsif p_key = 'autoPrintReceipt' then
    v_task := 'setup.set';
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'Printing by itself is on or off.' using errcode = '22023';
    end if;
  elsif p_key = 'categories' then
    v_task := 'setup.set';
    if jsonb_typeof(p_value) <> 'array' then
      raise exception 'The categories are a list.' using errcode = '22023';
    end if;
    for e in select * from jsonb_array_elements(p_value) loop
      if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'name') <> 'string' or length(trim(e ->> 'name')) = 0 then
        raise exception 'Every category has a name.' using errcode = '22023';
      end if;
    end loop;
  elsif p_key in ('units', 'locations', 'incomeCategories', 'expenseCategories') then
    v_task := 'setup.set';
    if jsonb_typeof(p_value) <> 'array' then
      raise exception 'That list is a list of words.' using errcode = '22023';
    end if;
    for e in select * from jsonb_array_elements(p_value) loop
      if jsonb_typeof(e) <> 'string' or length(trim(e #>> '{}')) = 0 then
        raise exception 'Every entry in the list is a word.' using errcode = '22023';
      end if;
    end loop;
  else
    raise exception 'That setting is not one the owner sets here.' using errcode = '22023';
  end if;

  insert into app_settings (shop_id, presets) values (p_shop_id, jsonb_build_object(p_key, v_val))
  on conflict (shop_id) do update
     set presets = coalesce(app_settings.presets, '{}'::jsonb) || jsonb_build_object(p_key, v_val),
         updated_at = now()
  returning presets into v_new;

  if (coalesce(v_old, '{}'::jsonb) -> p_key) is distinct from v_val then
    perform owner_log(p_shop_id, v_task,
      case p_key when 'priceReview' then 'Prices Sourcing confirms a day set to ' || (v_val ->> 'perDay')
                 when 'digestHour' then 'The daily digest moved to ' || lpad(p_value #>> '{}', 2, '0') || ':00'
                 when 'categories' then 'The categories changed'
                 when 'units' then 'The units changed'
                 when 'locations' then 'The places changed'
                 when 'incomeCategories' then 'The money-in words changed'
                 when 'expenseCategories' then 'The money-out words changed'
                 when 'autoPrintReceipt' then 'Printing a receipt by itself switched ' || case when p_value = 'true'::jsonb then 'on' else 'off' end
                 else 'The receipt''s ' || case p_key when 'shopLegalName' then 'shop name' when 'shopAddress' then 'address'
                   when 'shopPhone' then 'phone' when 'shopTin' then 'TIN' else 'footer' end || ' changed' end,
      jsonb_build_object('table', 'app_settings', 'id', p_shop_id, 'key', p_key),
      jsonb_build_object(p_key, coalesce(v_old, '{}'::jsonb) -> p_key), jsonb_build_object(p_key, v_val));
  end if;
  return jsonb_build_object('ok', true, 'presets', v_new);
end $$;
revoke all on function owner_set_preset(uuid, text, jsonb) from public, anon;
grant execute on function owner_set_preset(uuid, text, jsonb) to authenticated;

-- The console saves the whole presets row from its own copy (index.html
-- addSettingsDiffOp), and that copy has no digestHour (this file) and no
-- creditHold (0122, the Manager's) -- so every console save dropped them.
-- A save that leaves one of those keys out now keeps what was there, and
-- a priceReview without perDay keeps the perDay it had. A role still
-- changes them through set_shop_preset / owner_set_preset as before.
create or replace function app_settings_keep_role_keys()
returns trigger
language plpgsql as $$
declare
  k text;
begin
  if old.presets is null or new.presets is null or jsonb_typeof(new.presets) <> 'object' then return new; end if;
  foreach k in array array['digestHour', 'creditHold'] loop
    if old.presets ? k and not new.presets ? k then
      new.presets := new.presets || jsonb_build_object(k, old.presets -> k);
    end if;
  end loop;
  if jsonb_typeof(old.presets -> 'priceReview') = 'object' and old.presets -> 'priceReview' ? 'perDay'
     and jsonb_typeof(new.presets -> 'priceReview') = 'object' and not (new.presets -> 'priceReview' ? 'perDay') then
    new.presets := jsonb_set(new.presets, '{priceReview,perDay}', old.presets -> 'priceReview' -> 'perDay');
  end if;
  return new;
end $$;
drop trigger if exists app_settings_keep_role_keys on app_settings;
create trigger app_settings_keep_role_keys before update on app_settings
  for each row execute function app_settings_keep_role_keys();

-- ---------------------------------------------------------------------
-- 3. Stepping in on a logged decision. p_value null puts back what was
-- there before; otherwise p_value is the value to set instead (the same
-- shape the role's function takes). Built for the decisions whose before
-- can be written again by the role's own function:
--   a product's markups          set_product_markup (0122)
--   defaultMarkup, creditHold,
--   orderStageLimits             set_shop_preset (0122)
-- Anything else is refused by name, so the app can say so.
create or replace function owner_step_in(p_log_id uuid, p_value jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l decision_log%rowtype;
  v_key text;
  v_val jsonb;
  v_res jsonb;
begin
  select * into l from decision_log where id = p_log_id;
  if not found then raise exception 'That decision is not in the log.' using errcode = '22023'; end if;
  if not is_shop_admin(l.shop_id) then
    raise exception 'Only the owner steps in.' using errcode = '42501';
  end if;

  if l.task = 'markup.set' and l.ref ->> 'table' = 'products' then
    v_val := coalesce(p_value, l.before);
    if v_val is null or v_val = '{}'::jsonb then
      raise exception 'The log has no markup from before to put back.' using errcode = '22023';
    end if;
    v_res := set_product_markup(l.shop_id, l.ref ->> 'id', v_val);
  elsif l.ref ->> 'table' = 'app_settings' and l.ref ->> 'key' in ('defaultMarkup', 'creditHold', 'orderStageLimits') then
    v_key := l.ref ->> 'key';
    v_val := coalesce(p_value, l.before -> v_key);
    if v_val is null or jsonb_typeof(v_val) <> 'object' then
      raise exception 'The log has no setting from before to put back.' using errcode = '22023';
    end if;
    v_res := set_shop_preset(l.shop_id, v_key, v_val);
  else
    raise exception 'Stepping in on "%" is not built yet. Call the person who decided it.', l.task using errcode = '0A000';
  end if;

  -- The line the role's function just wrote (same transaction, same now()).
  update decision_log set steps_in = p_log_id
   where shop_id = l.shop_id and by = auth.uid() and at = now() and id <> p_log_id;
  return jsonb_build_object('ok', true, 'result', v_res);
end $$;
revoke all on function owner_step_in(uuid, jsonb) from public, anon;
grant execute on function owner_step_in(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. The digest, at each shop's hour (presets.digestHour, Kampala; 19 when
-- unset), once a day, saying whose decisions they were.
create or replace function ow_owner_digest()
returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  d date := ow_today();
  h int := extract(hour from (now() at time zone ow_shop_tz()))::int;
begin
  for r in
    select l.shop_id, count(*) as decisions,
           (select string_agg(x.who || ' ' || x.k, ', ' order by x.k desc, x.who)
              from (select coalesce(nullif(split_part(coalesce(l2.by_name, ''), ' ', 1), ''),
                                    case l2.role when 'auto' then 'The 24-hour run' else initcap(coalesce(l2.role, 'someone')) end) as who,
                           count(*) as k
                      from decision_log l2
                     where l2.shop_id = l.shop_id and (l2.at at time zone ow_shop_tz())::date = d
                       and coalesce(l2.role, '') not in ('owner', 'admin')
                     group by 1 order by count(*) desc limit 4) x) as who
      from decision_log l
      left join app_settings s on s.shop_id = l.shop_id
     where (l.at at time zone ow_shop_tz())::date = d
       and coalesce(l.role, '') not in ('owner', 'admin')
       and h = coalesce(case when jsonb_typeof(s.presets -> 'digestHour') = 'number' then (s.presets ->> 'digestHour')::int end, 19)
     group by l.shop_id
  loop
    perform ow_push(r.shop_id, 'owner.digest',
      'Today: ' || r.decisions || ' decision' || case when r.decisions = 1 then '' else 's' end || ', none waiting for you',
      coalesce(r.who, '') || '. The log has each one.', null, null, 'owner',
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
    perform cron.schedule('ow-owner-digest', '0 * * * *', 'select public.ow_owner_digest()');
  exception when others then
    raise notice 'The owner''s digest could not be scheduled: %', sqlerrm;
  end;
end $$;
