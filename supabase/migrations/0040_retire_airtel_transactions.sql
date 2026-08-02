-- Drops airtel_transactions, the ledger for the retired second Airtel path.
--
-- There were two Airtel implementations. The agent app has only ever called
-- agent-initiate-momo-payment, which records to agent_mobile_payments and is
-- what actually collects money for both providers. The other pair --
-- airtel-collection-initiate and airtel-collection-callback, on this table --
-- had no caller at all, but stayed deployed and reachable by any signed-in
-- agent, and carried the client-supplied-amount, no-duplicate-guard and
-- unnormalised-msisdn bugs that its twin had already been fixed for. Both
-- functions have been deleted from the project; this removes their table.
--
-- The table's own history is kept above it: 0023 created it, and 0029 and
-- 0033 both null its quote_id when clearing agent records. Those run before
-- this one, so a replay from scratch is unaffected.
--
-- GUARDED. If this table holds rows, they are payment records -- a
-- reference, an msisdn, an amount and a status against a real order -- and
-- dropping them destroys financial history that exists nowhere else. This
-- refuses rather than deciding that for you. If the rows are known to be
-- test data, or you have exported them, drop the table by hand:
--
--   drop table if exists airtel_transactions;
--
do $$
declare
  n bigint;
begin
  if to_regclass('public.airtel_transactions') is null then
    raise notice 'airtel_transactions is already gone -- nothing to do.';
    return;
  end if;

  execute 'select count(*) from public.airtel_transactions' into n;

  if n > 0 then
    raise exception using
      message = format('airtel_transactions still holds %s row(s) -- not dropping.', n),
      detail  = 'These are payment records from the retired Airtel path. Export or review them first, then drop the table by hand.',
      hint    = 'select * from airtel_transactions order by created_at desc;';
  end if;

  drop table public.airtel_transactions;
  raise notice 'airtel_transactions was empty and has been dropped.';
end $$;
