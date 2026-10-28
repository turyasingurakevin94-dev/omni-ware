-- What the Manager decides (0122), asked of a real database. Each row: what
-- is tried, as whom, and whether it must go through or be refused. A
-- 'check:' row is a do-block that raises when the books are not as the
-- decision should have left them.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x'),('00000000-0000-0000-0000-00000000000e','store@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Test shop','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store');
insert into staff(shop_id,id,name,role,user_id) values
 ('11111111-1111-1111-1111-111111111111','W1','Grace Manager','manager','00000000-0000-0000-0000-00000000000b'),
 ('11111111-1111-1111-1111-111111111111','W2','Sam Sales','sales','00000000-0000-0000-0000-00000000000d');
insert into customers(shop_id,id,name,debt,credit_limit,terms_days) values ('11111111-1111-1111-1111-111111111111','C001','Kato',500000,1000000,30);
insert into products(shop_id,id,name,wholesale_markup_type,wholesale_markup_value) values ('11111111-1111-1111-1111-111111111111','P1','Cement','percent',10);
insert into saved_quotes(id, shop_id, client_name, status, invoiced, payload) overriding system value values
 (9001,'11111111-1111-1111-1111-111111111111','Kato','completed',true,'{}'),
 (9002,'11111111-1111-1111-1111-111111111111','Kato','draft',false,'{}'),
 (9003,'11111111-1111-1111-1111-111111111111','Agent client','draft',false,'{"agentCancel":{"at":"2026-10-18","reason":"changed mind"}}');
begin;  -- 0169: a key's stock and its lots go in together (checked at commit)
insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','P1','P1',10);
insert into stock_lots(shop_id,key,qty,cost) values ('11111111-1111-1111-1111-111111111111','P1',4,100),('11111111-1111-1111-1111-111111111111','P1',6,120);
commit;
insert into purchase_invoices(id, shop_id, quote_id, date, payload) values
 (7001,'11111111-1111-1111-1111-111111111111',9001,current_date,'{"items":[{"qty":2,"price":1000}],"amountPaid":0,"payments":[]}'),
 (7002,'11111111-1111-1111-1111-111111111111',9001,current_date,'{"items":[{"qty":1,"price":500}],"amountPaid":200,"payments":[{"amount":200}]}');
insert into collection_trips(id, shop_id, supplier_id, status, lines, yard_checked_at) values
 ('T1','11111111-1111-1111-1111-111111111111','S1','collected',
  '[{"productId":"P1","productName":"Cement","qty":10,"gotQty":10,"gotPrice":100,"yardQty":8},{"productId":"P2","productName":"Nails","qty":5,"gotQty":5,"yardQty":5}]', now()),
 ('T2','11111111-1111-1111-1111-111111111111','S1','collected','[{"productId":"P1","qty":3,"gotQty":3}]', null);
insert into invoice_asks(id, shop_id, quote_id, kind, amount, asked_by, asked_by_name, status) values
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',9001,'void',5000,'00000000-0000-0000-0000-00000000000d','Sam','sent');
insert into restock_lines(id, shop_id, key, product_id, name, qty, cost, created_by) values
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','P1','P1','Cement',20,100,'00000000-0000-0000-0000-00000000000a');
insert into stock_reports(id, shop_id, key, product_id, name, qty, why, reported_by, reported_by_name) values
 ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','P1','P1','Cement',1,'damaged','00000000-0000-0000-0000-00000000000e','Esther'),
 ('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','P1','P1','Cement',2,'lost','00000000-0000-0000-0000-00000000000e','Esther');
insert into manager_notes(shop_id, kind, date, body, status) values
 ('11111111-1111-1111-1111-111111111111','target',current_date,'{"who":"00000000-0000-0000-0000-00000000000d","metric":"sales","aim":1000,"from":"2026-10-01","to":"2026-10-31"}','open'),
 ('11111111-1111-1111-1111-111111111111','target',current_date,'{"who":"00000000-0000-0000-0000-00000000000d","metric":"sales","aim":900,"from":"2026-09-01","to":"2026-09-30"}','open');

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
-- The checks read the books as the database owner sees them.
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;

set role authenticated;

