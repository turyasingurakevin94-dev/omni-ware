-- Agent-saved reusable item bundles ("Solutions") -- e.g. an agent's own
-- usual "cabinet hardware set", saved once from a real quote and reused
-- from Sell without rebuilding it from scratch each time.
--
-- Deliberately NOT admin-curated generic "project" templates seeded with
-- product references: the live catalog this was built against has only
-- a handful of real products, and inventing plausible-looking bundles
-- against product ids that may not exist (or may not still exist by the
-- time this ships) would be fake content, not a real feature. This is
-- the mechanism; real content comes from agents actually using it.
--
-- line_items stores {productId, variantIdx, qty} only -- never a price.
-- Loading a solution back into a quote always re-resolves the current
-- price through agent-catalog, same as every other quantity/price flow
-- in this app; a stale stored price would be exactly the kind of number
-- this codebase goes out of its way never to trust.
create table solution_templates (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  agent_id text not null,
  name text not null,
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);
create index solution_templates_agent_idx on solution_templates(shop_id, agent_id);

alter table solution_templates enable row level security;
create policy "agent manages own solutions" on solution_templates
  for all using (agent_id = current_agent_id(shop_id)) with check (agent_id = current_agent_id(shop_id));
