-- The both-sides link, held in ONE place instead of two.
--
-- 0063 stored the link twice -- customers.linked_supplier_id pointing at
-- a supplier, suppliers.linked_customer_id pointing back -- with a
-- foreign key on each. That is a CYCLE, and saveData() writes every
-- table concurrently (Promise.all, one transaction per request), so
-- whichever row landed first referenced a row the other request had not
-- written yet. It failed in production the first time a real customer
-- was linked:
--
--   insert or update on table "suppliers" violates foreign key
--   constraint "suppliers_linked_customer_fk"
--
-- No ordering fixes a genuine cycle -- link a new customer to a new
-- supplier and each row needs the other to exist first. So the second
-- copy goes: the customer holds the link, and the supplier side is
-- derived by asking which customer points at it. One field, so the two
-- halves cannot disagree and there is nothing to write out of order.
--
-- The remaining foreign key goes too, for the same reason in one
-- direction: the supplier form can create a supplier AND link it in the
-- same save, so customers could still reference a supplier row written
-- by a concurrent request. The client already treats a link to a missing
-- record as no link (find -> undefined -> null), and deleting a supplier
-- now clears it there, which is where every other cross-record cleanup
-- in this app already lives.
alter table customers drop constraint if exists customers_linked_supplier_fk;
alter table suppliers drop constraint if exists suppliers_linked_customer_fk;

drop index if exists suppliers_linked_customer_uniq;
alter table suppliers drop column if exists linked_customer_id;

-- Kept: this one is within a single table, so it is enforceable without
-- a cycle, and it is the guarantee that matters -- two customers
-- claiming one supplier would net that balance twice.
create unique index if not exists customers_linked_supplier_uniq
  on customers(shop_id, linked_supplier_id) where linked_supplier_id is not null;
