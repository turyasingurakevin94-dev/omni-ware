ICON_PRINT = '<svg class="icon ow-i16" viewBox="0 0 24 24"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="7" rx="1.6"/><path d="M6 16h12v5H6z"/></svg>'
ICON_DOTS  = '<svg class="icon ow-i16" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>'
ICON_X     = '<svg class="icon ow-i16" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'
ICON_TICK  = '<svg class="icon ow-i11" viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7"/></svg>'
ICON_WA    = '<svg class="icon ow-i14" viewBox="0 0 24 24"><path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/></svg>'
ICON_WARN  = '<svg class="icon ow-i12" viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 9v5M12 16.5v.5"/></svg>'

STAGES = [('Taken','now'), ('Buying',''), ('Preparing',''), ('Out',''), ('Delivered','')]

def spine(at=0, taken_events=None, chip=None):
    out = []
    for j, (name, _) in enumerate(STAGES):
        cls = 'ow-on' if j < at else ('ow-now' if j == at else '')
        bits = [f'<span class="ow-op-s-n">{name}</span>']
        if j <= at:
            bits.append('<span class="ow-op-s-t">Tue 18:37%s</span>' % (' &middot; 1d 18h' if j == at else ''))
        if j == 0 and taken_events:
            for t, w in taken_events:
                bits.append(f'<span class="ow-op-e"><em class="ow-op-ts">{t}</em> {w}</span>')
        if j == at and chip:
            bits.append(chip)
        out.append(f'<div class="ow-op-s {cls}">' + ''.join(bits) + '</div>')
    return ''.join(out)

def head():
    return f'''<div class="ow-dlg-h">
      <span class="ow-dlg-t">A99 Trade Center</span>
      <span class="ow-dlg-id">#365</span>
      <span class="ow-dlg-s">Trade Center</span>
      <span class="ow-dlg-sp"></span>
      <button type="button" class="ow-dlg-x" aria-label="Print the packing list">{ICON_PRINT}</button>
      <button type="button" class="ow-dlg-x" aria-label="Other moves">{ICON_DOTS}</button>
      <button type="button" class="ow-dlg-x" aria-label="Close">{ICON_X}</button>
    </div>'''

def strip(asked, total, confirmed, pay, act=''):
    bad = ' ow-bad' if confirmed < total else ''
    return f'''<div class="ow-sc-fig">
        <span class="ow-sc-c"><span class="ow-mt-l">Asked</span><span class="ow-sc-c-v">{asked} of {total}</span></span>
        <span class="ow-sc-c"><span class="ow-mt-l">Confirmed</span><span class="ow-sc-c-v{bad}">{confirmed}</span></span>
        <span class="ow-sc-c"><span class="ow-mt-l">To pay them</span><span class="ow-sc-c-v">{pay}</span></span>
        <span class="ow-dlg-sp"></span>
        {act}
      </div>'''

def card(n, name, place, pay, lines, state, state_cls='', acts='', band='', mark=None, nn=False):
    mk = mark if mark is not None else str(n)
    nocls = ''
    if mark == ICON_TICK: nocls = ' ow-sp-no ow-on'
    elif mark == '!': nocls = ' ow-sp-no ow-bad'
    rows = ''.join(
        f'<div class="ow-sc-r"><span class="ow-sc-r-n" title="{nm}">{nm}</span>'
        f'<span class="ow-sc-r-q">{q}</span><span class="ow-sp-ea">@ {ea}</span></div>'
        for nm, q, ea in lines)
    return f'''<div class="ow-sc">
          <div class="ow-sc-t"><span class="ow-sc-no{nocls}">{mk}</span><span class="ow-sc-p" title="{name}">{name}</span></div>
          <div class="ow-sc-s" title="{place}">{place}</div>
          <div class="ow-sc-v">{pay} <span class="ow-sc-u">to pay them</span></div>
          <div class="ow-sc-i">{rows}</div>
          {band}
          {'<div class="ow-sp-nn">' + ICON_WARN + 'No WhatsApp number on file &mdash; the message opens for you to pick the chat</div>' if nn else ''}
          <div class="ow-sc-f">
            <span class="ow-sc-st{state_cls}">{state}</span>
            <span class="ow-sp-ans">{acts}</span>
          </div>
        </div>'''

def ghost(label, icon=''):
    return f'<button type="button" class="btn btn-ghost ow-sm">{icon}{label}</button>'
def accent(label, icon=''):
    return f'<button type="button" class="btn btn-accent ow-sm">{icon}{label}</button>'

def page(spine_html, strip_html, cards, foot_html):
    return f'''  <div class="paper">
    {head()}
    <div class="ow-op">
      <div class="ow-op-sp">{spine_html}</div>
      <div class="ow-op-r">
        {strip_html}
        <div class="ow-sc-g ow-sp-g">
        {cards}
        </div>
      </div>
    </div>
    <div class="ow-dlg-f">
      {foot_html}
    </div>
  </div>
'''
