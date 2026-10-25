-- 0165 asked of a real database (Sales round 1, data integrity): an order's
-- money holds together whoever writes — Sales, the Manager, Accounts, the owner.
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

-- The seed is written as it would be after a clean history (the checks are off while it goes in).
set session_replication_role = replica;
insert into customers(shop_id,id,name,debt) values
 ('11111111-1111-1111-1111-111111111111','C1','Kato Construction',420000),
 ('11111111-1111-1111-1111-111111111111','C3','Lubowa Builders',420000),
 ('11111111-1111-1111-1111-111111111111','C4','Ggaba Stores',200000),
 ('11111111-1111-1111-1111-111111111111','C5','Nansana Hardware',0);
insert into customer_debt_log(id, shop_id, customer_id, date, type, amount, note, quote_id) values
 (1,'11111111-1111-1111-1111-111111111111','C1','2026-10-01','charge',420000,'Auto-sync — INV-0100',100),
 (2,'11111111-1111-1111-1111-111111111111','C3','2026-10-01','charge',420000,'Auto-sync — INV-0105',105),
 (3,'11111111-1111-1111-1111-111111111111','C4','2026-10-01','charge',200000,'Auto-sync — INV-0106',106);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, invoiced_at, amount_paid, payload) overriding system value values
 (100,'11111111-1111-1111-1111-111111111111','Kato Construction','2026-10-01','completed',true,'2026-10-01',0,'{"customerId":"C1","debtCharged":420000,"items":[{"lineId":1,"productName":"Iron sheet","qty":1,"price":300000,"sellPrice":420000,"supplierId":"__stock__"}],"payments":[]}'),
 (101,'11111111-1111-1111-1111-111111111111','Kato Construction','2026-10-20','preparing',false,null,0,'{"customerId":"C1","items":[{"lineId":1,"productName":"Cement","qty":10,"price":25000,"sellPrice":30000,"supplierId":"__stock__"}],"payments":[]}'),
 (102,'11111111-1111-1111-1111-111111111111','Walk-in','2026-10-20','preparing',false,null,0,'{"items":[{"lineId":1,"productName":"Nails","qty":2,"price":40000,"sellPrice":50000,"supplierId":"__stock__"}],"payments":[]}'),
 (103,'11111111-1111-1111-1111-111111111111','Walk-in','2026-10-19','completed',true,'2026-10-19',100000,'{"items":[{"lineId":1,"productName":"Hinge","qty":2,"price":40000,"sellPrice":50000,"supplierId":"__stock__"},{"lineId":2,"productName":"Door closer","qty":2,"price":90000,"productId":"NOPE","supplierId":"S9"},{"lineId":3,"productName":"Glass door lock","qty":0,"price":5000,"sellPrice":8000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-10-19","amount":100000,"cashTxnId":9003}]}'),
 (104,'11111111-1111-1111-1111-111111111111','Lubowa Builders','2026-10-20','completed',false,null,0,'{"customerId":"C3","items":[{"lineId":1,"productName":"Paint","qty":1,"price":30000,"sellPrice":50000,"supplierId":"__stock__"}],"payments":[]}'),
 (105,'11111111-1111-1111-1111-111111111111','Lubowa Builders','2026-10-01','completed',true,'2026-10-01',0,'{"customerId":"C3","debtCharged":420000,"items":[{"lineId":1,"productName":"Iron sheet","qty":1,"price":300000,"sellPrice":420000,"supplierId":"__stock__"}],"payments":[]}'),
 (106,'11111111-1111-1111-1111-111111111111','Ggaba Stores','2026-10-01','completed',true,'2026-10-01',0,'{"customerId":"C4","debtCharged":200000,"items":[{"lineId":1,"productName":"Wire","qty":1,"price":150000,"sellPrice":200000,"supplierId":"__stock__"}],"payments":[]}');
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id) values
 (9003,'11111111-1111-1111-1111-111111111111','2026-10-19','cash','receipt','Invoice Payment',100000,'Payment — order #0103',103),
 (9100,'11111111-1111-1111-1111-111111111111','2026-10-05','cash','receipt','Debt Payment',871500,'Payment — Mulongo',null);
set session_replication_role = origin;

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

