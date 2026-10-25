-- The old rows docs/audit/manager/round-1-correct.sql corrects, as the brief
-- found them on live (run after manager-round1-scenario.sql, which leaves P2
-- and P3 with lots that don't add up and a cash line of 386,666.67).
set session_replication_role = replica;
insert into customers(shop_id,id,name,debt) values
 ('11111111-1111-1111-1111-111111111111','C10','Muyanja Traders',0),('11111111-1111-1111-1111-111111111111','C11','Adinan',0),
 ('11111111-1111-1111-1111-111111111111','C12','Baker',0);
insert into saved_quotes(id, shop_id, client_name, date, status, invoiced, invoiced_at, voided, amount_paid, payload) overriding system value values
 (415,'11111111-1111-1111-1111-111111111111','Ken','2026-09-22','completed',true,'2026-09-22',false,400000,'{"customerId":"C1","debtCharged":100000,"items":[{"lineId":1,"productName":"Iron sheet","qty":1,"price":400000,"sellPrice":500000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-09-22","amount":400000,"cashTxnId":18965,"method":"cash"}]}'),
 (166,'11111111-1111-1111-1111-111111111111','Muyanja Traders','2026-08-10','completed',true,'2026-08-10',true,7040000,'{"customerId":"C10","items":[{"lineId":1,"productName":"Tiles","qty":1,"price":6000000,"sellPrice":7040000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-08-10","amount":7040000,"cashTxnId":18001,"method":"bank"}]}'),
 (148,'11111111-1111-1111-1111-111111111111','Adinan','2026-08-05','preparing',false,null,true,500000,'{"customerId":"C11","items":[{"lineId":1,"productName":"Paint","qty":10,"price":40000,"sellPrice":50000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-08-05","amount":500000,"cashTxnId":18002,"method":"cash"}]}'),
 (300,'11111111-1111-1111-1111-111111111111','Baker','2026-08-28','completed',false,null,false,100000,'{"customerId":"C12","items":[{"lineId":1,"productName":"Paint","qty":2,"price":40000,"sellPrice":50000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-08-22","amount":100000,"cashTxnId":18003,"method":"cash","note":""}]}'),
 (301,'11111111-1111-1111-1111-111111111111','Baker','2026-08-28','preparing',false,null,false,50000,'{"customerId":"C12","items":[{"lineId":1,"productName":"Paint","qty":1,"price":40000,"sellPrice":50000,"supplierId":"__stock__"}],"payments":[{"id":1,"date":"2026-08-20","amount":50000,"cashTxnId":18004,"method":"cash","note":"Deposit"}]}');
insert into cash_txns(id, shop_id, date, account, type, category, amount, description, quote_id) values
 (18965,'11111111-1111-1111-1111-111111111111','2026-09-22','momo','receipt','Debt Payment',500000,'Debt Payment',null),
 (18001,'11111111-1111-1111-1111-111111111111','2026-08-10','bank','receipt','Invoice Payment',7040000,'Payment — #0166',166),
 (18002,'11111111-1111-1111-1111-111111111111','2026-08-05','cash','receipt','Invoice Payment',500000,'Payment — #0148',148),
 (18003,'11111111-1111-1111-1111-111111111111','2026-08-22','cash','receipt','Invoice Payment',100000,'Payment — #0300',300),
 (18004,'11111111-1111-1111-1111-111111111111','2026-08-20','cash','receipt','Invoice Payment',50000,'Payment — #0301',301),
 (18005,'11111111-1111-1111-1111-111111111111','2026-10-02','cash','receipt','Debt Payment',16804.5,'Debt Payment',null);
insert into manager_notes(shop_id, kind, date, status, body) values
 ('11111111-1111-1111-1111-111111111111','target','2026-08-01','open','{"metric":"sales","aim":3000000,"from":"2026-08-01","to":"2026-08-31"}');
-- A second shop with a key apart too: the check is strict in every shop.
insert into shops(id, name, created_by) values ('22222222-2222-2222-2222-222222222222','Second shop','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-00000000000a','owner');
insert into stock(shop_id,key,product_id,qty) values ('22222222-2222-2222-2222-222222222222','Q1','Q1',2);
insert into stock_lots(shop_id,key,qty,cost) values ('22222222-2222-2222-2222-222222222222','Q1',7,100),('22222222-2222-2222-2222-222222222222','Q9',3,100);
set session_replication_role = origin;
