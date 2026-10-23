-- 0157 · Store, third: what the yard asks of others, and the goods it counts
-- that had no order behind them (the store app built to its canvas).
--
-- docs/decision-rights.md: the Store proposes, someone else decides, and the
-- one who waits gets a push. Nothing here waits for the owner.
--
--   1. store_asks: one row per thing the yard asks of someone --
--        'restock'   more of an item for the shelf; the Buyer decides what
--                    to buy (buy.restock), pushed store.restock
--        'extra'     goods on the truck that were not on the list; the
--                    Manager decides (trip.difference), pushed store.extra
--        'handover'  the yard handed to a colleague mid-shift; they tap
--                    "I've got it" (payload.toUserId), pushed store.handover
--        'close'     the yard closed for the day; a log line the Manager
--                    sees, pushed store.closed. Nothing to answer: it
--                    stays 'sent' and answer_store_ask refuses it.
--      A yard login adds rows as itself. Nobody updates a row directly.
--   2. answer_store_ask(id, status, note): the one who decides answers --
--      the Buyer a restock, the Manager an extra, the named colleague a
--      handover; the asker may withdraw their own. The asker is pushed
--      the answer (store.ask.decided).
--   3. receive_trip v2 (0136's): a trip line with no order and no
--      'restock' mark (bought for the shelf, the order amended away before
--      the trip) goes on the shelf as restock goods instead of being
--      counted "missing"; and the yard's reason for a count unlike the
--      Buyer's (p_lines[i].why: short, torn, brand) rides on the line as
--      yardWhy, beside yardQty, for the Manager's trip difference.
--
-- Applied by hand, after 0120 (ow_push), 0124 and 0136. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select kind, status, count(*) from store_asks group by 1, 2;
--   select tgname from pg_trigger where tgname = 'store_asks_ow_push';
--
-- ROLLBACK:
--   drop trigger if exists store_asks_ow_push on store_asks;
--   drop function if exists store_asks_ow_push();
--   drop function if exists answer_store_ask(uuid, text, text);
--   drop table if exists store_asks;
--   (receive_trip: re-run its body from 0136.)
-- ---------------------------------------------------------------------

-- Who works the yard: a Store login, a worker login ('staff', which
-- store.html also opens for), or anyone holding the yard's tasks.
create or replace function ow_is_yard(p_shop uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_shop_admin(p_shop) or has_task(p_shop, 'order.pick') or has_task(p_shop, 'trip.checkin')
      or exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.role in ('store', 'staff'));
$$;
revoke all on function ow_is_yard(uuid) from public, anon;
grant execute on function ow_is_yard(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 1. The asks.
create table if not exists store_asks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  kind text not null check (kind in ('restock', 'extra', 'handover', 'close')),
  ref text,
  payload jsonb not null default '{}'::jsonb,
  asked_by uuid default auth.uid(),
  asked_by_name text,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists store_asks_shop_idx on store_asks(shop_id, created_at desc);
create index if not exists store_asks_open_idx on store_asks(shop_id, kind, status);
alter table store_asks enable row level security;

drop policy if exists "members read store asks" on store_asks;
create policy "members read store asks" on store_asks
  for select using (is_shop_member(shop_id));
drop policy if exists "the yard adds store asks" on store_asks;
create policy "the yard adds store asks" on store_asks
  for insert with check (ow_is_yard(shop_id) and asked_by = auth.uid() and status = 'sent'
    and decided_by is null and decided_at is null);
-- No update or delete policy: answers go through answer_store_ask.

-- ---------------------------------------------------------------------
-- 2. The answer, by the one whose decision it is.
create or replace function answer_store_ask(p_id uuid, p_status text, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a store_asks%rowtype;
begin
  select * into a from store_asks where id = p_id for update;
  if not found or not is_shop_member(a.shop_id) then raise exception 'That ask is gone.'; end if;
  if a.status <> 'sent' then return jsonb_build_object('ok', true, 'already', true, 'status', a.status); end if;
  if p_status = 'withdrawn' then
    if a.asked_by is distinct from auth.uid() then
      raise exception 'Only the one who asked can take it back.' using errcode = '42501';
    end if;
  elsif p_status in ('accepted', 'declined') then
    if not (case a.kind
              when 'restock' then has_task(a.shop_id, 'buy.restock')
              when 'extra' then has_task(a.shop_id, 'trip.difference')
              when 'handover' then ow_uuid(a.payload ->> 'toUserId') = auth.uid()
              else false end) then
      raise exception 'That answer is not yours to give.' using errcode = '42501';
    end if;
  else
    raise exception 'An ask is accepted, declined or taken back.';
  end if;
  update store_asks set status = p_status, note = nullif(btrim(coalesce(p_note, '')), ''), decided_by = auth.uid(), decided_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;
revoke all on function answer_store_ask(uuid, text, text) from public, anon;
grant execute on function answer_store_ask(uuid, text, text) to authenticated;

-- The pushes: the one who decides, then the one who asked.
create or replace function store_asks_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  who text := coalesce(nullif(split_part(btrim(coalesce(new.asked_by_name, '')), ' ', 1), ''), 'The Store');
  what text := btrim(coalesce(p ->> 'qty', '') || ' ' || coalesce(p ->> 'unit', '') || ' ' || coalesce(p ->> 'name', 'goods'));
  ref jsonb := jsonb_build_object('table', 'store_asks', 'id', new.id);
  by_name text;
begin
  begin
    if tg_op = 'INSERT' then
      if new.kind = 'restock' then
        perform ow_push(new.shop_id, 'store.restock', 'More wanted on the shelf',
          who || ' asks for ' || what
            || case when jsonb_typeof(p -> 'shortFor') = 'array' and jsonb_array_length(p -> 'shortFor') > 0
                    then ' · ' || jsonb_array_length(p -> 'shortFor') || ' order' || case when jsonb_array_length(p -> 'shortFor') = 1 then '' else 's' end || ' short' else '' end
            || case when coalesce(p ->> 'when', '') = 'today' then ' · needed today' else '' end,
          null, 'buy.restock', null, ref, 'storeask:' || new.id);
      elsif new.kind = 'extra' then
        perform ow_push(new.shop_id, 'store.extra', 'Not on the list · keep it?',
          who || ' found ' || what || ' on the truck that was not on the list. Keep it or send it back?',
          null, 'trip.difference', null, ref, 'storeask:' || new.id);
      elsif new.kind = 'handover' then
        perform ow_push(new.shop_id, 'store.handover', who || ' handed you the yard',
          case coalesce(jsonb_array_length(case when jsonb_typeof(p -> 'orders') = 'array' then p -> 'orders' end), 0)
            when 0 then 'Nothing half done.' when 1 then '1 half-done job moves to you.'
            else jsonb_array_length(p -> 'orders') || ' half-done jobs move to you.' end || ' Tap "I''ve got it".',
          ow_uuid(p ->> 'toUserId'), null, null, ref, 'storeask:' || new.id);
      elsif new.kind = 'close' then
        perform ow_push(new.shop_id, 'store.closed', 'The yard is closed',
          who || ' closed the yard · ' || coalesce(p ->> 'out', '0') || ' out · ' || coalesce(p ->> 'carries', '0') || ' carried over.',
          null, null, 'manager', ref, 'storeask:' || new.id);
      end if;
    elsif new.status is distinct from old.status and new.status in ('accepted', 'declined') and new.asked_by is not null then
      select name into by_name from staff where shop_id = new.shop_id and user_id = new.decided_by limit 1;
      by_name := coalesce(nullif(split_part(btrim(coalesce(by_name, '')), ' ', 1), ''), case new.kind when 'restock' then 'The Buyer' when 'extra' then 'The Manager' else 'Your colleague' end);
      perform ow_push(new.shop_id, 'store.ask.decided',
        case new.kind when 'handover' then by_name || ' has the yard'
                      when 'restock' then case when new.status = 'accepted' then 'More is coming' else 'Not buying more yet' end
                      else case when new.status = 'accepted' then 'Keep it' else 'It goes back' end end,
        case when new.kind = 'handover' then by_name || case new.status when 'accepted' then ' tapped "I''ve got it".' else ' cannot take the yard.' end
             else by_name || case new.status when 'accepted' then ' said yes' else ' said no' end || ' · ' || what end
          || coalesce(' · ' || new.note, ''),
        new.asked_by, null, null, ref, 'storeaskdone:' || new.id || ':' || new.status);
    end if;
  exception when others then
    raise notice 'push (store ask): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists store_asks_ow_push on store_asks;
create trigger store_asks_ow_push after insert or update on store_asks
  for each row execute function store_asks_ow_push();

-- ---------------------------------------------------------------------
-- 3. receive_trip v2: no-order lines reach the shelf; the yard's reason rides on the line.
create or replace function receive_trip(p_shop uuid, p_trip text, p_lines jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t collection_trips%rowtype;
  l jsonb;
  i int;
  lines_out jsonb := '[]'::jsonb;
  diffs jsonb := '[]'::jsonb;
  inp jsonb;
  n numeric;
  pk numeric;
  buyer numeric;
  price numeric;
  shelf_qty numeric;
  q record;
  items jsonb;
  it jsonb;
  j int;
  k text;
  before numeric;
  after numeric;
  log_id bigint;
  sup_name text;
  why text;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  received int := 0;
  missing int := 0;
  moved int := 0;
  restocked int := 0;
  touched bigint[] := '{}';
  oid bigint;
  waiting boolean;
  prepay_blocked boolean;
begin
  if not has_task(p_shop, 'stock.receive') then
    raise exception 'Putting a trip on the shelf is for the Store, a manager or the owner.' using errcode = '42501';
  end if;
  select * into t from collection_trips where shop_id = p_shop and id = p_trip for update;
  if not found then raise exception 'That trip is gone.'; end if;
  if t.voided then raise exception 'That trip was called off.'; end if;
  if t.status = 'confirmed' then return jsonb_build_object('ok', true, 'already', true); end if;
  if t.status <> 'collected' then raise exception 'That trip is not back yet.'; end if;

  select name into sup_name from suppliers where shop_id = p_shop and id::text = t.supplier_id;

  for l, i in select e, (o - 1)::int from jsonb_array_elements(coalesce(t.lines, '[]'::jsonb)) with ordinality as x(e, o)
  loop
    inp := coalesce(p_lines -> i, '{}'::jsonb);
    buyer := case when jsonb_typeof(l -> 'gotQty') = 'number' then (l ->> 'gotQty')::numeric end;
    n := greatest(0, coalesce((inp ->> 'shop')::numeric, buyer, (l ->> 'qty')::numeric, 0));
    pk := greatest(1, coalesce((inp ->> 'pack')::numeric, 1));
    why := case when inp ->> 'why' in ('short', 'torn', 'brand') then inp ->> 'why' end;
    lines_out := lines_out || jsonb_build_array(l || jsonb_build_object('yardQty', n) || case when why is not null then jsonb_build_object('yardWhy', why) else '{}'::jsonb end);
    if buyer is not null and buyer <> n then
      diffs := diffs || jsonb_build_array(jsonb_build_object('i', i, 'productName', l ->> 'productName', 'unit', l ->> 'unit', 'buyer', buyer, 'shop', n, 'why', why));
    end if;
    if n <= 0 then continue; end if;

    -- Goods bought for the shelf (buy.restock, 0125, orderId 'restock'), and
    -- now also a line with no order at all: straight onto the shelf, at the
    -- price paid.
    if coalesce(l ->> 'orderId', '') in ('restock', '') and coalesce(l ->> 'productId', '') <> '' then
      price := coalesce((l ->> 'gotPrice')::numeric, (l ->> 'expectedPrice')::numeric, 0);
      shelf_qty := round(n * pk, 6);
      k := case when coalesce(l ->> 'variantIdx', '') = '' then l ->> 'productId' else (l ->> 'productId') || '::' || (l ->> 'variantIdx') end;
      select qty into before from stock where shop_id = p_shop and key = k for update;
      before := coalesce(before, 0);
      after := round(before + shelf_qty, 6);
      insert into stock (shop_id, key, product_id, variant_idx, qty)
           values (p_shop, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), after)
      on conflict (shop_id, key) do update set qty = excluded.qty;
      insert into stock_lots (shop_id, key, qty, cost) values (p_shop, k, shelf_qty, case when price > 0 then round(price / pk, 6) end);
      log_id := next_stock_log_id(p_shop);
      insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at)
           values (log_id, p_shop, k, l ->> 'productId', nullif(l ->> 'variantIdx', ''), l ->> 'productName', 'restock',
                   shelf_qty, after,
                   'Received from ' || coalesce(sup_name, 'the supplier') || ' for the shelf'
                     || case when pk > 1 then ' — ' || n || ' ' || coalesce(l ->> 'unit', '') else '' end || ' · counted at the shop',
                   current_date, now());
      if coalesce(l ->> 'orderId', '') = 'restock' and to_regclass('public.restock_buys') is not null then
        update restock_buys set status = 'collected' where shop_id = p_shop and id::text = l ->> 'lineId' and status in ('planned', 'on_trip');
      end if;
      received := received + 1; restocked := restocked + 1;
      continue;
    end if;

    -- The order line the goods are for. A line amended away is real goods
    -- nothing here knows what to do with: counted and reported, not shelved.
    oid := case when (l ->> 'orderId') ~ '^\d+$' then (l ->> 'orderId')::bigint end;
    if oid is null then missing := missing + 1; continue; end if;
    select id, status, payload into q from saved_quotes where shop_id = p_shop and id = oid and not voided for update;
    if not found then missing := missing + 1; continue; end if;
    items := coalesce(q.payload -> 'items', '[]'::jsonb);
    j := null;
    for x in 0 .. jsonb_array_length(items) - 1 loop
      if (items -> x ->> 'lineId') = (l ->> 'lineId') then j := x; exit; end if;
    end loop;
    if j is null then missing := missing + 1; continue; end if;
    it := items -> j;

    -- setLineSupplier: a trip is the record of where somebody went.
    if t.supplier_id is not null and t.supplier_id <> '__stock__' and coalesce(it ->> 'supplierId', '') <> t.supplier_id then
      it := it || jsonb_build_object('supplierId', t.supplier_id) || case when sup_name is not null then jsonb_build_object('supplierName', sup_name) else '{}'::jsonb end;
    end if;
    -- receiveQuoteLine: adds to what already came, each arrival its own receipt.
    price := coalesce((l ->> 'gotPrice')::numeric, (l ->> 'expectedPrice')::numeric, (it ->> 'price')::numeric, 0);
    shelf_qty := round(n * pk, 6);
    it := it || jsonb_build_object(
      'receivedQty', coalesce((it ->> 'receivedQty')::numeric, 0) + n,
      'receivedPrice', price,
      'receipts', coalesce(case when jsonb_typeof(it -> 'receipts') = 'array' then it -> 'receipts' end, '[]'::jsonb)
                    || jsonb_build_array(jsonb_build_object('qty', n, 'price', price, 'at', now_iso)),
      'receivedAt', now_iso,
      'receivedOnShelf', coalesce((it ->> 'receivedOnShelf')::numeric, 0) + shelf_qty);
    items := jsonb_set(items, array[j::text], it);
    update saved_quotes set payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{items}', items) where shop_id = p_shop and id = oid;
    if not (oid = any(touched)) then touched := touched || oid; end if;

    -- applyStockDelta, in the shelf's unit, at the cost per shelf unit.
    k := case when coalesce(it ->> 'variantIdx', '') = '' then it ->> 'productId' else (it ->> 'productId') || '::' || (it ->> 'variantIdx') end;
    select qty into before from stock where shop_id = p_shop and key = k for update;
    before := coalesce(before, 0);
    after := round(before + shelf_qty, 6);
    insert into stock (shop_id, key, product_id, variant_idx, qty)
         values (p_shop, k, it ->> 'productId', nullif(it ->> 'variantIdx', ''), after)
    on conflict (shop_id, key) do update set qty = excluded.qty;
    insert into stock_lots (shop_id, key, qty, cost) values (p_shop, k, shelf_qty, case when price > 0 then round(price / pk, 6) end);
    log_id := next_stock_log_id(p_shop);
    insert into stock_log (id, shop_id, key, product_id, variant_idx, label, type, delta, qty_after, note, date, at)
         values (log_id, p_shop, k, it ->> 'productId', nullif(it ->> 'variantIdx', ''), coalesce(it ->> 'productName', l ->> 'productName'), 'restock',
                 shelf_qty, after,
                 'Received from ' || coalesce(sup_name, 'the supplier') || coalesce(' for ' || nullif(q.payload -> 'client' ->> 'name', ''), '')
                   || case when pk > 1 then ' — ' || n || ' ' || coalesce(it ->> 'unit', '') else '' end || ' · counted at the shop',
                 current_date, now());
    received := received + 1;
  end loop;

  -- Buying -> Packing for an order whose goods are all in now
  -- (orderAwaitsGoods; the prepay gate holds, as orderLeaveDraft does).
  foreach oid in array touched loop
    select id, status, payload into q from saved_quotes where shop_id = p_shop and id = oid;
    if q.status <> 'awaiting_goods' then continue; end if;
    select exists (
      select 1 from jsonb_array_elements(coalesce(q.payload -> 'items', '[]'::jsonb)) e
       where coalesce(e ->> 'supplierId', '') not in ('', '__stock__')
         and not (coalesce(e ->> 'receivedAt', '') <> '' and coalesce((e ->> 'receivedQty')::numeric, 0) > 0)
    ) into waiting;
    if waiting then continue; end if;
    select exists (
      select 1 from agents a
       where a.shop_id = p_shop and a.id::text = q.payload ->> 'originAgentId'
         and coalesce(a.payment_term, 'prepay') = 'prepay' and coalesce(q.payload ->> 'agentPaymentStatus', '') <> 'paid'
    ) into prepay_blocked;
    if prepay_blocked then continue; end if;
    update saved_quotes
       set status = 'preparing',
           payload = coalesce(payload, '{}'::jsonb)
             || jsonb_build_object('stageEnteredAt', now_ms,
                  'stageLog', coalesce(case when jsonb_typeof(payload -> 'stageLog') = 'array' then payload -> 'stageLog' end, '[]'::jsonb)
                              || jsonb_build_array(jsonb_build_object('status', 'preparing', 'at', now_ms, 'auto', true)))
     where shop_id = p_shop and id = oid;
    moved := moved + 1;
  end loop;

  update collection_trips
     set lines = lines_out,
         yard_checked_at = coalesce(yard_checked_at, now()),
         yard_checked_by = coalesce(yard_checked_by, auth.uid()),
         yard_received_at = now(), yard_received_by = auth.uid(),
         status = 'confirmed', confirmed_at = now()
   where shop_id = p_shop and id = p_trip;

  return jsonb_build_object('ok', true, 'received', received, 'missing', missing, 'moved', moved, 'restocked', restocked, 'differences', jsonb_array_length(diffs));
end;
$$;
revoke all on function receive_trip(uuid, text, jsonb) from public, anon;
grant execute on function receive_trip(uuid, text, jsonb) to authenticated;
