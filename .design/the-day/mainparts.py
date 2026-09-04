# Pieces shared by the console board and the state boards.
from parts import (HEAD, chrome, MONO, ico, vtile, vstrip, pan, pan_h, bandrow, colhead,
                   drow, nm, amt, note, checkrow, btn, chip, LAB, CUT, INK, INK6, INK4,
                   RULE, HAIR, OXIDE, GOOD, WARN, BAD, ARROW_UP, ARROW_DOWN, ARROW_FLAT)
import day_data as D

CHEV = '<path d="M9 6l6 6-6 6"/>'
PRINTER = ('<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="7" rx="1.5"/>'
           '<path d="M7 16h10v5H7z"/>')


# ---- the page header, and the day it is reading ----------------------
def header(day_label, primary, today_ghost=True, prev_only=False):
    seg = ('<div style="display:flex;align-items:stretch;height:28px;border:1px solid %s;'
           'border-radius:6px;overflow:hidden;background:#fff">'
           '<span style="display:flex;align-items:center;padding:0 8px;border-right:1px solid %s">%s</span>'
           '<span style="display:flex;align-items:center;padding:0 12px;font-size:12px;'
           'font-weight:600;color:%s;white-space:nowrap;%s">%s</span>'
           '<span style="display:flex;align-items:center;padding:0 8px;border-left:1px solid %s;'
           '%s">%s</span></div>'
           % (RULE, RULE, ico('<path d="M15 6l-6 6 6 6"/>', 14, INK6), INK, MONO, day_label,
              RULE, 'background:#F7F9FB;' if prev_only else '',
              ico('<path d="M9 6l6 6-6 6"/>', 14, INK4 if prev_only else INK6)))
    return ('''
  <div style="display:flex;align-items:flex-end;gap:12px;padding:16px 0 12px;
    border-bottom:1px solid %s;margin-bottom:16px">
    <div>
      <div style="display:flex;align-items:center;gap:7px">
        <h1 style="font-family:'Archivo Black',sans-serif;font-size:19px;margin:0;
          letter-spacing:-.015em;line-height:1.1">The day</h1>
        <span style="width:16px;height:16px;border-radius:50%%;border:1px solid %s;color:%s;
          font-size:10px;font-weight:600;display:inline-flex;align-items:center;
          justify-content:center">i</span>
      </div>
      <p style="font-size:12px;color:%s;margin:3px 0 1px">Every figure is what the books recorded
        on that day &mdash; never how things stand now</p>
    </div>
    <span style="flex:1"></span>
    %s%s<span>%s</span>
  </div>''' % (RULE, RULE, INK6, INK6, seg,
               ('<span style="margin-left:6px">%s</span>' % btn('Today', 'ghost')) if today_ghost else '',
               primary))


def day_head(title, right=''):
    """The 34px head of the verdict panel: which day, and how it stands."""
    return ('<div style="display:flex;align-items:center;gap:10px;min-height:36px;padding:0 16px;'
            'border-bottom:1px solid %s;background:#F7F9FB">'
            '<span style="font-size:13px;font-weight:600;letter-spacing:-.01em;color:%s">%s</span>'
            '<span style="flex:1"></span>%s</div>' % (HAIR, INK, title, right))


ARROWS = {'up': ARROW_UP, 'down': ARROW_DOWN, 'flat': ARROW_FLAT}


def verdict(rows, head_right, title=None):
    tiles = [vtile(lab, val, (ARROWS[ar], txt, tone), basis, first=(i == 0))
             for i, (lab, val, _typ, ar, txt, tone, basis) in enumerate(rows)]
    return pan(day_head(title or D.DAY_LONG, head_right), vstrip(tiles))


# ---- the lists -------------------------------------------------------
BUY_COLS  = 'minmax(0,1fr) 62px 130px 122px 12px'
PAY_COLS  = 'minmax(0,1fr) 108px 128px 12px'
SHELF_COLS = 'minmax(0,1fr) 84px 116px 12px'


def buyers_band():
    out = [bandrow('Who bought', '10 buyers &middot; 11,540,000'),
           colhead(BUY_COLS, [('Customer', 'l'), ('Orders', 'r'), ('Sales', 'r'),
                              ('Gross profit', 'r'), ('', 'l')])]
    for i, (n, o, s, p, ref) in enumerate(D.BUYERS):
        out.append(drow(BUY_COLS, [
            nm(n, ref),
            amt(str(o)), amt(s),
            amt(p, '%.1f%% margin' % (float(p.replace(',', '')) / float(s.replace(',', '')) * 100)),
        ], hover=(i == 0)))
    out.append(note('Two more buyers, 307,500 between them, are not listed. '
                    'Sorted by what they took, largest first.'))
    return out


def payers_band():
    out = [bandrow('Who paid', '4 people &middot; 2,970,000'),
           colhead(PAY_COLS, [('Customer', 'l'), ('Arrived by', 'l'), ('Amount', 'r'), ('', 'l')])]
    for i, (n, ag, a, how) in enumerate(D.PAYERS_ROWS):
        out.append(drow(PAY_COLS, [
            nm(n, ag),
            '<span style="font-size:12px;color:%s;%s">%s</span>' % (INK6, CUT, how),
            amt(a),
        ], last=(i == len(D.PAYERS_ROWS) - 1)))
    return out


