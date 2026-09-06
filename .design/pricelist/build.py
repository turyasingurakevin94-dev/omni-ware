#!/usr/bin/env python3
"""Writes one .dc.html artboard per table direction.

The masthead and the foot are held IDENTICAL across every direction on
purpose: the criticism is about the table, so the table is the only
thing allowed to vary. Same three rows of Jackson's real list in each,
so the comparison is like for like.
"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))

HEAD = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
  <style>
    body { margin: 0; }
    a { color: #B23A26; } a:hover { color: #8E2C1C; }
    .w { width: 600px; height: 800px; box-sizing: border-box; background: %(ground)s;
         font-family: Inter, system-ui, sans-serif; position: relative; overflow: hidden;
         display: flex; flex-direction: column; }
    .mast { background: #14171B; height: 150px; box-sizing: border-box; flex: none;
            padding: 26px 34px 0; display: flex; justify-content: space-between; }
    .ow { display: flex; align-items: center; gap: 10px; height: 34px; }
    .owm { width: 34px; height: 34px; border-radius: 9px; background: #FFFFFF; color: #B23A26;
           font-family: 'Archivo Black', sans-serif; font-size: 13px; display: flex;
           align-items: center; justify-content: center; }
    .owt { font-family: 'Archivo Black', sans-serif; font-size: 15px; color: #FFFFFF; }
    .rt { text-align: right; }
    .kick { font-family: 'Archivo Black', sans-serif; font-size: 13px; letter-spacing: 2.5px;
            color: #C9573F; line-height: 34px; }
    .who { font-family: 'Archivo Black', sans-serif; font-size: 30px; color: #FFFFFF; margin-top: 10px; }
    .day { font-size: 15px; color: #8A939C; margin-top: 8px; }
    .key { height: 4px; background: #B23A26; flex: none; }
    .body { flex: 1; min-height: 0; }
    .foot { flex: none; height: 96px; background: #14171B; display: flex; align-items: center;
            justify-content: space-between; padding: 0 34px; }
    .fy { font-family: 'Archivo Black', sans-serif; font-size: 24px; color: #FFFFFF; }
    .fk { font-family: 'Archivo Black', sans-serif; font-size: 12px; letter-spacing: 1.4px;
          color: #C9573F; margin-top: 6px; }
    .ftel { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 27px; color: #FFFFFF; }
%(css)s
  </style>
</helmet>
<div class="w">
  <div class="mast">
    <div class="ow"><div class="owm">OW</div><div class="owt">OMNI-WARE</div></div>
    <div class="rt">
      <div class="kick">PRICE LIST</div>
      <div class="who">JACKSON</div>
      <div class="day">6 Sept 2026</div>
    </div>
  </div>
  <div class="key"></div>
  <div class="body">
%(body)s
  </div>
  <div class="foot">
    <div><div class="fy">REPLY YES</div><div class="fk">AND WE KEEP IT FOR YOU</div></div>
    <div class="ftel">0750016750</div>
  </div>
</div>
</x-dc>
</body>
</html>
"""

D = {}

