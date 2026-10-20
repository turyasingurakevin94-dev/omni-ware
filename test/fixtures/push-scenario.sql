-- Push for every app (0120), asked of a real database: each handoff puts
-- one push in the outbox, for the people the decision rights name, never
-- the owner's queue and never the login that made the write.
-- Each row: what is tried, as whom, and whether it must go through or be
-- refused. A 'check:' row raises when the outbox is not as it should be.
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
insert into collection_trips(id, shop_id, supplier_id, status, lines) values
 ('T1','11111111-1111-1111-1111-111111111111','S1','collecting','[{"productId":"P1","productName":"Cement","qty":10,"gotQty":10}]');
-- The Buyer's restock line (0125 restock_buys; 0136 retired restock_lines and moved the hold here).
insert into restock_buys(id, shop_id, product_id, qty, unit, supplier_id, status, created_by) values
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','P1',20,'bag','S1','planned','00000000-0000-0000-0000-00000000000a');
insert into sourcing_leads(id, shop_id, name, status, requests) values
 ('L1','11111111-1111-1111-1111-111111111111','Roofing nails 3"','priced','[{"source":"order","orderId":"9201","customerName":"Kato Construction"},{"source":"sourcing.ask","by":"00000000-0000-0000-0000-00000000000e","withdrawn":true},{"source":"sourcing.ask","by":"00000000-0000-0000-0000-00000000000f"}]');

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

set role authenticated;

-- ---- a price, decided
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: an order at a price under the shop''s', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9201,'11111111-1111-1111-1111-111111111111','Kato Construction','awaiting_goods','{"takenBy":"00000000-0000-0000-0000-00000000000d","items":[{"lineId":"L1","productId":"P1","productName":"Cement","qty":2,"price":30000,"sellPrice":35000,"priceBy":"GA","priceNote":"under","supplierId":"S1"}]}')$q$);
select _try('check: one push, to the Manager only', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='price.waits')=1 and _to('price.waits')='0b' and (select body from push_outbox where kind='price.waits') = 'Kato Construction — Cement at 35,000'$c$)$q$);
select _try('sales: save it again', 'ok', $q$update saved_quotes set payload = payload || '{"note":"x"}' where id=9201$q$);
select _try('check: saving again rings nobody again', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='price.waits')=1$c$)$q$);
select _try('sales: write the outbox', 'refused', $q$insert into push_outbox(shop_id,kind,title,body,to_role) values ('11111111-1111-1111-1111-111111111111','x','x','x','owner')$q$);
select _try('sales: call the push writer', 'refused', $q$select ow_push('11111111-1111-1111-1111-111111111111','x','x','x',null,null,'owner',null,null)$q$);
select _try('sales: read who a push goes to', 'refused', $q$select ow_push_recipients(1)$q$);
select _try('check: sales reads none of the Manager''s pushes', 'ok', $q$do $d$ begin if exists(select 1 from push_outbox) then raise exception 'sales sees the outbox'; end if; end $d$$q$);

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: says yes', 'ok', $q$update saved_quotes set payload = jsonb_set(payload, '{items,0,priceReview}', '{"price":35000,"qty":2}') where id=9201$q$);
select _try('check: the salesperson is told, nobody else', 'ok', $q$select _is($c$_to('price.decided')='0d' and (select body from push_outbox where kind='price.decided') like 'Kato Construction — the order moves on%'$c$)$q$);

-- ---- credit
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: an order over Kato''s limit', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9202,'11111111-1111-1111-1111-111111111111','Kato Construction','draft','{"takenBy":"00000000-0000-0000-0000-00000000000d","customerId":"C001","items":[{"productId":"P1","qty":20,"price":30000,"supplierId":"S1"}]}')$q$);
select _try('check: the credit hold goes to the Manager', 'ok', $q$select _is($c$_to('credit.hold')='0b' and (select body from push_outbox where kind='credit.hold') = 'Kato Construction would owe 1,250,000 of a 1,000,000 limit'$c$)$q$);

-- ---- delivered, a short pick, an agent's ask (the console, as the owner)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: an order delivered', 'ok', $q$insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (9203,'11111111-1111-1111-1111-111111111111','Ggaba Stores','completed','{"items":[{"productId":"P1","qty":1,"price":28000,"supplierId":"__stock__","pickStatus":"short","pickedQty":0}],"agentChange":{"at":1,"state":"asked","cancel":true}}')$q$);
select _try('check: delivered, to the Manager', 'ok', $q$select _is($c$_to('order.delivered')='0b'$c$)$q$);
select _try('check: the short pick, to the Manager', 'ok', $q$select _is($c$_to('pick.short')='0b'$c$)$q$);
select _try('check: the agent''s ask, to the Manager', 'ok', $q$select _is($c$_to('agent.change')='0b' and (select body from push_outbox where kind='agent.change') like '%cancel%'$c$)$q$);
select _try('check: none of it reaches the owner', 'ok', $q$select _is($c$not exists(select 1 from push_outbox o, lateral ow_push_recipients(o.id) r where r.user_id='00000000-0000-0000-0000-00000000000a')$c$)$q$);

