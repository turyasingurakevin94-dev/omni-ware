-- When a customer was last told something, and what.
--
-- The shop sends one picture per customer per fortnight. That rule needs
-- a memory, and it is the only thing this table is for: without it the
-- app would offer the same customer the same cement every time the
-- screen was opened, and the fortnight would mean nothing.
--
-- WRITTEN BY A THUMB, NEVER BY THE APP. A row appears when the owner
-- presses Share and the picture leaves for WhatsApp. Nothing here is a
-- schedule and nothing sends itself; this is the record of something a
-- person did, which is the same contract every other send in this app
-- keeps.
--
-- WHAT WAS SAID, not just when. reason and product_id are kept because
-- the only honest measure of whether any of this works is "did they buy
-- this thing within a fortnight of being shown it" -- and that question
-- cannot be asked of a bare timestamp. The answer itself is never
-- stored: it is read from the invoices at the moment somebody looks, so
-- it can never disagree with them.
--
-- NO FOREIGN KEYS, same reasoning as 0089 and 0090: deleting a customer
-- or a product should not erase the fact that the shop told somebody
-- something. The row stops resolving and drops out of the reading.
--
-- SAFE TO RUN TWICE.

create table if not exists briefs_sent (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint not null,
  customer_id text not null,
  sent_on date not null,
  -- The rule that put them on the list: rhythm, asked, price, stage,
  -- return. Open text rather than a check, because a new reason must not
  -- need a migration before the shop can use it -- and an unknown reason
  -- reads as "told", which is the only thing this table is load-bearing
  -- for.
  reason text,
  product_id text,
  qty numeric,
  created_at timestamptz not null default now(),
  primary key (shop_id, id)
);

create index if not exists briefs_sent_customer_idx
  on briefs_sent (shop_id, customer_id, sent_on desc);

alter table briefs_sent enable row level security;

drop policy if exists "shop members full access" on briefs_sent;
create policy "shop members full access" on briefs_sent
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

drop policy if exists "owner only deletes" on briefs_sent;
create policy "owner only deletes" on briefs_sent
  as restrictive for delete using (is_shop_owner(shop_id));
drop policy if exists "owner writes only" on briefs_sent;
create policy "owner writes only" on briefs_sent
  as restrictive for insert with check (is_shop_admin(shop_id));
drop policy if exists "owner updates only" on briefs_sent;
create policy "owner updates only" on briefs_sent
  as restrictive for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:brief_sent', 0 from shops
on conflict (shop_id, kind) do nothing;

-- select customer_id, count(*) told, max(sent_on) latest
--   from briefs_sent group by 1 order by 3 desc;