# ---------------------------------------------------------------- NOW
# Today's picture, unchanged, so the comparison is honest: same three
# rows, same masthead, the table exactly as it ships.
D['Now'] = dict(ground='#FFFFFF', css="""
    .n-cols { display: flex; justify-content: space-between; padding: 18px 34px 0;
              font-family: 'Archivo Black', sans-serif; font-size: 12px; letter-spacing: 1.6px;
              color: #8A939C; }
    .n-line { margin: 12px 34px 0; height: 1px; background: #CFD5DA; }
    .n-sec { display: flex; align-items: center; gap: 16px; margin: 22px 34px 8px; }
    .n-sect { font-family: 'Archivo Black', sans-serif; font-size: 17px; letter-spacing: 1.8px;
              color: #59626B; }
    .n-sect.good { color: #1C6B58; }
    .n-secr { flex: 1; height: 1px; background: #E3E7EA; }
    .n-row { display: grid; grid-template-columns: minmax(0,1fr) 104px 150px; gap: 0 12px;
             margin: 0 34px; padding: 14px 0; border-bottom: 1px solid #E3E7EA; }
    .n-nm { font-family: 'Archivo Black', sans-serif; font-size: 22px; color: #14171B; }
    .n-pk { font-size: 17px; color: #59626B; padding-top: 5px; }
    .n-pr { text-align: right; font-family: 'IBM Plex Mono', monospace; font-weight: 600;
            font-size: 32px; letter-spacing: -0.02em; color: #14171B; }
    .n-un { grid-column: 3; text-align: right; font-family: 'Archivo Black', sans-serif;
            font-size: 11px; letter-spacing: 1.2px; color: #8A939C; margin-top: 4px; }
    .n-note { grid-column: 1; margin-top: 4px; font-size: 16px; color: #1C6B58; }
    .n-note b { font-family: 'Archivo Black', sans-serif; font-size: 11px; letter-spacing: 1.2px;
                margin-left: 10px; }
    .n-take { grid-column: 1; margin-top: 4px; font-family: 'Archivo Black', sans-serif;
              font-size: 11px; letter-spacing: 1.2px; color: #8A939C; }
""", body="""
    <div class="n-cols"><span>PRODUCT</span><span>PACKING</span><span>PRICE</span></div>
    <div class="n-line"></div>
    <div class="n-sec"><span class="n-sect good">PRICE DOWN</span><span class="n-secr"></span></div>
    <div class="n-row">
      <div class="n-nm">RUNNERS</div><div class="n-pk">&mdash;</div><div class="n-pr">75,000</div>
      <div class="n-note"><s>122,500</s> <b>YOU SAVE 47,500</b></div>
    </div>
    <div class="n-sec"><span class="n-sect">YOU USUALLY TAKE</span><span class="n-secr"></span></div>
    <div class="n-row">
      <div class="n-nm">BLACK SCREWS</div><div class="n-pk">20/Ctn</div><div class="n-pr">15,000</div>
      <div class="n-un">PER BOX</div><div class="n-take">YOU USUALLY TAKE 20</div>
    </div>
    <div class="n-row">
      <div class="n-nm">GOLD SCREWS</div><div class="n-pk">&mdash;</div><div class="n-pr">15,000</div>
      <div class="n-un">PER KG</div><div class="n-take">YOU USUALLY TAKE 20</div>
    </div>
""")

# ---------------------------------------------------------------- A
# THE LEDGER. The section label leaves the product column entirely and
# lives in a left gutter, so rank is settled by POSITION, not by weight.
# Nothing in the gutter can ever compete with a product name.
D['Main'] = dict(ground='#FFFFFF', css="""
    .a-head { display: grid; grid-template-columns: 100px minmax(0,1fr) 168px; gap: 0 14px;
              padding: 20px 34px 10px; font-family: Inter, sans-serif; font-size: 11px;
              font-weight: 600; letter-spacing: 1.6px; color: #8A939C;
              border-bottom: 2px solid #14171B; }
    .a-head span:last-child { text-align: right; }
    .a-grp { display: grid; grid-template-columns: 100px minmax(0,1fr); gap: 0 14px;
             padding: 0 34px; }
    .a-lab { grid-column: 1; padding-top: 20px; font-family: Inter, sans-serif; font-size: 11px;
             font-weight: 700; letter-spacing: 1.4px; color: #8A939C; line-height: 1.5; }
    .a-lab.good { color: #1C6B58; }
    .a-rows { grid-column: 2; }
    .a-row { display: grid; grid-template-columns: minmax(0,1fr) 168px; gap: 0 14px;
             padding: 16px 0; border-bottom: 1px solid #E3E7EA; }
    .a-nm { font-family: 'Archivo Black', sans-serif; font-size: 23px; color: #14171B;
            line-height: 1.1; white-space: nowrap; }
    .a-pr { grid-column: 2; grid-row: 1; text-align: right; font-family: 'IBM Plex Mono', monospace;
            font-weight: 600; font-size: 33px; letter-spacing: -0.03em; color: #14171B; line-height: 1; }
    .a-un { grid-column: 2; text-align: right; font-size: 12px; font-weight: 600;
            letter-spacing: 1px; color: #8A939C; margin-top: 6px; }
    .a-sub { grid-column: 1 / -1; margin-top: 7px; font-size: 15px; color: #59626B; }
    .a-sub s { color: #8A939C; }
    .a-sub b { color: #1C6B58; font-weight: 700; }
    .a-sub .q { color: #8A939C; }
""", body="""
    <div class="a-head"><span></span><span>PRODUCT &amp; PACKING</span><span>PRICE</span></div>
    <div class="a-grp">
      <div class="a-lab good">PRICE<br>DOWN</div>
      <div class="a-rows">
        <div class="a-row">
          <div class="a-nm">RUNNERS</div><div class="a-pr">75,000</div>
          <div class="a-un">EACH</div>
          <div class="a-sub"><s>was 122,500</s> &middot; <b>you save 47,500</b></div>
        </div>
      </div>
    </div>
    <div class="a-grp">
      <div class="a-lab">YOU<br>USUALLY<br>TAKE</div>
      <div class="a-rows">
        <div class="a-row">
          <div class="a-nm">BLACK SCREWS</div><div class="a-pr">15,000</div>
          <div class="a-un">PER BOX</div>
          <div class="a-sub">20 Boxes/Ctn <span class="q">&middot; you take 20</span></div>
        </div>
        <div class="a-row">
          <div class="a-nm">GOLD SCREWS</div><div class="a-pr">15,000</div>
          <div class="a-un">PER KG</div>
          <div class="a-sub">Sold loose <span class="q">&middot; you take 20</span></div>
        </div>
      </div>
    </div>
""")

