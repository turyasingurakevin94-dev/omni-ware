#!/usr/bin/env python3
"""Draws the cash runway for the Forecasts canvas from real figures, so
the geometry is measured rather than drawn by eye. The chart idiom is
the one .design/ahead settled: a STEP line (a balance sits flat and
drops on the day), a dashed grey ghost for promises, the ground below
nothing drawn as a crimson field, a value axis on round steps and a day
axis with dated ticks. mkchart.py is that canvas's, unchanged."""
import sys, math, datetime as dt
sys.path.insert(0, '.')
from mkchart import build, money, short

# Tuesday 8 September 2026 -- the same day the Today lens is read on.
START = "2026-09-08"
ON_HAND = 6850000
COMMITS = [
  {"date":"2026-09-10","amount": 760000,"label":"Roofings Rolling Mills","kind":"bill"},
  {"date":"2026-09-11","amount": 800000,"label":"Nakawa shop — rent","kind":"rent"},
  {"date":"2026-09-14","amount": 420000,"label":"Stanbic loan","kind":"loan"},
  {"date":"2026-09-17","amount":1640000,"label":"Ssekitoleko Hardware","kind":"bill"},
  {"date":"2026-09-20","amount": 780000,"label":"August wages","kind":"wage"},
  {"date":"2026-09-29","amount": 340000,"label":"Bwambale Steel Works","kind":"bill"},
]
PROMISES = [
  {"date":"2026-09-13","amount":640000,"label":"Kato Construction Ltd"},
  {"date":"2026-09-22","amount":180000,"label":"Sarah Namono"},
]

def ylab(v, small):
    if not small: return money(v)
    a = abs(v)
    if a >= 1e6:
        s = f"{v/1e6:.1f}"
        return (s[:-2] if s.endswith('.0') else s) + 'M'
    if a >= 1e3: return f"{round(v/1e3)}k"
    return money(v)

