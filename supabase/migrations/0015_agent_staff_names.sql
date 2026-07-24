-- Lets an agent resolve the display name of whichever staff member is
-- currently preparing or delivering one of their OWN orders ("Andrew is
-- preparing your order") for the Order history screen, without granting
-- any broader access to the staff roster -- agents have no RLS policy on
-- `staff` at all otherwise (0012_sales_agents.sql), and this intentionally
-- keeps it that way. Scoped tightly: a name is only ever returned for a
-- staff id that's actually referenced as the assignedWorkerId or
-- assignedDeliveryId on one of THIS agent's own orders, so there's no way
-- to probe the wider staff list through this function.
create or replace function agent_staff_names(p_shop_id uuid, p_staff_ids text[])
returns table(id text, name text)
language sql security definer stable set search_path = public
as $$
  select s.id, s.name
  from staff s
  where s.shop_id = p_shop_id
    and s.id = any(p_staff_ids)
    and exists (
      select 1 from saved_quotes q
      where q.shop_id = p_shop_id
        and is_order_agent(p_shop_id, q.payload->>'originAgentId')
        and (q.payload->>'assignedWorkerId' = s.id or q.payload->>'assignedDeliveryId' = s.id)
    );
$$;
