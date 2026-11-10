-- 0180 Sales places an order through a server function (docs/spec/05-data.md
-- §8 Q3 and §9 Q6, Kevin 28 Oct 2026: the new apps write orders only
-- through server functions; docs/rebuild.md).
--
-- Until now Sales placed an order with two calls from the phone: an id from
-- next_row_id_blocks('row:saved_quote') (0138), then a direct insert into
-- saved_quotes (sales.html slide:place, 8718-8738; src/core/supabase/write.ts
-- copied it). A phone that lost signal between the two, or sent the insert
-- twice, left a gap or an order entered twice (the canvas's OR19). Now:
--
--   place_order(shop, row, key)
--       quote.make (Sales; the owner and admins hold every task). One
--       write: the order is numbered from row:saved_quote and inserted as
--       sales.html inserts it -- the same columns, the same payload
--       (client, items, charges, credit, savedAt, createdAt, payments [],
--       customerId, debtCharged 0, stageEnteredAt, stageLog, takenBy) --
--       so every guard and trigger on saved_quotes fires as it did on the
--       phone's insert, as the caller: 0119's gate (a shelf-only order to
--       Packing, a held move kept as gateHeldMove), 0165's money check,
--       0167's test-record mark (qa), 0171's no sale under cost (OWCST),
--       0173's stage rule (Packing needs quote.make or order.move), 0174's
--       gate reasons, 0175's checks on the Manager's answers, and the
--       pushes (0120's price.waits, credit.hold).
--
--       From the phone it takes only what Sales decides: the client's name
--       and phone, the lines, the charges, on credit or not (and the days),
--       the customer, where it goes (deliverTo), the chat it came from
--       (waConvId), and where it starts ('draft' Checking, or 'preparing'
--       Packing when all of it is on our shelf). The rest is the server's:
--       the number, the date (ow_today), the times, who took it (the
--       caller), nothing paid, and the Credit charge's pct, which is the
--       shop's (presets.creditPct, as sales.html nwQuoteOf writes it), so
--       no phone sells on credit without it.
--
--       Placed once: a key (the phone's draft key) sent again answers with
--       the order it already placed ('again': true), so a retry after lost
--       signal never makes a copy. Without a key every call places one, as
--       the insert did.
--
--       Refused: no login or not a member, no quote.make (42501); nothing
--       to place, a start other than Checking or Packing (22023); a
--       customer not in this shop's books (P0002); and whatever the guards
--       refuse.
--
--       Returns {ok, id, number ('#0558'), status (where it stands after
--       the gate), again}.
--
-- The direct insert is not closed here: sales.html (frozen) and the console
-- still place orders that way. Q3 closes it for each role when its old app
-- retires.
--
-- Applied by hand, after 0179. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select pg_get_function_identity_arguments('place_order'::regproc);   -- p_shop_id uuid, p_row jsonb, p_key text
--   select id, client_name, status, payload ->> 'takenBy', payload ->> 'placeKey' from saved_quotes order by id desc limit 5;
--
-- ROLLBACK:
--   drop function if exists place_order(uuid, jsonb, text);
--   drop index if exists saved_quotes_place_key_idx;
-- ---------------------------------------------------------------------

-- A key is looked up per shop; only orders placed with one carry it.
create index if not exists saved_quotes_place_key_idx on saved_quotes (shop_id, (payload ->> 'placeKey')) where payload ? 'placeKey';

create or replace function place_order(p_shop_id uuid, p_row jsonb, p_key text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_key text := nullif(left(regexp_replace(btrim(coalesce(p_key, '')), '[^A-Za-z0-9._:-]', '', 'g'), 80), '');
  src jsonb;
  presets jsonb;
  v_status text;
  items jsonb;
  charges jsonb;
  credit jsonb := null;
  days numeric;
  cid text;
  c customers%rowtype;
  v_name text;
  v_phone text;
  p jsonb;
  floor_id bigint;
  new_id bigint;
  got saved_quotes%rowtype;
  now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  now_iso text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Sign in to this shop first.' using errcode = '42501';
  end if;
  if not has_task(p_shop_id, 'quote.make') then
    raise exception 'Taking an order is Sales'' (quote.make).' using errcode = '42501';
  end if;
  if jsonb_typeof(p_row) is distinct from 'object' or jsonb_typeof(p_row -> 'payload') is distinct from 'object' then
    raise exception 'Nothing to place.' using errcode = '22023';
  end if;

  -- Placed once: the same key again is the order it placed.
  if v_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text || ':place_order:' || v_key, 0));
    select * into got from saved_quotes
     where shop_id = p_shop_id and payload ? 'placeKey' and payload ->> 'placeKey' = v_key
     order by id limit 1;
    if found then
      return jsonb_build_object('ok', true, 'id', got.id, 'number', '#' || lpad(got.id::text, 4, '0'), 'status', got.status, 'again', true);
    end if;
  end if;

  src := p_row -> 'payload';
  v_status := coalesce(nullif(btrim(coalesce(p_row ->> 'status', '')), ''), 'draft');
  if v_status not in ('draft', 'preparing') then
    raise exception 'A new order starts in Checking or Packing.' using errcode = '22023';
  end if;
  items := case when jsonb_typeof(src -> 'items') = 'array' then src -> 'items' else '[]'::jsonb end;
  if jsonb_array_length(items) = 0 then raise exception 'Add an item to place.' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements(items) e where jsonb_typeof(e) <> 'object') then
    raise exception 'Each line is an item.' using errcode = '22023';
  end if;
  charges := case when jsonb_typeof(src -> 'charges') = 'array' then src -> 'charges' else '[]'::jsonb end;
  if exists (select 1 from jsonb_array_elements(charges) e where jsonb_typeof(e) <> 'object') then
    raise exception 'Each charge is a line of its own.' using errcode = '22023';
  end if;

  -- The customer: one in this shop's books, or none (a walk-in).
  cid := nullif(btrim(coalesce(src ->> 'customerId', '')), '');
  if cid is not null then
    select * into c from customers where shop_id = p_shop_id and id = cid;
    if not found then raise exception 'That customer is not in the books.' using errcode = 'P0002'; end if;
  end if;
  v_name := coalesce(nullif(btrim(coalesce(p_row ->> 'client_name', '')), ''), nullif(btrim(coalesce(src -> 'client' ->> 'name', '')), ''),
                     nullif(btrim(coalesce(c.name, '')), ''), 'Walk-in');
  v_phone := nullif(btrim(coalesce(p_row ->> 'client_phone', src -> 'client' ->> 'phone', '')), '');

  -- On credit: the shop's Credit charge (presets.creditPct), for the days asked (else presets.chaseAfterDays).
  if jsonb_typeof(src -> 'credit') = 'object' then
    presets := coalesce((select a.presets from app_settings a where a.shop_id = p_shop_id), '{}'::jsonb);
    days := ow_num(src -> 'credit' ->> 'days');
    if days is null or days < 0 then days := greatest(0, coalesce(ow_num(presets ->> 'chaseAfterDays'), 0)); end if;
    credit := jsonb_build_object('pct', greatest(0, coalesce(ow_num(presets ->> 'creditPct'), 0)), 'days', round(days), 'agreedAt', ow_today());
  end if;

  p := jsonb_build_object(
         'client', jsonb_build_object('name', v_name, 'phone', coalesce(v_phone, '')),
         'items', items, 'charges', charges, 'credit', credit,
         'savedAt', now_iso, 'createdAt', now_iso, 'payments', '[]'::jsonb, 'customerId', cid, 'debtCharged', 0,
         'stageEnteredAt', now_ms, 'stageLog', jsonb_build_array(jsonb_build_object('status', v_status, 'at', now_ms)),
         'takenBy', uid::text);
  if jsonb_typeof(src -> 'deliverTo') = 'string' and btrim(src ->> 'deliverTo') <> '' then
    p := p || jsonb_build_object('deliverTo', left(btrim(src ->> 'deliverTo'), 200));
  end if;
  if jsonb_typeof(src -> 'waConvId') = 'number' then p := p || jsonb_build_object('waConvId', src -> 'waConvId'); end if;
  if v_key is not null then p := p || jsonb_build_object('placeKey', v_key); end if;

  -- The number, then the order: an ordinary insert, so every guard and trigger judges it as the caller.
  select coalesce(max(id), 0) into floor_id from saved_quotes;  -- ids are one sequence across shops (0001)
  new_id := ow_next_row_id(p_shop_id, 'row:saved_quote', floor_id);
  insert into saved_quotes (id, shop_id, client_name, client_phone, date, status, invoiced, invoiced_at, invoiced_ts, amount_paid, voided, payload)
       values (new_id, p_shop_id, v_name, v_phone, ow_today(), v_status, false, null, null, 0, false, p)
  returning * into got;

  return jsonb_build_object('ok', true, 'id', got.id, 'number', '#' || lpad(got.id::text, 4, '0'), 'status', got.status, 'again', false);
end $$;
revoke all on function place_order(uuid, jsonb, text) from public, anon;
grant execute on function place_order(uuid, jsonb, text) to authenticated;
