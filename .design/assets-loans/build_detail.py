# -*- coding: utf-8 -*-
# A FINANCED THING, OPENED. The one reading neither register could give:
# what it is worth against what is still owed on it, and the months where
# the second is bigger than the first.
from parts import *

W, H = 1040, 930

def ev(title, note, body, foot=''):
    return ('<div style="border:1px solid #E3E7EA;border-radius:6px;background:#fff;overflow:hidden;'
            'margin:0 0 12px;min-width:0;flex:1 1 300px;display:flex;flex-direction:column">'
            '<div style="display:flex;align-items:baseline;gap:8px;min-height:28px;padding:4px 10px;'
            'border-bottom:1px solid #E3E7EA;background:#F7F9FB">'
            '<span style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;'
            'color:#59626B">%s</span><span style="margin-left:auto;font-size:11px;color:#59626B">%s</span></div>'
            '<div style="flex:1">%s</div>%s</div>'
            % (title, note, body,
               ('<p style="margin:0;padding:8px 10px;border-top:1px solid #E3E7EA;font-size:11px;'
                'color:#59626B;line-height:1.45;max-width:76ch">%s</p>' % foot) if foot else ''))

def minitable(cols, rows, foot_row=None):
    grid = 'grid-template-columns:%s' % cols
    lab = 'font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#59626B;'
    head = ('<div style="display:grid;%s;gap:8px;padding:5px 10px;border-bottom:1px solid #CFD5DA">%s</div>'
            % (grid, ''.join('<span style="%s%s">%s</span>'
                             % (lab, 'text-align:right' if c.startswith('>') else '', c.lstrip('>'))
                             for c in rows[0])))
    out = [head]
    for r in rows[1:]:
        cells = []
        for c, v in zip(rows[0], r):
            right = c.startswith('>')
            tone = ''
            if v.startswith('!'):
                v = v[1:]; tone = 'color:#7F1D1A;font-weight:600;'
            cells.append('<span style="%s%s%sfont-size:12px;min-width:0;white-space:nowrap;'
                         '%s">%s</span>'
                         % (MONO if right else '', 'text-align:right;' if right else 'color:#59626B;',
                            tone, '' if right else 'overflow:hidden;text-overflow:ellipsis;', v))
        out.append('<div style="display:grid;%s;gap:8px;padding:5px 10px;border-bottom:1px solid #E3E7EA" '
                   'class="hair">%s</div>' % (grid, ''.join(cells)))
    if foot_row:
        out.append('<div style="padding:5px 10px;font-size:11px;color:#8A939C">%s</div>' % foot_row)
    return ''.join(out)

DEP = minitable('1fr 1fr 1fr 1fr', [
    ['Month', '>Opening', '>Charge', '>Closing'],
    ['Jun 2026', '12,900,000', '300,000', '12,600,000'],
    ['Jul 2026', '12,600,000', '300,000', '12,300,000'],
    ['Aug 2026', '12,300,000', '300,000', '12,000,000'],
    ['Sep 2026', '12,000,000', '300,000', '11,700,000'],
], '&hellip; 26 more, to Feb 2029 and a residual 3,000,000')

AGR = minitable('72px 1fr 1fr 1fr', [
    ['Due', '>Payment', '>Interest', '>Principal'],
    ['12 Sep 26', '572,900', '68,400', '504,500'],
    ['12 Oct 26', '572,900', '59,200', '513,700'],
    ['12 Nov 26', '572,900', '49,800', '523,100'],
    ['12 Dec 26', '572,900', '40,200', '532,700'],
], '&hellip; 3 more, to 12 Mar 2027')

EQ = minitable('1fr 1fr 1fr 1fr', [
    ['Month', '>Worth', '>Owed (agreed)', '>Difference'],
    ['Sep 2026', '12,000,000', '3,730,000', '8,270,000'],
    ['Dec 2026', '11,100,000', '2,190,000', '8,910,000'],
    ['Mar 2027', '10,200,000', '&mdash;', '10,200,000'],
    ['Apr 2027', '9,900,000', '&mdash;', '9,900,000'],
], 'The last instalment falls on 12 Mar 2027; the van keeps depreciating to Feb 2029.')

