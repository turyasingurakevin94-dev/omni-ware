-- Where the shop's places actually are.
--
-- Every customer and supplier already carries a location, but it is a
-- NAME -- "Bwaise", "Industrial Area" -- and nothing in the app knows
-- where those are on Earth. Geocoding is not the answer here: there are
-- no addresses to geocode, and the whole book resolves to about twenty
-- distinct places. So a place is pinned ONCE, by hand, and every record
-- that names it inherits the pin.
--
-- Keyed by the canonical name rather than an id, because the name IS the
-- key everywhere else: customers.location, suppliers.location and
-- presetLocations all join on the spelling that canonicalLocation()
-- settles on. An id would need every one of those rewritten to point at
-- it, for nothing gained.
--
-- lat/lng are nullable ON PURPOSE. A place nobody has pinned yet is not
-- a place at 0,0 in the Gulf of Guinea -- it is a place with no pin, and
-- the map lists it apart rather than drawing it somewhere false. Same
-- rule the buying runs already follow for suppliers with no location.
create table places (
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now(),
  primary key (shop_id, name),
  constraint places_lat_range check (lat is null or (lat >= -90 and lat <= 90)),
  constraint places_lng_range check (lng is null or (lng >= -180 and lng <= 180)),
  -- Half a pin is worse than none: it would place a marker on a real
  -- meridian at a fictional latitude.
  constraint places_pin_whole check ((lat is null) = (lng is null))
);

alter table places enable row level security;

create policy "shop members full access" on places
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- The same restrictive delete gate 0058 put on every other data table, so
-- a stale client cannot remove pins.
create policy "owner only deletes" on places
  as restrictive for delete using (is_shop_owner(shop_id));
