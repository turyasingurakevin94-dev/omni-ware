-- A customer who can sign in.
--
-- THE THIRD IDENTITY. shop_members are staff (0001). agents are
-- deliberately NOT shop_members (0012), because every price-book table
-- carries a blanket "shop members full access" policy and an agent must
-- never see supplier identity or cost. A customer needs the same
-- treatment one step further out: they get NO row-level access to
-- anything at all, and everything they can see arrives through one
-- service-role Edge Function that hand-picks the fields. There is no
-- column-level redaction to get subtly wrong because there is no
-- column-level access.
--
-- WHY NOT login_sessions (0062). That table requires
-- user_id uuid not null references auth.users, and constrains
-- app in ('admin','worker','agent'). A customer is not an auth.users
-- row and should not become one: minting an auth user per customer puts
-- a real credential on the account of somebody whose only proof of
-- identity is a phone they answer. So sessions live here, keyed on the
-- customer, and the Edge Function is the only thing that can read them.
--
-- WHY NOT 0053's pin. That column is Meta's two-step verification PIN
-- for the shop's own WhatsApp number. Nothing to borrow but the word.
--
-- THE ACCOUNT IS CREATED BY THE SHOP, never by self-signup. The owner
-- presses a button on a customer that already exists in `customers`, and
-- that customer gets a PIN. Two things follow. The gate is airtight
-- while the portal is young -- nobody reaches a price without somebody
-- at the shop deciding they should. And it sidesteps the matching
-- problem: saved_quotes carries client_name/client_phone as text and no
-- customer id, so "which orders are yours" is a guess unless a person
-- asserts the link. Here the shop asserts it, once, and the row holds it.
--
-- SAFE TO RUN TWICE. Migrations here are pasted by hand into a database
-- whose real state is whatever somebody pasted before.

create table if not exists client_accounts (
  shop_id uuid not null references shops(id) on delete cascade,
  customer_id text not null,
  -- Normalised at write time to the last nine digits, so 0772418903,
  -- +256772418903 and 256772418903 are one account and not three.
  phone text not null,
  -- Never the PIN itself. Minted by the Edge Function, hashed there,
  -- and compared by hash -- so a database somebody has a copy of does
  -- not hand out the current PIN of every customer.
  pin_hash text,
  pin_expires_at timestamptz,
  -- Counted up on a wrong PIN and cleared on a right one. The lock is
  -- derived from this and pin_expires_at rather than stored, so a lock
  -- cannot outlive the PIN it belongs to.
  pin_attempts integer not null default 0,
  -- Which agent this customer belongs to, if any. Carried over from
  -- agent_clients when the account is opened so the portal does not
  -- quietly become a second channel that cuts an agent out of their own
  -- customer. Null is a house account.
  agent_id text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  primary key (shop_id, customer_id),
  foreign key (shop_id, customer_id) references customers(shop_id, id) on delete cascade
);

-- One phone, one account, per shop. Two accounts on one number would
-- make "whose balance is this" unanswerable at the moment of sign-in.
create unique index if not exists client_accounts_phone_uniq
  on client_accounts(shop_id, phone);

-- Who is signed in, on what. One row per account and device, updated in
-- place -- the same shape as login_sessions and for the same reason: the
-- question is "what is signed in right now", not "every sign-in there
-- has ever been".
create table if not exists client_sessions (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  customer_id text not null,
  -- A hash of the opaque token the browser holds. The token itself is
  -- never stored, so a leaked database cannot be used to impersonate a
  -- customer -- only to see that a session exists.
  token_hash text not null,
  -- Random, minted by the browser, kept in its own localStorage. It
  -- identifies a browser profile and nothing about a person; clearing
  -- storage makes a new one, which shows as a new device rather than
  -- pretending to recognise the old.
  device_id text not null,
  label text not null default '',
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Set by the shop, or by the customer signing out. Never cleared: a
  -- revoked session stays revoked and coming back means signing in
  -- again. 0062 learned this the hard way.
  revoked_at timestamptz,
  foreign key (shop_id, customer_id) references client_accounts(shop_id, customer_id) on delete cascade
);

create unique index if not exists client_sessions_token_uniq on client_sessions(token_hash);
create index if not exists client_sessions_account_idx
  on client_sessions(shop_id, customer_id, last_seen_at desc);

alter table client_accounts enable row level security;
alter table client_sessions enable row level security;

-- Staff manage accounts; the Edge Function reaches both tables with the
-- service-role key, which RLS does not apply to. There is deliberately
-- NO policy granting a customer anything: a customer has no Supabase
-- identity and must never acquire one.
drop policy if exists "admins manage client accounts" on client_accounts;
create policy "admins manage client accounts" on client_accounts
  for all using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

-- Members may see that a device is signed in, and an owner may revoke
-- it. Nobody may read token_hash usefully -- it is a hash -- and nobody
-- may insert one, because only the function mints sessions.
drop policy if exists "members see client sessions" on client_sessions;
create policy "members see client sessions" on client_sessions
  for select using (is_shop_member(shop_id));
drop policy if exists "admins revoke client sessions" on client_sessions;
create policy "admins revoke client sessions" on client_sessions
  for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));
drop policy if exists "admins delete client sessions" on client_sessions;
create policy "admins delete client sessions" on client_sessions
  for delete using (is_shop_admin(shop_id));

comment on table client_accounts is
  'A customer who can sign in to the client portal. Not a shop_member and not an auth.users row: everything they see arrives through the client-portal Edge Function, which hand-picks every field.';
comment on column client_accounts.phone is
  'Normalised to the last nine digits at write time, so one person on one number is one account however they type it.';

-- Look first: who has an account, and who is still only in customers.
-- select c.id, c.name, (a.customer_id is not null) as has_account
--   from customers c left join client_accounts a
--     on a.shop_id = c.shop_id and a.customer_id = c.id
--  order by has_account desc, c.name;

-- ---------------------------------------------------------------------
-- Terms and a limit, which the books have never held.
--
-- The portal shows a customer "your terms: 30 days" and "your limit:
-- 2,000,000, 760,000 still available". Both were invented by the design
-- and neither exists: `customers` carries a debt and nothing about the
-- agreement the debt sits under. The shop has always known these — they
-- live in the owner's head and in how hard the chase is — and a screen
-- that states them to a customer needs them written down.
--
-- ON customers, NOT ON client_accounts. A customer has thirty-day terms
-- whether or not they ever sign in, and closing a portal account must
-- not silently forget what was agreed. The account is a login; this is
-- the relationship.
--
-- NULL MEANS NOBODY SAID, and it is the honest state of every row that
-- exists today. Nothing is back-filled and nothing is assumed: the
-- portal shows a terms line only where there is one, the way 0088 reads
-- a rival price with no side rather than guessing at it. A default of
-- 30 here would put a promise in front of a customer that the shop
-- never made.
alter table customers add column if not exists terms_days integer;
alter table customers add column if not exists credit_limit numeric;

comment on column customers.terms_days is
  'Days from invoice to payment, as agreed with this customer. Null means nobody has said, which is not the same as cash terms.';
comment on column customers.credit_limit is
  'What this customer may owe at once. Null means no limit has been set, which is not the same as a limit of zero.';

-- Look first: how much of the book has an agreement written down.
-- select count(*) filter (where terms_days is not null) as with_terms,
--        count(*) filter (where credit_limit is not null) as with_limit,
--        count(*) as customers
--   from customers;
