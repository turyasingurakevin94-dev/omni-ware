#!/usr/bin/env python3
"""Four directions for the fastener guide. The chrome, the data and the
render engine are IDENTICAL in all of them -- only the way the render and
the answers are arranged changes, so the comparison is fair."""
import os, math, geom, parts
from parts import HEAD, CSS, chrome, ruler, callout
HERE = os.path.dirname(os.path.abspath(__file__))

ROW = geom.BOLT['M10']; LEN = 75; STD = 'iso'
G8 = geom.GAUGE[8]


def mm(v):
    s = f'{v:g}'
    return s


def assembly(S, x0, cy, finish='zinc', uid='a', neighbours=False):
    """The bolt, its washer and its nut on one axis, to one scale.
    Returns (svg_inner, anchors) with anchors in viewport pixels."""
    b, bl, br = geom.hex_bolt(ROW, LEN, S, uid + 'b', finish=finish, bg='#171B20', std=STD)
    w, wt, wr = geom.washer(ROW, S, uid + 'w', finish=finish)
    n, nt, nr = geom.hex_nut(ROW, S, uid + 'n', finish=finish, std=STD)
    hw = geom.HEAD_K[ROW['dia']] * S
    end = x0 + bl
    wx = end + wr * 0.55 + 16
    nx = wx + wt + nr * 0.62 + 26
    g = [f'<g transform="translate({x0},{cy})">{b}</g>',
         f'<g transform="translate({wx:.1f},{cy})">{w}</g>',
         f'<g transform="translate({nx:.1f},{cy})">{n}</g>']
    anchors = dict(
        head=(x0 + hw * 0.45, cy - br), washer=(wx, cy - wr), nut=(nx + nt * 0.4, cy - nr),
        dia=(x0 + hw + 14, cy + ROW['dia'] / 2 * S), mid=(x0 + hw + (LEN * S) / 2, cy + ROW['dia'] / 2 * S),
        pitch=(x0 + hw + LEN * S * 0.86, cy + ROW['dia'] / 2 * S),
        right=nx + nt + nr * 0.6, bolt_end=end)
    if neighbours:
        for i, (sz, dx) in enumerate((('M8', 0), ('M12', 0))):
            pass
    return ''.join(g), anchors


def vp_bar(views=('Assembly', 'Exploded', 'Section')):
    seg = ''.join(f'<span class="{"on" if i == 1 else ""}">{v}</span>' for i, v in enumerate(views))
    return (f'<div class="vp-bar"><div class="vp-lab">Hex bolt · M10 &#215; 75 · full thread</div>'
            f'<div class="vp-seg">{seg}</div></div>')


TOOLS = ['M12 3a9 9 0 109 9M12 3v4M12 3l4 2', 'M6 12h12M12 6v12', 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4',
         'M3 12h18M12 3v18']


def vp_tools(active=0):
    return ('<div class="vp-tools">' + ''.join(
        f'<i class="{"on" if i == active else ""}"><svg viewBox="0 0 24 24"><path d="{d}"/></svg></i>'
        for i, d in enumerate(TOOLS)) + '</div>')