ACTS = ('<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">%s%s%s%s</div>'
        % (btn('Record a repayment', 'accent', '<path d="M12 5v14M5 12h14"/>'),
           btn('Sell or scrap it', 'ghost', '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
           btn('Edit', 'ghost', '<path d="M4 20h4L18.5 9.5a2.121 2.121 0 1 0-3-3L5 17v3z"/>'),
           btn('Remove', 'danger', '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>')))

ARITH = '''
<div style="display:grid;grid-template-columns:auto auto;gap:3px 16px;width:max-content;font-size:12px;margin:0 0 12px">
  <span style="color:#59626B">Worth on the books today</span>
  <span class="mono" style="text-align:right;font-weight:500">12,000,000</span>
  <span style="color:#59626B">Still owed to Stanbic</span>
  <span class="mono" style="text-align:right;font-weight:500">&minus;&nbsp;3,730,000</span>
  <span style="border-top:1px solid #CFD5DA;padding-top:3px;color:#14171B;font-weight:600">Yours, free of debt</span>
  <span class="mono" style="border-top:1px solid #CFD5DA;padding-top:3px;text-align:right;font-weight:600">8,270,000</span>
</div>'''

body = '''
<div style="width:%dpx;height:%dpx;position:relative;background:#E9EBED;box-sizing:border-box;padding:20px;overflow:hidden">
  <div style="display:flex;align-items:baseline;gap:10px;margin:0 0 12px">
    <h2 style="font-family:'Archivo Black',sans-serif;font-size:17px;margin:0;letter-spacing:-.015em">A financed thing, opened</h2>
    <span style="font-size:12px;color:#59626B">the same row, expanded in place &mdash; no modal, no second screen</span>
  </div>

  <div style="background:#fff;border:1px solid #E3E7EA;border-radius:8px;overflow:hidden">
    <div style="display:grid;grid-template-columns:%s;align-items:center;gap:10px;min-height:44px;
      padding:6px 12px;background:#F7F9FB;border-bottom:1px solid #E3E7EA">
      <svg class="ico" viewBox="0 0 24 24" style="width:12px;height:12px;color:#8A939C;justify-self:center;transform:rotate(90deg)"><path d="M9 6l6 6-6 6"/></svg>
      <div style="min-width:0;display:flex;align-items:center;gap:8px">
        <svg class="ico18" viewBox="0 0 24 24" style="color:#59626B">%s</svg>
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:13px;font-weight:500">Toyota Hiace van &middot; UBK 442F</span>%s</div>
          <div style="font-size:11px;color:#59626B;margin-top:1px">Straight line, 5 years &middot; Stanbic, reducing 22%%</div>
        </div>
      </div>
      %s%s%s
    </div>

    <div style="padding:12px">
      <p style="font-size:13px;color:#59626B;line-height:1.5;max-width:76ch;margin:0 0 12px">
        Bought on 12&nbsp;Mar&nbsp;2024 for 21,000,000, with 15,000,000 of it borrowed from Stanbic and
        6,000,000 paid from the shop&rsquo;s own bank. It is written down 300,000 a month over five years
        to a residual 3,000,000. Twenty-nine of thirty-six instalments are paid, and none is late.
      </p>
      %s
      <div style="display:flex;gap:16px;align-items:stretch;flex-wrap:wrap">%s%s</div>
      %s
      <p style="font-size:11px;color:#59626B;line-height:1.45;max-width:76ch;margin:0 0 12px">
        Repayments you record change what is owed. They do not change the agreed column, which is the
        plan the lender is holding you to &mdash; that is the whole reason both are drawn.
      </p>
      %s
      <p style="font-size:11px;color:#59626B;line-height:1.45;max-width:76ch;margin:8px 0 0">
        Selling it posts the proceeds to the Cash&nbsp;Book and the gain or loss to the Profit&nbsp;&amp;&nbsp;loss.
        It does not clear the Stanbic loan &mdash; that goes on being owed until it is repaid.
      </p>
    </div>
  </div>
</div>''' % (W, H, COLS, CRESTS['van'], chip('Due 12 Sep'),
             fig('12,000,000', 'cost 21,000,000'), fig('3,730,000', 'Stanbic, on track'),
             fig('8,270,000', 'worth less what is owed'),
             ARITH,
             ev('Depreciation, month by month', '30 of 60 charged', DEP,
                'A charge, not a payment: nothing leaves any account. It is what the van has used up.'),
             ev('The agreement, payment by payment', '29 of 36 paid', AGR,
                'Reducing balance: the interest share shrinks every month as the balance does.'),
             ev('Worth against owed, month by month', 'to the last instalment', EQ,
                'Positive every month, because 6,000,000 was paid down at the start. A van bought with '
                'nothing down is worth less than it owes for its first year &mdash; the register says so on '
                'the row when it happens.'),
             ACTS)

open('Detail.dc.html', 'w').write(HEAD + body + '\n</x-dc>\n</body>\n</html>\n')
print('Detail.dc.html', W, 'x', H)
