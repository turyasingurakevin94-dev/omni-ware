# -*- coding: utf-8 -*-
# The states the register has to be right in. Empty, one thing, and the
# case the old modal buried: a thing worth less than is owed on it.
from parts import *

W, H = 960, 1420

def frame(title, note, inner):
    return ('<div style="margin:0 0 18px">'
            '<div style="display:flex;align-items:baseline;gap:10px;margin:0 0 8px">'
            '<span style="font-size:12px;font-weight:600;letter-spacing:.02em">%s</span>'
            '<span style="font-size:12px;color:#59626B;min-width:0">%s</span></div>%s</div>'
            % (title, note, inner))

def mini_strip(tiles):
    out = []
    for i, (l, v, s_, tone) in enumerate(tiles):
        col = {'bad': '#7F1D1A', 'good': '#1C6B58'}.get(tone, '#8A939C' if v == '&mdash;' else '#14171B')
        out.append('<div style="flex:1;padding:10px 14px;%s">'
                   '<p style="font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;'
                   'color:#59626B;margin:0 0 4px">%s</p>'
                   '<span style="%sfont-size:20px;font-weight:500;letter-spacing:-.03em;display:block;'
                   'color:%s">%s</span>'
                   '<p style="font-size:11px;color:#59626B;margin:4px 0 0">%s</p></div>'
                   % ('' if i == 0 else 'border-left:1px solid #E3E7EA;', l, MONO, col, v, s_))
    return ('<div style="display:flex;background:#fff;border:1px solid #E3E7EA;border-radius:8px;'
            'overflow:hidden">%s</div>' % ''.join(out))

# 1 --------------------------------------------------------------------
EMPTY = frame(
  'Nothing recorded yet',
  'no strip at all &mdash; four tiles of zero would be four figures the books cannot derive',
  panel('The register', body=(
    '<div style="padding:32px;text-align:center">'
    '<p style="font-size:13px;color:#59626B;line-height:1.6;max-width:62ch;margin:0 auto 14px">'
    'Nothing here yet. Add the van, the shelving, the laptop &mdash; anything the shop bought to '
    '<i>use</i> rather than to sell. Record a loan when the shop borrows, so money the books show '
    'arriving is also shown as something that has to go back.</p>'
    '<div style="display:flex;gap:6px;justify-content:center">%s%s</div></div>'
    % (btn('Add an asset', 'accent', '<path d="M12 5v14M5 12h14"/>'),
       btn('Record a loan', 'ghost', '<path d="M12 5v14M5 12h14"/>')))))

# 2 --------------------------------------------------------------------
ONE = frame(
  'One thing, paid outright',
  'nothing is owed, so the owed tiles say so in words rather than in noughts',
  mini_strip([('Still owed', '&mdash;', 'nothing borrowed', ''),
              ('Falls due this month', '&mdash;', 'nothing to pay', ''),
              ('Behind schedule', '&mdash;', 'nothing overdue', ''),
              ('Worth on the books', '2,625,000', 'one thing held, cost 4,200,000', '')])
  + '<div style="height:12px"></div>' +
  panel('The register', count='1', body=reg_head() + reg_row(
     CRESTS['shelf'], 'Steel shelving &amp; racking &mdash; main shop',
     'Straight line, 8 years &middot; bought 5 Sep 2023',
     fig('2,625,000', 'cost 4,200,000'), fig(None, 'paid outright'),
     fig('2,625,000', 'all of it'), last=True)))

# 3 --------------------------------------------------------------------
UNDER_X = '''
<div style="padding:0 12px 12px 40px">
  <div style="display:inline-block;font-size:11px;color:#7A4A02;background:#FBEFD9;
    border:1px solid #EBD9B4;border-radius:4px;padding:2px 8px;margin:0 0 10px">
    Worth less than is owed on it until Aug&nbsp;2028. Selling it now would not clear the debt.</div>
  <p style="font-size:13px;color:#59626B;line-height:1.5;max-width:76ch;margin:0 0 10px">
    Bought on 10&nbsp;Jun&nbsp;2026 for 6,400,000 with nothing down, on a <b style="color:#7A4A02">flat
    20%</b> SACCO loan over 30 months. Flat interest is charged on the whole 6,400,000 for the entire
    term, so 9,600,000 goes back on a 6,400,000 machine &mdash; about <b style="color:#7A4A02">36% a
    year</b> in real terms. The boda is written down faster than the loan comes down, which is why
    the gap opens and takes two years to close.</p>
  <div style="display:grid;grid-template-columns:auto auto;gap:3px 16px;width:max-content;font-size:12px">
    <span style="color:#59626B">Worth on the books today</span>
    <span class="mono" style="text-align:right;font-weight:500">6,000,000</span>
    <span style="color:#59626B">Still owed to the SACCO</span>
    <span class="mono" style="text-align:right;font-weight:500">&minus;&nbsp;8,960,000</span>
    <span style="border-top:1px solid #CFD5DA;padding-top:3px;font-weight:600">Owed over its value</span>
    <span class="mono" style="border-top:1px solid #CFD5DA;padding-top:3px;text-align:right;
      font-weight:600;color:#7F1D1A">&minus;&nbsp;2,960,000</span>
  </div>
</div>'''

