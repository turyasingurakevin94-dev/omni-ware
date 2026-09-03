# Shared chrome for the Assets & loans boards.
# The rail and the top bar are the real ones: 220px navy rail, 54px bar,
# the Money group open with "Assets & loans" lit where two entries used
# to sit.

HEAD = open('_head.part').read()

NAV = [
    ("Selling", [
        ("Today", '<path d="M4 5h16v14H4z"/><path d="M4 10h16"/>'),
        ("Sell", '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="8" cy="8" r="1.4"/>'),
        ("Order tracking", '<path d="M3 7h13v10H3z"/><path d="M16 10h3l2 3v4h-5z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>'),
    ]),
    ("Money", [
        ("Cash book", '<path d="M3 6h18v12H3z"/><circle cx="12" cy="12" r="2.6"/>'),
        ("What&#39;s coming", '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
        ("Statements", '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 18v-4M12 18v-7M16 18v-2"/>'),
        ("Payroll &amp; rent", '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>'),
        ("__ACTIVE__Assets &amp; loans", '<path d="M3 17h2l1.5-5h11L19 17h2"/><circle cx="7.5" cy="18.5" r="1.8"/><circle cx="16.5" cy="18.5" r="1.8"/><path d="M8 12V7h8v5"/>'),
    ]),
    ("Insight", [
        ("Analysis", '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
        ("Manager", '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
    ]),
]

def chrome(crumb_group, crumb_page, height):
    """Top bar + rail, as an absolutely-positioned pair."""
    rail = []
    for group, items in NAV:
        rail.append('<div style="padding:0 20px;font-size:11px;font-weight:600;'
                    'letter-spacing:.09em;text-transform:uppercase;color:#7C8894;'
                    'margin:14px 0 8px">%s</div>' % group)
        rail.append('<div style="display:flex;flex-direction:column">')
        for name, path in items:
            active = name.startswith('__ACTIVE__')
            label = name.replace('__ACTIVE__', '')
            if active:
                rail.append(
                    '<div style="display:flex;align-items:center;gap:11px;height:34px;'
                    'padding:0 20px 0 17px;color:#fff;font-size:13px;font-weight:600;'
                    'background:rgba(255,255,255,.07);border-left:3px solid #B23A26">'
                    '<svg class="ico" viewBox="0 0 24 24">%s</svg>%s</div>' % (path, label))
            else:
                rail.append(
                    '<div style="display:flex;align-items:center;gap:11px;height:34px;'
                    'padding:0 20px;color:#C7CFD8;font-size:13px">'
                    '<svg class="ico" viewBox="0 0 24 24">%s</svg>%s</div>' % (path, label))
        rail.append('</div>')
    return '''
  <div style="position:absolute;top:0;left:0;right:0;height:54px;background:#14171B;display:flex;align-items:center;gap:6px;padding:0 18px 0 20px;box-sizing:border-box;z-index:3">
    <div style="display:flex;align-items:center;gap:10px;margin-right:18px;flex:none">
      <div style="width:26px;height:26px;border-radius:7px;background:#B23A26;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Archivo Black',sans-serif;font-size:11px">OW</div>
      <div style="color:#fff;font-size:13px;font-weight:600;letter-spacing:-.01em">Omni&#8209;Ware</div>
    </div>
    <div style="display:flex;align-items:baseline;gap:7px;font-size:13px;font-weight:600;color:#fff;white-space:nowrap">
      <span style="color:#8E9BA8;font-weight:500">%s</span><span style="color:#4A545E">/</span><span>%s</span>
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;align-items:center;gap:8px;height:30px;padding:0 10px;border-radius:6px;background:rgba(255,255,255,.07);color:#8E9BA8;font-size:12px;width:230px;box-sizing:border-box">
      <svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      Search anything
    </div>
  </div>
  <div style="position:absolute;top:54px;left:0;width:220px;height:%dpx;background:#14171B;padding:4px 0;box-sizing:border-box;z-index:2">%s</div>
''' % (crumb_group, crumb_page, height - 54, ''.join(rail))


# ---- components, at the exact metrics of the .ow-* layer -------------

MONO = ("font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;"
        "font-variant-numeric:tabular-nums;letter-spacing:-.02em;")

def strip(tiles):
    """.ow-strip -- one 4-up row, hairline dividers, no per-tile border."""
    out = []
    for i, (label, value, sub, tone) in enumerate(tiles):
        col = {'bad': '#7F1D1A', 'warn': '#7A4A02', 'good': '#1C6B58'}.get(tone, '#14171B')
        out.append(
            '<div style="padding:10px 16px;%s">'
            '<p style="font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:#59626B;margin:0 0 4px">%s</p>'
            '<span style="%sfont-size:22px;font-weight:500;letter-spacing:-.03em;line-height:1.1;display:block;color:%s">%s</span>'
            '<p style="font-size:11px;color:#59626B;margin:4px 0 0;line-height:1.35">%s</p>'
            '</div>' % ('' if i == 0 else 'border-left:1px solid #E3E7EA;',
                        label, MONO, col, value, sub))
    return ('<div style="display:grid;grid-template-columns:repeat(4,1fr);background:#fff;'
            'border:1px solid #E3E7EA;border-radius:8px;overflow:hidden">%s</div>' % ''.join(out))

def unit(u):
    return '<span style="font-size:.55em;color:#8A939C;margin-left:.3em;letter-spacing:0">%s</span>' % u

def panel(title, note='', count='', body='', action=''):
    head = ('<div style="display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;'
            'border-bottom:1px solid #E3E7EA;background:#F7F9FB">'
            '<span style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#59626B">%s</span>'
            '%s%s%s</div>') % (
        title,
        ('<span style="font-size:11px;color:#59626B;min-width:0;overflow:hidden;'
         'text-overflow:ellipsis;white-space:nowrap">%s</span>' % note) if note else '',
        ('<span style="font-size:11px;color:#59626B;margin-left:auto;white-space:nowrap;%s">%s</span>'
         % (MONO, count)) if count else '',
        ('<span style="margin-left:auto">%s</span>' % action) if action else '')
    return ('<div style="background:#fff;border:1px solid #E3E7EA;border-radius:8px;overflow:hidden">'
            '%s%s</div>' % (head, body))

def btn(label, kind='ghost', icon='', small=True):
    """.btn / .btn-accent / .btn-ghost, at .ow-sm."""
    base = ("display:inline-flex;align-items:center;gap:6px;height:%dpx;padding:0 %dpx;"
            "border-radius:6px;font-size:12px;font-weight:600;font-family:inherit;"
            "white-space:nowrap;box-sizing:border-box;" % (28 if small else 32, 10 if small else 12))
    skin = {
        'accent': 'background:#B23A26;color:#fff;border:1px solid #B23A26;',
        'ghost':  'background:#fff;color:#14171B;border:1px solid #CFD5DA;',
        'plain':  'background:#F7F9FB;color:#14171B;border:1px solid #CFD5DA;',
        'danger': 'background:#fff;color:#7F1D1A;border:1px solid #CFD5DA;',
    }[kind]
    ic = '<svg class="ico" viewBox="0 0 24 24" style="width:14px;height:14px">%s</svg>' % icon if icon else ''
    return '<span style="%s%s">%s%s</span>' % (base, skin, ic, label)

def chip(text, tone='', dot=False):
    skin = {
        '':     'background:#E9EBED;color:#59626B;',
        'mg':   'background:#F6E7E3;color:#8E2C1C;',
        'bad':  'background:#F7E4E2;color:#7F1D1A;',
        'warn': 'background:#FBEFD9;color:#7A4A02;',
        'good': 'background:#E2EFEB;color:#1C6B58;',
    }[tone]
    d = ('<span style="width:5px;height:5px;border-radius:50%;background:currentColor;'
         'display:inline-block"></span>') if dot else ''
    return ('<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;'
            'font-weight:600;letter-spacing:.02em;height:18px;padding:0 6px;border-radius:4px;'
            '%swhite-space:nowrap">%s%s</span>' % (skin, d, text))

def sidrow(k, v, tone='', strong=False):
    col = {'bad': '#7F1D1A', 'warn': '#7A4A02', 'good': '#1C6B58'}.get(tone, '#14171B')
    return ('<div style="display:flex;align-items:center;gap:8px;height:30px;padding:0 12px;'
            'border-bottom:1px solid #E3E7EA" class="hair">'
            '<span style="flex:1;min-width:0;font-size:12px;color:#59626B;overflow:hidden;'
            'text-overflow:ellipsis;white-space:nowrap">%s</span>'
            '<span style="%sfont-size:12px;font-weight:%d;color:%s">%s</span></div>'
            % (k, MONO, 600 if strong else 500, col, v))

CRESTS = {
  'van':    '<path d="M3 17h2l1.5-5h11L19 17h2"/><circle cx="7.5" cy="18.5" r="1.8"/><circle cx="16.5" cy="18.5" r="1.8"/><path d="M8 12V7h8v5"/>',
  'shelf':  '<path d="M4 4h16v16H4z"/><path d="M4 9.3h16M4 14.6h16"/>',
  'laptop': '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  'weld':   '<path d="M14 3l7 7-4 4-7-7z"/><path d="M10 7L3 14v7h7l7-7"/>',
  'bank':   '<path d="M3 10l9-6 9 6"/><path d="M5 10v9M19 10v9M9.5 10v9M14.5 10v9"/><path d="M3 21h18"/>',
  'boda':   '<circle cx="5.5" cy="17.5" r="3.2"/><circle cx="18.5" cy="17.5" r="3.2"/><path d="M5.5 17.5l4-7h6l3 7"/><path d="M9 6h4l1.5 4.5"/>',
}


# ---- THE REGISTER ROW ------------------------------------------------
# One row per THING. Five tracks: the crest, what it is, what it is
# worth, what is still owed on it, and what is therefore yours. A row
# with no thing behind it (working capital) carries an em-dash under
# Worth, which reads as "there is nothing here", not as zero. A row
# bought outright carries one under Owed.

COLS = '18px minmax(0,1fr) 132px 132px 168px'

def reg_head():
    lab = ('font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;'
           'color:#59626B;')
    return ('<div style="display:grid;grid-template-columns:%s;align-items:center;gap:10px;'
            'padding:6px 12px;border-bottom:1px solid #CFD5DA">'
            '<span></span><span style="%s">What it is</span>'
            '<span style="%stext-align:right">Worth</span>'
            '<span style="%stext-align:right">Owed</span>'
            '<span style="%stext-align:right">Yours, free of debt</span></div>'
            % (COLS, lab, lab, lab, lab))

def fig(value, basis, tone='', dim=False):
    if value is None:
        return ('<div style="text-align:right"><span style="%sfont-size:13px;font-weight:600;'
                'color:#8A939C">&mdash;</span>'
                '<span style="font-size:11px;color:#8A939C;display:block;margin-top:-1px;'
                'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">%s</span></div>'
                % (MONO, basis))
    col = {'bad': '#7F1D1A', 'warn': '#7A4A02', 'good': '#1C6B58'}.get(tone, '#8A939C' if dim else '#14171B')
    return ('<div style="text-align:right">'
            '<span style="%sfont-size:13px;font-weight:600;display:block;color:%s">%s</span>'
            '<span style="font-size:11px;color:#59626B;display:block;margin-top:-1px;'
            'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">%s</span></div>'
            % (MONO, col, value, basis))

def reg_row(crest, name, meta, worth, owed, yours, open_=False, dim=False,
            chips='', expand='', last=False):
    chev = ('<svg class="ico" viewBox="0 0 24 24" style="width:12px;height:12px;color:#8A939C;'
            'justify-self:center;%s"><path d="M9 6l6 6-6 6"/></svg>'
            % ('transform:rotate(90deg)' if open_ else ''))
    ink = '#8A939C' if dim else '#14171B'
    title = ('<div style="min-width:0;display:flex;align-items:center;gap:8px">'
             '<svg class="ico18" viewBox="0 0 24 24" style="color:%s">%s</svg>'
             '<div style="min-width:0">'
             '<div style="display:flex;align-items:center;gap:6px;min-width:0">'
             '<span style="font-size:13px;font-weight:500;letter-spacing:-.005em;color:%s;'
             'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">%s</span>%s</div>'
             '<div style="font-size:11px;color:#59626B;margin-top:1px;overflow:hidden;'
             'text-overflow:ellipsis;white-space:nowrap">%s</div></div></div>'
             % ('#8A939C' if dim else '#59626B', crest, ink, name, chips, meta))
    bg = 'background:#F7F9FB;' if open_ else ''
    row = ('<div style="display:grid;grid-template-columns:%s;align-items:center;gap:10px;'
           'width:100%%;min-height:44px;padding:6px 12px;box-sizing:border-box;%s">'
           '%s%s%s%s%s</div>' % (COLS, bg, chev, title, worth, owed, yours))
    body = row + expand
    edge = '' if last else 'border-bottom:1px solid #E3E7EA;'
    return '<div style="%s">%s</div>' % (edge, body)

def band(text, count=''):
    return ('<div style="font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;'
            'color:#59626B;padding:8px 12px 6px;background:#F7F9FB;border-top:1px solid #CFD5DA;'
            'border-bottom:1px solid #E3E7EA;display:flex"><span>%s</span>'
            '<span style="margin-left:auto;%s">%s</span></div>' % (text, MONO, count))
