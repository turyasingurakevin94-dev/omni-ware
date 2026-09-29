-- Browser push for the agent app.
--
-- Workers get native Android push (0011, 0014/0015) because every worker
-- install is the APK. Agents use agent.html in a phone browser, installed
-- or not, so theirs is standard Web Push: the phone gives the app an
-- endpoint and two keys, the app stores them here, and the agent-nudge
-- Edge Function sends to them with the shop's VAPID key.
--
-- agent_push_subscriptions: one row per phone that said yes. The agent's
-- own rows only -- the endpoint is theirs, not the shop's. Admins may
-- READ them, which is how the Sales agents screen can say how many agents
-- have notifications on; nothing in the owner app writes one.
--
-- agent_push_log: every nudge sent, so the same moment is never sent
-- twice and a day's nudges can be capped. Written only by agent-nudge
-- (service role, which bypasses RLS); the agent reads their own, the
-- shop reads all.
--
-- SAFE TO RUN TWICE.

create table if not exists agent_push_subscriptions (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  agent_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);

create index if not exists agent_push_subscriptions_agent_idx
  on agent_push_subscriptions (shop_id, agent_id);

alter table agent_push_subscriptions enable row level security;

drop policy if exists "agent manages own push subscriptions" on agent_push_subscriptions;
create policy "agent manages own push subscriptions" on agent_push_subscriptions
  for all using (user_id = auth.uid() and agent_id = current_agent_id(shop_id))
  with check (user_id = auth.uid() and agent_id = current_agent_id(shop_id));
drop policy if exists "admins read push subscriptions" on agent_push_subscriptions;
create policy "admins read push subscriptions" on agent_push_subscriptions
  for select using (is_shop_admin(shop_id));


create table if not exists agent_push_log (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  agent_id text not null,
  kind text not null,
  ref text not null,
  title text,
  body text,
  sent_at timestamptz not null default now(),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);

create index if not exists agent_push_log_agent_idx
  on agent_push_log (shop_id, agent_id, sent_at desc);
create unique index if not exists agent_push_log_once
  on agent_push_log (shop_id, agent_id, kind, ref);

alter table agent_push_log enable row level security;

drop policy if exists "agent reads own push log" on agent_push_log;
create policy "agent reads own push log" on agent_push_log
  for select using (agent_id = current_agent_id(shop_id));
drop policy if exists "admins read push log" on agent_push_log;
create policy "admins read push log" on agent_push_log
  for select using (is_shop_admin(shop_id));

-- select kind, count(*) from agent_push_log
--   where sent_at > now() - interval '7 days' group by 1 order by 2 desc;
