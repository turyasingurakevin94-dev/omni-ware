-- A standing detector for the bug 0036 had to repair by hand, plus the
-- policy gap found while wiring it up.
--
-- ---------------------------------------------------------------------
-- 1. Admins could not see agent mobile payments at all.
-- ---------------------------------------------------------------------
-- 0022 gave agent_mobile_payments exactly one policy: an agent reading
-- their own rows. Nothing for the shop. But index.html has a Mobile Money
-- screen that reads this table, so for an admin it has always come back
-- empty -- not an error, not a warning, just a permanently blank screen
-- for every momo payment the shop has ever collected.
--
-- Read-only for members, and no new exposure: the amount and status of an
-- agent's payment against a shop order is the shop's own commercial
-- record. Writes stay with the service role, which is the only thing that
-- should ever create or resolve one of these.
create policy "shop members view agent mobile payments" on agent_mobile_payments
  for select using (is_shop_member(shop_id));

-- ---------------------------------------------------------------------
-- 2. The detector.
-- ---------------------------------------------------------------------
-- Both apps used to rebuild an order's payload from an explicit field list
-- that omitted originAgentId; since the 0027 trigger derives agent_id from
-- that field, the column went null with it and the order silently
-- vanished from its agent's app while looking perfect in every admin view.
-- It ran undetected for about ten days.
--
-- Both write paths are fixed, so this should always return nothing. That
-- is exactly why it is worth running: the failure is invisible from the
-- side that would notice, so the only way it surfaces is if something
-- looks for it.
--
-- Keyed on payment evidence rather than on "looks unattributed", because
-- an ordinary walk-in order is ALSO unattributed and always will be.
-- agent-initiate-momo-payment refuses with 403 unless the order's
-- originAgentId already matched the caller, so a successful payment row
-- cannot exist for an order that was not that agent's.
create or replace function detached_agent_orders(p_shop_id uuid)
returns table(order_id bigint, order_date date, status text, agent_id text, amount numeric)
language sql
security definer
stable
set search_path = public
as $$
  select q.id, q.date, q.status, p.agent_id, p.amount
    from saved_quotes q
    join agent_mobile_payments p
      on p.order_id = q.id
     and p.shop_id  = q.shop_id
     and p.status   = 'successful'
   where q.shop_id = p_shop_id
     and is_shop_member(p_shop_id)
     and q.agent_id is null
     and q.payload->>'originAgentId' is null
   order by q.id;
$$;

revoke all on function detached_agent_orders(uuid) from public;
grant execute on function detached_agent_orders(uuid) to authenticated;
