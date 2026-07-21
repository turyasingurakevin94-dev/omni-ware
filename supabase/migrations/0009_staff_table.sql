-- Staff (workers and delivery personnel) that orders on the Order
-- Tracking board get assigned to as they move Draft -> Preparing ->
-- Pending Delivery. Mirrors the suppliers table shape.

create table staff (
  shop_id uuid not null references shops(id) on delete cascade,
  id text not null,
  name text, phone text, role text, notes text,
  primary key (shop_id, id)
);

alter table staff enable row level security;
create policy "shop members full access" on staff for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));
