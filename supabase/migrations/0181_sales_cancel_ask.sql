-- 0181 Sales asks the Manager to cancel an order (docs/spec/01-order-journey.md
-- §5 Q7; docs/spec/05-data.md §9 Q7; the canvas's OR18 "Ask Ruth to cancel",
-- OR19 "Entered twice · cancel the copy"). 0177 gave the Manager the one
-- Cancel (order.cancel, cancel_order) and left "Sales asking for a cancel"
-- not built: the decision-rights row says Sales proposes, and today they ring
-- the Manager. Now the ask is a row, and every step of it pushes the one who
-- waits:
--
--   cancel_asks          one row per ask: the order, why (the canvas's four:
--                        changed their mind, entered twice, wrong items or
--                        how many, something else), a note, what the order
--                        came to and its stage when asked, who asked; then
--                        the answer (accepted, declined, withdrawn), who
--                        and when. One open ask per order. Members read it
--                        (not the yard: 0159, 0179); nobody writes it but
--                        the functions below.
--
--   ask_cancel(shop, order, why, note)
--       cancel.ask (new; Sales). Only on your own order (payload.takenBy),
--       before it is invoiced or delivered, and not called off already.
--       Asked again while the first waits: the open ask stands ('again').
--       Pushes the Manager (order.cancel.ask, to order.cancel).
--
--   withdraw_cancel_ask(id)
--       The asker takes it back while it waits. Again: nothing more.
--
--   answer_cancel_ask(id, yes, note, choice, account)
--       order.cancel (the Manager). Yes: the order is cancelled through
--       0177's cancel_order -- every refusal of its own (invoiced, goods
--       that came in, a live trip, money with no choice), the yard and the
--       salesperson pushed (order.cancelled), the owner's log from the void
--       guard -- and the ask closes with it. No: the ask is declined with
--       the Manager's words, logged (decision_log, order.cancel), and the
--       asker pushed (order.cancel.ask.decided).
--
--   And the ask follows the order: an order called off another way (the
--   console's Cancel, the Manager app's void of a copy) closes its open ask
--   as accepted, and the asker is told when it was not cancel_order that
--   did it (that one tells them itself); an order invoiced first closes it
--   as declined ("ask for a void"), and the asker is told.
--
-- Applied by hand, after 0177 (cancel_order) and 0180. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select role, task from role_tasks where task = 'cancel.ask';
--   select to_regclass('public.cancel_asks');
--   select tgname from pg_trigger where tgname in ('cancel_asks_ow_push', 'saved_quotes_ow_cancel_asks');
--   select status, count(*) from cancel_asks group by 1;
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_cancel_asks on saved_quotes;
--   drop function if exists saved_quotes_ow_cancel_asks();
--   drop function if exists answer_cancel_ask(uuid, boolean, text, text, text);
--   drop function if exists withdraw_cancel_ask(uuid);
--   drop function if exists ask_cancel(uuid, bigint, text, text);
--   drop table if exists cancel_asks;   -- drops its push trigger with it
--   drop function if exists cancel_asks_ow_push();
--   delete from role_tasks where task = 'cancel.ask';
-- ---------------------------------------------------------------------

insert into role_tasks (role, task) values ('sales', 'cancel.ask') on conflict do nothing;

-- ---------------------------------------------------------------------
-- 1. The asks.
create table if not exists cancel_asks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  quote_id bigint not null,
  customer_id text,
  why text not null,
  note text,
  amount numeric not null default 0,
  stage text,
  asked_by uuid not null default auth.uid(),
  asked_by_name text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  answer text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cancel_asks_shop_idx on cancel_asks (shop_id, created_at desc);
create unique index if not exists cancel_asks_one_open on cancel_asks (shop_id, quote_id) where status = 'sent';
alter table cancel_asks enable row level security;

-- Members read them, but not the yard (a Store or yard-worker login reads no
-- books: 0159, 0179). No insert, update or delete policy: the functions write.
drop policy if exists "members read cancel asks" on cancel_asks;
create policy "members read cancel asks" on cancel_asks
  for select using (is_shop_member(shop_id)
    and not exists (select 1 from shop_members m where m.shop_id = cancel_asks.shop_id and m.user_id = auth.uid() and m.role in ('store', 'staff')));

