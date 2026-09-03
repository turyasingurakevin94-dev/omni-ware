# Emits the chart SVGs for both the Before and the proposed artboards.
# Hand-writing scatter coordinates is how a plot ends up lying about its
# own data, so every mark here is computed from the numbers below.
import math

WEEKS = ['W1','W2','W3','W4','W5','W6','W7','W8']
CASH_IN  = [8.4, 9.1, 7.2, 10.3, 8.8, 6.9, 7.4, 6.2]   # millions UGX
CASH_OUT = [7.1, 8.2, 8.0,  7.6, 9.4, 8.1, 9.0, 8.6]

UNITS = [412, 468, 501, 455, 523, 498, 470, 441]
REV   = [9.8, 11.2, 12.4, 11.0, 13.1, 12.2, 11.4, 10.6]

# name, weekly units (volume), margin %, profit (m UGX)
ITEMS = [
    ('Cement (Tororo 50kg)',        188, 18.2, 3.10),
    ('Iron Sheets (28g, plain)',    164,  9.2, 1.42),
    ('Steel Nails 3 inch',           96, 26.4, 1.05),
    ('PVC Pipe 1 inch',              74, 31.0, 0.94),
    ('Gloss Paint - White',          41, 34.5, 0.71),
    ('Barbed Wire',                  33, 29.8, 0.52),
    ('Wheelbarrows (heavy)',          4, 12.0, 0.06),
    ('Padlocks 60mm',                 9,  8.5, 0.05),
    ('Hinges 4 inch',                 6, 15.2, 0.04),
    ('Wire Nails 2 inch',            27, 22.0, 0.28),
    ('Roofing Nails',                58, 24.1, 0.44),
    ('Cement (Hima 50kg)',          121, 16.0, 1.60),
    ('Ceiling Boards',               12,  7.0, 0.03),
    ('Door Locks',                    8, 41.0, 0.12),
]

def esc(s): return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

def grouped_bars(w, h, palette):
    """Cash in vs cash out. palette = (in_colour, out_colour)."""
    L, R, T, B = 46, 8, 10, 22
    pw, ph = w - L - R, h - T - B
    top = 12.0
    slot = pw / len(WEEKS)
    bw = slot * 0.30
    o = []
    for g in (0, 3, 6, 9, 12):
        y = T + ph - (g / top) * ph
        o.append(f'<line x1="{L}" y1="{y:.1f}" x2="{w-R}" y2="{y:.1f}" stroke="#E3E7EA" stroke-width="1"/>')
        o.append(f'<text x="{L-7}" y="{y+3.5:.1f}" text-anchor="end" font-size="9.5" '
                 f'fill="#8A939C" font-family="IBM Plex Mono, monospace">{g}m</text>')
    for i, wk in enumerate(WEEKS):
        cx = L + slot * (i + 0.5)
        for v, col, off in ((CASH_IN[i], palette[0], -bw), (CASH_OUT[i], palette[1], 0)):
            bh = (v / top) * ph
            o.append(f'<rect x="{cx+off+1:.1f}" y="{T+ph-bh:.1f}" width="{bw-2:.1f}" '
                     f'height="{bh:.1f}" fill="{col}" rx="1"/>')
        o.append(f'<text x="{cx:.1f}" y="{h-7}" text-anchor="middle" font-size="9.5" '
                 f'fill="#8A939C" font-family="Inter, sans-serif">{wk}</text>')
    o.append(f'<line x1="{L}" y1="{T+ph}" x2="{w-R}" y2="{T+ph}" stroke="#CFD5DA" stroke-width="1"/>')
    return f'<svg class="ch" viewBox="0 0 {w} {h}" width="{w}" height="{h}">' + ''.join(o) + '</svg>'

def area(w, h, vals, colour, fmt):
    L, R, T, B = 42, 8, 10, 20
    pw, ph = w - L - R, h - T - B
    lo, hi = min(vals) * 0.88, max(vals) * 1.04
    def pt(i, v):
        return (L + pw * (i / (len(vals) - 1)), T + ph - ph * ((v - lo) / (hi - lo)))
    pts = [pt(i, v) for i, v in enumerate(vals)]
    line = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    fill = f'{L},{T+ph} ' + line + f' {L+pw},{T+ph}'
    o = [f'<line x1="{L}" y1="{T+ph}" x2="{w-R}" y2="{T+ph}" stroke="#CFD5DA" stroke-width="1"/>',
         f'<polygon points="{fill}" fill="{colour}" opacity=".13"/>',
         f'<polyline points="{line}" fill="none" stroke="{colour}" stroke-width="2" '
         f'stroke-linejoin="round" stroke-linecap="round"/>']
    for i, (x, y) in enumerate(pts):
        if i in (0, len(pts) - 1):
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.6" fill="{colour}"/>')
    o.append(f'<text x="{L-6}" y="{T+8}" text-anchor="end" font-size="9.5" fill="#8A939C" '
             f'font-family="IBM Plex Mono, monospace">{fmt(hi)}</text>')
    o.append(f'<text x="{L-6}" y="{T+ph}" text-anchor="end" font-size="9.5" fill="#8A939C" '
             f'font-family="IBM Plex Mono, monospace">{fmt(lo)}</text>')
    for i, wk in enumerate(WEEKS):
        x = L + pw * (i / (len(WEEKS) - 1))
        o.append(f'<text x="{x:.1f}" y="{h-6}" text-anchor="middle" font-size="9" '
                 f'fill="#8A939C" font-family="Inter, sans-serif">{wk}</text>')
    return f'<svg class="ch" viewBox="0 0 {w} {h}" width="{w}" height="{h}">' + ''.join(o) + '</svg>'

