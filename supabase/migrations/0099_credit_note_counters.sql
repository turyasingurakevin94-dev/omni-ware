-- Credit notes (CN-) against sales invoices, and supplier credits (SC-)
-- against bills.
--
-- Neither is a table of its own: a credit note rides inside the payload of
-- the invoice it is raised against, and a supplier credit inside its bill's,
-- the same way charges and payments already do. So there is nothing to
-- create and no policy to add -- write-boundary stays exactly as it is.
--
-- What they DO need is a number. CN- and SC- go on paper handed to customers
-- and suppliers, so they are dense, fetched one at a time through
-- next_row_id_blocks like INV- and PINV-, and each kind needs its counter
-- seeded here: a kind no migration seeds starts from nothing on a restored
-- database. Nothing has been issued yet, so every shop starts at 0.
insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:credit_note', 0 from shops
on conflict (shop_id, kind) do nothing;

insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:supplier_credit', 0 from shops
on conflict (shop_id, kind) do nothing;
