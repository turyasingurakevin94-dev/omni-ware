-- Ledger of Airtel Money Collection (USSD Push) attempts. A row is created
-- when a payment is initiated (reference = the transaction.id we send
-- Airtel) and updated by the airtel-collection-callback edge function once
-- Airtel posts the outcome. quote_id is nullable because the initiation
-- flow that sets it doesn't exist yet -- the callback still records the
-- ledger entry even if it's never linked to an order.
create table airtel_transactions (
  id bigint generated always as identity primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  quote_id bigint references saved_quotes(id),
  reference text not null,
  airtel_money_id text,
  status text not null default 'pending', -- pending | success | failed
  amount numeric,
  msisdn text,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index airtel_transactions_reference_idx on airtel_transactions(reference);
create index airtel_transactions_shop_idx on airtel_transactions(shop_id);

alter table airtel_transactions enable row level security;
create policy "shop members full access" on airtel_transactions
  for all using (is_shop_member(shop_id)) with check (is_shop_member(shop_id));
