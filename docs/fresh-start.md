# A fresh start

The books the apps were built on drifted from the real shop while the apps
were being tested on them. This is how the shop starts afresh **without
losing anything that was right**: a new shop is made beside the old one,
the reference data is copied across to be checked, and every balance is
measured again rather than trusted.

The old shop is never deleted. It stays readable from the shop picker, for
the owner and admins, as the record of everything before the switch.

Migration `0146_fresh_start.sql` holds the two steps. Both are run by the
operator in the Supabase **SQL editor**; no app can call them.

## What happens to each kind of data

| | What | Where it ends up |
|---|---|---|
| **Copied** | products, prices (with their old dates), item links, the names customers use, the photo library | new shop, to be checked |
| | suppliers, customers (contacts, credit limits, terms) | new shop, to be checked |
| | staff, agents, agents' clients, goals and settings | new shop |
| | settings: categories, units, markups, credit and price policies, letterhead, switched-off tasks, mobile money keys | new shop |
| | places and roads, rent still running, assets still owned, rivals' prices, id counters | new shop |
| **Measured again** | what each customer owes | starts at 0; the Manager enters each once the customer agrees it |
| | what the shop owes each supplier | starts at 0, entered from their statement |
| | stock | starts at 0, counted in the Store app |
| | cash, bank and mobile money | counted and read from statements |
| | loans | entered with what is still owed |
| **Left in the old shop** | every order, invoice, payment, cash line, bill, stock movement, count, decision, chat and log | old shop (archive) |
| **Moved on switch day** | team logins, agent logins, agents' public catalogues, WhatsApp numbers | new shop |

**Not carried across, to set up again if still wanted:** customers' and
suppliers' portal logins (each gets a new PIN in the new shop), Sourcing's
open hunts, agents' promotions and pinned items, and supplier commissions.
They stay readable in the old shop.

Photos are shared, not copied: both shops show the same files from the old
shop's storage folder. Deleting a photo from the new shop's library removes
only the library entry; the file stays for the old shop.

## Before switch day

1. **Back up.** `npm run backup` (every table, as JSON), and Export backup
   from the console's Backup menu. Keep a copy off the computer.
2. **Practise on staging**, never on a copy of live data
   (docs/environments.md, Part 1 step 8, makes a staging shop). Run every
   step below there first.
3. **Put 0146 on the live project:** paste
   `supabase/migrations/0146_fresh_start.sql` into the SQL editor and run it.
   It only adds the two functions; nothing changes until they are called.
4. **Find the old shop's id:**

   ```sql
   select id, name, created_at from shops order by created_at;
   ```

5. **Close what is open in the old shop:** finish or cancel orders that are
   not yet invoiced. Ask each supplier for a statement of what you owe them.
6. **Look first (dry run).** This does the whole copy, reports it, and
   undoes it:

   ```sql
   select * from ow_fresh_start('<old shop id>', 'Mukasa Hardware');
   ```

   The rows marked **LEFT** are your checklist: who owed what in the old
   books, how many supplier bills, stock lines, open loans and team logins.

## Switch day, before the shop opens

1. **Make the new shop:**

   ```sql
   select * from ow_fresh_start('<old shop id>', 'Mukasa Hardware', true);
   ```

   The first row is the new shop's id. Keep it. From here the owner sees
   **two shops** in every app; the newest is marked and listed first. The
   team still opens the old one.

2. **Count the stock** in the Store app, aisle by aisle, in the **new**
   shop. The Manager accepts each count. Whatever is counted is the new
   stock, valued at the copied price list.
3. **Count the cash**, read the bank and mobile money statements, and set
   the day's opening in Accounts.
4. **Move the team.** Look, then do it:

   ```sql
   select * from ow_fresh_start_move('<old shop id>', '<new shop id>');
   select * from ow_fresh_start_move('<old shop id>', '<new shop id>', true);
   ```

   Every login that is not an owner's or an admin's now opens the new shop
   and no longer the old one. Agents' logins, their catalogues and the
   WhatsApp numbers move too. It is safe to run twice.

5. **Rename the old shop**, so nobody mistakes it in the picker:

   ```sql
   update shops set name = 'Mukasa Hardware (old books)' where id = '<old shop id>';
   ```

## The first week

- **Customers:** the Manager app's **To collect** shows *Old books ·
  balances to confirm*, with how many are done. The Manager rings each
  customer, enters what they agree (or *Owes nothing*) and when it was owed
  from, if known. The old books' figure sits beside it for reference, and
  each one goes in the owner's log next to that figure. A balance can be
  changed until the customer trades in the new shop; after that it is
  locked.
- **Suppliers:** enter each statement as an opening balance ("Opening
  balance — owed before this system").
- **Prices:** they kept their dates, so Sourcing's daily share confirms the
  oldest first.
- **Loans:** enter each with what is still owed.
- **Assets and rent:** check each copied asset is still here and each lease
  still runs.

## If something goes wrong

- **Before the move:** delete the new shop and start again. Nothing in the
  old shop was touched.

  ```sql
  delete from shops where id = '<new shop id>';
  ```

- **After the move:** the old shop is still whole; only logins moved. Do not
  delete the new shop once the team has worked in it. Ask for the logins to
  be moved back instead.