# ---------------------------------------------------------------- B
# REVERSED BAND. Rank settled by GROUND: the section is white type on a
# dark bar, so it cannot be read as a product however heavy it is.
D['Band'] = dict(ground='#FFFFFF', css="""
    .b-bar { display: flex; align-items: center; justify-content: space-between;
             background: #14171B; color: #FFFFFF; padding: 9px 34px; margin-top: 16px; }
    .b-bar.good { background: #1C6B58; }
    .b-bt { font-family: Inter, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px; }
    .b-bn { font-family: 'IBM Plex Mono', monospace; font-size: 13px; opacity: .7; }
    .b-row { display: grid; grid-template-columns: minmax(0,1fr) 132px 152px; gap: 0 14px;
             padding: 18px 34px; border-bottom: 1px solid #E3E7EA; }
    .b-nm { font-family: 'Archivo Black', sans-serif; font-size: 24px; color: #14171B; }
    .b-pk { font-size: 16px; color: #59626B; padding-top: 6px; }
    .b-pr { text-align: right; font-family: 'IBM Plex Mono', monospace; font-weight: 600;
            font-size: 34px; letter-spacing: -0.03em; color: #14171B; line-height: 1; }
    .b-un { grid-column: 3; text-align: right; font-size: 12px; font-weight: 600;
            letter-spacing: 1px; color: #8A939C; margin-top: 6px; }
    .b-note { grid-column: 1 / 3; margin-top: 8px; }
    .b-chip { display: inline-block; background: #E2EFEB; color: #1C6B58; border-radius: 999px;
              padding: 4px 12px; font-size: 14px; font-weight: 600; }
    .b-was { color: #8A939C; font-size: 15px; margin-left: 10px; }
    .b-take { grid-column: 1 / 3; margin-top: 8px; font-size: 15px; color: #8A939C; }
""", body="""
    <div class="b-bar good"><span class="b-bt">PRICE DOWN</span><span class="b-bn">1 line</span></div>
    <div class="b-row">
      <div class="b-nm">RUNNERS</div><div class="b-pk">&mdash;</div><div class="b-pr">75,000</div>
      <div class="b-note"><span class="b-chip">You save 47,500</span><span class="b-was">was 122,500</span></div>
    </div>
    <div class="b-bar"><span class="b-bt">YOU USUALLY TAKE</span><span class="b-bn">2 lines</span></div>
    <div class="b-row">
      <div class="b-nm">BLACK SCREWS</div><div class="b-pk">20 Boxes/Ctn</div>
      <div class="b-pr">15,000</div><div class="b-un">PER BOX</div>
      <div class="b-take">You usually take 20</div>
    </div>
    <div class="b-row">
      <div class="b-nm">GOLD SCREWS</div><div class="b-pk">&mdash;</div>
      <div class="b-pr">15,000</div><div class="b-un">PER KG</div>
      <div class="b-take">You usually take 20</div>
    </div>
""")

