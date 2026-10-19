-- Push for the Manager's tables: a write-off report from the Store, and a
-- restock line the Manager held, each send a push (0120's outbox).
--
-- 0120 builds the outbox and every other handoff's push. These two push
-- from tables 0122 makes (stock_reports, restock_lines), so they come
-- after it, here: on a fresh database every migration runs once, in
-- order, and a trigger 0120 tried to put on a table that was not there
-- yet would never be attached.
--
--   a write-off report   to the Manager    stock.writeoff
--   a restock line held  to the Buyer      buy.restock
--
-- Applied by hand like every migration here, after 0120 and 0122. Every
-- function and trigger is replaced or dropped before it is created. Safe
-- to run twice.
--
-- CHECK AFTERWARDS:
--   select count(*) from pg_trigger where tgname like '%_ow_push';
--   -- 6
--
-- ROLLBACK:
--   drop trigger if exists stock_reports_ow_push on stock_reports;
--   drop trigger if exists restock_lines_ow_push on restock_lines;
-- ---------------------------------------------------------------------

-- 1. A write-off report from the Store.
create or replace function stock_reports_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform ow_push(new.shop_id, 'stock.report', 'Stock reported ' || coalesce(new.why, ''),
    trim_scale(coalesce(new.qty, 0))::text || ' ' || coalesce(new.name, 'items') || coalesce(' — ' || nullif(new.reported_by_name, ''), ''),
    null, 'stock.writeoff', null, jsonb_build_object('table', 'stock_reports', 'id', new.id), 'report:' || new.id);
  return null;
exception when others then
  raise notice 'push (report): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists stock_reports_ow_push on stock_reports;
create trigger stock_reports_ow_push after insert on stock_reports
  for each row execute function stock_reports_ow_push();

-- 2. A restock line the Manager held.
create or replace function restock_lines_ow_push() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'held' and old.status is distinct from 'held' then
    perform ow_push(new.shop_id, 'restock.held', 'The Manager held a restock line',
      coalesce(new.name, 'A line') || ' — not to buy for now.',
      null, 'buy.restock', null, jsonb_build_object('table', 'restock_lines', 'id', new.id), 'held:' || new.id || ':' || coalesce(new.held_at::text, ''));
  end if;
  return null;
exception when others then
  raise notice 'push (restock): % (%)', sqlerrm, sqlstate;
  return null;
end $$;
drop trigger if exists restock_lines_ow_push on restock_lines;
create trigger restock_lines_ow_push after update on restock_lines
  for each row execute function restock_lines_ow_push();
