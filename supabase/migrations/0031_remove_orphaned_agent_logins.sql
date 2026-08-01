-- Removes the auth logins left behind by 0029.
--
-- Deleting the agent rows there did not remove the Supabase auth users
-- underneath them -- agents.user_id was ON DELETE RESTRICT (0028), not
-- cascade, precisely so removing an agent could never silently destroy a
-- login. That left four users belonging to nothing.
--
-- Each delete is guarded rather than assumed safe. One of these logins
-- being ALSO a shop member or a staff member is entirely possible (the
-- same person can be an admin and an agent), and deleting it would lock
-- a real person out of the admin app -- an unrecoverable outcome from a
-- cleanup step. The guards make that impossible by construction: a user
-- still referenced anywhere is skipped and reported, not deleted.
do $$
declare
  target_ids uuid[] := array[
    'ce423130-d231-4707-acdd-06b838d95740',  -- Joab
    '58122dc3-1db3-4deb-82ec-603bfe8d9781',  -- joan
    'c8e0d91b-7368-480c-90ee-dbb5eea8d9b2',  -- Paul
    '5960968e-c51b-4607-a4aa-89d595af1310'   -- Dickson
  ]::uuid[];
  still_linked record;
  deleted_count int;
  found_count int;
begin
  select count(*) into found_count from auth.users where id = any(target_ids);
  raise notice 'Found % of 4 target login(s) still present.', found_count;

  for still_linked in
    select u.id, u.email,
           exists(select 1 from public.shop_members m where m.user_id = u.id) as is_member,
           exists(select 1 from public.staff s      where s.user_id = u.id) as is_staff,
           exists(select 1 from public.agents a     where a.user_id = u.id) as is_agent
      from auth.users u
     where u.id = any(target_ids)
       and (   exists(select 1 from public.shop_members m where m.user_id = u.id)
            or exists(select 1 from public.staff s      where s.user_id = u.id)
            or exists(select 1 from public.agents a     where a.user_id = u.id))
  loop
    raise notice 'SKIPPED % (%) -- still linked: member=%, staff=%, agent=%',
      still_linked.email, still_linked.id,
      still_linked.is_member, still_linked.is_staff, still_linked.is_agent;
  end loop;

  delete from auth.users u
   where u.id = any(target_ids)
     and not exists (select 1 from public.shop_members m where m.user_id = u.id)
     and not exists (select 1 from public.staff s      where s.user_id = u.id)
     and not exists (select 1 from public.agents a     where a.user_id = u.id);
  get diagnostics deleted_count = row_count;

  raise notice 'Deleted % orphaned agent login(s).', deleted_count;
end $$;
