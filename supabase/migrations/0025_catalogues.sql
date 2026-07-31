-- An agent's public, shareable product catalogue. Deliberately NOT an
-- online shop -- there is no price column here, no cart, no order/payment
-- table this feature writes to at all. A visitor can browse product names
-- and request a quotation; every path from there ends at contacting the
-- agent directly (phone/WhatsApp), never at a transaction with the
-- platform. That's a structural fact of this schema, not just a UI
-- choice: there is nothing here to attach a "buy" button to.
--
-- slug is globally unique (not scoped per shop) since it's a public URL
-- path -- catalogue-public/{slug}, not catalogue-public/{shopId}/{slug}.
create table catalogues (
  shop_id uuid not null references shops(id) on delete cascade,
  agent_id text not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  headline text,
  updated_at timestamptz not null default now(),
  primary key (shop_id, agent_id),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade
);

alter table catalogues enable row level security;
create policy "agent manages own catalogue" on catalogues
  for all using (agent_id = current_agent_id(shop_id)) with check (agent_id = current_agent_id(shop_id));

-- One row per "request a quotation" submission from the public page. Only
-- ever written by the catalogue-public Edge Function using the
-- service-role key -- there is deliberately no insert policy for either
-- an anonymous visitor or an authenticated agent, since an agent should
-- never be able to fabricate their own inbound leads, and a public
-- unauthenticated client must never get direct table access at all (the
-- Edge Function is the only trust boundary here, same reasoning as
-- agent-submit-order never trusting a client-supplied price).
create table catalogue_inquiries (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  agent_id text not null,
  product_id text,
  variant_idx text,
  customer_name text not null,
  customer_phone text not null,
  message text,
  agent_client_id bigint,
  created_at timestamptz not null default now(),
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade,
  foreign key (shop_id, agent_client_id) references agent_clients(shop_id, id) on delete set null
);
create index catalogue_inquiries_agent_idx on catalogue_inquiries(shop_id, agent_id);

alter table catalogue_inquiries enable row level security;
create policy "agent views own inquiries" on catalogue_inquiries
  for select using (agent_id = current_agent_id(shop_id));
