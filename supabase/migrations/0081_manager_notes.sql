-- The Manager's memory: meetings held and moves advised, so tomorrow's
-- meeting opens with an account instead of amnesia.
--
-- Deliberately NOT part of the synced data blob: read and written
-- directly by the Manager screen, wa_* style. Two row kinds share the
-- table -- a 'meeting' (keyline, what was rejected, how many moves) and
-- its 'move' rows pointing back at it. OUTCOMES ARE NEVER STORED HERE:
-- what happened to each move is derived from the books at render time
-- (a chase from the customer's own ledger, a restock from the stock
-- log), so the account the Manager gives of itself cannot be flattered
-- by anything it wrote.

create table manager_notes (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  kind text not null check (kind in ('meeting', 'move')),
  meeting_id bigint references manager_notes(id) on delete cascade,
  date date not null,
  body jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index manager_notes_shop_date_idx on manager_notes(shop_id, date desc);
create index manager_notes_meeting_idx on manager_notes(shop_id, meeting_id);

alter table manager_notes enable row level security;

create policy "shop members full access" on manager_notes
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

-- Same restrictive delete the other tables gained in 0058: members keep
-- reading and writing, deleting stays the owner's.
create policy "owner only deletes" on manager_notes
  as restrictive for delete using (is_shop_owner(shop_id));
