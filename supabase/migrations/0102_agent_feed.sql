-- The agent Feed, on the server.
--
-- Until now the Feed kept what an agent did with it -- "Not for me", the
-- aisles they act on, the lessons they have finished -- on the phone, so a
-- new phone started from nothing and the shop could never see what worked.
-- Three small tables fix both.
--
-- agent_feed_prefs: one row per agent, the same shape the app already
-- keeps locally (notMe / acted / lessons / about). The agent's own and
-- nobody else's, like agent_goals: it is how THEY like their feed, not a
-- record the shop acts on.
--
-- agent_feed_events: what an agent did with a card -- shown, acted,
-- shared, quoted, starred into the cluster, "not for me". The agent writes
-- their own; the shop's admins read all of them, because "which cards led
-- to sales" is the owner's question. Nothing here is money: a sale is
-- still only a sale when it is an order.
--
-- agent_feed_pins: an item the owner puts in front of their agents, with
-- a line of their own and an end date. Admins manage them; any agent of
-- the shop reads them.
--
-- SAFE TO RUN TWICE.

create table if not exists agent_feed_prefs (
  shop_id uuid not null references shops(id) on delete cascade,
  agent_id text not null,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (shop_id, agent_id),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);

alter table agent_feed_prefs enable row level security;

drop policy if exists "agent manages own feed prefs" on agent_feed_prefs;
create policy "agent manages own feed prefs" on agent_feed_prefs
  for all using (agent_id = current_agent_id(shop_id)) with check (agent_id = current_agent_id(shop_id));


create table if not exists agent_feed_events (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  agent_id text not null,
  card_kind text not null,
  item_key text not null default '',
  client_id text,
  action text not null check (action in ('shown', 'acted', 'shared', 'quoted', 'cluster', 'notme')),
  created_at timestamptz not null default now(),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);

create index if not exists agent_feed_events_shop_idx
  on agent_feed_events (shop_id, created_at desc);

alter table agent_feed_events enable row level security;

drop policy if exists "agent writes own feed events" on agent_feed_events;
create policy "agent writes own feed events" on agent_feed_events
  for insert with check (agent_id = current_agent_id(shop_id));
drop policy if exists "agent reads own feed events" on agent_feed_events;
create policy "agent reads own feed events" on agent_feed_events
  for select using (agent_id = current_agent_id(shop_id));
drop policy if exists "admins read feed events" on agent_feed_events;
create policy "admins read feed events" on agent_feed_events
  for select using (is_shop_admin(shop_id));


create table if not exists agent_feed_pins (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  product_id text not null,
  variant_idx text not null default '',
  note text,
  ends_on date,
  created_at timestamptz not null default now(),
  foreign key (shop_id, product_id) references products(shop_id, id) on delete cascade
);

create index if not exists agent_feed_pins_shop_idx on agent_feed_pins (shop_id);

alter table agent_feed_pins enable row level security;

drop policy if exists "admins manage feed pins" on agent_feed_pins;
create policy "admins manage feed pins" on agent_feed_pins
  for all using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));
drop policy if exists "agents read feed pins" on agent_feed_pins;
create policy "agents read feed pins" on agent_feed_pins
  for select using (is_shop_agent(shop_id));

-- select action, count(*) from agent_feed_events
--   where created_at > now() - interval '7 days' group by 1 order by 2 desc;
