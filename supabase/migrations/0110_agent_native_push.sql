-- Phone-app notifications for agents.
--
-- 0103 gave agents browser push (Web Push: an endpoint and two keys per
-- phone). The agent app is now also an installed Android and iPhone app,
-- whose phones hand over a single push token instead -- an FCM token on
-- Android, an APNs device token on an iPhone. Both live in the same
-- agent_push_subscriptions table, one row per phone, so agent-nudge reads
-- one list and sends each row the way its platform needs.
--
-- agent_notify_prefs: what each agent wants to hear about, when their
-- morning plan arrives, and how the messages talk to them. A missing row
-- means the defaults: everything on except the evening wrap-up, 8 am,
-- playful.
--
-- agent_price_snapshots: the agent price of every item, once a day. There
-- is no price history anywhere else -- prices are rules on cost, worked out
-- when asked -- so a drop can only be noticed by keeping yesterday's
-- figure. Written by agent-catalog the first time it lists the catalogue
-- each day (service role); read by agent-nudge. Kept for two weeks.
--
-- SAFE TO RUN TWICE.

alter table agent_push_subscriptions add column if not exists platform text not null default 'web';
alter table agent_push_subscriptions add column if not exists push_token text;
alter table agent_push_subscriptions alter column endpoint drop not null;
alter table agent_push_subscriptions alter column p256dh drop not null;
alter table agent_push_subscriptions alter column auth_key drop not null;
-- Not a partial index: the app saves with ON CONFLICT (push_token), which
-- only a plain unique index can answer. Web rows leave it null, and nulls
-- never collide.
create unique index if not exists agent_push_subscriptions_token_key
  on agent_push_subscriptions (push_token);
do $$ begin
  alter table agent_push_subscriptions add constraint agent_push_subscriptions_one_way
    check ((platform = 'web' and endpoint is not null and p256dh is not null and auth_key is not null)
        or (platform in ('android', 'ios') and push_token is not null));
exception when duplicate_object then null; end $$;


create table if not exists agent_notify_prefs (
  shop_id uuid not null references shops(id) on delete cascade,
  agent_id text not null,
  -- { "morning": true, "win": true, "price": true, "bonus": true,
  --   "goal": true, "due": true, "wrap": false } -- a missing key is its default.
  kinds jsonb not null default '{}'::jsonb,
  morning_hour smallint not null default 8 check (morning_hour between 6 and 10),
  tone text not null default 'playful' check (tone in ('playful', 'straight')),
  updated_at timestamptz not null default now(),
  primary key (shop_id, agent_id),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);

alter table agent_notify_prefs enable row level security;

drop policy if exists "agent manages own notify prefs" on agent_notify_prefs;
create policy "agent manages own notify prefs" on agent_notify_prefs
  for all using (agent_id = current_agent_id(shop_id)) with check (agent_id = current_agent_id(shop_id));
drop policy if exists "admins read notify prefs" on agent_notify_prefs;
create policy "admins read notify prefs" on agent_notify_prefs
  for select using (is_shop_admin(shop_id));


create table if not exists agent_price_snapshots (
  shop_id uuid not null references shops(id) on delete cascade,
  product_id text not null,
  variant_key text not null default '',
  price numeric not null,
  unit text,
  taken_on date not null,
  primary key (shop_id, product_id, variant_key, taken_on)
);

create index if not exists agent_price_snapshots_day_idx
  on agent_price_snapshots (shop_id, taken_on desc);

-- Agents never read this directly: the prices they are allowed to see
-- reach them through agent-catalog, and the drops through agent-nudge.
alter table agent_price_snapshots enable row level security;

drop policy if exists "admins read price snapshots" on agent_price_snapshots;
create policy "admins read price snapshots" on agent_price_snapshots
  for select using (is_shop_admin(shop_id));
