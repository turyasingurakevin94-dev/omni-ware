# -*- coding: utf-8 -*-
# BEFORE: the two pages as they stand today, and what is wrong with them.
from parts import HEAD, MONO, btn

W, H = 1240, 920

def legacy(title, blurb, panel_title, cta, stats, cols, rows):
    st = ''.join(
      '<div style="flex:1;min-width:0;padding:12px 14px;%s">'
      '<b style="%sfont-size:18px;font-weight:600;display:block;color:%s">%s</b>'
      '<span style="font-size:11px;color:#59626B">%s</span></div>'
      % ('' if i == 0 else 'border-left:1px solid #E3E7EA;', MONO,
         '#7F1D1A' if bad else '#14171B', v, l)
      for i, (v, l, bad) in enumerate(stats))
    th = ''.join('<th style="text-align:%s;font-size:11px;font-weight:600;color:#59626B;'
                 'padding:7px 8px;border-bottom:1px solid #CFD5DA;white-space:nowrap">%s</th>'
                 % ('right' if c.startswith('>') else 'left', c.lstrip('>')) for c in cols)
    tr = []
    for r in rows:
        tds = ''.join('<td style="text-align:%s;font-size:12px;padding:8px;border-bottom:1px solid #E3E7EA;'
                      '%swhite-space:nowrap">%s</td>'
                      % ('right' if c.startswith('>') else 'left',
                         MONO if c.startswith('>') else '', v)
                      for c, v in zip(cols, r))
        tr.append('<tr>%s</tr>' % tds)
    return '''
    <div style="background:#fff;border-radius:10px;padding:18px;box-sizing:border-box;flex:1;min-width:0">
      <h1 style="font-size:21px;font-weight:700;margin:0 0 6px;letter-spacing:-.02em">%s</h1>
      <p style="font-size:12px;color:#59626B;line-height:1.5;margin:0 0 16px">%s</p>
      <div style="border:1px solid #E3E7EA;border-radius:8px;overflow:hidden">
        <div style="display:flex;align-items:center;padding:12px 14px;border-bottom:1px solid #E3E7EA">
          <h2 style="font-size:14px;font-weight:600;margin:0">%s</h2>
          <span style="margin-left:auto">%s</span></div>
        <div style="display:flex;border-bottom:1px solid #E3E7EA">%s</div>
        <div style="position:relative;overflow:hidden">
          <table style="width:100%%;border-collapse:collapse;table-layout:auto;min-width:760px"><thead><tr>%s</tr></thead>
            <tbody>%s</tbody></table>
          <div style="position:absolute;top:0;right:0;bottom:0;width:56px;
            background:linear-gradient(90deg,rgba(255,255,255,0),#fff 78%%)"></div>
        </div>
        <p style="margin:0;padding:7px 10px;border-top:1px solid #E3E7EA;background:#F7F9FB;
          font-size:11px;color:#59626B">Seven columns do not fit the panel. On a phone this is a
          sideways scroll under the thumb; here it is simply cut.</p>
      </div>
    </div>''' % (title, blurb, panel_title, cta, st, th, ''.join(tr))

ICONS = ('<span style="color:#8A939C;letter-spacing:2px;font-size:13px">&#9636;&#9636;&#9636;&#9636;</span>')

ASSETS = legacy(
  'Assets',
  'The things the shop owns and uses &mdash; a van, shelving, a laptop. Not stock: these are bought to be '
  'used, and lose value a little at a time as depreciation rather than all at once when they are paid for.',
  'Register', btn('Add an asset', 'accent'),
  [('31,680,000', 'What they cost', 0), ('15,095,000', 'Written off so far', 0),
   ('15,985,000', 'Worth on the books', 0), ('3,750,000', 'Charge this year', 0)],
  ['Asset', 'Acquired', 'How it depreciates', '>Cost', '>Written off', '>Book value', ''],
  [['Toyota Hiace van &middot; UBK 442F', '2024-03-12', 'Straight line, 60 months',
    '21,000,000', '9,000,000', '12,000,000', ICONS],
   ['Steel shelving &amp; racking', '2023-09-05', 'Straight line, 96 months',
    '4,200,000', '1,575,000', '2,625,000', ICONS],
   ['Lenovo laptop &amp; POS printer', '2025-02-10', 'Straight line, 36 months',
    '2,880,000', '1,520,000', '1,360,000', ICONS],
   ['Welding plant &amp; compressor <span style="color:#8A939C">(sold 30 Jun)</span>',
    '2022-05-01', 'Straight line, 60 months',
    '3,600,000', '3,000,000', '600,000', ICONS]])

