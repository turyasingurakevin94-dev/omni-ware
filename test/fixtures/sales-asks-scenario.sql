-- 0130, asked of a real database: a counter sale is invoiced on the spot
-- and tells nobody it is "ready to invoice"; a payment ask goes from Sales
-- to Accounts and back, and nobody else can decide it.
-- Each row: what is tried, as whom, and whether it must go through or be
-- refused. A 'check:' row raises when the books are not as they should be.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','sales@x'),('00000000-0000-0000-0000-00000000000e','store@x'),
 ('00000000-0000-0000-0000-00000000000f','accounts@x'),('00000000-0000-0000-0000-000000000010','buyer@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000010','buyer');
insert into app_settings(shop_id, presets) values ('11111111-1111-1111-1111-111111111111',
 '{"defaultMarkup":{"wholesaleType":"percent","wholesaleValue":25,"retailType":"percent","retailValue":25}}')
 on conflict (shop_id) do update set presets = excluded.presets;
insert into suppliers(shop_id, id, name) values ('11111111-1111-1111-1111-111111111111','S1','Nakawa Cement Depot');
insert into products(shop_id,id,name) values ('11111111-1111-1111-1111-111111111111','P1','Cement');
insert into prices(id, shop_id, product_id, supplier_id, retail, unit) values (1,'11111111-1111-1111-1111-111111111111','P1','S1',30000,'bag');
insert into customers(shop_id,id,name,debt,credit_limit) values ('11111111-1111-1111-1111-111111111111','C001','Kato Construction',500000,1000000);

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
-- Who one kind of push reaches, as a sorted list of the test logins' last
-- two hex digits ('0b' is the Manager).
create function _to(p_kind text) returns text language sql security definer as $$
  select coalesce(string_agg(distinct right(r.user_id::text, 2), ','), '')
    from push_outbox o, lateral ow_push_recipients(o.id) r where o.kind = p_kind
$$;
grant execute on function _to to authenticated;


insert into stock(shop_id, key, qty) values ('11111111-1111-1111-1111-111111111111','P1',50);
insert into stock_lots(shop_id, key, qty, cost) values ('11111111-1111-1111-1111-111111111111','P1',50,30000);
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id) values
 (1,'11111111-1111-1111-1111-111111111111', current_date, 'momo', 'receipt', 'Debt Payment', 420000, 'Payment — Kato', null);

set role authenticated;

-- ---- a counter sale, pay and go
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: places a counter sale, all from the shelf', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, amount_paid, voided, payload) values (7001,'11111111-1111-1111-1111-111111111111','Walk-in',current_date,'draft',false,0,false,
  '{"counter":true,"client":{"name":"Walk-in"},"items":[{"lineId":1,"productId":"P1","productName":"Cement","unit":"bag","qty":2,"supplierId":"__stock__","price":30000,"sellPrice":37500}],"charges":[],"payments":[],"takenBy":"00000000-0000-0000-0000-00000000000d"}')$q$);
select _try('sales: paid in full, handed over', 'ok', $q$update saved_quotes set status='completed', amount_paid=75000, payload = payload || '{"payments":[{"amount":75000,"method":"cash"}]}' where id=7001$q$);
select _try('sales: invoices it through the one function', 'ok', $q$select invoice_order('11111111-1111-1111-1111-111111111111', 7001)$q$);
select _try('check: invoiced, the stock gone off the shelf', 'ok', $q$select _is($c$(select invoiced from saved_quotes where id=7001) and (select qty from stock where key='P1') = 48$c$)$q$);
select _try('check: nobody is told a counter sale is "ready to invoice"', 'ok', $q$select _is($c$_to('order.delivered') = ''$c$)$q$);
select _try('sales: an ordinary order reaches Delivered', 'ok', $q$insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, amount_paid, voided, payload) values (7002,'11111111-1111-1111-1111-111111111111','Kato Construction',current_date,'completed',false,0,false,
  '{"client":{"name":"Kato Construction"},"items":[{"lineId":1,"productId":"P1","productName":"Cement","unit":"bag","qty":1,"supplierId":"__stock__","price":30000,"sellPrice":37500}],"charges":[],"payments":[]}')$q$);
select _try('check: that one still tells the Manager', 'ok', $q$select _is($c$_to('order.delivered') = '0b'$c$)$q$);

-- ---- a payment recorded wrong
select _try('sales: asks Accounts to correct the method', 'ok', $q$insert into payment_asks(shop_id, cash_txn_id, amount, what, want, asked_by, asked_by_name, status) values ('11111111-1111-1111-1111-111111111111', 1, 420000, 'method', '{"from":"momo","account":"bank"}', '00000000-0000-0000-0000-00000000000d', 'Grace', 'sent')$q$);
select _try('check: Accounts is told, nobody else', 'ok', $q$select _is($c$_to('payment.ask') = '0f'$c$)$q$);
select _try('sales: asks in somebody else''s name', 'refused', $q$insert into payment_asks(shop_id, cash_txn_id, amount, what, asked_by, status) values ('11111111-1111-1111-1111-111111111111', 1, 420000, 'amount', '00000000-0000-0000-0000-00000000000b', 'sent')$q$);
select _try('sales: marks its own ask done', 'refused', $q$update payment_asks set status='done' where cash_txn_id=1$q$);
select _try('sales: decides it', 'refused', $q$select decide_payment_ask((select id from payment_asks where cash_txn_id=1), 'done')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: asks for a payment fix', 'refused', $q$insert into payment_asks(shop_id, cash_txn_id, amount, what, asked_by, status) values ('11111111-1111-1111-1111-111111111111', 1, 420000, 'day', '00000000-0000-0000-0000-00000000000e', 'sent')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: decides it (not theirs: payment.edit is Accounts'')', 'refused', $q$select decide_payment_ask((select id from payment_asks where cash_txn_id=1), 'done')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: corrects it and closes the ask', 'ok', $q$select decide_payment_ask((select id from payment_asks where cash_txn_id=1), 'done')$q$);
select _try('check: the asker is told', 'ok', $q$select _is($c$_to('payment.ask.decided') = '0d' and (select status from payment_asks where cash_txn_id=1) = 'done'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: takes back a decided ask', 'refused', $q$select withdraw_payment_ask((select id from payment_asks where cash_txn_id=1))$q$);
select _try('sales: asks again, then takes it back', 'ok', $q$insert into payment_asks(shop_id, cash_txn_id, amount, what, want, asked_by, status) values ('11111111-1111-1111-1111-111111111111', 1, 420000, 'amount', '{"amount":400000}', '00000000-0000-0000-0000-00000000000d', 'sent'); select withdraw_payment_ask((select id from payment_asks where what='amount'))$q$);
select _try('check: withdrawn', 'ok', $q$select _is($c$(select status from payment_asks where what='amount') = 'withdrawn'$c$)$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
