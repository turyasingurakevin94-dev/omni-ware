"""Directions B and C, and the phone."""
import geom, math
from parts import CSS, chrome, ruler, callout
from build import assembly, ROW, LEN, fit_cell, G8


def bench():
    """B - BENCH. Everything in this size laid out on one scale line, the
    way it would lie on the counter: the bolt, its washer, its nut, the
    spanner that turns it, the drills that make its holes. Below, the
    neighbouring sizes at true size, so 'M10' means something without a
    coin in the picture. Comparison-led rather than object-led."""
    W, H = 1440, 900
    S = 5.6
    BW, BH = 1172, 250
    x0 = 44; cy = 132
    svg, A = assembly(S, x0, cy, uid='b')
    lane1 = f'<svg width="{BW}" height="{BH}" style="position:absolute;inset:0">{svg}</svg>'
    cos = [
        callout(x0 + 12, cy - 55, 56, 'Bolt', 'M10 &#215; 75'),
        callout(A['washer'][0], A['washer'][1], 56, 'Washer', '20 / 10.5'),
        callout(A['nut'][0] + 6, A['nut'][1], 56, 'Nut', '8.4 thick'),
        callout(A['mid'][0], A['mid'][1], 196, 'Length under head', '75 mm', up=False, align='centre'),
    ]
    # the ladder: the same nut at every size the shop keeps, at TRUE size,
    # so the step from M10 to M12 is a thing the eye can settle rather
    # than a number to be trusted.
    nb, nx = [], 22
    for sz, live in (('M6', 0), ('M8', 0), ('M10', 1), ('M12', 0), ('M16', 0)):
        r0 = geom.BOLT[sz]
        n, nt, nr = geom.hex_nut(r0, S, 'nb' + sz, finish='zinc' if live else 'galv')
        cxx = nx + nr
        nb.append(f'<g transform="translate({cxx:.0f},58)" opacity="{1 if live else 0.38}">{n}</g>')
        nb.append(f'<text x="{cxx + nt / 2:.0f}" y="128" text-anchor="middle" '
                  f'fill="{"#E4EAEF" if live else "#5E6B76"}" font-size="12.5" '
                  f'font-family="IBM Plex Mono, monospace" font-weight="{600 if live else 400}">{sz}</text>')
        nb.append(f'<text x="{cxx + nt / 2:.0f}" y="145" text-anchor="middle" '
                  f'fill="{"#8FA3B2" if live else "#4B5762"}" font-size="10.5" '
                  f'font-family="Inter, sans-serif">{r0["afIso"]} mm spanner</text>')
        nx += nr * 2 + nt + 48
    lane2 = ('<div class="vp" style="height:172px;flex:none">'
             '<div class="vp-grid"></div>'
             f'<svg width="{BW}" height="172" style="position:absolute;inset:0">{"".join(nb)}</svg>'
             '<div class="co" style="left:16px;bottom:12px"><div class="co-l">The ladder &#8212; every size the shop keeps, at true size</div></div>'
             '<div class="co" style="right:16px;bottom:12px"><div class="co-l" style="color:#4B5762">'
             'nuts shown &#183; same scale as above</div></div></div>')
    band = ('<div class="vp" style="height:%dpx;flex:none">'
            '<div class="vp-grid"></div><div class="vp-glow"></div>%s%s'
            '<div class="vp-bar"><div class="vp-lab">M10 &#215; 75 &#183; bolt, washer and nut</div>'
            '<div class="vp-lab" style="color:#4B5762">one scale throughout &#183; 1&#8202;:&#8202;1.8</div>'
            '<div class="vp-seg"><span class="on">Exploded</span><span>Assembled</span></div></div>%s</div>'
            ) % (BH, lane1, ''.join(cos), ruler(BW - 28, S))

    def r(l, v, n=''):
        extra = '' if not n else ' <span style="color:var(--ink400)">&#183; %s</span>' % n
        return '<div class="sp"><span>%s%s</span><b>%s</b></div>' % (l, extra, v)
    left = ('<div class="pan" style="width:326px;flex:none">'
            '<div class="pan-h"><span class="pan-t">What it takes</span></div>'
            '<div class="pan-b" style="padding-top:7px">'
            + r('Spanner', '17 mm', 'ISO and DIN agree')
            + r('Socket', '17 mm')
            + r('Tap drill', '8.5 mm', 'to cut the thread')
            + r('Clearance drill', '11 mm', 'to pass through')
            + r('Torque', '47&#8211;56 N&#183;m', 'grade 8.8, dry')
            + r('Imperial nearest', '3/8&#8221;&#8211;16 UNC')
            + r('Head height', '6.4 mm')
            + r('Nut height', '8.4 mm')
            + r('Washer thickness', '2.0 mm')
            + '<p class="note" style="margin:10px 0 0">Held here as <b>M10*75</b> and <b>10x75</b>; both are counted.</p>'
            + '</div></div>')
    rows = ''.join(
        '<tr class="%s"><td><b>%s</b></td><td><b>%s</b></td><td><b>%s</b></td><td><b>%s</b></td>'
        '<td><b>%s / %s</b></td><td><b>%s</b></td><td><b>%s</b></td></tr>'
        % ('on' if x['size'] == 'M10' else '', x['size'], x['pitch'], x['afIso'], x['afDin'],
           x['washerOd'], x['washerId'], x['tapDrill'], x['clearDrill'])
        for x in geom.METRIC_BOLTS[2:9])
    mid = ('<div class="pan" style="flex:1;min-width:0">'
           '<div class="pan-h"><span class="pan-t">Metric bolts</span>'
           '<span class="pan-n">ISO 4017 / DIN 933 &#183; mm</span></div>'
           '<table class="tbl"><thead><tr><th>Size</th><th>Pitch</th><th>Spanner ISO</th>'
           '<th>Spanner DIN</th><th>Washer OD/ID</th><th>Tap</th><th>Clear</th></tr></thead>'
           '<tbody>' + rows + '</tbody></table></div>')
    right = ('<div class="pan" style="width:292px;flex:none">'
             '<div class="pan-h"><span class="pan-t">On the shelf</span><span class="pan-n">2 spellings</span></div>'
             '<div class="pan-b" style="display:flex;flex-direction:column;gap:8px;flex:1">'
             '<div style="display:flex;align-items:baseline;gap:9px">'
             '<span class="mono" style="font-size:23px;font-weight:500">328</span>'
             '<span style="font-size:11.5px;color:var(--ink600)">pcs &#183; <b class="mono">M10*75</b>, <b class="mono">10x75</b></span></div>'
             '<div class="sp" style="border-bottom:1px solid var(--ruleSoft)"><span>Each</span><b>UGX 1,250</b></div>'
             '<div class="sp"><span>Per 100 &#183; 4.1 kg</span><b>UGX 108,000</b></div>'
             '<div style="display:flex;gap:7px;margin-top:auto">'
             '<span class="btn btn-accent">Add to the sale</span>'
             '<span class="btn">+ nut &amp; washer</span></div></div></div>')
    body = ('<div class="app" style="width:%d;height:%dpx">' % (W, H)).replace('width:%d' % W, 'width:%dpx' % W) + chrome() + '''
  <div class="main">
    <div class="ph"><div><h1 class="ph-t">Fastener guide</h1></div>
      <p class="ph-sub">One size, everything it needs, all at the same scale.</p>
      <div class="ph-sp"></div>
      <div class="sel" style="width:330px;height:34px;font-size:13px;color:var(--ink400)">
        <svg viewBox="0 0 24 24" style="width:15px;height:15px;margin-right:7px;stroke:var(--ink400);fill:none;stroke-width:2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        Type a size &#8212; M8, #8, 38mm, 1 1/2, 13&#8230;</div>
    </div>
    ''' + band + lane2 + '''
    <div style="display:flex;gap:12px;align-items:stretch;flex:1;min-height:0">''' + left + mid + right + '''</div>
  </div>
</div>'''
    return body, W, H