# ---------------------------------------------------------------- A
def workbench():
    """A - WORKBENCH. The render is the page. Everything else is a margin
    note around it: what to turn it with, what it costs, what is on the
    shelf. Closest to the reference, and the most 'look at the thing'."""
    W, H = 1440, 900
    VPW, VPH = 676, 402
    S = 5.4
    x0 = 38; cy = 198
    svg, A = assembly(S, x0, cy, uid='a')
    cos = [
        callout(A['head'][0], A['head'][1], 60, 'Head', 'Hex &#183; 17 mm AF'),
        callout(A['washer'][0], A['washer'][1], 60, 'Flat washer', '20 / 10.5 &#215; 2', align='centre'),
        callout(A['nut'][0] + 6, A['nut'][1] + 90, 262, 'Nut', 'M10 &#215; 1.5', align='right', up=False),
        callout(A['dia'][0], A['dia'][1], 262, 'Diameter', '10.00 mm', up=False),
        callout(A['mid'][0], A['mid'][1], 296, 'Length under head', '75 mm', up=False, align='centre'),
        callout(A['pitch'][0], A['pitch'][1], 262, 'Pitch', '1.50 mm', up=False, align='centre'),
    ]
    vp = f'''<div class="vp" style="height:{VPH}px">
        <div class="vp-grid"></div><div class="vp-glow"></div>
        <svg width="{VPW}" height="{VPH}" style="position:absolute;inset:0">{svg}</svg>
        {''.join(cos)}
        {vp_bar()}
        {ruler(VPW - 28, S)}
        {vp_tools(2)}
      </div>'''

    cfg = f'''<div class="pan" style="width:212px;flex:none">
      <div class="pan-h"><span class="pan-t">Configure</span></div>
      <div class="pan-b" style="display:flex;flex-direction:column;gap:11px">
        <div class="fld"><span class="fld-l">Type</span><div class="sel">Hex bolt<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div></div>
        <div class="fld"><span class="fld-l">Size</span><div class="sel"><span class="mono">M10</span><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></div></div>
        <div class="fld"><span class="fld-l">Thread</span><div class="chips"><span class="chip on">Coarse 1.5</span><span class="chip">1.25</span><span class="chip">1.0</span></div></div>
        <div class="fld"><span class="fld-l">Length</span><div class="chips"><span class="chip">50</span><span class="chip on">75</span><span class="chip">100</span><span class="chip">150</span></div></div>
        <div class="fld"><span class="fld-l">Finish</span><div class="sw">
          <i class="on" style="background:linear-gradient(135deg,#F4F7F9,#79828A)"></i>
          <i style="background:linear-gradient(135deg,#7C848B,#14171B)"></i>
          <i style="background:linear-gradient(135deg,#F6E2A6,#8A6519)"></i>
          <i style="background:linear-gradient(135deg,#D9DEE1,#5C6366)"></i>
        </div><span style="font-size:11px;color:var(--ink600)">Bright zinc</span></div>
        <div class="fld"><span class="fld-l">Shown with</span><div class="chips">
          <span class="chip on">Nut</span><span class="chip on">Washer</span><span class="chip">Spring</span></div></div>
      </div>
    </div>'''

    def sp(l, v):
        return f'<div class="sp"><span>{l}</span><b>{v}</b></div>'
    spec = f'''<div class="pan" style="width:272px;flex:none">
      <div class="pan-h"><span class="pan-t">Every dimension</span><span class="pan-n mono">mm</span></div>
      <div class="pan-b" style="padding-top:6px">
        <div class="sp-sec">Bolt</div>
        {sp('Nominal diameter','10.00')}{sp('Thread pitch, coarse','1.50')}
        {sp('Across flats &#8212; ISO','17')}{sp('Across flats &#8212; DIN','17')}
        {sp('Head height','6.40')}{sp('Length under head','75')}
        <div class="sp-sec">Nut &amp; washer</div>
        {sp('Nut height','8.40')}{sp('Washer OD / ID','20 / 10.5')}{sp('Washer thickness','2.00')}
        <div class="sp-sec">Holes</div>
        {sp('Tap drill','8.50')}{sp('Clearance drill','11.00')}
        <div class="sp-sec">Also called</div>
        {sp('Imperial nearest','3/8&#8221;&#8211;16 UNC')}{sp('Spanner, imperial','11/16&#8221;')}
      </div>
    </div>'''

    # the tools, at the SAME scale as the render above -- a 17mm jaw
    # really is that much wider than an 8.5mm bit.
    TS = 2.5
    sp_svg, spl, spw = geom.spanner(ROW['afIso'], TS, 'ts')
    d1, d1l, d1r = geom.drill_bit(ROW['tapDrill'], TS, 'td', length_mm=64)
    d2, d2l, d2r = geom.drill_bit(ROW['clearDrill'], TS, 'cd', length_mm=64)
    strip = f'''<div class="vp" style="height:118px;border-radius:0;border-left:0;border-right:0;border-bottom:0">
        <div class="vp-grid"></div>
        <svg width="700" height="118" style="position:absolute;inset:0">
          <g transform="translate(126,62)">{sp_svg}</g>
          <g transform="translate(350,94)">{d1}</g>
          <g transform="translate(350,46)">{d2}</g>
        </svg>
        <div class="co" style="left:16px;top:10px"><div class="co-l">The spanner and the two drills</div></div>
        <div class="co" style="left:560px;top:34px"><div class="co-l">11 mm &#183; clearance</div></div>
        <div class="co" style="left:560px;top:82px"><div class="co-l">8.5 mm &#183; tap</div></div>
        <div class="co" style="right:14px;bottom:10px"><div class="co-l" style="color:#4B5762">same scale as above</div></div>
      </div>'''

    fit = f'''<div class="pan" style="flex:1">
      <div class="pan-h"><span class="pan-t">What it takes</span><span class="pan-n">ISO 4017 &#183; grade 8.8</span></div>
      <div class="pan-b" style="display:flex;gap:0;padding:12px 0 14px">
        {fit_cell('Spanner', '17 mm', 'ISO and DIN agree here', 'good')}
        {fit_cell('Tap drill', '8.5 mm', 'to cut an M10 thread', '')}
        {fit_cell('Clearance', '11 mm', 'for the bolt to pass', '')}
        {fit_cell('Torque', '47&#8211;56 N&#183;m', 'grade 8.8, dry thread', '')}
      </div>
      <div style="margin-top:auto">{strip}</div>
    </div>'''

    shop = f'''<div class="pan" style="width:352px;flex:none">
      <div class="pan-h"><span class="pan-t">On the shelf</span><span class="pan-n">214 nuts &#183; 660 washers</span></div>
      <div class="pan-b" style="display:flex;flex-direction:column;gap:9px;flex:1">
        <div style="display:flex;align-items:baseline;gap:9px">
          <span class="mono" style="font-size:24px;font-weight:500">328</span>
          <span style="font-size:11.5px;color:var(--ink600)">pcs &#183; held as <b class="mono">M10*75</b> and <b class="mono">10x75</b></span>
        </div>
        <div class="sp" style="border-bottom:1px solid var(--ruleSoft)"><span>Each</span><b>UGX 1,250</b></div>
        <div class="sp" style="border-bottom:1px solid var(--ruleSoft)"><span>Per 100</span><b>UGX 108,000</b></div>
        <div class="sp"><span>By weight &#183; 4.1 kg / 100</span><b>UGX 26,300/kg</b></div>
        <div style="display:flex;gap:7px;margin-top:auto">
          <span class="btn btn-accent"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add to the sale</span>
          <span class="btn">With nut &amp; washer</span>
        </div>
      </div>
    </div>'''

    body = f'''<div class="app" style="width:{W}px;height:{H}px">
  {chrome()}
  <div class="main">
    <div class="ph">
      <div><h1 class="ph-t">Fastener guide</h1></div>
      <p class="ph-sub">Hold the size on screen, read the fit off it.</p>
      <div class="ph-sp"></div>
      <div class="sel" style="width:330px;height:34px;font-size:13px;color:var(--ink400)">
        <svg viewBox="0 0 24 24" style="width:15px;height:15px;margin-right:7px;stroke:var(--ink400);fill:none;stroke-width:2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        Type a size &#8212; M8, #8, 38mm, 1 1/2, 13&#8230;</div>
    </div>
    <div style="display:flex;gap:12px;align-items:stretch">
      {cfg}
      <div style="flex:1;min-width:0">{vp}</div>
      {spec}
    </div>
    <div style="display:flex;gap:12px;align-items:stretch;flex:1;min-height:0">
      {fit}
      {shop}
    </div>
  </div>
</div>'''
    return body, W, H


def fit_cell(label, value, note, tone):
    chip = f'<span class="cp {tone}">{note}</span>' if tone else f'<span style="font-size:11px;color:var(--ink600)">{note}</span>'
    return (f'<div style="flex:1;padding:0 16px;border-left:1px solid var(--ruleSoft)">'
            f'<div class="fld-l" style="margin-bottom:5px">{label}</div>'
            f'<div class="mono" style="font-size:23px;font-weight:500;line-height:1.05">{value}</div>'
            f'<div style="margin-top:6px">{chip}</div></div>')


def emit(name, body, w, h):
    open(os.path.join(HERE, name + '.dc.html'), 'w').write(
        HEAD % dict(css=CSS, body=body, w=w, h=h))
    print('wrote', name)


if __name__ == '__main__':
    emit('Main', *workbench())
