-- 0181 asked of a real database (journey Q7; 05 §9 Q7; the canvas's OR18,
-- OR19): Sales asks the Manager to cancel its own order before the bill;
-- the Manager's yes goes through cancel_order, a no is logged and pushed.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000c','buyer@x'),('00000000-0000-0000-0000-00000000000d','grace@x'),
 ('00000000-0000-0000-0000-00000000000e','store@x'),('00000000-0000-0000-0000-00000000000f','worker@x'),
 ('00000000-0000-0000-0000-000000000010','brian@x'),('00000000-0000-0000-0000-000000000011','accounts@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role,display_name) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner','Kevin'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','Ruth Nakato'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer','Musa Okello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales','Grace Akello'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store','Peter Ssali'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','staff','Joseph'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000010','sales','Brian Okot'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000011','accounts','Esther');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;

-- Orders (the checks are off while they go in), Grace's unless named:
--   #0801 Checking.   #0802 Packing, 35,000 paid in cash.   #0803 Checking, Brian's.   #0804 invoiced.
--   #0805 delivered.  #0806 cancelled already.   #0807 On the road.   #0808 Checking.   #0809 Checking.
--   #0810 Buying, on a live trip.
set session_replication_role = replica;
insert into customers(shop_id,id,name,debt) values ('11111111-1111-1111-1111-111111111111','C1','Ken',0);
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id) values
 (9802,'11111111-1111-1111-1111-111111111111',ow_today(),'cash','receipt','Invoice Payment',35000,'Payment — #0802',802);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, voided, amount_paid, payload) overriding system value
 select g, '11111111-1111-1111-1111-111111111111', 'Ken', ow_today(), s, g = 804, g = 806, p,
   jsonb_build_object('customerId','C1','takenBy', case when g = 803 then '00000000-0000-0000-0000-000000000010' else '00000000-0000-0000-0000-00000000000d' end,
     'payments', case when p > 0 then jsonb_build_array(jsonb_build_object('id',1,'date',ow_today(),'amount',p,'cashTxnId',9000 + g,'method','cash')) else '[]'::jsonb end,
     'items', jsonb_build_array(jsonb_build_object('lineId',1,'productId','P1','productName','Cement','qty',1,'price',30000,'sellPrice',35000,'supplierId','__stock__')))
   from (values (801,'draft',0),(802,'preparing',35000),(803,'draft',0),(804,'completed',0),(805,'completed',0),(806,'cancelled',0),
                (807,'pending_delivery',0),(808,'draft',0),(809,'draft',0),(810,'awaiting_goods',0)) v(g, s, p);
update saved_quotes set payload = jsonb_set(payload, '{items,0}', '{"lineId":1,"productId":"P2","productName":"Iron sheet","qty":5,"price":40000,"sellPrice":45000,"supplierId":"S1"}') where id = 810;
insert into collection_trips(id, shop_id, supplier_id, status, lines) values ('T1','11111111-1111-1111-1111-111111111111','S1','open','[{"orderId":810,"productId":"P2","qty":5}]');
set session_replication_role = origin;

create table _r(n serial, label text, expect text, got text);
create table _out(k text, r jsonb);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  declare n int; begin execute q; get diagnostics n = row_count;
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then got := 'refused: 0 rows (row-level security hid them)'; end if;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq, _out to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;
-- What the caller sees of cancel_asks, under their own row-level security.
create function _sees() returns bigint language sql as $$ select count(*) from cancel_asks $$;
grant execute on function _sees to authenticated;
create function _ask(k text) returns uuid language sql security definer as $$ select (r ->> 'id')::uuid from _out where _out.k = $1 $$;
grant execute on function _ask to authenticated;

