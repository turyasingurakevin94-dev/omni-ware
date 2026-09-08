-- Where a customer's build has reached.
--
-- Two columns, and they buy something no figure in the books can: what
-- somebody is about to need BEFORE they have bought any of it. A buying
-- rhythm can only ever say "more of the same". A site at walling says
-- cement and blocks; the same site at roofing says sheets, ridges and
-- roofing nails, and it says so on the day it moves -- weeks before the
-- first sheet appears on an invoice.
--
-- THE DATE IS WHAT MAKES IT SAFE. A stage without one rots silently: a
-- site that finished roofing in July would still be offered sheets in
-- December, confidently, forever. Stored beside the stage and read
-- everywhere it is read, so a stage older than the app's staleness
-- window simply stops counting until somebody confirms it. Missing data
-- is reported, never treated as fact.
--
-- TEXT, NOT AN ENUM. The seven values are a closed list in the app, and
-- keeping the column open means adding an eighth is a release rather
-- than a migration -- and an unrecognised value reads as "no stage",
-- which is the truth rather than a crash.
--
-- SAFE TO RUN TWICE: add column if not exists is idempotent, and a shop
-- that has run it already sees nothing change.

alter table customers add column if not exists site_stage text;
alter table customers add column if not exists site_stage_at date;

-- Who has one, and how old it is:
-- select site_stage, count(*), min(site_stage_at) as oldest
--   from customers where site_stage is not null group by 1 order by 2 desc;
