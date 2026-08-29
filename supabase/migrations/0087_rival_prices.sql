-- What the shop down the road charges.
--
-- This app has always known what the shop PAYS -- the price registry is
-- a record of suppliers -- and has never known what anyone else SELLS
-- for. That is the fact every pricing decision actually turns on, and
-- the one the Manager cannot reach: it can say margin is thin, it can
-- say lift the price, and it cannot say by how much without knowing
-- whether the customer can buy the same carton cheaper up the street.
--
-- An OBSERVATION, not a price list. Each row is one thing somebody saw
-- on one day: a shelf ticket, a quote a customer showed you, what a
-- rival told a walk-in. So it carries its date and who saw it, it is
-- never overwritten, and the newest one per rival is what the screens
-- read. A price seen in March and a price seen today are different
-- facts and this table keeps them both.
--
-- No FK to products deliberately -- the same reasoning as stock_log.
-- Deleting a product should not silently erase what the market was
-- doing; the row simply stops resolving to a line and drops out of
-- every reading. rival is free text: these are not suppliers, they are
-- other shops, and the shop knows them by name.

create table rival_prices (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  product_id text not null,
  variant_idx int,
  rival text not null,
  price numeric not null check (price > 0),
  unit text,
  seen_on date not null,
  note text,
  created_at timestamptz not null default now()
);

create index rival_prices_shop_line_idx
  on rival_prices(shop_id, product_id, variant_idx, seen_on desc);
create index rival_prices_shop_seen_idx on rival_prices(shop_id, seen_on desc);

alter table rival_prices enable row level security;

create policy "shop members full access" on rival_prices
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- The same three restrictions every other books table carries: members
-- read and write, only the owner deletes (0058), and only the owner
-- writes or amends (0083). A rival price argues for changing what this
-- shop charges, so an account that cannot change a price must not be
-- able to change the argument for it either.
create policy "owner only deletes" on rival_prices
  as restrictive for delete using (is_shop_owner(shop_id));
create policy "owner writes only" on rival_prices
  as restrictive for insert with check (is_shop_admin(shop_id));
create policy "owner updates only" on rival_prices
  as restrictive for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

-- Look first: what this shop already knows about the market, if the
-- table somehow exists from an earlier run.
-- select rival, count(*) as seen, max(seen_on) as latest
--   from rival_prices group by rival order by latest desc;