set role authenticated;
-- ---------------- who may ask: cancel.ask (Sales), on their own order
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: asks to cancel #0801', 'refused:42501', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',801,'Changed their mind')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('yard worker: asks to cancel #0801', 'refused:42501', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',801,'Changed their mind')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: asks to cancel #0801', 'refused:42501', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',801,'Changed their mind')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select _try('accounts: asks to cancel #0801', 'refused:42501', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',801,'Changed their mind')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager (cancels, never asks): asks to cancel #0801', 'refused:42501', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',801,'Changed their mind')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('brian: asks to cancel Grace''s #0801', 'refused:42501', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',801,'Changed their mind')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks to cancel Brian''s #0803', 'refused:42501', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',803,'Changed their mind')$q$);
-- ---------------- what may not be asked
select _try('grace: #0801 with no reason', 'refused:22023', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',801,'  ')$q$);
select _try('grace: invoiced #0804 (a void, not a cancel)', 'refused:22023', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',804,'Entered twice')$q$);
select _try('grace: delivered #0805', 'refused:22023', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',805,'Entered twice')$q$);
select _try('grace: #0806, called off already', 'refused:22023', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',806,'Entered twice')$q$);
select _try('grace: an order not in the books', 'refused:P0002', $q$select ask_cancel('11111111-1111-1111-1111-111111111111',899,'Entered twice')$q$);
select _try('grace: writes an ask straight into the table', 'refused:42501', $q$insert into cancel_asks(shop_id, quote_id, why) values ('11111111-1111-1111-1111-111111111111',801,'sneaky')$q$);
select _try('check: none of those made an ask', 'ok', $q$select _is($c$(select count(*) from cancel_asks) = 0$c$)$q$);

-- ---------------- the ask
select _try('grace: asks Ruth to cancel #0801 — Kato changed their mind', 'ok', $q$insert into _out select 'a1', ask_cancel('11111111-1111-1111-1111-111111111111',801,'Kato changed their mind','He found it cheaper')$q$);
select _try('check: one ask, waiting, with what the order came to, its stage, Grace and Ken', 'ok', $q$select _is($c$(select status = 'sent' and amount = 35000 and stage = 'draft' and why = 'Kato changed their mind' and note = 'He found it cheaper' and asked_by = '00000000-0000-0000-0000-00000000000d' and asked_by_name = 'Grace Akello' and customer_id = 'C1' from cancel_asks where id = _ask('a1'))$c$)$q$);
select _try('check: Ruth (order.cancel) is pushed, once', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind = 'order.cancel.ask') = 1 and exists(select 1 from push_outbox where kind = 'order.cancel.ask' and to_task = 'order.cancel' and title = 'Cancel asked' and body = 'Grace asks to cancel #0801 · Ken · 35,000 — Kato changed their mind' and ref ->> 'quote' = '801')$c$)$q$);
select _try('grace: asks again while it waits', 'ok', $q$insert into _out select 'a1again', ask_cancel('11111111-1111-1111-1111-111111111111',801,'Entered twice')$q$);
select _try('check: the same ask, said again; no second push', 'ok', $q$select _is($c$_ask('a1again') = _ask('a1') and (select r ->> 'again' from _out where k = 'a1again') = 'true' and (select count(*) from cancel_asks) = 1 and (select count(*) from push_outbox where kind = 'order.cancel.ask') = 1$c$)$q$);
select _try('grace: sees her ask', 'ok', $q$do $d$ begin if _sees() <> 1 then raise exception 'sees %', _sees(); end if; end $d$$q$);
select _try('grace: answers it herself by hand', 'refused:0 rows', $q$update cancel_asks set status = 'accepted' where quote_id = 801$q$);
select _try('grace: answers her own ask', 'refused:42501', $q$select answer_cancel_ask(_ask('a1'), true)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: reads no asks', 'ok', $q$do $d$ begin if _sees() <> 0 then raise exception 'sees %', _sees(); end if; end $d$$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('yard worker: reads no asks', 'ok', $q$do $d$ begin if _sees() <> 0 then raise exception 'sees %', _sees(); end if; end $d$$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000011';
select _try('accounts: answers it', 'refused:42501', $q$select answer_cancel_ask(_ask('a1'), true)$q$);

-- ---------------- the Manager says no
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: says no — already loaded for Kato', 'ok', $q$select answer_cancel_ask(_ask('a1'), false, 'Already loaded for Kato')$q$);
select _try('check: declined with her words, by Ruth; #0801 stands', 'ok', $q$select _is($c$(select status = 'declined' and answer = 'Already loaded for Kato' and decided_by = '00000000-0000-0000-0000-00000000000b' and decided_at is not null from cancel_asks where id = _ask('a1')) and (select status = 'draft' and not voided from saved_quotes where id = 801)$c$)$q$);
select _try('check: the owner''s log has it, by order.cancel', 'ok', $q$select _is($c$exists(select 1 from decision_log where task = 'order.cancel' and what = 'Kept order #0801 for Ken: declined Grace Akello''s ask to cancel it — Already loaded for Kato' and amount = 35000 and after ->> 'status' = 'declined')$c$)$q$);
select _try('check: Grace is pushed the no', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind = 'order.cancel.ask.decided' and to_user = '00000000-0000-0000-0000-00000000000d' and title = 'Not cancelled' and body = '#0801 · Ken — Ruth kept it: Already loaded for Kato')$c$)$q$);
select _try('ruth: answers it again', 'refused:22023', $q$select answer_cancel_ask(_ask('a1'), true)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: withdraws an ask already answered', 'refused:22023', $q$select withdraw_cancel_ask(_ask('a1'))$q$);

-- ---------------- the Manager says yes: cancel_order does it
select _try('grace: asks again, after the no', 'ok', $q$insert into _out select 'a2', ask_cancel('11111111-1111-1111-1111-111111111111',801,'Kato changed their mind')$q$);
select _try('check: a new ask', 'ok', $q$select _is($c$_ask('a2') <> _ask('a1') and (select r ->> 'again' from _out where k = 'a2') = 'false'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: says yes', 'ok', $q$insert into _out select 'y2', answer_cancel_ask(_ask('a2'), true)$q$);
select _try('check: #0801 is cancelled by Ruth, with Grace''s reason (0177)', 'ok', $q$select _is($c$(select status = 'cancelled' and voided and payload ->> 'cancelledByName' = 'Ruth Nakato' and payload ->> 'cancelWhy' = 'Kato changed their mind' from saved_quotes where id = 801)$c$)$q$);
select _try('check: the ask is accepted, by Ruth', 'ok', $q$select _is($c$(select status = 'accepted' and decided_by = '00000000-0000-0000-0000-00000000000b' from cancel_asks where id = _ask('a2')) and (select r ->> 'status' from _out where k = 'y2') = 'accepted'$c$)$q$);
select _try('check: Grace is told once, by the cancel itself (order.cancelled), not twice', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind = 'order.cancelled' and ref ->> 'id' = '801' and to_user = '00000000-0000-0000-0000-00000000000d') and not exists(select 1 from push_outbox where kind = 'order.cancel.ask.decided' and dedupe = 'cancelaskdone:' || _ask('a2'))$c$)$q$);

-- ---------------- cancel_order's own refusals stand, and leave the ask waiting
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks to cancel #0802 (35,000 paid)', 'ok', $q$insert into _out select 'a3', ask_cancel('11111111-1111-1111-1111-111111111111',802,'Entered twice')$q$);
select _try('grace: asks to cancel #0810 (on a live buying trip)', 'ok', $q$insert into _out select 'a4', ask_cancel('11111111-1111-1111-1111-111111111111',810,'Wrong items or how many')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: yes to #0802 with no word on the 35,000', 'refused:OWVMN', $q$select answer_cancel_ask(_ask('a3'), true)$q$);
select _try('ruth: yes to #0810, still on the trip', 'refused:22023', $q$select answer_cancel_ask(_ask('a4'), true)$q$);
select _try('check: both asks still wait, both orders stand', 'ok', $q$select _is($c$(select count(*) from cancel_asks where id in (_ask('a3'), _ask('a4')) and status = 'sent') = 2 and (select count(*) from saved_quotes where id in (802, 810) and not voided) = 2$c$)$q$);
select _try('ruth: yes to #0802, the 35,000 kept as Ken''s deposit', 'ok', $q$select answer_cancel_ask(_ask('a3'), true, null, 'deposit')$q$);
select _try('check: #0802 cancelled with a deposit; the yard told to put back; the ask accepted', 'ok', $q$select _is($c$(select status = 'cancelled' and payload -> 'voidMoney' ->> 'choice' = 'deposit' from saved_quotes where id = 802) and (select debt from customers where id = 'C1') = -35000 and exists(select 1 from push_outbox where kind = 'order.cancelled' and ref ->> 'id' = '802' and to_task = 'order.pick') and (select status from cancel_asks where id = _ask('a3')) = 'accepted'$c$)$q$);

-- ---------------- taking it back
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks to cancel #0809', 'ok', $q$insert into _out select 'a5', ask_cancel('11111111-1111-1111-1111-111111111111',809,'Something else')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000010';
select _try('brian: takes back Grace''s ask', 'refused:42501', $q$select withdraw_cancel_ask(_ask('a5'))$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: takes it back', 'ok', $q$select withdraw_cancel_ask(_ask('a5'))$q$);
select _try('grace: takes it back again (a retry)', 'ok', $q$insert into _out select 'w5', withdraw_cancel_ask(_ask('a5'))$q$);
select _try('check: withdrawn once, the retry says so, nobody pushed', 'ok', $q$select _is($c$(select status from cancel_asks where id = _ask('a5')) = 'withdrawn' and (select r ->> 'again' from _out where k = 'w5') = 'true' and not exists(select 1 from push_outbox where kind = 'order.cancel.ask.decided' and ref ->> 'quote' = '809')$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: answers a withdrawn ask', 'refused:22023', $q$select answer_cancel_ask(_ask('a5'), true)$q$);

-- ---------------- the ask follows the order
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: asks to cancel #0808', 'ok', $q$insert into _out select 'a6', ask_cancel('11111111-1111-1111-1111-111111111111',808,'Entered twice')$q$);
select _try('grace: asks to cancel #0807 (on the road)', 'ok', $q$insert into _out select 'a7', ask_cancel('11111111-1111-1111-1111-111111111111',807,'Wrong items or how many')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: cancels #0808 straight from the order', 'ok', $q$select cancel_order('11111111-1111-1111-1111-111111111111',808,'Entered twice')$q$);
select _try('check: its ask closes as accepted, Grace told by the cancel only', 'ok', $q$select _is($c$(select status = 'accepted' and decided_by = '00000000-0000-0000-0000-00000000000b' from cancel_asks where id = _ask('a6')) and not exists(select 1 from push_outbox where dedupe = 'cancelaskdone:' || _ask('a6'))$c$)$q$);
reset role;
set request.jwt.claim.sub = '';
-- The server, no login (the hourly run), invoices #0807 as it is delivered.
select _try('server: #0807 delivered and invoiced before anyone answered', 'ok', $q$update saved_quotes set status = 'completed', invoiced = true, invoiced_at = now() where id = 807$q$);
select _try('check: its ask closes as declined, Grace told to ask for a void', 'ok', $q$select _is($c$(select status = 'declined' and answer like 'Invoiced before it was cancelled%' from cancel_asks where id = _ask('a7')) and exists(select 1 from push_outbox where kind = 'order.cancel.ask.decided' and to_user = '00000000-0000-0000-0000-00000000000d' and body = '#0807 · Ken — invoiced before it was cancelled: ask for a void.')$c$)$q$);

select case when (expect = 'ok' and got = 'ok') or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