# ---------------------------------------------------------------- C
# PRICE FIRST. The figure is the headline and the product name sits
# under it. Reads at a thumbnail, and at arm's length in a yard.
D['PriceFirst'] = dict(ground='#FFFFFF', css="""
    .c-sec { margin: 20px 34px 2px; font-family: Inter, sans-serif; font-size: 11px;
             font-weight: 700; letter-spacing: 2px; color: #8A939C; }
    .c-sec.good { color: #1C6B58; }
    .c-row { display: grid; grid-template-columns: 210px minmax(0,1fr); gap: 0 20px;
             align-items: center; padding: 16px 34px; border-top: 1px solid #E3E7EA; }
    .c-pr { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 44px;
            letter-spacing: -0.04em; color: #14171B; line-height: 1; }
    .c-un { font-size: 12px; font-weight: 600; letter-spacing: 1.1px; color: #8A939C; margin-top: 6px; }
    .c-nm { font-family: 'Archivo Black', sans-serif; font-size: 21px; color: #14171B; line-height: 1.15; }
    .c-pk { font-size: 15px; color: #59626B; margin-top: 6px; }
    .c-save { display: inline-block; margin-top: 8px; background: #1C6B58; color: #FFFFFF;
              border-radius: 4px; padding: 3px 9px; font-size: 13px; font-weight: 600; }
    .c-was { color: #8A939C; font-size: 14px; margin-left: 8px; }
""", body="""
    <div class="c-sec good">PRICE DOWN</div>
    <div class="c-row">
      <div><div class="c-pr">75,000</div><div class="c-un">EACH</div></div>
      <div><div class="c-nm">RUNNERS</div>
        <div><span class="c-save">Save 47,500</span><span class="c-was">was 122,500</span></div></div>
    </div>
    <div class="c-sec">YOU USUALLY TAKE</div>
    <div class="c-row">
      <div><div class="c-pr">15,000</div><div class="c-un">PER BOX</div></div>
      <div><div class="c-nm">BLACK SCREWS</div>
        <div class="c-pk">20 Boxes/Ctn &middot; you take 20</div></div>
    </div>
    <div class="c-row">
      <div><div class="c-pr">15,000</div><div class="c-un">PER KG</div></div>
      <div><div class="c-nm">GOLD SCREWS</div>
        <div class="c-pk">Sold loose &middot; you take 20</div></div>
    </div>
""")

