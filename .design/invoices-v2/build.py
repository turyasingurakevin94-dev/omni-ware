#!/usr/bin/env python3
"""Assembles each artboard from the shared chrome plus its own body.
Mirrors .design/inventory-v2/build.py. Re-run after editing any partial."""
import pathlib, re, sys
d = pathlib.Path(__file__).parent
R = lambda n: (d / n).read_text()
FONTS = ('  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Inter:wght@400;500;600;700&family=Archivo+Black&'
         'family=IBM+Plex+Mono:wght@400;500;600&display=swap">')

SALES_SUB = 'Every invoice the shop has raised, open money first.'
BUYS_SUB = 'Every bill a supplier has given you, and whether it is right.'
# The accent belongs to whichever lens has something to do next. On Sales
# that is the printed sheet a person walks the yard with; on Purchases the
# list's own print is a ghost, because the one thing to do is whatever the
# bill you have opened needs. Both are index.html's own reasoning.
PRINT_ACCENT = ('        <div class="btn btn-accent ow-sm">'
                '<svg class="icon" viewBox="0 0 24 24"><path d="M6 9V4h12v5"></path>'
                '<rect x="4" y="9" width="16" height="7" rx="1.5"></rect>'
                '<path d="M8 13h8v7H8z"></path></svg>Print list</div>')
PRINT_GHOST = PRINT_ACCENT.replace('btn-accent', 'btn-ghost')


def build(out, body, w, h, lens=None, phone=False):
    b = R(body)
    if '__HEAD__' in b:
        head = R('_head.html')
        sales = lens == 'sales'
        head = head.replace('__SUB__', SALES_SUB if sales else BUYS_SUB)
        head = head.replace('__SALES__', ' ow-on' if sales else '')
        head = head.replace('__BUYS__', '' if sales else ' ow-on')
        head = head.replace('__ACCENT__\n', (PRINT_ACCENT if sales else PRINT_GHOST) + '\n')
        head = head.replace('__SEARCHPH__',
                            'Doc No. / customer / item&hellip;' if sales
                            else 'Doc No. / supplier / item&hellip;')
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
        parts.append(R('_rail.html'))
    parts += [b, '</div>', '</x-dc>', '</body>', '</html>']
    (d / out).write_text('\n'.join(parts))
    print(f'built {out}  {w}x{h}')


build('Main.dc.html', 'body_sales.html', 1440, 912, lens='sales')
build('Purchases.dc.html', 'body_buys.html', 1440, 1000, lens='buys')
build('Linked.dc.html', 'body_linked.html', 1440, 820, lens='buys')
build('SideBySide.dc.html', 'body_split.html', 1440, 820)
build('Phone.dc.html', 'body_phone.html', 390, 844, phone=True)