UNDER = frame(
  'Worth less than is owed on it',
  'the reading that used to live three clicks inside a modal, said on the row and again when opened',
  panel('The register', note='behind first, then what falls due soonest', count='2', body=(
    reg_head() +
    reg_row(CRESTS['boda'], 'Bajaj boda &mdash; delivery',
            'Straight line, 4 years &middot; SACCO, flat 20% &middot; nothing down',
            fig('6,000,000', 'cost 6,400,000'), fig('8,960,000', 'SACCO, on track'),
            fig('&minus;&nbsp;2,960,000', 'owed over its value', tone='bad'),
            open_=True, chips=chip('Under water', 'warn'), expand=UNDER_X) +
    reg_row(CRESTS['van'], 'Toyota Hiace van &middot; UBK 442F',
            'Straight line, 5 years &middot; Stanbic, reducing 22%',
            fig('12,000,000', 'cost 21,000,000'), fig('3,730,000', 'Stanbic, on track'),
            fig('8,270,000', 'worth less what is owed'),
            chips=chip('Due 12 Sep'), last=True))))

# 4 --------------------------------------------------------------------
CLEAR = frame(
  'Nothing owed, nothing due',
  'the good state is stated, not left as an absence &mdash; and it takes no accent, because there is nothing to do',
  mini_strip([('Still owed', '&mdash;', 'both loans settled', ''),
              ('Falls due this month', '&mdash;', 'nothing to pay', ''),
              ('Behind schedule', '&mdash;', 'nothing overdue', ''),
              ('Worth on the books', '15,985,000', 'three things held', '')]))

# 5 --------------------------------------------------------------------
OFF = [
 ('The two rail entries become one.',
  'Assets and Loans go; <i>Assets&nbsp;&amp;&nbsp;loans</i> takes their place in Money. Both old '
  'keyword sets are kept on it, so searching &ldquo;depreciation&rdquo; or &ldquo;borrowed&rdquo; still lands here.'),
 ('The performance modal and the schedule modal go.',
  'Everything in both is on the opened row instead. The add and edit forms stay modals &mdash; a form '
  'is not a reading, and opening one in a list would push the list about.'),
 ('The daily due reminder stays where it is.',
  'It fires on Today and it is the right place for it. The register no longer needs its own banner '
  'back into it, because what is behind is now the first row of the page.'),
 ('Nothing was deleted from the arithmetic.',
  'Depreciation, effective rates on flat loans, fees withheld, disposal gains, the equity schedule &mdash; '
  'all still derived from the same records. The redesign moves where they are read, not what they say.'),
]
off = ''.join(
  '<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #E3E7EA" class="hair">'
  '<span style="%sflex:none;width:16px;font-size:12px;font-weight:600;color:#B23A26">%d</span>'
  '<div style="min-width:0"><b style="font-size:12px;display:block;margin-bottom:2px">%s</b>'
  '<span style="font-size:12px;color:#59626B;line-height:1.5">%s</span></div></div>'
  % (MONO, i + 1, t, b) for i, (t, b) in enumerate(OFF))

MOVED = frame('What moves, and what does not', '',
  '<div style="background:#fff;border:1px solid #E3E7EA;border-radius:8px;padding:12px 16px 4px">%s</div>' % off)

body = '''
<div style="width:%dpx;height:%dpx;position:relative;background:#E9EBED;box-sizing:border-box;padding:22px;overflow:hidden">
  <div style="display:flex;align-items:baseline;gap:10px;margin:0 0 16px">
    <h2 style="font-family:'Archivo Black',sans-serif;font-size:17px;margin:0;letter-spacing:-.015em">States, and what moved off</h2>
    <span style="font-size:12px;color:#59626B">empty, one row, and the case the old design hid</span>
  </div>
  %s%s%s%s%s
</div>''' % (W, H, EMPTY, ONE, UNDER, CLEAR, MOVED)

open('States.dc.html', 'w').write(HEAD + body + '\n</x-dc>\n</body>\n</html>\n')
print('States.dc.html', W, 'x', H)
