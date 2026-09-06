#!/usr/bin/env python3
"""Assembles each artboard from the shared chrome plus its own body."""
import os, re, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
R = lambda p: open(p, encoding='utf-8').read()

CHROME = R('_chrome.css') + R('_extra.css')
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
%s
  </style>
</helmet>
"""

def build(out, body, w, h, rail=True, badge='', frags=None):
    parts = [HEAD % CHROME, '<div class="app" style="width:%dpx;height:%dpx">' % (w, h)]
    if rail:
        parts.append(R('_rail.html').replace('__MAPBADGE__', badge))
    b = R(body)
    for k, v in (frags or {}).items():
        b = b.replace('__%s__' % k, R(v) if isinstance(v, str) and v.startswith('_') else v)
    left = re.findall(r'__[A-Z_]+__', b)
    if left:
        sys.exit('%s: unsubstituted %s' % (out, sorted(set(left))))
    parts += [b, '</div>', '</x-dc>', '</body>', '</html>', '']
    open(out, 'w', encoding='utf-8').write('\n'.join(parts))
    print('built %-22s %dx%d  %6d bytes' % (out, w, h, os.path.getsize(out)))

FURN_C = {'FURN': '_furn.html', 'LEGEND': '_leg_cust.html'}

def furn(legend):
    return R('_furn.html').replace('__LEGEND__', R(legend))

BADGE = '<span class="nav-badge">6</span>'

build('Main.dc.html', 'body_main.html', 1440, 1760, badge=BADGE, frags={
    'BASE': '_map_base.html', 'MARKERS': '_markers_cust.html',
    'FURN': '_furn.html', 'LEGEND': '_leg_cust.html'})

build('Before.dc.html', 'body_before.html', 1440, 1420, badge='', frags={
    'BASE': '_map_base.html', 'MARKERS': '_markers_old.html'})

build('Placing.dc.html', 'body_placing.html', 1440, 1660, badge=BADGE, frags={
    'BASE': '_map_base.html', 'MARKERS': '_markers_placing.html',
    'FURN': '_furn.html', 'LEGEND': '_leg_cust.html'})

build('Deliveries.dc.html', 'body_deliveries.html', 1440, 1300, badge=BADGE, frags={
    'BASE': '_map_base.html', 'MARKERS': '_markers_del.html',
    'FURN': '_furn.html', 'LEGEND': '_leg_del.html'})

build('States.dc.html', 'body_states.html', 1440, 1620, badge=BADGE)

build('Phone.dc.html', 'body_phone.html', 390, 844, rail=False, frags={
    'BASE': '_map_base_ph.html'})
