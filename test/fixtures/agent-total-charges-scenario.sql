-- 0172 asked of a real database (docs/spec/02-money.md §8 Q14): an agent
-- order's total is its goods and its charges, for mobile money and credit.
-- Run as the edge functions run them: the service role, no login.
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','owner@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Omni-ware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner');
insert into agents(shop_id, id, name, phone) values ('11111111-1111-1111-1111-111111111111','A1','Moses','0772000009');

-- #0401 2 x 10,000 of cement and a 5,000 delivery fee: 25,000.
-- #0402 10,000 of cement and a 5,000 delivery fee: 15,000, to be paid from #0403's credit of 20,000.
-- #0404 the same as #0402.
insert into saved_quotes(id, shop_id, client_name, date, status, agent_id, payload) overriding system value values
 (401,'11111111-1111-1111-1111-111111111111','Agent client',ow_today(),'draft','A1','{"originAgentId":"A1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":2,"price":9000,"sellPrice":10000}],"charges":[{"id":1,"label":"Delivery","type":"fixed","value":5000,"agentDelivery":true}]}'),
 (402,'11111111-1111-1111-1111-111111111111','Agent client',ow_today(),'draft','A1','{"originAgentId":"A1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":9000,"sellPrice":10000}],"charges":[{"id":1,"label":"Delivery","type":"fixed","value":5000,"agentDelivery":true}]}'),
 (403,'11111111-1111-1111-1111-111111111111','Agent client',ow_today(),'completed','A1','{"originAgentId":"A1","payments":[],"items":[],"agentCredit":{"amount":20000,"used":[]}}'),
 (404,'11111111-1111-1111-1111-111111111111','Agent client',ow_today(),'draft','A1','{"originAgentId":"A1","payments":[],"items":[{"lineId":1,"productId":"P1","productName":"Cement","qty":1,"price":9000,"sellPrice":10000}],"charges":[{"id":1,"label":"Delivery","type":"fixed","value":5000,"agentDelivery":true}]}');
insert into agent_mobile_payments(shop_id, agent_id, order_id, provider, phone, amount, external_reference, status) values
 ('11111111-1111-1111-1111-111111111111','A1',401,'mtn','0772000009',20000,gen_random_uuid(),'successful'),
 ('11111111-1111-1111-1111-111111111111','A1',401,'mtn','0772000009',5000,gen_random_uuid(),'successful');

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  begin execute q;
  exception when others then got := 'refused: ' || sqlstate || ' ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
create function _is(cond_sql text) returns void language plpgsql as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;

-- ---------------- the rule
select _try('goods 2,000, a fixed 5,000 and 10 % of the goods: 7,200', 'ok', $q$select _is($c$order_shop_total('{"items":[{"sellPrice":1000,"qty":2}],"charges":[{"type":"fixed","value":5000},{"type":"percent","value":10}]}') = 7200$c$)$q$);
select _try('a charge at 0 or below, or not a charge, adds nothing', 'ok', $q$select _is($c$order_shop_total('{"items":[{"sellPrice":1000,"qty":2}],"charges":[{"type":"fixed","value":0},{"type":"fixed","value":-500},"x"]}') = 2000$c$)$q$);
select _try('a value written as text counts, as Number() reads it', 'ok', $q$select _is($c$order_shop_total('{"items":[{"sellPrice":"1000","qty":"2"}],"charges":[{"type":"fixed","value":"5000"}]}') = 7000$c$)$q$);
select _try('no charges: the goods, as before', 'ok', $q$select _is($c$order_shop_total('{"items":[{"sellPrice":1000,"qty":2}]}') = 2000 and order_shop_total('{}') = 0$c$)$q$);

-- ---------------- mobile money
select _try('momo: 20,000 on #0401 (25,000 with its delivery)', 'ok', $q$select apply_momo_payment((select min(id) from agent_mobile_payments))$q$);
select _try('check: #0401 is not paid yet — the delivery fee is still owed', 'ok', $q$select _is($c$(select amount_paid from saved_quotes where id=401) = 20000 and (select payload->>'agentPaymentStatus' from saved_quotes where id=401) is null$c$)$q$);
select _try('momo: the last 5,000', 'ok', $q$select apply_momo_payment((select max(id) from agent_mobile_payments))$q$);
select _try('check: #0401 is paid', 'ok', $q$select _is($c$(select amount_paid from saved_quotes where id=401) = 25000 and (select payload->>'agentPaymentStatus' from saved_quotes where id=401) = 'paid'$c$)$q$);

-- ---------------- the agent's credit
select _try('credit: more than #0404 owes (16,000) is refused', 'ok', $q$select _is($c$(use_agent_credit('11111111-1111-1111-1111-111111111111','A1',404,'[{"from":403,"amount":16000}]')) ->> 'reason' = 'changed'$c$)$q$);
select _try('credit: 15,000 pays #0402, delivery and all', 'ok', $q$select _is($c$(use_agent_credit('11111111-1111-1111-1111-111111111111','A1',402,'[{"from":403,"amount":15000}]')) @> '{"ok":true,"credited":15000,"owed":0,"paid":true}'$c$)$q$);
select _try('check: #0402 is paid 15,000; #0403 has 5,000 of credit left', 'ok', $q$select _is($c$(select amount_paid from saved_quotes where id=402) = 15000 and (select payload->>'agentPaymentStatus' from saved_quotes where id=402) = 'paid' and (select (payload->'agentCredit'->'used'->0->>'amount')::numeric from saved_quotes where id=403) = 15000$c$)$q$);
select _try('credit: the 5,000 left pays part of #0404, which still owes its fee', 'ok', $q$select _is($c$(use_agent_credit('11111111-1111-1111-1111-111111111111','A1',404,'[{"from":403,"amount":5000}]')) @> '{"ok":true,"credited":5000,"owed":10000}' and (select payload->>'agentPaymentStatus' from saved_quotes where id=404) is null$c$)$q$);

select case when (expect = 'ok' and got = 'ok') or (expect like 'refused:%' and got like 'refused: ' || substr(expect, 9) || '%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
