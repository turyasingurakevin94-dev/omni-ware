-- 0132 — the supplier portal (supplier.html).
--
-- A supplier is the FOURTH identity, after staff, agents and customers
-- (0096). Like a customer, a supplier is not a shop_member and not an
-- auth.users row, so they have no row-level access to anything at all.
-- Everything they see arrives through the supplier-portal Edge Function,
-- which reads with the service-role key and builds every response key by
-- key. Everything they SAY lands in this migration's own tables and is
-- never written straight into the shop's records: the owner app folds an
-- answer in, and the owner approves a price.
--
-- The boundary (docs/supplier-platform.md, C3) is enforced by the
-- function and pinned by test/supplier-portal.test.js: a supplier never
-- sees the buyer, the sell price or margin, another supplier, another
-- supplier's lines on an order, or the shop's own stock.
--
-- Accounts are created by the shop, never by signing up. The owner
-- invites a supplier (supplier-accounts), a four-figure PIN goes to them,
-- and that PIN is the only way in. There is no "start" action that mints
-- a PIN on demand.

-- ---------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------
create table if not exists supplier_accounts (
  shop_id uuid not null references shops(id) on delete cascade,
  supplier_id text not null,
  -- The last nine digits, the same rule as client_accounts.phone.
  phone text not null,
  -- Never the PIN itself: PBKDF2, minted and compared in the functions.
  pin_hash text,
  pin_expires_at timestamptz,
  -- Five wrong tries and the PIN is dead; only the shop issues another.
  pin_attempts integer not null default 0,
  -- "Forgot PIN?" in the app sets this, so the owner sees who is waiting
  -- for a new one. Cleared when one is issued.
  pin_requested_at timestamptz,
  status text not null default 'active' check (status in ('active', 'suspended')),
  -- Language, quiet hours and which messages go where. Small, the
  -- supplier's own, and read back only to them.
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (shop_id, supplier_id),
  foreign key (shop_id, supplier_id) references suppliers(shop_id, id) on delete cascade
);

create unique index if not exists supplier_accounts_phone_uniq
  on supplier_accounts(shop_id, phone);

create table if not exists supplier_sessions (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  supplier_id text not null,
  token_hash text not null,
  device_id text not null,
  label text not null default '',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  foreign key (shop_id, supplier_id) references supplier_accounts(shop_id, supplier_id) on delete cascade
);

create unique index if not exists supplier_sessions_token_uniq on supplier_sessions(token_hash);
create index if not exists supplier_sessions_account_idx
  on supplier_sessions(shop_id, supplier_id, last_seen_at desc);

-- ---------------------------------------------------------------------
-- Answers to "can you supply this order?"
--
-- Kept in their own rows and NEVER written into saved_quotes.payload. The
-- owner app reads them and folds them in through setOrderSupplierConfirm,
-- so the one write path into an order stays the owner's (C4).
--
-- `terms` is the orderSupplierTerms signature of the lines the supplier
-- was shown. If the order is edited afterwards the signatures differ and
-- the answer is stale, exactly as a confirmation taken by phone is.
-- ---------------------------------------------------------------------
create table if not exists supplier_answers (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  order_id bigint not null,
  supplier_id text not null,
  state text not null check (state in ('confirmed', 'short', 'none')),
  terms text not null,
  -- For 'short': [{lineId, have}] — how many of each line they can give.
  changes jsonb not null default '[]'::jsonb,
  note text not null default '',
  at timestamptz not null default now(),
  -- Set by the owner app once it has folded this answer into the order.
  folded_at timestamptz,
  foreign key (shop_id, supplier_id) references supplier_accounts(shop_id, supplier_id) on delete cascade
);

create index if not exists supplier_answers_order_idx
  on supplier_answers(shop_id, order_id, supplier_id, at desc);

-- ---------------------------------------------------------------------
-- What a supplier proposes. Nothing here changes a price by itself.
--
--   still  — "this price is still correct" for one price row
--   price  — a new price (and bulk steps, packing) for one price row
--   add    — start supplying a product already in the catalogue
--   new    — a product the catalogue does not have yet
--
-- Out of stock is NOT a proposal: it is a fact about their own goods, and
-- the function writes it straight onto their price row (C5).
-- ---------------------------------------------------------------------
create table if not exists supplier_proposals (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  supplier_id text not null,
  kind text not null check (kind in ('still', 'price', 'add', 'new')),
  price_id bigint,
  product_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_note text not null default '',
  foreign key (shop_id, supplier_id) references supplier_accounts(shop_id, supplier_id) on delete cascade
);

create index if not exists supplier_proposals_open_idx
  on supplier_proposals(shop_id, status, created_at desc);

-- ---------------------------------------------------------------------
-- Row-level security. Admins manage everything; members may read. There
-- is deliberately NO policy granting a supplier anything: a supplier has
-- no Supabase identity and must never acquire one.
-- ---------------------------------------------------------------------
alter table supplier_accounts enable row level security;
alter table supplier_sessions enable row level security;
alter table supplier_answers enable row level security;
alter table supplier_proposals enable row level security;

drop policy if exists "admins manage supplier accounts" on supplier_accounts;
create policy "admins manage supplier accounts" on supplier_accounts
  for all using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

drop policy if exists "members see supplier sessions" on supplier_sessions;
create policy "members see supplier sessions" on supplier_sessions
  for select using (is_shop_member(shop_id));
drop policy if exists "admins revoke supplier sessions" on supplier_sessions;
create policy "admins revoke supplier sessions" on supplier_sessions
  for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

drop policy if exists "members see supplier answers" on supplier_answers;
create policy "members see supplier answers" on supplier_answers
  for select using (is_shop_member(shop_id));
drop policy if exists "admins fold supplier answers" on supplier_answers;
create policy "admins fold supplier answers" on supplier_answers
  for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

drop policy if exists "members see supplier proposals" on supplier_proposals;
create policy "members see supplier proposals" on supplier_proposals
  for select using (is_shop_member(shop_id));
drop policy if exists "admins decide supplier proposals" on supplier_proposals;
create policy "admins decide supplier proposals" on supplier_proposals
  for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

comment on table supplier_accounts is
  'A supplier who can sign in to supplier.html. Not a shop_member and not an auth.users row: everything they see arrives through the supplier-portal Edge Function, which hand-picks every field.';
comment on table supplier_answers is
  'A supplier''s answer to an order request. Never written into saved_quotes; the owner app folds it in.';
comment on table supplier_proposals is
  'A price or product a supplier proposes. Nothing changes until the owner accepts it.';

-- Look first: which suppliers have a portal account.
-- select s.id, s.name, (a.supplier_id is not null) as has_account, a.status
--   from suppliers s left join supplier_accounts a
--     on a.shop_id = s.shop_id and a.supplier_id = s.id
--  order by has_account desc, s.name;
