-- Delivering to an agent's client, and the shop cheering an agent on.
--
-- 1. delivery-photos: a picture of the goods at the client's door (or the
--    signed delivery note), added by the shop when it marks a delivery
--    done. PRIVATE, like bill-photos (0100): it shows a client's premises.
--    Stored as `{shop_id}/{agent_id}/{order_id}-{uuid}.jpg` for an agent's
--    order and `{shop_id}/shop/...` otherwise. Shop members read and write
--    their shop's folder; an agent reads only their own sub-folder, through
--    a short-lived signed URL, never a public one.
--
-- 2. agent_delivery_driver(): the driver's name and phone for ONE order,
--    only while that order is the calling agent's and out for delivery
--    with that driver. agent_staff_names (0016) gives names only, on
--    purpose; a phone number is handed out only for the delivery it is for.
--
-- 3. agent_shoutouts: a note of praise from the shop to an agent ("Goal
--    hit 13 days early -- proud of you"), shown on the agent's Today and
--    sent to their phone. Admins write them; the agent reads their own and
--    answers through agent_shoutout_react() (thanks / put away), which is
--    the only thing they may change.
--
-- SAFE TO RUN TWICE.

-- 1 -------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('delivery-photos', 'delivery-photos', false)
on conflict (id) do nothing;

drop policy if exists "shop members can view delivery photos" on storage.objects;
create policy "shop members can view delivery photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'delivery-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "agents can view their delivery photos" on storage.objects;
create policy "agents can view their delivery photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'delivery-photos'
  and (storage.foldername(name))[2] = public.current_agent_id((storage.foldername(name))[1]::uuid)
);

drop policy if exists "shop members can upload delivery photos" on storage.objects;
create policy "shop members can upload delivery photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'delivery-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "shop members can replace delivery photos" on storage.objects;
create policy "shop members can replace delivery photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'delivery-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'delivery-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

drop policy if exists "shop members can delete delivery photos" on storage.objects;
create policy "shop members can delete delivery photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'delivery-photos'
  and public.is_shop_member((storage.foldername(name))[1]::uuid)
);

-- 2 -------------------------------------------------------------------
create or replace function agent_delivery_driver(p_shop_id uuid, p_order_id bigint)
returns table(name text, phone text)
language sql security definer stable set search_path = public
as $$
  select s.name, s.phone
  from saved_quotes q
  join staff s on s.shop_id = q.shop_id and s.id = q.payload->>'assignedDeliveryId'
  where q.shop_id = p_shop_id
    and q.id = p_order_id
    and q.agent_id = current_agent_id(p_shop_id)
    and q.status = 'pending_delivery'
    and coalesce(q.voided, false) = false;
$$;
revoke all on function agent_delivery_driver(uuid, bigint) from public;
grant execute on function agent_delivery_driver(uuid, bigint) to authenticated;

-- 3 -------------------------------------------------------------------
create table if not exists agent_shoutouts (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  agent_id text not null,
  -- What it was for, as the shop picked it ("Goal · 13 days early").
  reason text,
  message text not null check (length(message) between 1 and 500),
  sent_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- Set by agent-nudge once the agent's phones were sent it.
  notified_at timestamptz,
  thanked_at timestamptz,
  put_away_at timestamptz,
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);
create index if not exists agent_shoutouts_agent_idx on agent_shoutouts (shop_id, agent_id, created_at desc);

alter table agent_shoutouts enable row level security;

drop policy if exists "admins manage shoutouts" on agent_shoutouts;
create policy "admins manage shoutouts" on agent_shoutouts
  for all using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));
drop policy if exists "agent reads own shoutouts" on agent_shoutouts;
create policy "agent reads own shoutouts" on agent_shoutouts
  for select using (agent_id = current_agent_id(shop_id));

create or replace function agent_shoutout_react(p_shop_id uuid, p_id bigint, p_action text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_action not in ('thanks', 'away') then
    raise exception 'action must be thanks or away';
  end if;
  update agent_shoutouts
     set thanked_at = case when p_action = 'thanks' then coalesce(thanked_at, now()) else thanked_at end,
         put_away_at = case when p_action = 'away' then coalesce(put_away_at, now()) else put_away_at end
   where shop_id = p_shop_id and id = p_id and agent_id = current_agent_id(p_shop_id);
end;
$$;
revoke all on function agent_shoutout_react(uuid, bigint, text) from public;
grant execute on function agent_shoutout_react(uuid, bigint, text) to authenticated;
