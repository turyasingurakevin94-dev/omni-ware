-- One person who is both a client and a supplier.
--
-- A hardware shop in a town this size buys from people it also sells to:
-- the fundi who takes cement on credit and sells you hinges, the
-- neighbouring shop you trade stock with both ways. Until now that person
-- had to be entered twice, once in each list, and the two records never
-- met -- what they owed the shop sat in Debtors while what the shop owed
-- them sat in Creditors, and nobody could see that the two largely
-- cancelled.
--
-- A LINK, not a merge. Quotes reference a customer id and purchase
-- invoices reference a supplier id; folding the two records into one
-- would rewrite both halves of the books to fix a display problem. Each
-- side keeps its own record, its own id and its own history, and simply
-- knows who the other one is.
--
-- on delete set null, so deleting one side leaves the other a normal
-- standalone record rather than a dangling pointer.
alter table customers add column if not exists linked_supplier_id text;
alter table suppliers add column if not exists linked_customer_id text;

alter table customers drop constraint if exists customers_linked_supplier_fk;
alter table customers add constraint customers_linked_supplier_fk
  foreign key (shop_id, linked_supplier_id) references suppliers(shop_id, id)
  on delete set null;

alter table suppliers drop constraint if exists suppliers_linked_customer_fk;
alter table suppliers add constraint suppliers_linked_customer_fk
  foreign key (shop_id, linked_customer_id) references customers(shop_id, id)
  on delete set null;

-- One counterpart each way. Without this two customers could both claim
-- the same supplier, and the net position would be computed twice
-- against one balance.
create unique index if not exists customers_linked_supplier_uniq
  on customers(shop_id, linked_supplier_id) where linked_supplier_id is not null;
create unique index if not exists suppliers_linked_customer_uniq
  on suppliers(shop_id, linked_customer_id) where linked_customer_id is not null;
