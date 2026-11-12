-- 0183 · Store, twelfth: the new Store app's database (the approved canvas
-- "Store — in the agent app's language", docs/canvas/store-agent/; its
-- integration board IB01Handovers and docs/audit/store/OTHER-APPS.md, "The
-- database"). Every handover the yard takes part in that waits on someone
-- now pushes that person, in the words IB01 draws, and a packed pickup
-- waits at the gate as "Ready to collect".
--
--   1. READY TO COLLECT. A packed pickup moves Packing -> On the road with
--      no carrier (`pending_delivery`, `payload.carrier` empty) the moment
--      it is packed, and the gate's hand-over (carrier client or agent)
--      moves it on to Delivered: both through store_patch_order, the yard's
--      own path (0164, 0178), as Sales (src/core/orders.ts readyToCollect)
--      and the agent app already read it. The money
--      gate (0156, 0164) holds goods where they LEAVE: a delivery when it
--      is loaded (as before), a packed pickup when it is handed over (or
--      given a carrier) -- so "Ready to collect · not paid yet · leaves when paid"
--      (OU13) waits at the gate, and the Store's money holds (store_live,
--      store_money_holds) list a ready-to-collect order too.
--
--   2. THE YARD'S ALLOW-LIST (ow_store_payload, 0164) also passes
--      deliverTo, deliverWhen, deliverPhone (Sales writes them apart,
--      IM-01/02), counter (a counter sale, IM-31), comingBack (below), and
--      on each takenBack entry whether the goods went back on the shelf
--      (restocked, IM-14). store_patch_order takes comingBack. It also
--      passes droppedLines (a line Sales, the Manager or the Buyer took off
--      the order leaves items[] for it; the yard draws it struck through),
--      without its price, and putBack (below). The yard never writes
--      droppedLines.
--
--   2b. PUT BACK (W7; PK10's red slide, OU27's bring it back). A cancelled
--      or voided order takes one write through store_patch_order, the
--      yard's put-back: payload.putBack {at, by, byName, lines [{idx,
--      qty}]}, stamped once, the time and the person the server's. Every
--      phone, Ruth and Grace then read it as put back, and it stops asking
--      the yard. No stock moves: an order's goods come off the books at
--      the invoice (0119), so a cancelled order's never left them (0177),
--      and a voided invoice's come back by the Manager's restock (0176);
--      the put-back is the shelf catching up with the books, so counting
--      it again would count it twice. No push: IB01 draws none for it.
--
--   3. THE PUSHES (IB01; "the yard" is order.pick, which the Store and a
--      yard worker hold; "Ruth" is the task the Manager holds; the owner
--      holds no role_tasks row, so he gets none -- his is the log):
--        order.pick         an order enters Packing (placed there, all in,
--                           or moved on) -> the yard: "New to pack · #0556
--                           Nansana · they collect" (IM-09, IM-10)
--        order.pick         given to a packer (awaiting_accept) -> that
--                           packer only: "Ruth gave you #0556 to pack" (IM-08)
--        order.all_in       Buying -> Packing -> the salesperson: "Ggaba's
--                           #0549 is all in · Packing"
--        order.cancelled    to whoever holds it: the yard ("Cancelled · put
--                           it back · #0530"; on a truck "#0534 cancelled ·
--                           bring it back"), a holder whose role is not the
--                           yard's, and the salesperson (IM-11, IM-39). It
--                           takes 0177's dedupe keys first, so cancel_order
--                           sends no second push in the old words.
--        pick.short         also to the salesperson: "#0552 · 1 short · Ruth
--                           settles" (0120's to pick.settle stays)
--        pick.settled       -> the packer and the salesperson: "Ruth settled
--                           #0552's short" (IM-37)
--        order.packed       packed, we deliver -> the salesperson: "Kato's
--                           #0552 is packed · bay 1" (IM-05)
--        order.unpaid_at_gate  packed with a money hold -> the salesperson:
--                           "Kato's #0552 is packed · take the money", with
--                           credit.ask -> Ruth (credit.release): "Not paid
--                           yet · let it go on credit?" (IM-07, IM-35; the
--                           Store's own ask keeps credit.ask, in these words,
--                           never "cash customer")
--        order.ready        Ready to collect -> the salesperson: "#0554 ready
--                           to collect · at the gate · code 0554" (IM-03)
--        order.out          loaded -> the salesperson: "#0552 on the road ·
--                           Ssali", hired "· Abudu (hired)" (IM-04, IM-27)
--        order.delivered    also to the salesperson: "#0552 delivered 14:05",
--                           "#0555 collected 10:47", "#0554 collected ·
--                           Peter", "#0552 delivered · no photo" with the
--                           reason (IM-06, IM-30); 0120's to invoice.make stays
--        order.back         can't deliver (comingBack) -> Ruth (order.assign)
--                           and the salesperson: "#0547 coming back · Ggaba
--                           closed"
--        order.moved        a stage the yard holds moved by someone outside
--                           the yard -> the yard: "Ruth marked #0538
--                           delivered" (IM-29)
--        trip.back          new words: "Denis's trip is back at the yard · 3
--                           lines" (IM-25, IM-26)
--        trip.checked       checked in -> the Buyer (trip.plan): "Checked in ·
--                           Denis's trip · 3 lines"
--        trip.difference    new words: "Musa's check-in of Denis's trip · 2 pc
--                           differ" (IM-23)
--        trip.difference.decided  -> the checker: "Ruth decided the 2 pc"
--        delivery.checked   a supplier's delivery checked in -> Sourcing
--                           (supplier.edit) and Accounts (bill.record, the
--                           delivery note): "Hima Cement · 100 bag came in"
--        store.restock, store.extra, store.handover  new words: "We need more
--                           · Gloss paint · about 10 tin", "Not on the list ·
--                           Binding wire 20kg · keep it?", "Musa passed you
--                           the yard" (IM-34)
--        store.ask.decided  "On the restock list · next trip", "Ruth: keep
--                           it" (an extra: also the Buyer, and Accounts when
--                           kept, who pays the supplier for it), "Okello has
--                           it" (IM-17)
--        stock.count.sent   a count sent -> Ruth only (stock.correct): "Musa's
--                           count of Wire nails 4" · 17" (IM-20)
--        stock.count.decided / stock.recount  -> the counter: "Ruth accepted
--                           your count" / "Ruth asked: count it again"
--        return.coming      Sales asks a return -> the yard: "#0548 coming
--                           back · 2 bag" (IM-15)
--        invoice.ask        the yard's return at the gate, new words "#0548 ·
--                           2 bag damaged" (IM-12, IM-13); invoice.ask.decided
--                           also to the salesperson (a yard ask) or the yard
--                           (Sales' ask): "Ruth took it back · 2 bag" (IM-14)
--
-- Not here (no write or no channel for it; listed in the Log): order.copy
-- (no app marks an order a copy yet), a push to an agent or a customer
-- (push_outbox reaches shop members only; agents have their own phones'
-- table), trip.short from the check-in's words, the gate's check-in of an
-- order that came back. notify-worker and notify-stock-count still send
-- their old pushes while their Database Webhooks are on: turn those two
-- webhooks off when the new app replaces store.html.
--
-- Touches no money and no stock: no cash line, payment, invoice, price or stock line. No role, task
-- or decision right changes. Every guard stays: store_patch_order's
-- p_expect, its stage rule and allow-list; 0173/0178's stage rule; the
-- money gate (now where the goods leave). Every push is AFTER the write and
-- never stops it.
--
-- Applied by hand, after 0181 (and 0120, 0147, 0156, 0157, 0164, 0166,
-- 0168, 0177, 0178). Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname in ('saved_quotes_ow_a_yard_push', 'stock_counts_ow_push', 'invoice_asks_ow_a_yard_push');
--   -- 3 rows
--   select position('ow_ready_to_collect' in pg_get_functiondef('store_live(uuid)'::regprocedure)) > 0;   -- true
--   select ow_store_payload('{"deliverTo":"Ntinda","deliverWhen":"today-pm","deliverPhone":"0772","counter":true}');
--   select ow_store_payload('{"droppedLines":[{"productName":"Hinge","qty":10,"sellPrice":9000}],"putBack":{"at":1,"lines":[]}}');
--   -- droppedLines without sellPrice, and putBack
--
-- ROLLBACK:
--   drop trigger if exists saved_quotes_ow_a_yard_push on saved_quotes;
--   drop trigger if exists stock_counts_ow_push on stock_counts;
--   drop trigger if exists invoice_asks_ow_a_yard_push on invoice_asks;
--   (the replaced functions: re-run their bodies from 0120/0147/0150's
--   collection_trips_ow_push, 0157/0159's store_asks_ow_push, 0156's
--   saved_quotes_ow_push_money, 0164's money gate, store_patch_order (0164)
--   and ow_store_payload (0164); store_live from 0168, store_money_holds
--   from 0164)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 0. Small words, one place each.

-- An order's number as the apps write it: #0552.
create or replace function ow_order_label(p_id bigint) returns text
language sql immutable as $$ select '#' || lpad(coalesce(p_id, 0)::text, 4, '0') $$;

-- A customer as the yard calls them: the first word ("Kato", "Ggaba").
create or replace function ow_short_name(p text) returns text
language sql immutable as $$ select coalesce(nullif(split_part(btrim(coalesce(p, '')), ' ', 1), ''), 'An order') $$;

-- A person by first name: their staff row, else the name the app shows (never the email).
create or replace function ow_who(p_shop uuid, p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(ow_first_name(p_shop, p_user),
    (select nullif(split_part(btrim(coalesce(m.display_name, '')), ' ', 1), '') from shop_members m
      where m.shop_id = p_shop and m.user_id = p_user and coalesce(m.display_name, '') !~ '@' limit 1))
$$;

-- The login behind a staff id (a packer, a driver, a trip's runner).
create or replace function ow_staff_user(p_shop uuid, p_staff text) returns uuid
language sql stable security definer set search_path = public as $$
  select s.user_id from staff s where s.shop_id = p_shop and s.id = nullif(btrim(coalesce(p_staff, '')), '') limit 1
$$;

-- The first name of the one person whose role holds a task ("Ruth settles"), or nothing.
create or replace function ow_task_holder(p_shop uuid, p_task text) returns text
language sql stable security definer set search_path = public as $$
  select case when count(*) = 1 then ow_who(p_shop, min(m.user_id::text)::uuid) end
    from shop_members m join role_tasks rt on rt.role = m.role and rt.task = p_task
   where m.shop_id = p_shop
$$;

-- Ready to collect: packed, On the road with nobody carrying it -- waiting at the gate.
create or replace function ow_ready_to_collect(p_status text, p jsonb) returns boolean
language sql immutable as $$
  select coalesce(p_status = 'pending_delivery' and jsonb_typeof(coalesce(p, '{}'::jsonb) -> 'carrier') is distinct from 'object'
                  and coalesce(p ->> 'pickingStatus', '') = 'done', false)
$$;

-- A clock time in the shop's day, from a time in ms (or now): 14:05.
create or replace function ow_clock(p_ms text) returns text
language sql stable as $$
  select to_char(coalesce(case when p_ms ~ '^\d{10,}(\.\d+)?$' then to_timestamp(p_ms::numeric / 1000) end, now()) at time zone ow_shop_tz(), 'FMHH24:MI')
$$;

-- How much, the way the yard says it: "2 bag" when every line is one unit, else "3 lines".
create or replace function ow_qty_words(p_lines jsonb, p_key text) returns text
language sql immutable as $$
  with l as (
    select coalesce(ow_num(e ->> p_key), ow_num(e ->> 'qty'), 0) as n, nullif(btrim(coalesce(e ->> 'unit', '')), '') as u
      from jsonb_array_elements(case when jsonb_typeof(p_lines) = 'array' then p_lines else '[]'::jsonb end) e
     where jsonb_typeof(e) = 'object')
  select case when (select count(*) from l) = 0 then 'nothing'
              when (select count(distinct coalesce(u, '')) from l) = 1
                then trim_scale((select sum(n) from l))::text || coalesce(' ' || (select min(u) from l), '')
              else (select count(*) from l)::text || ' lines' end
$$;

-- ---------------------------------------------------------------------
-- 1. Ready to collect.

-- 1a. The money gate holds goods where they leave the yard. A delivery leaves when it
-- is loaded (Packing -> On the road with a carrier) or delivered from Packing, as before;
-- a pickup leaves at the hand-over (Ready to collect -> Delivered), or when a carrier
-- takes it after all. Packed, Packing -> Ready to collect is not leaving: it waits at the gate.
create or replace function saved_quotes_ow_money_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  h jsonb;
  carried boolean := jsonb_typeof(coalesce(new.payload, '{}'::jsonb) -> 'carrier') = 'object';
begin
  if not ((old.status = 'preparing' and new.status = 'completed')
       or (old.status = 'preparing' and new.status = 'pending_delivery' and not ow_ready_to_collect(new.status, new.payload))
       or (ow_ready_to_collect(old.status, old.payload) and (new.status = 'completed' or (new.status = 'pending_delivery' and carried)))) then
    return new;
  end if;
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

-- 1b. store_patch_order (0164's, with 0162's p_expect): the same, plus comingBack among
-- the keys (can't deliver: {at, why, byName}), and a called-off order's put-back (2b).
create or replace function store_patch_order(p_shop uuid, p_id bigint, p_patch jsonb, p_status text, p_items jsonb, p_expect jsonb default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q saved_quotes%rowtype;
  allowed text[] := array['assignedWorkerId', 'assignedDeliveryId', 'pickingStatus', 'pickCursor', 'pickingAssignedAt', 'workerAcceptedAt',
                          'pickingDoneAt', 'bay', 'carrier', 'stageEnteredAt', 'stageLog', 'deliveredTo', 'deliveredAt', 'deliveredPhoto',
                          'deliveredPhotoKind', 'deliveredNote', 'handoverCheckedAt', 'creditAsk', 'comingBack'];
  line_keys text[] := array['pickStatus', 'pickedQty'];
  p jsonb;
  items jsonb;
  it jsonb;
  ch jsonb;
  k text;
  i int;
begin
  if not (is_shop_admin(p_shop) or has_task(p_shop, 'order.pick') or has_task(p_shop, 'order.load') or has_task(p_shop, 'order.deliver')
          or exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() and m.role in ('store', 'staff'))) then
    raise exception 'Packing, loading and delivering are the Store''s.' using errcode = '42501';
  end if;
  select * into q from saved_quotes where shop_id = p_shop and id = p_id for update;
  if not found then raise exception 'That order is no longer on the books.'; end if;
  -- W7: a called-off order takes one write only, the yard's put-back: stamped once
  -- ({at, by, byName, lines [{idx, qty}]}, the time and the person the server's), no
  -- stock moved (it comes off at the invoice, 0119; a void's restock is the Manager's,
  -- 0176), no stage moved, no push (IB01 draws none). Anything else: nothing, as before.
  if coalesce(q.voided, false) or q.status = 'cancelled' then
    if coalesce(jsonb_typeof(p_patch -> 'putBack'), '') <> 'object' then return null; end if;
    if not (coalesce(q.payload, '{}'::jsonb) ? 'putBack') then
      update saved_quotes set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('putBack', jsonb_build_object(
          'at', (extract(epoch from now()) * 1000)::bigint, 'by', auth.uid(), 'byName', ow_who(p_shop, auth.uid()),
          'lines', coalesce((select jsonb_agg(jsonb_build_object('idx', (e ->> 'idx')::int, 'qty', ow_num(e ->> 'qty')) order by o)
              from jsonb_array_elements(case when jsonb_typeof(p_patch -> 'putBack' -> 'lines') = 'array' then p_patch -> 'putBack' -> 'lines' else '[]'::jsonb end)
                   with ordinality x(e, o)
             where (e ->> 'idx') ~ '^\d+$' and coalesce(ow_num(e ->> 'qty'), 0) > 0), '[]'::jsonb)))
       where shop_id = p_shop and id = p_id;
    end if;
    return store_order(p_shop, p_id);
  end if;
  -- 0162: what the phone saw when the person tapped. If the order has moved since (another phone handed
  -- it over, packed or unpacked it), nothing is written: the phone refreshes and says so.
  if jsonb_typeof(p_expect) = 'object' and (
       (p_expect ? 'status' and (p_expect ->> 'status') is distinct from q.status)
    or (p_expect ? 'pickingStatus' and (p_expect ->> 'pickingStatus') is distinct from (q.payload ->> 'pickingStatus'))
    or (p_expect ? 'pickingDoneAt' and (p_expect ->> 'pickingDoneAt') is distinct from (q.payload ->> 'pickingDoneAt'))
    or (p_expect ? 'carrierAt' and (p_expect ->> 'carrierAt') is distinct from (q.payload -> 'carrier' ->> 'at'))) then
    raise exception 'Someone else just changed this order.' using errcode = '40001', hint = 'OWSTALE';
  end if;
  if p_status is not null and p_status <> q.status then
    if not ((q.status = 'preparing' and p_status in ('pending_delivery', 'completed')) or (q.status = 'pending_delivery' and p_status = 'completed')) then
      raise exception 'That order has moved on.' using errcode = 'P0001';
    end if;
  end if;
  -- The phone calls the money-hold ask letGoAsk (0164); the books keep creditAsk.
  if p_patch ? 'letGoAsk' then p_patch := (p_patch - 'letGoAsk') || jsonb_build_object('creditAsk', p_patch -> 'letGoAsk'); end if;
  p := coalesce(q.payload, '{}'::jsonb);
  for k in select jsonb_object_keys(coalesce(p_patch, '{}'::jsonb)) loop
    if not (k = any(allowed)) then continue; end if;
    if jsonb_typeof(p_patch -> k) = 'null' then p := p - k; else p := p || jsonb_build_object(k, p_patch -> k); end if;
  end loop;
  -- A line's pick fields, merged into that line (found by lineId, else by index).
  if jsonb_typeof(p_items) = 'array' then
    items := coalesce(p -> 'items', '[]'::jsonb);
    for ch in select e from jsonb_array_elements(p_items) e loop
      i := null;
      if coalesce(ch ->> 'lineId', '') <> '' then
        select (o - 1)::int into i from jsonb_array_elements(items) with ordinality x(e, o) where x.e ->> 'lineId' = ch ->> 'lineId' limit 1;
      end if;
      if i is null and (ch ->> 'idx') ~ '^\d+$' then i := (ch ->> 'idx')::int; end if;
      if i is null or i >= jsonb_array_length(items) then continue; end if;
      it := items -> i;
      foreach k in array line_keys loop
        if not (ch ? k) then continue; end if;
        if jsonb_typeof(ch -> k) = 'null' then it := it - k; else it := it || jsonb_build_object(k, ch -> k); end if;
      end loop;
      items := jsonb_set(items, array[i::text], it);
    end loop;
    p := jsonb_set(p, '{items}', items);
  end if;
  update saved_quotes set payload = p, status = coalesce(p_status, status) where shop_id = p_shop and id = p_id;
  return store_order(p_shop, p_id);
end $$;
revoke all on function store_patch_order(uuid, bigint, jsonb, text, jsonb, jsonb) from public, anon;
grant execute on function store_patch_order(uuid, bigint, jsonb, text, jsonb, jsonb) to authenticated;

-- 1c. The Store's money holds list an order waiting at the gate too (store_live 0168,
-- store_money_holds 0164), changed in place: only the order's stage test moves.
do $mig$
declare
  fn text;
  src text;
  was text := 'q.status = ''preparing'' and not coalesce(q.voided, false) and not coalesce(q.invoiced, false)';
  now_ text := '(q.status = ''preparing'' or ow_ready_to_collect(q.status, q.payload)) and not coalesce(q.voided, false) and not coalesce(q.invoiced, false)';
begin
  foreach fn in array array['store_live(uuid)', 'store_money_holds(uuid)'] loop
    src := replace(pg_get_functiondef(fn::regprocedure), chr(13), '');
    if position('ow_ready_to_collect' in src) > 0 then continue; end if;
    if position(was in src) = 0 then raise exception '0183: % is not the shape 0164/0168 left; not changed.', fn; end if;
    execute replace(src, was, now_);
  end loop;
end $mig$;

-- ---------------------------------------------------------------------
-- 2. The yard's allow-list (0164's ow_store_payload), with the new keys.
create or replace function ow_store_payload(p jsonb) returns jsonb
language plpgsql immutable as $$
declare
  top_keys text[] := array['assignedDeliveryId', 'assignedWorkerId', 'bay', 'cancelledAt', 'cancelledByName', 'carrier',
    'client', 'comingBack', 'counter', 'createdAt', 'customerId', 'date', 'deliverPhone', 'deliverTo', 'deliverWhen',
    'deliveredAt', 'deliveredNote', 'deliveredPhoto', 'deliveredPhotoKind',
    'deliveredTo', 'deliveryAddress', 'deliveryMode', 'handoverCheckedAt', 'originAgentId', 'pickCursor', 'pickShortfallAckAt', 'pickingAssignedAt',
    'pickingDoneAt', 'pickingStatus', 'putBack', 'runDriver', 'savedAt', 'stageEnteredAt', 'stageLog', 'takenBy', 'voidedAt', 'workerAcceptedAt'];
  line_keys text[] := array['lineId', 'productId', 'productName', 'variantIdx', 'qty', 'unit', 'packQty', 'packUnit', 'supplierId', 'clientWaits',
    'pickStatus', 'pickedQty', 'receivedAt', 'receivedQty', 'qtyIn'];
  out jsonb := '{}'::jsonb;
  k text;
  a jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return '{}'::jsonb; end if;
  foreach k in array top_keys loop
    if p ? k then out := out || jsonb_build_object(k, ow_strip_money(p -> k)); end if;
  end loop;
  -- The money hold, by the phone's names: whether an agent has settled, the Manager's
  -- answer, and the Store's own ask (who asked, when, and what came back).
  if p ? 'agentPaymentStatus' then out := out || jsonb_build_object('agentSettled', coalesce(p ->> 'agentPaymentStatus', '') = 'paid'); end if;
  if jsonb_typeof(p -> 'creditCheck') = 'object' then
    out := out || jsonb_build_object('letGo', jsonb_build_object('decision', p -> 'creditCheck' -> 'decision', 'at', p -> 'creditCheck' -> 'at'));
  end if;
  if jsonb_typeof(p -> 'creditAsk') = 'object' then
    a := p -> 'creditAsk';
    out := out || jsonb_build_object('letGoAsk', jsonb_strip_nulls(jsonb_build_object('at', a -> 'at', 'by', a -> 'by', 'byName', a -> 'byName',
      'carrier', ow_strip_money(a -> 'carrier'),
      'answer', case when jsonb_typeof(a -> 'answer') = 'object' then jsonb_build_object(
          'decision', case when a -> 'answer' ->> 'decision' = 'credit' then 'letgo' else a -> 'answer' ->> 'decision' end, 'at', a -> 'answer' -> 'at') end)));
  end if;
  if jsonb_typeof(p -> 'items') = 'array' then
    out := out || jsonb_build_object('items', coalesce((select jsonb_agg(coalesce((select jsonb_object_agg(x.key, x.value) from jsonb_each(case when jsonb_typeof(it) = 'object' then it else '{}'::jsonb end) x
        where x.key = any(line_keys)), '{}'::jsonb) order by o) from jsonb_array_elements(p -> 'items') with ordinality y(it, o)), '[]'::jsonb));
  end if;
  -- What the Manager took back, and whether it went back on the shelf (the note's
  -- restocked, and a line's own when it carries one): "Back on the shelf" / "Put aside".
  if jsonb_typeof(p -> 'creditNotes') = 'array' then
    out := out || jsonb_build_object('takenBack', coalesce((select jsonb_agg(jsonb_build_object('askId', cn -> 'askId', 'voided', cn -> 'voided',
        'restocked', coalesce((cn ->> 'restocked')::boolean, false),
        'lines', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('idx', e -> 'idx', 'qty', e -> 'qty',
              'restocked', case when e ? 'restock' then to_jsonb(coalesce(e ->> 'restock', '') = 'true') end)))
            from jsonb_array_elements(case when jsonb_typeof(cn -> 'lines') = 'array' then cn -> 'lines' else '[]'::jsonb end) e), '[]'::jsonb)))
      from jsonb_array_elements(p -> 'creditNotes') cn where jsonb_typeof(cn) = 'object'), '[]'::jsonb));
  end if;
  -- A line taken off the order (payload.droppedLines: it leaves items[] when it is
  -- dropped), so the yard sees it struck through; never its price.
  if jsonb_typeof(p -> 'droppedLines') = 'array' then
    out := out || jsonb_build_object('droppedLines', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('productId', d -> 'productId',
        'productName', d -> 'productName', 'variantIdx', d -> 'variantIdx', 'qty', d -> 'qty', 'unit', d -> 'unit', 'reason', d -> 'reason',
        'droppedAt', d -> 'droppedAt')) order by o)
      from jsonb_array_elements(p -> 'droppedLines') with ordinality y(d, o) where jsonb_typeof(d) = 'object'), '[]'::jsonb));
  end if;
  if jsonb_typeof(p -> 'pickSettle') = 'object' then
    out := out || jsonb_build_object('pickSettle', jsonb_build_object('pick', p -> 'pickSettle' -> 'pick', 'at', p -> 'pickSettle' -> 'at',
      'lines', coalesce((select jsonb_agg(jsonb_build_object('idx', e -> 'idx', 'picked', e -> 'picked', 'ordered', e -> 'ordered'))
        from jsonb_array_elements(case when jsonb_typeof(p -> 'pickSettle' -> 'lines') = 'array' then p -> 'pickSettle' -> 'lines' else '[]'::jsonb end) e), '[]'::jsonb)));
  end if;
  return out;
