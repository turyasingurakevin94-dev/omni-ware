-- 0169 asked of a real database (the Sales app built to its canvas): the team
-- chat -- take, hand, move, notes, a reply by someone else -- and a customer's kind.
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x'),('00000000-0000-0000-0000-00000000000b','manager@x'),
 ('00000000-0000-0000-0000-00000000000d','grace@x'),('00000000-0000-0000-0000-00000000000e','brian@x'),
 ('00000000-0000-0000-0000-00000000000f','accounts@x');
insert into shops(id, name, created_by) values ('11111111-1111-1111-1111-111111111111','Mukasa Hardware','00000000-0000-0000-0000-00000000000a');
insert into shop_members(shop_id,user_id,role) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000a','owner'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000b','manager'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000d','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e','sales'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000f','accounts');
insert into staff(shop_id,id,name,user_id) values
 ('11111111-1111-1111-1111-111111111111','1','Grace Akello','00000000-0000-0000-0000-00000000000d'),
 ('11111111-1111-1111-1111-111111111111','2','Brian Ouma','00000000-0000-0000-0000-00000000000e'),
 ('11111111-1111-1111-1111-111111111111','3','Ruth Nakato','00000000-0000-0000-0000-00000000000b');
insert into customers(shop_id,id,name,phone,debt) values
 ('11111111-1111-1111-1111-111111111111','C1','Kato Construction','0772418220',0);
insert into wa_conversations(shop_id, wa_id, profile_name, last_message_at, last_inbound_at) values
 ('11111111-1111-1111-1111-111111111111','256772418220','Kato', now(), now()),
 ('11111111-1111-1111-1111-111111111111','256701552904','', now(), now());

create table _r(n serial, label text, expect text, got text);
create function _try(label text, expect text, q text) returns void language plpgsql as $$
declare got text := 'ok';
begin
  declare n int; begin execute q; get diagnostics n = row_count;
    if n = 0 and (q ilike 'update%' or q ilike 'delete%') then got := 'refused: 0 rows (row-level security hid them)'; end if;
  exception when others then got := 'refused: ' || sqlerrm; end;
  insert into _r(label, expect, got) values (label, expect, got);
end $$;
grant all on _r, _r_n_seq to authenticated; grant execute on function _try to authenticated;
create function _is(cond_sql text) returns void language plpgsql security definer as $$
declare ok boolean;
begin execute 'select (' || cond_sql || ')' into ok;
  if not coalesce(ok, false) then raise exception 'not so: %', cond_sql; end if; end $$;
grant execute on function _is to authenticated;
create function _conv(w text) returns bigint language sql security definer as $$ select id from wa_conversations where wa_id = w $$;
grant execute on function _conv to authenticated;

set role authenticated;

