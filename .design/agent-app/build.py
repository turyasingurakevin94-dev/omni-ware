#!/usr/bin/env python3
"""Assembles each artboard from the shared phone CSS plus its own body.

Every mark in ICONS is drawn on the house 24-unit box, fill:none,
stroke:currentColor, stroke-width 1.8, round caps and joins -- set by the
stylesheet, never on the path. The tab-bar three are silhouettes with
evenodd subpaths so the same drawing reads stroked when inactive and
filled when active, which is a shape change rather than a colour change.
"""
import re, pathlib

HERE = pathlib.Path(__file__).parent

ICONS = {
    # --- the tab bar: a price tag, two people, a note with a coin ---
    'tag': '<path fill-rule="evenodd" d="M13.4 3.5H5.5A2 2 0 0 0 3.5 5.5v7.9c0 .53.21 1.04.59 1.41'
           'l6.1 6.1a2 2 0 0 0 2.82 0l7.9-7.9a2 2 0 0 0 0-2.82l-6.1-6.1A2 2 0 0 0 13.4 3.5z'
           'M7.6 9.1a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>',
    'people': '<path d="M9 4.6a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6z"/>'
              '<path d="M2.9 20v-.9c0-3.2 2.73-5.4 6.1-5.4s6.1 2.2 6.1 5.4v.9z"/>'
              '<path d="M17.3 6.1a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4z"/>',
    'note': '<path fill-rule="evenodd" d="M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z'
            'm9 3.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z"/>',
    # --- tab bar, inactive: drawn as outlines, not as stroked silhouettes ---
    'spark_o': '<path d="M6 16.2a6 6 0 0 1 12 0"/><path d="M3 19.6h18"/>'
               '<path d="M12 3.8v2.2M5.1 7.1l1.6 1.6M18.9 7.1l-1.6 1.6"/>',
    'tag_o': '<path d="M13.4 3.5H5.5A2 2 0 0 0 3.5 5.5v7.9c0 .53.21 1.04.59 1.41l6.1 6.1'
             'a2 2 0 0 0 2.82 0l7.9-7.9a2 2 0 0 0 0-2.82l-6.1-6.1A2 2 0 0 0 13.4 3.5z"/>'
             '<circle cx="7.7" cy="7.7" r="1.35"/>',
    'people_o': '<circle cx="9.1" cy="8.2" r="3.4"/>'
                '<path d="M2.9 19.6v-.8c0-3.2 2.75-5.4 6.2-5.4s6.2 2.2 6.2 5.4v.8"/>'
                '<circle cx="17.6" cy="9" r="2.5"/><path d="M17.6 14.2c2.3.2 3.8 2 3.8 4.3v1.1"/>',
    # --- the six categories, drawn as the thing itself ---
    'roofing': '<path d="M3.5 17.5l4-11h13l-4 11z"/><path d="M11.5 6.5l-4 11M15.5 6.5l-4 11"/>',
    'fastener': '<path d="M9.2 3h5.6l1.7 2.6-1.7 2.6H9.2L7.5 5.6z"/><path d="M10.3 8.2V21M13.7 8.2V21"/>'
                '<path d="M10.3 11.5h3.4M10.3 14.5h3.4M10.3 17.5h3.4"/>',
    'plumbing': '<path d="M8 3.5v6.2a6.3 6.3 0 0 0 6.3 6.3h6.2"/><path d="M5.2 3.5h5.6M17.7 13.2v5.6"/>',
    'paint': '<path d="M4.2 7.8h13.6v11.6a1.6 1.6 0 0 1-1.6 1.6H5.8a1.6 1.6 0 0 1-1.6-1.6z"/>'
             '<ellipse cx="11" cy="7.8" rx="6.8" ry="2.4"/><path d="M15.6 5.6c2.6-.7 4.4-1.7 4.4-3.1"/>',
    'cement': '<path d="M6.2 4.3h11.6L20 20.8H4z"/><path d="M9.2 4.3l.9-1.8h3.8l.9 1.8"/><path d="M9.4 12.2h5.2"/>',
    'tools': '<path d="M14.6 6.4a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.7-3.7a6 6 0 0 1-7.9 7.9'
             'l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    # --- the working marks ---
    'search': '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/>',
    'right': '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
    'left': '<path d="M15 5.5L8.5 12l6.5 6.5"/>',
    'down': '<path d="M5.5 9L12 15.5 18.5 9"/>',
    'up': '<path d="M12 19V5"/><path d="M5.5 11.5L12 5l6.5 6.5"/>',
    # Home: a sunrise over the yard -- the day starting, not a house.
    'spark': '<path fill-rule="evenodd" d="M12 2.6a1 1 0 0 1 1 1v2.2a1 1 0 1 1-2 0V3.6a1 1 0 0 1 1-1z'
             'M4.4 5.8a1 1 0 0 1 1.4 0l1.5 1.5a1 1 0 1 1-1.4 1.4L4.4 7.2a1 1 0 0 1 0-1.4z'
             'M19.6 5.8a1 1 0 0 1 0 1.4l-1.5 1.5a1 1 0 0 1-1.4-1.4l1.5-1.5a1 1 0 0 1 1.4 0z'
             'M12 9.4a6.2 6.2 0 0 0-6.1 5.2h12.2A6.2 6.2 0 0 0 12 9.4z'
             'M2.6 17.6a1 1 0 0 1 1-1h16.8a1 1 0 1 1 0 2H3.6a1 1 0 0 1-1-1z'
             'M6.6 20.6a1 1 0 0 1 1-1h8.8a1 1 0 1 1 0 2H7.6a1 1 0 0 1-1-1z"/>',
    'phone': '<path d="M6.4 3.2h3.1l1.6 4-2.1 1.5a12.4 12.4 0 0 0 5.8 5.8l1.5-2.1 4 1.6v3.1'
             'a2 2 0 0 1-2.2 2A17.3 17.3 0 0 1 2.6 5.4a2 2 0 0 1 2-2.2z"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'minus': '<path d="M5 12h14"/>',
    'tick': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'pencil': '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 5.5l4 4"/>',
    'lock': '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/>'
            '<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    'flag': '<path d="M5.5 21V3.5"/><path d="M5.5 4.5h11l-2 3.5 2 3.5h-11"/>',
    # standing: three bars of a podium, middle tallest
    'podium': '<path d="M3.5 20.5h17"/><rect x="4" y="13" width="4.6" height="7.5" rx="1"/>'
              '<rect x="9.7" y="7.5" width="4.6" height="13" rx="1"/>'
              '<rect x="15.4" y="16" width="4.6" height="4.5" rx="1"/>',
    'warn': '<path d="M12 3.5l9 15.5H3z"/><path d="M12 9.5v4M12 16.4v.1"/>',
    'wifi-off': '<path d="M3 3l18 18"/><path d="M9.2 15.4a4 4 0 0 1 5.6 0"/>'
                '<path d="M6.1 12.1a8.5 8.5 0 0 1 3.2-2"/><path d="M17.9 12.1a8.5 8.5 0 0 0-3.4-2.1"/>'
                '<path d="M3.2 8.9a13 13 0 0 1 4-2.5"/><path d="M20.8 8.9a13 13 0 0 0-9.6-3.3"/>'
                '<path d="M12 19.1v.1"/>',
    'medal': '<circle cx="12" cy="14.5" r="5"/><path d="M9.5 9.8L7 2.5h10l-2.5 7.3"/>',
    'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.2 1.9"/>',
    'box': '<path d="M3.5 7.6L12 3.3l8.5 4.3v8.8L12 20.7l-8.5-4.3z"/><path d="M3.5 7.6L12 12l8.5-4.4M12 12v8.7"/>',
    'doc': '<path d="M6 2.8h8l4 4v14.4H6z"/><path d="M9 8h4M9 11.5h6M9 15h5"/>',
    'out': '<path d="M9.5 20.5H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h4.5"/>'
           '<path d="M15.5 16.5L20 12l-4.5-4.5M20 12H9"/>',
}

