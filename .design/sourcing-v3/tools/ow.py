"""The phone design language (docs/phone-design-language.md), as markup
snippets lifted from the Store canvas, so every Sourcing board is built from
the same pieces. Each function returns an HTML string for a .dc.html board.

Holes ({{x}}) pass through untouched: write them in plain (non-f) strings or
double the braces inside f-strings.
"""

MONO = "font-family: 'IBM Plex Mono', monospace"
HEAD_BG = 'radial-gradient(130% 90% at 50% 0%, #2B3866 0%, #16203C 65%)'
DONE_BG = 'radial-gradient(130% 60% at 50% 0%, #2B3866 0%, #16203C 55%, #111A33 100%)'
LIST = 'background: #FFFFFF; border-radius: 22px; box-shadow: inset 0 0 0 1px #E6E3DD, 0 4px 14px rgba(22,32,60,.05)'

# soft tints: identity, never status
TINT = {
    'manager': ('#F6E4F1', '#7A3268'),   # Ruth; also rivals
    'indigo': ('#E4E6FA', '#3A3F9B'),    # Denis, suppliers
    'green': ('#E4F4EA', '#0F6B43'),
    'sky': ('#DCEAF8', '#1A5A8A'),
    'amber': ('#FDEEE1', '#95530C'),
    'teal': ('#DDF1EE', '#0E5E57'),
    'oxide': ('#FDE8E4', '#A82D24'),     # asks, demand
    'crimson': ('#FBE5E2', '#8E2A22'),
    'plain': ('#F1EEE8', '#5F6980'),
}

ICON = {
    'back': 'm15 6-6 6 6 6',
    'close': 'M6 6l12 12M18 6 6 18',
    'chev': 'm9 6 6 6-6 6',
    'tick': 'm5 12.5 4.5 4.5L19 7.5',
    'search': 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.2-4.2',
    'item': 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9',
    'supplier': 'M3 21V9l9-5 9 5v12M8 21v-7h8v7',
    'rival': 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'tag': 'M3 12V4h8l10 10-8 8zM7.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
    'camera': 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    'ask': 'M4 5h16v11H8l-4 4z',
    'phone': 'M7 3h10v18H7zM11 18h2',
    'call': 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
    'returned': 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
    'send': 'M21 3 3 10.5l7 2.5 2.5 7zM10 13 21 3',
    'route': 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h6a4 4 0 0 0 0-8h-2',
    'clock': 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    'plus': 'M12 5v14M5 12h14',
    'mic': 'M9 3h6v11H9zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
    'doc': 'M6 3h9l4 4v14H6zM9 11h7M9 14.5h7M9 18h4',
    'funnel': 'M3 5h18l-7 8v6l-4-2v-4z',
    'deal': 'M4 17 9 12l4 4 7-7M14 9h6v6',
    'star': 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z',
    'gauge': 'M4 18a8 8 0 0 1 16 0M12 18l4-6',
    'box': 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9',
    'name': 'M4 6h16M4 12h10M4 18h7',
    'warn': 'M12 4 2.5 20h19zM12 10v4M12 17h.01',
    'bell': 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    'pin': 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    'twins': 'M9 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM15 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    'outbox': 'M7 3h10v18H7zM11 18h2',
    'user': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
}


def svg(path, size=18, sw=2, color='currentColor'):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            f'<path d="{ICON.get(path, path)}"></path></svg>')


