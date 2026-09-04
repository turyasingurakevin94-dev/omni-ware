# THE DAY AS IT SHIPS TODAY, drawn at the legacy metrics exactly:
# .page-head (24px Archivo), .panel (radius 12, 22/24 padding, a shadow),
# .an-toolbar, .sum-strip, .pw-tail h4 at 10.5px, .ah-row at 12.5px.
# Nothing here is improved. The point of the board is the length.
from parts import HEAD, chrome
import day_data as D

W, H = 1240, 2620
INK, SOFT, LINE, PANEL, RULES = '#14171B', '#59626B', '#CFD5DA', '#FFFFFF', '#E3E7EA'
MONO = "font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;"

def panel(inner, mb=20):
    return ('<div style="background:%s;border:1px solid %s;border-radius:12px;padding:22px 24px;'
            'margin-bottom:%dpx;box-shadow:0 1px 2px rgba(20,30,40,0.04)">%s</div>'
            % (PANEL, LINE, mb, inner))

def h4(t):
    return ('<h4 style="font-size:10.5px;margin:20px 0 2px;text-transform:uppercase;'
            'letter-spacing:0.7px;color:#8A939C;padding-bottom:6px;border-bottom:1px solid %s;'
            'font-weight:700">%s</h4>' % (LINE, t))

def sub(t):
    return '<div style="font-size:12px;color:%s;margin:0 0 10px">%s</div>' % (SOFT, t)

def kind(t):
    return ('<span style="display:inline-block;margin-left:7px;font-size:10.5px;font-weight:600;'
            'letter-spacing:0.3px;text-transform:uppercase;color:%s;background:%s;border-radius:5px;'
            'padding:1px 6px">%s</span>' % (SOFT, RULES, t))

def row(when, what, amt, left):
    return ('<div style="display:flex;align-items:baseline;gap:10px;padding:9px 0;'
            'border-bottom:1px solid %s;font-size:12.5px">'
            '<span style="flex:0 0 auto;min-width:112px;font-size:11.5px;color:%s">%s</span>'
            '<span style="flex:1 1 200px;min-width:0;font-weight:600;color:%s">%s</span>'
            '<span style="%sfont-weight:700;color:%s;white-space:nowrap">%s</span>'
            '<span style="flex:0 0 auto;min-width:120px;text-align:right;font-size:11.5px;'
            'color:%s;white-space:nowrap">%s</span></div>'
            % (RULES, SOFT, when, INK, what, MONO, INK, amt, SOFT, left))

def more(n, noun):
    return '<p style="margin:8px 0 0;font-size:12px;color:%s">%s more %s not listed.</p>' % (SOFT, n, noun)

def section(title, s, rows):
    return ('<div>%s%s<div style="display:flex;flex-direction:column">%s</div></div>'
            % (h4(title), sub(s) if s else '', ''.join(rows)))

# ---- page head, with the eyebrow the Manager screen already dropped ---
head = ('<div style="margin-bottom:24px">'
        '<p style="margin:0 0 2px;color:%s;font-size:12px;letter-spacing:.06em;'
        'text-transform:uppercase">Insight</p>'
        '<h1 style="font-family:\'Archivo Black\',sans-serif;font-size:24px;margin:0 0 6px;'
        'color:%s;letter-spacing:0.2px">The day</h1>'
        '<p style="margin:0;color:%s;font-size:14px">One day as it happened &mdash; who bought, who paid, '
        'what moved on the shelf, what the orders did, and the meeting held that morning with what '
        'became of each move. Every figure is what the books recorded on the day itself, never how '
        'things stand now.</p></div>' % (SOFT, INK, SOFT))

# ---- the toolbar, in a bordered region of its own --------------------
def gbtn(t):
    return ('<span style="display:inline-flex;align-items:center;height:38px;padding:0 14px;'
            'border:1px solid %s;border-radius:8px;background:#fff;font-size:13px;font-weight:600;'
            'color:%s">%s</span>' % (LINE, INK, t))
toolbar = panel(
  '<div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap">%s'
  '<div style="min-width:180px"><label style="display:block;font-size:11.5px;font-weight:700;'
  'letter-spacing:.4px;text-transform:uppercase;color:%s;margin-bottom:5px">Day</label>'
  '<span style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;'
  'border:1px solid %s;border-radius:7px;font-size:13.5px;background:#FBFCFD;color:%s">'
  '25/08/2026<span style="color:%s">&#128197;</span></span></div>%s%s</div>'
  % (gbtn('&larr; Day before'), SOFT, LINE, INK, SOFT, gbtn('Day after &rarr;'), gbtn('Today')))