-- ---------------------------------------------------------------------
-- 2. Asking.
create or replace function ask_cancel(p_shop_id uuid, p_order bigint, p_why text, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  why text := left(nullif(btrim(coalesce(p_why, '')), ''), 200);
  q saved_quotes%rowtype;
  a cancel_asks%rowtype;
  lbl text;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Sign in to this shop first.' using errcode = '42501';
  end if;
  if not has_task(p_shop_id, 'cancel.ask') then
    raise exception 'Asking for a cancel is Sales'' (cancel.ask).' using errcode = '42501';
  end if;
  if why is null then raise exception 'Say why it should be cancelled.' using errcode = '22023'; end if;
  select * into q from saved_quotes where shop_id = p_shop_id and id = p_order for update;
  if not found then raise exception 'This order is no longer in the books.' using errcode = 'P0002'; end if;
  lbl := '#' || lpad(q.id::text, 4, '0');
  if ow_uuid(q.payload ->> 'takenBy') is distinct from uid then
    raise exception 'Only the one who took % asks to cancel it.', lbl using errcode = '42501';
  end if;
  if coalesce(q.voided, false) or q.status = 'cancelled' then raise exception '% is called off already.', lbl using errcode = '22023'; end if;
  if coalesce(q.invoiced, false) then raise exception '% is invoiced: ask for a void instead.', lbl using errcode = '22023'; end if;
  if q.status = 'completed' then raise exception '% was delivered: ask for a void once it is invoiced.', lbl using errcode = '22023'; end if;

  -- Asked already: the ask that waits stands.
  select * into a from cancel_asks where shop_id = p_shop_id and quote_id = q.id and status = 'sent';
  if found then
    return jsonb_build_object('ok', true, 'id', a.id, 'orderId', q.id, 'status', a.status, 'amount', a.amount, 'at', a.created_at, 'again', true);
  end if;
  insert into cancel_asks (shop_id, quote_id, customer_id, why, note, amount, stage, asked_by, asked_by_name)
       values (p_shop_id, q.id, nullif(q.payload ->> 'customerId', ''), why, left(nullif(btrim(coalesce(p_note, '')), ''), 500),
               greatest(0, round(ow_order_total(p_shop_id, q.payload, true))), q.status, uid,
               coalesce((select nullif(btrim(m.display_name), '') from shop_members m where m.shop_id = p_shop_id and m.user_id = uid limit 1),
                        (select nullif(btrim(st.name), '') from staff st where st.shop_id = p_shop_id and st.user_id = uid and btrim(st.name) !~ '@' limit 1)))
  returning * into a;
  return jsonb_build_object('ok', true, 'id', a.id, 'orderId', q.id, 'status', a.status, 'amount', a.amount, 'at', a.created_at, 'again', false);
end $$;
revoke all on function ask_cancel(uuid, bigint, text, text) from public, anon;
grant execute on function ask_cancel(uuid, bigint, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Taking it back.
create or replace function withdraw_cancel_ask(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a cancel_asks%rowtype;
begin
  select * into a from cancel_asks where id = p_id for update;
  if not found or a.asked_by is distinct from auth.uid() then
    raise exception 'That ask is not yours.' using errcode = '42501';
  end if;
  if a.status = 'withdrawn' then
    return jsonb_build_object('ok', true, 'id', a.id, 'status', a.status, 'again', true);
  end if;
  if a.status <> 'sent' then
    raise exception 'That ask is % already.', a.status using errcode = '22023';
  end if;
  update cancel_asks set status = 'withdrawn', decided_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'id', a.id, 'status', 'withdrawn', 'again', false);
end $$;
revoke all on function withdraw_cancel_ask(uuid) from public, anon;
grant execute on function withdraw_cancel_ask(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. The Manager's answer: yes through cancel_order, or no with words.
create or replace function answer_cancel_ask(p_id uuid, p_yes boolean, p_note text default null, p_choice text default null, p_account text default 'cash')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a cancel_asks%rowtype;
  v_note text := left(nullif(btrim(coalesce(p_note, '')), ''), 300);
  res jsonb;
  client text;
  lbl text;
begin
  if p_yes is null then raise exception 'Say yes or no.' using errcode = '22023'; end if;
  select * into a from cancel_asks where id = p_id for update;
  if not found then raise exception 'That ask is gone.' using errcode = 'P0002'; end if;
  if not has_task(a.shop_id, 'order.cancel') then
    raise exception 'Deciding a cancel is the Manager''s (order.cancel).' using errcode = '42501';
  end if;
  if a.status <> 'sent' then raise exception 'That ask is % already.', a.status using errcode = '22023'; end if;
  lbl := '#' || lpad(a.quote_id::text, 4, '0');

  if p_yes then
    -- 0177's one Cancel, with every refusal of its own; the order's void closes the ask (step 5).
    res := cancel_order(a.shop_id, a.quote_id, a.why || coalesce(' · ' || v_note, ''), p_choice, p_account);
    update cancel_asks set status = 'accepted', answer = v_note, decided_by = auth.uid(), decided_at = coalesce(decided_at, now()) where id = p_id;
    return jsonb_build_object('ok', true, 'id', a.id, 'orderId', a.quote_id, 'status', 'accepted', 'order', res);
  end if;

  update cancel_asks set status = 'declined', answer = v_note, decided_by = auth.uid(), decided_at = now() where id = p_id;
  select coalesce(nullif(btrim(coalesce(q.client_name, '')), ''), 'an order') into client
    from saved_quotes q where q.shop_id = a.shop_id and q.id = a.quote_id;
  perform manager_log_decision(a.shop_id, 'order.cancel',
    'Kept order ' || lbl || coalesce(' for ' || client, '') || ': declined ' || coalesce(nullif(a.asked_by_name, ''), 'a salesperson') || '''s ask to cancel it'
      || coalesce(' — ' || v_note, ''),
    a.amount, jsonb_build_object('table', 'cancel_asks', 'id', a.id, 'quote_id', a.quote_id),
    jsonb_build_object('status', 'sent', 'why', a.why), jsonb_build_object('status', 'declined', 'answer', v_note));
  return jsonb_build_object('ok', true, 'id', a.id, 'orderId', a.quote_id, 'status', 'declined');
end $$;
revoke all on function answer_cancel_ask(uuid, boolean, text, text, text) from public, anon;
grant execute on function answer_cancel_ask(uuid, boolean, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. The ask follows the order: called off closes it as accepted; invoiced first, as declined.
create or replace function saved_quotes_ow_cancel_asks() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if coalesce(new.voided, false) and not coalesce(old.voided, false) then
      update cancel_asks set status = 'accepted', decided_by = auth.uid(), decided_at = now()
       where shop_id = new.shop_id and quote_id = new.id and status = 'sent';
    elsif coalesce(new.invoiced, false) and not coalesce(old.invoiced, false) then
      update cancel_asks set status = 'declined', decided_by = auth.uid(), decided_at = now(),
             answer = 'Invoiced before it was cancelled: ask for a void.'
       where shop_id = new.shop_id and quote_id = new.id and status = 'sent';
    end if;
  exception when others then
    raise notice 'cancel ask (order %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists saved_quotes_ow_cancel_asks on saved_quotes;
create trigger saved_quotes_ow_cancel_asks after update of voided, invoiced on saved_quotes
  for each row when (new.voided is distinct from old.voided or new.invoiced is distinct from old.invoiced)
  execute function saved_quotes_ow_cancel_asks();

-- ---------------------------------------------------------------------
-- 6. Pushes: the ask to the Manager; a no (or a void by another way) to the asker.
create or replace function cancel_asks_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  client text;
  q_status text;
  q_invoiced boolean;
  lbl text := '#' || lpad(new.quote_id::text, 4, '0');
  who text;
  ref jsonb := jsonb_build_object('table', 'cancel_asks', 'id', new.id, 'quote', new.quote_id);
begin
  begin
    select coalesce(nullif(btrim(coalesce(q.client_name, '')), ''), nullif(btrim(coalesce(q.payload -> 'client' ->> 'name', '')), '')), q.status, coalesce(q.invoiced, false)
      into client, q_status, q_invoiced from saved_quotes q where q.shop_id = new.shop_id and q.id = new.quote_id;
    if tg_op = 'INSERT' and new.status = 'sent' then
      perform ow_push(new.shop_id, 'order.cancel.ask', 'Cancel asked',
        coalesce(nullif(split_part(btrim(coalesce(new.asked_by_name, '')), ' ', 1), ''), 'Sales') || ' asks to cancel ' || lbl
          || coalesce(' · ' || client, '') || ' · ' || ow_money(new.amount) || ' — ' || new.why,
        null, 'order.cancel', null, ref, 'cancelask:' || new.id);
    elsif tg_op = 'UPDATE' and old.status = 'sent' and (new.status = 'declined' or (new.status = 'accepted' and q_status is distinct from 'cancelled')) then
      -- The person's own name (0164's display name, else their staff name), never a role's stand-in.
      who := coalesce((select nullif(split_part(btrim(m.display_name), ' ', 1), '') from shop_members m where m.shop_id = new.shop_id and m.user_id = new.decided_by limit 1),
                      ow_first_name(new.shop_id, new.decided_by), 'The Manager');
      perform ow_push(new.shop_id, 'order.cancel.ask.decided',
        case when new.status = 'declined' then 'Not cancelled' else 'Called off' end,
        lbl || coalesce(' · ' || client, '') || ' — '
          || case when new.status = 'accepted' then who || ' voided it.'
                  when q_invoiced then 'invoiced before it was cancelled: ask for a void.'
                  else who || ' kept it' || coalesce(': ' || new.answer, '.') end,
        new.asked_by, null, null, ref, 'cancelaskdone:' || new.id);
    end if;
  exception when others then
    raise notice 'push (cancel ask): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists cancel_asks_ow_push on cancel_asks;
create trigger cancel_asks_ow_push after insert or update on cancel_asks
  for each row execute function cancel_asks_ow_push();
