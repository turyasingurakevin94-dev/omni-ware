-- After docs/audit/manager/round-1-correct.sql has run (twice): what it did.
create table if not exists _c(n serial, label text, ok boolean);
insert into _c(label, ok) values
 ('#0415: the 400,000 cash payment names a new 400,000 cash receipt of 22 Sep for #0415; 18965 untouched',
  (select c.account = 'cash' and c.amount = 400000 and c.quote_id = 415 and c.date = '2026-09-22' and c.type = 'receipt'
     from saved_quotes q, jsonb_array_elements(q.payload -> 'payments') p, cash_txns c
    where q.id = 415 and c.id::text = p ->> 'cashTxnId' and c.id <> 18965)
  and (select quote_id is null and amount = 500000 from cash_txns where id = 18965)),
 ('lots: every key in every shop adds up to its stock',
  not exists (select 1 from (select coalesce(s.shop_id, l.shop_id) sid, coalesce(s.key, l.key) k, greatest(0, coalesce(s.qty, 0)) st, coalesce(l.lots, 0) lo
                               from stock s full join (select shop_id, key, sum(qty) lots from stock_lots group by 1, 2) l on l.shop_id = s.shop_id and l.key = s.key) x
               where abs(x.lo - x.st) > 0.0001)),
 ('lots: P2 keeps its newest layers (2 at 42,000, 3 of the 4 at 41,000; the oldest gone)',
  (select count(*) = 2 from stock_lots where key = 'P2') and exists (select 1 from stock_lots where key = 'P2' and qty = 2 and cost = 42000)
  and exists (select 1 from stock_lots where key = 'P2' and qty = 3 and cost = 41000) and not exists (select 1 from stock_lots where key = 'P2' and cost = 40000)),
 ('lots: P3 (short) gets one layer of 3 at its last known cost, 2,500',
  (select count(*) = 1 and sum(qty) = 3 and min(cost) = 2500 from stock_lots where key = 'P3')),
 ('lots: the second shop''s keys too (Q1 trimmed to 2, Q9 with no stock emptied)',
  (select sum(qty) = 2 from stock_lots where key = 'Q1') and not exists (select 1 from stock_lots where key = 'Q9')),
 ('lots: each key matched has a stock-log correction line',
  (select count(*) from stock_log where type = 'correction' and note like 'Lots matched to stock (Manager round 1)%') = 4),
 ('#0166 and #0148: marked test with their receipts; no refund, no deposit',
  (select bool_and(qa) from saved_quotes where id in (166, 148)) and (select bool_and(qa) from cash_txns where id in (18001, 18002))
  and not exists (select 1 from cash_txns where quote_id in (166, 148) and type = 'payment') and (select debt from customers where id = 'C10') = 0),
 ('round-1-check query 7 lists only the owner console''s void of #0209 (the scenario''s; the console is not held)',
  not exists (select 1 from saved_quotes q where coalesce(q.voided, false) and coalesce(q.amount_paid, 0) > 0
                and coalesce(q.payload -> 'voidMoney' ->> 'done', '') = '' and not coalesce(q.qa, false) and q.id <> 209)),
 ('fractions: 386,666.67 is 386,667 and 16,804.5 is 16,805',
  (select amount from cash_txns where id = 9400) = 386667 and (select amount from cash_txns where id = 18005) = 16805
  and not exists (select 1 from cash_txns where amount <> round(amount))),
 ('targets: August''s target ended, missed',
  exists (select 1 from manager_notes where kind = 'target' and body ->> 'to' = '2026-08-31' and status = 'ended' and body -> 'result' ->> 'reached' = 'false')),
 ('labels: #0300''s payment of 22 Aug is labelled Deposit; #0301''s (noted Deposit by Sales) is left as it was',
  (select p ->> 'label' = 'Deposit' and p ->> 'note' = 'Deposit' from saved_quotes, jsonb_array_elements(payload -> 'payments') p where id = 300)
  and (select not (p ? 'label') from saved_quotes, jsonb_array_elements(payload -> 'payments') p where id = 301)),
 ('the owner''s log has a books.correct line for each change (#0415, 4 keys, the test voids, 2 fractions, targets, #0300)',
  (select count(*) from decision_log where task = 'books.correct') = 10);
select case when ok then 'PASS' else 'FAIL' end, label, coalesce(ok::text, 'null') from _c order by n;
