#!/usr/bin/env python3
"""Scale-true fastener geometry, as SVG.

Every dimension here is READ from the tables that already ship in
index.html (METRIC_BOLTS, SCREW_GAUGES, WALL_PLUGS) -- nothing is drawn
to taste. A millimetre is S pixels everywhere in one drawing, so an M6
beside an M8 is genuinely smaller by the right amount and a 1.6mm washer
is genuinely thinner than a 2mm one.

The one thing that is a DRAWING CONVENTION rather than a projection is
the exploded view: the bolt is in side elevation (how every catalogue
draws a bolt) while the washer and nut are turned face-on so their bores
are visible, with their thickness shown as a rim. That is the standard
exploded-assembly cheat. Both axes stay to scale within each part.
"""
import math

# ISO 4014/4017 head height k, mm. The one bolt dimension the app's own
# table does not carry, because the page has never had to draw one.
HEAD_K = {3:2.0, 4:2.8, 5:3.5, 6:4.0, 8:5.3, 10:6.4, 12:7.5, 14:8.8,
          16:10.0, 18:11.5, 20:12.5, 22:14.0, 24:15.0, 27:17.0, 30:18.7}
# ISO 4032 nut height m, mm.
NUT_M = {3:2.4, 4:3.2, 5:4.7, 6:5.2, 8:6.8, 10:8.4, 12:10.8, 14:12.8,
         16:14.8, 18:15.8, 20:18.0, 22:19.4, 24:21.5, 27:23.8, 30:25.6}

METRIC_BOLTS = [
  dict(size='M3',  dia=3,  pitch=0.5,  afIso=5.5, afDin=5.5, washerId=3.2,  washerOd=7,  washerT=0.5, tapDrill=2.5,  clearDrill=3.4),
  dict(size='M4',  dia=4,  pitch=0.7,  afIso=7,   afDin=7,   washerId=4.3,  washerOd=9,  washerT=0.8, tapDrill=3.3,  clearDrill=4.5),
  dict(size='M5',  dia=5,  pitch=0.8,  afIso=8,   afDin=8,   washerId=5.3,  washerOd=10, washerT=1,   tapDrill=4.2,  clearDrill=5.5),
  dict(size='M6',  dia=6,  pitch=1,    afIso=10,  afDin=10,  washerId=6.4,  washerOd=12, washerT=1.6, tapDrill=5,    clearDrill=6.6),
  dict(size='M8',  dia=8,  pitch=1.25, afIso=13,  afDin=13,  washerId=8.4,  washerOd=16, washerT=1.6, tapDrill=6.8,  clearDrill=9),
  dict(size='M10', dia=10, pitch=1.5,  afIso=16,  afDin=17,  washerId=10.5, washerOd=20, washerT=2,   tapDrill=8.5,  clearDrill=11),
  dict(size='M12', dia=12, pitch=1.75, afIso=18,  afDin=19,  washerId=13,   washerOd=24, washerT=2.5, tapDrill=10.2, clearDrill=13.5),
  dict(size='M14', dia=14, pitch=2,    afIso=21,  afDin=22,  washerId=15,   washerOd=28, washerT=2.5, tapDrill=12,   clearDrill=15.5),
  dict(size='M16', dia=16, pitch=2,    afIso=24,  afDin=24,  washerId=17,   washerOd=30, washerT=3,   tapDrill=14,   clearDrill=17.5),
  dict(size='M20', dia=20, pitch=2.5,  afIso=30,  afDin=30,  washerId=21,   washerOd=37, washerT=3,   tapDrill=17.5, clearDrill=22),
]
BOLT = {r['size']: r for r in METRIC_BOLTS}

SCREW_GAUGES = [
  dict(gauge=4,  dia=2.9, pilotSoft=1.5, pilotHard=2,   clearDrill=3.5, plugMm=5),
  dict(gauge=6,  dia=3.5, pilotSoft=2,   pilotHard=2.5, clearDrill=4,   plugMm=5),
  dict(gauge=8,  dia=4.2, pilotSoft=2,   pilotHard=3,   clearDrill=4.5, plugMm=6),
  dict(gauge=10, dia=4.8, pilotSoft=2.5, pilotHard=3.5, clearDrill=5,   plugMm=7),
  dict(gauge=12, dia=5.5, pilotSoft=3,   pilotHard=4,   clearDrill=6,   plugMm=8),
  dict(gauge=14, dia=6.3, pilotSoft=3.5, pilotHard=4.5, clearDrill=6.5, plugMm=10),
]
GAUGE = {r['gauge']: r for r in SCREW_GAUGES}

