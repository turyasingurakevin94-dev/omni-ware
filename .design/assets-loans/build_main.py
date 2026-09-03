# -*- coding: utf-8 -*-
from parts import *

W, H = 1440, 1030

# ---- the open row: Centenary, behind by two ---------------------------
# Behind first is why it sits at the top, so the thing that opens is the
# thing that is wrong. Everything inside is what the old modal held,
# minus the journey.

pay_field = lambda w, txt, mono=True: (
  '<span style="display:inline-flex;align-items:center;height:30px;padding:0 10px;'
  'min-width:%dpx;box-sizing:border-box;border:1px solid #CFD5DA;border-radius:6px;'
  'background:#fff;font-size:12px;color:#14171B;%s">%s</span>' % (w, MONO if mono else '', txt))

CENT_X = '''
<div style="padding:0 12px 12px 40px">
  <div style="display:inline-block;font-size:11px;color:#7A4A02;background:#FBEFD9;
    border:1px solid #EBD9B4;border-radius:4px;padding:2px 8px;margin:0 0 10px">
    Two instalments have not been paid: 5&nbsp;Jul and 5&nbsp;Aug. Nothing here has chased them.</div>
  <p style="font-size:13px;color:#59626B;line-height:1.5;max-width:76ch;margin:0 0 10px">
    8,000,000 taken on 5&nbsp;Jan&nbsp;2026 for stock, over 12 months. The agreement asks
    for <b class="mono" style="color:#14171B">5,413,300</b> by today; <b class="mono" style="color:#14171B">3,866,700</b>
    has been paid. Nothing was bought with it that the shop still holds, so there is nothing to sell to clear it.</p>

  <div style="display:flex;gap:20px;align-items:stretch;flex-wrap:wrap;margin:0 0 12px">
    <div style="border:1px solid #E3E7EA;border-radius:6px;background:#fff;overflow:hidden;flex:1 1 300px;min-width:0;display:flex;flex-direction:column">
      <div style="display:flex;align-items:baseline;gap:8px;min-height:28px;padding:4px 10px;
        border-bottom:1px solid #E3E7EA;background:#F7F9FB">
        <span style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#59626B">The agreement, payment by payment</span>
        <span style="margin-left:auto;font-size:11px;color:#59626B">7 of 12 due</span></div>
      <div style="padding:0;flex:1">__SCHED__</div>
      <p style="margin:0;padding:8px 10px;border-top:1px solid #E3E7EA;font-size:11px;color:#59626B;line-height:1.45;max-width:76ch">
        Flat 16% charges the whole 8,000,000 for all twelve months, including the part already
        paid back &mdash; which is why it costs about <b style="color:#7A4A02">29% a year</b> in real terms.</p>
    </div>
    <div style="border:1px solid #E3E7EA;border-radius:6px;background:#fff;overflow:hidden;flex:1 1 260px;min-width:0;display:flex;flex-direction:column">
      <div style="display:flex;align-items:baseline;gap:8px;min-height:28px;padding:4px 10px;
        border-bottom:1px solid #E3E7EA;background:#F7F9FB">
        <span style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#59626B">Repayments made</span>
        <span style="margin-left:auto;font-size:11px;color:#59626B">5 &middot; 3,866,700</span></div>
      <div style="flex:1">__PAID__</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
    __F1____F2____F3____CTA__
  </div>
  <p style="font-size:11px;color:#59626B;margin:8px 0 0;line-height:1.45;max-width:76ch">
    Recording it posts the payment to the Cash&nbsp;Book under Loan repayments, from the account you
    name. Nothing leaves any account on its own.</p>
</div>'''

sched_rows = [
    ('5 Jun 2026', '4,640,000', '773,300', '106,700', '666,600', '3,973,400', 'paid'),
    ('5 Jul 2026', '3,973,400', '773,300', '106,700', '666,600', '3,306,800', 'missed'),
    ('5 Aug 2026', '3,306,800', '773,300', '106,700', '666,600', '2,640,200', 'missed'),
    ('5 Sep 2026', '2,640,200', '773,300', '106,700', '666,600', '1,973,600', 'next'),
]
sh = ('font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#59626B;')
SC = ['<div style="display:grid;grid-template-columns:88px 1fr 1fr 1fr 66px;gap:8px;padding:5px 10px;'
      'border-bottom:1px solid #CFD5DA">'
      '<span style="%s">Due</span><span style="%stext-align:right">Payment</span>'
      '<span style="%stext-align:right">Interest</span><span style="%stext-align:right">Principal</span>'
      '<span style="%stext-align:right">State</span></div>' % (sh, sh, sh, sh, sh)]
