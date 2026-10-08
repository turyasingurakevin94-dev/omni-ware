-- What the stock log, the customer ledger and an order's stage log
-- already knew, kept.
--
-- stock_log. A movement knows what the goods cost (a delivery, or a
-- count that put goods on the shelf with a price), which supplier they
-- came from, the bill it was received against, and which screen wrote it
-- -- a purchase, a delivery against a buy order, a movement taken back.
-- A correction also knows the row it put right and the quantity the
-- purchase now stands at, and a reversal the row it took back. None of
-- the seven went up, so after a reload the receipt checks, the lead
-- supplier and undoing a delivery all read a row that no longer said any
-- of it -- and a corrected purchase read at its first figure, a delivery
-- already taken back read as still standing.
--
-- Kept by these columns, on every row written once this is applied:
-- cost, supplier_id, pi_id, source, corrects, purchase_qty, reverses.
-- NOT kept, because they have no column: correctedBy and reversedBy, the
-- forward pointers written onto the old row in memory. The app rebuilds
-- both on load from corrects and reverses (stockLogRelink), which say
-- the same thing from the row that always survives.
--
-- customer_debt_log. A payment taken on the ledger knows the cash entry
-- it arrived as, and an invoice's own rows know their invoice. Neither
-- went up, so after a reload a ledger-only payment stopped counting as
-- money collected (who pays when they are chased read short), and the
-- invoice's rows were recognised by their wording alone. Restored:
-- cash_txn_id and quote_id.
--
-- Nullable, all of them, and older rows are not back-filled: a row
-- written before this landed says "not recorded", which is the truth.
-- No foreign keys, following the rule these two tables already keep --
-- they are audit trails, and a row has to survive the deletion of
-- anything it points at. supplier_id is text because suppliers.id is;
-- pi_id, corrects, reverses, cash_txn_id and quote_id are bigint because
-- the rows they name are.
--
-- The app probes for these before writing them (as it does for 0076,
-- 0095 and 0105): a movement and a payment go up on every save, and a
-- column the database does not have yet would fail the whole upsert --
-- the shop would stop recording stock and money rather than merely lose
-- the link.
alter table public.stock_log
  add column if not exists cost numeric,
  add column if not exists supplier_id text,
  add column if not exists pi_id bigint,
  add column if not exists source text,
  add column if not exists corrects bigint,
  add column if not exists purchase_qty numeric,
  add column if not exists reverses bigint;

comment on column public.stock_log.cost is
  'What one unit cost, when the movement carried a cost (a delivery, a count that put goods on the shelf at a price). Null when nobody said -- never 0, which would be a claim that the goods were free.';
comment on column public.stock_log.supplier_id is
  'The supplier a delivery came from (suppliers.id). Null for every other movement.';
comment on column public.stock_log.pi_id is
  'The purchase bill (purchase_invoices.id) a delivery was received against, when there was one.';
comment on column public.stock_log.source is
  'Which part of the app wrote the movement when it was not a plain sale or count: inv-purchase, buy-order, never-happened.';
comment on column public.stock_log.corrects is
  'On a correction: the stock_log.id of the row it put right (the end of the chain before it). The app rebuilds that row''s forward pointer from this on load.';
comment on column public.stock_log.purchase_qty is
  'On a correction: the quantity the purchase stands at after it -- 0 when the delivery is undone. Null on every other row, where the movement''s own delta is the quantity.';
comment on column public.stock_log.reverses is
  'On a reversal ("never happened"): the stock_log.id of the movement it took back. The app rebuilds that row''s forward pointer from this on load.';

alter table public.customer_debt_log
  add column if not exists cash_txn_id bigint,
  add column if not exists quote_id bigint;

comment on column public.customer_debt_log.cash_txn_id is
  'The cash entry (cash_txns.id) a payment arrived as. Null for a charge, and for a row written before this column existed.';
comment on column public.customer_debt_log.quote_id is
  'The invoice (saved_quotes.id) a row belongs to, when the invoice wrote it. Null for a payment or charge entered on the ledger itself.';

-- saved_quotes.payload->'stageLog'. Every move an order makes appends
-- {status, at, auto?} -- the console on every status change, the worker
-- app when it sends an order out -- and both save the whole payload from
-- their own copy. Each app merges the server's log in before it writes,
-- but that is a read followed by a write: a save landing between the two
-- would still erase the other's entry, and a console tab opened before
-- this release writes the log from memory with no merge at all.
--
-- So the database keeps the union. On every update, the entries already
-- on the row and the entries arriving are put together, each (status,
-- at) once -- the same move written by both sides is one move -- and
-- ordered by `at` (milliseconds), because the board reads the time spent
-- in a stage as one entry's `at` less the one before it. A log only ever
-- grows: an update that carries no stageLog, or an older copy of it,
-- leaves what is there. Rows with no log yet are untouched.
create or replace function public.saved_quotes_keep_stage_log() returns trigger
language plpgsql set search_path = public
as $$
declare
  kept jsonb;
begin
  if jsonb_typeof(old.payload -> 'stageLog') is distinct from 'array'
     or jsonb_typeof(new.payload) is distinct from 'object' then
    return new;
  end if;
  select jsonb_agg(u.e order by u.at_ms nulls last, u.src, u.n)
    into kept
    from (
      select distinct on (x.e ->> 'status', x.e ->> 'at')
             x.e, x.src, x.n,
             case when jsonb_typeof(x.e -> 'at') = 'number' then (x.e ->> 'at')::numeric end as at_ms
        from (
          select o.e, 0 as src, o.n
            from jsonb_array_elements(old.payload -> 'stageLog') with ordinality as o(e, n)
          union all
          select w.e, 1 as src, w.n
            from jsonb_array_elements(
                   case when jsonb_typeof(new.payload -> 'stageLog') = 'array'
                        then new.payload -> 'stageLog' else '[]'::jsonb end
                 ) with ordinality as w(e, n)
        ) x
       where jsonb_typeof(x.e) = 'object'
       order by x.e ->> 'status', x.e ->> 'at', x.src desc, x.n
    ) u;
  if kept is not null then
    new.payload := jsonb_set(new.payload, '{stageLog}', kept);
  end if;
  return new;
end;
$$;

drop trigger if exists saved_quotes_keep_stage_log on public.saved_quotes;
create trigger saved_quotes_keep_stage_log
before update on public.saved_quotes
for each row
execute function public.saved_quotes_keep_stage_log();

-- Rollback, in one paste. The trigger first: without it the orders table
-- writes exactly as it did before, and the app's own merge still keeps
-- what each side wrote. The columns after it, only if nothing written
-- since should be kept -- what they hold is lost with them.
-- drop trigger if exists saved_quotes_keep_stage_log on public.saved_quotes;
-- drop function if exists public.saved_quotes_keep_stage_log();
-- alter table public.stock_log drop column if exists cost, drop column if exists supplier_id,
--   drop column if exists pi_id, drop column if exists source, drop column if exists corrects,
--   drop column if exists purchase_qty, drop column if exists reverses;
-- alter table public.customer_debt_log drop column if exists cash_txn_id, drop column if exists quote_id;
