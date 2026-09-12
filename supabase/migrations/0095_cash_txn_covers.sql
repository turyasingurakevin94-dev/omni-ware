-- The days a running cost pays for.
--
-- A year's insurance, a trading licence, a quarter's rent paid straight
-- into the cash book: one payment, many months of cover. The profit and
-- loss used to count it whole on the day it was paid, so the month of
-- paying looked terrible and the months it actually covered looked
-- better than they were -- the same shape a van made before the asset
-- register existed.
--
-- Two dates on the entry, both inclusive, and nothing else. Everything
-- the statements do with them is arithmetic on the entry and a date:
-- the profit and loss charges each period its share of the days, the
-- balance sheet carries the days paid for and not yet reached as paid
-- in advance, and the cash book is untouched -- money left on the day
-- it left.
--
-- Nullable, because almost every cash entry is a cost of the day it was
-- paid and stays so. The app probes for these columns before sending
-- them, as it does transfer_id (0076): every cash entry goes up on every
-- save, and a column the migration has not landed would otherwise fail
-- the whole upsert and the shop would silently stop recording money.
alter table cash_txns add column if not exists covers_from date;
alter table cash_txns add column if not exists covers_to date;

comment on column cash_txns.covers_from is
  'First day this payment pays for, when it covers a stretch of days (a licence, insurance, several months'' rent). Null for an ordinary entry, which is a cost of the day it was paid.';
comment on column cash_txns.covers_to is
  'Last day this payment pays for, inclusive. Set together with covers_from or not at all.';