def answer():
    """C - ANSWER. The sentence comes first, in words, because a sentence is
    what gets said out loud across the counter. The render is the proof
    beside it -- drawn upright in a tall card -- not the headline."""
    W, H = 1440, 900
    S = 3.75
    CW, CH = 396, 560
    svg, A = assembly(S, 0, 0, uid='c')
    Y0, CX = 58, CW / 2 - 4

    def rot(p):
        return (CX - p[1], Y0 + p[0])
    up = '<g transform="translate(%.0f,%d) rotate(90)">%s</g>' % (CX, Y0, svg)
    hx, hy = rot(A['head']); wx, wy = rot(A['washer']); nx, ny = rot(A['nut'])
    px, py = rot(A['pitch']); dx, dy = rot(A['dia'])
    cos = [
        callout(hx + 16, hy, hy - 26, 'Head', '17 mm AF'),
        callout(dx - 16, dy, dy + 26, 'Diameter', '10.00 mm', align='right'),
        callout(px + 16, py, py - 26, 'Pitch', '1.50 mm'),
        callout(wx - 16, wy, wy - 30, 'Washer', '20 / 10.5', align='right'),
        callout(nx + 16, ny, ny - 30, 'Nut', 'M10 &#215; 1.5'),
    ]
    card = ('<div class="vp" style="width:%dpx;height:%dpx;flex:none">'
            '<div class="vp-grid"></div><div class="vp-glow"></div>'
            '<svg width="%d" height="%d" style="position:absolute;inset:0">%s</svg>%s'
            '<div class="vp-bar"><div class="vp-lab">M10 &#215; 75 &#183; bright zinc</div>'
            '<div class="vp-seg"><span class="on">Exploded</span><span>Assembled</span></div></div>'
            '<div class="co" style="right:12px;bottom:10px"><div class="co-l" style="color:#4B5762">'
            'to scale &#183; 1&#8202;:&#8202;2.7</div></div>'
            '</div>') % (CW, CH, CW, CH, up, ''.join(cos))

    def big(l, v, n):
        return ('<div style="flex:1;padding:12px 16px;border-left:1px solid var(--ruleSoft)">'
                '<div class="fld-l" style="margin-bottom:5px">%s</div>'
                '<div class="mono" style="font-size:25px;font-weight:500;line-height:1.04">%s</div>'
                '<div style="font-size:11px;color:var(--ink600);margin-top:5px">%s</div></div>') % (l, v, n)
    rows = ''.join(
        '<tr class="%s"><td><b>%s</b></td><td><b>%s</b></td><td>%s</td><td><b>%s</b></td>'
        '<td><b>%s</b></td><td><b>%s / %s</b></td><td><b>%s</b></td><td><b>%s</b></td></tr>'
        % ('on' if x['size'] == 'M10' else '', x['size'], x['pitch'],
           {'M10': '1.25 &#183; 1.0', 'M12': '1.5 &#183; 1.25', 'M8': '1.0', 'M6': '0.75'}.get(x['size'], '&#8212;'),
           x['afIso'], x['afDin'], x['washerOd'], x['washerId'], x['tapDrill'], x['clearDrill'])
        for x in geom.METRIC_BOLTS[2:10])
    body = '<div class="app" style="width:%dpx;height:%dpx">' % (W, H) + chrome() + '''
  <div class="main">
    <div class="ph"><div><h1 class="ph-t">Fastener guide</h1></div>
      <p class="ph-sub">Ask it the way it was said to you.</p><div class="ph-sp"></div></div>
    <div class="sel" style="height:46px;font-size:16px;font-weight:600;flex:none">
      <svg viewBox="0 0 24 24" style="width:17px;height:17px;margin-right:9px;stroke:var(--ink400);fill:none;stroke-width:2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <span class="mono">M10 x 75</span>
      <span style="margin-left:14px;font-size:11.5px;font-weight:400;color:var(--ink400)">read as a metric bolt, 75&#8202;mm long &#8212; not a 75&#8202;mm pitch</span>
      <span class="cp mg" style="margin-left:auto">one reading</span></div>
    <div style="display:flex;gap:14px;align-items:stretch;flex:1;min-height:0">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:12px">
        <div class="pan" style="flex:none">
          <div class="pan-b" style="padding:14px 16px 2px">
            <p style="margin:0;font-size:20px;font-weight:600;line-height:1.4;max-width:54ch">
              An <span class="mono">M10</span> takes a <span class="mono">17&#8202;mm</span> spanner, an <span class="mono">11&#8202;mm</span> hole to pass through and an <span class="mono">8.5&#8202;mm</span> hole to tap.</p>
            <p class="note" style="margin:9px 0 0">ISO and DIN agree at M10, so one spanner turns both. They part company at M12, M14 and M22 &#8212; the chart says which.</p>
          </div>
          <div style="display:flex;border-top:1px solid var(--ruleSoft);margin-top:12px">''' \
        + big('Spanner', '17 mm', 'ISO 4017 and DIN 933') \
        + big('Clearance', '11 mm', 'ISO 273, medium fit') \
        + big('Tap drill', '8.5 mm', 'stock bit; exact is 8.50') \
        + big('Washer', '20 / 10.5', '&#215; 2.0 thick, ISO 7089') + '''
          </div>
        </div>
        <div class="pan" style="flex:1;min-height:0">
          <div class="pan-h"><span class="pan-t">Metric bolts</span><span class="pan-n">mm</span></div>
          <table class="tbl">
            <thead><tr><th>Size</th><th>Pitch</th><th>Fine pitches</th><th>ISO</th><th>DIN</th><th>Washer OD/ID</th><th>Tap</th><th>Clear</th></tr></thead>
            <tbody>''' + rows + '''</tbody></table>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;flex:none">''' + card + '''
        <div class="pan" style="flex:1">
          <div class="pan-b" style="display:flex;align-items:center;gap:12px;padding:12px 14px;height:100%">
            <div><div class="fld-l">On the shelf</div>
              <div style="display:flex;align-items:baseline;gap:7px;margin-top:3px">
                <span class="mono" style="font-size:21px;font-weight:500">328</span>
                <span style="font-size:11.5px;color:var(--ink600)">pcs &#183; UGX 1,250 each</span></div></div>
            <span class="btn btn-accent" style="margin-left:auto">Add to the sale</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>'''
    return body, W, H