# ---- the strip -------------------------------------------------------
def cell(v, l, first):
    return ('<div style="flex:1 1 130px;background:#fff;padding:12px 14px">'
            '<div style="%sfont-size:21px;font-weight:700;line-height:1.1;color:%s">%s</div>'
            '<div style="font-size:10.5px;font-weight:700;letter-spacing:0.7px;'
            'text-transform:uppercase;color:%s;margin-top:4px">%s</div></div>'
            % (MONO, INK, v, SOFT, l))
strip = panel(
  '<div style="font-size:15px;font-weight:600;letter-spacing:-.01em;color:%s;margin:18px 0 8px">'
  '25 Aug 2026</div>'
  '<div style="display:flex;flex-wrap:wrap;gap:1px;background:%s;border:1px solid %s;'
  'border-radius:12px;overflow:hidden;margin-bottom:16px">%s%s%s%s</div>'
  '<p style="margin:8px 0 0;font-size:12px;color:%s">* part of that profit was costed by estimate, '
  'so it is a good figure rather than a certain one.</p>'
  % (SOFT, LINE, LINE,
     cell(D.SALES_TOTAL, '24 sales', True), cell(D.PROFIT, 'gross profit *', False),
     cell(D.COLLECTED, '4 people paid', False), cell(D.TILL_NET, 'through the till', False), SOFT))

# ---- the one long panel ----------------------------------------------
secs = []
secs.append(section('Who bought', '', [row('', '%s%s' % (n, kind('%d order%s' % (o, '' if o == 1 else 's'))), s, '')
                                       for n, o, s, _p, _r in D.BUYERS]) + more(2, 'buyers'))
secs.append(section('Who paid', 'Money that arrived &mdash; not the bookkeeping that follows an invoice.',
                    [row('', n, a, '') for n, _, a, _ in D.PAYERS_ROWS]))
secs.append(section('What came in', '', [row('', '%s%s' % (l, kind(nt)), d, '%s on the shelf' % lf)
                                         for l, d, lf, nt in D.CAME_IN]))
secs.append(section('What went out', '',
                    [row('', l + (kind(nt) if nt else ''), d, '%s left' % lf) for l, d, lf, nt in D.WENT_OUT])
            + more(3, 'movements'))
secs.append(section('Counted', 'The shop correcting its own record &mdash; neither a delivery nor a sale.',
                    [row('', l, d, '%s counted' % lf) for l, d, lf, _ in D.COUNTED]))
secs.append('<p style="margin:8px 0 0;font-size:12px;color:%s"><b>Ran out on this day:</b> %s.</p>'
            % (SOFT, ', '.join(x[0] for x in D.RAN_OUT)))
secs.append(section('Orders that moved', '', [row('', n, '', kind(s)) for n, s, _ in D.MOVED]))
secs.append(section('Finished', '', [row('', n, '', kind(s)) for n, s, _ in D.FINISHED]))
secs.append(section('Days named', 'What a customer said, on the day they said it.',
                    [row(w, n, a if a != 'the whole balance' else '<i>the whole balance</i>', '')
                     for n, w, a, _ in D.PROMISES]))
secs.append('<p style="margin:8px 0 0;font-size:12px;color:%s">31 cash entries on this day: '
            '8,420,000 in, 3,180,000 out.</p>' % SOFT)
body = panel(''.join(secs))

meeting = panel(
  '<div style="font-size:15px;font-weight:600;color:%s;margin:18px 0 8px">The meeting that morning</div>'
  '<div style="background:#E9EBED;border:1px dashed %s;border-radius:10px;padding:10px 13px;'
  'font-size:13.5px;color:%s;margin:0 0 12px"><b>%s.</b> %s</div>'
  '<div style="background:#E9EBED;border:1px dashed %s;border-radius:10px;padding:10px 13px;'
  'font-size:13.5px;color:%s;margin:0 0 12px"><b>The one thing:</b> %s</div>'
  '%s' % (SOFT, LINE, INK, D.MEETING_OBJ, D.MEETING_WHY, LINE, INK, D.MEETING_KEY,
          ''.join('<div style="background:#fff;border:1px solid %s;border-radius:10px;padding:11px 13px;'
                  'margin-bottom:8px;font-size:13px"><b>%s</b><div style="font-size:12px;color:%s;'
                  'margin-top:3px">%s</div></div>' % (LINE, t, SOFT, o)
                  for _, t, o in D.MEETING_MOVES)))

page = '''
<div style="width:%dpx;height:%dpx;position:relative;background:#E9EBED;overflow:hidden">
%s
  <div style="position:absolute;top:54px;left:220px;right:0;padding:30px 40px 40px;box-sizing:border-box">
    %s%s%s%s%s
  </div>
</div>''' % (W, H, chrome('Insight', 'The day', H), head, toolbar, strip, body, meeting)

open('Before.dc.html', 'w').write(HEAD + page + '\n</x-dc>\n</body>\n</html>\n')
print('Before.dc.html', W, 'x', H)