-- ---------------- SAL-005: paid over is change, or a deposit the customer confirms
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: 470,000 on 420,000 with no answer is refused', 'refused', $q$select receive_payment('11111111-1111-1111-1111-111111111111','C1',470000,'momo')$q$);
select _try('sales: 470,000 on 420,000, change', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111','C1',470000,'momo',null,null,null,'change')$q$);
select _try('check: change — 420,000 money in, the bill paid, Kato owes 0', 'ok', $q$select _is($c$(select sum(amount) from cash_txns where description like 'Payment — INV-0100%') = 420000 and (select debt from customers where id='C1') = 0 and (select amount_paid from saved_quotes where id=100) = 420000 and (select (payload->>'debtCharged')::numeric from saved_quotes where id=100) = 0$c$)$q$);
select _try('sales: 470,000 on 420,000, a deposit', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111','C3',470000,'cash',null,null,null,'deposit')$q$);
select _try('check: deposit — 470,000 money in, Lubowa''s balance is -50,000, logged as a deposit', 'ok', $q$select _is($c$(select debt from customers where id='C3') = -50000 and exists(select 1 from customer_debt_log where customer_id='C3' and note='Deposit' and amount=50000 and cash_txn_id is not null)$c$)$q$);
select _try('sales: a walk-in order paid over can''t keep a deposit', 'refused', $q$select receive_payment('11111111-1111-1111-1111-111111111111',null,150000,'cash',null,102,null,'deposit')$q$);
select _try('sales: a walk-in order paid over, change', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111',null,150000,'cash',null,102,null,'change')$q$);
select _try('check: only the 100,000 owed went on the walk-in order', 'ok', $q$select _is($c$(select amount_paid from saved_quotes where id=102) = 100000$c$)$q$);
select _try('sales: Kato''s order before its invoice, 350,000 on 300,000, a deposit', 'ok', $q$select receive_payment('11111111-1111-1111-1111-111111111111',null,350000,'cash',null,101,null,'deposit')$q$);
select _try('check: the order is paid 300,000 and Kato has a 50,000 deposit', 'ok', $q$select _is($c$(select amount_paid from saved_quotes where id=101) = 300000 and (select debt from customers where id='C1') = -50000$c$)$q$);

-- ---------------- SAL-005 / SAL-011: an invoice uses the deposit first
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: invoices Lubowa''s 50,000 order, which uses the deposit', 'ok', $q$select invoice_order('11111111-1111-1111-1111-111111111111',104)$q$);
select _try('check: #104 paid 50,000 from the deposit, nothing charged, Lubowa owes 0', 'ok', $q$select _is($c$(select amount_paid from saved_quotes where id=104) = 50000 and (select (payload->>'debtCharged')::numeric from saved_quotes where id=104) = 0 and (select debt from customers where id='C3') = 0 and exists(select 1 from saved_quotes, jsonb_array_elements(payload->'payments') p where id=104 and p->>'fromDeposit'='true')$c$)$q$);

-- ---------------- SAL-007 / SAL-003 / SAL-004: totals
select _try('check: a line nobody priced is never in a total (#103: 100,000, not 280,000)', 'ok', $q$select _is($c$ow_order_total('11111111-1111-1111-1111-111111111111',(select payload from saved_quotes where id=103)) = 100000$c$)$q$);
select _try('check: whole UGX per line (1.5 × 333 + 1,001 + 2.5% + 999.6)', 'ok', $q$select _is($c$ow_order_total('11111111-1111-1111-1111-111111111111','{"items":[{"qty":1.5,"sellPrice":333},{"qty":1,"sellPrice":1001},{"qty":1,"sellPrice":999.6}],"charges":[{"type":"percent","value":2.5}]}'::jsonb) = round(ow_order_total('11111111-1111-1111-1111-111111111111','{"items":[{"qty":1.5,"sellPrice":333},{"qty":1,"sellPrice":1001},{"qty":1,"sellPrice":999.6}],"charges":[{"type":"percent","value":2.5}]}'::jsonb))$c$)$q$);
select _try('check: a total never goes below 0', 'ok', $q$select _is($c$ow_order_total('11111111-1111-1111-1111-111111111111','{"items":[{"qty":1,"sellPrice":1000}],"creditNotes":[{"amount":6000}]}'::jsonb) = 0$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: a credit note above the bill is refused', 'refused', $q$update saved_quotes set payload = payload || '{"creditNotes":[{"id":1,"amount":250000}]}' where id=106$q$);
select _try('manager: a 50,000 credit note on Ggaba''s 200,000 bill', 'ok', $q$update saved_quotes set payload = payload || '{"creditNotes":[{"id":1,"amount":50000}]}' where id=106$q$);
select _try('check: the server moved Ggaba''s balance with it (150,000, logged)', 'ok', $q$select _is($c$(select debt from customers where id='C4') = 150000 and (select (payload->>'debtCharged')::numeric from saved_quotes where id=106) = 150000 and exists(select 1 from customer_debt_log where customer_id='C4' and type='payment' and amount=50000 and quote_id=106)$c$)$q$);

select _try('manager: voids Ggaba''s INV-0106', 'ok', $q$update saved_quotes set voided = true where id=106$q$);
select _try('check: the server took the void''s 150,000 off Ggaba''s balance, once', 'ok', $q$select _is($c$(select debt from customers where id='C4') = 0 and (select count(*) from customer_debt_log where customer_id='C4' and quote_id=106) = 3$c$)$q$);

-- ---------------- SAL-006: counts and prices
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: a count of -3 is refused', 'refused', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',102,'{"items":[{"lineId":1,"productName":"Nails","qty":-3,"sellPrice":50000}]}')$q$);
select _try('sales: a price of -500 is refused', 'refused', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',102,'{"items":[{"lineId":1,"productName":"Nails","qty":2,"sellPrice":-500}]}')$q$);

-- ---------------- SAL-013: a patch never writes over a payment
select _try('sales: change the walk-in''s lines with a patch', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',102,'{"items":[{"lineId":1,"productName":"Nails","qty":3,"price":40000,"sellPrice":50000,"supplierId":"__stock__"}]}', 'Walk-in', '')$q$);
select _try('check: the payment taken before the patch is still on it', 'ok', $q$select _is($c$jsonb_array_length((select payload->'payments' from saved_quotes where id=102)) = 1 and (select amount_paid from saved_quotes where id=102) = 100000$c$)$q$);
select _try('sales: a patch may not touch payments', 'refused', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',102,'{"payments":[]}')$q$);
select _try('sales: a stale copy written back without the payment is refused', 'refused', $q$update saved_quotes set payload = payload || '{"payments":[]}' where id=102$q$);

-- ---------------- SAL-010 / SAL-012: payments, receipts, and what is paid
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: paid raised with no payment is refused', 'refused', $q$update saved_quotes set amount_paid = 155000 where id=106$q$);
select _try('owner: a 5,000 payment pointing at another customer''s 871,500 receipt is refused', 'refused', $q$update saved_quotes set amount_paid = 5000, payload = payload || '{"payments":[{"id":1,"date":"2026-10-05","amount":5000,"cashTxnId":9100}]}' where id=106$q$);
select _try('owner: a payment with no receipt at all is refused', 'refused', $q$update saved_quotes set amount_paid = 5000, payload = payload || '{"payments":[{"id":1,"date":"2026-10-05","amount":5000}]}' where id=106$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: a receipt a payment points to can''t change its amount on its own', 'refused', $q$update cash_txns set amount = 90000 where id=9003$q$);
select _try('accounts: corrects #103''s payment to 90,000 in one go', 'ok', $q$select ow_correct_payment('11111111-1111-1111-1111-111111111111',103,'1',90000)$q$);
select _try('check: the receipt and the payment both say 90,000', 'ok', $q$select _is($c$(select amount from cash_txns where id=9003) = 90000 and (select amount_paid from saved_quotes where id=103) = 90000$c$)$q$);
select _try('accounts: a payment can''t move onto a voided bill', 'refused', $q$select ow_correct_payment('11111111-1111-1111-1111-111111111111',100,'1',null,null,null,106)$q$);
select _try('accounts: moves Kato''s INV-0100 payment to Lubowa''s INV-0105', 'ok', $q$select ow_correct_payment('11111111-1111-1111-1111-111111111111',100,'1',null,null,null,105)$q$);
select _try('check: the receipt names #105, and both balances moved (Kato 420,000 less his 50,000 deposit = 370,000; Lubowa 0)', 'ok', $q$select _is($c$(select quote_id from cash_txns where id = (select (p->>'cashTxnId')::bigint from saved_quotes, jsonb_array_elements(payload->'payments') p where id=105 limit 1)) = 105 and (select debt from customers where id='C1') = 370000 and (select debt from customers where id='C3') = 0$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: may not correct a payment', 'refused', $q$select ow_correct_payment('11111111-1111-1111-1111-111111111111',103,'1',80000)$q$);

-- ---------------- asks, and the balance check
select _try('sales: asks Accounts to check a balance (no receipt)', 'ok', $q$insert into payment_asks(shop_id, customer_id, what, amount, asked_by) values ('11111111-1111-1111-1111-111111111111','C1','balance',349000,'00000000-0000-0000-0000-00000000000d')$q$);
select _try('sales: any other ask needs its receipt', 'refused', $q$insert into payment_asks(shop_id, customer_id, what, amount, asked_by) values ('11111111-1111-1111-1111-111111111111','C1','method',1000,'00000000-0000-0000-0000-00000000000d')$q$);
select _try('sales: asks Esther to settle a paid-over order', 'ok', $q$insert into payment_asks(shop_id, cash_txn_id, quote_id, what, amount, asked_by) values ('11111111-1111-1111-1111-111111111111',9003,103,'over',25000,'00000000-0000-0000-0000-00000000000d')$q$);
select _try('sales: a patch may not drop the money keys either', 'refused', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',102,'{}',null,null,array['debtCharged'])$q$);
select _try('sales: a patch drops a key and keeps the payment', 'ok', $q$select ow_patch_order('11111111-1111-1111-1111-111111111111',102,'{"note":"x"}',null,null,array['note'])$q$);
-- Esther settles an order paid over: 120,000 paid on a 100,000 order (seeded the old way)
reset role;
set request.jwt.claim.sub = '';
select set_config('ow.money_fix', 'on', false);
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id) values (9200,'11111111-1111-1111-1111-111111111111','2026-10-10','cash','receipt','Invoice Payment',120000,'Payment — order #0107',107);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, invoiced_at, amount_paid, payload) overriding system value values
 (107,'11111111-1111-1111-1111-111111111111','Nansana Hardware','2026-10-10','completed',true,'2026-10-10',120000,'{"customerId":"C5","debtCharged":0,"items":[{"lineId":1,"productName":"Tiles","qty":1,"price":80000,"sellPrice":100000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-10-10","amount":120000,"cashTxnId":9200}]}');
select set_config('ow.money_fix', '', false);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: may not settle a paid-over order', 'refused', $q$select ow_settle_over('11111111-1111-1111-1111-111111111111',107,'deposit')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: settles #107''s 20,000 over as Nansana''s deposit', 'ok', $q$select ow_settle_over('11111111-1111-1111-1111-111111111111',107,'deposit')$q$);
select _try('check: #107 paid 100,000 and its receipt 100,000; Nansana has a 20,000 deposit; the cash book still says 120,000', 'ok', $q$select _is($c$(select amount_paid from saved_quotes where id=107) = 100000 and (select amount from cash_txns where id=9200) = 100000 and (select debt from customers where id='C5') = -20000 and (select sum(amount) from cash_txns where description like '%#0107%' or id=9200) = 120000$c$)$q$);
select _try('accounts: nothing is left over to settle twice', 'refused', $q$select ow_settle_over('11111111-1111-1111-1111-111111111111',107,'change')$q$);
reset role;
-- a credit note with its refund (the owner console): money out is a payment below 0, its cash row a payment
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: the refund''s cash row goes out', 'ok', $q$insert into cash_txns(id,shop_id,date,account,type,category,amount,description) values (9300,'11111111-1111-1111-1111-111111111111','2026-10-20','cash','payment','Customer Refund',10000,'Refund — CN-0001 on INV-0103')$q$);
select _try('owner: a refund above 0 is refused', 'refused', $q$update saved_quotes set amount_paid = 100000, payload = jsonb_set(payload || '{"creditNotes":[{"id":1,"no":1,"amount":10000,"lines":[]}]}', '{payments}', (payload->'payments') || '[{"id":2,"date":"2026-10-20","amount":10000,"refund":true,"cashTxnId":9300}]') where id=103$q$);
select _try('owner: a refund that is not its cash row is refused', 'refused', $q$update saved_quotes set amount_paid = 85000, payload = jsonb_set(payload || '{"creditNotes":[{"id":1,"no":1,"amount":10000,"lines":[]}]}', '{payments}', (payload->'payments') || '[{"id":2,"date":"2026-10-20","amount":-5000,"refund":true,"cashTxnId":9300}]') where id=103$q$);
select _try('owner: a credit note with its 10,000 refund is kept', 'ok', $q$update saved_quotes set amount_paid = 80000, payload = jsonb_set(payload || '{"creditNotes":[{"id":1,"no":1,"amount":10000,"lines":[]}]}', '{payments}', (payload->'payments') || '[{"id":2,"date":"2026-10-20","amount":-10000,"refund":true,"cashTxnId":9300}]') where id=103$q$);
select _try('check: every balance adds up after all of it, but Kato''s: his 50,000 deposit sits beside his open 420,000 bill, and the check says so', 'ok', $q$select _is($c$(select string_agg(customer_id || ':' || gap, ',') from ow_balance_check where shop_id='11111111-1111-1111-1111-111111111111') = 'C1:-50000'$c$)$q$);
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
