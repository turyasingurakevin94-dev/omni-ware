-- When a customer's statement was last sent, and what it said was due.
--
-- The customer account shows "Statement sent on WhatsApp -- 14 Sep,
-- 4,130,000 then due" under Notes & follow-ups, so the next person at
-- the counter knows the customer has already been shown the figure, and
-- which figure. That needs a memory, and this table is all of it.
--
-- WRITTEN BY A THUMB, NEVER BY THE APP. A row appears when the owner
-- presses Send PDF on WhatsApp and the file is handed to the share sheet
-- or saved beside an opened chat. Nothing here schedules or sends; it is
-- the record of something a person did.
--
-- WHAT IT SAID, not just when: `due` is the balance printed on the
-- sheet, so "then due" can be read against what is due now.
--
-- NO FOREIGN KEYS, same reasoning as 0089 to 0091: deleting a customer
-- should not erase the fact that they were sent a statement.
--
-- SAFE TO RUN TWICE.

create table if not exists statements_sent (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint not null,
  customer_id text not null,
  sent_on date not null,
  due numeric,
  period_from date,
  created_at timestamptz not null default now(),
  primary key (shop_id, id)
);

create index if not exists statements_sent_customer_idx
  on statements_sent (shop_id, customer_id, sent_on desc);

alter table statements_sent enable row level security;

drop policy if exists "shop members full access" on statements_sent;
create policy "shop members full access" on statements_sent
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

drop policy if exists "owner only deletes" on statements_sent;
create policy "owner only deletes" on statements_sent
  as restrictive for delete using (is_shop_owner(shop_id));
drop policy if exists "owner writes only" on statements_sent;
create policy "owner writes only" on statements_sent
  as restrictive for insert with check (is_shop_admin(shop_id));
drop policy if exists "owner updates only" on statements_sent;
create policy "owner updates only" on statements_sent
  as restrictive for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:statement_sent', 0 from shops
on conflict (shop_id, kind) do nothing;

-- select customer_id, max(sent_on) latest, count(*) sent
--   from statements_sent group by 1 order by 2 desc;
