#!/usr/bin/env python3
"""Builds the runway chart's SVG from real figures, so the geometry is
measured rather than drawn by eye. A STEP line, never a slope: a balance
does not drift down between commitments, it sits flat and then drops on
the day. An interpolated line would draw a shape the money never takes.

The frame mirrors index.html's aheadRunwaySVG exactly -- same paddings,
same domain, same nice step -- so what the canvas shows is what the app
draws, and neither can quietly drift from the other."""
import sys, json, math, datetime as dt

def nice_step(span, want):
    """A step in figures a person reads: 1, 2 or 5 times a power of ten,
    so the value axis lands on 1,000,000 rather than on 1,284,000."""
    raw = max(1.0, span) / max(1, want)
    mag = 10 ** math.floor(math.log10(raw))
    k = raw / mag
    return (1 if k <= 1 else 2 if k <= 2 else 5 if k <= 5 else 10) * mag

def build(on_hand, commits, promises, start, days, w=800, h=280, small=False):
    # THE VIEWBOX IS THE COLUMN'S REAL WIDTH, not a round 1000. The svg is
    # width:100%, so every unit in it is scaled by column / w -- and at
    # 1000 units in the ~800px column this panel gets, every 11px label
    # rendered at 8.8px.
    padL, padR, padT, padB = (54, 12, 14, 66) if small else (88, 100, 30, 80)
    if small: w, h = 358, 196
    d0 = dt.date.fromisoformat(start); dN = d0 + dt.timedelta(days=days)
    innerW, innerH = w - padL - padR, h - padT - padB

    # the two walks
    def walk(events):
        bal = on_hand; pts = [(d0, bal)]
        for e in events:
            bal += e['delta']; pts.append((dt.date.fromisoformat(e['date']), bal))
        pts.append((dN, bal)); return pts
    solid = walk([{**c, 'delta': -c['amount']} for c in commits])
    mixed = sorted([{**c, 'delta': -c['amount']} for c in commits]
                 + [{**p, 'delta':  p['amount']} for p in promises],
                   key=lambda e: e['date'])
    ghost = walk(mixed)

    # THE DOMAIN IS NOT SNAPPED TO THE STEP. Rounding the top up to the
    # next whole gridline put 8,000,000 above a line that never passes
    # 6,381,779, and a quarter of the plot was empty. The domain is the
    # data plus a little air; the GRIDLINES are the round figures inside
    # it. The floor stays at nothing-left while the line is above it,
    # because zero is the edge this screen is about.
    lo_raw = min(0, min(b for _, b in solid), min(b for _, b in ghost))
    hi_raw = max(on_hand, max(b for _, b in solid), max(b for _, b in ghost))
    span = max(1, hi_raw - lo_raw); air = span * 0.07
    lo = lo_raw - air if lo_raw < 0 else 0
    hi = hi_raw + air
    step_v = nice_step(hi - lo, 4 if small else 7)

    def X(d): return padL + (d - d0).days / days * innerW
    def Y(v): return padT + innerH - (v - lo) / (hi - lo) * innerH

    def step(pts):
        s = f"M{X(pts[0][0]):.1f},{Y(pts[0][1]):.1f}"
        for i in range(1, len(pts)):
            s += f" L{X(pts[i][0]):.1f},{Y(pts[i-1][1]):.1f} L{X(pts[i][0]):.1f},{Y(pts[i][1]):.1f}"
        return s
    return dict(w=w, h=h, padL=padL, padR=padR, padT=padT, padB=padB, small=small,
                innerW=innerW, innerH=innerH, lo=lo, hi=hi, step_v=step_v,
                X=X, Y=Y, solid=solid, ghost=ghost, step=step, d0=d0, dN=dN, days=days)

def money(n): return f"{round(n):,}"
def short(d): return d.strftime("%-d %b")