end $$;

-- ---------------------------------------------------------------------
-- 3. An order's handovers in and out of the yard. Named "ow_a_" so it runs before
-- 0120's saved_quotes_ow_push among the AFTER triggers, and inside cancel_order's
-- update, before its own pushes: the cancel's dedupe keys are taken here first.
create or replace function saved_quotes_ow_a_yard_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := case when tg_op = 'UPDATE' then coalesce(old.payload, '{}'::jsonb) else '{}'::jsonb end;
  was text := case when tg_op = 'UPDATE' then old.status end;
  lbl text := ow_order_label(new.id);
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'An order');
  short text;
  taker uuid := ow_uuid(p ->> 'takenBy');
  uid uuid := auth.uid();
  me_role text;
  who text;
  ref jsonb := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  car jsonb := case when jsonb_typeof(p -> 'carrier') = 'object' then p -> 'carrier' end;
  counter boolean := coalesce(p ->> 'counter', '') = 'true' or coalesce(p ->> 'counterSale', '') = 'true';
  ready_now boolean;
  packed_now boolean;
  h jsonb;
  t text;
  b text;
  u uuid;
  n int;
begin
  short := ow_short_name(client);
  begin
    select m.role into me_role from shop_members m where m.shop_id = new.shop_id and m.user_id = uid limit 1;
    who := coalesce(ow_who(new.shop_id, uid), case when me_role = 'manager' then 'The Manager' else 'The shop' end);

    -- Cancelled: whoever holds it puts it back, and the salesperson is told.
    if tg_op = 'UPDATE' and new.status = 'cancelled' and was is distinct from 'cancelled' then
      if was in ('preparing', 'pending_delivery') then
        t := case when was = 'pending_delivery' and jsonb_typeof(o -> 'carrier') = 'object' then lbl || ' cancelled · bring it back'
                  else 'Cancelled · put it back · ' || lbl end;
        b := short || ' — ' || who || ' cancelled it' || coalesce(' · bay ' || nullif(o ->> 'bay', ''), '') || '.';
        perform ow_push(new.shop_id, 'order.cancelled', t, b, null, 'order.pick', null, ref, 'cancel:' || new.id || ':yard');
        -- A packer or driver the yard's push does not reach (a role without order.pick).
        foreach u in array array[ow_staff_user(new.shop_id, o ->> 'assignedWorkerId'), ow_staff_user(new.shop_id, o ->> 'assignedDeliveryId')] loop
          if u is not null and not exists (select 1 from shop_members m join role_tasks rt on rt.role = m.role and rt.task = 'order.pick'
                                             where m.shop_id = new.shop_id and m.user_id = u) then
            perform ow_push(new.shop_id, 'order.cancelled', t, b, u, null, null, ref, 'cancel:' || new.id || ':' || u);
          end if;
        end loop;
      end if;
      if taker is not null then
        perform ow_push(new.shop_id, 'order.cancelled', 'Cancelled · ' || lbl,
          short || ' — ' || who || ' cancelled it' || coalesce(': ' || left(nullif(btrim(coalesce(p ->> 'cancelWhy', '')), ''), 100), '.'),
          taker, null, null, ref, 'cancel:' || new.id || ':sales');
      end if;
      return null;
    end if;
    if coalesce(new.voided, false) or coalesce(new.invoiced, false) then return null; end if;

    -- In to Packing: the yard; and the salesperson when its goods are all in.
    if new.status = 'preparing' and (tg_op = 'INSERT' or was in ('draft', 'awaiting_goods')) then
      perform ow_push(new.shop_id, 'order.pick', 'New to pack',
        lbl || ' ' || short || ' · ' || case when p ->> 'deliveryMode' = 'agent_pickup'
                                               or (coalesce(p ->> 'deliverTo', p ->> 'deliveryAddress', '') = '' and coalesce(p ->> 'deliveryMode', '') <> 'shop_delivery')
                                             then 'they collect' else 'we deliver' end,
        null, 'order.pick', null, ref, 'pick:' || new.id || ':' || coalesce(p ->> 'stageEnteredAt', ''));
      if was = 'awaiting_goods' and taker is not null then
        perform ow_push(new.shop_id, 'order.all_in', short || '''s ' || lbl || ' is all in', 'Packing',
          taker, null, null, ref, 'allin:' || new.id || ':' || coalesce(p ->> 'stageEnteredAt', ''));
      end if;
    end if;

    -- Given to one packer: that packer only.
    if new.status = 'preparing' and p ->> 'pickingStatus' = 'awaiting_accept' and coalesce(p ->> 'assignedWorkerId', '') <> ''
       and (tg_op = 'INSERT' or (o ->> 'pickingStatus') is distinct from 'awaiting_accept' or (o ->> 'assignedWorkerId') is distinct from (p ->> 'assignedWorkerId')) then
      u := ow_staff_user(new.shop_id, p ->> 'assignedWorkerId');
      if u is not null then
        perform ow_push(new.shop_id, 'order.pick', who || ' gave you ' || lbl || ' to pack', short,
          u, null, null, ref, 'given:' || new.id || ':' || (p ->> 'assignedWorkerId') || ':' || coalesce(p ->> 'pickingAssignedAt', ''));
      end if;
    end if;

    -- Packed short: the salesperson too (0120 tells the Manager).
    if taker is not null and ow_pick_shortfall(p) and (tg_op = 'INSERT' or not ow_pick_shortfall(o)) then
      select count(*) into n from jsonb_array_elements(case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end) e
       where e ->> 'pickStatus' = 'short';
      perform ow_push(new.shop_id, 'pick.short', lbl || ' · ' || n || ' short · ' || coalesce(ow_task_holder(new.shop_id, 'pick.settle'), 'the Manager') || ' settles',
        short, taker, null, null, ref, 'short:' || new.id || ':sales:' || md5(coalesce(p -> 'items', '[]'::jsonb)::text));
    end if;

    -- The short settled: the packer and the salesperson.
    if jsonb_typeof(p -> 'pickSettle') = 'object' and (p -> 'pickSettle' ->> 'at') is distinct from (o -> 'pickSettle' ->> 'at') then
      t := coalesce(nullif(split_part(btrim(coalesce(p -> 'pickSettle' ->> 'byName', '')), ' ', 1), ''), who) || ' settled ' || lbl || '''s short';
      b := short || ' — ' || case when p -> 'pickSettle' ->> 'pick' = 'went' then 'bill what went' else 'bill the full quantity' end || '.';
      u := ow_staff_user(new.shop_id, p ->> 'assignedWorkerId');
      if u is not null then
        perform ow_push(new.shop_id, 'pick.settled', t, b, u, null, null, ref, 'settled:' || new.id || ':packer:' || coalesce(p -> 'pickSettle' ->> 'at', ''));
      end if;
      if taker is not null then
        perform ow_push(new.shop_id, 'pick.settled', t, b, taker, null, null, ref, 'settled:' || new.id || ':sales:' || coalesce(p -> 'pickSettle' ->> 'at', ''));
      end if;
    end if;

    -- Packed: waits for the truck, waits at the gate, or waits on money.
    ready_now := ow_ready_to_collect(new.status, p) and (tg_op = 'INSERT' or not ow_ready_to_collect(was, o));
    packed_now := new.status = 'preparing' and p ->> 'pickingStatus' = 'done' and (tg_op = 'INSERT' or (o ->> 'pickingStatus') is distinct from 'done');
    if (ready_now or packed_now) and not counter then
      h := ow_money_hold(new.shop_id, p, new.amount_paid);
      if h is not null then
        if taker is not null then
          perform ow_push(new.shop_id, 'order.unpaid_at_gate', short || '''s ' || lbl || ' is packed · take the money', 'Not paid yet · leaves when paid',
            taker, null, null, ref, 'unpaid:' || new.id || ':' || coalesce(p ->> 'pickingDoneAt', ''));
        end if;
        perform ow_push(new.shop_id, 'credit.ask', 'Not paid yet · let it go on credit?',
          short || ' ' || lbl || ' is packed · owes ' || ow_money(coalesce((h ->> 'owed')::numeric, 0)) || '. On credit, or the money first?',
          null, 'credit.release', null, ref, 'unpaid:' || new.id || ':' || coalesce(p ->> 'pickingDoneAt', '') || ':ask');
      elsif ready_now then
        if taker is not null then
          perform ow_push(new.shop_id, 'order.ready', lbl || ' ready to collect · at the gate · code ' || lpad(new.id::text, 4, '0'), short,
            taker, null, null, ref, 'ready:' || new.id || ':' || coalesce(p ->> 'stageEnteredAt', ''));
        end if;
      elsif taker is not null and not ow_pick_shortfall(p) then
        -- (Packed short waits on the Manager first: pick.short told them.)
        perform ow_push(new.shop_id, 'order.packed', short || '''s ' || lbl || ' is packed' || coalesce(' · bay ' || nullif(p ->> 'bay', ''), ''),
          'Waits for the truck', taker, null, null, ref, 'packed:' || new.id || ':' || coalesce(p ->> 'pickingDoneAt', ''));
      end if;
    end if;

    -- Loaded: on the road.
    if new.status = 'pending_delivery' and car is not null and taker is not null
       and (tg_op = 'INSERT' or was = 'preparing' or ow_ready_to_collect(was, o)) then
      perform ow_push(new.shop_id, 'order.out',
        lbl || ' on the road · ' || coalesce(nullif(split_part(btrim(coalesce(car ->> 'name', '')), ' ', 1), ''), 'our driver')
          || case when car ->> 'kind' = 'hired' then ' (hired)' else '' end,
        short, taker, null, null, ref, 'out:' || new.id || ':' || coalesce(car ->> 'at', ''));
    end if;

    -- Delivered or collected: the salesperson too (0120 tells the Manager).
    if new.status = 'completed' and (tg_op = 'INSERT' or was is distinct from 'completed') and taker is not null and not counter then
      if uid is not null and coalesce(me_role, '') not in ('store', 'staff') then
        t := who || ' marked ' || lbl || ' delivered';   -- not the yard's hand: no time, no photo to speak of
        b := short;
      elsif ow_ready_to_collect(was, o) or car ->> 'kind' in ('client', 'agent') or coalesce(p ->> 'handoverCheckedAt', '') <> '' then
        t := lbl || ' collected' || case when car ->> 'kind' = 'agent' or p ->> 'deliveryMode' = 'agent_pickup'
                                         then ' · ' || coalesce(nullif(split_part(btrim(coalesce(car ->> 'name', p ->> 'deliveredTo', '')), ' ', 1), ''), 'the agent')
                                         else ' ' || ow_clock(p ->> 'deliveredAt') end;
        b := short;
      elsif coalesce(p ->> 'deliveredPhoto', '') = '' then
        t := lbl || ' delivered · no photo';
        b := coalesce(nullif(btrim(coalesce(p ->> 'deliveredNote', '')), ''), 'No reason given') || ' · ' || short;
      else
        t := lbl || ' delivered ' || ow_clock(p ->> 'deliveredAt');
        b := short || ' · photo kept';
      end if;
      perform ow_push(new.shop_id, 'order.delivered', t, b, taker, null, null, ref, 'delivered:' || new.id || ':sales');
    end if;

    -- Can't deliver: it comes back.
    if jsonb_typeof(p -> 'comingBack') = 'object' and (p -> 'comingBack' ->> 'at') is distinct from (o -> 'comingBack' ->> 'at') then
      t := lbl || ' coming back · ' || case p -> 'comingBack' ->> 'why'
             when 'closed' then short || ' closed' when 'nobody' then 'nobody there' when 'refused' then short || ' refused it'
             when 'wrong_place' then 'wrong place'
             else coalesce(left(nullif(btrim(coalesce(p -> 'comingBack' ->> 'why', '')), ''), 60), 'not delivered') end;
      b := short || ' — ' || coalesce(nullif(split_part(btrim(coalesce(p -> 'comingBack' ->> 'byName', '')), ' ', 1), ''), who) || ' brings it back to the gate.';
      perform ow_push(new.shop_id, 'order.back', t, b, null, 'order.assign', null, ref, 'back:' || new.id || ':' || (p -> 'comingBack' ->> 'at') || ':mgr');
      if taker is not null then
        perform ow_push(new.shop_id, 'order.back', t, b, taker, null, null, ref, 'back:' || new.id || ':' || (p -> 'comingBack' ->> 'at') || ':sales');
      end if;
    end if;

    -- A stage the yard holds, moved by someone outside the yard: the yard is told.
    if tg_op = 'UPDATE' and new.status is distinct from was and uid is not null and coalesce(me_role, '') not in ('store', 'staff')
       and (was in ('preparing', 'pending_delivery') or new.status = 'completed') then
      perform ow_push(new.shop_id, 'order.moved', who || ' marked ' || lbl || ' ' || lower(ow_stage_word(new.status)), short,
        null, 'order.pick', null, ref, 'moved:' || new.id || ':' || new.status || ':' || coalesce(p ->> 'stageEnteredAt', ''));
    end if;
  exception when others then
    raise notice 'push (yard, order %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists saved_quotes_ow_a_yard_push on saved_quotes;
create trigger saved_quotes_ow_a_yard_push after insert or update on saved_quotes
  for each row execute function saved_quotes_ow_a_yard_push();

-- ---------------------------------------------------------------------
-- 4. The Store's own "let it go on credit?" (0156's saved_quotes_ow_push_money), in the
-- yard's words: "Not paid yet", never "cash customer" (IM-35). The answer back is as before.
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
      perform ow_push(new.shop_id, 'credit.ask', 'Not paid yet · let it go on credit?',
        coalesce(nullif(split_part(btrim(coalesce(ask ->> 'byName', '')), ' ', 1), ''), 'The Store')
          || ' has ' || ow_short_name(client) || ' ' || ow_order_label(new.id) || ' packed · owes ' || ow_money(coalesce((h ->> 'owed')::numeric, 0))
          || '. On credit, or the money first?',
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

-- ---------------------------------------------------------------------
-- 5. Trips (0150's collection_trips_ow_push, its runner pushes unchanged): back at the
-- yard, checked in, a difference and its answer, a supplier's delivery checked in.
create or replace function collection_trips_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sup text;
  stops integer := 1;
  rnd text := ow_trip_round(new.id);
  ref jsonb := jsonb_build_object('table', 'collection_trips', 'id', new.id, 'round', ow_trip_round(new.id));
  lead text;
  runner uuid;
  was uuid;
  who text;
  trip_w text;
  nlines int;
  lines jsonb := case when jsonb_typeof(new.lines) = 'array' then new.lines else '[]'::jsonb end;
  diff jsonb;
  supplied boolean := new.assigned_worker_id = '__supplier__';
begin
  begin
    -- 0150: the runner a trip waits on is told, once per round; the runner it
    -- is taken from is told too, and so is the runner of a trip cancelled.
    if new.assigned_worker_id is not null and new.assigned_worker_id <> '__supplier__' then
      select s.user_id, s.name into runner, who from staff s where s.shop_id = new.shop_id and s.id = new.assigned_worker_id;
    end if;
    if tg_op = 'UPDATE' and old.assigned_worker_id is not null and old.assigned_worker_id <> '__supplier__' then
      select s.user_id into was from staff s where s.shop_id = new.shop_id and s.id = old.assigned_worker_id;
    end if;
    select s.name into sup from suppliers s where s.shop_id = new.shop_id and s.id = new.supplier_id;
    sup := coalesce(sup, 'the supplier');
    -- "Denis's trip", or "the trip" when nobody named rode it.
    trip_w := coalesce(nullif(split_part(btrim(coalesce(who, '')), ' ', 1), '') || '''s trip', 'the trip');
    if tg_op = 'UPDATE' and coalesce(new.voided, false) and not coalesce(old.voided, false)
       and coalesce(new.note, '') ilike 'cancelled%' and was is not null then
      perform ow_push(new.shop_id, 'trip.cancelled', 'A trip is cancelled', 'The trip to ' || sup || ' is off: its lines are back on To plan.',
        was, null, null, ref, 'tripcancel:' || new.id);
    end if;
  exception when others then
    raise notice 'push (trip %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  if coalesce(new.voided, false) then return null; end if;
  begin
    if runner is not null and new.status = 'assigned'
       and (tg_op = 'INSERT' or old.assigned_worker_id is distinct from new.assigned_worker_id) then
      perform ow_push(new.shop_id, 'trip.sent', case when tg_op = 'INSERT' then 'A trip for you' else 'A trip is yours now' end,
        case when rnd <> new.id then 'A round, starting at ' || sup || ': open it to set off.' else 'To ' || sup || ': open it to set off.' end,
        runner, null, null, ref, 'tripsent:' || rnd || ':' || new.assigned_worker_id);
    end if;
    if tg_op = 'UPDATE' and was is not null and old.assigned_worker_id is distinct from new.assigned_worker_id then
      perform ow_push(new.shop_id, 'trip.taken', 'A trip went to someone else', 'The trip to ' || sup || ' is ' || coalesce(who, 'someone else') || '''s now.',
        was, null, null, ref, 'triptaken:' || new.id || ':' || old.assigned_worker_id);
    end if;
    -- Back at the yard (IM-25, IM-26): "Denis's trip is back at the yard · 3 lines".
    if new.status = 'collected' and (tg_op = 'INSERT' or old.status is distinct from 'collected') then
      if rnd <> new.id then
        select count(*), coalesce(sum(case when jsonb_typeof(c.lines) = 'array' then jsonb_array_length(c.lines) else 0 end), 0)::int
          into stops, nlines from collection_trips c
         where c.shop_id = new.shop_id and not coalesce(c.voided, false) and ow_trip_round(c.id) = rnd;
      else
        nlines := jsonb_array_length(lines);
      end if;
      lead := 'From ' || sup || case when stops > 1 then ' +' || (stops - 1) || ' · one round of ' || stops || ' stops' else '' end;
      perform ow_push(new.shop_id, 'trip.back', case when trip_w = 'the trip' then 'A trip' else trip_w end || ' is back at the yard · '
          || nlines || case when nlines = 1 then ' line' else ' lines' end,
        lead || ': check it in.',
        null, 'stock.receive', null, ref, 'tripback:' || rnd || ':store');
      perform ow_push(new.shop_id, 'trip.cash', case when stops > 1 then 'A round is back — settle its cash' else 'A trip is back — settle its cash' end,
        lead || ': the change and the receipts.',
        null, 'trip.cash', null, ref, 'tripback:' || rnd || ':cash');
    end if;
    -- The yard's count unlike the Buyer's: "Musa's check-in of Denis's trip · 2 pc differ".
    select coalesce(jsonb_agg(jsonb_build_object('qty', abs(ow_num(l ->> 'yardQty') - coalesce(ow_num(l ->> 'gotQty'), 0)), 'unit', l -> 'unit')), '[]'::jsonb)
      into diff from jsonb_array_elements(lines) l
     where l ? 'yardQty' and ow_num(l ->> 'yardQty') is distinct from ow_num(l ->> 'gotQty');
    if new.yard_checked_at is not null and (tg_op = 'INSERT' or old.yard_checked_at is null) and jsonb_array_length(diff) > 0 then
      perform ow_push(new.shop_id, 'trip.difference',
        coalesce(ow_who(new.shop_id, new.yard_checked_by), 'The yard') || '''s check-in of ' || trip_w || ' · ' || ow_qty_words(diff, 'qty') || ' differ',
        'From ' || sup || ': decide what the shelf takes.',
        null, 'trip.difference', null, ref, 'tripdiff:' || new.id);
    end if;
    -- The Manager's answer, to whoever checked it in: "Ruth decided the 2 pc".
    if tg_op = 'UPDATE' and new.difference_accepted_at is not null and old.difference_accepted_at is null and new.yard_checked_by is not null then
      perform ow_push(new.shop_id, 'trip.difference.decided',
        coalesce(ow_who(new.shop_id, new.difference_accepted_by), 'The Manager') || ' decided the ' || ow_qty_words(diff, 'qty'),
        'From ' || sup || '.', new.yard_checked_by, null, null, ref, 'tripdiffdone:' || new.id);
    end if;
    -- Checked in: the Buyer ("Checked in · Denis's trip · 3 lines"); a supplier's own
    -- delivery: Sourcing, and Accounts for the delivery note ("Hima Cement · 100 bag came in").
    if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
      if supplied then
        perform ow_push(new.shop_id, 'delivery.checked', sup || ' · ' || ow_qty_words(lines, 'yardQty') || ' came in', 'Checked in at the yard.',
          null, 'supplier.edit', null, ref, 'delivered:' || new.id || ':sourcing');
        perform ow_push(new.shop_id, 'delivery.checked', sup || ' · ' || ow_qty_words(lines, 'yardQty') || ' came in', 'Checked in at the yard · the delivery note.',
          null, 'bill.record', null, ref, 'delivered:' || new.id || ':accounts');
      else
        perform ow_push(new.shop_id, 'trip.checked', 'Checked in · ' || trip_w || ' · ' || jsonb_array_length(lines)
            || case when jsonb_array_length(lines) = 1 then ' line' else ' lines' end,
          'From ' || sup || ' · ' || coalesce(ow_who(new.shop_id, new.yard_received_by), 'the yard') || ' checked it in.',
          null, 'trip.plan', null, ref, 'tripchecked:' || new.id);
      end if;
    end if;
  exception when others then
    raise notice 'push (trip %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 6. What the yard asks (0157's store_asks_ow_push, 0159's new item), in IB01's words.
create or replace function store_asks_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  who text := coalesce(nullif(split_part(btrim(coalesce(new.asked_by_name, '')), ' ', 1), ''), 'The Store');
  nm text := coalesce(nullif(btrim(coalesce(p ->> 'name', '')), ''), 'goods');
  what text := btrim(coalesce(p ->> 'qty', '') || ' ' || coalesce(p ->> 'unit', '') || ' ' || coalesce(p ->> 'name', 'goods'));
  ref jsonb := jsonb_build_object('table', 'store_asks', 'id', new.id);
  by_name text;
  t text;
begin
  begin
    if tg_op = 'INSERT' then
      if new.kind = 'restock' then
        perform ow_push(new.shop_id, 'store.restock',
          'We need more · ' || nm || coalesce(' · about ' || nullif(btrim(coalesce(p ->> 'qty', '') || ' ' || coalesce(p ->> 'unit', '')), ''), ''),
          who || ' asks'
            || case when jsonb_typeof(p -> 'shortFor') = 'array' and jsonb_array_length(p -> 'shortFor') > 0
                    then ' · ' || jsonb_array_length(p -> 'shortFor') || ' order' || case when jsonb_array_length(p -> 'shortFor') = 1 then '' else 's' end || ' short' else '' end
            || case when coalesce(p ->> 'when', '') = 'today' then ' · needed today' else '' end || '.',
          null, 'buy.restock', null, ref, 'storeask:' || new.id);
      elsif new.kind = 'extra' then
        perform ow_push(new.shop_id, 'store.extra', 'Not on the list · ' || nm || ' · keep it?',
          who || ' found ' || what || ' on the truck. Keep it, or send it back?',
          null, 'trip.difference', null, ref, 'storeask:' || new.id);
        if coalesce((p ->> 'newItem')::boolean, false) then
          perform ow_push(new.shop_id, 'store.new_item', 'A new item at the yard',
            who || ' checked in ' || what || ' · not on file yet. Add it to what we sell?',
            null, 'product.edit', null, ref, 'storeasknew:' || new.id);
        end if;
      elsif new.kind = 'handover' then
        perform ow_push(new.shop_id, 'store.handover', who || ' passed you the yard',
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
      by_name := coalesce(ow_who(new.shop_id, new.decided_by),
                          case new.kind when 'restock' then 'The Buyer' when 'extra' then 'The Manager' else 'Your colleague' end);
      t := case new.kind when 'handover' then case when new.status = 'accepted' then by_name || ' has it' else by_name || ' can''t take the yard' end
                         when 'restock' then case when new.status = 'accepted' then 'On the restock list · next trip' else 'Not buying more yet' end
                         else by_name || case when new.status = 'accepted' then ': keep it' else ': send it back' end end;
      perform ow_push(new.shop_id, 'store.ask.decided', t,
        case when new.kind = 'handover' then by_name || case new.status when 'accepted' then ' tapped "I''ve got it".' else ' said no.' end
             else what end || coalesce(' · ' || new.note, ''),
        new.asked_by, null, null, ref, 'storeaskdone:' || new.id || ':' || new.status);
      -- Goods not on the list: the Buyer hears what happens to them, and Accounts pays for what is kept.
      if new.kind = 'extra' then
        perform ow_push(new.shop_id, 'store.ask.decided', t, what || ' · on the truck from your trip' || coalesce(' · ' || new.note, ''),
          null, 'trip.plan', null, ref, 'storeaskdone:' || new.id || ':' || new.status || ':buyer');
        if new.status = 'accepted' then
          perform ow_push(new.shop_id, 'store.ask.decided', t, what || ' · kept for the shelf: pay the supplier for it',
            null, 'bill.record', null, ref, 'storeaskdone:' || new.id || ':accounts');
        end if;
      end if;
    end if;
  exception when others then
    raise notice 'push (store ask): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 7. A blind count: to the Manager only (the owner reads the log), and back to the counter.
create or replace function stock_counts_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ls jsonb := case when jsonb_typeof(new.lines) = 'array' then new.lines else '[]'::jsonb end;
  who text := coalesce(nullif(split_part(btrim(coalesce(new.counted_by_name, '')), ' ', 1), ''), 'The Store');
  ref jsonb := jsonb_build_object('table', 'stock_counts', 'id', new.id);
  what text;
  by_name text;
begin
  begin
    if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
      what := case when jsonb_array_length(ls) = 1
                   then coalesce(ls -> 0 ->> 'name', 'an item') || ' · ' || trim_scale(coalesce(ow_num(ls -> 0 ->> 'counted'), 0))::text
                          || coalesce(' ' || nullif(ls -> 0 ->> 'unit', ''), '')
                   else coalesce(nullif(btrim(coalesce(new.aisle, new.place, '')), ''), 'the shelf') || ' · ' || jsonb_array_length(ls) || ' items' end;
      perform ow_push(new.shop_id, 'stock.count.sent', who || '''s count of ' || what, 'Accept the count, or ask for it again.',
        null, 'stock.correct', null, ref, 'count:' || new.id);
    elsif tg_op = 'UPDATE' and old.status = 'sent' and new.status in ('accepted', 'recount') and new.counted_by is not null then
      by_name := coalesce(ow_who(new.shop_id, new.decided_by), 'The Manager');
      if new.status = 'accepted' then
        perform ow_push(new.shop_id, 'stock.count.decided', by_name || ' accepted your count',
          coalesce(nullif(btrim(coalesce(new.aisle, new.place, '')), ''), 'The shelf') || ' · the books now say what you counted.',
          new.counted_by, null, null, ref, 'countdone:' || new.id);
      else
        perform ow_push(new.shop_id, 'stock.recount', by_name || ' asked: count it again',
          coalesce(nullif(btrim(coalesce(new.aisle, new.place, '')), ''), 'The shelf') || '.',
          new.counted_by, null, null, ref, 'countdone:' || new.id);
      end if;
    end if;
  exception when others then
    raise notice 'push (count): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists stock_counts_ow_push on stock_counts;
create trigger stock_counts_ow_push after insert or update of status on stock_counts
  for each row execute function stock_counts_ow_push();

-- ---------------------------------------------------------------------
-- 8. Goods coming back. Named "ow_a_" so it runs before 0131's invoice_asks_ow_push2,
-- whose keys it takes first for a return the yard asked (the yard's words).
create or replace function invoice_asks_ow_a_yard_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  q saved_quotes%rowtype;
  lbl text := ow_order_label(new.quote_id);
  what text := ow_qty_words(new.lines, 'qty');
  yard_ask boolean := coalesce(new.asked_role, '') in ('store', 'staff');
  ref jsonb := jsonb_build_object('table', 'invoice_asks', 'id', new.id, 'quote', new.quote_id);
  taker uuid;
  t text;
begin
  if new.kind is distinct from 'credit' or jsonb_typeof(new.lines) is distinct from 'array' or jsonb_array_length(new.lines) = 0 then return null; end if;
  begin
    select * into q from saved_quotes where shop_id = new.shop_id and id = new.quote_id;
    taker := ow_uuid(q.payload ->> 'takenBy');
    if new.status = 'sent' and (tg_op = 'INSERT' or old.status is distinct from 'sent') then
      if yard_ask then
        -- The return at the gate, to the Manager: "#0548 · 2 bag damaged".
        perform ow_push(new.shop_id, 'invoice.ask',
          lbl || ' · ' || what || case when exists (select 1 from jsonb_array_elements(new.lines) e where e ->> 'condition' = 'damaged') then ' damaged' else ' back' end,
          'Good or Damaged per line · ' || coalesce(nullif(split_part(btrim(coalesce(new.asked_by_name, '')), ' ', 1), ''), 'the yard')
            || coalesce(' · ' || nullif(btrim(coalesce(new.reason, '')), ''), ''),
          null, 'credit_note.raise', null, ref, 'invask:' || new.id);
      else
        -- Sales asked: the yard looks out for it.
        perform ow_push(new.shop_id, 'return.coming', lbl || ' coming back · ' || what,
          ow_short_name(q.client_name) || coalesce(' · ' || nullif(btrim(coalesce(new.reason, '')), ''), ''),
          null, 'order.pick', null, ref, 'returncoming:' || new.id);
      end if;
    end if;
    if tg_op = 'UPDATE' and old.status = 'sent' and new.status in ('accepted', 'declined') then
      t := coalesce(ow_who(new.shop_id, new.decided_by), 'The Manager')
           || case when new.status = 'accepted' then ' took it back · ' else ' kept it as sold · ' end || what;
      if yard_ask then
        perform ow_push(new.shop_id, 'invoice.ask.decided', t, lbl || ' · ' || ow_short_name(q.client_name),
          new.asked_by, null, null, ref, 'invaskdone:' || new.id);
        if taker is not null then
          perform ow_push(new.shop_id, 'invoice.ask.decided', t, lbl || ' · ' || ow_short_name(q.client_name),
            taker, null, null, ref, 'invaskdone:' || new.id || ':sales');
        end if;
      else
        perform ow_push(new.shop_id, 'invoice.ask.decided', t, lbl || ' · ' || ow_short_name(q.client_name),
          null, 'order.pick', null, ref, 'invaskdone:' || new.id || ':yard');
      end if;
    end if;
  exception when others then
    raise notice 'push (return): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists invoice_asks_ow_a_yard_push on invoice_asks;
create trigger invoice_asks_ow_a_yard_push after insert or update on invoice_asks
  for each row execute function invoice_asks_ow_a_yard_push();