def money_panel():
    return pan(pan_h('Money that came in',
                     'what was invoiced, and separately what actually arrived'),
               ''.join(buyers_band() + payers_band()))


def shelf_panel():
    out = [colhead(SHELF_COLS, [('Line', 'l'), ('Moved', 'r'), ('On the shelf', 'r'), ('', 'l')]),
           bandrow('Ran out', '2 lines', tone='warn')]
    for i, (line, mv, when) in enumerate(D.RAN_OUT):
        out.append(drow(SHELF_COLS, [
            nm(line, 'last sold at %s' % when), amt(mv),
            amt('0', 'nothing left', tone='bad'),
        ], last=(i == len(D.RAN_OUT) - 1)))
    out.append(bandrow('Came in', '3 deliveries'))
    for l, d, lf, nt in D.CAME_IN:
        out.append(drow(SHELF_COLS, [nm(l, nt), amt(d, tone='good'),
                                     amt(lf, dim=True)]))
    out.append(bandrow('Went out', '11 lines'))
    for l, d, lf, nt in D.WENT_OUT:
        out.append(drow(SHELF_COLS, [
            nm(l, nt if nt else ''),
            amt(d),
            amt(lf, tone='bad' if lf == '0' else '', dim=(lf != '0')),
        ]))
    out.append(note('Three more movements, 41 units between them, are not listed.'))
    out.append(bandrow('Counted', '2 corrections'))
    for i, (l, d, lf, nt) in enumerate(D.COUNTED):
        out.append(drow(SHELF_COLS, [nm(l, nt), amt(d, tone='warn' if d.startswith('&minus;') else ''),
                                     amt(lf, dim=True)], last=(i == len(D.COUNTED) - 1)))
    return pan(pan_h('The shelf', 'a count is the shop correcting its own record &mdash; '
                                  'neither a delivery nor a sale'), ''.join(out))


# ---- the rail --------------------------------------------------------
def srow(k, v, tone='', last=False, mono=True):
    edge = '' if last else 'border-bottom:1px solid %s;' % HAIR
    return ('<div style="display:flex;align-items:center;gap:8px;min-height:30px;padding:5px 12px;%s">'
            '<span style="flex:1;min-width:0;font-size:12px;color:%s;%s">%s</span>'
            '<span style="%sfont-size:12px;font-weight:600;color:%s;white-space:nowrap">%s</span></div>'
            % (edge, INK6, CUT, k, MONO if mono else '',
               {'good': GOOD, 'warn': WARN, 'bad': BAD}.get(tone, INK), v))


def work_panel():
    out = [bandrow('Orders that moved', '3')]
    for n, s, t in D.MOVED:
        out.append(drow('minmax(0,1fr) 12px', [nm(n, '%s &middot; %s' % (s, t))]))
    out.append(bandrow('Finished', '2'))
    for n, s, t in D.FINISHED:
        out.append(drow('minmax(0,1fr) 12px', [nm(n, 'Completed &middot; %s' % t)]))
    out.append(bandrow('Days named', '2'))
    for i, (n, w, a, ag) in enumerate(D.PROMISES):
        out.append(drow('minmax(0,1fr) 12px', [
            nm(n, 'said %s &middot; %s' % (w, a if a != 'the whole balance' else 'the whole balance'))],
            last=(i == len(D.PROMISES) - 1)))
    out.append(note('A day a customer named is their word, not a commitment. It keeps them out of '
                    'the chasing queue until it comes.'))
    return pan(pan_h('The work'), ''.join(out))


def baseline_panel():
    rows = []
    for i, (lab, val, typ, ar, txt, tone, basis) in enumerate(D.BASELINE):
        col = {'good': GOOD, 'warn': WARN, 'bad': BAD}.get(tone, INK6)
        short = txt.split(' a typical')[0]
        rows.append('<div style="padding:9px 12px;%s">'
                    '<div style="display:flex;align-items:baseline;gap:8px">'
                    '<span style="font-size:12px;color:%s;flex:1;min-width:0;%s">%s</span>'
                    '<span style="%sfont-size:12px;font-weight:600;color:%s">%s</span></div>'
                    '<div style="display:flex;align-items:center;gap:4px;margin-top:3px">'
                    '%s<span style="font-size:11px;font-weight:600;color:%s;white-space:nowrap">%s</span>'
                    '<span style="flex:1"></span>'
                    '<span style="font-size:11px;color:%s;white-space:nowrap">typical '
                    '<span style="%s">%s</span></span></div></div>'
                    % ('' if i == len(D.BASELINE) - 1 else 'border-bottom:1px solid %s;' % HAIR,
                       INK6, CUT, lab, MONO, INK, val,
                       ico(ARROWS[ar], 12, col), col, short, INK4, MONO, typ))
    rows.append(note('A typical Tuesday is the middle of the last five Tuesdays, 21 July to '
                     '18 August. Tuesdays only &mdash; a Tuesday against a Sunday says nothing.'))
    return pan(pan_h('Against a typical Tuesday'), ''.join(rows))