WALL_PLUGS = {5:'Yellow', 6:'Red', 7:'Brown', 8:'', 10:'Blue', 12:''}
PLUG_INK = {'Yellow':('#D8B23C','#F0DA92','#8A6C15'), 'Red':('#B2402E','#D98874','#6E2317'),
            'Brown':('#7A5236','#A98261','#4A2E1B'), 'Blue':('#3A6E96','#7FA8C6','#1F415C'),
            '':('#9AA1A6','#D2D7DA','#5E666C')}

# Finishes: base, highlight, shadow, deep shadow. These are MATERIALS,
# not interface colour -- the whole point of the page is that a black
# chipboard screw and a gold-passivated one look different on screen.
FINISH = {
  'zinc':  ('#AEB6BD', '#F4F7F9', '#79828A', '#3E464D'),
  'black': ('#2E3236', '#7C848B', '#1A1D20', '#0B0D0E'),
  'gold':  ('#C2933A', '#F6E2A6', '#8A6519', '#4E3A0C'),
  'galv':  ('#98A0A5', '#D9DEE1', '#6B7479', '#404750'),
}
FINISH_NAME = {'zinc':'Bright zinc', 'black':'Black phosphate', 'gold':'Yellow passivate', 'galv':'Hot-dip galvanised'}


def defs(uid, finish, bg):
    """Cylinder, face and rim gradients for one drawing."""
    b, hi, lo, deep = FINISH[finish]
    return f'''<defs>
  <linearGradient id="cyl{uid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="{deep}"/><stop offset="9%" stop-color="{lo}"/>
    <stop offset="30%" stop-color="{b}"/><stop offset="43%" stop-color="{hi}"/>
    <stop offset="58%" stop-color="{b}"/><stop offset="86%" stop-color="{lo}"/>
    <stop offset="100%" stop-color="{deep}"/>
  </linearGradient>
  <linearGradient id="face{uid}" x1="0.1" y1="0" x2="0.9" y2="1">
    <stop offset="0%" stop-color="{hi}"/><stop offset="38%" stop-color="{b}"/>
    <stop offset="100%" stop-color="{lo}"/>
  </linearGradient>
  <linearGradient id="rim{uid}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="{lo}"/><stop offset="45%" stop-color="{b}"/>
    <stop offset="100%" stop-color="{deep}"/>
  </linearGradient>
  <radialGradient id="bore{uid}" cx="0.5" cy="0.42" r="0.62">
    <stop offset="0%" stop-color="{deep}"/><stop offset="70%" stop-color="{lo}"/>
    <stop offset="100%" stop-color="{b}"/>
  </radialGradient>
</defs>'''