def svg(on_hand, commits, promises, start=START, days=30, ghost=True, small=False, w=796, h=250):
    g = build(on_hand, commits, promises, start, days, w=w, h=h, small=small)
    X, Y, step = g['X'], g['Y'], g['step']
    P, Q = g['padL'], g['padT']
    W, H, IW, IH = g['w'], g['h'], g['innerW'], g['innerH']
    D0, SV = g['d0'], g['step_v']
    baseY = Q + IH
    at = lambda d: D0 + dt.timedelta(days=d)
    out = []
    if g['lo'] < 0:
        out.append(f'<rect class="ah-neg" x="{P}" y="{Y(0):.1f}" width="{IW}" height="{(baseY-Y(0)):.1f}"/>')
    v = math.ceil(g['lo'] / SV) * SV
    while v <= g['hi'] + SV * 0.001:
        y = Y(v)
        out.append(f'<line class="ah-grid{" ah-zero" if round(v)==0 else ""}" x1="{P}" y1="{y:.1f}" x2="{P+IW}" y2="{y:.1f}"/>')
        out.append(f'<text class="ah-yl" x="{P-10}" y="{y+3.5:.1f}" text-anchor="end">{ylab(round(v), g["small"])}</text>')
        v += SV
    dstep = (max(1, -(-days // 2)) if days <= 16 else -(-days // 3)) if g['small'] else (
        1 if days <= 10 else 3 if days <= 24 else 7 if days <= 60 else 14 if days <= 140 else 30)
    xs = list(range(0, days, dstep))
    if len(xs) > 1 and days - xs[-1] < dstep * 0.5: xs.pop()
    xs.append(days)
    out.append(f'<line class="ah-axis" x1="{P}" y1="{baseY}" x2="{P+IW}" y2="{baseY}"/>')
    for i, d in enumerate(xs):
        x, last = X(at(d)), i == len(xs) - 1
        anc = 'start' if i == 0 else 'end' if last else 'middle'
        out.append(f'<line class="ah-tick" x1="{x:.1f}" y1="{baseY}" x2="{x:.1f}" y2="{baseY+5}"/>')
        out.append(f'<text class="ah-xl" x="{x:.1f}" y="{baseY + (17 if g["small"] else 18)}" text-anchor="{anc}">{short(at(d))}</text>')
        if not g['small'] and (i == 0 or last):
            out.append(f'<text class="ah-xl-t" x="{x:.1f}" y="{baseY+31}" text-anchor="{anc}">{"today" if i == 0 else at(d).year}</text>')
    # what leaves each day
    by = {}
    for c in commits: by.setdefault(c['date'], []).append(c)
    if by:
        railH, railB = (18, H - 20) if g['small'] else (22, H - 14)
        bw = 4 if g['small'] else 6
        tot = {k: sum(c['amount'] for c in v) for k, v in by.items()}
        mx = max(tot.values())
        lowest = min(zip([b for _, b in g['solid'][1:-1]], commits), key=lambda p: p[0])[1] if len(g['solid']) > 2 else None
        if not g['small']:
            out.append(f'<text class="ah-cap" x="{P-10}" y="{railB-railH/2+3.5:.1f}" text-anchor="end">Out each day</text>')
        for iso, items in sorted(by.items()):
            hh = max(3, tot[iso] / mx * railH)
            x = X(dt.date.fromisoformat(iso)) - bw / 2
            low = lowest is not None and iso == lowest['date']
            out.append(f'<rect class="ah-rail{" ah-rail-low" if low else ""}" x="{x:.1f}" y="{railB-hh:.1f}" width="{bw}" height="{hh:.1f}"/>')
    if ghost and promises:
        out.append(f'<path class="ah-ghost" d="{step(g["ghost"])}"/>')
    out.append(f'<path class="ah-line" d="{step(g["solid"])}"/>')
    out.append(f'<circle class="ah-dot ah-start" cx="{X(D0):.1f}" cy="{Y(on_hand):.1f}" r="{3 if g["small"] else 3.5}"/>')
    lowest = min(g['solid'][1:-1], key=lambda p: p[1]) if len(g['solid']) > 2 else g['solid'][0]
    for i, (d, b) in enumerate(g['solid']):
        if i == 0 or i == len(g['solid'])-1: continue
        nxt = g['solid'][i+1]
        if i + 1 < len(g['solid']) - 1 and nxt[0] == d and (d, b) != lowest: continue
        cls = 'ah-dot ah-low' if (d, b) == lowest else 'ah-dot'
        r = 3.8 if g["small"] and cls.endswith("low") else 3 if g["small"] else 4.5 if cls.endswith("low") else 3.5
        out.append(f'<circle class="{cls}" cx="{X(d):.1f}" cy="{Y(b):.1f}" r="{r}"/>')
    lx, ly = X(lowest[0]), Y(lowest[1])
    below = lowest[1] < 0
    if not g['small'] and commits:
        out.append(f'<line class="ah-lowrule" x1="{lx:.1f}" y1="{Q+34}" x2="{lx:.1f}" y2="{ly:.1f}"/>')
        anchor = 'end' if lx > P + IW*0.62 else 'start'
        dx = -9 if anchor == 'end' else 9
        out.append(f'<text class="ah-lowlab{" ah-bad" if below else ""}" x="{lx+dx:.1f}" y="{Q+11}" text-anchor="{anchor}">{"Short " + money(abs(lowest[1])) if below else money(lowest[1]) + " left"}</text>')
        out.append(f'<text class="ah-lowsub" x="{lx+dx:.1f}" y="{Q+25}" text-anchor="{anchor}">{short(lowest[0])} &mdash; the tightest day</text>')
    if not g['small']:
        endb = g['solid'][-1][1]
        out.append(f'<text class="ah-endlab" x="{P+IW+9}" y="{Y(endb)+4:.1f}">{money(endb)}</text>')
        if ghost and promises:
            gb = g['ghost'][-1][1]
            if abs(Y(gb) - Y(endb)) > 11:
                out.append(f'<text class="ah-endghost" x="{P+IW+9}" y="{Y(gb)+4:.1f}">{money(gb)}</text>')
    return (f'<svg class="ah-svg" viewBox="0 0 {W} {H}" role="img" aria-label="What you will hold over the next {days} days">' + "".join(out) + '</svg>')

open('_chart.html','w').write(svg(ON_HAND, COMMITS, PROMISES) + '\n')
open('_chart_sm.html','w').write(svg(ON_HAND, COMMITS, PROMISES, small=True) + '\n')
g = build(ON_HAND, COMMITS, PROMISES, START, 30)
low = min(g['solid'][1:-1], key=lambda p: p[1])
print('lowest', money(low[1]), short(low[0]), 'end', money(g['solid'][-1][1]))
