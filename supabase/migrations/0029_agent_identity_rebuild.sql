-- Rebuilds agent identity so an agent can never be detached from their own
-- order history, and clears out the test data that exposed the problem.
--
-- Every agent bug found so far traced to one decision: an order's owner was
-- a human-typed string. Deleting an agent freed their id for the next
-- person (who silently inherited their orders); re-creating an agent under
-- a different id stranded the old ones; the same login appearing in two
-- shops made the app unable to tell which was meant. None of those were
-- separate bugs -- they were the same missing constraint seen from four
-- angles.
--
-- Four properties together close it, and all four are needed:
--   1. ids are issued by the database, so nobody can type or re-type one
--   2. ids are immutable, so one can't be edited onto a different person
--   3. agents are retired, never deleted (0028), so an id is never freed
--   4. a login maps to exactly one agent row, so a person can't exist twice
--
-- The id stays a text column keyed (shop_id, id), so every foreign key and
-- edge function that already references it keeps working unchanged. The
-- fix is in who assigns the value, not what shape it is.

-- ---------------------------------------------------------------------
-- 1. Clear the test data.
--
-- purchase_invoices and airtel_transactions both reference saved_quotes
-- with no ON DELETE action, so they block the delete below. They're shop
-- records rather than agent records -- a purchase the shop made, a payment
-- it received -- so they're detached rather than destroyed: the paperwork
-- survives, it just no longer points at a quote that's been removed.
-- (agent_mobile_money is already ON DELETE SET NULL, and goes with the
-- agent anyway.)
update purchase_invoices set quote_id = null
 where quote_id in (select id from saved_quotes where agent_id is not null);
update airtel_transactions set quote_id = null
 where quote_id in (select id from saved_quotes where agent_id is not null);

-- Agent-submitted orders go first: 0027's saved_quotes_agent_fk is ON
-- DELETE RESTRICT, so agents cannot be removed while their orders remain
-- (which is the point of that constraint -- financial records shouldn't
-- vanish with the person who raised them).
delete from saved_quotes where agent_id is not null;

-- Cascades to everything an agent owns: agent_clients (0012),
-- agent_commission_claims (0014), agent_mobile_money (0022), agent_goals
-- (0024), catalogues (0025), solution_templates (0026).
delete from agents;

-- Admin-raised orders (agent_id is null) are deliberately kept.

-- The second shop held no agents and a single orphaned draft, left behind
-- when its only agent was deleted. Removing it takes the orphan with it
-- and leaves one clean shop -- which also unblocks
--   alter table saved_quotes validate constraint saved_quotes_agent_fk;
delete from shops where id = '2118f90b-ef63-4219-823c-88934a7b3246';

-- ---------------------------------------------------------------------
-- 2. Ids are issued here, not typed.
create sequence agents_code_seq;

-- Reads as AG0001, AG0002... -- short enough to say out loud in a support
-- call, which is all this value is for now that ownership is enforced by
-- the key rather than by whoever filled in the form. A single global
-- sequence rather than per-shop numbering: gapless per-shop counters need
-- either a lock or a retry loop to stay correct under concurrent invites,
-- and the number carries no meaning worth that.
alter table agents
  alter column id set default 'AG' || lpad(nextval('agents_code_seq')::text, 4, '0');

-- ---------------------------------------------------------------------
-- 3. Ids (and the shop behind them) are immutable.
--
-- saved_quotes.agent_id points at this value, so editing it would silently
-- hand one agent's orders to another -- exactly the failure being designed
-- out. Moving an agent between shops would strand their history the same
-- way, since ownership is the (shop_id, id) pair.
create or replace function agents_identity_is_immutable() returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'An agent id cannot be changed (% -> %): their orders reference it. Retire this agent and invite a replacement instead.', old.id, new.id;
  end if;
  if new.shop_id is distinct from old.shop_id then
    raise exception 'An agent cannot be moved between shops: their orders belong to the shop they were raised in.';
  end if;
  return new;
end;
$$;

drop trigger if exists agents_identity_immutable on agents;
create trigger agents_identity_immutable
before update on agents
for each row
execute function agents_identity_is_immutable();

-- ---------------------------------------------------------------------
-- 4. One login, one agent row.
--
-- Was unique per (shop_id, user_id), which still allowed the same person
-- to hold rows in two shops. ensureAgentAuth() looks an agent up by
-- user_id alone, so that case had no correct answer available to it -- it
-- either picked a shop arbitrarily (scoping the whole app to the wrong
-- data) or refused to start. Making it impossible is better than making
-- it a well-handled error.
drop index if exists agents_shop_user_unique;
create unique index agents_user_unique on agents(user_id) where user_id is not null;
