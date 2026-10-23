-- 0161 Store, sixth (audit round 1: data integrity, 23 Oct 2026; docs/audit/ROUND-1.md).
--
--   1. DATA-01 One count per place. A count of an aisle (or of one item) still
--      waiting on the Manager can't be joined by a second: stock_counts gets
--      `place` (by the aisle's category name, never its letter, or by the
--      item), and a partial unique index allows one 'sent' count per place.
--      A count done again replaces the waiting one when it is SENT
--      (store_count_replace): the old one reads 'superseded', the new one
--      names it in `replaces`, and the Manager sees only the latest. Anyone
--      who counts may replace a colleague's count (Kevin, 23 Oct). The
--      waiting duplicates already in the books are resolved the same way:
--      the newest stays, the older read 'superseded'.
--   2. DATA-02 A return's unit is its order line's. qty was always in the
--      line's unit (it is priced qty x the line's price); the label was not.
--      store_return_ask takes the unit from the order, and the asks already
--      sent with another unit (#0494: 20 "Ctn" that are 20 Box) are relabelled.
--   3. DATA-03 A write-off never takes more than the shelf has (the books
--      less what has left for orders not yet invoiced), and each line writes
--      its own stock_log row naming its report. One past the shelf is refused
--      with "count it first". No row is back-filled for 19 Oct (ROUND-1.md).
--   4. DATA-05 Products out of the Furniture catch-all into the aisles that
--      already exist (the table approved in ROUND-1.md), so no aisle empties
--      and no shelf letter moves. Each move matches the product's id AND its
--      name, so another shop's P269 is never touched.
--   5. DATA-06 One dash per name: " - " inside 13 product names and 4
--      variant names becomes a space, "(...)" gets its space. " — " (the
--      variant separator) is untouched. Orders keep a variant by position.
--
-- Run after 0160, once the store.html of this round is live. Safe to run twice.
-- Reload any open console (index.html) afterwards, so it doesn't save an old
-- copy of a moved product back.
--
-- CHECK AFTERWARDS:
--   select place, count(*) from stock_counts where status = 'sent' group by 1 having count(*) > 1;  -- no rows
--   select count(*) from products where category is null or btrim(category) = '';                    -- 0
--   select count(*) from products where name ~ '\s-\s';                                               -- 0
--
-- ROLLBACK: 0160 for store_return_ask, 0122 for write_off_stock; drop index
-- stock_counts_one_open. The product moves and renames are data: put them
-- back from the tables in ROUND-1.md if ever needed.
-- ---------------------------------------------------------------------

/* ---- 1. one count per place ---- */
alter table stock_counts drop constraint if exists stock_counts_status_check;
alter table stock_counts add constraint stock_counts_status_check check (status in ('sent', 'accepted', 'recount', 'superseded'));
alter table stock_counts add column if not exists place text;
alter table stock_counts add column if not exists replaces uuid;
alter table stock_counts add column if not exists superseded_at timestamptz;

-- "Aisle C · Nails and fixings" -> aisle:nails and fixings; "Spot count · Cement" -> item:<its key>.
-- By the category's name: a letter moves when the aisles do, the name doesn't.
create or replace function ow_count_place(p_aisle text, p_lines jsonb) returns text
language sql immutable as $$
  select case
    when coalesce(p_aisle, '') ~* '^spot count' then 'item:' || coalesce(nullif(p_lines -> 0 ->> 'key', ''), lower(btrim(p_aisle)))
    when coalesce(p_aisle, '') ~* '^aisle ' and position(' · ' in p_aisle) > 0
      then 'aisle:' || lower(btrim(substr(p_aisle, position(' · ' in p_aisle) + 3)))
    else null
  end
$$;

create or replace function stock_counts_place() returns trigger
language plpgsql as $$
begin
  new.place := ow_count_place(new.aisle, new.lines);
  return new;
end $$;
drop trigger if exists stock_counts_place on stock_counts;
create trigger stock_counts_place before insert or update of aisle, lines on stock_counts
  for each row execute function stock_counts_place();

-- A count replaced stays replaced: accepting it or asking for its recount is refused.
create or replace function stock_counts_superseded_stays() returns trigger
language plpgsql as $$
begin
  if old.status = 'superseded' and new.status is distinct from 'superseded' then
    raise exception 'A newer count of this place replaced this one.' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists stock_counts_superseded_stays on stock_counts;
create trigger stock_counts_superseded_stays before update of status on stock_counts
  for each row execute function stock_counts_superseded_stays();

update stock_counts set place = ow_count_place(aisle, lines) where place is distinct from ow_count_place(aisle, lines);

-- The waiting duplicates already there: the newest stays and names the one before it.
with ranked as (
  select id, row_number() over w as rn, lead(id) over w as older
    from stock_counts where status = 'sent' and place is not null
  window w as (partition by shop_id, place order by created_at desc, id desc))
update stock_counts c set replaces = r.older from ranked r where c.id = r.id and r.rn = 1 and r.older is not null and c.replaces is null;
with ranked as (
  select id, row_number() over (partition by shop_id, place order by created_at desc, id desc) as rn
    from stock_counts where status = 'sent' and place is not null)
update stock_counts c set status = 'superseded', superseded_at = now() from ranked r where c.id = r.id and r.rn > 1;

create unique index if not exists stock_counts_one_open on stock_counts(shop_id, place) where status = 'sent';

-- Count it again: the waiting count of the same place is replaced as the new one goes in,
-- in one step. If the Manager decided the old one meanwhile, the new one goes as the next count.
create or replace function store_count_replace(p_shop uuid, p_old uuid, p_aisle text, p_lines jsonb, p_missing jsonb, p_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o stock_counts%rowtype;
  r stock_counts%rowtype;
  replaced boolean := false;
  nm text;
begin
  if not has_task(p_shop, 'stock.count') then
    raise exception 'Counting stock is not this login''s job (stock.count).' using errcode = '42501';
  end if;
  if p_old is not null then
    select * into o from stock_counts where id = p_old and shop_id = p_shop for update;
    if found and o.status = 'sent' and o.place is not distinct from ow_count_place(p_aisle, p_lines) then
      update stock_counts set status = 'superseded', superseded_at = now() where id = p_old;
      replaced := true;
    end if;
  end if;
  select nullif(btrim(s.name), '') into nm from staff s where s.shop_id = p_shop and s.user_id = auth.uid() limit 1;
  insert into stock_counts (shop_id, aisle, counted_by, counted_by_name, lines, missing, replaces)
       values (p_shop, p_aisle, auth.uid(), coalesce(nm, nullif(btrim(p_name), ''), 'The Store'),
               coalesce(p_lines, '[]'::jsonb), coalesce(p_missing, '[]'::jsonb), case when replaced then p_old end)
  returning * into r;
  return to_jsonb(r) || jsonb_build_object('replaced', replaced, 'old_status', o.status);
end $$;
revoke all on function store_count_replace(uuid, uuid, text, jsonb, jsonb, text) from public, anon;
grant execute on function store_count_replace(uuid, uuid, text, jsonb, jsonb, text) to authenticated;

/* ---- 2. a return's unit is its order line's ---- */
-- 0161: the line's unit is the order line's, never the phone's: qty is in it
-- (the price is qty x the line's price).
create or replace function store_return_ask(p_shop uuid, p_order bigint, p_lines jsonb, p_reason text, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q saved_quotes%rowtype;
  l jsonb;
  it jsonb;
  priced jsonb := '[]'::jsonb;
  price numeric;
  total numeric := 0;
  nm text;
  new_id uuid;
  left_qty numeric;
begin
  if not is_shop_member(p_shop) then raise exception 'Not a member of this shop.' using errcode = '42501'; end if;
  select * into q from saved_quotes where shop_id = p_shop and id = p_order;
  if not found then raise exception 'That order is gone.'; end if;
  for l in select e from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) e loop
    if not ((l ->> 'idx') ~ '^\d+$') or coalesce((l ->> 'qty')::numeric, 0) <= 0 then continue; end if;
    it := q.payload -> 'items' -> ((l ->> 'idx')::int);
    if it is null then continue; end if;
    -- Never more back than the line had, less what is already on its way back or credited.
    left_qty := coalesce((it ->> 'qty')::numeric, 0) - coalesce((
        select sum((e ->> 'qty')::numeric) from invoice_asks a cross join lateral jsonb_array_elements(coalesce(a.lines, '[]'::jsonb)) e
         where a.shop_id = p_shop and a.quote_id = p_order and a.kind = 'credit' and (e ->> 'idx') = (l ->> 'idx')
           and (a.status = 'sent' or (a.status = 'accepted' and not exists (
                 select 1 from jsonb_array_elements(coalesce(q.payload -> 'creditNotes', '[]'::jsonb)) cn where cn ->> 'askId' = a.id::text)))), 0)
      - coalesce((
        select sum((e ->> 'qty')::numeric) from jsonb_array_elements(coalesce(q.payload -> 'creditNotes', '[]'::jsonb)) cn
         cross join lateral jsonb_array_elements(coalesce(cn -> 'lines', '[]'::jsonb)) e
         where not coalesce((cn ->> 'voided')::boolean, false) and (e ->> 'idx') = (l ->> 'idx')), 0);
    if (l ->> 'qty')::numeric > left_qty then
      raise exception 'More than that line can take back: % left of %.', greatest(left_qty, 0), coalesce(it ->> 'qty', '0') using errcode = '22023';
    end if;
    price := coalesce((it ->> 'sellPrice')::numeric, (it ->> 'price')::numeric, 0);
    priced := priced || jsonb_build_array(jsonb_build_object('idx', (l ->> 'idx')::int, 'name', coalesce(l ->> 'name', it ->> 'productName'),
      'unit', coalesce(it ->> 'unit', l ->> 'unit'), 'qty', (l ->> 'qty')::numeric, 'shown', l ->> 'shown',
      'condition', case when l ->> 'condition' = 'damaged' then 'damaged' else 'good' end)
      || case when price > 0 then jsonb_build_object('price', price, 'amount', round(price * (l ->> 'qty')::numeric)) else '{}'::jsonb end);
    total := total + case when price > 0 then round(price * (l ->> 'qty')::numeric) else 0 end;
  end loop;
  if jsonb_array_length(priced) = 0 then raise exception 'Nothing to send back.'; end if;
  select coalesce(nullif(btrim(s.name), ''), 'The Store') into nm from staff s where s.shop_id = p_shop and s.user_id = auth.uid() limit 1;
  insert into invoice_asks (shop_id, quote_id, customer_id, kind, lines, amount, reason, note, asked_by, asked_by_name, asked_role, status)
       values (p_shop, p_order, nullif(q.payload ->> 'customerId', ''), 'credit', priced, total,
               left(coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Came back'), 200), left(nullif(btrim(coalesce(p_note, '')), ''), 500),
               auth.uid(), coalesce(nm, 'The Store'),
               (select m.role from shop_members m where m.shop_id = p_shop and m.user_id = auth.uid() limit 1), 'sent')
  returning id into new_id;
  return jsonb_build_object('id', new_id, 'quote_id', p_order, 'kind', 'credit', 'lines', ow_strip_money(priced), 'reason', p_reason, 'note', p_note,
    'asked_by', auth.uid(), 'asked_by_name', coalesce(nm, 'The Store'), 'status', 'sent', 'created_at', now());
end $$;

revoke all on function store_return_ask(uuid, bigint, jsonb, text, text) from public, anon;
grant execute on function store_return_ask(uuid, bigint, jsonb, text, text) to authenticated;

-- The asks already sent with another unit: relabelled to the line's (qty stays: it was right).
do $$
declare
  a record;
  e jsonb;
  it jsonb;
  fixed jsonb;
  changed boolean;
begin
  for a in select x.id, x.lines, q.payload from invoice_asks x join saved_quotes q on q.shop_id = x.shop_id and q.id = x.quote_id
            where x.kind = 'credit' and jsonb_typeof(x.lines) = 'array' loop
    fixed := '[]'::jsonb; changed := false;
    for e in select v from jsonb_array_elements(a.lines) v loop
      it := case when (e ->> 'idx') ~ '^\d+$' then a.payload -> 'items' -> ((e ->> 'idx')::int) end;
      if it is not null and nullif(it ->> 'unit', '') is not null and (e ->> 'unit') is distinct from (it ->> 'unit') then
        e := (e - 'shown') || jsonb_build_object('unit', it ->> 'unit'); changed := true;
      end if;
      fixed := fixed || jsonb_build_array(e);
    end loop;
    if changed then update invoice_asks set lines = fixed where id = a.id; end if;
  end loop;
end $$;

/* ---- 3. a write-off never past the shelf, one stock_log row per report ---- */
create or replace function write_off_stock(p_shop_id uuid, p_report_ids uuid[], p_lines jsonb, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_ids uuid[] := coalesce(p_report_ids, '{}');
  v_lines jsonb := p_lines;
  n int;
  l jsonb;
  one jsonb;
  moved jsonb := '[]'::jsonb;
  changed int := 0;
  v_value numeric := 0;
  res jsonb;
  shelf numeric;
  want record;
  rep_id uuid;
  rep_why text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not has_task(p_shop_id, 'stock.writeoff') then
    raise exception 'Writing off stock is the Manager''s (stock.writeoff).' using errcode = '42501';
  end if;
  if array_length(v_ids, 1) is not null then
    select count(*) into n from stock_reports where shop_id = p_shop_id and id = any(v_ids) and status = 'sent';
    if n <> (select count(distinct x) from unnest(v_ids) x) then
      raise exception 'One of those reports is decided already, or is not this shop''s.';
    end if;
    perform 1 from stock_reports where id = any(v_ids) for update;
  end if;
  if v_lines is null or jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) = 0 then
    select coalesce(jsonb_agg(jsonb_build_object('key', r.key, 'productId', r.product_id, 'variantIdx', r.variant_idx,
                                                 'name', r.name, 'delta', -r.qty, 'report', r.id)), '[]'::jsonb)
      into v_lines from stock_reports r where r.id = any(v_ids);
  end if;
  if jsonb_array_length(v_lines) = 0 then raise exception 'Say which goods move.' using errcode = '22023'; end if;
  -- 0161: never more off than the shelf has -- the books less what has left for orders not yet invoiced.
  for want in select e ->> 'key' as k, max(e ->> 'name') as nm, sum(abs(coalesce((e ->> 'delta')::numeric, 0))) as qty
                from jsonb_array_elements(v_lines) e group by 1 loop
    select coalesce((select s.qty from stock s where s.shop_id = p_shop_id and s.key = want.k), 0)
           - coalesce(ow_held_gone(p_shop_id, want.k), 0) into shelf;
    if want.qty > greatest(shelf, 0) then
      raise exception 'The shelf has only % of %: count it first.', trim_scale(greatest(shelf, 0)), coalesce(want.nm, want.k) using errcode = '22023';
    end if;
  end loop;
  -- 0161: one stock_log row per line, its note naming the report it settles.
  for l in select e from jsonb_array_elements(v_lines) e loop
    rep_id := null; rep_why := null;
    select r.id, r.why into rep_id, rep_why from stock_reports r
     where r.id = any(v_ids) and (r.id::text = l ->> 'report' or (l ->> 'report' is null and r.key = l ->> 'key'))
     limit 1;
    one := manager_apply_stock_lines(p_shop_id, jsonb_build_array(l - 'report'), 'writeoff',
             'Write-off' || coalesce(' · ' || coalesce(rep_why, v_reason), '') || coalesce(' · report ' || rep_id::text, ''), -1);
    changed := changed + coalesce((one ->> 'changed')::int, 0);
    moved := moved || coalesce(one -> 'moved', '[]'::jsonb);
    v_value := v_value + coalesce((one ->> 'value')::numeric, 0);
  end loop;
  res := jsonb_build_object('changed', changed, 'moved', moved, 'value', v_value);
  if array_length(v_ids, 1) is not null then
    update stock_reports set status = 'written_off', decided_by = auth.uid(), decided_at = now()
     where id = any(v_ids);
  end if;
  perform manager_log_decision(p_shop_id, 'stock.writeoff',
    'Wrote off ' || coalesce((select string_agg(abs((m ->> 'delta')::numeric)::text || ' × ' || coalesce(m ->> 'name', m ->> 'key'), ', ')
                                from jsonb_array_elements(res -> 'moved') m), 'nothing')
      || coalesce(' · ' || v_reason, ''),
    nullif((res ->> 'value')::numeric, 0),
    jsonb_build_object('table', 'stock_reports', 'ids', to_jsonb(v_ids)),
    (select coalesce(jsonb_agg(jsonb_build_object('key', m ->> 'key', 'qty', (m ->> 'before')::numeric)), '[]'::jsonb)
       from jsonb_array_elements(res -> 'moved') m),
    (select coalesce(jsonb_agg(jsonb_build_object('key', m ->> 'key', 'qty', (m ->> 'after')::numeric)), '[]'::jsonb)
       from jsonb_array_elements(res -> 'moved') m));
  return jsonb_build_object('ok', true, 'changed', changed, 'reports', to_jsonb(v_ids));
end $$;
revoke all on function write_off_stock(uuid, uuid[], jsonb, text) from public, anon;
grant execute on function write_off_stock(uuid, uuid[], jsonb, text) to authenticated;

/* ---- 4. every product in its own aisle (ROUND-1.md, approved 23 Oct) ---- */
update products p set category = m.cat
  from (values
  ('P269', 'OMEGA Hinges - Normal', 'Hinges'),
  ('P262', 'OXFORD Hinges', 'Hinges'),
  ('P264', 'XY Mulper Hinges - Soft', 'Hinges'),
  ('P271', 'ZAWAINA Hinges - Normal', 'Hinges'),
  ('P273', 'ZAWAINA Hinges - Soft', 'Hinges'),
  ('P266', 'MEGA Mulper - Normal', 'Hinges'),
  ('P323', 'Mulper Frog - KYIKERE', 'Hinges'),
  ('P042', 'Normal Mulper', 'Hinges'),
  ('P044', 'Soft Close Mulper', 'Hinges'),
  ('P371', 'ZIN ZHUANG Soft Close', 'Hinges'),
  ('P522', 'Masasi 15pairs', 'Hinges'),
  ('P293', 'BOVOS Door Handle - Small', 'Handles'),
  ('P381', 'Drawer Handles - Flower', 'Handles'),
  ('P179', 'LAK Handles - Big', 'Handles'),
  ('P177', 'MEGGO Handles', 'Handles'),
  ('P307', 'CH Drawer Locks', 'Locks'),
  ('P291', 'Gate Latch', 'Locks'),
  ('P181', 'PROTEX Drawer Lock', 'Locks'),
  ('P115', 'STEEL MAN Door Lock', 'Locks'),
  ('P409', 'KALE KILIT', 'Locks'),
  ('P051', 'Runners', 'Runners'),
  ('P385', 'Concrete Bits', 'Power Tool Accessories'),
  ('P118', 'Twist Drill Bits', 'Power Tool Accessories'),
  ('P541', 'DCA Circular Blade', 'Power Tool Accessories'),
  ('P136', 'AWARD Planer', 'Tools'),
  ('P143', 'Belt Sander', 'Tools'),
  ('P336', 'BOSCH Jig Saw', 'Tools'),
  ('P279', 'DCA Baby Grinder', 'Tools'),
  ('P277', 'DCA Electric Drill', 'Tools'),
  ('P281', 'DCA Wood Router', 'Tools'),
  ('P086', 'Bow Saw Blade', 'Hand tools'),
  ('P094', 'Bow Saw Blade - Bahco', 'Hand tools'),
  ('P092', 'G-MAN Bow Saw', 'Hand tools'),
  ('P524', 'HandSaw', 'Hand tools'),
  ('P128', 'COLT Hack Saw Flame', 'Hand tools'),
  ('P133', 'WISEUP Hack Saw', 'Hand tools'),
  ('P158', 'OXFORD Tape measure', 'Hand tools'),
  ('P171', 'WISEUP Tape Measure', 'Hand tools'),
  ('P147', 'Spanners', 'Hand tools'),
  ('P313', 'Tri-Square', 'Hand tools'),
  ('P488', 'HU DONG Staple Gun', 'Hand tools'),
  ('P317', 'HANNSON Weighing Scale', 'Hand tools'),
  ('P289', 'KARDDIA Wall Plug', 'Fasteners'),
  ('P285', 'SJS Wall Plugs', 'Fasteners'),
  ('P156', 'LABIO Staple wires', 'Fasteners'),
  ('P154', 'LIBAO Staple wires', 'Fasteners'),
  ('P139', 'Paint Brushes', 'Painting'),
  ('P416', 'ABB Brush', 'Painting'),
  ('P152', 'China Stain', 'Painting'),
  ('P348', 'Sanding Sealer', 'Painting'),
  ('P481', 'Deerfos Sand Paper', 'Painting'),
  ('P145', 'INDASA Rhynolite Sandpaper Rolls', 'Painting'),
  ('P400', 'BAHCO SandFlex', 'Painting'),
  ('P484', 'Masking Tape - Green', 'Painting'),
  ('P149', 'JUMLEE Spray Gun', 'Painting'),
  ('P186', 'Corner Tape', 'Gypsum'),
  ('P111', 'Twisted Curtain Pipe', 'Curtain Fittings'),
  ('P107', 'Chrome Pipe', 'Curtain Fittings'),
  ('P500', 'Brackets', 'Furniture')
  ) m(id, name, cat)
 where p.id = m.id and p.name = m.name and (p.category is null or btrim(p.category) = '' or p.category = 'Furniture');

/* ---- 5. one dash per name ---- */
-- Variant names first, while the product still has the name the list matches.
do $$
declare
  v record;
begin
  for v in select * from (values
  ('P107', 'Chrome Pipe', 'Pipe Sizes', '19mm - Light', '19mm Light'),
  ('P107', 'Chrome Pipe', 'Pipe Sizes', '25mm - Heavy', '25mm Heavy'),
  ('P107', 'Chrome Pipe', 'Pipe Sizes', '25mm - Light', '25mm Light'),
  ('P271', 'ZAWAINA Hinges - Normal', 'Mulper Type', 'Half Bend(Type B)', 'Half Bend (Type B)')
  ) t(id, pname, grp, old, new) loop
    update products p set variants = (
        select jsonb_agg(case when jsonb_typeof(x.e -> 'combo') = 'object' and x.e -> 'combo' ->> v.grp = v.old
                              then jsonb_set(x.e, array['combo', v.grp], to_jsonb(v.new)) else x.e end order by x.ord)
          from jsonb_array_elements(p.variants) with ordinality x(e, ord))
     where p.id = v.id and p.name = v.pname and jsonb_typeof(p.variants) = 'array' and jsonb_array_length(p.variants) > 0;
  end loop;
end $$;

update products p set name = r.new
  from (values
  ('P293', 'BOVOS Door Handle - Small', 'BOVOS Door Handle Small'),
  ('P094', 'Bow Saw Blade - Bahco', 'Bow Saw Blade Bahco'),
  ('P381', 'Drawer Handles - Flower', 'Drawer Handles Flower'),
  ('P435', 'Drawer Runners - Maria', 'Drawer Runners Maria'),
  ('P235', 'Flat Head (CSK) - Self Drilling', 'Flat Head (CSK) Self Drilling'),
  ('P179', 'LAK Handles - Big', 'LAK Handles Big'),
  ('P484', 'Masking Tape - Green', 'Masking Tape Green'),
  ('P266', 'MEGA Mulper - Normal', 'MEGA Mulper Normal'),
  ('P323', 'Mulper Frog - KYIKERE', 'Mulper Frog KYIKERE'),
  ('P269', 'OMEGA Hinges - Normal', 'OMEGA Hinges Normal'),
  ('P264', 'XY Mulper Hinges - Soft', 'XY Mulper Hinges Soft'),
  ('P271', 'ZAWAINA Hinges - Normal', 'ZAWAINA Hinges Normal'),
  ('P273', 'ZAWAINA Hinges - Soft', 'ZAWAINA Hinges Soft')
  ) r(id, old, new)
 where p.id = r.id and p.name = r.old;
