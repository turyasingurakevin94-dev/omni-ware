-- 0145: Sourcing v2 -- two supplier records that are one supplier become
-- one, and Sourcing sets how many prices it confirms a day.
--
-- The owner's decisions of 20 Oct 2026 (the v2 canvas):
--
--   merge_suppliers(shop, keep, fold)   supplier.edit
--     "Kiseka Steel" and "Kiseka Steels", one phone, two records: every
--     price, quote line, hunt candidate and the rest the folded record
--     carried moves to the one kept, then the folded record goes. A price
--     the kept record already has for the same item stays the kept one's
--     (the folded duplicate is dropped, not doubled). One write, logged for
--     the owner under supplier.edit.
--
--   set_prices_per_day(shop, n)         price.confirm
--     Prices a day is set in the Sourcing app (it was the owner's policy
--     number, owner_set_preset 'priceReview', 0127). Same rule as the
--     owner's: a whole number 1-200, perDay and the console's month figure
--     (targetPerPeriod = perDay x 26) kept in step. The owner can still set
--     it from the Owner app; either way it is in the owner's log.
--
-- Safe to re-run.
--
-- Rollback:
--   drop function if exists merge_suppliers(uuid, text, text);
--   drop function if exists set_prices_per_day(uuid, int);
--   drop function if exists ow_sourcing_log(uuid, text, text, jsonb, jsonb, jsonb);

