-- 0146: a search that finds nothing is a chance (Sourcing v2, round 5).
--
-- Sales already has "We don't sell it · ask Sourcing" on an empty search,
-- and agents "Ask the shop to stock it"; both make a request. What was
-- lost is the search nobody followed up: the salesperson moved on, the
-- agent's client changed their mind, a visitor left the website. Now:
--
--   search_misses      every search that finds nothing, written by itself
--                      (never a tap): the words, where (sales / agent / web
--                      / console), who, and the order being written. Never a
--                      client's phone. The same person and words within 10
--                      minutes count once; the website at most 300 a day.
--                      Read by Sourcing (sourcing.lead), written only
--                      through the functions below.
--   log_search_miss    for a signed-in member (Sales, the console) or agent.
--   ow_record_search_miss  the one writer; the website's catalogue-public
--                      function calls it with the service key.
--   search_mutes       words Sourcing set aside ("not something we stock").
--                      They come back by themselves after 10 more searches
--                      in a month (the app counts that).
--   item_names         Sourcing may now teach a name ("rawl plug 6" is our
--                      Wall plug 6mm), as product.edit: a product detail,
--                      never its markup. Admins still manage them all.
--   agent_requests     an agent's "ask the shop to stock it" now pushes
--                      Sourcing (sourcing.request), as Sales' asks do.
--
-- Safe to re-run.
--
-- Rollback:
--   drop trigger if exists agent_requests_ow_push on agent_requests;
--   drop function if exists agent_requests_ow_push();
--   drop policy if exists "sourcing teaches item names" on item_names;
--   drop function if exists log_search_miss(uuid, text, text, bigint, text);
--   drop function if exists ow_record_search_miss(uuid, text, text, uuid, text, bigint, text);
--   drop table if exists search_mutes; drop table if exists search_misses;

create table if not exists search_misses (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  words text not null check (length(words) between 2 and 120),
  norm text not null,
  source text not null check (source in ('sales', 'agent', 'web', 'console')),
  by_user uuid,
  agent_id text,
  order_id bigint,
  client_name text check (client_name is null or length(client_name) <= 120),
  at timestamptz not null default now()
);
create index if not exists search_misses_shop_at_idx on search_misses (shop_id, at desc);
create index if not exists search_misses_norm_idx on search_misses (shop_id, norm, at desc);
alter table search_misses enable row level security;
drop policy if exists "sourcing reads search misses" on search_misses;
create policy "sourcing reads search misses" on search_misses
  for select using (has_task(shop_id, 'sourcing.lead'));

create table if not exists search_mutes (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  words text[] not null,
  reason text not null default 'not stocked' check (reason in ('not stocked')),
  by_user uuid default auth.uid(),
  at timestamptz not null default now()
);
create index if not exists search_mutes_shop_idx on search_mutes (shop_id, at desc);
alter table search_mutes enable row level security;
drop policy if exists "sourcing reads search mutes" on search_mutes;
create policy "sourcing reads search mutes" on search_mutes
  for select using (has_task(shop_id, 'sourcing.lead'));
drop policy if exists "sourcing sets words aside" on search_mutes;
create policy "sourcing sets words aside" on search_mutes
  for insert with check (has_task(shop_id, 'sourcing.lead') and by_user = auth.uid());

-- The one writer. Words are kept as typed (trimmed, 120 at most) and
-- normalised for grouping: lower case, one space between words.
create or replace function ow_record_search_miss(p_shop_id uuid, p_words text, p_source text, p_user uuid, p_agent text, p_order_id bigint, p_client text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  w text := left(regexp_replace(btrim(coalesce(p_words, '')), '\s+', ' ', 'g'), 120);
  n text := lower(w);
begin
  if length(w) < 2 or n ~ '^[0-9 .,]+$' then return; end if;
  if p_source not in ('sales', 'agent', 'web', 'console') then return; end if;
  if exists (select 1 from search_misses m
              where m.shop_id = p_shop_id and m.norm = n and m.source = p_source
                and m.by_user is not distinct from p_user and m.agent_id is not distinct from p_agent
                and m.at > now() - interval '10 minutes') then
    return;
  end if;
  if p_source = 'web' and (select count(*) from search_misses m where m.shop_id = p_shop_id and m.source = 'web' and m.at > now() - interval '1 day') >= 300 then
    return;
  end if;
  insert into search_misses (shop_id, words, norm, source, by_user, agent_id, order_id, client_name)
       values (p_shop_id, w, n, p_source, p_user, p_agent, p_order_id, nullif(left(btrim(coalesce(p_client, '')), 120), ''));
end $$;
revoke all on function ow_record_search_miss(uuid, text, text, uuid, text, bigint, text) from public, anon, authenticated;
grant execute on function ow_record_search_miss(uuid, text, text, uuid, text, bigint, text) to service_role;

-- A signed-in member (Sales, the console) or an agent. Who it is comes from
-- the login, never from what the app says.
create or replace function log_search_miss(p_shop_id uuid, p_words text, p_source text default 'sales', p_order_id bigint default null, p_client text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  ag text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if is_shop_member(p_shop_id) then
    perform ow_record_search_miss(p_shop_id, p_words, case when p_source = 'console' then 'console' else 'sales' end, auth.uid(), null, p_order_id, p_client);
    return;
  end if;
  ag := current_agent_id(p_shop_id);
  if ag is null then
    raise exception 'Not a member or agent of this shop.' using errcode = '42501';
  end if;
  perform ow_record_search_miss(p_shop_id, p_words, 'agent', auth.uid(), ag, null, p_client);
end $$;
revoke all on function log_search_miss(uuid, text, text, bigint, text) from public, anon;
grant execute on function log_search_miss(uuid, text, text, bigint, text) to authenticated;

-- Sourcing teaches a name to an item (product.edit: a product detail).
do $$
begin
  if to_regclass('public.item_names') is null then
    raise notice 'skipped "sourcing teaches item names": item_names is not on this database yet (0112).';
  else
    drop policy if exists "sourcing teaches item names" on item_names;
    create policy "sourcing teaches item names" on item_names
      for insert with check (has_task(shop_id, 'product.edit'));
  end if;
end $$;

-- An agent's "ask the shop to stock it" pushes Sourcing, as Sales' asks do.
create or replace function agent_requests_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text;
  qty text;
begin
  if new.kind is distinct from 'stock' then return null; end if;
  select nullif(split_part(btrim(coalesce(a.name, '')), ' ', 1), '') into who from agents a where a.shop_id = new.shop_id and a.id = new.agent_id;
  qty := case when ow_num(new.qty::text) > 0 then trim_scale(ow_num(new.qty::text))::text end;
  perform ow_push(new.shop_id, 'sourcing.request', 'A new request',
    coalesce(who, 'An agent') || ' (agent) asks for ' || left(new.words, 80) || coalesce(' · ' || qty, '')
      || coalesce(' for ' || nullif(btrim(coalesce(new.client_name, '')), ''), ''),
    null, 'sourcing.lead', null, jsonb_build_object('table', 'agent_requests', 'id', new.id), 'areq:' || new.id);
  return null;
exception when others then
  raise notice 'push (agent request): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
do $$
begin
  if to_regclass('public.agent_requests') is null then
    raise notice 'skipped agent_requests_ow_push: agent_requests is not on this database yet (0112).';
  else
    drop trigger if exists agent_requests_ow_push on agent_requests;
    create trigger agent_requests_ow_push after insert on agent_requests
      for each row execute function agent_requests_ow_push();
  end if;
end $$;
