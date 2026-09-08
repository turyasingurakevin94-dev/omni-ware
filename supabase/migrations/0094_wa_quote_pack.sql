-- The quote pack: one list of everything the shop can be asked about.
--
-- THE FORK THIS CLOSES. Two matchers have been running against two
-- different sets of products and calling themselves mirrors of each
-- other. The browser matched against every product with a retail price
-- -- hundreds of them. The webhook matched against the Meta catalog,
-- which takes only products with a photo AND a price, so it was a few
-- dozen. A customer who asked at 22:00 about something photoless got
-- silence; the same question at 09:00, with the owner reading, got a
-- price. Same shop, same product, same words, two answers, and nothing
-- on any screen said why.
--
-- Meta's photo rule is Meta's, and it stays -- their catalog is a
-- storefront and a storefront needs pictures. But a TEXT REPLY needs no
-- photo, and refusing to say a price because there is no photograph of
-- the thing is a rule nobody chose. So the browsable catalogue and the
-- answerable list are now two different lists, which is what they
-- always were.
--
-- THE CLIENT COMPUTES, THE SERVER CARRIES. Same division as
-- catalog-sync, and for the same reason: the pricing chain -- purchase
-- rows, ranked at quantity, through the shop's own markup rules -- lives
-- in the browser, and the printed catalogue is the proof it is right.
-- The server cannot re-derive a price and must never try. It reads this
-- row and quotes what it says.
--
-- WHICH MAKES THIS A SNAPSHOT, and a snapshot can go stale. Three
-- things hold it honest: the browser republishes whenever the WhatsApp
-- screen is opened and the contents have changed (the fingerprint says
-- whether they have, so an unchanged pack costs one read and no write);
-- built_at is stored so the screen can say how old it is; and the
-- webhook refuses to quote from a pack past WA_PACK_STALE_DAYS, falling
-- silent rather than saying a price the books have moved on from.
--
-- ONE ROW PER SHOP, and the items ride as jsonb rather than as a table
-- of their own. The matcher scores every candidate on every message --
-- it needs the whole list or none of it -- so a row per product would
-- be a table that is only ever read whole.
--
-- SAFE TO RUN TWICE, per 0089: pasted by hand into a database whose
-- real state is whatever somebody pasted before.

create table if not exists wa_quote_pack (
  shop_id uuid not null references shops(id) on delete cascade,
  -- What the browser last published, in the shape the matcher reads:
  -- [{ key, name, tokens[], price, unit, breaks[], aliases[], companion }]
  items jsonb not null default '[]'::jsonb,
  -- Denormalised on purpose: the screen shows the count without
  -- pulling a hundred kilobytes of items back to say a number.
  item_count integer not null default 0,
  -- A hash of the items. The browser compares before it writes, so
  -- opening the screen twice is one read, not two uploads.
  fingerprint text not null default '',
  built_at timestamptz not null default now(),
  primary key (shop_id)
);

alter table wa_quote_pack enable row level security;

drop policy if exists "shop members full access" on wa_quote_pack;
create policy "shop members full access" on wa_quote_pack
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- The same three restrictions the books tables carry (0058, 0083). This
-- row decides what goes out unattended, in the shop's name, at any hour
-- -- so an account that cannot change a price must not be able to
-- change what the machine quotes either.
drop policy if exists "owner only deletes" on wa_quote_pack;
create policy "owner only deletes" on wa_quote_pack
  as restrictive for delete using (is_shop_owner(shop_id));
drop policy if exists "owner writes only" on wa_quote_pack;
create policy "owner writes only" on wa_quote_pack
  as restrictive for insert with check (is_shop_admin(shop_id));
drop policy if exists "owner updates only" on wa_quote_pack;
create policy "owner updates only" on wa_quote_pack
  as restrictive for update using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));

-- Look first, if this ran once before -- how many each shop can be
-- asked about, and how old the answer is:
-- select shop_id, item_count, built_at, now() - built_at as age
--   from wa_quote_pack order by built_at;
-- And that the guards landed -- rls true, four policies:
-- select c.relrowsecurity as rls_on,
--        (select count(*) from pg_policies where tablename = 'wa_quote_pack') as policies
--   from pg_class c where c.relname = 'wa_quote_pack';

-- Rollback, in one paste:
-- drop table if exists wa_quote_pack;
