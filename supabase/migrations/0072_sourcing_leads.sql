-- An item a client asked for that the shop does not sell yet, and the
-- research that turns it into one.
--
-- The shop is asked for things it has never stocked. Somebody has to find
-- out who imports it, which supplier actually has it, what it costs and
-- how it is packed -- and until now that chase lived in one person's head
-- and in WhatsApp scrollback. It got dropped, or researched twice, and the
-- number that should decide whether to stock the thing at all -- how many
-- DIFFERENT customers have asked for it -- was never counted.
--
-- Five stages, in order:
--   asked   -- somebody asked; nobody has looked yet
--   looking -- given to a person to research
--   sourced -- we know who has it (a supplier, an importer, or both)
--   priced  -- we know what it costs
--   listed  -- it is a real product now; product_id says which
--
-- `listed` is written by graduation and nowhere else, always together
-- with product_id. A lead sitting in `listed` with no product would be
-- this table's biggest lie: the board would say the shop stocks it and
-- the catalogue would disagree.
--
-- requests and candidates are jsonb for the same reason
-- collection_trips.lines is: never queried across leads, never joined to,
-- only ever read as the whole list of one record -- which is the shape
-- the offline diff-sync in index.html already knows how to move.
--
--   requests  -- the demand ledger, one entry per ask:
--     {at, source, customerId, customerName, phone, qty, orderId,
--      conversationId, note}
--     Every ask is kept rather than a counter being bumped, because five
--     asks from one customer is not the signal five customers are, and a
--     stored count cannot tell the two apart afterwards.
--
--   candidates -- what the research turned up, one entry per lead found:
--     {id, role, supplierId, supplierName, phone, where, quotedPrice,
--      unit, packQty, packUnit, moq, leadTimeDays, note, at}
--     role is 'importer' | 'supplier' | 'both'. The distinction is real
--     here: the importer brings it into the country and sets the floor
--     price, the supplier in Kikuubo is who you actually buy from, and
--     knowing only one of them is a half-finished job.
create table sourcing_leads (
  id text not null,
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  notes text,
  status text not null default 'asked',
  assigned_staff_id text,
  -- Not a foreign key, deliberately -- collection_trips.supplier_id is
  -- plain text for the same reason. Graduation already has to sequence
  -- two saves around the prices->products FK; a third ordering constraint
  -- buys nothing. The cost is a dangling id after a product is deleted,
  -- so every read of it tolerates find() returning undefined.
  product_id text,
  graduated_at timestamptz,
  created_at timestamptz not null default now(),
  -- When it entered the stage it is in now, so "12 days here" means what
  -- it says. Re-applying the same status does not touch it.
  stage_entered_at bigint,
  requests jsonb not null default '[]'::jsonb,
  candidates jsonb not null default '[]'::jsonb,
  -- Dropped, not deleted. The research and the demand ledger are the
  -- asset -- the next person to ask for it is exactly why you kept them,
  -- and "we looked at this in March, the only importer wants 40 cartons"
  -- is a lesson nobody should have to learn twice.
  voided boolean not null default false,
  dropped_reason text,
  dropped_at timestamptz,
  primary key (shop_id, id),
  constraint sourcing_leads_status check
    (status in ('asked','looking','sourced','priced','listed'))
);

-- Every read is by shop and almost every one is "what is still open" --
-- which on a shop with a year of dropped and listed leads behind it is a
-- small slice of a large table.
create index sourcing_leads_open_idx
  on sourcing_leads (shop_id, status) where voided = false;

alter table sourcing_leads enable row level security;

create policy "shop members full access" on sourcing_leads
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- The same restrictive delete gate 0058 put on every other data table, so
-- a stale client cannot wipe the record of who asked for what.
create policy "owner only deletes" on sourcing_leads
  as restrictive for delete using (is_shop_owner(shop_id));