for d, op, pay, ints, prin, cl, st in sched_rows:
    tone = {'paid': ('#1C6B58', 'paid'), 'missed': ('#7F1D1A', 'missed'), 'next': ('#59626B', 'next')}[st]
    SC.append('<div style="display:grid;grid-template-columns:88px 1fr 1fr 1fr 66px;gap:8px;'
              'padding:5px 10px;border-bottom:1px solid #E3E7EA;font-size:12px" class="hair">'
              '<span style="color:#59626B">%s</span>'
              '<span class="mono" style="text-align:right">%s</span>'
              '<span class="mono" style="text-align:right;color:#59626B">%s</span>'
              '<span class="mono" style="text-align:right;color:#59626B">%s</span>'
              '<span style="text-align:right;font-size:11px;font-weight:600;color:%s">%s</span></div>'
              % (d, pay, ints, prin, tone[0], tone[1]))
SC.append('<div style="padding:5px 10px;font-size:11px;color:#8A939C">'
          '&hellip; three more, to 5&nbsp;Jan&nbsp;2027</div>')

paid_rows = [('5 Jun 2026', '773,340', 'from bank', ''),
             ('5 May 2026', '773,340', 'from bank', ''),
             ('5 Apr 2026', '773,340', 'from bank', ''),
             ('5 Mar 2026', '773,340', 'from mobile money', 'not in the cash book'),
             ('5 Feb 2026', '773,340', 'from bank', '')]
PD = []
for d, a, n, flag in paid_rows:
    PD.append('<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;'
              'border-bottom:1px solid #E3E7EA;font-size:12px" class="hair">'
              '<span style="min-width:0;flex:1">'
              '<span style="display:block;color:#59626B;overflow:hidden;text-overflow:ellipsis;'
              'white-space:nowrap">%s &middot; %s</span>%s</span>'
              '<span class="mono" style="font-weight:600">%s</span></div>'
              % (d, n, ('<span style="display:block;font-size:11px;color:#7A4A02;margin-top:1px">'
                        '%s</span>' % flag) if flag else '', a))

cent_x = (CENT_X.replace('__SCHED__', ''.join(SC)).replace('__PAID__', ''.join(PD))
          .replace('__F1__', pay_field(112, '5 Sep 2026'))
          .replace('__F2__', pay_field(118, '773,300'))
          .replace('__F3__', pay_field(150, 'from bank &#9662;', mono=False))
          .replace('__CTA__', btn('Record repayment', 'accent', small=False)))

# ---- the register -----------------------------------------------------
ROWS = [
  reg_row(CRESTS['bank'], 'Centenary Bank &mdash; working capital',
          'Flat 16% &middot; 12 months &middot; 5 of 12 paid &middot; next 5 Sep',
          fig(None, 'nothing behind it'), fig('5,413,300', 'of 9,280,000'),
          fig('1,546,600', '2 instalments behind', tone='bad'),
          open_=True, chips=chip('Behind', 'bad', dot=True), expand=cent_x),
  reg_row(CRESTS['van'], 'Toyota Hiace van &middot; UBK 442F',
          'Straight line, 5 years &middot; Stanbic, reducing 22%',
          fig('12,000,000', 'cost 21,000,000'), fig('3,730,000', 'Stanbic, on track'),
          fig('8,270,000', 'worth less what is owed'),
          chips=chip('Due 12 Sep')),
  reg_row(CRESTS['shelf'], 'Steel shelving &amp; racking &mdash; main shop',
          'Straight line, 8 years &middot; bought 5 Sep 2023',
          fig('2,625,000', 'cost 4,200,000'), fig(None, 'paid outright'),
          fig('2,625,000', 'all of it')),
  reg_row(CRESTS['laptop'], 'Lenovo laptop &amp; POS printer',
          'Straight line, 3 years &middot; bought 10 Feb 2025',
          fig('1,360,000', 'cost 2,880,000'), fig(None, 'paid outright'),
          fig('1,360,000', 'all of it')),
  band('Settled and sold', '1'),
  reg_row(CRESTS['weld'], 'Welding plant &amp; compressor',
          'Sold 30 Jun 2026 for 900,000 &middot; book value was 600,000',
          fig(None, 'no longer held', ), fig(None, ''),
          fig('300,000', 'gain on sale', tone='good'),
          dim=True, chips=chip('Sold'), last=True),
]

