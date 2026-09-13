#!/usr/bin/env python3
"""Assembles each artboard from the shared chrome plus its own body.
Mirrors .design/followups-v2/build.py. Re-run after editing any partial."""
import pathlib, re, sys
d = pathlib.Path(__file__).parent
R = lambda n: (d / n).read_text()
FONTS = ('  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Inter:wght@400;500;600;700&family=Archivo+Black&'
         'family=IBM+Plex+Mono:wght@400;500;600&display=swap">')

ONHAND_SUB = 'What is on the shelf right now, what it cost, and what it is worth.'
MOVES_SUB = 'Every change to the shelf, and what caused it.'
ACTS = ('        <div class="btn btn-ghost ow-sm">'
        '<svg class="icon" viewBox="0 0 24 24"><path d="M4 20V8M10 20V4M16 20v-7M22 20H2"></path></svg>'
        'Count the shelf</div>\n'
        '        <div class="btn btn-accent ow-sm">'
        '<svg class="icon" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>'
        'Receive a delivery</div>')


def build(out, body, w, h, lens=None, phone=False, on_n='128', mv_n='47', rail='_rail.html'):
    b = R(body)
    if '__HEAD__' in b:
        head = R('_head.html')
        head = head.replace('__SUB__', ONHAND_SUB if lens == 'onhand' else MOVES_SUB)
        head = head.replace('__ONHAND__', ' ow-on' if lens == 'onhand' else '')
        head = head.replace('__MOVES__', ' ow-on' if lens == 'moves' else '')
        # The two acts belong to the shelf, not to its history: nothing on
        # the Movements lens acts, so it carries no accent at all.
        head = head.replace('__ACTS__\n', ACTS + '\n' if lens == 'onhand' else '')
        head = head.replace('__ON_N__', on_n).replace('__MV_N__', mv_n)
        b = b.replace('__HEAD__\n', head)
    left = re.findall(r'__[A-Z]+__', b)
    if left:
        sys.exit('unsubstituted in %s: %s' % (out, left))
    css = R('_chrome.css') + ('\n' + R('_phone.css') if phone else '')
    parts = ['<!doctype html>', '<html>', '<head>', '  <meta charset="utf-8">',
             '  <script src="./support.js"></script>', '</head>', '<body>', '<x-dc>',
             '<helmet>', FONTS, '  <style>', css, '  </style>', '</helmet>',
             f'<div class="app" style="width:{w}px;height:{h}px">']
    if not phone:
        parts.append(R(rail))
    parts += [b, '</div>', '</x-dc>', '</body>', '</html>']
    (d / out).write_text('\n'.join(parts))
    print(f'built {out}  {w}x{h}')


build('Main.dc.html', 'body_main.html', 1440, 912, lens='onhand')
build('Movements.dc.html', 'body_moves.html', 1440, 912, lens='moves')
# A shop whose shelf has never moved: every count on the page is 0,
# and the rail carries no badge. A canvas that says "nothing has moved"
# beside a count of 47 is a canvas nobody can trust.
build('Empty.dc.html', 'body_empty.html', 1440, 560, lens='moves',
      on_n='0', mv_n='0', rail='_rail_nobadge.html')
build('Phone.dc.html', 'body_phone.html', 390, 844, phone=True)
build('PhoneMoves.dc.html', 'body_phonemoves.html', 390, 844, phone=True)
