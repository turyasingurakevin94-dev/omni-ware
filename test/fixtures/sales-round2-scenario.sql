-- 0167 asked of a real database (Sales round 2, core workflows): credit for a
-- customer with no limit set waits for the Manager; test records are marked.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x'),('00000000-0000-0000-0000-00000000000f','accounts@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts');
insert into customers(shop_id,id,name,debt,credit_limit) values
 ('11111111-1111-1111-1111-111111111111','C1','Kato Construction',0,3000000),
 ('11111111-1111-1111-1111-111111111111','C2','Mukono Roofing',0,null),
 ('11111111-1111-1111-1111-111111111111','C3','Testimony Hardware',0,null);

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  declare n int; begin execute q; get diagnostics n = row_count;
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then got := 'refused: 0 rows (row-level security hid them)'; end if;
  exception when others then got := 'refused: ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;

set role authenticated;

-- ---------------- SAL-016: credit with no limit set is the Manager's yes
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: Mukono (no limit) on credit +3%', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (201,'11111111-1111-1111-1111-111111111111','Mukono Roofing','draft','{"customerId":"C2","credit":{"pct":3,"days":30},"items":[{"lineId":1,"productName":"Iron sheet","qty":40,"price":30000,"sellPrice":38200,"supplierId":"__stock__"}]}')$q$);
select _try('check: it waits in Checking for the Manager, as credit', 'ok', $q$select _is($c$(select status from saved_quotes where id=201) = 'draft' and (select payload->'gateHeldMove'->>'why' from saved_quotes where id=201) = 'credit'$c$)$q$);
select _try('check: the Manager is pushed, and the push says no limit is set', 'ok', $q$select _is($c$(select body from push_outbox where kind='credit.hold' and ref->>'id'='201') like 'Mukono Roofing would owe 1,573,840 · no limit set'$c$)$q$);
select _try('sales: may not move it on before the Manager says', 'ok', $q$update saved_quotes set status = 'preparing' where id=201$q$);
select _try('check: still in Checking', 'ok', $q$select _is($c$(select status from saved_quotes where id=201) = 'draft'$c$)$q$);
select _try('sales: Mukono for cash goes straight on', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (202,'11111111-1111-1111-1111-111111111111','Mukono Roofing','draft','{"customerId":"C2","items":[{"lineId":1,"productName":"Iron sheet","qty":2,"price":30000,"sellPrice":38200,"supplierId":"__stock__"}]}')$q$);
select _try('check: the cash order is packing', 'ok', $q$select _is($c$(select status from saved_quotes where id=202) = 'preparing'$c$)$q$);
select _try('sales: Kato on credit, within his 3,000,000 limit', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (203,'11111111-1111-1111-1111-111111111111','Kato Construction','draft','{"customerId":"C1","credit":{"pct":3,"days":30},"items":[{"lineId":1,"productName":"Iron sheet","qty":40,"price":30000,"sellPrice":38200,"supplierId":"__stock__"}]}')$q$);
select _try('check: within the limit it goes straight on, as before', 'ok', $q$select _is($c$(select status from saved_quotes where id=203) = 'preparing'$c$)$q$);
select _try('sales: Kato on credit over his limit', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (204,'11111111-1111-1111-1111-111111111111','Kato Construction','draft','{"customerId":"C1","credit":{"pct":3,"days":30},"items":[{"lineId":1,"productName":"Iron sheet","qty":100,"price":30000,"sellPrice":38200,"supplierId":"__stock__"}]}')$q$);
select _try('check: over a set limit it waits, as before, and the push names the limit', 'ok', $q$select _is($c$(select status from saved_quotes where id=204) = 'draft' and (select body from push_outbox where kind='credit.hold' and ref->>'id'='204') like '% of a 3,000,000 limit'$c$)$q$);
select _try('sales: Mukono again on credit, for the cash-first answer', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (205,'11111111-1111-1111-1111-111111111111','Mukono Roofing','draft','{"customerId":"C2","credit":{"pct":3,"days":30},"items":[{"lineId":1,"productName":"Wheelbarrow","qty":2,"price":120000,"sellPrice":165000,"supplierId":"__stock__"}]}')$q$);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: says yes to credit for #201', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',201,'{"creditCheck":{"decision":"release","byName":"Ruth Nakato"}}')$q$);
select _try('check: #201 moved on by itself', 'ok', $q$select _is($c$(select status from saved_quotes where id=201) = 'preparing'$c$)$q$);
select _try('manager: says cash first for #205', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',205,'{"creditCheck":{"decision":"cash","byName":"Ruth Nakato"}}')$q$);
select _try('check: cash first holds #205 until it is paid', 'ok', $q$select _is($c$(select status from saved_quotes where id=205) = 'draft'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: Mukono pays #205 in full', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111',null,339900,'cash',null,205)$q$);
select _try('check: paid, #205 moves on', 'ok', $q$select _is($c$(select status from saved_quotes where id=205) = 'preparing'$c$)$q$);

-- ---------------- SAL-018: test records are marked, kept, and never by mistake
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: a customer named TEST Claude QA', 'ok', $q$insert into customers(shop_id,id,name,debt) values ('11111111-1111-1111-1111-111111111111','C9','TEST Claude QA',0)$q$);
select _try('check: TEST Claude QA is a test customer; Testimony Hardware is not', 'ok', $q$select _is($c$(select qa from customers where id='C9') and not (select qa from customers where id='C3')$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: an order for TEST Claude QA', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (301,'11111111-1111-1111-1111-111111111111','TEST Claude QA','draft','{"customerId":"C9","items":[{"lineId":1,"productName":"Silicone","qty":2,"price":7000,"sellPrice":9500,"supplierId":"__stock__"}]}')$q$);
select _try('sales: a walk-in named TEST walk-in', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (302,'11111111-1111-1111-1111-111111111111','TEST walk-in','draft','{"client":{"name":"TEST walk-in"},"items":[{"lineId":1,"productName":"Silicone","qty":1,"price":7000,"sellPrice":9500,"supplierId":"__stock__"}]}')$q$);
select _try('sales: an order for Testimony Hardware', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (303,'11111111-1111-1111-1111-111111111111','Testimony Hardware','draft','{"customerId":"C3","items":[{"lineId":1,"productName":"Silicone","qty":1,"price":7000,"sellPrice":9500,"supplierId":"__stock__"}]}')$q$);
select _try('check: the two test orders are marked; Testimony''s is not', 'ok', $q$select _is($c$(select qa from saved_quotes where id=301) and (select qa from saved_quotes where id=302) and not (select qa from saved_quotes where id=303) and not (select qa from saved_quotes where id=201)$c$)$q$);
select _try('sales: the test customer pays their order', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111',null,19000,'momo',null,301,'TESTQA123')$q$);
select _try('sales: Testimony pays theirs', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111',null,9500,'cash',null,303)$q$);
select _try('check: the test receipt is marked, the real one is not', 'ok', $q$select _is($c$(select bool_and(qa) from cash_txns where quote_id=301) and not (select bool_or(qa) from cash_txns where quote_id=303)$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: a receipt whose ref is TESTQA', 'ok', $q$insert into cash_txns(id,shop_id,date,account,type,category,amount,description) values (9900,'11111111-1111-1111-1111-111111111111','2026-10-23','momo','receipt','Sales Revenue',11500,'Payment — order #0564 · ref TESTQA456')$q$);
select _try('check: a TESTQA ref is a test receipt', 'ok', $q$select _is($c$(select qa from cash_txns where id=9900)$c$)$q$);
select _try('check: nothing was deleted: the test order and its money are all still there', 'ok', $q$select _is($c$(select count(*) from saved_quotes where id in (301,302)) = 2 and (select amount_paid from saved_quotes where id=301) = 19000$c$)$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
