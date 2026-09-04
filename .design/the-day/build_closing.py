# TONIGHT, STILL OPEN. The same screen at 16:52 on the day itself.
# Two things change and they are the whole argument of the board:
# the accent moves to the one thing left to do, and the comparison
# stops pretending an unfinished day can be measured against a
# finished one.
from parts import (HEAD, chrome, pan, pan_h, bandrow, colhead, drow, nm, amt, note,
                   checkrow, btn, chip, ico, vtile, vstrip, MONO, INK, INK6, INK4,
                   RULE, HAIR, GOOD, WARN, BAD, OXIDE, CUT, ARROW_UP, ARROW_DOWN)
import mainparts as M

W, H = 1440, 1010
TILLCOLS = 'minmax(0,1fr) 72px 72px'

BASE = [
  ('Sales invoiced',   '7,180,000', '6,240,000', 'up', '15% above a typical Tuesday by now', 'good',
   '15 sales &middot; 5 Tuesdays, 21 Jul &ndash; 18 Aug'),
  ('Gross profit',     '902,000',   '810,000',   'up', '11% above',  'good', '12.6% margin'),
  ('Debt collected',   '2,970,000', '1,340,000', 'up', '122% above', 'good', 'four paid already'),
  ('Through the till', '4,610,000', '3,980,000', 'up', '16% above',  'good', 'not yet counted'),
]

strip = vstrip([vtile(l, v, (M.ARROWS[a], t, tone), b, first=(i == 0))
                for i, (l, v, _typ, a, t, tone, b) in enumerate(BASE)])
verdict = pan(
  M.day_head('Today &mdash; Tuesday 25 August 2026',
             chip('Still open &middot; 16:52', 'warn', dot=True)),
  strip + note('Today is measured against where a typical Tuesday stood <b>at 16:52</b>, not '
               'against a whole Tuesday. An unfinished day set beside a finished one always '
               'reads as a bad day, and that is a lie the screen would be telling every '
               'afternoon.'))

# ---- the rail: the one thing left to do ------------------------------
accent = ('<div style="padding:10px 12px;border-top:1px solid %s;background:#fff">%s'
          '<p style="font-size:11px;color:%s;margin:7px 0 0;line-height:1.45">Counting is what '
          'closes the day. Until all three accounts are counted the till figure above is what '
          'the book says, not what is in the drawer.</p></div>'
          % (HAIR, btn('Count the till', 'accent',
                       '<rect x="2" y="6" width="20" height="12" rx="2"/>'
                       '<circle cx="12" cy="12" r="2.5"/>'), INK6))
checks = ''.join([
  checkrow('done', 'Cash book opened at 08:04',
           'Opening 1,842,000 across cash, mobile money and bank.'),
  checkrow('gap', 'Till not counted yet',
           'Cash, mobile money and bank are all still uncounted.'),
  checkrow('gap', 'Two finished orders carry no invoice',
           'Bwaise Roofing Works and Kyanja Contractors were completed at the counter.'),
  checkrow('idle', 'Nothing undated so far',
           'Checked at 16:52. It is checked again at close.', last=True),
])
tillhead = ('<div style="display:grid;grid-template-columns:%s;align-items:center;gap:8px;'
            'padding:5px 12px;border-bottom:1px solid %s"><span></span>'
            '<span style="font-size:11px;font-weight:600;letter-spacing:.06em;'
            'text-transform:uppercase;color:%s;text-align:right">In</span>'
            '<span style="font-size:11px;font-weight:600;letter-spacing:.06em;'
            'text-transform:uppercase;color:%s;text-align:right">Out</span></div>'
            % (TILLCOLS, RULE, INK6, INK6))
def tillrow(a, i, o, last=False):
    f = ('<span style="%sfont-size:12px;font-weight:500;color:%s;text-align:right">%%s</span>'
         % (MONO, INK))
    return ('<div style="display:grid;grid-template-columns:%s;align-items:center;gap:8px;'
            'min-height:30px;padding:5px 12px;%s"><span style="font-size:12px;color:%s;%s">%s</span>'
            '%s%s</div>' % (TILLCOLS, '' if last else 'border-bottom:1px solid %s;' % HAIR,
                            INK6, CUT, a, f % i, f % o))
closing = pan(pan_h('How the day closed', right=chip('2 to do', 'warn')),
  checks + accent
  + '<div style="display:flex;align-items:center;gap:8px;min-height:26px;padding:5px 12px;'
    'background:#F7F9FB;border-top:1px solid %s;border-bottom:1px solid %s">'
    '<span style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;'
    'color:%s">In / out, by account</span><span style="flex:1"></span>'
    '<span style="font-size:11px;color:%s">so far</span></div>' % (HAIR, HAIR, INK6, INK4)
  + tillhead + tillrow('Cash', '3,490,000', '2,650,000')
  + tillrow('Mobile money', '2,300,000', '530,000')
  + tillrow('Bank', '2,000,000', '&mdash;', last=True))

