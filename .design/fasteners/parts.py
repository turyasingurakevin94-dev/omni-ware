"""Shared chrome, CSS and the dark viewport, so the four artboards differ
only where they are meant to differ."""
import math, geom

HEAD = '''<!doctype html>
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
%(css)s
  </style>
</helmet>
%(body)s
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":%(w)d,"height":%(h)d}}'>
class Component extends DCLogic {}
</script>
</body>
</html>
'''

CSS = '''
    :root{
      --navy:#14171B; --steel800:#252A31; --steel400:#8A939C; --steel100:#DCE0E4;
      --steel050:#E9EBED; --paper:#FFFFFF; --paper2:#F7F9FB;
      --oxide:#B23A26; --oxideDeep:#8E2C1C; --oxideSoft:#F6E7E3;
      --verd:#1C6B58; --verdSoft:#E2EFEB; --amber:#B0700A; --amberSoft:#FBEFD9; --amberInk:#7A4A02;
      --crimson:#7F1D1A; --crimsonSoft:#F7E4E2;
      --ink:#14171B; --ink600:#59626B; --ink400:#8A939C;
      --rule:#CFD5DA; --ruleSoft:#E3E7EA;
      --mono:'IBM Plex Mono',ui-monospace,Menlo,monospace;
      /* the viewport is the ONE dark surface on the page: metal reads on
         dark and nowhere else does this app go dark. */
      --vp:#171B20; --vp2:#1E242B; --vpLine:#2F3841; --vpInk:#B9C3CC; --vpInk2:#6E7B87;
    }
    *{box-sizing:border-box;}
    body{margin:0;font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--ink);
      background:var(--steel050);-webkit-font-smoothing:antialiased;}
    a{color:var(--oxide);} a:hover{color:var(--oxideDeep);}
    .app{position:relative;background:var(--steel050);overflow:hidden;}
    .mono{font-family:var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-.02em;}

    /* chrome */
    .topbar{position:absolute;top:0;left:0;right:0;height:54px;background:var(--navy);
      display:flex;align-items:center;gap:14px;padding:0 20px;color:#fff;z-index:3;}
    .brand{display:flex;align-items:center;gap:10px;}
    .brand-mark{width:32px;height:32px;border-radius:8px;background:var(--oxide);color:#fff;
      display:flex;align-items:center;justify-content:center;font-family:'Archivo Black',sans-serif;font-size:12px;}
    .brand .tag{font-family:'Archivo Black',sans-serif;font-size:15.5px;letter-spacing:.3px;}
    .tb-sp{flex:1;}
    .tb-ic{width:18px;height:18px;fill:none;stroke:#C7CFD8;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
    .sidebar{position:absolute;top:54px;left:0;bottom:0;width:220px;background:var(--navy);
      padding:12px 10px;display:flex;flex-direction:column;gap:1px;z-index:2;}
    .nav-l{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#7C8894;padding:12px 12px 6px;}
    .nav-b{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:8px;
      font-size:13.5px;font-weight:500;color:#C7CFD8;white-space:nowrap;}
    .nav-b svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none;}
    .nav-b.active{background:var(--oxide);color:#fff;font-weight:700;}
    .main{position:absolute;top:54px;left:220px;right:0;bottom:0;padding:22px 26px 24px;overflow:hidden;
      display:flex;flex-direction:column;gap:14px;}

    /* page header */
    .ph{display:flex;align-items:flex-end;gap:12px;border-bottom:1px solid var(--rule);padding-bottom:11px;}
    .ph-t{font-family:'Archivo Black',sans-serif;font-size:19px;margin:0;letter-spacing:-.015em;line-height:1.1;}
    .ph-sub{font-size:12px;color:var(--ink600);margin:0 0 1px;}
    .ph-sp{flex:1;}

    /* panels */
    .pan{background:var(--paper);border:1px solid var(--ruleSoft);border-radius:8px;overflow:hidden;
      display:flex;flex-direction:column;min-height:0;}
    .pan-h{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;flex:none;
      border-bottom:1px solid var(--ruleSoft);background:var(--paper2);}
    .pan-t{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink600);}
    .pan-n{font-size:11px;color:var(--ink600);margin-left:auto;white-space:nowrap;}
    .pan-b{padding:10px 12px;}

    /* the dark viewport */
    .vp{position:relative;background:var(--vp);border:1px solid var(--vpLine);border-radius:8px;overflow:hidden;}
    .vp-grid{position:absolute;inset:0;
      background-image:linear-gradient(var(--vpLine) 1px,transparent 1px),linear-gradient(90deg,var(--vpLine) 1px,transparent 1px);
      background-size:40px 40px;opacity:.30;}
    .vp-glow{position:absolute;left:50%;top:46%;width:78%;height:62%;transform:translate(-50%,-50%);
      background:radial-gradient(ellipse at center,rgba(120,150,180,.20),transparent 68%);}
    .vp-bar{position:absolute;left:0;right:0;top:0;height:32px;display:flex;align-items:center;gap:8px;
      padding:0 12px;border-bottom:1px solid var(--vpLine);background:rgba(10,13,16,.55);}
    .vp-lab{font-size:10px;font-weight:600;letter-spacing:.10em;text-transform:uppercase;color:var(--vpInk2);}
    .vp-seg{display:flex;gap:1px;background:var(--vpLine);border-radius:5px;overflow:hidden;margin-left:auto;}
    .vp-seg span{font-size:10.5px;font-weight:600;padding:4px 9px;background:#12161A;color:var(--vpInk2);}
    .vp-seg span.on{background:var(--vpInk);color:#12161A;}
    .vp-tools{position:absolute;left:50%;transform:translateX(-50%);bottom:12px;display:flex;gap:1px;
      background:var(--vpLine);border-radius:7px;overflow:hidden;}
    .vp-tools i{display:flex;align-items:center;justify-content:center;width:34px;height:30px;background:#12161A;}
    .vp-tools i.on{background:#2A333C;}
    .vp-tools svg{width:15px;height:15px;fill:none;stroke:var(--vpInk);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}

    /* callouts, drawn as leader + label like an engineering drawing */
    .co{position:absolute;}
    .co-l{font-size:9.5px;font-weight:700;letter-spacing:.10em;text-transform:uppercase;color:var(--vpInk2);white-space:nowrap;}
    .co-v{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:12px;font-weight:500;
      color:#E4EAEF;white-space:nowrap;letter-spacing:-.02em;}
    .co-line{position:absolute;background:#48555F;}
    .co-dot{position:absolute;width:5px;height:5px;border-radius:50%;background:#8FA3B2;
      box-shadow:0 0 0 3px rgba(143,163,178,.18);}

    /* scale ruler */
    .ruler{position:absolute;left:14px;right:14px;bottom:52px;height:22px;}
    .ruler .rl{position:absolute;bottom:0;width:1px;background:#3C474F;}
    .ruler .rn{position:absolute;bottom:9px;font-family:var(--mono);font-size:9px;color:var(--vpInk2);transform:translateX(-50%);}
    .ruler .rbase{position:absolute;left:0;right:0;bottom:0;height:1px;background:#3C474F;}

    /* controls */
    .fld{display:flex;flex-direction:column;gap:4px;}
    .fld-l{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink600);}
    .sel{display:flex;align-items:center;height:30px;padding:0 9px;border:1px solid var(--rule);
      border-radius:6px;background:var(--paper);font-size:12.5px;font-weight:500;}
    .sel svg{width:13px;height:13px;margin-left:auto;fill:none;stroke:var(--ink400);stroke-width:2;}
    .chips{display:flex;flex-wrap:wrap;gap:5px;}
    .chip{font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;
      border:1px solid var(--rule);background:var(--paper);color:var(--ink600);}
    .chip.on{background:var(--navy);border-color:var(--navy);color:#fff;}
    .sw{display:flex;gap:6px;}
    .sw i{width:26px;height:26px;border-radius:6px;border:1px solid var(--rule);display:block;}
    .sw i.on{outline:2px solid var(--navy);outline-offset:1px;}

    .btn{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 13px;
      border-radius:6px;border:1px solid var(--rule);background:var(--paper);font-size:12.5px;font-weight:600;color:var(--ink);}
    .btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
    .btn-accent{background:var(--oxide);border-color:var(--oxide);color:#fff;}

    /* spec rows */
    .sp{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:12px;
      color:var(--ink600);padding:5px 0;border-bottom:1px dashed var(--steel100);}
    .sp:last-child{border-bottom:0;}
    .sp b{color:var(--ink);font-family:var(--mono);font-variant-numeric:tabular-nums;font-weight:500;font-size:12px;}
    .sp-sec{font-size:10px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink400);
      margin:9px 0 3px;padding-top:6px;border-top:1px solid var(--ruleSoft);}
    .sp-sec:first-child{margin-top:0;padding-top:0;border-top:0;}

    .cp{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;height:18px;
      padding:0 6px;border-radius:4px;background:var(--steel050);color:var(--ink600);}
    .cp.good{background:var(--verdSoft);color:var(--verd);}
    .cp.warn{background:var(--amberSoft);color:var(--amberInk);}
    .cp.bad{background:var(--crimsonSoft);color:var(--crimson);}
    .cp.mg{background:var(--oxideSoft);color:var(--oxideDeep);}

    .tbl{width:100%;border-collapse:collapse;}
    .tbl th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink600);
      font-weight:700;padding:6px 10px;border-bottom:1px solid var(--rule);}
    .tbl td{padding:6px 10px;border-bottom:1px solid var(--ruleSoft);font-size:12px;color:var(--ink600);}
    .tbl td b{color:var(--ink);font-family:var(--mono);font-weight:500;font-variant-numeric:tabular-nums;}
    .tbl tr.on td{background:var(--paper2);}
    .note{font-size:11px;line-height:1.45;color:var(--ink600);max-width:76ch;}
'''

