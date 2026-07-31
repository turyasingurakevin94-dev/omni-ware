-- A supplier-level commission rate (e.g. 3%), set once and reused to
-- auto-fill the amount when recording a period's commission, and to gate
-- the "missing commission" flag to only suppliers actually expected to
-- pay one. Null means "no agreed rate" -- unrelated to an explicit 0%.
alter table suppliers add column commission_pct numeric;
