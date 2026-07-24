-- saved_quotes.id mixes two ID-generation strategies: the admin app
-- assigns its own explicit id from a client-side counter on every new
-- quote (0002 switched the identity column from ALWAYS to BY DEFAULT
-- specifically to allow this), while agent-submit-order lets Postgres
-- auto-generate one from the identity sequence, never passing an id at
-- all. An explicit admin-assigned id doesn't advance that sequence, so
-- it can silently fall behind -- and once it has, the next
-- agent-submitted order's auto-generated id can collide with an id the
-- admin already used, failing the insert with "duplicate key value
-- violates unique constraint saved_quotes_pkey" (exactly the error an
-- agent hit trying to submit an order).
--
-- This trigger keeps the sequence pinned at least as far ahead as the
-- highest id actually used, no matter which side inserted it.
-- greatest(new.id, nextval(...)) only ever moves the sequence forward --
-- never backward -- so it can't undo an id another concurrent insert has
-- already claimed.
create or replace function sync_saved_quotes_id_seq() returns trigger
language plpgsql as $$
declare
  seqname text := pg_get_serial_sequence('saved_quotes', 'id');
begin
  perform setval(seqname, greatest(new.id, nextval(seqname)));
  return new;
end;
$$;

create trigger saved_quotes_sync_id_seq
after insert on saved_quotes
for each row
execute function sync_saved_quotes_id_seq();

-- Fix today's existing drift immediately too, so the very next insert
-- (from either side) doesn't have to wait for a fresh admin-assigned id
-- to happen to trigger the correction above.
select setval(
  pg_get_serial_sequence('saved_quotes', 'id'),
  coalesce((select max(id) from saved_quotes), 0) + 1,
  false
);
