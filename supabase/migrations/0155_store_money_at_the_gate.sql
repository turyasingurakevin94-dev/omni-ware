-- 0155 · Store, second: nothing leaves the gate unpaid for a cash customer
-- unless the Manager said it goes on credit (the cross-app test of 21 Oct
-- 2026: an unpaid order loaded for a brand-new cash-only customer).
--
-- docs/decision-rights.md: credit is the Manager's (credit.release). The
-- Store proposes, the Manager decides, and each side gets a push.
--
--   1. ow_money_hold(shop, payload, amount_paid): why an order may not
--      leave yet, or null. A cash customer is one with no credit limit on
--      file (or no customer record: a walk-in). An agent's order keeps its
--      own terms (the prepay gate). The Manager's "release" lets it go.
--   2. store_money_holds(shop): the packed orders that wait on money, with
--      what is owed, for the Store's Load and hand-over screens. The Store
--      sees the amount owed, never a price or a margin.
--   3. saved_quotes_ow_money_gate: a Store login -- or a worker login
--      ('staff'), which store.html also opens for -- cannot move such an
--      order out of Packing (loaded or handed over). The owner, an admin and the
--      Manager (credit.release) are not stopped by it.
--   4. Pushes: the Store's ask (payload.creditAsk = { at, by, byName,
--      carrier }, as the Manager app reads it) to the Manager
--      (credit.ask, to credit.release); the Manager's answer back to the
--      Store person who asked (credit.ask.decided).
--
-- Applied by hand, after 0119 (ow_order_total), 0120 (ow_push) and 0131.
-- Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select * from store_money_holds('<shop uuid>');
--   select tgname from pg_trigger where tgname in ('saved_quotes_ow_money_gate', 'saved_quotes_ow_push_money');
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_money_gate on saved_quotes;
--   drop trigger if exists saved_quotes_ow_push_money on saved_quotes;
--   drop function if exists saved_quotes_ow_money_gate();
--   drop function if exists saved_quotes_ow_push_money();
--   drop function if exists store_money_holds(uuid);
--   drop function if exists ow_money_hold(uuid, jsonb, numeric);
-- ---------------------------------------------------------------------

-- 1. Why an order waits on money, or null.
create or replace function ow_money_hold(p_shop_id uuid, p_payload jsonb, p_amount_paid numeric)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p jsonb := coalesce(p_payload, '{}'::jsonb);
  c customers;
  owed numeric;
  dec text := p -> 'creditCheck' ->> 'decision';
begin
  if coalesce(p ->> 'originAgentId', '') <> '' then return null; end if;
  if dec = 'release' then return null; end if;
  if coalesce(p ->> 'customerId', '') <> '' then
    select * into c from customers where shop_id = p_shop_id and id = p ->> 'customerId';
    if found and coalesce(c.credit_limit, 0) > 0 then return null; end if;
  end if;
  owed := greatest(0, round(ow_order_total(p_shop_id, p, true)) - coalesce(p_amount_paid, 0));
  if owed <= 0 then return null; end if;
  return jsonb_build_object('owed', owed, 'cash', true, 'decision', dec);
end $$;
revoke all on function ow_money_hold(uuid, jsonb, numeric) from public, anon, authenticated;

-- 2. The packed orders that wait on money, for the Store.
create or replace function store_money_holds(p_shop uuid)
returns table (id bigint, owed numeric, decision text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_shop_admin(p_shop) or has_task(p_shop, 'order.load') or has_task(p_shop, 'order.pick') or has_task(p_shop, 'credit.release')
          or exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.role = 'staff')) then
    raise exception 'Seeing what waits on money is for the Store, the Manager or the owner.' using errcode = '42501';
  end if;
  return query
    select q.id, (h ->> 'owed')::numeric, h ->> 'decision'
      from saved_quotes q
      cross join lateral (select ow_money_hold(q.shop_id, q.payload, q.amount_paid) as h) x
     where q.shop_id = p_shop and q.status = 'preparing' and not coalesce(q.voided, false) and not coalesce(q.invoiced, false)
       and x.h is not null;