# ---------------------------------------------------------------- D
# CARDS. Each line is its own object on a tinted ground. The section is
# a quiet label above the stack -- it is not on the card, so it cannot
# be confused with one.
D['Cards'] = dict(ground='#F7F9FB', css="""
    .d-sec { margin: 18px 30px 8px; font-family: Inter, sans-serif; font-size: 11px;
             font-weight: 700; letter-spacing: 2px; color: #8A939C; }
    .d-sec.good { color: #1C6B58; }
    .d-card { margin: 0 30px 10px; background: #FFFFFF; border: 1px solid #DCE0E4;
              border-radius: 10px; padding: 16px 18px; display: grid;
              grid-template-columns: minmax(0,1fr) auto; gap: 4px 16px; }
    .d-card.good { border-color: #1C6B58; }
    .d-nm { font-family: 'Archivo Black', sans-serif; font-size: 22px; color: #14171B; }
    .d-pr { grid-row: 1 / 3; align-self: center; text-align: right;
            font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 32px;
            letter-spacing: -0.03em; color: #14171B; line-height: 1; }
    .d-un { display: block; font-family: Inter, sans-serif; font-size: 12px; font-weight: 600;
            letter-spacing: 1px; color: #8A939C; margin-top: 6px; }
    .d-meta { font-size: 15px; color: #59626B; }
    .d-save { color: #1C6B58; font-weight: 600; }
    .d-was { color: #8A939C; text-decoration: line-through; }
""", body="""
    <div class="d-sec good">PRICE DOWN</div>
    <div class="d-card good">
      <div class="d-nm">RUNNERS</div>
      <div class="d-pr">75,000<span class="d-un">EACH</span></div>
      <div class="d-meta"><span class="d-was">122,500</span> &nbsp;<span class="d-save">you save 47,500</span></div>
    </div>
    <div class="d-sec">YOU USUALLY TAKE</div>
    <div class="d-card">
      <div class="d-nm">BLACK SCREWS</div>
      <div class="d-pr">15,000<span class="d-un">PER BOX</span></div>
      <div class="d-meta">20 Boxes/Ctn &middot; you take 20</div>
    </div>
    <div class="d-card">
      <div class="d-nm">GOLD SCREWS</div>
      <div class="d-pr">15,000<span class="d-un">PER KG</span></div>
      <div class="d-meta">Sold loose &middot; you take 20</div>
    </div>
""")

# ---------------------------------------------------------------- E
# DOT LEADER. The oldest price-sheet device there is: the eye is walked
# from the name to the figure. Section titles are centred small caps
# between rules -- a different shape entirely from a product line.
D['Leader'] = dict(ground='#FFFFFF', css="""
    .e-sec { display: flex; align-items: center; gap: 14px; margin: 26px 34px 14px; }
    .e-sr { flex: 1; height: 1px; background: #CFD5DA; }
    .e-st { font-family: Inter, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 2.4px;
            color: #8A939C; }
    .e-st.good { color: #1C6B58; }
    .e-row { margin: 0 34px 16px; }
    .e-line { display: flex; align-items: baseline; gap: 8px; }
    .e-nm { font-family: 'Archivo Black', sans-serif; font-size: 23px; color: #14171B; }
    .e-dots { flex: 1; border-bottom: 2px dotted #CFD5DA; transform: translateY(-5px); }
    .e-pr { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 32px;
            letter-spacing: -0.03em; color: #14171B; }
    .e-sub { display: flex; justify-content: space-between; margin-top: 5px; }
    .e-pk { font-size: 15px; color: #59626B; }
    .e-un { font-size: 12px; font-weight: 600; letter-spacing: 1px; color: #8A939C; }
    .e-save { color: #1C6B58; font-size: 15px; }
    .e-save s { color: #8A939C; }
""", body="""
    <div class="e-sec"><span class="e-st good">PRICE DOWN</span><span class="e-sr"></span></div>
    <div class="e-row">
      <div class="e-line"><span class="e-nm">RUNNERS</span><span class="e-dots"></span><span class="e-pr">75,000</span></div>
      <div class="e-sub"><span class="e-save"><s>122,500</s> &mdash; you save 47,500</span><span class="e-un">EACH</span></div>
    </div>
    <div class="e-sec"><span class="e-st">YOU USUALLY TAKE</span><span class="e-sr"></span></div>
    <div class="e-row">
      <div class="e-line"><span class="e-nm">BLACK SCREWS</span><span class="e-dots"></span><span class="e-pr">15,000</span></div>
      <div class="e-sub"><span class="e-pk">20 Boxes/Ctn &middot; you take 20</span><span class="e-un">PER BOX</span></div>
    </div>
    <div class="e-row">
      <div class="e-line"><span class="e-nm">GOLD SCREWS</span><span class="e-dots"></span><span class="e-pr">15,000</span></div>
      <div class="e-sub"><span class="e-pk">Sold loose &middot; you take 20</span><span class="e-un">PER KG</span></div>
    </div>
""")

for name, spec in D.items():
    with open(os.path.join(HERE, name + '.dc.html'), 'w') as fh:
        fh.write(HEAD % spec)
print('wrote', ', '.join(sorted(D)))
