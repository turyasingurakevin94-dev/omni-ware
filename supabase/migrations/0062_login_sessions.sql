-- Who is signed in to this shop, on what, and since when.
--
-- The shop is about to hold real money and its owner has already been
-- surprised once by data they did not expect. Three apps sign in against
-- one shop (admin, worker, agent) and until now nothing recorded that a
-- sign-in had happened at all: a phone left in a taxi, a password shared
-- between two workers, or somebody still signed in after they stopped
-- working here were all invisible.
--
-- One row per (person, device, app), updated in place. NOT a log of every
-- sign-in: a row per login would grow without limit and bury the question
-- actually being asked, which is "what is signed in RIGHT NOW".
create table login_sessions (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  -- Random, minted by the browser and kept in its own localStorage. Not a
  -- fingerprint: it identifies a browser profile, and clearing storage
  -- makes a new one, which the list shows as a new device rather than
  -- pretending to recognise it.
  device_id text not null,
  app text not null check (app in ('admin', 'worker', 'agent')),
  label text not null default '',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Set by an owner or admin to sign that device out. Never cleared: a
  -- revoked row stays revoked, and coming back means a new sign-in.
  revoked_at timestamptz,
  unique (shop_id, user_id, device_id, app)
);
create index login_sessions_shop_seen_idx on login_sessions(shop_id, last_seen_at desc);

alter table login_sessions enable row level security;

-- A device reads its own row (that is how it learns it has been revoked);
-- an owner or admin reads the whole shop's, which is the monitor.
create policy "own session or admin sees all" on login_sessions
  for select to authenticated
  using (user_id = auth.uid() or is_shop_admin(shop_id));

-- Only ever your own row, and only in a shop you belong to.
create policy "a device registers itself" on login_sessions
  for insert to authenticated
  with check (user_id = auth.uid() and is_shop_member(shop_id));

-- Your own heartbeat, or an admin revoking. The trigger below is what
-- keeps those two apart -- RLS can gate the row, not the column.
create policy "own heartbeat or admin revokes" on login_sessions
  for update to authenticated
  using (user_id = auth.uid() or is_shop_admin(shop_id))
  with check (user_id = auth.uid() or is_shop_admin(shop_id));

create policy "admins clear old sessions" on login_sessions
  for delete to authenticated
  using (is_shop_admin(shop_id));

/* Without this, a revoked device could simply clear its own revoked_at on
   its next heartbeat -- it owns the row, and the update policy above lets
   it write. Revocation has to be a thing only an admin can do, and the
   identity of a row has to be fixed once written, or a device could
   re-point somebody else's session at itself. */
create or replace function login_sessions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_shop_admin(new.shop_id) then
    if new.revoked_at is distinct from old.revoked_at then
      raise exception 'only an owner or admin can revoke a session';
    end if;
    if new.user_id <> old.user_id or new.shop_id <> old.shop_id
       or new.device_id <> old.device_id or new.app <> old.app
       or new.started_at <> old.started_at then
      raise exception 'a session cannot be re-pointed at another device or person';
    end if;
  end if;
  return new;
end;
$$;

create trigger login_sessions_guard_trg
  before update on login_sessions
  for each row execute function login_sessions_guard();