def _thread(x0, x1, Rm, Rn, pitch_px, uid, bg, taper=0.0):
    """A wound thread at TRUE pitch: outer envelope, helical grooves, and
    a sawtooth silhouette cut back to the ground. The groove slant is the
    real helix -- the crest advances p/pi across the visible diameter."""
    o = [f'<rect x="{x0:.2f}" y="{-Rm:.2f}" width="{x1-x0:.2f}" height="{2*Rm:.2f}" fill="url(#cyl{uid})"/>']
    slant = pitch_px / math.pi
    n = int((x1 - x0) / pitch_px) + 2
    g = []
    for i in range(n):
        x = x0 + i * pitch_px
        if x > x1: break
        w = pitch_px * 0.42
        g.append(f'<path d="M{x:.2f} {-Rm:.2f} L{x+w:.2f} {-Rm:.2f} L{x+w+slant:.2f} {Rm:.2f} L{x+slant:.2f} {Rm:.2f} Z"/>')
    o.append(f'<g fill="#000" opacity="0.42" clip-path="url(#tc{uid})">{"".join(g)}</g>')
    o.append(f'<g fill="#fff" opacity="0.13" clip-path="url(#tc{uid})">'
             + ''.join(f'<path d="M{x0+i*pitch_px+pitch_px*0.62:.2f} {-Rm:.2f} L{x0+i*pitch_px+pitch_px*0.78:.2f} {-Rm:.2f} '
                       f'L{x0+i*pitch_px+pitch_px*0.78+slant:.2f} {Rm:.2f} L{x0+i*pitch_px+pitch_px*0.62+slant:.2f} {Rm:.2f} Z"/>'
                       for i in range(n) if x0+i*pitch_px <= x1) + '</g>')
    # sawtooth silhouette, cut back to the ground on both edges
    top, bot = [], []
    i = 0
    while x0 + i * pitch_px <= x1 + pitch_px:
        x = x0 + i * pitch_px
        top.append(f'<path d="M{x:.2f} {-Rm-1:.2f} L{x+pitch_px:.2f} {-Rm-1:.2f} L{x+pitch_px*0.5:.2f} {-Rn:.2f} Z"/>')
        bot.append(f'<path d="M{x+slant:.2f} {Rm+1:.2f} L{x+pitch_px+slant:.2f} {Rm+1:.2f} L{x+pitch_px*0.5+slant:.2f} {Rn:.2f} Z"/>')
        i += 1
    o.append(f'<g fill="{bg}" clip-path="url(#tc{uid})">{"".join(top)}{"".join(bot)}</g>')
    clip = f'<clipPath id="tc{uid}"><rect x="{x0:.2f}" y="{-Rm-2:.2f}" width="{x1-x0:.2f}" height="{2*Rm+4:.2f}"/></clipPath>'
    return clip + ''.join(o)


def hex_bolt(row, length_mm, S, uid, finish='zinc', bg='#1A1E23', std='iso'):
    """Side elevation, head at left, axis at y=0, head face at x=0.
    Returns (svg, total_width_px)."""
    d, p = row['dia'], row['pitch']
    af = row['afIso'] if std == 'iso' else row['afDin']
    k = HEAD_K[d]
    ac = af * 1.1547
    R, Rk = ac / 2 * S, af / 2 * S
    hw = k * S
    Rm, Rn = d / 2 * S, (d / 2 - 0.6134 * p) * S
    L = length_mm * S
    ch = R * 0.20  # head chamfer
    o = [defs(uid, finish, bg)]
    b, hi, lo, deep = FINISH[finish]
    # shank + thread. Full-thread (ISO 4017) is what this shop stocks.
    o.append(_thread(hw - 0.5, hw + L, Rm, Rn, p * S, uid, bg))
    # the free end: a small chamfered lead
    o.append(f'<path d="M{hw+L:.2f} {-Rn:.2f} L{hw+L+Rm*0.5:.2f} {-Rn*0.55:.2f} '
             f'L{hw+L+Rm*0.5:.2f} {Rn*0.55:.2f} L{hw+L:.2f} {Rn:.2f} Z" fill="url(#cyl{uid})"/>')
    # head, across corners: silhouette + two facet divisions at +-ac/4
    o.append(f'<path d="M{ch:.2f} {-R:.2f} L{hw:.2f} {-R:.2f} L{hw:.2f} {R:.2f} L{ch:.2f} {R:.2f} '
             f'L0 {-R+ch:.2f} L0 {R-ch:.2f} Z" fill="url(#cyl{uid})"/>')
    o.append(f'<path d="M{ch:.2f} {-R:.2f} L{hw:.2f} {-R:.2f} L{hw:.2f} {-R/2:.2f} L{0.4*ch:.2f} {-R/2:.2f} Z" fill="#000" opacity="0.30"/>')
    o.append(f'<path d="M{ch:.2f} {R:.2f} L{hw:.2f} {R:.2f} L{hw:.2f} {R/2:.2f} L{0.4*ch:.2f} {R/2:.2f} Z" fill="#000" opacity="0.42"/>')
    o.append(f'<rect x="{0.4*ch:.2f}" y="{-R/2:.2f}" width="{hw-0.4*ch:.2f}" height="{R:.2f}" fill="url(#face{uid})"/>')
    o.append(f'<line x1="{0.4*ch:.2f}" y1="{-R/2:.2f}" x2="{hw:.2f}" y2="{-R/2:.2f}" stroke="{deep}" stroke-width="0.9" opacity="0.7"/>')
    o.append(f'<line x1="{0.4*ch:.2f}" y1="{R/2:.2f}" x2="{hw:.2f}" y2="{R/2:.2f}" stroke="{deep}" stroke-width="0.9" opacity="0.7"/>')
    # the washer face under the head
    o.append(f'<rect x="{hw-1.2:.2f}" y="{-R:.2f}" width="1.6" height="{2*R:.2f}" fill="{deep}" opacity="0.55"/>')
    o.append(f'<rect x="{0.4*ch:.2f}" y="{-R*0.34:.2f}" width="{hw-0.4*ch:.2f}" height="{R*0.20:.2f}" fill="{hi}" opacity="0.35"/>')
    return ''.join(o), hw + L + Rm * 0.5, R


