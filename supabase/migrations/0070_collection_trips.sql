-- Somebody going to a supplier to fetch goods, and what they came back
-- with.
--
-- The shop is a fulfilment centre: goods bought for an order come IN
-- first and are picked from the shop afterwards (see the awaiting_goods
-- order stage). The buying list already says what to fetch and from
-- whom; this is the job of actually going, given to a person.
--
-- A trip is per SUPPLIER, not per order, because that is the shape of
-- the real thing: one journey to Shafik covers lines from three
-- different orders and is settled with one payment. Grouping by order
-- would have sent the same worker to the same shop three times.
--
-- The lines are held as jsonb rather than as their own table. They are
-- never queried across trips, never joined to, and only ever read as the
-- whole list of one trip -- which is exactly what saved_quotes.payload
-- already does for order lines, and is the shape the offline diff-sync
-- in index.html knows how to move.
--
-- Each line points back at the order line it is for:
--   {orderId, lineId, productId, variantIdx, productName, unit, packUnit,
--    qty, expectedPrice, gotQty, gotPrice}
-- qty/expectedPrice are what the buying list sent them for; gotQty and
-- gotPrice are what actually came back, and stay null until somebody
-- says. Nothing here writes stock: confirming the trip does that, on the
-- admin side, through the receiving path the order lines already use.
create table collection_trips (
  id text not null,
  shop_id uuid not null references shops(id) on delete cascade,
  supplier_id text not null,
  -- open      -- made, nobody sent yet
  -- assigned  -- given to a worker, not yet accepted on their device
  -- collecting-- accepted; they are out
  -- collected -- back, with what they got recorded, awaiting confirmation
  -- confirmed -- checked in by the shop; the goods are on the shelf
  status text not null default 'open',
  assigned_worker_id text,
  -- Kept apart so "sent at 9, accepted at 11" is answerable. A single
  -- updated_at would have flattened the wait nobody could otherwise see.
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  accepted_at timestamptz,
  collected_at timestamptz,
  confirmed_at timestamptz,
  note text,
  lines jsonb not null default '[]'::jsonb,
  voided boolean not null default false,
  primary key (shop_id, id),
  constraint collection_trips_status check
    (status in ('open','assigned','collecting','collected','confirmed'))
);

-- Every read is by shop and almost every one is "what is still open",
-- which on a shop with a year of trips behind it is a small slice of a
-- large table.
create index collection_trips_open_idx
  on collection_trips (shop_id, status) where voided = false;

alter table collection_trips enable row level security;

-- Workers are shop members, and a worker has to be able to read the trip
-- they were given and write back that they have accepted it and what they
-- came home with. What they cannot do is put goods on the shelf: that is
-- confirming, and it happens in the admin app against the order lines.
create policy "shop members full access" on collection_trips
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- The same restrictive delete gate 0058 put on every other data table, so
-- a stale client cannot remove a trip somebody is out on.
create policy "owner only deletes" on collection_trips
  as restrictive for delete using (is_shop_owner(shop_id));
