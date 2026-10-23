-- 0163 Store, eighth (audit round 4: search and navigation, 23 Oct 2026; docs/audit/ROUND-4.md).
--
--   NAV-06 One product name was misspelt, so Find missed it when the yard typed
--   it right: P550 "Silcone Clear" is "Silicone Clear". It stays in Furniture
--   with the other adhesives (round 1). Matched by id and the old name, like
--   0161, so a name someone has already corrected is left alone.
--
-- Data only: no function, table or policy changes. The rest of NAV-06 (4x20,
-- one letter short, "Did you mean") is in store.html.
--
-- Run after 0161. Safe to run twice.
-- ROLLBACK: update products set name = 'Silcone Clear' where id = 'P550' and name = 'Silicone Clear';
-- ---------------------------------------------------------------------

update products p set name = 'Silicone Clear'
 where p.id = 'P550' and p.name = 'Silcone Clear';
