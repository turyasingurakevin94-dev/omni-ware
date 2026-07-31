-- airtel_transactions has no agent_id column -- ownership is only
-- knowable by joining through quote_id to the order's own
-- originAgentId, same check "agents manage their own orders" (0012)
-- already uses directly on saved_quotes. Without this, an agent has no
-- way to ever see a failed collection attempt: agentPaymentStatus only
-- ever moves unpaid -> paid (airtel-collection-callback leaves it alone
-- on failure), so polling the order alone makes a real failure look
-- indistinguishable from "still pending" forever.
--
-- Select-only, and it doesn't add anything not already knowable by
-- reading the same agent's own order -- reference/status/amount for a
-- collection attempt they themselves initiated.
create policy "agent views own airtel transactions" on airtel_transactions
  for select using (
    exists (
      select 1 from saved_quotes q
      where q.id = airtel_transactions.quote_id
        and q.shop_id = airtel_transactions.shop_id
        and q.payload->>'originAgentId' = current_agent_id(airtel_transactions.shop_id)
    )
  );
