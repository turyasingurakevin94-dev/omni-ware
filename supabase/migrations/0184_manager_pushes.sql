-- 0184 · Manager redesign: the Manager's pushes (docs/audit/manager/GOAL.md;
-- docs/audit/manager/handover.md §4, "Pushes that don't exist yet", "Changes
-- to pushes that exist", "Pushes that carry their evidence and their answer";
-- docs/spec/04-screens-manager-data.md §3). Every ask that waits on the
-- Manager pushes her with who asks, what, and the evidence; every answer is
-- told to the people it changes, by the Manager's own name (never "The
-- Manager" when the name is known); and a push may carry its one safe answer.
--
--   1. PUSH ACTIONS. push_outbox.actions [{id, label, v, ...}] is written
--      beside the title by one place, ow_push_actions (a BEFORE INSERT
--      trigger on push_outbox), for the rows addressed to the decision's task
--      only, and only the safe answers (handover §4): price.waits Approve /
--      Shop's price, credit.hold On credit (a customer with a limit),
--      pick.short Bill what went, trip.difference Take the check-in,
--      stock.report Kept on the shelf, invoice.ask Kept as sold / Kept as
--      billed, carton.ask Shelf part OK, store.extra Keep it,
--      stock.count.sent Count it again, order.cancel.ask Kept. Never a
--      write-off, credit note, void, refund, count taken, cancel, limit,
--      invoice or agent credit. `v` is the ask's state when the push was
--      written (ow_push_ask_state). push_subscriptions.app_build (int) lets
--      push-send send actions only to a shell that can draw them (N-1).
--      answer_from_push(p_outbox_id, p_action, p_key): the caller must be
--      one of the row's recipients and hold its task; the action must be on
--      the row; the ask must still be open and unchanged (else "Someone else
--      just did this", 40001 OWSTALE); once per key (the same key again
--      gives the first answer back); then the same write the app makes
--      (ow_patch_order for a price, creditCheck and pickSettle;
--      accept_trip_difference, dismiss_stock_report, decide_invoice_ask,
--      hold_restock_buy, answer_store_ask, ask_recount, answer_cancel_ask),
--      and its owner's-log line carries ref.via = 'push'.
--
--   2. NEW PUSHES.
--        order.cancelled        a cancelled order that was in Checking or Buying with a
--                               line from a supplier not received -> trip.plan (P-5):
--                               "Cancelled · stop buying"
--        invoice.voided         -> invoice.send and the salesperson unless they asked (P-6)
--        credit_note.raised     -> invoice.send and the salesperson unless they asked (P-7)
--        agent.change.decided   an agent's change or cancel answered, a line from a
--                               supplier on it -> trip.plan (P-8)
--        team.nudge             nudge_person(p_shop, p_to, p_order, p_words) (P-9;
--                               team.nudge, 0116): logged, pushed to that person
--        goal.set               a goal set -> the salesperson (P-10)
--        markup.wanted          an item listed by a login with product.edit and not
--                               markup.set -> markup.set (P-11)
--        promise.made           a promise taken by a login without credit.set ->
--                               credit.set (P-13)
--        trip.difference.decided  also to the trip's runner (P-4; 0183 sends it to the
--                               checker), both in the words "Ruth took Musa's check-in"
--      P-10 and P-13 are meant quiet (feed and badge, no sound): neither ow_push
--      nor push-send knows "quiet" (0130's counter "quiet" only drops a row), so
--      no flag is added here; they go as plain pushes until push-send can.
--      0183 already sends P-1 (stock.count.sent), P-2 (stock.count.decided,
--      stock.recount) and P-3 (pick.settled): not sent twice.
--
--   3. NEW WORDS (handover §3, §4): price.waits "{Grace} · Under the shop's price
--      · #0555" / "· Price coming ·" / "· Price up ·" / "At the counter";
--      price.decided only when the price moved, "{Ruth} set a new price";
--      credit.hold "{Grace} · On credit? · {client}" with the chip (Over the
--      limit · Old bill 38 d (held at 21) · No limit set); credit.ask "Not paid
--      yet · on credit?"; credit.ask.decided "Cash first · it stays";
--      pick.short "{Musa} · Packed short · #0550"; trip.difference "{Musa} ·
--      Check-in differs · {Denis}'s trip"; stock.report "{Musa} · Damaged · 3
--      Cement"; invoice.held "Can't bill itself · #0548", its body by code, no
--      database text; order.cancel.ask.decided "Cancelled" / "Kept" / "Billed
--      first · ask for a void"; restock.held/released "{Ruth}: not yet ·" /
--      "{Ruth}: go ahead ·" ("Shelf part OK ·" for a carton); carton.refused
--      "Order only · {item}". order.cancelled to the yard is 0183's
--      ("Cancelled · put it back"), already not "Called off". RETIRED:
--      order.delivered to invoice.make (it waits on nobody; the 24-hour run
--      bills it and invoice.held tells the ones it can't). 0183's
--      order.delivered to the salesperson stays.
--      0183's words are changed where 0183 sends them, by taking their dedupe
--      key first (triggers named "ow_a_" run first, as 0183 itself does), or
--      by a guarded replace of one literal (credit.ask, as 0167 and 0174 do).
--
-- Not here: P-12 credit.limit.ask (a new table, customer_asks, waits on Kevin:
-- docs/audit/manager/0184b-credit-ask.sql); the actions handover lists that
-- move a limit, an invoice, agent credit, or need the phone's markup rule
-- (D-2 Set, D-6/D-7 limits, D-9 Bill 567, D-22 Agree, D-33 Markup); the
-- notify-stock-count webhook (turn it off in Supabase when the new Manager app
-- ships: stock.count.sent replaces it).
--
-- No money, stock, role, task or decision right changes: every write an
-- action makes is the app's own, through the same guards (0165, 0175, 0122).
-- Every push is AFTER the write and never stops it.
--
-- Applied by hand, after 0183 (and 0120, 0131, 0136, 0151, 0153, 0157, 0158,
-- 0169, 0177, 0181). Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select tgname from pg_trigger where tgname in ('push_outbox_ow_actions', 'saved_quotes_ow_mgr_push',
--     'collection_trips_ow_a_mgr_push', 'manager_notes_ow_push', 'products_ow_markup_push', 'payment_promises_ow_push');
--   -- 6 rows
--   select position('order.delivered' in pg_get_functiondef('saved_quotes_ow_push()'::regprocedure)) = 0;   -- true
--   select column_name from information_schema.columns where (table_name, column_name) in
--     (('push_outbox', 'actions'), ('push_outbox', 'answered'), ('push_subscriptions', 'app_build'));   -- 3 rows
--
-- ROLLBACK:
--   drop trigger if exists push_outbox_ow_actions on push_outbox;
--   drop trigger if exists saved_quotes_ow_mgr_push on saved_quotes;
--   drop trigger if exists collection_trips_ow_a_mgr_push on collection_trips;
--   drop trigger if exists manager_notes_ow_push on manager_notes;
--   drop trigger if exists products_ow_markup_push on products;
--   drop trigger if exists payment_promises_ow_push on payment_promises;
--   drop function if exists answer_from_push(bigint, text, uuid);
--   drop function if exists nudge_person(uuid, uuid, bigint, text);
--   (the replaced functions: re-run saved_quotes_ow_push from 0120 then the
--   do-blocks of 0167 and 0174; saved_quotes_ow_price_up from 0153;
--   stock_reports_ow_push from 0129; restock_buys_ow_push from 0136;
--   ow_invoice_due_orders from 0169; cancel_asks_ow_push from 0181; 0183 for
--   its two credit.ask literals. The columns may stay; nothing else reads them.)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 0. Small words, one place each.

-- An order's lines, always an array.
create or replace function ow_items(p jsonb) returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(coalesce(p, '{}'::jsonb) -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end
$$;

-- A person as a push names them: their first name, else their role ("The manager", 0168), never "Someone".
create or replace function ow_name_of(p_shop uuid, p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(ow_who(p_shop, p_user),
    (select 'The ' || m.role from shop_members m where m.shop_id = p_shop and m.user_id = p_user limit 1), 'The shop')
$$;
revoke all on function ow_name_of(uuid, uuid) from public, anon, authenticated;

-- How many of a line went when it was packed short (manager.html pickShortfallLinesOf).
create or replace function ow_line_picked(e jsonb) returns numeric
language sql immutable as $$
  select case when e ->> 'pickStatus' = 'short'
              then least(greatest(0, coalesce(ow_num(e ->> 'qty'), 0)), greatest(0, coalesce(ow_num(e ->> 'pickedQty'), 0)))
              else greatest(0, coalesce(ow_num(e ->> 'qty'), 0)) end
$$;

-- The order as "Bill what went" leaves it: each short line at what went.
create or replace function ow_went_payload(p jsonb) returns jsonb
language sql immutable as $$
  select coalesce(p, '{}'::jsonb) || jsonb_build_object('items', coalesce((
    select jsonb_agg(case when jsonb_typeof(e) = 'object' and e ->> 'pickStatus' = 'short'
                          then e || jsonb_build_object('qty', ow_line_picked(e)) else e end order by k)
      from jsonb_array_elements(ow_items(p)) with ordinality x(e, k)), '[]'::jsonb))
$$;

-- A line's quantity as people say it: "36 sheet".
create or replace function ow_line_qty(e jsonb, p_qty numeric default null) returns text
language sql immutable as $$
  select trim_scale(coalesce(p_qty, ow_num(e ->> 'qty'), 0))::text || coalesce(' ' || nullif(btrim(coalesce(e ->> 'unit', '')), ''), '')
$$;

-- ---------------------------------------------------------------------
-- 1. Push actions: the safe answer a push may carry.
alter table push_outbox add column if not exists actions jsonb;
alter table push_outbox add column if not exists answered jsonb;
alter table push_subscriptions add column if not exists app_build int;

-- What the ask a push is about looks like now, or null once it is no longer open.
-- answer_from_push refuses when this has moved since the push was written.
create or replace function ow_push_ask_state(p_shop uuid, p_kind text, p_ref jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  tb text := coalesce(p_ref ->> 'table', '');
  rid text := p_ref ->> 'id';
  q saved_quotes%rowtype;
  presets jsonb;
  s text;
begin
  if rid is null then return null; end if;
  if tb = 'saved_quotes' and p_kind in ('price.waits', 'credit.hold', 'pick.short') then
    select * into q from saved_quotes where shop_id = p_shop and id::text = rid;
    if not found or coalesce(q.voided, false) or coalesce(q.invoiced, false) then return null; end if;
    if p_kind = 'price.waits' then
      presets := coalesce((select a.presets from app_settings a where a.shop_id = p_shop), '{}'::jsonb);
      select string_agg((x.k - 1)::text || ':' || coalesce(x.e ->> 'sellPrice', '') || ':' || coalesce(x.e ->> 'qty', '') || ':' || coalesce(x.e ->> 'price', ''), ';' order by x.k)
        into s from jsonb_array_elements(ow_items(q.payload)) with ordinality x(e, k)
       where ow_line_waits_price(p_shop, x.e, presets) or ow_line_under_cost(p_shop, x.e, presets);
    elsif p_kind = 'credit.hold' then
      if q.status <> 'draft' or ow_gate_reason(p_shop, q.payload, q.amount_paid) is distinct from 'credit' then return null; end if;
      s := coalesce(q.payload ->> 'customerId', '') || ':' || coalesce(q.payload -> 'creditCheck', 'null'::jsonb)::text || ':'
           || coalesce(q.amount_paid, 0)::text || ':' || round(ow_order_total(p_shop, q.payload, false))::text;
    else
      if not ow_pick_shortfall(q.payload) then return null; end if;
      select string_agg(coalesce(x.e ->> 'pickStatus', '') || ':' || coalesce(x.e ->> 'pickedQty', '') || ':' || coalesce(x.e ->> 'qty', ''), ';' order by x.k)
        into s from jsonb_array_elements(ow_items(q.payload)) with ordinality x(e, k);
    end if;
  elsif tb = 'collection_trips' and p_kind = 'trip.difference' then
    select md5(coalesce(t.lines, '[]'::jsonb)::text) into s from collection_trips t
     where t.shop_id = p_shop and t.id = rid and t.yard_checked_at is not null and t.difference_accepted_at is null and not coalesce(t.voided, false);
  elsif tb = 'stock_reports' and p_kind = 'stock.report' then
    select 'sent:' || r.qty into s from stock_reports r where r.shop_id = p_shop and r.id::text = rid and r.status = 'sent';
  elsif tb = 'invoice_asks' and p_kind = 'invoice.ask' then
    select 'sent:' || a.kind into s from invoice_asks a where a.shop_id = p_shop and a.id::text = rid and a.status = 'sent';
  elsif tb = 'restock_buys' and p_kind = 'carton.ask' then
    select 'held:' || r.qty into s from restock_buys r
     where r.shop_id = p_shop and r.id::text = rid and r.status = 'held' and r.held_by is null and coalesce(r.for_line, '') <> '';
  elsif tb = 'store_asks' and p_kind = 'store.extra' then
    select 'sent' into s from store_asks a where a.shop_id = p_shop and a.id::text = rid and a.status = 'sent';
  elsif tb = 'stock_counts' and p_kind = 'stock.count.sent' then
    select md5(coalesce(c.lines, '[]'::jsonb)::text) into s from stock_counts c where c.shop_id = p_shop and c.id::text = rid and c.status = 'sent';
  elsif tb = 'cancel_asks' and p_kind = 'order.cancel.ask' then
    select 'sent' into s from cancel_asks a where a.shop_id = p_shop and a.id::text = rid and a.status = 'sent';
  end if;
  return case when s is null then null else md5(p_kind || '|' || s) end;
end $$;
revoke all on function ow_push_ask_state(uuid, text, jsonb) from public, anon, authenticated;

-- The one place the safe answers are listed (handover §4). A push to anyone
-- but the decision's task carries none.
create or replace function ow_push_actions(p_shop uuid, p_kind text, p_task text, p_ref jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v text := ow_push_ask_state(p_shop, p_kind, p_ref);
  out jsonb;
  q saved_quotes%rowtype;
  c customers%rowtype;
  presets jsonb;
  it jsonb;
  k int;
  cost numeric;
  now_p numeric;
  shop_p numeric;
  a_kind text;
begin
  if v is null or p_task is null then return null; end if;
  if p_kind in ('price.waits', 'credit.hold', 'pick.short') then
    select * into q from saved_quotes where shop_id = p_shop and id::text = p_ref ->> 'id';
    presets := coalesce((select a.presets from app_settings a where a.shop_id = p_shop), '{}'::jsonb);
  end if;
  if p_kind = 'price.waits' and p_task = 'price.approve' then
    select x.e, (x.k - 1)::int into it, k from jsonb_array_elements(ow_items(q.payload)) with ordinality x(e, k)
     where ow_line_waits_price(p_shop, x.e, presets) or ow_line_under_cost(p_shop, x.e, presets) order by x.k limit 1;
    cost := ow_num(it ->> 'price');
    if ow_line_under_cost(p_shop, it, presets) then
      -- Price up: the shop's price is the safe one, when it is at or above the cost.
      shop_p := round(ow_line_sell_price(p_shop, it - 'sellPrice', presets));
      if shop_p > 0 and shop_p >= coalesce(cost, 0) then
        out := jsonb_build_array(jsonb_build_object('id', 'shop', 'label', 'Shop''s price ' || ow_money(shop_p), 'line', k, 'price', shop_p));
      end if;
    elsif coalesce(it ->> 'priceNote', '') = 'under' then
      now_p := round(case when coalesce(ow_num(it ->> 'sellPrice'), 0) > 0 then ow_num(it ->> 'sellPrice') else ow_line_sell_price(p_shop, it, presets) end);
      if now_p > 0 and (coalesce(cost, 0) <= 0 or now_p >= cost) then
        out := jsonb_build_array(jsonb_build_object('id', 'approve', 'label', 'Approve ' || ow_money(now_p), 'line', k, 'price', now_p));
      end if;
    end if;
  elsif p_kind = 'credit.hold' and p_task = 'credit.release' then
    select * into c from customers where shop_id = p_shop and id = q.payload ->> 'customerId';
    if coalesce(c.credit_limit, 0) > 0 then
      out := jsonb_build_array(jsonb_build_object('id', 'credit', 'label', 'On credit'));
    end if;
  elsif p_kind = 'pick.short' and p_task = 'pick.settle' then
    out := jsonb_build_array(jsonb_build_object('id', 'went', 'label',
      'Bill what went ' || ow_money(round(ow_order_total(p_shop, ow_went_payload(q.payload), false)))));
  elsif p_kind = 'trip.difference' and p_task = 'trip.difference' then
    out := jsonb_build_array(jsonb_build_object('id', 'take', 'label', 'Take the check-in'));
  elsif p_kind = 'stock.report' and p_task = 'stock.writeoff' then
    out := jsonb_build_array(jsonb_build_object('id', 'keep', 'label', 'Kept on the shelf'));
  elsif p_kind = 'invoice.ask' and p_task in ('invoice.void', 'credit_note.raise') then
    select a.kind into a_kind from invoice_asks a where a.shop_id = p_shop and a.id::text = p_ref ->> 'id';
    out := jsonb_build_array(jsonb_build_object('id', 'keep', 'label', case when a_kind = 'void' then 'Kept as billed' else 'Kept as sold' end));
  elsif p_kind = 'carton.ask' and p_task = 'restock.hold' then
    out := jsonb_build_array(jsonb_build_object('id', 'ok', 'label', 'Shelf part OK'));
  elsif p_kind = 'store.extra' and p_task = 'trip.difference' then
    out := jsonb_build_array(jsonb_build_object('id', 'keep', 'label', 'Keep it'));
  elsif p_kind = 'stock.count.sent' and p_task = 'stock.correct' then
    out := jsonb_build_array(jsonb_build_object('id', 'again', 'label', 'Count it again'));
  elsif p_kind = 'order.cancel.ask' and p_task = 'order.cancel' then
    out := jsonb_build_array(jsonb_build_object('id', 'kept', 'label', 'Kept'));
  end if;
  if out is null then return null; end if;
  return (select jsonb_agg(a || jsonb_build_object('v', v)) from jsonb_array_elements(out) a);
end $$;
revoke all on function ow_push_actions(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function push_outbox_ow_actions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    new.actions := ow_push_actions(new.shop_id, new.kind, new.to_task, new.ref);
  exception when others then
    raise notice 'push actions (%): % (%)', new.kind, sqlerrm, sqlstate;
    new.actions := null;
  end;
  return new;
end $$;
drop trigger if exists push_outbox_ow_actions on push_outbox;
create trigger push_outbox_ow_actions before insert on push_outbox
  for each row execute function push_outbox_ow_actions();

-- The answer from the notification itself.
create or replace function answer_from_push(p_outbox_id bigint, p_action text, p_key uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o push_outbox%rowtype;
  a jsonb;
  q saved_quotes%rowtype;
  c customers%rowtype;
  presets jsonb;
  it jsonb;
  items jsonb;
  k int;
  v_price numeric;
  now_p numeric;
  owe numeric;
  lines jsonb;
  res jsonb;
  me text;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  client text;
begin
  if uid is null then raise exception 'Sign in first.' using errcode = '42501'; end if;
  if p_key is null then raise exception 'An answer needs its key.' using errcode = '22023'; end if;
  select * into o from push_outbox where id = p_outbox_id for update;
  if not found then raise exception 'That push is gone.' using errcode = 'P0002'; end if;
  if not exists (select 1 from ow_push_recipients(o.id) r where r.user_id = uid) then
    raise exception 'This push is not yours to answer.' using errcode = '42501';
  end if;
  if o.answered is not null then
    if o.answered ->> 'key' = p_key::text then return coalesce(o.answered -> 'result', '{}'::jsonb) || jsonb_build_object('already', true); end if;
    raise exception 'Someone else just did this.' using errcode = '40001', hint = 'OWSTALE';
  end if;
  select e into a from jsonb_array_elements(coalesce(o.actions, '[]'::jsonb)) e where e ->> 'id' = p_action limit 1;
  if a is null then raise exception 'That answer is not on this push.' using errcode = '22023'; end if;
  if o.to_task is null or not has_task(o.shop_id, o.to_task) then
    raise exception 'That answer is not yours to give (%).', coalesce(o.to_task, 'no task') using errcode = '42501';
  end if;
  if ow_push_ask_state(o.shop_id, o.kind, o.ref) is distinct from (a ->> 'v') then
    raise exception 'Someone else just did this.' using errcode = '40001', hint = 'OWSTALE';
  end if;
  me := ow_member_name(o.shop_id, uid);

  if o.kind in ('price.waits', 'credit.hold', 'pick.short') then
    select * into q from saved_quotes where shop_id = o.shop_id and id::text = o.ref ->> 'id' for update;
    client := coalesce(nullif(btrim(coalesce(q.client_name, '')), ''), 'an order');
    presets := coalesce((select s.presets from app_settings s where s.shop_id = o.shop_id), '{}'::jsonb);
  end if;

  if o.kind = 'price.waits' and p_action in ('approve', 'shop') then
    -- decidePrice (manager.html): the line's priceReview, and for the shop's price its sellPrice.
    k := (a ->> 'line')::int;
    it := ow_items(q.payload) -> k;
    v_price := ow_num(a ->> 'price');
    now_p := round(case when coalesce(ow_num(it ->> 'sellPrice'), 0) > 0 then ow_num(it ->> 'sellPrice') else ow_line_sell_price(o.shop_id, it, presets) end);
    if coalesce(ow_num(it ->> 'price'), 0) > 0 and v_price < ow_num(it ->> 'price') then
      raise exception 'Someone else just did this.' using errcode = '40001', hint = 'OWSTALE';
    end if;
    if p_action = 'shop' then it := it || jsonb_build_object('sellPrice', v_price); end if;
    it := it || jsonb_build_object('priceReview', jsonb_build_object('state', case when p_action = 'approve' then 'approved' else 'changed' end,
      'price', v_price, 'was', now_p, 'qty', ow_num(it ->> 'qty'), 'by', uid, 'byName', me, 'at', now_iso));
    items := jsonb_set(ow_items(q.payload), array[k::text], it);
    perform ow_patch_order(o.shop_id, q.id, jsonb_build_object('items', items));
    perform manager_log_decision(o.shop_id, 'price.approve',
      case when p_action = 'approve' then 'Approved ' else 'Set ' end || coalesce(it ->> 'productName', 'a line') || ' at ' || ow_money(v_price) || ' for ' || client,
      v_price * coalesce(ow_num(it ->> 'qty'), 0), jsonb_build_object('table', 'saved_quotes', 'id', q.id, 'line', k),
      jsonb_build_object('price', now_p), jsonb_build_object('price', v_price, 'state', it -> 'priceReview' ->> 'state'));
    res := jsonb_build_object('ok', true, 'orderId', q.id, 'line', k, 'price', v_price);
  elsif o.kind = 'credit.hold' and p_action = 'credit' then
    -- ACT.hdecide (manager.html): creditCheck, release.
    select * into c from customers where shop_id = o.shop_id and id = q.payload ->> 'customerId';
    owe := coalesce(c.debt, 0) + greatest(0, round(ow_order_total(o.shop_id, q.payload, true)) - coalesce(q.amount_paid, 0));
    perform ow_patch_order(o.shop_id, q.id, jsonb_build_object('creditCheck', jsonb_build_object('decision', 'release', 'by', uid, 'byName', me,
      'at', floor(extract(epoch from clock_timestamp()) * 1000), 'over', greatest(0, owe - coalesce(c.credit_limit, 0)),
      'ageDays', case when coalesce(c.debt, 0) > 0 then ow_oldest_debt_days(o.shop_id, c.id) end, 'limit', c.credit_limit, 'withIt', owe)));
    perform manager_log_decision(o.shop_id, 'credit.release', 'Let ' || client || ' go on credit: would owe ' || ow_money(owe),
      owe, jsonb_build_object('table', 'saved_quotes', 'id', q.id), q.payload -> 'creditCheck', jsonb_build_object('decision', 'release'));
    res := jsonb_build_object('ok', true, 'orderId', q.id, 'decision', 'release');
  elsif o.kind = 'pick.short' and p_action = 'went' then
    -- ACT.spgo (manager.html): each short line at what went, and pickSettle.
    select coalesce(jsonb_agg(jsonb_build_object('idx', x.k - 1, 'ordered', ow_num(x.e ->> 'qty'), 'picked', ow_line_picked(x.e)) order by x.k), '[]'::jsonb)
      into lines from jsonb_array_elements(ow_items(q.payload)) with ordinality x(e, k)
     where x.e ->> 'pickStatus' = 'short' and ow_line_picked(x.e) < coalesce(ow_num(x.e ->> 'qty'), 0);
    perform ow_patch_order(o.shop_id, q.id, jsonb_build_object('items', ow_items(ow_went_payload(q.payload)),
      'pickSettle', jsonb_build_object('pick', 'went', 'by', uid, 'byName', me, 'at', now_iso, 'lines', lines)));
    perform manager_log_decision(o.shop_id, 'pick.settle', 'Billed what went on ' || client,
      round(ow_order_total(o.shop_id, ow_went_payload(q.payload), false)), jsonb_build_object('table', 'saved_quotes', 'id', q.id),
      lines, jsonb_build_object('pick', 'went'));
    res := jsonb_build_object('ok', true, 'orderId', q.id, 'pick', 'went');
  elsif o.kind = 'trip.difference' and p_action = 'take' then
    res := accept_trip_difference(o.ref ->> 'id');
  elsif o.kind = 'stock.report' and p_action = 'keep' then
    res := dismiss_stock_report((o.ref ->> 'id')::uuid);
  elsif o.kind = 'invoice.ask' and p_action = 'keep' then
    res := decide_invoice_ask((o.ref ->> 'id')::uuid, 'declined');
  elsif o.kind = 'carton.ask' and p_action = 'ok' then
    res := hold_restock_buy((o.ref ->> 'id')::uuid, false);
  elsif o.kind = 'store.extra' and p_action = 'keep' then
    res := answer_store_ask((o.ref ->> 'id')::uuid, 'accepted', null);
  elsif o.kind = 'stock.count.sent' and p_action = 'again' then
    perform ask_recount((o.ref ->> 'id')::uuid);
    perform manager_log_decision(o.shop_id, 'stock.correct', 'Asked for the count again', null,
      jsonb_build_object('table', 'stock_counts', 'id', o.ref ->> 'id'), jsonb_build_object('status', 'sent'), jsonb_build_object('status', 'recount'));
    res := jsonb_build_object('ok', true, 'id', o.ref ->> 'id', 'status', 'recount');
  elsif o.kind = 'order.cancel.ask' and p_action = 'kept' then
    res := answer_cancel_ask((o.ref ->> 'id')::uuid, false, null);
  else
    raise exception 'That answer is not on this push.' using errcode = '22023';
  end if;
  if coalesce((res ->> 'already')::boolean, false) then
    raise exception 'Someone else just did this.' using errcode = '40001', hint = 'OWSTALE';
  end if;

  -- The owner's log: the line this answer wrote says it came from the push.
  update decision_log set ref = coalesce(ref, '{}'::jsonb) || jsonb_build_object('via', 'push', 'outbox', o.id)
   where shop_id = o.shop_id and "by" = uid and "at" = now() and jsonb_typeof(coalesce(ref, '{}'::jsonb)) = 'object' and (ref ->> 'via') is null;
  res := coalesce(res, '{}'::jsonb) || jsonb_build_object('action', p_action, 'label', a ->> 'label');
  update push_outbox set answered = jsonb_build_object('key', p_key, 'action', p_action, 'by', uid, 'at', now(), 'result', res) where id = o.id;
  return res;
end $$;
revoke all on function answer_from_push(bigint, text, uuid) from public, anon;
grant execute on function answer_from_push(bigint, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Orders (0120's saved_quotes_ow_push, with 0167's "no limit set" and 0174's
-- ow_oldest_debt_days, written out whole in the new words; order.delivered retired).
create or replace function saved_quotes_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := case when tg_op = 'UPDATE' then coalesce(old.payload, '{}'::jsonb) else '{}'::jsonb end;
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'an order');
  lbl text := ow_order_label(new.id);
  taker uuid := ow_uuid(p ->> 'takenBy');
  asker text;
  ref jsonb := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  presets jsonb;
  n_why text;
  o_why text;
  terms text;
  line jsonb;
  k int;
  n int;
  c customers;
  counter boolean := coalesce(p ->> 'counter', '') = 'true' or coalesce(p ->> 'counterSale', '') = 'true';
  cost numeric;
  now_p numeric;
  shop_p numeric;
  owe numeric;
  age int;
  hold int;
  t text;
  b text;
  i int;
  it jsonb;
  was jsonb;
  r jsonb;
  olds jsonb;
begin
  if coalesce(new.voided, false) then return null; end if;
  begin
    presets := coalesce((select a.presets from app_settings a where a.shop_id = new.shop_id), '{}'::jsonb);
    terms := ow_gate_terms(p);
    asker := coalesce(ow_who(new.shop_id, taker), 'Sales');
    if new.status = 'draft' and not new.invoiced then
      n_why := ow_gate_reason(new.shop_id, p, new.amount_paid);
    end if;
    if tg_op = 'UPDATE' and old.status = 'draft' and not old.invoiced and not coalesce(old.voided, false) then
      o_why := ow_gate_reason(old.shop_id, o, old.amount_paid);
    end if;

    -- A price that waits: under the shop's price, price coming, or at the counter.
    if n_why = 'price' then
      select x.e, (x.k - 1)::int into line, k from jsonb_array_elements(ow_items(p)) with ordinality x(e, k)
       where ow_line_waits_price(new.shop_id, x.e, presets) order by x.k limit 1;
      cost := ow_num(line ->> 'price');
      now_p := round(case when coalesce(ow_num(line ->> 'sellPrice'), 0) > 0 then ow_num(line ->> 'sellPrice') else ow_line_sell_price(new.shop_id, line, presets) end);
      shop_p := case when coalesce(cost, 0) > 0 then round(ow_line_sell_price(new.shop_id, line - 'sellPrice', presets)) end;
      if counter or coalesce(line ->> 'priceNote', '') = 'under' then
        t := asker || case when counter then ' · At the counter · under the shop''s price' else ' · Under the shop''s price · ' || lbl end;
        b := coalesce(line ->> 'productName', 'A line') || ' · ' || ow_line_qty(line) || ' at ' || ow_money(now_p)
          || case when shop_p > now_p then ', shop''s ' || ow_money(shop_p) else '' end
          || case when cost > 0 then ' · cost ' || ow_money(cost) else '' end;
      else
        t := asker || ' · Price coming · ' || lbl;
        b := client || ' — ' || coalesce(line ->> 'productName', 'a line') || ' · ' || ow_line_qty(line)
          || case when cost > 0 then ' · cost ' || ow_money(cost) else ' · no cost yet' end;
      end if;
      perform ow_push(new.shop_id, 'price.waits', t, b, null, 'price.approve', null, ref || jsonb_build_object('line', k), 'price:' || new.id || ':' || terms);
    end if;

    -- On credit? (0167's no limit set, 0174's owed past the hold days, as a chip).
    if n_why = 'credit' then
      select * into c from customers where shop_id = new.shop_id and id = p ->> 'customerId';
      owe := coalesce(c.debt, 0) + greatest(0, round(ow_order_total(new.shop_id, p, true)) - coalesce(new.amount_paid, 0));
      hold := ow_hold_days(presets);
      age := case when coalesce(c.debt, 0) > 0 then ow_oldest_debt_days(new.shop_id, c.id) end;
      b := concat_ws(' · ',
        case when coalesce(c.credit_limit, 0) <= 0 then 'No limit set' when owe > c.credit_limit then 'Over the limit' end,
        case when age > hold then 'Old bill ' || age || ' d (held at ' || hold || ')' end,
        'would owe ' || ow_money(owe) || case when coalesce(c.credit_limit, 0) > 0 then ' of ' || ow_money(c.credit_limit) else '' end);
      perform ow_push(new.shop_id, 'credit.hold', asker || ' · On credit? · ' || client, b,
        null, 'credit.release', null, ref, 'credit:' || new.id || ':' || terms);
    end if;

    -- The price decided: the salesperson tells the customer only when it moved.
    if o_why = 'price' and n_why is distinct from 'price' and taker is not null then
      olds := ow_items(o);
      for i in 0 .. jsonb_array_length(ow_items(p)) - 1 loop
        it := ow_items(p) -> i;
        r := it -> 'priceReview';
        was := null;
        if coalesce(it ->> 'lineId', '') <> '' then
          select e into was from jsonb_array_elements(olds) e where e ->> 'lineId' = it ->> 'lineId' limit 1;
        elsif i < jsonb_array_length(olds) then
          was := olds -> i;
        end if;
        if jsonb_typeof(r) = 'object' and r ->> 'state' = 'changed' and (was -> 'priceReview') is distinct from r
           and ow_num(r ->> 'price') is distinct from ow_num(r ->> 'was') then
          perform ow_push(new.shop_id, 'price.decided',
            coalesce(nullif(split_part(btrim(coalesce(r ->> 'byName', '')), ' ', 1), ''), ow_name_of(new.shop_id, auth.uid())) || ' set a new price',
            client || ' — ' || coalesce(it ->> 'productName', 'an item') || ' is now ' || ow_money(ow_num(r ->> 'price')) || ' each. Tell them.',
            taker, null, null, ref, 'upset:' || new.id || ':' || coalesce(it ->> 'lineId', i::text) || ':' || coalesce(r ->> 'at', ''));
        end if;
      end loop;
    end if;

    -- Packed short: "Musa · Packed short · #0550".
    if ow_pick_shortfall(p) and (tg_op = 'INSERT' or not ow_pick_shortfall(o)) then
      select x.e, count(*) over () into line, n from jsonb_array_elements(ow_items(p)) x(e)
       where x.e ->> 'pickStatus' = 'short' and ow_line_picked(x.e) < coalesce(ow_num(x.e ->> 'qty'), 0) limit 1;
      t := coalesce((select nullif(split_part(btrim(coalesce(s.name, '')), ' ', 1), '') from staff s where s.shop_id = new.shop_id and s.id = p ->> 'assignedWorkerId'),
                    ow_name_of(new.shop_id, auth.uid())) || ' · Packed short · ' || lbl;
      b := coalesce(line ->> 'productName', 'A line') || ' ' || trim_scale(ow_line_picked(line))::text || ' of ' || ow_line_qty(line)
        || ' · bill ' || ow_money(round(ow_order_total(new.shop_id, ow_went_payload(p), false)))
        || ' (full ' || ow_money(round(ow_order_total(new.shop_id, p, false))) || ')'
        || case when n > 1 then ' · +' || (n - 1) || ' more' else '' end;
      perform ow_push(new.shop_id, 'pick.short', t, b, null, 'pick.settle', null, ref, 'short:' || new.id || ':' || md5(coalesce(p -> 'items', '[]'::jsonb)::text));
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
    -- (Delivered pushed the Manager here until 0184: it waits on nobody.)
  exception when others then
    raise notice 'push (order %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;

-- A supplier's price up past the sale (0153), in the new words.
create or replace function saved_quotes_ow_price_up() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := case when tg_op = 'UPDATE' then coalesce(old.payload, '{}'::jsonb) else '{}'::jsonb end;
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'an order');
  taker uuid := ow_uuid(p ->> 'takenBy');
  ref jsonb := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  presets jsonb;
  items jsonb := ow_items(p);
  olds jsonb := ow_items(o);
  it jsonb;
  was jsonb;
  i integer;
  first_line jsonb;
  first_k integer;
  waiting text := '';
  r jsonb;
begin
  if coalesce(new.voided, false) or coalesce(new.invoiced, false) or new.status = 'completed' then return null; end if;
  begin
    presets := coalesce((select a.presets from app_settings a where a.shop_id = new.shop_id), '{}'::jsonb);
    for i in 0 .. jsonb_array_length(items) - 1 loop
      it := items -> i;
      was := null;
      if coalesce(it ->> 'lineId', '') <> '' then
        select e into was from jsonb_array_elements(olds) e where e ->> 'lineId' = it ->> 'lineId' limit 1;
      elsif i < jsonb_array_length(olds) then
        was := olds -> i;
      end if;
      if ow_line_under_cost(new.shop_id, it, presets) then
        if first_line is null then first_line := it; first_k := i; end if;
        waiting := waiting || coalesce(it ->> 'lineId', i::text) || '@' || coalesce(it ->> 'price', '') || ';';
      elsif was is not null and ow_line_under_cost(new.shop_id, was, presets) and taker is not null then
        r := it -> 'priceReview';
        if jsonb_typeof(r) = 'object' and (r ->> 'state') = 'changed' and (was -> 'priceReview') is distinct from r then
          perform ow_push(new.shop_id, 'price.decided',
            coalesce(nullif(split_part(btrim(coalesce(r ->> 'byName', '')), ' ', 1), ''), ow_name_of(new.shop_id, auth.uid())) || ' set a new price',
            client || ' — ' || coalesce(it ->> 'productName', 'an item') || ' is now ' || ow_money(ow_num(r ->> 'price')) || ' each. Tell them.',
            taker, null, null, ref, 'upset:' || new.id || ':' || coalesce(it ->> 'lineId', i::text) || ':' || coalesce(r ->> 'at', ''));
        end if;
      end if;
    end loop;
    if waiting <> '' then
      perform ow_push(new.shop_id, 'price.waits', coalesce(ow_who(new.shop_id, taker), 'Sales') || ' · Price up · ' || ow_order_label(new.id),
        coalesce(first_line ->> 'productName', 'A line') || ' now costs ' || ow_money(ow_num(first_line ->> 'price')) || ' · sells at '
          || ow_money(round(case when coalesce(ow_num(first_line ->> 'sellPrice'), 0) > 0 then ow_num(first_line ->> 'sellPrice')
                                 else ow_line_sell_price(new.shop_id, first_line, presets) end)),
        null, 'price.approve', null, ref || jsonb_build_object('line', first_k), 'under:' || new.id || ':' || md5(waiting));
    end if;
  exception when others then
    raise notice 'push (price up): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

-- The Manager's answers on an order, told to the ones they change (P-5 … P-8).
create or replace function saved_quotes_ow_mgr_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p jsonb := coalesce(new.payload, '{}'::jsonb);
  o jsonb := coalesce(old.payload, '{}'::jsonb);
  lbl text := ow_order_label(new.id);
  client text := coalesce(nullif(btrim(coalesce(new.client_name, '')), ''), nullif(btrim(coalesce(p -> 'client' ->> 'name', '')), ''), 'An order');
  taker uuid := ow_uuid(p ->> 'takenBy');
  ref jsonb := jsonb_build_object('table', 'saved_quotes', 'id', new.id);
  who text;
  asker uuid;
  cn jsonb;
  l jsonb;
  amt numeric;
  n int;
  dec text;
  nm text;
  b text;
  bought boolean;
begin
  begin
    who := ow_name_of(new.shop_id, auth.uid());
    bought := exists (select 1 from jsonb_array_elements(ow_items(o) || ow_items(p)) e
                       where jsonb_typeof(e) = 'object' and coalesce(e ->> 'supplierId', '') not in ('', '__stock__'));

    -- P-5: cancelled while the Buyer may still be buying for it.
    if new.status = 'cancelled' and old.status is distinct from 'cancelled' and old.status in ('draft', 'awaiting_goods')
       and exists (select 1 from jsonb_array_elements(ow_items(o)) e
                    where jsonb_typeof(e) = 'object' and coalesce(e ->> 'supplierId', '') not in ('', '__stock__') and not ow_line_received(e)) then
      perform ow_push(new.shop_id, 'order.cancelled', 'Cancelled · stop buying',
        lbl || ' · ' || client || ' — ' || coalesce(nullif(split_part(btrim(coalesce(p ->> 'cancelledByName', '')), ' ', 1), ''), who)
          || ' cancelled it. Off To ask and the trip.',
        null, 'trip.plan', null, ref, 'cancel:' || new.id || ':buyer');
    end if;

    -- P-6: an invoice voided, to Accounts and the salesperson (unless they asked; the asker hears invoice.ask.decided).
    if coalesce(new.voided, false) and not coalesce(old.voided, false) and coalesce(old.invoiced, false) then
      select a.asked_by into asker from invoice_asks a
       where a.shop_id = new.shop_id and a.quote_id = new.id and a.kind = 'void' and a.status in ('sent', 'accepted') order by a.created_at desc limit 1;
      amt := coalesce(ow_num(p -> 'voidMoney' ->> 'amount'), 0);
      b := client || ' · ' || ow_money(round(ow_order_total(new.shop_id, p, false))) || ' — '
        || coalesce(nullif(split_part(btrim(coalesce(p -> 'voidedBy' ->> 'byName', '')), ' ', 1), ''), who)
        || coalesce(': ' || lower(nullif(btrim(coalesce(p -> 'voidedBy' ->> 'why', p ->> 'voidWhy', '')), '')), '') || '.'
        || case when amt > 0 and p -> 'voidMoney' ->> 'choice' = 'refund' then ' · refund ' || ow_money(amt) || ' ' || coalesce(nullif(p -> 'voidMoney' ->> 'account', ''), 'cash')
                when amt > 0 and p -> 'voidMoney' ->> 'choice' = 'deposit' then ' · ' || ow_money(amt) || ' kept as a deposit' else '' end;
      perform ow_push(new.shop_id, 'invoice.voided', 'Voided · ' || lbl, b, null, 'invoice.send', null, ref, 'voided:' || new.id || ':accounts');
      if taker is not null and taker is distinct from asker then
        perform ow_push(new.shop_id, 'invoice.voided', 'Voided · ' || lbl, b, taker, null, null, ref, 'voided:' || new.id || ':sales');
      end if;
    end if;

    -- P-7: a credit note raised.
    n := case when jsonb_typeof(p -> 'creditNotes') = 'array' then jsonb_array_length(p -> 'creditNotes') else 0 end;
    if n > coalesce(jsonb_array_length(case when jsonb_typeof(o -> 'creditNotes') = 'array' then o -> 'creditNotes' end), 0) then
      cn := p -> 'creditNotes' -> (n - 1);
      l := case when jsonb_typeof(cn -> 'lines') = 'array' then cn -> 'lines' -> 0 end;
      nm := coalesce(l ->> 'name', case when l ->> 'idx' ~ '^\d+$' then ow_items(p) -> (l ->> 'idx')::int ->> 'productName' end, 'goods');
      amt := coalesce(ow_num(cn ->> 'amount'), (select sum(coalesce(ow_num(e ->> 'qty'), 0) * coalesce(ow_num(e ->> 'price'), 0))
                                                  from jsonb_array_elements(case when jsonb_typeof(cn -> 'lines') = 'array' then cn -> 'lines' else '[]'::jsonb end) e), 0);
      select a.asked_by into asker from invoice_asks a
       where a.shop_id = new.shop_id and a.quote_id = new.id and a.kind = 'credit' and a.status in ('sent', 'accepted') order by a.created_at desc limit 1;
      b := client || ' — ' || trim_scale(coalesce(ow_num(l ->> 'qty'), 0))::text || ' ' || nm
        || case when jsonb_array_length(coalesce(cn -> 'lines', '[]'::jsonb)) > 1 then ' +' || (jsonb_array_length(cn -> 'lines') - 1) || ' more' else '' end
        || ' back · ' || ow_money(amt) || case when jsonb_typeof(cn -> 'refund') = 'object' then ' to pay back.' else ' off what they owe.' end;
      perform ow_push(new.shop_id, 'credit_note.raised', 'Credit note raised · ' || lbl, b, null, 'invoice.send', null,
        ref || jsonb_build_object('creditNote', cn -> 'no'), 'cn:' || new.id || ':' || n || ':accounts');
      if taker is not null and taker is distinct from asker then
        perform ow_push(new.shop_id, 'credit_note.raised', 'Credit note raised · ' || lbl, b, taker, null, null,
          ref || jsonb_build_object('creditNote', cn -> 'no'), 'cn:' || new.id || ':' || n || ':sales');
      end if;
    end if;

    -- P-8: an agent's change or cancel answered, to the Buyer when something is bought for it.
    if (o -> 'agentChange' ->> 'state') = 'asked' and (p -> 'agentChange' ->> 'state') in ('agreed', 'declined') then
      dec := p -> 'agentChange' ->> 'state';
    elsif jsonb_typeof(p -> 'agentCancel') = 'object' and coalesce(p -> 'agentCancel' ->> 'agreed', '') = 'true' and coalesce(o -> 'agentCancel' ->> 'agreed', '') <> 'true' then
      dec := 'cancelled';
    elsif jsonb_typeof(p -> 'agentCancel') = 'object' and coalesce(p -> 'agentCancel' ->> 'declined', '') = 'true' and coalesce(o -> 'agentCancel' ->> 'declined', '') <> 'true' then
      dec := 'kept';
    end if;
    if dec is not null and bought then
      select count(*) into n from jsonb_array_elements(case when jsonb_typeof(p -> 'agentChange' -> 'lines') = 'array' then p -> 'agentChange' -> 'lines' else '[]'::jsonb end) e
       where e ->> 'decision' = 'agreed';
      perform ow_push(new.shop_id, 'agent.change.decided',
        who || ' answered ' || coalesce(nullif(split_part(btrim(coalesce(p ->> 'originAgentName', '')), ' ', 1), ''), 'the agent'),
        lbl || ' · ' || client || ' — ' || case
          when dec = 'agreed' and n > 0 then n || case when n = 1 then ' line' else ' lines' end || ' changed. Buy only what is left.'
          when dec = 'cancelled' then 'cancelled. Buy none of it.'
          else 'kept as it is.' end,
        null, 'trip.plan', null, ref,
        'agentdone:' || new.id || ':' || dec || ':' || coalesce(p -> 'agentChange' ->> 'decidedAt', p -> 'agentCancel' ->> 'decidedAt', ''));
    end if;
  exception when others then
    raise notice 'push (manager answer, order %): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists saved_quotes_ow_mgr_push on saved_quotes;
create trigger saved_quotes_ow_mgr_push after update on saved_quotes
  for each row execute function saved_quotes_ow_mgr_push();

-- The Store's "on credit?" and its answer (0183's two literals; 0167 and 0174 changed 0120's this way).
do $mig$
declare
  f text;
  src text;
begin
  foreach f in array array['public.saved_quotes_ow_a_yard_push()', 'public.saved_quotes_ow_push_money()'] loop
    src := replace(pg_get_functiondef(f::regprocedure), chr(13), '');
    if position('Not paid yet · on credit?' in src) > 0 then continue; end if;
    if position('Not paid yet · let it go on credit?' in src) = 0 then
      raise exception '0184: % is not the shape 0183 left; not changed.', f;
    end if;
    src := replace(src, 'Not paid yet · let it go on credit?', 'Not paid yet · on credit?');
    src := replace(src, '''Cash first · keep it''', '''Cash first · it stays''');
    execute src;
  end loop;
end $mig$;

-- ---------------------------------------------------------------------
-- 3. Trips: the check-in that differs and its answer, to the checker and the runner.
-- Named "ow_a_" so it runs before 0183's collection_trips_ow_push and takes its keys.
create or replace function collection_trips_ow_a_mgr_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lines jsonb := case when jsonb_typeof(new.lines) = 'array' then new.lines else '[]'::jsonb end;
  ref jsonb := jsonb_build_object('table', 'collection_trips', 'id', new.id, 'round', ow_trip_round(new.id));
  sup text;
  runner uuid;
  runner_name text;
  trip_w text;
  checker text;
  l jsonb;
  n int;
  val numeric;
  cl text;
  t text;
  b text;
  got text;
begin
  if coalesce(new.voided, false) then return null; end if;
  begin
    select s.name into sup from suppliers s where s.shop_id = new.shop_id and s.id = new.supplier_id;
    sup := coalesce(sup, 'the supplier');
    if new.assigned_worker_id is not null and new.assigned_worker_id <> '__supplier__' then
      select s.user_id, s.name into runner, runner_name from staff s where s.shop_id = new.shop_id and s.id = new.assigned_worker_id;
    end if;
    trip_w := coalesce(nullif(split_part(btrim(coalesce(runner_name, '')), ' ', 1), '') || '''s trip', 'the trip');
    checker := coalesce(ow_who(new.shop_id, new.yard_checked_by), 'The yard');
    select x.l, count(*) over (),
           sum((ow_num(x.l ->> 'yardQty') - coalesce(ow_num(x.l ->> 'gotQty'), ow_num(x.l ->> 'qty'), 0))
               * coalesce(ow_num(x.l ->> 'gotPrice'), ow_num(x.l ->> 'expectedPrice'), 0)) over ()
      into l, n, val
      from jsonb_array_elements(lines) x(l)
     where x.l ? 'yardQty' and ow_num(x.l ->> 'yardQty') is distinct from coalesce(ow_num(x.l ->> 'gotQty'), ow_num(x.l ->> 'qty'), 0)
     limit 1;
    if coalesce(n, 0) = 0 then return null; end if;
    got := trim_scale(coalesce(ow_num(l ->> 'gotQty'), ow_num(l ->> 'qty'), 0))::text;
    cl := case when l ->> 'orderId' ~ '^\d+$' then (select ow_short_name(q.client_name) from saved_quotes q where q.shop_id = new.shop_id and q.id = (l ->> 'orderId')::bigint)
               when l ->> 'orderId' = 'restock' then 'For the shelf' end;
    if new.yard_checked_at is not null and (tg_op = 'INSERT' or old.yard_checked_at is null) then
      t := checker || ' · Check-in differs · ' || trip_w;
      b := concat_ws(' · ', cl, coalesce(l ->> 'productName', 'An item') || ' ' || trim_scale(ow_num(l ->> 'yardQty'))::text || ' of ' || got,
        case when val > 0 then '+' || ow_money(val) || ' at cost' when val < 0 then '−' || ow_money(abs(val)) || ' at cost' end,
        case when n > 1 then '+' || (n - 1) || ' more' end, 'from ' || sup);
      perform ow_push(new.shop_id, 'trip.difference', t, b, null, 'trip.difference', null, ref, 'tripdiff:' || new.id);
    end if;
    if tg_op = 'UPDATE' and new.difference_accepted_at is not null and old.difference_accepted_at is null then
      t := ow_name_of(new.shop_id, coalesce(new.difference_accepted_by, auth.uid())) || ' took ' || checker || '''s check-in';
      b := upper(left(trip_w, 1)) || substr(trip_w, 2) || ' · from ' || sup || ' — the shelf has the yard''s '
        || trim_scale(ow_num(l ->> 'yardQty'))::text || ' of ' || got || ' ' || coalesce(l ->> 'productName', 'items')
        || case when n > 1 then ' · +' || (n - 1) || ' more' else '' end || '.';
      if new.yard_checked_by is not null then
        perform ow_push(new.shop_id, 'trip.difference.decided', t, b, new.yard_checked_by, null, null, ref, 'tripdiffdone:' || new.id);
      end if;
      if runner is not null and runner is distinct from new.yard_checked_by then
        perform ow_push(new.shop_id, 'trip.difference.decided', t, b, runner, null, null, ref, 'tripdiffdone:' || new.id || ':runner');
      end if;
    end if;
  exception when others then
    raise notice 'push (trip %, manager): % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
drop trigger if exists collection_trips_ow_a_mgr_push on collection_trips;
create trigger collection_trips_ow_a_mgr_push after insert or update on collection_trips
  for each row execute function collection_trips_ow_a_mgr_push();

-- ---------------------------------------------------------------------
-- 4. A loss report (0129): "Musa · Damaged · 3 Cement".
create or replace function stock_reports_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  shelf numeric;
begin
  select s.qty into shelf from stock s where s.shop_id = new.shop_id and s.key = new.key;
  perform ow_push(new.shop_id, 'stock.report',
    coalesce(nullif(split_part(btrim(coalesce(new.reported_by_name, '')), ' ', 1), ''), ow_name_of(new.shop_id, new.reported_by)) || ' · '
      || case new.why when 'lost' then 'Lost' when 'stolen' then 'Stolen' when 'expired' then 'Expired' when 'damaged' then 'Damaged' else 'Gone' end
      || ' · ' || trim_scale(coalesce(new.qty, 0))::text || ' ' || coalesce(new.name, 'items'),
    case when shelf is not null then 'on the shelf ' || trim_scale(shelf)::text || ' → ' || trim_scale(greatest(0, shelf - coalesce(new.qty, 0)))::text || ' · ' else '' end
      || 'Write it off?',
    null, 'stock.writeoff', null, jsonb_build_object('table', 'stock_reports', 'id', new.id), 'report:' || new.id);
  return null;
exception when others then
  raise notice 'push (report): % (%)', sqlerrm, sqlstate;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 5. A restock line held or let go (0136), and a carton's answer (0158's carton.refused key taken first).
create or replace function restock_buys_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nm text;
  who text := ow_name_of(new.shop_id, auth.uid());
  carton boolean := coalesce(new.for_line, '') <> '';
  ref jsonb := jsonb_build_object('table', 'restock_buys', 'id', new.id);
begin
  select coalesce(p.name, new.product_id) into nm from products p where p.shop_id = new.shop_id and p.id = new.product_id;
  nm := coalesce(nm, new.product_id, 'A line');
  if new.status = 'held' and old.status is distinct from 'held' then
    perform ow_push(new.shop_id, 'restock.held', who || ': not yet · ' || nm, nm || ' — not to buy for now.',
      null, 'buy.restock', null, ref, 'held:' || new.id || ':' || coalesce(new.held_at::text, ''));
  elsif new.status = 'planned' and old.status = 'held' then
    perform ow_push(new.shop_id, 'restock.released',
      case when carton and old.held_by is null then 'Shelf part OK · ' || nm else who || ': go ahead · ' || nm end,
      case when carton and old.held_by is null then who || ': buy the carton; the ' || trim_scale(new.qty)::text || ' over go on the shelf.'
           else nm || ' — buy it when you next go.' end,
      null, 'buy.restock', null, ref, 'released:' || new.id || ':' || (extract(epoch from now()) * 1000)::bigint);
  elsif new.status = 'cancelled' and old.status = 'held' and old.held_by is null and carton then
    perform ow_push(new.shop_id, 'carton.refused', 'Order only · ' || nm,
      who || ': buy only what the order needs. The ' || trim_scale(new.qty)::text || ' for the shelf stay unbought.',
      new.created_by, case when new.created_by is null then 'buy.restock' end, null,
      ref || jsonb_build_object('line', new.for_line, 'orderId', nullif(split_part(new.for_line, ':', 1), '')), 'cartonno:' || new.id);
  end if;
  return null;
exception when others then
  raise notice 'push (restock): % (%)', sqlerrm, sqlstate;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 6. The 24-hour run (0169's): a bill it can't make says why in words, never the database's.
create or replace function ow_invoice_due_orders()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
  res jsonb;
  done int := 0;
  skipped jsonb := '[]'::jsonb;
  v_code text;
  v_why text;
  v_total numeric;
begin
  for r in
    select q.shop_id, q.id, q.client_name, q.payload
      from saved_quotes q
     where q.status = 'completed' and not q.invoiced and not q.voided
       and coalesce(ow_ts(q.payload ->> 'deliveredAt'),
                    case when ow_num(q.payload ->> 'stageEnteredAt') > 0
                         then to_timestamp(ow_num(q.payload ->> 'stageEnteredAt') / 1000) end)
           <= now() - interval '24 hours'
     order by q.shop_id, q.id
  loop
    begin
      v_total := round(ow_order_total(r.shop_id, coalesce(r.payload, '{}'::jsonb), false));
      if v_total < 1000 then
        raise exception 'Only % · the Manager checks it before billing.', v_total using errcode = 'OWSML';
      end if;
      res := ow_invoice_core(r.shop_id, r.id, 'auto', null, 'The 24-hour run');
      perform ow_log(r.shop_id, null, 'The 24-hour run', 'auto', 'invoice.make',
        'Invoiced ' || (res ->> 'invoice') || coalesce(' for ' || nullif(r.client_name, ''), '') || ', 24 hours after delivery',
        (res ->> 'total')::numeric, jsonb_build_object('table', 'saved_quotes', 'id', r.id),
        jsonb_build_object('invoiced', false), jsonb_build_object('invoiced', true, 'debtCharged', res -> 'debtCharged', 'bills', res -> 'bills'));
      done := done + 1;
    exception when others then
      v_code := sqlstate; v_why := sqlerrm;
      skipped := skipped || jsonb_build_array(jsonb_build_object('shop', r.shop_id, 'id', r.id, 'code', v_code, 'why', v_why));
      begin
        perform ow_push(r.shop_id, 'invoice.held', 'Can''t bill itself · ' || ow_order_label(r.id),
          coalesce(nullif(btrim(coalesce(r.client_name, '')), ''), 'An order') || ' — '
            || case when v_code in ('OWTPC', 'OWPRC') then 'Price coming · decide it to bill'
                    when v_code = 'OWSHP' then 'Packed short · decide the bill'
                    when v_code = 'OWSML' then 'Only ' || ow_money(v_total) || ' · check it'
                    when v_code = 'OWGIV' then 'A line at 0 · given away?'
                    else 'Can''t bill itself · open it' end,
          null, case when v_code in ('OWTPC', 'OWPRC', 'OWGIV') then 'price.approve' when v_code = 'OWSHP' then 'pick.settle' else 'invoice.make' end, null,
          jsonb_build_object('table', 'saved_quotes', 'id', r.id, 'code', v_code),
          'invheld:' || r.id || ':' || v_code || ':' || ow_today());
      exception when others then
        raise notice 'push (invoice held %): % (%)', r.id, sqlerrm, sqlstate;
      end;
    end;
  end loop;
  for r in select distinct m.shop_id from manager_notes m
            where m.kind = 'target' and m.status = 'open' and (m.body ->> 'to') ~ '^\d{4}-\d{2}-\d{2}$' and (m.body ->> 'to')::date < ow_today() loop
    begin
      perform ow_end_targets(r.shop_id);
    exception when others then
      raise notice 'ending targets (%): % (%)', r.shop_id, sqlerrm, sqlstate;
    end;
  end loop;
  return jsonb_build_object('invoiced', done, 'skipped', skipped);
end $$;
revoke all on function ow_invoice_due_orders() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Sales' cancel ask (0181): the ask, and the answers "Cancelled" / "Kept".
create or replace function cancel_asks_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  client text;
  q_status text;
  q_invoiced boolean;
  lbl text := ow_order_label(new.quote_id);
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
      who := ow_name_of(new.shop_id, new.decided_by);
      perform ow_push(new.shop_id, 'order.cancel.ask.decided',
        case when new.status = 'accepted' then 'Cancelled' when q_invoiced then 'Billed first · ask for a void' else 'Kept' end,
        lbl || coalesce(' · ' || client, '') || ' — '
          || case when new.status = 'accepted' then who || ' cancelled it.'
                  when q_invoiced then 'invoiced before it was cancelled.'
                  else who || ' kept it' || coalesce(': ' || new.answer, '.') end,
        new.asked_by, null, null, ref, 'cancelaskdone:' || new.id);
    end if;
  exception when others then
    raise notice 'push (cancel ask): % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 8. A nudge is a push (decision-rights §3; P-9). team.nudge is the Manager's (0116).
create or replace function nudge_person(p_shop uuid, p_to uuid, p_order bigint, p_words text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  words text := left(nullif(btrim(coalesce(p_words, '')), ''), 300);
  to_name text;
  ref jsonb;
begin
  if uid is null or not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  if not has_task(p_shop, 'team.nudge') then
    raise exception 'A nudge is the Manager''s (team.nudge).' using errcode = '42501';
  end if;
  if words is null then raise exception 'Say what the nudge is about.' using errcode = '22023'; end if;
  if p_to is null or not exists (select 1 from shop_members m where m.shop_id = p_shop and m.user_id = p_to) then
    raise exception 'That person is not in this shop.' using errcode = '22023';
  end if;
  if p_to = uid then raise exception 'A nudge goes to someone else.' using errcode = '22023'; end if;
  if p_order is not null and not exists (select 1 from saved_quotes q where q.shop_id = p_shop and q.id = p_order) then
    raise exception 'This order is no longer in the books.' using errcode = 'P0002';
  end if;
  to_name := ow_name_of(p_shop, p_to);
  ref := case when p_order is not null then jsonb_build_object('table', 'saved_quotes', 'id', p_order)
              else jsonb_build_object('table', 'shop_members', 'user', p_to) end;
  perform manager_log_decision(p_shop, 'team.nudge', 'Nudged ' || to_name || coalesce(' about ' || ow_order_label(p_order), '') || ': ' || words,
    null, ref, null, jsonb_build_object('to', p_to, 'words', words));
  perform ow_push(p_shop, 'team.nudge', ow_name_of(p_shop, uid) || ' nudged you', words, p_to, null, null, ref, null);
  return jsonb_build_object('ok', true, 'to', p_to, 'name', to_name);
end $$;
revoke all on function nudge_person(uuid, uuid, bigint, text) from public, anon;
grant execute on function nudge_person(uuid, uuid, bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 9. A goal set, to the salesperson (P-10; meant quiet, see the header).
create or replace function manager_notes_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who uuid;
begin
  if new.kind <> 'target' or new.status <> 'open' or not (coalesce(new.body, '{}'::jsonb) ? 'who') then return null; end if;
  if tg_op = 'UPDATE' and (old.body -> 'aim') is not distinct from (new.body -> 'aim') then return null; end if;
  who := ow_uuid(new.body ->> 'who');
  if who is null then return null; end if;
  perform ow_push(new.shop_id, 'goal.set',
    'Your goal for ' || case when new.body ->> 'from' ~ '^\d{4}-\d{2}-\d{2}$' then to_char((new.body ->> 'from')::date, 'FMMonth') else 'now' end,
    ow_money(ow_num(new.body ->> 'aim')) || ' · ' || ow_name_of(new.shop_id, coalesce(ow_uuid(new.body ->> 'setBy'), auth.uid())) || ' set it',
    who, null, null, jsonb_build_object('table', 'manager_notes', 'id', new.id), 'goal:' || new.id || ':' || coalesce(new.body ->> 'aim', ''));
  return null;
exception when others then
  raise notice 'push (goal): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists manager_notes_ow_push on manager_notes;
create trigger manager_notes_ow_push after insert or update on manager_notes
  for each row execute function manager_notes_ow_push();

-- ---------------------------------------------------------------------
-- 10. A new item listed by Sourcing: the Manager sets its markup (P-11).
create or replace function products_ow_markup_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not has_task(new.shop_id, 'product.edit') or has_task(new.shop_id, 'markup.set') then return null; end if;
  perform ow_push(new.shop_id, 'markup.wanted', 'A new item to price',
    ow_name_of(new.shop_id, auth.uid()) || ' listed ' || coalesce(nullif(btrim(coalesce(new.name, '')), ''), new.id) || ' · set its markup',
    null, 'markup.set', null, jsonb_build_object('table', 'products', 'id', new.id), 'markup:' || new.id);
  return null;
exception when others then
  raise notice 'push (markup): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists products_ow_markup_push on products;
create trigger products_ow_markup_push after insert on products
  for each row execute function products_ow_markup_push();

-- ---------------------------------------------------------------------
-- 11. A promise to pay taken by someone who does not decide credit (P-13; meant quiet).
create or replace function payment_promises_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c customers%rowtype;
begin
  if auth.uid() is null or has_task(new.shop_id, 'credit.set') then return null; end if;
  select * into c from customers where shop_id = new.shop_id and id = new.customer_id;
  perform ow_push(new.shop_id, 'promise.made',
    coalesce(ow_short_name(c.name), 'A customer') || ' promised ' || case when new.amount > 0 then ow_money(new.amount) || ' · ' else '' end
      || to_char(new.promised_on, 'Dy DD Mon'),
    ow_name_of(new.shop_id, auth.uid()) || ' took the promise' || case when coalesce(c.debt, 0) > 0 then ' · they owe ' || ow_money(c.debt) else '' end || '.',
    null, 'credit.set', null, jsonb_build_object('table', 'payment_promises', 'id', new.id, 'customer', new.customer_id), 'promise:' || new.id);
  return null;
exception when others then
  raise notice 'push (promise): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists payment_promises_ow_push on payment_promises;
create trigger payment_promises_ow_push after insert on payment_promises
  for each row execute function payment_promises_ow_push();
