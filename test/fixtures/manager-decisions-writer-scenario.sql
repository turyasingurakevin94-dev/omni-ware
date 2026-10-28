-- 0175 asked of a real database (journey Q5, Q12): the Manager's answers on
-- an order — the credit answer, a short pick settled, credit notes, a price
-- decision — are written only by whoever holds the task.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000c','buyer@x'),('00000000-0000-0000-0000-00000000000d','sales@x'),
 ('00000000-0000-0000-0000-00000000000f','accounts@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c','buyer'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;

-- #0701 Ken's order in Checking.  #0702 delivered, packed 8 of 10.  #0703 delivered and invoiced (70,000).
-- #0704-#0707 a line Sales sold under the shop's price (35,000 on a cost of 30,000) and the Manager approved.
set session_replication_role = replica;
insert into customers(shop_id,id,name,debt) values ('11111111-1111-1111-1111-111111111111','C1','Ken',70000);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, payload) overriding system value values
 (701,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft',false,'{"customerId":"C1","payments":[],"items":[{"lineId":1,"productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}'),
 (702,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'completed',false,'{"customerId":"C1","payments":[],"items":[{"lineId":1,"productName":"Nails","qty":10,"pickedQty":8,"pickStatus":"short","price":3000,"sellPrice":3500,"supplierId":"__stock__"}]}'),
 (703,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'completed',true,'{"customerId":"C1","payments":[],"debtCharged":70000,"items":[{"lineId":1,"productName":"Cement","qty":2,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}');
insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value
 select g, '11111111-1111-1111-1111-111111111111', 'Ken', ow_today(), 'draft',
   '{"customerId":"C1","payments":[],"items":[{"lineId":1,"productName":"Iron sheet","qty":1,"price":30000,"sellPrice":35000,"supplierId":"S1","priceBy":"00000000-0000-0000-0000-00000000000d","priceNote":"under","priceReview":{"state":"approved","price":35000,"was":35000,"qty":1,"by":"00000000-0000-0000-0000-00000000000b"}}]}'::jsonb
   from generate_series(704, 707) g;
set session_replication_role = origin;

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  declare n int; begin execute q; get diagnostics n = row_count;
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then got := 'refused: 0 rows (row-level security hid them)'; end if;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;
create function _p(p_id bigint) returns jsonb language sql security definer as $$ select payload from saved_quotes where id = p_id $$;
grant execute on function _p to authenticated;

set role authenticated;
-- ---------------- the credit answer (credit.release)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: writes Release on #0701', 'refused:42501', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"release"}}' where id=701$q$);
select _try('sales: a new order that carries a Release', 'refused:42501', $q$insert into saved_quotes(id, shop_id, client_name, date, status, payload) overriding system value values (720,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'draft','{"customerId":"C1","payments":[],"creditCheck":{"decision":"release"},"items":[{"lineId":1,"productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: says Release on #0701', 'ok', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"release","by":"00000000-0000-0000-0000-00000000000b"}}' where id=701$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: turns it into Hold', 'refused:42501', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"hold"}}' where id=701$q$);
select _try('buyer: takes it off', 'refused:42501', $q$update saved_quotes set payload = payload - 'creditCheck' where id=701$q$);
select _try('buyer: other changes to #0701 are still the Buyer''s', 'ok', $q$update saved_quotes set payload = payload || '{"buyerNote":"call S1"}' where id=701$q$);
select _try('check: the Manager''s Release stands', 'ok', $q$select _is($c$_p(701) -> 'creditCheck' ->> 'decision' = 'release'$c$)$q$);

-- ---------------- a short pick settled (pick.settle)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: bills the full 10 on #0702', 'refused:42501', $q$update saved_quotes set payload = payload || jsonb_build_object('pickShortfallAckAt', 1730000000000) where id=702$q$);
select _try('sales: writes the settle record', 'refused:42501', $q$update saved_quotes set payload = payload || '{"pickSettle":{"pick":"full"}}' where id=702$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: bills the full quantity', 'ok', $q$update saved_quotes set payload = payload || jsonb_build_object('pickShortfallAckAt', 1730000000000, 'pickSettle', '{"pick":"full","by":"00000000-0000-0000-0000-00000000000b"}'::jsonb) where id=702$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: a pick that starts again clears the settle date', 'ok', $q$update saved_quotes set payload = payload || '{"pickShortfallAckAt":null}' where id=702$q$);

-- ---------------- credit notes (credit_note.raise)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: raises a credit note on #0703', 'refused', $q$update saved_quotes set payload = payload || '{"creditNotes":[{"id":1,"amount":35000,"reason":"return","lines":[{"idx":0,"qty":1,"price":35000}]}]}' where id=703$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: raises one', 'refused:42501', $q$update saved_quotes set payload = payload || '{"creditNotes":[{"id":1,"amount":35000,"reason":"return","lines":[{"idx":0,"qty":1,"price":35000}]}]}' where id=703$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: raises it', 'ok', $q$update saved_quotes set payload = payload || '{"creditNotes":[{"id":1,"amount":35000,"reason":"return","lines":[{"idx":0,"qty":1,"price":35000}]}]}' where id=703$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: voids it', 'refused:42501', $q$update saved_quotes set payload = payload || '{"creditNotes":[{"id":1,"amount":35000,"reason":"return","voided":true,"lines":[{"idx":0,"qty":1,"price":35000}]}]}' where id=703$q$);
select _try('check: the credit note stands', 'ok', $q$select _is($c$jsonb_array_length(_p(703) -> 'creditNotes') = 1 and not (_p(703) -> 'creditNotes' -> 0 ? 'voided')$c$)$q$);

-- ---------------- the price decision (price.approve)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select _try('buyer: clears the Manager''s yes on #0704, the cost unchanged', 'refused:42501', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,priceReview}', 'null') where id=704$q$);
select _try('buyer: rewrites it', 'refused:42501', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,priceReview,price}', '30000') where id=704$q$);
select _try('buyer: takes a dearer price (36,000, past the 35,000 decided) and clears the yes, as the Buyer app does', 'ok', $q$update saved_quotes set payload = jsonb_set(jsonb_set(jsonb_set(payload, '{items,0,price}', '36000'), '{items,0,priceWas}', '30000'), '{items,0,priceReview}', 'null') where id=705$q$);
select _try('buyer: takes a dearer price (36,000) on #0706 and leaves the yes', 'ok', $q$update saved_quotes set payload = jsonb_set(jsonb_set(payload, '{items,0,price}', '36000'), '{items,0,priceWas}', '30000') where id=706$q$);
select _try('check: the database cleared the yes on #0706 — the line waits for the Manager again', 'ok', $q$select _is($c$_p(706) -> 'items' -> 0 -> 'priceReview' = 'null'::jsonb and _p(705) -> 'items' -> 0 -> 'priceReview' = 'null'::jsonb$c$)$q$);
select _try('check: the Manager is pushed (0153)', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind='price.waits' and ref->>'id'='706')$c$)$q$);
select _try('buyer: a dearer price still under the sale (32,000) does not clear the yes', 'refused:42501', $q$update saved_quotes set payload = jsonb_set(jsonb_set(payload, '{items,0,price}', '32000'), '{items,0,priceReview}', 'null') where id=707$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: saves #0704 again, its decision as it was', 'ok', $q$update saved_quotes set payload = payload || '{"note":"deliver after 2pm"}' where id=704$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: decides #0705 again at 38,000', 'ok', $q$update saved_quotes set payload = jsonb_set(jsonb_set(payload, '{items,0,sellPrice}', '38000'), '{items,0,priceReview}', '{"state":"changed","price":38000,"was":35000,"qty":1,"by":"00000000-0000-0000-0000-00000000000b"}') where id=705$q$);

-- ---------------- the owner, and the server
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner (console): holds every task', 'ok', $q$update saved_quotes set payload = payload || '{"creditCheck":{"decision":"hold"}}' where id=701$q$);
reset role;
set request.jwt.claim.sub = '';
select _try('server, no login: not judged', 'ok', $q$update saved_quotes set payload = payload - 'creditCheck' where id=701$q$);

select case when (expect = 'ok' and got = 'ok') or (expect = 'refused' and got like 'refused%')
              or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
