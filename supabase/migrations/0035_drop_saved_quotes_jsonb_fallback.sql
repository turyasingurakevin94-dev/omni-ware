-- Removes the JSONB fallback branch 0027 left behind.
--
-- 0027 replaced an agent policy keyed on payload->>'originAgentId' -- an
-- unconstrained field the client sends -- with one keyed on a real FK'd
-- agent_id column. It kept a fallback for rows the backfill might have
-- missed:
--
--   agent_id = current_agent_id(shop_id)
--   or (agent_id is null and payload->>'originAgentId' = current_agent_id(shop_id))
--
-- That fallback has done nothing since the migration it shipped in. 0027
-- backfilled every existing row and added a BEFORE trigger keeping
-- agent_id in lockstep with payload->>'originAgentId'; 0030 validated the
-- foreign key. So an agent order with agent_id null cannot be written and
-- none exist.
--
-- It is not free, though. It is the exact untrusted-JSONB read 0027 was
-- written to eliminate, still evaluated on every row of every agent's
-- order list, and it is the branch that cannot use saved_quotes_agent_idx.
-- Leaving it there also leaves the pattern in the codebase to be copied.
--
-- Guarded rather than assumed. The count that justified this was taken at
-- one moment on one connection; this re-checks at apply time and refuses
-- to narrow the policy if any row would lose access, because an agent
-- silently unable to see their own orders is precisely the failure 0027
-- existed to stop.
do $$
declare
  orphaned bigint;
begin
  select count(*) into orphaned
    from saved_quotes
   where agent_id is null
     and payload->>'originAgentId' is not null;

  if orphaned > 0 then
    raise exception
      'Refusing to drop the fallback: % order(s) still have agent_id null with an originAgentId in payload. Backfill them first (0027 does this) or those agents lose sight of their own orders.',
      orphaned;
  end if;
end $$;

drop policy "agents read their own orders" on saved_quotes;

create policy "agents read their own orders" on saved_quotes
  for select
  using (agent_id = current_agent_id(shop_id));

-- Same fallback, same reasoning, in the staff-name lookup.
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
        and q.agent_id = current_agent_id(p_shop_id)
        and (q.payload->>'assignedWorkerId' = s.id or q.payload->>'assignedDeliveryId' = s.id)
    );
$$;