-- ---- trips
select _try('owner: the trip is back', 'ok', $q$update collection_trips set status='collected', collected_at=now() where id='T1'$q$);
select _try('check: the Store counts it in, Accounts settles its cash', 'ok', $q$select _is($c$_to('trip.back')='0e' and _to('trip.cash')='0f'$c$)$q$);
select _try('owner: the yard counts 8 of 10', 'ok', $q$update collection_trips set yard_checked_at=now(), lines='[{"productId":"P1","productName":"Cement","qty":10,"gotQty":10,"yardQty":8}]' where id='T1'$q$);
select _try('check: the difference goes to the Manager', 'ok', $q$select _is($c$_to('trip.difference')='0b'$c$)$q$);

-- ---- a write-off report, a held restock line
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('store: reports 2 bags damaged', 'ok', $q$insert into stock_reports(shop_id,key,product_id,name,qty,why,reported_by,reported_by_name,status) values ('11111111-1111-1111-1111-111111111111','P1','P1','Cement',2,'damaged','00000000-0000-0000-0000-00000000000e','Musa Kiggundu','sent')$q$);
select _try('check: the report goes to the Manager', 'ok', $q$select _is($c$_to('stock.report')='0b' and (select body from push_outbox where kind='stock.report') = '2 Cement — Musa Kiggundu'$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: holds a restock line', 'ok', $q$select hold_restock_buy('bbbbbbbb-0000-0000-0000-000000000001', true)$q$);
select _try('check: a push for the Buyer (buy.restock: whoever holds it)', 'ok', $q$select _is($c$exists(select 1 from push_outbox where kind='restock.held' and to_task='buy.restock')$c$)$q$);

-- ---- a price changed, a request listed (written as the system)
reset role;
set request.jwt.claim.sub = '';
select _try('a supplier''s price moves', 'ok', $q$update prices set retail = 32000 where id = 1$q$);
select _try('check: the salesperson with that line on an open order is told', 'ok', $q$select _is($c$_to('price.changed')='0d' and (select count(*) from push_outbox where kind='price.changed')=2 and (select min(body) from push_outbox where kind='price.changed') like 'Kato Construction — Cement is now 32,000%'$c$)$q$);
select _try('the same price saved again', 'ok', $q$update prices set retail = 32000 where id = 1$q$);
select _try('check: no second push', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='price.changed')=2$c$)$q$);
select _try('Sourcing lists the nails', 'ok', $q$update sourcing_leads set status='listed' where id='L1'$q$);
select _try('check: whoever took the order, and whoever asked, are told; a withdrawn ask is not', 'ok', $q$select _is($c$_to('request.listed')='0d,0f'$c$)$q$);

-- ---- the owner's digest: the three below and the Manager's hold above
insert into decision_log(shop_id, by, role, task, what) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','price.approve','Said yes'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','price.approve','Said yes'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager','invoice.make','Invoiced');
select _try('the 19:00 digest', 'ok', $q$select _is($c$ow_owner_digest() = 1$c$)$q$);
select _try('check: one push, to the owner only', 'ok', $q$select _is($c$_to('owner.digest')='0a' and (select title from push_outbox where kind='owner.digest') = 'Today: 4 decisions' and (select body from push_outbox where kind='owner.digest') = 'price.approve 2, invoice.make 1, restock.hold 1. The log has each one.'$c$)$q$);
select _try('the digest runs twice', 'ok', $q$select _is($c$ow_owner_digest() = 1 and (select count(*) from push_outbox where kind='owner.digest') = 1$c$)$q$);

-- ---- a phone with no staff row (the owner's) can take pushes
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select _try('owner: registers a phone', 'ok', $q$insert into push_subscriptions(shop_id, user_id, fcm_token) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','tok-owner')$q$);
select _try('owner: registers a phone as somebody else', 'refused', $q$insert into push_subscriptions(shop_id, user_id, fcm_token) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','tok-x')$q$);

-- ---- delivery: one sender per row
reset role;
select _try('a sender claims the unsent rows', 'ok', $q$select _is($c$(select count(*) from ow_push_claim(500)) = (select count(*) from push_outbox where sent_at is null)$c$)$q$);
select _try('check: a second sender at the same moment gets none of them', 'ok', $q$select _is($c$(select count(*) from ow_push_claim(500)) = 0$c$)$q$);
select _try('a sender that died two minutes ago', 'ok', $q$update push_outbox set claimed_at = now() - interval '3 minutes' where id = (select min(id) from push_outbox)$q$);
select _try('check: its claim is free again, for that row only', 'ok', $q$select _is($c$(select count(*) from ow_push_claim(500)) = 1$c$)$q$);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: claim pushes', 'refused', $q$select ow_push_claim(1)$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
