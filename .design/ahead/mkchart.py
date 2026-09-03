#!/usr/bin/env python3
"""Builds the runway chart's SVG from real figures, so the geometry is
measured rather than drawn by eye. A STEP line, never a slope: a balance
does not drift down between commitments, it sits flat and then drops on
the day. An interpolated line would draw a shape the money never takes."""
import sys, json, datetime as dt

def build(on_hand, commits, promises, start, days, w=1000, h=248):
    padL, padR, padT, padB = 78, 104, 20, 36
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

    lo = min(0, min(b for _, b in solid), min(b for _, b in ghost))
    hi = max(on_hand, max(b for _, b in solid), max(b for _, b in ghost))
    hi = hi * 1.06 or 1
    def X(d): return padL + (d - d0).days / days * innerW
    def Y(v): return padT + innerH - (v - lo) / (hi - lo) * innerH

    def step(pts):
        s = f"M{X(pts[0][0]):.1f},{Y(pts[0][1]):.1f}"
        for i in range(1, len(pts)):
            s += f" L{X(pts[i][0]):.1f},{Y(pts[i-1][1]):.1f} L{X(pts[i][0]):.1f},{Y(pts[i][1]):.1f}"
        return s
    return dict(w=w, h=h, padL=padL, padR=padR, padT=padT, padB=padB,
                innerW=innerW, innerH=innerH, lo=lo, hi=hi,
                X=X, Y=Y, solid=solid, ghost=ghost, step=step, d0=d0, dN=dN, days=days)

def money(n): return f"{round(n):,}"
def short(d): return d.strftime("%-d %b")
