-- 0184b · Manager redesign, P-12 (docs/audit/manager/handover.md §4 P-12, §2
-- M-13; docs/spec/04-screens-manager-data.md §3 and §5): asking the Manager
-- for a credit limit. NOT A MIGRATION YET: it adds a table, and Kevin
-- approves the table first (spec Q1). Once he does, it moves to
-- supabase/migrations/ under the next number reserved for it in
-- docs/decision-rights.md §5, with that row written in the same commit.
-- test/manager-pushes-db.test.js runs it (twice) after 0184 while it is here.
--
-- decision-rights `credit.set`: "Proposes: Sales, Accounts". Today neither
-- can ask: Accounts' "limit, terms" button opens nothing that asks for one,
-- and Sales' "No limit set · Ruth decides" has nothing to tap.
--
--   customer_asks          one open ask per customer: an amount, the days,
--                          why; asked_by, its answer and who gave it
--   ask_credit_limit       Sales (quote.make) or Accounts (finance.see)
--   withdraw_customer_ask  the asker takes it back
--   answer_credit_limit    the Manager (credit.set): yes writes the
--                          customer's limit and terms (0122's guard logs it),
--                          no keeps them on cash; logged either way
--   pushes                 credit.limit.ask -> credit.set
--                          "Credit asked · Ggaba Stores" / "Esther asks
--                          3,000,000 · 14 days — {why}";
--                          credit.limit.ask.decided -> the asker
--                          "Ruth set Ggaba's limit" / "Limit 3,000,000 · 14 days."
--                          or "Ruth kept Ggaba on cash"
-- No push action: a limit is typed by the Manager (handover D-32's "Limit 3M
-- · 14 d" waits until Kevin says a limit may be set from a notification).
-- No role or task changes. Safe to run twice. Needs 0184 (ow_name_of).
--
-- CHECK AFTERWARDS:
--   select to_regclass('public.customer_asks');   -- customer_asks
--   select tgname from pg_trigger where tgname = 'customer_asks_ow_push';   -- 1 row
--
-- ROLLBACK:
--   drop trigger if exists customer_asks_ow_push on customer_asks;
--   drop function if exists answer_credit_limit(uuid, boolean, numeric, int, text);
--   drop function if exists withdraw_customer_ask(uuid);
--   drop function if exists ask_credit_limit(uuid, text, numeric, int, text);
--   drop table if exists customer_asks;
-- ---------------------------------------------------------------------

create table if not exists customer_asks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  customer_id text not null,
  kind text not null default 'limit' check (kind in ('limit')),
  amount numeric not null check (amount > 0),
  days int check (days is null or days >= 0),
  why text,
  asked_by uuid not null default auth.uid(),
  asked_by_name text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  answer jsonb,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists customer_asks_shop_idx on customer_asks (shop_id, created_at desc);
create unique index if not exists customer_asks_one_open on customer_asks (shop_id, customer_id) where status = 'sent';
alter table customer_asks enable row level security;
-- The Manager reads every ask; the asker reads their own. Writes go through the functions.
drop policy if exists "credit asks read" on customer_asks;
create policy "credit asks read" on customer_asks for select
  using (is_shop_member(shop_id) and (has_task(shop_id, 'credit.set') or asked_by = auth.uid()));

create or replace function ask_credit_limit(p_shop uuid, p_customer text, p_amount numeric, p_days int, p_why text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c customers%rowtype;
  v_id uuid;
begin
  if auth.uid() is null or not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  if not (has_task(p_shop, 'quote.make') or has_task(p_shop, 'finance.see')) then
    raise exception 'Asking for credit is for Sales or Accounts (quote.make, finance.see).' using errcode = '42501';
  end if;
  select * into c from customers where shop_id = p_shop and id = p_customer;
  if not found then raise exception 'That customer is not in this shop.' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Say how much credit.' using errcode = '22023'; end if;
  if p_days is not null and p_days < 0 then raise exception 'Days are 0 or more.' using errcode = '22023'; end if;
  if exists (select 1 from customer_asks a where a.shop_id = p_shop and a.customer_id = p_customer and a.status = 'sent') then
    raise exception 'A credit ask for % waits already.', coalesce(c.name, p_customer) using errcode = '22023';
  end if;
  insert into customer_asks (shop_id, customer_id, amount, days, why, asked_by, asked_by_name)
       values (p_shop, p_customer, round(p_amount), p_days, left(nullif(btrim(coalesce(p_why, '')), ''), 300), auth.uid(), ow_member_name(p_shop, auth.uid()))
    returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'sent');
end $$;
revoke all on function ask_credit_limit(uuid, text, numeric, int, text) from public, anon;
grant execute on function ask_credit_limit(uuid, text, numeric, int, text) to authenticated;

create or replace function withdraw_customer_ask(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare a customer_asks%rowtype;
begin
  select * into a from customer_asks where id = p_id for update;
  if not found then raise exception 'That ask is gone.' using errcode = 'P0002'; end if;
  if a.asked_by is distinct from auth.uid() then raise exception 'Only the one who asked can take it back.' using errcode = '42501'; end if;
  if a.status <> 'sent' then raise exception 'That ask is % already.', a.status using errcode = '22023'; end if;
  update customer_asks set status = 'withdrawn', decided_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'id', p_id, 'status', 'withdrawn');
end $$;
revoke all on function withdraw_customer_ask(uuid) from public, anon;
grant execute on function withdraw_customer_ask(uuid) to authenticated;

create or replace function answer_credit_limit(p_id uuid, p_yes boolean, p_amount numeric default null, p_days int default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a customer_asks%rowtype;
  c customers%rowtype;
  v_amount numeric;
  v_days int;
  v_note text := left(nullif(btrim(coalesce(p_note, '')), ''), 300);
begin
  if p_yes is null then raise exception 'Say yes or no.' using errcode = '22023'; end if;
  select * into a from customer_asks where id = p_id for update;
  if not found then raise exception 'That ask is gone.' using errcode = 'P0002'; end if;
  if not has_task(a.shop_id, 'credit.set') then
    raise exception 'Credit limits are the Manager''s (credit.set).' using errcode = '42501';
  end if;
  if a.status <> 'sent' then raise exception 'That ask is % already.', a.status using errcode = '22023'; end if;
  select * into c from customers where shop_id = a.shop_id and id = a.customer_id for update;
  if not found then raise exception 'That customer is not in this shop.' using errcode = 'P0002'; end if;
  if p_yes then
    v_amount := round(coalesce(p_amount, a.amount));
    v_days := coalesce(p_days, a.days, c.terms_days);
    if v_amount <= 0 then raise exception 'Say how much credit.' using errcode = '22023'; end if;
    -- 0122's customers guard checks credit.set again and logs the change.
    update customers set credit_limit = v_amount, terms_days = v_days where shop_id = a.shop_id and id = a.customer_id;
  else
    perform manager_log_decision(a.shop_id, 'credit.set',
      'Kept ' || coalesce(nullif(c.name, ''), c.id) || ' on cash: declined ' || coalesce(nullif(a.asked_by_name, ''), 'an') || '''s ask for ' || ow_money(a.amount)
        || coalesce(' — ' || v_note, ''),
      a.amount, jsonb_build_object('table', 'customer_asks', 'id', a.id, 'customer', a.customer_id),
      jsonb_build_object('status', 'sent'), jsonb_build_object('status', 'declined', 'note', v_note));
  end if;
  update customer_asks set status = case when p_yes then 'accepted' else 'declined' end, decided_by = auth.uid(), decided_at = now(),
         answer = jsonb_build_object('amount', v_amount, 'days', v_days, 'note', v_note)
   where id = p_id;
  return jsonb_build_object('ok', true, 'id', p_id, 'status', case when p_yes then 'accepted' else 'declined' end, 'amount', v_amount, 'days', v_days);
end $$;
revoke all on function answer_credit_limit(uuid, boolean, numeric, int, text) from public, anon;
grant execute on function answer_credit_limit(uuid, boolean, numeric, int, text) to authenticated;

create or replace function customer_asks_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cname text;
  ref jsonb := jsonb_build_object('table', 'customer_asks', 'id', new.id, 'customer', new.customer_id);
  who text;
begin
  select c.name into cname from customers c where c.shop_id = new.shop_id and c.id = new.customer_id;
  cname := coalesce(nullif(btrim(coalesce(cname, '')), ''), new.customer_id);
  if tg_op = 'INSERT' and new.status = 'sent' then
    perform ow_push(new.shop_id, 'credit.limit.ask', 'Credit asked · ' || cname,
      coalesce(nullif(split_part(btrim(coalesce(new.asked_by_name, '')), ' ', 1), ''), ow_name_of(new.shop_id, new.asked_by)) || ' asks ' || ow_money(new.amount)
        || coalesce(' · ' || new.days || ' days', '') || coalesce(' — ' || new.why, ''),
      null, 'credit.set', null, ref, 'creditask:' || new.id);
  elsif tg_op = 'UPDATE' and old.status = 'sent' and new.status in ('accepted', 'declined') then
    who := ow_name_of(new.shop_id, new.decided_by);
    perform ow_push(new.shop_id, 'credit.limit.ask.decided',
      case when new.status = 'accepted' then who || ' set ' || ow_short_name(cname) || '''s limit' else who || ' kept ' || ow_short_name(cname) || ' on cash' end,
      case when new.status = 'accepted' then 'Limit ' || ow_money((new.answer ->> 'amount')::numeric) || coalesce(' · ' || (new.answer ->> 'days') || ' days', '') || '.'
           else coalesce(new.answer ->> 'note', 'Cash only.') end,
      new.asked_by, null, null, ref, 'creditaskdone:' || new.id);
  end if;
  return null;
exception when others then
  raise notice 'push (credit ask): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists customer_asks_ow_push on customer_asks;
create trigger customer_asks_ow_push after insert or update on customer_asks
  for each row execute function customer_asks_ow_push();
