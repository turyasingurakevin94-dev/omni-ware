-- Loans that are not repaid monthly, and fees that are not one-off.
--
-- Verified against a real Spiro bike loan (UMA977GM): 3,310,000 over 52
-- WEEKLY payments of 88,149, where each payment is 75,149 of principal
-- and interest plus a fixed 13,000 charge -- 676,000 of fees over the
-- year, more than the 597,744 of interest. The app could hold neither
-- fact: its schedule walked calendar months, and its only fee was a
-- one-off deduction from the money handed over.
--
-- fee_per_instalment is ADDED to every payment, which is the opposite of
-- `fees` (kept back from the proceeds, so you receive less). Both are
-- real and a loan can carry both, so they are separate columns rather
-- than one number that would have to mean two things.
alter table loans add column if not exists frequency text not null default 'monthly';
alter table loans drop constraint if exists loans_frequency_check;
alter table loans add constraint loans_frequency_check
  check (frequency in ('weekly', 'fortnightly', 'monthly'));

alter table loans add column if not exists fee_per_instalment numeric not null default 0;

-- term_months keeps its historical name but now counts INSTALMENTS, which
-- for a monthly loan is the same number it always was. Every loan on file
-- predates this and is monthly, so no backfill is needed.
comment on column loans.term_months is
  'Number of instalments. Equals months only when frequency is monthly.';
