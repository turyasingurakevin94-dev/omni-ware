#!/usr/bin/env python3
import sys, json, math, datetime as dt
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

def ylab(v, small):
    if not small: return money(v)
    a = abs(v)
    if a >= 1e6:
        s = f"{v/1e6:.1f}"
        return (s[:-2] if s.endswith('.0') else s) + 'M'
    if a >= 1e3: return f"{round(v/1e3)}k"
    return money(v)

def svg(on_hand, commits, promises, start="2026-09-03", days=30, ghost=True, small=False):
    g = build(on_hand, commits, promises, start, days, small=small)
    X, Y, step = g['X'], g['Y'], g['step']
    P, Q = g['padL'], g['padT']
    W, H, IW, IH = g['w'], g['h'], g['innerW'], g['innerH']
    D0, SV = g['d0'], g['step_v']
    baseY = Q + IH
    at = lambda d: D0 + dt.timedelta(days=d)
    out = []
    # --- the ground below nothing, drawn as a field the line goes into --
    if g['lo'] < 0:
        out.append(f'<rect class="ah-neg" x="{P}" y="{Y(0):.1f}" width="{IW}" '
                   f'height="{(baseY-Y(0)):.1f}"/>')
    # --- THE VALUE AXIS ---------------------------------------------------
    # It was two gridlines -- what you hold now and nothing left -- on the
    # argument that a third would be a tick nobody reads. That was wrong:
    # with only two, every point between them is unreadable, and the whole
    # middle of this chart is between them. So: a round step, a hairline
    # and a figure at each. Zero keeps the heavier stroke; it is the cliff.
    v = math.ceil(g['lo'] / SV) * SV
    while v <= g['hi'] + SV * 0.001:
        y = Y(v)
        out.append(f'<line class="ah-grid{" ah-zero" if round(v)==0 else ""}" x1="{P}" '
                   f'y1="{y:.1f}" x2="{P+IW}" y2="{y:.1f}"/>')
        out.append(f'<text class="ah-yl" x="{P-10}" y="{y+3.5:.1f}" '
                   f'text-anchor="end">{ylab(round(v), g["small"])}</text>')
        v += SV
    # --- THE DAY AXIS -----------------------------------------------------
    # A rule along the floor with dated ticks on it, so a step in the line
    # can be placed on a day without counting pixels from one end.
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
        out.append(f'<text class="ah-xl" x="{x:.1f}" y="{baseY + (17 if g["small"] else 18)}" '
                   f'text-anchor="{anc}">{short(at(d))}</text>')
        if not g['small'] and (i == 0 or last):
            out.append(f'<text class="ah-xl-t" x="{x:.1f}" y="{baseY+31}" text-anchor="{anc}">'
                       f'{"today" if i == 0 else at(d).year}</text>')
    # --- WHAT LEAVES EACH DAY, under the axis it shares --------------------
    # Twelve payments in thirty days pile four dots into twenty pixels on
    # the line, and the flat segments between them hide how much is moving.
    by = {}
    for c in commits:
        by.setdefault(c['date'], []).append(c)
    if by:
        railH, railB = (18, H - 20) if g['small'] else (24, H - 16)
        bw = 4 if g['small'] else 6
        tot = {k: sum(c['amount'] for c in v) for k, v in by.items()}
        mx = max(tot.values())
        lowest = min(zip([b for _, b in g['solid'][1:-1]], commits), key=lambda p: p[0])[1] if len(g['solid']) > 2 else None
        if not g['small']:
            out.append(f'<text class="ah-cap" x="{P-10}" y="{railB-railH/2+3.5:.1f}" '
                       f'text-anchor="end">Out each day</text>')
        for iso, items in sorted(by.items()):
            h = max(3, tot[iso] / mx * railH)
            x = X(dt.date.fromisoformat(iso)) - bw / 2
            low = lowest is not None and iso == lowest['date']
            names = "; ".join(f"{c['label']} {money(c['amount'])}" for c in items)
            out.append(f'<rect class="ah-rail{" ah-rail-low" if low else ""}" x="{x:.1f}" '
                       f'y="{railB-h:.1f}" width="{bw}" height="{h:.1f}">'
                       f'<title>{short(dt.date.fromisoformat(iso))} — {money(tot[iso])} out: {names}</title></rect>')
    # --- the ghost: if every promise is kept -----------------------------
    if ghost and promises:
        out.append(f'<path class="ah-ghost" d="{step(g["ghost"])}"/>')
    # --- the balance itself ----------------------------------------------
    out.append(f'<path class="ah-line" d="{step(g["solid"])}"/>')
    out.append(f'<circle class="ah-dot ah-start" cx="{X(D0):.1f}" cy="{Y(on_hand):.1f}" '
               f'r="{3 if g["small"] else 3.5}"><title>Today, {short(D0)} — {money(on_hand)} in hand</title></circle>')
    # --- a marker and a hover title on every step ------------------------
    lowest = min(g['solid'][1:-1], key=lambda p: p[1]) if len(g['solid']) > 2 else g['solid'][0]
    for i, (d, b) in enumerate(g['solid']):
        if i == 0 or i == len(g['solid'])-1: continue
        c = commits[i-1]
        nxt = g['solid'][i+1]
        if i + 1 < len(g['solid']) - 1 and nxt[0] == d and (d, b) != lowest: continue
        cls = 'ah-dot ah-low' if (d, b) == lowest else 'ah-dot'
        out.append(f'<circle class="{cls}" cx="{X(d):.1f}" cy="{Y(b):.1f}" r="{3.8 if g["small"] and cls.endswith("low") else 3 if g["small"] else 4.5 if cls.endswith("low") else 3.5}">'
                   f'<title>{short(d)} — {c["label"]}, {money(c["amount"])} out, leaves {money(b)}</title></circle>')
    # --- the low point, named where it happens ---------------------------
    lx, ly = X(lowest[0]), Y(lowest[1])
    below = lowest[1] < 0
    if not g['small'] and commits:
        out.append(f'<line class="ah-lowrule" x1="{lx:.1f}" y1="{Q+34}" x2="{lx:.1f}" y2="{ly:.1f}"/>')
        anchor = 'end' if lx > P + IW*0.62 else 'start'
        dx = -9 if anchor == 'end' else 9
        out.append(f'<text class="ah-lowlab{" ah-bad" if below else ""}" x="{lx+dx:.1f}" y="{Q+11}" '
                   f'text-anchor="{anchor}">{"Short " + money(abs(lowest[1])) if below else money(lowest[1]) + " left"}</text>')
        out.append(f'<text class="ah-lowsub" x="{lx+dx:.1f}" y="{Q+25}" text-anchor="{anchor}">'
                   f'{short(lowest[0])} — the tightest day</text>')
    # --- the end-of-window figure, direct-labelled ------------------------
    if not g['small']:
        endb = g['solid'][-1][1]
        out.append(f'<text class="ah-endlab" x="{P+IW+9}" y="{Y(endb)+4:.1f}">{money(endb)}</text>')
        if ghost and promises:
            gb = g['ghost'][-1][1]
            if abs(Y(gb) - Y(endb)) > 11:
                out.append(f'<text class="ah-endghost" x="{P+IW+9}" y="{Y(gb)+4:.1f}">{money(gb)}</text>')
    return (f'<svg class="ah-svg" viewBox="0 0 {W} {H}" role="img" '
            f'aria-label="What you will hold over the next {days} days, from {money(on_hand)} '
            f'today down to {money(g["solid"][-1][1])}, lowest {money(lowest[1])}">' + "".join(out) + '</svg>')

open('_svg_main.html','w').write(svg(ON_HAND, COMMITS, PROMISES))
open('_svg_empty.html','w').write(svg(ON_HAND, [], []))
open('_svg_phone_short.html','w').write(svg(ON_HAND, SHORT_COMMITS, PROMISES, small=True))
open('_svg_short.html','w').write(svg(ON_HAND, SHORT_COMMITS, PROMISES))
open('_svg_phone.html','w').write(svg(ON_HAND, COMMITS, PROMISES, small=True))
print('main  ', len(open('_svg_main.html').read()), 'chars')
print('short ', len(open('_svg_short.html').read()), 'chars')
print('phone ', len(open('_svg_phone.html').read()), 'chars')
