-- The Manager may be measured against numbers it set itself.
--
-- A fifth row kind: 'target'. Written PROPOSED when a meeting suggests
-- one, and only becoming live when the owner takes it on -- a number the
-- shop is judged by is a commitment, and commitments here are made by a
-- tap, like every other real thing in this app.
--
-- The row holds only what cannot be worked out later: the metric, the
-- aim, the period, and WHERE THE SHOP STOOD when it was taken on. Where
-- it stands now is never stored -- it is read from the books every time
-- the scoreboard is drawn, so a manager cannot keep its own score. Same
-- law as a move's outcome, for the same reason.
--
-- Third widening of the same check (0082 review, 0084 question). The
-- constraint name is the one 0084 gave it.

alter table manager_notes drop constraint if exists manager_notes_kind_check;
alter table manager_notes add constraint manager_notes_kind_check
  check (kind in ('meeting', 'move', 'review', 'question', 'target'));
