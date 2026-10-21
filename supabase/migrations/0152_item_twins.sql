-- 0152: one item, one name (Sourcing v2, round 7; the cross-app test of 21 Oct).
--
-- "SJS Wall Plugs White/M6" was bought in as a 200 carton while "Wall
-- Plugs 6mm" -- the same plug -- had 196 packs on the shelf. Nothing said
-- the two were one item. Now:
--
--   item_twins   Sourcing's verdict on two items that look like one:
--                'same' (one name is kept; the other is taught as a name
--                of it, item_names, so search and orders land on the kept
--                one) or 'different' (never flagged together again). The
--                two product rows both stay on the books: nothing moves on
--                the shelf, and stock is never Sourcing's. Written with
--                product.edit (an item's own details, decision-rights
--                Sourcing); read by every member, so the Buyer sees the
--                shelf twin before buying.
--
-- The pair is kept in one order (a < b) so it is one row however it was
-- flagged. The Buyer's own flag arrives as a sourcing_fix hand-off (0125)
-- with a fix { field: 'same', productId, otherId }.
--
-- Safe to re-run.
--
-- Rollback:
--   drop table if exists item_twins;

create table if not exists item_twins (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  a text not null,
  b text not null,
  verdict text not null check (verdict in ('same', 'different')),
  keep text,
  handoff_id uuid,
  by_user uuid default auth.uid(),
  at timestamptz not null default now(),
  check (a < b),
  check (verdict = 'different' or keep in (a, b))
);
create unique index if not exists item_twins_pair_idx on item_twins (shop_id, a, b);
alter table item_twins enable row level security;

drop policy if exists "members read item twins" on item_twins;
create policy "members read item twins" on item_twins
  for select using (is_shop_member(shop_id));
drop policy if exists "sourcing judges item twins" on item_twins;
create policy "sourcing judges item twins" on item_twins
  for insert with check ((has_task(shop_id, 'product.edit') or is_shop_admin(shop_id)) and by_user = auth.uid());
drop policy if exists "sourcing changes its verdict" on item_twins;
create policy "sourcing changes its verdict" on item_twins
  for update using (has_task(shop_id, 'product.edit') or is_shop_admin(shop_id))
  with check ((has_task(shop_id, 'product.edit') or is_shop_admin(shop_id)) and by_user = auth.uid());
