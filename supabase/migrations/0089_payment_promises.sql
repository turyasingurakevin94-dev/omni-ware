-- When a customer said they would pay.
--
-- The chase message this app writes ends "Please let us know when we
-- can expect payment" -- and until now there was nowhere to write down
-- the answer. Three things followed from that hole. The chase queue
-- rang again three days later whatever the customer had said. The cash
-- forecast had only outgoings on its line, because a debtor's money
-- carried an age and never a date. And a broken promise left no trace
-- at all, which is the one thing about promises worth keeping: the
-- second time somebody breaks one, that is a fact about the customer.
--
-- A LEDGER, NOT A STAMP. A customer who promises Friday, misses it, and
-- promises next Tuesday is telling you something a single field per
-- customer cannot hold. 0077 made the same argument for client contact
-- and it holds harder here, because the whole value is in the pattern.
--
-- AN OBSERVATION, NOT A PLAN. Somebody said a thing on a day. The row
-- is never rewritten -- a changed mind is a SECOND promise, and that is
-- exactly the record worth having. It can be deleted, because a promise
-- entered against the wrong customer was never a promise at all.
--
-- NOTHING HERE IS A STATE. Whether a promise was kept is derived from
-- the debt ledger every time it is read, never stamped: a stored
-- "kept" and a ledger that disagrees with it is the drift this app has
-- already had to write a repair banner for once.
--
-- No FK to customers deliberately, the same reasoning as stock_log and
-- rival_prices: deleting a customer should not silently erase what they
-- promised, and the row simply stops resolving and drops out of every
-- reading. amount null means "the balance" -- most people do not name a
-- figure, and writing the balance in at the time would freeze a number
-- that moves.

create table payment_promises (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint not null,
  customer_id text not null,
  promised_on date not null,
  made_on date not null,
  amount numeric check (amount is null or amount > 0),
  note text,
  created_at timestamptz not null default now(),
  primary key (shop_id, id)
);

-- Every read is "what has this customer promised", newest first.
create index payment_promises_customer_idx
  on payment_promises (shop_id, customer_id, promised_on desc);

alter table payment_promises enable row level security;

create policy "shop members full access" on payment_promises
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- The same three restrictions every other books table carries: members
-- read and write, only the owner deletes (0058), and only the owner
-- writes or amends (0083). A promise decides whether a customer is
-- chased and what the forecast shows, so an account that cannot change
-- a debt must not be able to change the expectation of one either.
create policy "owner only deletes" on payment_promises
  as restrictive for delete using (is_shop_owner(shop_id));
create policy "owner writes only" on payment_promises
  as restrictive for insert with check (is_shop_admin(shop_id));
create policy "owner updates only" on payment_promises
  as restrictive for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

-- The id counter these rows are issued from, same block scheme as 0034
-- and seeded the way 0077 seeds its own.
insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:payment_promise', 0 from shops
on conflict (shop_id, kind) do nothing;

-- Look first: what is already on file, if this ran once before.
-- select customer_id, count(*) as promises, max(promised_on) as latest
--   from payment_promises group by 1 order by 3 desc;
