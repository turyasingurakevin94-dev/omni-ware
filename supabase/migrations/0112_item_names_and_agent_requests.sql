-- Finding any item: the names clients use, and what agents ask the shop.
--
-- 1. item_names: a word clients say for an item ("mabaati" for iron
--    sheets, "sumunti" for cement), set once by the shop and found by
--    every agent's search. Its own table, not a column on products, so a
--    shop that has not run this file keeps syncing its products exactly
--    as before. product_id is the product; variant_idx narrows it to one
--    size when the word only means that one (null: every size).
--    Shop members read them; admins add and remove them. Agents never
--    read the table: agent-catalog hands each item its names.
--
-- 2. agent_requests: what an agent asks of the shop from the search box.
--    kind 'name'  -- "payipu means PVC pipe 4"": a word to add to
--                    item_names, which the shop agrees to or turns down.
--    kind 'stock' -- "tile adhesive, 10, this week, for Kato": an item the
--                    shop does not have yet.
--    Agents add their own and read their own; admins read and answer all.
--
-- SAFE TO RUN TWICE.

-- 1 -------------------------------------------------------------------
create table if not exists item_names (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  word text not null check (length(word) between 1 and 60),
  product_id text not null,
  variant_idx text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists item_names_word_idx
  on item_names (shop_id, lower(word), product_id, coalesce(variant_idx, ''));
create index if not exists item_names_product_idx on item_names (shop_id, product_id);

alter table item_names enable row level security;

drop policy if exists "shop members read item names" on item_names;
create policy "shop members read item names" on item_names
  for select using (is_shop_member(shop_id));
drop policy if exists "admins manage item names" on item_names;
create policy "admins manage item names" on item_names
  for all using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

-- 2 -------------------------------------------------------------------
create table if not exists agent_requests (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  agent_id text not null,
  kind text not null check (kind in ('name', 'stock')),
  -- What was typed: the word to learn, or the item asked for.
  words text not null check (length(words) between 1 and 200),
  -- kind 'name': the item the word means.
  product_id text,
  variant_idx text,
  -- kind 'stock': how many, how soon, and for which client.
  qty numeric check (qty is null or qty > 0),
  wanted text check (wanted is null or wanted in ('week', 'any')),
  agent_client_id text,
  -- Said as the agent knows them: the board cannot read an agent's clients.
  client_name text check (client_name is null or length(client_name) <= 120),
  status text not null default 'open' check (status in ('open', 'done', 'declined')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade,
  check (kind <> 'name' or product_id is not null)
);
create index if not exists agent_requests_open_idx on agent_requests (shop_id, status, created_at desc);
create index if not exists agent_requests_agent_idx on agent_requests (shop_id, agent_id, created_at desc);

alter table agent_requests enable row level security;

drop policy if exists "admins manage agent requests" on agent_requests;
create policy "admins manage agent requests" on agent_requests
  for all using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));
drop policy if exists "agent reads own requests" on agent_requests;
create policy "agent reads own requests" on agent_requests
  for select using (agent_id = current_agent_id(shop_id));
-- An agent adds a request as themselves, open, and nothing else: never
-- one already answered, never one in another agent's name.
drop policy if exists "agent adds own requests" on agent_requests;
create policy "agent adds own requests" on agent_requests
  for insert with check (
    agent_id = current_agent_id(shop_id)
    and status = 'open' and resolved_at is null and resolved_by is null
  );
