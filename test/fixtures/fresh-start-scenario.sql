-- A fresh start (0148), asked of a real database: an old shop with a bit
-- of everything, a dry run, the copy, and switch day. Each check prints
-- PASS or FAIL, a tab, and what it checks.
create table _r(n serial, ok boolean, label text);
create function _c(ok boolean, label text) returns void language sql as $$ insert into _r(ok, label) values (coalesce(ok, false), label) $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _c to authenticated;

insert into auth.users values
 ('00000000-0000-0000-0000-0000000000a1','owner@x'), ('00000000-0000-0000-0000-0000000000a2','manager@x'),
 ('00000000-0000-0000-0000-0000000000a3','store@x'), ('00000000-0000-0000-0000-0000000000a4','agent@x'),
 ('00000000-0000-0000-0000-0000000000a5','oldagent@x');
insert into shops(id, name, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Mukasa Hardware', '00000000-0000-0000-0000-0000000000a1');
insert into shop_members(shop_id, user_id, role) values
 ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','owner'),
 ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a2','manager'),
 ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a3','store');
insert into app_settings(shop_id, presets) values ('aaaaaaaa-0000-0000-0000-000000000001',
 '{"categories":[{"name":"Roofing","subcategories":[]}],"units":["bag","sheet"],"shopLegalName":"Mukasa Hardware Ltd","defaultMarkup":{"wholesaleValue":25},"creditHold":{"days":21,"on":true},"dayLog":{"x":1},"chaseLog":[1,2],"stockCounts":{"A":1},"debtChases":{"C001":1}}');
insert into shop_task_off(shop_id, role, task) values ('aaaaaaaa-0000-0000-0000-000000000001','accounts','day.close');
insert into shop_payment_providers(shop_id, provider, environment, enabled, credentials) values ('aaaaaaaa-0000-0000-0000-000000000001','mtn','production',true,'{"apiKey":"k"}');
insert into entity_id_counters(shop_id, kind, last_issued) values ('aaaaaaaa-0000-0000-0000-000000000001','product',2),('aaaaaaaa-0000-0000-0000-000000000001','customer',2);
insert into suppliers(shop_id, id, name, phone, terms_days) values ('aaaaaaaa-0000-0000-0000-000000000001','S001','Kiseka Steel','0772100001',30);
insert into customers(shop_id, id, name, phone, debt, credit_limit, terms_days, linked_supplier_id) values
 ('aaaaaaaa-0000-0000-0000-000000000001','C001','Kato Construction','0772410220',2410000,5000000,30,null),
 ('aaaaaaaa-0000-0000-0000-000000000001','C002','Sarah Namono','0701000002',0,null,null,'S001');
insert into products(shop_id, id, name, category, image, wholesale_markup_type, wholesale_markup_value) values
 ('aaaaaaaa-0000-0000-0000-000000000001','P001','Iron sheet G28','Roofing','https://x.supabase.co/storage/v1/object/public/product-images/aaaaaaaa-0000-0000-0000-000000000001/a.jpg','percent',25),
 ('aaaaaaaa-0000-0000-0000-000000000001','P002','Cement 50kg','Building',null,null,null);
insert into prices(shop_id, product_id, supplier_id, wholesale, retail, date, unit) values
 ('aaaaaaaa-0000-0000-0000-000000000001','P001','S001',55700,60000,'2026-08-01','sheet'),
 ('aaaaaaaa-0000-0000-0000-000000000001','P002','S001',31000,33000,'2026-10-01','bag');
insert into product_links(shop_id, id, from_id, verb, to_id, qty) values ('aaaaaaaa-0000-0000-0000-000000000001', 7, 'P001', 'needs', 'P002', 2);
insert into item_names(shop_id, word, product_id) values ('aaaaaaaa-0000-0000-0000-000000000001','mabaati','P001');
insert into media_folders(shop_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001','Roofing');
insert into media_folders(shop_id, name, parent_id) select 'aaaaaaaa-0000-0000-0000-000000000001','Sheets', id from media_folders where name = 'Roofing';
insert into media(shop_id, path, url, name, folder_id) select 'aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001/a.jpg',
  'https://x.supabase.co/storage/v1/object/public/product-images/aaaaaaaa-0000-0000-0000-000000000001/a.jpg','Iron sheet', id from media_folders where name = 'Sheets';
insert into staff(shop_id, id, name, role, user_id, pay_basis, pay_rate) values
 ('aaaaaaaa-0000-0000-0000-000000000001','ST001','Ruth Nakato','manager','00000000-0000-0000-0000-0000000000a2','monthly',1200000),
 ('aaaaaaaa-0000-0000-0000-000000000001','ST002','Hassan','delivery',null,'daily',15000);
insert into agents(shop_id, id, name, user_id, retired_at) values
 ('aaaaaaaa-0000-0000-0000-000000000001','A001','Joan','00000000-0000-0000-0000-0000000000a4',null),
 ('aaaaaaaa-0000-0000-0000-000000000001','A002','Paul (left)','00000000-0000-0000-0000-0000000000a5',now());
insert into agent_goals(shop_id, agent_id, daily_target) values ('aaaaaaaa-0000-0000-0000-000000000001','A001',500000);
insert into agent_clients(shop_id, agent_id, name, phone) values ('aaaaaaaa-0000-0000-0000-000000000001','A001','Opio','0772000009'),('aaaaaaaa-0000-0000-0000-000000000001','A002','Gone','0772000010');
insert into catalogues(shop_id, agent_id, slug, headline) values ('aaaaaaaa-0000-0000-0000-000000000001','A001','joan-roofing','Roofing for less');
insert into places(shop_id, name, lat, lng) values ('aaaaaaaa-0000-0000-0000-000000000001','Ntinda',0.35,32.61);
insert into rent_agreements(shop_id, premises, landlord, amount, due_day, start_month, end_month) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Shop','Kizza',800000,5,'2025-01',null),
 ('aaaaaaaa-0000-0000-0000-000000000001','Old store','Kizza',300000,5,'2024-01','2024-12');
insert into fixed_assets(shop_id, name, cost, acquired_on, method, life_months, cash_txn_id, disposed_on) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Delivery truck',45000000,'2025-02-01','straight_line',60,123,null),
 ('aaaaaaaa-0000-0000-0000-000000000001','Old scale',300000,'2023-01-01','straight_line',36,124,'2025-06-01');
insert into rival_prices(shop_id, product_id, rival, price, seen_on) values ('aaaaaaaa-0000-0000-0000-000000000001','P001','Nakawa Hardware',58000,'2026-10-01');
insert into wa_numbers(shop_id, phone_number_id) values ('aaaaaaaa-0000-0000-0000-000000000001','pn-1');
-- What stays behind.
insert into stock(shop_id, key, product_id, qty) values ('aaaaaaaa-0000-0000-0000-000000000001','P001','P001',140);
insert into cash_txns(shop_id, date, account, type, category, amount) values ('aaaaaaaa-0000-0000-0000-000000000001',current_date,'cash','receipt','Sales',100000);
insert into saved_quotes(shop_id, client_name, status, invoiced, voided, payload) values ('aaaaaaaa-0000-0000-0000-000000000001','Kato','draft',false,false,'{}');
insert into purchase_invoices(shop_id, date, payload) values ('aaaaaaaa-0000-0000-0000-000000000001',current_date,'{"supplierId":"S001"}');
insert into loans(shop_id, lender, principal, started_on) values ('aaaaaaaa-0000-0000-0000-000000000001','Stanbic',10000000,'2025-01-01');
insert into customer_debt_log(shop_id, customer_id, date, type, amount) values ('aaaaaaaa-0000-0000-0000-000000000001','C001',current_date,'charge',2410000);

create temp table before_counts as
  select (select count(*) from shops) shops, (select count(*) from products) products, (select count(*) from shop_members) members;

-- ---- 1. a dry run changes nothing
create temp table dry as select * from ow_fresh_start('aaaaaaaa-0000-0000-0000-000000000001', 'Mukasa Hardware');
select _c((select what from dry limit 1) = 'DRY RUN: nothing was saved', 'a dry run says so on its first line');
select _c((select n from dry where what = 'products') = 2 and (select n from dry where what = 'customers') = 2, 'and reports what it would copy');
select _c((select shops from before_counts) = (select count(*) from shops) and (select products from before_counts) = (select count(*) from products)
  and (select members from before_counts) = (select count(*) from shop_members), 'and nothing was saved');
select _c(not exists (select 1 from dry where what = 'the new shop'), 'it shows no id for a shop it did not keep');

-- ---- 2. guards
do $$ begin perform ow_fresh_start('aaaaaaaa-0000-0000-0000-00000000dead', 'X', true); perform _c(false, 'an unknown shop is refused');
exception when others then perform _c(sqlerrm like 'There is no shop%', 'an unknown shop is refused'); end $$;
do $$ begin perform ow_fresh_start('aaaaaaaa-0000-0000-0000-000000000001', '  ', true); perform _c(false, 'a blank name is refused');
exception when others then perform _c(sqlerrm like 'Give the new shop a name%', 'a blank name is refused'); end $$;

-- ---- 3. the copy
create temp table done as select * from ow_fresh_start('aaaaaaaa-0000-0000-0000-000000000001', '  Mukasa Hardware  ', true);
create temp table nw as select (select note::uuid from done where what = 'the new shop') id;
select _c((select id from nw) is not null and exists (select 1 from shops s, nw where s.id = nw.id and s.name = 'Mukasa Hardware'
  and s.created_by = '00000000-0000-0000-0000-0000000000a1'), 'the new shop is made, named, and owned by the old shop''s maker');
select _c((select count(*) from shop_members m, nw where m.shop_id = nw.id) = 1
  and exists (select 1 from shop_members m, nw where m.shop_id = nw.id and m.role = 'owner'), 'only the owner is in it so far');
select _c((select count(*) from shop_members where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 3, 'the old shop keeps its whole team until switch day');

select _c((select presets -> 'units' = '["bag","sheet"]' and presets ->> 'shopLegalName' = 'Mukasa Hardware Ltd' and presets -> 'creditHold' ->> 'days' = '21'
  from app_settings a, nw where a.shop_id = nw.id), 'settings come across: units, letterhead, credit policy');
select _c((select not (presets ? 'dayLog') and not (presets ? 'chaseLog') and not (presets ? 'stockCounts') and not (presets ? 'debtChases')
  from app_settings a, nw where a.shop_id = nw.id), 'running logs kept in the settings stay behind');
select _c((select from_shop from fresh_starts f, nw where f.shop_id = nw.id) = 'aaaaaaaa-0000-0000-0000-000000000001', 'the new shop records where it came from');
select _c((select old_debts from fresh_starts f, nw where f.shop_id = nw.id) = '{"C001": 2410000}'::jsonb, 'and what each customer owed in the old books, as the Manager''s checklist');
select _c(exists (select 1 from shop_task_off t, nw where t.shop_id = nw.id and t.task = 'day.close')
  and exists (select 1 from shop_payment_providers p, nw where p.shop_id = nw.id and p.credentials ->> 'apiKey' = 'k')
  and (select last_issued from entity_id_counters e, nw where e.shop_id = nw.id and e.kind = 'product') = 2,
  'switched-off tasks, mobile money keys and id counters come across');

select _c((select count(*) from customers c, nw where c.shop_id = nw.id) = 2
  and (select sum(debt) from customers c, nw where c.shop_id = nw.id) = 0, 'every customer comes across, and every debt starts at 0');
select _c((select phone || credit_limit || terms_days from customers c, nw where c.shop_id = nw.id and c.id = 'C001') = '0772410220500000030'
  and (select linked_supplier_id from customers c, nw where c.shop_id = nw.id and c.id = 'C002') = 'S001', 'with their phone, credit limit, terms and supplier link');
select _c((select debt from customers where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001' and id = 'C001') = 2410000, 'the old shop still says what was owed');
select _c((select count(*) from suppliers s, nw where s.shop_id = nw.id and s.terms_days = 30) = 1, 'suppliers come across with their terms');
select _c((select count(*) from products p, nw where p.shop_id = nw.id) = 2
  and (select image from products p, nw where p.shop_id = nw.id and p.id = 'P001') like '%/aaaaaaaa-0000-0000-0000-000000000001/a.jpg'
  and (select wholesale_markup_value from products p, nw where p.shop_id = nw.id and p.id = 'P001') = 25, 'products come across with their photo and markup');
select _c((select count(*) from prices p, nw where p.shop_id = nw.id) = 2
  and not exists (select 1 from prices a, prices b, nw where a.shop_id = nw.id and b.shop_id = 'aaaaaaaa-0000-0000-0000-000000000001' and a.id = b.id)
  and (select date from prices p, nw where p.shop_id = nw.id and p.product_id = 'P001') = '2026-08-01', 'prices come across with new ids and their own dates');
select _c(exists (select 1 from product_links l, nw where l.shop_id = nw.id and l.id = 7 and l.to_id = 'P002')
  and exists (select 1 from item_names i, nw where i.shop_id = nw.id and i.word = 'mabaati'), 'item links and the names customers use come across');
select _c((select count(*) from media_folders f, nw where f.shop_id = nw.id) = 2
  and (select p.name from media_folders c join media_folders p on p.id = c.parent_id, nw where c.shop_id = nw.id and c.name = 'Sheets') = 'Roofing'
  and (select f.shop_id from media m join media_folders f on f.id = m.folder_id, nw where m.shop_id = nw.id) = (select id from nw),
  'the photo library comes across, folders inside folders, each photo in its folder''s copy');
select _c((select count(*) from staff s, nw where s.shop_id = nw.id) = 2
  and (select user_id from staff s, nw where s.shop_id = nw.id and s.id = 'ST001') = '00000000-0000-0000-0000-0000000000a2', 'staff come across, linked to their logins');
select _c((select count(*) from agents a, nw where a.shop_id = nw.id) = 1
  and (select user_id from agents a, nw where a.shop_id = nw.id and a.id = 'A001') is null, 'active agents come across without their login; a retired one stays behind');
select _c((select daily_target from agent_goals g, nw where g.shop_id = nw.id) = 500000
  and (select count(*) from agent_clients c, nw where c.shop_id = nw.id) = 1, 'with their goals and their own clients only');
select _c(exists (select 1 from places p, nw where p.shop_id = nw.id and p.name = 'Ntinda'), 'places come across');
select _c((select count(*) from rent_agreements r, nw where r.shop_id = nw.id) = 1, 'rent still running comes across; a finished lease stays behind');
select _c((select count(*) from fixed_assets f, nw where f.shop_id = nw.id) = 1
  and (select cash_txn_id is null from fixed_assets f, nw where f.shop_id = nw.id), 'assets still owned come across, without the old cash line');
select _c(exists (select 1 from rival_prices r, nw where r.shop_id = nw.id and r.price = 58000), 'rivals'' prices come across');

select _c(not exists (select 1 from stock s, nw where s.shop_id = nw.id) and not exists (select 1 from cash_txns c, nw where c.shop_id = nw.id)
  and not exists (select 1 from saved_quotes q, nw where q.shop_id = nw.id) and not exists (select 1 from purchase_invoices p, nw where p.shop_id = nw.id)
  and not exists (select 1 from loans l, nw where l.shop_id = nw.id) and not exists (select 1 from customer_debt_log l, nw where l.shop_id = nw.id),
  'no stock, cash, orders, supplier bills, loans or debt history come across');
select _c((select count(*) from stock where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1
  and (select count(*) from saved_quotes where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'and none of it leaves the old shop');
select _c((select n from done where what = 'LEFT: customers owing') = 1 and (select note from done where what = 'LEFT: customers owing') like '%2,410,000%',
  'the report says who owed what in the old books, to confirm');
select _c((select n from done where what = 'LEFT: stock lines') = 1 and (select n from done where what = 'LEFT: team logins') = 2, 'and how much stock and how many logins are left to move');
select _c(exists (select 1 from wa_numbers where phone_number_id = 'pn-1' and shop_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  and exists (select 1 from catalogues where slug = 'joan-roofing' and shop_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'WhatsApp and catalogues stay put until switch day');

do $$ begin perform ow_fresh_start('aaaaaaaa-0000-0000-0000-000000000001', 'Again', true); perform _c(false, 'a second fresh start from the same shop is refused');
exception when others then perform _c(sqlerrm like 'Shop % was already started fresh from this one%', 'a second fresh start from the same shop is refused, naming the first'); end $$;

-- ---- 4. switch day
do $$ begin perform ow_fresh_start_move('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', true); perform _c(false, 'a move to a shop not made by a fresh start is refused');
exception when others then perform _c(sqlerrm like '%was not started fresh from%', 'a move to a shop not made by a fresh start is refused'); end $$;
create temp table mdry as select * from ow_fresh_start_move('aaaaaaaa-0000-0000-0000-000000000001', (select id from nw));
select _c((select what from mdry limit 1) = 'DRY RUN: nothing was saved' and (select n from mdry where what = 'team logins moved') = 2
  and (select count(*) from shop_members where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 3, 'the move''s dry run reports and changes nothing');
create temp table mv as select * from ow_fresh_start_move('aaaaaaaa-0000-0000-0000-000000000001', (select id from nw), true);
select _c((select string_agg(role, ',' order by role) from shop_members m, nw where m.shop_id = nw.id) = 'manager,owner,store', 'the team now opens the new shop');
select _c((select string_agg(role, ',') from shop_members where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'owner', 'and only the owner still opens the old one');
select _c((select user_id from agents a, nw where a.shop_id = nw.id and a.id = 'A001') = '00000000-0000-0000-0000-0000000000a4'
  and (select user_id from agents where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001' and id = 'A001') is null, 'the agent''s login moved to their copy');
select _c((select user_id from agents where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001' and id = 'A002') = '00000000-0000-0000-0000-0000000000a5', 'a retired agent is left as they were');
select _c((select shop_id from catalogues where slug = 'joan-roofing') = (select id from nw)
  and (select shop_id from wa_numbers where phone_number_id = 'pn-1') = (select id from nw), 'the agent''s catalogue and the WhatsApp number moved');
create temp table mv2 as select * from ow_fresh_start_move('aaaaaaaa-0000-0000-0000-000000000001', (select id from nw), true);
select _c((select count(*) from shop_members m, nw where m.shop_id = nw.id) = 3 and (select n from mv2 where what = 'agent logins moved') = 0, 'running the move again changes nothing');

-- ---- 5. the Manager confirms each balance (set_opening_balance, debt.open)
grant select on nw to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
do $$ begin perform set_opening_balance((select id from nw), 'C001', 2000000); perform _c(false, 'a Store login cannot give an opening balance');
exception when others then perform _c(sqlerrm like '%needs debt.open%', 'a Store login cannot give an opening balance'); end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
do $$ begin perform set_opening_balance((select id from nw), 'C001', 2000000, current_date + 3); perform _c(false, 'a debt cannot start after today');
exception when others then perform _c(sqlerrm like 'A debt cannot start after today%', 'a debt cannot start after today'); end $$;
do $$ begin perform set_opening_balance((select id from nw), 'C001', -5); perform _c(false, 'a negative balance is refused');
exception when others then perform _c(sqlerrm like 'An opening balance is what they owe%', 'a negative balance is refused'); end $$;
select set_opening_balance((select id from nw), 'C001', 2000000, '2026-09-01');
select set_opening_balance((select id from nw), 'C001', 2100000, '2026-09-01');
reset role;
select _c((select debt from customers c, nw where c.shop_id = nw.id and c.id = 'C001') = 2100000, 'the Manager''s figure is what the customer owes, set again before any trading');
select _c((select count(*) from customer_debt_log l, nw where l.shop_id = nw.id and l.customer_id = 'C001') = 1
  and (select type || ' ' || amount || ' ' || date || ' ' || note from customer_debt_log l, nw where l.shop_id = nw.id and l.customer_id = 'C001') = 'charge 2100000 2026-09-01 Opening balance',
  'one opening line in their debt book, dated as confirmed, never two');
select _c((select confirmed -> 'C001' ->> 'amount' from fresh_starts f, nw where f.shop_id = nw.id) = '2100000', 'the checklist marks them confirmed');
select _c((select count(*) from decision_log d, nw where d.shop_id = nw.id and d.task = 'debt.open') = 2
  and (select before ->> 'oldBooks' from decision_log d, nw where d.shop_id = nw.id and d.task = 'debt.open' order by at desc limit 1) = '2410000'
  and (select by_name from decision_log d, nw where d.shop_id = nw.id and d.task = 'debt.open' limit 1) = 'Ruth Nakato',
  'each is in the owner''s log, by name, with what the old books said');
select _c((select debt from customers where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001' and id = 'C001') = 2410000, 'the old shop''s figure is untouched');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
select set_opening_balance((select id from nw), 'C002', 0);
reset role;
select _c((select debt from customers c, nw where c.shop_id = nw.id and c.id = 'C002') = 0
  and not exists (select 1 from customer_debt_log l, nw where l.shop_id = nw.id and l.customer_id = 'C002')
  and (select confirmed -> 'C002' ->> 'amount' from fresh_starts f, nw where f.shop_id = nw.id) = '0', '"owes nothing" is a confirmation too, with no line in the book');
insert into customer_debt_log(id, shop_id, customer_id, date, type, amount, note) select 990001, id, 'C001', current_date, 'payment', 100000, '' from nw;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
do $$ begin perform set_opening_balance((select id from nw), 'C001', 5000000); perform _c(false, 'once a customer has traded, their opening balance is locked');
exception when others then perform _c(sqlerrm like '%has traded in these books already%', 'once a customer has traded, their opening balance is locked'); end $$;
select _c((select count(*) from fresh_starts f, nw where f.shop_id = nw.id) = 1, 'a member reads their shop''s checklist');
select _c((select count(*) from fresh_starts where shop_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'and nothing of a shop they are not in');
do $$ begin update fresh_starts set old_debts = '{}' where true; perform _c(false, 'no login writes the checklist by hand');
exception when insufficient_privilege then perform _c(true, 'no login writes the checklist by hand'); end $$;
reset role;

-- ---- 6. no app login may call the operator's steps
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
do $$ begin perform ow_fresh_start('aaaaaaaa-0000-0000-0000-000000000001', 'X'); perform _c(false, 'an app login cannot start a shop afresh');
exception when insufficient_privilege then perform _c(true, 'an app login cannot start a shop afresh'); end $$;
do $$ begin perform ow_fresh_start_move('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'); perform _c(false, 'nor move a team');
exception when insufficient_privilege then perform _c(true, 'nor move a team'); end $$;
do $$ begin perform ow_fs_copy('customers', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'); perform _c(false, 'nor copy a table');
exception when insufficient_privilege then perform _c(true, 'nor copy a table'); end $$;
reset role;

select case when ok then 'PASS' else 'FAIL' end, label from _r order by n;