-- ---- as SALES: none of the Manager's decisions
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: set the hold days', 'refused', $q$select set_shop_preset('11111111-1111-1111-1111-111111111111','creditHold','{"days":30}')$q$);
select _try('sales: set a markup', 'refused', $q$select set_product_markup('11111111-1111-1111-1111-111111111111','P1','{"retailMarkupValue":5}')$q$);
select _try('sales: write stock off', 'refused', $q$select manager_stock_move('11111111-1111-1111-1111-111111111111','[{"key":"P1","delta":-1}]','writeoff',null,'stock.writeoff')$q$);
select _try('sales: decide an ask', 'refused', $q$select decide_invoice_ask('aaaaaaaa-0000-0000-0000-000000000001','accepted')$q$);
select _try('sales: set a goal', 'refused', $q$select set_person_goal('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d',5,'2026-10-01','2026-10-31')$q$);
select _try('sales: change a credit limit', 'refused', $q$update customers set credit_limit = 1 where id='C001'$q$);
select _try('sales: void an order', 'refused', $q$update saved_quotes set voided = true where id = 9002$q$);
select _try('sales: close an agent''s cancel (no agent.change)', 'refused', $q$update saved_quotes set voided = true where id = 9003$q$);
select _try('sales: hold a restock line', 'refused', $q$select hold_restock_line('bbbbbbbb-0000-0000-0000-000000000001', true)$q$);

-- ---- as MANAGER
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: cannot call the log writer directly', 'refused', $q$select manager_log_decision('11111111-1111-1111-1111-111111111111','markup.set','x',null,null,null,null)$q$);
select _try('manager: cannot call the stock mover directly', 'refused', $q$select manager_apply_stock_lines('11111111-1111-1111-1111-111111111111','[{"key":"P1","delta":-1}]','writeoff',null,-1)$q$);

-- presets
select _try('manager: set the hold days', 'ok', $q$select set_shop_preset('11111111-1111-1111-1111-111111111111','creditHold','{"days":30}')$q$);
select _try('manager: set stage limits', 'ok', $q$select set_shop_preset('11111111-1111-1111-1111-111111111111','orderStageLimits','{"draft":120,"awaiting_goods":1440,"preparing":120,"pending_delivery":240}')$q$);
select _try('manager: set the default markup', 'ok', $q$select set_shop_preset('11111111-1111-1111-1111-111111111111','defaultMarkup','{"wholesaleType":"percent","wholesaleValue":12}')$q$);
select _try('check: the three presets sit side by side', 'ok', $q$select _is($c$(select presets->'creditHold'->>'days' = '30' and presets->'orderStageLimits'->>'awaiting_goods' = '1440' and presets->'defaultMarkup'->>'wholesaleValue' = '12' from app_settings where shop_id='11111111-1111-1111-1111-111111111111')$c$)$q$);
select _try('manager: a setting that is not theirs', 'refused', $q$select set_shop_preset('11111111-1111-1111-1111-111111111111','priceReview','{"n":5}')$q$);
select _try('manager: a stage that does not exist', 'refused', $q$select set_shop_preset('11111111-1111-1111-1111-111111111111','orderStageLimits','{"lunch":5}')$q$);
select _try('manager: write app_settings directly', 'refused', $q$update app_settings set presets = '{}' where shop_id='11111111-1111-1111-1111-111111111111'$q$);

-- markups
select _try('manager: set a product''s markups', 'ok', $q$select set_product_markup('11111111-1111-1111-1111-111111111111','P1','{"retailMarkupType":"fixed","retailMarkupValue":500,"stockWholesaleMarkupType":"percent","stockWholesaleMarkupValue":8}')$q$);
select _try('check: markups changed, the rest kept', 'ok', $q$select _is($c$(select retail_markup_type='fixed' and retail_markup_value=500 and stock_wholesale_markup_value=8 and wholesale_markup_value=10 and name='Cement' from products where id='P1')$c$)$q$);
select _try('manager: change a product''s name through it', 'refused', $q$select set_product_markup('11111111-1111-1111-1111-111111111111','P1','{"name":"Sand"}')$q$);
select _try('manager: a markup type nobody uses', 'refused', $q$select set_product_markup('11111111-1111-1111-1111-111111111111','P1','{"retailMarkupType":"double"}')$q$);
select _try('manager: update products directly', 'refused', $q$update products set retail_markup_value = 1 where id='P1'$q$);

