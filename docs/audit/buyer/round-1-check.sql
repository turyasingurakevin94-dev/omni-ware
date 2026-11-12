-- Buyer round 1 (BUY-02, BUY-08, BUY-09): read-only checks to run in the Supabase SQL editor before Phase B.
-- Nothing here writes. Each answers one question the fix depends on.

-- 1. BUY-02: on #0606 and #0612, what each line holds. items[].price is the buyer's COST (the old buyer.html
--    and the new app write it there); items[].sellPrice is what the CLIENT pays (Sales writes it, Sales totals it).
--    Expect: sellPrice unchanged by the Buyer (928 on the bolts if Sales placed it at 928); price = the cost the buyer saved.
select q.id, q.status, q.payload->>'stage' as stage, i.ord as line,
       i.item->>'productName' as item, (i.item->>'qty')::numeric as qty,
       (i.item->>'price')::numeric as cost_price_field, (i.item->>'sellPrice')::numeric as sell_price_field,
       i.item->>'priceWas' as cost_was, i.item->>'repricedAt' as repriced_at,
       (q.payload->>'total')::numeric as stored_total
from saved_quotes q, jsonb_array_elements(q.payload->'items') with ordinality as i(item, ord)
where q.id in (606, 612)
order by q.id, i.ord;

-- 2. BUY-02: does any stored order total move when the buyer saves a cost? Orders whose stored total equals
--    the sum of qty × price (cost) rather than qty × sellPrice — those would show the bug in Sales or the Manager.
select q.id,
       (q.payload->>'total')::numeric as stored_total,
       sum((i->>'qty')::numeric * coalesce((i->>'sellPrice')::numeric, 0)) as by_sell_price,
       sum((i->>'qty')::numeric * coalesce((i->>'price')::numeric, 0)) as by_cost
from saved_quotes q, jsonb_array_elements(q.payload->'items') i
where q.created_at > now() - interval '30 days'
group by q.id, q.payload
having (q.payload->>'total') is not null
   and round((q.payload->>'total')::numeric) <> round(sum((i->>'qty')::numeric * coalesce((i->>'sellPrice')::numeric, 0)))
order by q.id desc
limit 50;

-- 3. BUY-08: lines still to buy with no selling price (the "sells 0" ones: Edging Lipping, Jin Zhuang).
select q.id, i->>'productName' as item, i->>'sellPrice' as sell_price, i->>'priceAsk' as price_ask, i->>'priceNote' as price_note
from saved_quotes q, jsonb_array_elements(q.payload->'items') i
where coalesce(nullif(i->>'sellPrice', '')::numeric, 0) = 0
  and q.created_at > now() - interval '30 days'
order by q.id desc;

-- 4. BUY-09: a price-list row whose price went 400 → 450: what the row keeps as the old price.
--    (the table is prices; buyer_confirm_price, 0136, keeps the row's own columns: see what it holds)
select *
from prices
order by id desc
limit 30;
