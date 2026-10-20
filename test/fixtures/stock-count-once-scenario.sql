-- 0141, asked of a real database: a stock count accepted while orders are
-- packed or delivered but not invoiced counts their goods back in, so the
-- invoice takes them off once, and only a real loss comes off at the count.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Ruth Nakato','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W2','Grace Akello','sales','00000000-0000-0000-0000-00000000000d');
-- No default markup: a product with no markup of its own has no selling price.
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into suppliers(shop_id, id, name) values ('11111111-1111-1111-1111-111111111111','S1','Maria Building Materials');
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','BB Silicone');
insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','P1','P1',20);
insert into stock_lots(shop_id,key,qty,cost) values ('11111111-1111-1111-1111-111111111111','P1',20,30000);
insert into saved_quotes(id, shop_id, client_name, status, invoiced, amount_paid, payload) overriding system value values
 -- packed (picking done), not invoiced: 3 have left the shelf
 (9601,'11111111-1111-1111-1111-111111111111','Kato Construction','preparing',false,150000,
  '{"pickingStatus":"done","client":{"name":"Kato Construction"},"items":[{"productId":"P1","productName":"BB Silicone","qty":3,"price":30000,"sellPrice":50000,"unit":"piece","supplierId":"__stock__","pickStatus":"done"}]}'),
 -- delivered short: 2 of 4 went
 (9602,'11111111-1111-1111-1111-111111111111','Ggaba Stores','completed',false,100000,
  '{"client":{"name":"Ggaba Stores"},"items":[{"productId":"P1","productName":"BB Silicone","qty":4,"pickedQty":2,"price":30000,"sellPrice":50000,"unit":"piece","supplierId":"__stock__","pickStatus":"short"}]}'),
 -- still in Checking: nothing has left the shelf
 (9603,'11111111-1111-1111-1111-111111111111','Lubowa Builders','draft',false,0,
  '{"client":{"name":"Lubowa Builders"},"items":[{"productId":"P1","productName":"BB Silicone","qty":5,"price":30000,"sellPrice":50000,"unit":"piece","supplierId":"__stock__"}]}'),
 -- packed but voided: not held
 (9604,'11111111-1111-1111-1111-111111111111','Nansana Hardware','preparing',false,0,
  '{"pickingStatus":"done","client":{"name":"Nansana Hardware"},"items":[{"productId":"P1","productName":"BB Silicone","qty":6,"price":30000,"sellPrice":50000,"unit":"piece","supplierId":"__stock__","pickStatus":"done"}]}');
update saved_quotes set voided = true where id = 9604;
-- The shelf holds 15: 20 less the 3 packed and the 2 delivered.
insert into stock_counts(id, shop_id, counted_by, counted_by_name, lines) values
 ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','Grace',
  '[{"key":"P1","productId":"P1","name":"BB Silicone","counted":15,"system":20}]');

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  begin execute q;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;

select _try('check: what has left the shelf for orders not yet invoiced is 5 (3 packed + 2 delivered short)', 'ok', $q$select _is($c$ow_held_gone('11111111-1111-1111-1111-111111111111', 'P1') = 5$c$)$q$);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: accepts the count of 15', 'ok', $q$select accept_stock_count('cccccccc-0000-0000-0000-000000000001')$q$);
reset role;
select _try('check: the books keep the 5 the invoices will take: 20, not 15', 'ok', $q$select _is($c$(select qty from stock where key='P1') = 20$c$)$q$);
select _try('check: the stock log says why', 'ok', $q$select _is($c$not exists(select 1 from stock_log where key='P1' and type='count')$c$)$q$);
update saved_quotes set status = 'completed' where id = 9601;
set request.jwt.claim.sub = '';
select _try('the 24-hour run would invoice them; the Manager invoices both now', 'ok', $q$select 1$q$);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: invoices the packed order', 'ok', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 9601)$q$);
reset role;
select _try('check: after its invoice the books are 17, once taken', 'ok', $q$select _is($c$(select qty from stock where key='P1') = 17$c$)$q$);
-- a real loss: the shelf is one short of what the books expect
insert into stock_counts(id, shop_id, counted_by, counted_by_name, lines) values
 ('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','Grace',
  '[{"key":"P1","productId":"P1","name":"BB Silicone","counted":14,"system":17}]');
set role authenticated;
select _try('manager: accepts a count one short (14 on the shelf, 2 still out for Ggaba)', 'ok', $q$select accept_stock_count('cccccccc-0000-0000-0000-000000000002')$q$);
reset role;
select _try('check: only the real loss comes off: 16', 'ok', $q$select _is($c$(select qty from stock where key='P1') = 16 and exists(select 1 from stock_log where key='P1' and type='count' and delta = -1 and note like '%2 out on orders not yet invoiced%')$c$)$q$);

select case when (expect = 'ok' and got = 'ok') or (expect like 'refused%' and got like expect || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
