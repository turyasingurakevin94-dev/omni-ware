-- 0162 asked of a real database (test/store-round3.test.js): a Store write that says what the phone
-- saw is refused when the order has moved since; without p_expect it behaves as before.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','o@x'),('00000000-0000-0000-0000-00000000000e','s@x');
insert into shops(id,name,created_by) values ('11111111-1111-1111-1111-111111111111','M','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store');
insert into staff(shop_id,id,name,role,user_id) values ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e');
insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (576,'11111111-1111-1111-1111-111111111111','Kato','preparing',
 '{"pickingStatus":"done","pickingDoneAt":1729000000000,"bay":2,"items":[{"lineId":1,"productId":"P1","qty":20,"unit":"Box","pickStatus":"done"}]}');
\unset ON_ERROR_STOP
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
-- Tab A hands it over, having seen it packed.
select 'hand over', store_patch_order('11111111-1111-1111-1111-111111111111', 576, '{"carrier":{"kind":"client","name":"Peter","at":1729000500000}}', null, null,
  '{"status":"preparing","pickingStatus":"done","pickingDoneAt":1729000000000,"carrierAt":null}') -> 'payload' -> 'carrier' ->> 'name';
-- Tab B still shows it packed with no carrier, and unpacks: refused.
do $$ begin perform store_patch_order('11111111-1111-1111-1111-111111111111', 576, '{"pickingStatus":"in_progress","pickingDoneAt":null,"bay":null}', null, null,
  '{"status":"preparing","pickingStatus":"done","pickingDoneAt":1729000000000,"carrierAt":null}'); raise notice 'unpack|written';
exception when others then raise notice 'unpack|% %', sqlstate, sqlerrm; end $$;
-- An app not yet updated sends no p_expect: it still writes.
select 'no expect', store_patch_order('11111111-1111-1111-1111-111111111111', 576, '{"deliveredNote":"kept"}', null, null) -> 'payload' ->> 'deliveredNote';
reset role;
select 'row', payload ->> 'pickingStatus', payload -> 'carrier' ->> 'name', payload ->> 'bay' from saved_quotes where id = 576;
