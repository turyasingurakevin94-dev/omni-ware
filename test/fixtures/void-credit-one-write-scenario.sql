-- 0176 asked of a real database (journey Q6): a void and a credit note are
-- each one write — all of it, or none of it.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role,display_name) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner','Kevin'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','Ruth Nakato'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales','Grace Akello');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111','{}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Cement');

-- On the books (the checks are off while it goes in): 8 bags on the shelf.
--   #0801 invoiced, 2 bags off the shelf, 70,000 owed.   #0802 invoiced, 1 bag, paid 35,000 in cash.
--   #0803 invoiced, 4 bags, 140,000 owed.                #0804 delivered, not invoiced.
set session_replication_role = replica;
insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','P1','P1',8);
insert into stock_lots(shop_id,key,qty,cost) values ('11111111-1111-1111-1111-111111111111','P1',8,30000);
insert into customers(shop_id,id,name,debt) values ('11111111-1111-1111-1111-111111111111','C1','Ken',210000);
insert into customer_debt_log(id, shop_id, customer_id, date, type, amount, note, quote_id) values
 (1,'11111111-1111-1111-1111-111111111111','C1',ow_today()-3,'charge',70000,'Auto-sync — INV-0801',801),
 (2,'11111111-1111-1111-1111-111111111111','C1',ow_today()-2,'charge',140000,'Auto-sync — INV-0803',803);
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id) values
 (9802,'11111111-1111-1111-1111-111111111111',ow_today()-3,'cash','receipt','Invoice Payment',35000,'Payment — INV-0802',802);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, invoiced_at, amount_paid, payload) overriding system value values
 (801,'11111111-1111-1111-1111-111111111111','Ken',ow_today()-3,'completed',true,ow_today()-3,0,'{"customerId":"C1","debtCharged":70000,"payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":30000,"sellPrice":35000,"supplierId":"__stock__","_stockTaken":2}]}'),
 (802,'11111111-1111-1111-1111-111111111111','Walk-in',ow_today()-3,'completed',true,ow_today()-3,35000,'{"debtCharged":0,"payments":[{"id":1,"date":"2026-10-25","amount":35000,"cashTxnId":9802,"method":"cash"}],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}'),
 (803,'11111111-1111-1111-1111-111111111111','Ken',ow_today()-2,'completed',true,ow_today()-2,0,'{"customerId":"C1","debtCharged":140000,"payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":4,"price":30000,"sellPrice":35000,"supplierId":"__stock__","_stockTaken":4}]}'),
 (804,'11111111-1111-1111-1111-111111111111','Ken',ow_today(),'completed',false,null,0,'{"customerId":"C1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":30000,"sellPrice":35000,"supplierId":"__stock__"}]}');
insert into invoice_asks(id, shop_id, quote_id, kind, amount, reason, asked_by, asked_by_name, asked_role, status) values
 ('aaaaaaaa-0000-0000-0000-000000000801','11111111-1111-1111-1111-111111111111',801,'void',70000,'raised twice','00000000-0000-0000-0000-00000000000d','Grace Akello','sales','sent'),
 ('aaaaaaaa-0000-0000-0000-000000000803','11111111-1111-1111-1111-111111111111',803,'credit',35000,'one bag split','00000000-0000-0000-0000-00000000000d','Grace Akello','sales','sent');
set session_replication_role = origin;

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

set role authenticated;
-- ---------------- a void
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: voids INV-0801', 'refused:42501', $q$select void_invoice('11111111-1111-1111-1111-111111111111',801,'twice',true,null,'cash','aaaaaaaa-0000-0000-0000-000000000801')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: voids #0804, not billed yet (that is a cancel)', 'refused:22023', $q$select void_invoice('11111111-1111-1111-1111-111111111111',804,'twice')$q$);
select _try('manager: voids INV-0801 with no reason', 'refused:22023', $q$select void_invoice('11111111-1111-1111-1111-111111111111',801,'  ',true)$q$);
select _try('manager: voids INV-0801 answering the ask on #0803', 'refused:22023', $q$select void_invoice('11111111-1111-1111-1111-111111111111',801,'twice',true,null,'cash','aaaaaaaa-0000-0000-0000-000000000803')$q$);
select _try('manager: voids INV-0802 (35,000 paid) without saying what happens to the money', 'refused:OWVMN', $q$select void_invoice('11111111-1111-1111-1111-111111111111',802,'wrong',true)$q$);
select _try('check: nothing of those stuck — no why, no void, the shelf still 8', 'ok', $q$select _is($c$not exists(select 1 from saved_quotes where id in (801,802) and (voided or payload ? 'voidedBy')) and (select qty from stock where key='P1') = 8$c$)$q$);
select _try('manager: voids INV-0801 (raised twice), goods back, the ask answered', 'ok', $q$select void_invoice('11111111-1111-1111-1111-111111111111',801,'twice',true,null,'cash','aaaaaaaa-0000-0000-0000-000000000801')$q$);
select _try('check: voided, with its why and its docLog line', 'ok', $q$select _is($c$(select voided and payload->'voidedBy'->>'why' = 'twice' and payload->'voidedBy'->>'byName' = 'Ruth Nakato' and payload->'docLog'->-1->>'what' = 'Voided · twice' from saved_quotes where id=801)$c$)$q$);
select _try('check: the 2 bags are back (10), lots and all', 'ok', $q$select _is($c$(select qty from stock where key='P1') = 10 and (select sum(qty) from stock_lots where key='P1') = 10$c$)$q$);
select _try('check: the ask is accepted, and Ken owes 70,000 less', 'ok', $q$select _is($c$(select status from invoice_asks where id='aaaaaaaa-0000-0000-0000-000000000801') = 'accepted' and (select debt from customers where id='C1') = 140000$c$)$q$);
select _try('manager: voids INV-0801 again', 'refused:22023', $q$select void_invoice('11111111-1111-1111-1111-111111111111',801,'twice')$q$);
select _try('manager: voids INV-0802 (wrong customer), the 35,000 refunded in cash, nothing back on the shelf', 'ok', $q$select void_invoice('11111111-1111-1111-1111-111111111111',802,'wrong',false,'refund','cash')$q$);
select _try('check: a Refund of 35,000 out of cash; the shelf untouched', 'ok', $q$select _is($c$(select voided from saved_quotes where id=802) and exists(select 1 from cash_txns where quote_id=802 and type='payment' and category='Refund' and amount=35000 and account='cash') and (select qty from stock where key='P1') = 10$c$)$q$);

