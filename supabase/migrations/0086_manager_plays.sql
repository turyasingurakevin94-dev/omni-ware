-- The Manager's playbook: the strategies this shop is actually working.
--
-- A sixth row kind. The Manager diagnosed well and prescribed nothing --
-- it could say "margin, not turnover, is the binding problem" and then
-- offer only collections, because a strategy is craft rather than a
-- figure and nothing here held one. A 'play' is that missing half:
-- charge for cutting, bulk-lot the dead stock, take a deposit before
-- delivery -- named, sized in this shop's own figures, and TRIED ONLY
-- ON A TAP like every other real thing in this app.
--
-- Kept rather than re-suggested, so the shop builds a strategy book
-- instead of hearing fresh ideas every Monday: a play the owner dropped
-- is never proposed again, a play that is running is known to be
-- running, and a play the OWNER typed in outranks anything the Manager
-- thought of. Whether it worked stays the owner's judgement -- nothing
-- here pretends to derive that.
--
-- Fourth widening of the same check (0082 review, 0084 question, 0085
-- target). The constraint name is the one 0085 gave it.

alter table manager_notes drop constraint if exists manager_notes_kind_check;
alter table manager_notes add constraint manager_notes_kind_check
  check (kind in ('meeting', 'move', 'review', 'question', 'target', 'play'));
