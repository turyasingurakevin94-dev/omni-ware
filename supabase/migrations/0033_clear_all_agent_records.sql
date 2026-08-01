-- Clears every agent-owned record ahead of onboarding real agents.
--
-- Reports counts as it goes, because the reason for running this was a
-- brand-new agent appearing to already hold a client list. The most likely
-- cause was client-side: the agent app's offline snapshot lived under one
-- localStorage key per BROWSER rather than per agent, so a second agent
-- signing in on the same device inherited the previous one's roster (fixed
-- alongside this migration). If the counts below come back non-zero, there
-- was server-side residue too and the notices say exactly how much.

do $$
declare
  n_clients int; n_orders int; n_agents int;
  n_solutions int; n_clusters int; n_goals int;
  n_claims int; n_momo int; n_catalogues int; n_inquiries int;
begin
  select count(*) into n_clients   from agent_clients;
  select count(*) into n_agents    from agents;
  select count(*) into n_orders    from saved_quotes where agent_id is not null;
  select count(*) into n_solutions from solution_templates;
  select count(*) into n_clusters  from agent_clusters;
  select count(*) into n_goals     from agent_goals;
  select count(*) into n_claims    from agent_commission_claims;
  select count(*) into n_momo      from agent_mobile_payments;
  select count(*) into n_catalogues from catalogues;
  select count(*) into n_inquiries from catalogue_inquiries;

  raise notice 'Before: agents=%, clients=%, agent_orders=%, solutions=%, clusters=%, goals=%, claims=%, momo=%, catalogues=%, inquiries=%',
    n_agents, n_clients, n_orders, n_solutions, n_clusters, n_goals, n_claims, n_momo, n_catalogues, n_inquiries;
end $$;

-- Detach shop-side paperwork that references an agent order, so the delete
-- below isn't blocked. These are the shop's own records (a purchase it
-- made, a payment it received) rather than agent data, so they survive
-- with the link cleared -- same treatment as 0029.
update purchase_invoices set quote_id = null
 where quote_id in (select id from saved_quotes where agent_id is not null);
update airtel_transactions set quote_id = null
 where quote_id in (select id from saved_quotes where agent_id is not null);

-- Agent orders before agents: saved_quotes_agent_fk is ON DELETE RESTRICT
-- (0027), which deliberately stops an agent being removed while their
-- orders remain.
delete from saved_quotes where agent_id is not null;

-- Deleting the agents cascades everything keyed to them: agent_clients,
-- agent_commission_claims, agent_mobile_payments, agent_goals, catalogues,
-- solution_templates. The explicit deletes that follow are belt-and-braces
-- for any row whose agent was already gone.
delete from agents;

delete from agent_clients;
delete from solution_templates;
delete from agent_clusters;
delete from agent_goals;
delete from agent_commission_claims;
delete from agent_mobile_payments;
delete from catalogue_inquiries;
delete from catalogues;

-- Admin-raised orders (agent_id is null) are deliberately kept, as are
-- products, prices, stock, suppliers, customers and the cash book.

do $$
declare n_left int;
begin
  select (select count(*) from agents)
       + (select count(*) from agent_clients)
       + (select count(*) from saved_quotes where agent_id is not null)
       + (select count(*) from solution_templates)
       + (select count(*) from agent_clusters)
       + (select count(*) from agent_goals)
       + (select count(*) from agent_commission_claims)
       + (select count(*) from agent_mobile_payments)
       + (select count(*) from catalogues)
       + (select count(*) from catalogue_inquiries)
    into n_left;
  raise notice 'After: % agent-related row(s) remain.', n_left;
end $$;
