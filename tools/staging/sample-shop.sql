-- The practice shop: made-up data for rehearsing a fresh start on STAGING.
-- Names and figures are docs/canvas-cast.md's sample shop; none of it is
-- the real shop's. tools/staging-rehearsal.js loads it, after removing any
-- earlier practice shop and every shop copied from it.
--
-- It holds a bit of everything the copy treats differently: reference data
-- to copy, balances to measure again (debts, stock, cash, a bill, a loan),
-- history to leave behind (orders, cash lines), and running logs inside the
-- settings that must not come across.

-- {{OWNER}} is the staging login that owns it, put in by the script.
insert into shops (id, name, created_by) values ('5a3b1e00-0000-4000-8000-0000000000aa', 'Mukasa Hardware (practice)', '{{OWNER}}');
insert into shop_members (shop_id, user_id, role) values ('5a3b1e00-0000-4000-8000-0000000000aa', '{{OWNER}}', 'owner');

insert into app_settings (shop_id, presets) values ('5a3b1e00-0000-4000-8000-0000000000aa', jsonb_build_object(
  'categories', jsonb_build_array(
    jsonb_build_object('name', 'Roofing', 'subcategories', '[]'::jsonb), jsonb_build_object('name', 'Cement', 'subcategories', '[]'::jsonb),
    jsonb_build_object('name', 'Steel', 'subcategories', '[]'::jsonb), jsonb_build_object('name', 'Plumbing', 'subcategories', '[]'::jsonb),
    jsonb_build_object('name', 'Timber', 'subcategories', '[]'::jsonb)),
  'units', jsonb_build_array('piece', 'sheet', 'bag', 'bar', 'length'),
  'locations', jsonb_build_array('Ntinda', 'Nakawa', 'Mukono', 'Lubowa', 'Ggaba', 'Nansana'),
  'defaultMarkup', jsonb_build_object('wholesaleType', 'percent', 'wholesaleValue', 25, 'retailType', 'percent', 'retailValue', 30),
  'creditHold', jsonb_build_object('days', 21, 'on', true),
  'priceReview', jsonb_build_object('perDay', 6),
  'shopLegalName', 'Mukasa Hardware Ltd (practice)', 'shopAddress', 'Kisekka Street, Kampala', 'shopPhone', '0700 000 000',
  'dayLog', jsonb_build_object('2026-10-17', jsonb_build_object('note', 'running log: stays behind')),
  'chaseLog', jsonb_build_array(jsonb_build_object('customerId', 'C002', 'on', '2026-10-10')),
  'stockCounts', jsonb_build_object('Roofing', 1),
  'debtChases', jsonb_build_object('C002', 2)));

insert into suppliers (shop_id, id, name, phone, location, terms_days) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'S001', 'Namanve Sheets', '0700 000 101', 'Namanve', 30),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'S002', 'Nakawa Cement Depot', '0700 000 102', 'Nakawa', 14),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'S003', 'Kiseka Steel', '0700 000 103', 'Kiseka', 30),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'S004', 'Owino Plumbing', '0700 000 104', 'Owino', 7),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'S005', 'Ndeeba Timber Works', '0700 000 105', 'Ndeeba', 14);

insert into products (shop_id, id, name, category, type) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P001', 'Iron sheet G28, 3m', 'Roofing', 'simple'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P002', 'Iron sheet G30, 3m', 'Roofing', 'simple'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P003', 'Ridge cap', 'Roofing', 'simple'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P004', 'Cement 50kg', 'Cement', 'simple'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P005', 'Y12 bar, 12m', 'Steel', 'simple'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P006', 'Binding wire, 25kg', 'Steel', 'simple'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P007', 'PVC pipe 1", 6m', 'Plumbing', 'simple'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P008', 'Timber 2x4, 12ft', 'Timber', 'simple');

insert into prices (shop_id, product_id, supplier_id, wholesale, retail, date, unit) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P001', 'S001', 55700, 60000, '2026-08-01', 'sheet'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P002', 'S001', 46000, 50000, '2026-09-12', 'sheet'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P003', 'S001', 18000, 21000, '2026-06-20', 'piece'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P004', 'S002', 31000, 33000, '2026-10-10', 'bag'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P005', 'S003', 42000, 45000, '2026-07-02', 'bar'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P006', 'S003', 120000, 130000, '2026-10-01', 'piece'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P007', 'S004', 14000, 16000, '2026-05-15', 'length'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P008', 'S005', 9000, 11000, '2026-09-30', 'piece');

