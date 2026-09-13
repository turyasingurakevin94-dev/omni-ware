#!/usr/bin/env python3
"""Assembles each artboard from the shared chrome plus its own body.
Mirrors .design/followups/build.sh; kept as python because the substitutions
are multi-file. Re-run after editing any partial."""
import pathlib, re, sys
d = pathlib.Path(__file__).parent
R = lambda n: (d/n).read_text()
FONTS = ('  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Inter:wght@400;500;600;700&family=Archivo+Black&'
         'family=IBM+Plex+Mono:wght@400;500;600&display=swap">')
def build(out, body, extra_css, w, h, rail, ch=None, head='_head.html', wn='32',
          strip='_strip.html', rows='_rows_all.html', qt='To message', qn='32 clients',
          qh=628):
    b = R(body)
    if '__QUEUE__' in b:
        q = R('_queue.html').replace('__QT__', qt).replace('__QN__', qn)
        q = q.replace('__ROWS__\n', R(rows)).replace('__QH__', str(qh))
        b = b.replace('__QUEUE__\n', q)
    b = b.replace('__HEADREG__\n', R('_head_reg.html')).replace('__HEAD__\n', R(head))
    b = b.replace('__WN__', wn)
    b = b.replace('__STRIPMONEY__\n', R('_strip_money.html')).replace('__STRIP__\n', R(strip))
    b = b.replace('__CH__', str(ch))
    left = re.findall(r'__[A-Z]+__', b)
    if left: sys.exit('unsubstituted in %s: %s' % (out, left))
    css = R('_chrome.css') + ('\n' + R(extra_css) if extra_css else '')
    parts = ['<!doctype html>', '<html>', '<head>', '  <meta charset="utf-8">',
             '  <script src="./support.js"></script>', '</head>', '<body>', '<x-dc>',
             '<helmet>', FONTS, '  <style>', css, '  </style>', '</helmet>',
             f'<div class="app" style="width:{w}px;height:{h}px">']
    if rail: parts.append(R(rail if isinstance(rail, str) else '_rail.html'))
    parts += [b, '</div>', '</x-dc>', '</body>', '</html>']
    (d/out).write_text('\n'.join(parts))
    print(f'built {out}  {w}x{h}' + (f'  content {ch}' if ch else ''))

build('Main.dc.html',    'body_main.html',    None, 1440, 912, 1, 628)
build('Money.dc.html',   'body_money.html',   None, 1440, 912, 1, 628,
      strip='_strip_money.html', rows='_rows_money.html', qt='Money', qn='15 of 32 clients')
build('Picture.dc.html', 'body_picture.html', None, 1440, 1200, 1, 916, rows='_rows_picture.html')
build('Register.dc.html','body_register.html',None, 1440, 1108, 1)
build('Empty.dc.html',   'body_empty.html',   None, 1440, 540, '_rail_nobadge.html', wn='0')
build('Instructions.dc.html','body_instructions.html', None, 660, 920, 0)
build('Phone.dc.html',       'body_phone.html',       '_phone.css', 390, 844, 0)
build('PhoneClient.dc.html', 'body_phoneclient.html', '_phone.css', 390, 844, 0)
