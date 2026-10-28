-- 0172 The rebuild's second backend fix (docs/rebuild.md, "Backend fixes
-- decided"; docs/spec/02-money.md §8 Q14, Kevin 28 Oct 2026): an agent
-- order's total is its goods AND its charges.
--
-- 0109's order_shop_total, the SQL twin of orderShopTotal(), summed the
-- lines only. Its edge-function copies (agent-change-order,
-- agent-initiate-momo-payment, check-momo-payment-status) add the order's
-- charges (the agent's delivery fee). So on an order with a fee:
--
--   - apply_momo_payment marked it paid (agentPaymentStatus) once the goods
--     were covered, the fee still owed;
--   - use_agent_credit thought less was owed than the agent's app planned
--     for, refused every plan that covered the fee ('changed'), and the
--     agent was told their credit "keeps moving".
--
-- order_shop_total now counts the charges by the shop's one rule (0165's
-- ow_order_total, the functions' chargesTotal): a percent is of the goods,
-- a fixed charge whole shillings, nothing at or below 0. The two callers
-- above read it as they did; nothing else calls it.
--
-- Applied by hand, after 0171. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select order_shop_total('{"items":[{"sellPrice":1000,"qty":2}],"charges":[{"type":"fixed","value":5000},{"type":"percent","value":10}]}');  -- 7200
--
-- ROLLBACK: run 0109's order_shop_total again.
-- ---------------------------------------------------------------------

-- What the shop is owed for an agent order: sellPrice x qty, summed, and
-- the order's charges. The SQL twin of orderShopTotal() in
-- agent-change-order and of the totals in agent-initiate-momo-payment and
-- check-momo-payment-status; keep the four in step.
create or replace function public.order_shop_total(p jsonb) returns numeric
language sql immutable set search_path = public
as $$
  with goods as (
    select coalesce(sum(public.jsonb_num(it -> 'sellPrice') * public.jsonb_num(it -> 'qty')), 0) as g
      from jsonb_array_elements(case when jsonb_typeof(p -> 'items') = 'array' then p -> 'items' else '[]'::jsonb end) it
  )
  select g + coalesce((
    select sum(case when ch ->> 'type' = 'percent' then round(g * public.jsonb_num(ch -> 'value') / 100)
                    else round(public.jsonb_num(ch -> 'value')) end)
      from jsonb_array_elements(case when jsonb_typeof(p -> 'charges') = 'array' then p -> 'charges' else '[]'::jsonb end) ch
     where jsonb_typeof(ch) = 'object' and public.jsonb_num(ch -> 'value') > 0), 0)
    from goods
$$;