def page(title, body, script, data_props='{"$preview":{"width":390,"height":844}}', extra_css=''):
    """A full .dc.html board, 390x844, the paper body; body is the inner markup."""
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sourcing · {title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{{margin:0}}
/* figures in the mono face everywhere, words in Figtree: digits come from Plex Mono */
@font-face{{font-family:'OW Figures';font-weight:400;src:url(https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n1i8q1w.woff2) format('woff2');unicode-range:U+0030-0039}}
@font-face{{font-family:'OW Figures';font-weight:500;src:url(https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJwlBFgg.woff2) format('woff2');unicode-range:U+0030-0039}}
@font-face{{font-family:'OW Figures';font-weight:600 700;src:url(https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwlBFgg.woff2) format('woff2');unicode-range:U+0030-0039}}
.nm{{font-family:Figtree,system-ui,sans-serif}}
a{{color:inherit;text-decoration:none}}a:hover{{color:inherit}}
input::placeholder{{color:#6B7480}}
/* rule 10: a drawn size is not the hit area. Every control reaches at least 44 x 44 */
:where(a,button,[role=radio],[role=tab],[role=switch]):not([style*="position: absolute"]):not([style*="position:absolute"]){{position:relative!important}}
:where(a,button,[role=radio],[role=tab],[role=switch])::before{{content:"";position:absolute;left:50%;top:50%;width:max(100%,44px);height:max(100%,44px);transform:translate(-50%,-50%)}}
*{{scrollbar-width:none}}*::-webkit-scrollbar{{display:none}}
.m{{font-family:'IBM Plex Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;letter-spacing:-.02em}}
@keyframes owPop{{0%{{transform:scale(.6);opacity:0}}60%{{transform:scale(1.08);opacity:1}}100%{{transform:scale(1)}}}}
@keyframes owPulseA{{0%{{box-shadow:0 0 0 0 rgba(245,178,107,.6)}}70%{{box-shadow:0 0 0 6px rgba(245,178,107,0)}}100%{{box-shadow:0 0 0 0 rgba(245,178,107,0)}}}}
@keyframes owRingA{{0%,100%{{box-shadow:0 0 0 3px #19223F,0 0 0 5px rgba(245,178,107,.95)}}50%{{box-shadow:0 0 0 3px #19223F,0 0 0 8px rgba(245,178,107,.25)}}}}
@keyframes owUndoRun{{to{{stroke-dashoffset:62.8}}}}
@keyframes owGone{{to{{opacity:0;visibility:hidden}}}}
@keyframes owChev{{0%,100%{{opacity:.35;transform:translateX(0)}}50%{{opacity:1;transform:translateX(4px)}}}}
{extra_css}</style>
</helmet>
<div style="width: 390px; height: 844px; position: relative; overflow: hidden; background: #F7F5F2; font-family: 'OW Figures', Figtree, system-ui, sans-serif; color: #1C2233; display: flex; flex-direction: column">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{data_props}'>
{script}
</script>
</body>
</html>
'''


def circ(href=None, icon='back', label='Back', onclick=None, blank=False, style=''):
    """A 44px head circle. blank keeps the title centred."""
    if blank:
        return '<span style="width: 44px; height: 44px; flex: none"></span>'
    inner = svg(icon, 18, 2.2)
    base = f'width: 44px; height: 44px; flex: none; border-radius: 999px; background: rgba(255,255,255,.08); color: #FFFFFF; display: flex; align-items: center; justify-content: center{style}'
    if onclick:
        return f'<button type="button" onClick="{onclick}" aria-label="{label}" style="all: unset; cursor: pointer; box-sizing: border-box; {base}">{inner}</button>'
    return f'<a href="{href}" aria-label="{label}" style="{base}">{inner}</a>'


def head(title, left='', right='', picture='', pad='10px 16px 20px', gap=16):
    """The navy head: circles and a centred grey title, then the state as a picture."""
    left = left or circ(blank=True)
    right = right or circ(blank=True)
    return f'''  <div style="flex: none; background: {HEAD_BG}; border-radius: 0 0 30px 30px; padding: {pad}; color: #FFFFFF; display: flex; flex-direction: column; gap: {gap}px">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px">
      {left}
      <span style="flex: 1; min-width: 0; text-align: center; font-size: 13px; font-weight: 700; color: #B3BCD2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{title}</span>
      {right}
    </div>
{picture}
  </div>'''


def title_block(title, sub='', lead=''):
    """A big title on navy with an optional leading badge (initials, icon)."""
    return f'''    <div style="display: flex; align-items: center; gap: 14px">
      {lead}
      <span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span class="nm" style="font-size: 22px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2">{title}</span>{f'<span style="font-size: 12px; font-weight: 600; color: #B3BCD2">{sub}</span>' if sub else ''}</span>
    </div>'''


def badge(icon, bg='#FDEEE1', ink='#95530C', size=56, anim=''):
    return (f'<span style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; color: {ink}; '
            f'display: flex; align-items: center; justify-content: center{"; animation: " + anim if anim else ""}">{svg(icon, 24, 2.2)}</span>')


def face(ini, tint='manager', size=42, ring=''):
    bg, ink = TINT[tint]
    fs = 13 if size >= 40 else 11
    return (f'<span style="width: {size}px; height: {size}px; flex: none; border-radius: 999px; background: {bg}; color: {ink}; '
            f'font-size: {fs}px; font-weight: 700; display: flex; align-items: center; justify-content: center{"; box-shadow: " + ring if ring else ""}">{ini}</span>')


def stats(cells, height=64):
    """A stat strip on navy: cells = [(figure, label, colour or None)]."""
    out = []
    for i, (fig, label, col) in enumerate(cells):
        div = '; box-shadow: -1px 0 0 rgba(255,255,255,.07)' if i else ''
        c = f'; color: {col}' if col else ''
        out.append(f'<span style="height: {height}px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0 4px{div}">'
                   f'<span style="{MONO}; font-size: 22px; font-weight: 600; line-height: 1{c}">{fig}</span>'
                   f'<span style="font-size: 11px; font-weight: 600; color: #B3BCD2; text-align: center">{label}</span></span>')
    return (f'    <div style="display: grid; grid-template-columns: repeat({len(cells)}, minmax(0, 1fr)); border-radius: 18px; '
            f'background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07)">' + ''.join(out) + '</div>')


def ring(frac, label, size=48, stroke=5, col='#6FDCB0', track='rgba(255,255,255,.12)', fs=12, aria='', part=0):
    """part: a further share drawn as a dashed arc after the solid one, for checks
    filled for you and not yet kept (they never count in the figure)."""
    r = (size - stroke) / 2 - 1
    c = 2 * 3.14159 * r
    on = round(c * max(0, min(1, frac)), 1)
    extra = ''
    if part:
        pl = c * part
        n = max(1, int((pl + 2) // 4.5))
        extra = (f'<circle cx="{size/2}" cy="{size/2}" r="{r:.1f}" fill="none" stroke="{col}" stroke-width="{stroke}" stroke-opacity=".6" '
                 f'stroke-dasharray="{' '.join(['2.5'] * n).replace(' ', ' 2 ')} {round(c, 1)}" '
                 f'transform="rotate({round(-90 + frac * 360 + 3, 1)} {size/2} {size/2})"></circle>')
    return (f'<span role="img" aria-label="{aria or label}" style="position: relative; width: {size}px; height: {size}px; flex: none; display: block">'
            f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" aria-hidden="true">'
            f'<circle cx="{size/2}" cy="{size/2}" r="{r:.1f}" fill="none" stroke="{track}" stroke-width="{stroke}"></circle>'
            f'<circle cx="{size/2}" cy="{size/2}" r="{r:.1f}" fill="none" stroke="{col}" stroke-width="{stroke}" stroke-linecap="round" '
            f'stroke-dasharray="{on} {round(c,1)}" transform="rotate(-90 {size/2} {size/2})"></circle>{extra}</svg>'
            f'<span style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; {MONO}; font-size: {fs}px; font-weight: 600">{label}</span></span>')


def body(inner, pad='18px 16px 24px', gap=10):
    return f'''  <div style="flex: 1; min-height: 0; overflow-y: auto; padding: {pad}; display: flex; flex-direction: column; gap: {gap}px">
{inner}
  </div>'''


def sec(text, right='', first=False):
    pad = '0 4px' if first else '8px 4px 0'
    if right:
        return (f'    <div style="display: flex; align-items: baseline; justify-content: space-between; padding: {pad}">'
                f'<span style="font-size: 13px; font-weight: 700; color: #5F6980">{text}</span>'
                f'<span style="font-size: 12px; font-weight: 600; color: #5F6980">{right}</span></div>')
    return f'    <span style="padding: {pad}; font-size: 13px; font-weight: 700; color: #5F6980">{text}</span>'


def lst(rows):
    return f'    <div style="{LIST}; padding: 6px; display: flex; flex-direction: column; gap: 2px">\n{rows}\n    </div>'


def icon_well(icon, tint='plain', size=42, radius=13):
    bg, ink = TINT[tint]
    return (f'<span style="width: {size}px; height: {size}px; flex: none; border-radius: {radius}px; background: {bg}; color: {ink}; '
            f'display: flex; align-items: center; justify-content: center">{svg(icon, 19, 2)}</span>')


def row(title, sub='', lead='', right='', href=None, onclick=None, min_h=66, sub_style='color: #5F6980', aria=''):
    """One line in a list: lead (icon well or face), title over subtitle, something on the right."""
    sub_html = f'<span style="font-size: 12px; font-weight: 600; {sub_style}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span>' if sub else ''
    inner = (f'{lead}<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">'
             f'<span class="nm" style="font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{title}</span>{sub_html}</span>{right}')
    base = f'display: flex; align-items: center; gap: 12px; min-height: {min_h}px; padding: 0 10px; border-radius: 16px'
    al = f' aria-label="{aria}"' if aria else ''
    if href:
        return f'      <a href="{href}"{al} style="{base}">{inner}</a>'
    if onclick:
        return f'      <button type="button" onClick="{onclick}"{al} style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; {base}">{inner}</button>'
    return f'      <div style="{base}">{inner}</div>'


def chev(col='#6B7480'):
    return f'<span style="flex: none; display: flex">{svg("chev", 16, 2.4, col)}</span>'


def chip(text, tint='plain', mono=False, h=26):
    bg, ink = TINT[tint]
    f = f'{MONO}; ' if mono else ''
    return (f'<span style="flex: none; height: {h}px; padding: 0 10px; border-radius: 999px; background: {bg}; color: {ink}; '
            f'{f}font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap">{text}</span>')


def pill(label, href=None, onclick=None, kind='red', icon=None, style_hole=''):
    """58px pill. kind: red (the one action), white (on navy), ghost (outlined), navy."""
    k = {
        'red': 'background: #C93A30; color: #FFFFFF; box-shadow: 0 10px 22px rgba(201,58,48,.26)',
        'white': 'background: #FFFFFF; color: #16203C; box-shadow: 0 10px 24px rgba(0,0,0,.25)',
        'ghost': 'background: #FFFFFF; color: #16203C; box-shadow: inset 0 0 0 1.5px #E6E3DD',
        'navy': 'background: #16203C; color: #FFFFFF',
        'hole': style_hole,
    }[kind]
    ic = svg(icon, 18, 2.2) if icon else ''
    base = f'height: 58px; border-radius: 999px; {k}; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px'
    if href:
        return f'<a href="{href}" style="{base}">{label}{ic}</a>'
    return f'<button type="button" onClick="{onclick}" style="all: unset; cursor: pointer; box-sizing: border-box; width: 100%; {base}">{label}{ic}</button>'


def foot(inner):
    """A plain footer on paper for one pill (or two)."""
    return f'  <div style="flex: none; padding: 12px 16px 22px; display: flex; flex-direction: column; gap: 8px">\n    {inner}\n  </div>'


def dock(line_left, line_right, slide_html):
    """The dark dock: one line of state, then the slide."""
    return f'''  <div style="flex: none; background: #16203C; border-radius: 26px 26px 0 0; padding: 14px 16px 22px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 -8px 24px rgba(22,32,60,.18); color: #FFFFFF">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 4px">
      <span style="font-size: 14px; font-weight: 700">{line_left}</span>
      <span style="font-size: 12px; font-weight: 700; color: #B3BCD2">{line_right}</span>
    </div>
    {slide_html}
  </div>'''


def slide(label, onclick, icon='send', disabled_hole=None):
    """Slide to confirm, drawn at rest: a red knob, the label, chevrons. On the
    canvas a tap stands in for the slide. disabled_hole: a hole that is 'true'
    while something is missing (then the label should say what)."""
    dis = f' aria-disabled="{disabled_hole}"' if disabled_hole else ''
    op = f'; opacity: {{{{slideOpacity}}}}' if disabled_hole else ''
    return (f'<button type="button" onClick="{onclick}"{dis} aria-label="{label}. Slide, or press Enter" style="all: unset; cursor: pointer; box-sizing: border-box; position: relative; width: 100%; height: 56px; border-radius: 999px; '
            f'background: radial-gradient(120% 140% at 10% 50%, #26335E 0%, #16203C 70%); box-shadow: inset 0 0 0 1px rgba(255,255,255,.06), 0 10px 22px rgba(22,32,60,.22){op}">'
            f'<span style="position: absolute; left: 0; top: 0; bottom: 0; width: 56px; border-radius: 999px; background: linear-gradient(90deg, rgba(201,58,48,.15), rgba(201,58,48,.55))"></span>'
            f'<span style="position: absolute; left: 4px; top: 4px; width: 48px; height: 48px; border-radius: 999px; background: #C93A30; color: #FFFFFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 14px rgba(201,58,48,.5), inset 0 1px 0 rgba(255,255,255,.2)">{svg(icon, 22, 2.2)}</span>'
            f'<span style="position: absolute; left: 58px; right: 18px; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 15px; font-weight: 700; color: #FFFFFF; white-space: nowrap; overflow: hidden">'
            f'<span style="overflow: hidden; text-overflow: ellipsis; min-width: 0">{label}</span>'
            f'<span style="flex: none; display: flex; color: #F0A39B; animation: owChev 1.4s ease-in-out infinite">{svg("chev", 14, 2.6)}{svg("chev", 14, 2.6)}</span></span></button>')


def undo(onclick):
    """The 10-second Undo pill, top right of a done screen."""
    return (f'<button type="button" onClick="{onclick}" aria-label="Undo, for 10 seconds" style="all: unset; cursor: pointer; position: absolute; top: 12px; right: 16px; z-index: 2; height: 40px; padding: 0 14px 0 8px; border-radius: 999px; background: rgba(255,255,255,.1); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); color: #FFFFFF; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; animation: owGone .3s ease 10s forwards">'
            '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="10" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2.5"></circle><circle cx="13" cy="13" r="10" fill="none" stroke="#6FDCB0" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="62.8" stroke-dashoffset="0" transform="rotate(-90 13 13)" style="animation: owUndoRun 10s linear forwards"></circle><path d="M10 10.5 8 12.5l2 2M8 12.5h6a3 3 0 0 1 0 6h-2" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>Undo</button>')


def track(steps, note=''):
    """Three steps: [(kind, glyph_html_or_initials, name, word, word_colour)].
    kind: done (mint tick), now (a face with a pulsing amber ring), later (hollow)."""
    cells = []
    for kind, glyph, name, word, wcol in steps:
        if kind == 'done':
            dot = f'<span style="width: 44px; height: 44px; border-radius: 999px; background: #6FDCB0; color: #16203C; display: flex; align-items: center; justify-content: center">{svg("tick", 20, 3)}</span>'
        elif kind == 'now':
            dot = glyph  # a face(..., ring=...) with animation
        else:
            dot = f'<span style="width: 44px; height: 44px; border-radius: 999px; background: #19223F; color: #B3BCD2; box-shadow: inset 0 0 0 2px rgba(255,255,255,.18); display: flex; align-items: center; justify-content: center">{glyph}</span>'
        cells.append(f'<span style="position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center">{dot}'
                     f'<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 13px; font-weight: 700; color: #FFFFFF">{name}</span>'
                     f'<span style="font-size: 11px; font-weight: 600; color: {wcol}">{word}</span></span></span>')
    n = f'<span style="display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; font-weight: 600; color: #B3BCD2">{svg("bell", 14, 2.2)}{note}</span>' if note else ''
    return (f'<div style="width: 100%; border-radius: 22px; background: rgba(255,255,255,.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,.07); padding: 18px 10px 14px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">'
            f'<div style="position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))">'
            f'<span style="position: absolute; top: 21px; left: 16.7%; width: 33.3%; height: 2px; background: rgba(111,220,176,.5)"></span>'
            f'<span style="position: absolute; top: 21px; left: 50%; width: 33.3%; height: 2px; background: repeating-linear-gradient(90deg, rgba(255,255,255,.25) 0 5px, transparent 5px 10px)"></span>'
            + ''.join(cells) + f'</div>{n}</div>')


def done_screen(icon, title, sub, stats_html, track_html, done_href, undo_click=None, done_label='Done'):
    """A full navy done page (sentScreen)."""
    u = undo(undo_click) if undo_click else ''
    return f'''  <div style="position: absolute; inset: 0; background: {DONE_BG}; color: #FFFFFF; display: flex; flex-direction: column; padding: 14px 20px 26px; box-sizing: border-box">
    {u}
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center">
      <span style="position: relative; width: 168px; height: 168px; display: flex; align-items: center; justify-content: center; animation: owPop .55s cubic-bezier(.2,.8,.2,1)">
        <span style="position: absolute; inset: 0; border-radius: 999px; box-shadow: inset 0 0 0 1px rgba(111,220,176,.14)"></span>
        <span style="position: absolute; inset: 22px; border-radius: 999px; box-shadow: inset 0 0 0 1px rgba(111,220,176,.26)"></span>
        <span style="position: relative; width: 80px; height: 80px; border-radius: 999px; background: #6FDCB0; color: #16203C; display: flex; align-items: center; justify-content: center; box-shadow: 0 14px 30px rgba(0,0,0,.3)">{svg(icon, 36, 2.4)}</span>
      </span>
      <span style="display: flex; flex-direction: column; gap: 8px">
        <span style="font-size: 28px; font-weight: 700; letter-spacing: -.02em">{title}</span>
        <span style="font-size: 14px; font-weight: 600; color: #B3BCD2">{sub}</span>
      </span>
      {stats_html}
      {track_html}
    </div>
    {pill(done_label, href=done_href, kind='white')}
  </div>'''


def stepper(input_id, value_hole, unit, less, more, label):
    """- [typed box] +, typing always allowed."""
    return (f'<div style="display: flex; align-items: center; gap: 8px">'
            f'<button type="button" onClick="{less}" aria-label="Fewer" style="all: unset; cursor: pointer; width: 44px; height: 44px; flex: none; border-radius: 999px; background: #F1EEE8; display: flex; align-items: center; justify-content: center">{svg("M5 12h14", 16, 2.6)}</button>'
            f'<label style="flex: 1; height: 52px; border-radius: 14px; box-shadow: inset 0 0 0 2px #16203C; display: flex; align-items: center; justify-content: center; gap: 6px">'
            f'<input id="{input_id}" value="{value_hole}" inputmode="numeric" aria-label="{label}" style="width: 90px; border: none; outline: none; background: transparent; {MONO}; font-size: 22px; font-weight: 600; text-align: right; color: #1C2233">'
            f'<span style="font-size: 13px; font-weight: 700; color: #5F6980">{unit}</span></label>'
            f'<button type="button" onClick="{more}" aria-label="More" style="all: unset; cursor: pointer; width: 44px; height: 44px; flex: none; border-radius: 999px; background: #16203C; color: #FFFFFF; display: flex; align-items: center; justify-content: center">{svg("plus", 16, 2.6)}</button></div>')


SEG_ON = 'background:#FFFFFF;color:#1C2233;box-shadow:0 1px 3px rgba(22,32,60,.12)'
SEG_OFF = 'background:transparent;color:#5F6980'
TILE_ON = 'background:#16203C;color:#FFFFFF;box-shadow:none'
TILE_OFF = 'background:#FFFFFF;color:#1C2233;box-shadow:inset 0 0 0 1.5px #E6E3DD'

# JS helpers to paste into a board's class, for picked/unpicked styles
JS_STYLES = (
    "const SEG = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;height:40px;border-radius:11px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;' + (on ? '" + SEG_ON + "' : '" + SEG_OFF + "');\n"
    "    const TILE = (on) => 'all:unset;cursor:pointer;box-sizing:border-box;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;' + (on ? '" + TILE_ON + "' : '" + TILE_OFF + "');"
)


def seg(sc_list, item='s'):
    """A segmented control over an sc-for list whose items carry label, on, pick, style (use SEG in JS)."""
    return (f'<div role="radiogroup" style="display: grid; grid-template-columns: repeat(var(--n, 2), minmax(0, 1fr)); gap: 4px; padding: 3px; border-radius: 14px; background: #F1EEE8">'
            f'<sc-for list="{{{{{sc_list}}}}}" as="{item}"><button type="button" role="radio" aria-checked="{{{{{item}.on}}}}" onClick="{{{{{item}.pick}}}}" style="{{{{{item}.style}}}}">{{{{{item}.label}}}}</button></sc-for></div>')


TABS = [('Today', 'Main.dc.html', 'M6 18a6 6 0 0 1 12 0zM3 18h18M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11'),
        ('Funnel', 'Funnel.dc.html', 'M3 5h18l-7 8v6l-4-2v-4z'),
        None,
        ('Prices', 'Prices.dc.html', 'M3 12V4h8l10 10-8 8zM7.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z'),
        ('Suppliers', 'Suppliers.dc.html', 'M3 21V9l9-5 9 5v12M8 21v-7h8v7')]


def tabbar(active, badges=None, fab_red=True, today_href='Main.dc.html'):
    """The Sourcing tab bar in the Store's style: 84px, white, a raised red + in the middle.
    fab_red=False draws the + navy, for a screen whose one red thing is elsewhere."""
    badges = badges or {}
    cells = []
    for t in TABS:
        if t is None:
            bg = '#C93A30' if fab_red else '#16203C'
            sh = 'box-shadow: 0 6px 20px rgba(201,58,48,.35); ' if fab_red else ''
            cells.append(f'<a href="Capture.dc.html" aria-label="Capture a price, a photo or an ask" style="justify-self: center; margin-top: -26px; width: 64px; height: 64px; border-radius: 999px; background: {bg}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; {sh}border: 4px solid #F7F5F2; box-sizing: content-box">{svg("plus", 26, 2.4)}</a>')
            continue
        name, href, path = t
        if name == 'Today':
            href = today_href
        on = name == active
        col = '#1C2233' if on else '#6B7480'
        fw = 700 if on else 600
        cur = ' aria-current="page"' if on else ''
        if on and name == 'Today':
            ic = ('<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                  '<path d="M6 18a6 6 0 0 1 12 0z"></path><path d="M3 18h18M12 4v3M4.9 8.9 7 11M19.1 8.9 17 11" fill="none"></path></svg>')
        else:
            ic = svg(path, 24, 1.8)
        b = badges.get(name)
        bh = (f'<span class="m" style="position: absolute; top: 0; right: 14px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: #95530C; color: #FFFFFF; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center">{b}</span>' if b else '')
        cells.append(f'<a href="{href}"{cur} style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 52px; justify-content: center; color: {col}; font-size: 12px; font-weight: {fw}">{ic}{name}{bh}</a>')
    return ('  <nav aria-label="Sourcing" style="position: absolute; left: 0; right: 0; bottom: 0; height: 84px; background: #FFFFFF; border-top: 1px solid #E6E3DD; '
            'display: grid; grid-template-columns: 1fr 1fr 84px 1fr 1fr; align-items: start; padding-top: 8px; box-sizing: border-box">\n    '
            + '\n    '.join(cells) + '\n  </nav>')


def home_head(title, sub, right='', picture='', gap=20):
    """A tab's head: a big greeting-style title on the left, circles on the right, then the picture."""
    return f'''  <div style="background: {HEAD_BG}; border-radius: 0 0 32px 32px; padding: 12px 20px 22px; display: flex; flex-direction: column; gap: {gap}px; color: #FFFFFF">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
      <span style="display: flex; flex-direction: column; gap: 3px; min-width: 0">
        <span style="font-size: 20px; font-weight: 700; letter-spacing: -.01em">{title}</span>
        <span style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: #B3BCD2; white-space: nowrap">{sub}</span>
      </span>
      <span style="display: flex; align-items: center; gap: 10px; flex: none">{right}</span>
    </div>
{picture}
  </div>'''


def home_scroll(inner):
    """A tab screen scrolls as one, head included, above the 84px tab bar."""
    return f'  <div style="position: absolute; inset: 0 0 84px 0; overflow-y: auto">\n{inner}\n  </div>'


DOT = '<span style="width: 3px; height: 3px; border-radius: 999px; background: #5F6A85"></span>'
LIVE = '<span style="display: flex; align-items: center; gap: 5px; color: #6FDCB0"><span style="width: 7px; height: 7px; border-radius: 999px; background: #6FDCB0"></span>Live</span>'
