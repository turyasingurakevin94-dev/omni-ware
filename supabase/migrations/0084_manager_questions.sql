-- The Manager may ask the shop for what no database holds.
--
-- Every figure it argues from has to come from these books, which is
-- what keeps it honest -- and also its ceiling. What a supplier charges
-- at forty units, whether a debtor is still trading, what the shop
-- across the road asks for the same screw: none of that is in here, and
-- until now there was no way to say so. A 'question' row is the Manager
-- asking, the Manager screen shows it with a box to answer in, and the
-- answer is read back at the top of the next meeting as evidence like
-- any other -- said by the owner, never invented.
--
-- Same widening as 0082 did for 'review'. The constraint name is the
-- one 0082 gave it.

alter table manager_notes drop constraint if exists manager_notes_kind_check;
alter table manager_notes add constraint manager_notes_kind_check
  check (kind in ('meeting', 'move', 'review', 'question'));
