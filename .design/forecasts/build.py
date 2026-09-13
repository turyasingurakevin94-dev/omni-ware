#!/usr/bin/env python3
"""Assembles each Forecasts artboard from the shared chrome plus its own
body. Mirrors .design/inventory-v2/build.py. Re-run after editing any
partial: python3 build.py"""
import pathlib, re, sys, subprocess
d = pathlib.Path(__file__).parent
R = lambda n: (d / n).read_text()
FONTS = ('  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Inter:wght@400;500;600;700&family=Archivo+Black&'
         'family=IBM+Plex+Mono:wght@400;500;600&display=swap">')

SUBS = {
  'cash':  'What falls due over the next 30 days, and what it leaves you.',
  'stock': 'What runs out, and what it costs to have it back in time.',
  'today': 'Tuesday 8 September at 16:40, against what a typical Tuesday ends at.',
}
# The screen's own act on the right of the header, per lens. One accent
# per screen, and it is the thing to do next ON THAT LENS.
ACTS = {
  # Nothing in the Cash header acts: naming a day happens on the bill's
  # own row, and on a healthy day there is no accent to spend. When the
  # line goes under, the accent is "Chase these three", in the rail.
  'cash':  '',
  # The two figures the plan turns on, as fields in the header -- as the
  # screen ships them. The accent is NOT here: it is the basket bar at
  # the foot, and only once something is ticked.
  'stock': ('        <div class="ow-f"><span class="ow-f-l">Cover</span><span class="ow-f-in"><span class="ow-f-v">14</span><span class="ow-f-u">days</span></span></div>\n'
            '        <div class="ow-f"><span class="ow-f-l">Budget</span><span class="ow-f-in"><span class="ow-f-v fc-ph">safe to spend</span><span class="ow-f-u">worked out</span></span></div>\n'
            ),
  'today': ('        <div class="btn btn-ghost ow-sm">Print the day</div>\n'
            '        <div class="btn btn-accent ow-sm">'
            '<svg class="icon" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2.5"></circle></svg>'
            'Count the till</div>\n'),
}


def build(out, body, w, h, lens, phone=False, strip='_strip.html', rail='_rail.html'):
    b = R(body)
    if '__HEAD__' in b:
        head = R('_head.html')
        head = head.replace('__SUB__', SUBS[lens])
        for k in ('cash', 'stock', 'today'):
            head = head.replace('__%s__' % k.upper(), ' ow-on' if lens == k else '')
        head = head.replace('__ACTS__\n', ACTS[lens])
        b = b.replace('__HEAD__\n', head)
    if '__STRIP__' in b:
        b = b.replace('__STRIP__\n', R(strip))
    if '__CHART__' in b:
        b = b.replace('__CHART__\n', R('_chart.html'))
    if '__CHART_SM__' in b:
        b = b.replace('__CHART_SM__\n', R('_chart_sm.html'))
    left = re.findall(r'__[A-Z_]+__', b)
    if left:
        sys.exit('unsubstituted in %s: %s' % (out, left))
    css = R('_chrome.css') + '\n' + R('_forecasts.css') + ('\n' + R('_phone.css') if phone else '')
    parts = ['<!doctype html>', '<html>', '<head>', '  <meta charset="utf-8">',
             '  <script src="./support.js"></script>', '</head>', '<body>', '<x-dc>',
             '<helmet>', FONTS, '  <style>', css, '  </style>', '</helmet>',
             f'<div class="app" style="width:{w}px;height:{h}px">']
    if not phone:
        parts.append(R(rail))
    parts += [b, '</div>', '</x-dc>', '</body>', '</html>']
    (d / out).write_text('\n'.join(parts))
    print(f'built {out}  {w}x{h}')


subprocess.run([sys.executable, str(d / 'render.py')], check=True, cwd=d)
build('Main.dc.html',  'body_cash.html',  1440, 1120, 'cash')
build('Stock.dc.html', 'body_stock.html', 1440, 1240, 'stock')
build('Today.dc.html', 'body_today.html', 1440, 1120, 'today')
build('Empty.dc.html', 'body_empty.html', 1440, 640,  'cash', strip='_strip_empty.html')
build('Phone.dc.html', 'body_phone.html', 390, 844, 'cash', phone=True)
build('PhoneStock.dc.html', 'body_phonestock.html', 390, 844, 'stock', phone=True)
