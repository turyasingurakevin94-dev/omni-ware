-- Sales, second migration (docs/decision-rights.md section 5: the next
-- number after 0129). Two things the Sales app now does:
--
--   1. A COUNTER SALE, pay and go (counter.sell, granted by 0119). The
--      salesperson invoices it on the spot through invoice_order(), so it
--      passes Delivered for an instant on its way. 0120 pushes the Manager
--      "Delivered — ready to invoice" on every order that reaches Delivered
--      uninvoiced; for a counter sale that push would always be wrong, so
--      the outbox drops it (and only it). A counter sale that waits for the
--      Manager's price still pushes "A counter sale waits for your price".
--
--   2. ASKING ACCOUNTS TO CORRECT A PAYMENT (payment.edit: Accounts does it;
--      Sales and the Manager propose it). The ask is a row in payment_asks:
--      which payment (the cash_txns line), what is wrong (the method, the
--      amount, the bill, the day), what it should be, and a word. Nothing in
--      the books changes until Accounts corrects the payment in its own
--      screen; deciding the ask closes it ('done' or 'declined'). Accounts is
--      pushed when one is asked, and the asker when it is decided.
--      A separate table from invoice_asks (0123): those are the Manager's
--      void and credit-note asks, read by the Manager's app, and a payment
--      ask is neither.
--
-- Applied by hand like every migration here, after 0119 and 0120 (the
-- pushes need their outbox; without it they are skipped and named). Safe
-- to run twice.
--
-- CHECK AFTERWARDS:
--   select to_regclass('public.payment_asks');                 -- payment_asks
--   select tgname from pg_trigger where tgname in ('payment_asks_ow_push', 'push_outbox_counter_quiet');
--
-- ROLLBACK:
--   drop trigger if exists push_outbox_counter_quiet on push_outbox;
--   drop table if exists payment_asks;   (the asks only; no payment is touched)

-- ---------------------------------------------------------------------
-- 1. A counter sale tells nobody it is "ready to invoice": it is invoiced.
create or replace function ow_push_counter_quiet() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'order.delivered' and coalesce(new.ref ->> 'table', '') = 'saved_quotes' and exists (
       select 1 from saved_quotes q
        where q.shop_id = new.shop_id and q.id::text = new.ref ->> 'id'
          and (coalesce(q.payload ->> 'counter', '') = 'true' or coalesce(q.payload ->> 'counterSale', '') = 'true')) then
    return null;
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.push_outbox') is null then
    raise notice 'skipped push_outbox_counter_quiet: run 0120 first, then this again';
    return;
  end if;
  drop trigger if exists push_outbox_counter_quiet on push_outbox;
  create trigger push_outbox_counter_quiet before insert on push_outbox
    for each row execute function ow_push_counter_quiet();
end $$;

-- ---------------------------------------------------------------------
-- 2. Asking Accounts to correct a payment.
create table if not exists payment_asks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  cash_txn_id bigint not null,
  customer_id text,
  quote_id bigint,
  amount numeric not null default 0 check (amount >= 0),
  what text not null check (what in ('method', 'amount', 'bill', 'day')),
  -- What it should be: {account} | {amount} | {quoteId} (null: on account) | {date}
  want jsonb not null default '{}'::jsonb,
  note text,
  asked_by uuid not null default auth.uid(),
  asked_by_name text,
  asked_role text,
  status text not null default 'sent' check (status in ('sent', 'done', 'declined', 'withdrawn')),
  decided_by uuid,
  decided_by_name text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_asks_shop_idx on payment_asks(shop_id, status, created_at desc);
alter table payment_asks enable row level security;

-- Who may ask: the proposers in the table (Sales, the Manager), and the
-- owner. Accounts corrects a payment itself; it does not ask.
create or replace function may_ask_payment(p_shop_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from shop_members m
    where m.shop_id = p_shop_id and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'manager', 'sales')
  );
$$;

drop policy if exists "members read payment asks" on payment_asks;
create policy "members read payment asks" on payment_asks
  for select using (is_shop_member(shop_id));
drop policy if exists "proposers add payment asks" on payment_asks;
create policy "proposers add payment asks" on payment_asks
  for insert with check (may_ask_payment(shop_id) and asked_by = auth.uid() and status = 'sent'
    and decided_by is null and decided_at is null);
-- No update or delete policy: an ask changes only through the two functions below.

-- The asker may take back an ask nobody has decided.
create or replace function withdraw_payment_ask(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update payment_asks set status = 'withdrawn', decided_at = now()
  where id = p_id and asked_by = auth.uid() and status = 'sent';
  if not found then
    raise exception 'That ask is decided already, or it is not yours.' using errcode = '42501';
  end if;
end $$;
revoke all on function withdraw_payment_ask(uuid) from public, anon;
grant execute on function withdraw_payment_ask(uuid) to authenticated;

-- Accounts closes it: 'done' once the payment is corrected, or 'declined'.
create or replace function decide_payment_ask(p_id uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  a record;
  v_name text;
begin
  if p_status not in ('done', 'declined') then
    raise exception 'An ask is done or declined.' using errcode = '22023';
  end if;
  select * into a from payment_asks where id = p_id for update;
  if not found then raise exception 'That ask is gone.'; end if;
  if not has_task(a.shop_id, 'payment.edit') then
    raise exception 'Correcting a payment is Accounts'' (payment.edit).' using errcode = '42501';
  end if;
  if a.status <> 'sent' then
    raise exception 'That ask is % already.', a.status;
  end if;
  select s.name into v_name from staff s where s.shop_id = a.shop_id and s.user_id = auth.uid() limit 1;
  update payment_asks set status = p_status, decided_by = auth.uid(), decided_by_name = v_name, decided_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'id', p_id, 'status', p_status);
end $$;
revoke all on function decide_payment_ask(uuid, text) from public, anon;
grant execute on function decide_payment_ask(uuid, text) to authenticated;

-- The pushes: to Accounts when asked, to the asker when decided (0120's outbox).
create or replace function payment_asks_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  what text := case new.what when 'method' then 'the method' when 'amount' then 'the amount' when 'bill' then 'the bill' else 'the day' end;
  who text := coalesce(nullif(btrim(coalesce(new.asked_by_name, '')), ''), 'Sales');
begin
  if to_regprocedure('ow_push(uuid,text,text,text,uuid,text,text,jsonb,text)') is null then return null; end if;
  if tg_op = 'INSERT' then
    perform ow_push(new.shop_id, 'payment.ask', 'A payment to correct',
      who || ' asks you to correct ' || what || ' on a payment of ' || ow_money(new.amount) || '.',
      null, 'payment.edit', null, jsonb_build_object('table', 'payment_asks', 'id', new.id), 'payask:' || new.id);
  elsif new.status in ('done', 'declined') and old.status = 'sent' then
    perform ow_push(new.shop_id, 'payment.ask.decided',
      case new.status when 'done' then 'Payment corrected' else 'Payment left as it is' end,
      coalesce(nullif(btrim(coalesce(new.decided_by_name, '')), ''), 'Accounts')
        || case new.status when 'done' then ' corrected ' else ' kept ' end || what || ' on the payment of ' || ow_money(new.amount) || '.',
      new.asked_by, null, null, jsonb_build_object('table', 'payment_asks', 'id', new.id), 'payaskdone:' || new.id);
  end if;
  return null;
exception when others then
  raise notice 'push (payment ask %): % (%)', new.id, sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists payment_asks_ow_push on payment_asks;
create trigger payment_asks_ow_push after insert or update on payment_asks
  for each row execute function payment_asks_push();
