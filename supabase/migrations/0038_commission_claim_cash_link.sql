-- Links a paid commission claim to the Cash Book entry that paid it.
--
-- markClaimPaid() flipped status to 'paid' and wrote nothing else. The
-- bonus is real money the shop owes the agent -- supplier-funded, but paid
-- out of the shop's own till -- so every claim settled so far left the
-- business with cash gone and no entry anywhere to account for it. The
-- Cash Book, the day's closing balance and every profit figure derived
-- from them were all overstated by exactly the amount handed over.
--
-- Same omission, and the same fix, as agentPrepayConfirm in 2b2f652: money
-- moving must leave a record, and the record must be traceable back to what
-- caused it so it can be found and reversed.
alter table agent_commission_claims
  add column cash_txn_id bigint;

-- Deliberately not a foreign key to cash_txns. That table is client-owned:
-- the admin app diffs it wholesale and can delete rows, and a hard
-- reference would make removing a Cash Book entry fail against a claim
-- nobody remembers. The link is for tracing, so a dangling id is a
-- tolerable outcome and a blocked deletion is not -- the same reasoning
-- payments[].cashTxnId already follows inside saved_quotes.payload.
comment on column agent_commission_claims.cash_txn_id is
  'cash_txns.id of the payment that settled this claim; not an FK, see 0038';
