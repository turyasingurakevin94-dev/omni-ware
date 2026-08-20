-- Paying somebody by the week.
--
-- Asked for plainly: "add a weekly rate, because we have some workers we
-- pay every after two weeks." There were two bases, monthly and daily,
-- and neither fits. A monthly salary is not what was agreed with these
-- workers, and a daily rate leaves the month uncosted until somebody
-- counts the days -- which is exactly the counting a weekly rate exists
-- to avoid.
--
-- THE RATE IS ONE WEEK. The shop hands over two weeks at a time, but the
-- rate agreed with the worker is a week, and the payment cadence is not
-- the same fact as the rate. Keeping them apart is what lets the app say
-- both "a week is 60,000" and "a fortnight is about 120,000" without
-- either being a guess.
--
-- SIX DAYS TO THE WEEK, AND SO 26 TO THE MONTH. The two constants are
-- one fact stated twice: the month has been 26 working days since 0078,
-- which is a six-day week, so a weekly rate becomes a monthly one by
-- 26 / 6. A worker on 60,000 a week is on 10,000 a day and 260,000 a
-- month, and a missed day costs them 10,000. Nothing here invents a
-- second opinion about how long a month is.
--
-- WHY NO FORTNIGHTLY DUE. A due is one month of one commitment, unique
-- on (shop, kind, ref, period) with period a YYYY-MM. Splitting weekly
-- workers into fortnightly dues would break that key and, with it, the
-- balance-sheet liability, the overdue reminders and the month
-- navigation on both the payroll screen and the attendance calendar --
-- for no gain, because a fortnightly hand-over is already expressible as
-- two payments against the month, which the payments array has carried
-- since 0046. The month stays the unit; the fortnight is a figure the
-- screen works out and offers.
--
-- This migration is the gate. The client can write pay_basis = 'weekly'
-- the moment it ships, and without this the CHECK from 0046 rejects the
-- row -- so the staff record would save locally and be refused on sync,
-- which is the worst of both.

alter table staff
  drop constraint if exists staff_pay_basis_check;

alter table staff
  add constraint staff_pay_basis_check
    check (pay_basis is null or pay_basis in ('monthly', 'weekly', 'daily'));

comment on column staff.pay_basis is
  'monthly = pay_rate is a month''s wage; weekly = pay_rate is one week''s wage, and a week is 6 working days, so the month is pay_rate / 6 * 26; daily = pay_rate is one day''s wage and days worked are entered per month; null = no rate set, which is not the same as a rate of zero.

Monthly and weekly are both KNOWN the moment the month exists, so their dues are raised costed and days missed are deducted from them. Daily is not: it cannot be costed until somebody counts the days, and its absences are recorded but never deducted, because the days not worked were never in the figure to begin with.';
