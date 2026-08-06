-- Phase 5: broadcasts. Two additions, both consent-shaped.
--
-- wa_conversations.opt_out: the STOP switch. The broadcast audience is
-- people who have MESSAGED THE SHOP (an existing relationship, the
-- cleanest consent there is) minus anyone who has said stop -- and the
-- webhook honours STOP/START in the customer's own words, instantly,
-- because an opt-out that waits for a human defeats its purpose.
alter table wa_conversations add column opt_out boolean not null default false;

-- wa_campaigns: one row per broadcast actually sent. The message rows
-- carry the campaign id in their payload, and delivery statuses already
-- flow back through the webhook by wamid -- so sent/delivered/read per
-- campaign is DERIVED from messages, never stored, and cannot drift
-- (the media library's usage-count reasoning, third appearance).
create table wa_campaigns (
  -- ALWAYS: campaigns are created only by wa-send (service role); a
  -- client-assigned id arriving here is a bug. Same as wa_messages.
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  template_name text not null,
  body text not null,
  recipients integer not null,
  created_at timestamptz not null default now()
);
create index wa_campaigns_shop_idx on wa_campaigns(shop_id, created_at desc);

alter table wa_campaigns enable row level security;
-- Members read; every write path goes through wa-send.
create policy "shop members read" on wa_campaigns
  for select using (is_shop_member(shop_id));
