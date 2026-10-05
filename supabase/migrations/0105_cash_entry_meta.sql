-- Who entered a cash entry, the photo of its paper, and the mark that
-- closes a day -- the three things the redesigned Cash Book shows that
-- nothing on file could say before.
--
-- entered_by is the auth user id of whoever wrote the entry, as text so a
-- staff row can be matched on either its user id or its own id. NULL on
-- every older entry, and the book says so ("not recorded") rather than
-- guessing; an entry another screen wrote is told apart by its document.
--
-- photo is a path in the PRIVATE bill-photos bucket (0100), stored and
-- shop-scoped exactly as a bill's photo is, and shown through a signed
-- URL. No new bucket and no new policy: a receipt is a paper document of
-- the same kind, read by the same people.
--
-- closed_at / closed_by are the owner's word that a day is done: every
-- account counted and agreeing. A mark, not a lock -- a closed day can be
-- reopened, and the book never refuses an entry somebody really made.
--
-- The app probes for these before writing them (as it does for 0076 and
-- 0095), so it keeps recording money in the window between the code
-- deploying and this being applied by hand.
alter table public.cash_txns
  add column if not exists entered_by text,
  add column if not exists photo text;

alter table public.cash_days
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by text;
