-- 0149: A fresh start, choosing what stays behind.
--
-- The owner's decision of 21 Oct 2026, after the preview on the live shop
-- (0148): only the customers, the suppliers, the settings and the rent,
-- assets and places are real. The price list (products, prices, item
-- links, names, photos, rivals' prices), the staff and agents, and every
-- login but the owner's and the admin's were made while testing the apps,
-- and must not come across.
--
-- So ow_fresh_start takes a fourth value, what to leave in the old shop,
-- any of:
--
--   'price list'  products, prices, item links, names customers use, the
--                 photo library, rivals' prices (and agents' shelves)
--   'team'        staff, agents and everything of theirs
--   'settings'    categories, units, markups, policies, letterhead,
--                 switched-off tasks, mobile money keys
--   'property'    places and roads, rent still running, assets still owned
--
-- Customers and suppliers always come across, and owners and admins.
-- Left out, a group reads 0 in the report, "left in the old shop, as
-- chosen", and the preview shows exactly what the real run will do:
--
--   select * from ow_fresh_start('<old>', 'Name', false, array['price list', 'team']);
--   select * from ow_fresh_start('<old>', 'Name', true,  array['price list', 'team']);
--
-- With no fourth value it does what 0148's did. Safe to re-run.
--
-- Rollback: run 0148_fresh_start.sql's ow_fresh_start again, after
--   drop function if exists ow_fresh_start(uuid, text, boolean, text[]);

drop function if exists ow_fresh_start(uuid, text, boolean);

create or replace function ow_fresh_start(p_from uuid, p_name text, p_for_real boolean default false, p_leave text[] default '{}')
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
  leave text[] := coalesce(p_leave, '{}');
  bad text;
  chosen constant text := 'left in the old shop, as chosen';