NAV = [('Today','M3 12h3M18 12h3M12 3v3M5.6 5.6l2.1 2.1M18.4 5.6l-2.1 2.1M6 18a6 6 0 0112 0z'),
       ('Sell','M20.6 13.4L12 22 2 12V2h10z M7 7h.01'),
       ('Products','M3 7l9-4 9 4-9 4z M3 7v10l9 4 9-4V7'),
       ('Suppliers','M3 21V9l7-4 7 4v12M9 21v-5h4v5'),
       ('Money','M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6')]


def chrome(active='Fastener guide'):
    nav = ''.join(f'<div class="nav-b"><svg viewBox="0 0 24 24"><path d="{d}"/></svg>{n}</div>'
                  for n, d in NAV)
    return f'''  <div class="topbar">
    <div class="brand"><div class="brand-mark">OW</div><div class="tag">OMNI&#8203;WARE</div></div>
    <div class="tb-sp"></div>
    <svg class="tb-ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
    <svg class="tb-ic" viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 01-3.4 0"/></svg>
  </div>
  <div class="sidebar">
    <div class="nav-l">The day</div>
    {nav}
    <div class="nav-l">Reference</div>
    <div class="nav-b active"><svg viewBox="0 0 24 24"><path d="M12 3v18M8.5 6.5h7M8.5 17.5h7"/><circle cx="12" cy="12" r="3.2"/></svg>Fastener guide</div>
    <div class="nav-b"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z M4 10h16M10 10v9"/></svg>Price list</div>
  </div>'''


