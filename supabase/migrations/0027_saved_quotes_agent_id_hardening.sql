-- Hardens how an agent's ownership of an order is expressed, following an
-- audit of the saved_quotes RLS policy added in 0012_sales_agents.sql.
--
-- Until now that ownership lived only in payload->>'originAgentId': a
-- JSONB key with no foreign key, no NOT NULL, no check constraint and no
-- index. Every writer happens to set it correctly today
-- (agent-submit-order writes it; the admin app deliberately preserves it
-- on re-save), but nothing at the database level enforced that -- a
-- single careless write would have made an order permanently invisible
-- to the agent who raised it, silently, with no error anywhere. It was
-- also a growing cost on every read: listing one agent's orders meant a
-- JSONB extraction across the whole shop's orders instead of an index
-- lookup.
--
-- This is the EXPAND half of an expand-and-contract change. The new
-- agent_id column is populated and read, but payload->>'originAgentId'
-- is still written by the app, still authoritative, and still read as a
-- fallback -- so this can be rolled back without stranding any row. The
-- CONTRACT half (dropping the payload fallback from the policies below)
-- is deliberately left to a later migration, once this one has been
-- verified against real data.

alter table saved_quotes add column agent_id text;

-- Backfill from the existing source of truth.
update saved_quotes
   set agent_id = payload->>'originAgentId'
 where payload->>'originAgentId' is not null;

-- Keeps the column in lockstep with the payload key WITHOUT requiring a
-- single application change: agent-submit-order, and the admin app's own
-- re-save path, keep writing payload exactly as they always have and the
-- column is derived from it here. Deriving it unconditionally -- rather
-- than letting a caller set agent_id directly -- is what makes it
-- impossible for the two to quietly diverge while both are still live.
-- The contract migration reverses this: the column becomes authoritative
-- and this trigger goes away.
create or replace function sync_saved_quote_agent_id() returns trigger
language plpgsql set search_path = public
as $$
begin
  new.agent_id := new.payload->>'originAgentId';
  return new;
end;
$$;

drop trigger if exists saved_quotes_sync_agent_id on saved_quotes;
create trigger saved_quotes_sync_agent_id
before insert or update on saved_quotes
for each row
execute function sync_saved_quote_agent_id();

-- Partial: a NULL agent_id (every admin-raised order) can never satisfy
-- `agent_id = current_agent_id(...)`, so those rows are dead weight in
-- this index.
create index saved_quotes_agent_idx
  on saved_quotes(shop_id, agent_id)
  where agent_id is not null;

-- NOT VALID on purpose: an order whose agent has since been removed from
-- the roster would otherwise make this migration fail outright against
-- real data. New and updated rows are checked from here on. Once any
-- historical dangling references have been cleaned up, run:
--   alter table saved_quotes validate constraint saved_quotes_agent_fk;
--
-- restrict, never cascade: these are financial records. Removing an
-- agent must not take their orders with it -- it should fail loudly and
-- force an explicit decision about what happens to the history.
alter table saved_quotes
  add constraint saved_quotes_agent_fk
  foreign key (shop_id, agent_id) references agents(shop_id, id)
  on delete restrict
  not valid;

-- ---------------------------------------------------------------------
-- Replaces the 0012 policy. Three changes:
--
--   * Keyed off the column, in the same shape as every other agent-scoped
--     policy in this schema (agent_clients, solution_templates). That
--     shape is also what makes it index-usable: current_agent_id() is
--     stable, so the planner collapses this to `agent_id = <constant>`
--     against the index above.
--   * Keeps a fallback to the payload key for any row the backfill
--     somehow missed. Guarded on `agent_id is null`, so it costs nothing
--     on the normal path and can't mask a genuine mismatch.
--   * SELECT only. The old policy was `for all`, which also let an agent
--     UPDATE or DELETE their own orders straight from the client. Nothing
--     needs that: agent.html only ever selects from this table, and every
--     agent-side write path (agent-submit-order, agent-claim-commission,
--     agent-initiate-momo-payment) runs service-role and bypasses RLS
--     entirely.
--
-- Note this does NOT change the behaviour that prompted the audit: when
-- auth.uid() is NULL (expired or mid-refresh token) current_agent_id()
-- returns NULL, every comparison below is NULL, and the read comes back
-- empty with no error. That is inherent to RLS -- Postgres cannot signal
-- "policy excluded everything" differently from "no rows" -- and is
-- handled on the client instead, in loadAgentHomeData()/saveOfflineCache().
drop policy "agents manage their own orders" on saved_quotes;

create policy "agents read their own orders" on saved_quotes
  for select
  using (
    agent_id = current_agent_id(shop_id)
    or (agent_id is null and payload->>'originAgentId' = current_agent_id(shop_id))
  );

-- Same treatment for the staff-name lookup from 0016, so it reads through
-- the indexed column too rather than extracting JSONB per row. Behaviour
-- is unchanged: is_order_agent(shop, X) and X = current_agent_id(shop)
-- both resolve to "this row belongs to the agent behind auth.uid()".
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
        and (
          q.agent_id = current_agent_id(p_shop_id)
          or (q.agent_id is null and q.payload->>'originAgentId' = current_agent_id(p_shop_id))
        )
        and (q.payload->>'assignedWorkerId' = s.id or q.payload->>'assignedDeliveryId' = s.id)
    );
$$;

-- ---------------------------------------------------------------------
-- Finding 3 from the same audit. agents.user_id was `on delete set null`,
-- so deleting an auth user silently blanked the link and instantly hid
-- every order and client belonging to that agent -- the data fully
-- intact, simply unreachable, with no error raised and no way for the
-- agent to recover it themselves. Deleting a still-linked auth user now
-- fails loudly instead; unlink the agent first if that's genuinely what
-- was meant.
--
-- The constraint is looked up rather than named literally: it was created
-- inline in 0012 and carries whatever name Postgres assigned it.
do $$
declare fk_name text;
begin
  select conname into fk_name
    from pg_constraint
   where conrelid = 'agents'::regclass
     and contype = 'f'
     and confrelid = 'auth.users'::regclass;
  if fk_name is not null then
    execute format('alter table agents drop constraint %I', fk_name);
  end if;
end $$;

alter table agents
  add constraint agents_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;
