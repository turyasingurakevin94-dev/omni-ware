-- Omni-ware: shared shop model
-- shops + shop_members (multi-staff, role-scoped) with every price-book
-- table scoped to shop_id. RLS checks shop membership, not row ownership.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Shops & membership
-- ---------------------------------------------------------------------

create table shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create table shop_members (
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index shop_members_user_id_idx on shop_members(user_id);

-- Membership-check helpers, SECURITY DEFINER so they can read shop_members
-- without re-triggering RLS on shop_members itself (would otherwise risk
-- recursive policy evaluation on that table's own policies below).
create or replace function is_shop_member(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from shop_members
    where shop_id = p_shop_id and user_id = auth.uid()
  );
$$;

create or replace function is_shop_admin(p_shop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from shop_members
    where shop_id = p_shop_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------
-- Price book / inventory tables, all scoped to shop_id.
-- Entity ids (S001, P001, ...) are kept as-is from the current app so the
-- existing localStorage JSON export can be imported with minimal reshaping;
-- uniqueness is now (shop_id, id) instead of globally unique.
-- ---------------------------------------------------------------------

create table suppliers (
  shop_id uuid not null references shops(id) on delete cascade,
  id text not null,
  name text, phone text, location text, notes text,
  primary key (shop_id, id)
);

create table customers (
  shop_id uuid not null references shops(id) on delete cascade,
  id text not null,
  name text, phone text, location text, notes text,
  debt numeric not null default 0,
  primary key (shop_id, id)
);

create table customer_debt_log (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  customer_id text not null,
  date date, type text, amount numeric, note text,
  foreign key (shop_id, customer_id) references customers(shop_id, id) on delete cascade
);
create index customer_debt_log_shop_idx on customer_debt_log(shop_id);
create index customer_debt_log_customer_idx on customer_debt_log(shop_id, customer_id);

create table products (
  shop_id uuid not null references shops(id) on delete cascade,
  id text not null,
  name text, category text, notes text,
  wholesale_markup_type text, wholesale_markup_value numeric,
  retail_markup_type text, retail_markup_value numeric,
  primary key (shop_id, id)
);

create table prices (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  product_id text not null,
  supplier_id text not null,
  wholesale numeric, retail numeric, date date,
  unit text, pack_unit text, pack_qty numeric,
  foreign key (shop_id, product_id) references products(shop_id, id) on delete cascade,
  foreign key (shop_id, supplier_id) references suppliers(shop_id, id) on delete cascade
);
create index prices_shop_idx on prices(shop_id);
create index prices_product_idx on prices(shop_id, product_id);

create table stock (
  shop_id uuid not null references shops(id) on delete cascade,
  key text not null,             -- stockKey(productId, variantIdx) from the app, unchanged
  product_id text, variant_idx text, qty numeric not null default 0,
  primary key (shop_id, key)
);

create table stock_lots (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  key text not null,             -- indexed, not FK'd to stock: lots may sync before the
  qty numeric, cost numeric      -- stock row does in the diffing sync layer we'll build next
);
create index stock_lots_shop_key_idx on stock_lots(shop_id, key);

create table stock_log (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  key text, product_id text, variant_idx text,
  label text, type text, delta numeric, qty_after numeric,
  note text, date date, at timestamptz
  -- no FK to products: this is an audit trail and should survive product deletion
);
create index stock_log_shop_idx on stock_log(shop_id);

create table cash_days (
  shop_id uuid not null references shops(id) on delete cascade,
  date date not null,
  opening jsonb, actual jsonb, opening_set boolean not null default false,
  primary key (shop_id, date)
);

create table cash_txns (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  date date, account text, type text, category text,
  amount numeric, description text, time text
  -- no FK to customers/suppliers: audit trail, same reasoning as stock_log
);
create index cash_txns_shop_idx on cash_txns(shop_id);

create table saved_quotes (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  client_name text, client_phone text, date date,
  status text, invoiced boolean not null default false, invoiced_at date,
  invoiced_ts timestamptz, amount_paid numeric not null default 0, voided boolean not null default false,
  payload jsonb   -- items[], payments[]: not normalized yet, see migration plan
);
create index saved_quotes_shop_idx on saved_quotes(shop_id);

create table purchase_invoices (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  quote_id bigint references saved_quotes(id),
  date date,
  payload jsonb
);
create index purchase_invoices_shop_idx on purchase_invoices(shop_id);

create table app_settings (
  shop_id uuid primary key references shops(id) on delete cascade,
  presets jsonb,        -- presetCategories/Units/IncomeCategories/ExpenseCategories/Attributes
  quote_draft jsonb,    -- data.quote: the shared in-progress, unsaved quote
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS: shops & shop_members
-- ---------------------------------------------------------------------

alter table shops enable row level security;

create policy "members can view their shop" on shops
  for select using (is_shop_member(id));

create policy "any authenticated user can create a shop" on shops
  for insert with check (created_by = auth.uid());

create policy "admins can update shop" on shops
  for update using (is_shop_admin(id)) with check (is_shop_admin(id));

create policy "owners can delete shop" on shops
  for delete using (
    exists (
      select 1 from shop_members
      where shop_id = shops.id and user_id = auth.uid() and role = 'owner'
    )
  );

alter table shop_members enable row level security;

create policy "members can view roster" on shop_members
  for select using (is_shop_member(shop_id));

-- Bootstraps the very first membership row (the shop's creator, as owner)
-- without needing an existing admin to grant it; every subsequent invite
-- must come from an existing owner/admin.
create policy "bootstrap owner or admin invites" on shop_members
  for insert with check (
    (user_id = auth.uid() and exists (
      select 1 from shops where id = shop_id and created_by = auth.uid()
    ))
    or is_shop_admin(shop_id)
  );

create policy "admins manage roles" on shop_members
  for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

create policy "self-leave or admin removes" on shop_members
  for delete using (user_id = auth.uid() or is_shop_admin(shop_id));

-- ---------------------------------------------------------------------
-- RLS: price book / inventory tables — any shop member has full access.
-- (Tighter per-role rules, e.g. restricting deletes to admins, can be
-- layered on later; v1 matches "whole staff works on one shared price book".)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'suppliers', 'customers', 'customer_debt_log', 'products', 'prices',
    'stock', 'stock_lots', 'stock_log', 'cash_days', 'cash_txns',
    'saved_quotes', 'purchase_invoices', 'app_settings'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "shop members full access" on %I for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id))',
      t
    );
  end loop;
end $$;
