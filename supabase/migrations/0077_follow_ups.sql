-- A client asked to be kept posted about something, and what we have
-- actually told them.
--
-- Out in the field clients say "let me know when you get it" or "tell me
-- if the price comes down". Unless that became an order the same day the
-- shop had nowhere to put it, so it survived only in whoever heard it --
-- and the ones remembered were the ones that happened to be remembered.
--
-- The thing being followed is EITHER a product the shop stocks or a lead
-- still in the sourcing funnel, never both:
--
--   product_id (+ variant_idx)  something on the shelf, or that was
--   lead_id                     something we do not sell yet
--
-- A lead-backed row keeps lead_id even after the lead graduates, and
-- resolves the product THROUGH the lead rather than rewriting itself.
-- That is not tidiness: sourcing_leads.product_id is set at graduation
-- and set back to null if the lead is moved off `listed` again, so a row
-- that had copied the id at graduation would afterwards point at nothing,
-- with no way left to tell what it had been following.
--
-- payload holds the contact ledger, and it is a LEDGER rather than a
-- last_contacted_at stamp because two of the four things worth telling a
-- client are differences against what they were last told:
--
--   contacts -- one entry per time we actually said something:
--     {at, reason, priceToldUGX, leadStatusTold}
--     priceToldUGX answers "has the price moved since they heard it" and
--     leadStatusTold answers "has the sourcing got further since they
--     heard it". A single timestamp can answer neither, and recomputing
--     them from anywhere else would be guessing at a conversation.
--
-- jsonb for the same reason sourcing_leads.requests is: never queried
-- across rows, never joined to, only ever read as the whole list of one
-- record -- the shape the offline diff-sync in index.html already moves.
--
-- Note that a row is CLOSED, not deleted. "They bought it" and "they went
-- elsewhere" are both worth keeping: the second is the more useful of the
-- two and is exactly what a deleted row would throw away.
create table follow_ups (
  id bigint not null,
  shop_id uuid not null references shops(id) on delete cascade,
  -- Plain text, not a foreign key, matching sourcing_leads.product_id and
  -- collection_trips.supplier_id: the cost is a dangling id after a
  -- customer is deleted, so every read of it tolerates find() returning
  -- undefined, and that is cheaper than another ordering constraint on
  -- save.
  customer_id text not null,
  product_id text,
  variant_idx int,
  lead_id text,
  -- How many they said they wanted. Null means they never said, which is
  -- ordinary -- "tell me when you get it" names no quantity -- and must
  -- not read as zero.
  qty numeric,
  note text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_reason text,
  payload jsonb not null default '{}'::jsonb,
  primary key (shop_id, id),
  -- Exactly one thing is being followed. Neither would be a row that
  -- cannot say what it is about; both would leave every reader to decide
  -- which one wins, and they would not all decide the same way.
  constraint follow_ups_one_subject check
    ((product_id is not null) <> (lead_id is not null))
);

-- Every read is "what is still open, for this shop" -- and on a shop with
-- a year of settled follow-ups behind it that is a small slice.
create index follow_ups_open_idx
  on follow_ups (shop_id, customer_id) where closed_at is null;

alter table follow_ups enable row level security;

create policy "shop members full access" on follow_ups
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- The same restrictive delete gate 0058 put on every other data table, so
-- a stale client cannot wipe the record of who is waiting on what.
create policy "owner only deletes" on follow_ups
  as restrictive for delete using (is_shop_owner(shop_id));

-- The id counter these rows are issued from, same block scheme as 0034
-- and seeded the same way 0042 seeds its own: next_row_id_blocks starts
-- from whatever it finds, and a missing counter would hand the first
-- client id 1 for a table that may already have rows if this migration is
-- ever re-run against a restored database.
insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:follow_up', 0 from shops
on conflict (shop_id, kind) do nothing;
