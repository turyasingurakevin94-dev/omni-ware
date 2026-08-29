-- The Manager's weekly review joins the journal as a third row kind.
--
-- 0081 allowed only 'meeting' and 'move', so a 'review' row -- the
-- verdict, at most three lessons, and the week's figures AS THE BOOKS
-- DERIVED THEM AT THE TIME (a review judges a closed week the rolling
-- window walks away from, so its figures are frozen with the judgement;
-- move outcomes stay derived-at-render as before) -- would violate the
-- check constraint. Widen it. The constraint name is the one Postgres
-- gave the inline check in 0081.

alter table manager_notes drop constraint if exists manager_notes_kind_check;
alter table manager_notes add constraint manager_notes_kind_check
  check (kind in ('meeting', 'move', 'review'));