def phone():
    """The phone is its own design, not a squeezed console. Its headline is
    the thing only a phone can do: hold the customer's bolt against the
    glass. The render is at 1:1 -- 3.78 css px to the millimetre -- and the
    ruler along the bottom is a real ruler."""
    W, H = 390, 844
    S = 3.7795            # 1 mm at 96 css px per inch
    VPW, VPH = 358, 286
    x0 = 14; cy = 150
    _b, _bl, _br = geom.hex_bolt(ROW, LEN, S, 'pb', bg='#171B20')
    svg = '<g transform="translate(%d,%d)">%s</g>' % (x0, cy, _b)
    hw = geom.HEAD_K[ROW['dia']] * S
    A = {'mid': (x0 + hw + LEN * S / 2, cy + ROW['dia'] / 2 * S)}
    cos = [
        callout(x0 + 12, cy - 38, 46, 'Head', '17 mm'),
        callout(A['mid'][0], A['mid'][1], 196, '75 mm under head', '', up=False, align='centre'),
    ]
    stepper = ('<div style="position:absolute;left:0;right:0;bottom:0;height:46px;display:flex;'
               'align-items:center;gap:1px;background:rgba(10,13,16,.72);border-top:1px solid var(--vpLine)">'
               '<div style="flex:1;text-align:center;font-size:13px;color:#6E7B87;padding:12px 0">M8</div>'
               '<div style="flex:1.4;text-align:center;background:#2A333C;color:#fff;font-weight:600;'
               'font-size:15px;padding:11px 0;font-family:var(--mono)">M10</div>'
               '<div style="flex:1;text-align:center;font-size:13px;color:#6E7B87;padding:12px 0">M12</div>'
               '<div style="flex:1;text-align:center;font-size:13px;color:#6E7B87;padding:12px 0">M16</div>'
               '</div>')
    vp = ('<div class="vp" style="height:%dpx;flex:none">'
          '<div class="vp-grid"></div><div class="vp-glow"></div>'
          '<svg width="%d" height="%d" style="position:absolute;inset:0">%s</svg>%s'
          '<div class="vp-bar" style="height:30px"><div class="vp-lab">M10 &#215; 75</div>'
          '<div style="margin-left:auto;display:flex;align-items:center;gap:5px;background:#2A333C;'
          'border-radius:5px;padding:3px 8px"><span style="width:5px;height:5px;border-radius:50%%;'
          'background:#7FD1B9"></span><span class="co-v" style="font-size:11px">1 : 1</span></div></div>'
          '%s%s</div>') % (VPH, VPW, VPH, svg, ''.join(cos),
                           ruler(VPW - 24, S).replace('bottom:52px', 'bottom:58px'), stepper)

    def tile(l, v, n):
        return ('<div style="flex:1;min-width:0;background:var(--paper);border:1px solid var(--ruleSoft);'
                'border-radius:8px;padding:11px 13px">'
                '<div class="fld-l" style="margin-bottom:4px">%s</div>'
                '<div class="mono" style="font-size:22px;font-weight:500;line-height:1.05">%s</div>'
                '<div style="font-size:11.5px;color:var(--ink600);margin-top:4px">%s</div></div>') % (l, v, n)
    TABS = [('Today', 'M6 18a6 6 0 0112 0zM12 3v3M3 12h3M18 12h3'),
            ('Sell', 'M20.6 13.4L12 22 2 12V2h10z'),
            ('Money', 'M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'),
            ('Guide', 'M12 3v18M8.5 6.5h7M8.5 17.5h7'),
            ('More', 'M4 7h16M4 12h16M4 17h16')]
    tabs = ''.join(
        '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;'
        'color:%s"><svg viewBox="0 0 24 24" style="width:23px;height:23px;fill:%s;stroke:currentColor;'
        'stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><path d="%s"/></svg>'
        '<span style="font-size:10.5px;font-weight:%d">%s</span></div>'
        % ('var(--oxide)' if n == 'Guide' else 'var(--ink400)',
           'currentColor' if n == 'Guide' else 'none', d, 600 if n == 'Guide' else 500, n)
        for n, d in TABS)

    body = ('<div class="app" style="width:%dpx;height:%dpx">' % (W, H)) + '''
  <div style="position:absolute;top:0;left:0;right:0;height:44px;background:var(--navy);
    display:flex;align-items:center;gap:10px;padding:0 14px;color:#fff;z-index:3">
    <div class="brand-mark" style="width:26px;height:26px;border-radius:7px;font-size:10px">OW</div>
    <div class="tag" style="font-family:'Archivo Black',sans-serif;font-size:13.5px">OMNIWARE</div>
    <div style="flex:1"></div>
    <svg class="tb-ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
  </div>
  <div style="position:absolute;top:44px;left:0;right:0;bottom:60px;padding:14px 16px 16px;
    display:flex;flex-direction:column;gap:11px;overflow:hidden">
    <div>
      <h1 style="font-family:'Archivo Black',sans-serif;font-size:26px;margin:0;letter-spacing:-.02em">Fastener guide</h1>
      <p style="margin:3px 0 0;font-size:13px;color:var(--ink600)">Hold the customer&#8217;s bolt on the glass.</p>
    </div>
    <div class="sel" style="height:46px;font-size:15px;color:var(--ink400);flex:none">
      <svg viewBox="0 0 24 24" style="width:17px;height:17px;margin-right:9px;stroke:var(--ink400);fill:none;stroke-width:2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      M8, #8, 38mm, 1 1/2, 13&#8230;</div>
    ''' + vp + '''
    <p class="note" style="margin:0;font-size:12px">Lay the bolt along the drawing and step the size until the
      threads line up. Calibrated once, on this phone.</p>
    <div style="display:flex;gap:9px">''' + tile('Spanner', '17 mm', 'ISO and DIN agree') + tile('Clearance', '11 mm', 'to pass through') + '''</div>
    <div style="display:flex;gap:9px">''' + tile('Tap drill', '8.5 mm', 'to cut the thread') + tile('Nut &amp; washer', 'M10', '20 / 10.5 &#215; 2') + '''</div>
    <div style="display:flex;align-items:center;gap:11px;margin-top:auto">
      <div style="min-width:0">
        <div class="fld-l">On the shelf</div>
        <div style="display:flex;align-items:baseline;gap:6px;margin-top:2px">
          <span class="mono" style="font-size:20px;font-weight:500">328</span>
          <span style="font-size:12px;color:var(--ink600)">pcs &#183; 1,250 each</span></div>
      </div>
      <span class="btn btn-accent" style="margin-left:auto;height:44px;padding:0 18px;font-size:14px">Add to the sale</span>
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:60px;background:var(--paper);
    border-top:1px solid var(--rule);display:flex;align-items:center;padding-top:2px">''' + tabs + '''</div>
</div>'''
    return body, W, H


