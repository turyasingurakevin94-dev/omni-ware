#!/usr/bin/env python3
"""Assembles each artboard from the shared chrome CSS + rail plus its own body.
Run from this folder: python3 build.py"""
import os, re
here = os.path.dirname(os.path.abspath(__file__)); os.chdir(here)
read = lambda p: open(p, encoding='utf-8').read()

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&amp;family=Archivo+Black&amp;family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap">'

TH = {
 'SHEETS':  '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#E9EBED"></rect><g stroke="#8A939C" stroke-width="2" fill="#DCE0E4"><path d="M4 22h56v8H4zM4 34h56v8H4zM4 46h56v8H4z"></path></g><path d="M4 22h56" stroke="#59626B" stroke-width="2"></path></svg>',
 'NAILS':   '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#E9EBED"></rect><path d="M12 26h40v26H12z" fill="#DCE0E4" stroke="#8A939C" stroke-width="2"></path><path d="M12 26l6-8h28l6 8" fill="#F7F9FB" stroke="#8A939C" stroke-width="2"></path><g stroke="#59626B" stroke-width="2"><path d="M22 34v12M32 34v12M42 34v12"></path></g></svg>',
 'PADLOCK': '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#E9EBED"></rect><rect x="16" y="30" width="32" height="24" rx="3" fill="#B0700A"></rect><path d="M23 30v-6a9 9 0 0 1 18 0v6" fill="none" stroke="#8A939C" stroke-width="4"></path><circle cx="32" cy="41" r="3" fill="#FBEFD9"></circle></svg>',
 'CEMENT':  '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#E9EBED"></rect><path d="M18 16h28l4 8v28H14V24z" fill="#DCE0E4" stroke="#8A939C" stroke-width="2"></path><path d="M14 32h36" stroke="#8A939C" stroke-width="2"></path><path d="M22 40h20M22 46h13" stroke="#59626B" stroke-width="2"></path></svg>',
 'PAINT':   '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#E9EBED"></rect><rect x="18" y="22" width="28" height="30" rx="2" fill="#F7F9FB" stroke="#8A939C" stroke-width="2"></rect><path d="M18 22h28" stroke="#59626B" stroke-width="3"></path><path d="M24 16h16v6H24z" fill="#DCE0E4" stroke="#8A939C" stroke-width="2"></path><path d="M24 34h16M24 40h10" stroke="#8A939C" stroke-width="2"></path></svg>',
 'BARROW':  '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#E9EBED"></rect><path d="M12 24h30l8 14H20z" fill="#B0700A"></path><circle cx="22" cy="46" r="6" fill="none" stroke="#59626B" stroke-width="3"></circle><path d="M42 24l10-6M20 38v4" stroke="#8A939C" stroke-width="3"></path></svg>',
 'WIRE':    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#E9EBED"></rect><g fill="none" stroke="#8A939C" stroke-width="2"><ellipse cx="32" cy="26" rx="18" ry="7"></ellipse><path d="M14 26v12a18 7 0 0 0 36 0V26"></path><ellipse cx="32" cy="38" rx="18" ry="7"></ellipse></g><ellipse cx="32" cy="26" rx="7" ry="3" fill="#DCE0E4"></ellipse></svg>',
 'STEEL':   '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#E9EBED"></rect><g stroke="#59626B" stroke-width="3" stroke-linecap="round"><path d="M10 44L50 18M10 50L54 22M14 38L46 16"></path></g><path d="M8 52h48" stroke="#8A939C" stroke-width="2"></path></svg>',
 'NONE':    '<svg class="icon" viewBox="0 0 24 24"><path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16M14 14l1.5-1.5a2 2 0 0 1 2.8 0L21 16"></path><rect x="3" y="6" width="18" height="12" rx="1"></rect><circle cx="9" cy="9" r="1"></circle></svg>',
}

def fill(html, view=None):
    html = html.replace('__PH__', read('_ph_shelf.html'))
    find = read('_find.html').replace('__VL__', 'ow-on' if view == 'lanes' else '').replace('__VR__', 'ow-on' if view == 'list' else '')
    html = html.replace('__FIND__', find).replace('__POS__', read('_pos.html')).replace('__FIX__', read('_fix.html'))
    for k, v in TH.items(): html = html.replace('__TH_%s__' % k, v)
    return html

def build(out, title, body, css, w, h, rail, where=None, view=None):
    parts = ['<!doctype html>', '<html lang="en">', '<head>', '  <meta charset="utf-8">', '  <title>%s</title>' % title,
             '  <script src="./support.js"></script>', '</head>', '<body>', '<x-dc>', '<helmet>', '  ' + FONTS, '  <style>']
    parts += [read(c) for c in css]
    parts += ['  </style>', '</helmet>', '<div class="app" style="width:%dpx;height:%dpx">' % (w, h)]
    if rail: parts.append(read('_rail.html').replace('__WHERE__', where))
    parts.append(fill(read(body), view))
    parts += ['</div>', '</x-dc>',
              '<script type="text/x-dc" data-dc-script data-props=\'{"$preview":{"width":%d,"height":%d}}\'>' % (w, h),
              'class Component extends DCLogic {', '  renderVals() { return {}; }', '}', '</script>', '</body>', '</html>']
    open(out, 'w', encoding='utf-8').write('\n'.join(parts) + '\n'); print('built', out)

D = ['_chrome.css', '_inv.css']
build('Main.dc.html',      'Inventory — the shelf in lanes',              'body_main.html',      D, 1440, 1320, True, 'Inventory', 'lanes')
build('Register.dc.html',  'Inventory — the register, one line open',      'body_list.html',      D, 1440, 1560, True, 'Inventory', 'list')
build('Movements.dc.html', 'Inventory — movements',                        'body_moves.html',     D, 1440, 1180, True, 'Inventory')
build('States.dc.html',    'Inventory — settled, hidden, failed, brand new','body_states.html',    D, 1440, 1560, True, 'Inventory')
build('Phone.dc.html',     'Inventory on the phone',                       'body_phone.html',     D + ['_phone.css'], 390, 844, False)
build('PhoneLine.dc.html', 'One line, on the phone',                       'body_phoneline.html', D + ['_phone.css'], 390, 844, False)