end $$;
revoke all on function store_money_holds(uuid) from public, anon;
grant execute on function store_money_holds(uuid) to authenticated;

-- 3. A Store or worker login cannot send it out of Packing.
create or replace function saved_quotes_ow_money_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  h jsonb;
begin
  if not (old.status = 'preparing' and new.status in ('pending_delivery', 'completed')) then return new; end if;
  if coalesce(new.voided, false) or coalesce(new.invoiced, false) then return new; end if;
  select m.role into v_role from shop_members m where m.shop_id = new.shop_id and m.user_id = auth.uid() limit 1;
  if v_role is null or v_role not in ('store', 'staff') or has_task(new.shop_id, 'credit.release') then return new; end if;
  begin
    h := ow_money_hold(new.shop_id, new.payload, new.amount_paid);
  exception when others then
    raise notice 'money gate (order %): % (%)', new.id, sqlerrm, sqlstate;
    return new;
  end;
  if h is not null then
    raise exception 'Not paid · cash customer. The Manager decides whether it goes on credit.' using errcode = '42501', hint = 'OWCSH';
  end if;
  return new;
end $$;
drop trigger if exists saved_quotes_ow_money_gate on saved_quotes;
create trigger saved_quotes_ow_money_gate before update on saved_quotes
  for each row execute function saved_quotes_ow_money_gate();

-- 4. The ask and its answer.
create or replace function saved_quotes_ow_push_money() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := coalesce(old.payload, '{}'::jsonb);
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'An order');
  ask jsonb := p -> 'creditAsk';
  dec text := p -> 'creditCheck' ->> 'decision';
  ref jsonb := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  h jsonb;
  who text;
begin
  if coalesce(new.voided, false) then return null; end if;
  begin
    if jsonb_typeof(ask) = 'object' and coalesce(ask ->> 'at', '') <> '' and not (ask ? 'answer')
       and (ask ->> 'at') is distinct from (o -> 'creditAsk' ->> 'at') then
      h := ow_money_hold(new.shop_id, p, new.amount_paid);
      perform ow_push(new.shop_id, 'credit.ask', 'Not paid · let it go on credit?',
        coalesce(nullif(split_part(btrim(coalesce(ask ->> 'byName', '')), ' ', 1), ''), 'The Store')
          || ' has ' || client || ' packed · owes ' || ow_money(coalesce((h ->> 'owed')::numeric, 0))
          || ' · cash customer. Credit or cash first?',
        null, 'credit.release', null, ref, 'loadask:' || new.id || ':' || coalesce(ask ->> 'at', ''));
    end if;
    if jsonb_typeof(ask) = 'object' and dec in ('release', 'cash', 'hold')
       and dec is distinct from (o -> 'creditCheck' ->> 'decision') and ow_uuid(ask ->> 'by') is not null then
      who := coalesce(nullif(split_part(btrim(coalesce(p -> 'creditCheck' ->> 'byName', '')), ' ', 1), ''), 'The Manager');
      perform ow_push(new.shop_id, 'credit.ask.decided',
        case when dec = 'release' then 'On credit · load it' else 'Cash first · keep it' end,
        client || case when dec = 'release' then ' — ' || who || ' lets it go on credit.'
                       else ' — ' || who || ' wants the money first. It stays on the bay.' end,
        ow_uuid(ask ->> 'by'), null, null, ref, 'loadaskdone:' || new.id || ':' || dec || ':' || coalesce(p -> 'creditCheck' ->> 'at', ''));
    end if;
  exception when others then
    raise notice 'push (money ask): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists saved_quotes_ow_push_money on saved_quotes;
create trigger saved_quotes_ow_push_money after update on saved_quotes
  for each row execute function saved_quotes_ow_push_money();