insert into item_names (shop_id, word, product_id) values ('5a3b1e00-0000-4000-8000-0000000000aa', 'mabaati', 'P001');

insert into customers (shop_id, id, name, phone, location, debt, credit_limit, terms_days) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C001', 'Kato Construction', '0700 000 201', 'Ntinda', 2410000, 5000000, 30),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C002', 'Kyaligonza & Sons', '0700 000 202', 'Nakawa', 746000, 600000, 14),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C003', 'Mukono Roofing', '0700 000 203', 'Mukono', 1846000, 3000000, 30),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C004', 'Lubowa Builders', '0700 000 204', 'Lubowa', 0, null, null),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C005', 'Ggaba Stores', '0700 000 205', 'Ggaba', 320000, null, 7),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C006', 'Nansana Hardware', '0700 000 206', 'Nansana', 0, null, null);

insert into customer_debt_log (shop_id, customer_id, date, type, amount, note) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C001', '2026-09-01', 'charge', 2410000, 'Auto-sync — INV-0101'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C002', '2026-09-26', 'charge', 746000, 'Auto-sync — INV-0112'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C003', '2026-10-02', 'charge', 1846000, 'Auto-sync — INV-0118'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'C005', '2026-10-12', 'charge', 320000, 'Auto-sync — INV-0124');

insert into staff (shop_id, id, name, role, pay_basis, pay_rate) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'ST001', 'Ruth Nakato', 'manager', 'monthly', 1200000),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'ST002', 'Esther Auma', 'accounts', 'monthly', 900000),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'ST003', 'Moses Lubega', 'sourcing', 'monthly', 600000),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'ST004', 'Musa Kiggundu', 'store', 'monthly', 500000),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'ST005', 'Grace Akello', 'sales', 'monthly', 450000),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'ST006', 'Hassan', 'delivery', 'daily', 15000);

insert into agents (shop_id, id, name, phone) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'A001', 'Peter Sserwadda', '0700 000 301'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'A002', 'Aisha Namutebi', '0700 000 302');
insert into agent_clients (shop_id, agent_id, name, phone, location) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'A001', 'Opio Site', '0700 000 311', 'Kira');

insert into places (shop_id, name, lat, lng) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'Ntinda', 0.3536, 32.6157),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'Nakawa', 0.3317, 32.6141);

insert into rent_agreements (shop_id, premises, landlord, amount, due_day, start_month) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'Kisekka Street shop', 'Mr Kasozi', 800000, 5, '2025-01');
insert into fixed_assets (shop_id, name, cost, acquired_on, method, life_months) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'Delivery truck', 45000000, '2025-02-01', 'straight_line', 60);
insert into rival_prices (shop_id, product_id, rival, price, seen_on) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P001', 'Nakawa Hardware', 58000, '2026-10-01');

-- What is measured again, or left behind.
insert into stock (shop_id, key, product_id, qty) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P001', 'P001', 140),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P004', 'P004', 85),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'P005', 'P005', 60);
insert into cash_txns (shop_id, date, account, type, category, amount, description) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', '2026-10-17', 'cash', 'receipt', 'Sales', 1250000, 'Counter sales'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', '2026-10-17', 'cash', 'payment', 'Transport', 40000, 'Delivery fuel');
insert into saved_quotes (shop_id, client_name, date, status, invoiced, voided, payload) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'Lubowa Builders', '2026-10-17', 'draft', false, false, '{"customerId":"C004","items":[]}'),
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'Kato Construction', '2026-09-01', 'completed', true, false, '{"customerId":"C001","items":[]}');
insert into purchase_invoices (shop_id, date, payload) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', '2026-10-05', '{"supplierId":"S003","total":2100000}');
insert into loans (shop_id, lender, principal, rate_pct, method, term_months, started_on) values
  ('5a3b1e00-0000-4000-8000-0000000000aa', 'Stanbic Bank', 10000000, 18, 'reducing_balance', 24, '2025-06-01');
