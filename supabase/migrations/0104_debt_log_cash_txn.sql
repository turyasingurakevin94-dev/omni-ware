-- The receipt a ledger payment's money arrived on.
--
-- A payment written on a customer's ledger (not against an invoice -- a
-- payment on an opening balance, say) records the cash receipt it came
-- in on, and the app reads that link to know the payment was MONEY: the
-- morning brief's "who paid today", the Manager's reading of who pays,
-- and the Method column of the statement of account all ask for it. The
-- link was only ever kept in memory, so every load dropped it and every
-- such payment fell silently out of all three.
--
-- Nullable: charges carry no receipt, and nor do the drift repair's
-- correction rows, whose own wording says no money moved. No foreign key,
-- as with every other cash_txn_id in the schema: a cash entry deleted on
-- its own leaves the ledger row standing, and the app treats a link to a
-- missing entry as no link.
--
-- The app probes for this column before sending it, as it does
-- covers_from (0095): every debt-log row goes up on every save, and a
-- column the migration has not landed would otherwise fail the whole
-- upsert and the shop would silently stop saving its ledgers. Rows
-- written before this lands are linked again on load, by the day, the
-- customer's name and the amount, and the next save writes the link.
alter table customer_debt_log add column if not exists cash_txn_id bigint;

comment on column customer_debt_log.cash_txn_id is
  'The cash_txns entry a payment''s money arrived on. Null for a charge, a correction, or a payment with no receipt on record.';