# ---- the meeting, half-run -------------------------------------------
def move(state, text, outcome, last=False):
    mark, col, word = {
      'done':   ('<path d="M4 12.5l5 5 11-11"/>', GOOD, 'Done'),
      'open':   ('<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l2.5 2.5"/>', WARN, 'Still open'),
    }[state]
    return ('<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 14px;%s">'
            '%s<div style="min-width:0;flex:1">'
            '<div style="font-size:13px;font-weight:500;color:%s;line-height:1.4">%s</div>'
            '<div style="font-size:12px;color:%s;margin-top:2px;line-height:1.45">%s</div></div>'
            '<span style="font-size:11px;font-weight:600;color:%s;white-space:nowrap;'
            'margin-top:1px">%s</span></div>'
            % ('' if last else 'border-bottom:1px solid %s;' % HAIR,
               ico(mark, 16, col, 'margin-top:2px'), INK, text, INK6, outcome, col, word))

meeting = pan(pan_h('The meeting this morning', 'three moves, one still open'),
  '<div style="display:flex;align-items:center;gap:9px;padding:10px 14px;'
  'border-bottom:1px solid %s;background:#F7F9FB">%s<span style="font-size:12px;color:%s">'
  '<b style="color:%s;font-weight:600">The one thing it asked for:</b> Ring Kato before ten '
  '&mdash; they collect on Tuesdays and pay on the spot.</span></div>' % (
    HAIR, ico('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/>', 15, INK6), INK6, INK)
  + '<div style="display:grid;grid-template-columns:minmax(0,1fr) 380px">'
    '<div style="border-right:1px solid %s">%s</div>'
    '<div style="padding:14px 16px">'
    '<p style="font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;'
    'color:%s;margin:0 0 6px">The objective it set</p>'
    '<p style="font-size:13px;color:%s;margin:0 0 3px;font-weight:600">Get the money in</p>'
    '<p style="font-size:12px;color:%s;margin:0;line-height:1.5;max-width:52ch">Two thirds of '
    'last month&rsquo;s sales are still sitting as debt, and the cement order falls due on '
    'Friday.</p></div></div>' % (HAIR, ''.join([
      move('done', 'Ring Kato Construction about the 1,500,000 on INV-2291',
           'Paid in full at 10:41, by mobile money.'),
      move('open', 'Hold the G28 iron sheets for Ssekitoleko&rsquo;s Thursday order',
           '46 sheets left on the shelf. Nothing has been set aside.'),
      move('done', 'Raise cement to 34,000 &mdash; the last two loads cost more',
           'Applied to 9 invoices so far.', last=True)]), INK6, INK, INK6))

# ---- the lists, as far as the day has got ----------------------------
BUY = [('Ssekitoleko Hardware', 2, '2,940,000', '361,000', '2 invoices'),
       ('Kato Construction Ltd', 1, '2,640,000', '291,000', 'INV-2338'),
       ('Walk-in', 7, '618,500', '117,000', '7 counter sales'),
       ('Nakawa Site Stores', 1, '385,000', '61,000', 'INV-2323'),
       ('Kyanja Contractors', 1, '240,000', '33,600', 'no invoice yet'),
       ('Bwaise Roofing Works', 1, '356,500', '28,400', 'no invoice yet')]
rows = [bandrow('Who bought', '6 buyers &middot; 7,180,000'),
        colhead(M.BUY_COLS, [('Customer', 'l'), ('Orders', 'r'), ('Sales', 'r'),
                             ('Gross profit', 'r'), ('', 'l')])]
for i, (n, o, s, p, r) in enumerate(BUY):
    rows.append(drow(M.BUY_COLS, [
        nm(n, r, chip('not invoiced', 'warn') if r.startswith('no invoice') else ''),
        amt(str(o)), amt(s),
        amt(p, '%.1f%% margin' % (float(p.replace(',', '')) / float(s.replace(',', '')) * 100))],
        last=(i == len(BUY) - 1)))
money = pan(pan_h('Money that came in', 'what was invoiced, and separately what actually arrived'),
            ''.join(rows))

page = '''
<div style="width:%dpx;height:%dpx;position:relative;background:#E9EBED;overflow:hidden">
%s
  <div style="position:absolute;top:54px;left:220px;right:0;padding:0 24px 24px;box-sizing:border-box">
    %s
    %s
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 304px;gap:16px;align-items:start;margin-top:16px">
      <div style="display:flex;flex-direction:column;gap:16px">%s%s</div>
      <div>%s</div>
    </div>
  </div>
</div>''' % (W, H, chrome('Insight', 'The day', H),
             M.header('Today', btn('Print the day', 'ghost', M.PRINTER),
                      today_ghost=False, prev_only=True),
             verdict, money, meeting, closing)

open('Closing.dc.html', 'w').write(HEAD + page + '\n</x-dc>\n</body>\n</html>\n')
print('Closing.dc.html', W, 'x', H)
