-- Preserve historical duplicates; suppress new pending copies, including
-- concurrent meetings. No changes to journal permissions or past records.
begin;

create or replace function public.manager_proposal_key(kind text, body jsonb)
returns text language sql immutable set search_path = public as $$
  select case
    when kind = 'target' then nullif(lower(trim(body->>'metric')), '')
    when kind = 'play' then nullif(
      regexp_replace(lower(trim(body->>'name')), '[^[:alnum:]]+', '', 'g'), '')
    else null end;
$$;

create or replace function public.manager_dedupe_pending_proposal()
returns trigger language plpgsql set search_path = public as $$
declare proposal_key text;
begin
  if new.status <> 'proposed' or new.kind not in ('play', 'target') then
    return new;
  end if;
  proposal_key := public.manager_proposal_key(new.kind, new.body);
  if proposal_key is null then return new; end if;
  -- Serialize all proposals for one shop. A second insert reads the first
  -- committed row after acquiring the lock. SECURITY INVOKER retains RLS.
  perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text, 97));
  if exists (
    select 1 from public.manager_notes n
    where n.shop_id = new.shop_id and n.kind = new.kind
      and n.status = 'proposed' and n.id is distinct from new.id
      and public.manager_proposal_key(n.kind, n.body) = proposal_key
  ) then return null; end if;
  return new;
end;
$$;

drop trigger if exists manager_pending_proposal_guard on public.manager_notes;
create trigger manager_pending_proposal_guard
  before insert or update of status, body on public.manager_notes
  for each row execute function public.manager_dedupe_pending_proposal();

commit;
