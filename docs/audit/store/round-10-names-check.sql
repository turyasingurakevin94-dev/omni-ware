-- Store round 10 (STO-WORD-11): which members have no name the apps can show. Read-only.
-- One row per member with no display_name and no usable staff name: these read "Someone" on a
-- Store phone today. Their login email is shown only so Kevin can tell who they are.
select m.role,
       u.email,
       m.display_name,
       (select s.name from staff s where s.shop_id = m.shop_id and s.user_id = m.user_id limit 1) as staff_name,
       sh.name as shop,
       m.user_id
  from shop_members m
  join shops sh on sh.id = m.shop_id
  left join auth.users u on u.id = m.user_id
 where nullif(btrim(m.display_name), '') is null
   and not exists (select 1 from staff s where s.shop_id = m.shop_id and s.user_id = m.user_id
                    and nullif(btrim(s.name), '') is not null and btrim(s.name) !~ '@' and btrim(s.name) !~ '^\S*\d\S*$')
 order by sh.name, m.role;
