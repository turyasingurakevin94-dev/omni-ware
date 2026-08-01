-- Retire agents instead of deleting them.
--
-- The admin app's "Remove agent" removed the row outright, and the invite
-- form's uniqueness check only ever looked at agents that still existed --
-- so a removed agent's id became typeable again. Orders deliberately
-- outlive their agent (the removal dialog says as much: "Orders they
-- already submitted will keep showing their name"), and ownership is
-- nothing more than (shop_id, agent_id), so reissuing a freed id handed
-- the departed agent's entire order history -- values, client details,
-- everything -- to whoever was given that id next. Silently, with no
-- error and nothing on either side to notice it.
--
-- Keeping the row and marking it retired fixes that at the root: the id
-- stays permanently taken, attribution survives, and the foreign key
-- added in 0027 never has to block a legitimate removal.

alter table agents add column retired_at timestamptz;

-- Retirement revokes access everywhere from one place. current_agent_id()
-- is what every agent-scoped policy in this schema resolves through --
-- agent_clients (0012), commission claims (0014), mobile money (0022),
-- goals (0024), catalogues (0025), solution_templates (0026) and
-- saved_quotes (0027) -- so a retired agent stops resolving to an id and
-- all of them close at once, rather than each needing its own check.
create or replace function current_agent_id(p_shop_id uuid)
returns text
language sql security definer stable set search_path = public
as $$
  select id from agents
   where shop_id = p_shop_id
     and user_id = auth.uid()
     and retired_at is null;
$$;

-- Same for the order-ownership helper (still used by agent_staff_names,
-- and by the saved_quotes policy on any database not yet carrying 0027).
create or replace function is_order_agent(p_shop_id uuid, p_agent_id text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select p_agent_id is not null and exists (
    select 1 from agents
     where shop_id = p_shop_id
       and id = p_agent_id
       and user_id = auth.uid()
       and retired_at is null
  );
$$;

create or replace function is_shop_agent(p_shop_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from agents
     where shop_id = p_shop_id
       and user_id = auth.uid()
       and retired_at is null
  );
$$;

-- Note on re-hiring: agents_shop_user_unique (0012) already stops one
-- login holding two agent rows in the same shop, and a retired row keeps
-- its user_id. So a returning agent is restored (clear retired_at) rather
-- than re-invited under a fresh id -- which is the intended workflow, and
-- keeps their order history attached to them instead of stranding it
-- under an id nobody owns any more.
