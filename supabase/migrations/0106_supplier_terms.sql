-- How many days a supplier gives the shop to pay a bill. With it a bill
-- has a due date -- its date plus the terms -- and the Suppliers screen
-- can say "9 days overdue" or "due 17 Oct" as the design draws it,
-- rather than only how long the bill has waited.
--
-- NULL means nobody has said, and the screen keeps showing the bill's
-- age; it never assumes a term the shop did not record.
--
-- The app probes for the column before writing it (as it does for 0096
-- and 0105), so suppliers keep saving in the window between the code
-- deploying and this being applied by hand.
alter table public.suppliers
  add column if not exists terms_days integer
    check (terms_days is null or terms_days between 0 and 365);
