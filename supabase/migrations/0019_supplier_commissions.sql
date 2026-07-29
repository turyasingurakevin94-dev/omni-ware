-- Commission a shop earns FROM a supplier for selling their products,
-- recorded per period (usually monthly) since that's how suppliers
-- typically pay it out -- distinct from agent_commission_claims, which is
-- money the shop owes an AGENT. Re-recording the same supplier+period
-- upserts in place rather than piling up duplicate rows.
create table supplier_commissions (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  supplier_id text not null,
  period text not null, -- 'YYYY-MM'
  amount numeric not null default 0,
  notes text,
  foreign key (shop_id, supplier_id) references suppliers(shop_id, id) on delete cascade,
  unique (shop_id, supplier_id, period)
);
create index supplier_commissions_shop_idx on supplier_commissions(shop_id);

alter table supplier_commissions enable row level security;

create policy "shop members full access" on supplier_commissions
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));
