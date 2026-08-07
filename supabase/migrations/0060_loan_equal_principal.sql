-- A third way lenders actually charge, and the rounding they do it with.
--
-- Verified against a real Lyamujungu SACCO schedule (20,000,000 over 12
-- months at 24%): they call it "declining", and the interest IS on the
-- outstanding balance -- but the PRINCIPAL is a flat 1/n each month, so
-- the installment falls (2,066,700 down to 1,699,600) instead of staying
-- level. Modelling that as an annuity overstated the balance from month
-- one and the total interest by 94,303.
--
-- round_to: the same sheet rounds every figure to the nearest 100, which
-- is what makes it close at exactly 0.00. Kept as a number rather than a
-- flag so a lender who rounds to 1,000 -- or not at all, the default --
-- is describable without another column.
alter table loans drop constraint if exists loans_method_check;
alter table loans add constraint loans_method_check
  check (method in ('reducing_balance', 'equal_principal', 'flat'));

alter table loans add column if not exists round_to numeric not null default 0;