def quadrant(w, h, mode):
    """mode 'before' = four series colours (one off-palette, one the accent).
       mode 'after'  = position carries the meaning, one colour marks the
                       group the finding is actually about."""
    L, R, T, B = 34, 12, 12, 28
    pw, ph = w - L - R, h - T - B
    vmax, mmax = 200.0, 45.0
    vmid, mmid = 90.0, 20.0
    o = []
    o.append(f'<rect x="{L}" y="{T}" width="{pw}" height="{ph}" fill="#FFFFFF" stroke="#E3E7EA"/>')
    xm = L + pw * (vmid / vmax); ym = T + ph - ph * (mmid / mmax)
    o.append(f'<line x1="{xm:.1f}" y1="{T}" x2="{xm:.1f}" y2="{T+ph}" stroke="#CFD5DA" stroke-dasharray="3 3"/>')
    o.append(f'<line x1="{L}" y1="{ym:.1f}" x2="{L+pw}" y2="{ym:.1f}" stroke="#CFD5DA" stroke-dasharray="3 3"/>')
    if mode == 'after':
        for lb, x, y, an in (('Not worth the shelf', L+8, T+ph-10, 'start'),):
            o.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="{an}" font-size="10" fill="#8A939C" '
                     f'font-family="Inter, sans-serif" letter-spacing=".04em">{lb}</text>')
    for nm, vol, mg, prof in ITEMS:
        x = L + pw * (min(vol, vmax) / vmax)
        y = T + ph - ph * (min(mg, mmax) / mmax)
        r = 3.4 + math.sqrt(prof) * 3.0
        if mode == 'before':
            col = ('#1C6B58' if (vol >= vmid and mg >= mmid) else
                   '#3B82C4' if (vol >= vmid and mg < mmid) else
                   '#B23A26' if (vol < vmid and mg >= mmid) else '#7F1D1A')
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{col}" opacity=".82"/>')
        else:
            dead = vol < vmid and mg < mmid
            col, op = ('#7F1D1A', .9) if dead else ('#8A939C', .5)
            o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{col}" opacity="{op}"/>')
            # No labels on the dots: four of them sit within 30px of each
            # other and the names overlapped into an unreadable stack. The
            # column beside the chart names them, in money order.
    o.append(f'<text x="{L+pw/2:.1f}" y="{h-8}" text-anchor="middle" font-size="10" fill="#59626B" '
             f'font-family="Inter, sans-serif">Units sold in the window &#8594;</text>')
    o.append(f'<text transform="translate(13,{T+ph/2:.1f}) rotate(-90)" text-anchor="middle" '
             f'font-size="10" fill="#59626B" font-family="Inter, sans-serif">Margin kept &#8594;</text>')
    return f'<svg class="ch" viewBox="0 0 {w} {h}" width="{w}" height="{h}">' + ''.join(o) + '</svg>'

def sparkbars(w, h):
    """The cash bridge as it appears inside the open finding: net per week,
       one colour, the three losing weeks the sentence names picked out."""
    L, R, T, B = 40, 6, 8, 18
    pw, ph = w - L - R, h - T - B
    net = [i - o for i, o in zip(CASH_IN, CASH_OUT)]
    lim = 3.0
    zero = T + ph / 2
    slot = pw / len(WEEKS)
    o = [f'<line x1="{L}" y1="{zero:.1f}" x2="{w-R}" y2="{zero:.1f}" stroke="#CFD5DA" stroke-width="1"/>',
         f'<text x="{L-6}" y="{zero+3.5:.1f}" text-anchor="end" font-size="9" fill="#8A939C" '
         f'font-family="IBM Plex Mono, monospace">0</text>']
    for i, v in enumerate(net):
        x = L + slot * i + slot * 0.22
        bwid = slot * 0.56
        bh = abs(v) / lim * (ph / 2)
        y = zero - bh if v > 0 else zero
        col = '#1C6B58' if v > 0 else '#7F1D1A'
        o.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bwid:.1f}" height="{bh:.1f}" fill="{col}" rx="1"/>')
        o.append(f'<text x="{x+bwid/2:.1f}" y="{h-5}" text-anchor="middle" font-size="9" '
                 f'fill="#8A939C" font-family="Inter, sans-serif">{WEEKS[i]}</text>')
    return f'<svg class="ch" viewBox="0 0 {w} {h}" width="{w}" height="{h}">' + ''.join(o) + '</svg>'

W = lambda p, s: open(p, 'w').write(s)
W('_ch_bridge_before.svg', grouped_bars(1044, 200, ('#1C6B58', '#7F1D1A')))
W('_ch_units_before.svg',  area(500, 168, UNITS, '#3B82C4', lambda v: f'{v:.0f}'))
W('_ch_rev_before.svg',    area(500, 168, REV,   '#1C6B58', lambda v: f'{v:.1f}m'))
W('_ch_quad_before.svg',   quadrant(820, 340, 'before'))
W('_ch_quad_after.svg',    quadrant(430, 252, 'after'))
W('_ch_net_after.svg',     sparkbars(620, 118))
print('charts written')
