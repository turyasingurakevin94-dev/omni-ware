-- Lets a staff member be flagged unavailable without deleting them --
-- excluded from the assignment picker on the Order Tracking board until
-- marked available again.

alter table staff
  add column unavailable boolean not null default false;
