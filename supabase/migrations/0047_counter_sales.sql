-- Selling over the counter.
--
-- A walk-in sale was recorded as a cash receipt under "Sales Revenue"
-- and that was the entire record of it. Nothing else happened: no
-- invoice, so no revenue and no cost of sales; and no stock movement, so
-- the goods stayed on the shelf in the app's eyes for ever.
--
-- The damage was not only to the statements, though that is where it
-- showed. A shop trading over the counter reported revenue of zero and a
-- loss equal to its whole running costs every month, while its inventory
-- grew by every item it had ever sold.
--
-- A counter sale now writes a real sale -- a completed, invoiced quote
-- whose lines come off our own shelf -- alongside the cash receipt. This
-- column is the link between the two.
--
-- WHY THE LINK IS NEEDED. Both halves are true and both must stay:
-- the receipt is cash the shop took, and belongs in the cash flow; the
-- invoice is a sale the shop made, and belongs in the profit and loss.
-- Without a link between them the statements cannot tell a counter sale
-- that WAS invoiced from takings that were never invoiced at all, and
-- the basis-gap warning would fire on exactly the sales that had just
-- been recorded properly -- training the shop to ignore the one warning
-- worth reading.
--
-- Nullable, and null is the ordinary case: every cash receipt that is
-- not a counter sale has no quote behind it. No foreign key, following
-- cash_txns' existing rule -- it is an audit trail, and a receipt has to
-- survive the deletion of anything it points at.
alter table cash_txns
  add column quote_id bigint;

comment on column cash_txns.quote_id is
  'The counter sale this receipt was taken for, when the till recorded one. Null for every other receipt, including a payment settling an existing invoice -- that arrives as Debt Collection and is counted separately.';

create index cash_txns_quote_idx on cash_txns(shop_id, quote_id)
  where quote_id is not null;
