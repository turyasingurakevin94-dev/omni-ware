-- What the Manager needs written down to see the month ahead and to
-- remember its own days -- four new row kinds in its journal, and two
-- things about a supplier that only the owner knows (the third, the
-- credit they give, is 0106's terms_days).
--
-- manager_notes, four new kinds. Fifth widening of the same check
-- (0082 review, 0084 question, 0085 target, 0086 play), under the name
-- those four kept, and every kind already allowed stays allowed --
-- leaving one out would refuse every row of it the shop already holds.
--
--   snapshot  the day's health reading -- the score, each department's,
--             and the levels a trend needs (cash on hand, money owed,
--             dead stock, margin...). One a day at most, written from
--             the owner's session after the books load. A level such as
--             dead stock has no history anywhere else: once the day has
--             passed it cannot be worked out again, so "up 4 this week"
--             can only ever be read from rows like these. Until seven
--             days of them exist the screen says the trend is not known
--             yet, rather than inventing one.
--   decision  a choice the owner signed in the Simulator. A RECORD,
--             never an instruction: signing pays nothing, sends nothing
--             and moves no stock. Kept apart from the Manager's own
--             'move' rows on purpose -- a decision the owner made is not
--             advice the Manager gave, and counting it as advice would
--             flatter the Manager's track record with the owner's work.
--   normal    something the owner taught about an ordinary day ("the
--             first Saturday of the month is always busy"), so a day
--             like it stops being flagged as out of the ordinary.
--   offer     a bank's or a supplier's offer the owner wrote down --
--             amount, rate, term, the day it expires. Nothing in the
--             books holds one, and a loan the shop has not taken cannot
--             be read off the loans table.
--
-- One snapshot per shop per day, held by the database and not only by
-- the app: two devices opening the books on the same morning would
-- otherwise both write one, and a doubled day would read as a flat
-- trend. The app treats the refusal as "already written today".
alter table manager_notes drop constraint if exists manager_notes_kind_check;
alter table manager_notes add constraint manager_notes_kind_check
  check (kind in ('meeting', 'move', 'review', 'question', 'target', 'play',
                  'snapshot', 'decision', 'normal', 'offer'));

create unique index if not exists manager_notes_snapshot_day_idx
  on manager_notes(shop_id, date) where kind = 'snapshot';

-- suppliers, two more terms. What only the owner knows about a
-- supplier, each in days, each nullable:
--
--   stop_at_days   the age a bill reaches before the supplier stops
--                  delivering ("Steel & Tube stop at 90 days")
--   delivery_days  the days they say a delivery takes
--
-- The days of credit they give are NOT added here: 0106 already keeps
-- them as suppliers.terms_days ("days they give you to pay"), and the
-- Manager reads and writes that one column. Two columns for one fact
-- would drift apart the first time only one of them was edited.
--
-- NULL means NOBODY HAS SAID, which is not 0: a supplier who stops at 0
-- days stops at once. Older rows are not back-filled -- a supplier
-- nobody has asked about reads "not known", which is the truth. The
-- Manager reads a deadline off a bill only where the owner wrote one
-- down; an invented supplier term would be a date on the cash line
-- nobody ever agreed to.
--
-- The app probes for these before writing them (as it does for 0096,
-- 0106 and 0107): a supplier row goes up on every save, and a column the
-- database does not have yet would fail the whole upsert -- the shop
-- would stop saving its suppliers rather than merely lose the terms.
--
-- The check is named for its own two columns. NOT suppliers_terms_days_check:
-- that is the name Postgres gave 0106's inline check on terms_days, and
-- dropping it "if exists" here would silently remove 0106's 0..365 bound.
alter table public.suppliers
  add column if not exists stop_at_days integer,
  add column if not exists delivery_days integer;

alter table public.suppliers drop constraint if exists suppliers_stop_delivery_days_check;
alter table public.suppliers add constraint suppliers_stop_delivery_days_check
  check ((stop_at_days is null or stop_at_days >= 0)
     and (delivery_days is null or delivery_days >= 0));

comment on column public.suppliers.stop_at_days is
  'The age in days a bill reaches before this supplier stops delivering, as the owner was told. Null when nobody has said -- never 0, which would mean they stop at once.';
comment on column public.suppliers.delivery_days is
  'Days this supplier says a delivery takes. The measured lead time comes from deliveries; this is their word. Null when nobody has said.';

-- Rollback, in one paste. The kinds first, and only once no row of the
-- four exists -- a check that excludes a kind the table holds cannot be
-- added, and deleting the rows deletes the shop's history with them.
-- The supplier columns after, only if nothing written since should be
-- kept: what they hold is lost with them.
-- drop index if exists manager_notes_snapshot_day_idx;
-- delete from manager_notes where kind in ('snapshot', 'decision', 'normal', 'offer');
-- alter table manager_notes drop constraint if exists manager_notes_kind_check;
-- alter table manager_notes add constraint manager_notes_kind_check
--   check (kind in ('meeting', 'move', 'review', 'question', 'target', 'play'));
-- alter table public.suppliers drop constraint if exists suppliers_stop_delivery_days_check;
-- alter table public.suppliers drop column if exists stop_at_days,
--   drop column if exists delivery_days;