# The exploded view turns the washer and nut about the vertical axis so
# their bores read. It is a REAL rotation, not a cheat: the face is
# foreshortened by cos(THETA) and the thickness shows at sin(THETA), so
# a 1.6mm washer still looks thinner than a 2mm one by the right amount.
THETA = 56.0
PK = math.cos(math.radians(THETA))
PD = math.sin(math.radians(THETA))


def washer(row, S, uid, finish='zinc'):
    """Origin at the disc centre. Returns (svg, depth_px, radius_px)."""
    od, idd, t = row['washerOd'], row['washerId'], row['washerT']
    R, r, T = od / 2 * S, idd / 2 * S, max(t * S * PD, 1.2)
    rx, rix = R * PK, r * PK
    b, hi, lo, deep = FINISH[finish]
    o = [defs(uid, finish, '#1A1E23')]
    o.append(f'<path d="M0 {-R:.2f} A{rx:.2f} {R:.2f} 0 0 0 0 {R:.2f} L{T:.2f} {R:.2f} '
             f'A{rx:.2f} {R:.2f} 0 0 1 {T:.2f} {-R:.2f} Z" fill="url(#rim{uid})"/>')
    o.append(f'<ellipse cx="0" cy="0" rx="{rx:.2f}" ry="{R:.2f}" fill="url(#face{uid})"/>')
    o.append(f'<ellipse cx="0" cy="0" rx="{rx:.2f}" ry="{R:.2f}" fill="none" stroke="{deep}" stroke-width="0.8" opacity="0.6"/>')
    o.append(f'<ellipse cx="0" cy="0" rx="{rx*0.88:.2f}" ry="{R*0.88:.2f}" fill="none" stroke="{hi}" stroke-width="{max(1.0,R*0.05):.2f}" opacity="0.26"/>')
    o.append(f'<path d="M0 {-r:.2f} A{rix:.2f} {r:.2f} 0 0 0 0 {r:.2f} L{T:.2f} {r:.2f} '
             f'A{rix:.2f} {r:.2f} 0 0 1 {T:.2f} {-r:.2f} Z" fill="url(#bore{uid})"/>')
    o.append(f'<ellipse cx="0" cy="0" rx="{rix:.2f}" ry="{r:.2f}" fill="{deep}"/>')
    return ''.join(o), T, R