-- stock
select _try('manager: write off 5 (oldest lots first)', 'ok', $q$select manager_stock_move('11111111-1111-1111-1111-111111111111','[{"key":"P1","productId":"P1","name":"Cement","delta":-5,"cost":100}]','writeoff','broken bags','stock.writeoff')$q$);
select _try('check: 5 left, first lot gone, second at 5', 'ok', $q$select _is($c$(select qty from stock where key='P1')=5 and (select count(*) from stock_lots where key='P1')=1 and (select qty from stock_lots where key='P1')=5 and (select type from stock_log order by id desc limit 1)='writeoff'$c$)$q$);
select _try('manager: a write-off that adds goods', 'refused', $q$select manager_stock_move('11111111-1111-1111-1111-111111111111','[{"key":"P1","delta":2}]','writeoff',null,'stock.writeoff')$q$);
select _try('manager: a write-off typed as a reversal', 'refused', $q$select manager_stock_move('11111111-1111-1111-1111-111111111111','[{"key":"P1","delta":-1}]','reversal',null,'stock.writeoff')$q$);
select _try('manager: goods back from a void (+2 at 150)', 'ok', $q$select manager_stock_move('11111111-1111-1111-1111-111111111111','[{"key":"P1","productId":"P1","name":"Cement","delta":2,"cost":150}]','reversal','void #9001','invoice.void')$q$);
select _try('check: 7 on the shelf, a lot at 150', 'ok', $q$select _is($c$(select qty from stock where key='P1')=7 and exists(select 1 from stock_lots where key='P1' and qty=2 and cost=150)$c$)$q$);
select _try('manager: a return that takes goods away', 'refused', $q$select manager_stock_move('11111111-1111-1111-1111-111111111111','[{"key":"P1","delta":-1}]','reversal',null,'credit_note.raise')$q$);
select _try('manager: a move for another task', 'refused', $q$select manager_stock_move('11111111-1111-1111-1111-111111111111','[{"key":"P1","delta":-1}]','writeoff',null,'stock.correct')$q$);
select _try('manager: touch stock directly', 'refused', $q$update stock set qty = 99 where key='P1'$q$);

-- asks
select _try('manager: accept a void ask', 'ok', $q$select decide_invoice_ask('aaaaaaaa-0000-0000-0000-000000000001','accepted')$q$);
select _try('check: the ask is closed, by the manager', 'ok', $q$select _is($c$(select status='accepted' and decided_by='00000000-0000-0000-0000-00000000000b' and decided_at is not null from invoice_asks where id='aaaaaaaa-0000-0000-0000-000000000001')$c$)$q$);
select _try('manager: decide it again', 'refused', $q$select decide_invoice_ask('aaaaaaaa-0000-0000-0000-000000000001','declined')$q$);
select _try('manager: a status that is not an answer', 'refused', $q$select decide_invoice_ask('aaaaaaaa-0000-0000-0000-000000000001','withdrawn')$q$);

-- the sale's bills
select _try('manager: void the bills order 9001 raised', 'ok', $q$select _is($c$(select r->'voided' = '[7001]'::jsonb and r->'kept' = '[7002]'::jsonb from (select void_sale_bills('11111111-1111-1111-1111-111111111111', 9001) r) x)$c$)$q$);
select _try('check: the unpaid bill is voided, the paid one is not', 'ok', $q$select _is($c$(select (payload->>'voided')::boolean from purchase_invoices where id=7001) and coalesce((select (payload->>'voided')::boolean from purchase_invoices where id=7002), false) = false$c$)$q$);

-- trips
select _try('manager: accept trip T1''s difference', 'ok', $q$select _is($c$(select (r->>'lines')::int = 1 from (select accept_trip_difference('T1') r) x)$c$)$q$);
select _try('check: who and when, and the stock did not move', 'ok', $q$select _is($c$(select difference_accepted_by='00000000-0000-0000-0000-00000000000b' and difference_accepted_at is not null from collection_trips where id='T1') and (select qty from stock where key='P1')=7$c$)$q$);
select _try('check: the log keeps the Buyer''s and the yard''s count', 'ok', $q$select _is($c$(select before->0->>'gotQty' = '10' and after->0->>'yardQty' = '8' and amount = -200 from decision_log where task='trip.difference')$c$)$q$);
select _try('manager: a trip the yard has not counted', 'refused', $q$select accept_trip_difference('T2')$q$);

-- restock
select _try('manager: hold a restock line', 'ok', $q$select hold_restock_line('bbbbbbbb-0000-0000-0000-000000000001', true)$q$);
select _try('check: held, by the manager', 'ok', $q$select _is($c$(select status='held' and held_by='00000000-0000-0000-0000-00000000000b' from restock_lines)$c$)$q$);
select _try('manager: update a restock line directly', 'refused', $q$update restock_lines set status = 'bought'$q$);
select _try('manager: add a restock line (buy.restock is the Buyer''s)', 'refused', $q$insert into restock_lines(shop_id,name,qty) values ('11111111-1111-1111-1111-111111111111','Sand',3)$q$);
select _try('manager: let it go ahead', 'ok', $q$select hold_restock_line('bbbbbbbb-0000-0000-0000-000000000001', false)$q$);
select _try('check: planned again', 'ok', $q$select _is($c$(select status='planned' and held_by is null from restock_lines)$c$)$q$);

