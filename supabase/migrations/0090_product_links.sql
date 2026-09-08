-- What goes with what, in the shop's own words.
--
-- The app can already see WHAT lands on the same invoice; it has never
-- known WHY, and it cannot tell a rule from a coincidence. Cement and
-- nails turn up together because a site building walls buys both. Cement
-- and a wheelbarrow turn up together because somebody happened to need a
-- wheelbarrow. Only the person at the counter knows which is which, and
-- until now there was nowhere for them to write it down.
--
-- A PAIRING IS A SENTENCE, and the columns are its parts: from_id, verb,
-- to_id, and optionally a ratio -- qty per unit. "Iron sheets NEEDS
-- roofing nails, 8 per sheet." That ratio is the whole value: without it
-- a recommendation can only name a thing, and with it the app can say
-- 140 sheets means about 1,120 nails, which is what a hardware man would
-- say and what an advert never says.
--
-- FIVE VERBS AND NO SIXTH. needs / with / instead / after / part. The
-- list is closed on purpose: every verb changes what a customer brief is
-- allowed to say, so a free-text verb would be a rule nothing can read.
--
-- to_id IS NOT A FOREIGN KEY, and deliberately. A shop pairs cement with
-- sand it does not sell, and that pairing is still true at the counter --
-- it simply never reaches a brief, because a brief cannot offer what the
-- shelf has not got. Same reasoning as stock_log and rival_prices:
-- deleting a product should not erase what the shop knows about it, and
-- the row simply stops resolving.
--
-- NOTHING HERE IS DERIVED. What the orders say about a pairing is worked
-- out at read time, every time, from the invoices -- never stamped onto
-- the row. A stored "the books agree" and a ledger that has since moved
-- on is the drift this app has already had to write a repair banner for.
--
-- SAFE TO RUN TWICE, per 0089: these are pasted by hand into a database
-- whose real state is whatever somebody pasted before.

create table if not exists product_links (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint not null,
  from_id text not null,
  verb text not null check (verb in ('needs','with','instead','after','part')),
  to_id text not null,
  -- Null means "no figure given", which a brief renders as a name and no
  -- number. Zero would be a quantity, and a wrong one.
  qty numeric check (qty is null or qty > 0),
  per text,
  note text,
  -- Turned off rather than deleted: a pairing somebody stopped using is
  -- a decision worth keeping, and deleting it invites writing it again.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (shop_id, id)
);

-- Every read is "what goes with this product", both directions.
create index if not exists product_links_from_idx on product_links (shop_id, from_id);
create index if not exists product_links_to_idx   on product_links (shop_id, to_id);

alter table product_links enable row level security;

drop policy if exists "shop members full access" on product_links;
create policy "shop members full access" on product_links
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- The same three restrictions the books tables carry (0058, 0083). A
-- pairing decides what the shop tells its customers, so an account that
-- cannot change a price must not be able to change that either.
drop policy if exists "owner only deletes" on product_links;
create policy "owner only deletes" on product_links
  as restrictive for delete using (is_shop_owner(shop_id));
drop policy if exists "owner writes only" on product_links;
create policy "owner writes only" on product_links
  as restrictive for insert with check (is_shop_admin(shop_id));
drop policy if exists "owner updates only" on product_links;
create policy "owner updates only" on product_links
  as restrictive for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

insert into entity_id_counters (shop_id, kind, last_issued)
select id, 'row:product_link', 0 from shops
on conflict (shop_id, kind) do nothing;

-- Look first, if this ran once before:
-- select verb, count(*) from product_links group by 1 order by 2 desc;
-- And that the guards landed -- rls true, four policies:
-- select c.relrowsecurity as rls_on,
--        (select count(*) from pg_policies where tablename = 'product_links') as policies
--   from pg_class c where c.relname = 'product_links';
