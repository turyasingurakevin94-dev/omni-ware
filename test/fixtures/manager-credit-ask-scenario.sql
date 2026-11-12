-- docs/audit/manager/0184b-credit-ask.sql asked of a real database, after
-- manager-pushes-scenario.sql (its people, customers and helpers): Sales or
-- Accounts ask the Manager for a credit limit; the Manager's answer writes
-- the limit and tells the asker.
truncate _r restart identity;
grant all on all tables in schema public to authenticated;
create function _ask(p_customer text) returns uuid language sql security definer as $$
  select id from customer_asks where customer_id = p_customer order by created_at desc limit 1
$$;
grant execute on function _ask to authenticated;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000012';
select _try('esther (Accounts) asks 3,000,000 · 14 days for Ggaba Stores', 'ok', $q$select ask_credit_limit('11111111-1111-1111-1111-111111111111','C1',3000000,14,'pays on time')$q$);
select _try('check: "Credit asked · Ggaba Stores" to Ruth, "Esther asks 3,000,000 · 14 days — pays on time"', 'ok', $q$select _is($c$_to('credit.limit.ask', 'Credit asked · Ggaba Stores') = '0b' and (select body from push_outbox where kind = 'credit.limit.ask') = 'Esther asks 3,000,000 · 14 days — pays on time'$c$)$q$);
select _try('esther asks again for Ggaba while one waits', 'refused: 22023', $q$select ask_credit_limit('11111111-1111-1111-1111-111111111111','C1',2000000,14,null)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('musa (Store) asks for credit', 'refused: 42501', $q$select ask_credit_limit('11111111-1111-1111-1111-111111111111','C3',1000000,7,null)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace (Sales) answers Esther''s ask', 'refused: 42501', $q$select answer_credit_limit(_ask('C1'), true)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: yes, 3,000,000 · 14 days', 'ok', $q$select answer_credit_limit(_ask('C1'), true)$q$);
select _try('check: Ggaba''s limit 3,000,000, 14 days; Esther told "Ruth set Ggaba''s limit"; logged', 'ok', $q$select _is($c$(select credit_limit = 3000000 and terms_days = 14 from customers where id = 'C1') and _to('credit.limit.ask.decided', 'Ruth set Ggaba''s limit') = '12' and (select body from push_outbox where kind = 'credit.limit.ask.decided') = 'Limit 3,000,000 · 14 days.' and exists (select 1 from decision_log where task = 'credit.set' and ref->>'id' = 'C1')$c$)$q$);
select _try('ruth answers it again', 'refused: 22023', $q$select answer_credit_limit(_ask('C1'), false)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace asks 1,000,000 for Nansana Hardware', 'ok', $q$select ask_credit_limit('11111111-1111-1111-1111-111111111111','C3',1000000,7,'new site')$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('ruth: no, cash only', 'ok', $q$select answer_credit_limit(_ask('C3'), false, null, null, 'Cash until they have paid twice.')$q$);
select _try('check: Nansana still no limit; Grace told "Ruth kept Nansana on cash" with Ruth''s words', 'ok', $q$select _is($c$(select credit_limit is null from customers where id = 'C3') and _to('credit.limit.ask.decided', 'Ruth kept Nansana on cash') = '0d' and (select body from push_outbox where dedupe like 'creditaskdone:%' and to_user = '00000000-0000-0000-0000-00000000000d') = 'Cash until they have paid twice.'$c$)$q$);
reset role;
select case when coalesce(r.got = r.expect or (r.expect like 'refused%' and r.got like r.expect || '%'), false) then 'PASS' else 'FAIL' end, r.label, r.got
  from _r r order by r.n;
