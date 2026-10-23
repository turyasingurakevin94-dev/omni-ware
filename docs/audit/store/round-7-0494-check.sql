-- Round 7 (minor): who sent the return on #0494, and why the Store app now calls them "Someone". Read-only.
-- One row per return on that order: the name stored with it, the sender's membership and chosen name,
-- their staff record, and the name on their login.
select a.id, a.status, a.created_at,
       a.asked_by_name                                   as stored_name,
       m.role                                            as member_role,
       m.display_name                                    as chosen_name,
       s.name                                            as staff_name,
       coalesce(u.raw_user_meta_data ->> 'name', u.raw_user_meta_data ->> 'full_name') as login_name,
       case when a.asked_by is null then 'no sender id'
            when m.user_id is null then 'not a member now'
            when nullif(btrim(m.display_name), '') is not null then 'has a chosen name'
            else 'member, no chosen name' end           as why
  from invoice_asks a
  left join shop_members m on m.shop_id = a.shop_id and m.user_id = a.asked_by
  left join staff s on s.shop_id = a.shop_id and s.user_id = a.asked_by
  left join auth.users u on u.id = a.asked_by
 where a.kind = 'credit' and a.quote_id = 494
 order by a.created_at;