def hex_nut(row, S, uid, finish='zinc', std='iso'):
    """Face-on hex ring, same rotation as the washer, threaded bore."""
    d = row['dia']
    af = row['afIso'] if std == 'iso' else row['afDin']
    R = (af / 2) / math.cos(math.radians(30)) * S
    T = NUT_M[d] * S * PD
    r = d / 2 * S
    rx, rix = R * PK, r * PK
    b, hi, lo, deep = FINISH[finish]
    pts = [(rx * math.cos(math.radians(a)), R * math.sin(math.radians(a))) for a in (90, 150, 210, 270, 330, 30)]
    face = ' '.join(f'{x:.2f},{y:.2f}' for x, y in pts)
    o = [defs(uid, finish, '#1A1E23')]
    o.append(f'<polygon points="{" ".join(f"{x+T:.2f},{y:.2f}" for x, y in pts)}" fill="{deep}"/>')
    for i, sh in ((5, 0.20), (4, 0.42), (3, 0.58)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % 6]
        o.append(f'<polygon points="{x1:.2f},{y1:.2f} {x2:.2f},{y2:.2f} {x2+T:.2f},{y2:.2f} {x1+T:.2f},{y1:.2f}" fill="{b}"/>'
                 f'<polygon points="{x1:.2f},{y1:.2f} {x2:.2f},{y2:.2f} {x2+T:.2f},{y2:.2f} {x1+T:.2f},{y1:.2f}" fill="#000" opacity="{sh}"/>')
    o.append(f'<polygon points="{face}" fill="url(#face{uid})"/>')
    o.append(f'<polygon points="{face}" fill="none" stroke="{deep}" stroke-width="0.8" opacity="0.65"/>')
    o.append(f'<polygon points="{" ".join(f"{x*0.84:.2f},{y*0.84:.2f}" for x, y in pts)}" fill="none" stroke="{hi}" stroke-width="{max(1.0,R*0.05):.2f}" opacity="0.22"/>')
    o.append(f'<path d="M0 {-r:.2f} A{rix:.2f} {r:.2f} 0 0 0 0 {r:.2f} L{T:.2f} {r:.2f} '
             f'A{rix:.2f} {r:.2f} 0 0 1 {T:.2f} {-r:.2f} Z" fill="url(#bore{uid})"/>')
    p = row['pitch'] * S
    y, th = -r + p * 0.4, []
    while y < r:
        w = rix * math.sqrt(max(1 - (y / r) ** 2, 0))
        th.append(f'<path d="M{-w:.2f} {y:.2f} A{rix:.2f} {r:.2f} 0 0 0 {-w:.2f} {y+0.1:.2f}"/>'
                  if False else f'<line x1="{-w:.2f}" y1="{y:.2f}" x2="{w+T:.2f}" y2="{y:.2f}"/>')
        y += p
    o.append(f'<clipPath id="nb{uid}"><path d="M0 {-r:.2f} A{rix:.2f} {r:.2f} 0 0 0 0 {r:.2f} '
             f'L{T:.2f} {r:.2f} A{rix:.2f} {r:.2f} 0 0 1 {T:.2f} {-r:.2f} Z"/></clipPath>')
    o.append(f'<g stroke="{hi}" stroke-width="0.7" opacity="0.30" clip-path="url(#nb{uid})">{"".join(th)}</g>')
    o.append(f'<ellipse cx="0" cy="0" rx="{rix:.2f}" ry="{r:.2f}" fill="none" stroke="{deep}" stroke-width="1"/>')
    return ''.join(o), T, R


def spanner(af_mm, S, uid, finish='galv'):
    """An open-end spanner, jaw opening left at TRUE across-flats. The
    jaw is the only dimension that matters here, so it is the only one
    taken from the standard; the handle is drawn to trade proportion."""
    af = af_mm * S
    b, hi, lo, deep = FINISH[finish]
    t = af * 0.40            # prong thickness
    hw = af / 2 + t          # head half-width
    jd = af * 0.85           # how far the mouth is open
    hh = af * 0.30           # handle half-width
    hl = af * 4.6
    d = (f'M{-jd:.2f} {-af/2:.2f} L{-jd:.2f} {-hw:.2f} L{af*0.55:.2f} {-hw:.2f} '
         f'Q{af*1.15:.2f} {-hw:.2f} {af*1.5:.2f} {-hh:.2f} L{hl:.2f} {-hh:.2f} '
         f'Q{hl+hh*1.4:.2f} {-hh:.2f} {hl+hh*1.4:.2f} 0 '
         f'Q{hl+hh*1.4:.2f} {hh:.2f} {hl:.2f} {hh:.2f} L{af*1.5:.2f} {hh:.2f} '
         f'Q{af*1.15:.2f} {hw:.2f} {af*0.55:.2f} {hw:.2f} L{-jd:.2f} {hw:.2f} '
         f'L{-jd:.2f} {af/2:.2f} L{af*0.42:.2f} {af/2:.2f} '
         f'A{af*0.30:.2f} {af*0.30:.2f} 0 0 0 {af*0.42:.2f} {-af/2:.2f} Z')
    o = [defs(uid, finish, '#1A1E23')]
    o.append(f'<g transform="rotate(-15)"><path d="{d}" fill="url(#cyl{uid})" '
             f'stroke="{deep}" stroke-width="0.9" stroke-linejoin="round"/>'
             f'<path d="{d}" fill="none" stroke="{hi}" stroke-width="0.8" opacity="0.30" '
             f'transform="translate(0,-1.2)"/></g>')
    return ''.join(o), hl + hh * 1.4 + jd, hw * 2


