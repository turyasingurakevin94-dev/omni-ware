-- Round 1 (data integrity), preview part 2. READ-ONLY: it changes nothing.
-- The Supabase SQL editor shows only the LAST result of a script, so this is
-- ONE statement. Paste the whole result back.
--   section 'move'    DATA-05: products in Furniture or with no category, and the aisle proposed
--   section 'aisle'   every category and how many products it holds now (for the letter check)
--   section 'variant' DATA-06: variant names with " - " or a bracket with no space ("Half Bend(Type B)")
with rules(pat, cat) as (values
  ('hinge',                      'Hinges'),
  ('handle|knob|pull',           'Handles'),
  ('padlock|lock|latch|cylinder','Locks'),
  ('runner|drawer slide',        'Runners')
)
select 'move' as section, p.id, p.name, coalesce(nullif(btrim(p.category), ''), '(none)') as now_in,
       coalesce((select r.cat from rules r where p.name ~* r.pat limit 1), '(decide)') as proposed
  from products p
 where p.category is null or btrim(p.category) = '' or p.category = 'Furniture'
union all
select 'aisle', null, coalesce(nullif(btrim(category), ''), '(none)'), count(*)::text, null
  from products group by 3
union all
select 'variant', p.id, p.name || ' — ' || c.value, c.key,
       regexp_replace(regexp_replace(c.value, '\s+-\s+', ' ', 'g'), '(\S)\(', '\1 (', 'g')
  from products p
  cross join lateral jsonb_array_elements(case when jsonb_typeof(p.variants) = 'array' then p.variants else '[]'::jsonb end) v
  cross join lateral jsonb_each_text(case when jsonb_typeof(v -> 'combo') = 'object' then v -> 'combo' else '{}'::jsonb end) c
 where c.value ~ '\s-\s' or c.value ~ '\S\('
order by 1, 5, 3;
