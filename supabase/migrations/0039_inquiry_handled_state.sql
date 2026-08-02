-- Lets an agent clear a catalogue request once they've dealt with it.
--
-- Deliberately "handled", not "read". A read flag set by looking at the
-- screen would clear itself the moment the agent opened Customers for any
-- other reason, so a request they glanced at on the bus and a request they
-- actually called back would look identical -- which is exactly the
-- distinction worth keeping. Marking it takes a tap, and until it does the
-- request stays on the list as outstanding work.
--
-- Nullable rather than a boolean: WHEN it was handled is worth having, and
-- "never" is the natural absence rather than a false that has to be
-- defaulted in.
alter table catalogue_inquiries
  add column handled_at timestamptz;

-- Update only, narrower than the precedent next door. agent_clients gives
-- the agent `for all` over their own rows, but a catalogue request is a
-- record of something a customer did, not the agent's own note: inserts
-- belong to catalogue-public (service role, from a form with no session)
-- and there is no reason for an agent to delete one. Marking it handled,
-- and unmarking it, is the whole of what they need.
create policy "agent handles own inquiries" on catalogue_inquiries
  for update
  using (agent_id = current_agent_id(shop_id))
  with check (agent_id = current_agent_id(shop_id));

-- The list is read newest-first and split on this, so it is worth indexing
-- the outstanding ones. Partial: handled rows are the ones that accumulate,
-- and none of them are ever the thing being looked for.
create index catalogue_inquiries_outstanding_idx
  on catalogue_inquiries(shop_id, agent_id, created_at desc)
  where handled_at is null;