def screw(g, length_mm, S, uid, head='csk', finish='black', bg='#1A1E23'):
    """Wood/chipboard screw: head, tapered thread at trade pitch, gimlet
    point. dia comes from the gauge table; pitch is the joinery rule
    (about half the diameter on a coarse wood screw)."""
    d = g['dia']; p = d * 0.5
    Rm = d / 2 * S; Rn = Rm * 0.58
    L = length_mm * S
    b, hi, lo, deep = FINISH[finish]
    o = [defs(uid, finish, bg)]
    hd = d * 2.0 * S            # head diameter, the trade rule of thumb
    if head == 'csk':
        hh = (hd - 2 * Rm) / 2 * 0.9
        o.append(f'<path d="M0 {-hd/2:.2f} L{hh*0.30:.2f} {-hd/2:.2f} L{hh*1.5:.2f} {-Rm:.2f} '
                 f'L{hh*1.5:.2f} {Rm:.2f} L{hh*0.30:.2f} {hd/2:.2f} L0 {hd/2:.2f} Z" fill="url(#cyl{uid})"/>')
        hx = hh * 1.5
    elif head == 'pan':
        hh = hd * 0.36
        o.append(f'<path d="M{hh:.2f} {-hd/2:.2f} A{hh:.2f} {hd/2:.2f} 0 0 0 {hh:.2f} {hd/2:.2f} '
                 f'L{hh*1.1:.2f} {hd/2:.2f} L{hh*1.1:.2f} {-hd/2:.2f} Z" fill="url(#cyl{uid})"/>')
        hx = hh * 1.1
    else:  # truss -- wide and low, the shop's "Truss Head 4*19"
        hd = d * 2.7 * S; hh = hd * 0.20
        o.append(f'<path d="M{hh:.2f} {-hd/2:.2f} A{hh*1.6:.2f} {hd/2:.2f} 0 0 0 {hh:.2f} {hd/2:.2f} '
                 f'L{hh*1.25:.2f} {hd/2:.2f} L{hh*1.25:.2f} {-hd/2:.2f} Z" fill="url(#cyl{uid})"/>')
        hx = hh * 1.25
    body = L - hx - Rm * 2.4
    o.append(f'<rect x="{hx-1:.2f}" y="{-Rn:.2f}" width="{L*0.16:.2f}" height="{2*Rn:.2f}" fill="url(#cyl{uid})"/>')
    x0 = hx + L * 0.14
    o.append(_thread(x0, hx + body, Rm, Rn, p * S, uid, bg))
    # gimlet point
    px = hx + body
    o.append(f'<path d="M{px:.2f} {-Rm:.2f} L{px+Rm*2.4:.2f} 0 L{px:.2f} {Rm:.2f} Z" fill="url(#cyl{uid})"/>')
    n = 4
    for i in range(n):
        f = i / n
        o.append(f'<path d="M{px+Rm*2.4*f:.2f} {-Rm*(1-f):.2f} L{px+Rm*2.4*(f+0.22):.2f} {-Rm*(1-f-0.22):.2f} '
                 f'L{px+Rm*2.4*(f+0.30):.2f} {Rm*(1-f-0.30):.2f} L{px+Rm*2.4*(f+0.08):.2f} {Rm*(1-f):.2f} Z" '
                 f'fill="#000" opacity="0.35"/>')
    return ''.join(o), L + Rm * 2.4, max(hd / 2, Rm)


