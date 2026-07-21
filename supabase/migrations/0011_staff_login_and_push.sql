-- Lets a staff row be linked to a real login (auth.users, via shop_members)
-- so a worker can be recognized as themselves in the app, and adds storage
-- for their Web Push subscription(s) so assignments can notify their device.
-- user_id is only ever written by the service-role invite-worker Edge
-- Function -- staff keeps its existing "shop members full access" policy
-- unchanged, so no client-writable path to claim/hijack another row exists.

alter table staff
  add column user_id uuid references auth.users on delete set null;

create unique index staff_shop_user_unique on staff(shop_id, user_id) where user_id is not null;

create table push_subscriptions (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  staff_id text not null,
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now(),
  foreign key (shop_id, staff_id) references staff(shop_id, id) on delete cascade
);
create index push_subscriptions_shop_staff_idx on push_subscriptions(shop_id, staff_id);

alter table push_subscriptions enable row level security;

-- A device only ever manages its own subscription row. The notify-worker
-- Edge Function reads this table with the service-role key, bypassing RLS,
-- so this policy only constrains normal client access.
create policy "own subscriptions" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
