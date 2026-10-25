-- Round 10 asked of a real database (test/store-round10.test.js), as a Store login:
--   REL-12  two tabs on one order: the second pack and the second hand-over are refused (0162, OWSTALE);
--           what the yard may not write is refused (0164 PRIV-05), and what it may still goes through.
--   WORD-11 the snapshot's members carry their role, and no name when they have none (0168).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000c','ruth@x'),('00000000-0000-0000-0000-00000000000e','musa@x');
insert into shops(id,name,created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','manager'),
  ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store');
insert into staff(shop_id,id,name,role,user_id) values ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e'),
  ('11111111-1111-1111-1111-111111111111','W6','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000c');
insert into customers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','C1','Kato');
insert into suppliers(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','S1','Katwe');
insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (601,'11111111-1111-1111-1111-111111111111','TEST · two tabs','preparing',
 '{"pickingStatus":"in_progress","pickingAssignedAt":1729000000000,"items":[{"lineId":1,"productId":"P1","productName":"Padlock 50mm","qty":1,"unit":"pc"}]}');
insert into stock_counts(id,shop_id,aisle,counted_by,counted_by_name,lines,status) values
 ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Aisle K · Paint','00000000-0000-0000-0000-00000000000e','Musa','[{"key":"P1","counted":3,"system":4}]','sent');
insert into invoice_asks(id,shop_id,quote_id,kind,lines,amount,reason,status,asked_by) values
 ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',601,'credit','[{"idx":0,"qty":1}]',0,'Came back','sent','00000000-0000-0000-0000-00000000000e');
insert into collection_trips(id,shop_id,supplier_id,status,lines) values ('T1','11111111-1111-1111-1111-111111111111','S1','collected','[]');
\unset ON_ERROR_STOP

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';

-- 1. Two tabs on #0601. Both opened it while it was being packed.
select 'A packs', store_patch_order('11111111-1111-1111-1111-111111111111', 601, '{"pickingStatus":"done","pickingDoneAt":1729000300000,"bay":1}', null, null,
  '{"status":"preparing","pickingStatus":"in_progress","pickingDoneAt":null,"carrierAt":null}') -> 'payload' ->> 'pickingStatus';
do $$ begin perform store_patch_order('11111111-1111-1111-1111-111111111111', 601, '{"pickingStatus":"done","pickingDoneAt":1729000400000,"bay":2}', null, null,
  '{"status":"preparing","pickingStatus":"in_progress","pickingDoneAt":null,"carrierAt":null}'); raise notice 'B packs|written';
exception when others then raise notice 'B packs|% %', sqlstate, sqlerrm; end $$;
select 'A hands over', store_patch_order('11111111-1111-1111-1111-111111111111', 601, '{"carrier":{"kind":"client","name":"Peter","at":1729000500000},"deliveredAt":"2026-10-25T09:00:00Z"}', 'completed', null,
  '{"status":"preparing","pickingStatus":"done","pickingDoneAt":1729000300000,"carrierAt":null}') ->> 'status';
do $$ begin perform store_patch_order('11111111-1111-1111-1111-111111111111', 601, '{"carrier":{"kind":"client","name":"Joseph","at":1729000600000}}', 'completed', null,
  '{"status":"preparing","pickingStatus":"done","pickingDoneAt":1729000300000,"carrierAt":null}'); raise notice 'B hands over|written';
exception when others then raise notice 'B hands over|% %', sqlstate, sqlerrm; end $$;

-- 2. What a Store login may not write.
do $$ declare n int; begin update shop_members set role = 'owner' where user_id = auth.uid(); get diagnostics n = row_count; raise notice 'w|own role|% rows', n;
  exception when others then raise notice 'w|own role|refused %', sqlstate; end $$;
do $$ declare n int; begin update shop_members set role = 'store' where user_id = '00000000-0000-0000-0000-00000000000c'; get diagnostics n = row_count; raise notice 'w|manager role|% rows', n;
  exception when others then raise notice 'w|manager role|refused %', sqlstate; end $$;
do $$ begin insert into saved_quotes(shop_id,client_name,status,payload) values ('11111111-1111-1111-1111-111111111111','Fake','preparing','{}'); raise notice 'w|order insert|written';
  exception when others then raise notice 'w|order insert|refused %', sqlstate; end $$;
do $$ declare n int; begin update saved_quotes set client_name = 'Changed' where id = 601; get diagnostics n = row_count; raise notice 'w|order update|% rows', n;
  exception when others then raise notice 'w|order update|refused %', sqlstate; end $$;
do $$ declare n int; begin update customers set name = 'Changed' where id = 'C1'; get diagnostics n = row_count; raise notice 'w|customer update|% rows', n;
  exception when others then raise notice 'w|customer update|refused %', sqlstate; end $$;
do $$ begin perform write_off_stock('11111111-1111-1111-1111-111111111111', array[]::uuid[], '[{"key":"P1","qty":1}]', 'test'); raise notice 'w|write_off_stock|written';
  exception when others then raise notice 'w|write_off_stock|refused %', sqlstate; end $$;
do $$ begin perform accept_stock_count('33333333-3333-3333-3333-333333333333'); raise notice 'w|accept_stock_count|written';
  exception when others then raise notice 'w|accept_stock_count|refused %', sqlstate; end $$;
do $$ begin perform decide_invoice_ask('22222222-2222-2222-2222-222222222222', 'accepted'); raise notice 'w|decide_invoice_ask|written';
  exception when others then raise notice 'w|decide_invoice_ask|refused %', sqlstate; end $$;
do $$ begin perform accept_trip_difference('T1'); raise notice 'w|accept_trip_difference|written';
  exception when others then raise notice 'w|accept_trip_difference|refused %', sqlstate; end $$;
-- What it may: its own asks.
do $$ begin insert into store_asks(shop_id,kind,ref,asked_by,asked_by_name,payload) values ('11111111-1111-1111-1111-111111111111','restock','P1',auth.uid(),'Musa','{}'); raise notice 'w|own ask|written';
  exception when others then raise notice 'w|own ask|refused %', sqlstate; end $$;

-- 3. The members, as the phone reads them.
select 'member', m ->> 'role', coalesce(m ->> 'name', '∅') from jsonb_array_elements(store_live('11111111-1111-1111-1111-111111111111') -> 'members') m order by m ->> 'role';
reset role;
select 'row', status, payload -> 'carrier' ->> 'name', payload ->> 'bay' from saved_quotes where id = 601;