def ruler(width_px, S, left=14, label='SCALE'):
    """mm ticks under the render. The page cannot claim 'to scale' and
    then not show what the scale is."""
    out = ['<div class="rbase"></div>']
    mm = 0
    while mm * S < width_px - 2:
        x = mm * S
        big = mm % 10 == 0
        out.append(f'<div class="rl" style="left:{x:.1f}px;height:{9 if big else 5}px"></div>')
        if big and mm > 0:
            out.append(f'<div class="rn" style="left:{x:.1f}px">{mm}</div>')
        mm += 5

    return f'<div class="ruler">{"".join(out)}</div>'


def callout(x, y_part, y_label, label, value='', align='left', up=True):
    """A leader from a dot ON the part to a label block whose top edge is
    given outright -- so labels line up with each other and can never
    drift into the viewport bar."""
    tx = {'left': 'left:0;', 'right': 'right:0;text-align:right;',
          'centre': 'left:50%;transform:translateX(-50%);text-align:center;'}[align]
    v = f'<div class="co-v">{value}</div>' if value else ''
    if up:
        y1, h = y_label + 30, y_part - (y_label + 30)
    else:
        y1, h = y_part, y_label - 6 - y_part
    return (f'<div class="co" style="left:{x:.0f}px;top:0">'
            f'<div class="co-dot" style="left:-2px;top:{y_part - 2:.0f}px"></div>'
            f'<div class="co-line" style="left:0;top:{y1:.0f}px;width:1px;height:{max(h, 0):.0f}px"></div>'
            f'<div style="position:absolute;top:{y_label:.0f}px;{tx}">'
            f'<div class="co-l">{label}</div>{v}</div></div>')
