-- Reattaches orders that a now-fixed bug detached from their agent.
--
-- Both apps used to rebuild an order's payload from an explicit field list
-- that omitted originAgentId, agentClientId, deliveryMode, deliveryAddress
-- and agentPaymentStatus -- the admin quote editor (fixed in 8d7b188) and
-- buildWorkerSyncRows in the worker app (fixed in c77a05b). Saving or even
-- just picking an agent's order therefore stripped those fields, and since
-- the trigger below derives agent_id FROM payload->>'originAgentId', the
-- column went null with it. The order stayed intact and correct in every
-- admin view while disappearing completely from the agent's app, with
-- nothing raised anywhere.
--
-- Both write paths are closed. This repairs what they already damaged.
--
-- ATTRIBUTION IS EVIDENCE-BASED, NOT INFERRED. "No agent on the order" is
-- also what an ordinary walk-in order looks like -- most unattributed
-- orders are exactly that and must be left alone, because attributing one
-- to an agent invents commission nobody owes. The only rows touched are
-- those carrying a successful mobile money payment, whose agent_id is
-- proof: agent-initiate-momo-payment refuses with 403 unless the order's
-- originAgentId already matched the caller, so a payment row cannot exist
-- for an order that was not theirs.
--
-- Only the payload is written. The BEFORE trigger from 0027 derives
-- agent_id from it, so setting both here would just be saying the same
-- thing twice and could disagree if the trigger ever changes.
do $$
declare
  repaired bigint := 0;
  r record;
begin
  for r in
    select q.id,
           q.shop_id,
           min(p.agent_id) as agent_id,
           count(distinct p.agent_id) as distinct_agents
      from saved_quotes q
      join agent_mobile_payments p
        on p.order_id = q.id
       and p.shop_id  = q.shop_id
       and p.status   = 'successful'
     where q.agent_id is null
       and q.payload->>'originAgentId' is null
     group by q.id, q.shop_id
    having count(distinct p.agent_id) = 1     -- never guess between two
  loop
    update saved_quotes
       set payload = coalesce(payload, '{}'::jsonb)
                     || jsonb_build_object(
                          'originAgentId', r.agent_id,
                          -- Evidenced by the same payment row that proves
                          -- ownership; this flag was stripped alongside it.
                          'agentPaymentStatus', 'paid'
                        )
     where id = r.id and shop_id = r.shop_id;
    repaired := repaired + 1;
    raise notice 'reattached order % to agent %', r.id, r.agent_id;
  end loop;

  raise notice 'repaired % order(s)', repaired;

  -- The trigger should have derived agent_id from the payload. If it did
  -- not, the repair has written a payload the RLS policy still cannot
  -- match on, which is worse than leaving the row alone -- so fail rather
  -- than report success.
  if exists (
    select 1 from saved_quotes
     where payload->>'originAgentId' is not null
       and agent_id is distinct from payload->>'originAgentId'
  ) then
    raise exception 'agent_id did not follow payload->>''originAgentId'' -- the 0027 sync trigger is not doing its job; rolling back';
  end if;
end $$;