-- stock reports
select _try('manager: write off report 1 (lines from the report)', 'ok', $q$select write_off_stock('11111111-1111-1111-1111-111111111111', array['cccccccc-0000-0000-0000-000000000001']::uuid[], null, 'damaged in the rain')$q$);
select _try('check: 6 left and the report written off', 'ok', $q$select _is($c$(select qty from stock where key='P1')=6 and (select status from stock_reports where id='cccccccc-0000-0000-0000-000000000001')='written_off'$c$)$q$);
select _try('manager: write it off twice', 'refused', $q$select write_off_stock('11111111-1111-1111-1111-111111111111', array['cccccccc-0000-0000-0000-000000000001']::uuid[], null, null)$q$);
select _try('manager: dismiss report 2', 'ok', $q$select dismiss_stock_report('cccccccc-0000-0000-0000-000000000002')$q$);
select _try('check: dismissed, stock untouched', 'ok', $q$select _is($c$(select status from stock_reports where id='cccccccc-0000-0000-0000-000000000002')='dismissed' and (select qty from stock where key='P1')=6$c$)$q$);
select _try('manager: update a report directly', 'refused', $q$update stock_reports set status = 'sent'$q$);

-- goals
select _try('manager: set Sam''s goal', 'ok', $q$select set_person_goal('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d',2500000,'2026-10-15','2026-11-14')$q$);
select _try('check: the overlapping goal closed, September''s kept, the new one open', 'ok', $q$select _is($c$(select count(*) from manager_notes where kind='target' and status='open')=2 and (select count(*) from manager_notes where kind='target' and status='closed')=1 and exists(select 1 from manager_notes where kind='target' and status='open' and body->>'who'='00000000-0000-0000-0000-00000000000d' and body->>'metric'='sales' and (body->>'aim')::numeric=2500000 and body->>'from'='2026-10-15' and body->>'to'='2026-11-14')$c$)$q$);
select _try('manager: a goal for somebody with no login', 'refused', $q$select set_person_goal('11111111-1111-1111-1111-111111111111','nobody',5,'2026-10-01','2026-10-31')$q$);
select _try('manager: a goal that ends before it starts', 'refused', $q$select set_person_goal('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d',5,'2026-10-31','2026-10-01')$q$);

-- the guards, redrawn
select _try('manager: change a credit limit and terms', 'ok', $q$update customers set credit_limit = 2000000, terms_days = 45 where id='C001'$q$);
select _try('manager: a new customer with terms', 'ok', $q$insert into customers(shop_id,id,name,terms_days) values ('11111111-1111-1111-1111-111111111111','C005','Nalu',14)$q$);
select _try('manager: still never raise a debt', 'refused', $q$update customers set debt = 900000 where id='C001'$q$);
select _try('check: the credit change is in the log, with what it was', 'ok', $q$select _is($c$exists(select 1 from decision_log where task='credit.set' and (before->>'credit_limit')::numeric=1000000 and (after->>'terms_days')::int=45 and by_name='Grace Manager' and role='manager')$c$)$q$);
select _try('manager: void an invoiced order', 'ok', $q$update saved_quotes set voided = true where id = 9001$q$);
select _try('manager: UN-void it', 'refused', $q$update saved_quotes set voided = false where id = 9001$q$);
select _try('manager: still never invoice by saving', 'refused', $q$update saved_quotes set invoiced = true where id = 9002$q$);
select _try('manager: still never un-invoice by saving', 'refused', $q$update saved_quotes set invoiced = false where id = 9001$q$);
select _try('manager: close an agent''s cancelled order', 'ok', $q$update saved_quotes set voided = true where id = 9003$q$);
select _try('check: one log row per decision, all the Manager''s', 'ok', $q$select _is($c$(select count(*) from decision_log where by='00000000-0000-0000-0000-00000000000b' and role='manager') >= 17 and not exists(select 1 from decision_log where what is null or what = '')$c$)$q$);

-- ---- as STORE: the acceptance is not the yard's
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: mark a trip''s difference accepted directly', 'refused', $q$update collection_trips set difference_accepted_at = now() where id = 'T2'$q$);
-- Since 0164 the Store writes only through its functions: it counts a trip in with receive_trip (store.html), not by hand.
select _try('store: count a trip in (receive_trip, as store.html does)', 'ok', $q$select receive_trip('11111111-1111-1111-1111-111111111111', 'T2', '[{"shop":3}]')$q$);
select _try('store: write the count on the trip by hand (0164: through its functions only)', 'refused', $q$update collection_trips set yard_checked_at = now() where id = 'T2'$q$);
select _try('store: report stock (stock.report, granted by 0124)', 'ok', $q$insert into stock_reports(shop_id,name,qty,why,reported_by) values ('11111111-1111-1111-1111-111111111111','Cement',1,'damaged','00000000-0000-0000-0000-00000000000e')$q$);

-- ---- as OWNER: everything
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: set a markup', 'ok', $q$select set_product_markup('11111111-1111-1111-1111-111111111111','P1','{"retailMarkupValue":600}')$q$);
select _try('owner: un-void an order', 'ok', $q$update saved_quotes set voided = false where id = 9001$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