def screws():
    """The other family, in the winning layout: a gauge-8 screw, the plug
    it fits shown in section so the bite is visible, and the masonry bit
    that makes the hole -- all at one scale. Finish is not decoration
    here: 'black' and 'gold' is how the customer names the screw."""
    W, H = 1440, 900
    VPW, VPH = 676, 402
    S = 7.6                       # a #8 screw is small; the scale says so
    g, LEN_S = G8, 50
    cy = 150
    sc, scl, sch = geom.screw(g, LEN_S, S, 'sc', head='csk', finish='black', bg='#171B20')
    plug_len = 30
    pl, pll, plh = geom.wall_plug(g['plugMm'], plug_len, S, 'pl')
    db, dbl, dbr = geom.drill_bit(g['plugMm'], S, 'db', length_mm=30, masonry=True)
    x0 = 34
    px = x0 + 34
    svg = (f'<svg width="{VPW}" height="{VPH}" style="position:absolute;inset:0">'
           f'<g transform="translate({x0},{cy})">{sc}</g>'
           f'<g transform="translate({px},{cy + 122})">{pl}</g>'
           f'<g transform="translate({px + pll + 54},{cy + 122})">{db}</g></svg>')
    cos = [
        callout(x0 + 14, cy - sch, 58, 'Head', 'Countersunk'),
        callout(x0 + scl * 0.48, cy + g['dia'] / 2 * S, 226, 'Shank', '4.2 mm &#183; a number 8', up=False),
        callout(x0 + scl - 30, cy - g['dia'] / 2 * S, 58, 'Length', '50 mm &#183; 2&#8221;', align='right'),
        callout(px + 16, cy + 122 + plh, 322, 'Red plug', '6 mm &#183; drill 6 mm', up=False),
        callout(px + pll + 84, cy + 122 + dbr, 322, 'Masonry bit', '6 mm', up=False),
    ]
    vp = ('<div class="vp" style="height:%dpx">'
          '<div class="vp-grid"></div><div class="vp-glow"></div>%s%s'
          '<div class="vp-bar"><div class="vp-lab">Wood screw &#183; #8 &#215; 50 &#183; black phosphate</div>'
          '<div class="vp-lab" style="color:#4B5762">to scale &#183; 2.4&#8202;:&#8202;1</div>'
          '<div class="vp-seg"><span>Screw</span><span class="on">With plug</span><span>Section</span></div></div>'
          '<div class="co" style="left:16px;bottom:14px"><div class="co-l" style="color:#4B5762">'
          'plug shown in section &#8212; the screw bites the ribs, not the wall</div></div>'
          '</div>') % (VPH, svg, ''.join(cos))

    cfg = ('<div class="pan" style="width:212px;flex:none">'
           '<div class="pan-h"><span class="pan-t">Configure</span></div>'
           '<div class="pan-b" style="display:flex;flex-direction:column;gap:11px">'
           '<div class="fld"><span class="fld-l">Type</span><div class="sel">Wood screw'
           '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div></div>'
           '<div class="fld"><span class="fld-l">Gauge</span><div class="chips">'
           '<span class="chip">#6</span><span class="chip on">#8</span><span class="chip">#10</span><span class="chip">#12</span></div></div>'
           '<div class="fld"><span class="fld-l">Head</span><div class="chips">'
           '<span class="chip on">Csk</span><span class="chip">Pan</span><span class="chip">Truss</span></div></div>'
           '<div class="fld"><span class="fld-l">Length</span><div class="chips">'
           '<span class="chip">25</span><span class="chip">38</span><span class="chip on">50</span><span class="chip">75</span></div></div>'
           '<div class="fld"><span class="fld-l">Finish</span><div class="sw">'
           '<i style="background:linear-gradient(135deg,#F4F7F9,#79828A)"></i>'
           '<i class="on" style="background:linear-gradient(135deg,#7C848B,#14171B)"></i>'
           '<i style="background:linear-gradient(135deg,#F6E2A6,#8A6519)"></i>'
           '<i style="background:linear-gradient(135deg,#D9DEE1,#5C6366)"></i></div>'
           '<span style="font-size:11px;color:var(--ink600)">Black phosphate &#8212; the black screw</span></div>'
           '<div class="fld"><span class="fld-l">Shown with</span><div class="chips">'
           '<span class="chip on">Wall plug</span><span class="chip on">Drill</span></div></div>'
           '</div></div>')

    def sp(l, v):
        return '<div class="sp"><span>%s</span><b>%s</b></div>' % (l, v)
    spec = ('<div class="pan" style="width:272px;flex:none">'
            '<div class="pan-h"><span class="pan-t">Every dimension</span><span class="pan-n mono">mm</span></div>'
            '<div class="pan-b" style="padding-top:6px">'
            '<div class="sp-sec">The screw</div>'
            + sp('Gauge', '#8') + sp('Diameter', '4.20') + sp('Length', '50 &#183; 2&#8221;')
            + sp('Head diameter', '8.4')
            + '<div class="sp-sec">Into timber</div>'
            + sp('Pilot, softwood', '2.00') + sp('Pilot, hardwood', '3.00') + sp('Clearance', '4.50')
            + '<div class="sp-sec">Into masonry</div>'
            + sp('Wall plug', '6 &#183; red') + sp('Masonry drill', '6.00')
            + sp('Plug takes', '#6 &#8211; #10')
            + '<div class="sp-sec">Also called</div>'
            + sp('Metric naming', '4.2 &#215; 50') + sp('Chipboard naming', '4 &#215; 50')
            + '</div></div>')

    fit = ('<div class="pan" style="flex:1">'
           '<div class="pan-h"><span class="pan-t">What it needs</span>'
           '<span class="pan-n">the hole decides, not the screw</span></div>'
           '<div class="pan-b" style="display:flex;gap:0;padding:12px 0 14px">'
           + fit_cell('Masonry drill', '6 mm', 'the plug size is the bit', 'good')
           + fit_cell("Pilot, soft", "2 mm", "pine, cypress", "")
           + fit_cell('Pilot, hard', '3 mm', 'mvule splits &#8212; go bigger', 'warn')
           + fit_cell("Driver", "PZ2", "PH2 will cam out", "")
           + '</div>'
           '<p class="note" style="margin:0 12px 12px">A 6 mm plug in a 7 mm hole spins and pulls out. '
           'The colour is only a nickname &#8212; makers differ; the millimetre is the fact.</p></div>')

    shop = ('<div class="pan" style="width:352px;flex:none">'
            '<div class="pan-h"><span class="pan-t">On the shelf</span>'
            '<span class="pan-n">4 spellings counted</span></div>'
            '<div class="pan-b" style="display:flex;flex-direction:column;gap:9px;flex:1">'
            '<div style="display:flex;align-items:baseline;gap:9px">'
            '<span class="mono" style="font-size:24px;font-weight:500">4,120</span>'
            '<span style="font-size:11.5px;color:var(--ink600)">pcs &#183; <b class="mono">8*2</b>, '
            '<b class="mono">4.2*50</b>, <b class="mono">4*50</b></span></div>'
            '<div class="sp" style="border-bottom:1px solid var(--ruleSoft)"><span>Per 100</span><b>UGX 9,800</b></div>'
            '<div class="sp" style="border-bottom:1px solid var(--ruleSoft)"><span>Per kg &#183; 168 pcs</span><b>UGX 15,400</b></div>'
            '<div class="sp"><span>Red plugs &#183; 6 mm</span><b>930 pcs</b></div>'
            '<div style="display:flex;gap:7px;margin-top:auto">'
            '<span class="btn btn-accent">Add to the sale</span>'
            '<span class="btn">With plugs</span></div></div></div>')

    body = ('<div class="app" style="width:%dpx;height:%dpx">' % (W, H)) + chrome() + '''
  <div class="main">
    <div class="ph"><div><h1 class="ph-t">Fastener guide</h1></div>
      <p class="ph-sub">Hold the size on screen, read the fit off it.</p>
      <div class="ph-sp"></div>
      <div class="sel" style="width:330px;height:34px;font-size:13px;color:var(--ink400)">
        <svg viewBox="0 0 24 24" style="width:15px;height:15px;margin-right:7px;stroke:var(--ink400);fill:none;stroke-width:2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        Type a size &#8212; M8, #8, 38mm, 1 1/2, 13&#8230;</div>
    </div>
    <div style="display:flex;gap:12px;align-items:stretch">''' + cfg + '''
      <div style="flex:1;min-width:0">''' + vp + '''</div>''' + spec + '''
    </div>
    <div style="display:flex;gap:12px;align-items:stretch;flex:1;min-height:0">''' + fit + shop + '''</div>
  </div>
</div>'''
    return body, W, H
