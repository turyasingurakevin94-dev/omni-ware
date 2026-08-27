-- Whose goods are on the shelf.
--
-- Consignment is a supplier leaving goods to be sold and paid for as
-- they sell. The shop holds them, can sell them, and owes nothing until
-- one goes -- at which point part of the money in the drawer belongs to
-- whoever left them. That is the figure the Consignment screen exists
-- to keep in front of the owner.
--
-- A LOT IS A DELIVERY, so it is the right place for this. A delivery is
-- either bought or consigned, never half of each, and every reading
-- downstream falls out of it: a sale already records which lots it
-- consumed and at what cost, so what is owed is a reading of sales that
-- have happened rather than a second ledger to keep in step.
--
-- THIS COLUMN IS THE WHOLE FEATURE. It shipped without it. The client
-- marked the lot, the screen showed it, the save dropped the mark on the
-- floor -- stock_lots carried key, qty and cost and nothing else -- and
-- the next load brought the goods back as the shop's own. A shop that
-- had received goods on consignment and sold some of them saw an empty
-- screen and no bill, which is the worst possible pair: nothing recorded
-- and nothing to notice.
--
-- The client probes for this column before writing it, the way it probes
-- for every hand-applied migration, because stock lots are a BUSY write:
-- every sale rewrites the key it touched, and PostgREST rejects a whole
-- insert for one unknown column. Sending it before this landed would
-- have stopped the shop saving stock lots at all -- silently, and while
-- looking perfectly well.
--
-- Null means the goods are the shop's own, which is nearly all of them.

alter table stock_lots
  add column if not exists consign text;

comment on column stock_lots.consign is
  'The supplier who still owns these units: goods held on consignment, to be paid for as they sell. Null = the shop bought them and they are its own.

Not a foreign key to suppliers, deliberately, and for the same reason the key column is not one to stock: lots sync ahead of other collections in the diffing layer, and a lot arriving before its supplier row must not be rejected. A consignor that has been deleted reads as an unknown supplier on screen rather than taking the row down with it.';
