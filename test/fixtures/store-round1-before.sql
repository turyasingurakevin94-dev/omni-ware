-- The books as they stood before 0161 (test/store-round1.test.js): two waiting
-- counts of one aisle, a return labelled in the pack unit, an empty shelf with
-- a loss reported on it, and products in the Furniture catch-all.
\set ON_ERROR_STOP 1
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','o@x'),('00000000-0000-0000-0000-00000000000b','m@x'),('00000000-0000-0000-0000-00000000000e','s@x'),('00000000-0000-0000-0000-00000000000f','j@x');
insert into shops(id,name,created_by) values ('11111111-1111-1111-1111-111111111111','M','00000000-0000-0000-0000-00000000000a'),('22222222-2222-2222-2222-222222222222','Other','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','store'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','store');
insert into staff(shop_id,id,name,role,user_id) values ('11111111-1111-1111-1111-111111111111','W3','Musa Kiggundu','store','00000000-0000-0000-0000-00000000000e'),('11111111-1111-1111-1111-111111111111','W4','Joy Namata','store','00000000-0000-0000-0000-00000000000f');
insert into products(shop_id,id,name,category,variants) values
 ('11111111-1111-1111-1111-111111111111','P269','OMEGA Hinges - Normal','Furniture','[]'),
 ('11111111-1111-1111-1111-111111111111','P522','Masasi 15pairs',null,'[]'),
 ('11111111-1111-1111-1111-111111111111','P103','Casters','Furniture','[]'),
 ('11111111-1111-1111-1111-111111111111','P435','Drawer Runners - Maria','Runners','[]'),
 ('11111111-1111-1111-1111-111111111111','P107','Chrome Pipe','Furniture','[{"combo":{"Pipe Sizes":"19mm - Light"}},{"combo":{"Pipe Sizes":"25mm - Heavy"}},{"combo":{"Pipe Sizes":"25mm - Light"}}]'),
 ('11111111-1111-1111-1111-111111111111','P271','ZAWAINA Hinges - Normal','Furniture','[{"combo":{"Mulper Type":"Full Overlay"}},{"combo":{"Mulper Type":"Half Bend(Type B)"}}]'),
 ('11111111-1111-1111-1111-111111111111','P342','ABC Black Screws','Fasteners','[]'),
 ('22222222-2222-2222-2222-222222222222','P269','Something else','Furniture','[]');
insert into stock(shop_id,key,product_id,qty) values ('11111111-1111-1111-1111-111111111111','P342','P342',0),('11111111-1111-1111-1111-111111111111','P103','P103',5);
insert into stock_counts(id,shop_id,aisle,counted_by,counted_by_name,lines,status,created_at) values
 ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Aisle A · Aluminum','00000000-0000-0000-0000-00000000000f','Joy Namata','[{"key":"P1","counted":2}]','sent','2026-10-21T20:32:00Z'),
 ('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Aisle A · Aluminum','00000000-0000-0000-0000-00000000000e','Musa Kiggundu','[{"key":"P1","counted":0}]','sent','2026-10-23T07:29:00Z'),
 ('aaaaaaaa-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Aisle G · Furniture','00000000-0000-0000-0000-00000000000e','Musa Kiggundu','[{"key":"P103","counted":5}]','accepted','2026-10-20T07:29:00Z');
insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (494,'11111111-1111-1111-1111-111111111111','Ken Bwaise','completed',
 '{"deliveredAt":"2026-10-20T10:00:00Z","items":[{"lineId":1,"productId":"P342","productName":"ABC Black Screws","qty":20,"unit":"Box","packQty":20,"packUnit":"Ctn","sellPrice":11500}]}');
insert into saved_quotes(id,shop_id,client_name,status,payload) overriding system value values (495,'11111111-1111-1111-1111-111111111111','Ggaba Stores','completed',
 '{"deliveredAt":"2026-10-21T10:00:00Z","items":[{"lineId":1,"productId":"P342","productName":"ABC Black Screws","qty":40,"unit":"Box","packQty":20,"packUnit":"Ctn","sellPrice":11500}]}');
insert into invoice_asks(id,shop_id,quote_id,kind,lines,amount,reason,asked_by,status) values
 ('bbbbbbbb-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',494,'credit','[{"idx":0,"qty":20,"unit":"Ctn","shown":"20 Ctn","name":"ABC Black Screws","condition":"good","price":11500,"amount":230000}]',230000,'Came back','00000000-0000-0000-0000-00000000000e','sent');
insert into stock_reports(id,shop_id,key,product_id,name,qty,why,status) values
 ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','P342','P342','ABC Black Screws',1,'damaged','sent'),
 ('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','P103','P103','Casters',2,'damaged','sent');
