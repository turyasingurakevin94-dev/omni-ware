# THE DAY, AS A CONSOLE. 1440, a Tuesday that has been closed and counted.
from parts import HEAD, chrome, pan, pan_h, note, checkrow, btn, chip, ico, MONO, \
    INK, INK6, INK4, RULE, HAIR, GOOD, WARN, BAD, OXIDE, CUT
import mainparts as M
import day_data as D

W, H = 1440, 2240

closed_chip = chip('Closed and counted', 'good', dot=True)
TILLCOLS = 'minmax(0,1fr) 72px 72px'

# ---- how the day closed ----------------------------------------------
checks = [
  checkrow('done', 'Cash book opened at 08:04',
           'Opening 1,842,000 across cash, mobile money and bank.'),
  checkrow('done', 'Till counted at close, 18:40',
           'All three accounts agreed to the shilling.'),
  checkrow('done', '31 movements recorded',
           '24 invoices, 4 collections, 3 payments out.'),
  checkrow('done', 'Nothing left undated',
           'No sale, payment or movement is sitting without a date.', last=True),
]
def tillrow(acct, cin, cout, last=False, strong=False):
    edge = '' if last else 'border-bottom:1px solid %s;' % HAIR
    f = ('<span style="%sfont-size:12px;font-weight:%d;color:%s;text-align:right">%s</span>'
         % (MONO, 600 if strong else 500, INK, '%s'))
    return ('<div style="display:grid;grid-template-columns:%s;align-items:center;gap:8px;'
            'min-height:30px;padding:5px 12px;%s">'
            '<span style="font-size:12px;color:%s;%s">%s</span>%s%s</div>'
            % (TILLCOLS, edge, INK if strong else INK6, CUT, acct, f % cin, f % cout))

tills = [
  '<div style="display:grid;grid-template-columns:%s;align-items:center;gap:8px;padding:5px 12px;'
  'border-bottom:1px solid %s"><span></span>'
  '<span style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;'
  'color:%s;text-align:right">In</span>'
  '<span style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;'
  'color:%s;text-align:right">Out</span></div>' % (TILLCOLS, RULE, INK6, INK6),
  tillrow('Cash', '4,120,000', '2,650,000'),
  tillrow('Mobile money', '2,300,000', '530,000'),
  tillrow('Bank', '2,000,000', '&mdash;'),
  '<div style="display:flex;align-items:center;gap:8px;min-height:30px;padding:5px 12px">'
  '<span style="font-size:12px;font-weight:600;color:%s;flex:1">Net through the till</span>'
  '<span style="%sfont-size:12px;font-weight:600;color:%s">5,240,000</span></div>' % (INK, MONO, INK),
]
closing = pan(
  pan_h('How the day closed'),
  ''.join(checks)
  + '<div style="display:flex;align-items:center;gap:8px;min-height:26px;padding:5px 12px;'
    'background:#F7F9FB;border-top:1px solid %s;border-bottom:1px solid %s">'
    '<span style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;'
    'color:%s">In / out, by account</span></div>' % (HAIR, HAIR, INK6)
  + ''.join(tills))

# ---- the meeting -------------------------------------------------------
def move(state, text, outcome, last=False):
    mark, col, word = {
      'done':   ('<path d="M4 12.5l5 5 11-11"/>', GOOD, 'Done'),
      'missed': ('<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-6 6M9 9l6 6"/>', BAD, 'Not done'),
    }[state]
    edge = '' if last else 'border-bottom:1px solid %s;' % HAIR
    return ('<div style="display:flex;align-items:flex-start;gap:10px;padding:11px 14px;%s">'
            '%s<div style="min-width:0;flex:1">'
            '<div style="font-size:13px;font-weight:500;color:%s;line-height:1.4">%s</div>'
            '<div style="font-size:12px;color:%s;margin-top:2px;line-height:1.45">%s</div></div>'
            '<span style="font-size:11px;font-weight:600;color:%s;white-space:nowrap;'
            'margin-top:1px">%s</span></div>'
            % (edge, ico(mark, 16, col, 'margin-top:2px'), INK, text, INK6, outcome, col, word))

meeting = pan(
  pan_h('The meeting that morning', 'what was decided, and what became of each move'),
  '<div style="display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:0;align-items:start">'
  '<div style="border-right:1px solid %s">%s</div>'
  '<div style="padding:14px 16px">'
  '<p style="font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;'
  'color:%s;margin:0 0 6px">The objective it set</p>'
  '<p style="font-size:13px;color:%s;margin:0 0 3px;font-weight:600">%s</p>'
  '<p style="font-size:12px;color:%s;margin:0 0 14px;line-height:1.5;max-width:52ch">%s</p>'
  '<p style="font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;'
  'color:%s;margin:0 0 6px">Considered and rejected</p>'
  '<p style="font-size:12px;color:%s;margin:0;line-height:1.5;max-width:52ch">%s</p>'
  '</div></div>'
  % (HAIR,
     ''.join(move(s, t, o, last=(i == len(D.MEETING_MOVES) - 1))
             for i, (s, t, o) in enumerate(D.MEETING_MOVES)),
     INK6, INK, D.MEETING_OBJ, INK6, D.MEETING_WHY, INK6, INK6, D.MEETING_REJECTED))

keyline = ('<div style="display:flex;align-items:center;gap:9px;padding:10px 14px;'
           'border-bottom:1px solid %s;background:#F7F9FB">%s'
           '<span style="font-size:12px;color:%s"><b style="color:%s;font-weight:600">'
           'The one thing it asked for:</b> %s</span></div>'
           % (HAIR, ico('<circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/>', 15, INK6),
              INK6, INK, D.MEETING_KEY))
meeting = meeting.replace('</div><div style="display:grid', '</div>' + keyline + '<div style="display:grid', 1)

primary = btn('Print the day', 'accent', M.PRINTER)

page = '''
<div style="width:%dpx;height:%dpx;position:relative;background:#E9EBED;overflow:hidden">
%s
  <div style="position:absolute;top:54px;left:220px;right:0;padding:0 24px 24px;box-sizing:border-box">
    %s
    %s
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 304px;gap:16px;align-items:start;margin-top:16px">
      <div style="display:flex;flex-direction:column;gap:16px">%s%s</div>
      <div style="display:flex;flex-direction:column;gap:16px">%s%s%s</div>
    </div>
    <div style="margin-top:16px">%s</div>
  </div>
</div>''' % (W, H, chrome('Insight', 'The day', H),
             M.header(D.DAY_SHORT, primary),
             M.verdict(D.BASELINE, closed_chip),
             M.money_panel(), M.shelf_panel(),
             closing, M.baseline_panel(), M.work_panel(),
             meeting)

open('Main.dc.html', 'w').write(HEAD + page + '\n</x-dc>\n</body>\n</html>\n')
print('Main.dc.html', W, 'x', H)
