-- 0169 Sales, seventh (the app built to its approved canvas, 28 Oct 2026;
-- docs/audit/sales/BUILD-2026-10-28.md): the team chat, and the server
-- pieces the canvas needs that the books lack.
--
-- Kevin's decisions of 28 Oct (docs/decision-rights.md):
--   * a salesperson takes a new number first-come (chat.take); they can hand
--     their own customer to a teammate with a note; the Manager moves anyone
--     (chat.move). Each is logged in the chat and in decision_log, and the
--     person given the chat gets a push;
--   * anyone may reply so no customer waits (msg.reply); the reply carries
--     the sender's name (0118 already stamps it) and the chat's salesperson
--     gets a push;
--   * Sales sets a customer's kind when adding them; after that only the
--     Manager changes it (customer.edit).
--
--   1. wa_conversations.owner_user_id / owner_at: the chat's salesperson.
--      Changed only through the three functions below; a member's update
--      (the read marker, 0052) can no longer touch it.
--   2. wa_conv_events: what happened to a chat (taken, handed, moved), the
--      line the chat shows ("Ruth gave Kato to Grace"). Members read; only
--      the functions write.
--   3. take_conversation(conv), hand_conversation(conv, to, note),
--      move_conversation(conv, to, note): security definer, checked by role.
--      Pushes chat.handed (to the new salesperson; on a move, the one it was
--      taken from too).
--   4. wa_notes: team notes in a chat, never sent to the customer. A note
--      that names a teammate (@Brian) pushes them (chat.note).
--   5. wa_messages: a reply sent by someone other than the chat's
--      salesperson pushes the salesperson (chat.reply_by_other).
--   6. customers.kind: contractor | reseller | retail. Set by whoever adds
--      the customer; once set, only the Manager (or the owner) changes it.
--   7. member_presence + touch_presence(shop): "3 of the team on now".
--   8. chat_served(shop, conv): messages each person sent this customer this
--      year (C4 "Who served Kato").
--
-- Applied by hand, after 0168. Safe to run twice.
--
-- CHECK AFTERWARDS:
--   select column_name from information_schema.columns where table_name = 'wa_conversations' and column_name in ('owner_user_id', 'owner_at');
--   select to_regclass('public.wa_conv_events'), to_regclass('public.wa_notes'), to_regclass('public.member_presence');
--   select role, task from role_tasks where task in ('chat.take', 'chat.move') order by 1, 2;
--   select column_name from information_schema.columns where table_name = 'customers' and column_name = 'kind';
--
-- ROLLBACK:
--   drop trigger if exists wa_conversations_owner_guard on wa_conversations; drop trigger if exists wa_messages_reply_push on wa_messages;
--   drop trigger if exists wa_notes_push on wa_notes; drop trigger if exists customers_kind_guard on customers;
--   drop function if exists take_conversation(bigint); drop function if exists hand_conversation(bigint, uuid, text);
--   drop function if exists move_conversation(bigint, uuid, text); drop function if exists touch_presence(uuid, bigint, boolean);
--   drop function if exists chat_served(uuid, bigint);
--   delete from role_tasks where task in ('chat.take', 'chat.move');
--   (the new columns and tables can stay: nothing else reads them)

-- ---------------------------------------------------------------------
-- 0. The caller's role in a shop, and their display name.
create or replace function ow_my_role(p_shop_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select m.role from shop_members m where m.shop_id = p_shop_id and m.user_id = auth.uid() limit 1
$$;
revoke all on function ow_my_role(uuid) from public, anon;
grant execute on function ow_my_role(uuid) to authenticated;

create or replace function ow_person_name(p_shop_id uuid, p_user uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(trim(s.name), '') from staff s where s.shop_id = p_shop_id and s.user_id = p_user limit 1),
    (select case m.role when 'owner' then 'The owner' when 'manager' then 'The manager' else 'A teammate' end
       from shop_members m where m.shop_id = p_shop_id and m.user_id = p_user limit 1),
    'A teammate')
