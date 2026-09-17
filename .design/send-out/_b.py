IC = {
 'print':'<svg class="icon ow-i16" viewBox="0 0 24 24"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="7" rx="1.6"/><path d="M6 16h12v5H6z"/></svg>',
 'dots':'<svg class="icon ow-i16" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
 'x':'<svg class="icon ow-i16" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
 'truck':'<svg class="icon ow-i14" viewBox="0 0 24 24"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
 'tick':'<svg class="icon ow-i16" viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7"/></svg>',
}
STAGES=[('Taken','Tue 18:37'),('Buying','13:20'),('Preparing','13:25'),('Out',''),('Delivered','')]

def spine(at, events=None, chip=None):
    out=[]
    for j,(name,when) in enumerate(STAGES):
        cls='ow-on' if j<at else ('ow-now' if j==at else '')
        b=[f'<span class="ow-op-s-n">{name}</span>']
        if j<=at and when: b.append(f'<span class="ow-op-s-t">{when}{" · 14m" if j==at else ""}</span>')
        for t,w in (events or {}).get(j,[]):
            b.append(f'<span class="ow-op-e"><em class="ow-op-ts">{t}</em> {w}</span>')
        if j==at and chip: b.append(chip)
        out.append(f'<div class="ow-op-s {cls}">'+''.join(b)+'</div>')
    return ''.join(out)

def head():
    return f'''<div class="ow-dlg-h">
      <span class="ow-dlg-t">A99 Trade Center</span>
      <span class="ow-dlg-id">#365</span>
      <span class="ow-dlg-s">Trade Center</span>
      <span class="ow-dlg-sp"></span>
      <button type="button" class="ow-dlg-x" aria-label="Print the packing list">{IC['print']}</button>
      <button type="button" class="ow-dlg-x" aria-label="Other moves">{IC['dots']}</button>
      <button type="button" class="ow-dlg-x" aria-label="Close">{IC['x']}</button>
    </div>'''

def opt(name, role, on=False):
    return (f'<button type="button" class="ow-ld-o{" ow-on" if on else ""}" role="radio" '
            f'aria-checked="{"true" if on else "false"}"><span class="ow-ld-d"></span>'
            f'<span class="ow-ld-t"><span class="ow-ld-n">{name}</span>'
            f'<span class="ow-ld-r">{role}</span></span></button>')

def field(label, ph, val=''):
    return (f'<label class="ow-ld-fl"><span class="ow-mt-l">{label}</span>'
            f'<input class="ow-ld-in" value="{val}" placeholder="{ph}"></label>')

def lines(items):
    return ''.join(f'<div class="ow-ld-l"><span class="ow-ld-l-n">{n}</span>'
                   f'<span class="ow-ld-l-q">{q}</span></div>' for n,q in items)

def page(spine_html, body, foot, w=680, h=560):
    return f'''  <div class="paper">
    {head()}
    <div class="ow-op">
      <div class="ow-op-sp">{spine_html}</div>
      <div class="ow-op-r">
        <div class="ow-op-lh"><span style="flex:1">Who is carrying it</span></div>
        <div class="ow-ld">
{body}
        </div>
      </div>
    </div>
    <div class="ow-dlg-f">
      {foot}
    </div>
  </div>
'''
