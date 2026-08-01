-- Moves id allocation for products, suppliers, customers and staff off the
-- client and into the database.
--
-- 59b8ef4 made these ids auto-generated and non-editable, which removed the
-- failure that mattered: a human re-entering an id that a deleted record
-- once held, silently inheriting its prices, stock, order lines or debt
-- history. What it could not remove is the race -- the counter lived in the
-- client's own copy of app_settings, so two admins adding a product at the
-- same moment both read the same number and both wrote it. The rows sync by
-- upsert, so the second silently overwrites the first rather than erroring.
--
-- Allocating here makes that impossible: the counter row is locked for the
-- duration of the update, so concurrent callers queue and each gets a
-- distinct value.
--
-- Deliberately an allocation RPC rather than a column DEFAULT. The admin app
-- is built around optimistic local arrays diffed against lastSynced, and the
-- id IS the diff key -- a row can't be inserted and have its id discovered
-- afterwards without unpicking that whole design. Asking for the next id and
-- carrying on unchanged gets the atomicity without the rewrite.
create table entity_id_counters (
  shop_id uuid not null references shops(id) on delete cascade,
  kind text not null,
  last_issued bigint not null default 0,
  primary key (shop_id, kind)
);

-- RLS on with no policies at all: nothing may read or write these rows
-- directly. The allocator below is SECURITY DEFINER and checks membership
-- itself, so that is the only way in -- a counter that could be edited from
-- a client would be no safer than the one this replaces.
alter table entity_id_counters enable row level security;

-- Seed from what already exists, so the first allocation lands above every
-- current record rather than colliding with it. Ids that don't match the
-- expected shape (legacy or hand-written) are ignored here, but they're
-- still covered: the client passes its own highest as a floor (see
-- issueEntityId in index.html) and the allocator takes whichever is larger.
insert into entity_id_counters (shop_id, kind, last_issued)
select shop_id, 'product', max((substring(id from '^P(\d+)$'))::bigint)
  from products where id ~ '^P\d+$' group by shop_id
on conflict (shop_id, kind) do nothing;

insert into entity_id_counters (shop_id, kind, last_issued)
select shop_id, 'supplier', max((substring(id from '^S(\d+)$'))::bigint)
  from suppliers where id ~ '^S\d+$' group by shop_id
on conflict (shop_id, kind) do nothing;

insert into entity_id_counters (shop_id, kind, last_issued)
select shop_id, 'customer', max((substring(id from '^C(\d+)$'))::bigint)
  from customers where id ~ '^C\d+$' group by shop_id
on conflict (shop_id, kind) do nothing;

insert into entity_id_counters (shop_id, kind, last_issued)
select shop_id, 'staff', max((substring(id from '^ST(\d+)$'))::bigint)
  from staff where id ~ '^ST\d+$' group by shop_id
on conflict (shop_id, kind) do nothing;

-- p_floor lets the caller say "whatever you do, don't go at or below this".
-- It covers ids the seed above couldn't parse, and any record created by a
-- client that fell back to local allocation while offline.
create or replace function next_entity_id(
  p_shop_id uuid,
  p_kind text,
  p_prefix text,
  p_pad int default 3,
  p_floor bigint default 0
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  if not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop';
  end if;
  if p_kind is null or p_prefix is null then
    raise exception 'kind and prefix are required';
  end if;

  -- The ON CONFLICT branch takes a row lock, so concurrent callers serialise
  -- here and cannot come away with the same number.
  insert into entity_id_counters (shop_id, kind, last_issued)
       values (p_shop_id, p_kind, greatest(1, coalesce(p_floor, 0) + 1))
  on conflict (shop_id, kind) do update
          set last_issued = greatest(entity_id_counters.last_issued, coalesce(p_floor, 0)) + 1
    returning last_issued into v;

  return p_prefix || lpad(v::text, greatest(coalesce(p_pad, 3), 1), '0');
end;
$$;

revoke all on function next_entity_id(uuid, text, text, int, bigint) from public;
grant execute on function next_entity_id(uuid, text, text, int, bigint) to authenticated;