$$;
revoke all on function ow_person_name(uuid, uuid) from public, anon;
grant execute on function ow_person_name(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 1. The chat's salesperson.
alter table wa_conversations add column if not exists owner_user_id uuid references auth.users(id) on delete set null;
alter table wa_conversations add column if not exists owner_at timestamptz;
create index if not exists wa_conversations_owner_idx on wa_conversations (shop_id, owner_user_id);

-- Only the functions below change who has a chat; the read marker stays a member's to write.
create or replace function wa_conversations_owner_guard() returns trigger
language plpgsql as $$
begin
  if (new.owner_user_id is distinct from old.owner_user_id or new.owner_at is distinct from old.owner_at)
     and coalesce(current_setting('ow.chat_owner', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'Who has a chat changes only by taking, handing or moving it.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists wa_conversations_owner_guard on wa_conversations;
create trigger wa_conversations_owner_guard before update on wa_conversations
  for each row execute function wa_conversations_owner_guard();

-- ---------------------------------------------------------------------
-- 2. What happened to a chat.
create table if not exists wa_conv_events (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  conversation_id bigint not null references wa_conversations(id) on delete cascade,
  kind text not null check (kind in ('taken', 'handed', 'moved')),
  by_user uuid references auth.users(id) on delete set null,
  by_name text,
  from_user uuid references auth.users(id) on delete set null,
  to_user uuid references auth.users(id) on delete set null,
  to_name text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists wa_conv_events_conv_idx on wa_conv_events (conversation_id, created_at);
alter table wa_conv_events enable row level security;
drop policy if exists "shop members read" on wa_conv_events;
create policy "shop members read" on wa_conv_events for select using (is_shop_member(shop_id));

-- ---------------------------------------------------------------------
-- 3. Take, hand, move.
create or replace function ow_chat_set_owner(c wa_conversations, p_to uuid, p_kind text, p_note text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me text := ow_person_name(c.shop_id, auth.uid());
  to_name text := case when p_to is null then null else ow_person_name(c.shop_id, p_to) end;
  who text := coalesce((select cu.name from customers cu where cu.shop_id = c.shop_id
                          and right(regexp_replace(coalesce(cu.phone, ''), '[^0-9]', '', 'g'), 9) = right(c.wa_id, 9) limit 1),
                       nullif(c.profile_name, ''), '+' || c.wa_id);
  what text;
begin
  perform set_config('ow.chat_owner', 'on', true);
  update wa_conversations set owner_user_id = p_to, owner_at = now() where id = c.id;
  insert into wa_conv_events (shop_id, conversation_id, kind, by_user, by_name, from_user, to_user, to_name, note)
       values (c.shop_id, c.id, p_kind, auth.uid(), me, c.owner_user_id, p_to, to_name, nullif(trim(coalesce(p_note, '')), ''));
  what := case p_kind when 'taken' then me || ' took ' || who
                      when 'handed' then me || ' gave ' || who || ' to ' || coalesce(to_name, 'a teammate')
                      else me || ' moved ' || who || ' to ' || coalesce(to_name, 'a teammate') end;
  if to_regclass('public.decision_log') is not null then
    begin
      insert into decision_log (shop_id, by, by_name, role, task, what, ref)
      values (c.shop_id, auth.uid(), me, ow_my_role(c.shop_id), case p_kind when 'moved' then 'chat.move' else 'chat.take' end, what,
              jsonb_build_object('table', 'wa_conversations', 'id', c.id));
    exception when others then raise notice 'decision_log: % (%)', sqlerrm, sqlstate;
    end;
  end if;
  if p_kind in ('handed', 'moved') then
    perform ow_push(c.shop_id, 'chat.handed', who || ' is yours now',
                    me || ' gave you ' || who || coalesce(' · ' || nullif(trim(coalesce(p_note, '')), ''), ''),
                    p_to, null, null, jsonb_build_object('table', 'wa_conversations', 'id', c.id), 'chat.handed:' || c.id || ':' || p_to || ':' || extract(epoch from clock_timestamp())::bigint);
    if p_kind = 'moved' and c.owner_user_id is not null and c.owner_user_id is distinct from p_to then
      perform ow_push(c.shop_id, 'chat.handed', who || ' moved to ' || coalesce(to_name, 'a teammate'),
                      me || ' moved ' || who || ' to ' || coalesce(to_name, 'a teammate'),
                      c.owner_user_id, null, null, jsonb_build_object('table', 'wa_conversations', 'id', c.id), 'chat.moved:' || c.id || ':' || c.owner_user_id || ':' || extract(epoch from clock_timestamp())::bigint);
    end if;
  end if;
end $$;
revoke all on function ow_chat_set_owner(wa_conversations, uuid, text, text) from public, anon, authenticated;

-- A new number: the first to take it has it.
create or replace function take_conversation(p_conv bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare c wa_conversations;
begin
  select * into c from wa_conversations where id = p_conv for update;
  if not found then raise exception 'That chat is not here any more.' using errcode = 'P0002'; end if;
  if not (is_shop_admin(c.shop_id) or has_task(c.shop_id, 'chat.take')) then
    raise exception 'Taking a chat needs chat.take.' using errcode = '42501';
  end if;
  if c.owner_user_id is not null then
    if c.owner_user_id = auth.uid() then return jsonb_build_object('ok', true, 'owner', c.owner_user_id); end if;
    raise exception '% has this chat already.', ow_person_name(c.shop_id, c.owner_user_id) using errcode = 'OWCHT';
  end if;
  perform ow_chat_set_owner(c, auth.uid(), 'taken', null);
  return jsonb_build_object('ok', true, 'owner', auth.uid());
end $$;
revoke all on function take_conversation(bigint) from public, anon;
grant execute on function take_conversation(bigint) to authenticated;

-- Your own customer, to a teammate, with a note.
create or replace function hand_conversation(p_conv bigint, p_to uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare c wa_conversations;
begin
  select * into c from wa_conversations where id = p_conv for update;
  if not found then raise exception 'That chat is not here any more.' using errcode = 'P0002'; end if;
  if not (is_shop_admin(c.shop_id) or has_task(c.shop_id, 'chat.take')) then
    raise exception 'Handing a chat needs chat.take.' using errcode = '42501';
  end if;
  if c.owner_user_id is distinct from auth.uid() and not (is_shop_admin(c.shop_id) or has_task(c.shop_id, 'chat.move')) then
    raise exception 'Only the chat''s salesperson hands it on; the Manager moves any chat.' using errcode = '42501';
  end if;
  if p_to is null or not exists (select 1 from shop_members m where m.shop_id = c.shop_id and m.user_id = p_to and m.role in ('sales', 'manager', 'owner')) then
    raise exception 'Give it to someone on the sales team.' using errcode = '22023';
  end if;
  if p_to = c.owner_user_id then return jsonb_build_object('ok', true, 'owner', p_to); end if;
  perform ow_chat_set_owner(c, p_to, case when c.owner_user_id = auth.uid() then 'handed' else 'moved' end, p_note);
  return jsonb_build_object('ok', true, 'owner', p_to);
end $$;
revoke all on function hand_conversation(bigint, uuid, text) from public, anon;
grant execute on function hand_conversation(bigint, uuid, text) to authenticated;

-- The Manager moves any chat.
create or replace function move_conversation(p_conv bigint, p_to uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare c wa_conversations;
begin
  select * into c from wa_conversations where id = p_conv for update;
  if not found then raise exception 'That chat is not here any more.' using errcode = 'P0002'; end if;
  if not (is_shop_admin(c.shop_id) or has_task(c.shop_id, 'chat.move')) then
    raise exception 'Moving a chat needs chat.move.' using errcode = '42501';
  end if;
  if p_to is null or not exists (select 1 from shop_members m where m.shop_id = c.shop_id and m.user_id = p_to and m.role in ('sales', 'manager', 'owner')) then
    raise exception 'Give it to someone on the sales team.' using errcode = '22023';
  end if;
  if p_to = c.owner_user_id then return jsonb_build_object('ok', true, 'owner', p_to); end if;
  perform ow_chat_set_owner(c, p_to, 'moved', p_note);
  return jsonb_build_object('ok', true, 'owner', p_to);
end $$;
revoke all on function move_conversation(bigint, uuid, text) from public, anon;
grant execute on function move_conversation(bigint, uuid, text) to authenticated;

insert into role_tasks (role, task) values
  ('sales', 'chat.take'),
  ('manager', 'chat.take'),
  ('manager', 'chat.move')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 4. Team notes, never sent to the customer.
create table if not exists wa_notes (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  conversation_id bigint not null references wa_conversations(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  by_user uuid not null default auth.uid() references auth.users(id) on delete set null,
  by_name text,
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists wa_notes_conv_idx on wa_notes (conversation_id, created_at);
alter table wa_notes enable row level security;
drop policy if exists "shop members read" on wa_notes;
create policy "shop members read" on wa_notes for select using (is_shop_member(shop_id));
drop policy if exists "members write their own" on wa_notes;
create policy "members write their own" on wa_notes for insert
  with check (is_shop_member(shop_id) and by_user = auth.uid()
              and exists (select 1 from wa_conversations c where c.id = conversation_id and c.shop_id = wa_notes.shop_id));

create or replace function wa_notes_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid; who text;
begin
  new.by_name := coalesce(nullif(trim(coalesce(new.by_name, '')), ''), ow_person_name(new.shop_id, new.by_user));
  select coalesce((select cu.name from customers cu join wa_conversations c on c.id = new.conversation_id
                    where cu.shop_id = new.shop_id and right(regexp_replace(coalesce(cu.phone, ''), '[^0-9]', '', 'g'), 9) = right(c.wa_id, 9) limit 1),
                  (select coalesce(nullif(c.profile_name, ''), '+' || c.wa_id) from wa_conversations c where c.id = new.conversation_id)) into who;
  foreach u in array coalesce(new.mentions, '{}') loop
    if exists (select 1 from shop_members m where m.shop_id = new.shop_id and m.user_id = u) then
      perform ow_push(new.shop_id, 'chat.note', new.by_name || ' · a note on ' || coalesce(who, 'a chat'), left(new.body, 300),
                      u, null, null, jsonb_build_object('table', 'wa_conversations', 'id', new.conversation_id), null);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists wa_notes_push on wa_notes;
create trigger wa_notes_push before insert on wa_notes for each row execute function wa_notes_push();

-- ---------------------------------------------------------------------
-- 5. Anyone may reply; the chat's salesperson is told.
create or replace function wa_messages_reply_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare c wa_conversations; who text;
begin
  if new.direction <> 'out' or new.sent_by is null then return new; end if;
  select * into c from wa_conversations where id = new.conversation_id;
  if not found or c.owner_user_id is null or c.owner_user_id = new.sent_by then return new; end if;
  who := coalesce((select cu.name from customers cu where cu.shop_id = c.shop_id
                     and right(regexp_replace(coalesce(cu.phone, ''), '[^0-9]', '', 'g'), 9) = right(c.wa_id, 9) limit 1),
                  nullif(c.profile_name, ''), '+' || c.wa_id);
  perform ow_push(c.shop_id, 'chat.reply_by_other',
                  coalesce(nullif(new.sent_by_name, ''), ow_person_name(c.shop_id, new.sent_by)) || ' replied to ' || who,
                  left(coalesce(new.body, 'A message'), 300), c.owner_user_id, null, null,
                  jsonb_build_object('table', 'wa_conversations', 'id', c.id), 'chat.reply:' || new.id);
  return new;
exception when others then
  raise notice 'chat.reply_by_other: % (%)', sqlerrm, sqlstate;
  return new;
end $$;
drop trigger if exists wa_messages_reply_push on wa_messages;
create trigger wa_messages_reply_push after insert on wa_messages for each row execute function wa_messages_reply_push();

-- ---------------------------------------------------------------------
-- 6. A customer's kind: set when adding them; after that, the Manager's.
alter table customers add column if not exists kind text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'customers_kind_check') then
    alter table customers add constraint customers_kind_check check (kind is null or kind in ('contractor', 'reseller', 'retail'));
  end if;
end $$;
create or replace function customers_kind_guard() returns trigger
language plpgsql as $$
begin
  if old.kind is not null and new.kind is distinct from old.kind and auth.uid() is not null
     and not (is_shop_admin(new.shop_id) or coalesce(ow_my_role(new.shop_id), '') = 'manager') then
    raise exception 'A customer''s kind is changed by the Manager.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists customers_kind_guard on customers;
create trigger customers_kind_guard before update on customers for each row execute function customers_kind_guard();

-- ---------------------------------------------------------------------
-- 7. Who is on now.
create table if not exists member_presence (
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  -- The chat they have open, and when they last typed in it ("Brian is typing a reply here").
  conv_id bigint,
  typing_at timestamptz,
  primary key (shop_id, user_id)
);
alter table member_presence add column if not exists conv_id bigint;
alter table member_presence add column if not exists typing_at timestamptz;
alter table member_presence enable row level security;
drop policy if exists "shop members read" on member_presence;
create policy "shop members read" on member_presence for select using (is_shop_member(shop_id));
create or replace function touch_presence(p_shop_id uuid, p_conv bigint default null, p_typing boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_shop_member(p_shop_id) then return; end if;
  insert into member_presence (shop_id, user_id, seen_at, conv_id, typing_at)
       values (p_shop_id, auth.uid(), now(), p_conv, case when p_typing then now() end)
  on conflict (shop_id, user_id) do update
     set seen_at = excluded.seen_at, conv_id = excluded.conv_id,
         typing_at = case when p_typing then now() when excluded.conv_id is distinct from member_presence.conv_id then null else member_presence.typing_at end;
end $$;
revoke all on function touch_presence(uuid, bigint, boolean) from public, anon;
grant execute on function touch_presence(uuid, bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Who served a customer this year: messages each person sent in the chat.
create or replace function chat_served(p_shop_id uuid, p_conv bigint)
returns table (user_id uuid, name text, messages bigint)
language sql stable security definer set search_path = public as $$
  select m.sent_by, ow_person_name(p_shop_id, m.sent_by), count(*)
    from wa_messages m
   where is_shop_member(p_shop_id) and m.shop_id = p_shop_id and m.conversation_id = p_conv
     and m.direction = 'out' and m.sent_by is not null
     and m.sent_at >= date_trunc('year', now())
   group by m.sent_by
   order by count(*) desc
$$;
revoke all on function chat_served(uuid, bigint) from public, anon;
grant execute on function chat_served(uuid, bigint) to authenticated;