TABS = [('spark', 'Home'), ('tag', 'Sell'), ('people', 'Clients')]


def icon(name, cls=''):
    c = f' class="{cls}"' if cls else ''
    return f'<svg{c} viewBox="0 0 24 24">{ICONS[name]}</svg>'


def tabbar(active):
    out = ['<div class="tabs">']
    for key, label in TABS:
        hit = label == active
        mark = icon(key if hit else key + '_o')
        out.append(f'  <div class="tab{" on" if hit else ""}">{mark}{label}</div>')
    out.append('</div>')
    return '\n'.join(out)


def expand(src):
    """{{i:name}} -> the mark; {{tabs:Sell}} -> the tab bar."""
    src = re.sub(r'\{\{tabs:(\w+)\}\}', lambda m: tabbar(m.group(1)), src)
    return re.sub(r'\{\{i:([\w-]+)\}\}', lambda m: icon(m.group(1)), src)


HEAD = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
  <style>
%s  </style>
</helmet>
<div class="app" style="width:%dpx;height:%dpx">
%s</div>
</x-dc>
</body>
</html>
"""


def check_balance(name, src):
    """<div> vs </div>. An unclosed div does not fail to render -- it
    swallows the rest of the page into whatever was left open, which is
    how a whole screen once came out inside the dark hero."""
    opens = len(re.findall(r'<div\b', src))
    closes = len(re.findall(r'</div>', src))
    if opens != closes:
        raise SystemExit(f'{name}: {opens} <div> vs {closes} </div> -- unbalanced by {opens - closes}')


def build(out, body, w, h, extra=()):
    css = (HERE / '_field.css').read_text()
    for f in extra:
        css += (HERE / f).read_text()
    raw = (HERE / body).read_text()
    check_balance(body, raw)
    src = expand(raw)
    (HERE / out).write_text(HEAD % (css, w, h, src))
    print(f'built {out}  {w}x{h}')


if __name__ == '__main__':
    PH = (390, 844)
    build('Main.dc.html',     'body_home.html',     *PH)
    build('Standing.dc.html', 'body_standing.html', *PH)
    build('SetTarget.dc.html','body_target.html',    *PH)
    build('Sell.dc.html',    'body_sell.html',    *PH)
    build('AddItem.dc.html', 'body_add.html',     *PH)
    build('Order.dc.html',   'body_order.html',   *PH)
    build('Clients.dc.html', 'body_clients.html', *PH)
    build('Client.dc.html',  'body_client.html',  *PH)
    build('Money.dc.html',   'body_money.html',   *PH)
    build('Orders.dc.html',  'body_orders.html',  *PH)
    build('Account.dc.html', 'body_account.html', *PH)
    build('DayOne.dc.html',  'body_day1.html',    *PH)
    build('Stale.dc.html',   'body_stale.html',   *PH)
