# One Tuesday in a Kampala hardware wholesaler, used by every board so
# the before and the after are arguing about the SAME day.

DAY_LONG  = 'Tuesday 25 August 2026'
DAY_SHORT = '25 Aug 2026'

SALES_TOTAL, SALES_COUNT = '11,540,000', 24
PROFIT, PROFIT_PC        = '1,464,000', '12.7%'
COLLECTED, PAYERS        = '2,970,000', 4
TILL_NET                 = '5,240,000'
TILL_IN, TILL_OUT, TILL_N = '8,420,000', '3,180,000', 31

# name, orders, sales, gross profit on those orders, the invoices behind it
BUYERS = [
  ('Ssekitoleko Hardware',        3, '4,180,000', '512,000', '3 invoices'),
  ('Kato Construction Ltd',       1, '2,640,000', '291,000', 'INV-2338'),
  ('Mulongo &amp; Sons',          2, '1,455,000', '203,500', '2 invoices'),
  ('Namirembe Building Supplies', 1,   '980,000', '118,000', 'INV-2332'),
  ('Walk-in',                     9,   '742,500', '141,000', '9 counter sales'),
  ('Bwaise Roofing Works',        1,   '610,000',  '44,000', 'INV-2341'),
  ('Nakawa Site Stores',          1,   '385,000',  '61,000', 'INV-2323'),
  ('Kyanja Contractors',          1,   '240,000',  '33,600', 'INV-2320'),
]
BUYERS_TOTAL = 10

# name, what it was against, amount, how it arrived
PAYERS_ROWS = [
  ('Kato Construction Ltd',       'INV-2291, 38 days old', '1,500,000', 'Mobile money'),
  ('Ssekitoleko Hardware',        'INV-2310, 19 days old',   '850,000', 'Cash'),
  ('Namirembe Building Supplies', 'INV-2264, 51 days old',   '400,000', 'Bank'),
  ('Mulongo &amp; Sons',          'INV-2333, 6 days old',    '220,000', 'Cash'),
]

RAN_OUT = [('Iron sheets &mdash; G28, 3m box profile', '&minus;92', '15:20'),
           ('Binding wire 16g &mdash; 5kg roll', '&minus;18', '11:48')]

# line, delta, left, note
CAME_IN = [
  ('Cement &mdash; Hima 50kg',        '+300', '412', 'Sembeguya Steel &middot; GRN&nbsp;4471'),
  ('Iron sheets &mdash; G32, 2m',     '+180', '246', 'Sembeguya Steel &middot; GRN&nbsp;4471'),
  ('Nails 4&Prime; &mdash; 25kg box',  '+40',  '61', 'Kisenyi Metals &middot; GRN&nbsp;4472'),
]
WENT_OUT = [
  ('Cement &mdash; Hima 50kg',                '&minus;186', '226', ''),
  ('Iron sheets &mdash; G28, 3m box profile',  '&minus;92',   '0', 'ran out'),
  ('Y12 reinforcement bar &mdash; 12m',        '&minus;60', '140', ''),
  ('PVC conduit 20mm &mdash; 3m',              '&minus;45', '210', ''),
  ('Nails 4&Prime; &mdash; 25kg box',          '&minus;22',  '39', ''),
  ('Binding wire 16g &mdash; 5kg roll',        '&minus;18',   '0', 'ran out'),
  ('Hoop iron &mdash; 30m roll',               '&minus;14',  '27', ''),
  ('Roofing nails 3&Prime; &mdash; 20kg',       '&minus;9',  '18', ''),
]
WENT_OUT_TOTAL = 11
COUNTED = [
  ('Padlocks 50mm &mdash; Yale', '&minus;4', '36', 'four short at the count'),
  ('Wheelbarrow &mdash; heavy duty', '+1', '9', 'one found'),
]

MOVED = [
  ('Kato Construction Ltd',       'Loading', '11:12'),
  ('Namirembe Building Supplies', 'Ready',   '13:40'),
  ('Bwaise Roofing Works',        'Picking', '16:05'),
]
FINISHED = [
  ('Ssekitoleko Hardware', 'Completed', '15:52'),
  ('Mulongo &amp; Sons',   'Completed', '17:20'),
]
PROMISES = [
  ('Bwaise Roofing Works', '29 Aug 2026', '610,000',        'against INV-2341'),
  ('Nakawa Site Stores',   '1 Sep 2026',  'the whole balance', 'against 3 invoices, 1,205,000'),
]

# label, this day, a typical Tuesday, arrow, delta text, tone, basis
BASELINE = [
  ('Sales invoiced',   SALES_TOTAL, '9,380,000',  'up',   '23% above a typical Tuesday', 'good',
   '5 Tuesdays, 21 Jul &ndash; 18 Aug'),
  ('Gross profit',     PROFIT,      '1,240,000',  'up',   '18% above',                   'good',
   '12.7% margin, against 13.2% typical'),
  ('Debt collected',   COLLECTED,   '1,910,000',  'up',   '55% above',                   'good',
   'four paid, against two typical'),
  ('Through the till', TILL_NET,    '5,720,000',  'down', '8% below',                    '',
   '2,650,000 went out to Sembeguya Steel'),
]

MEETING_OBJ = 'Get the money in'
MEETING_WHY = ('Two thirds of last month&rsquo;s sales are still sitting as debt, and the '
               'cement order falls due on Friday.')
MEETING_KEY = 'Ring Kato before ten &mdash; they collect on Tuesdays and pay on the spot.'
MEETING_MOVES = [
  ('done', 'Ring Kato Construction about the 1,500,000 on INV-2291',
   'Paid in full at 10:41, by mobile money.'),
  ('missed', 'Hold the G28 iron sheets for Ssekitoleko&rsquo;s Thursday order',
   'Not held. Sold across the counter and the line ran out at 15:20.'),
  ('done', 'Raise cement to 34,000 &mdash; the last two loads cost more',
   'Applied to 12 invoices today.'),
]
MEETING_REJECTED = ('Clearing the slow padlocks at a discount &mdash; the shelf is not what is '
                    'short this week.')
