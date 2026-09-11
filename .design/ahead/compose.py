#!/usr/bin/env python3
"""Substitutes the generated chart, the strip and the shared rail into
each artboard body, so no figure is typed twice."""
import re, pathlib
R = lambda p: pathlib.Path(p).read_text()

MAIN = dict(SAFE="110,000", SAFECLS="ow-warn",
  SAFESUB="The lowest the line gets, on <b>24 Sep</b>. This is what <b>What to buy</b> budgets from &mdash; not the 4,850,000 beside it",
  DUE="4,740,000", DUESUB="6 payments &middot; rent, wages, one loan and 3 supplier bills you dated",
  TIGHT="24 Sep", TIGHTCLS="ow-warn", TIGHTSUB="In 21 days, after the Bwambale bill. It recovers to <b>110,000</b> and stays there")
SHORT = dict(SAFE="0", SAFECLS="ow-bad",
  SAFESUB="The line goes under on <b>21 Sep</b>. There is nothing you can safely commit today",
  DUE="6,060,000", DUESUB="7 payments &middot; 1,210,000 more than you hold",
  TIGHT="28 Sep", TIGHTCLS="ow-bad", TIGHTSUB="Short <b>1,210,000</b> by then, unless money comes in first")

def compose(body, svg, vals, rail_extra=""):
    s = R(body)
    strip = R('_strip.html')
    for k, v in vals.items(): strip = strip.replace('__'+k+'__', v)
    rail = R('_rail_common.html').replace('__DUE__', vals['DUE'])
    s = s.replace('__STRIP__', strip)
    s = s.replace('__SVG__', R(svg) if svg else '')
    # THE "BELOW NOTHING" KEY ONLY BELONGS WHERE THE LINE GOES UNDER.
    # A legend naming a mark that is not on the chart is a mark the eye
    # hunts for and never finds.
    lg = R('_legend.html')
    if vals['SAFECLS'] != 'ow-bad':
        lg = "\n".join(l for l in lg.split("\n") if 'ah-lg-neg' not in l)
    s = s.replace('__LEGEND__', lg)
    s = s.replace('__RAIL__', rail_extra + rail)
    return s

pathlib.Path('_body_main.html').write_text(compose('body_main.html', '_svg_main.html', MAIN))
pathlib.Path('_body_short.html').write_text(
    compose('body_short.html', '_svg_short.html', SHORT, rail_extra=R('_rail_ring.html')))

# THE CROSSHAIR ARTBOARD. The canvas cannot hover, so it is drawn in the
# state a pointer puts it in. Its frame is 858 wide so the plot lands at
# exactly 800px and the card can be placed in the svg's own units.
cross = R('body_cross.html')
cross = cross.replace('__SVG__', R('_svg_cross.html'))
cross = cross.replace('__CARD__', R('_cross_card.html'))
cross = cross.replace('__LEGEND__',
    "\n".join(l for l in R('_legend.html').split("\n") if 'ah-lg-neg' not in l))
pathlib.Path('_body_cross.html').write_text(cross)
print('composed Main, Short and Crosshair')
