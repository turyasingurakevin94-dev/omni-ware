-- Round 1 (data integrity): a READ-ONLY preview for DATA-05 and DATA-06.
-- It changes nothing. Run it in the Supabase SQL editor and paste the two
-- result tables back, so the exact moves and renames go into ROUND-1.md for
-- approval before migration 0161 touches a product.

-- 1. DATA-05: every product in "Furniture" or with no category, and the aisle
--    the name rules propose. "(decide)" means no rule matched: name the aisle.
with rules(pat, cat) as (values
  ('hinge',                     'Hinges'),
  ('handle|knob|pull',          'Handles'),
  ('padlock|lock|latch|cylinder','Locks'),
  ('runner|drawer slide',       'Runners')
)
select p.id, p.name, coalesce(p.category, '(none)') as now_in,
       coalesce((select r.cat from rules r where p.name ~* r.pat limit 1), '(decide)') as proposed
  from products p
 where p.category is null or btrim(p.category) = '' or p.category = 'Furniture'
 order by proposed, p.name;

-- The aisles that exist now, and how many products each holds.
select coalesce(nullif(btrim(category), ''), '(none)') as category, count(*) as products
  from products group by 1 order by 1;

-- 2. DATA-06: names that use " - " inside the name (the variant separator is
--    " — "), or a bracket with no space before it, and the proposed name.
select p.id, p.name as now_named,
       regexp_replace(regexp_replace(p.name, '\s+-\s+', ' ', 'g'), '(\S)\(', '\1 (', 'g') as proposed
  from products p
 where p.name ~ '\s-\s' or p.name ~ '\S\('
 order by p.name;