def wall_plug(size_mm, plug_len_mm, S, uid, sectioned=True):
    """The plug, in half section so the screw is seen biting it. The
    outside diameter IS the masonry drill size -- the one fact that
    stops a wobbling plug -- so it is drawn at exactly that."""
    colour = WALL_PLUGS.get(size_mm, '')
    b, hi, lo = PLUG_INK[colour]
    R = size_mm / 2 * S
    L = plug_len_mm * S
    o = [f'''<defs><linearGradient id="pl{uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{lo}"/><stop offset="14%" stop-color="{b}"/>
      <stop offset="40%" stop-color="{hi}"/><stop offset="62%" stop-color="{b}"/>
      <stop offset="100%" stop-color="{lo}"/></linearGradient></defs>''']
    collar = R * 0.30
    o.append(f'<path d="M0 {-R*1.18:.2f} L{collar:.2f} {-R*1.18:.2f} L{collar:.2f} {-R:.2f} '
             f'L{L-R*0.5:.2f} {-R*0.86:.2f} L{L:.2f} {-R*0.45:.2f} L{L:.2f} {R*0.45:.2f} '
             f'L{L-R*0.5:.2f} {R*0.86:.2f} L{collar:.2f} {R:.2f} L{collar:.2f} {R*1.18:.2f} L0 {R*1.18:.2f} Z" '
             f'fill="url(#pl{uid})"/>')
    # anti-rotation ribs, at a real spacing
    ribs = []
    x = collar + R * 0.7
    while x < L - R * 0.8:
        ribs.append(f'<path d="M{x:.2f} {-R*0.98:.2f} L{x+R*0.34:.2f} {-R*0.98:.2f} L{x+R*0.20:.2f} {-R*0.55:.2f} L{x-R*0.14:.2f} {-R*0.55:.2f} Z"/>')
        ribs.append(f'<path d="M{x:.2f} {R*0.98:.2f} L{x+R*0.34:.2f} {R*0.98:.2f} L{x+R*0.20:.2f} {R*0.55:.2f} L{x-R*0.14:.2f} {R*0.55:.2f} Z"/>')
        x += R * 0.78
    o.append(f'<g fill="#000" opacity="0.26">{"".join(ribs)}</g>')
    if sectioned:
        # the split, and the bore the screw drives into
        o.append(f'<path d="M{collar:.2f} {-R*0.30:.2f} L{L*0.94:.2f} {-R*0.16:.2f} L{L*0.94:.2f} {R*0.16:.2f} '
                 f'L{collar:.2f} {R*0.30:.2f} Z" fill="#000" opacity="0.45"/>')
    return ''.join(o), L, R * 1.18


def drill_bit(dia_mm, S, uid, length_mm=None, masonry=False):
    """A twist bit at true diameter -- helical flutes, and a carbide tip
    when it is the masonry bit that goes with a plug."""
    R = dia_mm / 2 * S
    L = (length_mm or dia_mm * 11) * S
    o = [defs(uid, 'galv' if masonry else 'zinc', '#1A1E23')]
    o.append(f'<rect x="0" y="{-R:.2f}" width="{L:.2f}" height="{2*R:.2f}" fill="url(#cyl{uid})"/>')
    step = R * 1.5
    fl = []
    x = R * 2
    while x < L - R:
        fl.append(f'<path d="M{x:.2f} {-R:.2f} L{x+step*0.5:.2f} {-R:.2f} L{x+step*0.5+R*1.1:.2f} {R:.2f} L{x+R*1.1:.2f} {R:.2f} Z"/>')
        x += step
    o.append(f'<g fill="#000" opacity="0.34">{"".join(fl)}</g>')
    if masonry:
        o.append(f'<path d="M{L:.2f} {-R:.2f} L{L+R*0.7:.2f} {-R*1.06:.2f} L{L+R*1.9:.2f} 0 '
                 f'L{L+R*0.7:.2f} {R*1.06:.2f} L{L:.2f} {R:.2f} Z" fill="#8E969B"/>')
    else:
        o.append(f'<path d="M{L:.2f} {-R:.2f} L{L+R*1.15:.2f} 0 L{L:.2f} {R:.2f} Z" fill="url(#cyl{uid})"/>')
    return ''.join(o), L + R * 2, R