-- ---------------- a credit note
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: raises a credit note on INV-0803', 'refused:42501', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',803,'[{"idx":0,"qty":1,"restock":true}]','split')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: credits 5 of the 4 bags', 'refused:22023', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',803,'[{"idx":0,"qty":5,"restock":true}]','split','false','aaaaaaaa-0000-0000-0000-000000000803')$q$);
select _try('manager: names the line twice', 'refused:22023', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',803,'[{"idx":0,"qty":1},{"idx":0,"qty":1}]','split')$q$);
select _try('manager: a line that is not on the invoice', 'refused:22023', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',803,'[{"idx":3,"qty":1}]','split')$q$);
select _try('manager: on the voided INV-0801', 'refused:22023', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',801,'[{"idx":0,"qty":1}]','split')$q$);
select _try('check: nothing of those stuck — no note, the ask open, the shelf 10', 'ok', $q$select _is($c$not (select payload ? 'creditNotes' from saved_quotes where id=803) and (select status from invoice_asks where id='aaaaaaaa-0000-0000-0000-000000000803') = 'sent' and (select qty from stock where key='P1') = 10$c$)$q$);
select _try('manager: credits 1 bag (split), back on the shelf, the ask answered', 'ok', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',803,'[{"idx":0,"qty":1,"restock":true}]','one bag split',false,'aaaaaaaa-0000-0000-0000-000000000803')$q$);
select _try('check: CN-0001 for 35,000 at the price it sold at, on the invoice with its docLog line', 'ok', $q$select _is($c$(select payload->'creditNotes'->0 @> '{"no":1,"amount":35000,"restocked":true,"refund":null,"byName":"Ruth Nakato","lines":[{"idx":0,"qty":1,"price":35000,"name":"Cement"}]}' and payload->'docLog'->-1->>'what' = 'CN-0001 raised · 35,000' from saved_quotes where id=803)$c$)$q$);
select _try('check: the bag is back (11), the ask accepted, Ken owes 35,000 less, the owner''s log has it', 'ok', $q$select _is($c$(select qty from stock where key='P1') = 11 and (select sum(qty) from stock_lots where key='P1') = 11 and (select status from invoice_asks where id='aaaaaaaa-0000-0000-0000-000000000803') = 'accepted' and (select debt from customers where id='C1') = 105000 and exists(select 1 from decision_log where task='credit_note.raise' and what like 'Credit note CN-0001 · 35,000 on INV-0803 for Ken%')$c$)$q$);
select _try('manager: the other 3 bags, cash back, not restocked', 'ok', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',803,'[{"idx":0,"qty":3}]','damp',true)$q$);
select _try('check: CN-0002 for 105,000, the cash back due; the bill is 0', 'ok', $q$select _is($c$(select payload->'creditNotes'->1 @> '{"no":2,"amount":105000,"restocked":false,"refund":{"amount":105000,"due":true}}' from saved_quotes where id=803) and ow_order_total('11111111-1111-1111-1111-111111111111',(select payload from saved_quotes where id=803)) = 0 and (select qty from stock where key='P1') = 11$c$)$q$);
select _try('manager: one more bag', 'refused:22023', $q$select raise_credit_note('11111111-1111-1111-1111-111111111111',803,'[{"idx":0,"qty":1}]','again')$q$);
reset role;

select case when (expect = 'ok' and got = 'ok') or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