-- ---------------- chat.take: a new number, first come
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: takes Kato''s chat', 'ok', $q$select take_conversation(_conv('256772418220'))$q$);
select _try('check: Kato is Grace''s, and the chat says she took it', 'ok', $q$select _is($c$(select owner_user_id from wa_conversations where wa_id='256772418220') = '00000000-0000-0000-0000-00000000000d' and (select count(*) from wa_conv_events where kind='taken') = 1$c$)$q$);
select _try('check: the owner''s log has the take', 'ok', $q$select _is($c$(select count(*) from decision_log where task='chat.take' and what like 'Grace Akello took Kato Construction') = 1$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select _try('brian: may not take it from her', 'refused', $q$select take_conversation(_conv('256772418220'))$q$);
select _try('brian: may not write the owner column himself', 'refused', $q$update wa_conversations set owner_user_id = '00000000-0000-0000-0000-00000000000e' where wa_id='256772418220'$q$);
select _try('brian: may still mark the chat read', 'ok', $q$update wa_conversations set last_read_at = now() where wa_id='256772418220'$q$);
select _try('brian: may not hand Grace''s customer on', 'refused', $q$select hand_conversation(_conv('256772418220'), '00000000-0000-0000-0000-00000000000e', 'mine now')$q$);
select _try('brian: may not move a chat (the Manager''s)', 'refused', $q$select move_conversation(_conv('256772418220'), '00000000-0000-0000-0000-00000000000e', null)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
select _try('accounts: may not take a chat', 'refused', $q$select take_conversation(_conv('256701552904'))$q$);

-- ---------------- anyone may reply; the chat's salesperson is told
reset role;
insert into wa_messages(shop_id, conversation_id, wamid, direction, msg_type, body, status, sent_at, sent_by, sent_by_name)
  values ('11111111-1111-1111-1111-111111111111', _conv('256772418220'), 'w1', 'out', 'text', 'Yes, Ssali delivers Friday morning.', 'sent', now(), '00000000-0000-0000-0000-00000000000e', 'Brian Ouma'),
         ('11111111-1111-1111-1111-111111111111', _conv('256772418220'), 'w2', 'out', 'text', 'Sending the price now.', 'sent', now(), '00000000-0000-0000-0000-00000000000d', 'Grace Akello');
set role authenticated;
select _try('check: Brian''s reply pushed Grace; her own did not', 'ok', $q$select _is($c$(select count(*) from push_outbox where kind='chat.reply_by_other' and to_user='00000000-0000-0000-0000-00000000000d' and title = 'Brian Ouma replied to Kato Construction') = 1 and (select count(*) from push_outbox where kind='chat.reply_by_other') = 1$c$)$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('check: who served Kato this year, by messages', 'ok', $q$select _is($c$(select count(*) from chat_served('11111111-1111-1111-1111-111111111111', _conv('256772418220'))) = 2$c$)$q$);

-- ---------------- a team note, never sent; a name in it is pushed
select _try('grace: a note naming Brian', 'ok', $q$insert into wa_notes(shop_id, conversation_id, body, mentions) values ('11111111-1111-1111-1111-111111111111', _conv('256772418220'), '@Brian they pay on Friday.', '{00000000-0000-0000-0000-00000000000e}')$q$);
select _try('check: the note carries her name, and Brian is pushed', 'ok', $q$select _is($c$(select by_name from wa_notes limit 1) = 'Grace Akello' and (select count(*) from push_outbox where kind='chat.note' and to_user='00000000-0000-0000-0000-00000000000e') = 1$c$)$q$);
select _try('grace: may not write a note as Brian', 'refused', $q$insert into wa_notes(shop_id, conversation_id, body, by_user) values ('11111111-1111-1111-1111-111111111111', _conv('256772418220'), 'x', '00000000-0000-0000-0000-00000000000e')$q$);
select _try('check: no message went to the customer for the note', 'ok', $q$select _is($c$(select count(*) from wa_messages) = 2$c$)$q$);

-- ---------------- chat.take: her own customer, to a teammate, with a note
select _try('grace: gives Kato to Brian, with a note', 'ok', $q$select hand_conversation(_conv('256772418220'), '00000000-0000-0000-0000-00000000000e', 'Order #0552 is with them. They pay Friday.')$q$);
select _try('check: Kato is Brian''s; he is pushed with the note', 'ok', $q$select _is($c$(select owner_user_id from wa_conversations where wa_id='256772418220') = '00000000-0000-0000-0000-00000000000e' and (select body from push_outbox where kind='chat.handed' and to_user='00000000-0000-0000-0000-00000000000e') = 'Grace Akello gave you Kato Construction · Order #0552 is with them. They pay Friday.'$c$)$q$);
select _try('grace: may not give it to Accounts', 'refused', $q$select hand_conversation(_conv('256701552904'), '00000000-0000-0000-0000-00000000000f', null)$q$);

-- ---------------- chat.move: the Manager moves anyone
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: moves Kato back to Grace', 'ok', $q$select move_conversation(_conv('256772418220'), '00000000-0000-0000-0000-00000000000d', null)$q$);
select _try('check: both salespeople are told, and the log says moved', 'ok', $q$select _is($c$(select owner_user_id from wa_conversations where wa_id='256772418220') = '00000000-0000-0000-0000-00000000000d' and (select count(*) from push_outbox where kind='chat.handed' and to_user='00000000-0000-0000-0000-00000000000d') = 1 and (select count(*) from push_outbox where kind='chat.handed' and to_user='00000000-0000-0000-0000-00000000000e') = 2 and (select count(*) from decision_log where task='chat.move') = 1$c$)$q$);
select _try('manager: may take a new number too', 'ok', $q$select take_conversation(_conv('256701552904'))$q$);

-- ---------------- customer.edit: the kind
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('sales: adds a customer as a Contractor', 'ok', $q$insert into customers(shop_id,id,name,debt,kind) values ('11111111-1111-1111-1111-111111111111','C2','Nansana Hardware',0,'contractor')$q$);
select _try('sales: may not change the kind after', 'refused', $q$update customers set kind='reseller' where id='C2'$q$);
select _try('sales: may still edit the rest', 'ok', $q$update customers set location='Nansana' where id='C2'$q$);
select _try('sales: a kind that is not one of the three is refused', 'refused', $q$update customers set kind='vip' where id='C1'$q$);
select _try('sales: sets a kind where none was set', 'ok', $q$update customers set kind='retail' where id='C1'$q$);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select _try('manager: changes the kind', 'ok', $q$update customers set kind='reseller' where id='C2'$q$);
select _try('check: Reseller now', 'ok', $q$select _is($c$(select kind from customers where id='C2') = 'reseller'$c$)$q$);

-- ---------------- who is on now
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select _try('grace: is on', 'ok', $q$select touch_presence('11111111-1111-1111-1111-111111111111')$q$);
select _try('grace: again, one row', 'ok', $q$select touch_presence('11111111-1111-1111-1111-111111111111')$q$);
select _try('check: one row for Grace', 'ok', $q$select _is($c$(select count(*) from member_presence) = 1$c$)$q$);
select _try('grace: may not write presence for someone else', 'refused', $q$insert into member_presence(shop_id,user_id) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000e')$q$);

reset role;
select case when (expect='ok' and got='ok') or (expect='refused' and got like 'refused%') then 'PASS' else 'FAIL' end, label, got from _r order by n;