begin
  select g into bad from unnest(leave) g where g not in ('price list', 'team', 'settings', 'property') limit 1;
  if bad is not null then
    raise exception 'Nothing called "%" can be left behind. The choices are: price list, team, settings, property.', bad using errcode = '22023';
  end if;
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

    if 'settings' = any(leave) then
      out := out || jsonb_build_object('what', 'settings', 'n', 0, 'note', chosen || ': set categories, units, markups and the letterhead again');
      out := out || jsonb_build_object('what', 'tasks switched off', 'n', 0, 'note', chosen);
      out := out || jsonb_build_object('what', 'mobile money keys', 'n', 0, 'note', chosen);
    else
      insert into app_settings(shop_id, presets, updated_at)
        select v_to, coalesce(a.presets, '{}'::jsonb) - history_keys, now()
          from app_settings a where a.shop_id = p_from;
      get diagnostics c = row_count;
      out := out || jsonb_build_object('what', 'settings', 'n', c, 'note', 'categories, units, markups, policies, letterhead; running logs left behind');
      out := out || jsonb_build_object('what', 'tasks switched off', 'n', ow_fs_copy('shop_task_off', p_from, v_to), 'note', '');
      out := out || jsonb_build_object('what', 'mobile money keys', 'n', ow_fs_copy('shop_payment_providers', p_from, v_to), 'note', '');
    end if;
    out := out || jsonb_build_object('what', 'id counters', 'n', ow_fs_copy('entity_id_counters', p_from, v_to), 'note', 'new ids carry on after the copied ones');

    out := out || jsonb_build_object('what', 'suppliers', 'n', ow_fs_copy('suppliers', p_from, v_to), 'note', 'nothing owed to them yet: enter each statement');
    out := out || jsonb_build_object('what', 'customers', 'n', ow_fs_copy('customers', p_from, v_to, 'true', '{"debt": 0}'), 'note', 'every debt starts at 0: confirm and enter each');
    if 'price list' = any(leave) then
      out := out || jsonb_build_object('what', 'products', 'n', 0, 'note', chosen || ': Sourcing builds the price list afresh');
      out := out || jsonb_build_object('what', 'prices', 'n', 0, 'note', chosen);
      out := out || jsonb_build_object('what', 'item links', 'n', 0, 'note', chosen);
      out := out || jsonb_build_object('what', 'names customers use', 'n', 0, 'note', chosen);
      out := out || jsonb_build_object('what', 'photo library', 'n', 0, 'note', chosen);
    else
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
    end if;

    if 'team' = any(leave) then
      out := out || jsonb_build_object('what', 'staff', 'n', 0, 'note', chosen || ': hire again in the Owner app');
      out := out || jsonb_build_object('what', 'agents', 'n', 0, 'note', chosen);
    else
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
    -- An agent's shelf is of products: none without the price list.
    c := case when 'price list' = any(leave) then 0
              else ow_fs_copy('agent_clusters', p_from, v_to, format('x.agent_id in (select id from agents where shop_id = %s)', to_lit)) end
       + ow_fs_copy('solution_templates', p_from, v_to, format('x.agent_id in (select id from agents where shop_id = %s)', to_lit), '{}', false);
    out := out || jsonb_build_object('what', 'agents'' shelves and kits', 'n', c, 'note', '');
    end if;

    if 'property' = any(leave) then
      out := out || jsonb_build_object('what', 'places and roads', 'n', 0, 'note', chosen);
      out := out || jsonb_build_object('what', 'rent still running', 'n', 0, 'note', chosen);
      out := out || jsonb_build_object('what', 'assets still owned', 'n', 0, 'note', chosen);
    else
    c := ow_fs_copy('places', p_from, v_to) + ow_fs_copy('place_routes', p_from, v_to) + ow_fs_copy('road_names', p_from, v_to);
    out := out || jsonb_build_object('what', 'places and roads', 'n', c, 'note', '');
    out := out || jsonb_build_object('what', 'rent still running', 'n',
      ow_fs_copy('rent_agreements', p_from, v_to, format('x.end_month is null or x.end_month >= %L', to_char(now() at time zone ow_shop_tz(), 'YYYY-MM')), '{}', false),
      'note', 'what was paid stays behind: enter what is due');
    out := out || jsonb_build_object('what', 'assets still owned', 'n',
      ow_fs_copy('fixed_assets', p_from, v_to, 'x.disposed_on is null',
        '{"cash_txn_id": null, "loan_id": null, "disposal_cash_txn_id": null, "disposal_proceeds": null}', false),
      'note', 'at their cost and date; check each is still here');
    end if;
    -- Rivals' prices are of products: they go with the price list.
    out := out || jsonb_build_object('what', 'rivals'' prices', 'n',
      case when 'price list' = any(leave) then 0 else ow_fs_copy('rival_prices', p_from, v_to, 'true', '{}', false) end,
      'note', case when 'price list' = any(leave) then chosen else '' end);

    -- What is left behind, and what to do about it. Read from the old shop.
    select count(*), coalesce(sum(debt), 0) into c, tot from customers where shop_id = p_from and debt > 0;
    out := out || jsonb_build_object('what', 'LEFT: customers owing', 'n', c, 'note', 'the old books say ' || to_char(tot, 'FM999,999,999,990') || ' in all: the Manager confirms each with the customer and enters it (Manager app, To collect)');
    select count(*) into c from purchase_invoices where shop_id = p_from;
    out := out || jsonb_build_object('what', 'LEFT: supplier bills', 'n', c, 'note', 'ask each supplier for a statement; enter it as their opening balance');
    select count(*) into c from stock where shop_id = p_from and coalesce(qty, 0) <> 0;
    out := out || jsonb_build_object('what', 'LEFT: stock lines', 'n', c, 'note',
      case when 'price list' = any(leave) then 'add the products first, then count the shelves in the Store app; the count is the new stock'
           else 'count the shelves in the Store app; the count is the new stock' end);
    select count(*) into c from loans where shop_id = p_from and closed_on is null;
    out := out || jsonb_build_object('what', 'LEFT: open loans', 'n', c, 'note', 'enter each with what is still owed');
    select count(*) into c from cash_txns where shop_id = p_from;
    out := out || jsonb_build_object('what', 'LEFT: cash book lines', 'n', c, 'note', 'count the cash, read the bank and mobile money statements: that is the opening');
    select count(*) into c from saved_quotes where shop_id = p_from and not coalesce(voided, false) and not coalesce(invoiced, false);
    out := out || jsonb_build_object('what', 'LEFT: orders not invoiced', 'n', c, 'note', 'finish or cancel them in the old shop before switch day');
    select count(*) into c from shop_members where shop_id = p_from and role not in ('owner', 'admin');
    out := out || jsonb_build_object('what', 'LEFT: team logins', 'n', c, 'note',
      case when 'team' = any(leave) then 'they stay in the old shop: do not run ow_fresh_start_move''s team step'
           else 'they move on switch day: ow_fresh_start_move' end);

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

revoke all on function ow_fresh_start(uuid, text, boolean, text[]) from public, anon, authenticated;