LOANS = legacy(
  'Loans',
  'Money the shop has borrowed, what it is really costing, and whether the repayments are keeping up '
  'with the agreement.',
  'Borrowing', btn('Record a loan', 'accent'),
  [('9,143,300', 'Still owed', 0), ('2', 'Loans running', 0),
   ('1,392,700', 'Interest paid this year', 0), ('2,320,000', 'Behind schedule', 1)],
  ['Lender', 'Taken', 'Terms', '>Borrowed', '>Still owed', '>Keeping up?', ''],
  [['Centenary Bank', '2026-01-05', 'Flat 16% &middot; 12 months',
    '8,000,000', '5,413,300', '<span style="color:#7F1D1A">2,320,000 behind</span>', ICONS],
   ['Stanbic Bank', '2024-03-12', 'Reducing 22% &middot; 36 months',
    '15,000,000', '3,730,000', '<span style="color:#1C6B58">On track</span>', ICONS]])

FAULTS = [
 ('Two screens for one question.',
  'The van is on Assets. The loan that bought the van is on Loans. Neither page mentions the other, so '
  '&ldquo;what is this thing actually worth to me&rdquo; cannot be asked anywhere.'),
 ('The accent is on filing, not on the work.',
  'Both pages spend their one red button on <i>Add an asset</i> and <i>Record a loan</i> &mdash; things done '
  'twice a year. A repayment two months overdue gets no accent on either page.'),
 ('Nothing is ranked.',
  'Both tables sort by the date the thing was acquired or taken. The loan in arrears sits wherever its '
  'start date puts it; here that is the top by luck, not by rule.'),
 ('The reading that matters is three clicks deep.',
  'Worth against owed &mdash; the whole point of a thing bought on credit, and the app already computes it &mdash; '
  'lives inside the depreciation-schedule modal, behind an unlabelled icon.'),
 ('Seven columns at one weight, then four unnamed icons.',
  'Every column is set in the same ink at the same size, and the last cell is four icon buttons with no '
  'column name, one of which deletes the record.'),
 ('A paragraph nobody reads twice, permanently unfolded.',
  'Forty-five words of teaching sit above the work every single visit. The console folds that behind the '
  '&ldquo;i&rdquo; and keeps one line on screen.'),
]
f = ''.join(
  '<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #E3E7EA" class="hair">'
  '<span style="%sflex:none;width:18px;font-size:12px;font-weight:600;color:#B23A26">%d</span>'
  '<div style="min-width:0"><b style="font-size:12px;font-weight:600;display:block;margin-bottom:2px">%s</b>'
  '<span style="font-size:12px;color:#59626B;line-height:1.5">%s</span></div></div>'
  % (MONO, i + 1, t, b) for i, (t, b) in enumerate(FAULTS))

body = '''
<div style="width:%dpx;height:%dpx;position:relative;background:#E9EBED;box-sizing:border-box;padding:22px;overflow:hidden">
  <div style="display:flex;align-items:baseline;gap:10px;margin:0 0 4px">
    <h2 style="font-family:'Archivo Black',sans-serif;font-size:17px;margin:0;letter-spacing:-.015em">Today: two pages</h2>
    <span style="font-size:12px;color:#59626B">Assets and Loans as they stand, drawn from the markup in <span class="mono">index.html</span></span>
  </div>
  <div style="display:flex;gap:16px;align-items:stretch;margin:14px 0 18px">%s%s</div>
  <div style="background:#fff;border-radius:10px;padding:14px 18px 4px">
    <div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#59626B;margin-bottom:4px">What is wrong with them</div>
    %s
  </div>
</div>''' % (W, H, ASSETS, LOANS, f)

open('Before.dc.html', 'w').write(HEAD + body + '\n</x-dc>\n</body>\n</html>\n')
print('Before.dc.html', W, 'x', H)
