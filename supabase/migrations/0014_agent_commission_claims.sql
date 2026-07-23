-- Supplier-funded bonus commission (agent_promotions/agent_clusters) is
-- money the SHOP owes the AGENT -- unlike the agent's own margin, which
-- they already collect directly from their own client and never touches
-- the shop's books. This table is the payout ledger for that bonus: an
-- agent requests a claim for a completed month, an admin marks it paid
-- once actually settled (cash, mobile money, etc. -- outside this app).
--
-- Deliberately no agent-facing write policy. The claimed amount has real
-- money attached to it, so -- same reasoning as agent-submit-order's floor
-- price recompute -- it's always computed server-side from the agent's own
-- order history by the agent-claim-commission Edge Function (service-role),
-- never trusted from the client. An agent can only ever read their own
-- rows here to see status.
create table agent_commission_claims (
  shop_id uuid not null references shops(id) on delete cascade,
  id bigint generated always as identity primary key,
  agent_id text not null,
  month text not null, -- 'YYYY-MM'
  bonus_amount numeric not null,
  status text not null default 'requested' check (status in ('requested', 'paid')),
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  foreign key (shop_id, agent_id) references agents(shop_id, id) on delete cascade,
  unique (shop_id, agent_id, month)
);
create index agent_commission_claims_shop_idx on agent_commission_claims(shop_id);

alter table agent_commission_claims enable row level security;

create policy "agent views own claims" on agent_commission_claims
  for select using (agent_id = current_agent_id(shop_id));

create policy "admins manage claims" on agent_commission_claims
  for all using (is_shop_admin(shop_id)) with check (is_shop_admin(shop_id));
