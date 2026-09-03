#!/usr/bin/env python3
import sys, json, datetime as dt
sys.path.insert(0, '.')
from mkchart import build, money, short

ON_HAND = 4850000
COMMITS = [
  {"date":"2026-09-05","amount": 760000,"label":"Roofings Rolling Mills","kind":"bill"},
  {"date":"2026-09-06","amount": 800000,"label":"Nakawa shop — rent","kind":"rent"},
  {"date":"2026-09-09","amount": 420000,"label":"Stanbic loan","kind":"loan"},
  {"date":"2026-09-12","amount":1640000,"label":"Ssekitoleko Hardware","kind":"bill"},
  {"date":"2026-09-15","amount": 780000,"label":"August wages","kind":"wage"},
  {"date":"2026-09-24","amount": 340000,"label":"Bwambale Steel Works","kind":"bill"},
]
PROMISES = [
  {"date":"2026-09-08","amount":640000,"label":"Kato Construction Ltd"},
  {"date":"2026-09-17","amount":250000,"label":"Sarah Namono"},
  {"date":"2026-09-26","amount":480000,"label":"Peter Ssebowa"},
]
SHORT_COMMITS = COMMITS[:5] + [
  {"date":"2026-09-21","amount": 980000,"label":"Tororo Cement Depot","kind":"bill"},
  {"date":"2026-09-28","amount": 680000,"label":"Mulongo Hardware","kind":"bill"},
]

def svg(on_hand, commits, promises, start="2026-09-03", days=30, ghost=True):
    g = build(on_hand, commits, promises, start, days)
    X, Y, step = g['X'], g['Y'], g['step']
    P, Q = g['padL'], g['padT']
    W, H, IW, IH = g['w'], g['h'], g['innerW'], g['innerH']
    zeroY = Y(0)
    out = []
    # --- the zero line and the ground below it ---------------------------
    if g['lo'] < 0:
        out.append(f'<rect class="ah-neg" x="{P}" y="{zeroY:.1f}" width="{IW}" '
                   f'height="{(Q+IH-zeroY):.1f}"/>')
    # --- y gridlines: only the two that mean something -------------------
    for v, lab in [(on_hand, 'in hand'), (0, 'nothing left')]:
        y = Y(v)
        out.append(f'<line class="ah-grid{" ah-zero" if v==0 else ""}" x1="{P}" y1="{y:.1f}" '
                   f'x2="{P+IW}" y2="{y:.1f}"/>')
        out.append(f'<text class="ah-yl" x="{P-10}" y="{y+3.5:.1f}" text-anchor="end">{money(v)}</text>')
    # --- the ghost: if every promise is kept -----------------------------
    if ghost and promises:
        out.append(f'<path class="ah-ghost" d="{step(g["ghost"])}"/>')
    # --- the balance itself ----------------------------------------------
    out.append(f'<path class="ah-line" d="{step(g["solid"])}"/>')
    # --- a marker and a hover title on every step ------------------------
    lowest = min(g['solid'][1:-1], key=lambda p: p[1]) if len(g['solid']) > 2 else g['solid'][0]
    for i, (d, b) in enumerate(g['solid']):
        if i == 0 or i == len(g['solid'])-1: continue
        c = commits[i-1]
        cls = 'ah-dot ah-low' if (d, b) == lowest else 'ah-dot'
        out.append(f'<circle class="{cls}" cx="{X(d):.1f}" cy="{Y(b):.1f}" r="4">'
                   f'<title>{short(d)} — {c["label"]}, {money(c["amount"])} out, leaves {money(b)}</title></circle>')
    # --- the low point, named where it happens ---------------------------
    lx, ly = X(lowest[0]), Y(lowest[1])
    below = lowest[1] < 0
    out.append(f'<line class="ah-lowrule" x1="{lx:.1f}" y1="{Q}" x2="{lx:.1f}" y2="{Q+IH}"/>')
    anchor = 'end' if lx > P + IW*0.62 else 'start'
    dx = -9 if anchor == 'end' else 9
    out.append(f'<text class="ah-lowlab{" ah-bad" if below else ""}" x="{lx+dx:.1f}" y="{Q+13}" '
               f'text-anchor="{anchor}">{"Short " + money(abs(lowest[1])) if below else money(lowest[1]) + " left"}</text>')
    out.append(f'<text class="ah-lowsub" x="{lx+dx:.1f}" y="{Q+27}" text-anchor="{anchor}">'
               f'{short(lowest[0])} — the tightest day</text>')
    # --- x ends -----------------------------------------------------------
    out.append(f'<text class="ah-xl" x="{P}" y="{H-12}">Today, {short(g["d0"])}</text>')
    out.append(f'<text class="ah-xl" x="{P+IW}" y="{H-12}" text-anchor="end">{short(g["dN"])}</text>')
    # --- the end-of-window figure, direct-labelled ------------------------
    endb = g['solid'][-1][1]
    out.append(f'<text class="ah-endlab" x="{P+IW+9}" y="{Y(endb)+4:.1f}">{money(endb)}</text>')
    if ghost and promises:
        gb = g['ghost'][-1][1]
        out.append(f'<text class="ah-endghost" x="{P+IW+9}" y="{Y(gb)+4:.1f}">{money(gb)}</text>')
    return (f'<svg class="ah-svg" viewBox="0 0 {W} {H}" role="img" '
            f'aria-label="The balance over {days} days">' + "".join(out) + '</svg>')

open('_svg_main.html','w').write(svg(ON_HAND, COMMITS, PROMISES))
open('_svg_short.html','w').write(svg(ON_HAND, SHORT_COMMITS, PROMISES))
open('_svg_phone.html','w').write(svg(ON_HAND, COMMITS, PROMISES, days=30))
print('main  ', len(open('_svg_main.html').read()), 'chars')
print('short ', len(open('_svg_short.html').read()), 'chars')