register = panel('The register',
                 note='behind first, then what falls due soonest, then what it is worth',
                 count='5',
                 body=reg_head() + ''.join(ROWS))

# ---- the rail ---------------------------------------------------------
position = panel('The position', count='today', body=(
    sidrow('What they cost', '28,080,000') +
    sidrow('Written off so far', '12,095,000') +
    sidrow('Worth on the books', '15,985,000') +
    sidrow('Still owed on them', '9,143,300') +
    '<div style="border-top:1px solid #CFD5DA">' +
    sidrow('Yours, free of debt', '6,841,700', strong=True) + '</div>' +
    '<p style="font-size:11px;color:#59626B;line-height:1.45;margin:0;padding:8px 12px;'
    'border-top:1px solid #E3E7EA;max-width:76ch">The same three figures the Balance sheet '
    'carries, taken from the same records &mdash; so they cannot disagree with it.</p>'))

year = panel('This year', note='1 Jan &ndash; 3 Sep', body=(
    sidrow('Depreciation charged', '3,750,000') +
    sidrow('Interest paid', '1,392,700') +
    sidrow('Repaid off the principal', '7,056,900') +
    '<p style="font-size:11px;color:#59626B;line-height:1.45;margin:0;padding:8px 12px;'
    'border-top:1px solid #E3E7EA;max-width:76ch">Depreciation and interest are costs and reach '
    'the Profit &amp; loss. Money repaid off the principal is not a cost &mdash; it only moves.</p>'))

nothing = panel('Not counted here', body=(
    '<p style="font-size:11px;color:#59626B;line-height:1.5;margin:0;padding:10px 12px;max-width:76ch">'
    'Stock on the shelf is not an asset of this kind &mdash; it was bought to sell, and lives in '
    'Inventory. Rent is not borrowing; it is on Payroll&nbsp;&amp;&nbsp;rent. What falls due across '
    'every kind of promise, loans included, is drawn on '
    '<span style="font-weight:600;color:#14171B">What&#39;s coming</span>.</p>'))

# ---- the page ---------------------------------------------------------
HEADER = '''
  <div style="display:flex;align-items:flex-end;gap:12px;padding:16px 0 12px;border-bottom:1px solid #CFD5DA;margin-bottom:16px">
    <div>
      <div style="display:flex;align-items:center;gap:7px">
        <h1 style="font-family:'Archivo Black',sans-serif;font-size:19px;margin:0;letter-spacing:-.015em;line-height:1.1">Assets &amp; loans</h1>
        <span style="width:16px;height:16px;border-radius:50%;border:1px solid #CFD5DA;color:#59626B;
          font-size:10px;font-weight:600;display:inline-flex;align-items:center;justify-content:center">i</span>
      </div>
      <p style="font-size:12px;color:#59626B;margin:3px 0 1px">What the shop owns, what is still owed on it, and what falls due next</p>
    </div>
    <span style="flex:1"></span>
    __B1____B2__
  </div>'''
HEADER = (HEADER.replace('__B1__', btn('Add an asset', 'ghost', '<path d="M12 5v14M5 12h14"/>'))
                .replace('__B2__', '<span style="margin-left:6px">%s</span>'
                         % btn('Record a loan', 'ghost', '<path d="M12 5v14M5 12h14"/>')))

STRIP = strip([
  ('Still owed', '9,143,300', 'across two loans, one behind', ''),
  ('Falls due this month', '1,346,200', '5 Sep Centenary &middot; 12 Sep Stanbic', ''),
  ('Behind schedule', '1,546,600', 'Centenary, two instalments', 'bad'),
  ('Worth on the books', '15,985,000', 'three things held, cost 28,080,000', ''),
])

body = '''
<div style="width:%dpx;height:%dpx;position:relative;background:#E9EBED;overflow:hidden">
%s
  <div style="position:absolute;top:54px;left:220px;right:0;padding:0 24px 24px;box-sizing:border-box">
    %s
    %s
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 304px;gap:16px;align-items:start;margin-top:16px">
      <div>%s</div>
      <div style="display:flex;flex-direction:column;gap:16px">%s%s%s</div>
    </div>
  </div>
</div>''' % (W, H, chrome('Money', 'Assets &amp; loans', H), HEADER, STRIP,
             register, position, year, nothing)

open('Main.dc.html', 'w').write(HEAD + body + '\n</x-dc>\n</body>\n</html>\n')
print('Main.dc.html', W, 'x', H)
