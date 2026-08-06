-- The WhatsApp inbox: conversations and messages, plus the number map
-- that routes webhook traffic to a shop.
--
-- OWNERSHIP IS THE WHOLE DESIGN HERE. These tables are written by the
-- wa-webhook Edge Function (inbound messages, echoes of what the shop
-- sends from its phone, delivery statuses) and by wa-send (replies made
-- from the admin) -- both running as the service role. The browser only
-- READS them, with one deliberate exception: last_read_at, the admin's
-- own read marker. So unlike every diff-synced table, ids are GENERATED
-- ALWAYS -- a client-assigned id arriving here is a bug, and the
-- database should say so, the same reasoning as agent_promotions.
--
-- Messages are append-only history. Nothing updates a message body;
-- statuses move sent -> delivered -> read by wamid, and duplicates
-- (Meta retries, coexistence echoes) bounce off the unique wamid.

-- Which business phone number belongs to which shop. Written from the
-- admin during connection setup (a phone_number_id is an identifier,
-- not a secret); read by the webhook to route each event, which is what
-- makes this whole thing multi-shop-safe from day one.
create table wa_numbers (
  shop_id uuid not null references shops(id) on delete cascade,
  phone_number_id text not null,
  created_at timestamptz not null default now(),
  primary key (phone_number_id)
);
create index wa_numbers_shop_idx on wa_numbers(shop_id);

alter table wa_numbers enable row level security;
create policy "shop members full access" on wa_numbers
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

create table wa_conversations (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  -- The customer's WhatsApp id (their number, in Meta's format). One
  -- conversation per customer per shop, however many messages flow.
  wa_id text not null,
  profile_name text,
  last_message_at timestamptz,
  -- When the CUSTOMER last wrote. This is the fact the 24-hour free
  -- reply window hangs off, so it is stored, not derived on every send.
  last_inbound_at timestamptz,
  -- The admin's read marker -- the one column the browser may write.
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, wa_id)
);
create index wa_conversations_shop_idx on wa_conversations(shop_id, last_message_at desc);

alter table wa_conversations enable row level security;
create policy "shop members read" on wa_conversations
  for select using (is_shop_member(shop_id));
-- Update only -- there is no insert/delete policy, so the browser cannot
-- fabricate or destroy a conversation; those belong to the webhook.
create policy "shop members update read marker" on wa_conversations
  for update using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));

create table wa_messages (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  conversation_id bigint not null references wa_conversations(id) on delete cascade,
  -- WhatsApp's own message id. Meta retries webhooks and coexistence
  -- echoes travel their own path, so the same message can knock twice;
  -- unique here means it lands once.
  wamid text not null,
  direction text not null check (direction in ('in','out')),
  msg_type text not null default 'text',
  body text,
  -- The full message object for anything richer than text (an image, a
  -- location, an ORDER -- phase 3 reads carts out of exactly this).
  payload jsonb,
  -- Outbound delivery state: sent -> delivered -> read, or failed.
  -- Null for inbound, which has no such lifecycle.
  status text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, wamid)
);
create index wa_messages_conv_idx on wa_messages(conversation_id, sent_at);

alter table wa_messages enable row level security;
create policy "shop members read" on wa_messages
  for select using (is_shop_member(shop_id));
-- No insert/update/delete policies at all: every write path to a
-- message goes through an Edge Function holding the service role.
