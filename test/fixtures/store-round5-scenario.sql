-- Round 5 asked of a real database (test/store-round5.test.js): the yard's snapshot as
-- every role, with no money in it; what a Store login can and cannot write; names.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','admin@x'),('00000000-0000-0000-0000-00000000000c','ruth@x'),
  ('00000000-0000-0000-0000-00000000000d','grace@x'),('00000000-0000-0000-0000-00000000000e','musa@x'),('00000000-0000-0000-0000-00000000000f','joy@x'),
  ('00000000-0000-0000-0000-000000000010','worker@x'),('00000000-0000-0000-0000-000000000011','denis@x'),('00000000-0000-0000-0000-000000000012','acc@x'),
  ('00000000-0000-0000-0000-000000000013','src@x'),('00000000-0000-0000-0000-000000000099','stranger@x');
insert into shops(id,name,created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','admin'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','manager'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','store'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000010','staff'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000011','buyer'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000012','accounts'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000013','sourcing');
-- Musa has a staff record; Joy's login has none, so she starts with no name.
insert into staff(shop_id,id,name,role,user_id) values ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e'),
  ('11111111-1111-1111-1111-111111111111','W6','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000c');
insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S1','Katwe Fabricators');
insert into customers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','C1','Kato Construction');
insert into agents(shop_id,id,name,payment_term) values ('11111111-1111-1111-1111-111111111111','A1','Aisha Namutebi','prepay');
insert into app_settings(shop_id,presets) values ('11111111-1111-1111-1111-111111111111','{"categories":["Hinges"],"bays":4,"priceTiers":[1,2],"deliveryFee":5000,"markup":20}');
-- 0165: a payment carries its receipt (a cash row of the same amount, for the same order), and paid is their sum.
insert into cash_txns(id,shop_id,type,amount,quote_id,date) overriding system value values (9576,'11111111-1111-1111-1111-111111111111','receipt',100,576,current_date);
insert into saved_quotes(id,shop_id,client_name,status,amount_paid,payload) overriding system value values
 (576,'11111111-1111-1111-1111-111111111111','Kato Construction','preparing',100,
  '{"customerId":"C1","pickingStatus":"done","bay":2,"payments":[{"amount":100,"method":"cash","cashTxnId":"9576"}],"cost":5000,"agentCommission":30,
    "creditAsk":{"at":1729000000000,"by":"00000000-0000-0000-0000-00000000000e","byName":"Musa","answer":{"decision":"credit","at":1729000100000}},
    "creditCheck":{"decision":"release","at":1729000100000,"amount":96000},
    "creditNotes":[{"askId":"x","lines":[{"idx":0,"qty":1,"amount":5250}],"total":5250}],
    "items":[{"lineId":1,"productId":"P1","qty":20,"unit":"Pair","price":5250,"sellPrice":6000,"cost":5000,"pickStatus":"done","pickedQty":20}]}'),
 (577,'11111111-1111-1111-1111-111111111111','Aisha Namutebi','preparing',0,
  '{"originAgentId":"A1","agentPaymentStatus":"paid","agentSellPrice":7000,"items":[{"lineId":1,"productId":"P1","qty":2,"unit":"Pair","price":5250}]}');
insert into collection_trips(id,shop_id,supplier_id,status,note,lines) values ('T1','11111111-1111-1111-1111-111111111111','S1','collected','paid 50,000 UGX cash · two bundles',
  '[{"lineId":1,"productId":"P1","qty":10,"gotQty":10,"gotPrice":5000,"expectedPrice":5100,"orderId":576}]');
insert into stock_log(shop_id,key,type,delta,qty_after,date,note) values
 ('11111111-1111-1111-1111-111111111111','P1','in',10,10,current_date,'counted in at 10,750 UGX per Kg'),
 ('11111111-1111-1111-1111-111111111111','P1','in',4,14,current_date,'Bought from Katwe @ 5,250 UGX per Pair');
insert into invoice_asks(id,shop_id,quote_id,kind,lines,amount,reason,status,asked_by) values
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',576,'credit','[{"idx":0,"qty":1,"price":5250,"amount":5250}]',5250,'Came back','sent','00000000-0000-0000-0000-00000000000e');
insert into stock_counts(id,shop_id,aisle,counted_by,counted_by_name,lines,status) values
 ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','K','00000000-0000-0000-0000-00000000000e','Musa','[{"key":"P1","counted":14,"system":14}]','sent');
\unset ON_ERROR_STOP

-- 1. The snapshot as every role: it loads, and holds no money word.
create temp table roles_to_try(r text, u uuid);
insert into roles_to_try values ('owner','00000000-0000-0000-0000-00000000000a'),('admin','00000000-0000-0000-0000-00000000000b'),('manager','00000000-0000-0000-0000-00000000000c'),
  ('sales','00000000-0000-0000-0000-00000000000d'),('store','00000000-0000-0000-0000-00000000000e'),('staff','00000000-0000-0000-0000-000000000010'),
  ('buyer','00000000-0000-0000-0000-000000000011'),('accounts','00000000-0000-0000-0000-000000000012'),('sourcing','00000000-0000-0000-0000-000000000013'),
  ('stranger','00000000-0000-0000-0000-000000000099');
grant select on roles_to_try to authenticated;
do $$ declare x record; j jsonb; begin
  for x in select * from roles_to_try loop
    perform set_config('request.jwt.claim.sub', x.u::text, true);
    begin
      execute 'set local role authenticated';
      j := store_snapshot('11111111-1111-1111-1111-111111111111');
      raise notice 'snap|%|loaded|orders=%|money=%', x.r, jsonb_array_length(j -> 'orders'),
        coalesce((regexp_match(j::text, '[^"]{0,20}(price|cost|amount|paid|payment|credit|UGX)[^"]{0,20}', 'i'))[1], 'none');
      execute 'reset role';
    exception when others then execute 'reset role'; raise notice 'snap|%|refused|%', x.r, sqlstate;
    end;
  end loop;
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
-- 2. What the snapshot says, as Musa (store).
select 'note', string_agg(coalesce(e ->> 'note', '∅'), ' | ' order by e ->> 'id') from jsonb_array_elements(store_snapshot('11111111-1111-1111-1111-111111111111') -> 'log') e;
select 'trip note', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'trips' -> 0 ->> 'note';
select 'renamed', (store_snapshot('11111111-1111-1111-1111-111111111111') -> 'orders' -> 0 -> 'payload') ->> 'letGoAsk',
  (store_snapshot('11111111-1111-1111-1111-111111111111') -> 'orders' -> 0 -> 'payload') ->> 'letGo',
  (store_snapshot('11111111-1111-1111-1111-111111111111') -> 'orders' -> 1 -> 'payload') ->> 'agentSettled',
  store_snapshot('11111111-1111-1111-1111-111111111111') -> 'agents' -> 0 ->> 'terms';
select 'presets', store_snapshot('11111111-1111-1111-1111-111111111111') ->> 'presets';
select 'me', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'me' ->> 'name';
select 'managers', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'managers' ->> 'manager';
-- 3. What a Store login cannot do.
select 'members visible', count(*) from shop_members;
do $$ declare n int; begin update shop_members set role = 'owner' where user_id = auth.uid(); get diagnostics n = row_count; raise notice 'w|own role|% rows', n;
  exception when others then raise notice 'w|own role|refused %', sqlstate; end $$;
do $$ declare n int; begin update shop_members set role = 'store' where user_id = '00000000-0000-0000-0000-00000000000c'; get diagnostics n = row_count; raise notice 'w|other role|% rows', n;
  exception when others then raise notice 'w|other role|refused %', sqlstate; end $$;
do $$ begin insert into saved_quotes(shop_id,client_name,status,payload) values ('11111111-1111-1111-1111-111111111111','Fake','preparing','{}'); raise notice 'w|order insert|written';
  exception when others then raise notice 'w|order insert|refused %', sqlstate; end $$;
do $$ declare n int; begin update saved_quotes set status = 'completed' where id = 576; get diagnostics n = row_count; raise notice 'w|order update|% rows', n;
  exception when others then raise notice 'w|order update|refused %', sqlstate; end $$;
do $$ declare n int; begin delete from saved_quotes where id = 576; get diagnostics n = row_count; raise notice 'w|order delete|% rows', n;
  exception when others then raise notice 'w|order delete|refused %', sqlstate; end $$;
do $$ begin insert into customers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','CX','Fake'); raise notice 'w|customer insert|written';
  exception when others then raise notice 'w|customer insert|refused %', sqlstate; end $$;
do $$ begin perform decide_invoice_ask('22222222-2222-2222-2222-222222222222', 'accepted'); raise notice 'w|decide_invoice_ask|ran';
  exception when others then raise notice 'w|decide_invoice_ask|refused %', sqlstate; end $$;
do $$ begin perform accept_stock_count('33333333-3333-3333-3333-333333333333'); raise notice 'w|accept_stock_count|ran';
  exception when others then raise notice 'w|accept_stock_count|refused %', sqlstate; end $$;
do $$ begin perform ask_recount('33333333-3333-3333-3333-333333333333'); raise notice 'w|ask_recount|ran';
  exception when others then raise notice 'w|ask_recount|refused %', sqlstate; end $$;
-- 4. What it still does: its own tables directly, and orders through store_patch_order.
do $$ begin insert into stock_reports(shop_id,key,product_id,name,qty,why,reported_by,reported_by_name) values ('11111111-1111-1111-1111-111111111111','P1','P1','Hinges',1,'damaged',auth.uid(),'Musa'); raise notice 'ok|report insert|written';
  exception when others then raise notice 'ok|report insert|refused % %', sqlstate, sqlerrm; end $$;
do $$ begin insert into store_asks(shop_id,kind,payload,asked_by,asked_by_name) values ('11111111-1111-1111-1111-111111111111','restock','{"key":"P1"}',auth.uid(),'Musa'); raise notice 'ok|ask insert|written';
  exception when others then raise notice 'ok|ask insert|refused % %', sqlstate, sqlerrm; end $$;
select 'patch', store_patch_order('11111111-1111-1111-1111-111111111111', 576, '{"letGoAsk":{"at":1729000900000,"by":"00000000-0000-0000-0000-00000000000e","byName":"Musa"}}', null, null) -> 'payload' -> 'letGoAsk' ->> 'at';
-- 5. Joy has no name until she sets one; then it is on what she does.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select 'joy before', coalesce(store_snapshot('11111111-1111-1111-1111-111111111111') -> 'me' ->> 'name', '∅');
do $$ begin perform set_my_name('11111111-1111-1111-1111-111111111111', 'joy@x'); raise notice 'name|email|taken';
  exception when others then raise notice 'name|email|refused %', sqlstate; end $$;
select 'joy set', set_my_name('11111111-1111-1111-1111-111111111111', '  Joy   Namata ');
select 'joy after', store_snapshot('11111111-1111-1111-1111-111111111111') -> 'me' ->> 'name';
select 'joy in members', (select e ->> 'name' from jsonb_array_elements(store_snapshot('11111111-1111-1111-1111-111111111111') -> 'members') e where e ->> 'user_id' = '00000000-0000-0000-0000-00000000000f');
select 'joy return', store_return_ask('11111111-1111-1111-1111-111111111111', 577, '[{"idx":0,"qty":1}]', 'Came back', null) ->> 'asked_by_name';
reset role;
select 'row', payload -> 'creditAsk' ->> 'at', payload ? 'letGoAsk', status from saved_quotes where id = 576;
select 'orders', count(*) from saved_quotes;
select 'musa name', ow_member_name('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000e');
