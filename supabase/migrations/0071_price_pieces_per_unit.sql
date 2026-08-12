-- How many individual pieces are in ONE of this row's units.
--
-- The comparison page can rank suppliers of the SAME product without this,
-- because they are quoting the same thing. It cannot rank different
-- products against each other, and that is what it was asked to do.
--
-- The shop's own Fasteners / Self Drilling family is the case: RIDER is
-- quoted per Box, SJS per Pack, PATTA per Ctn. Nothing on file says how
-- many screws are in a Box or a Pack, so "44,000 a Box vs 38,500 a Pack"
-- cannot be ranked -- and a page that ranked it anyway would be
-- confidently wrong, which is worse than a page that declines.
--
-- With this recorded, price-per-piece is exact and every brand in a
-- family becomes comparable on one number.
--
-- Nullable, and null means UNKNOWN, never one. A row without it is
-- reported as not-comparable rather than being quietly treated as
-- one-piece-per-unit, which would make a 100-piece carton look a hundred
-- times dearer than a single screw -- the same shape of error as a carton
-- price entered as a unit price.
--
-- It lives on the price row rather than the product because it describes
-- what a SUPPLIER sells: two suppliers of the same screw box them
-- differently, and unit/pack_unit/pack_qty are already on this row for
-- exactly that reason.
alter table public.prices
  add column if not exists pieces_per_unit numeric;

comment on column public.prices.pieces_per_unit is
  'Individual pieces in one `unit` of this row (e.g. 100 screws in a Box). NULL means not recorded, which the comparison reports as not-comparable rather than assuming 1.';