-- The owner's log line, as the Sourcing login wrote it through logDecision.
create or replace function ow_sourcing_log(p_shop_id uuid, p_task text, p_what text, p_ref jsonb, p_before jsonb default null, p_after jsonb default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.decision_log') is null then return; end if;
  insert into decision_log (shop_id, by, by_name, role, task, what, ref, before, after)
  values (p_shop_id, auth.uid(), ow_staff_name_of(auth.uid(), p_shop_id),
          (select m.role from shop_members m where m.shop_id = p_shop_id and m.user_id = auth.uid() limit 1),
          p_task, p_what, p_ref, p_before, p_after);
end $$;
revoke all on function ow_sourcing_log(uuid, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

/* ---------------- two records, one supplier ---------------- */
-- A json list of objects whose "supplierId" (or "sid") names the folded
-- supplier, rewritten to name the kept one. Anything else is left as it is.
create or replace function ow_swap_supplier_json(p_list jsonb, p_fold text, p_keep text)
returns jsonb
language sql immutable as $$
  select case when jsonb_typeof(p_list) <> 'array' then p_list else coalesce((
    select jsonb_agg(
             case when jsonb_typeof(e) = 'object' and e ->> 'supplierId' = p_fold then jsonb_set(e, '{supplierId}', to_jsonb(p_keep))
                  when jsonb_typeof(e) = 'object' and e ->> 'sid' = p_fold then jsonb_set(e, '{sid}', to_jsonb(p_keep))
                  else e end
             order by o)
      from jsonb_array_elements(p_list) with ordinality as x(e, o)), '[]'::jsonb) end
$$;

create or replace function merge_suppliers(p_shop_id uuid, p_keep text, p_fold text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  keep_name text;
  fold_name text;
  n_prices int := 0;
  n_leads int := 0;
  n_quotes int := 0;
  n_other int := 0;
  n int;
  r record;
begin
  if auth.uid() is null or not has_task(p_shop_id, 'supplier.edit') then
    raise exception 'Merging suppliers needs supplier.edit (Sourcing).' using errcode = '42501';
  end if;
  if coalesce(p_keep, '') = '' or coalesce(p_fold, '') = '' or p_keep = p_fold then
    raise exception 'Pick two different suppliers: the one to keep and the one to fold in.' using errcode = '22023';
  end if;
  select name into keep_name from suppliers where shop_id = p_shop_id and id = p_keep for update;
  if not found then raise exception 'The supplier to keep is not on file.' using errcode = '22023'; end if;
  select name into fold_name from suppliers where shop_id = p_shop_id and id = p_fold for update;
  if not found then raise exception 'The supplier to fold in is not on file (already merged?).' using errcode = '22023'; end if;

  -- Prices: the kept record's own price for an item wins; the folded
  -- record's price for an item the kept one has no price for moves over.
  delete from prices f
   where f.shop_id = p_shop_id and f.supplier_id = p_fold
     and exists (select 1 from prices k where k.shop_id = p_shop_id and k.supplier_id = p_keep
                   and k.product_id = f.product_id
                   and coalesce(to_jsonb(k) ->> 'variant_idx', '') = coalesce(to_jsonb(f) ->> 'variant_idx', ''));
  update prices set supplier_id = p_keep where shop_id = p_shop_id and supplier_id = p_fold;
  get diagnostics n_prices = row_count;

  -- A commission row per supplier and month (0020): the kept one's month wins.
  if to_regclass('public.supplier_commissions') is not null then
    delete from supplier_commissions f where f.shop_id = p_shop_id and f.supplier_id = p_fold
       and exists (select 1 from supplier_commissions k where k.shop_id = p_shop_id and k.supplier_id = p_keep and k.period = f.period);
  end if;
  -- A supplier login (0132) is one per supplier: the kept one's stays.
  if to_regclass('public.supplier_accounts') is not null then
    delete from supplier_accounts f where f.shop_id = p_shop_id and f.supplier_id = p_fold
       and exists (select 1 from supplier_accounts k where k.shop_id = p_shop_id and k.supplier_id = p_keep);
  end if;

  -- Every other table that names a supplier by supplier_id (stock_log,
  -- collection_trips, restock buys, supplier answers and proposals, ...).
  for r in
    select c.table_name from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'supplier_id' and c.table_name not in ('prices', 'suppliers')
       and exists (select 1 from information_schema.columns s where s.table_schema = 'public' and s.table_name = c.table_name and s.column_name = 'shop_id')
       and exists (select 1 from information_schema.tables t where t.table_schema = 'public' and t.table_name = c.table_name and t.table_type = 'BASE TABLE')
  loop
    execute format('update public.%I set supplier_id = $1 where shop_id = $2 and supplier_id = $3', r.table_name) using p_keep, p_shop_id, p_fold;
    get diagnostics n = row_count; n_other := n_other + n;
  end loop;
  if to_regclass('public.customers') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'linked_supplier_id') then
    update customers set linked_supplier_id = p_keep where shop_id = p_shop_id and linked_supplier_id = p_fold;
    get diagnostics n = row_count; n_other := n_other + n;
  end if;

  -- The hunts' candidates (0072), as json.
  update sourcing_leads set candidates = ow_swap_supplier_json(candidates, p_fold, p_keep)
   where shop_id = p_shop_id and candidates::text like '%' || to_json(p_fold)::text || '%'
     and candidates is distinct from ow_swap_supplier_json(candidates, p_fold, p_keep);
  get diagnostics n_leads = row_count;

  -- Orders to suppliers (saved_quotes.payload): each line's supplier, and
  -- who has confirmed (payload.supplierConfirms, keyed by supplier).
  update saved_quotes q
     set payload = q.payload
                   || jsonb_build_object('items', ow_swap_supplier_json(q.payload -> 'items', p_fold, p_keep))
                   || case when jsonb_typeof(q.payload -> 'supplierConfirms') = 'object' and (q.payload -> 'supplierConfirms') ? p_fold
                           then jsonb_build_object('supplierConfirms', ((q.payload -> 'supplierConfirms') - p_fold)
                                  || case when (q.payload -> 'supplierConfirms') ? p_keep then '{}'::jsonb
                                          else jsonb_build_object(p_keep, (q.payload -> 'supplierConfirms') -> p_fold) end)
                           else '{}'::jsonb end
   where q.shop_id = p_shop_id and jsonb_typeof(q.payload) = 'object'
     and (coalesce(q.payload -> 'items', '[]'::jsonb)::text like '%' || to_json(p_fold)::text || '%'
          or coalesce((q.payload -> 'supplierConfirms') ? p_fold, false));
  get diagnostics n_quotes = row_count;

  delete from suppliers where shop_id = p_shop_id and id = p_fold;

  perform ow_sourcing_log(p_shop_id, 'supplier.edit',
    'Merged “' || coalesce(fold_name, p_fold) || '” into “' || coalesce(keep_name, p_keep) || '”: one supplier, two records',
    jsonb_build_object('table', 'suppliers', 'id', p_keep, 'folded', p_fold),
    jsonb_build_object('folded', jsonb_build_object('id', p_fold, 'name', fold_name)),
    jsonb_build_object('prices', n_prices, 'leads', n_leads, 'quotes', n_quotes, 'other', n_other));
  return jsonb_build_object('kept', p_keep, 'folded', p_fold, 'prices', n_prices, 'leads', n_leads, 'quotes', n_quotes, 'other', n_other);
end $$;
revoke all on function merge_suppliers(uuid, text, text) from public, anon;
grant execute on function merge_suppliers(uuid, text, text) to authenticated;

/* ---------------- prices a day, set by Sourcing ---------------- */
create or replace function set_prices_per_day(p_shop_id uuid, p_per_day int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_val jsonb;
begin
  if auth.uid() is null or not has_task(p_shop_id, 'price.confirm') then
    raise exception 'Setting prices a day needs price.confirm (Sourcing).' using errcode = '42501';
  end if;
  if p_per_day is null or p_per_day < 1 or p_per_day > 200 then
    raise exception 'Prices a day is a whole number, 1 to 200.' using errcode = '22023';
  end if;
  select presets into v_old from app_settings where shop_id = p_shop_id for update;
  v_val := coalesce(case when jsonb_typeof(v_old -> 'priceReview') = 'object' then v_old -> 'priceReview' end, '{}'::jsonb)
           || jsonb_build_object('perDay', p_per_day, 'targetPerPeriod', p_per_day * 26);
  insert into app_settings (shop_id, presets) values (p_shop_id, jsonb_build_object('priceReview', v_val))
  on conflict (shop_id) do update
     set presets = coalesce(app_settings.presets, '{}'::jsonb) || jsonb_build_object('priceReview', v_val),
         updated_at = now();
  if (coalesce(v_old, '{}'::jsonb) -> 'priceReview' -> 'perDay') is distinct from to_jsonb(p_per_day) then
    perform ow_sourcing_log(p_shop_id, 'price.confirm', 'Prices Sourcing confirms a day set to ' || p_per_day,
      jsonb_build_object('table', 'app_settings', 'id', p_shop_id, 'key', 'priceReview'),
      jsonb_build_object('priceReview', coalesce(v_old, '{}'::jsonb) -> 'priceReview'), jsonb_build_object('priceReview', v_val));
  end if;
  return jsonb_build_object('perDay', p_per_day);
end $$;
revoke all on function set_prices_per_day(uuid, int) from public, anon;
grant execute on function set_prices_per_day(uuid, int) to authenticated;
