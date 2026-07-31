-- Self-set income targets, shown as the progress ring on the agent app's
-- Home tab (This month vs. monthly_target) once that lands. Unlike
-- agent_commission_claims, nothing here is money-authoritative -- a goal
-- is just a number the agent sets for their own motivation, so (unlike
-- the claims table) the agent gets full read/write on their own row
-- rather than a service-role Edge Function computing it for them.
--
-- One row per agent, not a history log -- an agent has exactly one
-- current daily target and one current monthly target at a time; past
-- targets aren't meaningful to keep once replaced.
create table agent_goals (
  shop_id uuid not null references shops(id) on delete cascade,
  agent_id text not null,
  daily_target numeric,
  monthly_target numeric,
  updated_at timestamptz not null default now(),
  primary key (shop_id, agent_id),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);

alter table agent_goals enable row level security;

create policy "agent manages own goals" on agent_goals
  for all using (agent_id = current_agent_id(shop_id)) with check (agent_id = current_agent_id(shop_id));
