-- 0146: A fresh start -- a new shop that keeps what was right about the old
-- one, and leaves behind what has to be measured again.
--
-- The owner's decision of 21 Oct 2026: the books of the shop the apps were
-- built on drifted from the real shop while the apps were tested on them.
-- The shop starts afresh, and nothing correct may be lost on the way. So:
--
--   COPIED, as reference to be checked, never as a balance:
--     the price list (products, suppliers' prices, the item links and the
--     names customers use, the photo library), suppliers, customers, staff,
--     agents and their clients, the settings (categories, units, markups,
--     credit and price policies, the shop's letterhead), the tasks the
--     owner switched off, the mobile money keys, the places and roads, the
--     rent still running, the assets still owned, the rivals' prices, and
--     the id counters, so a new id never repeats a copied one.
--
--   MEASURED AGAIN, never copied: what customers owe (debts start at 0),
--   what the shop owes suppliers (no bills come across), stock (none comes
--   across: the Store counts it, and a count is valued at the copied price
--   list), cash and the bank (no cash book), loans (each entered with what
--   is still owed).
--
--   LEFT IN THE OLD SHOP, which is kept and stays readable from the shop
--   picker: every order, invoice, payment, cash line, bill, stock movement,
--   count, decision, message and log. Nothing in the old shop is deleted.
--
-- Two steps, run by the operator in the Supabase SQL editor, never from an
-- app (like making a shop, 0059). Each is a dry run unless told otherwise:
-- it does all of its work, reports it, and undoes it.
--
--   select * from ow_fresh_start('<old shop id>', 'New name');          -- look
--   select * from ow_fresh_start('<old shop id>', 'New name', true);    -- do it
--     The new shop, its owners and admins, and the copy. The team still
--     opens the old shop until the second step.
--
--   select * from ow_fresh_start_move('<old>', '<new>');               -- look
--   select * from ow_fresh_start_move('<old>', '<new>', true);         -- do it
--     Switch day: every other member moves to the new shop and leaves the
--     old one, each agent's login moves to their copy (an agent login can
--     open one shop only), and so do the agents' public catalogues and the
--     shop's WhatsApp numbers. Safe to run again.
--
-- Then, in the Manager app (the owner's decision of 21 Oct 2026: the
-- Manager enters each, never a copy of the old figure):
--
--   set_opening_balance(shop, customer, amount, since)    debt.open
--     What a customer owed before these books, once confirmed with them:
--     one 'Opening balance' line in their debt log, their debt set to it,
--     and the owner's log line with what the old books said. Only while
--     the customer has not traded in these books; until then it can be
--     set again. 0 says "confirmed: owes nothing".
--
-- fresh_starts keeps, per new shop, the shop it came from, what each
-- customer owed in the old books (the Manager's checklist, read-only),
-- and which of those the Manager has confirmed.
--
-- docs/fresh-start.md is the runbook. Safe to re-run this file.
--
-- Rollback:
--   drop function if exists set_opening_balance(uuid, text, numeric, date);
--   delete from role_tasks where task = 'debt.open';
--   drop table if exists fresh_starts;
--   drop function if exists ow_fresh_start_move(uuid, uuid, boolean);
--   drop function if exists ow_fresh_start(uuid, text, boolean);
--   drop function if exists ow_fs_copy(text, uuid, uuid, text, jsonb, boolean);
-- A shop made by ow_fresh_start goes with: delete from shops where id = '<new>';

create table if not exists fresh_starts (
  shop_id uuid primary key references shops(id) on delete cascade,
  from_shop uuid references shops(id) on delete set null,
  made_at timestamptz not null default now(),
  old_debts jsonb not null default '{}'::jsonb,
  confirmed jsonb not null default '{}'::jsonb
);
alter table fresh_starts enable row level security;
drop policy if exists "shop members read their fresh start" on fresh_starts;
create policy "shop members read their fresh start" on fresh_starts for select to authenticated using (is_shop_member(shop_id));
-- Written only by the functions below.
revoke insert, update, delete on fresh_starts from anon, authenticated;
grant select on fresh_starts to authenticated;

insert into role_tasks (role, task) values ('manager', 'debt.open') on conflict do nothing;

-- Copies one table's rows for a shop into another shop, every column that
-- exists today (a column added later comes along without an edit here).
-- p_set overrides columns on the way; p_keep_ids false lets the table's own
-- identity number the copies, for tables whose key is the id alone.
create or replace function ow_fs_copy(p_table text, p_from uuid, p_to uuid, p_where text default 'true',
  p_set jsonb default '{}'::jsonb, p_keep_ids boolean default true)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  cols text;
  n bigint;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = p_table and is_generated = 'NEVER'
     and (p_keep_ids or column_name <> 'id');
  if cols is null then raise exception 'ow_fs_copy: no table %', p_table; end if;
  execute format(
    'insert into public.%1$I (%2$s) overriding system value select %2$s from ('
    || 'select (jsonb_populate_record(null::public.%1$I, to_jsonb(x) || $1)).* from public.%1$I x where x.shop_id = $2 and (%3$s)) s',
    p_table, cols, p_where)
    using coalesce(p_set, '{}'::jsonb) || jsonb_build_object('shop_id', p_to), p_from;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function ow_fresh_start(p_from uuid, p_name text, p_for_real boolean default false)
returns table(what text, n bigint, note text)
language plpgsql
set search_path = public
as $$
declare
  old_shop shops%rowtype;
  v_to uuid;
  v_prior uuid;
  out jsonb := '[]'::jsonb;
  c bigint;
  tot numeric;
  fmap jsonb := '{}'::jsonb;
  f record;
  nid bigint;
  to_lit text;
  -- Running records kept in the settings, not settings: they stay behind.
  history_keys text[] := array['dayLog', 'buyHolds', 'buyOrders', 'stockCounts', 'debtChases', 'chaseLog',
    'msgUseLog', 'waPins', 'waSnooze', 'waNotes', 'analysisMarks'];
begin
  select * into old_shop from shops where id = p_from;
  if not found then raise exception 'There is no shop % to start from.', p_from using errcode = '22023'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'Give the new shop a name.' using errcode = '22023'; end if;
  select fs.shop_id into v_prior from fresh_starts fs where fs.from_shop = p_from limit 1;
  if v_prior is not null then
    raise exception 'Shop % was already started fresh from this one. To start again, delete it first: delete from shops where id = ''%'';', v_prior, v_prior
      using errcode = '23505';
  end if;

  begin
    v_to := gen_random_uuid();
    to_lit := quote_literal(v_to);
    insert into shops(id, name, created_by) values (v_to, btrim(p_name), old_shop.created_by);
    out := out || jsonb_build_object('what', 'the new shop', 'n', 1, 'note', v_to::text);

    insert into shop_members(shop_id, user_id, role)
      select v_to, m.user_id, m.role from shop_members m where m.shop_id = p_from and m.role in ('owner', 'admin');
    get diagnostics c = row_count;
    out := out || jsonb_build_object('what', 'owners and admins', 'n', c, 'note', 'they see both shops and choose in the picker');

    -- Where it came from, and the old books' debts as the Manager's
    -- checklist. Its own table: the console rewrites the settings whole.
    insert into fresh_starts(shop_id, from_shop, old_debts)
      values (v_to, p_from, coalesce((select jsonb_object_agg(id, debt) from customers where shop_id = p_from and debt > 0), '{}'::jsonb));

    insert into app_settings(shop_id, presets, updated_at)
      select v_to, coalesce(a.presets, '{}'::jsonb) - history_keys, now()
        from app_settings a where a.shop_id = p_from;
    get diagnostics c = row_count;
    out := out || jsonb_build_object('what', 'settings', 'n', c, 'note', 'categories, units, markups, policies, letterhead; running logs left behind');

    out := out || jsonb_build_object('what', 'tasks switched off', 'n', ow_fs_copy('shop_task_off', p_from, v_to), 'note', '');
    out := out || jsonb_build_object('what', 'mobile money keys', 'n', ow_fs_copy('shop_payment_providers', p_from, v_to), 'note', '');
    out := out || jsonb_build_object('what', 'id counters', 'n', ow_fs_copy('entity_id_counters', p_from, v_to), 'note', 'new ids carry on after the copied ones');

    out := out || jsonb_build_object('what', 'suppliers', 'n', ow_fs_copy('suppliers', p_from, v_to), 'note', 'nothing owed to them yet: enter each statement');
    out := out || jsonb_build_object('what', 'customers', 'n', ow_fs_copy('customers', p_from, v_to, 'true', '{"debt": 0}'), 'note', 'every debt starts at 0: confirm and enter each');
    out := out || jsonb_build_object('what', 'products', 'n', ow_fs_copy('products', p_from, v_to), 'note', '');
    out := out || jsonb_build_object('what', 'prices', 'n', ow_fs_copy('prices', p_from, v_to, 'true', '{}', false), 'note', 'keep their dates, so Sourcing re-confirms the old ones first');
    out := out || jsonb_build_object('what', 'item links', 'n', ow_fs_copy('product_links', p_from, v_to), 'note', '');
    out := out || jsonb_build_object('what', 'names customers use', 'n', ow_fs_copy('item_names', p_from, v_to, 'true', '{}', false), 'note', '');

    -- The photo library: folders hang off each other and photos off
    -- folders, by ids the copies do not keep. The photos themselves stay
    -- where they are in storage (a public bucket), so both shops show them.
    for f in select * from media_folders where shop_id = p_from order by id loop
      insert into media_folders(shop_id, name, parent_id, created_at) values (v_to, f.name, null, f.created_at) returning id into nid;
      fmap := fmap || jsonb_build_object(f.id::text, nid);
    end loop;
    update media_folders m set parent_id = (fmap ->> o.parent_id::text)::bigint
      from media_folders o where o.shop_id = p_from and o.parent_id is not null and m.id = (fmap ->> o.id::text)::bigint;
    insert into media(shop_id, path, url, name, bytes, mime, sha256, folder_id, created_at)
      select v_to, m.path, m.url, m.name, m.bytes, m.mime, m.sha256, (fmap ->> m.folder_id::text)::bigint, m.created_at
        from media m where m.shop_id = p_from order by m.id;
    get diagnostics c = row_count;
    out := out || jsonb_build_object('what', 'photo library', 'n', c, 'note', (select count(*) from media_folders where shop_id = v_to) || ' folders; the photos stay in the old shop''s storage folder');

    out := out || jsonb_build_object('what', 'staff', 'n', ow_fs_copy('staff', p_from, v_to), 'note', 'their logins move on switch day');
    -- An agent login opens one shop only (agents_user_unique): the copy
    -- has none until switch day.
    out := out || jsonb_build_object('what', 'agents', 'n', ow_fs_copy('agents', p_from, v_to, 'x.retired_at is null', '{"user_id": null}'), 'note', 'retired agents stay behind; logins move on switch day');
    c := 0;
    c := c + ow_fs_copy('agent_goals', p_from, v_to, format('x.agent_id in (select id from agents where shop_id = %s)', to_lit));
    c := c + ow_fs_copy('agent_notify_prefs', p_from, v_to, format('x.agent_id in (select id from agents where shop_id = %s)', to_lit));
    c := c + ow_fs_copy('agent_feed_prefs', p_from, v_to, format('x.agent_id in (select id from agents where shop_id = %s)', to_lit));
    out := out || jsonb_build_object('what', 'agents'' goals and settings', 'n', c, 'note', '');
    out := out || jsonb_build_object('what', 'agents'' clients', 'n', ow_fs_copy('agent_clients', p_from, v_to, format('x.agent_id in (select id from agents where shop_id = %s)', to_lit)), 'note', '');
    c := ow_fs_copy('agent_clusters', p_from, v_to, format('x.agent_id in (select id from agents where shop_id = %s)', to_lit))
       + ow_fs_copy('solution_templates', p_from, v_to, format('x.agent_id in (select id from agents where shop_id = %s)', to_lit), '{}', false);
    out := out || jsonb_build_object('what', 'agents'' shelves and kits', 'n', c, 'note', '');

    c := ow_fs_copy('places', p_from, v_to) + ow_fs_copy('place_routes', p_from, v_to) + ow_fs_copy('road_names', p_from, v_to);
    out := out || jsonb_build_object('what', 'places and roads', 'n', c, 'note', '');
    out := out || jsonb_build_object('what', 'rent still running', 'n',
      ow_fs_copy('rent_agreements', p_from, v_to, format('x.end_month is null or x.end_month >= %L', to_char(now() at time zone ow_shop_tz(), 'YYYY-MM')), '{}', false),
      'note', 'what was paid stays behind: enter what is due');
    out := out || jsonb_build_object('what', 'assets still owned', 'n',
      ow_fs_copy('fixed_assets', p_from, v_to, 'x.disposed_on is null',
        '{"cash_txn_id": null, "loan_id": null, "disposal_cash_txn_id": null, "disposal_proceeds": null}', false),
      'note', 'at their cost and date; check each is still here');
    out := out || jsonb_build_object('what', 'rivals'' prices', 'n', ow_fs_copy('rival_prices', p_from, v_to, 'true', '{}', false), 'note', '');

    -- What is left behind, and what to do about it. Read from the old shop.
    select count(*), coalesce(sum(debt), 0) into c, tot from customers where shop_id = p_from and debt > 0;
    out := out || jsonb_build_object('what', 'LEFT: customers owing', 'n', c, 'note', 'the old books say ' || to_char(tot, 'FM999,999,999,990') || ' in all: the Manager confirms each with the customer and enters it (Manager app, To collect)');
    select count(*) into c from purchase_invoices where shop_id = p_from;
    out := out || jsonb_build_object('what', 'LEFT: supplier bills', 'n', c, 'note', 'ask each supplier for a statement; enter it as their opening balance');
    select count(*) into c from stock where shop_id = p_from and coalesce(qty, 0) <> 0;
    out := out || jsonb_build_object('what', 'LEFT: stock lines', 'n', c, 'note', 'count the shelves in the Store app; the count is the new stock');
    select count(*) into c from loans where shop_id = p_from and closed_on is null;
    out := out || jsonb_build_object('what', 'LEFT: open loans', 'n', c, 'note', 'enter each with what is still owed');
    select count(*) into c from cash_txns where shop_id = p_from;
    out := out || jsonb_build_object('what', 'LEFT: cash book lines', 'n', c, 'note', 'count the cash, read the bank and mobile money statements: that is the opening');
    select count(*) into c from saved_quotes where shop_id = p_from and not coalesce(voided, false) and not coalesce(invoiced, false);
    out := out || jsonb_build_object('what', 'LEFT: orders not invoiced', 'n', c, 'note', 'finish or cancel them in the old shop before switch day');
    select count(*) into c from shop_members where shop_id = p_from and role not in ('owner', 'admin');
    out := out || jsonb_build_object('what', 'LEFT: team logins', 'n', c, 'note', 'they move on switch day: ow_fresh_start_move');

    if not p_for_real then
      raise exception using errcode = 'OWFSD', message = 'dry run';
    end if;
  exception when sqlstate 'OWFSD' then
    -- Everything above is undone; the report is kept, less the new shop's
    -- id, which was never kept either.
    out := jsonb_build_array(jsonb_build_object('what', 'DRY RUN: nothing was saved', 'n', 0,
      'note', 'run again with true as the third value to do it')) || (out - 0);
  end;

  return query select x.what, x.n, x.note from jsonb_to_recordset(out) as x(what text, n bigint, note text);
end;
$$;

create or replace function ow_fresh_start_move(p_from uuid, p_to uuid, p_for_real boolean default false)
returns table(what text, n bigint, note text)
language plpgsql
set search_path = public
as $$
declare
  out jsonb := '[]'::jsonb;
  c bigint;
  a record;
begin
  if not exists (select 1 from fresh_starts where shop_id = p_to and from_shop = p_from) then
    raise exception 'Shop % was not started fresh from shop % (ow_fresh_start makes that link).', p_to, p_from using errcode = '22023';
  end if;

  begin
    -- The team: every login that is not an owner's or an admin's opens the
    -- new shop and no longer the old one, so nobody records a sale there.
    insert into shop_members(shop_id, user_id, role)
      select p_to, m.user_id, m.role from shop_members m where m.shop_id = p_from and m.role not in ('owner', 'admin')
      on conflict (shop_id, user_id) do update set role = excluded.role;
    get diagnostics c = row_count;
    delete from shop_members where shop_id = p_from and role not in ('owner', 'admin');
    out := out || jsonb_build_object('what', 'team logins moved', 'n', c, 'note', 'they open the new shop from now on');

    -- An agent added to the old shop after the copy comes across now.
    perform ow_fs_copy('agents', p_from, p_to,
      format('x.retired_at is null and not exists (select 1 from agents n where n.shop_id = %L and n.id = x.id)', p_to), '{"user_id": null}');
    c := 0;
    for a in select o.id, o.user_id from agents o join agents n on n.shop_id = p_to and n.id = o.id
              where o.shop_id = p_from and o.user_id is not null and o.retired_at is null loop
      update agents set user_id = null where shop_id = p_from and id = a.id;
      update agents set user_id = a.user_id where shop_id = p_to and id = a.id;
      c := c + 1;
    end loop;
    out := out || jsonb_build_object('what', 'agent logins moved', 'n', c, 'note', 'the agent app opens the new shop');

    update catalogues k set shop_id = p_to
     where k.shop_id = p_from and exists (select 1 from agents n where n.shop_id = p_to and n.id = k.agent_id)
       and not exists (select 1 from catalogues e where e.shop_id = p_to and e.agent_id = k.agent_id);
    get diagnostics c = row_count;
    out := out || jsonb_build_object('what', 'agents'' catalogues moved', 'n', c, 'note', 'their public links keep working');

    update wa_numbers set shop_id = p_to where shop_id = p_from;
    get diagnostics c = row_count;
    out := out || jsonb_build_object('what', 'WhatsApp numbers moved', 'n', c, 'note', 'new messages arrive in the new shop; old chats stay in the old one');

    if not p_for_real then
      raise exception using errcode = 'OWFSD', message = 'dry run';
    end if;
  exception when sqlstate 'OWFSD' then
    out := jsonb_build_array(jsonb_build_object('what', 'DRY RUN: nothing was saved', 'n', 0,
      'note', 'run again with true as the third value to do it')) || out;
  end;

  return query select x.what, x.n, x.note from jsonb_to_recordset(out) as x(what text, n bigint, note text);
end;
$$;

-- What a customer owed before these books, as the Manager confirmed it.
create or replace function set_opening_balance(p_shop_id uuid, p_customer_id text, p_amount numeric, p_since date default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  amount numeric := round(p_amount);
  c customers%rowtype;
  old_books numeric;
  log_id bigint;
  saved jsonb;
begin
  if uid is null or not is_shop_member(p_shop_id) then
    raise exception 'Not a member of this shop.' using errcode = '42501';
  end if;
  if not (is_shop_admin(p_shop_id) or has_task(p_shop_id, 'debt.open')) then
    raise exception 'Giving a customer an opening balance needs debt.open.' using errcode = '42501';
  end if;
  if amount is null or amount < 0 then
    raise exception 'An opening balance is what they owe: nothing, or more.' using errcode = '22023';
  end if;
  if p_since is not null and p_since > ow_today() then
    raise exception 'A debt cannot start after today.' using errcode = '22023';
  end if;
  select * into c from customers where shop_id = p_shop_id and id = p_customer_id for update;
  if not found then raise exception 'There is no customer % in this shop.', p_customer_id using errcode = '22023'; end if;
  if exists (select 1 from customer_debt_log where shop_id = p_shop_id and customer_id = c.id and coalesce(note, '') <> 'Opening balance') then
    raise exception '% has traded in these books already: what they owe comes from those bills and payments now.', coalesce(nullif(c.name, ''), c.id)
      using errcode = '22023';
  end if;

  -- The right was checked above; the writes go in as the system, past the
  -- desk guard that stops a login raising a debt by hand (0113).
  saved := ow_system_begin();
  delete from customer_debt_log where shop_id = p_shop_id and customer_id = c.id and note = 'Opening balance';
  if amount > 0 then
    log_id := ow_next_row_id(p_shop_id, 'row:debt_log', 0);
    insert into customer_debt_log (id, shop_id, customer_id, date, type, amount, note)
         values (log_id, p_shop_id, c.id, p_since, 'charge', amount, 'Opening balance');
  end if;
  update customers set debt = amount where shop_id = p_shop_id and id = c.id;
  update fresh_starts set confirmed = confirmed || jsonb_build_object(c.id, jsonb_build_object('amount', amount, 'since', p_since, 'at', now(), 'by', uid))
   where shop_id = p_shop_id;
  perform ow_system_end(saved);

  select (f.old_debts ->> c.id)::numeric into old_books from fresh_starts f where f.shop_id = p_shop_id;
  perform ow_log(p_shop_id, uid, ow_staff_name_of(uid, p_shop_id), (select role from shop_members where shop_id = p_shop_id and user_id = uid),
    'debt.open', 'Opening balance for ' || coalesce(nullif(c.name, ''), c.id), amount,
    jsonb_build_object('table', 'customers', 'id', c.id),
    jsonb_build_object('debt', c.debt, 'oldBooks', old_books),
    jsonb_build_object('debt', amount, 'since', p_since));
  return jsonb_build_object('id', c.id, 'debt', amount, 'since', p_since, 'logId', log_id);
end $$;
revoke all on function set_opening_balance(uuid, text, numeric, date) from public, anon;
grant execute on function set_opening_balance(uuid, text, numeric, date) to authenticated;

-- The operator's, from the SQL editor. No app login may call these.
revoke all on function ow_fs_copy(text, uuid, uuid, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function ow_fresh_start(uuid, text, boolean) from public, anon, authenticated;
revoke all on function ow_fresh_start_move(uuid, uuid, boolean) from public, anon, authenticated;
