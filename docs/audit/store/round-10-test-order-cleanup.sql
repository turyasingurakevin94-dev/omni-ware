-- Store round 10 (STO-REL-12): take the TEST order away again. Run after the two-tab test.
-- 1. What the test moved on the shelf, if anything (read it before step 2).
select l.id, l.key, l.type, l.delta, l.note, l.at
  from stock_log l
 where l.note ilike '%TEST · two tabs%'
    or l.note ~ ('#0*(' || (select string_agg(q.id::text, '|') from saved_quotes q where q.client_name = 'TEST · two tabs') || ')\M');
-- 2. Void the TEST order(s), so no screen and no figure counts them.
update saved_quotes set voided = true where client_name = 'TEST · two tabs' and not coalesce(voided, false)
returning id as voided_test_order, status;
-- 3. If step 1 listed a row that took a piece off the shelf, ask Ruth (the Manager) to put it back
--    from the Manager app: a stock correction is hers to make, and it keeps the log honest.
